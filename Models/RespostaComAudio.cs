namespace VisioraAPI.Models;

public class RespostaComAudio
{
    public string Descricao { get; set; } = "";
    public string[] Objetos { get; set; } = Array.Empty<string>();
    public string[] Alertas { get; set; } = Array.Empty<string>();
    public string Pessoa { get; set; } = "";
    public string Sugestao { get; set; } = "";
    public string Direcao { get; set; } = "sem-direcao";
    public string Importancia { get; set; } = "baixa";
    public string AudioBase64 { get; set; } = "";

    // Saída otimizada para percepção ativa no front.
    public string FalaGuia { get; set; } = "";
    public bool UsarFalaLocal { get; set; } = false;
    public bool ModoGuia { get; set; } = false;
    public int TempoProcessamentoMs { get; set; } = 0;
    public string TipoFala { get; set; } = "silencio";
    public string EventoGuia { get; set; } = "silencio";
    public string CaminhoStatus { get; set; } = "desconhecido";
    public bool DeveFalar { get; set; } = false;
    public string MotivoFala { get; set; } = "";
    public string EstadoOperacional { get; set; } = "observando";
    public string ResumoAmbiente { get; set; } = "";
    public string[] PontosInteresse { get; set; } = Array.Empty<string>();

    public EstadoVisiora EstadoCognitivo { get; set; } = new();
    public List<MemoriaRecenteItem> MemoriaRecente { get; set; } = new();
    public int ConfiancaAmbiente { get; set; } = 0;
    public bool MudancaDetectada { get; set; } = false;
    public string AlertaPrincipal { get; set; } = "-";
    public string PessoaPorPerto { get; set; } = "-";
}

public class MemoriaRecenteItem
{
    public string Ambiente { get; set; } = "Indefinido";
    public string Evento { get; set; } = "Observando";
    public string Caminho { get; set; } = "Desconhecido";
    public string Direcao { get; set; } = "sem-direcao";
    public string Referencia { get; set; } = "-";
    public DateTime EmUtc { get; set; } = DateTime.UtcNow;
}
