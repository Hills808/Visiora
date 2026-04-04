using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;

namespace VisioraAPI.Services;

public class AudioService
{
    private readonly string _apiKey;

    public AudioService(IConfiguration config)
    {
        _apiKey = config["OpenAI:ApiKey"] ?? "";
    }

    public async Task<string> GerarAudioBase64(string texto)
    {
        using var client = new HttpClient();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _apiKey);

        var body = new
        {
            model = "gpt-4o-mini-tts",
            voice = "alloy",
            input = texto
        };

        var json = JsonSerializer.Serialize(body);

        var response = await client.PostAsync(
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
}