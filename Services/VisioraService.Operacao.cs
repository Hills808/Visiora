using System.Diagnostics;
using VisioraAPI.Models;

namespace VisioraAPI.Services;

public partial class VisioraService
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
    private static readonly MemoriaAmbienteAtual _memoriaAmbiente = new();
    private static readonly Dictionary<string, AmbienteMemorizado> _ambientesMemorizados = new(StringComparer.OrdinalIgnoreCase);
    private static readonly List<LeituraTemporal> _historicoTemporal = new();
    private static readonly EstadoTemporalNavegacao _estadoTemporal = new();
    private static EventoNavegacaoInterno? _eventoNavegacaoAtual;
    private static string _ultimoEventoNavegacaoFalado = "";
    private static DateTime _ultimoEventoNavegacaoFaladoEm = DateTime.MinValue;

    private const int INTERVALO_MINIMO_ENTRE_FALAS_SEGUNDOS = 2;
    private const int INTERVALO_CONFIRMACAO_CONTEXTUAL_SEGUNDOS = 8;
    private const int FRAMES_MINIMOS_PARA_CONFIRMAR_MUDANCA = 1;
    private const int REPETICOES_PARA_CONFIRMAR_AMBIENTE = 2;
    private const int REPETICOES_PARA_TRANSICAO = 2;
    private const int JANELA_TEMPORAL_MAXIMA = 8;
    private const int MINIMO_LEITURAS_PERSISTENCIA = 3;
    private const int INTERVALO_MINIMO_ENTRE_EVENTOS_REPETIDOS_SEGUNDOS = 6;

    public VisioraService(OpenAIService openAI, AudioService audioService)
    {
        _openAI = openAI;
        _audioService = audioService;
    }

    public async Task<RespostaComAudio> AnalisarAmbiente(string imagemBase64, string? modo = "automatico", string? pergunta = "")
    {
        return await AnalisarAmbiente(new ImagemRequest
        {
            ImagemBase64 = imagemBase64,
            Modo = modo ?? "automatico",
            Pergunta = pergunta ?? ""
        });
    }

    public async Task<RespostaComAudio> AnalisarAmbiente(ImagemRequest request)
    {
        var cronometro = Stopwatch.StartNew();

        try
        {
            request ??= new ImagemRequest();

            var modoNormalizado = NormalizarModo(request.Modo);
            var modoGuia = modoNormalizado == "guia";
            var primeiraLeitura = request.PrimeiraLeitura || request.ForcarDescricaoInicial || DeveForcarDescricaoInicialGuia(request.Pergunta);
            var forcarDescricaoInicialGuia = modoGuia && primeiraLeitura;
            var forcarFalaPorMovimentoGuia = modoGuia && (request.MudancaVisual >= 4.2 || !request.CenaEstavel || DeveForcarFalaPorMovimentoGuia(request.Pergunta));
            var estadoOperacional = ObterEstadoOperacional(request);

            if (modoGuia && PodeResponderSemAnalisePesada(request))
            {
                cronometro.Stop();
                return MontarRespostaSemNovaAnalise(request, cronometro.ElapsedMilliseconds);
            }

            var contextoParaPrompt = ObterContextoRecenteTexto();
            var perguntaComContextoOperacional = MontarPerguntaOperacional(request, estadoOperacional, primeiraLeitura);

            var respostaIA = await _openAI.AnalisarImagem(
                request.ImagemBase64,
                modoNormalizado,
                perguntaComContextoOperacional,
                contextoParaPrompt);

            AtualizarMemoriaAmbiente(respostaIA);
            AtualizarMotorTemporal(respostaIA);

            var textoAudio = modoNormalizado == "consulta"
                ? MontarTextoAudioConsulta(respostaIA, request.Pergunta)
                : MontarTextoAudioAutomatico(respostaIA);

            if (modoGuia)
            {
                textoAudio = PrepararFalaParaModoGuia(textoAudio, respostaIA, forcarDescricaoInicialGuia, forcarFalaPorMovimentoGuia);
                textoAudio = AplicarPoliticaDeComunicacaoAssistiva(textoAudio, respostaIA, request, primeiraLeitura);
            }

            AtualizarContextoRecente(respostaIA, textoAudio);

            var audioBase64 = "";
            if (DeveUsarTtsExterno(modoNormalizado, textoAudio))
                audioBase64 = await _audioService.GerarAudioBase64(textoAudio);

            var estadoCognitivo = ConstruirEstadoCognitivo(respostaIA);
            var memoriaRecente = ConstruirMemoriaRecente();
            var alertaPrincipal = ObterAlertaPrincipal(respostaIA);
            var pessoaPorPerto = !string.IsNullOrWhiteSpace(respostaIA.Pessoa)
                ? respostaIA.Pessoa.Trim()
                : (_estadoTemporal.PessoaPersistente ? "Pessoa ainda por perto" : "-");
            var eventoGuiaFinal = ObterEventoGuiaFinal(respostaIA, textoAudio, modoGuia);
            var tipoFalaFinal = ClassificarTipoFalaGuia(eventoGuiaFinal, textoAudio, modoGuia);
            var caminhoStatusFinal = ObterCaminhoStatusFinal(respostaIA);

            if (modoGuia)
                RegistrarFalaGuiaRapidaSeNecessario(textoAudio, respostaIA);

            cronometro.Stop();

            return new RespostaComAudio
            {
                Descricao = respostaIA.Descricao,
                Objetos = (respostaIA.Objetos ?? new List<string>()).ToArray(),
                Alertas = (respostaIA.Alertas ?? new List<string>()).ToArray(),
                Pessoa = respostaIA.Pessoa,
                Sugestao = respostaIA.Sugestao,
                Direcao = respostaIA.Direcao,
                Importancia = respostaIA.Importancia,
                AudioBase64 = audioBase64,
                FalaGuia = modoGuia ? textoAudio : "",
                UsarFalaLocal = modoGuia && !string.IsNullOrWhiteSpace(textoAudio),
                ModoGuia = modoGuia,
                TempoProcessamentoMs = (int)Math.Min(int.MaxValue, cronometro.ElapsedMilliseconds),
                TipoFala = tipoFalaFinal,
                EventoGuia = eventoGuiaFinal,
                CaminhoStatus = caminhoStatusFinal,
                DeveFalar = !string.IsNullOrWhiteSpace(textoAudio),
                MotivoFala = string.IsNullOrWhiteSpace(respostaIA.MotivoFala) ? DeterminarMotivoFala(eventoGuiaFinal, primeiraLeitura) : respostaIA.MotivoFala,
                EstadoOperacional = estadoOperacional,
                ResumoAmbiente = string.IsNullOrWhiteSpace(respostaIA.ResumoAmbiente) ? respostaIA.Descricao : respostaIA.ResumoAmbiente,
                PontosInteresse = (respostaIA.PontosInteresse ?? new List<string>()).ToArray(),
                EstadoCognitivo = estadoCognitivo,
                MemoriaRecente = memoriaRecente,
                ConfiancaAmbiente = (int)Math.Round(estadoCognitivo.ConfiancaAmbiente),
                MudancaDetectada = estadoCognitivo.MudancaDetectada || request.MudancaVisual >= 4.2,
                AlertaPrincipal = string.IsNullOrWhiteSpace(alertaPrincipal) ? "-" : alertaPrincipal,
                PessoaPorPerto = string.IsNullOrWhiteSpace(pessoaPorPerto) ? "-" : pessoaPorPerto
            };
        }
        catch (Exception ex)
        {
            cronometro.Stop();

            return new RespostaComAudio
            {
                Descricao = $"Erro: {ex.Message}",
                Objetos = Array.Empty<string>(),
                Alertas = new[] { "falha no processamento" },
                Pessoa = "",
                Sugestao = "",
                Direcao = "",
                Importancia = "alta",
                AudioBase64 = "",
                FalaGuia = "",
                UsarFalaLocal = false,
                ModoGuia = NormalizarModo(request?.Modo) == "guia",
                TempoProcessamentoMs = (int)Math.Min(int.MaxValue, cronometro.ElapsedMilliseconds),
                TipoFala = "erro",
                EventoGuia = "risco",
                CaminhoStatus = "desconhecido",
                DeveFalar = false,
                MotivoFala = "falha no processamento",
                EstadoOperacional = "erro",
                ResumoAmbiente = "",
                PontosInteresse = Array.Empty<string>(),
                EstadoCognitivo = ConstruirEstadoFalha(ex.Message),
                MemoriaRecente = new List<MemoriaRecenteItem>(),
                ConfiancaAmbiente = 0,
                MudancaDetectada = true,
                AlertaPrincipal = ex.Message,
                PessoaPorPerto = "-"
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

        var houveMudancaRelevante = CenaMudouDeFormaRelevante(atual, anterior) || MudancaContextualAmbienteRelevante();
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

            if (_eventoNavegacaoAtual != null && !string.IsNullOrWhiteSpace(_eventoNavegacaoAtual.Tipo))
            {
                _ultimoEventoNavegacaoFalado = _eventoNavegacaoAtual.Tipo;
                _ultimoEventoNavegacaoFaladoEm = agora;
            }

            if (EhConfirmacaoContextual(textoFinal))
                _ultimaConfirmacaoContextualEm = agora;

            _ultimaRespostaIA = atual;
            _framesComMudancaRelevante = 0;
            _framesEstaveis = 0;
            _memoriaAmbiente.HouveMudancaEstruturalRecente = false;
            _memoriaAmbiente.HouveEntradaEmNovoAmbiente = false;
            _memoriaAmbiente.HouveTransicaoConfirmada = false;
        }

        return textoFinal;
    }

    private string MontarTextoAudioConsulta(RespostaIA respostaIA, string? pergunta)
    {
        var partes = new List<string>();
        var anuncioAmbiente = MontarMensagemNovoAmbiente(respostaIA, forcarMesmoSemMudanca: true);

        if (!string.IsNullOrWhiteSpace(anuncioAmbiente))
            partes.Add(anuncioAmbiente);

        var eventoNavegacao = MontarMensagemEventoNavegacaoPrioritario(respostaIA, true);
        if (!string.IsNullOrWhiteSpace(eventoNavegacao) && !TextoJaRepresentado(eventoNavegacao, partes))
            partes.Add(eventoNavegacao);

        var mensagemTemporal = MontarMensagemTemporalPrioritaria(respostaIA, null, true);
        if (!string.IsNullOrWhiteSpace(mensagemTemporal) && !TextoJaRepresentado(mensagemTemporal, partes))
            partes.Add(mensagemTemporal);

        if (!string.IsNullOrWhiteSpace(respostaIA.Descricao) && !TextoJaRepresentado(respostaIA.Descricao, partes))
            partes.Add(SuavizarTexto(respostaIA.Descricao));

        var alertaPrincipal = ObterAlertaPrincipal(respostaIA);
        if (!string.IsNullOrWhiteSpace(alertaPrincipal) && !TextoJaRepresentado(alertaPrincipal, partes))
            partes.Add(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)));

        if (!string.IsNullOrWhiteSpace(respostaIA.Pessoa) && !TextoJaRepresentado(respostaIA.Pessoa, partes))
            partes.Add(SuavizarTexto(respostaIA.Pessoa));

        var contextoUtil = MontarContextoAmbienteUtil(respostaIA, null, true);
        if (!string.IsNullOrWhiteSpace(contextoUtil) && !TextoJaRepresentado(contextoUtil, partes))
            partes.Add(contextoUtil);

        var mudancaInterna = MontarMensagemMudancaNoMesmoAmbiente(respostaIA, null, true);
        if (!string.IsNullOrWhiteSpace(mudancaInterna) && !TextoJaRepresentado(mudancaInterna, partes))
            partes.Add(mudancaInterna);

        if (!string.IsNullOrWhiteSpace(respostaIA.Sugestao) &&
            !SugestaoGenerica(respostaIA.Sugestao) &&
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

        var textoFinal = string.Join(". ", partes.Distinct(StringComparer.OrdinalIgnoreCase));
        textoFinal = LimparTextoParaAudio(textoFinal, 340);

        return GarantirPontoFinal(textoFinal);
    }

    private string ConstruirMensagemAutomatica(RespostaIA atual, RespostaIA? anterior, int utilidade, bool houveMudancaRelevante)
    {
        var importancia = NormalizarTexto(atual.Importancia);
        var alertaPrincipal = ObterAlertaPrincipal(atual);
        var sugestao = LimparTextoBasico(atual.Sugestao);
        var pessoa = LimparTextoBasico(atual.Pessoa);

        var partes = new List<string>();

        var anuncioNovoAmbiente = MontarMensagemNovoAmbiente(atual);
        if (!string.IsNullOrWhiteSpace(anuncioNovoAmbiente))
            partes.Add(anuncioNovoAmbiente);

        var transicao = MontarMensagemTransicaoAmbiente();
        if (!string.IsNullOrWhiteSpace(transicao) && !TextoJaRepresentado(transicao, partes))
            partes.Add(transicao);

        var eventoNavegacao = MontarMensagemEventoNavegacaoPrioritario(atual, false);
        if (!string.IsNullOrWhiteSpace(eventoNavegacao) && !TextoJaRepresentado(eventoNavegacao, partes))
            partes.Add(eventoNavegacao);

        var mensagemTemporal = MontarMensagemTemporalPrioritaria(atual, anterior, false);
        if (!string.IsNullOrWhiteSpace(mensagemTemporal) && !TextoJaRepresentado(mensagemTemporal, partes))
            partes.Add(mensagemTemporal);

        if (!string.IsNullOrWhiteSpace(alertaPrincipal))
        {
            if (MudouAlertas(atual, anterior) || importancia == "alta")
                partes.Add(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)));
        }

        if (partes.Count == 0 &&
            !string.IsNullOrWhiteSpace(pessoa) &&
            (MudouPessoa(atual, anterior) || importancia == "media" || PessoaPareceInteracao(pessoa)))
        {
            partes.Add(SuavizarTexto(pessoa));
        }

        var mudancaNoMesmoAmbiente = MontarMensagemMudancaNoMesmoAmbiente(atual, anterior, false);
        if (!string.IsNullOrWhiteSpace(mudancaNoMesmoAmbiente) && !TextoJaRepresentado(mudancaNoMesmoAmbiente, partes))
            partes.Add(mudancaNoMesmoAmbiente);

        if (!string.IsNullOrWhiteSpace(sugestao) &&
            !SugestaoGenerica(sugestao) &&
            (MudouSugestao(atual, anterior) || importancia == "alta" || utilidade >= 3 || AmbienteAtualEhDinamico()))
        {
            if (!TextoJaRepresentado(sugestao, partes))
                partes.Add(SuavizarTexto(sugestao));
        }

        if (partes.Count == 0)
        {
            var contextoAmbiente = MontarContextoAmbienteUtil(atual, anterior, false);
            if (!string.IsNullOrWhiteSpace(contextoAmbiente))
                partes.Add(contextoAmbiente);
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

        var texto = string.Join(". ", partes.Distinct(StringComparer.OrdinalIgnoreCase));
        texto = LimparTextoParaAudio(texto, 240);

        return GarantirPontoFinal(texto);
    }

    private void AtualizarMemoriaAmbiente(RespostaIA resposta)
    {
        lock (_lockMemoria)
        {
            var sinal = ExtrairSinalAmbiente(resposta);
            _memoriaAmbiente.UltimoMomentoAnalise = DateTime.UtcNow;
            _memoriaAmbiente.PerfilAtual = sinal.Perfil;
            _memoriaAmbiente.ReferenciaAtual = sinal.Referencia;

            if (string.IsNullOrWhiteSpace(sinal.Label))
                return;

            if (string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            {
                RegistrarCandidatoAmbiente(sinal);
                return;
            }

            if (LabelsParecidos(_memoriaAmbiente.AmbienteConfirmado, sinal.Label))
            {
                ConsolidarNoMesmoAmbiente(sinal, resposta);
                return;
            }

            RegistrarSuspeitaDeTransicao(sinal, resposta);
        }
    }

    private void RegistrarCandidatoAmbiente(SinalAmbiente sinal)
    {
        if (LabelsParecidos(_memoriaAmbiente.CandidatoAmbiente, sinal.Label))
        {
            _memoriaAmbiente.RepeticoesCandidato++;
        }
        else
        {
            _memoriaAmbiente.CandidatoAmbiente = sinal.Label;
            _memoriaAmbiente.RepeticoesCandidato = 1;
        }

        _memoriaAmbiente.PerfilCandidato = sinal.Perfil;
        _memoriaAmbiente.ReferenciaCandidata = sinal.Referencia;

        if (_memoriaAmbiente.RepeticoesCandidato >= REPETICOES_PARA_CONFIRMAR_AMBIENTE)
        {
            ConfirmarAmbiente(sinal, houveTransicao: false);
        }
    }

    private void ConsolidarNoMesmoAmbiente(SinalAmbiente sinal, RespostaIA resposta)
    {
        _memoriaAmbiente.CandidatoAmbiente = sinal.Label;
        _memoriaAmbiente.RepeticoesCandidato = Math.Max(_memoriaAmbiente.RepeticoesCandidato, 1);
        _memoriaAmbiente.SuspeitaTransicao = "";
        _memoriaAmbiente.RepeticoesSuspeita = 0;
        _memoriaAmbiente.HouveTransicaoConfirmada = false;
        _memoriaAmbiente.HouveEntradaEmNovoAmbiente = false;

        if (!_ambientesMemorizados.TryGetValue(_memoriaAmbiente.AmbienteConfirmado, out var ambiente))
        {
            ambiente = new AmbienteMemorizado
            {
                Label = _memoriaAmbiente.AmbienteConfirmado,
                Perfil = _memoriaAmbiente.PerfilAtual,
                UltimaReferencia = _memoriaAmbiente.ReferenciaAtual,
                PrimeiroRegistroEm = DateTime.UtcNow
            };
            _ambientesMemorizados[_memoriaAmbiente.AmbienteConfirmado] = ambiente;
        }

        var referenciaAnterior = ambiente.UltimaReferencia;
        var objetosAnteriores = ambiente.ObjetosRecentes.ToList();
        var pessoaAnterior = ambiente.UltimaPessoa;
        var descricaoAnterior = ambiente.UltimaDescricao;
        var direcaoAnterior = ambiente.UltimaDirecao;

        var mudouEstrutura = VerificarMudancaEstrutural(
            ambiente,
            resposta,
            sinal,
            referenciaAnterior,
            objetosAnteriores,
            pessoaAnterior,
            descricaoAnterior,
            direcaoAnterior);

        ambiente.UltimoRegistroEm = DateTime.UtcNow;
        ambiente.TotalLeituras++;
        ambiente.UltimaDescricao = LimparTextoBasico(resposta.Descricao);
        ambiente.UltimaDirecao = LimparTextoBasico(resposta.Direcao);
        ambiente.UltimaReferencia = !string.IsNullOrWhiteSpace(sinal.Referencia) ? sinal.Referencia : ambiente.UltimaReferencia;
        ambiente.Perfil = !string.IsNullOrWhiteSpace(sinal.Perfil) ? sinal.Perfil : ambiente.Perfil;
        ambiente.UltimaPessoa = LimparTextoBasico(resposta.Pessoa);

        var objetosAtuais = NormalizarLista(resposta.Objetos);
        ambiente.ObjetosRecentes = objetosAtuais;

        foreach (var objeto in objetosAtuais)
        {
            if (!ambiente.ContagemObjetos.TryAdd(objeto, 1))
                ambiente.ContagemObjetos[objeto]++;
        }

        _memoriaAmbiente.ReferenciaAtual = ambiente.UltimaReferencia;
        _memoriaAmbiente.PerfilAtual = ambiente.Perfil;
        _memoriaAmbiente.HouveMudancaEstruturalRecente = mudouEstrutura;
        _memoriaAmbiente.UltimaMudancaEstrutural = mudouEstrutura ? ambiente.DescricaoMudancaRecente : "";
    }

    private void RegistrarSuspeitaDeTransicao(SinalAmbiente sinal, RespostaIA resposta)
    {
        if (LabelsParecidos(_memoriaAmbiente.SuspeitaTransicao, sinal.Label))
        {
            _memoriaAmbiente.RepeticoesSuspeita++;
        }
        else
        {
            _memoriaAmbiente.SuspeitaTransicao = sinal.Label;
            _memoriaAmbiente.RepeticoesSuspeita = 1;
        }

        _memoriaAmbiente.ReferenciaSuspeita = sinal.Referencia;
        _memoriaAmbiente.PerfilSuspeita = sinal.Perfil;

        var transicaoForte = SinalSugereTransicaoForte(sinal);

        if (_memoriaAmbiente.RepeticoesSuspeita >= REPETICOES_PARA_TRANSICAO ||
            (transicaoForte && _memoriaAmbiente.RepeticoesSuspeita >= 1))
        {
            ConfirmarAmbiente(sinal, houveTransicao: true);
            AtualizarUltimoAmbienteConfirmado(resposta, sinal);
        }
    }

    private void ConfirmarAmbiente(SinalAmbiente sinal, bool houveTransicao)
    {
        var ambienteAnterior = _memoriaAmbiente.AmbienteConfirmado;

        _memoriaAmbiente.AmbienteAnteriorConfirmado = ambienteAnterior;
        _memoriaAmbiente.AmbienteConfirmado = sinal.Label;
        _memoriaAmbiente.PerfilAtual = sinal.Perfil;
        _memoriaAmbiente.ReferenciaAtual = sinal.Referencia;
        _memoriaAmbiente.CandidatoAmbiente = sinal.Label;
        _memoriaAmbiente.PerfilCandidato = sinal.Perfil;
        _memoriaAmbiente.ReferenciaCandidata = sinal.Referencia;
        _memoriaAmbiente.RepeticoesCandidato = REPETICOES_PARA_CONFIRMAR_AMBIENTE;
        _memoriaAmbiente.SuspeitaTransicao = "";
        _memoriaAmbiente.RepeticoesSuspeita = 0;
        _memoriaAmbiente.HouveEntradaEmNovoAmbiente = true;
        _memoriaAmbiente.HouveTransicaoConfirmada = houveTransicao || !string.IsNullOrWhiteSpace(ambienteAnterior);
        _memoriaAmbiente.HouveMudancaEstruturalRecente = false;
        _memoriaAmbiente.UltimaMudancaEstrutural = "";
        _memoriaAmbiente.EntrouNoAmbienteEm = DateTime.UtcNow;

        if (!_ambientesMemorizados.ContainsKey(sinal.Label))
        {
            _ambientesMemorizados[sinal.Label] = new AmbienteMemorizado
            {
                Label = sinal.Label,
                Perfil = sinal.Perfil,
                UltimaReferencia = sinal.Referencia,
                PrimeiroRegistroEm = DateTime.UtcNow,
                UltimoRegistroEm = DateTime.UtcNow,
                TotalLeituras = 0
            };
        }
    }

    private bool SinalSugereTransicaoForte(SinalAmbiente sinal)
    {
        var label = NormalizarTexto(sinal.Label);
        var atual = NormalizarTexto(_memoriaAmbiente.AmbienteConfirmado);

        if (string.IsNullOrWhiteSpace(label) || LabelsParecidos(label, atual))
            return false;

        return label is "elevador" or "corredor" or "sala de aula" or "recepção" or "recepcao";
    }

    private void AtualizarUltimoAmbienteConfirmado(RespostaIA resposta, SinalAmbiente sinal)
    {
        if (!_ambientesMemorizados.TryGetValue(sinal.Label, out var ambiente))
            return;

        ambiente.UltimaDescricao = LimparTextoBasico(resposta.Descricao);
        ambiente.UltimaDirecao = LimparTextoBasico(resposta.Direcao);
        ambiente.UltimaReferencia = sinal.Referencia;
        ambiente.Perfil = sinal.Perfil;
        ambiente.UltimoRegistroEm = DateTime.UtcNow;
        ambiente.TotalLeituras++;
        ambiente.ObjetosRecentes = NormalizarLista(resposta.Objetos);
    }

    private bool VerificarMudancaEstrutural(
        AmbienteMemorizado ambiente,
        RespostaIA resposta,
        SinalAmbiente sinal,
        string referenciaAnterior,
        List<string> objetosAnteriores,
        string pessoaAnterior,
        string descricaoAnterior,
        string direcaoAnterior)
    {
        var mudou = false;
        var mensagens = new List<string>();

        var referenciaAtual = LimparTextoBasico(sinal.Referencia);
        if (!string.IsNullOrWhiteSpace(referenciaAtual) &&
            !string.IsNullOrWhiteSpace(referenciaAnterior) &&
            !LabelsParecidos(referenciaAtual, referenciaAnterior))
        {
            mensagens.Add($"A referência principal agora parece ser {referenciaAtual.ToLower()}");
            mudou = true;
        }

        var objetosAtuais = NormalizarLista(resposta.Objetos);
        var novosObjetos = objetosAtuais
            .Where(x => !objetosAnteriores.Contains(x, StringComparer.OrdinalIgnoreCase))
            .Take(2)
            .ToList();

        if (novosObjetos.Count > 0)
        {
            mensagens.Add($"Há mudança nesse ambiente: agora aparece {JuntarListaNatural(novosObjetos)}");
            mudou = true;
        }

        var pessoaAtual = LimparTextoBasico(resposta.Pessoa);
        if (!string.IsNullOrWhiteSpace(pessoaAtual) && string.IsNullOrWhiteSpace(pessoaAnterior))
        {
            mensagens.Add("Agora há pessoa por perto nesse ambiente");
            mudou = true;
        }

        var descricaoAtual = LimparTextoBasico(resposta.Descricao);
        if (!string.IsNullOrWhiteSpace(descricaoAtual) &&
            !string.IsNullOrWhiteSpace(descricaoAnterior) &&
            !LabelsParecidos(descricaoAtual, descricaoAnterior) &&
            DescricaoPareceAmbienteUtil(descricaoAtual))
        {
            mensagens.Add("A leitura do ambiente mudou de forma perceptível");
            mudou = true;
        }

        var direcaoAtual = LimparTextoBasico(resposta.Direcao);
        if (!string.IsNullOrWhiteSpace(direcaoAtual) &&
            !string.IsNullOrWhiteSpace(direcaoAnterior) &&
            !string.Equals(direcaoAtual, direcaoAnterior, StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(referenciaAtual))
        {
            mensagens.Add($"Você virou a câmera e agora a referência principal parece ficar em {direcaoAtual.ToLower()}");
            mudou = true;
        }

        ambiente.DescricaoMudancaRecente = mensagens.Count > 0 ? string.Join(". ", mensagens.Distinct(StringComparer.OrdinalIgnoreCase)) : "";

        return mudou;
    }


    private void AtualizarMotorTemporal(RespostaIA resposta)
    {
        lock (_lockMemoria)
        {
            var leitura = new LeituraTemporal
            {
                Em = DateTime.UtcNow,
                Ambiente = LimparTextoBasico(_memoriaAmbiente.AmbienteConfirmado),
                Perfil = LimparTextoBasico(_memoriaAmbiente.PerfilAtual),
                Descricao = LimparTextoBasico(resposta.Descricao),
                AlertaPrincipal = ObterAlertaPrincipal(resposta),
                Pessoa = LimparTextoBasico(resposta.Pessoa),
                Sugestao = LimparTextoBasico(resposta.Sugestao),
                Direcao = LimparTextoBasico(resposta.Direcao),
                Importancia = LimparTextoBasico(resposta.Importancia),
                Objetos = NormalizarLista(resposta.Objetos)
            };

            _historicoTemporal.Add(leitura);

            while (_historicoTemporal.Count > JANELA_TEMPORAL_MAXIMA)
                _historicoTemporal.RemoveAt(0);

            var ultimas = _historicoTemporal.TakeLast(Math.Min(_historicoTemporal.Count, 4)).ToList();
            var ultimasDirecoes = ultimas
                .Select(x => NormalizarTexto(x.Direcao))
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "sem-direcao")
                .ToList();

            var ambienteAtual = NormalizarTexto(_memoriaAmbiente.AmbienteConfirmado);
            var mesmoAmbienteNasUltimas = ultimas.Count >= 3 &&
                ultimas.All(x =>
                    string.IsNullOrWhiteSpace(ambienteAtual) ||
                    string.IsNullOrWhiteSpace(NormalizarTexto(x.Ambiente)) ||
                    LabelsParecidos(x.Ambiente, ambienteAtual));

            var alertasRecentes = ultimas
                .Select(x => NormalizarTexto(x.AlertaPrincipal))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();

            var pessoasRecentes = ultimas
                .Count(x => !string.IsNullOrWhiteSpace(x.Pessoa));

            _estadoTemporal.MesmoAmbienteComMovimento = mesmoAmbienteNasUltimas &&
                ultimasDirecoes.Count >= 3 &&
                ultimasDirecoes.Distinct(StringComparer.OrdinalIgnoreCase).Count() <= 2;

            _estadoTemporal.DirecaoDominante = ultimasDirecoes
                .GroupBy(x => x)
                .OrderByDescending(x => x.Count())
                .Select(x => x.Key)
                .FirstOrDefault() ?? "";

            _estadoTemporal.ObstaculoPersistente = alertasRecentes.Count >= MINIMO_LEITURAS_PERSISTENCIA &&
                alertasRecentes.GroupBy(x => x).Any(g => g.Count() >= MINIMO_LEITURAS_PERSISTENCIA);

            var antes = _historicoTemporal.Take(Math.Max(0, _historicoTemporal.Count - 1)).TakeLast(3).ToList();
            var haviaAlertasAntes = antes.Any(x => !string.IsNullOrWhiteSpace(x.AlertaPrincipal));
            _estadoTemporal.CaminhoLiberadoRecente = haviaAlertasAntes && string.IsNullOrWhiteSpace(leitura.AlertaPrincipal);

            _estadoTemporal.PessoaPersistente = pessoasRecentes >= 2 && !string.IsNullOrWhiteSpace(leitura.Pessoa);

            var houveMudancaApenasDirecao = ultimas.Count >= 3 &&
                ultimasDirecoes.Count >= 2 &&
                ultimas.Select(x => string.Join("|", x.Objetos)).Distinct(StringComparer.OrdinalIgnoreCase).Count() <= 2 &&
                ultimas.Select(x => NormalizarTexto(x.AlertaPrincipal)).Distinct(StringComparer.OrdinalIgnoreCase).Count() <= 2;

            _estadoTemporal.SugereRotacaoDeCamera = mesmoAmbienteNasUltimas &&
                houveMudancaApenasDirecao &&
                ultimasDirecoes.Distinct(StringComparer.OrdinalIgnoreCase).Count() >= 2 &&
                !_estadoTemporal.ObstaculoPersistente;

            _estadoTemporal.ContinuaNoMesmoLugar = mesmoAmbienteNasUltimas && !_memoriaAmbiente.HouveTransicaoConfirmada;
            _estadoTemporal.AmbienteAtual = _memoriaAmbiente.AmbienteConfirmado;
            _estadoTemporal.PerfilAtual = _memoriaAmbiente.PerfilAtual;
            _estadoTemporal.ReferenciaAtual = _memoriaAmbiente.ReferenciaAtual;
            _eventoNavegacaoAtual = DetectarEventoNavegacaoDetalhado(leitura);
            _estadoTemporal.EventoAtual = _eventoNavegacaoAtual;
            _estadoTemporal.UltimoEvento = _eventoNavegacaoAtual?.Tipo ?? DetectarEventoTemporal(leitura);
        }
    }

    private string DetectarEventoTemporal(LeituraTemporal atual)
    {
        if (_memoriaAmbiente.HouveTransicaoConfirmada)
            return "transicao_confirmada";

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente)
            return "novo_ambiente";

        if (_estadoTemporal.CaminhoLiberadoRecente)
            return "caminho_liberado";

        if (_estadoTemporal.ObstaculoPersistente)
            return "obstaculo_persistente";

        if (_estadoTemporal.PessoaPersistente)
            return "pessoa_persistente";

        if (_estadoTemporal.SugereRotacaoDeCamera)
            return "rotacao_de_camera";

        if (_estadoTemporal.MesmoAmbienteComMovimento)
            return "movimento_continuo";

        return "sem_evento";
    }


    private EventoNavegacaoInterno? DetectarEventoNavegacaoDetalhado(LeituraTemporal atual)
    {
        if (_memoriaAmbiente.HouveTransicaoConfirmada && !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
        {
            return new EventoNavegacaoInterno
            {
                Tipo = "transicao_confirmada",
                Descricao = string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteAnteriorConfirmado)
                    ? $"Agora você está em {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}"
                    : $"Você saiu de {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteAnteriorConfirmado)} e entrou em {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}",
                Importancia = "alta",
                Origem = "memoria_ambiente"
            };
        }

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente && !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
        {
            return new EventoNavegacaoInterno
            {
                Tipo = "novo_ambiente",
                Descricao = $"É um ambiente novo, parece {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}",
                Importancia = AmbienteAtualEhDinamico() ? "alta" : "media",
                Origem = "memoria_ambiente"
            };
        }

        if (_estadoTemporal.ObstaculoPersistente)
        {
            var alerta = ObterAlertaPrincipal(new RespostaIA { Alertas = string.IsNullOrWhiteSpace(atual.AlertaPrincipal) ? new List<string>() : new List<string> { atual.AlertaPrincipal } });
            var descricao = !string.IsNullOrWhiteSpace(alerta)
                ? $"O {NormalizarTexto(alerta).Replace("obstaculo", "obstáculo")} continua à frente"
                : "O obstáculo continua no caminho";

            return new EventoNavegacaoInterno
            {
                Tipo = "obstaculo_persistente",
                Descricao = descricao,
                Importancia = "alta",
                Origem = "motor_temporal"
            };
        }

        if (_estadoTemporal.CaminhoLiberadoRecente)
        {
            return new EventoNavegacaoInterno
            {
                Tipo = "caminho_liberado",
                Descricao = "O caminho que parecia bloqueado agora está mais livre",
                Importancia = "media",
                Origem = "motor_temporal"
            };
        }

        if (_estadoTemporal.PessoaPersistente && !string.IsNullOrWhiteSpace(atual.Pessoa))
        {
            return new EventoNavegacaoInterno
            {
                Tipo = "pessoa_persistente",
                Descricao = "Tem uma pessoa por perto ainda",
                Importancia = "media",
                Origem = "motor_temporal"
            };
        }

        if (_estadoTemporal.SugereRotacaoDeCamera && !string.IsNullOrWhiteSpace(_estadoTemporal.AmbienteAtual))
        {
            return new EventoNavegacaoInterno
            {
                Tipo = "rotacao_de_camera",
                Descricao = $"Você continua em {AdicionarArtigoAoAmbiente(_estadoTemporal.AmbienteAtual)}, parece mais uma mudança de direção",
                Importancia = "media",
                Origem = "motor_temporal"
            };
        }

        if (_estadoTemporal.MesmoAmbienteComMovimento && !string.IsNullOrWhiteSpace(_estadoTemporal.AmbienteAtual))
        {
            var descricao = AmbienteAtualEhDinamico()
                ? $"Você continua em {AdicionarArtigoAoAmbiente(_estadoTemporal.AmbienteAtual)}, com movimento ao redor"
                : $"Você continua em {AdicionarArtigoAoAmbiente(_estadoTemporal.AmbienteAtual)}";

            if (!string.IsNullOrWhiteSpace(_estadoTemporal.DirecaoDominante) &&
                _estadoTemporal.DirecaoDominante != "sem-direcao" &&
                _estadoTemporal.DirecaoDominante != "centro")
            {
                descricao += $", seguindo mais para {_estadoTemporal.DirecaoDominante}";
            }

            return new EventoNavegacaoInterno
            {
                Tipo = "movimento_continuo",
                Descricao = descricao,
                Importancia = "baixa",
                Origem = "motor_temporal"
            };
        }

        return null;
    }

    private bool DeveIgnorarEventoPorRepeticao(EventoNavegacaoInterno? evento, bool modoConsulta)
    {
        if (evento == null || string.IsNullOrWhiteSpace(evento.Tipo))
            return true;

        if (modoConsulta)
            return false;

        if (evento.Tipo == "movimento_continuo" && _framesEstaveis >= 1)
            return true;

        if (evento.Tipo == "rotacao_de_camera" && !_memoriaAmbiente.HouveMudancaEstruturalRecente)
            return true;

        if (evento.Importancia == "alta")
            return false;

        if (_ultimoEventoNavegacaoFalado == evento.Tipo &&
            _ultimoEventoNavegacaoFaladoEm != DateTime.MinValue &&
            (DateTime.UtcNow - _ultimoEventoNavegacaoFaladoEm).TotalSeconds < INTERVALO_MINIMO_ENTRE_EVENTOS_REPETIDOS_SEGUNDOS)
        {
            return true;
        }

        return false;
    }

    private string MontarMensagemEventoNavegacaoPrioritario(RespostaIA atual, bool modoConsulta)
    {
        lock (_lockMemoria)
        {
            var evento = _eventoNavegacaoAtual;

            if (DeveIgnorarEventoPorRepeticao(evento, modoConsulta))
                return "";

            if (evento == null)
                return "";

            if (evento.Tipo == "movimento_continuo" && !modoConsulta && _framesEstaveis < 2)
                return "";

            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(evento.Descricao), 220));
        }
    }

    private string MontarMensagemTemporalPrioritaria(RespostaIA atual, RespostaIA? anterior, bool modoConsulta)
    {
        lock (_lockMemoria)
        {
            if (_eventoNavegacaoAtual != null &&
                (_eventoNavegacaoAtual.Tipo == "novo_ambiente" ||
                 _eventoNavegacaoAtual.Tipo == "transicao_confirmada" ||
                 _eventoNavegacaoAtual.Tipo == "obstaculo_persistente" ||
                 _eventoNavegacaoAtual.Tipo == "caminho_liberado" ||
                 _eventoNavegacaoAtual.Tipo == "pessoa_persistente" ||
                 _eventoNavegacaoAtual.Tipo == "rotacao_de_camera"))
            {
                return "";
            }

            if (_estadoTemporal.UltimoEvento == "caminho_liberado")
                return "O caminho parece mais livre agora";

            if (_estadoTemporal.UltimoEvento == "obstaculo_persistente")
            {
                var alerta = ObterAlertaPrincipal(atual);
                if (!string.IsNullOrWhiteSpace(alerta))
                    return $"O {NormalizarTexto(alerta).Replace("obstaculo", "obstáculo")} continua no caminho";
            }

            if (_estadoTemporal.UltimoEvento == "pessoa_persistente" && !string.IsNullOrWhiteSpace(atual.Pessoa))
                return "Tem uma pessoa por perto ainda";

            if (_estadoTemporal.UltimoEvento == "rotacao_de_camera" && !modoConsulta)
                return "Você continua no mesmo ambiente, parece mais uma mudança de direção do que de lugar";

            if (_estadoTemporal.UltimoEvento == "movimento_continuo" &&
                !string.IsNullOrWhiteSpace(_estadoTemporal.AmbienteAtual))
            {
                var baseAmbiente = AdicionarArtigoAoAmbiente(_estadoTemporal.AmbienteAtual);

                if (LabelsParecidos(_estadoTemporal.AmbienteAtual, "corredor") || LabelsParecidos(_estadoTemporal.AmbienteAtual, "ambiente de passagem"))
                    return $"Você continua em {baseAmbiente} e parece seguir por essa passagem";

                if (LabelsParecidos(_estadoTemporal.AmbienteAtual, "elevador"))
                    return $"Você continua em {baseAmbiente}, com espaço mais limitado ao redor";

                if (AmbienteAtualEhDinamico())
                    return $"Você continua em {baseAmbiente}, com movimento ao redor";

                return $"Você continua em {baseAmbiente}";
            }

            if (modoConsulta && _estadoTemporal.ContinuaNoMesmoLugar && !string.IsNullOrWhiteSpace(_estadoTemporal.AmbienteAtual))
                return $"Você parece continuar em {AdicionarArtigoAoAmbiente(_estadoTemporal.AmbienteAtual)}";

            return "";
        }
    }

    private string MontarMensagemNovoAmbiente(RespostaIA atual, bool forcarMesmoSemMudanca = false)
    {
        lock (_lockMemoria)
        {
            if (!_memoriaAmbiente.HouveEntradaEmNovoAmbiente && !forcarMesmoSemMudanca)
                return "";

            var ambiente = _memoriaAmbiente.AmbienteConfirmado;
            if (string.IsNullOrWhiteSpace(ambiente))
                return "";

            var perfil = _memoriaAmbiente.PerfilAtual;
            var referencia = _memoriaAmbiente.ReferenciaAtual;

            var partes = new List<string>
            {
                $"É um ambiente novo, parece {AdicionarArtigoAoAmbiente(ambiente)}"
            };

            if (!string.IsNullOrWhiteSpace(referencia))
                partes.Add($"A principal referência aqui parece ser {referencia.ToLower()}");
            else if (!string.IsNullOrWhiteSpace(atual.Descricao) && DescricaoPareceAmbienteUtil(atual.Descricao))
                partes.Add(SuavizarTexto(atual.Descricao));

            if (perfil == "dinâmico" && !string.IsNullOrWhiteSpace(atual.Sugestao) && !SugestaoGenerica(atual.Sugestao))
                partes.Add(SuavizarTexto(atual.Sugestao));

            return GarantirPontoFinal(LimparTextoParaAudio(string.Join(". ", partes.Distinct(StringComparer.OrdinalIgnoreCase)), 220));
        }
    }

    private string MontarMensagemTransicaoAmbiente()
    {
        lock (_lockMemoria)
        {
            if (!_memoriaAmbiente.HouveTransicaoConfirmada)
                return "";

            if (string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
                return "";

            var ambiente = AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado);

            if (string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteAnteriorConfirmado))
                return $"Agora você está em {ambiente}";

            return $"Você saiu de {_memoriaAmbiente.AmbienteAnteriorConfirmado.ToLower()} e agora está em {ambiente}";
        }
    }

    private string MontarMensagemMudancaNoMesmoAmbiente(RespostaIA atual, RespostaIA? anterior, bool modoConsulta)
    {
        lock (_lockMemoria)
        {
            if (!_memoriaAmbiente.HouveMudancaEstruturalRecente && !modoConsulta)
                return "";

            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.UltimaMudancaEstrutural))
                return _memoriaAmbiente.UltimaMudancaEstrutural;

            if (modoConsulta && !string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual))
                return $"O espaço continua organizado em torno de {_memoriaAmbiente.ReferenciaAtual.ToLower()}";

            return "";
        }
    }

    private string MontarConfirmacaoContextual(RespostaIA atual, RespostaIA? anterior)
    {
        if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)))
            return "";

        if (!string.IsNullOrWhiteSpace(atual.Pessoa))
            return "";

        lock (_lockMemoria)
        {
            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            {
                if (AmbienteAtualEhDinamico())
                    return $"Você continua em {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}, com circulação ao redor";

                if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual))
                    return $"Você continua em {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}, e {_memoriaAmbiente.ReferenciaAtual.ToLower()} continua sendo um bom ponto de noção do espaço";

                return $"Você continua em {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}";
            }
        }

        if (DescricaoPareceAmbienteUtil(atual.Descricao))
            return SuavizarTexto(atual.Descricao);

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

        if (AmbienteAtualEhDinamico())
            return "O ambiente está mais movimentado agora, então vale seguir com atenção";

        if (direcao == "esquerda")
            return "O espaço parece melhor pela esquerda";

        if (direcao == "direita")
            return "O espaço parece melhor pela direita";

        if (direcao == "frente")
            return "O caminho à frente parece livre";

        return "";
    }

    private string MontarContextoAmbienteUtil(RespostaIA atual, RespostaIA? anterior, bool modoConsulta)
    {
        var descricao = LimparTextoBasico(atual.Descricao);
        var descricaoAnterior = LimparTextoBasico(anterior?.Descricao);

        lock (_lockMemoria)
        {
            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            {
                if (modoConsulta)
                {
                    var partes = new List<string>
                    {
                        $"Parece {AdicionarArtigoAoAmbiente(_memoriaAmbiente.AmbienteConfirmado)}"
                    };

                    if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual))
                        partes.Add($"O espaço parece se organizar em torno de {_memoriaAmbiente.ReferenciaAtual.ToLower()}");

                    return string.Join(". ", partes);
                }

                if (MudouDescricaoUtil(atual, anterior) && DescricaoPareceAmbienteUtil(descricao))
                    return SuavizarTexto(descricao);

                return "";
            }
        }

        if (DescricaoPareceAmbienteUtil(descricao) && (MudouDescricaoUtil(atual, anterior) || modoConsulta))
            return SuavizarTexto(descricao);

        if (!string.IsNullOrWhiteSpace(descricaoAnterior) &&
            descricaoAnterior != descricao &&
            DescricaoPareceAmbienteUtil(descricao))
        {
            return "Parece que você entrou em um ambiente diferente";
        }

        return "";
    }
}
