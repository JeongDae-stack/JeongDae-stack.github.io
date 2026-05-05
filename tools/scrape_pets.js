const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE_URL = "https://www.hwansoo.top/bbs/board.php?bo_table=pets&sod=asc&sop=and&sst=wr_hit";
const OUT_PATH = path.join(__dirname, "..", "data", "pets.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNumberList(line) {
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

function normalizeDetailUrl(rawHref) {
    try {
        const url = new URL(rawHref, "https://www.hwansoo.top");
        const wrId = url.searchParams.get("wr_id");

        if (!wrId) return null;

        return `https://www.hwansoo.top/bbs/board.php?bo_table=pets&wr_id=${encodeURIComponent(wrId)}`;
    } catch {
        return null;
    }
}

function cleanLines(text) {
    return String(text || "")
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);
}

function parsePetFromPayload(payload, sourceUrl) {
    const lines = cleanLines(payload.bodyText);
    const titleText = String(payload.titleText || "").trim();

    let name = titleText;
    let methodIdx = lines.findIndex(line => line.startsWith("획득방법"));

    if (!name && methodIdx !== -1) {
        for (let i = methodIdx - 1; i >= 0; i--) {
            const line = lines[i];
            if (
                !line.startsWith("###") &&
                line !== "Image" &&
                line !== "본문" &&
                !line.includes("목록") &&
                !line.includes("댓글")
            ) {
                name = line;
                break;
            }
        }
    }

    if (!name) {
        throw new Error("이름을 찾지 못했습니다.");
    }

    let sub = "";
    if (methodIdx !== -1) {
        const methodLine = lines[methodIdx];
        const methodMatch = methodLine.match(/^획득방법\s*:?\s*(.+)$/);
        if (methodMatch) {
            sub = methodMatch[1].trim();
        }
    }

    const elem = {};
    for (const line of lines) {
        const matches = [...line.matchAll(/(지|수|화|풍)\s*\(Lv\.?\s*(\d+)\)/g)];
        for (const match of matches) {
            elem[match[1]] = Number(match[2]);
        }
    }

    let init = null;
    let stats = null;
    let total = null;
    let ride = "";
    let grade = "";

    for (const line of lines) {
        if (line.startsWith("초기치")) {
            const nums = parseNumberList(line);
            if (nums.length >= 4) {
                init = {
                    atk: nums[0],
                    def: nums[1],
                    agi: nums[2],
                    hp: nums[3],
                };
            }
        }

        if (line.startsWith("성장률")) {
            const nums = parseNumberList(line);
            if (nums.length >= 4) {
                stats = {
                    atk: nums[0],
                    def: nums[1],
                    agi: nums[2],
                    hp: nums[3],
                };
            }
        }

        if (line.includes("탑승여부")) {
            const rideMatch = line.match(/탑승여부\s+(\S+)/);
            if (rideMatch) {
                ride = rideMatch[1];
            }
        }

        if (line.includes("총성장률")) {
            const totalMatch = line.match(/총성장률\s+(-?\d+(?:\.\d+)?)/);
            if (totalMatch) {
                total = Number(totalMatch[1]);
            }
        }

        if (line.startsWith("판매등급")) {
            grade = line.replace(/^판매등급\s*/, "").trim();
        }
    }

    if (!init) {
        throw new Error("초기치 파싱 실패");
    }

    if (!stats) {
        throw new Error("성장률 파싱 실패");
    }

    if (total === null) {
        throw new Error("총성장률 파싱 실패");
    }

    return {
        name,
        sub,
        elem,
        total,
        stats,
        init,
        ride,
        grade,
        emoji: emojiForName(name),
        imageUrl: payload.imageUrl || "",
        source: sourceUrl,
    };
}

