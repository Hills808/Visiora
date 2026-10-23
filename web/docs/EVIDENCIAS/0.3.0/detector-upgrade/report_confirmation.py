"""Render the frozen confirmation results without further fitting."""

import hashlib
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
result_path = ROOT / "confirmation-results.json"
report = json.loads(result_path.read_text())
protocol = json.loads((ROOT / "confirmation-protocol.json").read_text())
summary = {
    "protocolSHA256": report["confirmationProtocolSHA256"],
    "resultsSHA256": hashlib.sha256(result_path.read_bytes()).hexdigest(),
    "imageCount": len(protocol["images"]),
    "developmentIntersection": [],
    "noThresholdAdjustmentAfterConfirmation": True,
    "crowdAssertions": report["crowdCheck"],
    "crowdAnnotationsInSample": sum(ann["iscrowd"] for image in protocol["images"] for ann in image["anns"]),
    "targetCrowdAnnotationsInSample": sum(ann["iscrowd"] for image in protocol["images"] for ann in image["anns"] if ann["category_id"] in (1, 62, 65)),
    "policies": {key: {"model": item["model"], "thresholds": item["thresholds"], "summary": item["summary"]} for key, item in report["policies"].items()},
    "inferenceOnlyUncontrolledTiming": {},
    "falsePositiveExamples": {},
    "conclusion": "No single candidate improved all three target classes. S improved person recall and observed precision but reduced chair precision and bed recall. Tiny's high chair threshold reduced chair recall. No blanket detector replacement is established.",
    "limitations": report["limitations"] + ["Only public annotations define truth; visually plausible unannotated objects still count as false positives. No relabeling after results.", "Class thresholds are raw detector scores, not calibrated probabilities.", "Image downloads used official COCO HTTP URLs because HTTPS connection failed; byte hashes record local reproducibility but do not provide authenticated upstream integrity.", "No user photograph, camera video, audible voice, accessibility assessment, endurance, mobile, or controlled browser performance trial included."],
}
old = json.loads((ROOT / "protocol.json").read_text())
assert not {im["id"] for im in old["images"]}.intersection(im["id"] for im in protocol["images"])
for name, model in report["models"].items():
    values = sorted(row["inferenceMsExploratory"] for row in model["rows"])
    summary["inferenceOnlyUncontrolledTiming"][name] = {"p50Ms": statistics.median(values), "p95MsNearestRank": values[28], "samples": len(values), "warmupExcluded": False, "threads": 1}
    for row in model["rows"]:
        scores = [det["score"] for det in row["detections"]]
        assert scores == sorted(scores, reverse=True), "Greedy matching requires descending detections"
for name, policy in report["policies"].items():
    examples = []
    for row in policy["rows"]:
        for cls, scores in row["score"].items():
            if scores["fp"]:
                examples.append({"imageId": row["id"], "class": cls, "tp": scores["tp"], "fp": scores["fp"], "fn": scores["fn"], "gt": scores["gt"], "negativeImageForClass": scores["gt"] == 0, "detections": scores["falsePositives"]})
    summary["falsePositiveExamples"][name] = examples
(ROOT / "confirmation-summary.json").write_text(json.dumps(summary, indent=2))

