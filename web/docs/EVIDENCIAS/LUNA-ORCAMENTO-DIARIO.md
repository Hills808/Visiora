# Orçamento diário de US$ 2 — ADR-025

19/10/2026. O usuário esclareceu que a autorização é US$ 2 **por dia**, e não US$ 2 acumulados durante todo o piloto.

## Correção

`server/config.mjs` mantém ativação/chave/tarifa e teto diário positivo como requisitos. O teto inicial é zero; valor superior aos US$ 2 autorizados é recusado. `VISIORA_TOTAL_USD` é aposentado e não impede a renovação diária. Não foi necessário editar o `.env` real.

`server/budget-day.mjs` calcula as fronteiras do dia em `America/Sao_Paulo`, independentemente do fuso da máquina. A busca limitada usa a base de fusos de `Intl`, sem assumir deslocamento UTC fixo. O orçamento consulta timestamps no intervalo desse dia dentro da mesma transação de reserva. Não confia na coluna histórica `day` em UTC, nem altera registros antigos. Novos registros recebem a data de São Paulo. Não há limpeza diária do ledger; pedidos pendentes continuam bloqueando concorrência entre dias e reservas incertas continuam no seu dia de início. Falha de consulta/armazenamento impede o envio, sem contador alternativo.

## Verificação executada

- `node tools/test.mjs` (equivalente a `npm test`, build incluído): **135 testes passaram**, incluindo os testes HTTP/gateway/contratos existentes. [Saída](luna-orcamento-diario/tests.txt).
- Tipos, lint e formatação do servidor/teste passaram: [tipos](luna-orcamento-diario/types.txt), [lint](luna-orcamento-diario/lint.txt), [formatação](luna-orcamento-diario/format.txt).
- Quatro novos testes CA-L3: fronteira 02:59:59.999Z/03:00:00Z em São Paulo; histórico com `day` UTC contado pelo timestamp sem migrar dados; renovação sem apagar reservas e mantendo bloqueio diário; pendência global na virada; configuração diária sem teto total e recusa de valor acima de US$ 2.
- Testes de orçamento usam SQLite em memória ou arquivos temporários próprios. Nenhuma chamada paga, envio de imagem, alteração de reserva/ledger real ou publicação.

## Aplicação e limites

Reiniciar o gateway é obrigatório: Ctrl+C no terminal do servidor e `npm run dev:luna`; recarregar o navegador e iniciar com consentimento. Não reiniciamos o processo do usuário nem fizemos uma consulta real. O build está atualizado, mas servidor já aberto continua executando a regra antiga até ser reiniciado.

O limite é um controle conservador local, não prova do valor faturado pela OpenAI. Não foram testados cobrança/painel do provedor, API real após reinício, passagem física do relógio pela meia-noite, mudança de timezone do SO, instalação em outro PC ou quota compartilhada entre cópias do ledger. As fronteiras de data foram testadas com relógio controlado, não esperando o dia virar. Precisão de visão, fala e uso por pessoas cegas não foram avaliados nesta correção.
