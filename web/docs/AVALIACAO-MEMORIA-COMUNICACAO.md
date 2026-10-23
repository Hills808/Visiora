# Avaliação da memória e da comunicação do Visiora

Protocolo MC-01, 19/10/2026, São Paulo. **Preparado; nenhuma sessão realizada, nenhum participante recrutado pelo agente.** Mudanças implementadas na ADR-026. Não declarar utilidade, segurança ou acessibilidade validada a partir dos testes artificiais.

## Objetivo e decisões a avaliar

Descobrir se a pessoa compreende o ambiente e as mudanças com menos repetição, sem confundir uma descrição antiga com uma posição atual. As prioridades e os limiares atuais são hipóteses: novidades visíveis antes de ausências; itens confirmados antes de incertos; até três grupos; briefing até 45 palavras e atualizações até 25, incluindo a idade da imagem. Não concluir que esses padrões atendem todos os usuários antes de ouvi-los.

No Luna, direções se referem à câmera. Explicar e demonstrar o alinhamento do equipamento com a pessoa antes de comparar compreensão. Sem mapa 360°, identidade de pessoas, distância ou rota. A memória linguística não é rastreamento: dizer “há uma pessoa à direita” não prova ser a mesma pessoa vista antes.

## Participantes e preparação

1. Rodada formativa: cinco ou mais adultos cegos/com baixa visão e um ou dois profissionais de Orientação e Mobilidade. Buscar diferentes experiências com leitores de tela e tipos de deficiência visual; perguntar apenas o necessário, sem exigir diagnóstico clínico.
2. Rodada de aceite posterior: pelo menos oito participantes cegos/com baixa visão, após revisar os problemas formativos. Registrar experiência prévia no piloto. Profissionais não substituem os usuários na contagem de CA-A4/A5; a opinião de um usuário não representa toda a população.
3. Participação voluntária, explicação acessível da finalidade, possibilidade de interromper/desistir e autorização específica para qualquer gravação. Por padrão, registrar só código do participante, observações mínimas e transcrições autorizadas; sem nomes, fotos, vídeo, áudio ou dados clínicos em Git. Decidir retenção/exclusão com os participantes antes de coletar. A ficha fornecida está vazia.
4. Preparar local conhecido, assento, acompanhante/instrutor, computador/câmera e saída escolhida pelo participante. Testar volume e leitor de tela; oferecer pausas. A pessoa não será guiada a caminhar, não será vendada e não terá que encontrar obstáculos, escadas ou riscos. Nenhum convite ou contato é enviado por este protocolo.

## Sessão proposta: aproximadamente 45 minutos

| Tempo | Atividade | Registro |
| --- | --- | --- |
| 0–5 min | Explicação, concordância em participar e escolha de saída/volume | Preferências e recursos de acesso necessários |
| 5–10 min | Perguntar como costuma reconhecer um ambiente e quais mudanças gostaria de ouvir | Vocabulário, prioridades e desconfortos, sem sugerir respostas |
| 10–20 min | Comparar trechos de fala antigos e novos dos mesmos eventos simulados | Compreensão, repetição e preferência justificada |
| 20–35 min | Uso contínuo por 15 min, com pessoa sentada e cenas controladas | Erros, pedidos de repetição, ajuda necessária e cansaço |
| 35–45 min | Perguntas finais e sugestões | Notas, preferência e decisão de corrigir/retestar |

Se houver cansaço, parar antes de terminar e registrar o motivo; não excluir o resultado para melhorar a média. Uma sessão interrompida não comprova conforto por 15 min.

## Comparação de fala

Congelar a versão do código e as transcrições antes de começar. A referência anterior está nos relatórios de [movimento](EVIDENCIAS/luna-movimento/movement-e2e.json) e [continuidade](EVIDENCIAS/luna-movimento/continuity-e2e.json); os trechos novos serão gerados por `node tools/simulate-memory.mjs`. Ambos são cenários artificiais e devem ser apresentados como tal.

Usar os mesmos fatos de entrada, voz, velocidade e volume para A e B. Alternar a ordem entre participantes e usar rótulos A/B; não apresentar a versão nova como “melhor”. Não comparar uma voz humana expressiva com uma voz sintética diferente. O facilitador pode reproduzir ou ler fielmente o texto de ambos, registrando qual método usou. A preferência por trechos não comprova reconhecimento de câmera.

Separar o resultado de texto/planejamento do resultado de API/visão: registrar a evidência realmente retornada e a fala selecionada. Se o modelo não identificar o item no ensaio real, registrar falha de percepção; não corrigir a resposta durante a tarefa e contá-la como acerto do sistema.

## Cenários controlados e perguntas neutras

