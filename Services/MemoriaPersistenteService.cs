using System.Globalization;
using System.Text;
using Microsoft.Data.Sqlite;
using VisioraAPI.Models;

namespace VisioraAPI.Services;

public class MemoriaPersistenteService
{
    private readonly string _connectionString;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public MemoriaPersistenteService(IWebHostEnvironment environment)
    {
        var dataDirectory = Path.Combine(environment.ContentRootPath, "Data");
        Directory.CreateDirectory(dataDirectory);

        var databasePath = Path.Combine(dataDirectory, "visiora-memoria.db");
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();

        InicializarBanco();
    }

    public async Task<PainelMemoriaPersistente> RegistrarAmbienteAsync(
        RegistroMemoriaPersistenteInput entrada,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(entrada.Ambiente) || string.IsNullOrWhiteSpace(entrada.Assinatura))
            return await ObterPainelAsync(entrada.Assinatura, entrada.Ambiente, cancellationToken);

        var assinaturaPersistida = entrada.Assinatura;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            await using var connection = CriarConexao();
            await connection.OpenAsync(cancellationToken);
            await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

            var existente = await LocalizarRegistroAsync(connection, transaction, entrada, cancellationToken);
            assinaturaPersistida = existente?.Assinatura ?? entrada.Assinatura;

            var descricaoConsolidada = ConsolidarDescricao(
                existente?.DescricaoConsolidada ?? "",
                entrada.DescricaoConsolidada);

            if (existente == null)
            {
                await InserirAmbienteAsync(
                    connection,
                    transaction,
                    assinaturaPersistida,
                    entrada,
                    descricaoConsolidada,
                    cancellationToken);
            }
            else
            {
                await AtualizarAmbienteAsync(
                    connection,
                    transaction,
                    assinaturaPersistida,
                    existente,
                    entrada,
                    descricaoConsolidada,
                    cancellationToken);
            }

            await AtualizarReferenciasAsync(
                connection,
                transaction,
                assinaturaPersistida,
                entrada.Referencias,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        return await ObterPainelAsync(assinaturaPersistida, entrada.Ambiente, cancellationToken);
    }

