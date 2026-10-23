# Conjunto de teste e benchmark — proposta v0.1

Data: 17/10/2026. Estado: **protocolo pronto; 0/30 cenas reais coletadas, 0 modelos executados**. Não há imagem sintética ou de demonstração substituindo a amostra brasileira exigida pelo plano.

## Unidade, divisão e consentimento

A unidade independente é uma cena capturada em ambiente interno no Brasil, não cada quadro do mesmo vídeo. Núcleo de avaliação: seis tipos de lugar × cinco cenas = 30; imagens e vídeos da mesma cena contam uma vez. Separar conjunto de desenvolvimento antes da coleta: propor 12 cenas adicionais de outros locais (duas por tipo), para calibrar rótulos/limiares. Não ajustar modelo no conjunto de 30 e reportá-lo como teste independente. Se só houver 30, registrar a limitação e usar os 30 como avaliação congelada, sem calibrar neles.

Cada cena do núcleo tem um quadro estável e um clipe curto, idealmente de 20–30 s, com câmera/posição documentadas. Pelo menos três espaços físicos distintos por tipo; variantes do mesmo local ficam no mesmo split. Um banheiro vazio, por exemplo, não recebe pessoas apenas para diversificar. Ambientes privados/pessoas só com autorização do responsável e consentimento dos participantes; sem nomes, documentos, rostos identificáveis ou menores. Não filmar banheiros em uso.

Esta coleta é separada do uso normal do app: guardar imagens/vídeos de pesquisa exige opt-in específico, finalidade, prazo de retenção proposto de 30 dias após análise e opção de apagar; prazo deve ser acordado. Arquivos reais ficam localmente sob acesso restrito e fora de Git. Publicar somente métricas/manifesto sem dados identificáveis. Não coletar ou enviar imagens nesta fase.

## Manifesto das 30 cenas propostas

Cada linha abaixo é um plano de captura, não um arquivo existente. “Variar” significa usar locais/arranjos autorizados diferentes, evitando que cinco tomadas quase iguais virem cinco evidências independentes.

| ID | Lugar real | Variação / referência prioritária |
|---|---|---|
| BR-SAL-01 | Sala | Iluminação normal, sofá/cadeira e porta |
| BR-SAL-02 | Sala | Pouca luz, móveis contrastando pouco |
| BR-SAL-03 | Sala | Contraluz na janela, porta lateral |
| BR-SAL-04 | Sala | Mobiliário parcialmente ocluído; sem inferir o oculto |
| BR-SAL-05 | Sala | Pessoa parada e mudança controlada de objeto |
| BR-QUA-01 | Quarto | Cama, cadeira e armário, luz normal |
| BR-QUA-02 | Quarto | Espaço pequeno, câmera no peito |
| BR-QUA-03 | Quarto | Baixa iluminação, fundo parecido |
| BR-QUA-04 | Quarto | Objetos cortados nas bordas |
| BR-QUA-05 | Quarto | Porta lateral e cama parcialmente ocluída |
| BR-RES-01 | Restaurante | Mesas/cadeiras, sem pessoas identificáveis |
| BR-RES-02 | Restaurante | Arranjo denso, cadeiras próximas entre si |
| BR-RES-03 | Restaurante | Reflexos, nenhuma promessa sobre vidro |
| BR-RES-04 | Restaurante | Pessoa consentida e oclusão de cadeira |
| BR-RES-05 | Restaurante | Porta/balcão; não inferir saída nem cadeira vazia |
| BR-COR-01 | Corredor | Porta à direita, parede uniforme |
| BR-COR-02 | Corredor | Porta à esquerda e contraluz |
| BR-COR-03 | Corredor | Pessoa consentida aproximando-se com roteiro |
| BR-COR-04 | Corredor | Giro no lugar, sem pessoa se aproximando |
| BR-COR-05 | Corredor | Poucos objetos; testar “não sei” |
| BR-BAN-01 | Banheiro vazio | Pia e vaso, autorização do local |
| BR-BAN-02 | Banheiro vazio | Espelho e reflexo como casos de falso positivo |
| BR-BAN-03 | Banheiro vazio | Iluminação fraca, sem pessoas |
| BR-BAN-04 | Banheiro vazio | Pia/vaso parcialmente ocluídos |
| BR-BAN-05 | Banheiro vazio | Porta lateral e espaço pequeno |
| BR-ESC-01 | Sala de aula/escola | Carteiras, cadeiras, quadro e porta |
| BR-ESC-02 | Sala de aula/escola | Carteiras em grupo, cenário ambíguo com escritório |
| BR-ESC-03 | Sala de aula/escola | Quadro parcialmente ocluído e contraluz |
| BR-ESC-04 | Sala de aula/escola | Pessoa adulta consentida; sem menores |
| BR-ESC-05 | Sala de aula/escola | Sala vazia/poucas carteiras, incerteza de lugar |

