using VisioraAPI.Models;


namespace VisioraAPI.Services;

public class VisioraService
{
    private readonly OpenAIService _openAI;
    private readonly AudioService _audioService;

    public VisioraService(OpenAIService openAI, AudioService audioService)
    {
        _openAI = openAI;
        _audioService = audioService;
    }

    public async Task<RespostaComAudio> AnalisarAmbiente(string imagemBase64)
    {
        try
        {
            var respostaIA = await _openAI.AnalisarImagem(imagemBase64);

            var textoAudio =
                $"{respostaIA.Descricao}. " +
                $"Objetos detectados: {string.Join(", ", respostaIA.Objetos)}. " +
                $"Sugestão: {respostaIA.Sugestao}.";

            var audioBase64 = await _audioService.GerarAudioBase64(textoAudio);

            return new RespostaComAudio
            {
                Descricao = respostaIA.Descricao,
                Objetos = respostaIA.Objetos,
                Alertas = respostaIA.Alertas,
                Pessoa = respostaIA.Pessoa,
                Sugestao = respostaIA.Sugestao,
                AudioBase64 = audioBase64
            };
        }
        catch (Exception ex)
        {
            return new RespostaComAudio
            {
                Descricao = $"Erro: {ex.Message}",
                Objetos = Array.Empty<string>(),
                Alertas = new[] { "falha no processamento" },
                Pessoa = "",
                Sugestao = "",
                AudioBase64 = ""
            };
        }
    }
}