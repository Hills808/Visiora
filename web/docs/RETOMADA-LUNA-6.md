## H2 parcial: WebGPU local e comparação de detectores (23/10/2026)

ADR-030 e [evidência H2](EVIDENCIAS/H2-PERCEPCAO-LOCAL-2026-10-23.md): o modo local acelera os mesmos YOLOX via WebGPU com retorno à CPU na inicialização; RF-DETR/D-FINE não passaram o gate de falsos de cadeira e não foram integrados. O worker de ambientes permanece WASM (~1,6 s na fixture), e o detector híbrido real segue desligado no Luna. Próximo: medir cenas, memória/RAM e estabilidade em webcam/uso prolongado; obter conjunto brasileiro anotado e revisar possíveis lacunas do COCO antes de escolher detector. Não ativar fala local Luna por esta medição. Sem gasto de API, publicação ou mudança dos tetos.

## Memória e comunicação revisadas (19/10/2026)

ADR-026 implementa novidades visíveis antes de ausências, atualizações até 25 palavras e menos repetição por pequenas oscilações de posição/certeza/lugar. Ausência não recebe direção antiga; uma captura que perdeu sua vista não recupera posições por pixels parecidos. Texto/voz só entram no histórico após entrega válida. Memória linguística não é tracking nem um mapa atual; o modelo/API e US$ 2/dia continuam iguais.

[Evidências](EVIDENCIAS/MEMORIA-COMUNICACAO.md): 150 testes e 34 cenários de navegador com fontes artificiais. [Protocolo MC-01](AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](FICHA-AVALIACAO-MEMORIA.csv) preparados, com zero sessões/participantes/avaliações profissionais. Próximo nessa frente: executar sessões consentidas com pessoas cegas e O&M disponíveis, registrar falhas e revisar as hipóteses. H2 e demais gates híbridos continuam pendentes. Build local atualizado; recarregue com Ctrl+Shift+R. Sem API paga, segredo/ledger alterado ou publicação nesta revisão.

## Orçamento vigente: US$ 2 por dia (19/10/2026)

ADR-025 corrige o teto acumulado antigo: o limite é US$ 2 em cada dia de America/Sao_Paulo, renovado à meia-noite, sem teto total do piloto. O histórico permanece; reservas incertas são atribuídas pelo horário original e uma chamada pendente continua bloqueando concorrência. VISIORA_TOTAL_USD foi aposentado e é ignorado. Reinicie o gateway para aplicar (Ctrl+C e npm run dev:luna), depois recarregue a página. Não foi alterado o segredo ou ledger real nem executada chamada paga. As menções anteriores a US$ 2 totais/dia UTC são históricas e sucedidas por esta regra.

## Correção concluída: movimento e fala agrupada — ADR-024 (19/10/2026)

O usuário priorizou corrigir espera por estabilização e repetição por item antes de continuar H2. O Luna já analisa desde o primeiro quadro recente, sem exigir pausa. Mudança menor preserva a descrição qualificada por captura; vista amplamente diferente retira posições e permite só contexto histórico. Itens no mesmo setor compartilham direção, com incerteza por grupo. [Guia atual](ACOMPANHAMENTO-AUTOMATICO.md) e [evidências](EVIDENCIAS/LUNA-MOVIMENTO-FALA.md): 131 testes, 32 cenários de navegador, tipos/lint, formatação de código e seis transcrições locais iguais. Build local atualizado; recarregar com Ctrl+Shift+R. Nenhuma API paga, publicação ou modificação de chave/ledger/tetos.

Próximo: colher o resultado do piloto com movimentação da câmera e registrar atrasos/erros; a validação física/humana está pendente. O gate técnico permanece H2 para qualidade e desempenho antes de ativar detector local real. Não prometer visão em tempo real ou navegação segura. O modo local mantém sua regra de giro; não reintroduzir estabilidade de pixels como condição de análise Luna. Teste específico reproduzível: `node tests/e2e/luna-movement.mjs` (gateway fake próprio, Chrome e vídeo público já existente, SQLite em memória, sem `.env`). Os checkpoints abaixo são históricos.

## Retomar de H2: captura compartilhada já implementada localmente (18/10/2026)

O usuário autorizou implementar o plano. Leia ADR-023 e [H1-CAPTURA-COMPARTILHADA.md](EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md). H0 técnico reexecutou a base; H1 migrou o modo Luna para CaptureHub e integrou pipeline/contrato local independente, com fake exclusivo dos testes. Passaram 127 testes, 34 cenários de navegador, tipos/lint e seis transcrições iguais. Build local atualizado, sem publicação. O app normal ainda não liga detector local no Luna. Preservados modelo, consentimento, limites, chave e ledger real; nenhuma chamada paga para testar.

