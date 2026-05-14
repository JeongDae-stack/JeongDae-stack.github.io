    let currentTab = 'pet';

    let petData = [];
    let itemData = [];
    let petRankingData = {
        summary: null,
        pets: []
    };
let ridingInfoData = {
    summary: null,
    characters: []
};

    let radontaGuideData = [];

    async function loadData() {
        const area = document.getElementById('resultArea');

        try {
            area.innerHTML = `
                <div class="message-box">
                    데이터를 불러오는 중입니다...
                </div>
            `;

            const petResponse = await fetch("./data/pets.json");
            petData = await petResponse.json();
            console.log("페트 데이터 로딩 완료:", petData.length);

            try {
                const itemResponse = await fetch("./data/items.json");
                itemData = await itemResponse.json();
                console.log("아이템 데이터 로딩 완료:", itemData.length);
            } catch (itemError) {
                console.warn("아이템 데이터 로딩 실패. 아이템 검색은 비어 있을 수 있습니다.", itemError);
                itemData = [];
            }

            try {
                const rankResponse = await fetch("./data/pet_rankings.json");
                petRankingData = await rankResponse.json();
                console.log("펫 랭킹 데이터 로딩 완료:", getRankingPetsArray().length);
            } catch (rankError) {
                console.warn("펫 랭킹 데이터 로딩 실패. 펫 랭킹 탭은 비어 있을 수 있습니다.", rankError);
                petRankingData = {
                    summary: null,
                    pets: []
                };
            }

            try {
                const radontaResponse = await fetch("./data/radonta_guide.json");
                radontaGuideData = await radontaResponse.json();
                console.log("라돈타 공략 데이터 로딩 완료:", radontaGuideData.length);
            } catch (radontaError) {
                console.warn("라돈타 공략 데이터 로딩 실패. 라돈타 탭은 비어 있을 수 있습니다.", radontaError);
                radontaGuideData = [];
            }

try {
    const ridingResponse = await fetch(`./data/riding_info.json?v=${Date.now()}`, {
        cache: "no-store"
    });
    ridingInfoData = await ridingResponse.json();
    console.log("탑승펫 데이터 로딩 완료:", getRidingCharactersArray().length);
} catch (ridingError) {
    console.warn("탑승펫 데이터 로딩 실패. 탑승펫 안내 탭은 비어 있을 수 있습니다.", ridingError);
    ridingInfoData = {
        summary: null,
        characters: []
    };
}

            const rankingPets = getRankingPetsArray();
            const rankingRows = rankingPets.reduce((sum, pet) => sum + (pet.rankings?.length || 0), 0);

            area.innerHTML = `
                <div class="message-box">
                    페트 데이터 ${petData.length}개, 아이템 데이터 ${itemData.length}개 로딩 완료.<br>
                    펫 랭킹 데이터 ${rankingPets.length}개 페트 / ${rankingRows}개 기록 로딩 완료.<br>
                    검색 조건을 입력해보세요.
                </div>
            `;
        } catch (error) {
            console.error("데이터 로딩 실패:", error);

            area.innerHTML = `
                <div class="message-box" style="color:var(--accent);">
                    데이터를 불러오지 못했습니다.<br>
                    data/pets.json 파일이 있는지 확인해주세요.
                </div>
            `;
        }
    }

    loadData();
    setupEnterKeySearch();

    function setupEnterKeySearch() {
        document.querySelectorAll('.search-panel input').forEach(input => {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    doSearch();
                }
            });
        });
    }

    function switchTab(tab) {
        currentTab = tab;

        document.getElementById('petSearchPanel').style.display = tab === 'pet' ? 'block' : 'none';
        document.getElementById('itemSearchPanel').style.display = tab === 'item' ? 'block' : 'none';
        document.getElementById('rankSearchPanel').style.display = tab === 'rank' ? 'block' : 'none';
        document.getElementById('radontaSearchPanel').style.display = tab === 'radonta' ? 'block' : 'none';
	document.getElementById('ridingSearchPanel').style.display = tab === 'riding' ? 'block' : 'none';


        document.getElementById('petBtn').className = tab === 'pet' ? 'nav-btn active-pet' : 'nav-btn';
        document.getElementById('itemBtn').className = tab === 'item' ? 'nav-btn active-item' : 'nav-btn';
        document.getElementById('rankBtn').className = tab === 'rank' ? 'nav-btn active-rank' : 'nav-btn';
        document.getElementById('radontaBtn').className = tab === 'radonta' ? 'nav-btn active-radonta' : 'nav-btn';
	document.getElementById('ridingBtn').className = tab === 'riding' ? 'nav-btn active-riding' : 'nav-btn';

        document.getElementById('resultArea').innerHTML = "";

        if (tab === 'radonta') {
            renderRadontaGuide();
        }
	if (tab === 'riding') {
	    renderRidingInfo();
	}
    }

    function resetSearch() {
        document.querySelectorAll('input').forEach(input => input.value = "");
        document.querySelectorAll('select').forEach(select => select.value = "");

        const rankLimit = document.getElementById('rankLimit');
        if (rankLimit) {
            rankLimit.value = "20";
        }

        const rankMetric = document.getElementById('rankMetric');
        if (rankMetric) {
            rankMetric.value = "combatPower";
        }

        const pSortOrder = document.getElementById('pSortOrder');
        if (pSortOrder) {
            pSortOrder.value = "desc";
        }

        document.getElementById('resultArea').innerHTML = "";

        if (currentTab === 'radonta') {
            renderRadontaGuide();
        }
	if (currentTab === 'riding') {
	    renderRidingInfo();
	}
    }

    function safeText(value) {
        return String(value ?? '').toLowerCase();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function objectToSearchText(obj = {}) {
        const labelMap = {
            atk: '공 공격 공격력',
            def: '방 방어 방어력',
            agi: '순 순발 순발력 민첩',
            hp: '체 체력 내구력 hp',

            공격: '공 공격 공격력',
            방어: '방 방어 방어력',
            순발: '순 순발 순발력 민첩',
            체력: '체 체력 내구력 hp',
            내구: '체 체력 내구력 hp',
            내구력: '체 체력 내구력 hp',
            크리: '크리 크리티컬',
            크리티컬: '크리 크리티컬',
            회피: '회피 회피율',
            명중: '명중 명중률',
            매력: '매력'
        };

        return Object.entries(obj || {})
            .map(([key, value]) => `${key} ${labelMap[key] || ''} ${value}`)
            .join(' ');
    }

    function getImageUrl(data) {
        return data?.imageUrl || data?.img || data?.image || data?.thumb || data?.thumbnail || '';
    }

    function renderThumb(data, fallbackEmoji) {
        const imageUrl = getImageUrl(data);
        const emoji = fallbackEmoji || data?.emoji || '🎒';
        const name = data?.name || data?.petName || '';

        if (!imageUrl) {
            return `
                <div class="thumb-wrap">
                    <span class="fallback-emoji">${escapeHtml(emoji)}</span>
                </div>
            `;
        }

        return `
            <div class="thumb-wrap">
                <img
                    class="thumb-img"
                    src="${escapeHtml(imageUrl)}"
                    alt="${escapeHtml(name)}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                >
                <span class="fallback-emoji" style="display:none;">${escapeHtml(emoji)}</span>
            </div>
        `;
    }

    function getItemType(item) {
        if (item.type) return item.type;

        const name = item.name || '';
        const emoji = item.emoji || '';

        if (
            /(창|도끼|활|장궁|부메랑|손톱|발톱|검|칼|참다랑어|스피어|해머)/.test(name) ||
            ['🔱', '🪓', '🏹', '🪃', '⚔️', '🐾', '🐟'].includes(emoji)
        ) {
            return '무기';
        }

        if (
            /(갑옷|옷|투구|머리장식|장갑|방패|부츠|신발)/.test(name) ||
            ['👕', '🪖', '👑', '🧤', '🛡️'].includes(emoji)
        ) {
            return '방어구';
        }

        if (
            /(반지|귀걸이|목걸이|넥클리스|펜던트|벨트|부적)/.test(name) ||
            ['💍', '👂', '📿', '🎗️'].includes(emoji)
        ) {
            return '장신구';
        }

        return '소모품';
    }

    function getItemSearchText(item) {
        return [
            item.name,
            item.type,
            item.sub,
            item.desc,
            objectToSearchText(item.elem),
            objectToSearchText(item.init),
            objectToSearchText(item.stats)
        ].join(' ').toLowerCase();
    }

    function makeStatHtml(title, obj = {}) {
        const entries = Object.entries(obj || {})
            .filter(([_, value]) => String(value) !== '0' && String(value).trim() !== '');

        if (entries.length === 0) return '';

        return `
            <div style="margin-top:8px;">
                <div class="stat-row-label item-stat-label">${escapeHtml(title)}</div>
                <div class="stat-grid">
                    ${entries.map(([key, value]) => `
                        <div class="stat-val">
                            <span class="stat-label">${escapeHtml(key)}</span>
                            <span class="stat-num">${escapeHtml(value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderEmptyMessage(message) {
        const area = document.getElementById('resultArea');
        area.innerHTML = `
            <div class="message-box">
                ${message}
            </div>
        `;
    }

    function getRankingPetsArray() {
        if (Array.isArray(petRankingData)) return petRankingData;
        if (Array.isArray(petRankingData?.pets)) return petRankingData.pets;
        return [];
    }

    function getPetBaseByName(petName) {
        return petData.find(p => p.name === petName) ||
               petData.find(p => safeText(p.name) === safeText(petName)) ||
               petData.find(p => safeText(p.name).includes(safeText(petName))) ||
               null;
    }

    function getRankingMetricLabel(metric) {
        const labels = {
            combatPower: '전투력',
            level: 'Lv',
            atk: '공격력',
            def: '방어력',
            agi: '순발력',
            hp: '내구력',
            rank: '원본 순위'
        };

        return labels[metric] || metric;
    }

    function getRankingMetricValue(row, metric) {
        if (metric === 'rank') return Number(row.rank || 0);
        return Number(row[metric] || 0);
    }

    function formatRankingValue(value) {
        const num = Number(value || 0);
        if (Number.isInteger(num)) return String(num);
        return num.toFixed(2);
    }

    function calcSValue(initValue, growthValue, level) {
        const init = Number(initValue || 0);
        const growth = Number(growthValue || 0);
        const lv = Number(level || 1);

        return Math.floor(init + growth * (lv - 1));
    }

    function calcCombatPowerFromStats(stats) {
        const atk = Number(stats.atk || 0);
        const def = Number(stats.def || 0);
        const agi = Number(stats.agi || 0);
        const hp = Number(stats.hp || 0);

        return Math.round((atk + def + agi + (hp / 4)) * 100) / 100;
    }

    function calcSComparison(basePet, row) {
        if (!basePet || !basePet.init || !basePet.stats) {
            return null;
        }

        const sStats = {
            atk: calcSValue(basePet.init?.atk, basePet.stats?.atk, row.level),
            def: calcSValue(basePet.init?.def, basePet.stats?.def, row.level),
            agi: calcSValue(basePet.init?.agi, basePet.stats?.agi, row.level),
            hp: calcSValue(basePet.init?.hp, basePet.stats?.hp, row.level)
        };

        const currentStats = {
            atk: Number(row.atk || 0),
            def: Number(row.def || 0),
            agi: Number(row.agi || 0),
            hp: Number(row.hp || 0)
        };

        const currentCombatPower = calcCombatPowerFromStats(currentStats);
        const sCombatPower = calcCombatPowerFromStats(sStats);

        return {
            sStats,
            sCombatPower,
            currentCombatPower,
            diff: {
                atk: currentStats.atk - sStats.atk,
                def: currentStats.def - sStats.def,
                agi: currentStats.agi - sStats.agi,
                hp: currentStats.hp - sStats.hp,
                combatPower: Math.round((currentCombatPower - sCombatPower) * 100) / 100
            }
        };
    }

    function formatSigned(value) {
        const num = Number(value || 0);
        const text = Number.isInteger(num) ? String(num) : num.toFixed(2);

        if (num > 0) return `+${text}`;
        return text;
    }

    function getDiffClass(value) {
        const num = Number(value || 0);

        if (num > 0) return 'plus';
        if (num < 0) return 'minus';
        return 'zero';
    }

    function renderValueWithDiff(currentValue, diffValue, sValue) {
        if (diffValue === null || diffValue === undefined || sValue === null || sValue === undefined) {
            return escapeHtml(currentValue);
        }

        return `
            <div class="value-with-diff">
                <span class="value-main">${escapeHtml(currentValue)}</span>
                <span class="value-diff ${getDiffClass(diffValue)}">${escapeHtml(formatSigned(diffValue))}</span>
                <span class="s-base">S ${escapeHtml(sValue)}</span>
            </div>
        `;
    }

	function renderMobileRankStat(label, currentValue, diffValue, sValue, extraClass = "") {
	    if (diffValue === null || diffValue === undefined || sValue === null || sValue === undefined) {
	        return `
	            <div class="mobile-rank-stat ${escapeHtml(extraClass)}">
	                <div class="mobile-rank-stat-label">${escapeHtml(label)}</div>
	                <div class="mobile-rank-current">${escapeHtml(currentValue)}</div>
	            </div>
	        `;
	    }

    	return `
    	    <div class="mobile-rank-stat ${escapeHtml(extraClass)}">
    	        <div class="mobile-rank-stat-label">${escapeHtml(label)}</div>
    	        <div class="mobile-rank-current">${escapeHtml(currentValue)}</div>
    	        <span class="value-diff ${getDiffClass(diffValue)}">${escapeHtml(formatSigned(diffValue))}</span>
    	        <div class="mobile-rank-sbase">S ${escapeHtml(sValue)}</div>
    	    </div>
   	 `;
	}	

	function renderMobileRankCard(row, displayRank, comparison) {
	    const currentCombat = comparison ? comparison.currentCombatPower : row.combatPower;
	
	    const atkStat = comparison
	        ? renderMobileRankStat('공', row.atk, comparison.diff.atk, comparison.sStats.atk)
	        : renderMobileRankStat('공', row.atk, null, null);
	
	    const defStat = comparison
	        ? renderMobileRankStat('방', row.def, comparison.diff.def, comparison.sStats.def)
	        : renderMobileRankStat('방', row.def, null, null);
	
	    const agiStat = comparison
	        ? renderMobileRankStat('순', row.agi, comparison.diff.agi, comparison.sStats.agi)
	        : renderMobileRankStat('순', row.agi, null, null);
	
	    const hpStat = comparison
	        ? renderMobileRankStat('체', row.hp, comparison.diff.hp, comparison.sStats.hp)
	        : renderMobileRankStat('체', row.hp, null, null);
	
	    const combatStat = comparison
	        ? renderMobileRankStat(
	            '전투',
	            formatRankingValue(currentCombat),
	            comparison.diff.combatPower,
	            formatRankingValue(comparison.sCombatPower),
	            'combat'
	        )
	        : renderMobileRankStat('전투', formatRankingValue(currentCombat), null, null, 'combat');
	
	    return `
	        <div class="mobile-rank-card">
	            <div class="mobile-rank-top">
	                <div class="mobile-rank-name">
	                    #${escapeHtml(displayRank)} ${escapeHtml(row.nickname)}
	                </div>
	                <div class="mobile-rank-meta">
	                    Lv ${escapeHtml(row.level)}
	                </div>
	            </div>
	
	            <div class="mobile-rank-stats">
	                ${atkStat}
	                ${defStat}
	                ${agiStat}
	                ${hpStat}
	                ${combatStat}
	            </div>
	        </div>
	    `;
	}

    function getPetAutoSortMetric() {
        const minTotal = document.getElementById('minTotal').value.trim();
        const minAtk = document.getElementById('minAtk').value.trim();
        const minDef = document.getElementById('minDef').value.trim();
        const minAgi = document.getElementById('minAgi').value.trim();
        const minHp = document.getElementById('minHp').value.trim();

        const eJi = document.getElementById('eJi').value.trim();
        const eSu = document.getElementById('eSu').value.trim();
        const eHwa = document.getElementById('eHwa').value.trim();
        const ePung = document.getElementById('ePung').value.trim();

        if (minTotal !== '') return 'total';
        if (minAtk !== '') return 'stats.atk';
        if (minDef !== '') return 'stats.def';
        if (minAgi !== '') return 'stats.agi';
        if (minHp !== '') return 'stats.hp';

        if (eJi !== '') return 'elem.지';
        if (eSu !== '') return 'elem.수';
        if (eHwa !== '') return 'elem.화';
        if (ePung !== '') return 'elem.풍';

        return 'total';
    }

    function getPetValueByPath(pet, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : 0;
        }, pet);
    }

    function getPetSortLabel(metric) {
        const labels = {
            total: '전체 성장률',
            'stats.atk': '공격 성장률',
            'stats.def': '방어 성장률',
            'stats.agi': '순발 성장률',
            'stats.hp': '체력 성장률',
            'elem.지': '지속성',
            'elem.수': '수속성',
            'elem.화': '화속성',
            'elem.풍': '풍속성'
        };

        return labels[metric] || metric;
    }

    function doSearch() {
        const area = document.getElementById('resultArea');
        area.innerHTML = "";

        if (currentTab === 'pet' && petData.length === 0) {
            renderEmptyMessage("아직 페트 데이터가 로딩되지 않았습니다.");
            return;
        }

        if (currentTab === 'item' && itemData.length === 0) {
            renderEmptyMessage("아직 아이템 데이터가 로딩되지 않았습니다.<br>data/items.json 파일이 있는지 확인해주세요.");
            return;
        }

        if (currentTab === 'rank' && getRankingPetsArray().length === 0) {
            renderEmptyMessage("아직 펫 랭킹 데이터가 로딩되지 않았습니다.<br>data/pet_rankings.json 파일이 있는지 확인해주세요.");
            return;
        }

	if (currentTab === 'riding' && getRidingCharactersArray().length === 0) {
	    renderEmptyMessage("아직 탑승펫 데이터가 로딩되지 않았습니다.<br>data/riding_info.json 파일이 있는지 확인해주세요.");
	    return;
	}

        if (currentTab === 'pet') {
            searchPets();
        } else if (currentTab === 'item') {
            searchItems();
        } else if (currentTab === 'rank') {
            searchPetOwnerRankings();
        } else if (currentTab === 'radonta') {
            renderRadontaGuide();
	} else if (currentTab === 'riding') {
    		renderRidingInfo();   
	}

    function searchPets() {
        const area = document.getElementById('resultArea');

        const filters = {
            name: document.getElementById('pName').value.toLowerCase(),
            지: parseInt(document.getElementById('eJi').value) || 0,
            수: parseInt(document.getElementById('eSu').value) || 0,
            화: parseInt(document.getElementById('eHwa').value) || 0,
            풍: parseInt(document.getElementById('ePung').value) || 0,
            atk: parseFloat(document.getElementById('minAtk').value) || 0,
            def: parseFloat(document.getElementById('minDef').value) || 0,
            agi: parseFloat(document.getElementById('minAgi').value) || 0,
            hp: parseFloat(document.getElementById('minHp').value) || 0,
            total: parseFloat(document.getElementById('minTotal').value) || 0
        };

        const sortMetric = getPetAutoSortMetric();
        const sortOrder = document.getElementById('pSortOrder')?.value || 'desc';
        const sortLabel = getPetSortLabel(sortMetric);
        const sortOrderLabel = sortOrder === 'asc' ? '낮은순' : '높은순';

        const filtered = petData
            .filter(p => {
                return safeText(p.name).includes(filters.name) &&
                    (p.elem?.지 || 0) >= filters.지 &&
                    (p.elem?.수 || 0) >= filters.수 &&
                    (p.elem?.화 || 0) >= filters.화 &&
                    (p.elem?.풍 || 0) >= filters.풍 &&
                    (p.stats?.atk || 0) >= filters.atk &&
                    (p.stats?.def || 0) >= filters.def &&
                    (p.stats?.agi || 0) >= filters.agi &&
                    (p.stats?.hp || 0) >= filters.hp &&
                    (p.total || 0) >= filters.total;
            })
            .sort((a, b) => {
                const aValue = Number(getPetValueByPath(a, sortMetric) || 0);
                const bValue = Number(getPetValueByPath(b, sortMetric) || 0);

                if (sortOrder === 'asc') {
                    return aValue - bValue;
                }

                return bValue - aValue;
            });

        if (filtered.length === 0) {
            renderEmptyMessage("검색 결과가 없습니다.");
            return;
        }

        area.innerHTML += `
            <div class="rank-summary" style="border-color:var(--primary);">
                검색 결과: <strong>${filtered.length}</strong>개 ·
                정렬 기준: <strong>${escapeHtml(sortLabel)} ${escapeHtml(sortOrderLabel)}</strong>
            </div>
        `;

        filtered.forEach(p => {
            let elemHtml = '';

            for (const [key, value] of Object.entries(p.elem || {})) {
                if (value > 0) {
                    elemHtml += `<span class="elem-badge bg-${escapeHtml(key)}">${escapeHtml(key)} ${escapeHtml(value)}</span>`;
                }
            }

            const extraInfo = [
                p.ride ? `탑승: ${p.ride}` : '',
                p.grade ? `등급: ${p.grade}` : ''
            ].filter(Boolean).join(' · ');

            area.innerHTML += `
                <div class="card" style="border-left: 5px solid var(--primary)">
                    <div class="total-badge">${escapeHtml(p.total ?? '-')}</div>

                    <div class="card-head">
                        ${renderThumb(p, p.emoji || '🐾')}

                        <div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--primary);">
                                ${escapeHtml(p.name || '')}
                            </div>

                            <div style="font-size:0.75rem; color:var(--text-sub); margin-top:4px;">
                                ${escapeHtml(p.sub || '')}
                            </div>

                            ${extraInfo ? `
                                <div style="font-size:0.72rem; color:var(--text-sub); margin-top:4px;">
                                    ${escapeHtml(extraInfo)}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div style="margin-top:8px;">${elemHtml}</div>

                    <div class="stat-section">
                        <div class="stat-row-label">📈 성장률</div>
                        <div class="stat-grid">
                            <div class="stat-val"><span class="stat-label">공</span><span class="stat-num">${escapeHtml(p.stats?.atk ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">방</span><span class="stat-num">${escapeHtml(p.stats?.def ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">순</span><span class="stat-num">${escapeHtml(p.stats?.agi ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">체</span><span class="stat-num">${escapeHtml(p.stats?.hp ?? '-')}</span></div>
                        </div>

                        <div class="stat-row-label">👶 초기치</div>
                        <div class="stat-grid">
                            <div class="stat-val"><span class="stat-label">공</span><span class="stat-num" style="color:#fbbf24">${escapeHtml(p.init?.atk ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">방</span><span class="stat-num" style="color:#fbbf24">${escapeHtml(p.init?.def ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">순</span><span class="stat-num" style="color:#fbbf24">${escapeHtml(p.init?.agi ?? '-')}</span></div>
                            <div class="stat-val"><span class="stat-label">체</span><span class="stat-num" style="color:#fbbf24">${escapeHtml(p.init?.hp ?? '-')}</span></div>
                        </div>
                    </div>

                    ${p.source ? `<a class="source-link" href="${escapeHtml(p.source)}" target="_blank" rel="noopener">원본 보기</a>` : ''}
                </div>
            `;
        });
    }

    function searchItems() {
        const area = document.getElementById('resultArea');

        const iName = document.getElementById('iName').value.trim().toLowerCase();
        const iType = document.getElementById('iType').value;
        const iEffect = document.getElementById('iEffect').value.trim().toLowerCase();

        const filteredItems = itemData.filter(item => {
            const type = getItemType(item);
            const searchText = getItemSearchText(item);

            const matchName = safeText(item.name).includes(iName);
            const matchType = iType === '' || type === iType;
            const matchEffect = iEffect === '' || searchText.includes(iEffect);

            return matchName && matchType && matchEffect;
        });

        if (filteredItems.length === 0) {
            renderEmptyMessage("검색 결과가 없습니다.");
            return;
        }

        filteredItems.forEach(item => {
            const type = getItemType(item);

            let elemHtml = '';

            for (const [key, value] of Object.entries(item.elem || {})) {
                if (value > 0) {
                    elemHtml += `<span class="elem-badge bg-${escapeHtml(key)}">${escapeHtml(key)} ${escapeHtml(value)}</span>`;
                }
            }

            area.innerHTML += `
                <div class="card" style="border-left: 5px solid var(--item-color)">
                    <div style="font-size:0.7rem; color:var(--item-color); font-weight:bold; margin-bottom:8px;">
                        ${escapeHtml(type)}
                    </div>

                    <div class="card-head item-card-head">
                        ${renderThumb(item, item.emoji || '🎒')}

                        <div>
                            <div style="font-size:1.3rem; font-weight:bold; color:var(--item-color);">
                                ${escapeHtml(item.name || '')}
                            </div>

                            <div style="font-size:0.75rem; color:var(--text-sub); margin-top:4px;">
                                ${escapeHtml(item.sub || '')}
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:8px;">
                        ${elemHtml}
                    </div>

                    <div class="stat-section">
                        ${makeStatHtml('기본 능력치', item.init)}
                        ${makeStatHtml('추가 효과', item.stats)}

                        ${item.desc ? `
                            <div class="desc-box">
                                ${escapeHtml(item.desc)}
                            </div>
                        ` : ''}
                    </div>

                    ${item.source ? `<a class="source-link" href="${escapeHtml(item.source)}" target="_blank" rel="noopener">원본 보기</a>` : ''}
                </div>
            `;
        });
    }

    function searchPetOwnerRankings() {
        const area = document.getElementById('resultArea');

        const petNameQuery = document.getElementById('rankPetName').value.trim().toLowerCase();
        const nicknameQuery = document.getElementById('rankNickname').value.trim().toLowerCase();
        const metric = document.getElementById('rankMetric').value;
        const limit = parseInt(document.getElementById('rankLimit').value) || 20;
        const metricLabel = getRankingMetricLabel(metric);

        const rankingPets = getRankingPetsArray();

        let matchedPets = rankingPets.filter(pet => {
            const matchPetName = petNameQuery === '' || safeText(pet.petName).includes(petNameQuery);
            const hasRows = Array.isArray(pet.rankings) && pet.rankings.length > 0;

            return matchPetName && hasRows;
        });

        if (nicknameQuery) {
            matchedPets = matchedPets
                .map(pet => ({
                    ...pet,
                    rankings: pet.rankings.filter(row => safeText(row.nickname).includes(nicknameQuery))
                }))
                .filter(pet => pet.rankings.length > 0);
        }

        if (matchedPets.length === 0) {
            renderEmptyMessage("랭킹 결과가 없습니다.");
            return;
        }

        const totalRowsBeforeLimit = matchedPets.reduce((sum, pet) => sum + pet.rankings.length, 0);

        area.innerHTML += `
            <div class="rank-summary">
                <strong>펫 랭킹 검색 결과</strong><br>
                검색된 페트: ${matchedPets.length}개 · 검색된 랭킹 기록: ${totalRowsBeforeLimit}개 · 정렬 기준: ${escapeHtml(metricLabel)}<br>
                S기준: <strong>Math.floor(초기치 + 성장률 × (Lv - 1))</strong><br>
                전투력 계산식: <strong>공격력 + 방어력 + 순발력 + (내구력 / 4)</strong>
            </div>
        `;

        matchedPets.forEach(petRank => {
            const basePet = getPetBaseByName(petRank.petName);
            const displayPet = {
                name: petRank.petName,
                petName: petRank.petName,
                sub: petRank.sub || basePet?.sub || '',
                imageUrl: petRank.imageUrl || basePet?.imageUrl || '',
                emoji: basePet?.emoji || '🐾'
            };

            const sortedRows = [...petRank.rankings].sort((a, b) => {
                if (metric === 'rank') {
                    return Number(a.rank || 0) - Number(b.rank || 0);
                }

                return getRankingMetricValue(b, metric) - getRankingMetricValue(a, metric);
            });

            const rows = sortedRows.slice(0, limit);

            const tableRows = rows.map((row, index) => {
                const displayRank = metric === 'rank' ? row.rank : index + 1;
                const comparison = calcSComparison(basePet, row);

                const atkCell = comparison
                    ? renderValueWithDiff(row.atk, comparison.diff.atk, comparison.sStats.atk)
                    : escapeHtml(row.atk);

                const defCell = comparison
                    ? renderValueWithDiff(row.def, comparison.diff.def, comparison.sStats.def)
                    : escapeHtml(row.def);

                const agiCell = comparison
                    ? renderValueWithDiff(row.agi, comparison.diff.agi, comparison.sStats.agi)
                    : escapeHtml(row.agi);

                const hpCell = comparison
                    ? renderValueWithDiff(row.hp, comparison.diff.hp, comparison.sStats.hp)
                    : escapeHtml(row.hp);

                const currentCombat = comparison ? comparison.currentCombatPower : row.combatPower;
                const combatCell = comparison
                    ? renderValueWithDiff(formatRankingValue(currentCombat), comparison.diff.combatPower, formatRankingValue(comparison.sCombatPower))
                    : escapeHtml(formatRankingValue(row.combatPower));

const mobileCard = renderMobileRankCard(row, displayRank, comparison);

	return `
	    <tr class="desktop-rank-row">
	        <td>${escapeHtml(displayRank)}</td>
	        <td class="nickname">${escapeHtml(row.nickname)}</td>
	        <td>${escapeHtml(row.level)}</td>
	        <td>${atkCell}</td>
	        <td>${defCell}</td>
	        <td>${agiCell}</td>
	        <td>${hpCell}</td>
	        <td class="combat">${combatCell}</td>
	    </tr>
	
	    <tr class="mobile-rank-row">
	        <td class="mobile-rank-card-cell" colspan="8">
	            ${mobileCard}
	        </td>
	    </tr>
	`;
            }).join('');

            area.innerHTML += `
                <div class="card rank-card">
                    <div class="card-head item-card-head">
                        ${renderThumb(displayPet, displayPet.emoji)}

                        <div>
                            <div style="font-size:1.25rem; font-weight:bold; color:var(--rank-color);">
                                ${escapeHtml(petRank.petName)}
                            </div>

                            <div style="font-size:0.75rem; color:var(--text-sub); margin-top:4px;">
                                ${escapeHtml(petRank.sub || basePet?.sub || '')}
                            </div>

                            <div class="rank-score">
                                ${escapeHtml(metricLabel)} 기준 TOP ${rows.length}
                            </div>
                        </div>
                    </div>

                    <div class="rank-table-wrap">
                        <table class="rank-table">
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>닉네임</th>
                                    <th>Lv</th>
                                    <th>공격력</th>
                                    <th>방어력</th>
                                    <th>순발력</th>
                                    <th>내구력</th>
                                    <th>전투력</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>

                    ${petRank.source ? `<a class="source-link" href="${escapeHtml(petRank.source)}" target="_blank" rel="noopener">원본 보기</a>` : ''}
                </div>
            `;
        });
    }

    function getRadontaSearchText(entry) {
        const variantText = (entry.variants || [])
            .map(v => `${v.title} ${v.spellOrder} ${v.attackOrder}`)
            .join(' ');

        return [
            entry.floor,
            entry.set,
            entry.spellOrder,
            entry.attackOrder,
            variantText
        ].join(' ').toLowerCase();
    }

    function renderRadontaNormalSections(entry, simpleMode) {
        if (simpleMode) {
            return `
                <div class="radonta-section">
                    <div class="radonta-label">공격순서</div>
                    <div class="radonta-text">${escapeHtml(entry.attackOrder || '')}</div>
                </div>
            `;
        }

        return `
            <div class="radonta-section">
                <div class="radonta-label">주술순서</div>
                <div class="radonta-text">${escapeHtml(entry.spellOrder || '')}</div>
            </div>

            <div class="radonta-section">
                <div class="radonta-label">공격순서</div>
                <div class="radonta-text">${escapeHtml(entry.attackOrder || '')}</div>
            </div>
        `;
    }

    function renderRadontaVariantSections(entry, simpleMode) {
        return (entry.variants || []).map(variant => `
            <div class="radonta-variant">
                <div class="radonta-variant-title">${escapeHtml(variant.title || '')}</div>

                ${simpleMode ? '' : `
                    <div class="radonta-section">
                        <div class="radonta-label">주술순서</div>
                        <div class="radonta-text">${escapeHtml(variant.spellOrder || '')}</div>
                    </div>
                `}

                <div class="radonta-section">
                    <div class="radonta-label">공격순서</div>
                    <div class="radonta-text">${escapeHtml(variant.attackOrder || '')}</div>
                </div>
            </div>
        `).join('');
    }

	function getRadontaSetBadgeClass(setName) {
	    if (setName === "수셋") return "set-water";
	    if (setName === "지셋") return "set-earth";
	    return "";
	}

    function renderRadontaGuide() {
        const area = document.getElementById('resultArea');
        area.innerHTML = "";

        if (!Array.isArray(radontaGuideData) || radontaGuideData.length === 0) {
            renderEmptyMessage("라돈타 공략 데이터가 로딩되지 않았습니다.<br>data/radonta_guide.json 파일이 있는지 확인해주세요.");
            return;
        }

        const floorQuery = document.getElementById('radontaFloor')?.value.trim().toLowerCase() || "";
        const setFilter = document.getElementById('radontaSet')?.value || "";
        const keyword = document.getElementById('radontaKeyword')?.value.trim().toLowerCase() || "";
        const viewMode = document.getElementById('radontaViewMode')?.value || "all";
        const simpleMode = viewMode === "simple";

        const filtered = radontaGuideData.filter(entry => {
            const matchFloor = floorQuery === "" || safeText(entry.floor).includes(floorQuery);
            const matchSet = setFilter === "" || entry.set === setFilter;
            const matchKeyword = keyword === "" || getRadontaSearchText(entry).includes(keyword);

            return matchFloor && matchSet && matchKeyword;
        });

        if (filtered.length === 0) {
            renderEmptyMessage("라돈타 공략 검색 결과가 없습니다.");
            return;
        }

	area.innerHTML += `
	    <div class="rank-summary" style="border-color:var(--radonta-color);">
	        <strong style="color:var(--radonta-color);">라돈타 공략</strong><br>
	        검색 결과: ${filtered.length}개 · 층/셋/키워드로 필터링할 수 있습니다.<br><br>

        	<div style="color:#ffffff; font-weight:bold; line-height:1.8;">
	        	2순 : 1완 수호 담당<br>
	        	3순 : 2완 수호 담당<br>
	        	1순 우대타임에 2순은 서브힐, 3순은 주유
        	</div>

	    </div>
	`;

        filtered.forEach(entry => {
            const bodyHtml = entry.variants
                ? renderRadontaVariantSections(entry, simpleMode)
                : renderRadontaNormalSections(entry, simpleMode);

            area.innerHTML += `
                <div class="card radonta-card">
                    <div class="radonta-floor-title">
                        ${escapeHtml(entry.floor)}
                        <span class="radonta-set-badge ${getRadontaSetBadgeClass(entry.set)}">${escapeHtml(entry.set)}</span>
                    </div>

                    ${bodyHtml}
                </div>
            `;
        });
    }

// Inline onclick handlers in index.html call these functions.
// Keep explicit exports when JS is separated into js/app.js.
window.switchTab = switchTab;
window.resetSearch = resetSearch;
window.doSearch = doSearch;

async function shareSite() {
    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const shareTitle = "StoneAge Database";
    const shareText = "스톤에이지 페트 / 아이템 / 랭킹 / 라돈타 공략 정보 사이트";

    try {
        if (navigator.share) {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            });
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            alert("사이트 링크가 복사되었습니다.");
            return;
        }

        window.prompt("아래 링크를 복사하세요.", shareUrl);
    } catch (error) {
        console.warn("공유 실패:", error);
        window.prompt("아래 링크를 복사하세요.", shareUrl);
    }
}

function refreshSite() {
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now());
    window.location.href = url.toString();
}

function getRidingCharactersArray() {
    if (Array.isArray(ridingInfoData)) return ridingInfoData;
    if (Array.isArray(ridingInfoData?.characters)) return ridingInfoData.characters;
    return [];
}

function normalizeRidingName(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[［\[]/g, "(")
        .replace(/[］\]]/g, ")")
        .replace(/\s+/g, "")
        .trim();
}

function findPetForRiding(petName) {
    const targetKey = normalizeRidingName(petName);

    if (!targetKey) return null;

    return petData.find(pet => normalizeRidingName(pet.name) === targetKey) ||
           petData.find(pet => normalizeRidingName(pet.name).includes(targetKey)) ||
           petData.find(pet => targetKey.includes(normalizeRidingName(pet.name))) ||
           null;
}

function getRidingPetNames(characterInfo) {
    if (Array.isArray(characterInfo.pets)) {
        return characterInfo.pets;
    }

    return [
        ...(characterInfo.matchedPets || []),
        ...(characterInfo.unmatchedPets || [])
    ];
}

function renderRidingPetCard(petName) {
    const pet = findPetForRiding(petName);

    if (!pet) {
        return `
            <div class="riding-pet-card unmatched">
                <div class="thumb-wrap">
                    <span class="fallback-emoji">❓</span>
                </div>

                <div>
                    <div class="riding-pet-name">${escapeHtml(petName)}</div>
                    <div class="riding-unmatched-label">이미지 미매칭</div>
                </div>
            </div>
        `;
    }

    const elemText = Object.entries(pet.elem || {})
        .filter(([_, value]) => Number(value) > 0)
        .map(([key, value]) => `${key}${value}`)
        .join(" / ");

    return `
        <div class="riding-pet-card">
            ${renderThumb(pet, pet.emoji || "🐾")}

            <div>
                <div class="riding-pet-name">${escapeHtml(pet.name)}</div>
                <div class="riding-pet-sub">
                    ${escapeHtml(elemText || pet.sub || "")}
                </div>
            </div>
        </div>
    `;
}

function renderRidingInfo() {
    const area = document.getElementById('resultArea');
    area.innerHTML = "";

    const characterQuery = document.getElementById('ridingCharacter')?.value.trim().toLowerCase() || "";
    const petQuery = document.getElementById('ridingPetName')?.value.trim().toLowerCase() || "";
    const viewMode = document.getElementById('ridingViewMode')?.value || "all";
    const sortMode = document.getElementById('ridingSortMode')?.value || "character";

    let characters = getRidingCharactersArray()
        .map(characterInfo => {
            let petNames = getRidingPetNames(characterInfo);

            if (petQuery) {
                petNames = petNames.filter(name => safeText(name).includes(petQuery));
            }

            if (viewMode === "matched") {
                petNames = petNames.filter(name => !!findPetForRiding(name));
            } else if (viewMode === "unmatched") {
                petNames = petNames.filter(name => !findPetForRiding(name));
            }

            return {
                ...characterInfo,
                displayPets: petNames
            };
        })
        .filter(characterInfo => {
            const matchCharacter =
                characterQuery === "" ||
                safeText(characterInfo.character).includes(characterQuery) ||
                safeText(characterInfo.title).includes(characterQuery);

            return matchCharacter && characterInfo.displayPets.length > 0;
        });

    if (sortMode === "count") {
        characters.sort((a, b) => b.displayPets.length - a.displayPets.length);
    } else {
        characters.sort((a, b) => String(a.character || "").localeCompare(String(b.character || ""), "ko"));
    }

    if (characters.length === 0) {
        renderEmptyMessage("탑승펫 안내 검색 결과가 없습니다.");
        return;
    }

    const totalPetRefs = characters.reduce((sum, item) => sum + item.displayPets.length, 0);

    area.innerHTML += `
        <div class="rank-summary" style="border-color:#14b8a6;">
            <strong style="color:#14b8a6;">탑승펫 안내</strong><br>
            검색된 캐릭터: ${characters.length}명 · 표시된 탑승펫: ${totalPetRefs}개<br>
            펫 이미지는 기존 pets.json의 imageUrl을 기준으로 표시합니다.
        </div>
    `;

    characters.forEach(characterInfo => {
        const petCardsHtml = characterInfo.displayPets
            .map(name => renderRidingPetCard(name))
            .join("");

        area.innerHTML += `
            <div class="card riding-card">
                <div class="riding-title">
                    <div class="riding-character-name">
                        ${escapeHtml(characterInfo.character || characterInfo.title || "")}
                    </div>

                    <div class="riding-count-badge">
                        탑승펫 ${characterInfo.displayPets.length}개
                    </div>
                </div>

                <div class="riding-pet-grid">
                    ${petCardsHtml}
                </div>

                ${characterInfo.source ? `<a class="source-link" href="${escapeHtml(characterInfo.source)}" target="_blank" rel="noopener">원본 보기</a>` : ""}
            </div>
        `;
    });
}