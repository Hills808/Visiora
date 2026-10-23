## Exceção para apresentação — 23/10/2026 (ADR-037)

Por autorização do usuário, o teto de reserva do **Luna** no piloto com servidor configurado foi elevado para **US$ 10 no dia 23/10/2026**, no fuso `America/Sao_Paulo`. Esse valor inclui as reservas e os gastos já computados no dia: não é crédito adicional. Às 00h de **24/10/2026**, retorna automaticamente ao teto normal de **US$ 2/dia**, mesmo sem reiniciar o processo. A configuração `VISIORA_DAILY_USD` continua limitada a 2; a exceção só atua com o Luna previamente habilitado e orçamento normal positivo. Histórico, reservas incertas, chave e consentimento permanecem intactos. Para usar o código novo, atualizar o checkout local e **reiniciar o gateway** antes da apresentação. Isso não altera cotas ou faturamento do provedor e não resolve timeout, rede, credenciais ou falhas de voz. O link público estático ainda não oferece Luna. Evidência e roteiro: [EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md](EVIDENCIAS/LUNA-LIMITE-APRESENTACAO-2026-10-23.md).

## Memória e comunicação revisadas (19/10/2026)

ADR-026 implementa novidades visíveis antes de ausências, atualizações até 25 palavras e menos repetição por pequenas oscilações de posição/certeza/lugar. Ausência não recebe direção antiga; uma captura que perdeu sua vista não recupera posições por pixels parecidos. Texto/voz só entram no histórico após entrega válida. Memória linguística não é tracking nem um mapa atual; o modelo/API e US$ 2/dia continuam iguais.

[Evidências](EVIDENCIAS/MEMORIA-COMUNICACAO.md): 150 testes e 34 cenários de navegador com fontes artificiais. [Protocolo MC-01](AVALIACAO-MEMORIA-COMUNICACAO.md) e [ficha vazia](FICHA-AVALIACAO-MEMORIA.csv) preparados, com zero sessões/participantes/avaliações profissionais. Próximo nessa frente: executar sessões consentidas com pessoas cegas e O&M disponíveis, registrar falhas e revisar as hipóteses. H2 e demais gates híbridos continuam pendentes. Build local atualizado; recarregue com Ctrl+Shift+R. Sem API paga, segredo/ledger alterado ou publicação nesta revisão.

## Orçamento vigente: US$ 2 por dia (19/10/2026)

ADR-025 corrige o teto acumulado antigo: o limite é US$ 2 em cada dia de America/Sao_Paulo, renovado à meia-noite, sem teto total do piloto. O histórico permanece; reservas incertas são atribuídas pelo horário original e uma chamada pendente continua bloqueando concorrência. VISIORA_TOTAL_USD foi aposentado e é ignorado. Reinicie o gateway para aplicar (Ctrl+C e npm run dev:luna), depois recarregue a página. Não foi alterado o segredo ou ledger real nem executada chamada paga. As menções anteriores a US$ 2 totais/dia UTC são históricas e sucedidas por esta regra.

## Correção autorizada — movimento e fala Luna (19/10/2026)

O usuário priorizou início sem esperar estabilização e fala menos repetitiva. ADR-024 implementa análise desde o primeiro quadro recente, continuidade com movimento menor e agrupamento por setor. Mudança ampla da vista retira posições anteriores e conserva apenas contexto histórico qualificado; não equivale a medir giro corporal. Essa política sucede a exigência de estabilidade das versões Luna anteriores, preservando o bloqueio de giro medido/simulado do cérebro local, idades, orçamento e demais critérios. [Evidências por CA](EVIDENCIAS/LUNA-MOVIMENTO-FALA.md). Testes artificiais não validam caminhada, precisão ou uso por pessoas cegas. H2 e pesquisa humana permanecem próximos gates; não houve publicação.

## Adendo implementado — H0 técnico e H1 (18/10/2026)

Após autorização do usuário, ADR-023 implementou a primeira fatia do plano portátil: captura compartilhada no modo Luna e consumidor local independente, testado com fake. [Evidência e escopo de aceite](EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md). Nenhum detector novo ativado no uso normal. Não equivale ao aceite global de CA-H* nem conclui pesquisa humana H0: entrevistas, dataset, precisão/latência real e matriz física continuam pendentes. Próximo gate H2; regras de produto, privacidade e orçamento preservadas. Sem publicação.

## Adendo de planejamento — percepção contínua portátil (18/10/2026)

O usuário solicitou planejar a evolução híbrida com Luna considerando PCs/notebooks diferentes. [PLANO-PERCEPCAO-CONTINUA.md](PLANO-PERCEPCAO-CONTINUA.md) e ADR-022 detalham arquitetura, fases H0–H7 e critérios adicionais propostos CA-H1..H11. Esse adendo não altera código nem declara critérios atendidos. Preservar as regras de experiência, qualidade e privacidade e as exceções de Luna já autorizadas nas ADRs anteriores. O estado implementado permanece ADR-021; nenhuma compatibilidade universal, segurança ou latência foi comprovada pelo planejamento.

# VISIORA — Plano completo de produto e arquitetura

> Documento para entregar ao agente de desenvolvimento (OpenAI/Codex). Leia tudo antes de escrever código. Onde este documento diz "verificar", o agente deve checar a versão e a licença atuais na fonte oficial antes de fixar a escolha, e registrar o resultado em `docs/DECISOES.md`.