    public async Task<PainelMemoriaPersistente> ObterPainelAsync(
        string? assinaturaAtual = "",
        string? ambienteAtual = "",
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await using var connection = CriarConexao();
            await connection.OpenAsync(cancellationToken);
            return await LerPainelAsync(connection, assinaturaAtual, ambienteAtual, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private void InicializarBanco()
    {
        using var connection = CriarConexao();
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE IF NOT EXISTS ambientes (
                assinatura TEXT PRIMARY KEY,
                ambiente TEXT NOT NULL,
                perfil TEXT NOT NULL,
                descricao_consolidada TEXT NOT NULL,
                ultimo_evento TEXT NOT NULL,
                leituras INTEGER NOT NULL DEFAULT 0,
                criado_em_utc TEXT NOT NULL,
                ultima_vez_reconhecido_utc TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS referencias_ambiente (
                ambiente_assinatura TEXT NOT NULL,
                referencia TEXT NOT NULL,
                ocorrencias INTEGER NOT NULL DEFAULT 0,
                ultima_vez_reconhecido_utc TEXT NOT NULL,
                PRIMARY KEY (ambiente_assinatura, referencia),
                FOREIGN KEY (ambiente_assinatura) REFERENCES ambientes(assinatura) ON DELETE CASCADE
            );
            """;
        command.ExecuteNonQuery();
    }

    private SqliteConnection CriarConexao()
    {
        return new SqliteConnection(_connectionString);
    }

    private async Task InserirAmbienteAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string assinatura,
        RegistroMemoriaPersistenteInput entrada,
        string descricaoConsolidada,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO ambientes (
                assinatura,
                ambiente,
                perfil,
                descricao_consolidada,
                ultimo_evento,
                leituras,
                criado_em_utc,
                ultima_vez_reconhecido_utc
            )
            VALUES (
                $assinatura,
                $ambiente,
                $perfil,
                $descricao,
                $evento,
                $leituras,
                $criado,
                $ultima
            );
            """;
        command.Parameters.AddWithValue("$assinatura", assinatura);
        command.Parameters.AddWithValue("$ambiente", entrada.Ambiente);
        command.Parameters.AddWithValue("$perfil", entrada.Perfil);
        command.Parameters.AddWithValue("$descricao", descricaoConsolidada);
        command.Parameters.AddWithValue("$evento", entrada.Evento);
        command.Parameters.AddWithValue("$leituras", Math.Max(1, entrada.IncrementoLeitura));
        command.Parameters.AddWithValue("$criado", FormatarUtc(entrada.ReconhecidoEmUtc));
        command.Parameters.AddWithValue("$ultima", FormatarUtc(entrada.ReconhecidoEmUtc));

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task AtualizarAmbienteAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string assinatura,
        RegistroBanco existente,
        RegistroMemoriaPersistenteInput entrada,
        string descricaoConsolidada,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            UPDATE ambientes
            SET ambiente = $ambiente,
                perfil = $perfil,
                descricao_consolidada = $descricao,
                ultimo_evento = $evento,
                leituras = $leituras,
                ultima_vez_reconhecido_utc = $ultima
            WHERE assinatura = $assinatura;
            """;
        command.Parameters.AddWithValue("$assinatura", assinatura);
        command.Parameters.AddWithValue("$ambiente", entrada.Ambiente);
        command.Parameters.AddWithValue("$perfil", string.IsNullOrWhiteSpace(entrada.Perfil) ? existente.Perfil : entrada.Perfil);
        command.Parameters.AddWithValue("$descricao", descricaoConsolidada);
        command.Parameters.AddWithValue("$evento", entrada.Evento);
        command.Parameters.AddWithValue("$leituras", existente.Leituras + Math.Max(1, entrada.IncrementoLeitura));
        command.Parameters.AddWithValue("$ultima", FormatarUtc(entrada.ReconhecidoEmUtc));

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task AtualizarReferenciasAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string assinatura,
        IEnumerable<string> referencias,
        CancellationToken cancellationToken)
    {
        foreach (var referencia in referencias
                     .Where(x => !string.IsNullOrWhiteSpace(x))
                     .Select(LimparTexto)
                     .Where(x => !string.IsNullOrWhiteSpace(x))
                     .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText =
                """
                INSERT INTO referencias_ambiente (
                    ambiente_assinatura,
                    referencia,
                    ocorrencias,
                    ultima_vez_reconhecido_utc
                )
                VALUES ($assinatura, $referencia, 1, $ultima)
                ON CONFLICT(ambiente_assinatura, referencia)
                DO UPDATE SET
                    ocorrencias = ocorrencias + 1,
                    ultima_vez_reconhecido_utc = excluded.ultima_vez_reconhecido_utc;
                """;
            command.Parameters.AddWithValue("$assinatura", assinatura);
            command.Parameters.AddWithValue("$referencia", referencia);
            command.Parameters.AddWithValue("$ultima", FormatarUtc(DateTime.UtcNow));

            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task<RegistroBanco?> LocalizarRegistroAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        RegistroMemoriaPersistenteInput entrada,
        CancellationToken cancellationToken)
    {
        var exato = await ObterRegistroPorAssinaturaAsync(connection, transaction, entrada.Assinatura, cancellationToken);
        if (exato != null)
            return exato;

        if (string.IsNullOrWhiteSpace(entrada.Ambiente))
            return null;

        var candidatos = await ObterRegistrosPorAmbienteAsync(connection, transaction, entrada.Ambiente, cancellationToken);
        if (candidatos.Count == 0)
            return null;

        if (entrada.Referencias.Count == 0)
            return candidatos[0];

        var referenciasAtuais = new HashSet<string>(
            entrada.Referencias.Select(NormalizarChave),
            StringComparer.OrdinalIgnoreCase);

        RegistroBanco? melhor = null;
        var melhorSobreposicao = 0;

        foreach (var candidato in candidatos)
        {
            var referenciasExistentes = await ObterReferenciasPorAssinaturaAsync(
                connection,
                transaction,
                candidato.Assinatura,
                cancellationToken);

            var sobreposicao = referenciasExistentes
                .Select(NormalizarChave)
                .Count(referenciasAtuais.Contains);

            if (sobreposicao > melhorSobreposicao)
            {
                melhorSobreposicao = sobreposicao;
                melhor = candidato;
            }
        }

        return melhorSobreposicao > 0 ? melhor : candidatos[0];
    }

    private async Task<RegistroBanco?> ObterRegistroPorAssinaturaAsync(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        string assinatura,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(assinatura))
            return null;

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT assinatura, ambiente, perfil, descricao_consolidada, ultimo_evento, leituras, ultima_vez_reconhecido_utc
            FROM ambientes
            WHERE assinatura = $assinatura
            LIMIT 1;
            """;
        command.Parameters.AddWithValue("$assinatura", assinatura);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            return null;

        return LerRegistro(reader);
    }

    private async Task<List<RegistroBanco>> ObterRegistrosPorAmbienteAsync(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        string ambiente,
        CancellationToken cancellationToken)
    {
        var registros = new List<RegistroBanco>();

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT assinatura, ambiente, perfil, descricao_consolidada, ultimo_evento, leituras, ultima_vez_reconhecido_utc
            FROM ambientes
            WHERE ambiente = $ambiente
            ORDER BY ultima_vez_reconhecido_utc DESC
            LIMIT 4;
            """;
        command.Parameters.AddWithValue("$ambiente", ambiente);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            registros.Add(LerRegistro(reader));

        return registros;
    }

    private async Task<PainelMemoriaPersistente> LerPainelAsync(
        SqliteConnection connection,
        string? assinaturaAtual,
        string? ambienteAtual,
        CancellationToken cancellationToken)
    {
        var recentes = new List<MemoriaPersistenteAmbiente>();

        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT assinatura, ambiente, perfil, descricao_consolidada, ultimo_evento, leituras, ultima_vez_reconhecido_utc
            FROM ambientes
            ORDER BY ultima_vez_reconhecido_utc DESC
            LIMIT 6;
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var registro = LerRegistro(reader);
            var referencias = await ObterReferenciasPorAssinaturaAsync(connection, null, registro.Assinatura, cancellationToken);

            recentes.Add(new MemoriaPersistenteAmbiente
            {
                Assinatura = registro.Assinatura,
                Ambiente = registro.Ambiente,
                Perfil = registro.Perfil,
                DescricaoConsolidada = registro.DescricaoConsolidada,
                UltimoEvento = registro.UltimoEvento,
                Leituras = registro.Leituras,
                UltimoReconhecimentoUtc = registro.UltimoReconhecimentoUtc,
                Referencias = referencias
            });
        }

        var atual = recentes.FirstOrDefault(x =>
            !string.IsNullOrWhiteSpace(assinaturaAtual) &&
            x.Assinatura.Equals(assinaturaAtual, StringComparison.OrdinalIgnoreCase));

        if (atual == null && !string.IsNullOrWhiteSpace(ambienteAtual))
        {
            atual = recentes.FirstOrDefault(x =>
                x.Ambiente.Equals(ambienteAtual, StringComparison.OrdinalIgnoreCase));
        }

        if (atual != null)
            atual.CorrespondeAoAmbienteAtual = true;

        return new PainelMemoriaPersistente
        {
            Atual = atual ?? new MemoriaPersistenteAmbiente(),
            Recentes = recentes
        };
    }

    private async Task<List<string>> ObterReferenciasPorAssinaturaAsync(
        SqliteConnection connection,
        SqliteTransaction? transaction,
        string assinatura,
        CancellationToken cancellationToken)
    {
        var referencias = new List<string>();

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT referencia
            FROM referencias_ambiente
            WHERE ambiente_assinatura = $assinatura
            ORDER BY ocorrencias DESC, ultima_vez_reconhecido_utc DESC
            LIMIT 5;
            """;
        command.Parameters.AddWithValue("$assinatura", assinatura);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var referencia = reader.GetString(0);
            if (!string.IsNullOrWhiteSpace(referencia))
                referencias.Add(referencia);
        }

        return referencias;
    }

    private static RegistroBanco LerRegistro(SqliteDataReader reader)
    {
        return new RegistroBanco
        {
            Assinatura = reader.GetString(0),
            Ambiente = reader.GetString(1),
            Perfil = reader.GetString(2),
            DescricaoConsolidada = reader.GetString(3),
            UltimoEvento = reader.GetString(4),
            Leituras = reader.GetInt32(5),
            UltimoReconhecimentoUtc = ParseUtc(reader.GetString(6))
        };
    }

    private static string ConsolidarDescricao(string atual, string nova)
    {
        var descricaoAtual = LimparTexto(atual);
        var descricaoNova = LimparTexto(nova);

        if (string.IsNullOrWhiteSpace(descricaoAtual))
            return descricaoNova;

        if (string.IsNullOrWhiteSpace(descricaoNova))
            return descricaoAtual;

        var atualNormalizada = NormalizarChave(descricaoAtual);
        var novaNormalizada = NormalizarChave(descricaoNova);

        if (atualNormalizada == novaNormalizada)
            return descricaoNova.Length >= descricaoAtual.Length ? descricaoNova : descricaoAtual;

        if (atualNormalizada.Contains(novaNormalizada))
            return descricaoAtual;

        if (novaNormalizada.Contains(atualNormalizada))
            return descricaoNova;

        var combinada = $"{descricaoNova}. {descricaoAtual}";
        return combinada.Length <= 340 ? combinada : LimitarTexto(combinada, 340);
    }

    private static string LimitarTexto(string texto, int limite)
    {
        if (string.IsNullOrWhiteSpace(texto) || texto.Length <= limite)
            return texto;

        var recorte = texto[..limite];
        var ultimoPonto = recorte.LastIndexOf('.');
        var ultimaVirgula = recorte.LastIndexOf(',');
        var corte = Math.Max(ultimoPonto, ultimaVirgula);

        if (corte > 80)
            return recorte[..corte].Trim();

        return recorte.Trim();
    }

    private static string LimparTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return "";

        return texto.Trim()
            .Replace("\r", " ")
            .Replace("\n", " ")
            .Replace("\t", " ")
            .Replace("  ", " ");
    }

    private static string NormalizarChave(string? texto)
    {
        var limpo = LimparTexto(texto).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(limpo))
            return "";

        var builder = new StringBuilder(limpo.Length);
        foreach (var caractere in limpo.Normalize(NormalizationForm.FormD))
        {
            var categoria = CharUnicodeInfo.GetUnicodeCategory(caractere);
            if (categoria != UnicodeCategory.NonSpacingMark)
                builder.Append(caractere);
        }

        return builder.ToString()
            .Normalize(NormalizationForm.FormC)
            .Replace("  ", " ")
            .Trim();
    }

