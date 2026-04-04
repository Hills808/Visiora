using Microsoft.AspNetCore.Mvc;
using VisioraAPI.Models;
using VisioraAPI.Services;

namespace VisioraAPI.Controllers;

[ApiController]
[Route("[controller]")]
public class TesteController : ControllerBase
{
    private readonly VisioraService _service;

    public TesteController(VisioraService service)
    {
        _service = service;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            descricao = "Endpoint funcionando",
            objetos = new[] { "mesa" },
            alertas = new[] { "nenhum" },
            pessoa = "não identificada",
            sugestao = "teste"
        });
    }

    [HttpPost("analisar")]
    public async Task<IActionResult> Analisar([FromBody] ImagemRequest request)
    {
        var resposta = await _service.AnalisarAmbiente(request.ImagemBase64);
        return Ok(resposta);
    }
}