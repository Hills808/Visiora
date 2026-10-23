## Verificação contínua — ADR-031 (23/10/2026)

O diagnóstico de `OnlineSession` preserva contagens da última sessão Luna após `stop()`. ADR-036 acrescenta `sessionEnd` com motivo categórico e se havia análise pendente antes do cancelamento. O app identifica no JSON que `errors`/`speechCompleted` cobrem a vida da página, enquanto `onlineContinuity` cobre a sessão Luna atual ou anterior. Nenhum pixel, descrição ou resposta bruta é incluído. [Evidência](EVIDENCIAS/LUNA-DIAGNOSTICO-2026-10-23.md).

O ensaio CA-D5 `tests/e2e/stability.mjs` usa um Chrome próprio com vídeo público como câmera artificial, modelos locais reais e voz simulada. Mede memória privada da árvore desse Chrome a cada 30 s, após aquecimento, e exporta somente contagens do diagnóstico. O teste de CA-E3 clona o repositório em pasta nova, instala pelo lockfile, gera o pacote e consulta o servidor em loopback. Os dois roteiros são locais e separados do CI para não consumir 30 minutos nem exigir Windows no runner. [Protocolo e resultados](EVIDENCIAS/ESTABILIDADE-INSTALACAO-2026-10-23.md).

O E2E `tests/e2e/smoke.mjs` e o gate de CI `npm run test:a11y` usam a mesma rotina para verificar botões e selects visíveis com pelo menos 44 px em 390/1440 px, além de axe-core 4.14.0 nas duas larguras. A dependência de teste é local e não entra no pacote do aplicativo. O CI instala somente Chromium headless e não usa câmera ou imagens privadas. A regra automatizada de contraste reforçado segue WCAG AAA e não mede todos os cenários de tema, zoom, leitor de tela ou dispositivo real. [Evidência](EVIDENCIAS/ACESSIBILIDADE-2026-10-23.md).

O workflow de GitHub Actions em `.github/workflows/visiora-web.yml` executa o projeto em `web/` com Node 24 e Python 3.11. Instala pelo `package-lock.json`, roda build e testes Node, checagem estrita de tipos, lint e seis transcrições simuladas. Não usa `.env`, chave ou imagens privadas; E2E de navegador com fixture pública e ensaios físicos são gates separados. [Evidência](EVIDENCIAS/CI-2026-10-23.md).

## Execução local de objetos — ADR-030 (23/10/2026)

`vision/worker.ts` usa o bundle WebGPU do ONNX Runtime Web 1.30.0 no worker de objetos. Depois de verificar os pesos YOLOX Nano/Tiny/S, inicia e aquece as três sessões com WebGPU quando disponível. Falha de inicialização libera as sessões e recria a mesma política em WASM. Se um erro ou prazo excedido interromper a GPU durante a sessão, `Camera` descarta o resultado incompleto de objetos e reinicia uma única vez esse worker em WASM, mantendo a câmera; uma falha da CPU encerra a sessão. O resultado carrega `provider`, exibido como GPU/CPU no status e guardado no diagnóstico. `tools/build.mjs` copia os arquivos de runtime para pacote e cache versionado. O worker independente de ambientes usa WebGPU para SigLIP2 e Places365 quando possível, com aquecimento antes do estado pronto e retorno à CPU em falha. A perda física de GPU ainda precisa de teste CA-H7 em equipamento real. No modo Luna, o pipeline local real permanece desativado. [Ensaio H2 parcial](EVIDENCIAS/H2-PERCEPCAO-LOCAL-2026-10-23.md), [ensaio de ambientes](EVIDENCIAS/CENAS-GPU-2026-10-23.md).

## Memória e comunicação revisadas (19/10/2026)

ADR-026 implementa novidades visíveis antes de ausências, atualizações até 25 palavras e menos repetição por pequenas oscilações de posição/certeza/lugar. Ausência não recebe direção antiga; uma captura que perdeu sua vista não recupera posições por pixels parecidos. Texto/voz só entram no histórico após entrega válida. Memória linguística não é tracking nem um mapa atual; o modelo/API e US$ 2/dia continuam iguais.

