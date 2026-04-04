using Microsoft.AspNetCore.Mvc;
using VisioraAPI.Models;
using VisioraAPI.Services;

namespace VisioraAPI.Controllers;

[ApiController]
[Route("[controller]")]
public class TesteController : ControllerBase
{
    private readonly VisioraService _visioraService;

    public TesteController(VisioraService visioraService)
    {
        _visioraService = visioraService;
    }

    [HttpPost("analisar")]
    public async Task<IActionResult> Analisar([FromBody] ImagemRequest request)
    {
        var resposta = await _visioraService.AnalisarAmbiente(
            request.ImagemBase64,
            request.Modo,
            request.Pergunta
        );

        return Ok(resposta);
    }
}