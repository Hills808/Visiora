# Consenso de dois modelos de ambientes

**Resultado:** o consenso respondeu corretamente a duas imagens a mais, sem aumentar o número de erros nesta nova amostra. Passou a regra de desenvolvimento, mas **não confirmou a meta de 95%**: deu 16 acertos em 17 respostas, ou 94,1%. A decisão de adoção continua aberta; estes dados não comprovam precisão geral.

Nenhum arquivo do produto, Git ou Site foi alterado. Não foram usados imagem privada, parâmetros dela, regras de objetos, pesos novos, pacotes novos ou API paga.

## Regra congelada

1. Os dois modelos recebem **a mesma imagem RGB inteira** redimensionada diretamente para 224 × 224, com interpolação bilinear PIL. Não há recorte de objetos nem recorte central. SigLIP2 usa sua normalização e Places365 usa a normalização ImageNet. O Places foi reavaliado assim; não foram reutilizadas previsões da auditoria anterior, que usava recorte central.
2. O Places365 propõe a família da sua classe TOP1. A probabilidade é a da classe bruta, sem somar probabilidades da família. A margem compara essa classe à melhor classe de outra família.
3. Essa família precisa aparecer entre os **três primeiros candidatos brutos do SigLIP2 q4**, com cosseno de pelo menos 0,12 e diferença de no máximo 0,015 para o primeiro candidato Sig.
4. Se o primeiro candidato Sig for de rejeição, o consenso rejeita. Candidatos de rejeição não aprovam uma família.
5. A saída é **a família do TOP1 Places, apoiada pelo Sig**. Não é a categoria de um objeto nem uma frase criada por um modelo generativo.

Foram usadas somente as famílias já declaradas em `artifacts/recognition-upgrade/compare_places.py`. No Sig, apenas `children_room` → `childs_room` e `kindergarten` → `kindergarden_classroom` antecedem essa canonicalização. Outros nomes incompatíveis continuam incompatíveis. Não foram criadas equivalências para favorecer o resultado.

Os catálogos têm **34 categorias canônicas com nomes compatíveis**, descritas em `namespace-compatibility.json`. A regra vale para qualquer uma delas; os oito tipos de ambiente do conjunto não limitam a inferência. As demais categorias não recebem aprovação pelo consenso. Isso continua sendo reconhecimento com **catálogos limitados**, não análise visual aberta.

## Escolha somente no desenvolvimento

Foram usadas as mesmas 96 imagens públicas dos índices 0–11 por classe. Elas incluem pesquisas anteriores e não representam validação independente.

Grade congelada:

- Probabilidade Places: 0,30; 0,40; 0,50; 0,60; 0,70; 0,80.
- Margem Places entre famílias: 0,10; 0,15; 0,20; 0,25; 0,30.
- Aprovação: pelo menos 10 respostas, pelo menos 95% de precisão por família e no máximo um erro. Maximizar acertos; desempatar por precisão e limiares mais restritos.

Dos 30 pares, 25 passaram. A decisão congelada foi **probabilidade Places ≥ 0,30 e margem entre famílias ≥ 0,15**, além de todo o filtro Sig acima.

| Política | Acertos por família | Erros por família | Dúvidas | Precisão entre respostas |
| --- | ---: | ---: | ---: | ---: |
| SigLIP2 q4 atual, 0,12 / 0,03 | 28 | 0 | 68 | 100% em 28 respostas |
| Consenso escolhido | 37 | 0 | 59 | 100% em 37 respostas |

Essas frações descrevem somente este desenvolvimento pequeno. A regra de família também foi aplicada ao baseline para a comparação ser igual: sua contagem estrita anterior de 27 acertos e um erro vira 28 acertos por família, porque `kindergarten` pertence à família `classroom` já declarada. O JSON preserva também as contagens estritas, que não foram substituídas silenciosamente.

`protocol.json` foi gravado antes das previsões do desenvolvimento. `frozen-choice.json` preserva a escolha, os hashes do protocolo e do desenvolvimento e a marcação de que a confirmação ainda não havia sido aberta.

## Confirmação nova, sem recalibração

Somente depois de passar o desenvolvimento, foram selecionadas **40 novas imagens públicas**, índices 22–26 por classe no mesmo ordenamento por hash da fotografia original. Seus SHA-256 não se sobrepõem aos índices 0–21 já avaliados.

| Política congelada | Acertos por família | Erros por família | Dúvidas | Cobertura | Precisão entre respostas |
| --- | ---: | ---: | ---: | ---: | ---: |
| SigLIP2 q4 atual | 14 | 1 | 25 | 37,5% | 93,3% de 15 respostas |
| Consenso | 16 | 1 | 23 | 42,5% | 94,1% de 17 respostas |

