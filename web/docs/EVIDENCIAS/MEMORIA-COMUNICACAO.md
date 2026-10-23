# Memória e comunicação — ADR-026

19/10/2026, São Paulo. O usuário priorizou novidades úteis, menos repetição, retirada de posições antigas e avaliação com pessoas cegas/profissionais de Orientação e Mobilidade. **Implementação local testada com fontes artificiais; avaliação humana preparada, ainda não executada.**

## Mudança entregue

`SnapshotDiscourse` separa memória linguística da evidência e do realizador `VisualMemory`. Grupos guardam horário de última observação e entrega; referências não vistas por mais de 30 s são retiradas. Ver uma referência novamente renova a observação, não a transforma automaticamente em fala entregue. Silêncio para referências já ditas e novamente observadas; nenhuma idade de snapshot é renovada por memória, repetição ou pergunta no mesmo frame.

A seleção mantém a ordem de utilidade dada pelo provedor dentro de dois grupos: referências atuais confirmadas antes das incertas; depois ausências. Não usa um catálogo de ambientes nem regras nome→lugar ou nome→prioridade. Até três grupos. Briefing/reorientação até 45 palavras; atualizações até 25, incluindo fonte e idade, calculadas com o prefixo real. Conteúdo selecionado só entra como entregue após voz concluída/texto disponibilizado. Ausências que não cabem após uma novidade entregue são retiradas da memória de referências, sem ficar numa fila de lembretes atrasados; isso não equivale a dizer que a ausência foi falada.

Ausência não recebe direção da caixa antiga: “Não identifiquei pessoas nesta captura.” Não significa que alguém saiu. Objetos repetidos do mesmo grupo usam “mais de uma cadeira”, sem pluralizar nomes abertos por regras frágeis. Pessoas continuam com contagem aproximada, sem identidade.

Pequena oscilação de caixa não repete direção: margem experimental de 5° em torno do limite de setor. Uma mudança significativa ainda usa a direção fixa derivada da nova caixa. Oscilação de certeza não reapresenta referência anteriormente dita com certeza; confirmação de referência antes incerta pode ser narrada. Nomes são normalizados por acento, caixa e espaços, sem inventar equivalência semântica entre sinônimos.

Troca do nome do lugar na mesma vista exige duas capturas distintas recentes, no máximo 30 s entre elas. Repetir consulta sobre um frame não confirma lugar. Primeiro briefing, primeira hipótese após lugar desconhecido e vista amplamente nova não esperam essa confirmação. Uma omissão isolada do lugar não apaga uma hipótese conhecida nem força um novo briefing; a UI continua mostrando apenas a hipótese da captura, que pode divergir da memória de fala durante confirmação.

`SnapshotView` acompanha a captura aceita e a que está em análise. Uma mudança ampla invalida suas posições permanentemente; retornar a pixels parecidos não as recupera. É necessária uma nova captura para falar posições. A memória de referências é retirada nessa transição. A lista também retira posições após validade de 10 s ou falta de quadro recente. Voz direcional é revalidada antes e durante entrega; callback de início após TTL de 4 s é rejeitado. Interrupção/conclusão inválida não entram como entrega nem no histórico da aplicação. Repetição explicitamente solicitada permanece memória da imagem, com idade.

## Resultados executados

| Verificação | Resultado / registro | Alcance |
| --- | --- | --- |
| Build seguido da mesma suíte do `npm test` (`node --test`, cobertura do cérebro) | **150 passaram, 0 falharam**; [saída](memoria-comunicacao/tests.txt) | 15 novos testes específicos; regressões existentes |
| Tipos, lint e formatação TS/MJS/HTML | Passaram; [tipos](memoria-comunicacao/types.txt), [lint](memoria-comunicacao/lint.txt), [formatação](memoria-comunicacao/format.txt) | Código verificado, sem instalar dependência |
| Simulador local histórico | Seis transcrições iguais à H1; [saída](memoria-comunicacao/simulator.txt) | Sem alteração de comportamento do cérebro local |
| `node tools/simulate-memory.mjs` | Seis cenários novos; [transcrições](memoria-comunicacao/memory-transcripts.txt) | Novidade/ausência, setor, lugar, certeza, nova vista e agrupamento |
| `node tests/e2e/luna.mjs` | **10 cenários**; [relatório](memoria-comunicacao/luna-e2e.json) | Fluxo completo, procura, repetição, diálogo, erro e layout 390 px |
| `node tests/e2e/luna-continuity.mjs` | **8 cenários**; [relatório](memoria-comunicacao/continuity-e2e.json) | Não identificação, silêncio, reorientação e recuperação |
| `node tests/e2e/luna-movement.mjs` | **9 cenários**; [relatório](memoria-comunicacao/movement-e2e.json) | Inclui mudança ampla + retorno durante API e callback de voz atrasado |
| `node tests/e2e/hybrid-capture.mjs` | **7 cenários**; [relatório](memoria-comunicacao/hybrid-e2e.json) | Captura/worker concorrentes, expiração, revogação e parada |

