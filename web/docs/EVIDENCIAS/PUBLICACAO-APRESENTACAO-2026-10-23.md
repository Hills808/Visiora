# Publicação da apresentação — 23/10/2026

Critérios relacionados: CA-E1, CA-E4, CA-E5, CA-A1 e CA-A3. Esta evidência verifica o pacote e a interface; não aprova CA-A4/A5 nem qualidade da visão.

- `npm ci`: 43 pacotes instalados, zero vulnerabilidades relatadas pelo npm.
- `npm run build`: 79 arquivos estáticos e ZIP local de aproximadamente 167,4 MB.
- `npm test`: 163 testes passaram, zero falhas; cobertura total do cérebro de 99,07% em linhas.
- `npm run typecheck` e `npm run lint`: passaram.
- `node tools/simulate.mjs`: seis transcrições geradas sem regressão observada.
- `npm run test:a11y`: 390 e 1440 px, zero violações axe e de contraste reforçado no teste automatizado.
- Modo inicial alterado para Modelos locais; nenhum endpoint pago é necessário para iniciar esse modo.
- Primeira tentativa de implantação da versão 4 falhou: o host rejeitou `ort-wasm-simd-threaded.asyncify.wasm` de 26.781.914 bytes por exceder 25 MiB. O build passou a publicar gzip de 6.605.903 bytes e manifesto de integridade; maior arquivo em `dist` agora tem 20.000.000 bytes.
- `node tests/e2e/scenes.mjs` com `VISIORA_TEST_URL=http://127.0.0.1:8090`: passou 8 casos, incluindo inicialização WebGPU, retorno a WASM quando a GPU falha, reconhecimento de ambiente, saída de voz simulada, silêncio por um minuto, pacote offline e ausência de requisições externas. Câmera e voz foram simuladas.

Publicação: versão 5 do Site, implantação `appgdep_6adbb666c50c8191b9256f9672bc33ee` concluída em https://visiora-ambiente.hills808.chatgpt.site com acesso público. Requisições anônimas por HTTPS retornaram HTTP 200 para `/`, `/app.js`, `/vendor/asyncify-wasm.json`, `/vendor/ort-wasm-simd-threaded.asyncify.wasm.gz` e `/models/manifest.json`. No Chrome headless com câmera artificial, a página retornou HTTP 200, `isSecureContext=true`, seletor inicial `local`, câmera ativa e zero erros de página.

Não testados no notebook de apresentação: download pela rede do local, webcam, voz pt-BR, desempenho por 30 minutos, acessibilidade com leitor de tela físico e avaliação com pessoas cegas. O modo Luna na hospedagem estática não está disponível.
