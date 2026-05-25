namespace VisioraAPI.Models;

public class MemoriaPersistenteAmbiente
{
    public string Assinatura { get; set; } = "";
    public string Ambiente { get; set; } = "Indefinido";
    public string Perfil { get; set; } = "indefinido";
    public string DescricaoConsolidada { get; set; } = "";
    public string UltimoEvento { get; set; } = "";
    public List<string> Referencias { get; set; } = new();
    public int Leituras { get; set; } = 0;
    public DateTime UltimoReconhecimentoUtc { get; set; } = DateTime.MinValue;
    public bool CorrespondeAoAmbienteAtual { get; set; } = false;
}

public class PainelMemoriaPersistente
{
    public MemoriaPersistenteAmbiente Atual { get; set; } = new();
    public List<MemoriaPersistenteAmbiente> Recentes { get; set; } = new();
}
