namespace VisioraAPI.Models;

public class RespostaIA
{
    public string Descricao { get; set; } = "";
    public List<string> Objetos { get; set; } = new();
    public List<string> Alertas { get; set; } = new();
    public string Pessoa { get; set; } = "";
    public string Sugestao { get; set; } = "";
    public string Direcao { get; set; } = "";
    public string Importancia { get; set; } = "";

    // Campos do modo Percepção Ativa.
    // A IA percebe a cena; o Visiora decide quando e como falar.
    public string EventoGuia { get; set; } = "silencio";
    public string CaminhoStatus { get; set; } = "desconhecido";
    public string FalaCurta { get; set; } = "";
    public List<string> PontosInteresse { get; set; } = new();
    public string ResumoAmbiente { get; set; } = "";
    public string EstadoUsuarioInferido { get; set; } = "observando";
    public string MotivoFala { get; set; } = "";
    public string ObservacaoMudanca { get; set; } = "";
    public string AmbienteProvavel { get; set; } = "";
}
