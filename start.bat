@echo off

echo Iniciando Visiora AI...

set AZURE_SPEECH_KEY=exemplo
set AZURE_SPEECH_REGION=brazilsouth

dotnet build
dotnet run

pause