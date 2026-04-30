const fs = require("fs");
const path = require("path");

const IN_PATH = path.join(__dirname, "..", "data", "right_items_raw.json");
const OUT_PATH = path.join(__dirname, "..", "data", "items.json");

function getItemType(name) {
    if (/(창|도끼|활|장궁|부메랑|손톱|발톱|검|칼|참다랑어)/.test(name)) {
        return "무기";
    }

    if (/(갑옷|옷|투구|머리장식|장갑|방패|부츠|신발)/.test(name)) {
        return "방어구";
    }

    if (/(반지|귀걸이|목걸이|넥클리스|펜던트|벨트|부적)/.test(name)) {
        return "장신구";
    }

    return "소모품";
}

function emojiForType(type) {
    if (type === "무기") return "⚔️";
    if (type === "방어구") return "🛡️";
    if (type === "장신구") return "💍";
    return "🎒";
}

function findStat(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].replace(/\s+/g, "");
    }
    return null;
}

function parseStats(description = "") {
    const text = description.replace(/\n/g, " ");

    const stats = {};

    const atk = findStat(text, [
        /공격력\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /공\s*([+-]?\d+(?:~[+-]?\d+)?)/
    ]);

    const def = findStat(text, [
        /방어력\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /방어\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /방\s*([+-]?\d+(?:~[+-]?\d+)?)/
    ]);

    const agi = findStat(text, [
        /순발력\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /순\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /민\s*([+-]?\d+(?:~[+-]?\d+)?)/
    ]);

    const hp = findStat(text, [
        /체력\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /내구력\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /내구\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /체\s*([+-]?\d+(?:~[+-]?\d+)?)/,
        /내\s*([+-]?\d+(?:~[+-]?\d+)?)/
    ]);

    const cri = findStat(text, [
        /크리티컬\s*([+-]?\d+(?:~[+-]?\d+)?%?)/,
        /크리\s*([+-]?\d+(?:~[+-]?\d+)?%?)/
    ]);

    const eva = findStat(text, [
        /회피\s*([+-]?\d+(?:~[+-]?\d+)?%?)/
    ]);

    const hit = findStat(text, [
        /명중\s*([+-]?\d+(?:~[+-]?\d+)?%?)/
    ]);

    if (atk) stats["공격"] = atk;
    if (def) stats["방어"] = def;
    if (agi) stats["순발"] = agi;
    if (hp) stats["체력"] = hp;
    if (cri) stats["크리"] = cri;
    if (eva) stats["회피"] = eva;
    if (hit) stats["명중"] = hit;

    return stats;
}

function parseElem(description = "") {
    const elem = {};
    const text = description.replace(/\n/g, " ");

    const map = {
        "지": /(?:지속성|\[지)\s*\+?(\d+)/,
        "수": /(?:수속성|\[수)\s*\+?(\d+)/,
        "화": /(?:화속성|\[화)\s*\+?(\d+)/,
        "풍": /(?:풍속성|\[풍)\s*\+?(\d+)/,
    };

    for (const [key, regex] of Object.entries(map)) {
        const match = text.match(regex);
        if (match) elem[key] = Number(match[1]);
    }

    return elem;
}

function main() {
    const raw = JSON.parse(fs.readFileSync(IN_PATH, "utf-8"));

    const items = raw.map(item => {
        const name = String(item.name || "").trim();
        const desc = String(item.description || "").trim();
        const type = getItemType(name);

        return {
            id: item.id || "",
            name,
            type,
            sub: item.materials || "아이템",
            elem: parseElem(desc),
            total: 0,
            init: {},
            stats: parseStats(desc),
            desc,
            emoji: emojiForType(type),
            imageUrl: item.imageUrl || "",
            source: item.source || ""
        };
    }).filter(item => item.name);

    fs.writeFileSync(OUT_PATH, JSON.stringify(items, null, 2), "utf-8");

    console.log(`완료: ${OUT_PATH}`);
    console.log(`저장된 아이템 수: ${items.length}`);
}

main();