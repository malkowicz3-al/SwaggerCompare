@echo off
rem Opens SwaggerCompare in a Microsoft Edge app window. Nothing is installed.
set "PAGE=%~dp0app\src\index.html"
if not exist "%PAGE%" (echo Unzip the whole SwaggerCompare-web.zip first, then run SwaggerCompare.bat from the unzipped folder. & pause & exit /b 1)
set "URL=file:///%PAGE:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (start "" "%EDGE%" --app="%URL%" --window-size=1440,900) else (start "" "%PAGE%")
