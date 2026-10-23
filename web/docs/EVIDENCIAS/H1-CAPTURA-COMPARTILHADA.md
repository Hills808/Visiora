# H0 técnico + H1 — captura compartilhada no piloto Luna

18/10/2026, São Paulo. Implementação local autorizada após ADR-022; decisão em ADR-023. **H1 implementada e ensaiada com detector/voz/API simulados.** H0 ainda tem pendências de pesquisa humana e medições reais. Nenhum modelo novo adotado, chamada paga, alteração de orçamento/ledger real ou publicação.

## Resultado e limite

O modo Luna agora usa `CaptureHub` como único dono da câmera. Observação de movimento e JPEG usam a mesma captura identificada. Um consumidor local independente pode processar quadros enquanto a API ou a voz estão ocupadas. A prova desta fatia injeta um worker de teste, sem reconhecimento semântico e sem acrescentar itens à fala. **No uso normal, o novo detector local permanece desativado até H2/H3.** O modo local histórico preserva sua câmera/modelos; os dois modos continuam mutuamente exclusivos.

Durante **12.019 ms** de espera real de relógio no navegador por uma resposta artificial, o worker concluiu **14 quadros novos**, descartou 28 oportunidades enquanto ocupado, manteve zero quadros na fila e usou uma única solicitação de câmera. Isso mede concorrência de transporte, não latência nem qualidade de um detector. O worker introduz deliberadamente 600 ms de atraso para exercitar sobrecarga. O snapshot atrasado foi recusado pelo limite existente de 10 s; fatos locais não o tornaram atual.

## Base reexecutada antes da alteração

- 109 testes passaram; tipos/lint passaram; 18 cenários dos dois E2E Luna passaram.
- Seis transcrições do simulador guardadas antes e depois, idênticas byte a byte.
- Computador disponível ao ensaio: Windows, versão do sistema reportada `10.0.26200`, x64; Intel Core i7-10700F, 16 processadores lógicos; 25.634.594.816 bytes de RAM reportados por Node. Não é um mínimo aprovado nem um inventário de todos os aparelhos do usuário.
- Node 24.11.0; Chrome headless 155.0.8059.84. GPU não inventariada/medida. Fonte da câmera: vídeo de QA já existente `artifacts/vision/dog.y4m`; nenhuma webcam física ou foto privada.
- Arquivos: [baseline.json](h1/baseline.json), [testes anteriores](h1/baseline-tests.txt), [simulador anterior](h1/baseline-simulator.txt). Tempos de execução dos testes não são tempos de resposta da API/modelo.

## Verificações após a alteração

| Verificação executada | Resultado / arquivo | Alcance |
| --- | --- | --- |
| `npm test` | **127/127**; [saída](h1/tests.txt) | Inclui 18 novos testes de captura, fluxo local e transferência; build incluído |
| `npm run typecheck`, `npm run lint` | Passaram; [tipos](h1/types.txt), [lint](h1/lint.txt) | TypeScript estrito e regras/sintaxe existentes |
| `node tools/simulate.mjs` | Seis transcrições iguais à base; [saída](h1/simulator.txt) | Lógica de fala, sem qualidade visual |
| `node tests/e2e/luna.mjs` | **10 cenários**; [relatório](h1/luna-e2e.json) | Fluxo completo, HTTP loopback, câmera/voz/evidência artificiais |
| `node tests/e2e/luna-continuity.mjs` | **8 cenários**; [relatório](h1/continuity-e2e.json) | Mudança localizada, nova vista, recuperação e parada |
| `node tests/e2e/hybrid-capture.mjs` | **7 cenários**; [relatório](h1/hybrid-e2e.json) | Worker real com observações vazias de teste, sem inferência de modelo |
| `node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures` | **9 cenários**; [relatório](h1/local-smoke.json) | Modo local histórico com pesos WASM reais, câmera/voz falsas; HTTP substituído por arquivos; axe sem violações sérias/críticas no estado ocioso testado |

Total: **34 cenários de navegador** nas quatro suítes, além dos testes unitários. Não é contagem de vídeos independentes de avaliação visual. Cobertura do comando existente é apenas do cérebro: 98,77% de linhas; não representa cobertura dos módulos novos de captura.

