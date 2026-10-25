# Protocolo de avaliação de movimento e atualidade

**Preparado; nenhuma sessão ou medição realizada.** Este protocolo avalia percepção, tempo de resposta e utilidade em cenas controladas. Não é orientação para caminhar e não valida segurança. Os critérios CA-H3, CA-H4, CA-H10 e CA-A4/A5 são metas do projeto, não resultados. Neste trabalho: **0 sessões, 0 participantes e 0 avaliações de O&M**.

## Segurança e participantes

- Usar sala conhecida, sem percurso nem obstáculos preparados como desafio. O participante cego ou com baixa visão permanece sentado ou parado; nunca caminha guiado pelo protótipo.
- Um operador vidente movimenta a câmera ou reproduz clipes consentidos, seguindo a sequência anotada. O participante pode parar a sessão a qualquer momento.
- Explicar que direções são relativas à câmera, que o sistema pode omitir ou errar e que não indica caminho livre. Obter consentimento acessível antes de qualquer sessão ou gravação. Não guardar imagem, áudio ou identificadores pessoais por padrão.
- Futuras avaliações de Orientação e Mobilidade (O&M) devem ser planejadas com profissional e participantes; não substituem os critérios com pessoas cegas/baixa visão.

## Alvo prioritário: iPhone, câmera traseira

Registrar modelo do iPhone, versão iOS/Safari e voz instalada. Ensaio técnico com operador parado, câmera traseira em retrato/paisagem, HTTPS e permissão de câmera; confirmar a lente efetiva, pois `facingMode: ideal` é uma preferência. Medir bateria/aquecimento, rede Wi-Fi/dados, retorno de segundo plano e interrupções, sem enviar imagens por padrão. Comparar sensor desligado, autorizado com leituras, negado e sem leituras; giro por si só não estabelece posição corporal. Nunca chamar autorização de sensor de prova de leitura, nem ausência de giro de prova de estabilidade. Testar VoiceOver fisicamente; emulação Chromium não cobre esses requisitos.

## Preparação e execução

1. Congelar versão do app, modelo/pesos, configuração, dispositivo, navegador e roteiro. Antes de habilitar fala híbrida, executar benchmark local H2: qualidade anotada, latência por etapa, p50/p95, memória e perfis CPU/GPU. Registrar falhas e resultados negativos; se qualidade e atraso não passarem CA-H3/H4, manter snapshots e não liberar fala do detector.
2. Dois anotadores definem antes da execução cada evento relevante, classe, setor relativo à câmera, visibilidade e janela válida. Resolver divergências ou marcá-las como indeterminadas; não usar saída do modelo como rótulo de referência.
3. Executar os cenários abaixo em clipes com IDs e tempos conhecidos. Separar desenvolvimento de confirmação congelada. Repetições de frames do mesmo clipe não contam como eventos independentes.
4. Fazer primeiro a medição técnica sem participante. Só depois, em sessão consentida e estacionária, perguntar o que a pessoa entendeu e se a informação foi útil, tardia, repetida ou confusa. Não sugerir resposta.
5. Registrar toda omissão, fala incorreta, descarte, interrupção e falha. Relatar contagens e denominadores por cenário e classe; não retirar casos difíceis do cálculo.

## Cenários mínimos

| ID | Cena controlada | Verificar |
|---|---|---|
| M01 | Vista estática por 5 min | Após briefing, silêncio sem repetição; falsas referências. Para CA-H3, acrescentar ensaio estático de 10 min conforme o critério. |
| M02 | Pequena mudança localizada | Se a referência nova/alterada aparece no setor correto e no prazo válido. |
| M03 | Giro amplo A→B→A, operado por avaliador | Posições de A não são tratadas como atuais em B; o retorno a A exige nova evidência. Não inferir giro físico pela mudança de pixels. |
| M04 | Movimento contínuo da câmera | Quadros novos, descartes, atraso e estabilidade da interface; não contar FPS de câmera como inferências. |
| M05 | Objeto transitório | Janela de visibilidade, detecção, omissão e fala atrasada após o objeto desaparecer. |
| M06 | Oclusão parcial e reaparecimento | Perda/retorno da evidência, troca indevida de associação e ausência inventada. |
| M07 | Pouca luz e desfoque | Abstenções e erros; não compensar baixa evidência com linguagem confiante. |
| M08 | Rede lenta ou indisponível | Tempo de snapshot Luna separado do processamento local; expirado ou falho não vira fato atual. Usar simulador antes de qualquer ensaio de serviço real. |
| M09 | Voz ocupada ou fala interrompida | Registrar callback de início e conclusão separadamente; interrupção não confirma entrega nem elimina a informação pendente. |
| M10 | Pausa e revogação de consentimento | Captura, worker, envios e agendamentos param conforme política; confirmar ausência de nova observação/envio após parada. |

