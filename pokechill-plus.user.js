// ==UserScript==
// @name         ⚡ Pokechill Plus 
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatic clicking on Fight Again + Item Tracking
// @author       You
// @match        https://play-pokechill.github.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let clickCount = 0;
    let isRunning = false;
    let interval = null;
    let itemStats = {};
    let itemImages = {};
    let lastButtonState = false; // Prevents multiple clicks
    let observer = null; // MutationObserver for Items
    let lastSeenItems = {};
    let DEBUG = false;

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
        lastSeenItems = {};
        updateUI();
        updateItemDisplay();
        console.log('🔄 Everything reset');
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
            console.log('▶️ Auto-Fight started');
        }
    }

    function stopAutoClick() {
        if (interval) {
            clearInterval(interval);
            interval = null;
            isRunning = false;
            lastButtonState = false;
            updateUI();
            console.log('⏸️ Auto-Fight stopped');
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
        console.log(`🐛 Debug mode: ${DEBUG ? 'ON' : 'OFF'}`);
    }

    function updateUI() {
        const statusDot = document.getElementById('af-status-dot');
        const statusText = document.getElementById('af-status-text');
        const clickCountEl = document.getElementById('af-click-count');
        const startBtn = document.getElementById('af-start-btn');
        const stopBtn = document.getElementById('af-stop-btn');
        const buttonStatus = document.getElementById('af-button-status');

        if (statusDot) {
            statusDot.style.color = isRunning ? '#0f0' : '#f00';
            statusDot.textContent = isRunning ? '●' : '○';
        }
        if (statusText) {
            statusText.textContent = isRunning ? 'Active' : 'Stopped';
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
        if (buttonStatus) {
            const btn = findButton();
            if (btn) {
                buttonStatus.textContent = '✓ Ready';
                buttonStatus.style.color = '#0f0';
            } else {
                buttonStatus.textContent = '✗ Not found';
                buttonStatus.style.color = '#f00';
            }
        }
    }

    function createUI() {
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
            <div style="font-weight: bold; margin-bottom: 12px; font-size: 15px; color: #667eea; text-align: center;">
                🤖 Auto-Fight
            </div>
            <div style="margin: 8px 0;">
                Status: <span id="af-status-dot" style="font-weight: bold;">○</span>
                <span id="af-status-text">Stopped</span>
            </div>
            <div style="margin: 8px 0;">
                Clicks: <span id="af-click-count" style="color: #ffc107; font-weight: bold;">0</span>
            </div>
            <div style="margin: 8px 0; font-size: 11px;">
                Button: <span id="af-button-status" style="font-weight: bold;">...</span>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button id="af-start-btn" style="
                    flex: 1;
                    padding: 8px;
                    background: #4caf50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 12px;
                ">▶ Start</button>
                <button id="af-stop-btn" style="
                    flex: 1;
                    padding: 8px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 12px;
                    display: none;
                ">⏸ Stop</button>
                <button id="af-reset-btn" style="
                    padding: 8px 12px;
                    background: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 12px;
                ">↺</button>
            </div>

            <!-- Item Tracking Section -->
            <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #667eea;">
                <div style="margin-bottom: 8px;">
                    <span style="font-weight: bold; color: #667eea;">📦 Collected Items</span>
                </div>
                <div id="af-item-list" style="
                    max-height: 150px;
                    overflow-y: auto;
                    background: rgba(255,255,255,0.05);
                    padding: 8px;
                    border-radius: 5px;
                ">
                    <div style="color: #888; font-size: 11px; text-align: center;">No items collected</div>
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

        makeDraggable(overlay);

        const hoverStyle = `
            #af-start-btn:hover { background: #45a049; }
            #af-stop-btn:hover { background: #da190b; }
            #af-reset-btn:hover { background: #e68900; }
            #af-item-list::-webkit-scrollbar { width: 6px; }
            #af-item-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); border-radius: 3px; }
            #af-item-list::-webkit-scrollbar-thumb { background: #667eea; border-radius: 3px; }
        `;
        const style = document.createElement('style');
        style.textContent = hoverStyle;
        document.head.appendChild(style);

        return overlay;
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (e.target.tagName === 'BUTTON') return;
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
        setupItemObserver();
        console.log('🤖 Auto-Fight with Live-Item-Tracking loaded!');
        console.log('   Ctrl+Space: Start/stop tool');
        console.log('   Ctrl+D: Toggle debug mode');
    });

})();