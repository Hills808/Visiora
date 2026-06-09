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

    // Campos novos para percepção espacial: ajudam o Visiora a descrever localização aproximada
    // de objetos úteis sem transformar tudo em comando de direção.
    public string MapaVerbal { get; set; } = "";
    public List<ItemEspacial> ItensEspaciais { get; set; } = new();
    public string MudancaEspacial { get; set; } = "";
    public string ProximidadeRisco { get; set; } = "";
}

public class ItemEspacial
{
    public string Nome { get; set; } = "";
    public string Tipo { get; set; } = "referencia";
    public string Posicao { get; set; } = "indefinido";
    public string DistanciaAproximada { get; set; } = "indefinida";
    public string Relevancia { get; set; } = "";
    public bool Risco { get; set; } = false;
}
