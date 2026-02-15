// ==UserScript==
// @name         ⚡ Pokechill Plus
// @namespace    http://tampermonkey.net/
// @version      1.12
// @description  Automatic clicking on Fight Again + Item Tracking
// @author       Teazy
// @match        https://play-pokechill.github.io/*
// @updateURL    https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus.user.js
// @downloadURL  https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus.user.js
// @icon         https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus-icon.png
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Sound URLs (hosted in repo)
    const GENERELL_SUCCESS_SOUND_URL = 'https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/sounds/success.mp3';
    const SHINY_SOUND_URL = GENERELL_SUCCESS_SOUND_URL;
    const ABILITY_SOUND_URL = GENERELL_SUCCESS_SOUND_URL;

    // LocalStorage Keys
    const STORAGE_KEYS = {
        SHINY_SOUND: 'pc-plus-shiny-sound',
        ABILITY_SOUND: 'pc-plus-ability-sound',
        TEAM_REMOVE_BTN: 'pc-plus-team-remove-btn',
        POKEMON_INFO: 'pc-plus-pokemon-info'
    };

    class Logger {
        constructor() {
            this.debugMode = false;
        }

        toggleDebug() {
            this.debugMode = !this.debugMode;
            this.log(`🐛 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        }

        log(...args) {
            if (this.debugMode) {
                console.log(...args);
            }
        }
    }

    function formatPokemonName(id) {
        if (typeof format === 'function') {
            return format(id);
        }
        return id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1');
    }

    class ItemTracker {
        constructor(logger, uiController) {
            this.logger = logger;
            this.uiController = uiController;
            this.itemStats = {};
            this.itemImages = {};
            this.observer = null;
        }

        reset() {
            this.itemStats = {};
            this.itemImages = {};
            this.uiController.updateItemDisplay(this.itemStats, this.itemImages);
        }

        start() {
            this.setupObserver();
        }

        setupObserver() {
            const endList = document.getElementById('area-end-item-list');
            if (!endList) {
                setTimeout(() => this.setupObserver(), 1000);
                return;
            }

            if (this.observer) this.observer.disconnect();

            this.logger.log('👀 Item Summary Observer started');
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'childList') {
                        m.addedNodes.forEach(node => {
                            if (node.nodeType === 1 && node.classList.contains('area-end-item')) {
                                this.processItemNode(node);
                            }
                        });
                    }
                });
            });

            this.observer.observe(endList, { childList: true });
        }

        processItemNode(node) {
            const itemId = node.getAttribute('data-item');
            const img = node.querySelector('img');
            const span = node.querySelector('span');

            if (itemId && span) {
                const count = parseInt(span.textContent.replace('+', '')) || 0;
                if (count > 0) {
                    this.itemStats[itemId] = (this.itemStats[itemId] || 0) + count;
                    if (img && img.src && !this.itemImages[itemId]) {
                        this.itemImages[itemId] = img.src;
                    }
                    this.logger.log(`➕ Item tracked: ${itemId} +${count}`);
                    this.uiController.updateItemDisplay(this.itemStats, this.itemImages);
                }
            }
        }
    }

    class PokemonTracker {
        constructor(logger, uiController) {
            this.logger = logger;
            this.uiController = uiController;
            this.pkmnStats = {};
            this.pkmnImages = {};
            this.observer = null;
            this.onShinyFound = null;
        }

        reset() {
            this.pkmnStats = {};
            this.pkmnImages = {};
            this.uiController.updatePokemonDisplay(this.pkmnStats, this.pkmnImages);
        }

        start() {
            this.setupObserver();
        }

        setupObserver() {
            const pkmnList = document.getElementById('area-end-pkmn-list');
            if (!pkmnList) {
                setTimeout(() => this.setupObserver(), 1000);
                return;
            }

            if (this.observer) this.observer.disconnect();

            this.logger.log('👀 Pokemon Summary Observer started');
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.type === 'childList') {
                        m.addedNodes.forEach(node => {
                            if (node.nodeType === 1 && node.getAttribute('data-pkmn-editor')) {
                                this.processPkmnNode(node);
                            }
                        });
                    }
                });
            });

            this.observer.observe(pkmnList, { childList: true });
        }

        processPkmnNode(node) {
            const pkmnId = node.getAttribute('data-pkmn-editor');
            const img = node.querySelector('img');
            const span = node.querySelector('span');
            const tag = span ? span.textContent.trim() : null;

            if (pkmnId) {
                if (!this.pkmnStats[pkmnId]) {
                    this.pkmnStats[pkmnId] = { count: 0, new: 0, shiny: 0, ivs: 0 };
                }

                this.pkmnStats[pkmnId].count++;

                if (tag === 'New!') this.pkmnStats[pkmnId].new++;
                else if (tag === '✦Shiny✦!' || tag?.includes('Shiny')) {
                    this.pkmnStats[pkmnId].shiny++;
                    if (this.onShinyFound) this.onShinyFound(pkmnId);
                }
                else if (tag === "Iv's Up!") this.pkmnStats[pkmnId].ivs++;

                if (img && img.src && !this.pkmnImages[pkmnId]) {
                    this.pkmnImages[pkmnId] = img.src;
                }

                this.logger.log(`🐾 Pokemon tracked: ${pkmnId} (${tag || 'Standard'})`);
                this.uiController.updatePokemonDisplay(this.pkmnStats, this.pkmnImages);
            }
        }
    }

    class TrainingMonitor {
        constructor(logger, uiController, abilityHunter) {
            this.logger = logger;
            this.uiController = uiController;
            this.abilityHunter = abilityHunter;
            this.ivStats = {};
            this.moveStats = {};
            this.observer = null;
        }

        reset() {
            this.ivStats = {};
            this.moveStats = {};
            this.uiController.updateIvDisplay(this.ivStats);
            this.uiController.updateMoveDisplay(this.moveStats);
        }

        start() {
            this.setupObserver();
        }

        setupObserver() {
            const areaEndTitle = document.getElementById('area-end-moves-title');
            if (!areaEndTitle) {
                setTimeout(() => this.setupObserver(), 1000);
                return;
            }

            if (this.observer) this.observer.disconnect();

            this.logger.log('👀 Training Observer started');
            this.observer = new MutationObserver(() => this.processMutations(areaEndTitle));
            this.observer.observe(areaEndTitle, { childList: true, subtree: true });
        }

        processMutations(container) {
            const spans = container.querySelectorAll('span');
            spans.forEach(span => {
                if (span.dataset.pcTracked) return;
                const text = span.textContent.trim();
                if (!text) return;

                span.dataset.pcTracked = 'true';

                if (text.includes(' learnt ')) this.trackMove(text);
                else if (text.startsWith('Increased')) this.trackIvs(text);
                else if (text.includes(' now has ')) this.trackAbility(text);
            });
        }

        trackMove(text) {
            const moveMatch = text.match(/(.+?)\s+(?:has\s+)?learnt\s+(.+)!/);
            if (moveMatch) {
                const pokemonName = moveMatch[1].trim();
                const moves = moveMatch[2].trim().split(/,\s*and\s+|,\s*|\s+and\s+/).map(m => m.trim()).filter(m => m.length > 0);

                if (!this.moveStats[pokemonName]) this.moveStats[pokemonName] = [];

                moves.forEach(moveName => {
                    if (!this.moveStats[pokemonName].includes(moveName)) {
                        this.moveStats[pokemonName].push(moveName);
                        this.logger.log(`🎯 Move tracked: ${pokemonName} learned ${moveName}`);
                    }
                });
                this.uiController.updateMoveDisplay(this.moveStats);
            }
        }

        trackIvs(text) {
            const statMatches = text.matchAll(/(\w+)\s+(\d+)\s+point/g);
            for (const match of statMatches) {
                const statName = match[1].toLowerCase();
                const points = parseInt(match[2]) || 1;

                const map = { hp: 'HP', atk: 'Attack', def: 'Defense', satk: 'Sp. Atk', sdef: 'Sp. Def', spe: 'Speed' };
                const stat = map[statName];

                if (stat) {
                    this.ivStats[stat] = (this.ivStats[stat] || 0) + points;
                    this.logger.log(`📈 IV tracked: ${stat} +${points}`);
                }
            }
            this.uiController.updateIvDisplay(this.ivStats);
        }

        trackAbility(text) {
            const abilityMatch = text.match(/(.+?)\s+now has\s+(.+)!/);
            if (abilityMatch) {
                const pokemonName = abilityMatch[1].trim();
                const abilityName = abilityMatch[2].trim();

                this.logger.log(`🎯 Ability tracked: ${pokemonName} got ${abilityName}`);
                this.abilityHunter.registerAbility(pokemonName, abilityName);
            }
        }
    }

    class AbilityHunter {
        constructor(logger, uiController) {
            this.logger = logger;
            this.uiController = uiController;
            this.enabled = false;
            this.targetAbility = '';
            this.abilityLog = [];
            this.lastTrainingPokemon = null;
            this.onTargetFound = null;
        }

        getAbilityRarity(abilityName) {
            if (typeof ability === 'undefined') return 1;
            const normName = abilityName.toLowerCase().replace(/\s+/g, '');
            for (const [key, ab] of Object.entries(ability)) {
                if (key.toLowerCase() === normName) return ab.rarity || 1;
            }
            return 1;
        }

        getAbilityColor(abilityName) {
            const rarity = this.getAbilityRarity(abilityName);
            switch (rarity) {
                case 1: return '#888';    // Common = gray
                case 2: return '#69df96'; // Uncommon = green
                case 3: return '#64b5f6'; // Rare = light blue
                default: return '#888';
            }
        }

        reset() {
            this.abilityLog = [];
            this.uiController.updateAbilityDisplay(this.abilityLog, this.targetAbility, this);
        }

        onTick() {
            if (typeof saved !== 'undefined' && typeof pkmn !== 'undefined') {
                const currentPokemon = saved.trainingPokemon;
                if (currentPokemon !== this.lastTrainingPokemon) {
                    this.lastTrainingPokemon = currentPokemon;
                    this.uiController.updateAbilitySelect(this.getTrainingPokemonName(), this.getAvailableAbilities());
                }
            }
        }

        startHunt(abilityName) {
            if (!abilityName) {
                this.logger.log('⚠️ Please select a target ability');
                return;
            }
            this.targetAbility = abilityName;
            this.enabled = true;
            this.uiController.updateAbilityHuntUI(this.enabled);
            this.logger.log(`🎯 Ability Hunt started for: ${this.targetAbility}`);
        }

        stopHunt() {
            this.enabled = false;
            this.targetAbility = '';
            this.uiController.updateAbilityHuntUI(this.enabled);
            this.logger.log('⏸️ Ability Hunt stopped');
        }

        registerAbility(pokemonName, abilityName) {
            this.abilityLog.unshift({ pokemon: pokemonName, ability: abilityName, time: new Date() });
            if (this.abilityLog.length > 50) this.abilityLog.pop();
            this.uiController.updateAbilityDisplay(this.abilityLog, this.targetAbility, this);

            if (this.enabled && this.targetAbility) {
                const normTarget = this.targetAbility.toLowerCase().replace(/\s+/g, '');
                const normAbility = abilityName.toLowerCase().replace(/\s+/g, '');

                if (normAbility === normTarget) {
                    this.logger.log(`🎉 Target ability "${abilityName}" found!`);
                    this.stopHunt();
                    if (this.onTargetFound) this.onTargetFound();
                    return true; // Signal target found
                }
            }
            return false;
        }

        hasReachedTarget() {
            if (!this.enabled || !this.targetAbility) return false;

            // Check game state directly - ability is set synchronously before the button appears
            if (typeof saved !== 'undefined' && typeof pkmn !== 'undefined' && saved.trainingPokemon) {
                const currentAbility = pkmn[saved.trainingPokemon].ability;
                if (currentAbility) {
                    const normTarget = this.targetAbility.toLowerCase().replace(/\s+/g, '');
                    const normCurrent = currentAbility.toLowerCase().replace(/\s+/g, '');

                    if (normCurrent === normTarget) {
                        this.logger.log(`🛑 Target ability "${currentAbility}" found (game state check), blocking click!`);
                        this.stopHunt();
                        if (this.onTargetFound) this.onTargetFound();
                        return true;
                    }
                }
            }
            return false;
        }

        getTrainingPokemonName() {
            if (typeof saved === 'undefined' || typeof pkmn === 'undefined') return null;
            if (!saved.trainingPokemon || !pkmn[saved.trainingPokemon]) return null;
            return formatPokemonName(saved.trainingPokemon);
        }

        getAvailableAbilities() {
            if (typeof ability === 'undefined' || typeof pkmn === 'undefined' || typeof saved === 'undefined') return [];

            const trainingPokemon = saved.trainingPokemon;
            if (!trainingPokemon || !pkmn[trainingPokemon]) return [];

            const pokemonTypes = pkmn[trainingPokemon].type || [];
            const currentAbility = pkmn[trainingPokemon].ability;
            const hiddenAbility = pkmn[trainingPokemon].hiddenAbility?.id;

            const availableAbilities = Object.keys(ability).filter(a => {
                const ab = ability[a];
                if (!ab.type) return false;
                if (a === hiddenAbility) return false;
                if (a === currentAbility) return false;
                return ab.type.includes("all") || ab.type.some(t => pokemonTypes.includes(t));
            });

            availableAbilities.sort((a, b) => {
                const rarityDiff = (ability[a].rarity || 1) - (ability[b].rarity || 1);
                if (rarityDiff !== 0) return rarityDiff;
                return a.localeCompare(b);
            });

            return availableAbilities;
        }
    }

    class ShinyHunter {
        constructor(logger, uiController) {
            this.logger = logger;
            this.uiController = uiController;
            this.enabled = false;
            this.targetPokemon = null;
            this.onTargetFound = null;
            this.lastArea = null;
        }

        onTick() {
            const currentAreaId = typeof saved !== 'undefined' ? (saved.currentAreaBuffer || saved.currentArea) : null;
            if (currentAreaId && currentAreaId !== this.lastArea) {
                this.lastArea = currentAreaId;
                this.uiController.updateShinySelect(this.getAvailablePokemon());
            }
        }

        startHunt(pokemonId) {
            if (!pokemonId) return;
            this.targetPokemon = pokemonId;
            this.enabled = true;
            this.uiController.updateShinyHuntUI(true, pokemonId);
            this.logger.log(`✨ Shiny Hunt started for: ${formatPokemonName(pokemonId)}`);
        }

        stopHunt() {
            this.enabled = false;
            this.targetPokemon = null;
            this.uiController.updateShinyHuntUI(false, null);
            this.logger.log('⏸️ Shiny Hunt stopped');
        }

        registerShiny(pkmnId) {
            const isTarget = this.targetPokemon && pkmnId.toLowerCase().replace(/\s+/g, '') === this.targetPokemon.toLowerCase().replace(/\s+/g, '');

            if (this.enabled && isTarget) {
                const pkmnName = formatPokemonName(pkmnId);
                this.logger.log(`🎉 Target Shiny "${pkmnName}" found via Tracker!`);
                this.stopHunt();
                if (this.onTargetFound) this.onTargetFound();
                return true;
            }
            return false;
        }

        hasFoundShiny() {
            if (!this.enabled || !this.targetPokemon) return false;

            // Direct game state check (Safety net)
            if (typeof pkmn !== 'undefined' && pkmn[this.targetPokemon]?.shiny) {
                this.logger.log(`🛑 Target Shiny ${this.targetPokemon} detected in game state!`);
                this.registerShiny(this.targetPokemon);
                return true;
            }
            return false;
        }

        getAvailablePokemon() {
            if (typeof areas === 'undefined' || typeof saved === 'undefined') return [];
            const areaId = saved.currentAreaBuffer || saved.currentArea;
            const area = areas[areaId];
            if (!area) return [];

            const p = new Set();
            if (area.spawns) {
                ['common', 'uncommon', 'rare'].forEach(r => {
                    if (area.spawns[r]) area.spawns[r].forEach(i => p.add(i.id || i));
                });
            }
            if (area.team) {
                Object.values(area.team).forEach(slot => { if (slot?.id) p.add(slot.id); });
            }
            return Array.from(p).sort();
        }
    }

    class HPDisplay {
        constructor(logger) {
            this.logger = logger;
            this.active = false;
            this.interval = null;
        }

        toggle(active) {
            this.active = active;
            if (this.active) {
                this.update();
                if (!this.interval) this.interval = setInterval(() => this.update(), 100);
            } else {
                if (this.interval) clearInterval(this.interval);
                this.interval = null;
                this.remove();
            }
        }

        remove() {
            const enemyHp = document.getElementById('pc-plus-enemy-hp');
            if (enemyHp) enemyHp.remove();
            ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slot => {
                const teamHp = document.getElementById(`pc-plus-team-hp-${slot}`);
                if (teamHp) teamHp.remove();
            });
        }

        update() {
            if (!this.active) return;
            try {
                this.updateEnemyHp();
                this.updateTeamHp();
            } catch (e) { } // Silent fail usually
        }

        updateEnemyHp() {
            const wildNameEl = document.getElementById('explore-wild-name');
            if (!wildNameEl) return;
            if (typeof wildPkmnHp === 'undefined' || typeof wildPkmnHpMax === 'undefined' || !wildPkmnHpMax) return;

            const levelSpan = wildNameEl.querySelector('.explore-pkmn-level');
            if (!levelSpan) return;

            let hpSpan = document.getElementById('pc-plus-enemy-hp');
            if (!hpSpan) {
                hpSpan = document.createElement('span');
                hpSpan.id = 'pc-plus-enemy-hp';
                hpSpan.style.cssText = 'margin-left: 8px; font-size: 0.9em; font-weight: bold;';
                levelSpan.parentNode.insertBefore(hpSpan, levelSpan.nextSibling);
            }

            hpSpan.textContent = `(${this.formatHp(wildPkmnHp, wildPkmnHpMax)})`;
            hpSpan.style.color = this.getHpColor(wildPkmnHp, wildPkmnHpMax);
        }

        updateTeamHp() {
            if (typeof pkmn === 'undefined' || typeof team === 'undefined') return;
            ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slot => {
                if (!team?.[slot]?.pkmn?.id) return;
                const p = pkmn[team[slot].pkmn.id];
                if (!p || !p.playerHpMax) return;

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

                hpSpan.textContent = `(${this.formatHp(p.playerHp, p.playerHpMax)})`;
                hpSpan.style.color = this.getHpColor(p.playerHp, p.playerHpMax);
            });
        }

        formatHp(cur, max) { return `${Math.round(cur)}/${Math.round(max)}`; }
        getHpColor(cur, max) {
            const p = (cur / max) * 100;
            if (p > 50) return '#4caf50';
            if (p > 25) return '#ffc107';
            return '#f44336';
        }
    }

    class GameSpeedController {
        constructor(logger) {
            this.logger = logger;
            this.currentSpeed = 1;
            this.defaultTimer = 2000;
        }

        getCurrentSpeedFromGame() {
            if (typeof saved === 'undefined' || !saved.overrideBattleTimer) {
                return 1;
            }
            const speed = this.defaultTimer / saved.overrideBattleTimer;
            // Round to nearest valid speed (1, 1.5, 2, 3, 4)
            const validSpeeds = [1, 1.5, 2, 3, 4];
            return validSpeeds.reduce((prev, curr) =>
                Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev
            );
        }

        setSpeed(multiplier) {
            if (typeof saved === 'undefined') {
                this.logger.log('⚠️ Game not ready, cannot change speed');
                return;
            }
            this.currentSpeed = multiplier;
            saved.overrideBattleTimer = this.defaultTimer / multiplier;
            this.logger.log(`⚡ Game speed set to ${multiplier}x`);
        }
    }

    class AutoBattler {
        constructor(logger, uiController, itemTracker, abilityHunter, shinyHunter) {
            this.logger = logger;
            this.uiController = uiController;
            this.itemTracker = itemTracker;
            this.abilityHunter = abilityHunter;
            this.shinyHunter = shinyHunter;

            this.isRunning = false;
            this.clickCount = 0;
            this.interval = null;
            this.lastButtonState = false;
            this.startTime = null;
            this.timerInterval = null;
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.startTime = Date.now();
            this.interval = setInterval(() => this.tick(), 250);
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            this.uiController.updateAutoFightStatus(true);
            this.updateTimer();
            this.logger.log('▶️ Auto-Fight started');
        }

        stop() {
            if (!this.isRunning) return;
            this.isRunning = false;
            if (this.interval) clearInterval(this.interval);
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.interval = null;
            this.timerInterval = null;
            this.lastButtonState = false;

            if (this.abilityHunter.enabled) {
                this.abilityHunter.stopHunt();
            }

            if (this.shinyHunter.enabled) {
                this.shinyHunter.stopHunt();
            }

            this.uiController.updateAutoFightStatus(false);
            this.logger.log('⏸️ Auto-Fight stopped');
        }

        toggle() {
            this.isRunning ? this.stop() : this.start();
        }

        reset() {
            this.clickCount = 0;
            this.startTime = this.isRunning ? Date.now() : null;
            this.uiController.updateClickCount(0);
            this.uiController.updateTimer('00:00:00');
        }

        updateTimer() {
            if (!this.startTime) return;
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            this.uiController.updateTimer(timeString);
        }

        findButton() {
            const btn = document.getElementById('area-rejoin');
            return (btn && btn.offsetParent !== null && !btn.disabled) ? btn : null;
        }

        tick() {
            const btn = this.findButton();
            const buttonExists = !!btn;

            if (!btn || this.lastButtonState) {
                this.lastButtonState = buttonExists;
                return;
            }

            if (this.abilityHunter.hasReachedTarget()) {
                this.logger.log('🎯 Ability Hunt: Target reached, stopping');
                this.abilityHunter.stopHunt();
                this.stop();
                this.lastButtonState = buttonExists;
                return;
            }

            // Shiny Hunt Check
            if (this.shinyHunter.hasFoundShiny()) {
                this.logger.log('✨ Shiny Hunt: Target found, stopping');
                this.shinyHunter.stopHunt();
                this.stop();
                this.lastButtonState = buttonExists;
                return;
            }

            this.logger.log('🎯 Click on Fight Again');
            btn.click();
            this.clickCount++;
            this.uiController.updateClickCount(this.clickCount);
            this.lastButtonState = buttonExists;
        }
    }

    class PopUpController {
        constructor(uiController) {
            this.uiController = uiController;
            this.popupWindow = null;
            this.isPopupMode = false;
        }

        openPopup() {
            if (this.popupWindow && !this.popupWindow.closed) {
                this.popupWindow.focus();
                return true;
            }

            this.popupWindow = window.open('', 'PokechillPlus', 'width=420,height=870,scrollbars=no,resizable=yes');
            if (!this.popupWindow) {
                alert('Pop-Up blocked! Please allow pop-ups for this site.');
                return false;
            }

            this.popupWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>⚡ Pokechill Plus</title>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            margin: 0;
                            padding: 10px;
                            background: #1a1a1a;
                            font-family: Arial, sans-serif;
                        }
                        * { box-sizing: border-box; }
                    </style>
                </head>
                <body></body>
                </html>
            `);
            this.popupWindow.document.close();

            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(style => {
                if (style.tagName === 'LINK') {
                    const newLink = this.popupWindow.document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = style.href;
                    this.popupWindow.document.head.appendChild(newLink);
                } else {
                    const newStyle = this.popupWindow.document.createElement('style');
                    newStyle.textContent = style.textContent;
                    this.popupWindow.document.head.appendChild(newStyle);
                }
            });

            const overlay = this.uiController.overlay;
            if (overlay) {
                this.originalOnMouseDown = overlay.onmousedown;

                overlay.onmousedown = null;

                overlay.style.position = 'relative';
                overlay.style.top = '0';
                overlay.style.right = 'auto';
                overlay.style.left = '0';
                overlay.style.margin = '0';
                overlay.style.maxHeight = 'none';

                this.popupWindow.document.body.appendChild(overlay);

                this.uiController.attachEventListeners();
            }

            this.popupWindow.addEventListener('beforeunload', () => {
                this.closePopup(true);
            });

            this.isPopupMode = true;
            return true;
        }

        closePopup(fromPopup = false) {
            if (!this.isPopupMode) return;

            const overlay = this.uiController.overlay;
            if (overlay) {
                overlay.style.position = 'fixed';
                overlay.style.top = '10px';
                overlay.style.right = '10px';
                overlay.style.left = 'auto';
                overlay.style.margin = '';
                overlay.style.maxHeight = '850px';

                this.uiController.makeDraggable(overlay);

                document.body.appendChild(overlay);

                this.uiController.attachEventListeners();
            }

            if (this.popupWindow && !this.popupWindow.closed) {
                this.popupWindow.close();
            }
            this.popupWindow = null;
            this.isPopupMode = false;

            if (fromPopup) {
                const checkbox = document.getElementById('af-popup-toggle');
                if (checkbox) checkbox.checked = false;
            }
        }

        toggle(enabled) {
            if (enabled) {
                return this.openPopup();
            } else {
                this.closePopup();
                return true;
            }
        }
    }

    class UIController {
        constructor() {
            this.overlay = null;
            this.callbacks = {
                onStart: () => { },
                onStop: () => { },
                onReset: () => { },
                onAbilityHuntStart: () => { },
                onAbilityHuntStop: () => { },
                onSpeedChange: () => { },
                onHpToggle: () => { },
                onTypeToggle: () => { },
                onPopupToggle: () => { },
                onShinySoundToggle: () => { },
                onAbilitySoundToggle: () => { },
                onPokemonInfoToggle: () => { }
            };
        }

        init(callbacks) {
            this.callbacks = callbacks;
            if (document.getElementById('pokechill-overlay')) return;
            this.createOverlay();
            this.attachEventListeners();
        }

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'pokechill-overlay';
            this.overlay.style.cssText = `
                position: fixed; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.95);
                color: #fff; padding: 15px; border-radius: 10px; font-family: Arial, sans-serif;
                font-size: 13px; z-index: 999999; min-width: 300px; max-width: 400px;
                max-height: 850px; overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 2px solid #667eea;
            `;

            this.overlay.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px; color: #667eea; text-align: center;">⚡ Pokechill Plus</div>
                ${this.renderSection('autofight', 'Auto-Fight', true)}
                ${this.renderSection('display', 'Display Options')}
                ${this.renderSection('sounds', 'Sounds')}
                ${this.renderSection('tweaks', 'Game Tweaks')}
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; font-size: 10px; color: #888; text-align: center;">Ctrl+Space: Toggle | Ctrl+D: Debug</div>
            `;

            document.body.appendChild(this.overlay);
            this.injectStyles();
            this.makeDraggable(this.overlay);

            // Populate Section Contents
            document.getElementById('section-autofight-content').innerHTML = `
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <button id="af-start-btn" class="pc-btn pc-btn-green">▶ Start</button>
                    <button id="af-stop-btn" class="pc-btn pc-btn-red" style="display: none;">⏸ Stop</button>
                    <button id="af-reset-btn" class="pc-btn pc-btn-orange">↺</button>
                </div>
                <div style="margin-bottom: 10px; font-size: 12px;">Clicks: <span id="af-click-count" style="color: #ffc107; font-weight: bold;">0</span></div>
                <div style="border-top: 1px solid #444; padding-top: 10px;">
                    <div style="font-size: 12px; color: #667eea; margin-bottom: 6px;">📦 Collected Items</div>
                    <div id="af-item-list" class="pc-item-list"><div class="empty-list">No items collected</div></div>
                </div>
                <!-- Pokemon -->
                <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                    <div style="font-size: 12px; color: #69df96; margin-bottom: 6px;">🐾 Gathered Pokemons</div>
                    <div id="af-pkmn-list" class="pc-item-list"><div class="empty-list">No pokemon gathered</div></div>
                </div>
                <!-- IVs -->
                <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                    <div style="font-size: 12px; color: #a78bfa; margin-bottom: 6px;">❖ IVs Gained</div>
                    <div id="af-iv-list" class="pc-item-list"><div class="empty-list">No IVs gained</div></div>
                </div>
                <!-- Moves -->
                <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                    <div style="font-size: 12px; color: #f472b6; margin-bottom: 6px;">◇ Moves Learned</div>
                    <div id="af-move-list" class="pc-item-list"><div class="empty-list">No moves learned</div></div>
                </div>
                <div style="border-top: 1px solid #444; padding-top: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <div style="font-size: 12px; color: #69df96;">★ Ability Hunt</div>
                        <span id="af-ability-status" style="color: #888; font-size: 14px;">○</span>
                    </div>
                    <div style="margin-bottom: 8px; font-size: 11px;">Pokemon: <span id="af-ability-pokemon" style="color: #888; font-weight: bold;">No Pokemon selected</span></div>
                     <div style="margin-bottom: 8px;">
                        <select id="af-ability-select" style="width: 100%; padding: 6px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
                            <option value="">-- Select Pokemon first --</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                        <button id="af-ability-start" class="pc-btn pc-btn-green" style="font-size: 10px; padding: 5px;">▶ Hunt</button>
                        <button id="af-ability-stop" class="pc-btn pc-btn-red" style="display: none; font-size: 10px; padding: 5px;">⏸ Stop</button>
                    </div>
                     <div style="font-size: 10px; color: #888; margin-bottom: 6px;">Rolled Abilities:</div>
                    <div id="af-ability-log" class="pc-item-list" style="max-height: 80px;"><div class="empty-list">No abilities rolled</div></div>
                </div>
                <!-- Shiny Hunt -->
                <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <div style="font-size: 12px; color: #ffc107;">✨ Shiny Hunt</div>
                        <span id="af-shiny-status" style="color: #888; font-size: 14px;">○</span>
                    </div>
                    <div style="margin-bottom: 8px; font-size: 11px;">Pokemon: <span id="af-shiny-pokemon" style="color: #888; font-weight: bold;">No Pokemon selected</span></div>
                    <div style="margin-bottom: 8px;">
                        <select id="af-shiny-select" style="width: 100%; padding: 6px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
                            <option value="">-- Select Pokemon --</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                        <button id="af-shiny-start" class="pc-btn pc-btn-green" style="font-size: 10px; padding: 5px;">▶ Hunt</button>
                        <button id="af-shiny-stop" class="pc-btn pc-btn-red" style="display: none; font-size: 10px; padding: 5px;">⏸ Stop</button>
                    </div>
                </div>
            `;

            document.getElementById('section-display-content').innerHTML = `
                <label class="pc-checkbox-label">
                    <input type="checkbox" id="af-hp-toggle">
                    <span>Show HP Values</span>
                </label>
                <label class="pc-checkbox-label" style="margin-top: 5px;">
                    <input type="checkbox" id="af-type-toggle">
                    <span>Show Type Effectiveness</span>
                </label>
                <label class="pc-checkbox-label" style="margin-top: 5px;">
                    <input type="checkbox" id="af-popup-toggle">
                    <span>Open in Pop-Up Window</span>
                </label>
                <label class="pc-checkbox-label" style="margin-top: 5px;">
                    <input type="checkbox" id="af-team-remove-toggle">
                    <span>Show Team Remove Button</span>
                </label>
                <label class="pc-checkbox-label" style="margin-top: 5px;">
                    <input type="checkbox" id="af-pokemon-info-toggle" checked>
                    <span>Show Pokemon Info Buttons</span>
                </label>
            `;

            document.getElementById('section-sounds-content').innerHTML = `
                <label class="pc-checkbox-label">
                    <input type="checkbox" id="af-shiny-sound-toggle">
                    <span>Notify on Shiny</span>
                </label>
                <label class="pc-checkbox-label" style="margin-top: 5px;">
                    <input type="checkbox" id="af-ability-sound-toggle">
                    <span>Notify on Target Ability</span>
                </label>
            `;

            document.getElementById('section-tweaks-content').innerHTML = `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; color: #ccc;">Speed</span>
                        <span id="af-speed-indicator" style="color: #667eea; font-size: 11px;">1x</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        ${[1, 1.5, 2, 3, 4].map(s => `<button id="af-speed-${s}" class="pc-speed-btn" data-speed="${s}">${s}x</button>`).join('')}
                    </div>
                </div>
            `;
        }

        renderSection(id, title, open = false) {
            return `
            <div class="pc-section">
                <div class="pc-section-header" id="section-${id}-header">
                    <span id="section-${id}-arrow">${open ? '▼' : '▶'}</span>
                    <span>${title}</span>
                    ${id === 'autofight' ? '<div style="margin-left: auto; display: flex; align-items: center; gap: 8px;"><span id="af-timer" style="display: none; font-size: 11px; color: #888; font-family: monospace;">00:00:00</span><span id="af-status-dot">○</span></div>' : ''}
                </div>
                <div class="pc-section-content" id="section-${id}-content" style="display: ${open ? 'block' : 'none'};"></div>
            </div>`;
        }

        attachEventListeners() {
            if (this.overlayClickHandler) {
                this.overlay.removeEventListener('click', this.overlayClickHandler);
            }

            this.overlayClickHandler = (e) => {
                const target = e.target;

                if (target.id === 'af-start-btn') this.callbacks.onStart();
                else if (target.id === 'af-stop-btn') this.callbacks.onStop();
                else if (target.id === 'af-reset-btn') this.callbacks.onReset();
                else if (target.id === 'af-ability-start') {
                    const select = this.overlay.querySelector('#af-ability-select');
                    this.callbacks.onAbilityHuntStart(select?.value);
                }
                else if (target.id === 'af-ability-stop') this.callbacks.onAbilityHuntStop();

                else if (target.id === 'af-shiny-start') {
                    const select = this.overlay.querySelector('#af-shiny-select');
                    this.callbacks.onShinyHuntStart(select?.value);
                }
                else if (target.id === 'af-shiny-stop') this.callbacks.onShinyHuntStop();

                else if (target.classList.contains('pc-speed-btn')) {
                    const speed = parseFloat(target.dataset.speed);
                    this.callbacks.onSpeedChange(speed);
                    this.updateSpeedUI(speed);
                }

                else if (target.classList.contains('pc-section-header') || target.closest('.pc-section-header')) {
                    const header = target.classList.contains('pc-section-header') ? target : target.closest('.pc-section-header');
                    const id = header.id.replace('section-', '').replace('-header', '');
                    this.toggleSection(id);
                }
            };

            this.overlay.addEventListener('click', this.overlayClickHandler);

            if (this.overlayChangeHandler) {
                this.overlay.removeEventListener('change', this.overlayChangeHandler);
            }

            this.overlayChangeHandler = (e) => {
                const target = e.target;
                if (target.id === 'af-hp-toggle') this.callbacks.onHpToggle(target.checked);
                else if (target.id === 'af-type-toggle') this.callbacks.onTypeToggle(target.checked);
                else if (target.id === 'af-popup-toggle') this.callbacks.onPopupToggle(target.checked);
                else if (target.id === 'af-team-remove-toggle') this.callbacks.onTeamRemoveToggle(target.checked);
                else if (target.id === 'af-shiny-sound-toggle') this.callbacks.onShinySoundToggle(target.checked);
                else if (target.id === 'af-ability-sound-toggle') this.callbacks.onAbilitySoundToggle(target.checked);
                else if (target.id === 'af-pokemon-info-toggle') this.callbacks.onPokemonInfoToggle(target.checked);
            };

            this.overlay.addEventListener('change', this.overlayChangeHandler);

            this.updateSpeedUI(1);
        }

        updateAutoFightStatus(isRunning) {
            const dot = this.overlay.querySelector('#af-status-dot');
            const timer = this.overlay.querySelector('#af-timer');
            const startBtn = this.overlay.querySelector('#af-start-btn');
            const stopBtn = this.overlay.querySelector('#af-stop-btn');
            if (dot) { dot.style.color = isRunning ? '#4caf50' : '#888'; dot.textContent = isRunning ? '●' : '○'; }
            if (timer) {
                timer.style.color = isRunning ? '#4caf50' : '#888';
                timer.style.display = isRunning ? 'inline' : 'none';
            }
            if (startBtn) startBtn.style.display = isRunning ? 'none' : 'block';
            if (stopBtn) stopBtn.style.display = isRunning ? 'block' : 'none';
        }

        updateTimer(timeString) {
            const timer = this.overlay.querySelector('#af-timer');
            if (timer) timer.textContent = timeString;
        }

        updateClickCount(count) {
            const el = this.overlay.querySelector('#af-click-count');
            if (el) el.textContent = count;
        }

        updateItemDisplay(stats, images) {
            const list = this.overlay.querySelector('#af-item-list');
            if (!list) return;
            const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) { list.innerHTML = '<div class="empty-list">No items collected</div>'; return; }
            list.innerHTML = sorted.map(([name, count]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 11px;">
                    <span style="color: #fff; display: flex; align-items: center;">${images[name] ? `<img src="${images[name]}" style="width:20px;height:20px;margin-right:6px;">` : ''}${name}</span>
                    <span style="color: #ffc107; font-weight: bold;">x${count}</span>
                </div>
             `).join('');
        }

        updatePokemonDisplay(stats, images) {
            const list = this.overlay.querySelector('#af-pkmn-list');
            if (!list) return;
            const sorted = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
            if (sorted.length === 0) { list.innerHTML = '<div class="empty-list">No pokemon gathered</div>'; return; }

            list.innerHTML = sorted.map(([id, data]) => {
                const tags = [];
                if (data.new > 0) tags.push(`<span style="color:#69df96; font-size:9px;">NEW! x${data.new}</span>`);
                if (data.shiny > 0) tags.push(`<span style="color:#ffc107; font-size:9px;">SHINY! x${data.shiny}</span>`);
                if (data.ivs > 0) tags.push(`<span style="color:#a78bfa; font-size:9px;">IVs UP! x${data.ivs}</span>`);

                const name = formatPokemonName(id);

                return `
                <div style="margin: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                        <span style="color: #fff; display: flex; align-items: center;">
                            ${images[id] ? `<img src="${images[id]}" style="width:24px;height:24px;margin-right:6px;filter:drop-shadow(0 0 2px rgba(0,0,0,0.5));">` : ''}${name}
                        </span>
                        <span style="color: #69df96; font-weight: bold;">x${data.count}</span>
                    </div>
                    ${tags.length > 0 ? `<div style="display: flex; gap: 6px; margin-top: 2px; margin-left: 30px;">${tags.join('')}</div>` : ''}
                </div>`;
            }).join('');
        }

        updateIvDisplay(stats) {
            const list = this.overlay.querySelector('#af-iv-list');
            if (!list) return;
            const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) { list.innerHTML = '<div class="empty-list">No IVs gained</div>'; return; }
            list.innerHTML = sorted.map(([stat, count]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 11px;">
                    <span style="color: #fff;">❖ ${stat}</span>
                    <span style="color: #a78bfa; font-weight: bold;">x${count}</span>
                </div>
             `).join('');
        }

        updateMoveDisplay(stats) {
            const list = this.overlay.querySelector('#af-move-list');
            if (!list) return;
            const sorted = Object.keys(stats).sort((a, b) => stats[b].length - stats[a].length);
            if (sorted.length === 0) { list.innerHTML = '<div class="empty-list">No moves learned</div>'; return; }
            list.innerHTML = sorted.map(pokemon => `
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 11px; font-weight: bold; color: #f472b6;">◇ ${pokemon} <span style="color:#888;">(${stats[pokemon].length})</span></div>
                    ${stats[pokemon].map(m => `<div style="margin: 2px 0 2px 12px; font-size: 10px; color: #ccc;">- ${m}</div>`).join('')}
                </div>
             `).join('');
        }

        updateAbilityHuntUI(enabled) {
            const startBtn = this.overlay.querySelector('#af-ability-start');
            const stopBtn = this.overlay.querySelector('#af-ability-stop');
            const statusDot = this.overlay.querySelector('#af-ability-status');
            const select = this.overlay.querySelector('#af-ability-select');
            if (startBtn) startBtn.style.display = enabled ? 'none' : 'block';
            if (stopBtn) stopBtn.style.display = enabled ? 'block' : 'none';
            if (statusDot) { statusDot.style.color = enabled ? '#4caf50' : '#888'; statusDot.textContent = enabled ? '●' : '○'; }
            if (select) select.disabled = enabled;
        }

        updateAbilityDisplay(log, target, hunter) {
            const list = this.overlay.querySelector('#af-ability-log');
            if (!list) return;
            if (log.length === 0) { list.innerHTML = '<div class="empty-list">No abilities rolled</div>'; return; }

            const normTarget = target ? target.toLowerCase().replace(/\s+/g, '') : '';
            list.innerHTML = log.slice(0, 20).map(entry => {
                const normAbility = entry.ability.toLowerCase().replace(/\s+/g, '');
                const isTarget = normTarget && normAbility === normTarget;
                const color = hunter ? hunter.getAbilityColor(entry.ability) : '#888';
                const targetStyle = isTarget ? 'font-weight: bold; text-shadow: 0 0 5px currentColor; filter: brightness(1.2);' : '';
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 10px;">
                    <span style="color: #ccc;">${entry.pokemon}</span>
                    <span style="color: ${color}; ${targetStyle}">${entry.ability}</span>
                </div>`;
            }).join('');
        }

        updateAbilitySelect(pokemonName, abilities) {
            const select = this.overlay.querySelector('#af-ability-select');
            const label = this.overlay.querySelector('#af-ability-pokemon');
            if (!select) return;

            if (label) {
                label.textContent = pokemonName || 'No Pokemon selected';
                label.style.color = pokemonName ? '#69df96' : '#888';
            }

            if (abilities.length === 0) {
                select.innerHTML = '<option value="">-- Select Pokemon first --</option>';
                return;
            }

            let html = '<option value="">-- Select Ability --</option>';
            [1, 2, 3].forEach(tier => {
                const tierAbilities = abilities.filter(a => (typeof ability !== 'undefined' && ability[a].rarity || 1) === tier);
                if (tierAbilities.length > 0) {
                    const label = tier === 1 ? 'Common' : (tier === 2 ? 'Uncommon' : 'Rare');
                    html += `<optgroup label="${label}">`;
                    tierAbilities.forEach(a => {
                        const name = formatPokemonName(a);
                        html += `<option value="${a}">${name}</option>`;
                    });
                    html += `</optgroup>`;
                }
            });
            select.innerHTML = html;
        }

        updateShinyHuntUI(enabled, pokemonName) {
            const startBtn = this.overlay.querySelector('#af-shiny-start');
            const stopBtn = this.overlay.querySelector('#af-shiny-stop');
            const statusDot = this.overlay.querySelector('#af-shiny-status');
            const select = this.overlay.querySelector('#af-shiny-select');
            const label = this.overlay.querySelector('#af-shiny-pokemon');

            if (startBtn) startBtn.style.display = enabled ? 'none' : 'block';
            if (stopBtn) stopBtn.style.display = enabled ? 'block' : 'none';
            if (statusDot) {
                statusDot.style.color = enabled ? '#ffc107' : '#888';
                statusDot.textContent = enabled ? '●' : '○';
            }
            if (select) select.disabled = enabled;
            if (label) {
                label.textContent = pokemonName ? formatPokemonName(pokemonName) : 'No Pokemon selected';
                label.style.color = pokemonName ? '#ffc107' : '#888';
            }
        }

        updateShinySelect(availablePokemon) {
            const select = this.overlay.querySelector('#af-shiny-select');
            if (!select) return;

            let html = '<option value="">-- Select Pokemon --</option>';
            availablePokemon.forEach(pkmnId => {
                const name = formatPokemonName(pkmnId);
                html += `<option value="${pkmnId}">${name}</option>`;
            });
            select.innerHTML = html;
        }

        updateSpeedUI(currentSpeed) {
            this.overlay.querySelectorAll('.pc-speed-btn').forEach(btn => {
                btn.classList.toggle('active', parseFloat(btn.dataset.speed) === currentSpeed);
                btn.style.background = parseFloat(btn.dataset.speed) === currentSpeed ? '#667eea' : 'rgba(255,255,255,0.1)';
                btn.style.color = parseFloat(btn.dataset.speed) === currentSpeed ? '#fff' : '#ccc';
            });
            const ind = this.overlay.querySelector('#af-speed-indicator');
            if (ind) { ind.textContent = `${currentSpeed}x`; ind.style.color = currentSpeed > 1 ? '#4caf50' : '#667eea'; }
        }

        toggleSection(id) {
            const content = this.overlay.querySelector(`#section-${id}-content`);
            const arrow = this.overlay.querySelector(`#section-${id}-arrow`);
            if (content && arrow) {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    arrow.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    arrow.textContent = '▶';
                }
            }
        }

        injectStyles() {
            const css = `
                .pc-section { margin-bottom: 10px; }
                .pc-section-header { display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(102, 126, 234, 0.2); border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 13px; }
                .pc-section-header:hover { background: rgba(102, 126, 234, 0.3); }
                .pc-section-content { padding: 10px; background: rgba(255,255,255,0.03); border-radius: 0 0 5px 5px; }
                .pc-btn { flex: 1; padding: 8px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px; color: white; }
                .pc-btn-green { background: #4caf50; } .pc-btn-green:hover { background: #45a049; }
                .pc-btn-red { background: #f44336; } .pc-btn-red:hover { background: #da190b; }
                .pc-btn-orange { background: #ff9800; } .pc-btn-orange:hover { background: #e68900; }
                .pc-item-list { max-height: 120px; overflow-y: auto; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 5px; }
                .pc-item-list::-webkit-scrollbar { width: 6px; }
                .pc-item-list::-webkit-scrollbar-thumb { background: #667eea; border-radius: 3px; }
                #pokechill-overlay::-webkit-scrollbar { width: 8px; }
                #pokechill-overlay::-webkit-scrollbar-thumb { background: #667eea; border-radius: 4px; }
                #pokechill-overlay::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
                .empty-list { color: #888; font-size: 11px; text-align: center; }
                .pc-speed-btn { flex: 1; padding: 6px 4px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: all 0.2s; }
                .pc-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
                
                /* Remove Button Styles */
                .pc-remove-btn {
                    position: absolute;
                    left: 75px; /* Default fallback */
                    top: 6px;
                    width: 24px;
                    height: 24px;
                    background: rgb(255, 81, 81);
                    color: white;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    z-index: 1000;
                    border: 1px solid rgba(0,0,0,0.4);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                    transition: filter 0.1s, transform 0.1s;
                    user-select: none;
                    pointer-events: auto !important;
                }
                .pc-remove-btn:hover {
                    filter: brightness(1.1);
                    transform: scale(1.05);
                }
                .pc-remove-btn:active {
                    transform: scale(0.95);
                    filter: brightness(0.9);
                }
                .pc-clear-team-btn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgb(255, 81, 81);
                    color: white;
                    border-radius: 4px;
                    font-size: 16px;
                    cursor: pointer;
                    border: 1px solid rgba(0,0,0,0.4);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                    transition: filter 0.1s, transform 0.1s;
                    user-select: none;
                    margin-left: 10px;
                }
                .pc-clear-team-btn:hover { filter: brightness(1.1); transform: scale(1.05); }
                .pc-clear-team-btn:active { transform: scale(0.95); }
            `;
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        }

        makeDraggable(elm) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            elm.onmousedown = (e) => {
                if (['BUTTON', 'SELECT', 'INPUT', 'OPTION'].includes(e.target.tagName)) return;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
                document.onmousemove = (e) => {
                    e.preventDefault();
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    elm.style.top = (elm.offsetTop - pos2) + "px";
                    elm.style.left = (elm.offsetLeft - pos1) + "px";
                    elm.style.right = 'auto'; // Reset right if sticking
                };
            };
        }
    }

    class MoveEffectivenessDisplay {
        constructor(logger) {
            this.logger = logger;
            this.active = false;
            this.observer = null;
            this.interval = null;
        }

        toggle(active) {
            this.active = active;
            if (this.active) {
                this.start();
            } else {
                this.stop();
            }
        }

        start() {
            if (this.observer) return;
            this.logger.log('🛡️ Type Effectiveness Display started');

            this.observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                for (const m of mutations) {
                    if (m.target.classList && m.target.classList.contains('pc-type-indicator')) continue;
                    if (m.target.closest && m.target.closest('.pc-type-indicator')) continue;

                    if (m.type === 'childList') {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === 1 && !node.classList.contains('pc-type-indicator') && !node.querySelector('.pc-type-indicator')) {
                                shouldUpdate = true;
                                break;
                            }
                        }
                    }
                    else if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                        if (!m.target.classList.contains('pc-type-indicator')) {
                            shouldUpdate = true;
                        }
                    }

                    if (shouldUpdate) break;
                }
                if (shouldUpdate) this.updateEffectiveness();
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'data-move']
            });

            this.interval = setInterval(() => this.updateEffectiveness(), 1000);

            this.updateEffectiveness();
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }

            document.querySelectorAll('.pc-type-indicator').forEach(el => el.remove());
        }

        updateEffectiveness() {
            if (!this.active) return;

            if (typeof typeEffectiveness === 'undefined' || typeof saved === 'undefined' || typeof pkmn === 'undefined' || typeof move === 'undefined') {
                return;
            }

            const currentOpponentId = saved.currentPkmn;
            if (!currentOpponentId || !pkmn[currentOpponentId]) return;

            const opponentTypes = pkmn[currentOpponentId].type; // Expecting array e.g. ["fire", "flying"]
            if (!opponentTypes) return;

            document.querySelectorAll('.pkmn-movebox').forEach(box => {
                if (!box.id.includes('team')) return;

                const moveId = box.dataset.move;
                if (!moveId || !move[moveId]) return;

                const moveType = move[moveId].type;
                if (!moveType) return;

                let effectiveness = typeEffectiveness(moveType, opponentTypes);
                if (effectiveness === undefined || effectiveness === null) effectiveness = 1;

                this.appendIndicator(box, effectiveness);
            });
        }

        appendIndicator(box, multiplier) {
            let indicator = box.querySelector('.pc-type-indicator');
            const typeImg = box.querySelector('img');

            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'pc-type-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    right: 2.2rem;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 4px;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.8);
                    z-index: 3;
                    white-space: nowrap;
                    line-height: normal;
                `;

                if (typeImg) {
                    box.insertBefore(indicator, typeImg);
                } else {
                    box.appendChild(indicator);
                }
            } else {
                if (typeImg && indicator.nextSibling !== typeImg) {
                    box.insertBefore(indicator, typeImg);
                }
                indicator.style.position = 'absolute';
                indicator.style.right = '2.2rem';
                indicator.style.top = '50%';
                indicator.style.transform = 'translateY(-50%)';
                indicator.style.marginLeft = '';
            }

            if (multiplier > 1.0) {
                indicator.textContent = `▲ x${multiplier}`;
                indicator.style.color = '#4caf50'; // Green
                indicator.style.display = 'inline-block';
            } else if (multiplier == 0) {
                indicator.textContent = `x0`;
                indicator.style.color = '#9e9e9e'; // Grey
                indicator.style.display = 'inline-block';
            } else if (multiplier < 1.0) {
                indicator.textContent = `▼ x${multiplier}`;
                indicator.style.color = '#f44336'; // Red
                indicator.style.display = 'inline-block';
            } else {
                indicator.textContent = `▬ x${multiplier}`;
                indicator.style.color = '#ffffff'; // White
                indicator.style.display = 'inline-block';
            }
        }
    }

    class TeamUIEnhancer {
        constructor(logger) {
            this.logger = logger;
            this.observer = null;
            this.resizeObserver = null;
            this.active = true;
        }

        toggle(enabled) {
            this.active = enabled;
            if (enabled) {
                this.start();
            } else {
                this.stop();
            }
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            document.querySelectorAll('.pc-remove-btn').forEach(btn => btn.remove());
            document.querySelectorAll('.pc-clear-team-btn').forEach(btn => btn.remove());
        }

        start() {
            if (this.observer) return;

            const teamPreview = document.getElementById('team-preview');
            if (!teamPreview) {
                setTimeout(() => this.start(), 1000);
                return;
            }

            this.logger.log('🛠️ Team UI Enhancer started');

            this.observer = new MutationObserver(() => this.injectRemoveButtons());
            this.observer.observe(teamPreview, { childList: true, subtree: true });

            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    this.updateButtonPosition(entry.target);
                }
            });

            this.injectRemoveButtons();
        }

        updateButtonPosition(slot) {
            const infobox = slot.querySelector('.explore-header-infobox');
            const removeBtn = slot.querySelector('.pc-remove-btn');
            if (infobox && removeBtn) {
                const offset = 28;
                removeBtn.style.left = (infobox.offsetLeft - offset) + 'px';
            }
        }

        injectRemoveButtons() {
            if (!this.active) return;

            this.injectClearButton();

            const teamPreview = document.getElementById('team-preview');
            if (!teamPreview) return;

            const slots = teamPreview.querySelectorAll('.explore-team-member');
            slots.forEach(slot => {
                const slotId = slot.id.replace('explore-', '').replace('-member', '');

                const spriteData = slot.querySelector('.explore-sprite');
                const isOccupied = spriteData && spriteData.dataset.pkmnEditor;

                if (isOccupied) {
                    if (!slot.querySelector('.pc-remove-btn')) {
                        const removeBtn = document.createElement('div');
                        removeBtn.className = 'pc-remove-btn';
                        removeBtn.innerHTML = '✕';
                        removeBtn.title = 'Remove Pokemon';

                        slot.style.position = 'relative';

                        removeBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.removePokemon(slotId);
                        }, true);

                        slot.appendChild(removeBtn);

                        if (this.resizeObserver) {
                            this.resizeObserver.observe(slot);
                        }
                    }
                    this.updateButtonPosition(slot);
                }
            });
        }

        injectClearButton() {
            if (!this.active) return;

            const selectorBar = document.querySelector('.team-menu-selector-new');
            if (selectorBar && !selectorBar.querySelector('.pc-clear-team-btn')) {
                const clearBtn = document.createElement('div');
                clearBtn.className = 'pc-clear-team-btn';
                clearBtn.innerHTML = '🗑️';
                clearBtn.title = 'Clear Full Team';

                clearBtn.addEventListener('click', (e) => {
                    if (confirm('Are you sure you want to clear the entire team?')) {
                        this.clearFullTeam();
                    }
                });

                selectorBar.appendChild(clearBtn);
            }
        }

        clearFullTeam() {
            if (typeof saved === 'undefined' || !saved.previewTeams || !saved.currentPreviewTeam) return;

            this.logger.log('🗑️ Clearing full team');

            const currentTeam = saved.previewTeams[saved.currentPreviewTeam];
            if (currentTeam) {
                Object.keys(currentTeam).forEach(key => {
                    if (key !== 'name' && currentTeam[key]) {
                        currentTeam[key].pkmn = undefined;
                        currentTeam[key].item = undefined;
                    }
                });

                // Trigger the game's native update function
                if (typeof updatePreviewTeam === 'function') {
                    updatePreviewTeam();
                }
            }
        }

        removePokemon(slotId) {
            if (typeof saved === 'undefined' || !saved.previewTeams || !saved.currentPreviewTeam) return;

            this.logger.log(`🗑️ Removing Pokemon from slot: ${slotId}`);

            const currentTeam = saved.previewTeams[saved.currentPreviewTeam];
            if (currentTeam && currentTeam[slotId]) {
                currentTeam[slotId].pkmn = undefined;
                currentTeam[slotId].item = undefined;

                if (typeof updatePreviewTeam === 'function') {
                    updatePreviewTeam();
                }
            }
        }
    }


    class PokemonInfoController {
        constructor(logger) {
            this.logger = logger;
            this.active = true;
            this.observer = null;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById('pc-info-styles')) return;
            const style = document.createElement('style');
            style.id = 'pc-info-styles';
            style.textContent = `
                .pc-info-icon {
                    position: absolute;
                    right: 4px;
                    top: 4px;
                    cursor: pointer;
                    font-size: 1.2em;
                    color: #d1d5db; /* Light gray */
                    transition: color 0.2s, transform 0.2s;
                    user-select: none;
                    z-index: 10000 !important;
                    pointer-events: auto !important;
                }
                .pc-info-icon:hover {
                    color: #58a6ff;
                    transform: scale(1.1);
                }
                .explore-header-hpbox {
                    position: relative;
                    pointer-events: auto !important;
                    z-index: 10;
                }
                .pkmn-info-popup {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 5px;
                    background: rgba(26, 26, 26, 0.95);
                    backdrop-filter: blur(5px);
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 8px 12px;
                    z-index: 10000;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    max-width: 300px;
                    width: max-content;
                    color: #fff;
                    font-size: 0.9rem;
                    text-align: left;
                    animation: pcFadeIn 0.2s ease-out;
                }
                @keyframes pcFadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .pkmn-info-popup-title {
                    font-weight: bold;
                    color: #58a6ff;
                    margin-bottom: 4px;
                    border-bottom: 1px solid #444;
                    padding-bottom: 4px;
                    font-size: 1rem;
                }
                .pkmn-info-popup-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0;
                    font-size: 0.85rem;
                }
                .pkmn-info-popup-val {
                    font-weight: bold;
                    color: #e2e8f0;
                }
            `;
            document.head.appendChild(style);
        }

        start() {
            this.active = true;
            this.setupObserver();
            this.injectIcons();

            // Close popups when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.pkmn-info-popup') && !e.target.closest('.pc-info-icon')) {
                    this.removePopups();
                }
            });
        }

        stop() {
            this.active = false;
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.removeIcons();
            this.removePopups();
        }

        setupObserver() {
            if (this.observer) return;

            this.observer = new MutationObserver((mutations) => {
                if (!this.active) return;

                let shouldInject = false;
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        shouldInject = true;
                        break;
                    }
                }

                if (shouldInject) {
                    this.injectIcons();
                }
            });

            const target = document.body;
            if (target) {
                this.observer.observe(target, { childList: true, subtree: true });
            }
        }

        injectIcons() {
            if (!this.active) return;

            const hpBoxes = document.querySelectorAll('.explore-header-hpbox');

            hpBoxes.forEach(box => {
                if (box.querySelector('.pc-info-icon')) return;
                if (box.querySelector('#explore-wild-name')) return;

                const infoIcon = document.createElement('span');
                infoIcon.className = 'pc-info-icon';
                infoIcon.innerHTML = 'ⓘ';
                infoIcon.title = 'Battle Fatigue Info';

                infoIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.logger.log('PokechillPlus: Clicked info icon', box.id, box);
                    this.togglePokemonInfo(box, null, infoIcon);
                });

                box.appendChild(infoIcon);
            });

            const battleSlots = document.querySelectorAll('[id^="team-indicator-slot-"]');
            battleSlots.forEach(img => {
                if (img.getAttribute('data-pc-info-bound')) return;
                img.setAttribute('data-pc-info-bound', 'true');

                img.style.cursor = 'help';
                img.style.pointerEvents = 'auto';
                img.style.zIndex = '100';
                img.style.position = 'relative';

                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const match = img.id.match(/slot-(\d+)/);
                    if (match) {
                        const slotId = 'slot' + match[1];
                        this.togglePokemonInfo(img.parentElement, slotId, img);
                    }
                });
            });
        }

        removeIcons() {
            document.querySelectorAll('.pc-info-icon').forEach(icon => icon.remove());
        }

        removePopups() {
            document.querySelectorAll('.pkmn-info-popup').forEach(p => p.remove());
        }

        calculateBattleFatigue(pkmnData) {
            if (!pkmnData || !pkmnData.bst || !pkmnData.ivs) return 0;

            // Formula: 100 + (hp*30 * 1.15^ivH) + (def*15 * 1.15^ivD) + (sdef*15 * 1.15^ivS)
            const hpPart = pkmnData.bst.hp * 30 * Math.pow(1.15, pkmnData.ivs.hp);
            const defPart = pkmnData.bst.def * 15 * Math.pow(1.15, pkmnData.ivs.def);
            const sdefPart = pkmnData.bst.sdef * 15 * Math.pow(1.15, pkmnData.ivs.sdef);

            return Math.floor(100 + hpPart + defPart + sdefPart);
        }

        togglePokemonInfo(ContainerOrBox, passedSlotId = null, targetElement = null) {
            const existing = document.querySelectorAll('.pkmn-info-popup');
            existing.forEach(el => el.remove());

            let slotId = passedSlotId;

            if (!slotId) {
                let parent = ContainerOrBox.closest('[id^="explore-"][id$="-member"]');
                if (parent) {
                    const match = parent.id.match(/explore-(?:slot)?(\d+)-member/);
                    if (match) {
                        slotId = 'slot' + match[1];
                        this.logger.log('PokechillPlus: Resolved slotId', slotId, 'from', parent.id);
                    }
                }
            }

            if (!slotId) {
                let parent = ContainerOrBox.closest('[data-slot^="slot"]');
                if (parent) slotId = parent.dataset.slot;
            }

            let pokemonData = null;
            let pId = null;

            if (typeof team !== 'undefined' && team[slotId] && team[slotId].pkmn) {
                pId = team[slotId].pkmn.id || team[slotId].pkmn;
                if (typeof pkmn !== 'undefined' && pkmn[pId]) {
                    pokemonData = pkmn[pId];
                }
            } else if (typeof saved !== 'undefined' && saved.previewTeams && saved.currentPreviewTeam) {
                const previewTeam = saved.previewTeams[saved.currentPreviewTeam];
                if (previewTeam && previewTeam[slotId] && previewTeam[slotId].pkmn) {
                    pId = previewTeam[slotId].pkmn.id || previewTeam[slotId].pkmn;
                    if (typeof pkmn !== 'undefined' && pkmn[pId]) {
                        pokemonData = pkmn[pId];
                    }
                }
            }

            if (!pokemonData || !pId) return;

            this.showPopup(ContainerOrBox, pokemonData, pId, targetElement);
        }

        showPopup(container, pokemonData, pId, targetElement = null) {
            const totalFatigue = this.calculateBattleFatigue(pokemonData);

            const displayName = formatPokemonName(pId);

            const popup = document.createElement('div');
            popup.className = 'pkmn-info-popup';
            popup.innerHTML = `
                <div class="pkmn-info-popup-title">${displayName}</div>
                <div class="pkmn-info-popup-row">
                    <span>Battle Fatigue: </span>
                    <span class="pkmn-info-popup-val">${totalFatigue} Rounds</span>
                </div>
            `;

            document.body.appendChild(popup);

            const rect = container.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            popup.style.position = 'absolute';
            popup.style.left = `${rect.right + scrollLeft - 200}px`;
            popup.style.top = `${rect.top + scrollTop}px`;

            if (targetElement) {
                const targetRect = targetElement.getBoundingClientRect();

                popup.style.left = `${targetRect.left + scrollLeft - 200 - 10}px`;
                popup.style.top = `${targetRect.top + scrollTop}px`;
            }
        }
    }

    // --- Main Application ---

    class PokechillPlus {
        constructor() {
            this.logger = new Logger();
            this.ui = new UIController();
            this.popupController = new PopUpController(this.ui);

            this.abilityHunter = new AbilityHunter(this.logger, this.ui);
            this.shinyHunter = new ShinyHunter(this.logger, this.ui);
            this.itemTracker = new ItemTracker(this.logger, this.ui);
            this.pokemonTracker = new PokemonTracker(this.logger, this.ui);
            this.trainingMonitor = new TrainingMonitor(this.logger, this.ui, this.abilityHunter);
            this.hpDisplay = new HPDisplay(this.logger);
            this.typeDisplay = new MoveEffectivenessDisplay(this.logger);
            this.speedController = new GameSpeedController(this.logger);
            this.teamEnhancer = new TeamUIEnhancer(this.logger);
            this.pokemonInfo = new PokemonInfoController(this.logger);

            this.battler = new AutoBattler(this.logger, this.ui, this.itemTracker, this.abilityHunter, this.shinyHunter);

            this.shinySoundEnabled = localStorage.getItem(STORAGE_KEYS.SHINY_SOUND) === 'true';
            this.abilitySoundEnabled = localStorage.getItem(STORAGE_KEYS.ABILITY_SOUND) === 'true';

            const savedRemoveBtnPref = localStorage.getItem(STORAGE_KEYS.TEAM_REMOVE_BTN);
            this.teamRemoveBtnEnabled = savedRemoveBtnPref === null ? true : savedRemoveBtnPref === 'true';

            const savedPokemonInfoPref = localStorage.getItem(STORAGE_KEYS.POKEMON_INFO);
            this.pokemonInfoEnabled = savedPokemonInfoPref === null ? true : savedPokemonInfoPref === 'true';

            this.abilityHunter.onTargetFound = () => {
                this.battler.stop();
                if (this.abilitySoundEnabled) {
                    new Audio(ABILITY_SOUND_URL).play().catch(() => { });
                }
            };

            this.shinyHunter.onTargetFound = () => {
                this.battler.stop();
            };
        }

        init() {
            this.ui.init({
                onStart: () => this.battler.start(),
                onStop: () => this.battler.stop(),
                onReset: () => this.resetAll(),
                onAbilityHuntStart: (ability) => {
                    this.abilityHunter.startHunt(ability);
                    this.battler.start();
                },
                onAbilityHuntStop: () => {
                    this.abilityHunter.stopHunt();
                    this.battler.stop();
                },
                onShinyHuntStart: (pokemonId) => {
                    if (!pokemonId) {
                        this.logger.log('⚠️ Please select a target Pokemon');
                        return;
                    }
                    this.shinyHunter.startHunt(pokemonId);
                    this.battler.start();
                },
                onShinyHuntStop: () => {
                    this.shinyHunter.stopHunt();
                    this.battler.stop();
                },
                onSpeedChange: (speed) => this.speedController.setSpeed(speed),
                onHpToggle: (show) => this.hpDisplay.toggle(show),
                onTypeToggle: (show) => this.typeDisplay.toggle(show),
                onPopupToggle: (enabled) => {
                    const success = this.popupController.toggle(enabled);
                    if (!success) {
                        // If popup failed to open, uncheck the checkbox
                        const checkbox = document.getElementById('af-popup-toggle');
                        if (checkbox) checkbox.checked = false;
                    }
                },
                onShinySoundToggle: (enabled) => {
                    this.shinySoundEnabled = enabled;
                    localStorage.setItem(STORAGE_KEYS.SHINY_SOUND, enabled);
                },
                onAbilitySoundToggle: (enabled) => {
                    this.abilitySoundEnabled = enabled;
                    localStorage.setItem(STORAGE_KEYS.ABILITY_SOUND, enabled);
                },
                onTeamRemoveToggle: (enabled) => {
                    this.teamRemoveBtnEnabled = enabled;
                    localStorage.setItem(STORAGE_KEYS.TEAM_REMOVE_BTN, enabled);
                    this.teamEnhancer.toggle(enabled);
                },
                onPokemonInfoToggle: (enabled) => {
                    this.pokemonInfoEnabled = enabled;
                    localStorage.setItem(STORAGE_KEYS.POKEMON_INFO, enabled);
                    if (enabled) {
                        this.pokemonInfo.start();
                    } else {
                        this.pokemonInfo.stop();
                    }
                }
            });

            this.pokemonTracker.onShinyFound = () => {
                if (this.shinySoundEnabled) {
                    new Audio(SHINY_SOUND_URL).play().catch(() => { });
                }
            };

            const shinySoundCheckbox = document.getElementById('af-shiny-sound-toggle');
            const abilitySoundCheckbox = document.getElementById('af-ability-sound-toggle');
            const teamRemoveCheckbox = document.getElementById('af-team-remove-toggle');
            const pokemonInfoCheckbox = document.getElementById('af-pokemon-info-toggle');
            if (shinySoundCheckbox) shinySoundCheckbox.checked = this.shinySoundEnabled;
            if (abilitySoundCheckbox) abilitySoundCheckbox.checked = this.abilitySoundEnabled;
            if (teamRemoveCheckbox) teamRemoveCheckbox.checked = this.teamRemoveBtnEnabled;
            if (pokemonInfoCheckbox) pokemonInfoCheckbox.checked = this.pokemonInfoEnabled;

            this.syncGameSpeed();

            this.trainingMonitor.start();
            this.itemTracker.start();
            this.pokemonTracker.start();

            if (this.teamRemoveBtnEnabled) {
                this.teamEnhancer.start();
            }

            if (this.pokemonInfoEnabled) {
                this.pokemonInfo.start();
            }

            setInterval(() => {
                this.abilityHunter.onTick();
                this.shinyHunter.onTick();
            }, 500);

            // Workaround: Pokechill bug - training effect re-fires because updateWildPkmn()
            // processes dead wilds multiple times at high speed, each queuing a setWildPkmn()
            // call that triggers training[...].effect() again when currentTrainingWave <= 0.
            // Fix: Inject a page-level script that wraps all training effects with a once-guard.
            this.patchTrainingEffects();

            // Global Shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === 'Space') {
                    e.preventDefault();
                    this.battler.toggle();
                }
                if (e.ctrlKey && e.code === 'KeyD') {
                    e.preventDefault();
                    this.logger.toggleDebug();
                }
            });

            // Debug Functions
            window.pcPlusSimulateAbility = (abilityName, pokemonName = 'TestPokemon') => {
                const fakeText = `${pokemonName} now has ${abilityName}!`;
                this.logger.log(`🧪 Simulating ability: "${fakeText}"`);
                this.trainingMonitor.trackAbility(fakeText);
            };
            window.pcPlusSimulateShiny = (pokemonName = 'Pikachu') => {
                this.logger.log(`🧪 Simulating shiny: ${pokemonName}`);
                if (this.pokemonTracker.onShinyFound) {
                    this.pokemonTracker.onShinyFound(pokemonName);
                }
            };
            window.pcPlusTestShinySound = () => new Audio(SHINY_SOUND_URL).play();
            window.pcPlusTestAbilitySound = () => new Audio(ABILITY_SOUND_URL).play();

            this.logger.log('⚡ Pokechill Plus (Class) loaded!');
        }

        resetAll() {
            this.battler.reset();
            this.itemTracker.reset();
            this.pokemonTracker.reset();
            this.trainingMonitor.reset();
            this.abilityHunter.reset();
            this.logger.log('🔄 All Stats Reset');
        }

        patchTrainingEffects() {
            const script = document.createElement('script');
            script.textContent = `
