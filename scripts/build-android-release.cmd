@echo off
setlocal

cd /d "%~dp0\.."

if exist ".env.release.local" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env.release.local") do (
    set "%%A=%%B"
  )
)

if "%JAVA_HOME%"=="" if exist "C:\tmp\jdk17\jdk-17.0.19+10" set "JAVA_HOME=C:\tmp\jdk17\jdk-17.0.19+10"
if "%ANDROID_HOME%"=="" if exist "C:\tmp\android-sdk" set "ANDROID_HOME=C:\tmp\android-sdk"
if "%ANDROID_SDK_ROOT%"=="" set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"

if "%NAHARU_KEYSTORE_PASSWORD%"=="" (
  echo ERROR: NAHARU_KEYSTORE_PASSWORD is required.
  exit /b 1
)

if "%NAHARU_KEY_ALIAS_PASSWORD%"=="" (
  set "NAHARU_KEY_ALIAS_PASSWORD=%NAHARU_KEYSTORE_PASSWORD%"
)

call npm.cmd run android:sync
if errorlevel 1 exit /b 1

cd android
call gradlew.bat bundleRelease
if errorlevel 1 exit /b 1

echo.
echo AAB files:
dir /b /s app\build\outputs\bundle\release\*.aab
