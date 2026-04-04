using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using VisioraAPI.Models;

namespace VisioraAPI.Services;

public class OpenAIService
{
    private readonly string _apiKey;

    public OpenAIService(IConfiguration config)
    {
        _apiKey =
            Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? config["OpenAI:ApiKey"]
            ?? "";

        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new Exception("API Key da OpenAI não configurada.");
    }

    public async Task<RespostaIA> AnalisarImagem(
        string base64,
        string? modo = "automatico",
        string? pergunta = "",
        string? contextoRecente = "")
    {
        using var client = new HttpClient();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _apiKey);

        var modoNormalizado = NormalizarModo(modo);
        var prompt = MontarPrompt(modoNormalizado, pergunta, contextoRecente);

        var body = new
        {
            model = "gpt-4o-mini",
            response_format = new
            {
                type = "json_object"
            },
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Você é o Visiora, um assistente visual acessível para pessoas com deficiência visual. Sua prioridade é segurança, autonomia, orientação espacial, utilidade prática, continuidade e linguagem natural. Responda apenas em JSON válido."
                },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "text",
                            text = prompt
                        },
                        new
                        {
                            type = "image_url",
                            image_url = new
                            {
                                url = $"data:image/jpeg;base64,{base64}"
                            }
                        }
                    }
                }
            },
            temperature = modoNormalizado == "consulta" ? 0.45 : 0.25,
            max_tokens = modoNormalizado == "consulta" ? 380 : 280
        };

        var json = JsonSerializer.Serialize(body);

        using var response = await client.PostAsync(
            "https://api.openai.com/v1/chat/completions",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        var result = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception($"Erro OpenAI: {result}");

        using var doc = JsonDocument.Parse(result);

        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(content))
            throw new Exception("Resposta vazia da OpenAI.");

        content = LimparJsonResposta(content);

        var respostaIA = JsonSerializer.Deserialize<RespostaIA>(
            content,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        if (respostaIA == null)
            throw new Exception("Não foi possível converter a resposta da IA.");

        return SanitizarResposta(respostaIA, modoNormalizado);
    }

    private string NormalizarModo(string? modo)
    {
        if (string.IsNullOrWhiteSpace(modo))
            return "automatico";

        return modo.Trim().Equals("consulta", StringComparison.OrdinalIgnoreCase)
            ? "consulta"
            : "automatico";
    }

    private string MontarPrompt(string modo, string? pergunta, string? contextoRecente)
    {
        return modo == "consulta"
            ? MontarPromptConsulta(pergunta, contextoRecente)
            : MontarPromptAutomatico(contextoRecente);
    }

    private string MontarBlocoContexto(string? contextoRecente)
    {
        var contextoLimpo = LimparTexto(contextoRecente);

        if (string.IsNullOrWhiteSpace(contextoLimpo))
            contextoLimpo = "Sem contexto recente relevante.";

        return @"CONTEXTO RECENTE:
" + contextoLimpo + @"

Use esse contexto somente para melhorar continuidade.
Priorize sempre a imagem atual.
Não invente fatos.
Use o contexto para perceber:
- se a cena continua estável
- se um obstáculo permanece
- se algo parece ter se aproximado
- se você já orientou algo parecido há pouco
- se vale uma confirmação curta em vez de repetir tudo.";
    }

    private string MontarPromptAutomatico(string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);

        return @"Você é o Visiora, um assistente visual pensado para pessoas com deficiência visual.
Você não é um narrador de imagens. Você transforma visão em ajuda prática.

" + blocoContexto + @"

Responda APENAS em JSON válido.

Formato obrigatório:
{
  ""descricao"": """",
  ""objetos"": [],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": """",
  ""direcao"": """",
  ""importancia"": """"
}

OBJETIVO NO MODO AUTOMÁTICO:
Decidir o que vale a pena comunicar para manter segurança, contexto e autonomia.
Você pode responder com pouca informação, mas não deve abandonar o usuário no silêncio quando houver orientação útil.

REGRAS GERAIS:
- Priorize segurança, locomoção, orientação e utilidade cotidiana.
- Evite detalhes visuais irrelevantes.
- Não invente objetos, distâncias exatas ou ações.
- Não use linguagem técnica.
- Não repita a mesma ideia em vários campos.
- Prefira frases curtas, naturais e úteis para áudio.
- Pense como um assistente calmo e confiável.
- Quando o ambiente estiver livre, você pode dar uma confirmação curta ocasional.
- Algo pode ser importante mesmo sem ser perigoso, se ajudar a pessoa a se orientar melhor.
- Não transforme qualquer pessoa ou móvel em alerta automaticamente.
- Use noções aproximadas como: à frente, próximo, mais livre, bloqueando passagem, à esquerda, à direita.

COMO JULGAR IMPORTÂNCIA:
- alta:
  risco, obstáculo próximo, bloqueio claro, necessidade imediata de ação
