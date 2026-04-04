using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VisioraAPI.Services;

public class AudioService
{
    private readonly string _apiKey;
    private const int LIMITE_PADRAO = 260;

    public AudioService(IConfiguration config)
    {
        _apiKey =
            Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? config["OpenAI:ApiKey"]
            ?? "";

        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new Exception("API Key da OpenAI não configurada.");
    }

    public async Task<string> GerarAudioBase64(string texto)
    {
        using var client = new HttpClient();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _apiKey);

        var textoAjustado = AjustarTextoParaFalaNatural(texto);

        if (string.IsNullOrWhiteSpace(textoAjustado))
            return "";

        var body = new
        {
            model = "gpt-4o-mini-tts",
            voice = "alloy",
            input = textoAjustado
        };

        var json = JsonSerializer.Serialize(body);

        using var response = await client.PostAsync(
            "https://api.openai.com/v1/audio/speech",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        var bytes = await response.Content.ReadAsByteArrayAsync();

        if (!response.IsSuccessStatusCode)
        {
            var erro = Encoding.UTF8.GetString(bytes);
            throw new Exception($"Erro ao gerar áudio: {erro}");
        }

        return Convert.ToBase64String(bytes);
    }

    private string AjustarTextoParaFalaNatural(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim();

        texto = LimparPontuacao(texto);
        texto = NormalizarTermosVisuais(texto);
        texto = SuavizarComandos(texto);
        texto = HumanizarFrases(texto);
        texto = InserirPausasNaturais(texto);
        texto = EvitarTomMecanico(texto);
        texto = LimitarTamanhoSemQuebrarFrase(texto, LIMITE_PADRAO);

        if (!texto.EndsWith(".") && !texto.EndsWith("!") && !texto.EndsWith("?"))
            texto += ".";

        return texto.Trim();
    }

    private string LimparPontuacao(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("...", ".");
        texto = texto.Replace("..", ".");
        texto = texto.Replace(" .", ".");
        texto = texto.Replace(" ,", ",");
        texto = texto.Replace(" ;", ";");
        texto = texto.Replace(" :", ":");

        while (texto.Contains("  "))
            texto = texto.Replace("  ", " ");

        texto = Regex.Replace(texto, @"([,;:]){2,}", "$1");
        texto = Regex.Replace(texto, @"([.!?]){2,}", "$1");

        return texto.Trim();
    }

    private string NormalizarTermosVisuais(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("visualiza-se", "há", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("é possível observar", "há", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("foi detectado", "há", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("foram detectados", "há", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("à sua frente", "à frente", StringComparison.OrdinalIgnoreCase);

        return texto.Trim();
    }

    private string SuavizarComandos(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("mova-se", "siga", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("desloque-se", "vá", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("prossiga", "pode seguir", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("avance", "pode avançar", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("reposicione-se", "ajuste sua posição", StringComparison.OrdinalIgnoreCase);

        texto = texto.Replace("obstáculo identificado", "obstáculo à frente", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("caminho obstruído", "caminho bloqueado", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("rota livre", "caminho livre", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("desvie imediatamente", "desvie com cuidado", StringComparison.OrdinalIgnoreCase);

        return texto.Trim();
    }

    private string HumanizarFrases(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = Regex.Replace(texto, @"\bambiente interno com circulação livre\b", "O caminho parece livre", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bhá caminho livre\b", "O caminho está livre", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bhá uma pessoa à frente\b", "Tem uma pessoa à frente", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bhá uma pessoa próxima\b", "Tem uma pessoa por perto", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bhá um obstáculo no caminho\b", "Tem um obstáculo no caminho", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bhá um obstáculo à frente\b", "Tem um obstáculo à frente", RegexOptions.IgnoreCase);

        return texto.Trim();
    }

    private string InserirPausasNaturais(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = Regex.Replace(texto, @"\s+à frente\b", ", à frente");
        texto = Regex.Replace(texto, @"\s+à esquerda\b", ", à esquerda");
        texto = Regex.Replace(texto, @"\s+à direita\b", ", à direita");
        texto = Regex.Replace(texto, @"\s+no centro\b", ", no centro");

        texto = Regex.Replace(texto, @"\bCuidado\b", "Cuidado,", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bAtenção\b", "Atenção,", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"\bPor enquanto\b", "Por enquanto,", RegexOptions.IgnoreCase);

        texto = texto.Replace("Siga à", "Siga, à", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("Vá à", "Vá, à", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("Pode seguir à", "Pode seguir, à", StringComparison.OrdinalIgnoreCase);

        return LimparPontuacao(texto);
    }

    private string EvitarTomMecanico(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("Referência ", "Referência: ", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("Com cuidado. Pode seguir", "Pode seguir com cuidado", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("Caminho bloqueado. Procure desviar.", "O caminho está bloqueado. Procure desviar.", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("Caminho parcialmente bloqueado. Com atenção.", "O caminho está parcialmente bloqueado. Vá com atenção.", StringComparison.OrdinalIgnoreCase);

        return LimparPontuacao(texto);
    }

    private string LimitarTamanhoSemQuebrarFrase(string texto, int limite)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        if (texto.Length <= limite)
            return texto.Trim();

        var textoCortado = texto[..limite];

        var ultimoPonto = textoCortado.LastIndexOf('.');
        if (ultimoPonto > 80)
            return textoCortado[..(ultimoPonto + 1)].Trim();

        var ultimaExclamacao = textoCortado.LastIndexOf('!');
        if (ultimaExclamacao > 80)
            return textoCortado[..(ultimaExclamacao + 1)].Trim();

        var ultimaInterrogacao = textoCortado.LastIndexOf('?');
        if (ultimaInterrogacao > 80)
            return textoCortado[..(ultimaInterrogacao + 1)].Trim();

        var ultimaVirgula = textoCortado.LastIndexOf(',');
        if (ultimaVirgula > 80)
            return textoCortado[..ultimaVirgula].Trim();

        var ultimoEspaco = textoCortado.LastIndexOf(' ');
        if (ultimoEspaco > 80)
            return textoCortado[..ultimoEspaco].Trim();

        return textoCortado.Trim();
    }
}
