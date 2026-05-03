using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using VisioraAPI.Models;

namespace VisioraAPI.Services;

public class OpenAIService
{
    private readonly string _apiKey;
    private static readonly HttpClient _httpClient = new();

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
        if (string.IsNullOrWhiteSpace(base64))
            throw new Exception("Imagem não informada para análise.");

        var modoNormalizado = NormalizarModo(modo);
        var prompt = MontarPrompt(modoNormalizado, pergunta, contextoRecente);

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        var body = new
        {
            model = "gpt-4o-mini",
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Você é o Visiora, um assistente visual de percepção ativa para pessoas com deficiência visual. Responda sempre em JSON válido. Seu foco é situar, alertar, apontar pontos úteis e apoiar autonomia sem presumir destino."
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
                            image_url = new
                            {
                                url = $"data:image/jpeg;base64,{base64}"
                            }
                        }
                    }
                }
            },
            temperature = modoNormalizado switch
            {
                "consulta" => 0.28,
                "guia" => 0.08,
                _ => 0.12
            },
            max_tokens = modoNormalizado switch
            {
                "consulta" => 420,
                "guia" => 460,
                _ => 300
            }
        };

        var json = JsonSerializer.Serialize(body);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request);
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

        var valor = modo.Trim().ToLowerInvariant();

        if (valor.Contains("consulta"))
            return "consulta";

        if (valor.Contains("guia"))
            return "guia";

        return "automatico";
    }

    private string MontarPrompt(string modo, string? pergunta, string? contextoRecente)
    {
        return modo switch
        {
            "consulta" => MontarPromptConsulta(pergunta, contextoRecente),
            "guia" => MontarPromptGuiaRapido(pergunta, contextoRecente),
            _ => MontarPromptAutomatico(contextoRecente)
        };
    }

    private string MontarBlocoContexto(string? contextoRecente)
    {
        var contextoLimpo = LimparTexto(contextoRecente);

        if (string.IsNullOrWhiteSpace(contextoLimpo))
            contextoLimpo = "Sem contexto recente relevante.";

        return @"CONTEXTO RECENTE DO VISIORA:
" + contextoLimpo + @"

Use esse contexto apenas para continuidade.
Priorize sempre a imagem atual.
Não invente fatos.
Evite repetir a mesma fala se nada mudou.
Perceba se o usuário continua no mesmo lugar, se virou a câmera, se entrou em outro ambiente, se apareceu pessoa, obstáculo, passagem, porta ou referência útil.";
    }

    private string MontarPromptGuiaRapido(string? pergunta, string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);
        var pedidoUsuario = LimparTexto(pergunta);

        if (string.IsNullOrWhiteSpace(pedidoUsuario))
            pedidoUsuario = "Ciclo automático de percepção ativa.";

        return $$"""
Você é o Visiora em MODO PERCEPÇÃO ATIVA para uma pessoa com deficiência visual.
Você NÃO é um Waze literal e NÃO deve presumir que a pessoa quer ir para algum lugar.
Você é um acompanhante visual: percebe o ambiente, situa a pessoa, aponta pontos úteis e fica pronto para avisar mudanças, riscos, pessoas e passagens.

{{blocoContexto}}

ESTADO DO CICLO ATUAL ENVIADO PELO FRONT:
{{pedidoUsuario}}

Responda APENAS em JSON válido, neste formato:
{
  "descricao": "",
  "objetos": [],
  "alertas": [],
  "pessoa": "",
  "sugestao": "",
  "direcao": "",
  "importancia": "",
  "eventoGuia": "",
  "caminhoStatus": "",
  "falaCurta": "",
  "pontosInteresse": [],
  "resumoAmbiente": "",
  "estadoUsuarioInferido": "",
  "motivoFala": "",
  "observacaoMudanca": "",
  "ambienteProvavel": ""
}

PERGUNTA PRINCIPAL DO VISIORA:
O que a pessoa precisa saber agora para compreender o ambiente e se manter segura, sem eu presumir o destino dela?

MODO DE PENSAR:
- Se é primeira leitura, dê contexto suficiente para a pessoa formar um mapa mental inicial.
- Se a pessoa parece parada, descreva e observe; não empurre movimento.
- Se a câmera mudou, informe o que apareceu, sumiu ou ficou relevante.
- Se apareceu porta, passagem, pessoa, cadeira, obstáculo ou saída provável, destaque como ponto de interesse.
- Se houver risco, interrompa com fala curta e direta.
- Se nada útil mudou, use silêncio.
- Não transforme toda cena em comando de locomoção.

EVENTO_GUIA deve ser um destes:
- inicio: primeira leitura do ambiente ou início do loop
- risco: obstáculo, bloqueio, escada, pessoa no caminho ou algo próximo que exija cuidado
- pessoa: pessoa próxima, pessoa entrando no campo de visão ou possível interação
- novo_ambiente: mudança clara de cômodo/local
- ponto_interesse: porta, saída provável, passagem, mesa, cadeira, balcão, quadro ou referência útil apareceu
- mudanca: algo relevante mudou dentro do mesmo ambiente
- observacao: atualização útil sem risco, sem mandar a pessoa andar
- livre: caminho/passagem livre, somente se isso for útil no momento
- confirmacao: confirmação rara de funcionamento
- silencio: nada útil mudou

CAMINHO_STATUS deve ser um destes:
- livre
- parcialmente_livre
- bloqueado
- estreito
- movimentado
- desconhecido

COMO USAR A DESCRICAO:
- Na primeira leitura: faça uma descrição ambiental completa, em 2 a 4 frases curtas.
- Inclua: tipo provável de ambiente, organização geral, objetos grandes úteis, porta/passagem se visível, pessoas/riscos se houver.
- Não diga apenas que parece um quarto ou uma sala. Isso é pouco.
- Em movimento ou mudança: descreva somente o que mudou ou ficou relevante.
- Não descreva decoração sem utilidade.

COMO USAR FALA_CURTA:
- É a fala que o usuário pode ouvir.
- Deve ser natural, calma e confortável.
- Na primeira leitura, pode ter 2 a 4 frases curtas.
- Depois da primeira leitura, prefira 1 frase curta.
- Para risco: fale imediatamente e com poucas palavras.
- Para ponto de interesse: informe sem comandar. Exemplo: Há uma porta visível à direita, caso você precise sair.
- Para passagem: informe como possibilidade. Exemplo: A passagem à frente parece livre, se você for se mover.

FRASES BOAS:
- Parece uma sala de aula. Há mesas e cadeiras distribuídas, com uma área mais livre ao centro. Também aparece uma porta à direita.
- Há uma porta visível à direita, caso você precise sair.
- Uma pessoa apareceu à frente.
- Cuidado, cadeira próxima no centro.
- A passagem à frente parece livre, se você for se mover.
- Parece que você entrou em uma área de passagem.

EVITE, a menos que haja risco ou pedido claro de direção:
- siga em frente
- vire à direita
- continue pelo centro
- vá para...
- use X para se orientar

Prefira:
- há X à direita
- X aparece como referência
- a passagem parece livre se você for se mover
- cuidado se for se mover

PONTOS DE INTERESSE:
Inclua em pontosInteresse itens úteis para a autonomia: porta, saída provável, passagem, cadeira, mesa, pessoa, escada, balcão, quadro/lousa, obstáculo, corredor, elevador.

SUGESTAO:
- Só use sugestao se ela ajudar de forma condicional ou segura.
- Prefira: se for se mover, atenção à cadeira no centro; em vez de mandar seguir pela direita.

IMPORTANCIA:
- alta: risco, obstáculo próximo, pessoa no caminho, escada, bloqueio claro
- media: ambiente novo, pessoa próxima, porta/passagem útil, mudança relevante
- baixa: cena estável ou sem novidade útil

SE NADA MUDOU:
- eventoGuia = silencio
- importancia = baixa
- falaCurta = vazio
- sugestao = vazio

LEMBRE:
A pessoa não enxerga. Ela precisa se sentir situada, segura e acompanhada, mas não controlada. Informe possibilidades, riscos e referências; não presuma o destino.
""";
    }


    private string MontarPromptAutomatico(string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);

        return @"Você é o Visiora, um assistente visual acessível para pessoas com deficiência visual.