Próximo trabalho: H2, benchmark de modelos/perfis no worker antes de ativar reconhecimento local. Não refazer a infraestrutura já pronta nem tratar o fake como ganho de qualidade. H0 ainda depende de entrevistas/O&M, vídeo brasileiro consentido e medições reais; H3–H7 continuam planejadas. Ensaiar no mesmo conjunto e registrar falhas/omissões, latência por etapa e RAM; manter verificação de pessoas. Contexto Luna não vira fato atual. Cada integração requer suas evidências antes de falar.

H1 pode ser reproduzida sem segredo com `node tests/e2e/hybrid-capture.mjs` após build (Chrome + fixture pública existente); o script encerra seus próprios processos. O teste de continuidade agora aguarda o frame observado, porque o relógio artificial não avança o decodificador de vídeo. Docs e evidências têm cópia na raiz selecionada. Os checkpoints abaixo são históricos e suas pausas de planejamento foram sucedidas pela autorização atual.

## Próxima implementação planejada: percepção contínua portátil (18/10/2026)

Leia [PLANO-PERCEPCAO-CONTINUA.md](PLANO-PERCEPCAO-CONTINUA.md) e ADR-022 antes de implementar a próxima evolução. O usuário pediu planejamento para combinar percepção local frequente com interpretação Luna em diferentes PCs/notebooks. Plano concluído; produto ainda permanece na ADR-021. Nenhuma nova API, dependência, interface ou hospedagem foi implementada nesta etapa.

Iniciar por H0 (baseline, roteiros de experiência, equipamentos e métricas) e H1 (captura única compartilhada, contratos e percepção fake funcionando durante uma chamada Luna). Depois H2 compara modelos e perfis por capacidade medida. Só integrar fala local real após cumprir os critérios de qualidade e atualidade. Não ligar os cinco modelos antigos simultaneamente e presumir ganho. A matriz Windows/macOS/Linux/ARM64 é alvo de teste, não compatibilidade já comprovada.

Preservar chave, ledger, US$ 2/dia e US$ 2 totais. Copiar o projeto para outra máquina não compartilha orçamento: manter um gateway ativo por vez no piloto; futuro gateway compartilhado exige controle transacional único e autenticação. Não publicar nem efetuar chamadas pagas para verificar este plano. Aguarde instrução de implementação; não há execução futura agendada. As seções seguintes descrevem o produto implementado e checkpoints anteriores.

## Continuidade revisada no piloto local (18/10/2026)

ADR-021 sucede os parâmetros do primeiro automático: intervalo mínimo de 4,5 s, gatilho por blocos para mudanças localizadas, orientação após mudança ampla de vista e aviso qualificado quando uma pessoa deixa de ser identificada, mesmo com móveis iguais. Respostas cuja imagem mudou durante a consulta são descartadas. Uma falha temporária conhecida permite uma nova captura após pelo menos 15 s; segunda falha consecutiva pausa. Erros de orçamento, credencial, consentimento, modelo ou contrato pausam sem recuperação. Consentimento `cloud-v3-continuity`. Preservados US$ 2/dia, US$ 2 totais, reserva e histórico. Nenhuma chamada paga feita pelo agente para testar esta mudança. Guia: [ACOMPANHAMENTO-AUTOMATICO.md](ACOMPANHAMENTO-AUTOMATICO.md); evidência: [LUNA-CONTINUIDADE.md](EVIDENCIAS/LUNA-CONTINUIDADE.md). Publicado continua 0.3; os blocos anteriores abaixo são históricos.

## Próxima retomada: piloto automático local (18/10/2026)

ADR-020 e `ACOMPANHAMENTO-AUTOMATICO.md` sucedem o fluxo somente sob demanda. O usuário pediu análise inicial e acompanhamento sem perguntas: implementação local experimental com estabilidade, gatilho de mudança, intervalo de 12 s, deduplicação, prioridade a passagens visíveis, consentimento `cloud-v2-auto`, pausa após falha e orçamento existente preservado. Não houve chamada paga nova para esta mudança. Evidências em `EVIDENCIAS/LUNA-AUTOMATICO.md`; próximo trabalho é medir qualidade/custo/latência em ensaio autorizado, não declarar produto validado ou aumentar limites. Publicado permanece 0.3. Os blocos seguintes são checkpoints históricos.

## Conferência de modelo implementada (18/10/2026)

O usuário configurou a chave e autorizou US$ 2 por dia/US$ 2 totais; relatou análise e voz funcionando. Foram observadas seis consultas antigas concluídas com uso de tokens, sem registro de modelo. ADR-018 revisa a reserva conservadora. ADR-019 acrescenta conferência exata de `model` recebido, tabela `model_responses`, log JSON e `npm run luna:models`. Reiniciar o servidor atualizado para aplicar; nenhuma confirmação retroativa. A nova conferência foi testada sem API paga, conforme `EVIDENCIAS/LUNA-MODELO-RESPOSTA.md`. Próximo passo é observar o campo de uma próxima consulta explícita autorizada e depois avaliar qualidade/custo/latência. O site publicado permanece 0.3; as seções abaixo são checkpoints históricos.

