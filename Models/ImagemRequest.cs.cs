namespace VisioraAPI.Models;

public class ImagemRequest
{
    public string ImagemBase64 { get; set; } = "";
    public string Modo { get; set; } = "automatico";
    public string Pergunta { get; set; } = "";
}