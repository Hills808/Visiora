# CA-L4/S4 — diagnóstico da sessão Luna com webcam (23/10/2026)

O usuário enviou `C:\meu\plan\visiora-diagnosticov.json`, SHA-256 `D1545BD3C0A68E7B149AE61EBE5EF4FEA41BD154273C5DC7ED94FDD2951C2F64`, e uma captura de tela da sessão. O arquivo e a imagem identificável **não** foram copiados ao repositório. Segundo a tela, a entrada era webcam ao vivo em ambiente interno, com pessoa e cadeira visíveis, Luna selecionado e consentimento marcado. Iluminação, modelo/API efetivamente retornado, máquina, voz e tempo até fala não foram medidos neste ensaio. O JSON marca `version=0.3.0`, `deliveryPolicy=adr-029` e exportação em `2026-10-23T19:02:32.301Z`.

| Critério | Observado | Estado e próximo passo |
| --- | --- | --- |
| CA-L4 — processamento/entrega | 2 envios, 1 resposta aceita, 1 fala confirmada, 0 retiradas, 0 silêncios, 0 recuperações; `lastError=null`. | Funcionamento parcial observado. O segundo envio não tem desfecho no arquivo; não atribuir a crédito, API ou expiração. |
| CA-S4 — diagnóstico sem imagem | JSON contém contagens e estado, sem pixels ou transcrição. `local.state=disabled` é esperado no Luna atual. | Exportação observada; auditoria completa de rede/disco não realizada. |
| CA-A4/A5 — experiência | A tela mostra “Analisando uma imagem” com câmera ativa; o arquivo foi exportado já em `source=idle`, `running=false`, `pending=false`. | Instantes diferentes. Sem registro da frase ou da audibilidade, não se avalia precisão, latência ou utilidade para pessoas cegas. |

`paused=true` no arquivo **não prova pausa por erro**: `OnlineSession.stop()` sempre pausa o agendador. `speechCompleted=4` e `errors=1` são contadores da página inteira, enquanto `onlineContinuity` descreve a última sessão Luna; a causa daquele erro geral não está no arquivo. `frames=0` e latências locais vazias são esperados porque pertencem ao modo local. O último `lastError` pode ter sido limpo por uma resposta ou fala posterior. O arquivo não distingue uma consulta em andamento cancelada pela parada de uma consulta sem resposta por outro motivo.

Para tornar o próximo diagnóstico interpretável, a mudança desta fatia registra `onlineContinuity.sessionEnd.reason` e `pendingAtStop`, além do escopo dos contadores gerais. Teste fake em navegador cobriu parada com requisição em andamento e parada após falha do provedor. Nenhuma chamada paga ou imagem privada foi usada no teste. Ainda não testado: repetição com a webcam real, áudio audível, motivo do erro geral anterior, duração captura→fala, precisão visual e participantes cegos/baixa visão.
