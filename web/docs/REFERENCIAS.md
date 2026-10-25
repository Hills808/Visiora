# Referências e o que foi adotado

## Hierarquia da interface — 24/10/2026

[Be My Eyes](https://support.bemyeyes.com/hc/en-us/articles/360005528557-Getting-started-with-Be-My-Eyes), [Seeing AI](https://www.seeingai.com/ios) e [Google Lookout](https://support.google.com/accessibility/android/answer/9031274?hl=pt-BR): adotadas ação principal evidente, perguntas secundárias e separação entre tarefa e configuração. Não copiamos marca, recursos não implementados ou alegações de precisão/segurança. [Análise e escolhas](EVIDENCIAS/REDESIGN-VISUAL-2026-10-24.md).

## Avaliação de memória e comunicação — 19/10/2026

[W3C/WAI: Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/), consultado nesta data. Adotado no [protocolo MC-01](AVALIACAO-MEMORIA-COMUNICACAO.md): participação de usuários na avaliação, diversidade de experiência e explicitação do alcance, combinadas à avaliação de conformidade. Isso não comprova utilidade do Visiora nem valida suas prioridades e limiares de fala. **Nenhuma sessão humana foi realizada.** O&M e pessoas cegas ainda precisam avaliar as escolhas. [Evidência técnica, hipóteses e limites](EVIDENCIAS/MEMORIA-COMUNICACAO.md).

**Histórico:** a tabela abaixo veio do protótipo e não é evidência de adoção ou conformidade. Fontes de modelos foram consultadas novamente na pesquisa registrada em DECISOES.md, ADR-012. O estado implementado e seus limites estão em ARQUITETURA.md e LIMITES.md.

| Referência                                                              | Ideia adotada                                                                | Rejeitada                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| Microsoft Soundscape (descontinuado em 2023; fork comunitário)          | Sons direcionais espaciais, chamar lugares por direção relativa, pouco texto | Dependência de GPS/mapas                     |
| Seeing AI (Microsoft), Lookout (Google), Envision, Be My Eyes           | Modos separados (descrever, ler texto, procurar), voz curta                  | Dependência de nuvem                         |
| Orientação e mobilidade (O&M): posições do relógio, passos como unidade | Passos e direção em palavras; relógio como opção                             | —                                            |
| WCAG 2.2 / ARIA live regions                                            | Modo leitor de tela, contraste, alvos ≥ 44 px                                | —                                            |
| YOLOX / YOLO (ONNX Runtime)                                             | Detector trocável por ONNX                                                   | Pesos Ultralytics são AGPL: avalie a licença |
| Depth Anything V2 Metric-Indoor-Small (Apache-2.0)                      | Profundidade métrica interna                                                 | Versões Base/Large são CC-BY-NC              |
| SigLIP2                                                                 | Classificação zero-shot de tipo de lugar                                     | —                                            |
| Ollama + qwen3-vl                                                       | Descrição rica opcional, local                                               | Não é usada para alertas                     |

## Pesquisa de reconhecimento de ambientes (0.2.0)

Adotado experimentalmente SigLIP2 q4 pela imagem inteira, com categorias limitadas e rejeição. Places365 foi executado apenas em pesquisa. SmolVLM, Florence e Qwen foram pesquisados para análise aberta, sem integração ou medições próprias. Licenças, revisões, fontes primárias e resultados no ADR-012; não presumir que sugestão histórica já esteja funcionando.

## Atualização de reconhecimento 0.3.0

YOLOX Nano/Tiny/S verifica somente pessoas por consenso; SigLIP2 q4 e Places365 comparam a imagem inteira para ambientes. Resultados modestos e rejeições de RT-DETRv2, FP16 e SmolVLM estão em DECISOES.md ADR-014/015 e EVIDENCIAS/RECONHECIMENTO-0.3.0.md. Pesos Places365: CC BY sem versão indicada, atribuição dos autores e fonte incluídas; código MIT. Nenhuma regra deduz lugar pelos objetos. Catálogo compatível limitado a 34 tipos; análise aberta, conjunto brasileiro e validação com usuários continuam pendentes.
