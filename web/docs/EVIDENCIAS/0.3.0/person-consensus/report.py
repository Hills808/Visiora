"""Frozen focused-person result and browser evidence; no refitting."""

import json
from pathlib import Path

import compare

ROOT = Path(__file__).resolve().parent
protocol = json.loads((ROOT / "protocol.json").read_text())
results = json.loads((ROOT / "results.json").read_text())
browser = json.loads((ROOT / "browser-compatibility.json").read_text())
parity = json.loads((ROOT / "composition-parity.json").read_text())


def identity(det):
    return det["class"], det["score"], tuple(det["box"])


cap_effects = []
for row in results["rows"]:
    baseline = {identity(det) for det in row["nanoBaseline"] if det["class"] != "person"}
    pipeline = {identity(det) for det in row["pipeline"] if det["class"] != "person"}
    cap_effects.append({"id": row["id"], "baselineCount": len(row["nanoBaseline"]), "pipelineCount": len(row["pipeline"]), "nonPersonRemoved": len(baseline-pipeline), "nonPersonAddedFromNano": len(pipeline-baseline)})
summary = {
    "protocolSHA256": compare.sha(ROOT / "protocol.json"),
    "resultsSHA256": compare.sha(ROOT / "results.json"),
    "browserEvidenceSHA256": compare.sha(ROOT / "browser-compatibility.json"),
    "imageSourcesSHA256": compare.sha(ROOT / "image-sources.json"),
    "newImages": 30,
    "selection": "Positions19..24 per same5strata; no overlap with previous90 asserted before inference",
    "policy": "Person from fixed two-of-three YOLOX agreement, fusedscore>=.50; mapped non-person from unchanged Nano>=.50; final globalNMS/max30",
    "nanoBaseline": results["nanoBaseline"],
    "pipeline": results["pipeline"],
    "qualityGatePassed": results["qualityGatePassed"],
    "latencyGatePassed": browser.get("latencyGatePassed", False),
    "combinedLimitedGatePassed": results["qualityGatePassed"] and browser.get("latencyGatePassed", False),
    "browserWarmFrameMs": [frame["fullFrameWarmMs"] for frame in browser["frames"]],
    "compositionParity": parity,
    "allMappedClassCount": sum(label is not None for label in protocol["productClassMapping"]),
    "allRawHeadClasses": 80,
    "fullMappedBeforeCapSaved": True,
    "capEffectsPerImage": cap_effects,
    "nonPersonChanges": sum(row["nonPersonRemoved"]+row["nonPersonAddedFromNano"] for row in cap_effects),
    "falsePositiveExamples": [{"id": row["id"], "class": cls, "tp": score["tp"], "fp": score["fp"], "fn": score["fn"], "gt": score["gt"], "falsePositiveBoxes": score["falsePositives"]} for row in results["pipelineScores"] for cls, score in row["score"].items() if score["fp"]],
    "limitations": protocol["limitations"] + ["Only one fewer personFP in this sample; cannot establish broad precision gain or user-photo correction.", "Chair recall remains6/55; policy does not improve non-person perception.", "All3warm browser frames came from first3selected bed-without-person images by predeclared order; timing does not measure diverse scene contention.", "Scene model concurrency, live camera/transfer, mobile, battery, audible speech and endurance not tested.", "Browser canvas/OpenCV preprocessing are not claimed pixel-equivalent; composition code checked independently on all30native full-mapped results."],
}
compare.write("summary.json", summary)
lines = [
    "# Especialista em pessoas por consenso — teste limitado",
    "",
    "A política passou as condições pré-declaradas nesta amostra: encontrou mais pessoas e teve um erro de pessoa a menos; cadeira e cama ficaram iguais ao Nano. Três quadros WASM aquecidos ficaram abaixo de3segundos. Isso autoriza considerar o candidato, mas não comprova precisão geral nem corrige por si só as falhas com cadeiras e ambientes.",
    "",
    "## Regra e seleção antes das novas predições",
    "",
    "Nano mantém todos os objetos mapeados não-person com score≥0,50. Somente pessoa vem do consenso fixo de Nano+Tiny+S: cada detecção≥0,45, pelo menos dois heads distintos, uma detecção de cada head por cluster, IoU≥0,50 com todos os membros; caixa e score por média. Exige score final≥0,50. Nenhuma regra usa cama, quarto, pista de cena ou foto específica.",
    "",
    "Cada head foi inferido novamente e guardou todos os objetos mapeados antes do limite30; o export prevê80classes, das quais48 já têm nome no produto. Depois da composição: NMS por classe com IoU>0,45 e máximo30 GLOBAL. Somente então foram contados pessoa/cadeira/cama. Portanto outras classes participam da competição do limite, ao contrário do experimento anterior com brutos restritos aos três alvos.",
    "",
    "30novas imagens públicas COCOval2017: posições19–24 na mesma ordem SHA256 dos cinco estratos. Os90IDs anteriores foram reproduzidos exatamente e a ausência de interseção foi conferida antes da execução. Não houve grade nova nem ajuste após o resultado.",
    "",
    f"Protocolo SHA256: `{summary['protocolSHA256']}`.",
    "",
    "Gate de qualidade antes da execução: precisão de pessoa≥Nano, FP de pessoa<Nano, TP de pessoa≥Nano; cadeira/cama com TP não menor e FP não maior. Gate adicional: cada um dos três quadros aquecidos WASM≤3000ms. Correspondência normal IoU≥0,50, crowd por IoA≥0,50; sem reclassificar anotações.",
    "",
    "## Resultado nas30novas imagens",
    "",
    "| Política | Classe | TP | FP | FN | Precisão | Recall | Negativas com FP |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
]
for policy, data in [("Nano atual .50", results["nanoBaseline"]), ("Especialista pessoa", results["pipeline"])]:
    for cls, row in data.items():
        lines.append(f"| {policy} | {cls} | {row['tp']} | {row['fp']} | {row['fn']} | {100*row['precision']:.1f}% | {100*row['recall']:.1f}% | {row['negativeImagesWithFalseDetection']}/{row['negativeImages']} |")
