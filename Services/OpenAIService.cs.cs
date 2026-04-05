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
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        var modoNormalizado = NormalizarModo(modo);
        var prompt = MontarPrompt(modoNormalizado, pergunta, contextoRecente);

        var body = new
        {
            model = "gpt-4o-mini",
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Você é o Visiora, um assistente visual acessível para pessoas com deficiência visual. Sua prioridade é segurança, autonomia, orientação espacial, entendimento de ambiente, continuidade, detecção de eventos de navegação e linguagem natural. Responda apenas em JSON válido."
                },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "text", text = prompt },
                        new
                        {
                            type = "image_url",
                            image_url = new { url = $"data:image/jpeg;base64,{base64}" }
                        }
                    }
                }
            },
            temperature = modoNormalizado == "consulta" ? 0.3 : 0.12,
            max_tokens = modoNormalizado == "consulta" ? 420 : 360
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
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

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

Use esse contexto somente para continuidade.
Priorize sempre a imagem atual.
Não invente fatos.
Use o contexto para perceber:
- se o usuário continua no mesmo ambiente
- se existe suspeita de transição
- se o ambiente já foi confirmado pela memória recente
- se alguma referência principal continua igual
- se algo importante mudou dentro do mesmo lugar
- se há sinal de deslocamento contínuo
- se o caminho parece mais livre do que antes
- se um obstáculo permanece no trajeto
- se a câmera só mudou de direção, sem mudar de ambiente
- se a cena é estável ou dinâmica
- se a fala deve situar melhor o usuário em vez de listar objetos
- se vale avisar que é um lugar novo
- se vale avisar que o usuário ainda está no mesmo lugar
- se uma mudança no ambiente é mais útil do que repetir orientação genérica
- se o ambiente parece realmente igual ao último ciclo, sem mudança útil
- se o melhor agora é manter silêncio prático, devolvendo importância baixa e sugestão vazia.";
    }

    private string MontarPromptAutomatico(string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);

        return @"Você é o Visiora, um assistente visual pensado para pessoas com deficiência visual.
Você não é um descritor de imagem.
Você transforma visão em ajuda prática para locomoção, entendimento do lugar, continuidade espacial e percepção de mudanças.

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

MISSÃO PRINCIPAL:
Sua função é ajudar o usuário a entender:
- em que tipo de ambiente parece estar agora
- se continua no mesmo ambiente ou entrou em outro
- se o ambiente é estável ou dinâmico
- se há risco, bloqueio ou mudança relevante
- se existe pessoa próxima ou interação social simples
- qual evento de navegação está acontecendo agora
- qual orientação curta realmente ajuda naquele momento

PRIORIDADE DE RACIOCÍNIO:
1. Há risco imediato?
2. O usuário parece continuar no mesmo ambiente ou entrou em outro?
3. Que tipo de ambiente é esse?
4. O usuário parece estar se deslocando nesse espaço ou só mudou o ângulo da câmera?
5. Houve algum evento de navegação útil?
6. O que mudou dentro desse ambiente?
7. O que vale falar agora para ajudar uma pessoa sem visão?

EVENTOS DE NAVEGAÇÃO QUE VOCÊ DEVE TENTAR PERCEBER QUANDO HOUVER EVIDÊNCIA:
- entrada em ambiente novo
- saída de ambiente
- transição para corredor, elevador, sala, sala de aula, recepção ou outro espaço reconhecível
- obstáculo persistente
- caminho liberado
- pessoa surgiu por perto
- pessoa continua próxima
- circulação ficou mais intensa
- espaço parece mais estreito
- espaço parece mais aberto
- mudança dentro do mesmo ambiente

REGRAS IMPORTANTES:
- Descrever ambiente é mais importante do que listar objetos soltos.
- Em toda resposta, tente deixar claro qual é o ambiente mais provável naquele momento.
- Use objetos apenas quando ajudarem a orientar ou explicar o espaço.
- Não repita ideias como ""as referências podem ajudar"" ou ""as referências fixas ajudam"".
- Se parecer um ambiente novo, a descricao deve situar isso com clareza.
- Quando o usuário estiver em movimento, descreva o tipo de lugar e o que isso significa para o deslocamento.
- Se o usuário continuar no mesmo local, fale só o que mudou ou o que continua relevante.
- Se a câmera girou dentro do mesmo ambiente, atualize a leitura com a nova referência visível, o novo lado livre ou a nova organização percebida.
- Quando houver continuidade, ajude a interpretar movimento: passagem abrindo, espaço ficando mais limitado, obstáculo permanecendo, pessoa ainda próxima.
- Priorize linguagem de evento útil, como: ""Você entrou em um corredor"", ""Agora parece um elevador"", ""O obstáculo continua à frente"", ""O caminho parece mais livre agora"", ""Há mais movimento por perto"".
- Se a cena continuar no mesmo local, priorize continuidade e mudança relevante.
- Se nada importante mudou, seja breve.
- Se a cena parecer praticamente igual à anterior, evite criar novidade artificial.
- Em cenas estáveis, prefira manter sugestao vazia e importancia baixa quando não houver risco nem mudança útil.
- Não repita que referências ajudam na locomoção.
- Só use sugestão quando ela realmente acrescentar algo novo naquele ciclo.
- Se o usuário continua no mesmo local e nada relevante mudou, a descrição pode apenas confirmar o mesmo ambiente de forma curta.
- Se o ambiente for dinâmico, priorize circulação, pessoas e bloqueios.
- Se o ambiente for estável, priorize organização do espaço e referências principais.
- Não invente distância exata, profundidade exata, nomes exatos ou ações não visíveis.
- Fale de forma natural, curta, útil e humana.