---

## 0. Como o agente deve trabalhar (leia primeiro)

O projeto anterior falhou por três motivos: virou um conjunto de gambiarras, não era responsivo/profissional e seguiu instruções "ao pé da letra" sem pensar na função geral. Regras para evitar isso:

1. **Pense no usuário final antes de pensar na tarefa.** Antes de cada épico, escreva 5 linhas: quem usa, em que situação, o que ouve, o que NÃO pode acontecer, como saberei que ficou bom. Se a tarefa e o objetivo do produto divergirem, vale o objetivo; registre a divergência.
2. **Sem gambiarra.** Proibido: valores mágicos espalhados, `sleep` para "resolver" corrida, `try/except` que engole erro, código duplicado, arquivo gigante, flags que ninguém documentou. Toda constante vive em um arquivo de configuração com comentário do porquê.
3. **Nada é "pronto" sem evidência.** Cada critério de aceite (seção 11) precisa de teste automatizado, medição registrada ou roteiro de teste manual com resultado anotado. Nunca declarar resultado não verificado.
4. **Pesquisar antes de decidir.** Para cada modelo/biblioteca: versão atual, licença, tamanho, requisitos, benchmark relevante, e uma alternativa. Registrar em `docs/DECISOES.md` (ADR curto: contexto, decisão, alternativas, consequências).
5. **Qualidade profissional:** tipagem estática (TypeScript estrito; Python com type hints e `mypy`), lint, formatação automática, CI rodando testes, logs estruturados, tratamento explícito de erros, README que funciona do zero em máquina limpa.
6. **Iterar em fatias verticais.** Cada fase entrega algo que funciona de ponta a ponta (câmera → fala), mesmo simples, e melhora. Não construir camadas inteiras sem integrá-las.
7. **Honestidade de segurança.** Não afirmar navegação segura nem "acessibilidade validada" sem testes com pessoas cegas. Distâncias são estimativas.

---

## 1. Visão e propósito

**Visiora é uma ambientação por voz para pessoas cegas ou com baixa visão.** A câmera (celular ou webcam) observa; o sistema entende o ambiente, forma um **mapa mental** e o descreve como uma pessoa atenciosa faria:

- "Você parece estar em uma sala de aula. À sua direita, a uns cinco passos, tem uma cadeira. A porta fica atrás de você, à esquerda."
- Nunca "possível obstáculo". Nunca lista seca de rótulos. Nunca repetição cansativa (repetição causa dor de cabeça e cansaço auditivo).

Princípio central: **falar pouco, falar certo, falar na hora certa.** Silêncio é o estado normal.

### O que o produto NÃO é
- Não substitui bengala, cão-guia nem treinamento de Orientação e Mobilidade (O&M).
- Não é um sistema de navegação segura. O canal de alerta de proximidade é auxiliar e experimental.
- Não é leitor de tela do sistema operacional; coexiste com NVDA/VoiceOver/TalkBack.

---

## 2. Público-alvo

**Primário:** pessoas cegas e com baixa visão, adultas, brasileiras (pt-BR), que usam leitor de tela no dia a dia e querem se orientar em ambientes internos (casa, sala de aula, restaurante, escritório, corredor, banheiro, transporte parado).

**Secundário:**
- Instrutores de O&M e familiares que ajudam a configurar e a avaliar.
- Pessoas com baixa visão que preferem contraste alto, fonte grande e o mapa visual.
- Desenvolvedores/pesquisadores (código aberto, simulador).

**Personas para guiar decisões (validar com entrevistas):**
- *Marina, 24, cega congênita, estudante.* Usa NVDA e iPhone. Quer saber onde há cadeira vazia, onde está a porta, quem está por perto. Odeia voz repetitiva e demora.
- *Seu Carlos, 61, perdeu a visão há 2 anos.* Pouca prática com tecnologia. Precisa de um botão grande, instrução curta, e que o sistema funcione sem configurar nada.
- *Joana, 35, baixa visão.* Usa o celular com zoom. Quer o mapa visual com contraste alto e a fala como complemento.

**Restrições de contexto:** uso com uma mão, celular no peito/pescoço ou na mão, ambiente barulhento, fones abertos (precisa ouvir o ambiente real), bateria limitada, internet ruim ou ausente.

---

## 3. Gaps e problemas conhecidos do projeto anterior e como este plano resolve

| Gap/problema | Causa provável | Solução neste plano |
|---|---|---|
| Fala "possível obstáculo", genérica | Descrição por rótulo, sem geometria | Mundo espacial (x,y) com direção e distância em passos; frases geradas por planejador de discurso (seção 7) |
| Repetitivo | Fala a cada quadro/detecção | Memória do que foi dito por objeto; só fala com mudança material; "dito" só após a voz confirmar |
| Fala enquanto o usuário gira | Sem estado de movimento | Bloqueio por taxa de giro; espera a cena assentar |
| Não responsivo/lento | Pipeline síncrono, imagens grandes, modelo pesado no caminho crítico | Cérebro no cliente; percepção por WebSocket com descarte de quadros velhos; orçamento de latência (seção 11) |
| Pouco profissional | Gambiarras, UI improvisada | Design system acessível, testes, CI, ADRs |
| Não entende o lugar | Só objetos, sem contexto | Estimador de tipo de lugar (priors de objetos + classificador zero-shot) com incerteza honesta |
| Memória inexistente | Cada quadro isolado | Mundo persistente da sessão com pose, confirmação, esquecimento controlado |
| Distância sem sentido | Pixels/metros crus | Profundidade métrica + prior de tamanho fundidos; passos quantizados (1–8, depois 10/15/20) |
| Acesso ao leitor de tela | Só voz própria | Modo "leitor de tela" via região `aria-live`, atalhos, mapa em texto |
| Custos | Possível uso de APIs pagas | Tudo local/gratuito (seção 6); nenhuma chamada paga obrigatória |
| Sem validação | Testes só técnicos | Plano de validação com usuários cegos (seção 13) |

