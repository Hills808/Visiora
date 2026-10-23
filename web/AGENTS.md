# AGENTS.md — Visiora

Este arquivo é lido automaticamente pelo agente (Codex no VS Code e na CLI) quando o repositório é aberto. Mantenha-o curto; o detalhe está em `docs/`.

## 0. Antes de qualquer tarefa (obrigatório)

1. Leia `docs/PLANO-COMPLETO-VISIORA.md` inteiro na primeira vez na sessão. Nas seguintes, releia as seções 0, 7, 9 e 11 e a seção do épico atual.
2. Leia `docs/LIMITES.md` e `docs/DECISOES.md` (se existir).
3. Escreva 5 linhas antes de codar: quem usa, em que situação, o que ouve, o que NÃO pode acontecer, como vou provar que ficou bom.
4. Se a tarefa pedida contradiz o objetivo do produto, **o objetivo vence**. Registre a divergência em `docs/DECISOES.md` e avise o usuário.
5. Em dúvida real que muda o resultado, pergunte uma vez, de forma curta. Em dúvida pequena, escolha o padrão do plano e diga o que escolheu.

## 1. O produto em três linhas

Ambientação por voz em pt-BR para pessoas cegas ou com baixa visão: forma um mapa mental do ambiente e fala de modo natural e direcional ("à sua direita, a uns cinco passos, uma cadeira"). Fala pouco, certo e na hora certa; silêncio é o estado normal. Não garante segurança e não substitui bengala nem cão-guia.

## 2. Regras de fala (nunca violar)

- Nunca dizer "possível obstáculo", "objeto não identificado" nem listar rótulos sem direção.
- Direção sempre relativa ao usuário, com **uma frase fixa por setor**. Distância em passos, só se a profundidade for conhecida; nunca inventar distância.
- Não repetir o que já foi dito sem mudança material (entidade nova, aproximação real ≤ 60% da distância dita, ou pedido do usuário).
- Um item só conta como "dito" depois que a voz de fato falou; fala expirada ou interrompida volta à fila.
- Não falar enquanto o usuário gira nem logo após outra fala.
- Frases curtas: um setor por frase, no máximo 3 itens.
- Incerteza honesta: "talvez seja…", "não tenho certeza", "não dá para garantir que o caminho esteja livre". Memória antiga é dita como antiga.
- Alertas: raros, curtos, escalam só se piorar. Rotulados como experimentais.

## 3. Regras de engenharia

- Sem gambiarra: sem números mágicos espalhados (toda constante em arquivo de configuração com o porquê), sem `sleep` para corrida, sem `catch` que engole erro, sem código duplicado, sem arquivo gigante, sem flag não documentada.
- TypeScript estrito no front e no cérebro; Python com type hints, `mypy`, `ruff`. Formatação automática. Logs estruturados.
- Arquitetura: **cérebro** (mundo, cena, narrador, realizador) separado da **percepção** (detector, profundidade, cena, OCR, VLM). Percepção sem estado e sem gravar imagem. O cérebro nunca depende de um modelo específico.
- Todo backend de percepção implementa a interface comum e tem versão `fake` para teste.
- Mudou comportamento de fala? Atualize testes e transcrições do simulador no mesmo commit.
- Cada fatia entrega algo que funciona de ponta a ponta (câmera → fala). Não construir camadas soltas.

## 4. Custo zero e licenças

- Proibido usar API paga, serviço com cartão ou nuvem obrigatória. Tudo roda local.
- Antes de adotar modelo ou biblioteca: versão atual, licença, tamanho, requisitos e uma alternativa, registrados em `docs/DECISOES.md` (ADR curto). Preferir Apache-2.0/MIT. Atenção: pesos Ultralytics são AGPL; Depth Anything V2 só o tamanho Small é Apache; Base/Large costumam ser não comerciais.
- Não confie na memória sobre versões: verifique na fonte oficial.

## 5. Privacidade e segurança

- Imagens: processadas em memória e descartadas; nunca gravadas por padrão.
- Serviço escuta só em loopback; HTTPS para expor na rede local.
- Sem telemetria remota. Coleta para melhoria só com opt-in explícito, sem imagens por padrão, com "apagar tudo".
- Nenhum segredo no repositório.

## 6. Definição de pronto (Definition of Done)

Uma tarefa só está pronta quando:
1. Há teste automatizado, medição registrada ou roteiro manual executado com resultado anotado em `docs/EVIDENCIAS/`, mapeado a um ID `CA-*` da seção 11 do plano.
2. Lint, tipos e testes passam; o simulador não gera regressão de transcrição sem justificativa.
3. A documentação afetada foi atualizada (README, ARQUITETURA, LIMITES, DECISOES).
4. Você listou **o que NÃO foi testado**.

## 7. Comandos padrão (manter atualizados)

