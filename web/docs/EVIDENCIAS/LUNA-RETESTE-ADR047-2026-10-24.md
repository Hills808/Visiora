# Reteste do usuário após ADR-047 — 24/10/2026

Origem: diagnóstico exportado pelo usuário em 2026-10-24T23:39:36.175Z (20:39:36, America/Sao_Paulo), versão 0.3.0, deliveryPolicy adr-047, source luna. SHA-256 do arquivo: 47799a6c675102615efe5961ea893ee3444dbf1d34b1817adcd6286d02439a6f.

Condições: captura de tela fornecida mostra webcam em ambiente interno; não houve novo acesso à câmera pelo agente. Modelo físico, sistema, iluminação medida, voz audível, transcrição completa e duração da sessão não foram fornecidos. `simulated:false` identifica percepção real no cliente, mas não comprova por si só áudio audível nem modelo faturado; o diagnóstico não guarda atestado do modelo ou custo. Não copiar imagem, texto da descrição nem arquivo privado para o repositório.

| Critério | Observado | Avaliação e próxima ação |
|---|---|---|
| CA-L1/L4 — contrato e continuidade | 5 despachos, 4 aceitos; sessão ativa, uma análise pendente; 3 entregas, 1 decisão de silêncio, 0 respostas obsoletas/inutilizáveis | O fluxo entregou descrições neste reteste. Não assumir que o quinto despacho falhou; estava pendente. Não há indicação do HTTP 422 anterior neste arquivo; não prova ausência em todas as sessões. |
| CA-F6/L4 — expiração | 1 retirada por expiração; lastError speech-expired; 1 recuperação; paused=false, recovering=false | Houve expiração antes da fala e agendamento de captura nova. O arquivo foi exportado com pedido pendente; não prova que essa recuperação já concluiu. Não confundir errors=0 geral com ausência de expiração. |
| CA-D1/D3 — atraso | 4 respostas: 4,75–7,02 s; p50 5,26 s. 3 inícios de voz: 4,78–6,54 s desde captura; p50 5,29 s | Tempos altos para acompanhar movimento; não atende às metas rápidas do plano. Amostra pequena e cenário não controlado; p95 é apenas o máximo destas amostras. |
| CA-F7 — extensão de fala | 3 durações por callback: 8,47–16,81 s, mediana 10,40 s | Priorizar fala curta e novidade. Duração não permite verificar por si só o número de palavras/itens ou CA-F7. |
| CA-H1/H2 — percepção contínua local | local.enabled=false; state=disabled; accepted=0 | Não exercitada. frames=0 geral refere-se ao modo local; CaptureHub Luna processou 335 frames e estava recente, sem fila pendente. |
| CA-F5/H9 — giro/memória em movimento | câmeraRotation.enabled=false; nenhuma invalidação de giro; memória local vazia | Não testado. Ausência de eventos não prova que o usuário ficou parado nem que movimento foi detectado. |
| CA-L3 — custo | Diagnóstico não inclui uso faturado, saldo ou reservas | Não calculável pelo número de despachos. Nenhuma consulta paga, alteração de teto ou ledger feita nesta avaliação. |
| CA-A4/A5/P* — utilidade/precisão | Sem transcrição completa, verdade-terreno anotada ou avaliação de usuários cegos | Não testado; a captura de tela não sustenta alegação de precisão ou uso para caminhar. |

A espera entre preparação da fala e callback de início foi 25–56 ms (3 amostras). Isso não mede separadamente toda espera anterior na fila; não atribuir a expiração a uma causa específica com estes dados. A imagem de tela pode mostrar a descrição criada numa captura anterior junto do contador atual de idade: isso não comprova congelamento.

Próxima fatia recomendada: descrição automática mais curta, prioridade à novidade atual e revisão da expiração/espera sem ampliar a validade das posições. Medir novamente captura→início e duração da fala, com câmera e áudio físicos; testar observador opcional separadamente. Não mudar modelo, preço, cota ou cadência paga a partir desta amostra. Este relatório apenas avalia evidência recebida; nenhum código foi alterado nem suíte reexecutada.
