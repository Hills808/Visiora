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
