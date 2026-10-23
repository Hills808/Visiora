# Auditoria de continuidade — 22/10/2026

Escopo: leitura do checkout de trabalho do Visiora, verificação local de testes e definição da próxima fatia. Nenhum comportamento do app foi alterado. O checkout já continha numerosas alterações não consolidadas; esta auditoria preservou todas. As conclusões sobre código são estáticas quando não há teste de reprodução indicado.

## Rastro de orquestração desta auditoria

| Etapa | Agente e modelo solicitado na chamada de colaboração | Trabalho | Saída usada | Limite da prova |
| --- | --- | --- | --- | --- |
| A1 | `/root/documentos_h2` — `gpt-6-luna` | Plano, ADRs, evidências e pendências H2 | Estado H1/H2, critérios CA-H* e tensões documentais | A chamada da conversa registra o modelo **solicitado**; este chat não expõe confirmação do backend nem tokens por agente. |
| A2 | `/root/codigo_auditoria` — `gpt-6.1-sol` | Código de captura/pipeline, integração e testes | Riscos de medição, adaptação do worker e isolamento | Mesma limitação de confirmação e custo da etapa A1. |
| A3 | Coordenador desta conversa — modelo não atestado neste relatório | Conferência de linhas, execução de verificadores, reconciliação e decisão | Este relatório | Não atribuir um modelo não confirmado à redação final. |

Nenhum Astra foi solicitado: os dois pareceres concordaram sobre o gate seguinte e não surgiu decisão técnica crítica que exigisse outra revisão. Os agentes não editaram arquivos nem invocaram API paga. O custo monetário e os tokens deste chat não estão disponíveis aqui; não há alegação de economia medida.

## Estado verificado

- H1 implementou `CaptureHub` e o consumidor local independente com fake; o detector novo não fornece fatos para fala no modo Luna. Ver [evidência H1](H1-CAPTURA-COMPARTILHADA.md) e `src/vision/online-session.ts:130-134`.
- ADR-024 permite análise desde quadro recente mesmo com movimento; ADR-026 reduziu repetição de snapshots em lógica testada. Isso não comprova caminhada ou utilidade real. Ver [retomada](../RETOMADA-LUNA-6.md) e [memória](MEMORIA-COMUNICACAO.md).
- O limite vigente do gateway Luna é US$ 2 por dia em `America/Sao_Paulo`, sem teto total, conforme ADR-025. Esta auditoria não consultou o ledger real nem fez chamadas pagas.
- O [conjunto brasileiro](../CONJUNTO-DE-TESTE.md) ainda declara 0/30 cenas reais; H2 não pode ser aprovado por qualidade brasileira com os fixtures atuais.

## Achados técnicos por prioridade

1. **Métrica incompleta para H2 — confirmado por código.** `src/perception/local-pipeline.ts:113-121` adiciona a `latencyMs` somente resultados aceitos. Resultados lentos descartados e falhas ficam fora dessa amostra. Esse vetor não pode ser usado sozinho como p95 do pipeline; a bancada deve registrar toda tentativa e seus desfechos, além de tempos por etapa e denominadores.
2. **Worker histórico exige adaptação — confirmado por contrato.** `src/vision/worker.ts` recebe `init/frame` com dois buffers e metadados de caixa; `src/perception/worker-adapter.ts` espera resultado de `LocalFrame`. Ligar um ao outro diretamente falharia no protocolo. A bancada H2 deve ter um bridge testado, preservando pré-processamento, geometria e a confirmação de pessoas do baseline.
3. **Falha de consumidor pode encerrar captura — risco confirmado por leitura.** `src/vision/capture-hub.ts:147-152` coloca callbacks de todos os consumidores no mesmo `try` do desenho; exceção síncrona chama `ended()`. O consumidor atual trata seus erros internamente, então não foi demonstrada falha no uso normal. Testar isolamento antes de adicionar consumidores H2.
4. **Timeout depende do adapter — risco de contrato.** `src/perception/local-pipeline.ts:102-106` aborta o sinal, mas aguarda a promessa de `analyze`. O adapter atual reage ao cancelamento; outro que ignore o sinal pode manter a vaga ocupada. Incluir caso não cooperativo no gate de robustez.

## Próximo passo separado em entregas

**H2.1 — bancada do baseline no worker, sem fala nova.** Congelar versão/hash/licença do modelo, computador, navegador, provider, threads, entradas e denominadores. Adaptar o worker com testes de protocolo e caixas. Registrar cada tentativa: carga, cópia, transferência, inferência, idade ao receber, erro/descarte, uso de memória disponível e atraso da interface. Testar com insumos públicos conhecidos para provar a bancada; isso ainda não aprova qualidade. Critérios: CA-H2/H3/H4 e CA-D1/D4.

**H2.2–H2.4 — comparação justa.** Anotar vídeos independentes com eventos e setores, manter desenvolvimento separado de confirmação e comparar baseline com no máximo duas alternativas no mesmo conjunto. Medir p50/p95, omissões, falsos e abstenções por classe em perfis CPU/GPU/reduzido; testar falhas, troca de provider e 30 minutos nas combinações que se queira declarar compatíveis. Critérios: CA-H3/H4/H6/H7, CA-P3, CA-D5.

**H2.5 — decisão do gate.** Só escolher detector/perfil para H3 após qualidade, atualidade e atraso medidos. Se nenhum passar, manter snapshots Luna e registrar limitação. Não habilitar fala local por resultado fake ou tempo médio isolado. O ensaio com pessoas cegas/O&M e CA-A4/A5 permanecem uma frente separada e pendente.

## Verificações executadas nesta auditoria

- `node --test` com todos os `*.test.mjs` de `tests/`: **156/156 passaram**.
- `node node_modules/typescript/bin/tsc --noEmit`: passou.
- `node tools/check.mjs`: passou.
- `node tools/simulate.mjs`: seis cenas emitiram transcrições; não houve comparação formal de snapshots nesta auditoria.

Não executados: build/empacotamento novo, E2E de navegador, API real, webcam/voz física, benchmark de modelo, medição de RAM/p95 em hardware real, avaliação humana e publicação. Os testes fake verificam transporte e regras; não provam precisão visual ou segurança.

## Pendências de documentação

Trechos históricos ainda citam teto total de US$ 2 e espera por estabilidade do Luna. ADR-025 e ADR-024 os sucedem, respectivamente. Antes de reutilizar esses trechos como instrução operacional, marcá-los expressamente como históricos em `docs/DECISOES.md` e `docs/PLANO-PERCEPCAO-CONTINUA.md`.
