namespace VisioraAPI.Models;

public class ImagemRequest
{
    public string ImagemBase64 { get; set; } = "";
    public string Modo { get; set; } = "automatico";
    public string Pergunta { get; set; } = "";

    // Telemetria enviada pelo front para o backend decidir melhor antes e depois da análise da IA.
    public double MudancaVisual { get; set; } = 0;
    public bool ForcarAnalise { get; set; } = false;
    public bool PreferirAudioLocal { get; set; } = false;
    public bool PrimeiraLeitura { get; set; } = false;
    public bool ForcarDescricaoInicial { get; set; } = false;
    public bool LoopAtivo { get; set; } = false;
    public bool CenaEstavel { get; set; } = false;
    public bool AudioTocando { get; set; } = false;
    public string NivelMovimento { get; set; } = "indefinido";
    public int TempoDesdeUltimaAnaliseMs { get; set; } = 0;
    public int TempoDesdeUltimaFalaMs { get; set; } = 0;
}
