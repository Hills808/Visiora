"""Render measured RT-DETRv2 evidence without refitting."""

import json
import math
import statistics
from pathlib import Path

import compare

ROOT = Path(__file__).resolve().parent
dev = compare.read("development-results.json")
selection = compare.read("selection.json")
confirmed = compare.read("confirmation-results.json")
conservative = compare.read("conservative-development.json")
browser = compare.read("browser-compatibility.json")
old_confirmation = json.loads((compare.OLD / "confirmation-results.json").read_text())
snap = compare.read("source-snapshot.json")
summary = {
    "protocolSHA256": compare.sha(ROOT / "protocol.json"),
    "selectionSHA256": compare.sha(ROOT / "selection.json"),
    "developmentResultsSHA256": compare.sha(ROOT / "development-results.json"),
    "confirmationResultsSHA256": compare.sha(ROOT / "confirmation-results.json"),
    "onnxRevision": snap["onnx"]["sha"],
    "originalRevision": snap["original"]["sha"],
    "license": "Apache-2.0, both official original and ONNX conversion metadata; upstream LICENSE saved",
    "selectedBeforeConfirmationInference": selection["selected"],
    "confirmation": confirmed["summary"],
    "nanoBaselineSame30": old_confirmation["policies"]["nano-baseline"]["summary"],
    "conservativeAdditionalDevelopmentOnly": conservative["variants"],
    "browser": browser,
    "nativeUncontrolledTiming": {},
    "postprocessingDiagnostics": {},
    "falsePositiveExamples": [{"imageId": row["id"], "class": cls, "tp": score["tp"], "fp": score["fp"], "fn": score["fn"], "gt": score["gt"], "falsePositiveBoxes": score["falsePositives"]} for row in confirmed["scores"] for cls, score in row["score"].items() if score["fp"]],
    "conclusion": "RT-DETRv2 uint8 passed native CPU and browser WASM execution, but primary dev-selected policy did not uniformly improve the three classes on confirmation. Chair precision fell to50%, and person precision89.8% vsNano90% despite greater person recall. No automatic product replacement justified by this limited evaluation.",
    "notTested": ["Private user photo", "Real camera", "Audible speech", "Endurance or battery", "Offline service-worker behavior", "Mobile browsers", "Assistive readers", "Brazilian scenes", "Controlled timing", "COCO mAP"],
}
for variant, model in dev["variants"].items():
    values = sorted(row["inferenceMsExploratory"] for row in model["rows"])
    summary["nativeUncontrolledTiming"][variant] = {"n": len(values), "p50Ms": statistics.median(values), "p95MsNearestRank": values[math.ceil(len(values)*.95)-1], "threads": 1, "coldFirstCallIncluded": True, "provider": "CPUExecutionProvider", "onnxruntime": "1.23.2", "caveat": "Single pass shared CPU; no causal speed/quantization conclusion"}
    summary["postprocessingDiagnostics"][variant] = {"sameQueryDuplicatesAboveScore0.45Removed": sum(row["postprocessDiagnostics"]["repeatedSameQueryAboveMinScore"] for row in model["rows"])}
summary["postprocessingDiagnostics"]["confirmation_uint8"] = {"sameQueryDuplicatesAboveScore0.45Removed": sum(row["postprocessDiagnostics"]["repeatedSameQueryAboveMinScore"] for row in confirmed["rows"])}
compare.write("summary.json", summary)

lines = [
    "# RT-DETRv2 R18 — comparação limitada no Visiora",
    "",
    "O RT-DETRv2 uint8 executou em CPU e WASM, mas a política escolhida no desenvolvimento não melhorou as três classes em conjunto na confirmação. Não há base nesta avaliação para trocar automaticamente o detector do produto.",
    "",
    "## Origem e licença",
    "",
    "Original primário: `PekingU/rtdetr_v2_r18vd`, revisão `" + snap["original"]["sha"] + "`.",
    "",
    "Conversão primária: `onnx-community/rtdetr_v2_r18vd-ONNX`, revisão `" + snap["onnx"]["sha"] + "`. Os dois cards declaram Apache-2.0; o LICENSE do repositório oficial foi salvo. Hash e tamanho dos pesos foram conferidos contra a metadata HF do snapshot.",
    "",
    "| Variante | Bytes | SHA256 |",
    "|---|---:|---|",
]
for name, item in dev["variants"].items():
    lines.append(f"| {name} | {item['bytes']} | `{item['sha256']}` |")
