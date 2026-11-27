@echo off
setlocal
rem Opens SwaggerCompare in a Microsoft Edge (or Chrome) app window.
rem Needs no Node.js, npm or install: the app is plain HTML/JS in this folder.
title SwaggerCompare
set "ROOT=%~dp0"
set "PAGE=%ROOT%src\index.html"

rem The app files must sit next to this script (run from the unzipped folder, not from inside the zip).
set "MISSING="
for %%F in ("src\index.html" "src\gen\renderer.js" "vendor\monaco\vs\loader.js") do if not exist "%ROOT%%%~F" set "MISSING=%%~F"
if defined MISSING (
  echo.
  echo  SwaggerCompare cannot start: the file "%MISSING%" is missing.
  echo.
  echo  How to fix:
  echo   1. Right-click the downloaded zip, choose "Extract All...".
  echo   2. Open the extracted folder and double-click SwaggerCompare.bat there.
  echo   Running it from inside the zip, or copying only the .bat, does not work.
  echo.
  echo  Download: https://github.com/malkowicz3-al/SwaggerCompare/releases/latest
  echo.
  pause
  exit /b 1
)

set "URL=file:///%PAGE:\=/%"

rem Edge ships with Windows 10/11; Chrome works the same way.
set "BROWSER="
for %%B in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if not defined BROWSER if exist "%%~B" set "BROWSER=%%~B"

if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --window-size=1440,900
  exit /b 0
)

echo.
echo  Microsoft Edge or Google Chrome was not found.
echo  Opening SwaggerCompare in your default browser instead.
echo  If the page stays empty, install Edge or Chrome, or use SwaggerCompare.exe
echo  from https://github.com/malkowicz3-al/SwaggerCompare/releases/latest
echo.
start "" "%PAGE%"
timeout /t 10 >nul
exit /b 0
