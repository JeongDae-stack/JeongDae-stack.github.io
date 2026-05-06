@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo ========================================
echo   StoneAge 페트 랭킹 데이터 갱신
echo ========================================
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js LTS 버전을 설치해주세요.
    pause
    exit /b 1
)

REM 랭킹 수집 스크립트 확인
if not exist "tools\scrape_pet_rankings.js" (
    echo [ERROR] tools\scrape_pet_rankings.js 파일이 없습니다.
    echo 먼저 페트 랭킹 수집 스크립트를 만들어주세요.
    pause
    exit /b 1
)

REM pets.json 확인
if not exist "data\pets.json" (
    echo [ERROR] data\pets.json 파일이 없습니다.
    echo 먼저 기본 페트 데이터를 생성해주세요.
    pause
    exit /b 1
)

echo [1/2] 페트 랭킹 데이터 수집 중...
echo Chrome 창이 뜨면 닫지 말고 기다려주세요.
echo.

node tools\scrape_pet_rankings.js

if errorlevel 1 (
    echo.
    echo [ERROR] 페트 랭킹 데이터 갱신 실패
    pause
    exit /b 1
)

echo.
echo [2/2] 갱신 결과 확인 중...
echo.

node -e "const r=require('./data/pet_rankings.json'); console.log(r.summary); const p=r.pets.find(x=>x.rankings.length>0); if(p){ console.log('예시:', p.petName, p.rankings[0]); }"

if errorlevel 1 (
    echo.
    echo [ERROR] data\pet_rankings.json 확인 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo   페트 랭킹 데이터 갱신 완료
echo ========================================
echo.

git status

echo.
set /p DO_GIT=GitHub에 commit / push까지 할까요? (y/N): 

if /I "%DO_GIT%"=="Y" (
    echo.
    echo [Git] data\pet_rankings.json 추가 중...
    git add data\pet_rankings.json

    echo.
    echo [Git] 커밋 생성 중...
    git commit -m "Update pet ranking data"

    if errorlevel 1 (
        echo.
        echo [WARN] 커밋할 변경사항이 없거나 커밋에 실패했습니다.
        echo git status를 확인해주세요.
        pause
        exit /b 0
    )

    echo.
    echo [Git] GitHub로 push 중...
    git push

    if errorlevel 1 (
        echo.
        echo [ERROR] git push 실패
        pause
        exit /b 1
    )

    echo.
    echo GitHub 반영 완료.
    echo GitHub Pages 반영까지는 약간 시간이 걸릴 수 있습니다.
) else (
    echo.
    echo Git commit / push는 건너뜁니다.
)

echo.
echo 완료되었습니다.
pause