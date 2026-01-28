// ==UserScript==
// @name         ⚡ Pokechill Plus 
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Automatic clicking on Fight Again + Item Tracking
// @author       Teazy
// @match        https://play-pokechill.github.io/*
// @updateURL    https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus.user.js
// @downloadURL  https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus.user.js
// @icon         https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus-icon.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let clickCount = 0;
    let isRunning = false;
    let interval = null;
    let itemStats = {};
    let itemImages = {};
    let ivStats = {};
    let moveStats = {};
    let lastButtonState = false;
    let observer = null;
    let trainingObserver = null;
    let lastSeenItems = {};
    let DEBUG = false;
    let showHpDisplay = false;
    let hpUpdateInterval = null;

    // Ability Hunting
    let abilityHuntEnabled = false;
    let targetAbility = '';
    let abilityLog = [];
    let lastTrainingPokemon = null;

    function log(...args) {
        if (DEBUG) {
            console.log(...args);
        }
    }

    function findButton() {
        const btn = document.getElementById('area-rejoin');
        if (btn && btn.offsetParent !== null && !btn.disabled) {
            return btn;
        }
        return null;
    }

    function trackItems() {
        if (!isRunning) {
            log('⏸️ Tool is stopped, not tracking');
            return;
        }

        log('🔍 Tracking Items...');
        const dropsContainer = document.getElementById('explore-drops');

        if (!dropsContainer) {
            log('❌ explore-drops container not found');
            return;
        }

        const itemElements = dropsContainer.querySelectorAll('.explore-item');
        log(`📦 Found items in container: ${itemElements.length}`);

        const currentItems = {};

        itemElements.forEach(el => {
            const itemId = el.getAttribute('data-item');
            const countSpan = el.querySelector('span');
            const img = el.querySelector('img');

            if (itemId && countSpan) {
                const countText = countSpan.textContent.trim();
                const currentCount = parseInt(countText.replace('x', '')) || 0;
                currentItems[itemId] = currentCount;

                if (img && img.src && !itemImages[itemId]) {
                    itemImages[itemId] = img.src;
                }

                log(`  📝 ${itemId}: currently x${currentCount}`);
            }
        });

        // Compare with previous values and count differences
        Object.keys(currentItems).forEach(itemId => {
            const currentCount = currentItems[itemId];
            const lastCount = lastSeenItems[itemId] || 0;
            const diff = currentCount - lastCount;

            if (diff > 0) {
                log(`  ➕ ${itemId}: +${diff} (${lastCount} -> ${currentCount})`);

                if (itemStats[itemId]) {
                    itemStats[itemId] += diff;
                } else {
                    itemStats[itemId] = diff;
                }
            }
        });

        lastSeenItems = { ...currentItems };

        log('📊 Collected items:', itemStats);
        updateItemDisplay();
    }

    function setupItemObserver() {
        const dropsContainer = document.getElementById('explore-drops');

        if (!dropsContainer) {
            log('⏳ explore-drops not yet available, waiting...');
            setTimeout(setupItemObserver, 1000);
            return;
        }

        if (observer) {
            observer.disconnect();
        }

        log('👀 Item Observer started');

        observer = new MutationObserver((mutations) => {
            let itemsChanged = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    itemsChanged = true;
                }
            });

            if (itemsChanged && isRunning) {
                log('🔄 Items have changed, tracking again...');
                trackItems();
            }
        });

        observer.observe(dropsContainer, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: false
        });

        if (isRunning) {
            trackItems();
        }
    }

    function setupTrainingObserver() {
        const areaEndTitle = document.getElementById('area-end-moves-title');
        if (!areaEndTitle) {
            setTimeout(setupTrainingObserver, 1000);
            return;
        }

        if (trainingObserver) {
            trainingObserver.disconnect();
        }

        log('👀 Training Observer started');

        trainingObserver = new MutationObserver(() => {
            const spans = areaEndTitle.querySelectorAll('span');
            spans.forEach(span => {
                if (span.dataset.pcTracked) return;

                const text = span.textContent.trim();
                if (!text) return;

                span.dataset.pcTracked = 'true';

                if (text.includes(' learnt ')) {
                    trackMove(text);
                } else if (text.startsWith('Increased')) {
                    trackIvs(text);
                } else if (text.includes(' now has ')) {
                    trackAbility(text);
                }
            });
        });

        trainingObserver.observe(areaEndTitle, {
            childList: true,
            subtree: true
        });
    }

    function trackMove(text) {
        // Matches both "Pokemon has learnt Move!" and "Pokemon learnt Move!"
        const moveMatch = text.match(/(.+?)\s+(?:has\s+)?learnt\s+(.+)!/);
        if (moveMatch) {
            const pokemonName = moveMatch[1].trim();
            const movesString = moveMatch[2].trim();

            // Parse moves - can be "Move1", "Move1 and Move2", or "Move1, Move2, and Move3"
            const moves = movesString
                .split(/,\s*and\s+|,\s*|\s+and\s+/)
                .map(m => m.trim())
                .filter(m => m.length > 0);

            if (!moveStats[pokemonName]) {
                moveStats[pokemonName] = [];
            }

            moves.forEach(moveName => {
                if (!moveStats[pokemonName].includes(moveName)) {
                    moveStats[pokemonName].push(moveName);
                    log(`🎯 Move tracked: ${pokemonName} learned ${moveName}`);
                }
            });

            updateMoveDisplay();
        }
    }

    function trackAbility(text) {
        // Matches "Pokemon now has Ability!"
        const abilityMatch = text.match(/(.+?)\s+now has\s+(.+)!/);
        if (abilityMatch) {
            const pokemonName = abilityMatch[1].trim();
            const abilityName = abilityMatch[2].trim();

            abilityLog.unshift({ pokemon: pokemonName, ability: abilityName, time: new Date() });
            if (abilityLog.length > 50) abilityLog.pop(); // Keep max 50 entries

            log(`🎯 Ability tracked: ${pokemonName} got ${abilityName}`);
            updateAbilityDisplay();

            if (abilityHuntEnabled && targetAbility) {
                const normalizedTarget = targetAbility.toLowerCase().replace(/\s+/g, '');
                const normalizedAbility = abilityName.toLowerCase().replace(/\s+/g, '');

                if (normalizedAbility === normalizedTarget) {
                    log(`🎉 Target ability "${abilityName}" found!`);
                    stopAbilityHunt();
                } else {
                    log(`❌ Got "${abilityName}", looking for "${targetAbility}", continuing...`);
                }
            }
        }
    }

    function startAbilityHunt() {
        const select = document.getElementById('af-ability-select');
        if (!select || !select.value) {
            log('⚠️ Please select a target ability');
            return;
        }

        targetAbility = select.value;
        abilityHuntEnabled = true;
        updateAbilityHuntUI();
        log(`🎯 Ability Hunt started for: ${targetAbility}`);

        if (!isRunning) {
            startAutoClick();
        }
    }

    function getAvailableAbilities() {
        if (typeof ability === 'undefined' || typeof pkmn === 'undefined' || typeof saved === 'undefined') {
            return [];
        }

        const trainingPokemon = saved.trainingPokemon;
        if (!trainingPokemon || !pkmn[trainingPokemon]) {
            return [];
        }

        const pokemonTypes = pkmn[trainingPokemon].type || [];
        const currentAbility = pkmn[trainingPokemon].ability;
        const hiddenAbility = pkmn[trainingPokemon].hiddenAbility?.id;

        const availableAbilities = Object.keys(ability).filter(a => {
            const ab = ability[a];
            if (!ab.type) return false;
            if (a === hiddenAbility) return false; // Hidden ability is separate
            if (a === currentAbility) return false; // Already has this ability

            return ab.type.includes("all") || ab.type.some(t => pokemonTypes.includes(t));
        });

        availableAbilities.sort((a, b) => {
            const rarityDiff = (ability[a].rarity || 1) - (ability[b].rarity || 1);
            if (rarityDiff !== 0) return rarityDiff;
            return a.localeCompare(b);
        });

        return availableAbilities;
    }

    function checkTrainingPokemonChange() {
        if (typeof saved === 'undefined' || typeof pkmn === 'undefined') return;

        const currentPokemon = saved.trainingPokemon;
        if (currentPokemon !== lastTrainingPokemon) {
            lastTrainingPokemon = currentPokemon;
            updateAbilitySelect();
        }
    }

    function getTrainingPokemonName() {
        if (typeof saved === 'undefined' || typeof pkmn === 'undefined') return null;
        if (!saved.trainingPokemon || !pkmn[saved.trainingPokemon]) return null;

        const id = saved.trainingPokemon;
        return id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1');
    }

    function updateAbilitySelect() {
        const select = document.getElementById('af-ability-select');
        const pokemonLabel = document.getElementById('af-ability-pokemon');
        if (!select) return;

        const pokemonName = getTrainingPokemonName();
        if (pokemonLabel) {
            pokemonLabel.textContent = pokemonName || 'No Pokemon selected';
            pokemonLabel.style.color = pokemonName ? '#69df96' : '#888';
        }

        const abilities = getAvailableAbilities();

        if (abilities.length === 0) {
            select.innerHTML = '<option value="">-- Select Pokemon first --</option>';
            return;
        }

        const tier1 = abilities.filter(a => ability[a].rarity === 1);
        const tier2 = abilities.filter(a => ability[a].rarity === 2);
        const tier3 = abilities.filter(a => ability[a].rarity === 3);

        let html = '<option value="">-- Select Ability --</option>';

        if (tier1.length > 0) {
            html += '<optgroup label="Common (Tier 1)">';
            tier1.forEach(a => {
                const name = a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1');
                html += `<option value="${a}">${name}</option>`;
            });
            html += '</optgroup>';
        }

        if (tier2.length > 0) {
            html += '<optgroup label="Uncommon (Tier 2)">';
            tier2.forEach(a => {
                const name = a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1');
                html += `<option value="${a}">${name}</option>`;
            });
            html += '</optgroup>';
        }

        if (tier3.length > 0) {
            html += '<optgroup label="Rare (Tier 3)">';
            tier3.forEach(a => {
                const name = a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1');
                html += `<option value="${a}">${name}</option>`;
            });
            html += '</optgroup>';
        }

        select.innerHTML = html;
    }

    function stopAbilityHunt(stopAutoFight = true) {
        abilityHuntEnabled = false;
        targetAbility = '';
        updateAbilityHuntUI();
        log('⏸️ Ability Hunt stopped');

        if (stopAutoFight && isRunning) {
            stopAutoClick();
        }
    }

    function updateAbilityHuntUI() {
        const startBtn = document.getElementById('af-ability-start');
        const stopBtn = document.getElementById('af-ability-stop');
        const statusDot = document.getElementById('af-ability-status');
        const select = document.getElementById('af-ability-select');

        if (startBtn) startBtn.style.display = abilityHuntEnabled ? 'none' : 'block';
        if (stopBtn) stopBtn.style.display = abilityHuntEnabled ? 'block' : 'none';
        if (statusDot) {
            statusDot.style.color = abilityHuntEnabled ? '#4caf50' : '#888';
            statusDot.textContent = abilityHuntEnabled ? '●' : '○';
        }
        if (select) select.disabled = abilityHuntEnabled;
    }

    function getAbilityRarity(abilityName) {
        if (typeof ability === 'undefined') return 1;

        const normalizedName = abilityName.toLowerCase().replace(/\s+/g, '');

        for (const [key, ab] of Object.entries(ability)) {
            if (key.toLowerCase() === normalizedName) {
                return ab.rarity || 1;
            }
        }
        return 1;
    }

    function getAbilityColor(abilityName) {
        const rarity = getAbilityRarity(abilityName);
        switch(rarity) {
            case 1: return '#888';    // Common = gray
            case 2: return '#69df96'; // Uncommon = green
            case 3: return '#64b5f6'; // Rare = light blue
            default: return '#888';
        }
    }

    function updateAbilityDisplay() {
        const abilityList = document.getElementById('af-ability-log');
        if (!abilityList) return;

        if (abilityLog.length === 0) {
            abilityList.innerHTML = '<div style="color: #888; font-size: 11px; text-align: center;">No abilities rolled</div>';
            return;
        }

        abilityList.innerHTML = abilityLog.slice(0, 20).map(entry => {
            const normalizedTarget = targetAbility ? targetAbility.toLowerCase().replace(/\s+/g, '') : '';
            const normalizedAbility = entry.ability.toLowerCase().replace(/\s+/g, '');
            const isTarget = normalizedTarget && normalizedAbility === normalizedTarget;
            const abilityColor = getAbilityColor(entry.ability);
            const targetStyle = isTarget ? 'font-weight: bold; text-shadow: 0 0 5px currentColor;' : '';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 10px;">
                    <span style="color: #ccc;">${entry.pokemon}</span>
                    <span style="color: ${abilityColor}; ${targetStyle}">${entry.ability}</span>
                </div>
            `;
        }).join('');
    }

    function trackIvs(text) {
        const statMatches = text.matchAll(/(\w+)\s+(\d+)\s+point/g);
        for (const match of statMatches) {
            const statName = match[1].toLowerCase();
            const points = parseInt(match[2]) || 1;

            let stat = '';
            if (statName === 'hp') stat = 'HP';
            else if (statName === 'atk') stat = 'Attack';
            else if (statName === 'def') stat = 'Defense';
            else if (statName === 'satk') stat = 'Sp. Atk';
            else if (statName === 'sdef') stat = 'Sp. Def';
            else if (statName === 'spe') stat = 'Speed';

            if (stat) {
                ivStats[stat] = (ivStats[stat] || 0) + points;
                log(`📈 IV tracked: ${stat} +${points}`);
            }
        }
        updateIvDisplay();
    }

    function updateMoveDisplay() {
        const moveList = document.getElementById('af-move-list');
        if (!moveList) return;

        const pokemonNames = Object.keys(moveStats);

        if (pokemonNames.length === 0) {
            moveList.innerHTML = '<div style="color: #888; font-size: 11px; text-align: center;">No moves learned</div>';
            return;
        }

        const sortedPokemon = pokemonNames.sort((a, b) => {
            return moveStats[b].length - moveStats[a].length;
        });

        moveList.innerHTML = sortedPokemon.map(pokemonName => {
            const moves = moveStats[pokemonName];

            const movesHtml = moves.map(moveName => {
                return `
                    <div style="margin: 2px 0 2px 12px; font-size: 10px; color: #ccc;">
                        - ${moveName}
                    </div>
                `;
            }).join('');

            return `
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; font-weight: bold; color: #f472b6;">
                        ◇ ${pokemonName} <span style="color: #888; font-size: 10px; font-weight: normal;">(${moves.length})</span>
                    </div>
                    ${movesHtml}
                </div>
            `;
        }).join('');
    }

    function updateIvDisplay() {
        const ivList = document.getElementById('af-iv-list');
        if (!ivList) return;

        const sortedIvs = Object.entries(ivStats).sort((a, b) => b[1] - a[1]);

        if (sortedIvs.length === 0) {
            ivList.innerHTML = '<div style="color: #888; font-size: 11px; text-align: center;">No IVs gained</div>';
            return;
        }

        ivList.innerHTML = sortedIvs.map(([stat, count]) => {
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 11px;">
                    <span style="color: #fff;">❖ ${stat}</span>
                    <span style="color: #a78bfa; font-weight: bold;">x${count}</span>
                </div>
            `;
        }).join('');
    }

    function updateItemDisplay() {
        const itemList = document.getElementById('af-item-list');
        if (!itemList) return;

        const sortedItems = Object.entries(itemStats).sort((a, b) => b[1] - a[1]);

        if (sortedItems.length === 0) {
            itemList.innerHTML = '<div style="color: #888; font-size: 11px; text-align: center;">No items collected</div>';
            return;
        }

        itemList.innerHTML = sortedItems.map(([name, count]) => {
            const imgSrc = itemImages[name] || '';
            const imgHtml = imgSrc ? `<img src="${imgSrc}" style="width: 20px; height: 20px; margin-right: 6px; vertical-align: middle;">` : '';

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 11px;">
                    <span style="color: #fff; display: flex; align-items: center;">${imgHtml}${name}</span>
                    <span style="color: #ffc107; font-weight: bold;">x${count}</span>
                </div>
            `;
        }).join('');
    }

    function resetAll() {
        clickCount = 0;
        itemStats = {};
        itemImages = {};
        ivStats = {};
        moveStats = {};
        lastSeenItems = {};
        abilityLog = [];
        updateUI();
        updateItemDisplay();
        updateIvDisplay();
        updateMoveDisplay();
        updateAbilityDisplay();
        log('🔄 Everything reset');
    }

    function clickButton() {
        const btn = findButton();
        const buttonExists = !!btn;

        if (btn && isRunning && !lastButtonState) {
            log('🎯 Click on Fight Again');
            btn.click();
            clickCount++;
            updateUI();
        }

        lastButtonState = buttonExists;
    }

    function startAutoClick() {
        if (!interval) {
            interval = setInterval(clickButton, 250);
            isRunning = true;

            lastSeenItems = {};

            const dropsContainer = document.getElementById('explore-drops');
            if (dropsContainer) {
                const itemElements = dropsContainer.querySelectorAll('.explore-item');
                itemElements.forEach(el => {
                    const itemId = el.getAttribute('data-item');
                    const countSpan = el.querySelector('span');
                    if (itemId && countSpan) {
                        const countText = countSpan.textContent.trim();
                        const currentCount = parseInt(countText.replace('x', '')) || 0;
                        lastSeenItems[itemId] = currentCount;
                    }
                });
                log('📸 Baseline captured:', lastSeenItems);
            }

            updateUI();
            log('▶️ Auto-Fight started');
        }
    }

    function stopAutoClick() {
        if (interval) {
            clearInterval(interval);
            interval = null;
            isRunning = false;
            lastButtonState = false;

            if (abilityHuntEnabled) {
                abilityHuntEnabled = false;
                targetAbility = '';
                updateAbilityHuntUI();
            }

            updateUI();
            log('⏸️ Auto-Fight stopped');
        }
    }

    function toggleAutoClick() {
        if (isRunning) {
            stopAutoClick();
        } else {
            startAutoClick();
        }
    }

    function toggleDebug() {
        DEBUG = !DEBUG;
        log(`🐛 Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
    }

    // Debug function to simulate an ability roll (call from console: pcPlusSimulateAbility('AbilityName'))
    window.pcPlusSimulateAbility = function(abilityName, pokemonName = 'TestPokemon') {
        const fakeText = `${pokemonName} now has ${abilityName}!`;
        log(`🧪 Simulating ability: "${fakeText}"`);
        trackAbility(fakeText);
    };

    function toggleHpDisplay() {
        showHpDisplay = !showHpDisplay;
        const checkbox = document.getElementById('af-hp-toggle');
        if (checkbox) checkbox.checked = showHpDisplay;

        if (showHpDisplay) {
            updateHpDisplay();
            if (!hpUpdateInterval) {
                hpUpdateInterval = setInterval(updateHpDisplay, 100);
            }
        } else {
            if (hpUpdateInterval) {
                clearInterval(hpUpdateInterval);
                hpUpdateInterval = null;
            }
            removeHpDisplay();
        }
        log(`❤️ HP Display: ${showHpDisplay ? 'ON' : 'OFF'}`);
    }

    function formatHp(current, max) {
        if (!current && current !== 0) return '';
        if (!max) return '';
        const currentRounded = Math.round(current);
        const maxRounded = Math.round(max);
        return `${currentRounded}/${maxRounded}`;
    }

    function getHpColor(current, max) {
        const percent = (current / max) * 100;
        if (percent > 50) return '#4caf50';
        if (percent > 25) return '#ffc107';
        return '#f44336';
    }

    function updateHpDisplay() {
        if (!showHpDisplay) return;

        try {
            updateEnemyHp();
            updateTeamHp();
        } catch (e) {
            log('HP Display error:', e);
        }
    }

    function updateEnemyHp() {
        const wildNameEl = document.getElementById('explore-wild-name');
        if (!wildNameEl) return;

        if (typeof wildPkmnHp === 'undefined' || typeof wildPkmnHpMax === 'undefined') return;
        if (!wildPkmnHpMax || wildPkmnHpMax <= 0) return;

        const levelSpan = wildNameEl.querySelector('.explore-pkmn-level');
        if (!levelSpan) return;

        let hpSpan = document.getElementById('pc-plus-enemy-hp');
        if (!hpSpan) {
            hpSpan = document.createElement('span');
            hpSpan.id = 'pc-plus-enemy-hp';
            hpSpan.style.cssText = 'margin-left: 8px; font-size: 0.9em; font-weight: bold;';
            levelSpan.parentNode.insertBefore(hpSpan, levelSpan.nextSibling);
        }

        const hpText = formatHp(wildPkmnHp, wildPkmnHpMax);
        const hpColor = getHpColor(wildPkmnHp, wildPkmnHpMax);
        hpSpan.textContent = `(${hpText})`;
        hpSpan.style.color = hpColor;
    }

    function updateTeamHp() {
        if (typeof pkmn === 'undefined' || typeof team === 'undefined') return;

        const slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

        slots.forEach((slot) => {
            if (!team?.[slot]?.pkmn?.id) return;

            const pokemonId = team[slot].pkmn.id;
            const pokemon = pkmn[pokemonId];
            if (!pokemon || !pokemon.playerHpMax) return;

            // In battle mode, ID is "explore-slot1-member" etc.
            const teamMemberEl = document.getElementById(`explore-${slot}-member`);
            if (!teamMemberEl) return;

            const levelSpan = teamMemberEl.querySelector('.explore-pkmn-level');
            if (!levelSpan) return;

            let hpSpan = document.getElementById(`pc-plus-team-hp-${slot}`);
            if (!hpSpan) {
                hpSpan = document.createElement('span');
                hpSpan.id = `pc-plus-team-hp-${slot}`;
                hpSpan.style.cssText = 'margin-left: 6px; font-size: 0.85em; font-weight: bold;';
                levelSpan.parentNode.insertBefore(hpSpan, levelSpan.nextSibling);
            }

            const hpText = formatHp(pokemon.playerHp, pokemon.playerHpMax);
            const hpColor = getHpColor(pokemon.playerHp, pokemon.playerHpMax);
            hpSpan.textContent = `(${hpText})`;
            hpSpan.style.color = hpColor;
        });
    }

    function removeHpDisplay() {
        const enemyHp = document.getElementById('pc-plus-enemy-hp');
        if (enemyHp) enemyHp.remove();

        const slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
        slots.forEach(slot => {
            const teamHp = document.getElementById(`pc-plus-team-hp-${slot}`);
            if (teamHp) teamHp.remove();
        });
    }

    function updateUI() {
        const statusDot = document.getElementById('af-status-dot');
        const clickCountEl = document.getElementById('af-click-count');
        const startBtn = document.getElementById('af-start-btn');
        const stopBtn = document.getElementById('af-stop-btn');

        if (statusDot) {
            statusDot.style.color = isRunning ? '#4caf50' : '#888';
            statusDot.textContent = isRunning ? '●' : '○';
        }
        if (clickCountEl) {
            clickCountEl.textContent = clickCount;
        }
        if (startBtn) {
            startBtn.style.display = isRunning ? 'none' : 'block';
        }
        if (stopBtn) {
            stopBtn.style.display = isRunning ? 'block' : 'none';
        }
    }

    function toggleSection(sectionId) {
        const content = document.getElementById(`section-${sectionId}-content`);
        const arrow = document.getElementById(`section-${sectionId}-arrow`);
        if (content.style.display === 'none') {
            content.style.display = 'block';
            arrow.textContent = '▼';
        } else {
            content.style.display = 'none';
            arrow.textContent = '▶';
        }
    }

    function createUI() {
        if (document.getElementById('pokechill-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'pokechill-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.95);
            color: #fff;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 999999;
            min-width: 250px;
            max-width: 350px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 2px solid #667eea;
        `;

        overlay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px; color: #667eea; text-align: center;">
                ⚡ Pokechill Plus
            </div>

            <div class="pc-section">
                <div class="pc-section-header" id="section-autofight-header">
                    <span id="section-autofight-arrow">▼</span>
                    <span>Auto-Fight</span>
                    <span id="af-status-dot" style="margin-left: auto;">○</span>
                </div>
                <div class="pc-section-content" id="section-autofight-content">
                    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <button id="af-start-btn" class="pc-btn pc-btn-green">▶ Start</button>
                        <button id="af-stop-btn" class="pc-btn pc-btn-red" style="display: none;">⏸ Stop</button>
                        <button id="af-reset-btn" class="pc-btn pc-btn-orange">↺</button>
                    </div>
                    <div style="margin-bottom: 10px; font-size: 12px;">
                        Clicks: <span id="af-click-count" style="color: #ffc107; font-weight: bold;">0</span>
                    </div>
                    <div style="border-top: 1px solid #444; padding-top: 10px;">
                        <div style="font-size: 12px; color: #667eea; margin-bottom: 6px;">📦 Collected Items</div>
                        <div id="af-item-list" class="pc-item-list">
                            <div style="color: #888; font-size: 11px; text-align: center;">No items collected</div>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                        <div style="font-size: 12px; color: #a78bfa; margin-bottom: 6px;">❖ IVs Gained</div>
                        <div id="af-iv-list" class="pc-item-list">
                            <div style="color: #888; font-size: 11px; text-align: center;">No IVs gained</div>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                        <div style="font-size: 12px; color: #f472b6; margin-bottom: 6px;">◇ Moves Learned</div>
                        <div id="af-move-list" class="pc-item-list">
                            <div style="color: #888; font-size: 11px; text-align: center;">No moves learned</div>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <div style="font-size: 12px; color: #69df96;">★ Ability Hunt</div>
                            <span id="af-ability-status" style="color: #888; font-size: 14px;">○</span>
                        </div>
                        <div style="margin-bottom: 8px; font-size: 11px;">
                            Pokemon: <span id="af-ability-pokemon" style="color: #888; font-weight: bold;">No Pokemon selected</span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <select id="af-ability-select" style="
                                width: 100%;
                                padding: 6px 8px;
                                border: 1px solid #444;
                                border-radius: 4px;
                                background: rgba(30,30,30,0.95);
                                color: #fff;
                                font-size: 11px;
                                outline: none;
                                cursor: pointer;
                            ">
                                <option value="">-- Select Pokemon first --</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                            <button id="af-ability-start" class="pc-btn pc-btn-green" style="font-size: 10px; padding: 5px;">▶ Hunt</button>
                            <button id="af-ability-stop" class="pc-btn pc-btn-red" style="display: none; font-size: 10px; padding: 5px;">⏸ Stop</button>
                        </div>
                        <div style="font-size: 10px; color: #888; margin-bottom: 6px;">Rolled Abilities:</div>
                        <div id="af-ability-log" class="pc-item-list" style="max-height: 80px;">
                            <div style="color: #888; font-size: 11px; text-align: center;">No abilities rolled</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pc-section">
                <div class="pc-section-header" id="section-display-header">
                    <span id="section-display-arrow">▼</span>
                    <span>Display Options</span>
                </div>
                <div class="pc-section-content" id="section-display-content">
                    <label class="pc-checkbox-label">
                        <input type="checkbox" id="af-hp-toggle">
                        <span>Show HP Values</span>
                    </label>
                </div>
            </div>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; font-size: 10px; color: #888; text-align: center;">
                Ctrl+Space: Toggle | Ctrl+D: Debug
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('af-start-btn').addEventListener('click', startAutoClick);
        document.getElementById('af-stop-btn').addEventListener('click', stopAutoClick);
        document.getElementById('af-reset-btn').addEventListener('click', resetAll);
        document.getElementById('af-hp-toggle').addEventListener('change', toggleHpDisplay);
        document.getElementById('af-ability-start').addEventListener('click', startAbilityHunt);
        document.getElementById('af-ability-stop').addEventListener('click', stopAbilityHunt);
        document.getElementById('section-autofight-header').addEventListener('click', () => toggleSection('autofight'));
        document.getElementById('section-display-header').addEventListener('click', () => toggleSection('display'));

        makeDraggable(overlay);

        const styles = `
            .pc-section { margin-bottom: 10px; }
            .pc-section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: rgba(102, 126, 234, 0.2);
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                font-size: 13px;
            }
            .pc-section-header:hover { background: rgba(102, 126, 234, 0.3); }
            .pc-section-content {
                padding: 10px;
                background: rgba(255,255,255,0.03);
                border-radius: 0 0 5px 5px;
            }
            .pc-btn {
                flex: 1;
                padding: 8px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
                color: white;
            }
            .pc-btn-green { background: #4caf50; }
            .pc-btn-green:hover { background: #45a049; }
            .pc-btn-red { background: #f44336; }
            .pc-btn-red:hover { background: #da190b; }
            .pc-btn-orange { background: #ff9800; }
            .pc-btn-orange:hover { background: #e68900; }
            .pc-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 12px;
            }
            .pc-checkbox-label input { cursor: pointer; width: 16px; height: 16px; }
            .pc-item-list {
                max-height: 120px;
                overflow-y: auto;
                background: rgba(255,255,255,0.05);
                padding: 8px;
                border-radius: 5px;
            }
            .pc-item-list::-webkit-scrollbar { width: 6px; }
            .pc-item-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); border-radius: 3px; }
            .pc-item-list::-webkit-scrollbar-thumb { background: #667eea; border-radius: 3px; }
            #af-status-dot { font-size: 14px; }
        `;
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);

        return overlay;
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (['BUTTON', 'SELECT', 'INPUT', 'OPTION'].includes(e.target.tagName)) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault();
            toggleAutoClick();
        }
        if (e.ctrlKey && e.code === 'KeyD') {
            e.preventDefault();
            toggleDebug();
        }
    });

    window.addEventListener('load', function() {
        createUI();
        setInterval(updateUI, 200);
        setInterval(checkTrainingPokemonChange, 500);
        setupItemObserver();
        setupTrainingObserver();
        log('⚡ Pokechill Plus loaded!');
        log('   Ctrl+Space: Start/stop');
        log('   Ctrl+D: Debug mode');
    });

})();