O consenso ganhou nove respostas corretas que o q4 havia omitido e perdeu sete respostas corretas do q4, deixando saldo de duas. Três dos ganhos foram em quartos. Isso mostra uma mudança de cobertura, não melhora em todos os ambientes.

Se forem comparados os nomes brutos exatos das classes, os dois tiveram 14 respostas aceitas com nome igual ao alvo. A melhoria acima é da saída por família, por exemplo quarto em vez de exigir o subtipo exato do catálogo. Essa distinção foi definida antes do teste e está preservada nos resultados.

Os dois erraram a mesma fotografia anotada como `office`, respondendo `computer_room`. Esse caso continuou sendo erro; a família de escritório não foi ampliada depois do teste para apagá-lo. Anotações de pesquisa podem ser ambíguas, mas não foram revistas para elevar a métrica.

O resultado não atingiu 95% na confirmação. Não houve ajuste de limiar, família, catálogo ou recorte após conhecer os 40 resultados.

**A política medida é o consenso como decisão final.** Combinar suas respostas com todas as respostas do q4, ou usá-lo apenas quando o q4 tiver dúvida, seria outra política. Essa união ou fallback não foi congelada nem confirmada neste experimento.

## Custo e execução medidos

- ONNX Runtime nativo 1.23.2, CPU, quatro threads.
- Nos 40 novos exemplos, p50 exploratório do codificador Sig: **108,3 ms**; Places: **8,3 ms**; soma por imagem: **116,7 ms**.
- Esses tempos excluem leitura, preparação, câmera, rede, fala e uso simultâneo dos demais componentes. Não são latência do produto nem do celular.
- O peso local Places acrescentaria **45.445.545 bytes**, aproximadamente 45,4 MB, aos 63,3 MB do Sig visual atual, se fosse adotado. Não houve distribuição.

## Origem, licença e integridade

| Modelo | Bytes | SHA-256 |
| --- | ---: | --- |
| SigLIP2 visual q4 | 63.267.466 | `03e61be280fb24114facd87a1e1e6b2b654aad49845686da2f930c72740914aa` |
| Places365 ResNet18 ONNX F32 | 45.445.545 | `843436fd7a9c9af62382d1924948761cb0e03637f679710062e9a84f3d77a06e` |
| Checkpoint original Places365 | 45.506.139 | `2f4759217d470da2b803f8f66cd4488a066406b555a5fb95ee9a4663f9f05588` |

SigLIP2: conversão `onnx-community/siglip2-base-patch16-224-ONNX`, snapshot `ba1f3b0843f24bc5417d38e19c37b287d719b2f4`. Original `google/siglip2-base-patch16-224`, revisão `75de2d55ec2d0b4efc50b3e9ad70dba96a7b2fa2`, licença Apache-2.0. Os embeddings de texto q4 existentes permaneceram inalterados, SHA-256 `79e6e68e003271fc0ba71e1fc2fac953169bb6c70f6aa2919d072ada439d2600`.

Places365: checkpoint público dos autores CSAILVision/places365, arquitetura ResNet18, exportação local F32 opset17 já existente. Os autores declaram **CC BY para os pesos, sem especificar a versão**, e MIT para o código. Essa ressalva de licença não foi omitida. Nenhum novo pacote, peso ou conversão foi criado nesta tarefa.

## O que não foi testado

Não houve WASM ou WebGPU dos dois modelos juntos, medição de RAM, câmera real, movimento, áudio real, leitores de tela, uso prolongado, pessoas cegas ou com baixa visão, ambientes brasileiros, negativos específicos ou qualidade nas outras categorias compatíveis. Não foram testadas as categorias sem nome compatível.

As imagens são públicas, derivadas de MIT Indoor Scenes, com anotações que podem ser ambíguas e sobreposição desconhecida com o pré-treino. Não devem ser redistribuídas com o produto. Não há evidência para afirmar segurança, precisão geral, acessibilidade ou melhoria estatisticamente estabelecida.

## Artefatos

- `evaluate_consensus.py`: regra, protocolos, desenvolvimento e confirmação sequenciais.
- `protocol.json`, `development-selection.json`, `development.json`: preparação congelada e todas as 30 políticas.
- `frozen-choice.json`: decisão antes da confirmação.
- `confirmation-selection.json`, `confirmation.json`: hashes, previsões, resultados e tempos dos 40 novos exemplos.
- `namespace-compatibility.json`: as 34 categorias compatíveis, sem regras restritas aos oito tipos avaliados.
