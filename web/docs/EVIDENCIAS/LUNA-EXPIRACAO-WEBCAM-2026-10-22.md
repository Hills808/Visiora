# Ensaio Luna com webcam — 22/10/2026

**Errata do reteste:** a primeira correção descrita abaixo não resolveu a pausa observada novamente pelo usuário. A investigação posterior identificou expiração durante a fala, expiração sem mudança ampla e risco de cache antigo. Estado atual e limites: [LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md](LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md), ADR-029.

## Evidência recebida

O usuário exportou `C:\meu\plan\visiora-diagnostico-luna.json` e mostrou a tela do Visiora. O JSON tem SHA-256 `4CE2C0F5E7C2DBDFE6BBB5F523BEFAAE40BDCC160716FE5450D2A94BF2C5AA2C`; a data interna é 22/10/2026, 22h54min59s em America/Sao_Paulo. A tela mostrava uma pessoa e uma cadeira, e a legenda Luna citava quarto, janela, pessoa e cadeira de escritório. O usuário informou que o aplicativo falou: “A descrição expirou antes de poder falar. O acompanhamento foi pausado.” A captura de tela é relato visual dessa sessão; não foi gravada no repositório. Não se verificou a precisão das caixas/direções por inspeção da resposta bruta.

O diagnóstico da sessão Luna registrou `dispatched=1`, `accepted=1`, `obsolete=1`, `silent=1`, `delivered=0`, `recoveries=0`, `lastError=null`, `running=true`, `pending=false` e `paused=true`. `accepted=1` indica que a resposta passou pela validação do cliente, enquanto `obsolete=1` significa que a vista perdeu posições por mudança ampla; não significa falha da API. `delivered=0` indica que a descrição Luna não foi confirmada como entregue nessa sessão. Os totais gerais (`frames=206`, `speechCompleted=5`, `errors=2`) acumulam desde o carregamento da página e podem incluir o ensaio anterior em modo local; não são números exclusivos da sessão Luna.

O ledger SQLite local, lido somente para auditoria, mostra a consulta de 22h54min29s como `complete`, 1.852 tokens de entrada, 455 de saída e débito local estimado de 885 microdólares (US$ 0,000885). Modelo solicitado e declarado pela API: `gpt-6-luna`, conferência `verified`, sem falha registrada. Isso afasta a hipótese de falta de crédito **para essa consulta**. Não demonstra saldo atual da conta nem valor exato da fatura externa. O agente não fez chamada paga, não editou o ledger e não leu/mostrou a chave.

## Causa no código e correção

`OnlineSession` aceita a resposta e marca a mudança ampla de vista. Se a fala espera até o snapshot ultrapassar dez segundos, `VisualMemory.utterance` devolve `null`; antes desta correção, `present` pausava o automático em qualquer expiração, inclusive quando a mudança ampla já havia pedido uma nova captura. Isso corresponde aos contadores e à mensagem observada. Não há registro do instante exato de início/cancelamento da voz, então o diagnóstico não distingue todos os atrasos internos.

Agora, a expiração após mudança ampla mantém a necessidade de nova captura e deixa o automático continuar. A descrição antiga não é falada nem confirmada; uma nova consulta só ocorre com câmera/voz disponíveis, intervalo mínimo de 4,5 s, consentimento e reserva dentro do teto diário. Expiração sem mudança ampla continua pausando, para não consumir repetidamente quando o problema for saída lenta. Fonte, modelo, validade de dez segundos e teto US$ 2/dia não mudaram.

## Verificação

| Critério | Evidência | Resultado |
| --- | --- | --- |
| CA-L4, atualidade e fala | Teste `expired speech after a changed view...`: novo envio só após 4,5 s; sem mudança, pausa; pausa existente não é revertida | Passou |
| CA-L3, cadência e orçamento | Testes existentes de captura única, intervalo, reserva diária e falhas | Passaram, sem chamada real |
| CA-F6, entrega | Testes de confirmação apenas após conclusão e descarte de fala interrompida | Passaram |
| CA-E1, regressão | `npm test` 157/157; `npm run typecheck`; `npm run lint`; `node tools/simulate.mjs` em seis cenas | Passaram; transcrições locais não mudaram |

**Não testado após a correção:** nova sessão com webcam e voz físicas; continuação efetiva após a mensagem no Chrome do usuário; latência, faturamento ou saldo da API; precisão da cena/direções; leitor de tela; uso prolongado; pessoas cegas/baixa visão. O teste unitário prova a política de agendamento, não a entrega ponta a ponta. Um novo diagnóstico por sessão, depois de recarregar a página, deve mostrar mais de uma captura apenas se houver nova vista e orçamento disponível, sem `paused=true` por esse caso. O H2 híbrido continua pendente.