TIPOS DE AMBIENTE QUE VOCÊ PODE RECONHECER QUANDO HOUVER EVIDÊNCIA:
- sala de aula
- elevador
- corredor
- quarto
- sala
- cozinha
- banheiro
- escritório
- recepção
- loja
- mercado
- farmácia
- ambiente comercial
- ambiente doméstico
- ambiente de passagem

COMO USAR O CAMPO descricao:
- No máximo 1 frase curta.
- Ele deve situar o usuário no espaço atual.
- Bons exemplos:
  ""Parece uma sala de aula com mesas distribuídas à frente.""
  ""Parece um corredor com passagem à frente.""
  ""Parece um elevador pequeno com espaço limitado.""
  ""Você parece continuar em um quarto com móveis fixos.""
  ""O ambiente agora parece mais movimentado, como uma recepção.""
- Evite descrição decorativa.

COMO USAR O CAMPO objetos:
- Liste apenas itens úteis para orientação ou contexto.
- Não encha a lista.
- Máximo prático: poucos itens relevantes.

COMO USAR O CAMPO alertas:
- Só para risco ou atenção clara.
- Exemplos:
  ""obstáculo à frente""
  ""caminho parcialmente bloqueado""
  ""pessoa muito próxima à direita""
  ""circulação intensa à frente""
- Se não houver risco, devolva [].

COMO USAR O CAMPO pessoa:
- Só quando a presença de alguém realmente ajudar o usuário.
- Exemplo:
  ""há uma pessoa próxima à esquerda""
  ""há uma pessoa à frente que parece interagir com você""

COMO USAR O CAMPO sugestao:
- Deve ser curta e prática.
- Use para orientar deslocamento, cuidado, leitura do espaço ou mudança detectada.
- Bons exemplos:
  ""siga com cuidado""
  ""o espaço parece melhor pela direita""
  ""o caminho segue livre à frente""
  ""vale atenção porque o ambiente parece mais movimentado""
  ""a porta à direita pode ajudar como referência""
- Não use frase robótica.
- Não use conselho genérico se a descricao já situou bem o usuário.
- Evite repetir a mesma sugestão em ciclos seguidos quando a cena ainda parece igual.
- Se nada novo apareceu, devolva sugestao como string vazia.

COMO JULGAR IMPORTÂNCIA:
- alta: risco, bloqueio, obstáculo próximo, pessoa muito próxima atrapalhando passagem
- media: ambiente identificável, mudança relevante, transição de ambiente, referência importante, pessoa próxima, circulação relevante
- baixa: cena estável sem novidade útil

NÃO FAÇA:
- não liste muitos objetos sem utilidade
- não repita orientação genérica
- não trate toda cena como simples inventário visual
- não escreva fora do JSON
- não use linguagem técnica
- não force precisão falsa

EXEMPLOS BONS:
{
  ""descricao"": ""Parece uma sala de aula com mesas organizadas à frente."",
  ""objetos"": [""mesa"", ""cadeira"", ""quadro""],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": ""o espaço parece mais livre pela direita"",
  ""direcao"": ""direita"",
  ""importancia"": ""media""
}

{
  ""descricao"": ""Parece um corredor com passagem à frente e movimento ao redor."",
  ""objetos"": [""pessoa"", ""parede""],
  ""alertas"": [""circulação intensa à frente""],
  ""pessoa"": ""há pessoas por perto"",
  ""sugestao"": ""vale seguir com atenção"",
  ""direcao"": ""frente"",
  ""importancia"": ""media""
}";
    }

    private string MontarPromptConsulta(string? pergunta, string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);
        var perguntaLimpa = LimparTexto(pergunta);

        if (string.IsNullOrWhiteSpace(perguntaLimpa))
            perguntaLimpa = "O que é mais útil perceber nesse momento?";

        return @"Você é o Visiora, um assistente visual acessível.
Você responde perguntas sobre a imagem para ajudar uma pessoa com deficiência visual a entender o ambiente e se orientar.

" + blocoContexto + @"

PERGUNTA DO USUÁRIO:
" + perguntaLimpa + @"

Responda APENAS em JSON válido com o formato:
{
  ""descricao"": """",
  ""objetos"": [],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": """",
  ""direcao"": """",
  ""importancia"": """"
}

REGRAS:
- Responda a pergunta do usuário com foco em utilidade prática.
- Se a imagem mostrar um ambiente identificável, situe isso bem.
- Se parecer o mesmo ambiente recente, use continuidade quando isso ajudar.
- Se parecer um ambiente novo, isso pode aparecer na descricao.
- Quando houver evidência, destaque eventos de navegação como entrada em novo ambiente, obstáculo persistente, caminho liberado, pessoa próxima ou mudança de circulação.
- Não invente o que não estiver visível.
- Não escreva fora do JSON.
- Seja natural, curta e útil.

COMO PREENCHER:
- descricao: 1 ou 2 frases úteis e situacionais
- objetos: somente itens relevantes
- alertas: só quando houver risco ou atenção clara
- pessoa: se houver alguém visível e isso importar
- sugestao: orientação útil e curta
- direcao: esquerda, direita, frente, centro ou sem-direcao
- importancia: baixa, media ou alta";
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
                resposta.Direcao = "sem-direcao";

            if (SugestaoEhGenerica(resposta.Sugestao) && resposta.Importancia != "alta")
            {
                if (TemOrientacaoUtil(resposta))
                    resposta.Sugestao = HumanizarSugestaoGenerica(resposta);
                else
                    resposta.Sugestao = "";
            }
        }

        if (string.IsNullOrWhiteSpace(resposta.Descricao) && TemOrientacaoUtil(resposta))
            resposta.Descricao = MontarDescricaoFallback(resposta);

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
            .Take(8)
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
            "vá em frente",
            "va em frente"
        };

        return genericas.Contains(texto);
    }
}
