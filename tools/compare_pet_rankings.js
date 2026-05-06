const fs = require("fs");
const path = require("path");

const beforePath = process.argv[2];
const afterPath = process.argv[3];

if (!beforePath || !afterPath) {
    console.error("사용법: node tools\\compare_pet_rankings.js before.json after.json");
    process.exit(1);
}

function readJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function normalizeRankingRow(row = {}) {
    return {
        rank: Number(row.rank || 0),
        nickname: String(row.nickname || ""),
        level: Number(row.level || 0),
        atk: Number(row.atk || 0),
        def: Number(row.def || 0),
        agi: Number(row.agi || 0),
        hp: Number(row.hp || 0),
        combatPower: Number(row.combatPower || 0)
    };
}

function getPetsArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.pets)) return data.pets;
    return [];
}

function normalizeData(data) {
    const pets = getPetsArray(data)
        .map(pet => ({
            petName: String(pet.petName || pet.name || ""),
            rankings: Array.isArray(pet.rankings)
                ? pet.rankings.map(normalizeRankingRow)
                : []
        }))
        .sort((a, b) => a.petName.localeCompare(b.petName, "ko"));

    return pets;
}

function makePetMap(normalizedPets) {
    const map = new Map();

    normalizedPets.forEach(pet => {
        map.set(pet.petName, JSON.stringify(pet.rankings));
    });

    return map;
}

function getSummary(data) {
    const pets = getPetsArray(data);
    const petsWithRanking = pets.filter(p => Array.isArray(p.rankings) && p.rankings.length > 0).length;
    const totalRankingRows = pets.reduce((sum, p) => sum + (Array.isArray(p.rankings) ? p.rankings.length : 0), 0);

    return {
        petCount: pets.length,
        petsWithRanking,
        totalRankingRows
    };
}

const beforeData = readJson(beforePath);
const afterData = readJson(afterPath);

if (!afterData) {
    console.error("[ERROR] 새 pet_rankings.json 파일을 읽을 수 없습니다.");
    process.exit(1);
}

if (!beforeData) {
    console.log("[CHANGED] 기존 pet_rankings.json이 없어 새 파일을 변경사항으로 처리합니다.");
    process.exit(2);
}

const beforeNormalized = normalizeData(beforeData);
const afterNormalized = normalizeData(afterData);

const beforeText = JSON.stringify(beforeNormalized);
const afterText = JSON.stringify(afterNormalized);

const beforeSummary = getSummary(beforeData);
const afterSummary = getSummary(afterData);

console.log("");
console.log("========================================");
console.log("  펫 랭킹 변경 비교");
console.log("========================================");
console.log("기존:", beforeSummary);
console.log("신규:", afterSummary);

if (beforeText === afterText) {
    console.log("");
    console.log("[NO CHANGE] 실제 랭킹 변화가 없습니다.");
    process.exit(0);
}

const beforeMap = makePetMap(beforeNormalized);
const afterMap = makePetMap(afterNormalized);

const changedPets = [];
const addedPets = [];
const removedPets = [];

for (const [petName, afterRankings] of afterMap.entries()) {
    if (!beforeMap.has(petName)) {
        addedPets.push(petName);
    } else if (beforeMap.get(petName) !== afterRankings) {
        changedPets.push(petName);
    }
}

for (const petName of beforeMap.keys()) {
    if (!afterMap.has(petName)) {
        removedPets.push(petName);
    }
}

console.log("");
console.log("[CHANGED] 실제 랭킹 변화가 있습니다.");
console.log(`변경된 페트: ${changedPets.length}개`);
console.log(`추가된 페트: ${addedPets.length}개`);
console.log(`삭제된 페트: ${removedPets.length}개`);

if (changedPets.length > 0) {
    console.log("");
    console.log("변경된 페트 예시:");
    changedPets.slice(0, 20).forEach(name => console.log(`- ${name}`));

    if (changedPets.length > 20) {
        console.log(`... 외 ${changedPets.length - 20}개`);
    }
}

process.exit(2);