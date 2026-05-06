@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo ========================================
echo   StoneAge 페트 랭킹 데이터 갱신
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    pause
    exit /b 1
)

if not exist "tools\scrape_pet_rankings.js" (
    echo [ERROR] tools\scrape_pet_rankings.js 파일이 없습니다.
    pause
    exit /b 1
)

if not exist "tools\compare_pet_rankings.js" (
    echo [ERROR] tools\compare_pet_rankings.js 파일이 없습니다.
    pause
    exit /b 1
)

if not exist "data\pets.json" (
    echo [ERROR] data\pets.json 파일이 없습니다.
    pause
    exit /b 1
)

if not exist "data" (
    mkdir data
)

if not exist "tmp" (
    mkdir tmp
)

set BEFORE_FILE=tmp\pet_rankings.before.json
set AFTER_FILE=data\pet_rankings.json

if exist "%AFTER_FILE%" (
    copy "%AFTER_FILE%" "%BEFORE_FILE%" >nul
) else (
    echo [INFO] 기존 data\pet_rankings.json 파일이 없습니다.
    if exist "%BEFORE_FILE%" del "%BEFORE_FILE%"
)

echo [1/3] 페트 랭킹 데이터 수집 중...
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
echo [2/3] 실제 랭킹 변경 여부 확인 중...
echo.

node tools\compare_pet_rankings.js "%BEFORE_FILE%" "%AFTER_FILE%"
set COMPARE_RESULT=%errorlevel%

if "%COMPARE_RESULT%"=="0" (
    echo.
    echo 실제 랭킹 변화가 없으므로 기존 파일로 되돌립니다.

    if exist "%BEFORE_FILE%" (
        copy "%BEFORE_FILE%" "%AFTER_FILE%" >nul
    )

    echo.
    echo ========================================
    echo   변경사항 없음
    echo ========================================
    echo.
    git status
    pause
    exit /b 0
)

if "%COMPARE_RESULT%"=="2" (
    echo.
    echo 실제 랭킹 변화가 확인되었습니다.
) else (
    echo.
    echo [ERROR] 랭킹 비교 중 오류가 발생했습니다.
    pause
    exit /b 1
)

echo.
echo [3/3] 갱신 결과 확인 중...
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