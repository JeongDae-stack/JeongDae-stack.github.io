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

powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/flowerjunho/stoneage-light/main/src/data/right_items.json' -OutFile 'data\right_items_raw.json'"

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

echo.
echo ========================================
echo   데이터 갱신 완료
echo ========================================
echo.

dir data

echo.
set /p DO_GIT=GitHub에 commit / push까지 할까요? (y/N): 

if /I "%DO_GIT%"=="Y" (
    echo.
    echo [Git] 변경 파일 추가 중...

    git add data\pets.json data\items.json tools\scrape_pets.js tools\convert_items.js update_data.bat

    echo.
    echo [Git] 커밋 생성 중...

    git commit -m "Update pet and item data"

    echo.
    echo [Git] GitHub로 push 중...

    git push

    echo.
    echo GitHub 반영 요청 완료.
    echo GitHub Pages 반영까지는 약간 시간이 걸릴 수 있습니다.
) else (
    echo.
    echo Git commit / push는 건너뜁니다.
)

echo.
echo 완료되었습니다.
pause