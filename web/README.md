## Continuidade de fala — ADR-048

O automático preserva o que já foi falado durante omissões isoladas e pequenas variações. Corrigir o nome do lugar não repete os objetos; uma pessoa sem posição não é tratada como ausente. Novidades, mudança de direção/vista e pedidos explícitos permanecem elegíveis. [Testes e limites](docs/EVIDENCIAS/CONTINUIDADE-SEM-REPETICAO-2026-10-25.md).

## Correção de contrato Luna — ADR-047

O servidor aceita diferenças equivalentes de formatação e informa um motivo específico quando a resposta não atende ao contrato. Uma posição inválida continua bloqueada. Se ocorrer pausa, anote o código e pare/inicie após conferir a causa. [Testes e limites](docs/EVIDENCIAS/LUNA-CONTRATO-422-2026-10-24.md); reteste real ainda pendente.

## Percepção contínua e memória — ADR-046

No [Luna privado](https://visiora-luna-hills808.hills808.chatgpt.site/), selecione **Ajustes → Percepção local contínua · experimental → Acompanhar objetos neste aparelho**. A opção vale só nesta página e começa desligada. Ao iniciar Luna, o observador baixa cerca de 60 MB de modelos e usa a mesma câmera, em paralelo à análise e à voz. A carga não bloqueia a primeira captura Luna. Desative se houver aquecimento ou lentidão.

Abra **Percepção local experimental** para consultar observações recentes, candidatos e associações temporárias. Elas são relativas à câmera, podem errar e não representam identidades, distâncias ou caminho livre. A fala continua baseada nas capturas Luna; fala híbrida aguarda qualidade temporal medida. O diagnóstico exportado não inclui rótulos, caixas ou imagens. [Evidências e limites](docs/EVIDENCIAS/PERCEPCAO-CONTINUA-2026-10-24.md).

Teste de transporte/execução real: após build e preparação do vídeo de QA, `node tests/e2e/continuous-real.mjs` (GPU quando disponível) e `node tests/e2e/continuous-real.mjs --cpu`. `VISIORA_QA_VIDEO` aceita caminho de vídeo Y4M público/consentido; sem ele usa a foto pública dog.y4m e mede só carga/atraso. Usa API fake e SQLite em memória, nunca .env; não valida câmera/voz reais ou reconhecimento. Não usar frames privados sem autorização. H1 fake continua em `node tests/e2e/hybrid-capture.mjs`.

## Movimento no iPhone — revisão ADR-045

No [Luna privado](https://visiora-luna-hills808.hills808.chatgpt.site/), a descrição identifica o tempo da captura e posições relativas à câmera. A mudança de vista exige captura nova mesmo quando o enquadramento volta. Em **Ajustes → Giros da câmera · experimental**, a leitura opcional retira posições após giro detectado; começa desligada, exige permissão no iPhone e funciona só durante Luna em primeiro plano. O estado informa quando faltam leituras. Sem câmera/voz física ou caminhada avaliadas nesta revisão: não usar o protótipo para decidir onde pisar. Para o primeiro ensaio, permanecer parado e movimentar apenas a câmera num ambiente conhecido.

Ajuda permite exportar diagnóstico com tempos da resposta/início/conclusão e motivos de retirada, sem imagens nem textos. Voz/texto e percepção fake são separados; callbacks não provam que houve som. [Resultados e limites](docs/EVIDENCIAS/MOVIMENTO-IPHONE-2026-10-24.md) · [Protocolo antes de avançar percepção](docs/AVALIACAO-MOVIMENTO.md).

## Versão web atual — 24/10/2026

[Abrir Visiora com Luna](https://visiora-luna-hills808.hills808.chatgpt.site/) (acesso privado) · [Modo local público](https://visiora-ambiente.hills808.chatgpt.site/).

A interface usa uma ação principal, descrição em destaque e detalhes expansíveis. No modo Luna, autorize as capturas antes de iniciar. Perguntas são opcionais. Ajustes preservam voz/leitor de tela, tema e texto ampliado. O orçamento hospedado é centralizado, US$ 2/dia; não há chave no navegador. Não rode outro gateway pago em paralelo, pois o ledger local é separado. [Referências e verificação do visual](docs/EVIDENCIAS/REDESIGN-VISUAL-2026-10-24.md).

As orientações de túnel e implantação própria abaixo são alternativas/histórico; o Site privado já tem gateway publicado. O Visiora permanece um protótipo em avaliação, sem aceite com pessoas cegas.

---

## Demonstração remota temporária — sala de aula (23/10/2026)

Para usar o **Luna real** pelo notebook ou celular sem instalar o servidor nesses aparelhos, há um iniciador para Windows: `tools/apresentacao-luna.ps1`. Ele abre um **Cloudflare Quick Tunnel HTTPS** protegido por e-mail e roda o gateway local na **mesma origem pública**; deve ser executado no computador que já tem `.env` e `.runtime/luna-budget.sqlite`. O computador permanece ligado e conectado à internet durante a sessão. O link `chatgpt.site` anterior continua estático, sem Luna.

**Preparação:** pare o gateway atual (Ctrl+C), instale `cloudflared` 2026.9.3+ com `winget install --id Cloudflare.cloudflared -e` e atualize o checkout para a `main`. Na pasta `web` execute `npm run build`, depois `powershell -ExecutionPolicy Bypass -File tools/apresentacao-luna.ps1 -Email seu-email@exemplo.com`. Copie a URL `https://...trycloudflare.com` exibida na segunda janela e cole no prompt. Acesse essa URL no notebook ou celular, autentique-se pelo código recebido no e-mail, dê consentimento à câmera e teste `/api/vision/status`. O orçamento e a chave permanecem no gateway original; **não rode outra instância paga**.

**Limitações:** requer PC ligado, internet, e-mails acessíveis no notebook, túnel sujeito à disponibilidade da Cloudflare e provedor; não é produção nem garante estabilidade da apresentação. O iniciador foi revisado por leitura de código, **não executado neste ambiente**. Veja `docs/EVIDENCIAS/LUNA-TUNEL-APRESENTACAO-2026-10-23.md`. Se precisar de maior confiabilidade, leve o pacote portátil Windows preparado anteriormente.

## Luna pela internet — implantação privada (em preparação)

A hospedagem pública atual `https://visiora-ambiente.hills808.chatgpt.site` é **estática** e não oferece Luna. Há uma opção de implantação em endereço HTTPS próprio, com autenticação, chave somente no servidor e orçamento SQLite persistente: [guia de implantação](deploy/README.md). **Não foi implantada nem testada ao vivo.** Não divulgue um endereço como funcionando com Luna até confirmar as etapas do guia.

## Exceção para apresentação — 23/10/2026 (ADR-037)

Por autorização do usuário, o teto de reserva do **Luna** no piloto com servidor configurado foi elevado para **US$ 10 no dia 23/10/2026**, no fuso `America/Sao_Paulo`. Esse valor inclui as reservas e os gastos já computados no dia: não é crédito adicional. Às 00h de **24/10/2026**, retorna automaticamente ao teto normal de **US$ 2/dia**, mesmo sem reiniciar o processo. A configuração `VISIORA_DAILY_USD` continua limitada a 2; a exceção só atua com o Luna previamente habilitado e orçamento normal positivo. Histórico, reservas incertas, chave e consentimento permanecem intactos. Para usar o código novo, atualizar o checkout local e **reiniciar o gateway** antes da apresentação. Isso não altera cotas ou faturamento do provedor e não resolve timeout, rede, credenciais ou falhas de voz. O link público estático ainda não oferece Luna. Evidência e roteiro: [docs/EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md](docs/EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md).

## Luna na apresentação pelo notebook Windows (23/10/2026)

O endereço público abaixo serve somente arquivos estáticos e **não dispõe do gateway Luna**. Para apresentar o acompanhamento automático no notebook Windows x64, use o pacote portátil `artifacts/visiora-luna-notebook-windows-x64.zip`. Ele inclui Node.js e o mesmo build da interface; abra `LEIA-ME-LUNA.txt` dentro do ZIP. Antes de sair, pare o gateway no PC e transfira separadamente `.env` e `.runtime/luna-budget.sqlite` para a pasta extraída no notebook. O ZIP distribuível não contém chave nem registro de gasto. Depois, abra `iniciar-luna.cmd` e visite `http://127.0.0.1:8080` no notebook. O gateway escuta só nesse aparelho; a câmera funciona no loopback do navegador. Teste a voz e a internet no notebook antes da apresentação. Não use Luna nos dois computadores ao mesmo tempo, pois o teto diário não é compartilhado ao vivo.

Para regenerar o pacote nesta máquina: `npm run package:luna-notebook`. O script baixa o Node.js 24.22.1 x64 do site oficial e confere o SHA-256 publicado. [Evidência do ensaio portátil](docs/EVIDENCIAS/LUNA-NOTEBOOK-2026-10-23.md).

## Apresentação em outro aparelho (23/10/2026)

Abra https://visiora-ambiente.hills808.chatgpt.site em Chrome ou Edge atualizado, com internet. Selecione **Modelos locais**, permita a câmera e aguarde o primeiro download de cerca de 168 MB. Em **Ajustes**, confira se há uma voz pt-BR; se não houver, use as descrições em texto ou o leitor de tela. Teste no notebook antes da apresentação, de preferência na mesma rede que será usada no local. A análise local roda no próprio aparelho e pode ficar lenta em notebooks sem GPU compatível. A demonstração de cenas funciona sem câmera.

O endereço público oferece o modo local. **Luna não funciona nesse endereço**, pois exige um gateway privado com chave, consentimento e orçamento. Não cole a chave da API no navegador. O site é um protótipo em avaliação: não oferece orientação segura para deslocamento.

[Evidências e limites desta publicação](docs/EVIDENCIAS/PUBLICACAO-APRESENTACAO-2026-10-23.md).

## Visão local mais rápida no PC testado (23/10/2026)

A [Especificação de Requisitos de Software](docs/REQUISITOS.md) organiza funcionalidades, regras, interfaces, qualidade e design do Visiora segundo a ISO/IEC/IEEE 29148:2018, com IDs, critérios de verificação e estado de cada requisito.

O último diagnóstico Luna com webcam registrou uma fala entregue em duas consultas enviadas. Foi exportado após a sessão parar; por isso `paused=true` não identifica falha. O diagnóstico novo distingue motivo da parada e análise pendente ao parar. [Leitura e limites do teste](docs/EVIDENCIAS/LUNA-DIAGNOSTICO-2026-10-23.md). Para investigar outra ocorrência, exporte o JSON enquanto a mensagem ainda aparece, antes de tocar em **Parar ambientação**; isso não envia nova imagem à API.

Em Chrome no Windows, um ensaio de 30 minutos com vídeo público como câmera e voz simulada manteve a sessão ativa: 6.062 quadros, zero erros e crescimento de memória privada de 1,29% depois do aquecimento. Isso ainda precisa de webcam, voz e outras máquinas. [Evidência CA-D5/E3](docs/EVIDENCIAS/ESTABILIDADE-INSTALACAO-2026-10-23.md).

Os controles da tela inicial foram verificados em 390 e 1440 px: áreas de botão/select ≥44 px, sem violações axe sérias/críticas nem de contraste reforçado no ensaio automatizado. O botão Ajustes mantém nome para leitor de tela no celular. [Evidência de interface](docs/EVIDENCIAS/ACESSIBILIDADE-2026-10-23.md).

`npm run test:a11y` prepara o build e executa a auditoria estática de interface em Chromium; o CI instala o navegador headless e roda esse comando em cada mudança de `web/`.

Se a GPU falhar durante a análise local, o Visiora descarta o quadro incompleto e tenta continuar uma vez na CPU sem fechar a câmera. Falha posterior encerra a sessão com erro. [Teste e limites](docs/EVIDENCIAS/GPU-RECUPERACAO-2026-10-23.md).

O reconhecimento de ambiente também usa GPU quando disponível, após carregar e preparar os dois modelos. Se a GPU falhar ao iniciar, usa CPU; se falhar durante a análise, descarta aquela resposta e reinicia na CPU. Em vídeo público simulado, 34 respostas de ambiente levaram p50 191 ms e p95 249 ms da captura até a resposta. [Medição e limites](docs/EVIDENCIAS/CENAS-GPU-2026-10-23.md).

O repositório executa testes, tipos, lint e transcrições simuladas no GitHub Actions a cada mudança em `web/`. O fluxo ainda não substitui ensaios com webcam, voz ou leitores de tela reais. [Evidência de CI](docs/EVIDENCIAS/CI-2026-10-23.md).

Na medição anterior da ADR-030, o modo **Modelos locais** passou a usar GPU/WebGPU para objetos. Os mesmos YOLOX Nano/Tiny/S e a mesma regra de pessoas permanecem. Com imagem pública e câmera simulada, a análise de objetos levou 64–124 ms na RTX 3060 e 1334–1665 ms na CPU; o reconhecimento de ambiente ainda usava CPU e levou cerca de 1,6 s. O status e o diagnóstico indicam GPU ou CPU para objetos. RF-DETR e D-FINE foram comparados, mas produziram mais detecções de cadeira sem anotação correspondente e não entraram no aplicativo. O modo Luna continua usando capturas próprias, sem detector local híbrido ativo. [Medições, modelos e limites](docs/EVIDENCIAS/H2-PERCEPCAO-LOCAL-2026-10-23.md). Para usar o build local, recarregue duas vezes após `npm run build` e `npm run dev:luna`; o cache offline troca de revisão.

## Correção da expiração da fala Luna (22/10/2026)

No reteste com webcam, o acompanhamento ainda pausou quando a descrição Luna ultrapassou dez segundos antes de terminar a fala. Agora uma fala iniciada dentro da validade pode terminar se a vista continuar válida; se não começar, há no máximo uma nova captura após 15 s, sujeita ao mesmo consentimento e orçamento. O build também troca a versão do cache offline quando o código muda. O usuário confirmou funcionamento em nova sessão: 4 respostas aceitas, 3 entregas, nenhum erro; ainda sem medição independente de precisão, áudio ou latência. [Evidência e limites](docs/EVIDENCIAS/LUNA-FALA-EXPIRADA-RETESTE-2026-10-22.md). Para carregar o build novo no navegador que já tinha o app aberto, recarregue duas vezes; o primeiro recarregamento instala o novo cache, o segundo abre os arquivos atuais. A versão publicada não mudou.

## Memória e comunicação revisadas (19/10/2026)

ADR-026 implementa novidades visíveis antes de ausências, atualizações até 25 palavras e menos repetição por pequenas oscilações de posição/certeza/lugar. Ausência não recebe direção antiga; uma captura que perdeu sua vista não recupera posições por pixels parecidos. Texto/voz só entram no histórico após entrega válida. Memória linguística não é tracking nem um mapa atual; o modelo/API e US$ 2/dia continuam iguais.

[Evidências](docs/EVIDENCIAS/MEMORIA-COMUNICACAO.md): 150 testes e 34 cenários de navegador com fontes artificiais. [Protocolo MC-01](docs/AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](docs/FICHA-AVALIACAO-MEMORIA.csv) preparados, com zero sessões/participantes/avaliações profissionais. Próximo nessa frente: executar sessões consentidas com pessoas cegas e O&M disponíveis, registrar falhas e revisar as hipóteses. H2 e demais gates híbridos continuam pendentes. Build local atualizado; recarregue com Ctrl+Shift+R. Sem API paga, segredo/ledger alterado ou publicação nesta revisão.

## Orçamento vigente: US$ 2 por dia (19/10/2026)

ADR-025 corrige o teto acumulado antigo: o limite é US$ 2 em cada dia de America/Sao_Paulo, renovado à meia-noite, sem teto total do piloto. O histórico permanece; reservas incertas são atribuídas pelo horário original e uma chamada pendente continua bloqueando concorrência. VISIORA_TOTAL_USD foi aposentado e é ignorado. Reinicie o gateway para aplicar (Ctrl+C e npm run dev:luna), depois recarregue a página. Não foi alterado o segredo ou ledger real nem executada chamada paga. As menções anteriores a US$ 2 totais/dia UTC são históricas e sucedidas por esta regra.

## Correção atual: início com movimento e fala agrupada (19/10/2026)

O Luna começa a analisar no primeiro quadro recente, sem exigir estabilidade. Movimento menor não interrompe a descrição da captura; uma mudança ampla retira posições antigas e permite apenas contexto histórico até a próxima análise. Se essa descrição expirar antes da fala após a mudança ampla, o acompanhamento aguarda uma captura nova na cadência existente, sem usar a posição antiga. Itens no mesmo setor compartilham a direção: “À sua frente, há uma janela, uma pessoa e uma cama.” Silêncio sem novidade e orçamento preservados. Ainda são capturas espaçadas, com mínimo de 4,5 s entre envios, não visão contínua em tempo real.

Build local atualizado. Para aplicar, recarregue o piloto com **Ctrl+Shift+R**; se o servidor estiver parado, na pasta `visiora` execute `npm run dev:luna`. Autorize a câmera/envio e inicie. [Guia atual](docs/ACOMPANHAMENTO-AUTOMATICO.md) · [Evidências](docs/EVIDENCIAS/LUNA-MOVIMENTO-FALA.md): 131 testes e 32 cenários de navegador. Sem API paga nos testes ou publicação. Não testados caminhada física, precisão em movimento, áudio/leitores reais, pessoas cegas e outras máquinas. ADR-024 sucede as exigências antigas de estabilidade no modo Luna. Os blocos abaixo são históricos.

## Implementado localmente: primeira etapa da captura compartilhada (18/10/2026)

H1 está implementada: uma câmera no modo Luna alimenta capturas e consumidores locais independentes, com identidade/idade e cancelamento. O consumidor novo foi testado com worker simulado; **o detector local real ainda não foi ativado no Luna**. Próxima fatia: benchmark H2 antes de escolher modelo e liberar fala local. H0 técnico passou; entrevistas e medições físicas seguem pendentes. [Resultados e limites](docs/EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md): 127 testes, 34 cenários no navegador, tipos/lint e seis transcrições iguais. Nenhuma chamada paga ou publicação.

Build local atualizado. Para reproduzir: `npm test`, `npm run typecheck`, `npm run lint`, `node tools/simulate.mjs` e `node tests/e2e/hybrid-capture.mjs`. O último inicia e encerra seu próprio gateway fake em loopback, SQLite em memória e Chrome com vídeo/voz artificiais; não lê `.env` nem usa chave. Requer Chrome (ou `CHROME_PATH`) e o vídeo público de QA já descrito abaixo. As seções seguintes preservam o histórico.

## Próxima evolução planejada: percepção contínua e portabilidade

O próximo incremento está documentado em [PLANO-PERCEPCAO-CONTINUA.md](docs/PLANO-PERCEPCAO-CONTINUA.md): câmera compartilhada, acompanhamento local independente do Luna, memória com fonte/validade, perfis conforme capacidade da máquina e futuro orçamento único entre computadores. Começar por H0/H1; escolher modelos após benchmark. **Somente planejamento concluído: não há nova funcionalidade implementada nem chamada paga.** O piloto atual permanece descrito abaixo.

## Continuidade revisada no piloto local (18/10/2026)

O acompanhamento local foi revisado: percebe mudanças localizadas, considera pessoas que deixam de ser identificadas e descreve novamente uma vista amplamente diferente. Uma falha temporária conhecida permite uma nova captura após 15 s; duas falhas consecutivas pausam. Intervalo mínimo de 4,5 s, uma análise por vez, silêncio sem mudança e orçamento original preservado. Não foi testado reconhecimento real desta revisão. Para aplicar: na pasta `visiora`, pare o servidor com Ctrl+C, rode `npm run build`, depois `npm run dev:luna`, e recarregue `http://127.0.0.1:8080` com Ctrl+Shift+R. Autorize novamente o envio automático. [Guia](docs/ACOMPANHAMENTO-AUTOMATICO.md) · [Evidências e limites](docs/EVIDENCIAS/LUNA-CONTINUIDADE.md). Publicado permanece 0.3. Os blocos abaixo sobre a primeira versão automática são históricos.

## Fluxo atual do piloto Luna: automático

O Luna analisa a primeira imagem estável ao ativar e acompanha mudanças sem exigir perguntas. Envia no máximo uma captura por vez, com intervalo mínimo de 12 s, e fala novidades após validação. Ausência de mudança relevante não gera envios periódicos. Exige novo consentimento explícito para automático e preserva orçamento/registro de modelo. Erro pausa, sem retry pago. Voz local indisponível impede consultas automáticas no modo voz. Portas e aberturas são referências visíveis, sem garantia de saída. Guia: [ACOMPANHAMENTO-AUTOMATICO.md](docs/ACOMPANHAMENTO-AUTOMATICO.md). Evidência e limites: [LUNA-AUTOMATICO.md](docs/EVIDENCIAS/LUNA-AUTOMATICO.md). Mudança local experimental, não publicada; seções antigas sobre Luna somente sob demanda são históricas.

# Visiora 0.3.0

Protótipo em avaliação de ambientação por voz em pt-BR. Objetos vêm do YOLOX-Nano; pessoas precisam de acordo entre dois dos três detectores Nano/Tiny/S. SigLIP2 e Places365 comparam a mesma imagem inteira para reconhecer o ambiente. Tudo roda localmente, sem API paga. O cérebro escolhe quando falar e mantém silêncio entre mudanças. Não garante segurança e não substitui bengala nem cão-guia.

Não há regra que deduza o lugar pelos objetos detectados. O consenso tem **34 tipos de lugar com nomes compatíveis** entre os catálogos aprendidos; isso continua limitado e não é análise aberta de qualquer lugar. Sem concordância suficiente, responde que não sabe. Há erros mesmo entre respostas aceitas. A tela mostra há quanto tempo a última descrição foi produzida; falas na fila são reavaliadas antes de começar.

## Experimentar

Inicie a ambientação e autorize a câmera. O primeiro acesso baixa cerca de **168 MB de modelos**, além do aplicativo/runtime. Mantenha o aparelho estável e acompanhe o cartão **Reconhecer o ambiente**. Use **Ouvir sobre este lugar** para consultar. Falha dos modelos de ambiente permite nova tentativa e mantém a identificação de objetos. Falha dos verificadores de pessoas interrompe a câmera com aviso; não há troca silenciosa de política.

Para usar localmente, baixe o pacote pela Ajuda ou extraia `artifacts/visiora-local.zip`, abra `iniciar.cmd` com Node.js 24+ instalado e visite http://127.0.0.1:8080. Veja LEIA-ME-LOCAL.txt. A demonstração não usa reconhecimento real. Em Ajustes, teste uma voz local pt-BR ou escolha leitor de tela; sem voz local, há texto com aviso.

A câmera não mede distância nem mantém mapa 360°. Passos e giros da demonstração são simulados. Não há microfone, OCR, reconhecimento facial, análise generativa ou navegação. Histórico começa desligado e só guarda descrições neste navegador quando você permite.

## Desenvolver

Node.js 24+, npm e Python 3.11+ (stdlib para criar ZIP). Em outro computador Windows, com esses programas e Git já instalados:

```powershell
git clone https://github.com/Hills808/Visiora.git
cd Visiora/web
npm ci
npm run build
npm run dev
```

Abra `http://127.0.0.1:8080` nesse mesmo computador e escolha **Modelos locais** para testar sem API. O servidor escuta apenas em loopback; acessar de outro aparelho pela rede exige uma configuração HTTPS própria. Para verificar o código nesta pasta:

```powershell
npm test
npm run typecheck
npm run lint
npm run simulate
npm run dev
```

`dev` serve `dist` em loopback; após editar, rode `npm run build`. `node tools/test.mjs` executa build e testes. O build gera o pacote local em `artifacts`, fora dos arquivos individuais publicados. O navegador também monta esse ZIP com fflate, incluindo somente arquivos estáticos e instruções.

Sem serviço Python obrigatório, API paga ou inferência na nuvem. Modelos, hashes, revisões e licenças estão em `public/models` e `public/licenses`. Pesos maiores são divididos em partes de até 20 MB, reconstruídos e verificados antes de rodar. O modelo textual SigLIP2 só preparou os vetores offline e não é distribuído. Places365 tem pesos CC BY sem versão indicada pelos autores, com atribuição incluída; seu código tem MIT. Cache offline tem botão explícito e ainda não foi verificado com rede desligada.

## Verificações e pesquisa

Veja `docs/EVIDENCIAS/RECONHECIMENTO-0.3.0.md`, `docs/DECISOES.md` (ADR-014/015) e `docs/LIMITES.md`. Em 40 imagens novas, ambientes passaram de 14 acertos/1 erro/25 dúvidas para **16/1/23**, contando famílias equivalentes nos dois métodos. Ganho pequeno, com nove acertos novos e sete acertos anteriores omitidos. Em outras 30 imagens novas, pessoas passaram de 24 acertos/6 falsos/32 omissões para **29/5/27**. Cadeiras permaneceram em **6 acertos, 1 falso e 49 omissões**: este problema não foi resolvido. Não é avaliação brasileira nem validação com pessoas cegas/baixa visão.

QA com Chrome instalado no caminho Windows padrão ou `CHROME_PATH`:

```powershell
node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures
node tests/e2e/scenes.mjs http://127.0.0.1:8080 --fixtures
node tests/e2e/people.mjs
```

`--fixtures` substitui HTTP por arquivos locais; não testa servidor, rede nem service worker. `people.mjs` sempre usa esse transporte. Pesos WASM são reais; câmera e voz são simuladas. Insumos de QA não entram no produto. O teste de objetos usa [dog.jpg do YOLOX](https://raw.githubusercontent.com/Megvii-BaseDetection/YOLOX/main/assets/dog.jpg), convertido em `artifacts/vision/dog.y4m`; axe-core 4.14.0 vem do `package-lock.json`. O teste de lugar usa uma imagem positiva selecionada em `artifacts/scene/browser.y4m`. O de pessoas usa a foto pública COCO val2017 23899 convertida em `artifacts/recognition-upgrade/people.y4m`. São testes de integração, não de precisão.

Reprodução dos benchmarks requer downloads e dependências opcionais descritos na evidência. Scripts, protocolos congelados, todas as previsões e fontes sem fotografias foram preservados em `docs/EVIDENCIAS/0.3.0/`. `tools/prepare_recognition_models.mjs` verifica e divide os três pesos adicionais já obtidos; não baixa nem treina modelos. Nenhum script de pesquisa roda no aplicativo. Um clone limpo com Node/npm já instalados gerou o build em 22,87 s; outra cópia respondeu HTTP 200. Ainda falta repetir o roteiro com uma pessoa de fora e medir instalação dos pré-requisitos. [Evidência](docs/EVIDENCIAS/ESTABILIDADE-INSTALACAO-2026-10-23.md).

## Documentos e publicação

O plano completo continua sendo a referência do produto. Decisões de escopo estão nos ADRs; mudanças de fala exigem verificar testes e transcrições. Evidências anteriores são históricas.

Site privado com identidade preservada em `.openai/hosting.json`. Para publicar alterações, use o fluxo oficial do Sites com a mesma identidade. O pacote local independe da hospedagem.

## Próxima etapa planejada: Luna 6

Arquitetura e tarefas estão em [PLANO-MIGRACAO-LUNA-6.md](docs/PLANO-MIGRACAO-LUNA-6.md). Para continuar, leia [RETOMADA-LUNA-6.md](docs/RETOMADA-LUNA-6.md). Documentação somente: a versão publicada continua 0.3; nenhuma integração Luna ou chamada paga foi realizada nesta etapa.


## Integração Luna local implementada (ainda não publicada)

Leia [CONFIGURAR-LUNA.md](docs/CONFIGURAR-LUNA.md). Luna é a opção principal no novo seletor, com consultas sob demanda, snapshots com idade e nomes abertos. Chave somente no servidor; API começa desligada e orçamento zero. Para experimentar sem cobrança, faça build e rode `npm run dev:luna` com `VISIORA_PROVIDER=fake`. A resposta fake padrão é artificial e vazia. O pacote offline continua oferecendo somente os modelos locais. Testes e limites em [LUNA-INTEGRACAO-LOCAL.md](docs/EVIDENCIAS/LUNA-INTEGRACAO-LOCAL.md). Nenhuma chamada real ou ganho de qualidade medido.
## Ferramenta separada: orquestrador de IA

O protótipo de orquestração para tarefas de desenvolvimento fica em [ORQUESTRADOR-IA.md](docs/ORQUESTRADOR-IA.md). `node tools/ai-orchestrator/cli.mjs preview "pedido"` funciona sem rede; `run` requer chave, orçamento próprio e `--allow-paid-api` e pode cobrar API. Ele produz plano e resultados textuais, sem alterar o Visiora ou outros projetos.

## Conferir o modelo devolvido pela API

No piloto local Luna, reinicie o gateway após atualizar o código. A próxima resposta registra `visiora_model_response` no terminal e metadados em SQLite. Use `npm run luna:models` em outro terminal para consultar o modelo solicitado, o informado e a conferência (`verified`, `mismatch`, `missing`, `invalid`). Apenas `gpt-6-luna` exato é aceito. Modelo ausente ou diferente bloqueia análise/voz e preserva a reserva, sem repetir chamada. Registros antigos não são confirmados retroativamente. Isso confirma o campo da API, não a precisão do reconhecimento. [Evidência e limites](docs/EVIDENCIAS/LUNA-MODELO-RESPOSTA.md).