Manifesto futuro por amostra: ID, split, ID pseudônimo do local, hash SHA-256 do arquivo, autorização/consentimento armazenados separadamente, licença de uso, câmera/resolução/FPS, orientação e espelhamento, altura, campo de visão/calibração, iluminação, timestamps, rótulo real do lugar e ambiguidades. Não armazenar endereço exato no repositório.

## Anotações e verdade-terreno

- Dois anotadores revisam classe, caixa normalizada, identidade temporária no clipe, visibilidade/oclusão e relevância para a fala; divergências são adjudicadas e registradas.
- Medir posição e distância com trena, não com saída do modelo. Distância de referência: ponto da câmera projetado no chão ao ponto de referência do objeto projetado no chão; marcar também distância Z quando necessária à comparação do depth. Registrar ambas quando diferirem. Pontos escolhidos devem ser consistentes por classe.
- Em pelo menos três ambientes reais, medir alvos nas faixas 1, 2, 3, 4, 5 e 6 m onde houver espaço. Proposta: 18 posições de alvo × três ambientes = 54 posições medidas, com medidas repetidas. Não fabricar 6 m em quarto pequeno; trocar local ou declarar cobertura ausente.
- Bearing: medir ângulo do centro/referência do alvo em relação ao eixo óptico não espelhado e yaw do usuário. Validar FOV/intrínsecos e transformação; anotar incerteza de trena/ângulo.
- Marcar início/fim de giro, entradas/saídas do FOV, aproximação de pessoa, oclusões e falas permitidas/proibidas. Distância sem medição vira desconhecida; ausência no detector não significa inexistência no local.
- Distinguir porta, saída, cadeira e disponibilidade de cadeira. A anotação não autoriza ao modelo afirmar atributo que ele não mede.

## Ensaios adicionais, separados do núcleo de 30

| Ensaio | Amostragem proposta | Critérios e limites |
|---|---|---|
| Cena estática | 3 ambientes × clipe de 10 min, sem replay transformado em amostra independente | CA-F1 (janela de 5 min) e CA-P3 (fantasmas falados ≤ 1/10 min) |
| Aproximação | 30 trajetórias: 3 locais × 2 velocidades (0,5 e 1,0 m/s) × 5 repetições | CA-P5, ≥ 27/30 avisos; reportar por velocidade/local e intervalo de incerteza |
| Controles de aproximação | 30 negativos: 10 pessoa parada com giro da câmera; 10 deslocamento lateral; 10 afastamento | Nenhum falso aviso causado por giro; negativos não entram no denominador dos 90% |
| Giro | 0, 14,9, 15, 15,1 e 30°/s; cruzar ±180°, jitter e sensor ausente | CA-F5, casos de fronteira; taxas exatas primeiro no simulador |
| Profundidade ausente/inválida | null, NaN, infinito, ≤ 0, fora de faixa, relativa, antiga e com frame errado | CA-P6; nenhuma distância dita; medir quanto ainda consegue descrever direção |
| Transporte atrasado | Respostas fora de ordem, > 3 s, desconexão, câmera travada | CA-D4 e degradação honesta; não repetir quadro como detecção nova |
| Resistência | Sessão local contínua de 30 min após aquecimento | CA-D5: sem queda e crescimento de memória ≤ 10%; registrar baseline e pico |
| Uso humano | ≥ 8 participantes, sessão da seção 13 | CA-A4/A5; não substituir por avaliadores com olhos vendados |

Nenhum participante com deficiência visual precisa andar em trajetória de aproximação; adultos da equipe podem executar ensaio de câmera em área controlada. Escadas/degraus reais não são usados para validar deslocamento. Esses objetos podem existir apenas no simulador como teste de mensagem, sem promessa de detector real.

## Protocolo de benchmark local

