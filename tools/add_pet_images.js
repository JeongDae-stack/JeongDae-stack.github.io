const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const PETS_PATH = path.join(__dirname, "..", "data", "pets.json");
const BACKUP_PATH = path.join(__dirname, "..", "data", "pets.backup.json");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isPetImageUrl(url) {
    if (!url) return false;

    const lower = String(url).toLowerCase();

    if (!lower.includes("/data/file/pets/")) return false;
    if (
        !lower.includes(".webp") &&
        !lower.includes(".gif") &&
        !lower.includes(".png") &&
        !lower.includes(".jpg") &&
        !lower.includes(".jpeg")
    ) {
        return false;
    }

    if (lower.includes("logo")) return false;
    if (lower.includes("icon")) return false;
    if (lower.includes("profile")) return false;
    if (lower.includes("avatar")) return false;

    return true;
}

async function extractPetImage(page, url) {
    try {
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000,
        });

        await sleep(200);

        const imageUrl = await page.evaluate(() => {
            function normalize(raw) {
                if (!raw) return "";
                try {
                    return new URL(raw, location.href).href;
                } catch {
                    return raw;
                }
            }

            function isPetImage(raw) {
                if (!raw) return false;

                const lower = String(raw).toLowerCase();

                if (!lower.includes("/data/file/pets/")) return false;

                return (
                    lower.includes(".webp") ||
                    lower.includes(".gif") ||
                    lower.includes(".png") ||
                    lower.includes(".jpg") ||
                    lower.includes(".jpeg")
                );
            }

            const containers = [
                document.querySelector("#bo_v_con"),
                document.querySelector("#bo_v_atc"),
                document.querySelector(".bo_v_con"),
                document.querySelector(".view-content"),
                document.querySelector(".board-view"),
                document.querySelector("article"),
                document.body,
            ].filter(Boolean);

            for (const container of containers) {
                const links = Array.from(container.querySelectorAll("a[href]"));

                for (const a of links) {
                    if (
                        a.closest("#bo_vc") ||
                        a.closest(".bo_vc") ||
                        a.closest("#bo_vc_w") ||
                        a.closest(".comment") ||
                        a.closest(".comments") ||
                        a.closest(".cmt")
                    ) {
                        continue;
                    }

                    const href = a.getAttribute("href") || a.href || "";

                    if (isPetImage(href)) {
                        return normalize(href);
                    }
                }

                const imgs = Array.from(container.querySelectorAll("img"));

                for (const img of imgs) {
                    if (
                        img.closest("#bo_vc") ||
                        img.closest(".bo_vc") ||
                        img.closest("#bo_vc_w") ||
                        img.closest(".comment") ||
                        img.closest(".comments") ||
                        img.closest(".cmt")
                    ) {
                        continue;
                    }

                    const src = img.getAttribute("src") || img.src || "";

                    if (isPetImage(src)) {
                        return normalize(src);
                    }
                }
            }

            return "";
        });

        return isPetImageUrl(imageUrl) ? imageUrl : "";
    } catch (error) {
        return "";
    }
}

async function main() {
    if (!fs.existsSync(PETS_PATH)) {
        console.error("data/pets.json 파일이 없습니다.");
        process.exit(1);
    }

    const pets = JSON.parse(fs.readFileSync(PETS_PATH, "utf-8"));

    if (!Array.isArray(pets)) {
        console.error("pets.json 형식이 배열이 아닙니다.");
        process.exit(1);
    }

    if (pets.length < 500) {
        console.error(`페트 수가 너무 적습니다: ${pets.length}`);
        console.error("잘못된 pets.json일 수 있으니 중단합니다.");
        process.exit(1);
    }

    if (!fs.existsSync(BACKUP_PATH)) {
        fs.writeFileSync(BACKUP_PATH, JSON.stringify(pets, null, 2), "utf-8");
        console.log(`백업 생성: ${BACKUP_PATH}`);
    }

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

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < pets.length; i++) {
        const pet = pets[i];

        if (pet.imageUrl) {
            skipped++;
            continue;
        }

        if (!pet.source) {
            failed++;
            console.log(`[${i + 1}/${pets.length}] SKIP - source 없음: ${pet.name}`);
            continue;
        }

        const imageUrl = await extractPetImage(page, pet.source);

        if (imageUrl) {
            pet.imageUrl = imageUrl;
            updated++;
            console.log(`[${i + 1}/${pets.length}] OK - ${pet.name}`);
        } else {
            failed++;
            console.log(`[${i + 1}/${pets.length}] NO IMG - ${pet.name}`);
        }

        if ((i + 1) % 25 === 0) {
            fs.writeFileSync(PETS_PATH, JSON.stringify(pets, null, 2), "utf-8");
            console.log(`중간 저장: ${i + 1}/${pets.length}, 이미지 있음: ${pets.filter(x => x.imageUrl).length}`);
        }

        await sleep(150);
    }

    await browser.close();

    fs.writeFileSync(PETS_PATH, JSON.stringify(pets, null, 2), "utf-8");

    console.log("");
    console.log("완료");
    console.log(`전체 페트 수: ${pets.length}`);
    console.log(`이미지 추가: ${updated}`);
    console.log(`기존 이미지 있음: ${skipped}`);
    console.log(`이미지 없음/실패: ${failed}`);
    console.log(`최종 이미지 있음: ${pets.filter(x => x.imageUrl).length}`);
}

main().catch(error => {
    console.error("실패:", error);
    process.exit(1);
});