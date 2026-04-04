namespace VisioraAPI.Models;

public class RespostaComAudio
{
    public string Descricao { get; set; } = string.Empty;
    public string[] Objetos { get; set; } = Array.Empty<string>();
    public string[] Alertas { get; set; } = Array.Empty<string>();
    public string Pessoa { get; set; } = string.Empty;
    public string Sugestao { get; set; } = string.Empty;
    public string AudioBase64 { get; set; } = string.Empty;
}