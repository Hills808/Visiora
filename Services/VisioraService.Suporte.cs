using VisioraAPI.Models;

namespace VisioraAPI.Services;

public partial class VisioraService
{
    private static string _ultimaAssinaturaMapaEspacialFalada = "";
    private static DateTime _ultimaAssinaturaMapaEspacialFaladaEm = DateTime.MinValue;

    private SinalAmbiente ExtrairSinalAmbiente(RespostaIA resposta)
    {
        var descricao = NormalizarTexto(resposta.Descricao);
        var objetos = NormalizarLista(resposta.Objetos);
        var referencia = ExtrairReferenciaAmbiente(resposta);

        var label = InferirLabelAmbiente(descricao, objetos);
        var perfil = InferirPerfilAmbiente(descricao, objetos);

        return new SinalAmbiente
        {
            Label = label,
            Perfil = perfil,
            Referencia = referencia
        };
    }

    private string InferirLabelAmbiente(string descricao, List<string> objetos)
    {
        if (string.IsNullOrWhiteSpace(descricao) && objetos.Count == 0)
            return "";

        if (ContemQualquer(descricao, "sala de aula", "carteiras", "lousa", "quadro") ||
            (objetos.Contains("cadeira") && objetos.Contains("mesa") && (objetos.Contains("quadro") || objetos.Contains("lousa"))))
            return "sala de aula";

        if (ContemQualquer(descricao, "elevador"))
            return "elevador";

        if (ContemQualquer(descricao, "corredor", "passagem", "hall") ||
            (objetos.Contains("porta") && objetos.Count <= 3 && !objetos.Contains("cama") && !objetos.Contains("sofá") && !objetos.Contains("sofa")))
            return "corredor";

        if (ContemQualquer(descricao, "recepção", "recepcao"))
            return "recepção";

        if (ContemQualquer(descricao, "escritório", "escritorio") || objetos.Contains("mesa") && objetos.Contains("cadeira") && objetos.Contains("computador"))
            return "escritório";

        if (ContemQualquer(descricao, "quarto") || objetos.Contains("cama") || objetos.Contains("guarda-roupa"))
            return "quarto";

        if (ContemQualquer(descricao, "sala") || objetos.Contains("sofá") || objetos.Contains("sofa") ||
            (objetos.Contains("mesa") && objetos.Contains("cadeira") && !objetos.Contains("computador") && !objetos.Contains("lousa") && !objetos.Contains("quadro")))
            return "sala";

        if (ContemQualquer(descricao, "cozinha") || objetos.Contains("geladeira") || objetos.Contains("fogão") || objetos.Contains("fogao") || objetos.Contains("pia"))
            return "cozinha";

        if (ContemQualquer(descricao, "banheiro") || objetos.Contains("pia") && objetos.Contains("espelho"))
            return "banheiro";

        if (ContemQualquer(descricao, "mercado", "supermercado"))
            return "mercado";

        if (ContemQualquer(descricao, "farmácia", "farmacia"))
            return "farmácia";

        if (ContemQualquer(descricao, "loja") || objetos.Contains("prateleira") || objetos.Contains("balcão") || objetos.Contains("balcao"))
            return "loja";

        if (ContemQualquer(descricao, "ambiente comercial"))
            return "ambiente comercial";

        if (ContemQualquer(descricao, "ambiente doméstico", "ambiente domestico"))
            return "ambiente doméstico";

        if (ContemQualquer(descricao, "ambiente interno de passagem", "ambiente de passagem"))
            return "ambiente de passagem";

        return "";
    }

    private string InferirPerfilAmbiente(string descricao, List<string> objetos)
    {
        if (ContemQualquer(descricao, "movimentado", "circulação", "circulacao", "passagem", "mercado", "loja", "recepção", "recepcao", "corredor", "elevador"))
            return "dinâmico";

        if (ContemQualquer(descricao, "quarto", "sala", "cozinha", "banheiro", "escritório", "escritorio", "doméstico", "domestico", "móveis fixos", "moveis fixos"))
            return "estável";

        if (objetos.Contains("cama") || objetos.Contains("guarda-roupa") || objetos.Contains("sofá") || objetos.Contains("sofa"))
            return "estável";

        if (objetos.Contains("prateleira") || objetos.Contains("balcão") || objetos.Contains("balcao") || objetos.Contains("carrinho"))
            return "dinâmico";

        return "indefinido";
    }

    private string ExtrairReferenciaAmbiente(RespostaIA resposta)
    {
        var objetos = NormalizarLista(resposta.Objetos);
        var direcao = NormalizarTexto(resposta.Direcao);

        if (objetos.Contains("lousa") || objetos.Contains("quadro"))
            return "quadro";

        if (objetos.Contains("cama"))
            return direcao switch
            {
                "esquerda" => "cama à esquerda",
                "direita" => "cama à direita",
                _ => "cama"
            };

        if (objetos.Contains("guarda-roupa"))
            return direcao switch
            {
                "esquerda" => "guarda-roupa à esquerda",
                "direita" => "guarda-roupa à direita",
                _ => "guarda-roupa"
            };

        if (objetos.Contains("porta"))
            return direcao switch
            {
                "esquerda" => "porta à esquerda",
                "direita" => "porta à direita",
                _ => "porta"
            };

        if (objetos.Contains("balcão") || objetos.Contains("balcao"))
            return "balcão";

        if (objetos.Contains("prateleira"))
            return "prateleiras";

        if (objetos.Contains("mesa"))
            return direcao switch
            {
                "esquerda" => "mesa à esquerda",
                "direita" => "mesa à direita",
                _ => "mesa"
            };

        return "";
    }

    private bool TemReferenciaFixaUtil(RespostaIA resposta)
    {
        return !string.IsNullOrWhiteSpace(ExtrairReferenciaAmbiente(resposta));
    }

    private bool TemIndicioAmbienteUtil(RespostaIA resposta)
    {
        return DescricaoPareceAmbienteUtil(resposta.Descricao) || TemReferenciaFixaUtil(resposta);
    }

    private bool DescricaoPareceAmbienteUtil(string? descricao)
    {
        var texto = NormalizarTexto(descricao);

        if (string.IsNullOrWhiteSpace(texto))
            return false;

        var chaves = new[]
        {
            "sala de aula", "elevador", "corredor", "quarto", "sala", "cozinha", "banheiro",
            "escritorio", "escritório", "recepcao", "recepção", "loja", "mercado", "farmacia", "farmácia",
            "ambiente comercial", "ambiente domestico", "ambiente doméstico", "ambiente interno", "ambiente de passagem",
            "moveis fixos", "móveis fixos", "prateleiras", "circulacao", "circulação"
        };

        return chaves.Any(texto.Contains);
    }

    private bool DescricaoPareceAmbienteDinamico(string? descricao)
    {
        var texto = NormalizarTexto(descricao);

        if (string.IsNullOrWhiteSpace(texto))
            return false;

        return ContemQualquer(texto, "comercial", "prateleiras", "circulacao", "circulação", "movimentado", "passagem", "recepcao", "recepção", "mercado", "farmacia", "farmácia", "loja", "corredor", "elevador");
    }

    private bool DescricaoPareceAmbienteEstavel(string? descricao)
    {
        var texto = NormalizarTexto(descricao);

        if (string.IsNullOrWhiteSpace(texto))
            return false;

        return ContemQualquer(texto, "quarto", "sala", "cozinha", "banheiro", "escritorio", "escritório", "domestico", "doméstico", "moveis fixos", "móveis fixos", "sala de aula");
    }

    private bool PessoaPareceInteracao(string? pessoa)
    {
        var texto = NormalizarTexto(pessoa);

        if (string.IsNullOrWhiteSpace(texto))
            return false;

        return texto.Contains("interagir") ||
               texto.Contains("mao estendida") ||
               texto.Contains("mão estendida") ||
               texto.Contains("acen") ||
               texto.Contains("chamando") ||
               texto.Contains("olhando para voce") ||
               texto.Contains("olhando para você") ||
               texto.Contains("aproximando");
    }

    private string TransformarAlertaEmFala(string alerta)
    {
        var texto = NormalizarTexto(alerta);

        if (texto.Contains("muito proximo") || texto.Contains("muito próximo"))
            return "Cuidado, tem um obstáculo muito perto";

        if (texto.Contains("obstaculo") && texto.Contains("frente") || texto.Contains("obstáculo") && texto.Contains("frente"))
            return "Cuidado, tem um obstáculo à frente";

        if (texto.Contains("bloqueado"))
            return "Atenção, o caminho está bloqueado";

        if (texto.Contains("parcialmente bloqueado"))
            return "Atenção, o caminho está parcialmente bloqueado";

        if (texto.Contains("circulacao intensa") || texto.Contains("circulação intensa"))
            return "Atenção, tem bastante movimento à frente";

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
            "porta", "cadeira", "mesa", "escada", "pessoa", "parede", "balcão", "balcao", "mochila",
            "garrafa", "copo", "sofá", "sofa", "cama", "guarda-roupa", "prateleira", "geladeira",
            "fogão", "fogao", "pia", "carrinho", "quadro", "lousa"
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
                "Perfil recente do ambiente: " + ValorOuPadrao(_contextoRecente.PerfilAmbiente, "não definido") + ". " +
                "Referência de ambiente recente: " + ValorOuPadrao(_contextoRecente.ReferenciaAmbiente, "nenhuma") + ". " +
                "Mudança estrutural recente: " + ValorOuPadrao(_memoriaAmbiente.UltimaMudancaEstrutural, "nenhuma") + ". " +
                "Ambiente confirmado em memória: " + ValorOuPadrao(_memoriaAmbiente.AmbienteConfirmado, "nenhum") + ". " +
                "Ambiente anterior em memória: " + ValorOuPadrao(_memoriaAmbiente.AmbienteAnteriorConfirmado, "nenhum") + ". " +
                "Suspeita de transição: " + ValorOuPadrao(_memoriaAmbiente.SuspeitaTransicao, "nenhuma") + ". " +
                "Evento temporal recente: " + ValorOuPadrao(_estadoTemporal.UltimoEvento, "sem_evento") + ". " +
                "Descrição do evento temporal recente: " + ValorOuPadrao(_estadoTemporal.EventoAtual?.Descricao, "nenhuma") + ". " +
                "Direção dominante recente: " + ValorOuPadrao(_estadoTemporal.DirecaoDominante, "sem-direcao") + ". " +
                "Continuidade do lugar: " + (_estadoTemporal.ContinuaNoMesmoLugar ? "continua no mesmo ambiente" : "sem continuidade confirmada") + ". " +
                "Último texto falado: " + ValorOuPadrao(_contextoRecente.UltimoTextoFalado, "nenhum") + ". " +
                MontarContextoMemoriaPersistente();
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
            _contextoRecente.PerfilAmbiente = DetectarPerfilAmbiente(atual);
            _contextoRecente.ReferenciaAmbiente = ExtrairReferenciaAmbiente(atual);
        }
    }

    private string DetectarTendenciaCena(RespostaIA atual, RespostaIA? anterior)
    {
        if (!string.IsNullOrWhiteSpace(_estadoTemporal.UltimoEvento) && _estadoTemporal.UltimoEvento != "sem_evento")
        {
            return _estadoTemporal.UltimoEvento switch
            {
                "transicao_confirmada" => "ambiente mudou",
                "novo_ambiente" => "entrada em novo ambiente",
                "caminho_liberado" => "caminho ficou mais livre",
                "obstaculo_persistente" => "obstáculo permanece no trajeto",
                "pessoa_persistente" => "pessoa permanece por perto",
                "rotacao_de_camera" => "mesmo ambiente com mudança de direção",
                "movimento_continuo" => "deslocamento contínuo no mesmo ambiente",
                _ => "cena estável"
            };
        }

        if (_memoriaAmbiente.HouveTransicaoConfirmada)
            return "ambiente mudou";

        if (_memoriaAmbiente.HouveMudancaEstruturalRecente)
            return "mudança dentro do mesmo ambiente";

        if (anterior == null)
            return "primeira análise recente";

        var alertaAtual = NormalizarTexto(ObterAlertaPrincipal(atual));
        var alertaAnterior = NormalizarTexto(ObterAlertaPrincipal(anterior));
        var importanciaAtual = NormalizarTexto(atual.Importancia);
        var importanciaAnterior = NormalizarTexto(anterior.Importancia);
        var direcaoAtual = NormalizarTexto(atual.Direcao);
        var direcaoAnterior = NormalizarTexto(anterior.Direcao);

        if (!string.IsNullOrWhiteSpace(alertaAtual) && string.IsNullOrWhiteSpace(alertaAnterior))
            return "novo alerta detectado";

        if (!string.IsNullOrWhiteSpace(alertaAtual) && alertaAtual == alertaAnterior)
            return importanciaAtual == "alta" ? "risco parece mais próximo" : "alerta permanece no ambiente";

        if (direcaoAtual != direcaoAnterior && direcaoAtual != "sem-direcao" && direcaoAnterior != "sem-direcao")
            return "mudança de referência espacial";

        if (importanciaAtual == "baixa" && importanciaAnterior != "baixa")
            return "risco reduziu ou saiu do caminho";

        if (AmbienteAtualEhDinamico())
            return "ambiente mais dinâmico";

        return "cena estável";
    }

    private string DetectarPerfilAmbiente(RespostaIA resposta)
    {
        lock (_lockMemoria)
        {
            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.PerfilAtual) && _memoriaAmbiente.PerfilAtual != "indefinido")
                return _memoriaAmbiente.PerfilAtual;
        }

        if (DescricaoPareceAmbienteDinamico(resposta.Descricao))
            return "dinâmico";

        if (DescricaoPareceAmbienteEstavel(resposta.Descricao))
            return "estável";

        if (TemReferenciaFixaUtil(resposta))
            return "organizado por referências fixas";

        return "indefinido";
    }


private bool DeveForcarDescricaoInicialGuia(string? pergunta)
{
    var texto = NormalizarTexto(pergunta);

    if (string.IsNullOrWhiteSpace(texto))
        return false;

    return texto.Contains("primeira leitura") ||
           texto.Contains("descricao inicial") ||
           texto.Contains("descrição inicial") ||
           texto.Contains("inicio do guia") ||
           texto.Contains("início do guia") ||
           texto.Contains("ambiente inicial");
}

private bool DeveForcarFalaPorMovimentoGuia(string? pergunta)
{
    var texto = NormalizarTexto(pergunta);

    if (string.IsNullOrWhiteSpace(texto))
        return false;

    return texto.Contains("movimento detectado") ||
           texto.Contains("mudanca visual") ||
           texto.Contains("mudança visual") ||
           texto.Contains("camera virou") ||
           texto.Contains("câmera virou") ||
           texto.Contains("nova direcao") ||
           texto.Contains("nova direção") ||
           texto.Contains("objeto novo") ||
           texto.Contains("possivel transicao") ||
           texto.Contains("possível transição");
}