Total: **150 testes e 34 cenários de navegador**. Chrome headless reportou 155.0.8059.85 no ensaio híbrido. Gateway fake próprio em loopback, SQLite em memória, vídeo público de QA e voz controlada. Nenhuma chave lida, chamada paga, imagem privada enviada, alteração de ledger real ou publicação. A cobertura relatada é somente do cérebro, não da percepção física. Não se repetiu a suíte smoke local nesta fatia; sua evidência anterior permanece histórica.

Na regressão inicial, o teste de continuidade avançava o relógio artificial após receber a resposta, antes de concluir a voz; a nova revalidação retirava corretamente essa entrega antiga. O teste passou a aguardar a fala efetiva antes de avançar. Outra execução revelou ausência omitida pelo novo limite curto aparecendo só na captura seguinte: a política foi corrigida para retirar essas referências sem backlog após a novidade entregue. Foram mantidos os limites de validade e tempo; não se aumentou timeout para aprovar testes. Expectativas antigas foram atualizadas conscientemente para ausência sem direção, confirmação de lugar e preferência pela novidade dentro de 25 palavras.

## Exemplos do simulador

Após uma referência nova e pessoa não identificada: “Na imagem capturada há 1 segundo: À sua frente, à direita, há uma mesa. Não identifiquei pessoas nesta captura.” O simulador acrescenta identificação de fonte artificial; a captura seguinte igual ficou em silêncio.

Perto de um limite de setor, três pequenas oscilações ficaram em silêncio; a mudança maior produziu a direção nova. Na sequência de nomes escritório → biblioteca → escritório → biblioteca → biblioteca, houve fala inicial e uma troca de hipótese após a confirmação final. Esses são testes de decisão com rótulos artificiais, não prova de reconhecimento do ambiente ou deslocamento físico.

## Relação com critérios

| Critério | Demonstrado nesta fatia | Pendente |
| --- | --- | --- |
| CA-F1/F4/F7 | Silêncio em cinco minutos artificiais; novidade, tolerância de setor, certeza, memória e limites de fala | Repetição/conforto com vídeo e participantes reais |
| CA-F3/P6/L4 | Direção só em evidência localizada válida; ausência sem direção antiga; sem distância; vista invalidada não revive | Precisão de caixas, mudança ampla e idade física do sensor |
| CA-F6/H2 | Entrega inválida/interrompida não confirma referência nem histórico; quadro não é renovado por pergunta | Áudio real, leitor físico e compreensão de fala parcial |
| CA-F9 | Nome do lugar estabilizado por capturas distintas, sem catálogo ou dedução por objetos | Qualidade/latência semântica da API e adequação da regra |
| CA-A4/A5/H11 | [Protocolo MC-01](../AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](../FICHA-AVALIACAO-MEMORIA.csv) preparados | **0 sessões, 0 participantes, 0 profissionais avaliando**; nenhum aceite humano |

## Limites e próxima avaliação

A prioridade por certeza, a margem de 5°, as duas capturas e os 30 s são hipóteses a avaliar. Podem omitir uma atualização útil ou atrasar uma mudança de lugar. Não há correspondência de instâncias nem sinônimos: pessoas/objetos com mesmo nome/setor podem ser confundidos; nomes diferentes para o mesmo item ainda podem repetir. A fala continua descrevendo capturas espaçadas com atraso. Mudança de pixels não mede movimento corporal; pequenas mudanças podem preservar direções que já mudaram no mundo, sempre qualificadas como da captura.

Não testados: uso por pessoas cegas/baixa visão/O&M, caminhada e câmera física, voz audível/leitores reais, API paga/latência/fatura, outras máquinas/SOs, detector local real no Luna, movimento/oclusão/baixa luz reais, sessões prolongadas/RAM/bateria, publicação ou quota compartilhada. Não afirmar validação de acessibilidade, precisão, rastreamento de pessoas, tempo real ou segurança.

Próxima parte humana: executar MC-01 em local consentido, com participantes e profissional disponíveis. O agente não recrutou nem contatou ninguém. H2 de reconhecimento e as fases híbridas de associação/fusão continuam pendentes; esta entrega é a memória de discurso das capturas, não a implementação completa de H3/H4.
