const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");
const PETS_JSON = path.join(ROOT, "data", "pets.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(url, baseUrl) {
    if (!url) return "";

    try {
        return new URL(url, baseUrl).href;
    } catch {
        return "";
    }
}

async function extractPetImageUrl(page, sourceUrl) {
    await page.goto(sourceUrl, {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    const imageUrl = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll("img"));

        const candidates = images
            .map(img => img.getAttribute("src") || img.src || "")
            .filter(src => src)
            .filter(src => {
                const lower = src.toLowerCase();

                return (
                    lower.includes("/data/file/pets/") &&
                    (
                        lower.includes(".webp") ||
                        lower.includes(".gif") ||
                        lower.includes(".png") ||
                        lower.includes(".jpg") ||
                        lower.includes(".jpeg")
                    )
                );
            });

        return candidates[0] || "";
    });

    return normalizeUrl(imageUrl, sourceUrl);
}

async function main() {
    if (!fs.existsSync(PETS_JSON)) {
        throw new Error("data/pets.json 파일이 없습니다.");
    }

    const pets = JSON.parse(fs.readFileSync(PETS_JSON, "utf-8"));

    const targets = pets.filter(pet => {
        return (!pet.imageUrl || String(pet.imageUrl).trim() === "") && pet.source;
    });

    console.log("========================================");
    console.log("  빈 펫 이미지 URL 보완");
    console.log("========================================");
    console.log(`전체 펫: ${pets.length}`);
    console.log(`imageUrl 없는 펫: ${targets.length}`);
    console.log("");

    if (targets.length === 0) {
        console.log("보완할 항목이 없습니다.");
        return;
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

    let success = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
        const pet = targets[i];

        try {
            console.log(`[${i + 1}/${targets.length}] ${pet.name} 이미지 확인 중...`);

            const imageUrl = await extractPetImageUrl(page, pet.source);

            if (imageUrl) {
                pet.imageUrl = imageUrl;
                success++;
                console.log(`  OK: ${imageUrl}`);
            } else {
                failed++;
                console.log(`  FAIL: 이미지 URL을 찾지 못했습니다.`);
            }
        } catch (error) {
            failed++;
            console.log(`  FAIL: ${error.message}`);
        }

        await sleep(200);
    }

    await browser.close();

    fs.writeFileSync(PETS_JSON, JSON.stringify(pets, null, 2), "utf-8");

    console.log("");
    console.log("========================================");
    console.log("  빈 펫 이미지 URL 보완 완료");
    console.log("========================================");
    console.log(`성공: ${success}`);
    console.log(`실패: ${failed}`);
}

main().catch(error => {
    console.error("[ERROR]", error);
    process.exit(1);
});