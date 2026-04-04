namespace VisioraAPI.Models;

public class RespostaIA
{
    public string Descricao { get; set; } = string.Empty;
    public string[] Objetos { get; set; } = Array.Empty<string>();
    public string[] Alertas { get; set; } = Array.Empty<string>();
    public string Pessoa { get; set; } = string.Empty;
    public string Sugestao { get; set; } = string.Empty;
}