# Movimento, atualidade e alvo iPhone — ADR-045

**Alvo declarado:** iPhone com câmera traseira. **Escopo executado:** lógica e integração com entrada, evidência e saída simuladas no Chrome Windows. Não é aprovação para caminhar guiado pelo app.

## Entrega e motivo

Uma vista A invalidada em B não recupera posições ao retornar a A; fica pendente uma captura nova, respeitando cadência, recuperação, consentimento e orçamento. A saída automática obsoleta não ocupa a voz com contexto antigo antes dessa substituta. Duas respostas com vista perdida produzem um único aviso curto; somente entrega recente pode zerá-lo. Estado consultável distingue análise, espera de saída, recuperação, pausa e ausência de descrição recente, sem anúncio periódico.

Luna usa idade da captura, passado e setores relativos à câmera. Exemplo simulado: “Na imagem capturada há 1 segundo: O ambiente parecia escritório. À frente da câmera, havia uma cadeira.” Manual e Repetir continuam explicitamente históricos. Não se infere orientação corporal nem distância. As seis transcrições do cérebro local permanecem com o contrato anterior; [seis cenários de memória Luna atualizados](MOVIMENTO-TRANSCRICOES-2026-10-24.jsonl).

Leitura opcional de giros em Ajustes, desligada por padrão, pede permissão no gesto; só escuta durante Luna visível. Dois eventos próximos, completos e finitos confirmam rotação pela norma dos eixos, sem preservar dados brutos. Autorização sem leituras não vira indicação de sensor funcionando. Parada, segundo plano, pagehide e desativação retiram escuta. O sensor retira posições; não detecta caminhada, translação ou obstáculos. Limiares são hipóteses, sem calibração física.

Cancelamento de fala por Ajustes/mute não confirma conteúdo nem deixa a sessão bloqueada até timeout. Fala preparada que não começa no TTL, ou cuja captura expira antes de começar, permite uma recuperação após 15 s e pausa na segunda expiração. Repetição/contexto não reiniciam essa contagem. Saída histórica sem callback inicial também expira e libera a fila, sem solicitar captura paga por esse motivo.

Diagnóstico em memória, limitado por sessão: captura→resposta, preparação→início, captura→início e início→conclusão, p50/p95, retiradas por vista/expiração/cancelamento. Voz e disponibilidade de texto são separados; replay não acrescenta amostras de conteúdo novo. `simulated` identifica percepção fake, não comprova ou mede voz acústica. Sem imagem, transcrição, identificação pessoal ou leituras brutas de sensor no diagnóstico.

## Orquestração realmente executada

| Trabalho | Agente/modelo | Resultado |
| --- | --- | --- |
| Triagem do fluxo | `movimento_fluxo_sol`, GPT-6.1 Sol | Identificou A→B→A e bloqueios de análise/saída; leitura sem mudanças |
| Protocolo e evidência H2 | `movimento_evidencia_luna`, GPT-6 Luna | Protocolo de avaliação com clipes/anotação e participantes estacionários |
| Sessão, métricas e giro | `movimento_session_sol`, GPT-6.1 Sol | Implementação inicial e testes; limite de uso interrompeu a etapa final |
| Revisão crítica | `movimento_risco_astra`, GPT-6 Astra | Reproduziu problemas de cancelamento, métrica textual, aviso leitor, recuperação e replay; correções incorporadas |
| Integração final | agente principal | Entrada/permite sensor, interface, recuperação final, documentação, testes e empacotamento |

Delegação pelas ferramentas desta sessão, sem executar CLI pago do repositório. Custo/tokens por agente não foram informados pela ferramenta. Zero requisições reais à OpenAI para esta revisão. Chave, ledger, teto US$ 2/dia e configuração do modelo não foram alterados. Skills aplicadas: `visiora-evaluation` e `sites:sites`.

## Verificação

Critérios exercitados em simulação: CA-F3/F4/F5/F6/F7, CA-P6, CA-D4, CA-A1/A3, CA-E1/E5 e CA-L3/L4. Metas de percepção CA-H3/H4/H10 continuam sem aceite físico/humano.

- **183/183 testes passaram**, tipos estritos e lint passaram; cobertura de linhas do cérebro 99,08%. Auditoria automática em 390/1440 px passou com detalhes fechados/abertos, tema escuro/texto ampliado e novo painel de giros aberto, sem violações sérias/críticas ou de contraste reforçado. Teclado e dimensões mínimas de alvos passaram. Não equivale a ensaio VoiceOver.
- E2E `tests/e2e/luna-movement.mjs`: **13 cenários passaram**, sem erros de página; vídeo sintético, provedor fake, controle simulado de fala/giroscópio. Inclui ação do botão de permissão, desligado por padrão, giro com pixels iguais, cancelamento/retomada via Ajustes e métrica/aviso no ramo leitor. `artifacts/e2e-luna-movement/result.json`, 17 chamadas fake. Os ~103 ms observados até despacho inicial são medição do teste, não latência do Luna nem do iPhone.
- E2E `tests/e2e/luna.mjs`: **10 cenários passaram**, zero erros, 7 chamadas fake; `artifacts/e2e-luna/result.json`.
- Problemas encontrados durante teste: preferência leitor persistida entre cenários foi isolada por contexto descartável; uma execução começou durante rebuild e encontrou arquivos indisponíveis. Execuções seguintes usam build concluído. Os resultados negativos não são evidência de defeito do iPhone.

## O que não foi testado

Safari/iPhone físico, lente traseira efetiva, sensor/permissão real, VoiceOver, voz audível, bateria/aquecimento, dados móveis, percepção em caminhada, detecção de obstáculos/degraus/vidro, qualidade dos modelos, precisão espacial, profundidade, uso prolongado, pessoas cegas/baixa visão ou profissional de O&M. **Zero sessões humanas nesta revisão.** Não satisfaz CA-A2/A4/A5, CA-P1/P2/P5, CA-D1/D2/D3/D5 ou gates H2/H3 por esses testes. Persistem erros possíveis de classe, omissões e desatualização por mudanças pequenas/translação que pixels/sensor não captam.

## Próxima decisão por evidência

Executar [AVALIACAO-MOVIMENTO.md](../AVALIACAO-MOVIMENTO.md) no iPhone, com operador parado e clipes anotados, antes de qualquer ensaio supervisionado com deslocamento. Medir eventos→fala e omissões em janelas úteis. Avaliar detector local rápido separadamente do Luna de contexto, sem habilitar fala local por resultado fake. Nenhum modelo novo foi escolhido ou baixado nesta revisão.

Referências consultadas: [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) para permissões/eixos/unidades; [estudo ASSETS de assistentes de vídeo com participantes cegos](https://arxiv.org/abs/2508.03651) e [avaliação de VideoLLMs em perigos](https://arxiv.org/abs/2505.04488) para formular cenários e limites. As pesquisas não validam o Visiora nem substituem seu benchmark.