---

## 4. Como funciona (visão de usuário)

1. **Abrir e tocar em "Iniciar".** Um botão grande. Primeira fala: "Pronto. Olhando ao redor."
2. **Ambientação.** Em ~4 segundos de câmera estável: "Parece que você está em uma sala de aula. À sua frente, escrivaninhas e cadeiras a partir de cinco passos e um quadro a uns doze passos. A porta fica à direita, a uns oito passos."
3. **Silêncio.** Se nada mudar, nada é dito.
4. **Novidades.** Ao virar ou andar e algo relevante aparecer: uma frase curta ("Há uma porta atrás de você, à esquerda, a uns cinco passos.").
5. **Alertas.** Algo sólido no caminho, escada ou pessoa se aproximando: frase curta, prioridade máxima, pode interromper, som direcional opcional e vibração.
6. **Perguntas sob demanda** (botão, atalho ou voz): "O que há à frente?", "Descrever o ambiente", "Onde estou?", "Onde está a porta/cadeira/…?", "Repetir", "Mapear girando".
7. **Mapear girando.** O usuário gira devagar no lugar; o sistema acompanha por bússola/giroscópio e ao final dá uma descrição completa 360°.
8. **Modos extras (opcionais, locais):** ler texto (placas, cardápio), descrição rica por modelo de visão-linguagem para perguntas abertas ("o que está escrito naquela placa?", "que cor é a camisa?").

---

## 5. Arquitetura

### 5.1 Visão geral

