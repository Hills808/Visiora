namespace VisioraAPI.Models;

public class RespostaVisiora
{
    public string Descricao { get; set; }
    public string[] Objetos { get; set; }
    public string[] Alertas { get; set; }
    public string Pessoa { get; set; }
    public string Sugestao { get; set; }
}