| ID | Evento | O que observar | Pergunta após ouvir |
| --- | --- | --- | --- |
| MC-01 | Primeira vista de um ambiente consentido | Poucas referências, hipótese de lugar e direção compreendidas | “Como você descreveria esse espaço com o que ouviu?” |
| MC-02 | Vista parada por cinco minutos | Silêncio sem repetição; compreensão do estado ativo | “Esse silêncio lhe informou o suficiente? O que faltou?” |
| MC-03 | Um item novo aparece e uma pessoa deixa o enquadramento | Utilidade da novidade antes da ausência; ausência não entendida como saída física | “O que mudou? O que você consegue concluir sobre a pessoa?” |
| MC-04 | Pequena oscilação da câmera perto de um limite de setor | A tolerância reduz repetição sem esconder uma mudança que seria útil | “Você sentiu falta de alguma atualização de posição?” |
| MC-05 | Câmera muda amplamente de vista e retorna | Nenhuma posição da captura invalidada reaparece como atual; reorientação com captura nova | “Quais informações ainda servem para a vista atual?” |
| MC-06 | Hipóteses de lugar alternam em duas capturas | Confirmação evita troca de nome cansativa; observar se esperar atrapalha | “O que você entendeu sobre o tipo de lugar e a certeza da resposta?” |
| MC-07 | Voz é interrompida ou começa tarde | Entrega parcial não conta como completa; texto e histórico coerentes | “O que deu tempo de compreender? Que informação precisaria ouvir outra vez?” |
| MC-08 | Câmera deixa de fornecer quadros ou a captura expira | Posições retiradas da lista; não interpretar silêncio como acompanhamento garantido | “Como você percebeu que a informação deixou de ser recente?” |
| MC-09 | Leitor de tela, perguntas opcionais e repetição explícita | Evitar duas vozes; repetição identificada como memória da captura | “De que momento é essa descrição? Como você pediria outra?” |

Falhas artificiais controladas podem usar o simulador/transportes fake, sempre identificados. Não provocar gastos ou falhas reais de serviço para reproduzir o cenário. Não enviar imagens de participantes para nuvem sem autorização específica e orçamento disponível.

## Medidas e decisão

Usar a [ficha vazia](FICHA-AVALIACAO-MEMORIA.csv), por participante/cenário/versão. Registrar a fala efetiva, conclusão da voz, idade da evidência, interpretação em palavras da pessoa, informação repetida sem mudança, pedidos de repetição, ajuda do facilitador e incidentes. Tempo até falar é medição separada; o usuário não deve ter que cronometrar.

Perguntas finais de 1 a 5: “As falas evitaram repetição desnecessária”; “Entendi onde estavam as referências descritas”; “As informações escolhidas foram úteis”. Perguntar também se usaria novamente e se houve dor de cabeça ou cansaço, quando começou e ao que atribui. São perguntas do projeto, **não um questionário SUS validado**. Permitir resposta oral e comentário livre.

| Critério | Decisão de aceite posterior |
| --- | --- |
| CA-F1/F4/F6/F7/L4 | Auditar repetições, limites de fala, interrupções e idade; mostrar exemplos e falhas, sem apenas uma nota média |
| CA-A4 | Com ≥8 participantes: ≥80% iniciam/usam sem ajuda após 2 min de instrução; médias ≥4/5 em repetição e clareza; ≥75% usariam novamente. Mostrar numerador/denominador e desistências; 6/8 não é 80% |
| CA-A5 | Nenhum participante atribui dor de cabeça/cansaço à repetição em 15 min. Se houver, registrar falha e revisar; não compensar com média dos demais |
| CA-A2 | Fluxo em NVDA, VoiceOver e TalkBack exige seus ensaios reais próprios; uma sessão num navegador não cobre os três |
| CA-H11 | Profissionais e usuários revisam utilidade/prioridades; registrar divergências, mudanças escolhidas e o que permanece incerto |

Erros de compreensão que façam posições antigas parecerem atuais têm prioridade de correção. Revisar a política de fala com os exemplos antes de ajustar limiares. Se o problema for percepção ou falta de atualidade, tratá-lo como tal; não mascarar com um texto mais confiante.

## Referência metodológica e estado

O W3C/WAI recomenda envolver pessoas com deficiência na avaliação e combinar sua participação com avaliação de conformidade, explicitando o alcance da amostra: [Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/), consultado em 19/10/2026. Essa orientação não fornece prova de que nossas frases ou limiares sejam adequados; são hipóteses do Visiora a testar conforme este protocolo.

**Estado: 0 sessões, 0 participantes, 0 avaliações profissionais.** Para executar a parte humana, faltam participantes e profissional de O&M disponíveis, local/horário acordados e consentimento. Nenhum resultado foi preenchido por simulação ou inventado.
