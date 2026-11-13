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
        const latest = Math.max(0, ...ids.filter(Number.isSafeInteger));
        if (!latest) throw new Error("No patch-note IDs found");
        console.log(latest);
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
