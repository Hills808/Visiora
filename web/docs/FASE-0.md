# Visiora — revisão da Fase 0

Data: 17/10/2026. Estado: **planejamento e pesquisa documental entregues; Fase 0 ainda não concluída**.
Nenhum código de produto foi escrito, nenhum site foi publicado e a Fase 1 não começou.

## Entendimento em 8 linhas

1. Pessoas cegas ou com baixa visão usam câmera e voz pt-BR para formar um mapa mental de ambientes internos.
2. O app informa o lugar, referências úteis e direções relativas; silêncio é o estado normal.
3. Distância em passos exige profundidade válida; sem ela, falar só direção e admitir a limitação.
4. Não repetir sem entidade nova relevante, aproximação real a ≤ 60% da distância dita ou pedido explícito.
5. Não falar durante giro acima de 15°/s; marcar como dito apenas o conteúdo efetivamente falado.
6. Não prometer caminho livre, navegação segura, identificação de pessoas, degraus ou vidro confiáveis.
7. Tudo funciona localmente, sem API paga, conta ou nuvem obrigatória; imagens não são gravadas por padrão.
8. Simulação prova lógica; visão real, voz e uso com pessoas exigem evidências próprias.

## Resultado real das tentativas de teste

O diretório selecionado inicialmente só continha `work/` e `outputs/`, sem arquivos. Os anexos chegaram separados. Foram colocadas cópias textuais dos 20 arquivos de código recebidos em `work/prototipo/`, em caminhos inferidos pelos imports e comandos do AGENTS. Não é um checkout completo. Não reconstruí implementações ausentes para fazer os testes passarem.

| Comando | Resultado desta sessão | Evidência |
|---|---|---|
| `npm test` | Bloqueado: ENOENT, `package.json` ausente; saída -4058 no PowerShell | `EVIDENCIAS/npm-test.log` |
| `node tools/simulate.mjs` | Bloqueado: `web/js/sim/simulator.js` ausente; saída 1 | `EVIDENCIAS/simulate.log` |
| `node --test tests/*.test.mjs` | 5 arquivos falharam no carregamento por módulos ausentes; 0 testes de comportamento aprovados; saída 1 | `EVIDENCIAS/node-test.log` |
| `cd perception` e `python -m pytest` | Bloqueado: `No module named pytest`; saída 1 | `EVIDENCIAS/pytest.log` |
| `python tests/e2e/e2e.py http://127.0.0.1:8765 <dir>` | Bloqueado no import de `playwright`; saída 1. Nenhum servidor/app foi iniciado | `EVIDENCIAS/e2e.log` |

Os anexos descrevem 40 testes do cérebro e 13 de percepção aprovados anteriormente. **Isso é histórico relatado pelos documentos, não resultado reproduzido aqui.** A contagem de definições nos arquivos recebidos é 40 e 13, respectivamente; contagem não significa execução. Não houve transcrição nova do simulador.

A tentativa de instalar `pytest` e `onnx` em uma pasta interna ao projeto falhou: `No matching distribution found for pytest`. Não houve instalação global. Consulta local de um `config.json` oficial no Hugging Face falhou com `URLError: [Errno 11001] getaddrinfo failed`. Portanto nenhum peso real foi executado. A leitura de páginas na pesquisa funcionou; isso não demonstra acesso de download no Python.

## Entregas para revisão

| Arquivo | Conteúdo |
|---|---|
| `REQUISITOS.md` | Hipóteses, roteiro de entrevistas, sessão futura com usuários, design system e exemplos de fala |
| `CONJUNTO-DE-TESTE.md` | 30 cenas propostas, anotação, consentimento, métricas e protocolo reproduzível |
| `DECISOES.md` | Fontes oficiais, variantes/licenças, números publicados e decisões provisórias |
| `PLANO-FASE-1.md` | Tarefas, dependências, testes, critérios CA-* e saída da fase |
| `EVIDENCIAS/FASE0-EXECUCAO.md` | Ambiente, falhas de execução, análise estática e lacunas |

## O que falta para encerrar a Fase 0

- Receber o protótipo completo, incluindo README, `package.json`, lockfile/configuração Python, `web/js`, estilos e demais recursos. Reexecutar os comandos sem mudar o comportamento.
- Realizar 5+ entrevistas com pessoas cegas/baixa visão e 1–2 instrutores de Orientação e Mobilidade. O roteiro está pronto; nenhuma pessoa foi entrevistada.
- Coletar com autorização e anotar as 30 cenas. Ainda não existe conjunto de imagens/vídeos brasileiro recebido ou coletado nesta sessão.
- Fixar PC de referência e checkpoints, obter dependências/pesos e medir qualidade, p50/p95 e memória em CPU e GPU disponível. Não eleger modelo por números de outro hardware.
- Revisar as divergências registradas em DECISOES e aprovar o escopo da Fase 1.

## O que NÃO foi testado

Modelos/pesos reais; webcam; voz audível pt-BR; câmera/sensores de celular; NVDA, VoiceOver ou TalkBack; rede local com HTTPS; processamento offline completo; qualidade das 30 cenas; latência/memória de inferência; cobertura, lint, tipos, CI, privacidade em execução e uso com pessoas. Nenhum CA-* foi aceito nesta sessão. CA-A4 e CA-A5 continuam pendentes.

## Ponto de parada

O próximo passo é completar as pendências da Fase 0. O plano da Fase 1 é uma proposta para aprovação; não autoriza implementação. A solicitação de usar Sites fica registrada, mas publicar ou criar uma demonstração agora contrariaria a ordem expressa de não escrever código de produto nesta fase.