lines = [
    "# Confirmação pequena dos detectores — Visiora",
    "",
    "A troca geral por YOLOX-S não ficou sustentada nesta amostra. Ele encontrou mais pessoas, mas gerou mais erros de cadeira e perdeu mais camas. Nenhum limiar foi alterado após estes resultados.",
    "",
    "## Protocolo congelado",
    "",
    "30 imagens públicas novas de COCO val2017: seis de cada um dos mesmos cinco estratos do desenvolvimento. A ordem SHA256 original foi reproduzida exatamente, e foram usadas as posições 13–18 de cada estrato, após as 12 já avaliadas. Zero interseção com as 60 imagens anteriores. Seleção e quatro políticas foram gravadas antes de baixar/inferir as imagens.",
    "",
    f"SHA256 do protocolo: `{summary['protocolSHA256']}`.",
    "",
    "Correspondência: IoU ≥ 0,50 com caixa normal ainda livre; predições em ordem decrescente de score. Se não há correspondência normal, interseção/área da detecção ≥ 0,50 com crowd da mesma classe ignora a detecção. Há uma anotação crowd na amostra, de classe fora das três avaliadas, e nenhum ignore disparou. Portanto o caminho crowd de pessoa/cadeira/cama foi verificado por asserções sintéticas, não por um caso positivo desta amostra. Elas cobrem detecção pequena dentro de crowd e prioridade do match normal. NMS 0,45 e máximo 30 da configuração existente. Todas as escalas de objeto incluídas.",
    "",
    "TP = detecções que correspondem à anotação; FP = detecções sem correspondência; FN = objetos anotados perdidos. Precisão = TP/(TP+FP); recall = TP/(TP+FN). Scores não são probabilidades calibradas.",
    "",
    "## Resultados de confirmação",
    "",
    "| Política | Classe | Score mínimo | TP | FP | FN | Precisão | Recall | Imagens negativas com FP |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
]
labels = {"person": "Pessoa", "chair": "Cadeira", "bed": "Cama"}
for name, policy in report["policies"].items():
    for cls, item in policy["summary"].items():
        lines.append(f"| {name} | {labels[cls]} | {policy['thresholds'][cls]:.2f} | {item['tp']} | {item['fp']} | {item['fn']} | {100*item['precision']:.1f}% | {100*item['recall']:.1f}% | {item['negativeImagesWithFalseDetection']}/{item['negativeImages']} |")
lines += [
    "",
    "Os nomes target85/target90 indicam a meta usada no desenvolvimento, não precisão garantida na confirmação. No S, a cadeira passou de precisão observada próxima da meta no desenvolvimento para cerca de 52% nesta confirmação. Há somente sete camas anotadas; um único objeto muda bastante a taxa.",
    "",
    "## Exemplos preservados, sem reinterpretar rótulos",
    "",
    "- Imagem 267300: Nano gerou uma pessoa onde há zero pessoas anotadas; Tiny e S não geraram esse FP.",
    "- Imagem 78915: S gerou oito cadeiras onde há zero cadeiras anotadas, tanto em target85 quanto em target90. Nano e Tiny geraram zero cadeiras. Esses oito resultados continuam FP; a anotação não foi alterada para favorecer o modelo.",
    "- Imagem 172877: Nano gerou uma cadeira e S duas onde não há cadeira anotada. Tiny gerou zero.",
    "- Imagem 194875: 11 pessoas anotadas. Nano TP3/FP1/FN8; S TP9/FP1/FN2. Isso mostra o ganho de cobertura e um erro que continua existindo.",
    "- Imagem 463842: Tiny gerou uma caixa de cama sem IoU suficiente e não correspondeu à cama anotada: FP1/FN1. Não foi contado como acerto por apenas acertar o nome da classe.",
    "",
    "## Tempo exploratório",
    "",
    "ORT CPU com uma thread, uma passada, sem aquecimento excluído, compartilhando o computador. Os números abaixo medem somente a chamada de inferência e não estabelecem comparação controlada nem desempenho de navegador/câmera.",
    "",
    "| Modelo | p50 de inferência | p95 por posto mais próximo | Amostras |",
    "|---|---:|---:|---:|",
]
for name, item in summary["inferenceOnlyUncontrolledTiming"].items():
    lines.append(f"| {name} | {item['p50Ms']:.1f} ms | {item['p95MsNearestRank']:.1f} ms | {item['samples']} |")
lines += ["", "## Limites", ""]
lines += [f"- {item}" for item in summary["limitations"]]
lines += ["", "Isto não é COCO mAP, validação do produto, garantia de segurança ou prova de generalização. Não há fotos privadas nesta avaliação. As imagens permanecem somente nos artefatos locais; não são distribuídas com o produto.", "", "## Arquivos", "", "- `confirmation-protocol.json`: seleção e políticas antes da execução.", "- `confirmation-image-sources.json`: origem, licença, bytes e SHA256 por imagem.", "- `confirmation-results.json`: modelos, caixas, acertos, erros e omissões por imagem.", "- `confirmation-summary.json`: resumo e exemplos sem novo ajuste.", "- `confirm.py` e `report_confirmation.py`: reprodução.", "- `confirmation.log`: saída real da execução.", ""]
(ROOT / "CONFIRMACAO.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"summaryPath": str(ROOT / "confirmation-summary.json"), "reportPath": str(ROOT / "CONFIRMACAO.md"), "timing": summary["inferenceOnlyUncontrolledTiming"]}, indent=2))
