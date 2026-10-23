# CA-A1/A3 — controles e auditoria automatizada da interface

Data: 23/10/2026. Requisitos RNF-04 e RD-01 a RD-04. Chrome headless local, layout inicial em larguras 390 e 1440 px, fluxo de demonstração com voz simulada e câmera artificial para o E2E completo.

O primeiro ensaio encontrou velocidade da voz 35×44 px, botão “Conhecer os limites” 110×32 px no celular e ausência de nome acessível em Ajustes quando o texto ficava oculto. CSS elevou os dois alvos a pelo menos 44×44 px; HTML deu nome explícito a Ajustes. `axe-core` 4.14.0 passou a ser dependência fixada, e o E2E não pode mais ignorar sua ausência.

Depois das correções, `node tests/e2e/smoke.mjs http://127.0.0.1:8080 --fixtures` passou em nove casos e `npm run test:a11y` passou separadamente. Em 390 e 1440 px: sem rolagem horizontal; todos os botões e selects visíveis medidos ≥44×44 px; zero violações axe sérias/críticas; zero violações da regra automatizada `color-contrast-enhanced` nos estados iniciais. O fluxo final escuro também teve zero violações axe sérias/críticas. Não houve erro de console nem requisição externa no roteiro. [CI remoto com Chromium](https://github.com/Hills808/Visiora/actions/runs/39985260829) concluiu com sucesso. A regra de contraste reforçado segue WCAG AAA e pode aceitar texto grande abaixo de 7:1; uma medição individual de todo texto ainda é necessária para afirmar literalmente RNF-04.

Não testado: NVDA, VoiceOver, TalkBack, celulares físicos, zoom extremo, todos os estados modais, câmera/voz reais e uso com participantes cegos ou com baixa visão. `--fixtures` intercepta arquivos locais; não verifica HTTP, service worker ou download nativo.
