// ==UserScript==
// @name         ⚡ Pokechill Plus
// @namespace    http://tampermonkey.net/
// @version      1.5
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
                // Format is "+X"
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
            this.pkmnStats = {}; // { id: { count: 0, new: 0, shiny: 0, ivs: 0 } }
            this.pkmnImages = {};
            this.observer = null;
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
                else if (tag === '✦Shiny✦!' || tag?.includes('Shiny')) this.pkmnStats[pkmnId].shiny++;
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

            // Bind UI events later or expose methods
        }

        reset() {
            this.abilityLog = [];
            this.uiController.updateAbilityDisplay(this.abilityLog, this.targetAbility);
        }

        onTick() {
            // Check for pokemon change to update select dropdown
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
            this.uiController.updateAbilityDisplay(this.abilityLog, this.targetAbility);

            if (this.enabled && this.targetAbility) {
                const normTarget = this.targetAbility.toLowerCase().replace(/\s+/g, '');
                const normAbility = abilityName.toLowerCase().replace(/\s+/g, '');

                if (normAbility === normTarget) {
                    this.logger.log(`🎉 Target ability "${abilityName}" found!`);
                    this.stopHunt();
                    return true; // Signal target found
                }
            }
            return false;
        }

        hasReachedTarget() {
            // Backup check by scanning DOM (Reliability feature from original script)
            if (!this.enabled || !this.targetAbility) return false;

            const areaEndTitle = document.getElementById('area-end-moves-title');
            if (!areaEndTitle) return false;

            const spans = areaEndTitle.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                if (!text.includes(' now has ')) continue;

                const abilityMatch = text.match(/(.+?)\s+now has\s+(.+)!/);
                if (!abilityMatch) continue;

                const abilityName = abilityMatch[2].trim();
                const normTarget = this.targetAbility.toLowerCase().replace(/\s+/g, '');
                const normAbility = abilityName.toLowerCase().replace(/\s+/g, '');

                if (normAbility === normTarget) {
                    this.logger.log(`🛑 Target ability "${abilityName}" found (DOM check), blocking click!`);
                    return true;
                }
            }
            return false;
        }

        getTrainingPokemonName() {
            if (typeof saved === 'undefined' || typeof pkmn === 'undefined') return null;
            if (!saved.trainingPokemon || !pkmn[saved.trainingPokemon]) return null;
            const id = saved.trainingPokemon;
            return id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1');
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
        constructor(logger, uiController, itemTracker, abilityHunter) {
            this.logger = logger;
            this.uiController = uiController;
            this.itemTracker = itemTracker;
            this.abilityHunter = abilityHunter;

            this.isRunning = false;
            this.clickCount = 0;
            this.interval = null;
            this.lastButtonState = false;
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.interval = setInterval(() => this.tick(), 250);
            this.uiController.updateAutoFightStatus(true);
            this.logger.log('▶️ Auto-Fight started');
        }

        stop() {
            if (!this.isRunning) return;
            this.isRunning = false;
            if (this.interval) clearInterval(this.interval);
            this.interval = null;
            this.lastButtonState = false;

            // Also stop ability hunt if running
            if (this.abilityHunter.enabled) {
                this.abilityHunter.stopHunt();
            }

            this.uiController.updateAutoFightStatus(false);
            this.logger.log('⏸️ Auto-Fight stopped');
        }

        toggle() {
            this.isRunning ? this.stop() : this.start();
        }

        reset() {
            this.clickCount = 0;
            this.uiController.updateClickCount(0);
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

            this.logger.log('🎯 Click on Fight Again');
            btn.click();
            this.clickCount++;
            this.uiController.updateClickCount(this.clickCount);
            this.lastButtonState = buttonExists;
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
                onTypeToggle: () => { }
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
                font-size: 13px; z-index: 999999; min-width: 250px; max-width: 350px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 2px solid #667eea;
            `;

            this.overlay.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px; color: #667eea; text-align: center;">⚡ Pokechill Plus</div>
                ${this.renderSection('autofight', 'Auto-Fight', true)}
                ${this.renderSection('display', 'Display Options')}
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
                <!-- Ability Hunt -->
                <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
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
                    ${id === 'autofight' ? '<span id="af-status-dot" style="margin-left: auto;">○</span>' : ''}
                </div>
                <div class="pc-section-content" id="section-${id}-content" style="display: ${open ? 'block' : 'none'};"></div>
            </div>`;
        }

        attachEventListeners() {
            document.getElementById('af-start-btn').addEventListener('click', this.callbacks.onStart);
            document.getElementById('af-stop-btn').addEventListener('click', this.callbacks.onStop);
            document.getElementById('af-reset-btn').addEventListener('click', this.callbacks.onReset);
            document.getElementById('af-hp-toggle').addEventListener('change', (e) => this.callbacks.onHpToggle(e.target.checked));
            document.getElementById('af-type-toggle').addEventListener('change', (e) => this.callbacks.onTypeToggle(e.target.checked));
            document.getElementById('af-ability-start').addEventListener('click', () => {
                const select = document.getElementById('af-ability-select');
                this.callbacks.onAbilityHuntStart(select.value);
            });
            document.getElementById('af-ability-stop').addEventListener('click', this.callbacks.onAbilityHuntStop);

            ['autofight', 'display', 'tweaks'].forEach(id => {
                document.getElementById(`section-${id}-header`).addEventListener('click', () => this.toggleSection(id));
            });

            document.querySelectorAll('.pc-speed-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const speed = parseFloat(btn.dataset.speed);
                    this.callbacks.onSpeedChange(speed);
                    this.updateSpeedUI(speed);
                });
            });

            this.updateSpeedUI(1);
        }

        updateAutoFightStatus(isRunning) {
            const dot = document.getElementById('af-status-dot');
            const startBtn = document.getElementById('af-start-btn');
            const stopBtn = document.getElementById('af-stop-btn');
            if (dot) { dot.style.color = isRunning ? '#4caf50' : '#888'; dot.textContent = isRunning ? '●' : '○'; }
            if (startBtn) startBtn.style.display = isRunning ? 'none' : 'block';
            if (stopBtn) stopBtn.style.display = isRunning ? 'block' : 'none';
        }

        updateClickCount(count) {
            const el = document.getElementById('af-click-count');
            if (el) el.textContent = count;
        }

        updateItemDisplay(stats, images) {
            const list = document.getElementById('af-item-list');
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
            const list = document.getElementById('af-pkmn-list');
            if (!list) return;
            const sorted = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
            if (sorted.length === 0) { list.innerHTML = '<div class="empty-list">No pokemon gathered</div>'; return; }

            list.innerHTML = sorted.map(([id, data]) => {
                const tags = [];
                if (data.new > 0) tags.push(`<span style="color:#69df96; font-size:9px;">NEW! x${data.new}</span>`);
                if (data.shiny > 0) tags.push(`<span style="color:#ffc107; font-size:9px;">SHINY! x${data.shiny}</span>`);
                if (data.ivs > 0) tags.push(`<span style="color:#a78bfa; font-size:9px;">IVs UP! x${data.ivs}</span>`);

                const name = id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1');

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
            const list = document.getElementById('af-iv-list');
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
            const list = document.getElementById('af-move-list');
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
            const startBtn = document.getElementById('af-ability-start');
            const stopBtn = document.getElementById('af-ability-stop');
            const statusDot = document.getElementById('af-ability-status');
            const select = document.getElementById('af-ability-select');
            if (startBtn) startBtn.style.display = enabled ? 'none' : 'block';
            if (stopBtn) stopBtn.style.display = enabled ? 'block' : 'none';
            if (statusDot) { statusDot.style.color = enabled ? '#4caf50' : '#888'; statusDot.textContent = enabled ? '●' : '○'; }
            if (select) select.disabled = enabled;
        }

        updateAbilityDisplay(log, target) {
            const list = document.getElementById('af-ability-log');
            if (!list) return;
            if (log.length === 0) { list.innerHTML = '<div class="empty-list">No abilities rolled</div>'; return; }

            const normTarget = target ? target.toLowerCase().replace(/\s+/g, '') : '';
            list.innerHTML = log.slice(0, 20).map(entry => {
                const normAbility = entry.ability.toLowerCase().replace(/\s+/g, '');
                const isTarget = normTarget && normAbility === normTarget;
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 10px;">
                    <span style="color: #ccc;">${entry.pokemon}</span>
                    <span style="color: #888; ${isTarget ? 'color: #69df96; font-weight: bold;' : ''}">${entry.ability}</span>
                </div>`;
            }).join('');
        }

        updateAbilitySelect(pokemonName, abilities) {
            const select = document.getElementById('af-ability-select');
            const label = document.getElementById('af-ability-pokemon');
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
                        const name = a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1');
                        html += `<option value="${a}">${name}</option>`;
                    });
                    html += `</optgroup>`;
                }
            });
            select.innerHTML = html;
        }

        updateSpeedUI(currentSpeed) {
            document.querySelectorAll('.pc-speed-btn').forEach(btn => {
                btn.classList.toggle('active', parseFloat(btn.dataset.speed) === currentSpeed);
                btn.style.background = parseFloat(btn.dataset.speed) === currentSpeed ? '#667eea' : 'rgba(255,255,255,0.1)';
                btn.style.color = parseFloat(btn.dataset.speed) === currentSpeed ? '#fff' : '#ccc';
            });
            const ind = document.getElementById('af-speed-indicator');
            if (ind) { ind.textContent = `${currentSpeed}x`; ind.style.color = currentSpeed > 1 ? '#4caf50' : '#667eea'; }
        }

        toggleSection(id) {
            const content = document.getElementById(`section-${id}-content`);
            const arrow = document.getElementById(`section-${id}-arrow`);
            if (content.style.display === 'none') {
                content.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                content.style.display = 'none';
                arrow.textContent = '▶';
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
                .empty-list { color: #888; font-size: 11px; text-align: center; }
                .pc-speed-btn { flex: 1; padding: 6px 4px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: all 0.2s; }
                .pc-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
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

            // Observer for move button creation/updates
            this.observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                for (const m of mutations) {
                    // Ignore our own indicators
                    if (m.target.classList && m.target.classList.contains('pc-type-indicator')) continue;
                    if (m.target.closest && m.target.closest('.pc-type-indicator')) continue;

                    if (m.type === 'childList') {
                        // Check if added nodes are NOT our indicators
                        for (const node of m.addedNodes) {
                            if (node.nodeType === 1 && !node.classList.contains('pc-type-indicator') && !node.querySelector('.pc-type-indicator')) {
                                shouldUpdate = true;
                                break;
                            }
                        }
                    }
                    // Updates on style or class might indicate new move loaded
                    else if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                        // Ignore if target is our indicator (handled above by target check, but double check)
                        if (!m.target.classList.contains('pc-type-indicator')) {
                            shouldUpdate = true;
                        }
                    }

                    if (shouldUpdate) break;
                }
                if (shouldUpdate) this.updateEffectiveness();
            });

            // Observe a broad container as move boxes are dynamically created/destroyed often
            // Ideally we find a stable container. 'explore-bot' or 'team-menu' might contain them.
            // For safety, document.body but filtered.
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'data-move']
            });

            // Fallback interval just in case
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
            // Cleanup existing indicators
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

            // Process all move buttons and filter for player moves
            document.querySelectorAll('.pkmn-movebox').forEach(box => {
                if (!box.id.includes('team')) return;

                const moveId = box.dataset.move;
                if (!moveId || !move[moveId]) return;

                const moveType = move[moveId].type;
                if (!moveType) return;

                // Calculate effectiveness using the game's internal chart
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
                // Neutral x1
                indicator.textContent = `▬ x${multiplier}`;
                indicator.style.color = '#ffffff'; // White
                indicator.style.display = 'inline-block';
            }
        }
    }

    // --- Main Application ---

    class PokechillPlus {
        constructor() {
            this.logger = new Logger();
            this.ui = new UIController();

            // Services with Dependencies
            this.abilityHunter = new AbilityHunter(this.logger, this.ui);
            this.itemTracker = new ItemTracker(this.logger, this.ui);
            this.pokemonTracker = new PokemonTracker(this.logger, this.ui);
            this.trainingMonitor = new TrainingMonitor(this.logger, this.ui, this.abilityHunter);
            this.hpDisplay = new HPDisplay(this.logger);
            this.typeDisplay = new MoveEffectivenessDisplay(this.logger);
            this.speedController = new GameSpeedController(this.logger);

            this.battler = new AutoBattler(this.logger, this.ui, this.itemTracker, this.abilityHunter);
        }

        init() {
            // Initialize UI
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
                onSpeedChange: (speed) => this.speedController.setSpeed(speed),
                onHpToggle: (show) => this.hpDisplay.toggle(show),
                onTypeToggle: (show) => this.typeDisplay.toggle(show)
            });

            // Start Observers (that don't depend on "Run" state being true, but just general monitoring)
            this.trainingMonitor.start();
            this.itemTracker.start();
            this.pokemonTracker.start();

            setInterval(() => this.abilityHunter.onTick(), 500);

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

            // Debug Function
            window.pcPlusSimulateAbility = (abilityName, pokemonName = 'TestPokemon') => {
                const fakeText = `${pokemonName} now has ${abilityName}!`;
                this.logger.log(`🧪 Simulating ability: "${fakeText}"`);
                this.trainingMonitor.trackAbility(fakeText);
            };

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
    }

    // --- Entry Point ---

    window.addEventListener('load', () => {
        const app = new PokechillPlus();
        app.init();
        // Expose app for debugging if needed
        window.PokechillPlusApp = app;
    });

})();