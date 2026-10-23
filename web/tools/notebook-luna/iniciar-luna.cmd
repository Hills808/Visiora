@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo Falta o arquivo privado .env. Leia LEIA-ME-LUNA.txt.
  pause
  exit /b 1
)
if not exist ".runtime\luna-budget.sqlite" (
  echo Falta o registro de orcamento .runtime\luna-budget.sqlite. Leia LEIA-ME-LUNA.txt.
  pause
  exit /b 1
)
node.exe --env-file=.env check-luna.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo Abra no Chrome ou Edge o endereco mostrado na linha "Visiora" abaixo.
echo Mantenha esta janela aberta durante a apresentacao. Ctrl+C encerra.
node.exe --env-file=.env server\gateway.mjs
pause