- media:
  orientação útil, mudança relevante, pessoa próxima, porta, cadeira, mesa, abertura de caminho, confirmação útil de contexto
- baixa:
  ambiente estável sem novidade útil real

REGRAS POR CAMPO:

1. descricao
- No máximo 1 frase curta.
- Deve resumir o que mais importa para o momento.
- Pode ser uma confirmação útil, como caminho livre, ambiente estável, alguém próximo, objeto relevante.

2. objetos
- Liste apenas objetos úteis para locomoção ou contexto imediato.
- Exemplos: porta, cadeira, mesa, pessoa, escada, mochila no chão, balcão.

3. alertas
- Use somente para risco ou atenção clara.
- Exemplos:
  ""obstáculo à frente"",
  ""caminho parcialmente bloqueado"",
  ""obstáculo muito próximo"",
  ""pessoa muito próxima à direita""
- Se não houver risco, devolva [].

4. pessoa
- Preencha apenas se houver pessoa visível e isso ajudar.
- Exemplo: ""há uma pessoa próxima à esquerda""

5. sugestao
- Deve ser curta, prática e útil.
- Pode ser orientação de desvio, cuidado, aproximação ou confirmação.
- Boas sugestões:
  ""vá um pouco para a direita"",
  ""siga com cuidado"",
  ""o caminho parece livre à frente"",
  ""há espaço melhor pela esquerda""
- Não use sugestão vazia se houver ajuda útil a dar.
- Não use comando agressivo ou robótico.

6. direcao
- Use apenas:
  ""esquerda"", ""direita"", ""frente"", ""centro"", ""sem-direcao""

7. importancia
- Use apenas:
  ""baixa"", ""media"", ""alta""

NÃO FAÇA:
- não descreva roupa, cor, decoração ou fundo sem utilidade prática
- não invente profundidade exata
- não use texto fora do JSON
- não deixe tudo vazio se houver algo útil para orientação

EXEMPLOS BONS:

{
  ""descricao"": ""O caminho à frente parece livre."",
  ""objetos"": [""porta""],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": ""pode seguir com cuidado"",
  ""direcao"": ""frente"",
  ""importancia"": ""media""
}

