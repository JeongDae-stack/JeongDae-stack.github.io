const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE_URL = "https://www.hwansoo.top/bbs/board.php?bo_table=pets&sod=asc&sop=and&sst=wr_hit";
const OUT_PATH = path.join(__dirname, "..", "data", "pets.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumbers(line) {
    return [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
}

function emojiForName(name) {
    if (["드래곤", "청룡", "백룡", "흑룡", "룡"].some(x => name.includes(x))) return "🐉";
    if (["호", "고르", "노르", "그루", "검호"].some(x => name.includes(x))) return "🐅";
    if (["다이노", "테라", "로스", "돈", "노스", "라노"].some(x => name.includes(x))) return "🦖";
    if (["북이", "거북"].some(x => name.includes(x))) return "🐢";
    if (["푸스", "가스트", "울프"].some(x => name.includes(x))) return "🐺";
    if (["부비", "우리"].some(x => name.includes(x))) return "🐖";
    return "🐾";
}

function getWrId(url) {
    try {
        return new URL(url).searchParams.get("wr_id");
    } catch {
        return null;
    }
}

function parsePetsFromPage(bodyText, linkGroups) {
    const lines = bodyText
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);

    const pets = [];
    let cursor = 0;

    for (const group of linkGroups) {
        const name = group.texts[0];
        const sub = group.texts[1] || "";

        if (!name) continue;

        const start = lines.findIndex((line, idx) => idx >= cursor && line.includes(name));
        if (start === -1) {
            console.log(`[WARN] 이름 위치 못 찾음: ${name}`);
            continue;
        }

        const end = lines.findIndex((line, idx) => idx >= start && line.startsWith("판매등급"));
        if (end === -1) {
            console.log(`[WARN] 판매등급 위치 못 찾음: ${name}`);
            continue;
        }

        const block = lines.slice(start, end + 1);

        const elem = {};
        for (const line of block) {
            const m = line.match(/^(지|수|화|풍)\s*\(Lv\.?\s*(\d+)\)/);
            if (m) {
                elem[m[1]] = Number(m[2]);
            }
        }

        const initLine = block.find(line => line.startsWith("초기치"));
        const statLine = block.find(line => line.startsWith("성장률"));
        const rideTotalLine = block.find(line => line.includes("탑승여부") && line.includes("총성장률"));
        const gradeLine = block.find(line => line.startsWith("판매등급"));

        if (!initLine || !statLine || !rideTotalLine || !gradeLine) {
            console.log(`[WARN] 필수 정보 부족: ${name}`);
            cursor = end + 1;
            continue;
        }

        const initNums = parseNumbers(initLine);
        const statNums = parseNumbers(statLine);

        const rideMatch = rideTotalLine.match(/탑승여부\s+(\S+)/);
        const totalMatch = rideTotalLine.match(/총성장률\s+(-?\d+(?:\.\d+)?)/);

        if (initNums.length < 4 || statNums.length < 4 || !totalMatch) {
            console.log(`[WARN] 숫자 파싱 실패: ${name}`);
            cursor = end + 1;
            continue;
        }

        pets.push({
            name,
            sub,
            elem,
            total: Number(totalMatch[1]),
            stats: {
                atk: statNums[0],
                def: statNums[1],
                agi: statNums[2],
                hp: statNums[3],
            },
            init: {
                atk: initNums[0],
                def: initNums[1],
                agi: initNums[2],
                hp: initNums[3],
            },
            ride: rideMatch ? rideMatch[1] : "",
            grade: gradeLine.replace("판매등급", "").trim(),
            emoji: emojiForName(name),
            source: group.href,
        });

        cursor = end + 1;
    }

    return pets;
}

async function getPageInfo(page) {
    return await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="bo_table=pets"][href*="wr_id="]'));

        const map = new Map();

        for (const a of anchors) {
            const href = a.href;
            const text = a.innerText.trim();

            const url = new URL(href);
            const wrId = url.searchParams.get("wr_id");

            if (!wrId) continue;

            if (!map.has(wrId)) {
                map.set(wrId, {
                    wrId,
                    href,
                    texts: [],
                });
            }

            if (text && !map.get(wrId).texts.includes(text)) {
                map.get(wrId).texts.push(text);
            }
        }

        const pageNumbers = Array.from(document.querySelectorAll('a[href*="bo_table=pets"]'))
            .map(a => {
                try {
                    const url = new URL(a.href);
                    const p = url.searchParams.get("page");
                    return p ? Number(p) : null;
                } catch {
                    return null;
                }
            })
            .filter(n => Number.isInteger(n) && n > 0);

        return {
            bodyText: document.body.innerText,
            linkGroups: Array.from(map.values()).filter(g => g.texts.length > 0),
            maxPage: pageNumbers.length ? Math.max(...pageNumbers) : 1,
        };
    });
}

async function main() {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            width: 1280,
            height: 900,
        },
    });

    const page = await browser.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    console.log("[시작] 페트정보 1페이지 접속 중...");

    await page.goto(`${BASE_URL}&page=1`, {
        waitUntil: "networkidle2",
        timeout: 60000,
    });

    let firstInfo = await getPageInfo(page);
    const lastPage = firstInfo.maxPage;

    console.log(`마지막 페이지 추정: ${lastPage}`);
    console.log(`[1/${lastPage}] 페이지 파싱 중...`);

    const allPets = [];
    allPets.push(...parsePetsFromPage(firstInfo.bodyText, firstInfo.linkGroups));

    for (let pageNo = 2; pageNo <= lastPage; pageNo++) {
        const url = `${BASE_URL}&page=${pageNo}`;

        console.log(`[${pageNo}/${lastPage}] 접속 중...`);

        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000,
        });

        const info = await getPageInfo(page);
        const pets = parsePetsFromPage(info.bodyText, info.linkGroups);

        console.log(`[${pageNo}/${lastPage}] ${pets.length}개 수집`);

        allPets.push(...pets);

        await sleep(500);
    }

    await browser.close();

    const uniqueMap = new Map();

    for (const pet of allPets) {
        const key = `${pet.name}__${pet.sub}`;
        uniqueMap.set(key, pet);
    }

    const result = Array.from(uniqueMap.values()).sort((a, b) => {
        return a.name.localeCompare(b.name, "ko");
    });

    fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), "utf-8");

    console.log("");
    console.log(`완료: ${OUT_PATH}`);
    console.log(`저장된 페트 수: ${result.length}`);
}

main().catch(err => {
    console.error("실패:", err);
    process.exit(1);
});