[Evidências](EVIDENCIAS/MEMORIA-COMUNICACAO.md): 150 testes e 34 cenários de navegador com fontes artificiais. [Protocolo MC-01](AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](FICHA-AVALIACAO-MEMORIA.csv) preparados, com zero sessões/participantes/avaliações profissionais. Próximo nessa frente: executar sessões consentidas com pessoas cegas e O&M disponíveis, registrar falhas e revisar as hipóteses. H2 e demais gates híbridos continuam pendentes. Build local atualizado; recarregue com Ctrl+Shift+R. Sem API paga, segredo/ledger alterado ou publicação nesta revisão.

## Orçamento vigente: US$ 2 por dia (19/10/2026)

ADR-025 corrige o teto acumulado antigo: o limite é US$ 2 em cada dia de America/Sao_Paulo, renovado à meia-noite, sem teto total do piloto. O histórico permanece; reservas incertas são atribuídas pelo horário original e uma chamada pendente continua bloqueando concorrência. VISIORA_TOTAL_USD foi aposentado e é ignorado. Reinicie o gateway para aplicar (Ctrl+C e npm run dev:luna), depois recarregue a página. Não foi alterado o segredo ou ledger real nem executada chamada paga. As menções anteriores a US$ 2 totais/dia UTC são históricas e sucedidas por esta regra.

## Entrega de fala Luna e atualização do cache — ADR-029 (22/10/2026)

`OnlineSession` distingue uma fala que começou dentro dos dez segundos de validade de uma fala ainda pendente. A primeira pode terminar como descrição histórica se a vista continuar válida; mudança ampla ainda a cancela. Se a fala não começar antes da expiração, `AutoAnalysis` agenda no máximo uma captura nova após 15 s, sem fila, sob os mesmos gates de câmera, saída, consentimento e orçamento. Segunda expiração sem entrega pausa. `Speaker` só confirma `VisualMemory` após início e conclusão válidos. `tools/build.mjs` inclui uma revisão dos arquivos do aplicativo no nome do cache de `sw.js`; a ativação retira o cache antigo. Ver [evidência do reteste](EVIDENCIAS/LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md).

## Luna sem espera por estabilidade — ADR-024 (19/10/2026)

`SnapshotCamera.ready` exige frame recente e assinatura; captura/`AutoAnalysis`/`OnlineSession` já podem trabalhar no primeiro quadro, sem bloqueio por movimento de pixels. Resposta permanece um snapshot até 10 s com idade explícita. Vista estruturalmente ampla em relação à captura retira posições da UI e da fala, inclusive antes/durante entrega; aproveita somente contexto histórico do lugar, sem repetir contexto já confirmado. Pequenas mudanças não invalidam a fala. `VisualMemory` confirma apenas o que foi entregue; `snapshot-speech.ts` agrupa os itens por setor, com direção fixa e incerteza preservada. O bloqueio por giro do cérebro local não mudou.

Cadência, uma API em voo, ausência de fila, disponibilidade da saída, consentimento, conferência de modelo, limites de idade e orçamento permanecem. Movimento pode gerar mais consultas dentro dos tetos. Nenhum detector novo foi ligado: H2/H3 continuam pendentes. [Evidências e limites](EVIDENCIAS/LUNA-MOVIMENTO-FALA.md). Esta seção sucede a política de estabilidade/descarte por qualquer movimento descrita nos blocos históricos abaixo.

## H1 implementada: captura compartilhada no modo Luna (18/10/2026)

ADR-023 inicia a arquitetura da ADR-022. `vision/capture-hub.ts` é o dono único do stream Luna, mantém somente o último quadro e entrega derivados da mesma captura. `snapshot-camera.ts` mantém política de estabilidade/assinatura/JPEG; `perception/frame.ts` define identidade, geração, tempo e transformação. `local-pipeline.ts` opera independentemente de API/voz, com um trabalho em voo e sem fila; `worker-adapter.ts` transfere buffers e cancela/termina o worker. `online-session.ts` integra esse consumidor opcional à mesma captura e expõe apenas diagnóstico numérico. Sem adapter aprovado no app normal, estado local `disabled/model-not-selected`; o fake é exclusivo do teste, sem alimentar fala. Modo local histórico ainda tem seu próprio controlador, usado de forma exclusiva.