{
  ""descricao"": ""Há um obstáculo ocupando a frente."",
  ""objetos"": [""cadeira""],
  ""alertas"": [""obstáculo à frente""],
  ""pessoa"": """",
  ""sugestao"": ""desvie um pouco pela esquerda"",
  ""direcao"": ""frente"",
  ""importancia"": ""alta""
}

{
  ""descricao"": ""Tem uma pessoa próxima à esquerda."",
  ""objetos"": [""pessoa""],
  ""alertas"": [],
  ""pessoa"": ""há uma pessoa próxima à esquerda"",
  ""sugestao"": ""mantenha atenção nesse lado"",
  ""direcao"": ""esquerda"",
  ""importancia"": ""media""
}";
    }

    private string MontarPromptConsulta(string? pergunta, string? contextoRecente)
    {
        var perguntaLimpa = string.IsNullOrWhiteSpace(pergunta)
            ? "Descreva o ambiente de forma útil para uma pessoa com deficiência visual."
            : pergunta.Trim();

        var blocoContexto = MontarBlocoContexto(contextoRecente);

        return @"Você é o Visiora, um assistente visual acessível.
O usuário fez uma pergunta sobre o ambiente.

PERGUNTA:
" + perguntaLimpa + @"

" + blocoContexto + @"

Responda APENAS em JSON válido.

Formato obrigatório:
{
  ""descricao"": """",
  ""objetos"": [],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": """",
  ""direcao"": """",
  ""importancia"": """"
}

OBJETIVO NO MODO CONSULTA:
Responder de forma mais completa, mas ainda prática.
Você deve ajudar a pessoa a entender a situação e agir melhor no espaço.

REGRAS:
- Priorize utilidade prática em vez de descrição visual.
- Soe natural, claro e humano.
- Responda diretamente ao que foi perguntado.
- Não invente informações.
- Se houver risco, destaque isso.
- Se houver espaço livre, diga isso com clareza.
- Se existir pessoa ou objeto relevante, diga apenas se ajudar na resposta.
- Use noções aproximadas de posição e proximidade.

COMO PREENCHER:
- descricao:
  1 a 3 frases curtas, naturais e úteis
- objetos:
  somente itens relevantes
- alertas:
  só se houver risco ou atenção importante
- pessoa:
  se houver alguém visível e isso importar
- sugestao:
  uma orientação útil e curta quando fizer sentido
- direcao:
  esquerda, direita, frente, centro ou sem-direcao
- importancia:
  baixa, media ou alta

EXEMPLOS DE TOM:
- ""Você está em um ambiente interno com espaço razoavelmente livre.""
- ""Há uma mesa à frente e uma cadeira próxima, então vale ir com cuidado.""
- ""Tem uma pessoa por perto, mas o caminho parece livre.""
- ""O espaço está mais aberto pela direita.""

NÃO FAÇA:
- não escreva fora do JSON
- não use linguagem técnica
- não encha a resposta de detalhes irrelevantes";
    }

    private string LimparJsonResposta(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return "";

        content = content.Trim();

        if (content.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            content = content.Replace("```json", "", StringComparison.OrdinalIgnoreCase).Replace("```", "").Trim();

        if (content.StartsWith("```"))
            content = content.Replace("```", "").Trim();

        var primeiroJson = content.IndexOf('{');
        var ultimoJson = content.LastIndexOf('}');

        if (primeiroJson >= 0 && ultimoJson > primeiroJson)
            content = content.Substring(primeiroJson, ultimoJson - primeiroJson + 1);

        return content.Trim();
    }

    private RespostaIA SanitizarResposta(RespostaIA resposta, string modo)
    {
        resposta.Descricao = LimparTexto(resposta.Descricao);
        resposta.Pessoa = LimparTexto(resposta.Pessoa);
        resposta.Sugestao = LimparTexto(resposta.Sugestao);
        resposta.Direcao = SanitizarDirecao(resposta.Direcao);
        resposta.Importancia = SanitizarImportancia(resposta.Importancia);

        resposta.Objetos = SanitizarLista(resposta.Objetos);
        resposta.Alertas = SanitizarLista(resposta.Alertas);

        if (modo == "automatico")
        {
            if (resposta.Importancia == "baixa" && resposta.Alertas.Count == 0 && string.IsNullOrWhiteSpace(resposta.Sugestao))
            {
                resposta.Direcao = "sem-direcao";
            }

            if (SugestaoEhGenerica(resposta.Sugestao) && resposta.Importancia != "alta")
            {
                if (TemOrientacaoUtil(resposta))
                    resposta.Sugestao = HumanizarSugestaoGenerica(resposta);
                else
                    resposta.Sugestao = "";
            }
        }

        if (string.IsNullOrWhiteSpace(resposta.Descricao) && TemOrientacaoUtil(resposta))
        {
            resposta.Descricao = MontarDescricaoFallback(resposta);
        }

        return resposta;
    }

    private bool TemOrientacaoUtil(RespostaIA resposta)
    {
        if (resposta.Alertas?.Count > 0) return true;
        if (!string.IsNullOrWhiteSpace(resposta.Sugestao)) return true;
        if (!string.IsNullOrWhiteSpace(resposta.Pessoa)) return true;
        if (resposta.Objetos?.Count > 0 && resposta.Importancia != "baixa") return true;
        return resposta.Direcao != "sem-direcao" && resposta.Importancia != "baixa";
    }

    private string MontarDescricaoFallback(RespostaIA resposta)
    {
        if (resposta.Alertas?.Count > 0)
            return LimparTexto(resposta.Alertas[0]);

        if (!string.IsNullOrWhiteSpace(resposta.Pessoa))
            return LimparTexto(resposta.Pessoa);

        if (resposta.Objetos?.Count > 0)
            return $"Há {resposta.Objetos[0]} relevante no ambiente.";

        return "";
    }

    private string HumanizarSugestaoGenerica(RespostaIA resposta)
    {
        if (resposta.Alertas?.Count > 0)
            return "siga com cuidado";

        if (resposta.Direcao == "frente")
            return "o caminho parece livre à frente";

        if (resposta.Direcao == "esquerda")
            return "há espaço melhor pela esquerda";

        if (resposta.Direcao == "direita")
            return "há espaço melhor pela direita";

        return "";
    }

    private string LimparTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim().Replace("\n", " ").Replace("\r", " ");

        while (texto.Contains("  "))
            texto = texto.Replace("  ", " ");

        return texto.Trim();
    }

    private List<string> SanitizarLista(IEnumerable<string>? lista)
    {
        if (lista == null)
            return new List<string>();

        return lista
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(LimparTexto)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();
    }

    private string SanitizarDirecao(string? direcao)
    {
        var valor = LimparTexto(direcao).ToLower();

        return valor switch
        {
            "esquerda" => "esquerda",
            "direita" => "direita",
            "frente" => "frente",
            "centro" => "centro",
            _ => "sem-direcao"
        };
    }

    private string SanitizarImportancia(string? importancia)
    {
        var valor = LimparTexto(importancia).ToLower();

        return valor switch
        {
            "alta" => "alta",
            "media" => "media",
            _ => "baixa"
        };
    }

    private bool SugestaoEhGenerica(string? sugestao)
    {
        var texto = LimparTexto(sugestao).ToLower();

        if (string.IsNullOrWhiteSpace(texto))
            return false;

        var genericas = new List<string>
        {
            "mova-se para frente",
            "siga em frente",
            "continue em frente",
            "avance",
            "continue",
            "siga reto",
            "pode seguir",
            "siga",
            "vá em frente"
        };

        return genericas.Contains(texto);
    }
}