```
npm test                              # cérebro, saída, armazenamento e detector (build incluído)
node tools/simulate.mjs               # transcrições das cenas simuladas
npm run typecheck                    # TypeScript estrito
npm run lint                         # sintaxe e regras locais
npm run test:a11y                    # Chromium instalado; alvos, axe e contraste na interface inicial
node tests/e2e/smoke.mjs <url>        # Chrome instalado, servidor e insumos de QA do README
```

A percepção desta versão roda em TypeScript no navegador, com backend simulado para testes. Não há pasta perception nem pytest de serviço nesta implementação. Python é usado apenas para empacotar e medir opcionalmente. O E2E --fixtures não verifica HTTP, câmera real, áudio ou offline.
Se o repositório mudar de estrutura, atualize esta seção e o README. Nunca encerre processos com `pkill -f` por nome genérico; use PID.

## 8. Honestidade

- Nunca declarar "seguro", "validado" ou "acessível" sem os critérios CA-A4/CA-A5 (testes com pessoas cegas).
- Nunca afirmar resultado que não foi executado. Mostre a evidência (saída de teste, medição, transcrição).
- Simulador valida lógica, não qualidade dos modelos de visão. Diga isso.
- Se algo falhar ou não puder ser feito (rede bloqueada, modelo indisponível), diga claramente e proponha o próximo passo; não contorne em silêncio.

## 9. Como responder ao usuário

- Português do Brasil, direto e curto. Primeiro o resultado, depois detalhes.
- Informe: o que mudou, evidências, o que não foi testado, decisões pendentes.
- O usuário não é desenvolvedor sênior: explique escolhas em linguagem simples, sem jargão desnecessário.

## 10. Mapa de documentos

| Arquivo | Para quê |
|---|---|
| `docs/PLANO-COMPLETO-VISIORA.md` | Fonte de verdade: visão, escopo, arquitetura, critérios de aceite, fases |
| `docs/PRODUTO.md` | Princípios de experiência |
| `docs/ARQUITETURA.md` | Desenho técnico atual |
| `docs/LIMITES.md` | Limites honestos (exibir na ajuda do app) |
| `docs/DECISOES.md` | ADRs: modelos, licenças, escolhas |
| `docs/REFERENCIAS.md` | Fontes e o que foi adotado ou rejeitado |
| `docs/EVIDENCIAS/` | Resultados de testes e medições por critério |

## Retomada planejada — Luna 6 (18/10/2026)

Antes de trabalhar na migração, leia `docs/RETOMADA-LUNA-6.md`, `docs/PLANO-MIGRACAO-LUNA-6.md` e ADR-016 em `docs/DECISOES.md`. O usuário solicitou somente planejamento nesta etapa. A futura opção paga/nuvem é uma mudança de escopo planejada; não autoriza gastos ou envio de imagens agora. Começar a implementação apenas após nova instrução, pelos contratos e respostas simuladas; chamadas reais dependem dos requisitos pendentes do plano. Preserve as regras e evidências do modo local.


## Autorização de desenvolvimento Luna — 18/10/2026

O usuário mandou iniciar a implementação após o planejamento. ADR-017 registra a fatia local e os limites. Leia `docs/CONFIGURAR-LUNA.md` e o topo atualizado de `docs/RETOMADA-LUNA-6.md`. Essa autorização sucede a pausa anterior, sem autorizar gastos, orçamento ou envio de anexos privados. O modo pago depende de chave em segredo, teto definido, conferência de preços e consentimento de nuvem. Modo local mantém as regras originais. `npm run dev:luna` inicia gateway local; `node tests/e2e/luna.mjs` testa integração fake.
## Atualização do fluxo principal - automático (18/10/2026)

O usuário mandou analisar ao ativar e acompanhar mudanças sem perguntas obrigatórias. ADR-020 e `docs/ACOMPANHAMENTO-AUTOMATICO.md` sucedem a etapa apenas sob demanda no piloto local, sem aumentar os US$ 2/dia e US$ 2 totais autorizados. Respeitar consentimento `cloud-v2-auto`, pausa após erro, metadado de modelo e limites de atualidade. Automático não está validado com usuários ou câmera física por estes testes. Não publicar nem declarar segurança/precisão a partir de fakes.

## Revisão de continuidade - ADR-021 (18/10/2026)

Leia ADR-021, o guia automático e `docs/EVIDENCIAS/LUNA-CONTINUIDADE.md`. Esta revisão sucede a pausa após qualquer erro e a cadência anterior: uma recuperação após falha temporária conhecida, com captura atual após 15 s, nova reserva e pausa na segunda falha consecutiva. Intervalo mínimo de 4,5 s, consentimento `cloud-v3-continuity`. Erros de orçamento/acesso/modelo/contrato não recuperam automaticamente. Preservar chave, ledger real e tetos. Registrar ausência como não identificação na captura, nunca como saída física da pessoa. Sem chamadas pagas pelo agente ou deploy para testar esta revisão.

## Planejamento portátil - ADR-022 (18/10/2026)

