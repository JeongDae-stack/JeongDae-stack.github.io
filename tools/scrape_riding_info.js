const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");
const PETS_JSON = path.join(ROOT, "data", "pets.json");
const OUT_JSON = path.join(ROOT, "data", "riding_info.json");

const BASE_URL = "https://www.hwansoo.top/bbs/board.php";
const BOARD_URL = `${BASE_URL}?bo_table=riding`;

const PET_NAME_ALIASES = {
    "쿠루로": "쿠로로"
};

const MANUAL_HIDDEN_CHARACTERS = [
    {
        character: "울보소녀(히든)",
        baseCharacter: "울보소녀",
        extraPets: ["예르체", "풍백"]
    },
    {
        character: "석기미남(히든)",
        baseCharacter: "석기미남",
        extraPets: ["풍백"]
    }
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(value) {
    return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeName(value) {
    return normalizeText(value)
        .replace(/[［\[]/g, "(")
        .replace(/[］\]]/g, ")")
        .replace(/\s+/g, "");
}

function cleanCharacterName(title) {
    return normalizeText(title)
        .replace(/^#+\s*/g, "")
        .replace(/\s*탑승\s*정보\s*/g, "")
        .replace(/\s*탑승정보\s*/g, "")
        .replace(/\s*탑승\s*리스트\s*/g, "")
        .replace(/\s*탑승리스트\s*/g, "")
        .replace(/\s*탑승\s*페트\s*/g, "")
        .replace(/\s*탑승페트\s*/g, "")
        .trim();
}

function uniqueArray(list) {
    const seen = new Set();
    const result = [];

    for (const item of list) {
        const key = normalizeName(item);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        result.push(item);
    }

    return result;
}

function loadPets() {
    if (!fs.existsSync(PETS_JSON)) {
        console.log("[WARN] data/pets.json 파일이 없습니다. 펫 이름 매칭은 건너뜁니다.");
        return [];
    }

    return JSON.parse(fs.readFileSync(PETS_JSON, "utf-8"));
}

function buildPetLookup(pets) {
    const map = new Map();

    for (const pet of pets) {
        const name = pet.name || "";
        const key = normalizeName(name);

        if (!key) continue;

        if (!map.has(key)) {
            map.set(key, pet);
        }
    }

    return map;
}

function matchPetName(name, petLookup) {
    const pet = findPetByRidingName(name, petLookup);

    if (pet) {
        return {
            matched: true,
            matchedName: pet.name
        };
    }

    return {
        matched: false,
        matchedName: ""
    };
}

function findPetByRidingName(name, petLookup) {
    const originalKey = normalizeName(name);
    const aliasTarget = PET_NAME_ALIASES[name] || PET_NAME_ALIASES[originalKey] || "";
    const key = aliasTarget ? normalizeName(aliasTarget) : originalKey;

    if (!key) return null;

    if (petLookup.has(key)) {
        return petLookup.get(key);
    }

    for (const pet of petLookup.values()) {
        const petKey = normalizeName(pet.name);
        if (petKey && (petKey.includes(key) || key.includes(petKey))) {
            return pet;
        }
    }

    return null;
}

function buildRidingMatchLists(petNames, petLookup) {
    const matchedPets = [];
    const unmatchedPets = [];

    for (const name of petNames) {
        const pet = findPetByRidingName(name, petLookup);

        if (pet) {
            matchedPets.push(pet.name);
        } else {
            unmatchedPets.push(name);
        }
    }

    return {
        matchedPets: uniqueArray(matchedPets),
        unmatchedPets: uniqueArray(unmatchedPets)
    };
}

function applyManualHiddenCharacters(characters, petLookup) {
    const result = characters.filter(characterInfo => {
        return !MANUAL_HIDDEN_CHARACTERS.some(hidden => hidden.character === characterInfo.character);
    });

    for (const hidden of MANUAL_HIDDEN_CHARACTERS) {
        const base = result.find(characterInfo => characterInfo.character === hidden.baseCharacter);

        if (!base) {
            console.log(`[WARN] 히든 캐릭터 기준 데이터를 찾지 못했습니다: ${hidden.baseCharacter}`);
            continue;
        }

        const petNames = uniqueArray([...(base.pets || []), ...hidden.extraPets]);
        const { matchedPets, unmatchedPets } = buildRidingMatchLists(petNames, petLookup);

        result.push({
            ...base,
            character: hidden.character,
            title: `${hidden.character} 탑승 정보`,
            hidden: true,
            baseCharacter: hidden.baseCharacter,
            hiddenExtraPets: hidden.extraPets,
            petCount: petNames.length,
            matchedCount: matchedPets.length,
            unmatchedCount: unmatchedPets.length,
            pets: petNames,
            matchedPets,
            unmatchedPets
        });

        console.log(
            `[MANUAL] ${hidden.character}: ${petNames.length}개 ` +
            `(히든 추가 ${hidden.extraPets.join(", ")})`
        );
    }

    return result;
}

async function gotoWithRetry(page, url, options = {}) {
    const maxTry = 3;

    for (let i = 1; i <= maxTry; i++) {
        try {
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: 60000,
                ...options
            });
            return;
        } catch (error) {
            console.log(`[WARN] 페이지 접근 실패 ${i}/${maxTry}: ${url}`);
            console.log(`       ${error.message}`);

            if (i === maxTry) {
                throw error;
            }

            await sleep(1500);
        }
    }
}

async function collectPostLinks(page) {
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href]"))
            .map(a => ({
                title: (a.textContent || "").trim(),
                href: a.href || a.getAttribute("href") || ""
            }))
            .filter(item => {
                return (
                    item.title &&
                    item.href &&
                    item.href.includes("bo_table=riding") &&
                    item.href.includes("wr_id=")
                );
            });
    });

    return links
        .map(item => ({
            title: normalizeText(item.title),
            url: item.href
        }))
        .filter(item => item.title && item.url);
}

