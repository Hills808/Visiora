# Especificação de Requisitos de Software — Visiora

**Identificador:** ERS-VIS-001 · **Versão:** 1.0 · **Data:** 23/10/2026 · **Estado:** linha de base proposta para revisão com usuários e O&M.

Esta ERS segue a organização e os princípios de requisitos verificáveis da **ISO/IEC/IEEE 29148:2018**, edição vigente em 23/10/2026. Ela não declara certificação ou conformidade formal auditada. A [ISO](https://www.iso.org/standard/72089.html) informa que a edição de 2018 foi confirmada em 2024; há uma revisão em desenvolvimento. O texto integral da norma é licenciado e não foi reproduzido aqui.

## 1. Introdução

### 1.1 Objetivo e público

Especificar o comportamento, interfaces, restrições e critérios de aceitação do protótipo Visiora para desenvolvedores, avaliadores, instrutores de Orientação e Mobilidade (O&M) e pessoas usuárias. A fonte de verdade para critérios detalhados `CA-*` é [PLANO-COMPLETO-VISIORA.md](PLANO-COMPLETO-VISIORA.md), seção 11; as decisões que sucedem o plano estão em [DECISOES.md](DECISOES.md).

### 1.2 Escopo

O Visiora descreve por texto e voz, em pt-BR, elementos visíveis do ambiente com direção relativa à câmera. O modo **local** processa imagens no aparelho; o modo **Luna** é opcional, depende de gateway e consentimento para envio de capturas à OpenAI, e pode gerar cobrança dentro do limite configurado. O produto forma referências linguísticas temporárias para ambientação. **Não é um sistema de navegação segura**, não garante caminho livre e não substitui bengala, cão-guia ou O&M.

### 1.3 Convenções e termos

- **Deve** indica requisito obrigatório; **pode** indica capacidade opcional.
- **Captura:** imagem e carimbo de tempo obtidos da câmera. **Snapshot Luna:** interpretação de uma captura específica, com idade visível, até o limite de validade.
- **Dito:** item cuja saída de voz começou e terminou validamente; texto planejado, cancelado ou expirado não conta.
- **Implementado:** existe no código e tem teste ou evidência indicada. **Parcial:** existe, mas o critério completo não foi demonstrado. **Planejado:** não está disponível no fluxo normal. Esses estados são informativos e não substituem o aceite.

### 1.4 Referências

[ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html) · [Plano do produto](PLANO-COMPLETO-VISIORA.md) · [Arquitetura](ARQUITETURA.md) · [Limites](LIMITES.md) · [Decisões](DECISOES.md) · [Plano híbrido](PLANO-PERCEPCAO-CONTINUA.md).

## 2. Descrição geral

### 2.1 Usuários e ambiente operacional

Público principal: pessoas cegas ou com baixa visão, adultas, que usam pt-BR, teclado, ampliação ou leitor de tela. Público de apoio: familiares, avaliadores e instrutores de O&M. O piloto web requer navegador com câmera; a versão local funciona sem API paga. O modo Luna requer Node 24+ no computador do gateway, internet, chave mantida no servidor, teto configurado e consentimento explícito. O gateway atual escuta somente em `127.0.0.1`; acesso por outro computador ainda não é suportado.

### 2.2 Premissas e dependências

A câmera pode perder quadros, a iluminação pode mudar, o detector pode errar e a voz local pt-BR pode não existir no aparelho. Direção é relativa à câmera, não à posição corporal medida. Nenhum modelo atual fornece profundidade métrica validada. O modo Luna descreve capturas espaçadas, não vídeo interpretado continuamente. A interface deve comunicar indisponibilidade, idade da informação e incerteza sem inventar fatos.

### 2.3 Restrições e exclusões

Não prometer detecção confiável de portas, degraus, buracos, vidro, saída física ou rota segura. Não inferir distância em passos sem profundidade válida. Não ativar fala local híbrida no modo Luna antes dos gates H2/H3. Funcionalidades como mapeamento 360°, OCR, alerta de aproximação real, gateway compartilhado e navegação por múltiplos computadores são evolução planejada, não parte disponível do piloto.

## 3. Requisitos funcionais

Cada linha é uma obrigação testável. IDs `RF-*` pertencem a esta ERS; `CA-*` apontam para o aceite existente. O estado reflete apenas a evidência disponível em 23/10/2026.

| ID | Requisito | Verificação / aceite | Estado |
| --- | --- | --- | --- |
| RF-01 | O sistema deve iniciar e encerrar uma sessão de câmera por ação explícita e liberar câmera e workers ao encerrar. | E2E início/parada; CA-H1/H9. | Parcial: testes com câmera simulada. |
| RF-02 | O sistema deve permitir escolher análise local ou Luna antes de iniciar; o Luna deve exigir configuração e consentimento específico para envios automáticos. | E2E de modo/consentimento; CA-L1/L2. | Implementado; uso físico não revalidado nesta ERS. |
| RF-03 | No modo local, o sistema deve identificar somente classes suportadas e usar consenso de pelo menos dois YOLOX para mencionar pessoas. | Testes de contrato, consenso e E2E; CA-P3/P6. | Implementado; qualidade geral pendente. |
| RF-04 | No modo Luna, o sistema deve analisar a primeira captura recente e alterações relevantes sem exigir pergunta obrigatória, respeitando uma chamada por vez, cadência, consentimento e orçamento. | E2E fake e diagnóstico; CA-L1/L3/L4. | Implementado; custo/latência reais não revalidados nesta ERS. |
| RF-05 | Toda referência espacial falada deve usar uma frase fixa para o setor relativo à câmera; distância em passos só deve aparecer com profundidade válida. | Testes de fala/propriedades; CA-F2/F3/P6. | Implementado na lógica; direção física pendente. |
| RF-06 | O sistema deve manter silêncio quando não houver novidade material e limitar repetição a entidade nova, aproximação válida ou pedido explícito. | Simulador com 12 sementes e 5 min; CA-F1/F4. | Implementado em simulação; webcam estática pendente. |
| RF-07 | Uma fala cancelada, expirada ou que não iniciou no prazo não deve confirmar o item como dito; uma fala iniciada validamente pode concluir como histórica se a vista continuar válida. | Testes do narrador e Luna; CA-F6/L4. | Implementado; audibilidade independente pendente. |
| RF-08 | O sistema deve oferecer perguntas sob demanda para descrição, o que há à frente, busca de referência e repetição, com resposta honesta quando não souber. | E2E de perguntas; CA-F3/F9/L1. | Implementado em parte; cobertura de vocabulário limitada. |
| RF-09 | O sistema deve apresentar texto equivalente à fala, idade da descrição e estado de câmera, modo, voz, GPU/CPU e erros em linguagem compreensível. | Inspeção UI, E2E e diagnóstico; CA-A1/E5/H2. | Parcial: leitor de tela físico pendente. |
| RF-10 | O usuário deve conseguir pausar voz, parar a sessão, revogar novos envios Luna e apagar os dados locais controlados pelo aplicativo. | E2E de controles/armazenamento; CA-S4/H9. | Implementado localmente; retenção do provedor não é controlada pelo app. |
| RF-11 | O sistema deve exportar diagnóstico somente sob ação do usuário, sem pixels ou texto das descrições, incluindo contagens, tempos, erros e provedor local. | Teste de diagnóstico; CA-S1/S4. | Implementado; auditoria completa de disco/rede pendente. |
| RF-12 | Se a GPU não iniciar ou falhar durante o modo local, o sistema deve informar o uso da CPU e conservar a mesma política de detecção, sem aproveitar quadro incompleto. | E2E GPU/CPU e teste de falha; CA-H7. | Implementado em teste simulado; perda física de GPU pendente. |

## 4. Interfaces externas

| ID | Interface e requisito | Verificação | Estado |
| --- | --- | --- | --- |
| RI-01 | Câmera: solicitar vídeo sem áudio, descartar quadros velhos e não manter fila crescente. | Testes de captura e CA-D4/H1. | Parcial em câmera simulada. |
| RI-02 | Saída: texto pt-BR, voz local pt-BR quando disponível, controles por teclado e equivalente textual para leitor de tela. Ausência de voz deve ser informada. | CA-A1/A2, testes de Speaker. | Parcial; NVDA/VoiceOver/TalkBack físicos pendentes. |
| RI-03 | Gateway Luna: aceitar somente origem local prevista, validar formato, modelo retornado e reserva de orçamento; guardar chave apenas no servidor. | Testes de gateway; CA-L2/L3/S2. | Implementado localmente; gateway compartilhado planejado. |
| RI-04 | Armazenamento: histórico opcional limitado, configurações locais e ledger Luna em SQLite no servidor, sem gravar imagens por padrão. | Testes de storage/ledger; CA-S1/S4. | Parcial; auditoria completa do sistema pendente. |

## 5. Requisitos não funcionais

| ID | Requisito mensurável | Verificação / aceite | Estado |
| --- | --- | --- | --- |
| RNF-01 | O sistema não deve afirmar segurança, caminho livre ou saída garantida; alertas, se implementados, devem ser raros e rotulados experimentais. | Revisão de todas as falas/UI; CA-F2/P6. | Parcial; avaliação humana pendente. |
| RNF-02 | O modo local deve atingir p50 ≤150 ms e p95 ≤400 ms de quadro até resposta de percepção no PC de referência, sem remover verificadores de pessoas. | Medição integrada CA-D1/H4. | Parcial: inferência de objetos e ambiente acelerada em fixture GPU; falta medir captura até resposta integrada e outros PCs. |
| RNF-03 | O sistema deve rejeitar 100% dos resultados com mais de 3 s para fatos locais, sem fila crescente; snapshot Luna deve exibir idade e respeitar seu prazo próprio. | Testes de carga/idade; CA-D4/L4. | Implementado em testes; carga física pendente. |
| RNF-04 | A interface deve ser responsiva, com contraste padrão ≥7:1, alvos ≥44 px, operação por teclado e zero violações axe sérias/críticas. | CA-A1/A3; auditoria desktop/celular. | Parcial: E2E 390/1440 px, alvos e axe passaram; leitores e aparelhos reais pendentes. |
| RNF-05 | O fluxo iniciar → ambientação → pergunta → parar deve ser concluído com NVDA, VoiceOver e TalkBack; aceite final requer CA-A4/A5 com pessoas cegas. | Roteiro manual e estudo consentido. | Não executado. |
| RNF-06 | Imagens devem permanecer em memória por padrão; sem telemetria remota no modo local; gateway deve escutar loopback por padrão e não expor chave ao navegador. | CA-S1/S2/S3/H9. | Parcial; rede/disco completos não auditados. |
| RNF-07 | Código deve passar testes, lint, tipos e simulador; versões/licenças de modelos devem ser registradas. | CA-E1/E4; pipeline CI. | CI remoto verde para esses comandos; E2E do aceite completo ainda pendente. |
| RNF-08 | A sessão deve manter 30 min sem queda nem crescimento de RAM >10%, e a instalação limpa no Windows deve funcionar em ≤15 min. | CA-D5/E3; ensaio cronometrado. | Não executado. |
| RNF-09 | No modo Luna, nenhum envio automático deve ocorrer sem consentimento atual e reserva dentro do limite diário configurado; erros de acesso/orçamento não devem gerar nova chamada automática. | Testes de budget/continuidade; CA-L2/L3. | Implementado em testes; reconciliação de cobrança externa pendente. |
| RNF-10 | Referências faladas devem ter no máximo 3 itens por frase e até 25 palavras em atualização equilibrada; memória antiga deve ser rotulada como antiga. | Testes de transcrição; CA-F7/F8. | Implementado em simulação. |

## 6. Requisitos de design e experiência

**RD-01:** A interface deve usar hierarquia visual clara, layout responsivo, tipografia legível e controles grandes; a informação principal deve caber sem rolagem horizontal em telas pequenas. **RD-02:** Estado e ação devem ter nomes distintos: iniciar/parar, modo de análise, consentimento, descrição atual e idade da captura. **RD-03:** Cor ou animação não devem ser o único meio de transmitir estado; texto e foco de teclado devem permanecer compreensíveis. **RD-04:** O design deve respeitar preferência de movimento reduzido e oferecer tema de alto contraste/fonte ampliada. **RD-05:** O modo local e o Luna devem explicar custo e privacidade antes da escolha, sem induzir consentimento. Verificar com CA-A1/A3, inspeção de interface e avaliação com usuários CA-A4/A5. Estes requisitos orientam refinamento do design existente; não significam que a experiência esteja validada.

## 7. Rastreabilidade e gestão de mudanças

| Grupo ERS | Origem e aceite | Evidência atual ou lacuna |
| --- | --- | --- |
| RF-01, RF-02, RF-04, RI-01, RI-03, RNF-09 | ADR-017/020/021/023/025/029; CA-L*, CA-H1/H2/H9 | `EVIDENCIAS/H1-CAPTURA-COMPARTILHADA.md`, testes Luna; custo real não medido. |
| RF-03, RF-05 a RF-08, RNF-01/03/10 | Plano §7/11; ADR-024/026/030; CA-F*, CA-P3/P6 | Simulador, testes de fala, `EVIDENCIAS/H2-PERCEPCAO-LOCAL-2026-10-23.md`; precisão física pendente. |
| RF-09 a RF-12, RI-02/04, RNF-04/06, RD-* | Plano §8/11; ADR-030/032; CA-A*, CA-S*, CA-H7 | E2E e testes locais; leitor de tela, disco/rede e GPU física perdida pendentes. |
| RNF-02/05/08 | Plano §11 e plano híbrido §9; CA-D1/D5/E3/A4/A5/H4/H11 | Não aceitos; exigem medição e estudo físico/humano. |

Mudanças que afetem fala, privacidade, custo ou modelos devem atualizar este documento, [DECISOES.md](DECISOES.md), testes/transcrições e a evidência `CA-*` correspondente. Requisitos planejados devem continuar identificados como planejados até serem implementados e medidos. O aceite final do produto só ocorre após CA-A4 e CA-A5 com participantes reais; até lá, a designação é **protótipo em avaliação**.

## 8. Pendências de validação desta ERS

Revisar os requisitos com pessoas cegas/baixa visão e instrutor de O&M; resolver prioridades de fala e vocabulário por pesquisa consentida; medir precisão e latência em cenas brasileiras anotadas; testar webcam, áudio, leitores de tela, GPU perdida, 30 min, RAM, instalação limpa e custo real Luna. Não houve sessão de validação de requisitos com esses participantes para esta versão do documento.