## Relógios e atualidade

Usar relógio monotônico comum ao navegador para os marcos locais. Para cada evento, registrar `t_evento`, `t_captura`, `t_resposta`, `t_callback_inicio` e `t_audivel` separadamente. O callback da voz do navegador não prova que a pessoa ouviu; a observação audível requer medição independente e consentida. Se não houver medição audível, registrar `não medido`, nunca substituir por callback.

Neste protocolo, classificar snapshots Luna com idade de até **6 s** como atuais para a análise principal e reportar separadamente os de 6–10 s como atrasados para esse protocolo. O teto contratual vigente de snapshot continua sendo **10 s**; não ampliá-lo. Fatos locais só contam como atuais com idade de **até 3 s**. Uma observação vencida não pode sustentar fala atual. Reportar idade na captura e na resposta.

## Registro por evento

Uma linha por evento anotado; ligações entre linhas usam `run_id` e `event_id`. Preencher valores reais ou `não medido`.

| Campo | Valor a registrar |
|---|---|
| Identificação técnica | `run_id`, `event_id`, cenário, versão/hash do código e modelo, perfil/backend, dispositivo, SO, navegador |
| Referência anotada | Classe, setor esperado, início/fim visível, relevância, janela válida, anotadores e divergência |
| Evento→captura | `t_evento`, `t_captura`, delta ms, frame ID, fonte (local/Luna), idade no momento da captura |
| Captura→resposta | `t_resposta`, delta ms, estado (aceita/abstenção/erro/descartada), idade da evidência, motivo de descarte |
| Resposta→callback | `t_callback_inicio`, delta ms; início e fim do áudio do navegador, se disponíveis |
| Callback→audível | `t_audivel` e delta ms obtidos por método independente consentido, ou `não medido` |
| Conteúdo entregue | Referência falada, setor falado, incerteza, texto/transcrição autorizada, completou/interrompeu |
| Julgamento técnico | Acerto, omissão, referência inexistente, classe errada, setor errado, fora da janela, duplicação ou indeterminado |
| Utilidade humana | Entendimento relatado, utilidade percebida, confusão/atraso/repetição, pedido de ajuda; `não avaliado` fora de sessão humana |

Matching entre referência e fala é um para um. Fala duplicada não conta como acerto adicional; setor errado ou fala fora da janela não conta como acerto. Evento relevante sem referência correta é omissão. Referência falada sem evento anotado é falsa referência. Casos indeterminados permanecem visíveis e contam de modo conservador na decisão.

## Métricas e decisão

Calcular separadamente por cenário, classe e perfil, informando `n`, mediana/p50, p95, mínimo/máximo e falhas. Não misturar tempo de Luna com inferência local. Reportar ao menos: evento→captura; captura→resposta; resposta→callback de início; evento→callback; evento→áudio audível quando medido; idade e taxa de descarte; precisão de referências faladas; cobertura dos eventos relevantes; abstenções e falsas referências.

- **CA-H3 (meta):** precisão ≥95% das referências locais faladas; cobertura ≥90% dos eventos relevantes anotados; no máximo uma referência inexistente falada em 10 min estáticos. Reportar denominadores, contagens e erros por classe; a amostra precisa ser suficiente para sustentar a conclusão.
- **CA-H4 (meta):** percepção local no PC de referência p50 ≤150 ms e p95 ≤400 ms; surgimento confirmado até início de voz local p95 ≤1,2 s, com tempo de confirmação, giros/gaps suprimidos e falhas no relatório. Callback não é áudio audível nem cumprimento de CA-D2.
- **CA-H10 (meta):** Luna com captura→resposta e captura→áudio p50/p95, validade, descartes, falhas e uso por sessão. Nenhum tempo de API é garantia de disponibilidade ou qualidade.
- **CA-A4/A5:** só avaliar com participantes cegos/baixa visão conforme protocolo humano do projeto; resultado técnico ou teste com pessoas vendadas não substitui esses critérios.

Velocidade sozinha não aprova fala híbrida. Liberar essa fala somente após benchmark H2 e avaliação temporal H3 demonstrarem qualidade e atualidade no perfil declarado. Se um perfil falhar, manter a capacidade reduzida/snapshots e documentar o limite; não relaxar idade, limiar ou critério para aprová-lo.

**Estado deste documento:** protocolo preparado; nenhuma câmera, participante, API ou teste foi usado. Não há resultado nem decisão de aprovação registrada.