CaptureHub prefere callbacks de novos frames, com alternativa baseada em avanço do vídeo; pausa/congelamento não renova a idade de um frame retido. Stamp usa horário de cópia no navegador, não sensor. Fatos locais >3 s e snapshots Luna >10 s continuam rejeitados. Tracking, perfis CPU/GPU, fusão de evidência/narração e gateway compartilhado são futuros. [Evidências H1](EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md). As seções abaixo são históricas; o desenho completo continua parcialmente planejado.

## Evolução planejada: percepção contínua portátil (18/10/2026)

[PLANO-PERCEPCAO-CONTINUA.md](PLANO-PERCEPCAO-CONTINUA.md), ADR-022, define uma câmera compartilhada, percepção em worker, associação temporal no cérebro e contexto Luna assíncrono, com evidência e idade separadas. Perfis CPU/GPU/reduzido dependem de testes reais. Gateway compartilhado e orçamento único entre PCs são uma fase futura. **Esse desenho não está implementado**; o estado executável continua na ADR-021 abaixo.

## Continuidade revisada no piloto local (18/10/2026)

ADR-021 sucede os parâmetros do primeiro automático: intervalo mínimo de 4,5 s, gatilho por blocos para mudanças localizadas, orientação após mudança ampla de vista e aviso qualificado quando uma pessoa deixa de ser identificada, mesmo com móveis iguais. Respostas cuja imagem mudou durante a consulta são descartadas. Uma falha temporária conhecida permite uma nova captura após pelo menos 15 s; segunda falha consecutiva pausa. Erros de orçamento, credencial, consentimento, modelo ou contrato pausam sem recuperação. Consentimento `cloud-v3-continuity`. Preservados US$ 2/dia, US$ 2 totais, reserva e histórico. Nenhuma chamada paga feita pelo agente para testar esta mudança. Guia: [ACOMPANHAMENTO-AUTOMATICO.md](ACOMPANHAMENTO-AUTOMATICO.md); evidência: [LUNA-CONTINUIDADE.md](EVIDENCIAS/LUNA-CONTINUIDADE.md). Publicado continua 0.3; os blocos anteriores abaixo são históricos.

## Fluxo automático do piloto local (18/10/2026)

`auto-analysis.ts` agenda primeira captura e novidades por impressão RGB local, com estabilidade, intervalo de 12 s, uma análise em voo e pausa após falha. `online-session.ts` coordena revogação, geração, validade e descrição que aguarda o fechamento de ajustes. `visual-memory.ts` compara grupos nome/setor/incerteza/contagem e confirma somente após saída; muda a hipótese de lugar sem catálogo nem fusão com World atual. Movimento invalida o quadro e a fala, preserva memória rotulada e força nova captura após o intervalo. Prompt prioriza passagens visíveis sem garantir saída. Consentimento `cloud-v2-auto`, tetos/reservas/modelo no servidor. Nenhuma modificação de esquema da evidência ou dependência nova. Detalhes e limites: ADR-020 e `ACOMPANHAMENTO-AUTOMATICO.md`. O restante deste documento inclui estados históricos anteriores do piloto.

## Conferência do modelo no gateway local (18/10/2026)

`server/provider.mjs` confere `model` no envelope da API por `response-model.mjs`. O gateway grava metadados limitados em `model_responses` no SQLite e evento JSON `visiora_model_response` no terminal antes de aceitar evidências. Somente `gpt-6-luna` exato é aceito; ausência, valor inválido ou divergência bloqueiam a descrição e preservam a reserva. Erros/recusas também guardam o campo disponível; rede sem resposta não produz confirmação. A tabela nova preserva as consultas/gastos anteriores, que permanecem sem prova retroativa. O comando `npm run luna:models` consulta os registros em modo somente leitura. Não há mudança no contrato de observações nem no texto da narração. ADR-019 detalha política e limites; esta atualização segue local e não publicada.