async function collectAllPostLinks(page) {
    const all = [];
    const seen = new Set();

    for (let pageNo = 1; pageNo <= 10; pageNo++) {
        const url = pageNo === 1 ? BOARD_URL : `${BOARD_URL}&page=${pageNo}`;

        console.log(`[LIST] ${pageNo}페이지 확인 중...`);
        await gotoWithRetry(page, url);

        const links = await collectPostLinks(page);
        let added = 0;

        for (const link of links) {
            const wrIdMatch = link.url.match(/[?&]wr_id=(\d+)/);
            const wrId = wrIdMatch ? wrIdMatch[1] : link.url;

            if (seen.has(wrId)) continue;

            seen.add(wrId);
            all.push({
                wrId,
                title: link.title,
                url: link.url
            });
            added++;
        }

        console.log(`       신규 게시글 ${added}개`);

        if (added === 0) {
            break;
        }

        await sleep(500);
    }

    return all;
}

function extractBodyTextFromFullPage(fullText) {
    const text = String(fullText || "").replace(/\r/g, "");
    const startMarker = "### 본문";
    const endMarkers = [
        "### 관련자료",
        "댓글 0",
        "등록된 댓글",
        "로그인한 회원만",
        "###  【"
    ];

    let body = text;
    const startIndex = body.indexOf(startMarker);

    if (startIndex >= 0) {
        body = body.slice(startIndex + startMarker.length);
    }

    let endIndex = -1;

    for (const marker of endMarkers) {
        const idx = body.indexOf(marker);
        if (idx >= 0 && (endIndex === -1 || idx < endIndex)) {
            endIndex = idx;
        }
    }

    if (endIndex >= 0) {
        body = body.slice(0, endIndex);
    }

    return body.trim();
}

function parsePetNamesFromBody(bodyText, petLookup, characterName) {
    const blockedPatterns = [
        /^본문$/,
        /^목록$/,
        /^이전$/,
        /^다음$/,
        /^작성일/,
        /^댓글/,
        /^조회/,
        /^등록자/,
        /^최고관리자/,
        /^탑승정보$/,
        /^관련자료$/,
        /^로그인/,
        /^등록된 댓글/,
        /^#/
    ];

    const rawLines = String(bodyText || "")
        .replace(/\r/g, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .split(/\n+/)
        .map(line => normalizeText(line))
        .filter(Boolean);

    const names = [];
    const characterKey = normalizeName(characterName);

    for (const line of rawLines) {
        let value = line;

        value = value.replace(/^[-•*·]\s*/g, "");
        value = value.replace(/^\d+[.)]\s*/g, "");
        value = normalizeText(value);

        if (!value) continue;
        if (blockedPatterns.some(pattern => pattern.test(value))) continue;

        // 캐릭터명은 펫 이름에서 제외
        if (normalizeName(value) === characterKey) continue;

        // 한 줄에 여러 펫이 붙어 있는 경우 pets.json 기준으로 분해
        const knownNames = extractKnownPetNamesFromLine(value, petLookup);

        if (knownNames.length > 0) {
            names.push(...knownNames);
            continue;
        }

        // 그래도 못 찾은 짧은 항목만 미매칭 후보로 남김
        if (value.length <= 30) {
            names.push(value);
        }
    }

    return uniqueArray(names);
}

