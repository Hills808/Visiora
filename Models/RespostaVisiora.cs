namespace VisioraAPI.Models;

public class RespostaVisiora
{
    public string Descricao { get; set; } = "";
    public string[] Objetos { get; set; } = Array.Empty<string>();
    public string[] Alertas { get; set; } = Array.Empty<string>();
    public string Pessoa { get; set; } = "";
    public string Sugestao { get; set; } = "";
}