1. Registrar PC-REF-01 exato: CPU, núcleos, RAM, SO/build, GPU/VRAM/driver (se houver), energia, navegador, Python, ONNX Runtime/PyTorch, providers, threads e versões. Confirmar CPU como caminho obrigatório; GPU opcional em máquina disponível, sem serviço pago. Não deduzir GPU física a partir de PyTorch CPU.
2. Fixar variante, revisão de código, checkpoint, SHA-256, licença de código e peso, bytes, precisão, input, normalização, redimensionamento, vocabulário e pós-processamento. Converter por procedimento oficial. Testar equivalência de caixa e escore com o runtime original antes de comparar ONNX. Um decoder de YOLO não serve automaticamente a RF-DETR/RT-DETR/YOLOX.
3. Usar uma imagem por chamada (batch 1), concorrência 1, sem gravação de imagens/saídas visuais por padrão. Inputs de pesquisa já consentidos são lidos localmente. Downloads e aquecimento ocorrem fora da medição. Depois da preparação, desligar rede externa durante ensaio de uso normal.
4. Guardar tempo de carga/primeira inferência separadamente. Proposta de medição quente: 20 inferências de aquecimento, depois 10 passagens completas pelas 30 cenas (300 amostras por configuração), ordem de cenas fixa/registrada e ordem de modelos alternada. Esses números pertencem à configuração do experimento, não à lógica do produto. Sincronizar GPU antes/depois do cronômetro se houver.
5. Medir decode, pré-processamento, inferência, pós-processamento e total quadro→resposta; pipeline combinado detector+depth+cena e não só componentes isolados. Quando profundidade/cena tiverem frequências diferentes, reportar quadros completos e leves separadamente, além do agregado. Incluir atrasos/transporte no fim a fim.
6. Registrar p50/p95 por modelo e pipeline, máximo, frames descartados, timeout/erro, RSS de pico, memória estabilizada e VRAM de pico. Não chamar pesos em MB de consumo de RAM. Guardar cada amostra e método de percentil. Não ocultar falhas com exclusões sem regra prévia.
7. Avaliar detecção em todas as cenas; medir profundidade nos pontos anotados; classificador nos seis tipos; alimentar fatos no cérebro somente depois de validar contrato. Falas sobre falsos positivos são métrica própria. Não tratar replay de vídeo acelerado como latência de câmera real.
8. Congelar limiares no desenvolvimento e executar teste uma vez por decisão. Mudou checkpoint/limiar/preprocessamento? Nova versão do experimento, justificativa e repetição correspondente. Manter resultado negativo.

## Métricas e aceite

| Medida | Definição e vínculo |
|---|---|
| Detecção | Precisão/recall/F1 com matching por classe e IoU ≥ 0,5 como protocolo proposto; AP se houver anotação suficiente; reportar por classe, incluindo classes não cobertas pelo modelo |
| Qualidade percebida | Dois revisores humanos classificam cada referência falada como correta/incorreta/indeterminada e útil/não útil; descrever concordância. Isso não é CA-A4 |
| Bearing | Mediana do erro angular absoluto com diferença circular, CA-P1 ≤ 10°; reportar p95 e cobertura |
| Distância | Mediana de |estimada-real|/real entre 1–6 m, CA-P2 ≤ 25%; informar cobertura, falhas e fonte métrica. Não excluir sistematicamente casos difíceis sem reportá-los |
| Lugar | Acertos top-1 / 30; CA-P4 pede ≥ 24/30 (80%). Registrar abstenções separadamente e erros confiantes; “não sei” abaixo do limiar é comportamento correto, não acerto top-1 |
| Fantasmas | Objetos inexistentes efetivamente falados / 10 min, CA-P3 ≤ 1; manter falsos positivos visuais e de fala separados |
| Latência | CA-D1 p50 ≤ 150 ms e p95 ≤ 400 ms no PC fixado; CA-D2 surgimento→início de áudio p95 ≤ 1,2 s; CA-D3 pedido→início ≤ 800 ms |
| Voz real | Sincronizar evento visual e início audível com gravação de ensaio consentida/local ou instrumento; callback de TTS/voz stub não basta para áudio |
| Memória/robustez | CA-D4 descarte 100% de quadros > 3 s sem fila crescente; CA-D5 30 min sem queda/crescimento > 10% |

Propor cobertura mínima adicional antes da escolha para evitar “boa precisão” por omitir quase tudo; registrar essa decisão após o piloto, sem alterar os CAs silenciosamente. Trinta cenas são um piloto pequeno: reportar contagens e incerteza, sem generalizar a todo o Brasil.

## Estrutura de resultados esperados

Um manifesto identifica entradas e configuração; um CSV de amostras contém `run_id`, cena/frame, modelo/revisão/hash, provider, input, tempos por etapa/total, RAM/VRAM e erro; outro contém matching, classe, bearing/distância, confiança, abstenção e julgamento humano. Relatório em `EVIDENCIAS/` associa cada conclusão ao CA e lista o que não foi medido. Não há linhas de resultado preenchidas nesta versão.

**Bloqueios atuais:** conjunto/consentimentos inexistentes; protótipo incompleto; pytest/playwright/onnx ausentes; instalação de dependências falhou; acesso local ao HF falhou em DNS; GPU não inventariada. A pesquisa de tabelas oficiais está em DECISOES, separada das medições futuras.
