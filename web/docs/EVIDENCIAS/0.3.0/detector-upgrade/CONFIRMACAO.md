# Confirmação pequena dos detectores — Visiora

A troca geral por YOLOX-S não ficou sustentada nesta amostra. Ele encontrou mais pessoas, mas gerou mais erros de cadeira e perdeu mais camas. Nenhum limiar foi alterado após estes resultados.

## Protocolo congelado

30 imagens públicas novas de COCO val2017: seis de cada um dos mesmos cinco estratos do desenvolvimento. A ordem SHA256 original foi reproduzida exatamente, e foram usadas as posições 13–18 de cada estrato, após as 12 já avaliadas. Zero interseção com as 60 imagens anteriores. Seleção e quatro políticas foram gravadas antes de baixar/inferir as imagens.

SHA256 do protocolo: `498b1bd28feb4c97432bf3be06958dc136b3fc9ec32ec50da46a5aaf7476e87b`.

Correspondência: IoU ≥ 0,50 com caixa normal ainda livre; predições em ordem decrescente de score. Se não há correspondência normal, interseção/área da detecção ≥ 0,50 com crowd da mesma classe ignora a detecção. Há uma anotação crowd na amostra, de classe fora das três avaliadas, e nenhum ignore disparou. Portanto o caminho crowd de pessoa/cadeira/cama foi verificado por asserções sintéticas, não por um caso positivo desta amostra. Elas cobrem detecção pequena dentro de crowd e prioridade do match normal. NMS 0,45 e máximo 30 da configuração existente. Todas as escalas de objeto incluídas.

TP = detecções que correspondem à anotação; FP = detecções sem correspondência; FN = objetos anotados perdidos. Precisão = TP/(TP+FP); recall = TP/(TP+FN). Scores não são probabilidades calibradas.

## Resultados de confirmação

| Política | Classe | Score mínimo | TP | FP | FN | Precisão | Recall | Imagens negativas com FP |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| nano-baseline | Pessoa | 0.50 | 27 | 3 | 27 | 90.0% | 50.0% | 1/18 |
| nano-baseline | Cadeira | 0.50 | 7 | 2 | 15 | 77.8% | 31.8% | 1/16 |
| nano-baseline | Cama | 0.50 | 3 | 0 | 4 | 100.0% | 42.9% | 0/23 |
| tiny-target90 | Pessoa | 0.45 | 31 | 0 | 23 | 100.0% | 57.4% | 0/18 |
| tiny-target90 | Cadeira | 0.70 | 4 | 1 | 18 | 80.0% | 18.2% | 0/16 |
| tiny-target90 | Cama | 0.45 | 4 | 1 | 3 | 80.0% | 57.1% | 0/23 |
| s-target85 | Pessoa | 0.45 | 40 | 1 | 14 | 97.6% | 74.1% | 0/18 |
| s-target85 | Cadeira | 0.45 | 13 | 12 | 9 | 52.0% | 59.1% | 2/16 |
| s-target85 | Cama | 0.65 | 2 | 0 | 5 | 100.0% | 28.6% | 0/23 |
| s-target90 | Pessoa | 0.45 | 40 | 1 | 14 | 97.6% | 74.1% | 0/18 |
| s-target90 | Cadeira | 0.55 | 12 | 11 | 10 | 52.2% | 54.5% | 2/16 |
| s-target90 | Cama | 0.80 | 2 | 0 | 5 | 100.0% | 28.6% | 0/23 |

Os nomes target85/target90 indicam a meta usada no desenvolvimento, não precisão garantida na confirmação. No S, a cadeira passou de precisão observada próxima da meta no desenvolvimento para cerca de 52% nesta confirmação. Há somente sete camas anotadas; um único objeto muda bastante a taxa.

## Exemplos preservados, sem reinterpretar rótulos

- Imagem 267300: Nano gerou uma pessoa onde há zero pessoas anotadas; Tiny e S não geraram esse FP.
- Imagem 78915: S gerou oito cadeiras onde há zero cadeiras anotadas, tanto em target85 quanto em target90. Nano e Tiny geraram zero cadeiras. Esses oito resultados continuam FP; a anotação não foi alterada para favorecer o modelo.
- Imagem 172877: Nano gerou uma cadeira e S duas onde não há cadeira anotada. Tiny gerou zero.
- Imagem 194875: 11 pessoas anotadas. Nano TP3/FP1/FN8; S TP9/FP1/FN2. Isso mostra o ganho de cobertura e um erro que continua existindo.
- Imagem 463842: Tiny gerou uma caixa de cama sem IoU suficiente e não correspondeu à cama anotada: FP1/FN1. Não foi contado como acerto por apenas acertar o nome da classe.

## Tempo exploratório

ORT CPU com uma thread, uma passada, sem aquecimento excluído, compartilhando o computador. Os números abaixo medem somente a chamada de inferência e não estabelecem comparação controlada nem desempenho de navegador/câmera.

| Modelo | p50 de inferência | p95 por posto mais próximo | Amostras |
|---|---:|---:|---:|
| nano | 19.9 ms | 20.6 ms | 30 |
| tiny | 62.4 ms | 64.5 ms | 30 |
| s | 253.3 ms | 262.3 ms | 30 |

## Limites

- 30 stratified public COCO validation images; prevalence not representative.
- COCO val2017 is known model-development validation data; not independent Brazilian camera performance.
- Policy names refer to development targets, never confirmation guarantees.
- No threshold adjustment permitted after confirmation; no private photograph used.
- Timing exploratory single-pass shared CPU, not controlled latency comparison.
- Only public annotations define truth; visually plausible unannotated objects still count as false positives. No relabeling after results.
- Class thresholds are raw detector scores, not calibrated probabilities.
- Image downloads used official COCO HTTP URLs because HTTPS connection failed; byte hashes record local reproducibility but do not provide authenticated upstream integrity.
- No user photograph, camera video, audible voice, accessibility assessment, endurance, mobile, or controlled browser performance trial included.

Isto não é COCO mAP, validação do produto, garantia de segurança ou prova de generalização. Não há fotos privadas nesta avaliação. As imagens permanecem somente nos artefatos locais; não são distribuídas com o produto.

## Arquivos

- `confirmation-protocol.json`: seleção e políticas antes da execução.
- `confirmation-image-sources.json`: origem, licença, bytes e SHA256 por imagem.
- `confirmation-results.json`: modelos, caixas, acertos, erros e omissões por imagem.
- `confirmation-summary.json`: resumo e exemplos sem novo ajuste.
- `confirm.py` e `report_confirmation.py`: reprodução.
- `confirmation.log`: saída real da execução.
