# CA-A1/A3/E1/L4 — interface simplificada, 24/10/2026

## Referências e decisões

Fontes oficiais consultadas:

- [Be My Eyes: primeiros passos](https://support.bemyeyes.com/hc/en-us/articles/360005528557-Getting-started-with-Be-My-Eyes): captura como ação principal, perguntas adicionais e histórico em ações separadas. Adotamos hierarquia de ação, sem copiar o fluxo de conversa ou a identidade visual.
- [Seeing AI: histórico oficial do aplicativo](https://www.seeingai.com/ios): organização por tarefa, com funções de leitura, descrição e outras opções. Adotamos divisão entre ambientação principal e recursos secundários. O [manual oficial](https://www.microsoft.com/en-us/garage/wp-content/uploads/2025/04/Seeing-AI-User-Manual.pdf) reforça que resultados dependem do contexto; não transferimos capacidades ou alegações do produto para o Visiora.
- [Google Lookout](https://support.google.com/accessibility/android/answer/9031274?hl=pt-BR): seleção de modo, controles de leitura e configurações separados. Adotamos modo identificado e configurações em área própria, mantendo os limites do protótipo.

São referências de organização, não prova de usabilidade do Visiora. Nenhum ativo, logotipo, fonte ou biblioteca foi copiado/adicionado.

## Implementação

Navegação clara e mais estreita; cores neutras com verde da marca; texto de apoio legível; uma única frase de apresentação. A autorização vem antes de iniciar, e o controle principal vem antes da prévia. O consentimento de nuvem aparece apenas ao escolher Luna. A descrição mantém destaque, sem aspas/onda decorativas. Quatro perguntas compactas substituem cartões grandes. Contexto e referências ficam em detalhes expansíveis; erros do reconhecimento local abrem a área para preservar acesso à mensagem e à tentativa de recuperação. Estados da câmera, fala e falha permanecem disponíveis. Ajustes, tema escuro, texto ampliado, atalhos e equivalentes textuais foram preservados.

Não alterados: modelo/prompt, captura automática, voz/narrativa, consentimento exigido pelo gateway, cotas, chave, registros financeiros ou acesso privado. Sem geração paga ou câmera física para verificar o visual.

## Orquestração executada

| Etapa | Agente/modelo | Entrega |
| --- | --- | --- |
| Análise de experiência | `visual_ux_luna`, GPT-6 Luna | Oito prioridades de simplificação, leitura de produto/limites/HTML/CSS; sem editar ou chamar API |
| Estilos | `visual_css_sol`, GPT-6.1 Sol | Refatoração do CSS, temas, reflow, contraste e alvos |
| Integração e referências | agente principal, GPT-6.1 Sol | Pesquisa oficial, HTML/TS de apresentação, variantes pública/privada, documentação e publicação |
| Revisão independente | `visual_qa_sol`, GPT-6.1 Sol | Testes e achados sobre início abaixo da dobra, texto colado e erro recolhido; correções incorporadas |

Não foi executado o CLI pago `tools/ai-orchestrator`; a delegação usou as ferramentas de subagentes desta sessão. Tokens/preço por subagente não foram fornecidos pelas ferramentas; não há cálculo inventado de economia.

## Verificação e limites

Primeira passagem: 165 testes, tipos, lint e transcrições passaram. A auditoria do navegador passou em 390 e 1440 px, com detalhes fechados/abertos e tema escuro com texto ampliado, sem violações sérias/críticas ou de contraste reforçado. Os achados de UX motivaram uma segunda passagem após ajustar a posição de início e os avisos.

Resultados finais: tipos, lint e auditoria de acessibilidade passaram. Nas larguras 390/1440, com detalhes fechados/abertos e tema escuro com fonte ampliada, não houve violações sérias/críticas ou de contraste reforçado. A abertura por teclado passou. Alvos de botão/select ≥44 px e início ≥64 px. Isso é auditoria automática, não conformidade humana validada.

No celular 390×844, o início local ocupa y=534–598 px e o início com consentimento Luna visível y=718–782 px. No notebook 1366×768, respectivamente y=331–395 e y=446–510 px. O início cabe na primeira tela nesses cenários medidos; isso não garante todos os tamanhos de tela ou preferências.

Smoke do navegador com `--fixtures`: nove verificações, zero erros de página; demonstração, consultas, temas, histórico opt-in, exclusão de dados e saída textual. Os arquivos são servidos pelo interceptador do teste; esse smoke não verifica HTTP, câmera real, áudio ou offline. E2E Luna: HTTP loopback real com vídeo público como câmera artificial, voz substituída, dez verificações, sete chamadas a provedor fake e zero erros de página; fala inicial, repetição sem nova consulta, mudança de cena, cancelamento e parada durante análise. Não houve imagem enviada à OpenAI, cobrança nova nem alteração de teto.

Evidências locais: `artifacts/visual-redesign/{desktop,mobile,dark-large}.png`, `qa-measurements-final.json`, `artifacts/e2e/result.json` e `artifacts/e2e-luna/result.json`. Capturas mostram somente interface/demonstração artificial; sem webcam ou descrição privada. Os E2E que inspecionam referências foram ajustados para abrir os detalhes explicitamente; os testes Luna selecionam o modo em vez de depender da opção padrão de uma variante do HTML. Os demais ensaios de visão/GPU/movimento não foram repetidos nesta revisão.

## Publicações confirmadas

- Luna privado: source `bd341457b0073578b160bdc3bb60899c9e052585`, deployment `appgdep_6adc5b6d59a08191a07bb162efadfe14`, succeeded, https://visiora-luna-hills808.hills808.chatgpt.site. O navegador autenticado confirmou o título novo, início antes da prévia, consentimento desmarcado, detalhes recolhidos e “Luna configurado”. Câmera permaneceu desligada.
- Local público: source `75f66c007ade4baaac3c06909db930d3f53c5e20`, deployment `appgdep_6adc5b97e4c881918ae1aa6548321477`, succeeded, https://visiora-ambiente.hills808.chatgpt.site. Público e privado mantêm suas audiências e destinos de análise. A variante pública continua fornecendo o link privado da Luna, sem segredo no cliente.

Não testados: leitores de tela físicos (NVDA/VoiceOver/TalkBack), pessoas cegas/baixa visão, uso prolongado, precisão dos modelos, áudio audível e API paga nesta revisão. Não declarar acessibilidade ou segurança validadas por esses testes.
