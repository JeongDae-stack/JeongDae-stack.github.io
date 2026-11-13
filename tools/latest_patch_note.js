const puppeteer = require("puppeteer");

async function main() {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const response = await page.goto("https://www.hwansoo.top/bbs/board.php?bo_table=patchnote", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });
        if (!response?.ok()) throw new Error("Patch notes HTTP " + response?.status());
        const ids = await page.$$eval("a[href]", links => links.map(link => {
            const url = new URL(link.href);
            if (url.hostname !== location.hostname || url.searchParams.get("bo_table") !== "patchnote") return 0;
            return Number(url.searchParams.get("wr_id"));
        }));
        const candidates = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))]
            .sort((a, b) => b - a);
        if (!candidates.length) throw new Error("No patch-note IDs found");

        for (const id of candidates) {
            const url = new URL("https://www.hwansoo.top/bbs/board.php");
            url.search = new URLSearchParams({ bo_table: "patchnote", wr_id: String(id) });
            const detail = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60000 });
            if (!detail?.ok()) throw new Error("Patch-note detail HTTP " + detail?.status());
            const destination = new URL(page.url());
            const samePost = destination.origin === url.origin &&
                destination.pathname === url.pathname &&
                destination.searchParams.get("bo_table") === "patchnote" &&
                destination.searchParams.get("wr_id") === String(id);
            if (samePost && await page.$eval("body", body =>
                Boolean(body.querySelector("#bo_v #bo_v_title") &&
                    body.querySelector("#bo_v #bo_v_con")?.innerHTML.trim())
            )) {
                console.log(id);
                return;
            }
        }
        console.log(0);
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