async function scrapePostDetail(page, post, petLookup) {
    await gotoWithRetry(page, post.url);

    const detail = await page.evaluate(() => {
        const titleEl =
            document.querySelector("#bo_v_title") ||
            document.querySelector(".bo_v_tit") ||
            document.querySelector("h1") ||
            document.querySelector("h2");

        const contentEl =
            document.querySelector("#bo_v_con") ||
            document.querySelector(".bo_v_con") ||
            document.querySelector("#bo_v_atc") ||
            document.querySelector("article");

        return {
            title: titleEl ? titleEl.innerText : "",
            contentText: contentEl ? contentEl.innerText : "",
            fullText: document.body ? document.body.innerText : ""
        };
    });

    const title = normalizeText(detail.title || post.title);
    const character = cleanCharacterName(title || post.title);

let bodyText = String(detail.contentText || "")
    .replace(/\r/g, "\n")
    .trim();

if (!bodyText || bodyText.length < 2) {
    bodyText = extractBodyTextFromFullPage(detail.fullText);
}
const petNames = parsePetNamesFromBody(bodyText, petLookup, character);

    const matchedPets = [];
    const unmatchedPets = [];

    for (const name of petNames) {
        const match = matchPetName(name, petLookup);

        if (match.matched) {
            matchedPets.push(match.matchedName);
        } else {
            unmatchedPets.push(name);
        }
    }

    return {
        character,
        title,
        source: post.url,
        petCount: petNames.length,
        matchedCount: matchedPets.length,
        unmatchedCount: unmatchedPets.length,
        pets: petNames,
        matchedPets: uniqueArray(matchedPets),
        unmatchedPets: uniqueArray(unmatchedPets)
    };
}

async function main() {
    ensureDir(path.dirname(OUT_JSON));

    const pets = loadPets();
    const petLookup = buildPetLookup(pets);

    console.log("========================================");
    console.log("  캐릭터별 탑승펫 정보 수집");
    console.log("========================================");
    console.log(`기존 pets.json 펫 수: ${pets.length}`);
    console.log("");

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

    const posts = await collectAllPostLinks(page);

    console.log("");
    console.log(`수집 대상 게시글: ${posts.length}개`);
    console.log("");

    const characters = [];

    for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        console.log(`[${i + 1}/${posts.length}] ${post.title}`);

        try {
            const result = await scrapePostDetail(page, post, petLookup);
            characters.push(result);

            console.log(
                `       ${result.character}: ${result.petCount}개 ` +
                `(매칭 ${result.matchedCount}, 미매칭 ${result.unmatchedCount})`
            );

            if (result.unmatchedPets.length > 0) {
                console.log(`       미매칭: ${result.unmatchedPets.join(", ")}`);
            }
        } catch (error) {
            console.log(`       [FAIL] ${error.message}`);
        }

        await sleep(500);
    }

    await browser.close();

    const finalCharacters = applyManualHiddenCharacters(characters, petLookup)
        .sort((a, b) => a.character.localeCompare(b.character, "ko"));

    const totalPetRefs = finalCharacters.reduce((sum, item) => sum + item.petCount, 0);
    const totalMatched = finalCharacters.reduce((sum, item) => sum + item.matchedCount, 0);
    const totalUnmatched = finalCharacters.reduce((sum, item) => sum + item.unmatchedCount, 0);

    const output = {
        summary: {
            generatedAt: new Date().toISOString(),
            sourceBoard: BOARD_URL,
            characterCount: finalCharacters.length,
            totalPetRefs,
            totalMatched,
            totalUnmatched,
            manualHiddenCharacterCount: MANUAL_HIDDEN_CHARACTERS.length
        },
        characters: finalCharacters
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), "utf-8");

    console.log("");
    console.log("========================================");
    console.log("  캐릭터별 탑승펫 정보 수집 완료");
    console.log("========================================");
    console.log(output.summary);
    console.log(`저장 파일: ${OUT_JSON}`);
}

main().catch(error => {
    console.error("[ERROR]", error);
    process.exit(1);
});

function getPetCandidates(petLookup) {
    return Array.from(petLookup.values())
        .map(pet => ({
            name: pet.name,
            key: normalizeName(pet.name)
        }))
        .filter(pet => pet.name && pet.key)
        .sort((a, b) => b.key.length - a.key.length);
}

function extractKnownPetNamesFromLine(line, petLookup) {
    let remain = normalizeName(line);
    const found = [];

    // alias 먼저 처리
    for (const [alias, target] of Object.entries(PET_NAME_ALIASES)) {
        const aliasKey = normalizeName(alias);
        const targetKey = normalizeName(target);

        if (remain.includes(aliasKey) && petLookup.has(targetKey)) {
            found.push(petLookup.get(targetKey).name);
            remain = remain.split(aliasKey).join(" ");
        }
    }

    const candidates = getPetCandidates(petLookup);

    for (const pet of candidates) {
        if (!pet.key) continue;

        if (remain.includes(pet.key)) {
            found.push(pet.name);
            remain = remain.split(pet.key).join(" ");
        }
    }

    return uniqueArray(found);
}