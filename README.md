# Visiora AI

![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)
![C#](https://img.shields.io/badge/C%23-12-239120?logo=csharp&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?logo=openai&logoColor=white)
![Azure Speech](https://img.shields.io/badge/Azure-Speech-0078D4?logo=microsoftazure&logoColor=white)

O Visiora AI é um protótipo acadêmico de assistência visual. A aplicação captura imagens da câmera no navegador, envia cada leitura ao backend e transforma a interpretação do ambiente em contexto textual e orientação por áudio para apoiar pessoas com deficiência visual.

O projeto está disponível em [github.com/Hills808/Visiora](https://github.com/Hills808/Visiora). Este documento descreve o que está implementado no branch main e não substitui validação clínica, testes de segurança ou um sistema de navegação certificado.

## Funcionalidades implementadas

- Captura da câmera diretamente no navegador com getUserMedia, video e canvas.
- Conversão dos frames para JPEG em Base64 antes do envio à API.
- Consulta manual ao ambiente em linguagem natural.
- Modo automático/percepção ativa, com análise periódica e decisão de quando falar.
- Modos de análise automatico, guia e consulta.
- Identificação contextual de ambiente, pessoas, objetos, alertas, direção, importância e caminho.
- Detecção de mudanças visuais e eventos como início, risco, pessoa, novo ambiente, ponto de interesse, mudança e silêncio.
- Memória contextual em processo para comparar leituras, reconhecer permanência ou transição de ambiente e reduzir repetições.
- Geração opcional de fala pelo OpenAI Text-to-Speech, retornada em Base64.
- Fala local pelo SpeechSynthesis do navegador para o modo guia quando não há áudio externo na resposta.
- Gravação de comandos de voz no navegador, conversão para WAV e transcrição em português do Brasil com Azure Speech.
- Comandos de voz para descrever o ambiente, consultar o que está à frente, verificar pessoas ou obstáculos e controlar o modo automático e o áudio.
- Painel web com estado da câmera, modo automático, áudio, reconhecimento, decisão do loop, leitura atual e memória recente.
- Endpoint de exemplo /weatherforecast, mantido pelo template do ASP.NET Core.

## Como funciona

~~~mermaid
flowchart LR
    A[Navegador<br/>câmera e microfone] --> B[wwwroot/index.html]
    B -->|POST imagemBase64| C[TesteController]
    C --> D[VisioraService]
    D --> E[OpenAI GPT-4o-mini<br/>análise multimodal]
    E --> D
    D -->|texto de orientação| F[AudioService]
    F -->|opcional: áudio Base64| G[OpenAI gpt-4o-mini-tts]
    D --> C
    C --> B
    B -->|SpeechSynthesis ou áudio recebido| H[Saída de voz]
    A -->|WAV multipart| I[VozController]
    I --> J[AzureSpeechService<br/>pt-BR]
    J --> I
~~~

1. O navegador solicita permissão para câmera e, quando necessário, microfone.
2. O frame atual é reduzido e codificado como JPEG Base64.
3. POST /Teste/analisar recebe a imagem, o modo e a pergunta.
4. VisioraService monta o contexto, chama a OpenAI, sanitiza a resposta JSON e aplica as regras de comunicação do Visiora.
5. A resposta pode conter texto, alertas, pontos de interesse, estado cognitivo e áudio Base64.
6. No modo automático, o frontend usa diferença visual, intervalos e cooldowns para evitar chamadas e falas desnecessárias.
7. Para voz, o navegador envia um WAV ao endpoint de transcrição; o Azure Speech retorna o texto reconhecido e o frontend interpreta o comando.

## Arquitetura

O projeto é uma aplicação ASP.NET Core minimal host com controllers, serviços de domínio e uma interface estática servida pelo próprio backend.

- Program.cs: registra OpenAPI, controllers, serviços e middlewares de HTTPS, arquivos estáticos e arquivos padrão.
- Controllers/TesteController.cs: recebe imagens e devolve a análise do ambiente.
- Controllers/VozController.cs: recebe áudio WAV e devolve a transcrição.
- Services/OpenAIService.cs: chama POST https://api.openai.com/v1/chat/completions com imagem e prompt; exige JSON estruturado.
- Services/AudioService.cs: chama POST https://api.openai.com/v1/audio/speech para gerar fala externa.
- Services/AzureSpeechService.cs: usa o SDK Azure Cognitive Services Speech para reconhecimento pt-BR.
- Services/VisioraService.Operacao.cs e Services/VisioraService.Suporte.cs: orquestram análise, memória contextual, eventos, prioridade de fala e estado cognitivo.
- Models/: contratos de entrada e saída da API.
- wwwroot/index.html: interface, captura de mídia, loop de percepção, áudio e comandos.

### Memória e contexto

A memória atual é mantida em estruturas estáticas do processo (VisioraService). Ela guarda leituras recentes, ambiente candidato/confirmado, referências, mudanças estruturais e eventos temporais para compor a próxima fala. Não há banco SQLite nem armazenamento persistente implementado no branch main; reiniciar a aplicação limpa esse contexto.

## Tecnologias e integrações

| Componente | Uso no projeto |
| --- | --- |
| .NET 10 / ASP.NET Core | API HTTP, injeção de dependências e arquivos estáticos |
| C# | Controllers, serviços, modelos e regras de decisão |
| OpenAI Chat Completions | Análise multimodal da imagem com gpt-4o-mini e resposta JSON |
| OpenAI Audio Speech | Síntese opcional com gpt-4o-mini-tts e voz alloy |
| Azure Cognitive Services Speech | Transcrição de comandos WAV em pt-BR |
| HTML, CSS e JavaScript | Interface web, câmera, microfone, loop e controles de áudio |

### VLibras

Não foi encontrada integração com VLibras no código, no HTML ou nas dependências do repositório. Portanto, VLibras não é apresentado como funcionalidade disponível nesta versão.

## Pré-requisitos

- .NET SDK 10.0.
- Navegador moderno com suporte a câmera, microfone, AudioContext e SpeechSynthesis.
- Chave da OpenAI com acesso aos endpoints de visão e áudio.
- Recurso Azure Speech com chave e região configuradas.
- Permissões de câmera e microfone concedidas pelo navegador. Em ambientes fora de localhost, use HTTPS para atender às restrições de mídia do navegador.

## Configuração segura

O backend procura as credenciais nesta ordem:

| Variável de ambiente | Alternativa de configuração | Obrigatória para |
| --- | --- | --- |
| OPENAI_API_KEY | OpenAI:ApiKey | análise de imagem e TTS externo |
| AZURE_SPEECH_KEY | AzureSpeech:Key | transcrição de voz |
| AZURE_SPEECH_REGION | AzureSpeech:Region | transcrição de voz |

Configure as chaves apenas no ambiente de execução. Não coloque valores reais em README.md, appsettings*.json, launchSettings.json, scripts ou no histórico do Git.

Exemplo em PowerShell:

~~~powershell
$env:OPENAI_API_KEY = "sua-chave-openai"
$env:AZURE_SPEECH_KEY = "sua-chave-azure-speech"
$env:AZURE_SPEECH_REGION = "brazilsouth"
~~~

O arquivo .gitignore já exclui appsettings.json, appsettings.Development.json e Properties/launchSettings.json. O start.bat versionado contém apenas o valor literal exemplo para Azure Speech e não configura a chave da OpenAI; substitua o uso por variáveis seguras antes de executar em qualquer ambiente real.

## Executando localmente

~~~powershell
git clone https://github.com/Hills808/Visiora.git
cd Visiora
dotnet restore
dotnet run --urls "http://localhost:5224"
~~~

Depois, abra http://localhost:5224. A rota raiz serve wwwroot/index.html por meio de UseDefaultFiles() e UseStaticFiles().

Para executar pelo script incluído:

~~~powershell
.\start.bat
~~~

O script executa dotnet build e dotnet run, mas deve ser revisado para receber credenciais por variáveis de ambiente antes do uso.

## API

### POST /Teste/analisar

Analisa um frame da câmera.

Corpo JSON mínimo:

~~~json
{
  "imagemBase64": "<jpeg-base64-sem-o-prefixo-data>",
  "modo": "consulta",
  "pergunta": "O que tem à minha frente?"
}
~~~

modo pode ser automatico, guia ou consulta. Se omitido, o backend usa automatico; em consulta, a pergunta orienta a resposta. A imagem é enviada à OpenAI como data:image/jpeg;base64,...

A resposta 200 é um objeto RespostaComAudio e pode incluir descricao, objetos, alertas, pessoa, sugestao, direcao, importancia, audioBase64, falaGuia, eventoGuia, caminhoStatus, estadoCognitivo e memoriaRecente. Se o corpo não trouxer imagemBase64, o controller retorna 400.

> Observação de implementação: ImagemRequest declara campos de telemetria, mas o controller atual encaminha ao serviço apenas imagemBase64, modo e pergunta. A decisão de ciclo também é feita pelo JavaScript do frontend.

### POST /api/Voz/transcrever

Recebe um arquivo WAV em multipart/form-data no campo audioFile. O limite do controller é de 10 MB.

Resposta de sucesso:

~~~json
{
  "sucesso": true,
  "texto": "descrever ambiente",
  "vazio": false
}
~~~

O endpoint retorna 400 quando nenhum áudio é enviado e 500 quando ocorre uma exceção na transcrição.

### GET /weatherforecast

Endpoint de exemplo gerado pelo template ASP.NET Core; não participa do fluxo do Visiora.

## Atalhos e operação da interface

- A: inicia ou para o modo automático (inicia a câmera quando necessário).
- D: solicita uma descrição do ambiente.
- O: pergunta o que há à frente.
- V: inicia ou encerra a gravação de comando de voz.
- Espaço: pausa ou retoma o áudio atual.

Também estão disponíveis os controles visuais para iniciar/parar câmera e automático, fazer consulta manual e pausar/retomar/parar áudio.

## Estrutura do repositório

~~~text
.
├── Controllers/
│   ├── TesteController.cs
│   ├── VozController.cs
│   └── limpar_duplicados_controllers.bat
├── Models/
│   ├── EstadoVisiora.cs
│   ├── ImagemRequest.cs
│   ├── RespostaComAudio.cs
│   ├── RespostaIA.cs
│   └── RespostaVisiora.cs
├── Services/
│   ├── AudioService.cs
│   ├── AzureSpeechService.cs
│   ├── OpenAIService.cs
│   ├── VisioraService.Operacao.cs
│   └── VisioraService.Suporte.cs
├── Uploads/
│   ├── imagem_639108386012840950.jpg
│   └── imagem_639108389181515476.jpg
├── wwwroot/
│   └── index.html
├── .gitignore
├── Program.cs
├── VisioraAPI.csproj
├── VisioraAPI.http
├── VisioraAPI.sln
├── build_log.txt
├── start.bat
└── tado cognitivo Visiora AI
~~~

## Validação

Foi executado dotnet build VisioraAPI.csproj em uma cópia limpa do branch main.

- Resultado: compilação concluída com sucesso.
- Erros: 0.
- Avisos: 7, incluindo o alerta NU1903 para Microsoft.OpenApi 2.0.0 e avisos de propriedades não anuláveis em RespostaVisiora.
- O repositório não contém um projeto de testes automatizados; a validação atual é de compilação e inspeção do fluxo.

## Segurança, privacidade e limitações

- A API não configura autenticação, autorização, CORS restritivo, rate limiting ou controle de uso por usuário. Não a exponha diretamente à internet sem uma camada de proteção.
- As imagens são enviadas ao endpoint da OpenAI para análise. O áudio de comandos é enviado ao Azure Speech para transcrição. Revise contratos, retenção e consentimento antes de usar dados pessoais ou ambientes sensíveis.
- O WAV recebido é gravado temporariamente em Path.GetTempPath() somente para a transcrição e é removido no bloco finally do serviço Azure. O código não persiste os frames analisados em banco.
- As respostas da IA são probabilísticas e podem conter erros, omissões ou interpretações incorretas. O Visiora não substitui bengala, cão-guia, acompanhante, avaliação profissional ou sistema de navegação certificado.
- O projeto não fornece distância métrica confiável, localização, mapa, geolocalização, reconhecimento biométrico ou garantia de que um caminho esteja seguro.
- O loop automático depende de heurísticas do frontend e de chamadas externas; latência, indisponibilidade, custos e limites das APIs afetam a experiência.
- Em falhas da OpenAI, o serviço de análise encapsula o erro em RespostaComAudio; consumidores devem verificar também os campos de estado e não assumir que todo 200 representa uma leitura válida.

## Status e contexto acadêmico

O Visiora é um protótipo acadêmico em evolução, desenvolvido para explorar acessibilidade, percepção visual assistiva, interação multimodal e processamento contextual. O código prioriza experimentação e clareza do fluxo; antes de um uso operacional, são necessários testes com usuários, revisão de segurança, observabilidade, tratamento de custos, autenticação e avaliação de acessibilidade.

Não há arquivo de licença no repositório neste momento. Defina uma licença antes de distribuir o projeto como software open source.

## Contribuição

1. Crie uma branch para sua alteração.
2. Mantenha credenciais fora do Git e documente apenas nomes de variáveis.
3. Execute dotnet build antes de abrir um pull request.
4. Descreva impactos de privacidade, acessibilidade e custos de API nas mudanças que alterem o fluxo de câmera, áudio ou IA.

## Referências

- [Repositório Visiora](https://github.com/Hills808/Visiora)
- [ASP.NET Core](https://learn.microsoft.com/aspnet/core)
- [OpenAI API](https://platform.openai.com/docs)
- [Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/)