    private static string FormatarUtc(DateTime valorUtc)
    {
        var utc = valorUtc == DateTime.MinValue ? DateTime.UtcNow : valorUtc.ToUniversalTime();
        return utc.ToString("O");
    }

    private static DateTime ParseUtc(string valor)
    {
        return DateTime.TryParse(
            valor,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind,
            out var parsed)
            ? parsed
            : DateTime.UtcNow;
    }

    private sealed class RegistroBanco
    {
        public string Assinatura { get; init; } = "";
        public string Ambiente { get; init; } = "";
        public string Perfil { get; init; } = "";
        public string DescricaoConsolidada { get; init; } = "";
        public string UltimoEvento { get; init; } = "";
        public int Leituras { get; init; } = 0;
        public DateTime UltimoReconhecimentoUtc { get; init; } = DateTime.MinValue;
    }
}

public class RegistroMemoriaPersistenteInput
{
    public string Assinatura { get; set; } = "";
    public string Ambiente { get; set; } = "";
    public string Perfil { get; set; } = "";
    public string DescricaoConsolidada { get; set; } = "";
    public List<string> Referencias { get; set; } = new();
    public int IncrementoLeitura { get; set; } = 1;
    public string Evento { get; set; } = "";
    public DateTime ReconhecidoEmUtc { get; set; } = DateTime.UtcNow;
}
