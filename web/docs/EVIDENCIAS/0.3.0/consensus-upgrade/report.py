"""Summarize the frozen consensus experiment; no tuning or new inference."""

import json
from pathlib import Path

import explore

ROOT = Path(__file__).resolve().parent
report = json.loads((ROOT / "exploratory-results.json").read_text())
summary = {
    "protocolSHA256": report["protocolSHA256"],
    "rawResultsSHA256": explore.sha(ROOT / "exploratory-results.json"),
    "partitions": {key: {field: value for field, value in part.items() if field not in ("rows", "scores", "nanoScores")} for key, part in report["partitions"].items()},
    "gatePassed": report["new30PermittedByFrozenGate"],
    "new30DownloadedOrInferred": False,
    "parametersChangedAfterResults": False,
    "privateImageUsed": False,
    "productFilesChanged": False,
    "falsePositiveExamples": {},
    "limitations": json.loads((ROOT / "protocol.json").read_text())["limitations"],
    "conclusion": "Fixed two-of-three consensus increased recall but failed the predeclared precision/recall gate across all3classes. In particular chair FP increased and precision fell in both partitions versusNano.50. Stop: no new30, no threshold grid, no further variants.",
}
for name, part in report["partitions"].items():
    summary["falsePositiveExamples"][name] = [{"id": row["id"], "class": cls, "tp": item["tp"], "fp": item["fp"], "fn": item["fn"], "gt": item["gt"], "falsePositiveBoxes": item["falsePositives"]} for row in part["scores"] for cls, item in row["score"].items() if item["fp"]]
explore.write("summary.json", summary)
lines = [
    "# Consenso fixo de dois entre três detectores YOLOX",
    "",
    "O consenso ampliou a quantidade de objetos encontrados, mas não reduziu os erros nas três classes em conjunto. A regra de continuar não passou; não foram baixadas nem inferidas outras30 imagens.",
    "",
    "## Regra congelada antes de processar os resultados",
    "",
    "Nano+Tiny+S, cada detecção com score≥0,45. Candidatos em ordem decrescente de score; desempate pelo nome do head e índice original. A partir da maior detecção disponível, adicionar no máximo uma detecção de cada outro head, da mesma classe e com IoU≥0,50 com todos os membros atuais. Isso impede juntar objetos diferentes por uma cadeia frouxa de sobreposições. Exigir pelo menos dois modelos distintos. Fundir caixa e score por média aritmética. NMS entre clusters da mesma classe com IoU>0,45; máximo30 no conjunto final. Nenhuma regra específica de pessoa/cadeira/cama ou de foto.",
    "",
    f"SHA256 do protocolo: `{report['protocolSHA256']}`.",
    "",
    "Comparação: Nano atual com score≥0,50. Mesmas anotações e avaliador: match normal com IoU≥0,50 antes de eventual ignore crowd com interseção/área da detecção≥0,50. Nenhum rótulo foi alterado. Resultados nos60dev e nos30 anteriores são todos exploratórios para esta nova regra, pois seus dados já haviam sido inspecionados.",
    "",
    "A condição operacional pré-declarada para novas30 era precisão e recall não inferiores ao Nano em cada uma das três classes nas duas partições, com algum ganho. Não é teste estatístico nem comprovação de superioridade.",
    "",
    "## Resultados",
    "",
    "| Partição | Regra | Classe | TP | FP | FN | Precisão | Recall | Negativas com FP |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|",
]
for name, part in report["partitions"].items():
    for label, data in [("Nano .50", part["nanoBaseline"]), ("Consenso fixo", part["summary"])]:
        for cls, row in data.items():
            lines.append(f"| {name} | {label} | {cls} | {row['tp']} | {row['fp']} | {row['fn']} | {100*row['precision']:.1f}% | {100*row['recall']:.1f}% | {row['negativeImagesWithFalseDetection']}/{row['negativeImages']} |")
lines += [
    "",
    "Nos30 anteriores, pessoa melhorou de27TP/3FP/27FN para34TP/0FP/20FN e cama de3TP/0FP/4FN para5TP/0FP/2FN. Já cadeira passou de7TP/2FP/15FN para9TP/3FP/13FN: mais acertos e também mais erros, com precisão menor. Nos60dev, o consenso criou quatro FP de cadeira contra zero do Nano e dois FP de cama contra um. Portanto não houve melhoria uniforme.",
    "",
    "## Limites e custo",
    "",
    "Os brutos arquivados guardam somente as três classes alvo depois do máximo30 global de cada detector. Por isso o limite30 do consenso aqui atua somente nesses alvos; uma implementação genérica do produto com todas as classes também teria competição das demais classes e não é reproduzida integralmente por este ensaio. Não extrapolar os resultados para80 classes.",
    "",
    "Modelos podem concordar no mesmo erro. Concordância não prova existência nem transforma a média de scores em probabilidade calibrada. O consenso exige três inferências por quadro analisado; tempo total, consumo de memória e efeito sobre a câmera não foram medidos neste experimento.",
    "",
    "Não é COCOmAP nem validação independente: COCOval2017 é conjunto conhecido de validação dos modelos, e esta amostra estratificada não representa prevalência real. Não foram testados foto privada, câmera, áudio audível, leitores de tela, celular, ambientes brasileiros ou uso prolongado. Não houve alteração em produto, Git ou Sites.",
    "",
    "## Arquivos",
    "",
    "- protocol.json: parâmetros, fontes/hash e condição antes da avaliação.",
    "- exploratory-results.json: caixas fundidas, membros por head, TP/FP/FN e comparador por imagem.",
    "- summary.json: resumo e exemplos de erros.",
    "- exploratory.log: saída real da execução.",
    "- explore.py e report.py: reprodução sem nova inferência.",
    "",
]
(ROOT / "RELATORIO.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"report": str(ROOT / "RELATORIO.md"), "summary": str(ROOT / "summary.json"), "new30Permitted": report["new30PermittedByFrozenGate"]}, indent=2))
