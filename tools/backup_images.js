const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");

const PETS_JSON = path.join(ROOT, "data", "pets.json");
const ITEMS_JSON = path.join(ROOT, "data", "items.json");

const OUT_ROOT = path.join(ROOT, "image_backup");
const PET_OUT = path.join(OUT_ROOT, "pets");
const ITEM_OUT = path.join(OUT_ROOT, "items");
const MANIFEST = path.join(OUT_ROOT, "image_manifest.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function safeFileName(name) {
    return String(name || "unknown")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 80);
}

function getExtFromUrl(url) {
    try {
        const pathname = new URL(url).pathname.toLowerCase();

        if (pathname.endsWith(".webp")) return ".webp";
        if (pathname.endsWith(".gif")) return ".gif";
        if (pathname.endsWith(".png")) return ".png";
        if (pathname.endsWith(".jpg")) return ".jpg";
        if (pathname.endsWith(".jpeg")) return ".jpeg";
    } catch {
        // ignore
    }

    return ".img";
}

function isRemoteUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
}

async function downloadImageWithPuppeteer(page, url, outPath) {
    const response = await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
    });

    if (!response) {
        throw new Error("No response");
    }

    const status = response.status();

    if (status < 200 || status >= 300) {
        throw new Error(`HTTP ${status}`);
    }

    const buffer = await response.buffer();

    if (!buffer || buffer.length === 0) {
        throw new Error("Empty image buffer");
    }

    fs.writeFileSync(outPath, buffer);
}

async function backupList(type, list, outDir, page) {
    const results = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];

        const name = item.name || item.petName || `item_${i + 1}`;
        const imageUrl = item.imageUrl;

        if (!imageUrl) {
            console.log(`[${type}] SKIP no imageUrl - ${name}`);
            results.push({
                type,
                name,
                imageUrl: "",
                localPath: "",
                status: "skipped",
                error: "no imageUrl"
            });
            continue;
        }

        if (!isRemoteUrl(imageUrl)) {
            console.log(`[${type}] SKIP local imageUrl - ${name}`);
            results.push({
                type,
                name,
                imageUrl,
                localPath: imageUrl,
                status: "skipped",
                error: "not remote url"
            });
            continue;
        }

        const ext = getExtFromUrl(imageUrl);
        const fileName = `${String(i + 1).padStart(4, "0")}_${safeFileName(name)}${ext}`;
        const outPath = path.join(outDir, fileName);
        const relativePath = path.relative(ROOT, outPath).replaceAll("\\", "/");

        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
            console.log(`[${type}] EXISTS - ${name}`);
            results.push({
                type,
                name,
                imageUrl,
                localPath: relativePath,
                status: "ok"
            });
            continue;
        }

        try {
            console.log(`[${type}] DOWNLOAD - ${name}`);
            await downloadImageWithPuppeteer(page, imageUrl, outPath);

            results.push({
                type,
                name,
                imageUrl,
                localPath: relativePath,
                status: "ok"
            });
        } catch (error) {
            console.log(`[${type}] FAIL - ${name}: ${error.message}`);

            results.push({
                type,
                name,
                imageUrl,
                localPath: "",
                status: "failed",
                error: error.message
            });
        }

        if ((i + 1) % 25 === 0 || i === list.length - 1) {
            console.log(`[${type}] 진행률: ${i + 1}/${list.length}`);
        }

        await sleep(200);
    }

    return results;
}

async function main() {
    ensureDir(PET_OUT);
    ensureDir(ITEM_OUT);

    if (!fs.existsSync(PETS_JSON)) {
        throw new Error("data/pets.json 파일이 없습니다.");
    }

    if (!fs.existsSync(ITEMS_JSON)) {
        throw new Error("data/items.json 파일이 없습니다.");
    }

    const pets = JSON.parse(fs.readFileSync(PETS_JSON, "utf-8"));
    const items = JSON.parse(fs.readFileSync(ITEMS_JSON, "utf-8"));

    console.log("========================================");
    console.log("  이미지 백업 시작");
    console.log("========================================");
    console.log(`페트: ${pets.length}개`);
    console.log(`아이템: ${items.length}개`);
    console.log("");

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

    const petResults = await backupList("pet", pets, PET_OUT, page);
    const itemResults = await backupList("item", items, ITEM_OUT, page);

    await browser.close();

    const allResults = [...petResults, ...itemResults];

    const manifest = {
        generatedAt: new Date().toISOString(),
        summary: {
            pets: {
                total: pets.length,
                ok: petResults.filter(x => x.status === "ok").length,
                failed: petResults.filter(x => x.status === "failed").length,
                skipped: petResults.filter(x => x.status === "skipped").length
            },
            items: {
                total: items.length,
                ok: itemResults.filter(x => x.status === "ok").length,
                failed: itemResults.filter(x => x.status === "failed").length,
                skipped: itemResults.filter(x => x.status === "skipped").length
            },
            total: {
                ok: allResults.filter(x => x.status === "ok").length,
                failed: allResults.filter(x => x.status === "failed").length,
                skipped: allResults.filter(x => x.status === "skipped").length
            }
        },
        images: allResults
    };

    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf-8");

    console.log("");
    console.log("========================================");
    console.log("  이미지 백업 완료");
    console.log("========================================");
    console.log(`백업 폴더: ${OUT_ROOT}`);
    console.log(`목록 파일: ${MANIFEST}`);
    console.log("");
    console.log(manifest.summary);
}

main().catch(error => {
    console.error("실패:", error);
    process.exit(1);
});