## Atualização após autorização de implementação (18/10/2026)

A primeira fatia local foi implementada. Leia primeiro `docs/CONFIGURAR-LUNA.md`, ADR-017 e `docs/EVIDENCIAS/LUNA-INTEGRACAO-LOCAL.md`. O checkpoint de planejamento abaixo é histórico.

- Luna principal no seletor; modo local preservado. Gateway ESM Node em loopback, prompt/schema aberto, análise de captura e fala com idade, consentimento, orçamento transacional e fake.
- Nenhuma chave real, orçamento autorizado, chamada paga ou deploy. Publicado continua 0.3.
- Primeiro próximo passo: usuário define teto total/diário e configura credencial em segredo; no Sites usar plugin OpenAI Developers e skill oficial de chave. Nunca pedir segredo no chat. Rever custo de imagem e confirmação de preço antes de habilitar.
- Depois: smoke pequeno em imagens públicas autorizadas, medir uso/qualidade/latência. Ainda faltam benchmark independente, tipagem estática do gateway, reconciliação administrativa, fusão com World/Scene ao vivo, migração hospedada e testes com usuários. Não ligar automático antes dos gates.
- Comandos: `npm test`, `npm run typecheck`, `npm run lint`, `node tools/simulate.mjs`, `node tests/e2e/luna.mjs`. O último requer Chrome e o insumo público `artifacts/vision/dog.y4m`, já existente neste checkout; os insumos de QA não são fotos privadas.

# Comece aqui — Visiora com Luna 6

Checkpoint de18/10/2026. O usuário pediu **somente planejamento agora**, para retomar quando os créditos voltarem. Nenhuma implementação, chamada paga ou publicação nova nesta etapa. Não existe tarefa agendada para executar automaticamente em cinco horas.

## Leia e confirme

1. `AGENTS.md`, plano completo (seções obrigatórias), limites e decisões atuais.
2. `docs/PLANO-MIGRACAO-LUNA-6.md` inteiro: arquitetura, contratos, tarefas L00–L11 e gates.
3. `docs/DECISOES.md`, ADR-016. É uma mudança de escopo planejada: API paga e nuvem no modo Luna; não apaga as regras do modo local.
4. `git status --short` e `git log -1 --format=%H`; preservar alterações do usuário. Estes documentos podem estar só no checkout, sem push. Não afirmar que o remoto já contém o planejamento.

## Estado que não pode ser perdido

- Checkout: `visiora`, dentro da pasta selecionada pelo usuário.
- Publicado:0.3.0; commit `9ac9fadc1844145d66d4bf2b4e8d543f792b9483`.
- Site privado `appgprj_6ad3aaa3c22881919aef7bcb07d2a927`: https://visiora-ambiente.hills808.chatgpt.site
- Backend atual inexistente; hospedagem é estática. Cinco modelos ONNX locais; **não é Ollama**.
- A nova escolha é `gpt-6-luna` via API com imagem real e resposta estruturada aberta.
- A memória/narração atual é reaproveitável, mas `PLACES` e `LEX` fechados precisam evoluir. Só ligar uma API não resolve isso.
- Resultado histórico:73 unitários e20 casos de integração; nenhum teste Luna. Evidência0.3 tem todas as limitações.

## Primeiro trabalho autorizado ao mandar continuar

Começar por L00–L04: contratos abertos de evidência, prompt/schema, backend fake, agendador/freshness, gateway desativado e contabilidade testada sem custo. Continuar os testes do cérebro e as transcrições. Não começar por chamadas reais, deploy ou remoção dos modelos atuais.

Antes de qualquer chamada paga: orçamento e consentimento explícitos, chave pelo fluxo oficial e precificação de imagens/reserva verificada. Gasto permitido começa em0; modo online desligado. Não pedir segredo no chat ou colocá-lo no navegador. Se faltar plugin OpenAI Developers, pedir ativação só quando necessário para configurar chave.

Fatos atuais continuam limitados a3s. Resposta de3–10s só pode ser snapshot antigo identificado, nunca atualização do mundo atual. Cancelamento não garante ausência de cobrança. Sem retries faturáveis automáticos. API valida formato, não verdade; contagem/caixas do modelo são estimativas.

## Comandos de base para a implementação futura

Executar dentro de `visiora`, sem comandos fora da pasta selecionada:

```powershell
git status --short
node tools/test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tools/check.mjs
node tools/simulate.mjs
```

Esses comandos são instruções de retomada; não foram reexecutados para este planejamento exclusivamente documental. Não instalar dependências, obter chave ou disparar benchmark pago para “confirmar” este arquivo.

## Frase para retomar a conversa

“Continue o Visiora pelo docs/RETOMADA-LUNA-6.md. Comece pelos contratos e testes fake da migração Luna, preservando a versão0.3 publicada. Antes de chamadas reais, confirme os requisitos pendentes do plano.”