Uma primeira execução de continuidade falhou porque o teste soltava a resposta após avançar 400 ms no relógio artificial, antes de confirmar a observação do novo frame. A decodificação de vídeo não acompanha esse relógio. O teste passou a aguardar a captura observada, mantendo a expectativa de descarte da resposta antiga. A tentativa inicial fica registrada em `h1/luna-continuity-regression.txt`; o resultado após correção é `h1/continuity-e2e.json`. Não se aumentou timeout ou validade para aprovar.

## Correspondência aos critérios

| Critério | Evidência desta fatia | Ainda não demonstrado |
| --- | --- | --- |
| CA-H1 / CA-D4 | Stream único; novos IDs/tempos; uma inferência por vez; nenhuma cópia/fila quando ocupado; continuidade durante 12 s de API e fala; alternativa sem callback de vídeo | Desempenho com detector real em outras máquinas |
| CA-H2 / CA-P6 / CA-L4 | Versão, geração, frame, tempo, geometria e fonte conferidos; ofertas repetidas/fora de ordem/de outra sessão rejeitadas; local >3 s e snapshot >10 s rejeitados; parada cancela resultado pendente | Associação temporal, conflitos local/Luna, identidade de entidades, detecção visual real |
| CA-H9 / CA-S4 | Parada, permissão tardia, codificação pendente, evento de câmera encerrada, revogação e evento simulado de aba oculta liberam recursos; buffers transferidos; diagnóstico sem pixels/textos da cena | Auditoria de disco/memória/retenção do provedor/SO, suspensão real por SO e acessibilidade dos avisos com leitores físicos |
| CA-F* / CA-L* | Regressões existentes passaram; transcrições do simulador iguais; nova captura compartilhada não altera esquema, seleção de frases, limite de chamada, modelo ou orçamento | Uso natural, voz audível, qualidade semântica e API/fatura reais |

## H0: preparação de experiência e equipamentos

Usar o protocolo de consentimento já definido no plano completo, sem contatos/envios feitos pelo agente. Proposta para sessão formativa em local conhecido, pessoa parada e acompanhante/instrutor: apresentar uma vista, observar mudança e pedir que o participante explique o que entendeu. Não usar o aplicativo para guiar caminhada ou experimentar riscos.

| Situação do roteiro | O que investigar com participante e O&M | Registro futuro |
| --- | --- | --- |
| Primeira vista de um cômodo | “Como você descreveria a organização do lugar depois de ouvir?” | Clareza, referências úteis e informações faltantes |
| Pessoa entra e muda de setor | “Em que momento essa mudança seria útil ouvir?” | Atraso percebido e necessidade de fala |
| Pessoa deixa o enquadramento, cadeira permanece | “O que você entendeu sobre a pessoa?” | Verificar se ausência visual foi confundida com saída física |
| Nova vista com os mesmos nomes de móveis | “Você percebeu que era outra vista?” | Orientação compreendida sem repetição excessiva |
| Vista parada e processamento ativo | “Esse silêncio foi confortável? Faltou alguma indicação?” | Compreensão do estado, carga auditiva, preferência sem inserir fala periódica por padrão |
| Internet/voz indisponível | “Você entendeu o que ainda estava funcionando?” | Clareza do aviso e recuperação compreensível |

Essas perguntas **não foram aplicadas**. H0.1 técnico concluído; H0.2–H0.4 parcialmente preparados, com entrevista/O&M, referências de latência real e conjunto brasileiro ainda pendentes. Outros equipamentos Windows de entrada, macOS/ARM64, Linux e GPU continuam sem ensaio. O vídeo público estático usado aqui não substitui os 30 ambientes brasileiros nem os vídeos temporais anotados de H2/H3.

## Próxima fatia

H2: medir o baseline local completo em worker e no máximo duas alternativas; congelar versões/licenças/hashes, entradas e critérios antes de integrar. Registrar latência por etapa, falsos/omissões, qualidade temporal, RAM e instalação por equipamento. Manter verificação de pessoas. Se nenhum perfil passar, manter o fluxo de capturas e declarar a limitação. Não ligar fala local real apenas porque o worker fake passou.

**Não testado nesta entrega:** reconhecimento híbrido real, novos modelos, tracking, profundidade, câmera/áudio físicos, NVDA/VoiceOver/TalkBack, pessoas cegas/baixa visão, API paga/latência/fatura, precisão do detector em movimento, 30 min/RAM/bateria, GPU, outras máquinas/SOs, instalação limpa, offline/service worker, orçamento compartilhado remoto ou site publicado. Não declarar segurança, precisão, “tempo real” ou acessibilidade validada.
