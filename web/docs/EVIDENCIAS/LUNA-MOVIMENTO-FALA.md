# Luna: análise com movimento e fala agrupada

19/10/2026, São Paulo. Correção solicitada pelo usuário após observar espera por estabilidade e repetição de “À sua frente”. Decisão ADR-024. Implementação local, sem chamada paga, alteração de chave/ledger ou publicação.

## O que mudou

- O primeiro quadro recente já permite análise. Movimento de pixels não bloqueia captura, envio, aceitação ou início da voz.
- Mudança pequena/moderada permite a descrição rotulada com a idade da imagem. Mudança estrutural ampla remove posições anteriores, inclusive durante fala; aproveita somente a hipótese histórica do lugar, se houver e ainda não tiver sido dita.
- Até três itens são agrupados por setor. Itens incertos continuam numa oração própria. Direções, limite de palavras e confirmação somente após entrega são preservados.
- Câmera sem quadro recente continua impedida de capturar. Validades de 3 s para quadros/fatos locais e 10 s para snapshots, uma API em voo, intervalo mínimo de 4,5 s, recuperação limitada e orçamento permanecem.

Exemplo da transcrição artificial concluída:

> Simulação de análise. Na imagem capturada há 2 segundos: O ambiente parece quarto. À sua frente, há uma janela com veneziana, uma pessoa e uma cama.

Após mudança ampla durante a análise, o teste entregou apenas “O ambiente parecia quarto”, com o prefixo de idade, sem posições/objetos. Na captura seguinte, os itens omitidos puderam ser ditos. Durante uma fala, a mudança ampla cancelou a descrição direcional uma vez; uma mudança menor não cancelou.

## Evidências executadas

| Verificação | Resultado | Critérios exercitados |
| --- | --- | --- |
| `npm test` (via `node tools/test.mjs`, inclui build) | 131 testes passaram; [saída](luna-movimento/tests.txt) | CA-F1/F2/F3/F4/F7, CA-L1/L3/L4, CA-H2 e regressões existentes |
| Tipos e lint | Passaram; [tipos](luna-movimento/types.txt), [lint](luna-movimento/lint.txt) | Tipos estritos e regras do projeto |
| Formatação de código TS/MJS e HTML | Passou; [saída](luna-movimento/format.txt) | Arquivos de código; ver ressalva abaixo |
| Simulador local | Seis transcrições iguais à H1; [saída](luna-movimento/simulator.txt) | CA-F*: comportamento do modo local preservado |
| `node tests/e2e/luna-movement.mjs` | 7 cenários; [relatório e transcrições](luna-movimento/movement-e2e.json) | CA-F1/F2/F3/F4/F7, CA-P6, CA-L1/L3/L4: início, movimento, fala agrupada, deduplicação, contexto histórico e cancelamento |
| `node tests/e2e/luna.mjs` | 10 cenários; [relatório](luna-movimento/luna-e2e.json) | Fluxo Luna, perguntas, diálogo, parada, erro, layout 390 px |
| `node tests/e2e/luna-continuity.mjs` | 8 cenários; [relatório](luna-movimento/continuity-e2e.json) | Mudança localizada, pessoa ausente, reorientação, recuperação e silêncio |
| `node tests/e2e/hybrid-capture.mjs` | 7 cenários; [relatório](luna-movimento/hybrid-e2e.json) | CA-H1/H2/H9: transporte compartilhado, prazo e cancelamento |

Total: **131 testes e 32 cenários de navegador**, sem erro de página nos quatro relatórios. Contagens não representam ambientes reais avaliados nem aceite global dos critérios. A suíte smoke local não foi repetida nesta revisão; seus nove cenários anteriores são evidência histórica de H1.

No novo ensaio, o envio começou **60,6 ms após a primeira amostra**, antes da antiga janela de estabilização de 1.200 ms. É uma observação de agendamento em Chrome headless 155.0.8059.84 neste PC, com fonte artificial; **não é latência de visão/voz do Luna real nem promessa de desempenho**. A impressão de teste muda a cada frame sem oportunidade de estabilização. API, evidências e voz são artificiais; vídeo público de QA existente. Todos os pedidos permaneceram em loopback, SQLite em memória, sem `.env`.

O teste de continuidade foi atualizado conscientemente: antes esperava descarte mesmo para mudança localizada durante uma consulta, comportamento responsável pelo bloqueio relatado. Agora testa retirada de posições por mudança ampla. O novo E2E cobre separadamente continuidade em movimento menor e mudança ampla durante API/voz. Não se aumentou TTL ou orçamento.

A revisão das transcrições encontrou uma falha que o E2E antigo não detectava: uma pergunta rápida sobre o mesmo frame era rejeitada como resposta expirada, mas o teste contava o aviso de erro como fala e conferia a legenda anterior. O teste agora exige o conteúdo realmente entregue na busca e após fechar Ajustes. A memória permite um pedido novo sobre o mesmo frame com tempo/dimensões intactos, sem renovar a idade; rejeita replay, frame anterior, stamp alterado e expiração. Guarda no máximo 16 IDs por frame, acima do teto de 15 pedidos/minuto do gateway. Há teste unitário específico.

A varredura inicial de formatação também incluiu o JSON histórico `tests/fixtures/person-consensus.json`, que já tinha formatação divergente. [Saída original](luna-movimento/format-full-existing-fixture.txt). Não foi alterado; a verificação de código TS/MJS/HTML passou. Os primeiros erros de tipo na implementação do agrupamento foram corrigidos usando o tipo de setor existente, antes dos resultados acima.

## Não testado / próximos ensaios

Não houve teste com câmera física em caminhada, desfoque, giro corporal medido, API paga, latência/fatura reais, áudio físico, NVDA/VoiceOver/TalkBack, pessoas cegas/baixa visão, outras máquinas/SOs, bateria/RAM prolongadas, detector híbrido real ou site publicado. A heurística de mudança ampla pode errar ou omitir direções úteis; nomes diferentes ainda podem escapar da deduplicação. Não se comprovaram precisão, segurança de navegação, utilidade humana ou CA-A4/A5.

Próximo ensaio do piloto: em ambiente conhecido, conferir início sem espera de estabilidade, movimentação da câmera, atualização após nova vista, itens na mesma direção e silêncio após retorno às mesmas referências. Registrar atrasos e falas incorretas; não usar o protótipo para guiar percurso. Em paralelo ao roteiro humano, o gate técnico seguinte permanece H2: benchmark de reconhecimento e perfis por equipamento.