Você não é um descritor de imagem comum. Você transforma visão em orientação prática, contexto e segurança.

" + blocoContexto + @"

Responda APENAS em JSON válido, neste formato:
{
  ""descricao"": """",
  ""objetos"": [],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": """",
  ""direcao"": """",
  ""importancia"": """"
}

PRIORIDADES:
1. Segurança e obstáculos.
2. Tipo de ambiente.
3. Caminho livre ou bloqueado.
4. Pessoa próxima ou interação.
5. Mudança de ambiente ou mudança de direção da câmera.
6. Referência útil para locomoção.

REGRAS:
- A descricao deve ser curta e útil para uma pessoa sem visão.
- Não repita frases genéricas.
- Não diga ""as referências podem ajudar"".
- Não invente distância exata.
- Se nada mudou, seja breve.
- Se houver ambiente novo, pessoa, porta, passagem, corredor, obstáculo ou objeto relevante, informe.
- Use importancia baixa, media ou alta.
- Use direcao: esquerda, direita, frente, centro ou sem-direcao.";
    }

    private string MontarPromptConsulta(string? pergunta, string? contextoRecente)
    {
        var blocoContexto = MontarBlocoContexto(contextoRecente);
        var perguntaLimpa = LimparTexto(pergunta);

        if (string.IsNullOrWhiteSpace(perguntaLimpa))
            perguntaLimpa = "Descreva o ambiente de forma útil para locomoção.";

        return @"Você é o Visiora em modo consulta. Responda à pergunta usando a imagem atual e o contexto recente.
A resposta deve ajudar uma pessoa com deficiência visual a entender o ambiente, pessoas, riscos e referências úteis.

" + blocoContexto + @"

PERGUNTA DO USUÁRIO:
" + perguntaLimpa + @"

Responda APENAS em JSON válido, neste formato:
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
- Seja mais completo que no modo guia, mas ainda objetivo.
- Priorize locomoção, segurança, ambiente, pessoas e referência espacial.
- Não invente fatos.
- Não descreva decoração sem utilidade.
- Se houver risco, destaque em alertas.
- Use direcao apenas: esquerda, direita, frente, centro, sem-direcao.
- Use importancia apenas: baixa, media, alta.";
    }

    private RespostaIA SanitizarResposta(RespostaIA resposta, string modo)
    {
        resposta.Descricao = LimparTexto(resposta.Descricao);
        resposta.Pessoa = LimparTexto(resposta.Pessoa);
        resposta.Sugestao = LimparTexto(resposta.Sugestao);
        resposta.Direcao = NormalizarDirecao(resposta.Direcao);
        resposta.Importancia = NormalizarImportancia(resposta.Importancia);
        resposta.EventoGuia = NormalizarEventoGuia(resposta.EventoGuia);
        resposta.CaminhoStatus = NormalizarCaminhoStatus(resposta.CaminhoStatus);
        resposta.FalaCurta = LimparTexto(resposta.FalaCurta);
        resposta.ResumoAmbiente = LimparTexto(resposta.ResumoAmbiente);
        resposta.EstadoUsuarioInferido = NormalizarEstadoUsuario(resposta.EstadoUsuarioInferido);
        resposta.MotivoFala = LimparTexto(resposta.MotivoFala);
        resposta.ObservacaoMudanca = LimparTexto(resposta.ObservacaoMudanca);
        resposta.AmbienteProvavel = LimparTexto(resposta.AmbienteProvavel);

        resposta.PontosInteresse = (resposta.PontosInteresse ?? new List<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => LimparTexto(x))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(6)
            .ToList();

        resposta.Objetos = (resposta.Objetos ?? new List<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => LimparTexto(x))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(modo == "consulta" ? 8 : 5)
            .ToList();

        resposta.Alertas = (resposta.Alertas ?? new List<string>())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => LimparTexto(x))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToList();

        if (string.IsNullOrWhiteSpace(resposta.Descricao))
        {
            if (resposta.Alertas.Any())
                resposta.Descricao = "Há uma situação que exige atenção no ambiente.";
            else if (resposta.Objetos.Any())
                resposta.Descricao = "Há elementos próximos que podem ajudar na orientação.";
            else
                resposta.Descricao = "Não consegui identificar detalhes suficientes do ambiente.";
        }

        if (modo == "guia")
        {
            resposta.Descricao = LimitarTexto(resposta.Descricao, 260);
            resposta.Sugestao = LimitarTexto(resposta.Sugestao, 120);
            resposta.Pessoa = LimitarTexto(resposta.Pessoa, 110);
            resposta.FalaCurta = LimitarTexto(resposta.FalaCurta, 380);
            resposta.ResumoAmbiente = LimitarTexto(resposta.ResumoAmbiente, 260);
            resposta.MotivoFala = LimitarTexto(resposta.MotivoFala, 160);
            resposta.ObservacaoMudanca = LimitarTexto(resposta.ObservacaoMudanca, 180);
        }
        else
        {
            resposta.Descricao = LimitarTexto(resposta.Descricao, 260);
            resposta.Sugestao = LimitarTexto(resposta.Sugestao, 160);
            resposta.Pessoa = LimitarTexto(resposta.Pessoa, 140);
            resposta.FalaCurta = LimitarTexto(resposta.FalaCurta, 260);
            resposta.ResumoAmbiente = LimitarTexto(resposta.ResumoAmbiente, 260);
            resposta.MotivoFala = LimitarTexto(resposta.MotivoFala, 160);
            resposta.ObservacaoMudanca = LimitarTexto(resposta.ObservacaoMudanca, 180);
        }

        return resposta;
    }


    private string NormalizarEventoGuia(string? evento)
    {
        var texto = LimparTexto(evento).ToLowerInvariant()
            .Replace(" ", "_")
            .Replace("-", "_");

        if (texto.Contains("risco") || texto.Contains("obstaculo") || texto.Contains("obstáculo") || texto.Contains("alerta")) return "risco";
        if (texto.Contains("pessoa") || texto.Contains("interacao") || texto.Contains("interação")) return "pessoa";
        if (texto.Contains("novo") || texto.Contains("transicao") || texto.Contains("transição")) return "novo_ambiente";
        if (texto.Contains("ponto") || texto.Contains("interesse") || texto.Contains("porta") || texto.Contains("saida") || texto.Contains("saída")) return "ponto_interesse";
        if (texto.Contains("mudanca") || texto.Contains("mudança") || texto.Contains("apareceu")) return "mudanca";
        if (texto.Contains("observacao") || texto.Contains("observação")) return "observacao";
        if (texto.Contains("livre") || texto.Contains("passagem")) return "livre";
        if (texto.Contains("inicio") || texto.Contains("início") || texto.Contains("primeira")) return "inicio";
        if (texto.Contains("confirmacao") || texto.Contains("confirmação")) return "confirmacao";
        if (texto.Contains("silencio") || texto.Contains("silêncio")) return "silencio";

        return "silencio";
    }

    private string NormalizarEstadoUsuario(string? estado)
    {
        var texto = LimparTexto(estado).ToLowerInvariant();

        if (texto.Contains("mov")) return "em movimento";
        if (texto.Contains("trans")) return "transição";
        if (texto.Contains("parad")) return "parado";
        if (texto.Contains("explor")) return "explorando";
        if (texto.Contains("risco")) return "atenção";

        return "observando";
    }

    private string NormalizarCaminhoStatus(string? caminho)
    {
        var texto = LimparTexto(caminho).ToLowerInvariant()
            .Replace(" ", "_")
            .Replace("-", "_");

        if (texto.Contains("bloqueado") || texto.Contains("obstruido") || texto.Contains("obstruído")) return "bloqueado";
        if (texto.Contains("parcial")) return "parcialmente_livre";
        if (texto.Contains("estreito") || texto.Contains("apertado")) return "estreito";
        if (texto.Contains("movimentado") || texto.Contains("circulacao") || texto.Contains("circulação")) return "movimentado";
        if (texto.Contains("livre") || texto.Contains("aberto")) return "livre";

        return "desconhecido";
    }

    private string NormalizarDirecao(string? direcao)
    {
        var texto = LimparTexto(direcao).ToLowerInvariant();

        if (texto.Contains("esquerda")) return "esquerda";
        if (texto.Contains("direita")) return "direita";
        if (texto.Contains("frente")) return "frente";
        if (texto.Contains("centro")) return "centro";

        return "sem-direcao";
    }

    private string NormalizarImportancia(string? importancia)
    {
        var texto = LimparTexto(importancia).ToLowerInvariant();

        if (texto.Contains("alta")) return "alta";
        if (texto.Contains("media") || texto.Contains("média")) return "media";
        if (texto.Contains("baixa")) return "baixa";

        return "baixa";
    }

    private string LimparJsonResposta(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return "{}";

        content = content.Trim();

        if (content.StartsWith("```"))
        {
            content = content.Replace("```json", "", StringComparison.OrdinalIgnoreCase)
                .Replace("```", "")
                .Trim();
        }

        var inicio = content.IndexOf('{');
        var fim = content.LastIndexOf('}');

        if (inicio >= 0 && fim > inicio)
            content = content[inicio..(fim + 1)];

        return content.Trim();
    }

    private string LimparTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim()
            .Replace("\r", " ")
            .Replace("\n", " ")
            .Replace("\t", " ");

        while (texto.Contains("  "))
            texto = texto.Replace("  ", " ");

        return texto.Trim();
    }

    private string LimitarTexto(string texto, int limite)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        if (texto.Length <= limite)
            return texto.Trim();

        var cortado = texto[..limite];
        var ultimoPonto = cortado.LastIndexOf('.');
        var ultimaVirgula = cortado.LastIndexOf(',');
        var corte = Math.Max(ultimoPonto, ultimaVirgula);

        if (corte > 40)
            cortado = cortado[..corte];

        return cortado.Trim(' ', ',', '.', ';') + ".";
    }
}