private string PrepararFalaParaModoGuia(string textoBase, RespostaIA atual, bool forcarDescricaoInicial = false, bool forcarFalaPorMovimento = false)
{
    var importancia = NormalizarTexto(atual.Importancia);
    var alertaPrincipal = ObterAlertaPrincipal(atual);
    var eventoGuia = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
    var falaCurta = LimparTextoBasico(atual.FalaCurta);

    lock (_lockMemoria)
    {
        var agora = DateTime.UtcNow;
        var primeiraFalaDoGuia = _ultimaFalaEm == DateTime.MinValue || string.IsNullOrWhiteSpace(_ultimoTextoFalado);

        if (forcarDescricaoInicial || primeiraFalaDoGuia || eventoGuia == "inicio")
            return CriarFalaInicialDoGuia(atual, true);

        if (!string.IsNullOrWhiteSpace(alertaPrincipal))
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)), 120));

        if (eventoGuia == "risco" && !TextoEhGenericoParaGuia(falaCurta))
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 120));

        if (_memoriaAmbiente.HouveTransicaoConfirmada && !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            return CriarFalaDeTransicaoGuia(atual);

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente && !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            return CriarFalaDeTransicaoGuia(atual);

        if (eventoGuia == "novo_ambiente")
            return CriarFalaDeTransicaoGuia(atual);

        if (!string.IsNullOrWhiteSpace(atual.Pessoa) &&
            (MudouPessoa(atual, _ultimaRespostaIA) || eventoGuia == "pessoa" || PessoaPareceInteracao(atual.Pessoa)))
        {
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(atual.Pessoa), 140));
        }

        if (eventoGuia == "pessoa" && !TextoEhGenericoParaGuia(falaCurta))
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 140));

        if (eventoGuia == "ponto_interesse")
        {
            var ponto = CriarFalaPontoDeInteresse(atual);
            if (!string.IsNullOrWhiteSpace(ponto))
                return ponto;
        }

        if (_estadoTemporal.CaminhoLiberadoRecente || eventoGuia == "livre")
        {
            if (!TextoEhGenericoParaGuia(falaCurta) && !FalaPareceComandoDeDestino(falaCurta))
                return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 150));

            return "A passagem à frente parece livre, se você for se mover.";
        }

        if (_memoriaAmbiente.HouveMudancaEstruturalRecente && !string.IsNullOrWhiteSpace(_memoriaAmbiente.UltimaMudancaEstrutural))
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(_memoriaAmbiente.UltimaMudancaEstrutural), 170));

        if (forcarFalaPorMovimento || eventoGuia is "mudanca" or "observacao")
        {
            var falaMovimento = CriarFalaDeMudancaOuMovimento(atual, textoBase);
            if (!string.IsNullOrWhiteSpace(falaMovimento) && !TextoEhGenericoParaGuia(falaMovimento))
                return falaMovimento;
        }

        if (DeveEmitirConfirmacaoDeConforto(agora, atual))
            return "Continuo acompanhando. Sem mudança importante agora.";
    }

    if (!TextoEhGenericoParaGuia(falaCurta) && importancia != "baixa" && !FalaPareceComandoDeDestino(falaCurta))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 160));

    var sugestao = LimparTextoBasico(atual.Sugestao);
    if (!string.IsNullOrWhiteSpace(sugestao) && !SugestaoGenerica(sugestao) && importancia == "alta")
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(sugestao), 140));

    return "";
}


private string CriarFalaInicialDoGuia(RespostaIA atual, bool exigirDescricaoUtil = false)
{
    var alertaPrincipal = ObterAlertaPrincipal(atual);
    var pessoa = LimparTextoBasico(atual.Pessoa);
    var descricao = LimparTextoBasico(atual.Descricao);
    var sugestao = LimparTextoBasico(atual.Sugestao);
    var direcao = NormalizarTexto(atual.Direcao);
    var caminhoStatus = NormalizarTexto(atual.CaminhoStatus).Replace(" ", "_").Replace("-", "_");
    var objetos = NormalizarLista(atual.Objetos)
        .Where(ObjetoEhUtil)
        .Take(5)
        .ToList();

    var falaPanoramicaSuperior = CriarFalaPanoramicaAssistivaSuperior(atual, true);
    if (!string.IsNullOrWhiteSpace(falaPanoramicaSuperior))
        return GarantirPontoFinal(LimparTextoParaAudio(falaPanoramicaSuperior, 560));

    var ambiente = "";
    var referencia = "";

    lock (_lockMemoria)
    {
        ambiente = !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado)
            ? _memoriaAmbiente.AmbienteConfirmado
            : _memoriaAmbiente.CandidatoAmbiente;

        referencia = !string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual)
            ? _memoriaAmbiente.ReferenciaAtual
            : _memoriaAmbiente.ReferenciaCandidata;
    }

    var partes = new List<string>();

    var descricaoEspacial = CriarDescricaoEspacialInicial(atual, ambiente, referencia, objetos, descricao);
    if (!string.IsNullOrWhiteSpace(descricaoEspacial))
        partes.Add(descricaoEspacial);
    else
        partes.Add("Estou analisando o espaço ao seu redor para te situar com mais clareza");

    if (!string.IsNullOrWhiteSpace(alertaPrincipal))
    {
        var alertaFala = SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal));
        if (!TextoJaRepresentado(alertaFala, partes))
            partes.Add(alertaFala);
    }
    else
    {
        var falaCaminho = CriarFalaDeCaminhoInicial(caminhoStatus, sugestao, direcao);
        if (!string.IsNullOrWhiteSpace(falaCaminho) && !TextoJaRepresentado(falaCaminho, partes))
            partes.Add(falaCaminho);
        else if (!DescricaoJaMencionaCaminho(partes.FirstOrDefault()))
            partes.Add("Não percebo obstáculo imediato à frente");
    }

    if (!string.IsNullOrWhiteSpace(pessoa))
    {
        var pessoaFala = SuavizarTexto(pessoa);
        if (!TextoJaRepresentado(pessoaFala, partes))
            partes.Add(pessoaFala);
    }
    else
    {
        var referenciaFala = CriarFalaReferenciaInicial(referencia, objetos, direcao);
        if (!string.IsNullOrWhiteSpace(referenciaFala) && !TextoJaRepresentado(referenciaFala, partes))
            partes.Add(referenciaFala);
    }

    return GarantirPontoFinal(LimparTextoParaAudio(string.Join(". ", partes.Distinct(StringComparer.OrdinalIgnoreCase)), 430));
}

private string CriarDescricaoEspacialInicial(RespostaIA atual, string ambiente, string referencia, List<string> objetos, string descricao)
{
    var partes = new List<string>();

    if (DescricaoServeComoDescricaoInicial(descricao) && !DescricaoInicialCurtaDemais(descricao, ambiente))
    {
        partes.Add(SuavizarTexto(descricao));
    }
    else if (!string.IsNullOrWhiteSpace(ambiente))
    {
        partes.Add($"Parece {AdicionarArtigoAoAmbiente(ambiente)}");
    }
    else if (DescricaoServeComoDescricaoInicial(descricao))
    {
        partes.Add(SuavizarTexto(descricao));
    }
    else
    {
        partes.Add("Estou percebendo um ambiente interno à frente");
    }

    var objetosPrincipais = objetos
        .Where(x => !ObjetoEhPessoaOuRiscoGenerico(x))
        .Take(4)
        .ToList();

    if (objetosPrincipais.Count > 0 && !DescricaoJaMencionaObjetos(partes.FirstOrDefault(), objetosPrincipais))
    {
        partes.Add($"Vejo como principais referências {JuntarListaNatural(objetosPrincipais)}");
    }

    if (!string.IsNullOrWhiteSpace(referencia) &&
        !NormalizarTexto(string.Join(". ", partes)).Contains(NormalizarTexto(referencia)))
    {
        partes.Add($"A referência mais clara parece ser {referencia.ToLowerInvariant()}");
    }

    var referenciasPersistentes = ObterReferenciasPersistentesDoAmbienteAtual()
        .Where(x => !NormalizarTexto(string.Join(". ", partes)).Contains(NormalizarTexto(x)))
        .Take(2)
        .ToList();

    if (referenciasPersistentes.Count > 0)
        partes.Add($"As referências que mais se repetem aqui são {JuntarListaNatural(referenciasPersistentes)}");

    return string.Join(". ", partes.Where(x => !string.IsNullOrWhiteSpace(x)));
}

private bool DescricaoInicialCurtaDemais(string descricao, string ambiente)
{
    var texto = NormalizarTexto(descricao);
    var ambienteNormalizado = NormalizarTexto(ambiente);

    if (string.IsNullOrWhiteSpace(texto))
        return true;

    var palavras = texto.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;

    if (palavras <= 6)
        return true;

    if (!string.IsNullOrWhiteSpace(ambienteNormalizado) &&
        (texto == $"parece {ambienteNormalizado}" || texto == $"parece um {ambienteNormalizado}" || texto == $"parece uma {ambienteNormalizado}"))
    {
        return true;
    }

    return false;
}

private bool DescricaoJaMencionaCaminho(string? texto)
{
    var t = NormalizarTexto(texto);
    return t.Contains("caminho") || t.Contains("passagem") || t.Contains("livre") || t.Contains("bloque") || t.Contains("obstaculo") || t.Contains("obstáculo");
}

private bool DescricaoJaMencionaObjetos(string? texto, List<string> objetos)
{
    var t = NormalizarTexto(texto);
    if (string.IsNullOrWhiteSpace(t))
        return false;

    return objetos.Any(objeto => t.Contains(NormalizarTexto(objeto)));
}

private bool ObjetoEhPessoaOuRiscoGenerico(string objeto)
{
    var texto = NormalizarTexto(objeto);
    return texto is "pessoa" or "obstaculo" or "obstáculo" or "risco";
}

private string CriarFalaDeTransicaoGuia(RespostaIA atual)
{
    var descricao = LimparTextoBasico(atual.Descricao);
    var alertaPrincipal = ObterAlertaPrincipal(atual);
    var pessoa = LimparTextoBasico(atual.Pessoa);
    var falaCurta = LimparTextoBasico(atual.FalaCurta);
    var caminhoStatus = NormalizarTexto(atual.CaminhoStatus).Replace(" ", "_").Replace("-", "_");

    var ambiente = "";
    var referencia = "";

    lock (_lockMemoria)
    {
        ambiente = _memoriaAmbiente.AmbienteConfirmado;
        referencia = _memoriaAmbiente.ReferenciaAtual;
    }

    var partes = new List<string>();

    if (!TextoEhGenericoParaGuia(falaCurta) && NormalizarTexto(atual.EventoGuia).Contains("novo"))
        partes.Add(SuavizarTexto(falaCurta));
    else if (!string.IsNullOrWhiteSpace(ambiente))
        partes.Add($"Parece que o ambiente mudou. Agora parece {AdicionarArtigoAoAmbiente(ambiente)}");
    else if (DescricaoServeComoDescricaoInicial(descricao))
        partes.Add(SuavizarTexto(descricao));
    else
        partes.Add("A cena mudou. Pode ser outro ponto do ambiente.");

    if (!string.IsNullOrWhiteSpace(alertaPrincipal))
        partes.Add(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)));
    else if (!string.IsNullOrWhiteSpace(pessoa))
        partes.Add(SuavizarTexto(pessoa));
    else
    {
        var caminho = CriarFalaDeCaminhoInicial(caminhoStatus, atual.Sugestao, atual.Direcao);
        if (!string.IsNullOrWhiteSpace(caminho))
            partes.Add(caminho);
        else if (!string.IsNullOrWhiteSpace(referencia))
            partes.Add($"{PrimeiraLetraMaiuscula(referencia)} aparece como referência no ambiente");
    }

    return GarantirPontoFinal(LimparTextoParaAudio(string.Join(". ", partes.Distinct(StringComparer.OrdinalIgnoreCase)), 210));
}

private bool DescricaoServeComoDescricaoInicial(string? descricao)
{
    var texto = NormalizarTexto(descricao);

    if (string.IsNullOrWhiteSpace(texto))
        return false;

    if (texto.Contains("mesmo ambiente") ||
        texto.Contains("vou avisar") ||
        texto.Contains("continuo acompanhando") ||
        texto.Contains("cena estavel") ||
        texto.Contains("cena estável") ||
        texto.Contains("sem mudanca") ||
        texto.Contains("sem mudança") ||
        texto.Contains("nada relevante"))
    {
        return false;
    }

    return true;
}

private string CriarFalaDeMudancaOuMovimento(RespostaIA atual, string textoBase)
{
    var alertaPrincipal = ObterAlertaPrincipal(atual);
    if (!string.IsNullOrWhiteSpace(alertaPrincipal))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(TransformarAlertaEmFala(alertaPrincipal)), 120));

    var pessoa = LimparTextoBasico(atual.Pessoa);
    if (!string.IsNullOrWhiteSpace(pessoa))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(pessoa), 130));

    var falaCurta = LimparTextoBasico(atual.FalaCurta);
    if (!TextoEhGenericoParaGuia(falaCurta) && !FalaPareceComandoDeDestino(falaCurta))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 160));

    var pontoInteresse = CriarFalaPontoDeInteresse(atual);
    if (!string.IsNullOrWhiteSpace(pontoInteresse))
        return pontoInteresse;

    if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.UltimaMudancaEstrutural))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(_memoriaAmbiente.UltimaMudancaEstrutural), 150));

    var sugestao = LimparTextoBasico(atual.Sugestao);
    if (!string.IsNullOrWhiteSpace(sugestao) && !SugestaoGenerica(sugestao) && !TextoEhGenericoParaGuia(sugestao))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(sugestao), 140));

    var objetos = NormalizarLista(atual.Objetos)
        .Where(ObjetoEhUtil)
        .Take(2)
        .ToList();

    if (objetos.Count > 0)
    {
        var direcao = NormalizarTexto(atual.Direcao);
        var local = direcao is "esquerda" or "direita" or "frente" or "centro"
            ? $" {TextoDirecaoNatural(direcao)}"
            : "";

        return GarantirPontoFinal(LimparTextoParaAudio($"Agora percebo {JuntarListaNatural(objetos)}{local}", 130));
    }

    var descricao = LimparTextoBasico(atual.Descricao);
    if (DescricaoServeComoDescricaoInicial(descricao) && !TextoEhGenericoParaGuia(descricao))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(descricao), 140));

    return "";
}


