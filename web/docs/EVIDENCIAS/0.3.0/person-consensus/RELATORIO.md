# Especialista em pessoas por consenso — teste limitado

A política passou as condições pré-declaradas nesta amostra: encontrou mais pessoas e teve um erro de pessoa a menos; cadeira e cama ficaram iguais ao Nano. Três quadros WASM aquecidos ficaram abaixo de3segundos. Isso autoriza considerar o candidato, mas não comprova precisão geral nem corrige por si só as falhas com cadeiras e ambientes.

## Regra e seleção antes das novas predições

Nano mantém todos os objetos mapeados não-person com score≥0,50. Somente pessoa vem do consenso fixo de Nano+Tiny+S: cada detecção≥0,45, pelo menos dois heads distintos, uma detecção de cada head por cluster, IoU≥0,50 com todos os membros; caixa e score por média. Exige score final≥0,50. Nenhuma regra usa cama, quarto, pista de cena ou foto específica.

Cada head foi inferido novamente e guardou todos os objetos mapeados antes do limite30; o export prevê80classes, das quais48 já têm nome no produto. Depois da composição: NMS por classe com IoU>0,45 e máximo30 GLOBAL. Somente então foram contados pessoa/cadeira/cama. Portanto outras classes participam da competição do limite, ao contrário do experimento anterior com brutos restritos aos três alvos.

30novas imagens públicas COCOval2017: posições19–24 na mesma ordem SHA256 dos cinco estratos. Os90IDs anteriores foram reproduzidos exatamente e a ausência de interseção foi conferida antes da execução. Não houve grade nova nem ajuste após o resultado.

Protocolo SHA256: `c95167e2ee77cc21b1015bbd1161723a7146bc21872519aaeecbe58112f474e8`.

Gate de qualidade antes da execução: precisão de pessoa≥Nano, FP de pessoa<Nano, TP de pessoa≥Nano; cadeira/cama com TP não menor e FP não maior. Gate adicional: cada um dos três quadros aquecidos WASM≤3000ms. Correspondência normal IoU≥0,50, crowd por IoA≥0,50; sem reclassificar anotações.

## Resultado nas30novas imagens

| Política | Classe | TP | FP | FN | Precisão | Recall | Negativas com FP |
|---|---|---:|---:|---:|---:|---:|---:|
| Nano atual .50 | person | 24 | 6 | 32 | 80.0% | 42.9% | 1/18 |
| Nano atual .50 | chair | 6 | 1 | 49 | 85.7% | 10.9% | 0/16 |
| Nano atual .50 | bed | 3 | 0 | 3 | 100.0% | 50.0% | 0/24 |
| Especialista pessoa | person | 29 | 5 | 27 | 85.3% | 51.8% | 0/18 |
| Especialista pessoa | chair | 6 | 1 | 49 | 85.7% | 10.9% | 0/16 |
| Especialista pessoa | bed | 3 | 0 | 3 | 100.0% | 50.0% | 0/24 |

São56pessoas,55cadeiras e6camas anotadas. O ganho observado de pessoa é pequeno:5TP a mais e1FP a menos. Não anunciar85,3% como precisão geral. O recall de cadeira continua6/55(10,9%); este candidato mantém essa limitação do Nano.

Na imagem370478, o Nano produziu uma pessoa onde não havia pessoa anotada; o consenso removeu essa detecção. Outros cinco FP de pessoa persistem nas imagens67616,555050 e411817. Concordância entre modelos não prova que a pessoa existe.

O limite30 não foi atingido por nenhuma das duas políticas nestas30imagens. Houve0alterações no conjunto não-person: boxes/classes/scores de todos os objetos não-person finais coincidem com o Nano. Isso não garante ausência de efeito do limite em cenas mais densas.

## WASM real com aquecimento e pré-processamento completo

Chromeheadless155, ORTWeb1.30.0, WASM, uma thread. As três sessões ficaram carregadas simultaneamente. Uma chamada de aquecimento por modelo, com outputs finitos, depois três quadros com imagens públicas pré-declaradas. Nano/Tiny usam416; S usa640. Cada quadro inclui os três resizes letterbox114 com dimensões inteiras, RGB→BGR float32, inferências sequenciais, decode completo, NMS, consenso e limiteglobal.

| Quadro público | Tempo total aquecido | Cumpre3000ms nesta execução |
|---|---:|---|
| 226592 | 1335.3ms | Sim |
| 249550 | 1312.0ms | Sim |
| 235399 | 1318.0ms | Sim |

Zero pageerror. Carregamento dos modelos e decodificação JPEG ficam fora do relógio do quadro, como vídeo já decodificado. Não foi usada uma soma de tempos antigos: o relógio mediu resize→resultado de cada quadro. Os três quadros são dos primeiros três casos bed-without-person; o ensaio não cobre carga variada com o modelo de ambiente em paralelo, câmera real, transferência para worker, bateria ou uso prolongado.

Resize browser usa canvas bilinear low, piso das dimensões e padding114, como o caminho de captura atual. Não foi afirmada igualdade de pixels com OpenCV. A composição JavaScript foi comparada separadamente ao Python nos30resultados completos:166detecções dos dois canais conferidas, diferença máxima0 e tolerância1e-9. Isso testa a política, não equivalência entre os runtimes de imagem/inferência.

## Limites e arquivos

COCOval2017 é conjunto conhecido de validação dos modelos; estes30casos estratificados não representam prevalência real nem COCOmAP. Não foram testados foto privada do usuário, ambientes brasileiros, câmera real, celular, leitores de tela, áudio audível, duração longa ou segurança. Nenhum arquivo de produto, Git ou Sites foi alterado.

- protocol.json e image-sources.json: regras,IDs,origens,licenças e SHA256 antes da inferência.
- results.json: todos os objetos mapeados de cada head antes do limite, composição final e contagens por imagem.
- summary.json: gates limitados, métricas e limitações.
- browser-compatibility.json: tempos reais de resize/inferência/decode/fusão e outputs.
- composition-parity.json: conferência JS/Python nos30casos.
- compare.py, pipeline-functions.mjs, browser-probe.mjs, check-composition.mjs, report.py e logs: reprodução.
