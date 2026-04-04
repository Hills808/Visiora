using VisioraAPI.Models;

namespace VisioraAPI.Services;

public class VisioraService
{
    private readonly OpenAIService _openAI;
    private readonly AudioService _audioService;

    private static readonly object _lockMemoria = new();

    private static RespostaIA? _ultimaRespostaIA;
    private static string _ultimoTextoFalado = "";
    private static string _ultimoResumoFalado = "";
    private static DateTime _ultimaFalaEm = DateTime.MinValue;
    private static DateTime _ultimaConfirmacaoContextualEm = DateTime.MinValue;

    private static int _framesEstaveis = 0;
    private static int _framesComMudancaRelevante = 0;

    private static readonly ContextoRecenteIA _contextoRecente = new();

    private const int INTERVALO_MINIMO_ENTRE_FALAS_SEGUNDOS = 3;
    private const int INTERVALO_CONFIRMACAO_CONTEXTUAL_SEGUNDOS = 12;
    private const int FRAMES_MINIMOS_PARA_CONFIRMAR_MUDANCA = 2;

    public VisioraService(OpenAIService openAI, AudioService audioService)
    {
        _openAI = openAI;
        _audioService = audioService;
    }

    public async Task<RespostaComAudio> AnalisarAmbiente(string imagemBase64, string? modo = "automatico", string? pergunta = "")
    {
        try
        {
            var contextoParaPrompt = ObterContextoRecenteTexto();
            var modoNormalizado = NormalizarModo(modo);

            var respostaIA = await _openAI.AnalisarImagem(imagemBase64, modoNormalizado, pergunta, contextoParaPrompt);

            var textoAudio = modoNormalizado == "consulta"
                ? MontarTextoAudioConsulta(respostaIA, pergunta)
                : MontarTextoAudioAutomatico(respostaIA);

            AtualizarContextoRecente(respostaIA, textoAudio);

            var audioBase64 = "";

            if (!string.IsNullOrWhiteSpace(textoAudio))
                audioBase64 = await _audioService.GerarAudioBase64(textoAudio);

            return new RespostaComAudio
            {
                Descricao = respostaIA.Descricao,
                Objetos = (respostaIA.Objetos ?? new List<string>()).ToArray(),
                Alertas = (respostaIA.Alertas ?? new List<string>()).ToArray(),
                Pessoa = respostaIA.Pessoa,
                Sugestao = respostaIA.Sugestao,
                Direcao = respostaIA.Direcao,
                Importancia = respostaIA.Importancia,
                AudioBase64 = audioBase64
            };
        }
        catch (Exception ex)
        {
            return new RespostaComAudio
            {
                Descricao = $"Erro: {ex.Message}",
                Objetos = Array.Empty<string>(),
                Alertas = new[] { "falha no processamento" },
                Pessoa = "",
                Sugestao = "",
                Direcao = "",
                Importancia = "alta",
                AudioBase64 = ""
            };
        }
    }

    private string MontarTextoAudioAutomatico(RespostaIA atual)
    {
        RespostaIA? anterior;
        lock (_lockMemoria)
        {
            anterior = _ultimaRespostaIA;
        }

        var houveMudancaRelevante = CenaMudouDeFormaRelevante(atual, anterior);
        var utilidade = CalcularUtilidade(atual);
        var importancia = NormalizarTexto(atual.Importancia);

        AtualizarContadoresDeCena(houveMudancaRelevante);

        if (houveMudancaRelevante && importancia != "alta")
        {
            lock (_lockMemoria)
            {
                if (_framesComMudancaRelevante < FRAMES_MINIMOS_PARA_CONFIRMAR_MUDANCA)
                {
                    _ultimaRespostaIA = atual;
                    return "";
                }
            }
        }

        var textoFinal = ConstruirMensagemAutomatica(atual, anterior, utilidade, houveMudancaRelevante);

        if (string.IsNullOrWhiteSpace(textoFinal))
        {
            lock (_lockMemoria)
            {
                _ultimaRespostaIA = atual;
            }

            return "";
        }

        lock (_lockMemoria)
        {
            var agora = DateTime.UtcNow;
            var resumoAtual = CriarResumoSemantico(atual, textoFinal);

            if (!PodeFalarAgora(atual, textoFinal, resumoAtual, agora))
            {
                _ultimaRespostaIA = atual;
                return "";
            }

            _ultimoTextoFalado = textoFinal;
            _ultimoResumoFalado = resumoAtual;
            _ultimaFalaEm = agora;

            if (EhConfirmacaoContextual(textoFinal))
                _ultimaConfirmacaoContextualEm = agora;

            _ultimaRespostaIA = atual;
            _framesComMudancaRelevante = 0;
            _framesEstaveis = 0;
        }

        return textoFinal;
    }