lines += [
    "",
    "## Contrato verificado",
    "",
    "RGB, redimensionamento bilinear da imagem inteira para 640×640, rescale 1/255, sem letterbox, padding ou normalização ImageNet. Comparação do tensor com RTDetrImageProcessor oficial Transformers4.57.6: diferença máxima5,96e-8; tolerância1e-6 passou. Saídas logits[1,300,80] e pred_boxes[1,300,4], com caixas cxcywh normalizadas. A ordem id2label do config foi conferida: pessoa0, cadeira56, cama59.",
    "",
    "Pós-processamento focal oficial: sigmoid e top300 do achatamento query×classe, sem NMS. Nosso protocolo remove somente repetições da MESMA query, mantendo sua maior classe, para não apresentar a mesma caixa sob nomes diferentes. Isso é uma diferença explícita em relação ao output oficial. Queries diferentes não passam por NMS; suas duplicatas contam como FP quando não correspondem a outra anotação. Em seguida: caixas no tamanho original, clipping, classes já mapeadas no produto e máximo30 global antes de filtrar os três alvos. Nenhum alvo é favorecido.",
    "",
    "Foram removidas15 repetições de mesma query acima do score0,45 em cada variante nas60 imagens de desenvolvimento e7 na confirmação uint8. Os dados brutos registram essas contagens por imagem.",
    "",
    "Correspondência de caixas reutiliza a avaliação anterior: IoU≥0,50 para anotação normal livre; depois IoA≥0,50 da detecção com crowd da mesma classe permite ignore. Detecções em ordem de score. Não há reinterpretação de anotações nem exclusão de tamanhos difíceis.",
    "",
    "## Seleção usando somente60 imagens de desenvolvimento",
    "",
    "Grade congelada antes de inferir: 0,45 a0,90 com passo0,05. Para cada classe, buscar precisão≥0,90 com ao menos5 predições não ignoradas, maximizando recall, depois precisão e limiar menor. A variante precisa atender às três classes; entre elegíveis, maior recall médio. Havia fallback0,85 pré-declarado, mas não foi necessário. O arquivo selection.json foi congelado antes das30 imagens de confirmação.",
    "",
    "| Variante | Classe | Score escolhido dev | TP | FP | FN | Precisão dev | Recall dev |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for variant, item in selection["developmentCandidates"]["0.9"].items():
    for cls, row in item["classes"].items():
        lines.append(f"| {variant} | {cls} | {row['threshold']:.2f} | {row['tp']} | {row['fp']} | {row['fn']} | {100*row['precision']:.1f}% | {100*row['recall']:.1f}% |")
lines += [
    "",
    "A regra escolheu uint8: recall médio53,5%, contra47,7% no F32. Isso não demonstra equivalência nem superioridade geral da quantização. Em score0,50, por exemplo, F32 pessoa89TP/11FP/13FN, enquanto uint8 pessoa86TP/15FP/16FN. Os efeitos são distintos por classe e limiar.",
    "",
    "## Confirmação30, sem novos ajustes",
    "",
    "| Modelo/política | Classe | TP | FP | FN | Precisão | Recall | Imagens negativas com FP |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for policy, data in [("Nano .50 anterior", summary["nanoBaselineSame30"]), ("RT-DETR uint8 selecionado", confirmed["summary"])]:
    for cls, row in data.items():
        lines.append(f"| {policy} | {cls} | {row['tp']} | {row['fp']} | {row['fn']} | {100*row['precision']:.1f}% | {100*row['recall']:.1f}% | {row['negativeImagesWithFalseDetection']}/{row['negativeImages']} |")
lines += [
    "",
    "A meta90% usada no desenvolvimento não se manteve nas três classes: pessoa89,8%, cadeira50%, cama80%. A cobertura de pessoa e cama aumentou em relação ao Nano, enquanto cadeira perdeu precisão e cobertura. Na imagem78915 ocorreram quatro cadeiras sem anotação e, na172877, uma. Esses casos continuam FP. Os cinco FP de pessoa ocorreram em imagens que já tinham pessoas anotadas; isso não os transforma em acertos.",
    "",
    "## Comparação conservadora adicional: apenas desenvolvimento",
    "",
    "O pedido adicional de meta95% e de limitar erros ao Nano chegou após selection.json e após iniciar a execução da confirmação. Portanto conservative-development.json está marcado como desenvolvimento suplementar; não altera a seleção primária e não é apresentado como teste de confirmação. Usa a mesma grade, sem novos modelos ou pesos.",
    "",
    "| Variante/política | Classe | Limiar dev | TP | FP | FN | Precisão dev | Recall dev |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for variant, policies in conservative["variants"].items():
    for policy in ("target95", "atMostNanoFalsePositives"):
        for cls, row in policies[policy].items():
            if row:
                lines.append(f"| {variant}/{policy} | {cls} | {row['threshold']:.2f} | {row['tp']} | {row['fp']} | {row['fn']} | {100*row['precision']:.1f}% | {100*row['recall']:.1f}% |")
lines += [
    "",
    "No uint8, o alvo95% exige cadeira0,90:9TP/0FP/68FN, recall11,7%. A política com no máximo os FP do Nano escolhe pessoa0,70, cadeira0,90 e cama0,80; pessoa fica63TP/0FP/39FN no desenvolvimento. Precisão observada alta com tão poucos acertos e tanta omissão não estabelece precisão real nem utilidade suficiente.",
    "",
    "## Execução e tempo",
    "",
    "| Variante nativa | p50 CPU | p95 CPU | Amostras |",
    "|---|---:|---:|---:|",
]
for variant, row in summary["nativeUncontrolledTiming"].items():
    lines.append(f"| {variant} | {row['p50Ms']:.1f} ms | {row['p95MsNearestRank']:.1f} ms | {row['n']} |")
lines += [
    "",
    "ORTCPU1.23.2, uma thread, uma passada, primeira chamada incluída, computador compartilhado. São tempos exploratórios apenas de inferência; não concluir que uint8 acelera o modelo. Ambos executaram sem erro de kernel.",
    "",
    f"No navegador HeadlessChrome155, ORTWeb1.30.0/WASM/uma thread: modelo uint8 carregou e inferiu uma imagem pública, outputs finitos, zero pageerror. Uma chamada fria: carga{browser.get('loadMsExploratory', 0):.1f}ms e inferência{browser.get('inferenceMsExploratory', 0):.1f}ms. Isso prova execução nesse fixture e não latência de webcam ou equivalência do resize canvas com PIL. Service workers ficaram bloqueados no transporte de QA.",
    "",
    "## Limites e arquivos",
    "",
    "São60dev+30confirmação estratificadas já usadas na comparação YOLOX. As30 são novas em relação ao desenvolvimento, mas COCOval2017 é dado de validação conhecido dos modelos. Não é prevalência real, mAP ou prova independente de generalização. Há somente sete camas na confirmação.",
    "",
    "Não foram testados: foto privada, câmera real, fala audível, leitores de tela, celular, ambientes brasileiros, bateria, uso prolongado, offline real ou desempenho controlado. Nada foi alterado em produto/public/Git/Sites.",
    "",
    "- protocol.json, selection.json: regras e escolha congeladas.",
    "- development-results.json, confirmation-results.json: caixas e contagens reais.",
    "- conservative-development.json: comparação adicional apenas dev.",
    "- preprocessing-check.json: comparação do tensor ao processador oficial.",
    "- browser-compatibility.json: execução WASM real e seus limites.",
    "- source-snapshot.json, model-sources.json, references.json, LICENSE: origem, hash e licença.",
    "- summary.json: resumo estruturado; logs e scripts ao lado para reprodução.",
    "",
]
(ROOT / "RELATORIO.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"summary": str(ROOT / "summary.json"), "report": str(ROOT / "RELATORIO.md"), "nativeTiming": summary["nativeUncontrolledTiming"]}, indent=2))
