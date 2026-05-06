const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const PETS_PATH = path.join(__dirname, "..", "data", "pets.json");
const OUT_PATH = path.join(__dirname, "..", "data", "pet_rankings.json");
const BACKUP_PATH = path.join(__dirname, "..", "data", "pet_rankings.backup.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toNumber(value) {
    if (value === undefined || value === null) return 0;
    return Number(String(value).replaceAll(",", "").trim()) || 0;
}

function cleanLines(text) {
    return String(text || "")
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);
}

function calcCombatPower(row) {
    const atk = toNumber(row.atk);
    const def = toNumber(row.def);
    const agi = toNumber(row.agi);
    const hp = toNumber(row.hp);

    return Math.round((atk + def + agi + (hp / 4)) * 100) / 100;
}

function isRankingHeader(line) {
    const compact = String(line || "").replace(/\s+/g, "");

    return (
        compact.includes("닉네임") &&
        compact.includes("Lv") &&
        compact.includes("공격력") &&
        compact.includes("방어력") &&
        compact.includes("순발력") &&
        compact.includes("내구력")
    );
}

function headerHasCombatPower(line) {
    const compact = String(line || "").replace(/\s+/g, "");

    return (
        compact.includes("전투력") ||
        compact.includes("점수") ||
        compact.includes("스코어")
    );
}

function isStopLine(line) {
    const text = String(line || "").trim();

    if (!text) return true;

    const stopWords = [
        "### 관련자료",
        "관련자료",
        "이전",
        "다음",
        "작성일",
        "댓글",
        "등록된 댓글",
        "로그인한 회원만 댓글",
        "목록",
        "최근글",
        "새댓글",
        "사이트 소개",
        "개인정보처리방침",
        "이메일 무단수집거부",
        "책임의 한계",
        "이용약관",
        "이용안내",
        "문의하기",
        "모바일버전"
    ];

    return stopWords.some(word => text.includes(word));
}

function parseRankingRow(line, options = {}) {
    const text = String(line || "").trim();

    if (!text) return null;
    if (isRankingHeader(text)) return null;
    if (isStopLine(text)) return null;

    /*
      기본 원본 형식:
      닉네임 Lv 공격력 방어력 순발력 내구력
      아키 138 300 307 79 1621

      혹시 추후 원본에 전투력/점수 컬럼이 추가되면:
      닉네임 Lv 공격력 방어력 순발력 내구력 전투력
      아키 138 300 307 79 1621 1091.25

      닉네임에 공백이 들어갈 수도 있으므로
      뒤에서 숫자들을 잡고 앞부분 전체를 닉네임으로 처리합니다.
    */

    const matchWithCombat = text.match(
        /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,.]+)$/
    );

    if (options.hasCombatPowerColumn && matchWithCombat) {
        const row = {
            nickname: matchWithCombat[1].trim(),
            level: toNumber(matchWithCombat[2]),
            atk: toNumber(matchWithCombat[3]),
            def: toNumber(matchWithCombat[4]),
            agi: toNumber(matchWithCombat[5]),
            hp: toNumber(matchWithCombat[6]),
            combatPower: toNumber(matchWithCombat[7]),
            combatPowerType: "source"
        };

        if (!row.nickname) return null;
        if (row.nickname.includes("님의 댓글")) return null;
        if (row.nickname.includes("댓글")) return null;

        return row;
    }

    const match = text.match(
        /^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/
    );

    if (!match) return null;

    const row = {
        nickname: match[1].trim(),
        level: toNumber(match[2]),
        atk: toNumber(match[3]),
        def: toNumber(match[4]),
        agi: toNumber(match[5]),
        hp: toNumber(match[6])
    };

    if (!row.nickname) return null;
    if (row.nickname.includes("님의 댓글")) return null;
    if (row.nickname.includes("댓글")) return null;

    row.combatPower = calcCombatPower(row);
    row.combatPowerType = "calculated";

    return row;
}

function parseRankingsFromText(bodyText) {
    const lines = cleanLines(bodyText);
    const headerIndex = lines.findIndex(isRankingHeader);

    if (headerIndex === -1) {
        return [];
    }

    const headerLine = lines[headerIndex];
    const hasCombatPowerColumn = headerHasCombatPower(headerLine);

    const rows = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        if (isStopLine(line)) {
            break;
        }

        const row = parseRankingRow(line, { hasCombatPowerColumn });

        if (row) {
            rows.push(row);
        }
    }

    return rows.map((row, index) => ({
        rank: index + 1,
        ...row
    }));
}