    private string MontarTextoAudioConsulta(RespostaIA respostaIA, string? pergunta)
    {
        var partes = new List<string>();

        if (!string.IsNullOrWhiteSpace(respostaIA.Descricao))
            partes.Add(SuavizarTexto(respostaIA.Descricao));

        var alertaPrincipal = ObterAlertaPrincipal(respostaIA);
        if (!string.IsNullOrWhiteSpace(alertaPrincipal))
            partes.Add(SuavizarTexto(alertaPrincipal));

        if (!string.IsNullOrWhiteSpace(respostaIA.Pessoa) &&
            !TextoJaRepresentado(respostaIA.Pessoa, partes))
        {
            partes.Add(SuavizarTexto(respostaIA.Pessoa));
        }

        if (!string.IsNullOrWhiteSpace(respostaIA.Sugestao) &&
            !TextoJaRepresentado(respostaIA.Sugestao, partes))
        {
            partes.Add(SuavizarTexto(respostaIA.Sugestao));
        }

        if (partes.Count == 0 && respostaIA.Objetos != null && respostaIA.Objetos.Any())
        {
            var objeto = respostaIA.Objetos.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(objeto))
                partes.Add($"Percebo {objeto} no ambiente");
        }

        if (partes.Count == 0)
            return "";

        var textoFinal = string.Join(". ", partes);
        textoFinal = LimparTextoParaAudio(textoFinal, 320);

