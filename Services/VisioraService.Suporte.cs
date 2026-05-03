using VisioraAPI.Models;

namespace VisioraAPI.Services;

public partial class VisioraService
{
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
        partes.Add("Estou analisando o espaço à frente para orientar sua locomoção");

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

    if ((agora - _ultimaFalaEm).TotalSeconds < 32)
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

        if (request.TempoDesdeUltimaAnaliseMs <= 0 || request.TempoDesdeUltimaAnaliseMs >= 9000)
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
            EstadoCognitivo = estado,
            MemoriaRecente = memoria,
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
            partes.Add("Primeira leitura: faça descrição ambiental completa o suficiente para uma pessoa sem visão se situar. Não presuma destino. Aponte portas, passagens, obstáculos, pessoas e objetos úteis, caso apareçam.");
        }
        else if (estadoOperacional.Contains("movimento") || estadoOperacional.Contains("mudança"))
        {
            partes.Add("A câmera mudou. Informe o que apareceu, sumiu ou ficou relevante. Não mande a pessoa ir para lugar nenhum sem motivo; destaque possibilidades e riscos.");
        }
        else
        {
            partes.Add("Verificação de prontidão. Se nada útil mudou, use silêncio. Fale apenas por risco, pessoa, porta/passagem, mudança relevante ou novo ambiente.");
        }

        return string.Join(" ", partes);
    }

    private string AplicarPoliticaDeComunicacaoAssistiva(string textoAudio, RespostaIA atual, ImagemRequest request, bool primeiraLeitura)
    {
        if (primeiraLeitura)
        {
            var falaInicial = CriarFalaInicialDoGuia(atual, true);
            return GarantirPontoFinal(LimparTextoParaAudio(falaInicial, 520));
        }

        if (string.IsNullOrWhiteSpace(textoAudio))
            return "";

        var alerta = ObterAlertaPrincipal(atual);
        if (!string.IsNullOrWhiteSpace(alerta))
            return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(TransformarAlertaEmFala(alerta)), 130));

        var textoSeguro = TornarOrientacaoCondicional(textoAudio);

        if (request.CenaEstavel && request.MudancaVisual < 3.2 && NormalizarTexto(atual.Importancia) == "baixa")
        {
            if (NormalizarTexto(atual.EventoGuia) is "silencio" or "confirmacao")
                return "";
        }

        return GarantirPontoFinal(LimparTextoParaAudio(SuavizarTexto(textoSeguro), 220));
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
                AtualizadoEmUtc = DateTime.UtcNow
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
            AtualizadoEmUtc = DateTime.UtcNow
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
}
