@echo off
cd /d "%~dp0"
set "STUDIO_NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "STUDIO_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined STUDIO_NODE for /f "delims=" %%N in ('where node 2^>nul') do if not defined STUDIO_NODE set "STUDIO_NODE=%%N"
if not defined STUDIO_NODE (
 echo Se necesita Node.js 22 o posterior. Instala la version LTS de https://nodejs.org/
 pause
 exit /b 1
)
"%STUDIO_NODE%" server.js
if errorlevel 1 pause