private string CriarFalaDeCaminhoInicial(string caminhoStatus, string? sugestao, string? direcao)
{
    var sugestaoLimpa = LimparTextoBasico(sugestao);
    var direcaoNormalizada = NormalizarTexto(direcao);

    if (!string.IsNullOrWhiteSpace(sugestaoLimpa) &&
        !SugestaoGenerica(sugestaoLimpa) &&
        !TextoEhGenericoParaGuia(sugestaoLimpa) &&
        !FalaPareceComandoDeDestino(sugestaoLimpa))
    {
        return SuavizarTexto(TornarOrientacaoCondicional(sugestaoLimpa));
    }

    return caminhoStatus switch
    {
        "livre" => "A passagem à frente parece livre, se você for se mover",
        "parcialmente_livre" => "Há passagem, mas com atenção se você for andar",
        "estreito" => "A passagem parece estreita, então vale cuidado se for se mover",
        "movimentado" => "Há movimento por perto, então é bom manter atenção",
        "bloqueado" => "A passagem parece bloqueada",
        _ when direcaoNormalizada == "frente" => "O centro parece mais livre, caso você precise se mover",
        _ when direcaoNormalizada == "direita" => "A área à direita parece mais aberta",
        _ when direcaoNormalizada == "esquerda" => "A área à esquerda parece mais aberta",
        _ => ""
    };
}


private string CriarFalaReferenciaInicial(string referencia, List<string> objetos, string direcao)
{
    if (!string.IsNullOrWhiteSpace(referencia))
    {
        var refNorm = NormalizarTexto(referencia);
        if (refNorm.Contains("porta"))
            return $"Há {referencia.ToLowerInvariant()} visível, caso você precise sair";

        return $"{PrimeiraLetraMaiuscula(referencia)} aparece como ponto de referência";
    }

    var uteis = objetos
        .Where(x => x is "porta" or "cadeira" or "mesa" or "cama" or "sofa" or "sofá" or "balcao" or "balcão" or "parede" or "quadro" or "lousa")
        .Take(2)
        .ToList();

    if (uteis.Count == 0)
        return "";

    var direcaoNatural = TextoDirecaoNatural(direcao);
    return string.IsNullOrWhiteSpace(direcaoNatural)
        ? $"Também percebo {JuntarListaNatural(uteis)} por perto"
        : $"Também percebo {JuntarListaNatural(uteis)} {direcaoNatural}";
}


private string TextoDirecaoNatural(string? direcao)
{
    return NormalizarTexto(direcao) switch
    {
        "esquerda" => "à esquerda",
        "direita" => "à direita",
        "frente" => "à frente",
        "centro" => "no centro",
        _ => ""
    };
}

private bool TextoEhGenericoParaGuia(string? texto)
{
    var t = NormalizarTexto(texto);

    if (string.IsNullOrWhiteSpace(t))
        return true;

    var proibidos = new[]
    {
        "vou avisar", "coisas importantes", "mesmo ambiente", "voce continua", "você continua",
        "referencias podem ajudar", "referências podem ajudar", "referencia fixa", "referência fixa",
        "estado cognitivo", "evento temporal", "sem mudanca", "sem mudança", "nada relevante",
        "cena estavel", "cena estável", "ambiente estavel", "ambiente estável"
    };

    if (proibidos.Any(t.Contains))
        return true;

    return false;
}

private string CriarFalaPontoDeInteresse(RespostaIA atual)
{
    var falaCurta = LimparTextoBasico(atual.FalaCurta);
    if (!TextoEhGenericoParaGuia(falaCurta) && !FalaPareceComandoDeDestino(falaCurta))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(falaCurta), 170));

    var pontos = (atual.PontosInteresse ?? new List<string>())
        .Concat(NormalizarLista(atual.Objetos))
        .Where(ObjetoEhUtil)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Take(2)
        .ToList();

    var direcao = TextoDirecaoNatural(atual.Direcao);

    if (pontos.Any(x => NormalizarTexto(x).Contains("porta")))
        return GarantirPontoFinal($"Há uma porta visível {direcao}, caso você precise sair".Replace("  ", " "));

    if (pontos.Any(x => NormalizarTexto(x).Contains("passagem") || NormalizarTexto(x).Contains("corredor")))
        return GarantirPontoFinal($"Há uma passagem {direcao}, se você precisar se mover".Replace("  ", " "));

    if (pontos.Count > 0)
        return GarantirPontoFinal(LimparTextoParaAudio($"Agora percebo {JuntarListaNatural(pontos)} {direcao}".Replace("  ", " "), 150));

    var observacao = LimparTextoBasico(atual.ObservacaoMudanca);
    if (!string.IsNullOrWhiteSpace(observacao))
        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(observacao), 160));

    return "";
}

private bool FalaPareceComandoDeDestino(string? texto)
{
    var t = NormalizarTexto(texto);
    if (string.IsNullOrWhiteSpace(t))
        return false;

    var comandos = new[]
    {
        "siga", "va para", "vá para", "vire", "continue", "prossiga", "avance",
        "desvie", "caminhe", "ande", "mova se", "mova-se"
    };

    return comandos.Any(t.StartsWith);
}

private string TornarOrientacaoCondicional(string texto)
{
    var t = LimparTextoBasico(texto);
    var norm = NormalizarTexto(t);

    if (string.IsNullOrWhiteSpace(t))
        return "";

    if (!FalaPareceComandoDeDestino(t))
        return t;

    if (norm.Contains("direita"))
        return "A área à direita parece mais segura se você for se mover";

    if (norm.Contains("esquerda"))
        return "A área à esquerda parece mais segura se você for se mover";

    if (norm.Contains("frente") || norm.Contains("centro"))
        return "A passagem à frente parece possível se você for se mover";

    return "Se você for se mover, vá com atenção";
}

private bool DeveEmitirConfirmacaoDeConforto(DateTime agora, RespostaIA atual)
{
    if (_ultimaFalaEm == DateTime.MinValue)
        return false;

    if ((agora - _ultimaFalaEm).TotalSeconds < 58)
        return false;

    if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)))
        return false;

    if (!string.IsNullOrWhiteSpace(atual.Pessoa))
        return false;

    if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente || _memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveMudancaEstruturalRecente)
        return false;

    return _framesEstaveis >= 2;
}

private string ObterEventoGuiaFinal(RespostaIA resposta, string textoAudio, bool modoGuia)
{
    if (!modoGuia)
        return "consulta";

    if (string.IsNullOrWhiteSpace(textoAudio))
        return "silencio";

    var evento = NormalizarTexto(resposta.EventoGuia).Replace(" ", "_").Replace("-", "_");

    if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(resposta)))
        return "risco";

    if (!string.IsNullOrWhiteSpace(resposta.Pessoa))
        return "pessoa";

    if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente || _memoriaAmbiente.HouveTransicaoConfirmada)
        return "novo_ambiente";

    if (evento is "inicio" or "risco" or "desvio" or "novo_ambiente" or "pessoa" or "mudanca" or "ponto_interesse" or "observacao" or "livre" or "confirmacao")
        return evento;

    return "guia";
}

private string ClassificarTipoFalaGuia(string eventoGuia, string textoAudio, bool modoGuia)
{
    if (!modoGuia)
        return "consulta";

    if (string.IsNullOrWhiteSpace(textoAudio))
        return "silencio";

    return eventoGuia switch
    {
        "inicio" => "inicial",
        "risco" => "risco",
        "desvio" => "observacao",
        "novo_ambiente" => "transicao",
        "pessoa" => "pessoa",
        "ponto_interesse" => "ponto_interesse",
        "mudanca" => "mudanca",
        "observacao" => "observacao",
        "livre" => "caminho",
        "confirmacao" => "confirmacao",
        _ => "guia"
    };
}

private string ObterCaminhoStatusFinal(RespostaIA resposta)
{
    var caminho = NormalizarTexto(resposta.CaminhoStatus).Replace(" ", "_").Replace("-", "_");

    if (caminho is "livre" or "parcialmente_livre" or "bloqueado" or "estreito" or "movimentado")
        return caminho;

    var alerta = NormalizarTexto(ObterAlertaPrincipal(resposta));
    if (alerta.Contains("bloque") || alerta.Contains("obstaculo") || alerta.Contains("obstáculo"))
        return "bloqueado";

    if (NormalizarTexto(resposta.Sugestao).Contains("livre"))
        return "livre";

    return "desconhecido";
}

private void RegistrarFalaGuiaRapidaSeNecessario(string textoAudio, RespostaIA atual)
{
    if (string.IsNullOrWhiteSpace(textoAudio))
        return;

    lock (_lockMemoria)
    {
        var agora = DateTime.UtcNow;
        var resumoAtual = CriarResumoSemantico(atual, textoAudio);

        _ultimoTextoFalado = textoAudio;
        _ultimoResumoFalado = resumoAtual;
        _ultimaFalaEm = agora;

        if (_eventoNavegacaoAtual != null && !string.IsNullOrWhiteSpace(_eventoNavegacaoAtual.Tipo))
        {
            _ultimoEventoNavegacaoFalado = _eventoNavegacaoAtual.Tipo;
            _ultimoEventoNavegacaoFaladoEm = agora;
        }

        if (EhConfirmacaoContextual(textoAudio))
            _ultimaConfirmacaoContextualEm = agora;

        _memoriaAmbiente.HouveMudancaEstruturalRecente = false;
        _memoriaAmbiente.HouveEntradaEmNovoAmbiente = false;
        _memoriaAmbiente.HouveTransicaoConfirmada = false;
    }
}