```
┌────────────────────────── Dispositivo do usuário (navegador PWA) ──────────────────────────┐
│ Câmera ─▶ Captura (JPEG ~320–640 px, 5–8 fps)                                              │
│ Sensores: bússola/giroscópio (yaw), acelerômetro (passos)                                  │
│                                                                                            │
│ CÉREBRO (TypeScript, testável sem câmera):                                                 │
│   World (memória espacial) ─▶ SceneEstimator ─▶ Narrator (planejador) ─▶ Realizer (pt-BR)  │
│                                                                   │                        │
│ SAÍDA: fila de fala com prioridade/validade ◀─────────────────────┘                        │
│        voz (Web Speech / voz local) · aria-live · earcons 3D · vibração · mapa (radar)     │
│ DADOS: IndexedDB/SQLite-WASM (preferências, diagnósticos locais, sessões opt-in)           │
└───────────────▲──────────────────────────────────────────────────────────────┬─────────────┘
                │ detecções, profundidade, probabilidades de lugar              │ WebSocket binário
                │                                                               ▼ (quadro + id + timestamp)
┌───────────────┴──────────────── Serviço de percepção local (Python, sem estado) ───────────┐
│ Detector (ONNX Runtime) · Profundidade métrica · Classificador de cena · OCR · VLM opcional│
│ Executa no PC do usuário (CPU/GPU) ou em modo "tudo no aparelho" (seção 5.3)               │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Decisões-chave e justificativas

- **Cérebro separado da percepção.** Percepção produz fatos ("cadeira, caixa, profundidade 3,1 m"). O cérebro decide o que dizer. Isso permite trocar modelos sem mexer na experiência e testar a fala com simulador determinístico. *Este é o maior diferencial do projeto: a qualidade vem do cérebro, não só do modelo.*
- **Cérebro no cliente, em TypeScript.** Latência zero entre decisão e voz, funciona offline, mesmo código em teste e produção.
- **Percepção sem estado.** O servidor não guarda imagens nem sessão; escala e testa fácil; privacidade por construção.
- **Protocolo de quadros com `frameId` e `capturedAtMs`.** O cliente descarta respostas velhas (>3 s) e mede latência real ponta a ponta.
- **Escuta apenas em loopback por padrão.** Exposição na rede local só por escolha explícita, com HTTPS.
- **Sem gravação de imagens** por padrão. Qualquer coleta para melhoria é opt-in, anonimizada e local (seção 8).

### 5.3 Modos de implantação (todos gratuitos)

| Modo | Onde roda | Para quê |
|---|---|---|
| A. PC + navegador | Tudo no PC (Python + navegador) | MVP, desenvolvimento, uso em casa com webcam |
| B. Celular + PC na rede local | Câmera no celular (HTTPS), percepção no PC | Uso móvel em casa, sem nuvem |
| C. Tudo no celular | Detector leve em ONNX Runtime Web/WebGPU ou WASM; sem profundidade pesada | Fase 3; menor qualidade, máxima privacidade/portabilidade |

Decisão: **entregar A primeiro, B em seguida, C como pesquisa** com metas realistas de qualidade.

### 5.4 Módulos e contratos

**Percepção (Python 3.11+, FastAPI, ONNX Runtime):**
- `Detector`: entrada JPEG, saída `[{cls, score, box, ...}]` em classes de um vocabulário do produto (mapeamento COCO/Objects365/Open-vocabulary → léxico Visiora).
- `Depth`: mapa de profundidade métrica interno; função pura que reduz por caixa e por corredor frontal.
- `SceneClassifier`: probabilidades de tipo de lugar (zero-shot com rótulos em inglês internos, saída em chave canônica).
- `OCR`: sob demanda, texto + caixas.
- `Describer` (VLM): sob demanda (nunca no caminho crítico de alerta).
- Cada backend implementa uma interface `Protocol`; há backend `fake` para testes.

**Cérebro (TypeScript):**
- `geometry`: bearing, fusão de profundidade (variância inversa), setores (8), passos.
- `World`: entidades com pose no mundo, associação, confirmação por acertos, contagem de faltas apenas dentro do campo de visão, fusão de duplicatas, velocidade no referencial do mundo (aproximação real, não efeito do giro).
- `SceneEstimator`: priors de objetos por tipo de lugar + classificador; limiar de confiança, margem e histerese; admite "não sei".
- `Narrator`: canais (alerta > resposta > briefing > novidade), memória do que foi dito, confirmação de fala (`markSpoken`/`markDropped`), bloqueio por giro, modos de verbosidade.
- `Realizer`: gera frases em pt-BR (gênero, número, concordância, artigos), uma frase fixa por setor direcional, quantização de distância, agrupamento por setor com no máximo 3 itens por frase.
- `Speaker`: fila com prioridade, validade (TTL), interrupção só para alerta, modo leitor de tela.
- `Simulator`: salas virtuais com verdade-terreno e ruído; caminhadas roteirizadas; base dos testes de regressão do cérebro.

### 5.5 Modelo espacial

- Coordenadas: x à direita, y à frente; pose {x, y, yaw}. Webcam fixa: pose constante. Celular: yaw por sensores, x/y por contagem de passos (opcional).
- Setores: frente, frente-direita, direita, atrás-direita, atrás, atrás-esquerda, esquerda, frente-esquerda.
- Distância: profundidade métrica fundida com prior de tamanho do objeto; incerteza (sigma) viaja junto; quando a profundidade é desconhecida, a distância **não é dita**.
- Esquecimento: objetos estáticos viram "memória antiga" depois de um tempo e são ditos como tal ("vi há uns 20 segundos, pode ter mudado"); dinâmicos expiram em segundos.

---

## 6. Stack gratuita e atual (verificar versões/licenças ao implementar)

**Regra:** custo zero obrigatório (sem API paga, sem cartão). "Gratuito" não significa "fraco": escolher o melhor dentro de licenças permissivas, executável em hardware comum.

| Função | Candidatos recomendados | Notas e licenças (verificar) |
|---|---|---|
| Detecção de objetos | **RT-DETR / RF-DETR / D-FINE / YOLOX** (famílias de licença permissiva) em ONNX; comparar também modelos *open-vocabulary* leves | Pesos Ultralytics YOLO são **AGPL**: usar só se o projeto aceitar AGPL; preferir Apache-2.0/MIT |
| Profundidade métrica | **Depth Anything V2 Metric-Indoor, tamanho Small** | Small é Apache-2.0; Base/Large costumam ser CC-BY-NC (**evitar** se houver chance de uso comercial). Alternativa: Depth Pro/ZoeDepth/Metric3D após checar licença e tamanho |
| Tipo de lugar | **SigLIP2** zero-shot (ou CLIP/OpenCLIP) | Apache-2.0 (verificar); rótulos em inglês internos |
| Descrição/perguntas abertas (opcional) | VLM local pequeno via **Ollama** ou llama.cpp: família Qwen-VL, Moondream, Gemma, SmolVLM (escolher o que roda no hardware-alvo e tem licença permissiva) | Medir latência; nunca no caminho de alerta |
| OCR | PaddleOCR, RapidOCR ou Tesseract (pt-BR) | Apache-2.0 |
| Voz de saída (TTS) | 1) **Web Speech API** do navegador (grátis; no Windows/Edge há vozes "Natural" online/offline conforme disponibilidade); 2) **Piper** ou similar para voz local offline pt-BR | Verificar licença da biblioteca e de cada voz; avaliar naturalidade com usuários |
| Voz de entrada (comandos) | Web Speech Recognition (se disponível) e/ou **Whisper/faster-whisper** local, ou **Vosk** (pt-BR), com vocabulário curto de comandos | MIT/Apache; priorizar palavra-chave simples e botões |
| Raciocínio/linguagem | **Regras + planejador de discurso determinístico** (núcleo); LLM local opcional só para respostas abertas | Determinismo = previsível, testável, sem alucinação em alertas |
| Armazenamento | **SQLite** local (servidor) e **IndexedDB**/SQLite-WASM (navegador); arquivos JSON/Parquet para telemetria opt-in | Sem nuvem |
| Servidor | Python 3.11+, FastAPI, Uvicorn, ONNX Runtime (CPU/DirectML/CUDA conforme máquina) | Windows como alvo de primeira classe |
| Front-end | TypeScript, Vite, PWA, Web Audio, WebSocket, sem framework pesado ou com framework leve | Acessibilidade primeiro |
| Testes | Vitest/node:test, pytest, Playwright, axe-core (acessibilidade), medições de latência | CI gratuito (GitHub Actions) |
| Hospedagem do front | Servido pelo próprio serviço local ou GitHub Pages | Nenhum custo |

**Importante sobre o raciocínio:** o núcleo de "inteligência" do produto é o planejador de discurso (o que falar e quando). LLM generativo no caminho de fala traz latência, custo de hardware e risco de alucinação. Use LLM só como camada opcional para perguntas abertas, sempre sinalizando que é uma descrição auxiliar.

**Pesquisa obrigatória na Fase 0:** benchmark em 30 imagens/vídeos de ambientes internos brasileiros (sala, quarto, restaurante, corredor, banheiro, escola) comparando detectores, profundidade e classificador, medindo precisão percebida, latência em CPU e em GPU, e consumo de memória. Registrar tudo em ADR.

---

## 7. Experiência de voz e linguagem (o coração do produto)

### 7.1 Princípios
1. **Mapa mental primeiro:** tipo de lugar → visão geral → saída.
2. **Direção relativa e distância em passos**, sempre. "À sua direita, a uns cinco passos, uma cadeira."
3. **Frases curtas**, no máximo 3 itens por frase, um setor por frase.
4. **Direção com frase fixa por setor** para formar um mapa mental estável; variar conteúdo, não geografia.
5. **Nada de repetição.** Cada entidade tem registro de quando e a que distância foi dita; só fala de novo se: surgiu algo novo relevante, algo se aproximou de verdade (≤ 60% da distância dita), ou o usuário pediu.
6. **"Dito" só depois que a voz fala.** Fala descartada/expirada volta à fila.
7. **Não fala enquanto o usuário gira** (taxa de giro acima de um limiar) nem logo após outra fala.
8. **Incerteza honesta:** "Talvez seja um restaurante", "Não tenho certeza de que lugar é este", "Não identifiquei objetos à frente, mas não dá para garantir que o caminho esteja livre".
9. **Memória antiga dita como antiga.**
10. **Alertas são raros e curtos:** "Cuidado, cadeira à frente, a uns três passos." / "Atenção, escada à frente…".
11. **Verbosidade ajustável:** só o essencial / equilibrado / detalhado; velocidade de voz; estilo de direção (esquerda/direita ou relógio).
12. **Nunca a expressão "possível obstáculo".** Nomear o objeto; se não souber o que é e houver algo sólido, "Tem algo sólido à frente, a uns dois passos."

### 7.2 Canais e prioridades
`alerta (0, interrompe)` > `aproximação (1)` > `resposta (1)` > `briefing (2)` > `novidade (3)`. Cada fala tem validade (TTL): informação velha é descartada, não falada.

### 7.3 Léxico
Léxico pt-BR versionado (nome, gênero, número, papel: saída/perigo/mobiliário/pessoa, importância, dinâmico/estático). Meta: 60–100 classes úteis no MVP (porta, janela, escada, cadeira, mesa, sofá, cama, vaso sanitário, pia, pessoa, veículo, elevador, catraca, balcão, quadro, TV, armário, geladeira, fogão, degrau, rampa, parede/coluna quando detectável…). Classes que o detector não cobre (degrau, meio-fio, porta de vidro, buraco) são **lacunas declaradas**, não prometidas.

### 7.4 Sons e vibração
- Earcons direcionais (estéreo) para alertas; opcionais.
- Vibração (Android) por padrão em alertas; opcional.
- Volume e uso de fone aberto/condução óssea recomendados na ajuda.

### 7.5 Saída acessível
Modo "leitor de tela" que publica falas em região `aria-live` (NVDA/VoiceOver/TalkBack); todo conteúdo do mapa visual tem equivalente em lista textual; atalhos de teclado; alvos ≥ 44 px (64 px no botão principal); contraste ≥ 7:1 no tema padrão; fonte legível (Atkinson Hyperlegible ou equivalente livre); respeita `prefers-reduced-motion` e `prefers-contrast`.

---

## 8. Dados, privacidade e armazenamento (gratuito e local)

- **Imagens:** processadas em memória e descartadas. Nunca gravadas por padrão.
- **Preferências:** `localStorage`/IndexedDB.
- **Diagnóstico:** métricas agregadas locais (latências, contagem de falas, erros) em SQLite/IndexedDB, visíveis ao usuário, exportáveis manualmente.
- **Coleta para melhoria (opt-in explícito):** consentimento claro em linguagem simples, acessível por voz; gravar apenas fatos (classes, distâncias), nunca imagens, a menos que o usuário ative "contribuir com imagens" separadamente, com rosto desfocado local; botão "apagar tudo".
- **LGPD:** base legal = consentimento; finalidade explícita; minimização; direito de apagar; sem compartilhamento com terceiros; sem telemetria remota por padrão.
- **Segurança:** serviço em loopback; HTTPS ao expor na rede local; validação de tamanho/formato de quadros; limite de taxa; sem execução de conteúdo recebido.

---

## 9. Escopo

### 9.1 MVP (Fases 0–2) — dentro
- Ambientes internos comuns, pt-BR, câmera de celular ou webcam.
- Cérebro completo (mundo, cena, narrador, realizador) com simulador e testes.
- Percepção local com detector ONNX + profundidade + classificador de cena.
- Voz do navegador + modo leitor de tela; mapa visual; lista textual; atalhos.
- Respostas sob demanda: à frente, descrever, onde estou, procurar, repetir, mapear girando.
- Alerta experimental (objeto sólido à frente, escada, pessoa se aproximando).
- Ajuda, ajustes, onboarding falado.
- Docs, CI, ADRs, README funcional em Windows, macOS e Linux.

### 9.2 Pós-MVP (Fases 3–4) — planejado
- Modo "tudo no celular".
- OCR e perguntas abertas por VLM local.
- Comandos de voz de entrada.
- Voz offline local (Piper ou equivalente) e escolha de voz.
- Calibração de passo e de campo de visão guiada.
- Idiomas adicionais (arquitetura já separa léxico e realizador).
- Pacote instalável (Windows) e app empacotado.

### 9.3 Fora do escopo (declarado)
- Navegação externa/rua, travessia, trânsito, GPS, rotas.
- Qualquer garantia de segurança ou de caminho livre.
- Reconhecimento facial / identificação de pessoas.
- Detecção de degraus, meio-fio, buracos e vidro com confiabilidade (pesquisa futura com sensor de profundidade/LiDAR onde existir).
- Nuvem, contas, sincronização.

---

## 10. Demanda e requisitos

### 10.1 Funcionais (resumo; cada um vira história de usuário com critério de aceite)
- RF1 Iniciar/parar com um toque ou tecla.
- RF2 Ambientação automática em até 5 s de câmera estável.
- RF3 Falar só novidades relevantes; silêncio em cena estática.
- RF4 Perguntas sob demanda (6 tipos) por botão/atalho (e voz na fase 3).
- RF5 Mapeamento 360° por giro com descrição final.
- RF6 Alertas de proximidade com escalonamento só quando piora.
- RF7 Procurar objeto por nome (com sinônimos pt-BR) e dizer onde está, com idade da informação.
- RF8 Modo leitor de tela e modo voz própria.
- RF9 Ajustes: voz, verbosidade, passo, campo de visão, estilo de direção, tema.
- RF10 Mapa visual (radar) e lista textual equivalente.
- RF11 Diagnóstico local e exportação.
- RF12 Funcionar sem internet após instalar.

### 10.2 Não funcionais
- RNF1 Latência (seção 11).
- RNF2 Acessibilidade WCAG 2.2 AA no mínimo (AAA para contraste do tema padrão).
- RNF3 Privacidade (seção 8).
- RNF4 Robustez: reconexão automática; degradação elegante se profundidade/cena falharem (continua com o que tem e diz o que não sabe).
- RNF5 Portabilidade: Windows 10/11 como alvo principal; Chrome/Edge/Safari/Firefox recentes.
- RNF6 Manutenibilidade: cobertura do cérebro ≥ 85%, ADRs, CI verde.
- RNF7 Custo operacional R$ 0.
- RNF8 Bateria: modo economia (reduz fps) e aviso de uso prolongado.

### 10.3 Demanda esperada
Uso individual local. Sem servidor central, não há demanda a escalar; o dimensionamento é por dispositivo: 1 fluxo de vídeo, 5–8 fps, resposta por quadro em menos de 250 ms em PC de referência (definir e documentar o PC de referência na Fase 0).

---

## 11. Critérios de aceite (mensuráveis)

Cada critério tem **como medir** e **onde registrar** (`docs/EVIDENCIAS/`).

### 11.1 Experiência de fala
| ID | Critério | Medição |
|---|---|---|
| CA-F1 | Em cena estática por 5 min, no máximo 1 fala após o briefing | Simulador, 12 sementes; e vídeo real estático |
| CA-F2 | Nenhuma fala contém "possível obstáculo", "objeto não identificado" ou lista de rótulos sem direção | Teste de regressão por expressão regular em todas as transcrições |
| CA-F3 | Toda fala sobre objeto traz direção em frase fixa do setor e, quando a profundidade é conhecida, distância em passos | Teste de propriedades sobre `facts` |
| CA-F4 | Nenhum item é repetido sem mudança material (nova entidade, aproximação ≤ 60% ou pedido do usuário) | Simulador com ruído; auditoria de transcrições |
| CA-F5 | Nada é falado durante giro > 15°/s | Teste do narrador com yaw simulado |
| CA-F6 | Falas expiradas/interrompidas voltam à fila e não contam como ditas | Teste do `Speaker` + narrador |
| CA-F7 | Frases com no máximo 3 itens e ≤ 25 palavras em modo equilibrado (briefing até ~45) | Teste automático |
| CA-F8 | Concordância pt-BR (gênero, número, artigos) correta em 100% do léxico | Teste tabela-verdade do léxico |
| CA-F9 | Briefing inclui tipo de lugar quando confiança suficiente; senão diz que não sabe | Simulador com e sem classificador |

### 11.2 Percepção e espaço
| ID | Critério | Medição |
|---|---|---|
| CA-P1 | Erro de bearing mediano ≤ 10° em cenas de teste com verdade-terreno | Conjunto de vídeos anotados |
| CA-P2 | Erro de distância mediano ≤ 25% entre 1 e 6 m (objetos com profundidade conhecida) | Medição com trena em 3 ambientes reais |
| CA-P3 | Fantasmas: ≤ 1 objeto inexistente falado por 10 min de cena estática | Vídeos reais e simulador |
| CA-P4 | Tipo de lugar correto (top-1) em ≥ 80% de 6 ambientes × 5 cenas, ou "não sei" quando abaixo do limiar | Conjunto de teste brasileiro |
| CA-P5 | Aproximação de pessoa a ≥ 0,5 m/s detectada e avisada ≥ 90% das vezes em teste roteirizado; giro da câmera não gera falso aviso | Teste real e simulador |
| CA-P6 | Sem profundidade válida, o sistema não inventa distância | Teste de backend `fake` sem depth |

### 11.3 Desempenho
| ID | Critério | Medição |
|---|---|---|
| CA-D1 | Latência quadro→resposta da percepção p50 ≤ 150 ms, p95 ≤ 400 ms no PC de referência | Telemetria local |
| CA-D2 | Alerta: do surgimento do objeto à fala iniciada p95 ≤ 1,2 s | Teste com vídeo sincronizado |
| CA-D3 | Respostas sob demanda iniciam a fala em ≤ 800 ms | Playwright |
| CA-D4 | Descarte de quadros velhos (> 3 s) = 100%; sem fila crescente | Teste de carga |
| CA-D5 | 30 min contínuos sem vazamento de memória (> 10% de crescimento) nem queda | Teste de resistência |

### 11.4 Acessibilidade e usabilidade
| ID | Critério | Medição |
|---|---|---|
| CA-A1 | 0 violações críticas/sérias no axe-core; navegação completa só por teclado | Playwright + axe |
| CA-A2 | Fluxo "Iniciar → ambientação → pergunta → parar" concluído com NVDA (Windows), VoiceOver (iOS) e TalkBack (Android) | Roteiro manual registrado |
| CA-A3 | Contraste ≥ 7:1 no tema padrão; alvos ≥ 44 px | Auditoria automática |
| CA-A4 | **Teste com ≥ 8 pessoas cegas/baixa visão:** ≥ 80% iniciam e usam sem ajuda após 2 min de instrução; nota média ≥ 4/5 em "não é repetitivo" e "entendo onde as coisas estão"; ≥ 75% dizem que usariam de novo | Protocolo da seção 13 |
| CA-A5 | Nenhum participante relata dor de cabeça/cansaço atribuído à repetição em sessão de 15 min | Questionário |

### 11.5 Qualidade de engenharia
| ID | Critério | Medição |
|---|---|---|
| CA-E1 | CI verde: lint, tipos, testes unitários, simulador, E2E | GitHub Actions |
| CA-E2 | Cobertura do cérebro ≥ 85%; percepção ≥ 70% | Relatório de cobertura |
| CA-E3 | README leva de máquina limpa ao app funcionando em ≤ 15 min (Windows) | Teste cronometrado por pessoa de fora |
| CA-E4 | Zero segredo ou dependência paga; licença de cada modelo registrada | Auditoria de licenças |
| CA-E5 | `docs/LIMITES.md` atualizado e exibido na ajuda do app | Revisão |

### 11.6 Segurança e privacidade
| ID | Critério | Medição |
|---|---|---|
| CA-S1 | Nenhuma imagem gravada em disco por padrão | Teste que inspeciona o sistema de arquivos |
| CA-S2 | Serviço só escuta em loopback por padrão | Teste de porta |
| CA-S3 | Sem requisição de rede externa em uso normal | Captura de tráfego em teste |
| CA-S4 | Coleta opt-in desligada por padrão; "apagar tudo" funciona | Teste E2E |

**Regra de aceite final:** o produto só é chamado "validado" se CA-A4 e CA-A5 forem cumpridos com usuários reais. Até lá, usar "protótipo em avaliação".

---

## 12. Fases, épicos e entregáveis

### Fase 0 — Descoberta e decisões (1–2 semanas)
- E0.1 Entrevistas curtas com 5+ pessoas cegas/baixa visão e 1–2 instrutores de O&M (roteiro: seção 13). Saída: requisitos ajustados, vocabulário real.
- E0.2 Benchmark de modelos gratuitos (seção 6) em ambientes brasileiros; ADRs.
- E0.3 Definir PC de referência, métricas, e conjunto de vídeos anotados (com consentimento).
- E0.4 Design system acessível; protótipo de fala em texto (roteiros de diálogo).
- **Saída:** `docs/DECISOES.md`, `docs/REQUISITOS.md`, `docs/CONJUNTO-DE-TESTE.md`.

### Fase 1 — Cérebro e simulador (2–3 semanas)
- E1.1 Geometria, World, SceneEstimator, Narrator, Realizer, léxico pt-BR.
- E1.2 Simulador com salas, ruído e caminhadas; transcrições de regressão.
- E1.3 Testes de CA-F1…F9 e CA-P5/P6.
- **Saída:** cérebro passando todos os testes de fala sem nenhuma câmera.

### Fase 2 — Percepção real e app (3–4 semanas)
- E2.1 Serviço de percepção com backends reais e `fake`; WebSocket com `frameId`.
- E2.2 PWA: câmera, voz, leitor de tela, radar, lista textual, ajustes, atalhos.
- E2.3 Sensores: yaw, passos; "mapear girando".
- E2.4 Medições CA-P1…P4, CA-D1…D5; ajustes de limiares.
- E2.5 Acessibilidade CA-A1…A3.
- **Saída:** MVP ponta a ponta no PC com webcam e no celular via rede local.

### Fase 3 — Validação com usuários (2–3 semanas, em paralelo com ajustes)
- E3.1 Sessões com ≥ 8 pessoas (seção 13); correções priorizadas.
- E3.2 CA-A2 com NVDA, VoiceOver, TalkBack.
- **Saída:** relatório de validação; decisão de seguir/pivotar com base em evidência.

### Fase 4 — Evolução
- OCR, VLM local, comandos de voz, voz offline, modo tudo-no-celular, instalador, novos idiomas.

---

## 13. Validação com usuários (obrigatória)

- **Parceria:** instituições de apoio a pessoas cegas (ex.: institutos, associações e centros de reabilitação locais) e instrutores de O&M; sempre com consentimento livre e esclarecido (TCLE), sem pagamento obrigatório pelo projeto, com possibilidade de desistir a qualquer momento.
- **Segurança da sessão:** local conhecido e livre de risco, acompanhante presente, nunca testar em escadas, vias ou lugares perigosos; o produto não é usado como único meio de segurança.
- **Roteiro (45 min):** 5 min de explicação; 3 tarefas (descobrir onde está a porta; achar uma cadeira vazia; saber quem está perto) sem e com Visiora; questionário (SUS adaptado + escalas de "repetição", "clareza de direção", "confiança", "cansaço").
- **Registro:** anotar o que foi dito pelo sistema (transcrição automática local, sem vídeo), tempo para concluir tarefas, erros de interpretação de direção/distância, pedidos de repetição.
- **Decisão por evidência:** critérios CA-A4/A5; sem eles, não declarar validação.

---

## 14. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Distância errada gera falsa confiança | Segurança | Dizer distância só se conhecida; passos arredondados; aviso de limite; alerta rotulado experimental |
| Detector genérico não cobre degrau, vidro, meio-fio | Segurança | Declarar lacuna; não prometer; avaliar sensor de profundidade (LiDAR) em fase futura |
| Licenças restritivas (AGPL, CC-BY-NC) | Jurídico | ADR de licença por modelo; preferir Apache/MIT |
| Latência alta em PC fraco | UX | Modelos pequenos, resolução adaptativa, fps adaptativo, modo economia |
| Voz robótica cansa | UX | Escolha de voz, velocidade, teste com usuários; opção de voz local melhor |
| Priors de cena viciados | Precisão | Calibrar com cenas reais; "não sei" quando duvidar |
| Cérebro virar gambiarra com o tempo | Manutenção | Testes de propriedade, simulador, ADRs, revisão |
| Dependência de HTTPS para câmera no celular | Adoção | Guia de certificado local; túnel local gratuito documentado; alternativa PWA instalada |
| Exposição de privacidade | Ético/legal | Seção 8; auditoria CA-S1…S4 |

---

## 15. Estrutura de repositório sugerida

```
visiora/
  apps/web/                 # PWA (TypeScript)
  packages/brain/           # geometria, mundo, cena, narrador, realizador, léxico (TS)
  packages/sim/             # simulador e cenários
  services/perception/      # Python/FastAPI/ONNX (backends + fake)
  tests/{unit,sim,e2e,perf,a11y}/
  docs/{PRODUTO,ARQUITETURA,DECISOES,REQUISITOS,LIMITES,REFERENCIAS,EVIDENCIAS}/
  tools/                    # scripts (benchmark, simulate, servidor estático)
  .github/workflows/        # CI