async function getListPageInfo(page) {
    return await page.evaluate(() => {
        const detailUrls = Array.from(
            document.querySelectorAll('a[href*="bo_table=pets"][href*="wr_id="]')
        ).map(a => a.href);

        const pageNumbers = Array.from(
            document.querySelectorAll('a[href*="bo_table=pets"]')
        )
            .map(a => {
                try {
                    return Number(new URL(a.href).searchParams.get("page"));
                } catch {
                    return null;
                }
            })
            .filter(n => Number.isInteger(n) && n > 0);

        return {
            detailUrls,
            maxPage: pageNumbers.length ? Math.max(...pageNumbers) : 1,
        };
    });
}

async function scrapePetDetail(page, url) {
    await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
    });

    await sleep(200);

    const payload = await page.evaluate(() => {
        const titleSelectors = [
            "#bo_v_title",
            ".bo_v_tit",
            ".view_tit",
            "h1",
            "h2",
            "h3",
        ];

        let titleText = "";
        for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText.trim()) {
                titleText = el.innerText.trim();
                break;
            }
        }

        let imageUrl = "";

        const imageSelectors = [
            "#bo_v_atc img",
            "#bo_v_con img",
            ".board-view img",
            ".view-content img",
            ".tbl_frm01 img",
            "article img",
            "img"
        ];

        for (const selector of imageSelectors) {
            const imgs = Array.from(document.querySelectorAll(selector));

            for (const img of imgs) {
                const src = img.getAttribute("src") || img.src || "";
                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;

                if (!src) continue;
                if (w < 40 || h < 40) continue;
                if (src.includes("logo")) continue;
                if (src.includes("icon")) continue;

                imageUrl = src;
                break;
            }

            if (imageUrl) break;
        }

        return {
            titleText,
            bodyText: document.body.innerText || "",
            imageUrl,
        };
    });

    if (payload.imageUrl) {
        try {
            payload.imageUrl = new URL(payload.imageUrl, url).href;
        } catch {
            // 그대로 둠
        }
    }

    return parsePetFromPayload(payload, url);
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

    console.log("[시작] 페트 목록 페이지 접속 중...");

    await page.goto(`${BASE_URL}&page=1`, {
        waitUntil: "networkidle2",
        timeout: 60000,
    });

    const firstInfo = await getListPageInfo(page);
    const lastPage = firstInfo.maxPage;

    console.log(`마지막 페이지 추정: ${lastPage}`);

    const detailUrlSet = new Set();

    for (let pageNo = 1; pageNo <= lastPage; pageNo++) {
        console.log(`[목록 ${pageNo}/${lastPage}] 수집 중...`);

        await page.goto(`${BASE_URL}&page=${pageNo}`, {
            waitUntil: "networkidle2",
            timeout: 60000,
        });

        const info = await getListPageInfo(page);

        for (const rawUrl of info.detailUrls) {
            const normalized = normalizeDetailUrl(rawUrl);
            if (normalized) {
                detailUrlSet.add(normalized);
            }
        }

        console.log(`[목록 ${pageNo}/${lastPage}] 누적 상세 URL: ${detailUrlSet.size}`);
        await sleep(250);
    }

    const detailUrls = Array.from(detailUrlSet);
    console.log(`상세 페이지 수집 대상: ${detailUrls.length}개`);

    const pets = [];

    for (let i = 0; i < detailUrls.length; i++) {
        const url = detailUrls[i];

        try {
            const pet = await scrapePetDetail(page, url);
            pets.push(pet);
            console.log(`[상세 ${i + 1}/${detailUrls.length}] OK - ${pet.name} ${pet.imageUrl ? "(img)" : "(no img)"}`);
        } catch (error) {
            console.log(`[상세 ${i + 1}/${detailUrls.length}] FAIL - ${url}`);
            console.log(`  이유: ${error.message}`);
        }

        await sleep(250);
    }

    await browser.close();

    const uniqueMap = new Map();

    for (const pet of pets) {
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

main().catch(error => {
    console.error("실패:", error);
    process.exit(1);
});