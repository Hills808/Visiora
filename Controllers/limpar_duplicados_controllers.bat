@echo off
setlocal
cd /d "%~dp0"
cd ..\Controllers

echo Limpando duplicados de Controllers...
if exist "TesteController.cs(1).cs" del "TesteController.cs(1).cs"
if exist "TesteController.cs.cs" del "TesteController.cs.cs"
if exist "VozController.cs(1).cs" del "VozController.cs(1).cs"
if exist "VozController.cs.cs" del "VozController.cs.cs"

echo Controllers restantes:
dir /b
pause
