# Evidências da revisão inicial

Data: 17/10/2026. Todos os comandos foram iniciados com diretório de trabalho dentro da pasta selecionada ou seus subdiretórios. Não houve comando iniciado fora dela, instalação global, alteração de protótipo ou publicação.

## Ambiente observado

| Item | Observação real |
|---|---|
| Sistema informado pelo Python | Windows-10-10.0.26200-SP0; nome comercial não confirmado |
| Processador informado pelo ambiente | Intel64 Family 6 Model 165 Stepping 5, GenuineIntel; 16 processadores lógicos |
| RAM física via GlobalMemoryStatusEx | 23,9 GiB |
| Node / npm | v24.11.0 / 11.6.1 |
| Python | 3.11.9 |
| PyTorch | 2.10.0+cpu; `torch.cuda.is_available()` = False |
| Módulos encontrados | numpy, PIL, fastapi, uvicorn, httpx, onnxruntime, torch, transformers |
| Módulos não encontrados | pytest, onnx, playwright |

A consulta CIM para CPU/RAM/GPU foi negada. O fallback confirmou RAM e identificador genérico da CPU. A ausência de CUDA no PyTorch CPU **não prova ausência de GPU física**. Modelo exato de CPU, GPU, driver e execução DirectML não foram confirmados. Não usar esta máquina como referência definitiva sem inventário completo.

## Comandos e limites

As saídas originais das cinco tentativas de teste estão nos arquivos `.log` desta pasta. Os testes Node falharam na importação, antes de executar os casos; isso não demonstra defeito nas regras do cérebro. A suíte Python e o E2E também não chegaram aos casos. A chamada E2E foi suficiente para registrar a dependência ausente; o app não foi iniciado.

Instalação tentada, da raiz selecionada:

```powershell
python -m pip install --target .\work\prototype-deps --cache-dir .\work\pip-cache --disable-pip-version-check --timeout 10 --retries 0 pytest onnx
```

Resultado: código 1; `Could not find a version that satisfies the requirement pytest (from versions: none)` e `No matching distribution found for pytest`. Não se atribui a causa exata sem diagnóstico adicional. A requisição de metadados do modelo separadamente falhou em resolução de DNS.

## Análise estática dos anexos — não são falhas reproduzidas em execução

| Achado | Evidência no texto recebido | Consequência / teste futuro |
|---|---|---|
| Critérios antigos mais frouxos | `narrator.test.mjs`: briefing ≤ 6 s e frases delta/alerta ≤ 32 palavras | Exigir briefing ≤ 5 s estáveis e ≤ 25 palavras equilibradas (briefing aproximadamente 45), conforme plano; CA-F7 e RF2 |
| Teste não prova frase fixa | `realize.test.mjs` aceita variação e verifica principalmente termos | Testar prefixo exato dos oito setores; CA-F3 |
| Tamanho típico tratado como profundidade conhecida | `geometry.test.mjs` espera `known=true` quando só há prior de altura, sem depth | Separar estimativa por tamanho de profundidade métrica válida; CA-P6/F3. Não reaproveitar essa expectativa como contrato final |
| Entidade sem distância pode desaparecer | `world.test.mjs` espera remover objeto sem depth nem prior | Avaliar entidade só com bearing para preservar direção sem inventar mapa métrico; CA-P6/F3 |
| VLM solicita passos sem evidência métrica | `ollama_vlm.py`, prompt `surroundings` pede distância em passos a partir de JPEG e comprimento de passo | Remover distância generativa antes de eventual adoção; VLM só auxiliar e pós-MVP; CA-P6 |
| Percepção guarda informação de quadros anteriores | `pipeline.py` mantém `_depth_map`, `_scene_probs`, contadores e tempos | Contraria o serviço sem estado descrito no plano. Risco inferido de aplicar depth antigo em outra cena; exigir proveniência e não reutilizar mapas sem alinhamento comprovado; CA-P2/P6/S1 |
| Lacuna na classificação de corredor | `hf_scene.py` não inclui `corridor` nos oito rótulos | Incluir corredor no vocabulário de teste e calibrar abstenção; CA-P4/F9 |
| Adaptador ONNX assume formatos e pré-processamento comuns | `onnx_yolo.py` usa um input, primeiro output, letterbox e RGB/255 | Exportação de outro detector não está validada por isso; testar coordenadas, normalização, rótulos e múltiplos outputs por backend; CA-P1/P6/E4 |
| O E2E coleta resultados, sem assertivas de aceite | `e2e.py` imprime JSON, usa câmera falsa/voz stub e esperas fixas | Saída 0 por si só não prova CA-D/A. Futuro E2E deve esperar eventos e falhar por critérios; CA-E1/A1/D3 |
| Estado de fala não foi demonstrado | Não foi recebido teste específico completo de Speaker/TTL/confirmar fragmentos | Cobrir início, fim, cancelamento, expiração e callbacks tardios; CA-F6 |

Nenhuma dessas observações autorizou reescrita nesta fase. Os originais em `work/prototipo/` são referência importada em texto, com estrutura inferida; não foram promovidos a código final. A transferência binária dos anexos falhou; as cópias locais vieram da leitura textual integral, podendo diferir na terminação de linha. Preservam-se os anexos como originais.

## Mapeamento de evidências

| Grupo | Situação |
|---|---|
| CA-F1…F9 | Não demonstrados; testes bloqueados. Análise estática não os aprova |
| CA-P1…P6 | Não medidos com modelos/cenas reais; P5/P6 simulados também bloqueados |
| CA-D1…D5 | Não medidos; nenhum número bibliográfico vale como medição local |
| CA-A1…A5 | Não executados; nenhuma alegação de acessibilidade validada |
| CA-E1…E5 | Critérios ainda não cumpridos; licenças pesquisadas não equivalem à auditoria da instalação |
| CA-S1…S4 | Sem ensaio de execução/tráfego/sistema de arquivos; não aprovados por inspeção de código |

## Retomada

Receber o arquivo completo preservando pastas, conferir AGENTS/README e manifests, instalar só dependências documentadas em ambiente do projeto, rodar comandos originais e guardar saídas/códigos/versões/hash de entrada. Só então comparar transcrições e decidir o reaproveitamento. Não fabricar `package.json`, simulador ou mocks substitutos para declarar a execução do original.