(function() {
    function patch() {
        if (typeof training === 'undefined') { setTimeout(patch, 200); return; }

        var effectGuard = false;

        for (var key in training) {
            if (training[key] && typeof training[key].effect === 'function') {
                (function(orig) {
                    training[key].effect = function() {
                        if (effectGuard) return;
                        effectGuard = true;
                        orig.call(this);
                    };
                })(training[key].effect);
            }
        }

        var areaEnd = document.getElementById('area-end');
        if (areaEnd) {
            new MutationObserver(function() {
                if (areaEnd.style.display === 'none') effectGuard = false;
            }).observe(areaEnd, { attributes: true, attributeFilter: ['style'] });
        }
    }
    patch();
})();
`;
            document.head.appendChild(script);
            script.remove();
            this.logger.log('🛡️ Training effect patch applied');
        }

        syncGameSpeed() {
            const checkAndSync = () => {
                if (typeof saved !== 'undefined' && saved.overrideBattleTimer) {
                    const currentSpeed = this.speedController.getCurrentSpeedFromGame();
                    this.speedController.currentSpeed = currentSpeed;
                    this.ui.updateSpeedUI(currentSpeed);
                    this.logger.log(`⚡ Synced game speed: ${currentSpeed}x`);
                } else {
                    setTimeout(checkAndSync, 500);
                }
            };
            checkAndSync();
        }
    }

    // --- Entry Point ---

    window.addEventListener('load', () => {
        const app = new PokechillPlus();
        app.init();
        // Expose app for debugging if needed
        window.PokechillPlusApp = app;
    });

})();