@echo off
cd /d "%~dp0"
set "STUDIO_NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "STUDIO_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined STUDIO_NODE for /f "delims=" %%N in ('where node 2^>nul') do if not defined STUDIO_NODE set "STUDIO_NODE=%%N"
if not defined STUDIO_NODE (
 echo Se necesita Node.js 22.12 o posterior. Instala la version LTS de https://nodejs.org/
 pause
 exit /b 1
)
for %%N in ("%STUDIO_NODE%") do set "STUDIO_NPM=%%~dpNnpm.cmd"
if not exist "node_modules\vite" (
 echo Instalando dependencias del frontend...
 call "%STUDIO_NPM%" ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
"%STUDIO_NODE%" node_modules\vite\bin\vite.js build
if errorlevel 1 (
 pause
 exit /b 1
)
"%STUDIO_NODE%" server.js
if errorlevel 1 pause