Antes da próxima evolução híbrida, leia `docs/PLANO-PERCEPCAO-CONTINUA.md` e o topo de `docs/RETOMADA-LUNA-6.md`. Plano concluído, sem implementação. Começar por H0/H1 somente após instrução de implementar. Não presumir novos modelos escolhidos, compatibilidade física, ganho de qualidade, quota compartilhada ou publicação. Manter orçamento/ledger e distinção entre fatos locais atuais e snapshots Luna.

## H1 implementada; próximo gate H2 — ADR-023 (18/10/2026)

O usuário autorizou implementar. Leia o topo de `RETOMADA-LUNA-6.md` e `EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md`. H0 técnico e H1 concluídos localmente; H0 humano/medições ainda pendentes. CaptureHub no Luna e consumidor independente com fake exclusivo do teste; nenhum detector novo ativado no app normal. Próxima fatia H2 mede qualidade/desempenho antes de fala local. Não anunciar ganho visual por teste fake. Novo E2E: `node tests/e2e/hybrid-capture.mjs`, com gateway fake/SQLite em memória/vídeo público, sem `.env`. Manter chave, ledger, tetos e versão API. Publicação/gateway compartilhado permanecem fases futuras.

## Movimento e fala Luna corrigidos — ADR-024 (19/10/2026)

O usuário priorizou análise desde o início, mesmo com movimento, e menos repetição. Leia ADR-024 e docs/EVIDENCIAS/LUNA-MOVIMENTO-FALA.md. Quadro recente permite análise; estabilidade de pixels não é requisito nem prova de giro físico. Mudança menor preserva snapshot com idade; mudança estrutural ampla retira posições e permite apenas contexto histórico sem repetição. Agrupar itens por setor, preservar incerteza e confirmar somente entrega. Sucede as exigências anteriores de estabilidade no Luna; regra de giro medido/simulado do cérebro local permanece. Não aumentar validade, orçamento ou declarar precisão/caminhada validada. Novo teste: node tests/e2e/luna-movement.mjs, somente fake/loopback. H2 e pesquisa humana continuam pendentes.

## Orçamento diário corrigido — ADR-025 (19/10/2026)

O usuário esclareceu que o limite é US$ 2 por dia, não US$ 2 no total. Sucede os tetos acumulados das ADRs anteriores. Usar America/Sao_Paulo e timestamps para a fronteira diária; não reescrever/apagar o histórico ou liberar reservas incertas. Pendência em andamento continua bloqueando concorrência após meia-noite. VISIORA_TOTAL_USD foi aposentado; teto inicial diário zero e máximo autorizado 2. Leia docs/EVIDENCIAS/LUNA-ORCAMENTO-DIARIO.md e a configuração atual antes de mexer em orçamento. Sem chamada paga pelo agente para testar; processo do usuário exige reinício para aplicar.

## Memória e comunicação — ADR-026 (19/10/2026)

O usuário priorizou fala/memória dos snapshots e avaliação com pessoas cegas/O&M. Leia docs/EVIDENCIAS/MEMORIA-COMUNICACAO.md e docs/AVALIACAO-MEMORIA-COMUNICACAO.md. Priorizar novidade atual; ausência sem direção antiga; grupo selecionado só após entrega válida; não restaurar posições da captura invalidada quando pixels retornam. Tolerância de setor, confirmação de lugar e retenção linguística são hipóteses a testar, não pose/identidade. Não confundir os 30 s de memória linguística com os 10 s máximos de snapshot. Fonte/API/modelo/orçamento diário da ADR-025 preservados. Avaliação humana preparada, não realizada: 0 sessões/participantes/profissionais. Não recrutar/enviar mensagens ou declarar aceite humano sem evidência. H2 e demais gates híbridos permanecem pendentes.

## Reteste da expiração Luna — ADR-029 (22/10/2026)

Leia docs/EVIDENCIAS/LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md. Fala iniciada dentro dos dez segundos pode terminar se a vista seguir válida; mudança ampla ainda cancela. Fala que não iniciou no prazo permite somente uma nova captura após 15 s, sujeita a consentimento, cadência e orçamento; segunda expiração pausa. O build versiona o cache offline. Usuário confirmou funcionamento com webcam/Luna e diagnóstico `adr-029` mostrou três entregas, sem erro; audibilidade independente, precisão, latência e aceite humano permanecem não medidos.

## H2 parcial — ADR-030 (23/10/2026)

Leia `docs/EVIDENCIAS/H2-PERCEPCAO-LOCAL-2026-10-23.md`. O modo local usa os mesmos YOLOX Nano/Tiny/S com WebGPU e retorno à CPU se a inicialização falhar. RF-DETR e D-FINE não foram adotados: as anotações públicas deixam dúvidas sobre cadeiras e faltam dados brasileiros revisados. O worker de ambientes permanece WASM, e o modo Luna continua sem detector local real. H2/H3 não liberam fala híbrida; faltam webcam/voz, uso prolongado, outros equipamentos e revisão independente de qualidade.
