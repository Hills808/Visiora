namespace VisioraAPI.Models;

public class EstadoVisiora
{
    public string AmbienteAtual { get; set; } = "indefinido";
    public double ConfiancaAmbiente { get; set; } = 0;
    public string TipoAmbiente { get; set; } = "indefinido";
    public string EventoAtual { get; set; } = "inicializando";
    public bool MudancaDetectada { get; set; } = false;
    public string NivelAtencao { get; set; } = "medio";
    public string TendenciaMovimento { get; set; } = "observando";
    public string ReferenciaPrincipal { get; set; } = "";
    public string CaminhoStatus { get; set; } = "desconhecido";
    public string AlertaPrincipal { get; set; } = "";
    public string PessoaStatus { get; set; } = "";
    public string DirecaoPreferencial { get; set; } = "sem-direcao";
    public string AmbienteCandidato { get; set; } = "";
    public int LeiturasConsistentesAmbiente { get; set; } = 0;
    public int LeiturasSuspeitaTransicao { get; set; } = 0;
    public int TempoNoAmbienteSegundos { get; set; } = 0;
    public string ModoGuiaStatus { get; set; } = "observando";
    public DateTime AtualizadoEmUtc { get; set; } = DateTime.UtcNow;
    public bool MemoriaPersistenteAtiva { get; set; } = false;
    public string AmbienteMemorizado { get; set; } = "";
    public int LeiturasMemorizadas { get; set; } = 0;
    public string UltimoEventoMemorizado { get; set; } = "";
    public string MapaVerbal { get; set; } = "";
    public int ItensEspaciaisDetectados { get; set; } = 0;
    public string MemoriaAssistivaStatus { get; set; } = "sem memória ativa";
}