## Incremento local Luna (18/10/2026, não publicado)

Nova fatia câmera→gateway→evidência aberta→VisualMemory→Speaker. Contratos em `src/perception/`, captura/sessão/cliente em `src/vision/`, gateway loopback ESM em `server/`, prompt/schema versionados em `prompts/` e `schemas/`. Tudo Luna é snapshot com idade, separado de World/Scene atuais; sem análise automática paga. SQLite local mantém reserva/uso sem imagens. Detalhes: ADR-017, [CONFIGURAR-LUNA.md](CONFIGURAR-LUNA.md) e [evidências](EVIDENCIAS/LUNA-INTEGRACAO-LOCAL.md). O desenho abaixo continua descrevendo o modo local 0.3.

# Arquitetura atual - 0.3.0

Aplicação estática TypeScript estrito, sem backend remoto obrigatório. `app.ts` coordena sessão; `ui/` renderiza texto sem HTML vindo dos modelos. `config.ts` reúne limiares experimentais.

`vision/camera.ts` solicita vídeo sem áudio, congela uma captura em canvas e alimenta **dois workers independentes**, com um quadro em voo por worker e sem fila crescente. Objetos: três inferências sequenciais YOLOX Nano/Tiny/S, BGR bruto, letterbox superior esquerdo 114, entradas 416/416/640. Há aquecimento por modelo antes de iniciar os quadros. `person-consensus.ts` exige duas redes com caixas compatíveis para pessoas; demais classes mantêm Nano. Propostas mapeadas não são truncadas antes da fusão; NMS por classe e limite global de 30 só depois. Dois modelos correlacionados ainda podem concordar em erro.

Ambientes: SigLIP2 q4 e Places365 F32 (`scene-worker.ts`/`scene-model.ts`) recebem a mesma imagem inteira RGB 224×224, sem recorte central ou de objetos. Sig usa -1..1; Places usa a normalização ImageNet. Nenhum recebe objetos do detector. Cenas são amostradas quando há pelo menos 2 s desde a última captura e sem mudança visual forte; a duração dos objetos pode espaçar mais as amostras. Isso não mede pose ou velocidade angular.

O encoder q4 mantém os mesmos vetores textuais offline (80 categorias e 8 rejeições). `scene-consensus.ts` compara a família do TOP1 Places com os três primeiros candidatos Sig: cosseno ≥0,12 e diferença ao primeiro ≤0,015, Places ≥0,30 e margem para outra família ≥0,15. Primeiro Sig de rejeição sempre impede aprovação. Há 34 nomes canônicos compatíveis. Só subtipos semânticos predeclarados são agrupados; nenhuma associação de objetos a ambientes. A regra é a política final medida, sem união/fallback para respostas isoladas do Sig. Não é análise aberta nem probabilidade de acerto calibrada.

`model-assets.ts` valida tamanho, caminhos e SHA-256 das partes, reconstrução e dados auxiliares. Falha de cenas libera sessões, informa erro, permite nova tentativa e mantém objetos ativos. Falha em qualquer detector encerra a câmera com aviso, sem enfraquecer a verificação silenciosamente.

Cada resultado traz fonte, ID e instante da captura. `brain/scene.ts` exige duas imagens aceitas da mesma categoria, com pelo menos 1,8 s entre elas, e expira a evidência após 6,5 s. `brain.ts` recebe o resultado assíncrono separadamente, descarta capturas com mais de 3 s ou anteriores à estabilização e bloqueia durante movimento. Nenhum objeto isolado determina o lugar. `sim/scenarios.ts` fornece classificação explicitamente simulada pelo mesmo contrato.

`brain/world.ts` associa entidades e preserva ID/instante de captura; `brain.ts` planeja fala; `realizer.ts` usa frases por setor e `lexicon.ts`. O cérebro não importa ONNX. Tempo e observações são entradas testáveis. Antes de iniciar uma fala, confere se suas entidades ainda estão visíveis no mesmo setor e se o lugar se mantém. Consulta explícita descartada volta ao planejamento; memória antiga explicitamente anunciada continua permitida. Local novo é anunciado uma vez, confirmado após término da saída. Interrupções voltam ao planejamento com fatos atuais.

