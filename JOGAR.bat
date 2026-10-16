@echo off
rem RCL-Karts - abre o jogo no navegador com o painel de relevo (relevo.html).
rem Sobe o servidor local do jogo (so neste PC, em 127.0.0.1) e abre a pagina. Fechar esta janela desliga o servidor.
rem Precisa do Node.js 20 ou mais novo instalado.
setlocal
cd /d "%~dp0"
set PORTA=8766

where node >nul 2>nul
if errorlevel 1 goto semnode

echo.
echo   RCL-Karts - Circuito 101
echo   Abrindo http://localhost:%PORTA%/relevo.html no navegador...
echo   Jogo sem o painel: http://localhost:%PORTA%/
echo   Para desligar, feche esta janela.
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORTA%/relevo.html'"
node ferramentas\servidor.mjs %PORTA%
echo.
echo   O servidor parou. Se a porta %PORTA% estiver ocupada, feche o outro programa
echo   ou troque o numero em "set PORTA=" neste arquivo.
pause
exit /b 1

:semnode
echo.
echo   Nao achei o Node.js neste PC. Instale o Node 20 ou mais novo, do site nodejs.org,
echo   e rode o JOGAR.bat de novo.
echo.
pause
exit /b 1
