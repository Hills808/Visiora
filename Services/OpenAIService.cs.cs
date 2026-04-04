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
        _apiKey = config["OpenAI:ApiKey"] ?? "";
    }

    public async Task<RespostaIA> AnalisarImagem(string base64)
    {
        using var client = new HttpClient();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _apiKey);

        var body = new
        {
            model = "gpt-4o-mini",
            messages = new object[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "text",
                            text = @"Analise a imagem e responda APENAS em JSON válido, sem markdown, sem ```json, sem texto extra, neste formato:
{
  ""descricao"": """",
  ""objetos"": [],
  ""alertas"": [],
  ""pessoa"": """",
  ""sugestao"": """"
}"
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
            max_tokens = 300
        };

        var json = JsonSerializer.Serialize(body);

        var response = await client.PostAsync(
            "https://api.openai.com/v1/chat/completions",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        var result = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Erro OpenAI: {result}");
        }

        using var doc = JsonDocument.Parse(result);

        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(content))
            throw new Exception("Resposta vazia da OpenAI.");

        content = content.Trim();

        if (content.StartsWith("```json"))
            content = content.Replace("```json", "").Replace("```", "").Trim();

        if (content.StartsWith("```"))
            content = content.Replace("```", "").Trim();

        var respostaIA = JsonSerializer.Deserialize<RespostaIA>(
            content,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        if (respostaIA == null)
            throw new Exception("Não foi possível converter a resposta da IA.");

        return respostaIA;
    }
}