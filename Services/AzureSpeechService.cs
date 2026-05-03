using Microsoft.CognitiveServices.Speech;
using Microsoft.CognitiveServices.Speech.Audio;

namespace VisioraAPI.Services;

public class AzureSpeechService
{
    private readonly string _speechKey;
    private readonly string _speechRegion;

    public AzureSpeechService(IConfiguration config)
    {
        _speechKey =
            Environment.GetEnvironmentVariable("AZURE_SPEECH_KEY")
            ?? config["AzureSpeech:Key"]
            ?? "";

        _speechRegion =
            Environment.GetEnvironmentVariable("AZURE_SPEECH_REGION")
            ?? config["AzureSpeech:Region"]
            ?? "";

        if (string.IsNullOrWhiteSpace(_speechKey))
            throw new Exception("Azure Speech Key não configurada. Use AZURE_SPEECH_KEY ou AzureSpeech:Key.");

        if (string.IsNullOrWhiteSpace(_speechRegion))
            throw new Exception("Azure Speech Region não configurada. Use AZURE_SPEECH_REGION ou AzureSpeech:Region.");
    }

    public async Task<string> TranscreverWavAsync(byte[] wavBytes, CancellationToken cancellationToken = default)
    {
        if (wavBytes == null || wavBytes.Length == 0)
            return "";

        var tempFile = Path.Combine(Path.GetTempPath(), $"visiora-voz-{Guid.NewGuid()}.wav");

        try
        {
            await File.WriteAllBytesAsync(tempFile, wavBytes, cancellationToken);

            var speechConfig = SpeechConfig.FromSubscription(_speechKey, _speechRegion);
            speechConfig.SpeechRecognitionLanguage = "pt-BR";
            speechConfig.SetProperty(PropertyId.SpeechServiceResponse_PostProcessingOption, "TrueText");
            speechConfig.SetProfanity(ProfanityOption.Raw);

            using var audioConfig = AudioConfig.FromWavFileInput(tempFile);
            using var recognizer = new SpeechRecognizer(speechConfig, audioConfig);

            var phraseList = PhraseListGrammar.FromRecognizer(recognizer);
            phraseList.AddPhrase("descrever ambiente");
            phraseList.AddPhrase("o que tem à minha frente");
            phraseList.AddPhrase("tem alguém por perto");
            phraseList.AddPhrase("tem obstáculo à frente");
            phraseList.AddPhrase("iniciar modo automático");
            phraseList.AddPhrase("parar modo automático");
            phraseList.AddPhrase("pausar áudio");
            phraseList.AddPhrase("retomar áudio");
            phraseList.AddPhrase("parar áudio");
            phraseList.AddPhrase("ambiente");
            phraseList.AddPhrase("frente");
            phraseList.AddPhrase("esquerda");
            phraseList.AddPhrase("direita");
            phraseList.AddPhrase("guia");

            var result = await recognizer.RecognizeOnceAsync();

            return result.Reason switch
            {
                ResultReason.RecognizedSpeech => (result.Text ?? "").Trim(),
                ResultReason.NoMatch => "",
                ResultReason.Canceled => "",
                _ => ""
            };
        }
        finally
        {
            try
            {
                if (File.Exists(tempFile))
                    File.Delete(tempFile);
            }
            catch
            {
            }
        }
    }
}