        return GarantirPontoFinal(textoFinal);
    }

    private string ConstruirMensagemAutomatica(RespostaIA atual, RespostaIA? anterior, int utilidade, bool houveMudancaRelevante)
    {
        var importancia = NormalizarTexto(atual.Importancia);
        var alertaPrincipal = ObterAlertaPrincipal(atual);
        var sugestao = LimparTextoBasico(atual.Sugestao);
        var pessoa = LimparTextoBasico(atual.Pessoa);

        var partes = new List<string>();

        if (!string.IsNullOrWhiteSpace(alertaPrincipal))
        {
            if (MudouAlertas(atual, anterior) || importancia == "alta")
                partes.Add(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)));
        }

        if (partes.Count == 0 &&
            !string.IsNullOrWhiteSpace(pessoa) &&
            (MudouPessoa(atual, anterior) || importancia == "media"))
        {
            partes.Add(SuavizarTexto(pessoa));
        }

        if (!string.IsNullOrWhiteSpace(sugestao) &&
            !SugestaoGenerica(sugestao) &&
            (MudouSugestao(atual, anterior) || importancia == "alta" || utilidade >= 3))
        {
            if (!TextoJaRepresentado(sugestao, partes))
                partes.Add(SuavizarTexto(sugestao));
        }

        if (partes.Count == 0 && utilidade >= 2)
        {
            var orientacaoUtil = MontarOrientacaoUtil(atual, anterior);
            if (!string.IsNullOrWhiteSpace(orientacaoUtil))
                partes.Add(orientacaoUtil);
        }

        if (partes.Count == 0 && DeveDarConfirmacaoContextual(atual, houveMudancaRelevante))
        {
            var confirmacao = MontarConfirmacaoContextual(atual, anterior);
            if (!string.IsNullOrWhiteSpace(confirmacao))
                partes.Add(confirmacao);
        }

        if (partes.Count == 0)
            return "";

        var texto = string.Join(". ", partes);
        texto = LimparTextoParaAudio(texto, 220);

        return GarantirPontoFinal(texto);
    }

    private void AtualizarContadoresDeCena(bool houveMudancaRelevante)
    {
        lock (_lockMemoria)
        {
            if (houveMudancaRelevante)
            {
                _framesComMudancaRelevante++;
                _framesEstaveis = 0;
            }
            else
            {
                _framesEstaveis++;
                _framesComMudancaRelevante = 0;
            }
        }
    }

    private bool PodeFalarAgora(RespostaIA atual, string textoFinal, string resumoAtual, DateTime agora)
    {
        var importancia = NormalizarTexto(atual.Importancia);

        if (!string.IsNullOrWhiteSpace(_ultimoTextoFalado) &&
            NormalizarTexto(_ultimoTextoFalado) == NormalizarTexto(textoFinal) &&
            importancia != "alta")
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(_ultimoResumoFalado) &&
            _ultimoResumoFalado == resumoAtual &&
            importancia != "alta")
        {
            return false;
        }

        if (_ultimaFalaEm != DateTime.MinValue &&
            (agora - _ultimaFalaEm).TotalSeconds < INTERVALO_MINIMO_ENTRE_FALAS_SEGUNDOS &&
            importancia != "alta")
        {
            return false;
        }

        return true;
    }

    private int CalcularUtilidade(RespostaIA resposta)
    {
        var score = 0;

        if (resposta.Alertas != null && resposta.Alertas.Any())
            score += 4;

        if (!string.IsNullOrWhiteSpace(resposta.Pessoa))
            score += 2;

        if (!string.IsNullOrWhiteSpace(resposta.Sugestao))
            score += SugestaoGenerica(resposta.Sugestao) ? 1 : 3;

        if (!string.IsNullOrWhiteSpace(resposta.Direcao) &&
            !NormalizarTexto(resposta.Direcao).Equals("sem-direcao"))
        {
            score += 1;
        }

        if (resposta.Objetos != null)
        {
            foreach (var objeto in resposta.Objetos.Select(NormalizarTexto))
            {
                if (ObjetoEhUtil(objeto))
                {
                    score += 1;
                    break;
                }
            }
        }

        if (NormalizarTexto(resposta.Importancia) == "alta")
            score += 4;
        else if (NormalizarTexto(resposta.Importancia) == "media")
            score += 2;

        return score;
    }

    private bool DeveDarConfirmacaoContextual(RespostaIA atual, bool houveMudancaRelevante)
    {
        var importancia = NormalizarTexto(atual.Importancia);

        if (importancia == "alta")
            return false;

        if (houveMudancaRelevante)
            return false;

        lock (_lockMemoria)
        {
            if (_ultimaConfirmacaoContextualEm == DateTime.MinValue)
                return _framesEstaveis >= 2;

            return _framesEstaveis >= 2 &&
                   (DateTime.UtcNow - _ultimaConfirmacaoContextualEm).TotalSeconds >= INTERVALO_CONFIRMACAO_CONTEXTUAL_SEGUNDOS;
        }
    }

    private string MontarConfirmacaoContextual(RespostaIA atual, RespostaIA? anterior)
    {
        if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)))
            return "";

        if (!string.IsNullOrWhiteSpace(atual.Pessoa))
            return "";

        var objetos = NormalizarLista(atual.Objetos);

        if (objetos.Contains("porta"))
            return "Há uma porta por perto";

        if (objetos.Contains("cadeira"))
            return "Há uma cadeira próxima";

        if (objetos.Contains("mesa"))
            return "Há uma mesa próxima";

        if (NormalizarTexto(atual.Direcao) == "frente" && !string.IsNullOrWhiteSpace(atual.Sugestao))
            return "O caminho à frente parece livre";

        if (NormalizarTexto(atual.Importancia) == "baixa")
            return "Por enquanto, o caminho parece livre";

        return "";
    }

    private string MontarOrientacaoUtil(RespostaIA atual, RespostaIA? anterior)
    {
        var direcao = NormalizarTexto(atual.Direcao);
        var objetos = NormalizarLista(atual.Objetos);

        if (!string.IsNullOrWhiteSpace(atual.Sugestao) && !SugestaoGenerica(atual.Sugestao))
            return SuavizarTexto(atual.Sugestao);

        if (objetos.Contains("porta"))
            return direcao switch
            {
                "esquerda" => "Há uma porta à esquerda",
                "direita" => "Há uma porta à direita",
                _ => "Há uma porta à frente"
            };

        if (objetos.Contains("cadeira"))
            return direcao switch
            {
                "esquerda" => "Há uma cadeira próxima à esquerda",
                "direita" => "Há uma cadeira próxima à direita",
                _ => "Há uma cadeira próxima"
            };

        if (objetos.Contains("mesa"))
            return direcao switch
            {
                "esquerda" => "Há uma mesa à esquerda",
                "direita" => "Há uma mesa à direita",
                _ => "Há uma mesa à frente"
            };

        if (direcao == "esquerda")
            return "O espaço parece melhor pela esquerda";

        if (direcao == "direita")
            return "O espaço parece melhor pela direita";

        if (direcao == "frente")
            return "O caminho à frente parece livre";

        return "";
    }

    private string TransformarAlertaEmFala(string alerta)
    {
        var texto = NormalizarTexto(alerta);

        if (texto.Contains("muito próximo"))
            return "Cuidado, tem um obstáculo muito perto";

        if (texto.Contains("obstáculo") && texto.Contains("frente"))
            return "Cuidado, tem um obstáculo à frente";

        if (texto.Contains("bloqueado"))
            return "Atenção, o caminho está bloqueado";

        if (texto.Contains("parcialmente bloqueado"))
            return "Atenção, o caminho está parcialmente bloqueado";

        if (texto.Contains("pessoa") && texto.Contains("direita"))
            return "Tem uma pessoa próxima à direita";

        if (texto.Contains("pessoa") && texto.Contains("esquerda"))
            return "Tem uma pessoa próxima à esquerda";

        return alerta;
    }

    private string ObterAlertaPrincipal(RespostaIA resposta)
    {
        return resposta.Alertas?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .FirstOrDefault() ?? "";
    }

    private bool TextoJaRepresentado(string texto, IEnumerable<string> partes)
    {
        var t = NormalizarTexto(texto);
        return partes.Any(p => NormalizarTexto(p) == t);
    }

    private bool ObjetoEhUtil(string objeto)
    {
        if (string.IsNullOrWhiteSpace(objeto))
            return false;

        var uteis = new[]
        {
            "porta", "cadeira", "mesa", "escada", "pessoa", "parede",
            "balcão", "balcao", "mochila", "garrafa", "copo", "sofá", "sofa"
        };

        return uteis.Contains(objeto);
    }

    private string ObterContextoRecenteTexto()
    {
        lock (_lockMemoria)
        {
            return
                "Última descrição útil: " + ValorOuPadrao(_contextoRecente.UltimaDescricao, "nenhuma") + ". " +
                "Último alerta: " + ValorOuPadrao(_contextoRecente.UltimoAlerta, "nenhum") + ". " +
                "Última sugestão: " + ValorOuPadrao(_contextoRecente.UltimaSugestao, "nenhuma") + ". " +
                "Última direção relevante: " + ValorOuPadrao(_contextoRecente.UltimaDirecao, "sem-direcao") + ". " +
                "Última importância: " + ValorOuPadrao(_contextoRecente.UltimaImportancia, "baixa") + ". " +
                "Tendência recente: " + ValorOuPadrao(_contextoRecente.TendenciaCena, "cena estável") + ". " +
                "Último texto falado: " + ValorOuPadrao(_contextoRecente.UltimoTextoFalado, "nenhum") + ".";
        }
    }

    private void AtualizarContextoRecente(RespostaIA atual, string textoFalado)
    {
        lock (_lockMemoria)
        {
            var anterior = _ultimaRespostaIA;

            _contextoRecente.UltimaDescricao = LimparTextoBasico(atual.Descricao);
            _contextoRecente.UltimoAlerta = ObterAlertaPrincipal(atual);
            _contextoRecente.UltimaSugestao = LimparTextoBasico(atual.Sugestao);
            _contextoRecente.UltimaDirecao = LimparTextoBasico(atual.Direcao);
            _contextoRecente.UltimaImportancia = LimparTextoBasico(atual.Importancia);
            _contextoRecente.UltimoTextoFalado = LimparTextoBasico(textoFalado);
            _contextoRecente.TendenciaCena = DetectarTendenciaCena(atual, anterior);
        }
    }

    private string DetectarTendenciaCena(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return "primeira análise recente";

        var alertaAtual = NormalizarTexto(ObterAlertaPrincipal(atual));
        var alertaAnterior = NormalizarTexto(ObterAlertaPrincipal(anterior));

        var importanciaAtual = NormalizarTexto(atual.Importancia);
        var importanciaAnterior = NormalizarTexto(anterior.Importancia);

        var direcaoAtual = NormalizarTexto(atual.Direcao);
        var direcaoAnterior = NormalizarTexto(anterior.Direcao);

        if (string.IsNullOrWhiteSpace(alertaAtual) &&
            string.IsNullOrWhiteSpace(alertaAnterior) &&
            importanciaAtual == "baixa" &&
            importanciaAnterior == "baixa")
        {
            return "cena estável e livre";
        }

        if (!string.IsNullOrWhiteSpace(alertaAtual) && string.IsNullOrWhiteSpace(alertaAnterior))
            return "novo alerta detectado";

        if (!string.IsNullOrWhiteSpace(alertaAtual) && alertaAtual == alertaAnterior)
        {
            if (importanciaAnterior != "alta" && importanciaAtual == "alta")
                return "risco parece mais próximo";

            return "alerta permanece no ambiente";
        }

        if (direcaoAtual != direcaoAnterior &&
            direcaoAtual != "sem-direcao" &&
            direcaoAnterior != "sem-direcao")
        {
            return "mudança de referência espacial";
        }

        if (importanciaAtual == "baixa" && importanciaAnterior != "baixa")
            return "risco reduziu ou saiu do caminho";

        return "mudança recente no ambiente";
    }

    private string CriarResumoSemantico(RespostaIA resposta, string textoFinal)
    {
        var alertas = string.Join("|", NormalizarLista(resposta.Alertas));
        var objetos = string.Join("|", NormalizarLista(resposta.Objetos).Take(3));
        var sugestao = NormalizarTexto(resposta.Sugestao);
        var direcao = NormalizarTexto(resposta.Direcao);
        var importancia = NormalizarTexto(resposta.Importancia);
        var texto = NormalizarTexto(textoFinal);

        return $"{importancia}::{alertas}::{objetos}::{sugestao}::{direcao}::{texto}";
    }

    private string SuavizarTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim();

        texto = texto.Replace("obstáculo identificado", "obstáculo à frente", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("mova-se", "siga", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("desloque-se", "vá", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("à sua frente", "à frente", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("aproxime-se com cuidado", "com cuidado", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("ambiente detectado", "ambiente percebido", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("há uma pessoa", "tem uma pessoa", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("há um obstáculo", "tem um obstáculo", StringComparison.OrdinalIgnoreCase);

        return texto.Trim();
    }

    private string LimparTextoParaAudio(string texto, int limite)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("..", ".");
        texto = texto.Replace(". .", ".");
        texto = texto.Replace("  ", " ");
        texto = texto.Trim();

        if (texto.Length > limite)
        {
            var textoCortado = texto[..limite];
            var ultimoPonto = textoCortado.LastIndexOf('.');

            if (ultimoPonto > 50)
                texto = textoCortado[..(ultimoPonto + 1)];
            else
            {
                var ultimaVirgula = textoCortado.LastIndexOf(',');
                texto = ultimaVirgula > 50
                    ? textoCortado[..(ultimaVirgula + 1)]
                    : textoCortado;
            }
        }

        texto = texto.Trim();

        if (!texto.EndsWith("."))
            texto += ".";

        return texto;
    }

    private string NormalizarModo(string? modo)
    {
        if (string.IsNullOrWhiteSpace(modo))
            return "automatico";

        return modo.Trim().Equals("consulta", StringComparison.OrdinalIgnoreCase)
            ? "consulta"
            : "automatico";
    }

    private string NormalizarTexto(string? texto)
    {
        return string.IsNullOrWhiteSpace(texto)
            ? ""
            : texto.Trim().ToLower();
    }

    private List<string> NormalizarLista(IEnumerable<string>? lista)
    {
        if (lista == null)
            return new List<string>();

        return lista
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim().ToLower())
            .Distinct()
            .OrderBy(x => x)
            .ToList();
    }

    private bool ListasIguais(IEnumerable<string>? lista1, IEnumerable<string>? lista2)
    {
        return NormalizarLista(lista1).SequenceEqual(NormalizarLista(lista2));
    }

    private bool MudouAlertas(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return !string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual));

        return !ListasIguais(atual.Alertas, anterior.Alertas);
    }

    private bool MudouSugestao(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return !string.IsNullOrWhiteSpace(atual.Sugestao);

        return NormalizarTexto(atual.Sugestao) != NormalizarTexto(anterior.Sugestao);
    }

    private bool MudouDirecao(RespostaIA atual, RespostaIA? anterior)
    {
        var atualDirecao = NormalizarTexto(atual.Direcao);

        if (anterior == null)
            return !string.IsNullOrWhiteSpace(atualDirecao) && atualDirecao != "sem-direcao";

        return atualDirecao != NormalizarTexto(anterior.Direcao);
    }

    private bool MudouObjetos(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return NormalizarLista(atual.Objetos).Count > 0;

        return !ListasIguais(atual.Objetos, anterior.Objetos);
    }

    private bool MudouPessoa(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return !string.IsNullOrWhiteSpace(atual.Pessoa);

        return NormalizarTexto(atual.Pessoa) != NormalizarTexto(anterior.Pessoa);
    }

    private bool CenaMudouDeFormaRelevante(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return true;

        if (MudouAlertas(atual, anterior)) return true;
        if (MudouSugestao(atual, anterior)) return true;
        if (MudouDirecao(atual, anterior)) return true;
        if (MudouObjetos(atual, anterior)) return true;
        if (MudouPessoa(atual, anterior)) return true;

        return false;
    }

    private bool SugestaoGenerica(string? sugestao)
    {
        var texto = NormalizarTexto(sugestao);

        if (string.IsNullOrWhiteSpace(texto))
            return true;

        var sugestoesGenericas = new List<string>
        {
            "mova-se para frente",
            "siga em frente",
            "continue em frente",
            "avance",
            "continue",
            "siga reto",
            "pode seguir",
            "siga",
            "vá em frente"
        };

        return sugestoesGenericas.Contains(texto);
    }

    private bool EhConfirmacaoContextual(string texto)
    {
        var t = NormalizarTexto(texto);

        return t.Contains("caminho parece livre") ||
               t.Contains("por enquanto") ||
               t.Contains("há uma porta") ||
               t.Contains("há uma cadeira") ||
               t.Contains("há uma mesa");
    }

    private string GarantirPontoFinal(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim();

        if (!texto.EndsWith("."))
            texto += ".";

        return texto;
    }

    private string ValorOuPadrao(string? texto, string padrao)
    {
        return string.IsNullOrWhiteSpace(texto) ? padrao : texto.Trim();
    }

    private string LimparTextoBasico(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim().Replace("\n", " ").Replace("\r", " ");

        while (texto.Contains("  "))
            texto = texto.Replace("  ", " ");

        return texto.Trim();
    }

    private class ContextoRecenteIA
    {
        public string UltimaDescricao { get; set; } = "";
        public string UltimoAlerta { get; set; } = "";
        public string UltimaSugestao { get; set; } = "";
        public string UltimaDirecao { get; set; } = "sem-direcao";
        public string UltimaImportancia { get; set; } = "baixa";
        public string TendenciaCena { get; set; } = "cena estável";
        public string UltimoTextoFalado { get; set; } = "";
    }
}
