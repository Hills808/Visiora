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
}