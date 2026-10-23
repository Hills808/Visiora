# Ensaio com webcam real — 22/10/2026

## Estado

**Ensaio manual com diagnóstico recebido.** O usuário executou o modo local com sua webcam e forneceu `C:\meu\plan\visiora-diagnostico.json`. O agente não acessou quadros nem controlou o navegador; as tentativas anteriores de automação foram recusadas. O arquivo contém medições do aplicativo, sem imagens e sem transcrição. O usuário informou que havia uma pessoa e uma cadeira ao fundo. Ele relatou que o Visiora identificou primeiro a pessoa e, aproximadamente 30 segundos depois, falou da cadeira; não percebeu muita repetição. O atraso é estimativa do usuário, sem cronômetro ou registro de evento. Não houve chamada Luna registrada no diagnóstico.

Nova tentativa após o usuário mostrar a configuração de navegação “Sempre permitir”: a ferramenta de navegador recusou novamente a mesma origem, agora com a razão “A saved user permission setting blocks this action ... A saved permission or managed policy denies access”. A configuração efetiva que produz a recusa não é visível ao agente. O servidor foi iniciado e interrompido novamente. Não houve acesso à câmera nem resultado de ensaio; não contornar por CDP, comandos ou outro navegador.

Terceira tentativa, após o usuário informar que adicionou permissão específica: o inventário da extensão Chrome mostrou a aba `Visiora — Seu espaço, em palavras` em `http://127.0.0.1:8080/`, mas `getTab` para essa aba foi recusado pela mesma política ao tentar observar conteúdo. A mensagem citou permissão salva ou política gerenciada que nega `http://127.0.0.1:8080`. O servidor já estava ativo sob processo do usuário e não foi interrompido pelo agente. Nenhum quadro ou dado de diagnóstico foi lido.

## Condições conhecidas

| Item | Registro | Limite |
| --- | --- | --- |
| Webcam | Logitech Webcam C925e, status OK no inventário do Windows | Enumeração do dispositivo; não prova captura de vídeo pelo Visiora |
| Computador | Intel Core i7-10700F, 8 núcleos/16 threads; RAM instalada 25.634.594.816 bytes | Não mede uso de RAM durante inferência |
| Build local | `dist/app.js` de 23/10/2026 00:56 UTC; `dist/index.html` corresponde ao `public/index.html` | Arquivos presentes; não confirma execução no navegador |
| Servidor | `127.0.0.1:8080` estava escutando em processo já ativo antes da tentativa de acessar a aba do usuário | O agente não inspecionou a página por bloqueio da ferramenta |
| Modo observado | `source: camera`, com contadores de Luna zerados | O diagnóstico não registra o identificador físico da webcam |

## Resultado do diagnóstico manual

Arquivo de 2.656 bytes, SHA-256 `44EB860A138D385106D3164F4E82F5F76831EFC74E4C67BF58CB7A6714DA78E7`; data interna 22/10/2026 22h50 em `America/Sao_Paulo`. Percentis pelo método *nearest rank*, sobre resultados registrados. Os contadores do exportador não são zerados por `resetBrain()` ou `stop()`; portanto, são acumulados desde o carregamento da página e podem abranger mais de uma sessão. Não guardar cópia do JSON nem imagens no repositório.

| Medida | Objetos | Lugar |
| --- | ---: | ---: |
| Resultados | 99 | 47 |
| Mediana (p50) | 1.347 ms | 1.556 ms |
| p95 | 1.397 ms | 1.609 ms |
| Mínimo–máximo | 1.324–1.486 ms | 1.527–1.779 ms |
| Acima de 400 ms | 99/99 | 47/47 |

Desde o carregamento da página, o aplicativo registrou 3 falas concluídas, 0 erros, 1 resultado de lugar rejeitado e **47/47 abstenções do classificador de lugar**. O cérebro da sessão corrente registrou 0 quadros de objetos rejeitados; esse contador é zerado ao reiniciar o cérebro, ao contrário dos anteriores. O último rastro de descrição cita um quadro de objetos e nenhum quadro de lugar; ele não informa rótulos nem direção. Os contadores de consulta Luna são zero. O campo `onlineContinuity.local.state=disabled` pertence ao consumidor híbrido do modo Luna, não ao detector local desta sessão.