```

---

## 16. Material de apoio: protótipo de referência

Existe um protótipo funcional (`visiora.zip`) que implementa a lógica do cérebro, o simulador, o app e um serviço de percepção em Python, com 40 testes do cérebro, 13 de percepção e E2E. **Use-o como especificação executável do comportamento esperado** (transcrições do simulador, testes de narrador), não como código final: foi validado apenas com câmera e detector falsos, e os backends reais de profundidade, cena e VLM **nunca foram testados com pesos reais**. O agente pode reaproveitar o que passar nos critérios de aceite e deve reescrever o que não passar, mantendo os testes de comportamento como contrato.

---

## 17. Prompt inicial sugerido para o agente

> Você é o engenheiro responsável pelo Visiora. Leia `docs/PLANO-COMPLETO-VISIORA.md` inteiro e o protótipo de referência. Comece pela Fase 0: (1) proponha por escrito o roteiro de entrevistas e o conjunto de teste; (2) pesquise e faça benchmark dos modelos gratuitos da seção 6, registrando versão, licença, latência e qualidade em ADRs; (3) devolva um plano da Fase 1 com tarefas, testes e critérios de aceite mapeados aos IDs da seção 11. Não escreva código de produto antes de eu aprovar a Fase 0. Em toda entrega: mostre evidências (testes, medições, transcrições), liste o que NÃO foi testado e nunca declare segurança ou validação sem os critérios CA-A4/CA-A5.

## Adendo de planejamento — Luna 6

A migração futura está em [PLANO-MIGRACAO-LUNA-6.md](PLANO-MIGRACAO-LUNA-6.md), com escopo registrado na ADR-016 de [DECISOES.md](DECISOES.md). Leia [RETOMADA-LUNA-6.md](RETOMADA-LUNA-6.md) antes de continuar. Este adendo não altera o funcionamento publicado, não substitui evidências dos critérios de aceite e não autoriza chamadas pagas ou envio de imagens.
