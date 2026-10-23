# CA-H7 — recuperação da GPU durante a sessão local

Data: 23/10/2026. Requisitos: RF-01, RF-03, RF-09 e RF-12 da ERS.

O teste `tests/camera-gpu-recovery.test.mjs` simula worker WebGPU pronto e, depois, erro durante a sessão. Resultado: um segundo worker recebe `forceCpu: true`; o worker GPU termina; a câmera continua com um único pedido de permissão e nenhuma trilha parada; nenhum resultado do quadro com falha chega ao cérebro; o status informa CPU. Ao simular erro posterior da CPU, a sessão encerra e libera a trilha. O teste não usa imagem, webcam, áudio ou API paga.

Comandos executados após a alteração: `npm test` (162 passaram, 0 falharam), `npm run typecheck`, `npm run lint` e `node tools/simulate.mjs` (seis transcrições; todos passaram). O CI remoto ainda deve ser conferido após publicação da mudança.

Não testado: perda física de dispositivo WebGPU, worker sem resposta até o prazo, duração da reinicialização, RAM, qualidade após troca, webcam/voz/leitor de tela reais e uso por pessoas cegas. O simulador verifica lógica de fala, não qualidade de visão.