**Leitura:** CA-D1 não foi atingido nesta máquina pelos resultados observados: só o tempo do worker de objetos tem p50 e p95 acima das metas propostas de 150/400 ms para quadro→resposta. É uma amostra do dispositivo e das saídas aceitas, sem carga, falhas, descartes ou voz no cálculo; não é o p95 completo do sistema. As 47 abstenções mostram que o app não apresentou um lugar confirmado durante a amostra, mas o arquivo não registra o motivo de cada rejeição nem demonstra que um lugar deveria ser reconhecido. Três falas não provam excesso de repetição: o arquivo não contém duração da sessão, texto nem horários de cada fala.

**Melhorias delimitadas:** (1) investigar o atraso relatado de cerca de 30 segundos até a cadeira, com registro separado de primeira detecção, confirmação pelo cérebro, entrada na fila de fala e início audível; o JSON atual não identifica em qual etapa ocorreu a espera; (2) medir a cadeia completa e contar todas as tentativas antes de escolher perfil/modelo no gate H2; (3) registrar motivo de cada abstenção de lugar, sem reduzir limiares às cegas; (4) tornar o diagnóstico por sessão e incluir duração e horários da fala sem guardar imagens. Não habilitar fala híbrida nova ou declarar reconhecimento útil a partir deste arquivo.

## Roteiro para o proprietário

1. Abrir `http://127.0.0.1:8080` no Chrome, selecionar **Modelos locais · sem API paga**, clicar **Iniciar ambientação** e conceder acesso à câmera. Não selecionar Luna nem autorizar envio à nuvem neste ensaio.
2. Apontar para uma cena interna conhecida e manter o enquadramento estático por cinco minutos, sem caminhar. Anotar o horário de início, o que existe na cena e cada frase realmente ouvida, com horário aproximado. Anotar também avisos, silêncio, repetições e diferenças entre a fala e a cena.
3. Com a câmera **ainda ativa**, abrir **Ajuda** e clicar **Exportar diagnóstico local**. Anexar o JSON à conversa. Depois parar a câmera.
4. Para avaliar novidades e omissões depois do período estático, iniciar uma **segunda sessão separada** e introduzir uma mudança segura e conhecida no enquadramento, por exemplo uma cadeira ou pessoa parada, com registro do instante e posição. Não caminhar guiado pelo aplicativo.

O diagnóstico contém contagens de quadros, falas concluídas, erros e até 300 latências recentes de inferência de objetos, além de amostras de lugar. Ele não contém vídeo nem prova a verdade dos rótulos. `speechCompleted` não permite verificar sozinho o número de falas **após** o briefing; a anotação de horários é necessária para CA-F1. As latências registradas pertencem aos resultados que chegaram e não incluem, por si, tempo de carregamento, falhas, descarte, áudio audível ou p95 completo de tentativas.

## Avaliação por critério

| Critério | Comparação | Estado atual |
| --- | --- | --- |
| CA-F1 / CA-H5 | Falas extras em cinco minutos estáticos: no máximo uma após o briefing | 3 falas acumuladas desde o carregamento; usuário não percebeu muita repetição; duração, briefing e horários não registrados; inconclusivo |
| CA-F2/F3/F4 | Frases proibidas, direção e repetição sem mudança material | Não testado |
| CA-P3 / CA-H3 | Referências inexistentes, omissões e mudanças, comparadas à cena anotada | Pessoa e cadeira ao fundo informadas; usuário relata menção a ambas, cadeira após ~30 s; sem texto/direção/tempo instrumentado; inconclusivo para precisão |
| CA-D1 / CA-H4 | p50/p95 das latências disponíveis e quantidade de quadros; reportar separadamente tentativas ausentes | Worker de objetos 1.347/1.397 ms; excede meta nesta máquina. Cadeia completa não medida |
| CA-S1/S3 | Ausência de gravação/envio de imagens | Não auditado nesta sessão |
| CA-A4/A5 | Utilidade, cansaço e compreensão por pessoas cegas | Não testado; zero sessões nesta etapa |

## Decisão de continuidade

Após o ensaio, priorizar falhas observadas por impacto na confiança do usuário: afirmação falsa ou direção errada; repetição; atraso/omissão; carregamento ou voz indisponível. O próximo gate de desenvolvimento permanece H2, com bancada que conta todas as tentativas, erros e descartes antes de ativar fala local no modo híbrido. Não usar a mera detecção da webcam no Windows para declarar o teste de câmera real concluído.
