@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo ========================================
echo   StoneAge Database 데이터 갱신 스크립트
echo ========================================
echo.

REM data 폴더 확인
if not exist "data" (
    echo data 폴더가 없어서 생성합니다.
    mkdir data
)

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js LTS 버전을 설치해주세요.
    pause
    exit /b 1
)

REM npm 설치 확인
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm이 설치되어 있지 않습니다.
    echo Node.js를 다시 설치해주세요.
    pause
    exit /b 1
)

REM puppeteer 설치 확인
if not exist "node_modules\puppeteer" (
    echo.
    echo [준비] puppeteer가 없어서 설치합니다...
    npm install puppeteer

    if errorlevel 1 (
        echo [ERROR] puppeteer 설치 실패
        pause
        exit /b 1
    )
)

REM 페트 갱신 스크립트 확인
if not exist "tools\scrape_pets.js" (
    echo [ERROR] tools\scrape_pets.js 파일이 없습니다.
    echo 페트 수집 스크립트를 먼저 만들어주세요.
    pause
    exit /b 1
)

REM 아이템 변환 스크립트 확인
if not exist "tools\convert_items.js" (
    echo [ERROR] tools\convert_items.js 파일이 없습니다.
    echo 아이템 변환 스크립트를 먼저 만들어주세요.
    pause
    exit /b 1
)

echo.
echo [1/3] 페트 데이터 갱신 중...
echo Chrome 창이 뜨면 닫지 말고 기다려주세요.
echo.

node tools\scrape_pets.js

if errorlevel 1 (
    echo [ERROR] 페트 데이터 갱신 실패
    pause
    exit /b 1
)

node tools\fill_missing_pet_images.js

if errorlevel 1 (
    echo [ERROR] 펫 이미지 URL 보완 실패
    pause
    exit /b 1
)

if errorlevel 1 (
    echo.
    echo [ERROR] 페트 데이터 갱신 실패
    pause
    exit /b 1
)

echo.
echo [2/3] 아이템 원본 데이터 다운로드 중...
echo.

powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $temp = Join-Path 'data' ([guid]::NewGuid().ToString() + '.tmp'); try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/flowerjunho/stoneage-light/main/src/data/right_items.json' -OutFile $temp; Move-Item -LiteralPath $temp -Destination 'data\right_items_raw.json' -Force } catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) { exit 4 }; throw } finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }"

if "%errorlevel%"=="4" (
    echo [WARN] 아이템 원본 주소에서 404를 반환했습니다. 기존 아이템 데이터를 유지합니다.
    goto data_updated
)

if errorlevel 1 (
    echo.
    echo [ERROR] 아이템 원본 데이터 다운로드 실패
    pause
    exit /b 1
)

echo.
echo [3/3] 아이템 데이터 변환 중...
echo.

node tools\convert_items.js

if errorlevel 1 (
    echo.
    echo [ERROR] 아이템 데이터 변환 실패
    pause
    exit /b 1
)

:data_updated
echo.
echo ========================================
echo   데이터 갱신 완료
echo ========================================
echo.

dir data

echo.
:publish
echo [Git] 변경 파일 확인 중...
git add -- data\pets.json data\items.json
if errorlevel 1 goto git_failed

git diff --cached --quiet HEAD -- data\pets.json data\items.json
if errorlevel 2 goto git_failed
if errorlevel 1 (
    git commit --only -m "Update pet and item data" -- data\pets.json data\items.json
    if errorlevel 1 goto git_failed
)

echo [Git] GitHub로 push 중...
git push
if errorlevel 1 goto git_failed

echo GitHub 푸시 완료.
echo.
echo 완료되었습니다.
pause
exit /b 0

:git_failed
echo [ERROR] GitHub 반영 실패. 위 Git 오류를 확인해주세요.
pause
exit /b 1
