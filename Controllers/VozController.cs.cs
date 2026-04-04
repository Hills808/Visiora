using Microsoft.AspNetCore.Mvc;
using VisioraAPI.Services;

namespace VisioraAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VozController : ControllerBase
{
    private readonly AzureSpeechService _azureSpeechService;

    public VozController(AzureSpeechService azureSpeechService)
    {
        _azureSpeechService = azureSpeechService;
    }

    [HttpPost("transcrever")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Transcrever([FromForm] IFormFile? audioFile, CancellationToken cancellationToken)
    {
        if (audioFile == null || audioFile.Length == 0)
        {
            return BadRequest(new
            {
                sucesso = false,
                texto = "",
                erro = "Nenhum áudio recebido."
            });
        }

        try
        {
            await using var stream = audioFile.OpenReadStream();
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);

            var texto = await _azureSpeechService.TranscreverWavAsync(ms.ToArray(), cancellationToken);

            return Ok(new
            {
                sucesso = true,
                texto = texto ?? "",
                vazio = string.IsNullOrWhiteSpace(texto)
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                sucesso = false,
                texto = "",
                erro = ex.Message
            });
        }
    }
}
