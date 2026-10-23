# Consenso fixo de dois entre três detectores YOLOX

O consenso ampliou a quantidade de objetos encontrados, mas não reduziu os erros nas três classes em conjunto. A regra de continuar não passou; não foram baixadas nem inferidas outras30 imagens.

## Regra congelada antes de processar os resultados

Nano+Tiny+S, cada detecção com score≥0,45. Candidatos em ordem decrescente de score; desempate pelo nome do head e índice original. A partir da maior detecção disponível, adicionar no máximo uma detecção de cada outro head, da mesma classe e com IoU≥0,50 com todos os membros atuais. Isso impede juntar objetos diferentes por uma cadeia frouxa de sobreposições. Exigir pelo menos dois modelos distintos. Fundir caixa e score por média aritmética. NMS entre clusters da mesma classe com IoU>0,45; máximo30 no conjunto final. Nenhuma regra específica de pessoa/cadeira/cama ou de foto.

SHA256 do protocolo: `8be3d0a75e6724f3a1b74bb2fdd238d985191293ee3d023a2fb9d0594804e120`.

Comparação: Nano atual com score≥0,50. Mesmas anotações e avaliador: match normal com IoU≥0,50 antes de eventual ignore crowd com interseção/área da detecção≥0,50. Nenhum rótulo foi alterado. Resultados nos60dev e nos30 anteriores são todos exploratórios para esta nova regra, pois seus dados já haviam sido inspecionados.

A condição operacional pré-declarada para novas30 era precisão e recall não inferiores ao Nano em cada uma das três classes nas duas partições, com algum ganho. Não é teste estatístico nem comprovação de superioridade.

## Resultados

| Partição | Regra | Classe | TP | FP | FN | Precisão | Recall | Negativas com FP |
|---|---|---|---:|---:|---:|---:|---:|---:|
| development60-exploratory | Nano .50 | person | 58 | 2 | 44 | 96.7% | 56.9% | 0/36 |
| development60-exploratory | Nano .50 | chair | 8 | 0 | 69 | 100.0% | 10.4% | 0/33 |
| development60-exploratory | Nano .50 | bed | 7 | 1 | 6 | 87.5% | 53.8% | 0/47 |
| development60-exploratory | Consenso fixo | person | 68 | 2 | 34 | 97.1% | 66.7% | 0/36 |
| development60-exploratory | Consenso fixo | chair | 15 | 4 | 62 | 78.9% | 19.5% | 0/33 |
| development60-exploratory | Consenso fixo | bed | 8 | 2 | 5 | 80.0% | 61.5% | 0/47 |
| priorConfirmation30-exploratory | Nano .50 | person | 27 | 3 | 27 | 90.0% | 50.0% | 1/18 |
| priorConfirmation30-exploratory | Nano .50 | chair | 7 | 2 | 15 | 77.8% | 31.8% | 1/16 |
| priorConfirmation30-exploratory | Nano .50 | bed | 3 | 0 | 4 | 100.0% | 42.9% | 0/23 |
| priorConfirmation30-exploratory | Consenso fixo | person | 34 | 0 | 20 | 100.0% | 63.0% | 0/18 |
| priorConfirmation30-exploratory | Consenso fixo | chair | 9 | 3 | 13 | 75.0% | 40.9% | 2/16 |
| priorConfirmation30-exploratory | Consenso fixo | bed | 5 | 0 | 2 | 100.0% | 71.4% | 0/23 |

Nos30 anteriores, pessoa melhorou de27TP/3FP/27FN para34TP/0FP/20FN e cama de3TP/0FP/4FN para5TP/0FP/2FN. Já cadeira passou de7TP/2FP/15FN para9TP/3FP/13FN: mais acertos e também mais erros, com precisão menor. Nos60dev, o consenso criou quatro FP de cadeira contra zero do Nano e dois FP de cama contra um. Portanto não houve melhoria uniforme.

## Limites e custo

Os brutos arquivados guardam somente as três classes alvo depois do máximo30 global de cada detector. Por isso o limite30 do consenso aqui atua somente nesses alvos; uma implementação genérica do produto com todas as classes também teria competição das demais classes e não é reproduzida integralmente por este ensaio. Não extrapolar os resultados para80 classes.

Modelos podem concordar no mesmo erro. Concordância não prova existência nem transforma a média de scores em probabilidade calibrada. O consenso exige três inferências por quadro analisado; tempo total, consumo de memória e efeito sobre a câmera não foram medidos neste experimento.

Não é COCOmAP nem validação independente: COCOval2017 é conjunto conhecido de validação dos modelos, e esta amostra estratificada não representa prevalência real. Não foram testados foto privada, câmera, áudio audível, leitores de tela, celular, ambientes brasileiros ou uso prolongado. Não houve alteração em produto, Git ou Sites.

## Arquivos

- protocol.json: parâmetros, fontes/hash e condição antes da avaliação.
- exploratory-results.json: caixas fundidas, membros por head, TP/FP/FN e comparador por imagem.
- summary.json: resumo e exemplos de erros.
- exploratory.log: saída real da execução.
- explore.py e report.py: reprodução sem nova inferência.
