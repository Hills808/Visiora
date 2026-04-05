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
        texto = texto.Replace("mova-se", "siga", StringComparison.OrdinalIgnoreCase);
        texto = texto.Replace("desloque-se", "vá", StringComparison.OrdinalIgnoreCase);
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

        return modo.Trim().Equals("consulta", StringComparison.OrdinalIgnoreCase)
            ? "consulta"
            : "automatico";
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