`diagnostics.ts` guarda apenas IDs e tempos dos quadros e da descrição. O diagnóstico exportado não inclui pixels, nomes, rankings ou texto falado. A legenda informa a idade da descrição; esse contador não é aria-live e não gera fala periódica.

`output/speaker.ts` filtra vozes locais pt-BR e invalida callbacks antigos. Callback de término não demonstra áudio audível. Leitor de tela recebe respostas sob demanda, sem confirmação fictícia.

`storage.ts` guarda preferências e histórico opcional limitado. Nenhuma imagem entra no armazenamento implementado. `public/sw.js` oferece cache explícito de arquivos estáticos. `download-worker.ts` monta ZIP com fflate a partir da lista do build, sem quadros ou histórico. `tools/package_local.py` gera pacote em `artifacts/visiora-local.zip`. Servidor incluído escuta em 127.0.0.1, sem upload.

Sites mantém a identidade em `.openai/hosting.json` e publica `dist`. Sem profundidade métrica, mapa com pose real, alertas utilizáveis, OCR ou VLM generativo. As latências medidas excedem CA-D1; separar workers evita uma fila única, mas não comprova a meta nem prazo até a fala.

## Adendo de planejamento — Luna 6

A migração futura está em [PLANO-MIGRACAO-LUNA-6.md](PLANO-MIGRACAO-LUNA-6.md), com escopo registrado na ADR-016 de [DECISOES.md](DECISOES.md). Leia [RETOMADA-LUNA-6.md](RETOMADA-LUNA-6.md) antes de continuar. Este adendo não altera o funcionamento publicado, não substitui evidências dos critérios de aceite e não autoriza chamadas pagas ou envio de imagens.
# Hospedagem da apresentação (23/10/2026)

O site público serve apenas os arquivos estáticos de `dist` por HTTPS. A câmera, os workers ONNX, os pesos e a voz rodam no navegador do visitante; imagens não passam pelo host no modo local. O endpoint `/api/vision/*` não existe nessa hospedagem, portanto Luna informa gateway indisponível. O gateway com chave e ledger continua apenas no ambiente local configurado. O seletor inicia em Modelos locais para evitar escolher por engano um serviço ausente.

Para respeitar o limite de 25 MiB por arquivo do host, o build grava o runtime WebAssembly asyncify como gzip e um manifesto com bytes/SHA-256. Os dois workers o descomprimem e verificam antes de chamar o ONNX Runtime. O pacote local e o cache offline incluem esses arquivos compactados.

O pacote portátil Luna para Windows x64 usa os mesmos `dist/`, `server/`, `prompts/` e `schemas/` e acrescenta um Node.js oficial com hash verificado. O gateway continua em loopback com SQLite local. `.env` e `.runtime/luna-budget.sqlite` são transferidos separadamente pelo proprietário, fora do ZIP e do Git; o preflight exige Luna pronto e teto de US$ 2/dia. Não existe sincronização de orçamento entre dois gateways ativos.
## Luna hospedado privado — ADR-039 (23/10/2026)

`hosting/luna/` monta uma variante do mesmo cliente web sem pesos locais e publica `/api/vision/status` e `/api/vision/analyze` no Worker do Site privado. O despacho da hospedagem exige login; as rotas exigem identidade, origem, token CSRF e consentimento antes de aceitar JPEG. O Worker chama a Responses API com `store:false`, confere o identificador `gpt-6-luna` devolvido e valida a evidência estruturada. D1 mantém apenas ID, horário, dia de São Paulo, reserva/custo, estado, uso e modelo; nenhuma imagem ou fala. Uma inserção SQL condicional faz a reserva de modo atômico entre aparelhos. Reserva incerta permanece até revisão manual. O modo público local e o gateway Node/SQLite continuam em código separado; o gateway local está desativado enquanto o Site usa o teto de US$ 2/dia. [Evidência](EVIDENCIAS/LUNA-CELULAR-HOSPEDADO-2026-10-23.md).