private bool DeveUsarTtsExterno(string modoNormalizado, string textoAudio)
{
    if (string.IsNullOrWhiteSpace(textoAudio))
        return false;

    if (modoNormalizado == "guia")
        return false;

    return true;
}

    private string ObterEstadoOperacional(ImagemRequest request)
    {
        var nivel = NormalizarTexto(request.NivelMovimento);

        if (request.PrimeiraLeitura || request.ForcarDescricaoInicial)
            return "primeira leitura";

        if (request.AudioTocando)
            return "aguardando fala terminar";

        if (request.MudancaVisual >= 10 || nivel.Contains("forte"))
            return "movimento forte";

        if (request.MudancaVisual >= 4.2 || nivel.Contains("moderado"))
            return "mudança visual";

        if (request.CenaEstavel || nivel.Contains("parado"))
            return "observação estável";

        return "observando";
    }

    private bool PodeResponderSemAnalisePesada(ImagemRequest request)
    {
        if (request == null)
            return false;

        if (NormalizarModo(request.Modo) != "guia")
            return false;

        if (request.ForcarAnalise || request.PrimeiraLeitura || request.ForcarDescricaoInicial)
            return false;

        if (_ultimaRespostaIA == null)
            return false;

        if (!request.CenaEstavel)
            return false;

        if (request.MudancaVisual >= 3.2)
            return false;

        if (request.TempoDesdeUltimaAnaliseMs <= 0 || request.TempoDesdeUltimaAnaliseMs >= 18000)
            return false;

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente || _memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveMudancaEstruturalRecente)
            return false;

        return true;
    }

    private RespostaComAudio MontarRespostaSemNovaAnalise(ImagemRequest request, long tempoMs)
    {
        var resposta = _ultimaRespostaIA ?? new RespostaIA
        {
            Descricao = "Ambiente em observação.",
            Importancia = "baixa",
            Direcao = "sem-direcao"
        };

        var estado = ConstruirEstadoCognitivo(resposta);
        var memoria = ConstruirMemoriaRecente();
        var memoriaPersistenteAtual = ObterMemoriaPersistenteAtual();
        var ambientesPersistidos = ObterAmbientesPersistidos();
        var alerta = ObterAlertaPrincipal(resposta);
        var estadoOperacional = ObterEstadoOperacional(request);

        return new RespostaComAudio
        {
            Descricao = resposta.Descricao,
            Objetos = (resposta.Objetos ?? new List<string>()).ToArray(),
            Alertas = (resposta.Alertas ?? new List<string>()).ToArray(),
            Pessoa = resposta.Pessoa,
            Sugestao = "",
            Direcao = resposta.Direcao,
            Importancia = "baixa",
            AudioBase64 = "",
            FalaGuia = "",
            UsarFalaLocal = false,
            ModoGuia = true,
            TempoProcessamentoMs = (int)Math.Min(int.MaxValue, tempoMs),
            TipoFala = "silencio",
            EventoGuia = "silencio",
            CaminhoStatus = ObterCaminhoStatusFinal(resposta),
            DeveFalar = false,
            MotivoFala = "cena estável sem mudança útil",
            EstadoOperacional = estadoOperacional,
            ResumoAmbiente = string.IsNullOrWhiteSpace(resposta.ResumoAmbiente) ? resposta.Descricao : resposta.ResumoAmbiente,
            PontosInteresse = (resposta.PontosInteresse ?? new List<string>()).ToArray(),
            MapaVerbal = resposta.MapaVerbal,
            ItensEspaciais = (resposta.ItensEspaciais ?? new List<ItemEspacial>()).ToArray(),
            EstadoCognitivo = estado,
            MemoriaRecente = memoria,
            MemoriaPersistenteAtual = memoriaPersistenteAtual,
            AmbientesPersistidos = ambientesPersistidos,
            ConfiancaAmbiente = (int)Math.Round(estado.ConfiancaAmbiente),
            MudancaDetectada = false,
            AlertaPrincipal = string.IsNullOrWhiteSpace(alerta) ? "-" : alerta,
            PessoaPorPerto = string.IsNullOrWhiteSpace(resposta.Pessoa) ? "-" : resposta.Pessoa
        };
    }

    private string MontarPerguntaOperacional(ImagemRequest request, string estadoOperacional, bool primeiraLeitura)
    {
        var partes = new List<string>();

        if (!string.IsNullOrWhiteSpace(request.Pergunta))
            partes.Add(request.Pergunta.Trim());

        partes.Add($"Estado operacional do front: {estadoOperacional}.");
        partes.Add($"Mudança visual estimada: {request.MudancaVisual:0.00}.");
        partes.Add($"Cena estável: {(request.CenaEstavel ? "sim" : "não")}.");
        partes.Add($"Áudio tocando: {(request.AudioTocando ? "sim" : "não")}.");
        partes.Add($"Tempo desde última análise: {request.TempoDesdeUltimaAnaliseMs} ms.");
        partes.Add($"Tempo desde última fala: {request.TempoDesdeUltimaFalaMs} ms.");

        if (primeiraLeitura)
        {
            partes.Add("Primeira leitura: faça descrição espacial completa para uma pessoa sem visão formar um mapa mental. Informe ambiente provável, objetos úteis e posição aproximada: esquerda, centro, direita, frente ou fundo. Se houver mesa, cadeira, estante, porta, passagem, pessoa ou obstáculo, cite todos os relevantes e onde estão.");
        }
        else if (estadoOperacional.Contains("movimento") || estadoOperacional.Contains("mudança"))
        {
            partes.Add("A câmera mudou. Informe o que apareceu, sumiu ou ficou relevante, com posição aproximada. Se houver vários itens úteis, cite mais de um, por exemplo mesa à frente, cadeira no centro, estante ao fundo ou porta à direita. Não mande a pessoa ir para lugar nenhum; destaque possibilidades e riscos.");
        }
        else
        {
            partes.Add("Verificação de prontidão. Se nada útil mudou, use silêncio. Fale por risco, pessoa, porta/passagem, mudança relevante, novo ambiente ou quando uma leitura espacial com vários objetos úteis ainda não foi comunicada.");
        }

        return string.Join(" ", partes);
    }

    private RespostaIA? ObterRespostaAnteriorParaPoliticaAssistiva()
    {
        lock (_lockMemoria)
        {
            return _ultimaRespostaIA;
        }
    }

    private string AplicarPoliticaDeComunicacaoAssistiva(string textoAudio, RespostaIA atual, ImagemRequest request, bool primeiraLeitura, RespostaIA? anteriorParaPolitica)
    {
        if (primeiraLeitura)
        {
            var falaInicial = CriarFalaInicialDoGuia(atual, true);
            return GarantirPontoFinal(LimparTextoParaAudio(falaInicial, 520));
        }

        var falaAssistiva = ConstruirFalaAssistivaInteligente(textoAudio, atual, request, anteriorParaPolitica);
        if (string.IsNullOrWhiteSpace(falaAssistiva))
            return "";

        falaAssistiva = TornarOrientacaoCondicional(falaAssistiva);
        falaAssistiva = SuavizarTexto(falaAssistiva);
        falaAssistiva = LimparTextoParaAudio(falaAssistiva, 210);

        if (DeveSilenciarAssinaturaAssistiva(falaAssistiva, atual, request))
            return "";

        RegistrarAssinaturaAssistivaFalada(falaAssistiva, atual);
        return GarantirPontoFinal(falaAssistiva);
    }

    private string ConstruirFalaAssistivaInteligente(string textoAudio, RespostaIA atual, ImagemRequest request, RespostaIA? anterior)
    {
        var alerta = ObterAlertaPrincipal(atual);
        var importancia = NormalizarTexto(atual.Importancia);
        var evento = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
        var falaCurta = LimparTextoBasico(atual.FalaCurta);
        var observacao = LimparTextoBasico(atual.ObservacaoMudanca);

        if (!string.IsNullOrWhiteSpace(alerta))
        {
            if (importancia == "alta" || MudouAlertas(atual, anterior) || request.MudancaVisual >= 6)
                return TransformarAlertaEmFala(alerta);

            return "";
        }

        if (_memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveEntradaEmNovoAmbiente || evento == "novo_ambiente")
            return CriarFalaDeTransicaoGuia(atual);

        if (!string.IsNullOrWhiteSpace(atual.Pessoa))
        {
            if (MudouPessoa(atual, anterior) || PessoaPareceInteracao(atual.Pessoa) || evento == "pessoa")
                return LimparTextoParaAudio(atual.Pessoa, 150);

            return "";
        }

        var falaMapaEspacial = CriarFalaMapaEspacialSituacional(atual, anterior, request);
        if (!string.IsNullOrWhiteSpace(falaMapaEspacial))
            return falaMapaEspacial;

        var novosPontos = ObterNovasReferenciasAssistivas(atual, anterior);
        if (novosPontos.Count > 0)
            return CriarFalaNovasReferenciasAssistivas(novosPontos, atual);

        if (_memoriaAmbiente.HouveMudancaEstruturalRecente && !string.IsNullOrWhiteSpace(_memoriaAmbiente.UltimaMudancaEstrutural))
            return _memoriaAmbiente.UltimaMudancaEstrutural;

        var houveMovimentoReal = request.MudancaVisual >= 6 || NormalizarTexto(request.NivelMovimento).Contains("medio") || NormalizarTexto(request.NivelMovimento).Contains("alto");
        var eventoUtil = evento is "mudanca" or "observacao" or "ponto_interesse" or "livre";

        if (houveMovimentoReal || eventoUtil)
        {
            var falaMudanca = CriarFalaMudancaAssistivaContextual(atual, anterior, textoAudio, falaCurta, observacao, request);
            if (!string.IsNullOrWhiteSpace(falaMudanca))
                return falaMudanca;
        }

        if (DeveEmitirConfirmacaoDeConforto(DateTime.UtcNow, atual))
            return CriarConfirmacaoAssistivaContextual(atual);

        return "";
    }

    private List<string> ObterNovasReferenciasAssistivas(RespostaIA atual, RespostaIA? anterior)
    {
        var atuais = ObterReferenciasAssistivas(atual);
        if (atuais.Count == 0)
            return new List<string>();

        if (anterior == null)
            return atuais.Take(2).ToList();

        var anteriores = ObterReferenciasAssistivas(anterior)
            .Select(NormalizarTexto)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return atuais
            .Where(x => !anteriores.Contains(NormalizarTexto(x)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToList();
    }

    private List<string> ObterReferenciasAssistivas(RespostaIA resposta)
    {
        var lista = new List<string>();

        if (resposta.PontosInteresse != null)
            lista.AddRange(resposta.PontosInteresse);

        if (resposta.Objetos != null)
            lista.AddRange(resposta.Objetos);

        return lista
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Where(x => ObjetoEhUtil(NormalizarTexto(x)) || ReferenciaTextualEhUtil(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();
    }

    private bool ReferenciaTextualEhUtil(string texto)
    {
        var t = NormalizarTexto(texto);
        if (string.IsNullOrWhiteSpace(t))
            return false;

        return t.Contains("porta") ||
               t.Contains("passagem") ||
               t.Contains("corredor") ||
               t.Contains("cadeira") ||
               t.Contains("mesa") ||
               t.Contains("cama") ||
               t.Contains("quadro") ||
               t.Contains("lousa") ||
               t.Contains("prateleira") ||
               t.Contains("escada") ||
               t.Contains("pessoa") ||
               t.Contains("obstaculo") ||
               t.Contains("obstáculo");
    }

    private string CriarFalaNovasReferenciasAssistivas(List<string> novosPontos, RespostaIA atual)
    {
        var itens = ObterItensEspaciaisAssistivos(atual)
            .Where(x => novosPontos.Any(p => NormalizarTexto(p).Contains(NormalizarTexto(x.Nome)) || NormalizarTexto(x.Nome).Contains(NormalizarTexto(p))))
            .ToList();

        if (itens.Count >= 2)
        {
            var frase = CriarFraseItensEspaciais(itens, 4);
            if (!string.IsNullOrWhiteSpace(frase))
                return frase;
        }

        var direcao = TextoDirecaoNatural(atual.Direcao);
        var pontos = novosPontos
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .ToList();

        if (pontos.Count == 0)
            return "";

        var texto = $"Agora percebo {JuntarListaNatural(pontos)}";
        if (!string.IsNullOrWhiteSpace(direcao))
            texto += $" {direcao}";

        if (pontos.Any(x => ReferenciaPodeAtrapalharMovimento(x)))
            texto += "; atenção se você for se mover";
        else if (pontos.Any(x => NormalizarTexto(x).Contains("porta") || NormalizarTexto(x).Contains("passagem")))
            texto += ", como referência útil do ambiente";

        return texto.Replace("  ", " ");
    }


    private string CriarFalaPanoramicaAssistivaSuperior(RespostaIA atual, bool primeiraLeitura)
    {
        var itens = ObterItensEspaciaisAssistivos(atual);
        var mapaVerbal = LimparTextoBasico(atual.MapaVerbal);
        var descricao = LimparTextoBasico(atual.Descricao);
        var ambiente = !string.IsNullOrWhiteSpace(atual.AmbienteProvavel)
            ? atual.AmbienteProvavel
            : ObterAmbienteAssistivoAtual();

        var partes = new List<string>();

        if (!string.IsNullOrWhiteSpace(mapaVerbal) && !TextoEhGenericoParaGuia(mapaVerbal))
            partes.Add(mapaVerbal);
        else if (!string.IsNullOrWhiteSpace(descricao) && !TextoEhGenericoParaGuia(descricao))
            partes.Add(descricao);
        else if (!string.IsNullOrWhiteSpace(ambiente))
            partes.Add($"Parece {AdicionarArtigoAoAmbiente(ambiente)}");

        var fraseItens = CriarFraseItensEspaciais(itens, primeiraLeitura ? 6 : 4);
        if (!string.IsNullOrWhiteSpace(fraseItens) && !TextoJaRepresentado(fraseItens, partes))
            partes.Add(fraseItens);

        var alerta = ObterAlertaPrincipal(atual);
        if (!string.IsNullOrWhiteSpace(alerta))
        {
            var alertaFala = TransformarAlertaEmFala(alerta);
            if (!TextoJaRepresentado(alertaFala, partes))
                partes.Add(alertaFala);
        }
        else
        {
            var contextoMovimento = CriarResumoDePassagemSemComando(atual, itens);
            if (!string.IsNullOrWhiteSpace(contextoMovimento) && !TextoJaRepresentado(contextoMovimento, partes))
                partes.Add(contextoMovimento);
        }

        if (!string.IsNullOrWhiteSpace(atual.Pessoa) && !TextoJaRepresentado(atual.Pessoa, partes))
            partes.Add(SuavizarTexto(atual.Pessoa));

        var texto = string.Join(". ", partes
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim().TrimEnd('.'))
            .Distinct(StringComparer.OrdinalIgnoreCase));

        return GarantirPontoFinal(texto);
    }

    private string CriarFalaMapaEspacialSituacional(RespostaIA atual, RespostaIA? anterior, ImagemRequest request)
    {
        var itens = ObterItensEspaciaisAssistivos(atual);
        if (itens.Count == 0)
            return "";

        var assinaturaAtual = CriarAssinaturaMapaEspacial(itens);
        var assinaturaAnterior = anterior == null ? "" : CriarAssinaturaMapaEspacial(ObterItensEspaciaisAssistivos(anterior));
        var houveMudancaDeMapa = !string.IsNullOrWhiteSpace(assinaturaAtual) && assinaturaAtual != assinaturaAnterior;
        var movimentoReal = request.MudancaVisual >= 5.5 || NormalizarTexto(request.NivelMovimento).Contains("medio") || NormalizarTexto(request.NivelMovimento).Contains("alto");
        var evento = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
        var eventoEspacial = evento is "ponto_interesse" or "mudanca" or "observacao" or "livre";

        if (!houveMudancaDeMapa && !movimentoReal && !eventoEspacial)
            return "";

        if (MapaEspacialFoiFaladoRecentemente(assinaturaAtual, request))
            return "";

        var itensPrioritarios = SelecionarItensEspaciaisPrioritarios(itens, anterior, movimentoReal).ToList();
        if (itensPrioritarios.Count == 0)
            itensPrioritarios = itens.Take(4).ToList();

        var frase = CriarFraseItensEspaciais(itensPrioritarios, movimentoReal ? 5 : 4);
        if (string.IsNullOrWhiteSpace(frase))
            return "";

        var complemento = CriarResumoDePassagemSemComando(atual, itensPrioritarios);
        if (!string.IsNullOrWhiteSpace(complemento) && !TextoJaRepresentado(complemento, new[] { frase }))
            frase = frase.Trim().TrimEnd('.') + ". " + complemento;

        RegistrarMapaEspacialFalado(assinaturaAtual);
        return GarantirPontoFinal(LimparTextoParaAudio(frase, 260));
    }

    private List<ItemEspacial> ObterItensEspaciaisAssistivos(RespostaIA resposta)
    {
        var itens = new List<ItemEspacial>();

        if (resposta.ItensEspaciais != null)
        {
            itens.AddRange(resposta.ItensEspaciais
                .Where(x => x != null && !string.IsNullOrWhiteSpace(x.Nome))
                .Select(x => new ItemEspacial
                {
                    Nome = LimparTextoBasico(x.Nome),
                    Tipo = LimparTextoBasico(x.Tipo),
                    Posicao = NormalizarPosicaoAssistiva(x.Posicao),
                    DistanciaAproximada = LimparTextoBasico(x.DistanciaAproximada),
                    Relevancia = LimparTextoBasico(x.Relevancia),
                    Risco = x.Risco
                }));
        }

        if (itens.Count == 0)
        {
            var direcaoPadrao = NormalizarPosicaoAssistiva(resposta.Direcao);
            var referencias = ObterReferenciasAssistivas(resposta);
            foreach (var referencia in referencias)
            {
                itens.Add(new ItemEspacial
                {
                    Nome = referencia,
                    Tipo = InferirTipoItemEspacial(referencia),
                    Posicao = direcaoPadrao,
                    DistanciaAproximada = "indefinida",
                    Relevancia = "referência útil",
                    Risco = ReferenciaPodeAtrapalharMovimento(referencia)
                });
            }
        }

        return itens
            .Where(x => !string.IsNullOrWhiteSpace(x.Nome))
            .GroupBy(x => NormalizarTexto(x.Nome) + "|" + NormalizarTexto(x.Posicao))
            .Select(g => g.First())
            .OrderByDescending(PontuarItemEspacial)
            .Take(8)
            .ToList();
    }

    private IEnumerable<ItemEspacial> SelecionarItensEspaciaisPrioritarios(List<ItemEspacial> atuais, RespostaIA? anterior, bool movimentoReal)
    {
        var anteriores = anterior == null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : ObterItensEspaciaisAssistivos(anterior).Select(CriarAssinaturaItemEspacial).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var novos = atuais
            .Where(x => !anteriores.Contains(CriarAssinaturaItemEspacial(x)))
            .OrderByDescending(PontuarItemEspacial)
            .ToList();

        if (novos.Count >= 2)
            return novos.Take(5);

        if (novos.Count == 1 && movimentoReal)
            return novos.Concat(atuais.Where(x => CriarAssinaturaItemEspacial(x) != CriarAssinaturaItemEspacial(novos[0])).Take(3));

        if (movimentoReal)
            return atuais.Take(5);

        return novos;
    }

    private string CriarFraseItensEspaciais(List<ItemEspacial> itens, int maxItens)
    {
        var selecionados = itens
            .Where(x => !string.IsNullOrWhiteSpace(x.Nome))
            .OrderByDescending(PontuarItemEspacial)
            .Take(maxItens)
            .Select(FormatarItemEspacial)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (selecionados.Count == 0)
            return "";

        return "Identifico " + JuntarListaNatural(selecionados) + ".";
    }

    private string FormatarItemEspacial(ItemEspacial item)
    {
        var nome = LimparTextoBasico(item.Nome);
        if (string.IsNullOrWhiteSpace(nome))
            return "";

        var posicao = NormalizarPosicaoAssistiva(item.Posicao);
        var distancia = NormalizarTexto(item.DistanciaAproximada);
        var risco = item.Risco || ReferenciaPodeAtrapalharMovimento(nome);

        var texto = nome;

        if (posicao != "indefinido")
            texto += " " + PosicaoEmFrase(posicao);

        if ((distancia.Contains("proxim") || distancia.Contains("perto")) && !NormalizarTexto(texto).Contains("proxim"))
            texto += " próxima";

        if (risco && !NormalizarTexto(texto).Contains("aten"))
            texto += " como ponto de atenção";

        return texto.Trim();
    }

    private string CriarResumoDePassagemSemComando(RespostaIA atual, List<ItemEspacial> itens)
    {
        var caminho = NormalizarTexto(atual.CaminhoStatus).Replace(" ", "_").Replace("-", "_");

        if (!string.IsNullOrWhiteSpace(atual.ProximidadeRisco))
            return SuavizarTexto(atual.ProximidadeRisco);

        if (caminho == "bloqueado")
            return "O caminho parece bloqueado; cuidado antes de se mover";

        if (caminho == "estreito" || caminho == "parcialmente_livre")
            return "O espaço parece parcialmente livre, mas com atenção aos objetos próximos";

        if (itens.Any(x => x.Risco || ReferenciaPodeAtrapalharMovimento(x.Nome)))
            return "Se for se mover, atenção aos objetos próximos";

        if (caminho == "livre")
            return "A área à frente parece livre, se você for se mover";

        return "";
    }

    private bool MapaEspacialFoiFaladoRecentemente(string assinatura, ImagemRequest request)
    {
        if (string.IsNullOrWhiteSpace(assinatura))
            return true;

        lock (_lockMemoria)
        {
            if (_ultimaAssinaturaMapaEspacialFalada == assinatura &&
                (DateTime.UtcNow - _ultimaAssinaturaMapaEspacialFaladaEm).TotalSeconds < 35 &&
                request.TempoDesdeUltimaFalaMs < 35000)
            {
                return true;
            }
        }

        return false;
    }

    private void RegistrarMapaEspacialFalado(string assinatura)
    {
        lock (_lockMemoria)
        {
            _ultimaAssinaturaMapaEspacialFalada = assinatura;
            _ultimaAssinaturaMapaEspacialFaladaEm = DateTime.UtcNow;
        }
    }

    private string CriarAssinaturaMapaEspacial(List<ItemEspacial> itens)
    {
        return string.Join("|", itens
            .Select(CriarAssinaturaItemEspacial)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .OrderBy(x => x)
            .Take(8));
    }

    private string CriarAssinaturaItemEspacial(ItemEspacial item)
    {
        return NormalizarTexto(item.Nome) + ":" + NormalizarTexto(item.Posicao);
    }

    private int PontuarItemEspacial(ItemEspacial item)
    {
        var nome = NormalizarTexto(item.Nome);
        var tipo = NormalizarTexto(item.Tipo);
        var score = 0;

        if (item.Risco || tipo.Contains("obstaculo") || tipo.Contains("obstáculo")) score += 100;
        if (nome.Contains("pessoa")) score += 85;
        if (nome.Contains("porta") || tipo.Contains("saida") || tipo.Contains("saída")) score += 75;
        if (nome.Contains("passagem") || nome.Contains("corredor")) score += 70;
        if (nome.Contains("cadeira") || nome.Contains("mesa")) score += 60;
        if (nome.Contains("estante") || nome.Contains("prateleira") || nome.Contains("cama")) score += 48;
        if (nome.Contains("quadro") || nome.Contains("lousa")) score += 40;

        if (NormalizarTexto(item.Posicao) is "frente" or "centro") score += 12;
        if (NormalizarTexto(item.DistanciaAproximada).Contains("proxim")) score += 10;

        return score;
    }

    private string NormalizarPosicaoAssistiva(string? posicao)
    {
        var texto = NormalizarTexto(posicao);
        if (texto.Contains("esquer")) return "esquerda";
        if (texto.Contains("direit")) return "direita";
        if (texto.Contains("centro") || texto.Contains("meio")) return "centro";
        if (texto.Contains("frente") || texto.Contains("adiante")) return "frente";
        if (texto.Contains("fundo") || texto.Contains("atras") || texto.Contains("atrás")) return "fundo";
        return "indefinido";
    }

    private string PosicaoEmFrase(string posicao)
    {
        return posicao switch
        {
            "esquerda" => "à esquerda",
            "direita" => "à direita",
            "centro" => "no centro",
            "frente" => "à frente",
            "fundo" => "ao fundo",
            _ => ""
        };
    }

    private string InferirTipoItemEspacial(string nome)
    {
        var t = NormalizarTexto(nome);
        if (t.Contains("porta") || t.Contains("saida") || t.Contains("saída")) return "saida";
        if (t.Contains("passagem") || t.Contains("corredor")) return "passagem";
        if (t.Contains("pessoa")) return "pessoa";
        if (ReferenciaPodeAtrapalharMovimento(nome)) return "obstaculo";
        return "referencia";
    }

    private bool ReferenciaPodeAtrapalharMovimento(string referencia)
    {
        var t = NormalizarTexto(referencia);
        return t.Contains("cadeira") ||
               t.Contains("mesa") ||
               t.Contains("cama") ||
               t.Contains("mochila") ||
               t.Contains("obstaculo") ||
               t.Contains("obstáculo") ||
               t.Contains("escada") ||
               t.Contains("prateleira") ||
               t.Contains("estante");
    }

    private string CriarFalaMudancaAssistivaContextual(
        RespostaIA atual,
        RespostaIA? anterior,
        string textoAudio,
        string falaCurta,
        string observacao,
        ImagemRequest request)
    {
        if (!string.IsNullOrWhiteSpace(observacao) && !TextoEhGenericoParaGuia(observacao))
            return observacao;

        if (!string.IsNullOrWhiteSpace(falaCurta) && !TextoEhGenericoParaGuia(falaCurta) && !FalaPareceComandoDeDestino(falaCurta))
            return falaCurta;

        var pontosAtuais = ObterReferenciasAssistivas(atual).Take(2).ToList();
        var ambienteAtual = ObterAmbienteAssistivoAtual();

        if (request.MudancaVisual >= 9 && pontosAtuais.Count > 0)
            return $"A câmera mudou. Agora ficam mais evidentes {JuntarListaNatural(pontosAtuais)}";

        if (request.MudancaVisual >= 9 && !string.IsNullOrWhiteSpace(ambienteAtual))
            return $"Ainda parece {AdicionarArtigoAoAmbiente(ambienteAtual)}; estou acompanhando a mudança da câmera";

        return "";
    }

    private string CriarConfirmacaoAssistivaContextual(RespostaIA atual)
    {
        var ambiente = ObterAmbienteAssistivoAtual();
        var referencia = ExtrairReferenciaAmbiente(atual);

        if (string.IsNullOrWhiteSpace(referencia))
        {
            referencia = ObterReferenciasPersistentesDoAmbienteAtual()
                .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? "";
        }

        if (!string.IsNullOrWhiteSpace(ambiente) && !string.IsNullOrWhiteSpace(referencia))
            return $"Continuo acompanhando {AdicionarArtigoAoAmbiente(ambiente)}. {PrimeiraLetraMaiuscula(referencia)} segue como referência útil.";

        if (!string.IsNullOrWhiteSpace(ambiente))
            return $"Continuo acompanhando {AdicionarArtigoAoAmbiente(ambiente)}.";

        return "Continuo acompanhando o ambiente. Se algo importante mudar, eu aviso.";
    }

    private string ObterAmbienteAssistivoAtual()
    {
        lock (_lockMemoria)
        {
            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
                return _memoriaAmbiente.AmbienteConfirmado;

            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.CandidatoAmbiente))
                return _memoriaAmbiente.CandidatoAmbiente;

            if (!string.IsNullOrWhiteSpace(_painelMemoriaPersistente.Atual?.Ambiente))
                return _painelMemoriaPersistente.Atual.Ambiente;
        }

        return "";
    }

    private bool DeveSilenciarAssinaturaAssistiva(string fala, RespostaIA atual, ImagemRequest request)
    {
        if (string.IsNullOrWhiteSpace(fala))
            return true;

        var importancia = NormalizarTexto(atual.Importancia);
        if (importancia == "alta" || !string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)))
            return false;

        var assinatura = CriarAssinaturaAssistiva(fala, atual);
        var agora = DateTime.UtcNow;
        var falaAnterior = NormalizarTexto(_ultimoTextoFalado);
        var falaAtual = NormalizarTexto(fala);

        if (!string.IsNullOrWhiteSpace(falaAnterior) && falaAnterior == falaAtual)
            return true;

        if (!string.IsNullOrWhiteSpace(_ultimaAssinaturaAssistivaFalada) &&
            _ultimaAssinaturaAssistivaFalada == assinatura &&
            (agora - _ultimaAssinaturaAssistivaFaladaEm).TotalSeconds < 55)
        {
            return true;
        }

        if (request.CenaEstavel && request.MudancaVisual < 3.2 && request.TempoDesdeUltimaFalaMs < 45000)
        {
            var evento = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
            if (evento is "livre" or "ponto_interesse" or "observacao" or "mudanca" or "silencio" or "confirmacao")
                return true;
        }

        if (!string.IsNullOrWhiteSpace(falaAnterior))
        {
            var similaridade = CalcularSimilaridadeSimples(falaAnterior, falaAtual);
            if (similaridade >= 0.78 && request.TempoDesdeUltimaFalaMs < 65000)
                return true;
        }

        return false;
    }

    private string CriarAssinaturaAssistiva(string fala, RespostaIA atual)
    {
        var evento = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
        var ambiente = NormalizarTexto(ObterAmbienteAssistivoAtual());
        var pontos = string.Join("|", ObterReferenciasAssistivas(atual).Select(NormalizarTexto).Take(3));
        var alerta = NormalizarTexto(ObterAlertaPrincipal(atual));
        var pessoa = NormalizarTexto(atual.Pessoa);

        if (!string.IsNullOrWhiteSpace(alerta))
            return "alerta:" + alerta;

        if (!string.IsNullOrWhiteSpace(pessoa))
            return "pessoa:" + pessoa;

        if (!string.IsNullOrWhiteSpace(pontos))
            return evento + ":" + ambiente + ":" + pontos;

        return evento + ":" + ambiente + ":" + NormalizarTexto(fala);
    }

    private void RegistrarAssinaturaAssistivaFalada(string fala, RespostaIA atual)
    {
        lock (_lockMemoria)
        {
            _ultimaAssinaturaAssistivaFalada = CriarAssinaturaAssistiva(fala, atual);
            _ultimaAssinaturaAssistivaFaladaEm = DateTime.UtcNow;
        }
    }

    private bool DeveSilenciarPorRepeticaoAssistiva(RespostaIA atual, ImagemRequest request, string textoSeguro)
    {
        if (string.IsNullOrWhiteSpace(textoSeguro))
            return true;

        var importancia = NormalizarTexto(atual.Importancia);
        if (importancia == "alta")
            return false;

        if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)))
            return false;

        if (!string.IsNullOrWhiteSpace(atual.Pessoa) &&
            (MudouPessoa(atual, _ultimaRespostaIA) || PessoaPareceInteracao(atual.Pessoa)))
            return false;

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente ||
            _memoriaAmbiente.HouveTransicaoConfirmada ||
            _memoriaAmbiente.HouveMudancaEstruturalRecente)
            return false;

        var evento = NormalizarTexto(atual.EventoGuia).Replace(" ", "_").Replace("-", "_");
        var estavel = request.CenaEstavel || request.MudancaVisual < 4.2 || NormalizarTexto(request.NivelMovimento).Contains("baixo");

        if (estavel && request.TempoDesdeUltimaFalaMs > 0 && request.TempoDesdeUltimaFalaMs < 45000)
        {
            if (evento is "livre" or "ponto_interesse" or "observacao" or "mudanca" or "silencio" or "confirmacao")
                return true;
        }

        var ultimo = NormalizarTexto(_ultimoTextoFalado);
        var atualTexto = NormalizarTexto(textoSeguro);

        if (string.IsNullOrWhiteSpace(ultimo) || string.IsNullOrWhiteSpace(atualTexto))
            return false;

        if (ultimo == atualTexto)
            return true;

        var similaridade = CalcularSimilaridadeSimples(ultimo, atualTexto);
        if (estavel && similaridade >= 0.72 && request.TempoDesdeUltimaFalaMs < 65000)
            return true;

        return false;
    }

    private double CalcularSimilaridadeSimples(string textoA, string textoB)
    {
        var a = textoA.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(x => x.Length > 3)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var b = textoB.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(x => x.Length > 3)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (a.Count == 0 || b.Count == 0)
            return 0;

        var intersecao = a.Count(x => b.Contains(x));
        var uniao = a.Union(b, StringComparer.OrdinalIgnoreCase).Count();
        return uniao == 0 ? 0 : (double)intersecao / uniao;
    }

    private string DeterminarMotivoFala(string eventoGuia, bool primeiraLeitura)
    {
        if (primeiraLeitura)
            return "descrição inicial para situar o usuário";

        return eventoGuia switch
        {
            "risco" => "risco ou obstáculo detectado",
            "pessoa" => "presença humana relevante",
            "novo_ambiente" => "mudança de ambiente",
            "ponto_interesse" => "ponto útil do ambiente apareceu",
            "mudanca" => "mudança relevante na cena",
            "livre" => "passagem livre relevante",
            "confirmacao" => "confirmação de funcionamento",
            "silencio" => "sem mudança útil",
            _ => "percepção ativa"
        };
    }

    private string CriarResumoSemantico(RespostaIA resposta, string textoFinal)
    {
        var alertas = string.Join("|", NormalizarLista(resposta.Alertas));
        var objetos = string.Join("|", NormalizarLista(resposta.Objetos).Take(4));
        var sugestao = NormalizarTexto(resposta.Sugestao);
        var direcao = NormalizarTexto(resposta.Direcao);
        var importancia = NormalizarTexto(resposta.Importancia);
        var texto = NormalizarTexto(textoFinal);
        var descricaoAmbiente = DescricaoPareceAmbienteUtil(resposta.Descricao) ? NormalizarTexto(resposta.Descricao) : "";
        var referencia = NormalizarTexto(ExtrairReferenciaAmbiente(resposta));
        var ambiente = NormalizarTexto(_memoriaAmbiente.AmbienteConfirmado);
        var tendencia = NormalizarTexto(_contextoRecente.TendenciaCena);

        return $"{importancia}::{alertas}::{objetos}::{sugestao}::{direcao}::{descricaoAmbiente}::{referencia}::{ambiente}::{tendencia}::{texto}";
    }

    private string SuavizarTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Trim();
        texto = texto.Replace("obstáculo identificado", "obstáculo à frente", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("mova-se", "ajuste sua posição", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("desloque-se", "mude de posição", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("à sua frente", "à frente", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("aproxime-se com cuidado", "com cuidado", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("ambiente detectado", "ambiente percebido", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("há uma pessoa", "tem uma pessoa", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("há um obstáculo", "tem um obstáculo", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("há pessoas por perto", "tem pessoas por perto", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("essas referências podem ajudar", "isso ajuda a localizar melhor o espaço", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("as referências fixas podem ajudar", "isso ajuda a manter noção do espaço", StringComparison.OrdinalIgnoreCase);

        texto = texto.Replace("a referência principal aqui parece ser", "o espaço parece se organizar em torno de", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("segue como referência", "continua servindo para localizar o espaço", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("referência principal", "ponto principal do espaço", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("você parece estar no mesmo ambiente", "continuo acompanhando", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("vou avisar coisas importantes", "", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("evento temporal", "mudança percebida", StringComparison.OrdinalIgnoreCase);

        return texto.Trim();
    }

    private string LimparTextoParaAudio(string texto, int limite)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        texto = texto.Replace("..", ".").Replace(". .", ".").Replace("  ", " ").Trim();

        if (texto.Length > limite)
        {
            var textoCortado = texto[..limite];
            var ultimoPonto = textoCortado.LastIndexOf('.');

            if (ultimoPonto > 50)
                texto = textoCortado[..(ultimoPonto + 1)];
            else
            {
                var ultimaVirgula = textoCortado.LastIndexOf(',');
                texto = ultimaVirgula > 50 ? textoCortado[..ultimaVirgula] : textoCortado;
            }
        }

        return texto.Trim(' ', ',', ';');
    }

    private string NormalizarModo(string? modo)
    {
        if (string.IsNullOrWhiteSpace(modo))
            return "automatico";

        var valor = modo.Trim().ToLowerInvariant();

        return valor switch
        {
            "consulta" => "consulta",
            "guia" => "guia",
            "guia-rapido" => "guia",
            "guia_rapido" => "guia",
            "rapido" => "guia",
            "rápido" => "guia",
            _ => "automatico"
        };
    }

    private List<string> NormalizarLista(IEnumerable<string>? lista)
    {
        if (lista == null)
            return new List<string>();

        return lista
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(NormalizarTexto)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private string NormalizarTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        return texto
            .Trim()
            .ToLowerInvariant()
            .Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .Aggregate("", (acc, c) => acc + c)
            .Replace("\n", " ")
            .Replace("\r", " ")
            .Replace("  ", " ")
            .Trim();
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

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente || _memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveMudancaEstruturalRecente)
            return true;

        if (importancia == "media" && TemIndicioAmbienteUtil(atual) && _ultimaFalaEm != DateTime.MinValue && (agora - _ultimaFalaEm).TotalSeconds >= 2)
            return true;

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

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente)
            score += 4;

        if (_memoriaAmbiente.HouveTransicaoConfirmada)
            score += 3;

        if (_memoriaAmbiente.HouveMudancaEstruturalRecente)
            score += 3;

        if (!string.IsNullOrWhiteSpace(resposta.Pessoa))
            score += PessoaPareceInteracao(resposta.Pessoa) ? 3 : 2;

        if (!string.IsNullOrWhiteSpace(resposta.Sugestao))
            score += SugestaoGenerica(resposta.Sugestao) ? 1 : 3;

        if (!string.IsNullOrWhiteSpace(resposta.Direcao) && !NormalizarTexto(resposta.Direcao).Equals("sem-direcao"))
            score += 1;

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

        if (TemIndicioAmbienteUtil(resposta))
            score += 2;

        if (TemReferenciaFixaUtil(resposta))
            score += 2;

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

    private bool MudouDescricaoUtil(RespostaIA atual, RespostaIA? anterior)
    {
        if (anterior == null)
            return DescricaoPareceAmbienteUtil(atual.Descricao);

        return NormalizarTexto(atual.Descricao) != NormalizarTexto(anterior.Descricao);
    }

    private bool MudancaContextualAmbienteRelevante()
    {
        lock (_lockMemoria)
        {
            return _memoriaAmbiente.HouveEntradaEmNovoAmbiente ||
                   _memoriaAmbiente.HouveTransicaoConfirmada ||
                   _memoriaAmbiente.HouveMudancaEstruturalRecente;
        }
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
        if (MudouDescricaoUtil(atual, anterior) && TemIndicioAmbienteUtil(atual)) return true;

        return false;
    }

    private bool SugestaoGenerica(string? sugestao)
    {
        var texto = NormalizarTexto(sugestao);

        if (string.IsNullOrWhiteSpace(texto))
            return true;

        var sugestoesGenericas = new List<string>
        {
            "mova-se para frente", "siga em frente", "continue em frente", "avance", "continue",
            "siga reto", "pode seguir", "siga", "va em frente", "vá em frente"
        };

        return sugestoesGenericas.Contains(texto);
    }

    private bool EhConfirmacaoContextual(string texto)
    {
        var t = NormalizarTexto(texto);

        return t.Contains("voce continua") ||
               t.Contains("você continua") ||
               t.Contains("por enquanto") ||
               t.Contains("ambiente novo") ||
               t.Contains("agora voce esta") ||
               t.Contains("agora você está") ||
               t.Contains("referencia principal") ||
               t.Contains("referência principal");
    }

    private bool AmbienteAtualEhDinamico()
    {
        lock (_lockMemoria)
        {
            return NormalizarTexto(_memoriaAmbiente.PerfilAtual) == "dinamico" ||
                   NormalizarTexto(_memoriaAmbiente.PerfilAtual) == "dinâmico";
        }
    }

    private bool LabelsParecidos(string? a, string? b)
    {
        var aa = NormalizarTexto(a);
        var bb = NormalizarTexto(b);

        if (string.IsNullOrWhiteSpace(aa) || string.IsNullOrWhiteSpace(bb))
            return false;

        return aa == bb || aa.Contains(bb) || bb.Contains(aa);
    }

    private bool ContemQualquer(string texto, params string[] termos)
    {
        return termos.Any(texto.Contains);
    }

    private string AdicionarArtigoAoAmbiente(string ambiente)
    {
        var valor = LimparTextoBasico(ambiente).ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(valor))
            return "um ambiente";

        return valor switch
        {
            "sala" => "uma sala",
            "sala de aula" => "uma sala de aula",
            "cozinha" => "uma cozinha",
            "recepção" => "uma recepção",
            "farmácia" => "uma farmácia",
            "loja" => "uma loja",
            "sala de espera" => "uma sala de espera",
            "ambiente doméstico" => "um ambiente doméstico",
            "ambiente comercial" => "um ambiente comercial",
            "ambiente de passagem" => "um ambiente de passagem",
            _ when valor.StartsWith("um ") || valor.StartsWith("uma ") => valor,
            _ when valor.EndsWith("a") => "uma " + valor,
            _ => "um " + valor
        };
    }

    private string JuntarListaNatural(List<string> itens)
    {
        var limpos = itens
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (limpos.Count == 0) return "";
        if (limpos.Count == 1) return limpos[0];
        if (limpos.Count == 2) return $"{limpos[0]} e {limpos[1]}";

        return string.Join(", ", limpos.Take(limpos.Count - 1)) + " e " + limpos.Last();
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

    private EstadoVisiora ConstruirEstadoCognitivo(RespostaIA atual)
    {
        lock (_lockMemoria)
        {
            var ambienteAtual = !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado)
                ? PrimeiraLetraMaiuscula(_memoriaAmbiente.AmbienteConfirmado)
                : (!string.IsNullOrWhiteSpace(_memoriaAmbiente.CandidatoAmbiente)
                    ? $"Em validação: {PrimeiraLetraMaiuscula(_memoriaAmbiente.CandidatoAmbiente)}"
                    : InferirAmbientePeloConteudoAtual(atual));

            var tipoAmbiente = !string.IsNullOrWhiteSpace(_memoriaAmbiente.PerfilAtual)
                ? PrimeiraLetraMaiuscula(_memoriaAmbiente.PerfilAtual)
                : (!string.IsNullOrWhiteSpace(_memoriaAmbiente.PerfilCandidato)
                    ? PrimeiraLetraMaiuscula(_memoriaAmbiente.PerfilCandidato)
                    : InferirTipoPeloConteudoAtual(atual));

            var alertaPrincipal = ObterAlertaPrincipal(atual);
            var referenciaPrincipal = ObterReferenciaPrincipalEstado(atual);
            var pessoaStatus = !string.IsNullOrWhiteSpace(atual.Pessoa)
                ? atual.Pessoa.Trim()
                : (_estadoTemporal.PessoaPersistente ? "Pessoa ainda por perto" : "-");
            var confianca = CalcularConfiancaAmbienteEstado(atual);
            var memoriaPersistenteAtual = ObterMemoriaPersistenteAtual();

            return new EstadoVisiora
            {
                AmbienteAtual = string.IsNullOrWhiteSpace(ambienteAtual) ? "Indefinido" : ambienteAtual,
                ConfiancaAmbiente = confianca,
                TipoAmbiente = string.IsNullOrWhiteSpace(tipoAmbiente) ? "Indefinido" : tipoAmbiente,
                EventoAtual = ObterEventoDominanteEstado(),
                MudancaDetectada = HouveMudancaDetectadaNoMomento(),
                NivelAtencao = MontarNivelAtencaoAtual(atual),
                TendenciaMovimento = MontarTendenciaMovimentoEstado(),
                ReferenciaPrincipal = string.IsNullOrWhiteSpace(referenciaPrincipal) ? "-" : referenciaPrincipal,
                CaminhoStatus = ObterStatusCaminhoEstado(atual),
                AlertaPrincipal = string.IsNullOrWhiteSpace(alertaPrincipal) ? "-" : alertaPrincipal,
                PessoaStatus = string.IsNullOrWhiteSpace(pessoaStatus) ? "-" : pessoaStatus,
                DirecaoPreferencial = string.IsNullOrWhiteSpace(atual.Direcao) ? "sem-direcao" : atual.Direcao,
                AmbienteCandidato = string.IsNullOrWhiteSpace(_memoriaAmbiente.CandidatoAmbiente) ? "" : PrimeiraLetraMaiuscula(_memoriaAmbiente.CandidatoAmbiente),
                LeiturasConsistentesAmbiente = _memoriaAmbiente.RepeticoesCandidato,
                LeiturasSuspeitaTransicao = _memoriaAmbiente.RepeticoesSuspeita,
                TempoNoAmbienteSegundos = ObterTempoNoAmbienteSegundos(),
                ModoGuiaStatus = string.IsNullOrWhiteSpace(atual.EventoGuia) ? "observando" : atual.EventoGuia,
                AtualizadoEmUtc = DateTime.UtcNow,
                MemoriaPersistenteAtiva = !string.IsNullOrWhiteSpace(memoriaPersistenteAtual.Ambiente),
                AmbienteMemorizado = memoriaPersistenteAtual.Ambiente,
                LeiturasMemorizadas = memoriaPersistenteAtual.Leituras,
                UltimoEventoMemorizado = memoriaPersistenteAtual.UltimoEvento,
                MapaVerbal = string.IsNullOrWhiteSpace(atual.MapaVerbal) ? atual.ResumoAmbiente : atual.MapaVerbal,
                ItensEspaciaisDetectados = atual.ItensEspaciais?.Count ?? 0,
                MemoriaAssistivaStatus = !string.IsNullOrWhiteSpace(memoriaPersistenteAtual.Ambiente)
                    ? $"Memória ativa: {memoriaPersistenteAtual.Ambiente} ({memoriaPersistenteAtual.Leituras} leituras)"
                    : "ambiente em aprendizado"
            };
        }
    }

    private EstadoVisiora ConstruirEstadoFalha(string mensagem)
    {
        return new EstadoVisiora
        {
            AmbienteAtual = "Erro",
            TipoAmbiente = "Indefinido",
            EventoAtual = "Falha no processamento",
            MudancaDetectada = true,
            NivelAtencao = "alto",
            TendenciaMovimento = "desconhecida",
            ReferenciaPrincipal = "-",
            CaminhoStatus = "desconhecido",
            AlertaPrincipal = string.IsNullOrWhiteSpace(mensagem) ? "Falha no processamento" : mensagem,
            PessoaStatus = "-",
            DirecaoPreferencial = "sem-direcao",
            AmbienteCandidato = "",
            LeiturasConsistentesAmbiente = 0,
            LeiturasSuspeitaTransicao = 0,
            TempoNoAmbienteSegundos = 0,
            ConfiancaAmbiente = 0,
            AtualizadoEmUtc = DateTime.UtcNow,
            MapaVerbal = "",
            ItensEspaciaisDetectados = 0,
            MemoriaAssistivaStatus = "erro"
        };
    }

    private List<MemoriaRecenteItem> ConstruirMemoriaRecente()
    {
        lock (_lockMemoria)
        {
            var itens = new List<MemoriaRecenteItem>();
            var ultimasLeituras = _historicoTemporal.TakeLast(Math.Min(4, _historicoTemporal.Count)).ToList();

            foreach (var leitura in ultimasLeituras)
            {
                var ambiente = !string.IsNullOrWhiteSpace(leitura.Ambiente)
                    ? PrimeiraLetraMaiuscula(leitura.Ambiente)
                    : "Indefinido";

                var evento = !string.IsNullOrWhiteSpace(leitura.AlertaPrincipal)
                    ? PrimeiraLetraMaiuscula(TransformarAlertaEmFala(leitura.AlertaPrincipal))
                    : (!string.IsNullOrWhiteSpace(_estadoTemporal.UltimoEvento) && _estadoTemporal.UltimoEvento != "sem_evento"
                        ? PrimeiraLetraMaiuscula(_estadoTemporal.UltimoEvento.Replace("_", " "))
                        : "Observando");

                var caminho = !string.IsNullOrWhiteSpace(leitura.AlertaPrincipal)
                    ? ObterStatusCaminhoEstado(new RespostaIA { Alertas = new List<string> { leitura.AlertaPrincipal }, Sugestao = leitura.Sugestao })
                    : (string.IsNullOrWhiteSpace(leitura.Sugestao) ? "desconhecido" : ObterStatusCaminhoEstado(new RespostaIA { Sugestao = leitura.Sugestao }));

                itens.Add(new MemoriaRecenteItem
                {
                    Ambiente = ambiente,
                    Evento = evento,
                    Caminho = PrimeiraLetraMaiuscula(caminho),
                    Direcao = string.IsNullOrWhiteSpace(leitura.Direcao) ? "sem-direcao" : leitura.Direcao,
                    Referencia = string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual) ? "-" : PrimeiraLetraMaiuscula(_memoriaAmbiente.ReferenciaAtual),
                    EmUtc = leitura.Em
                });
            }

            if (itens.Count == 0)
            {
                itens.Add(new MemoriaRecenteItem
                {
                    Ambiente = string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado) ? "Indefinido" : PrimeiraLetraMaiuscula(_memoriaAmbiente.AmbienteConfirmado),
                    Evento = PrimeiraLetraMaiuscula(ObterEventoDominanteEstado()),
                    Caminho = PrimeiraLetraMaiuscula(ObterStatusCaminhoEstado(new RespostaIA())),
                    Direcao = string.IsNullOrWhiteSpace(_estadoTemporal.DirecaoDominante) ? "sem-direcao" : _estadoTemporal.DirecaoDominante,
                    Referencia = string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual) ? "-" : PrimeiraLetraMaiuscula(_memoriaAmbiente.ReferenciaAtual),
                    EmUtc = DateTime.UtcNow
                });
            }

            return itens.OrderByDescending(x => x.EmUtc).ToList();
        }
    }

    private double CalcularConfiancaAmbienteEstado(RespostaIA atual)
    {
        lock (_lockMemoria)
        {
            var pontuacao = 0d;

            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
                pontuacao += 48;
            else if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.CandidatoAmbiente))
                pontuacao += 22;
            else if (!string.IsNullOrWhiteSpace(InferirLabelAmbiente(NormalizarTexto(atual.Descricao), NormalizarLista(atual.Objetos))))
                pontuacao += 16;

            pontuacao += Math.Min(18, _memoriaAmbiente.RepeticoesCandidato * 9);
            pontuacao += Math.Min(14, _framesEstaveis * 2.5);

            if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual))
                pontuacao += 10;

            if (_estadoTemporal.ContinuaNoMesmoLugar)
                pontuacao += 6;

            if (_historicoTemporal.Count >= 3)
                pontuacao += 6;

            if (_memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveEntradaEmNovoAmbiente)
                pontuacao = Math.Max(pontuacao, 70);

            return Math.Max(0, Math.Min(100, pontuacao));
        }
    }

    private int ObterTempoNoAmbienteSegundos()
    {
        lock (_lockMemoria)
        {
            if (_memoriaAmbiente.EntrouNoAmbienteEm == DateTime.MinValue)
                return 0;

            return Math.Max(0, (int)(DateTime.UtcNow - _memoriaAmbiente.EntrouNoAmbienteEm).TotalSeconds);
        }
    }

    private string ObterEventoDominanteEstado()
    {
        if (_memoriaAmbiente.HouveTransicaoConfirmada)
            return "Transição confirmada";
        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente)
            return "Novo ambiente";
        if (_memoriaAmbiente.HouveMudancaEstruturalRecente)
            return "Mudança no ambiente";
        if (_eventoNavegacaoAtual != null && !string.IsNullOrWhiteSpace(_eventoNavegacaoAtual.Descricao))
            return PrimeiraLetraMaiuscula(_eventoNavegacaoAtual.Descricao);
        if (_estadoTemporal.ObstaculoPersistente)
            return "Obstáculo persistente";
        if (_estadoTemporal.CaminhoLiberadoRecente)
            return "Caminho liberado";
        if (_estadoTemporal.PessoaPersistente)
            return "Pessoa por perto";
        if (_estadoTemporal.ContinuaNoMesmoLugar && !string.IsNullOrWhiteSpace(_memoriaAmbiente.AmbienteConfirmado))
            return "Ambiente consolidado";
        if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.CandidatoAmbiente))
            return "Consolidando ambiente";
        return "Inicializando";
    }

    private string ObterStatusCaminhoEstado(RespostaIA atual)
    {
        var alerta = NormalizarTexto(ObterAlertaPrincipal(atual));
        var sugestao = NormalizarTexto(atual.Sugestao);

        if (_estadoTemporal.CaminhoLiberadoRecente)
            return "livre";

        if (alerta.Contains("bloqueado") || alerta.Contains("obstaculo") || alerta.Contains("obstáculo"))
            return "bloqueado";

        if (sugestao.Contains("esquerda") || sugestao.Contains("direita"))
            return "desvio sugerido";

        if (sugestao.Contains("livre") || sugestao.Contains("seguir") || sugestao.Contains("avancar") || sugestao.Contains("avançar"))
            return "livre";

        if (_estadoTemporal.ObstaculoPersistente)
            return "atenção";

        if (_estadoTemporal.ContinuaNoMesmoLugar)
            return "estável";

        return "desconhecido";
    }

    private string MontarNivelAtencaoAtual(RespostaIA atual)
    {
        if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(atual)) || NormalizarTexto(atual.Importancia) == "alta" || _estadoTemporal.ObstaculoPersistente)
            return "alto";

        if (_memoriaAmbiente.HouveTransicaoConfirmada || _memoriaAmbiente.HouveEntradaEmNovoAmbiente || _memoriaAmbiente.HouveMudancaEstruturalRecente || _estadoTemporal.PessoaPersistente)
            return "medio";

        return "baixo";
    }

    private string MontarTendenciaMovimentoEstado()
    {
        if (_estadoTemporal.SugereRotacaoDeCamera)
            return "mudança de direção";

        if (_estadoTemporal.MesmoAmbienteComMovimento)
        {
            if (!string.IsNullOrWhiteSpace(_estadoTemporal.DirecaoDominante) && _estadoTemporal.DirecaoDominante != "sem-direcao")
                return $"movimento para {_estadoTemporal.DirecaoDominante}";

            return "movimento contínuo";
        }

        if (_estadoTemporal.CaminhoLiberadoRecente)
            return "caminho abrindo";

        if (_estadoTemporal.ObstaculoPersistente)
            return "obstáculo persistente";

        if (_estadoTemporal.ContinuaNoMesmoLugar)
            return "ambiente estável";

        return "observando";
    }

    private string ObterReferenciaPrincipalEstado(RespostaIA atual)
    {
        if (!string.IsNullOrWhiteSpace(_memoriaAmbiente.ReferenciaAtual))
            return PrimeiraLetraMaiuscula(_memoriaAmbiente.ReferenciaAtual);

        var referenciaAtual = ExtrairReferenciaAmbiente(atual);
        if (!string.IsNullOrWhiteSpace(referenciaAtual))
            return PrimeiraLetraMaiuscula(referenciaAtual);

        return "-";
    }

    private bool HouveMudancaDetectadaNoMomento()
    {
        return _memoriaAmbiente.HouveEntradaEmNovoAmbiente ||
               _memoriaAmbiente.HouveTransicaoConfirmada ||
               _memoriaAmbiente.HouveMudancaEstruturalRecente ||
               _estadoTemporal.ObstaculoPersistente ||
               _estadoTemporal.CaminhoLiberadoRecente ||
               _estadoTemporal.PessoaPersistente;
    }

    private string InferirAmbientePeloConteudoAtual(RespostaIA atual)
    {
        var label = InferirLabelAmbiente(NormalizarTexto(atual.Descricao), NormalizarLista(atual.Objetos));
        if (!string.IsNullOrWhiteSpace(label))
            return PrimeiraLetraMaiuscula(label);

        if (!string.IsNullOrWhiteSpace(atual.Descricao) && DescricaoPareceAmbienteUtil(atual.Descricao))
            return PrimeiraLetraMaiuscula(LimparTextoBasico(atual.Descricao));

        return "Indefinido";
    }

    private string InferirTipoPeloConteudoAtual(RespostaIA atual)
    {
        var perfil = InferirPerfilAmbiente(NormalizarTexto(atual.Descricao), NormalizarLista(atual.Objetos));
        return string.IsNullOrWhiteSpace(perfil) || perfil == "indefinido" ? "Em análise" : PrimeiraLetraMaiuscula(perfil);
    }

    private string PrimeiraLetraMaiuscula(string? texto)
    {
        var valor = LimparTextoBasico(texto);
        if (string.IsNullOrWhiteSpace(valor))
            return "";

        if (valor.Length == 1)
            return valor.ToUpperInvariant();

        return char.ToUpperInvariant(valor[0]) + valor[1..];
    }

    private async Task GarantirMemoriaPersistenteInicializadaAsync()
    {
        lock (_lockMemoria)
        {
            if (_painelPersistenteInicializado)
                return;
        }

        var painel = await _memoriaPersistenteService.ObterPainelAsync();

        lock (_lockMemoria)
        {
            if (_painelPersistenteInicializado)
                return;

            _painelMemoriaPersistente = painel ?? new PainelMemoriaPersistente();
            _painelPersistenteInicializado = true;
        }
    }

    private async Task AtualizarMemoriaPersistenteAsync(RespostaIA resposta, bool primeiraLeitura)
    {
        var snapshot = CriarSnapshotPersistencia(resposta, primeiraLeitura);
        if (snapshot == null)
            return;

        PainelMemoriaPersistente? painel = null;

        if (snapshot.DevePersistir)
        {
            painel = await _memoriaPersistenteService.RegistrarAmbienteAsync(
                new RegistroMemoriaPersistenteInput
                {
                    Assinatura = snapshot.Assinatura,
                    Ambiente = snapshot.Ambiente,
                    Perfil = snapshot.Perfil,
                    DescricaoConsolidada = snapshot.DescricaoConsolidada,
                    Referencias = snapshot.Referencias,
                    IncrementoLeitura = snapshot.IncrementoLeitura,
                    Evento = snapshot.Evento,
                    ReconhecidoEmUtc = snapshot.ReconhecidoEmUtc
                });
        }
        else if (snapshot.DeveAtualizarPainel)
        {
            painel = await _memoriaPersistenteService.ObterPainelAsync(snapshot.Assinatura, snapshot.Ambiente);
        }

        lock (_lockMemoria)
        {
            if (snapshot.DevePersistir)
            {
                _controlePersistenciaAmbientes[snapshot.Assinatura] = new ControlePersistenciaAmbiente
                {
                    UltimoRegistroUtc = snapshot.ReconhecidoEmUtc,
                    LeiturasPersistidas = snapshot.TotalLeiturasObservadas,
                    UltimoEvento = snapshot.Evento
                };
            }

            if (painel != null)
            {
                _painelMemoriaPersistente = painel;
                _painelPersistenteInicializado = true;
            }
        }
    }

    private PersistenciaMemoriaSnapshot? CriarSnapshotPersistencia(RespostaIA resposta, bool primeiraLeitura)
    {
        lock (_lockMemoria)
        {
            var ambienteAtual = _memoriaAmbiente.AmbienteConfirmado;
            if (string.IsNullOrWhiteSpace(ambienteAtual))
                return null;

            if (!_ambientesMemorizados.TryGetValue(ambienteAtual, out var ambienteMemorizado))
                return null;

            var referencias = ExtrairReferenciasPersistencia(resposta, ambienteMemorizado.UltimaReferencia);
            var ambiente = LimparTextoBasico(ambienteAtual);
            var perfil = LimparTextoBasico(_memoriaAmbiente.PerfilAtual);
            var assinatura = CriarAssinaturaPersistente(ambiente, referencias);

            if (string.IsNullOrWhiteSpace(assinatura))
                return null;

            var evento = DeterminarEventoPersistente(primeiraLeitura, resposta);
            var eventoPrioritario =
                _memoriaAmbiente.HouveEntradaEmNovoAmbiente ||
                _memoriaAmbiente.HouveTransicaoConfirmada ||
                _memoriaAmbiente.HouveMudancaEstruturalRecente;

            var temInformacaoUtil =
                referencias.Count > 0 ||
                !string.IsNullOrWhiteSpace(ObterAlertaPrincipal(resposta)) ||
                !string.IsNullOrWhiteSpace(resposta.Pessoa) ||
                (resposta.PontosInteresse?.Count ?? 0) > 0;

            _controlePersistenciaAmbientes.TryGetValue(assinatura, out var controle);

            var agora = DateTime.UtcNow;
            var ultimoRegistroUtc = controle == null ? DateTime.MinValue : controle.UltimoRegistroUtc;
            var tempoDesdeUltimoRegistro = ultimoRegistroUtc == DateTime.MinValue
                ? double.MaxValue
                : (agora - ultimoRegistroUtc).TotalSeconds;

            var totalLeiturasObservadas = Math.Max(1, ambienteMemorizado.TotalLeituras);
            var incrementoLeitura = Math.Max(1, totalLeiturasObservadas - (controle?.LeiturasPersistidas ?? 0));
            var mudouEvento = !string.Equals(controle?.UltimoEvento, evento, StringComparison.OrdinalIgnoreCase);

            var devePersistir =
                eventoPrioritario ||
                (temInformacaoUtil &&
                 totalLeiturasObservadas >= MINIMO_LEITURAS_PERSISTENCIA &&
                 incrementoLeitura >= LEITURAS_MINIMAS_NOVA_CONSOLIDACAO &&
                 tempoDesdeUltimoRegistro >= INTERVALO_MINIMO_PERSISTENCIA_SEGUNDOS) ||
                (temInformacaoUtil &&
                 mudouEvento &&
                 tempoDesdeUltimoRegistro >= INTERVALO_MINIMO_PERSISTENCIA_SEGUNDOS);

            var deveAtualizarPainel =
                primeiraLeitura ||
                eventoPrioritario ||
                !_painelPersistenteInicializado ||
                (string.IsNullOrWhiteSpace(_painelMemoriaPersistente.Atual?.Ambiente) ||
                 !LabelsParecidos(_painelMemoriaPersistente.Atual.Ambiente, ambiente));

            if (!devePersistir && !deveAtualizarPainel)
                return null;

            return new PersistenciaMemoriaSnapshot
            {
                Assinatura = assinatura,
                Ambiente = ambiente,
                Perfil = string.IsNullOrWhiteSpace(perfil) ? "indefinido" : perfil,
                DescricaoConsolidada = CriarDescricaoPersistente(resposta, ambiente, referencias),
                Referencias = referencias,
                Evento = evento,
                DevePersistir = devePersistir,
                DeveAtualizarPainel = deveAtualizarPainel,
                IncrementoLeitura = incrementoLeitura,
                ReconhecidoEmUtc = agora,
                TotalLeiturasObservadas = totalLeiturasObservadas
            };
        }
    }

    private string MontarContextoMemoriaPersistente()
    {
        var atual = _painelMemoriaPersistente.Atual;
        if (!string.IsNullOrWhiteSpace(atual.Ambiente))
        {
            var referencias = atual.Referencias?.Any() == true
                ? JuntarListaNatural(atual.Referencias.Take(3).ToList())
                : "nenhuma";

            return
                "Memória persistente atual: ambiente " + atual.Ambiente +
                ", leituras úteis acumuladas " + atual.Leituras +
                ", referências frequentes " + referencias +
                ", descrição consolidada " + ValorOuPadrao(atual.DescricaoConsolidada, "nenhuma") + ".";
        }

        if (_painelMemoriaPersistente.Recentes.Count > 0)
        {
            var recente = _painelMemoriaPersistente.Recentes[0];
            return "Memória persistente disponível, último ambiente salvo: " +
                   ValorOuPadrao(recente.Ambiente, "nenhum") + ".";
        }

        return "Memória persistente: sem registros úteis salvos.";
    }


    private string AplicarMemoriaPersistenteNaFala(
        string textoAtual,
        MemoriaPersistenteAmbiente memoriaPersistenteAtual,
        bool primeiraLeitura,
        bool modoGuia)
    {
        if (!modoGuia || !primeiraLeitura || memoriaPersistenteAtual == null)
            return textoAtual;

        if (string.IsNullOrWhiteSpace(memoriaPersistenteAtual.Ambiente))
            return textoAtual;

        var textoNormalizado = NormalizarTexto(textoAtual);
        var ambienteNormalizado = NormalizarTexto(memoriaPersistenteAtual.Ambiente);

        if (textoNormalizado.Contains("memoria") || textoNormalizado.Contains("memória") ||
            (!string.IsNullOrWhiteSpace(ambienteNormalizado) && textoNormalizado.Contains(ambienteNormalizado) && textoNormalizado.Contains("reconhec")))
            return textoAtual;

        var partes = new List<string>();

        if (!string.IsNullOrWhiteSpace(textoAtual))
            partes.Add(textoAtual.Trim().TrimEnd('.'));

        var referencias = memoriaPersistenteAtual.Referencias?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToList() ?? new List<string>();

        if (referencias.Count > 0)
        {
            partes.Add($"Este ambiente já aparece na memória como {memoriaPersistenteAtual.Ambiente}, com referências como {JuntarListaNatural(referencias)}");
        }
        else if (memoriaPersistenteAtual.Leituras > 0)
        {
            partes.Add($"Este ambiente já aparece na memória como {memoriaPersistenteAtual.Ambiente}");
        }

        var textoFinal = string.Join(". ", partes.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase));

        if (string.IsNullOrWhiteSpace(textoFinal))
            return textoAtual;

        if (!textoFinal.EndsWith(".") && !textoFinal.EndsWith("!") && !textoFinal.EndsWith("?"))
            textoFinal += ".";

        return textoFinal;
    }

    private MemoriaPersistenteAmbiente ObterMemoriaPersistenteAtual()
    {
        lock (_lockMemoria)
        {
            return CopiarMemoriaPersistente(_painelMemoriaPersistente.Atual);
        }
    }

    private List<MemoriaPersistenteAmbiente> ObterAmbientesPersistidos()
    {
        lock (_lockMemoria)
        {
            return _painelMemoriaPersistente.Recentes
                .Select(CopiarMemoriaPersistente)
                .ToList();
        }
    }

    private IEnumerable<string> ObterReferenciasPersistentesDoAmbienteAtual()
    {
        lock (_lockMemoria)
        {
            var atual = _painelMemoriaPersistente.Atual;
            if (!string.IsNullOrWhiteSpace(atual.Ambiente) && atual.Referencias?.Count > 0)
                return atual.Referencias.ToList();

            var ambienteAtual = _memoriaAmbiente.AmbienteConfirmado;
            if (string.IsNullOrWhiteSpace(ambienteAtual))
                return new List<string>();

            return _painelMemoriaPersistente.Recentes
                .FirstOrDefault(x => LabelsParecidos(x.Ambiente, ambienteAtual))
                ?.Referencias
                ?.ToList() ?? new List<string>();
        }
    }

    private MemoriaPersistenteAmbiente CopiarMemoriaPersistente(MemoriaPersistenteAmbiente? origem)
    {
        origem ??= new MemoriaPersistenteAmbiente();

        return new MemoriaPersistenteAmbiente
        {
            Assinatura = origem.Assinatura,
            Ambiente = origem.Ambiente,
            Perfil = origem.Perfil,
            DescricaoConsolidada = origem.DescricaoConsolidada,
            UltimoEvento = origem.UltimoEvento,
            Leituras = origem.Leituras,
            UltimoReconhecimentoUtc = origem.UltimoReconhecimentoUtc,
            CorrespondeAoAmbienteAtual = origem.CorrespondeAoAmbienteAtual,
            Referencias = origem.Referencias?.ToList() ?? new List<string>()
        };
    }

    private List<string> ExtrairReferenciasPersistencia(RespostaIA resposta, string referenciaAtual)
    {
        var direcaoNatural = TextoDirecaoNatural(resposta.Direcao);
        var referencias = new List<string>();

        if (!string.IsNullOrWhiteSpace(referenciaAtual) && ReferenciaEhPersistenteUtil(referenciaAtual))
            referencias.Add(PrimeiraLetraMaiuscula(referenciaAtual));

        foreach (var ponto in resposta.PontosInteresse ?? new List<string>())
        {
            if (ReferenciaEhPersistenteUtil(ponto))
                referencias.Add(PrimeiraLetraMaiuscula(LimparTextoBasico(ponto)));
        }

        foreach (var objeto in NormalizarLista(resposta.Objetos)
                     .Where(ReferenciaEhPersistenteUtil)
                     .Take(4))
        {
            if ((objeto is "porta" or "mesa" or "cadeira" or "cama" or "passagem") &&
                !string.IsNullOrWhiteSpace(direcaoNatural))
            {
                referencias.Add(PrimeiraLetraMaiuscula($"{objeto} {direcaoNatural}"));
            }
            else
            {
                referencias.Add(PrimeiraLetraMaiuscula(objeto));
            }
        }

        return referencias
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();
    }

    private bool ReferenciaEhPersistenteUtil(string? texto)
    {
        var normalizado = NormalizarTexto(texto);
        if (string.IsNullOrWhiteSpace(normalizado))
            return false;

        return normalizado.Contains("porta") ||
               normalizado.Contains("passagem") ||
               normalizado.Contains("corredor") ||
               normalizado.Contains("mesa") ||
               normalizado.Contains("cadeira") ||
               normalizado.Contains("cama") ||
               normalizado.Contains("quadro") ||
               normalizado.Contains("lousa") ||
               normalizado.Contains("escada") ||
               normalizado.Contains("elevador") ||
               normalizado.Contains("balcao") ||
               normalizado.Contains("balcão") ||
               normalizado.Contains("prateleira");
    }

    private string CriarAssinaturaPersistente(string ambiente, IEnumerable<string> referencias)
    {
        var chaveAmbiente = NormalizarTexto(ambiente);
        if (string.IsNullOrWhiteSpace(chaveAmbiente))
            return "";

        var partes = referencias
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(NormalizarTexto)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .Take(3)
            .ToList();

        return partes.Count == 0
            ? chaveAmbiente
            : $"{chaveAmbiente}::{string.Join("|", partes)}";
    }

    private string CriarDescricaoPersistente(RespostaIA resposta, string ambiente, IEnumerable<string> referencias)
    {
        var resumo = LimparTextoBasico(string.IsNullOrWhiteSpace(resposta.ResumoAmbiente) ? resposta.Descricao : resposta.ResumoAmbiente);
        var referenciasTexto = referencias
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Take(3)
            .ToList();

        if (string.IsNullOrWhiteSpace(resumo))
            resumo = $"Ambiente reconhecido como {AdicionarArtigoAoAmbiente(ambiente)}";

        if (referenciasTexto.Count > 0 &&
            !NormalizarTexto(resumo).Contains(NormalizarTexto(referenciasTexto[0])))
        {
            resumo += $". Referências mais consistentes: {JuntarListaNatural(referenciasTexto)}";
        }

        return LimparTextoParaAudio(resumo, 320);
    }

    private string DeterminarEventoPersistente(bool primeiraLeitura, RespostaIA resposta)
    {
        if (_memoriaAmbiente.HouveTransicaoConfirmada)
            return "transição confirmada";

        if (_memoriaAmbiente.HouveEntradaEmNovoAmbiente)
            return "novo ambiente confirmado";

        if (_memoriaAmbiente.HouveMudancaEstruturalRecente)
            return "mudança estrutural";

        if (!string.IsNullOrWhiteSpace(ObterAlertaPrincipal(resposta)))
            return "risco observado";

        if (!string.IsNullOrWhiteSpace(resposta.Pessoa))
            return "pessoa por perto";

        if ((resposta.PontosInteresse?.Count ?? 0) > 0)
            return "ponto de interesse estável";

        if (primeiraLeitura)
            return "primeira consolidação";

        return "reconhecimento estável";
    }

    private class ContextoRecenteIA
    {
        public string UltimaDescricao { get; set; } = "";
        public string UltimoAlerta { get; set; } = "";
        public string UltimaSugestao { get; set; } = "";
        public string UltimaDirecao { get; set; } = "sem-direcao";
        public string UltimaImportancia { get; set; } = "baixa";
        public string TendenciaCena { get; set; } = "cena estável";
        public string PerfilAmbiente { get; set; } = "";
        public string ReferenciaAmbiente { get; set; } = "";
        public string UltimoTextoFalado { get; set; } = "";
    }

    private class MemoriaAmbienteAtual
    {
        public string AmbienteConfirmado { get; set; } = "";
        public string AmbienteAnteriorConfirmado { get; set; } = "";
        public string CandidatoAmbiente { get; set; } = "";
        public int RepeticoesCandidato { get; set; } = 0;
        public string PerfilCandidato { get; set; } = "";
        public string ReferenciaCandidata { get; set; } = "";
        public string SuspeitaTransicao { get; set; } = "";
        public int RepeticoesSuspeita { get; set; } = 0;
        public string PerfilSuspeita { get; set; } = "";
        public string ReferenciaSuspeita { get; set; } = "";
        public string PerfilAtual { get; set; } = "";
        public string ReferenciaAtual { get; set; } = "";
        public bool HouveEntradaEmNovoAmbiente { get; set; } = false;
        public bool HouveTransicaoConfirmada { get; set; } = false;
        public bool HouveMudancaEstruturalRecente { get; set; } = false;
        public string UltimaMudancaEstrutural { get; set; } = "";
        public DateTime EntrouNoAmbienteEm { get; set; } = DateTime.MinValue;
        public DateTime UltimoMomentoAnalise { get; set; } = DateTime.MinValue;
    }

    private class AmbienteMemorizado
    {
        public string Label { get; set; } = "";
        public string Perfil { get; set; } = "";
        public string UltimaDescricao { get; set; } = "";
        public string UltimaDirecao { get; set; } = "";
        public string UltimaPessoa { get; set; } = "";
        public string UltimaReferencia { get; set; } = "";
        public string DescricaoMudancaRecente { get; set; } = "";
        public DateTime PrimeiroRegistroEm { get; set; } = DateTime.MinValue;
        public DateTime UltimoRegistroEm { get; set; } = DateTime.MinValue;
        public int TotalLeituras { get; set; } = 0;
        public List<string> ObjetosRecentes { get; set; } = new();
        public Dictionary<string, int> ContagemObjetos { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }


    private class LeituraTemporal
    {
        public DateTime Em { get; set; } = DateTime.MinValue;
        public string Ambiente { get; set; } = "";
        public string Perfil { get; set; } = "";
        public string Descricao { get; set; } = "";
        public string AlertaPrincipal { get; set; } = "";
        public string Pessoa { get; set; } = "";
        public string Sugestao { get; set; } = "";
        public string Direcao { get; set; } = "";
        public string Importancia { get; set; } = "";
        public List<string> Objetos { get; set; } = new();
    }

    private class EstadoTemporalNavegacao
    {
        public string AmbienteAtual { get; set; } = "";
        public string PerfilAtual { get; set; } = "";
        public string ReferenciaAtual { get; set; } = "";
        public string DirecaoDominante { get; set; } = "";
        public string UltimoEvento { get; set; } = "sem_evento";
        public EventoNavegacaoInterno? EventoAtual { get; set; }
        public bool ContinuaNoMesmoLugar { get; set; } = false;
        public bool MesmoAmbienteComMovimento { get; set; } = false;
        public bool ObstaculoPersistente { get; set; } = false;
        public bool CaminhoLiberadoRecente { get; set; } = false;
        public bool PessoaPersistente { get; set; } = false;
        public bool SugereRotacaoDeCamera { get; set; } = false;
    }

    private class EventoNavegacaoInterno
    {
        public string Tipo { get; set; } = "";
        public string Descricao { get; set; } = "";
        public string Importancia { get; set; } = "media";
        public string Origem { get; set; } = "";
    }

    private class SinalAmbiente
    {
        public string Label { get; set; } = "";
        public string Perfil { get; set; } = "";
        public string Referencia { get; set; } = "";
    }

    private class ControlePersistenciaAmbiente
    {
        public DateTime UltimoRegistroUtc { get; set; } = DateTime.MinValue;
        public int LeiturasPersistidas { get; set; } = 0;
        public string UltimoEvento { get; set; } = "";
    }

    private class PersistenciaMemoriaSnapshot
    {
        public string Assinatura { get; set; } = "";
        public string Ambiente { get; set; } = "";
        public string Perfil { get; set; } = "";
        public string DescricaoConsolidada { get; set; } = "";
        public List<string> Referencias { get; set; } = new();
        public string Evento { get; set; } = "";
        public bool DevePersistir { get; set; } = false;
        public bool DeveAtualizarPainel { get; set; } = false;
        public int IncrementoLeitura { get; set; } = 1;
        public int TotalLeiturasObservadas { get; set; } = 0;
        public DateTime ReconhecidoEmUtc { get; set; } = DateTime.UtcNow;
    }
}