lines += [
    "",
    "São56pessoas,55cadeiras e6camas anotadas. O ganho observado de pessoa é pequeno:5TP a mais e1FP a menos. Não anunciar85,3% como precisão geral. O recall de cadeira continua6/55(10,9%); este candidato mantém essa limitação do Nano.",
    "",
    "Na imagem370478, o Nano produziu uma pessoa onde não havia pessoa anotada; o consenso removeu essa detecção. Outros cinco FP de pessoa persistem nas imagens67616,555050 e411817. Concordância entre modelos não prova que a pessoa existe.",
    "",
    f"O limite30 não foi atingido por nenhuma das duas políticas nestas30imagens. Houve{summary['nonPersonChanges']}alterações no conjunto não-person: boxes/classes/scores de todos os objetos não-person finais coincidem com o Nano. Isso não garante ausência de efeito do limite em cenas mais densas.",
    "",
    "## WASM real com aquecimento e pré-processamento completo",
    "",
    "Chromeheadless155, ORTWeb1.30.0, WASM, uma thread. As três sessões ficaram carregadas simultaneamente. Uma chamada de aquecimento por modelo, com outputs finitos, depois três quadros com imagens públicas pré-declaradas. Nano/Tiny usam416; S usa640. Cada quadro inclui os três resizes letterbox114 com dimensões inteiras, RGB→BGR float32, inferências sequenciais, decode completo, NMS, consenso e limiteglobal.",
    "",
    "| Quadro público | Tempo total aquecido | Cumpre3000ms nesta execução |",
    "|---|---:|---|",
]
for frame in browser["frames"]:
    lines.append(f"| {frame['id']} | {frame['fullFrameWarmMs']:.1f}ms | {'Sim' if frame['wouldMeetBrain3000Ms'] else 'Não'} |")
lines += [
    "",
    "Zero pageerror. Carregamento dos modelos e decodificação JPEG ficam fora do relógio do quadro, como vídeo já decodificado. Não foi usada uma soma de tempos antigos: o relógio mediu resize→resultado de cada quadro. Os três quadros são dos primeiros três casos bed-without-person; o ensaio não cobre carga variada com o modelo de ambiente em paralelo, câmera real, transferência para worker, bateria ou uso prolongado.",
    "",
    "Resize browser usa canvas bilinear low, piso das dimensões e padding114, como o caminho de captura atual. Não foi afirmada igualdade de pixels com OpenCV. A composição JavaScript foi comparada separadamente ao Python nos30resultados completos:166detecções dos dois canais conferidas, diferença máxima0 e tolerância1e-9. Isso testa a política, não equivalência entre os runtimes de imagem/inferência.",
    "",
    "## Limites e arquivos",
    "",
    "COCOval2017 é conjunto conhecido de validação dos modelos; estes30casos estratificados não representam prevalência real nem COCOmAP. Não foram testados foto privada do usuário, ambientes brasileiros, câmera real, celular, leitores de tela, áudio audível, duração longa ou segurança. Nenhum arquivo de produto, Git ou Sites foi alterado.",
    "",
    "- protocol.json e image-sources.json: regras,IDs,origens,licenças e SHA256 antes da inferência.",
    "- results.json: todos os objetos mapeados de cada head antes do limite, composição final e contagens por imagem.",
    "- summary.json: gates limitados, métricas e limitações.",
    "- browser-compatibility.json: tempos reais de resize/inferência/decode/fusão e outputs.",
    "- composition-parity.json: conferência JS/Python nos30casos.",
    "- compare.py, pipeline-functions.mjs, browser-probe.mjs, check-composition.mjs, report.py e logs: reprodução.",
    "",
]
(ROOT / "RELATORIO.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"report": str(ROOT / "RELATORIO.md"), "summary": str(ROOT / "summary.json"), "limitedGatePassed": summary["combinedLimitedGatePassed"], "nonPersonChanges": summary["nonPersonChanges"]}, indent=2))