async function scrapeOnePetRanking(page, pet, index, total) {
    if (!pet.source) {
        console.log(`[${index}/${total}] SKIP - source 없음: ${pet.name}`);

        return {
            petName: pet.name || "",
            sub: pet.sub || "",
            source: pet.source || "",
            imageUrl: pet.imageUrl || "",
            rankings: []
        };
    }

    try {
        await page.goto(pet.source, {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        await sleep(150);

        const bodyText = await page.evaluate(() => document.body.innerText || "");
        const rankings = parseRankingsFromText(bodyText);

        console.log(`[${index}/${total}] ${pet.name} - ${rankings.length}개`);

        return {
            petName: pet.name || "",
            sub: pet.sub || "",
            source: pet.source || "",
            imageUrl: pet.imageUrl || "",
            rankings
        };
    } catch (error) {
        console.log(`[${index}/${total}] FAIL - ${pet.name}`);
        console.log(`  이유: ${error.message}`);

        return {
            petName: pet.name || "",
            sub: pet.sub || "",
            source: pet.source || "",
            imageUrl: pet.imageUrl || "",
            rankings: []
        };
    }
}

async function main() {
    if (!fs.existsSync(PETS_PATH)) {
        console.error("data/pets.json 파일이 없습니다.");
        process.exit(1);
    }

    const pets = JSON.parse(fs.readFileSync(PETS_PATH, "utf-8"));

    if (!Array.isArray(pets)) {
        console.error("data/pets.json 형식이 배열이 아닙니다.");
        process.exit(1);
    }

    if (pets.length < 500) {
        console.error(`페트 수가 너무 적습니다: ${pets.length}`);
        console.error("잘못된 pets.json일 수 있으니 중단합니다.");
        process.exit(1);
    }

    if (fs.existsSync(OUT_PATH) && !fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(OUT_PATH, BACKUP_PATH);
        console.log(`기존 랭킹 백업 생성: ${BACKUP_PATH}`);
    }

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            width: 1280,
            height: 900
        }
    });

    const page = await browser.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    const results = [];
    let totalRankingRows = 0;

    console.log("");
    console.log("========================================");
    console.log("  페트 유저 랭킹 수집 시작");
    console.log("========================================");
    console.log(`대상 페트 수: ${pets.length}`);
    console.log("전투력 계산식: 공격력 + 방어력 + 순발력 + (내구력 / 4)");
    console.log("");

    for (let i = 0; i < pets.length; i++) {
        const pet = pets[i];

        const result = await scrapeOnePetRanking(page, pet, i + 1, pets.length);
        results.push(result);

        totalRankingRows += result.rankings.length;

        if ((i + 1) % 25 === 0 || i === pets.length - 1) {
            const partialOutput = {
                summary: {
                    generatedAt: new Date().toISOString(),
                    petCount: results.length,
                    petsWithRanking: results.filter(x => x.rankings.length > 0).length,
                    totalRankingRows,
                    combatPowerFormula: "atk + def + agi + (hp / 4)"
                },
                pets: results
            };

            fs.writeFileSync(OUT_PATH, JSON.stringify(partialOutput, null, 2), "utf-8");

            console.log("");
            console.log(`[중간 저장] ${i + 1}/${pets.length}`);
            console.log(`현재 랭킹 보유 페트 수: ${results.filter(x => x.rankings.length > 0).length}`);
            console.log(`현재 전체 랭킹 행 수: ${totalRankingRows}`);
            console.log("");
        }

        await sleep(150);
    }

    await browser.close();

    const summary = {
        generatedAt: new Date().toISOString(),
        petCount: results.length,
        petsWithRanking: results.filter(x => x.rankings.length > 0).length,
        totalRankingRows,
        combatPowerFormula: "atk + def + agi + (hp / 4)"
    };

    const output = {
        summary,
        pets: results
    };

    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf-8");

    console.log("");
    console.log("========================================");
    console.log("  페트 유저 랭킹 수집 완료");
    console.log("========================================");
    console.log(`저장 위치: ${OUT_PATH}`);
    console.log(`전체 페트 수: ${summary.petCount}`);
    console.log(`랭킹 있는 페트 수: ${summary.petsWithRanking}`);
    console.log(`전체 랭킹 행 수: ${summary.totalRankingRows}`);
    console.log(`전투력 계산식: ${summary.combatPowerFormula}`);
    console.log("");
}

main().catch(error => {
    console.error("실패:", error);
    process.exit(1);
});