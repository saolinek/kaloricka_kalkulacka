const APP_VERSION = 'v1.18.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// State management
let state = {
    date: null,
    items: [],
    weight: null,
    target: 2200,
    recipes: [],
    history: {},
    activeView: 'overview'
};

// DOM Cache
let el = {};

function init() {
    console.log(`[App] Booting ${APP_VERSION}...`);
    
    // 1. Cache DOM Elements
    el = {
        appVersion: document.getElementById('app-version-display'),
        btnDebugReset: document.getElementById('btn-debug-reset'), // Debug Button
        
        current: document.getElementById('display-current'),
        target: document.getElementById('display-target'),
        progress: document.getElementById('progress-fill'),
        
        // Inputs
        weight: document.getElementById('weight-input'),
        btnWeightConfirm: document.getElementById('btn-weight-confirm'),
        
        // Containers
        dailyList: document.getElementById('daily-list'),
        dailyListContainer: document.getElementById('daily-list-container'),
        recipesList: document.getElementById('recipes-list'),
        recipesPlaceholder: document.getElementById('recipes-placeholder'),
        statsContent: document.getElementById('stats-content'),
        
        // Selection List for Overview
        listSelectRecipe: document.getElementById('list-select-recipe'),
        placeholderSelectRecipe: document.getElementById('placeholder-select-recipe'),
        
        views: {
            overview: document.getElementById('view-overview'),
            foods: document.getElementById('view-foods'),
            stats: document.getElementById('view-stats')
        },
        nav: {
            overview: document.getElementById('nav-overview'),
            foods: document.getElementById('nav-foods'),
            stats: document.getElementById('nav-stats')
        },
        
        // Buttons
        btnOpenAddCal: document.getElementById('btn-open-add-cal'),
        btnOpenAddRecipe: document.getElementById('btn-open-add-recipe'), // In Overview (opens selection)
        btnCreateRecipe: document.getElementById('btn-create-recipe'),     // In Recipes Tab (opens creation)
        
        // Close Buttons
        btnCloseAddCal: document.getElementById('btn-close-add-cal'),
        btnCloseAddRecipe: document.getElementById('btn-close-add-recipe'), // Closes creation
        btnCloseSelectRecipe: document.getElementById('btn-close-select-recipe'), // Closes selection
        
        // Overlays
        overlayAddCal: document.getElementById('overlay-add-cal'),
        overlayAddRecipe: document.getElementById('overlay-add-recipe'),       // Creation
        overlaySelectRecipe: document.getElementById('overlay-select-recipe'), // Selection
        
        // Forms
        formAddCal: document.getElementById('form-add-cal'),
        formAddRecipe: document.getElementById('form-add-recipe'),
        
        // Inputs
        inputName: document.getElementById('input-name'),
        inputKcal100: document.getElementById('input-kcal-100'),
        inputGrams: document.getElementById('input-grams'),
        inputRecipeName: document.getElementById('input-recipe-name'),
        inputRecipeKcal: document.getElementById('input-recipe-kcal')
    };

    // 2. Set Version
    if (el.appVersion) {
        el.appVersion.textContent = APP_VERSION;
    }

    // 3. Load & Logic
    loadState();
    checkDateAndReset();
    
    // 4. Bind Events
    bindEvents();
    
    // 5. Render
    render();
    
    // 6. SW
    registerServiceWorker();
}

// --- LOGIC ---

function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            state = {
                ...state,
                ...parsed,
                items: Array.isArray(parsed.items) ? parsed.items : [],
                recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
                history: parsed.history || {}
            };
        }
    } catch (e) {
        console.error("State load failed", e);
    }
}

function saveState() {
    try {
        // Sync current day to history
        if (state.date) {
            state.history[state.date] = {
                total: getTotalCalories(),
                weight: state.weight
            };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("State save failed", e);
    }
}

function checkDateAndReset() {
    const today = new Date().toISOString().split('T')[0];
    
    if (state.date && state.date !== today) {
        // Ensure old day is in history
        state.history[state.date] = {
            total: getTotalCalories(),
            weight: state.weight
        };
        
        // Reset current day
        state.items = [];
        state.weight = null;
    }
    
    state.date = today;
    saveState();
}

function getTotalCalories() {
    return state.items.reduce((sum, item) => sum + item.kcal, 0);
}

// --- ACTIONS ---

function addItem(name, kcal) {
    checkDateAndReset();
    state.items.push({ id: Date.now(), name, kcal: parseInt(kcal) });
    saveState();
    render();
}

function createRecipe(name, kcal) {
    state.recipes.push({ id: Date.now(), name, kcal: parseInt(kcal) });
    saveState();
    render();
}

function updateWeight(val) {
    checkDateAndReset();
    state.weight = val ? parseFloat(val) : null;
    saveState();
}

function switchView(viewName) {
    state.activeView = viewName;
    saveState();
    render();
}

/**
 * 100% Reliable Hard Reset
 */
async function hardResetApp() {
    if (!confirm("⚠️ OPRAVDU vymazat všechna data, cache a restartovat aplikaci?")) return;
    
    console.log("CRITICAL: Hard reset sequence started...");
    
    try {
        // 1. Clear State
        localStorage.clear();
        sessionStorage.clear();
        console.log("- Data cleared");

        // 2. Clear Caches (All versions)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log("- Caches deleted");
        }

        // 3. Unregister all Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log("- Service Workers unregistered");
        }

        console.log("- Reset complete. Reloading...");
        
        // 4. Force Reload
        window.location.reload(true);
    } catch (err) {
        console.error("Reset failed partially", err);
        window.location.reload();
    }
}

// --- UI HELPERS ---

function toggleOverlay(overlay, show) {
    if (!overlay) return;
    overlay.classList.toggle('active', show);
    if (show) {
        const inp = overlay.querySelector('input');
        if (inp) setTimeout(() => inp.focus(), 50);
    } else {
        const form = overlay.querySelector('form');
        if (form) form.reset();
    }
}

function renderSelectRecipeList() {
    if (!el.listSelectRecipe) return;
    el.listSelectRecipe.innerHTML = '';
    
    if (state.recipes.length === 0) {
        if (el.placeholderSelectRecipe) el.placeholderSelectRecipe.classList.remove('hidden');
    } else {
        if (el.placeholderSelectRecipe) el.placeholderSelectRecipe.classList.add('hidden');
        
        state.recipes.forEach(r => {
            const li = document.createElement('li');
            li.className = 'list-item recipe-item';
            li.style.cursor = 'pointer';
            li.innerHTML = `
                <div class="recipe-info">
                    <span class="item-name">${r.name}</span>
                    <span class="item-kcal">${r.kcal} kcal</span>
                </div>
                <button class="add-recipe-btn" title="Použít recept">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>
                </button>
            `;
            
            const addAction = (e) => {
                e.stopPropagation();
                addItem(r.name, r.kcal);
                toggleOverlay(el.overlaySelectRecipe, false);
            };
            
            li.addEventListener('click', addAction);
            li.querySelector('.add-recipe-btn').addEventListener('click', addAction);
            
            el.listSelectRecipe.appendChild(li);
        });
    }
}

/**
 * Render: Statistiky (Charts)
 */
function renderStats() {
    if (!el.statsContent) return;

    // 1. Get History Data
    const allDates = Object.keys(state.history).sort();
    if (allDates.length === 0) {
        el.statsContent.innerHTML = '<div class="center-placeholder"><p>Zatím nejsou k dispozici žádná data.</p></div>';
        return;
    }

    // 2. Weight Chart Data (Only days with weight)
    const weightData = allDates
        .filter(d => state.history[d].weight !== null && state.history[d].weight !== undefined)
        .map(d => ({ date: d, value: state.history[d].weight }));

    let html = '';

    if (weightData.length > 0) {
        html += `<div class="chart-container growable-chart">
            <h3>Vývoj váhy (kg)</h3>
            <div class="svg-chart-wrapper responsive-svg-container">
                ${generateWeightSVG(weightData)}
            </div>
        </div>`;
    } else {
        html += `<div class="chart-container"><p style="opacity:0.5; font-size:0.8rem;">Zatím nejsou data o váze.</p></div>`;
    }

    html += '<h3 style="margin: 20px 0 10px 12px; font-size: 1rem; opacity: 0.7;">Historie dní</h3>';
    html += '<ul class="daily-list" style="flex-shrink: 0;">'; // History list shouldn't eat the chart space
    [...allDates].reverse().forEach(d => {
        const h = state.history[d];
        const dayLabel = new Date(d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
        html += `<li class="list-item">
            <span class="item-name">${dayLabel}</span>
            <div style="text-align:right">
                <div class="item-kcal">${h.total} kcal</div>
                <div style="font-size:0.8em;opacity:0.7">${h.weight ? h.weight + ' kg' : '-'}</div>
            </div>
        </li>`;
    });
    html += '</ul>';

    el.statsContent.innerHTML = html;
}

function generateWeightSVG(data) {
    const width = 1000;  // High resolution coordinates for viewBox
    const height = 500;
    const paddingX = 60;
    const paddingY = 40;

    const minW = 0;
    const maxW = 100;
    const rangeW = 100;

    const getX = (index) => paddingX + (index * (width - 2 * paddingX) / (data.length - 1 || 1));
    const getY = (val) => {
        const clippedVal = Math.max(minW, Math.min(maxW, val));
        return height - paddingY - (clippedVal / rangeW * (height - 2 * paddingY));
    };

    let points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
    
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
        <!-- Axes -->
        <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="#C4C6CF" stroke-width="2" />
        <line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${height - paddingY}" stroke="#C4C6CF" stroke-width="2" />
        
        <!-- Y-Axis Fixed Marks (0, 25, 50, 75, 100) -->
        ${[0, 25, 50, 75, 100].map(v => `
            <line x1="${paddingX - 5}" y1="${getY(v)}" x2="${paddingX}" y2="${getY(v)}" stroke="#C4C6CF" stroke-width="2" />
            <text x="${paddingX - 10}" y="${getY(v) + 5}" font-size="16" text-anchor="end" fill="#74777F">${v}</text>
        `).join('')}

        <!-- Data Line -->
        <polyline fill="none" stroke="var(--md-sys-color-primary)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    `;

    data.forEach((d, i) => {
        const x = getX(i);
        const y = getY(d.value);
        svg += `<circle cx="${x}" cy="${y}" r="6" fill="var(--md-sys-color-primary)" />`;
        
        // Dynamic labels for every few points to avoid crowding
        if (data.length < 12 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) {
            const dateLabel = new Date(d.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
            svg += `<text x="${x}" y="${height - 10}" font-size="16" text-anchor="middle" fill="#74777F">${dateLabel}</text>`;
        }
    });

    svg += `</svg>`;
    return svg;
}

function render() {
    const total = getTotalCalories();

    // Dashboard
    if (el.current) el.current.textContent = total;
    if (el.target) el.target.textContent = state.target;
    if (el.progress) {
        const pct = Math.min((total / state.target) * 100, 100);
        el.progress.style.width = `${pct}%`;
        el.progress.className = total > state.target ? 'progress-fill over-limit' : 'progress-fill';
    }
    if (el.weight && document.activeElement !== el.weight) {
        el.weight.value = state.weight || '';
    }

    // Lists
    if (el.dailyList) {
        el.dailyList.innerHTML = '';
        if (state.items.length > 0) {
            el.dailyListContainer.classList.remove('hidden');
            [...state.items].reverse().forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `<span class="item-name">${item.name}</span><span class="item-kcal">+${item.kcal}</span>`;
                el.dailyList.appendChild(li);
            });
        } else {
            el.dailyListContainer.classList.add('hidden');
        }
    }

    if (el.recipesList) {
        el.recipesList.innerHTML = '';
        if (state.recipes.length > 0) {
            el.recipesPlaceholder.classList.add('hidden');
            state.recipes.forEach(r => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `<div class="recipe-info"><span class="item-name">${r.name}</span><span class="item-kcal">${r.kcal} kcal</span></div>`;
                el.recipesList.appendChild(li);
            });
        } else {
            el.recipesPlaceholder.classList.remove('hidden');
        }
    }

    if (state.activeView === 'stats') {
        renderStats();
    }

    Object.keys(el.views).forEach(key => {
        const isActive = key === state.activeView;
        if (el.views[key]) {
            el.views[key].classList.toggle('active', isActive);
            el.views[key].classList.toggle('hidden', !isActive);
        }
        if (el.nav[key]) {
            el.nav[key].classList.toggle('active', isActive);
        }
    });
}

function bindEvents() {
    if (el.btnDebugReset) el.btnDebugReset.onclick = hardResetApp;

    if (el.nav.overview) el.nav.overview.onclick = () => switchView('overview');
    if (el.nav.foods) el.nav.foods.onclick = () => switchView('foods');
    if (el.nav.stats) el.nav.stats.onclick = () => switchView('stats');

    if (el.btnOpenAddRecipe) el.btnOpenAddRecipe.onclick = () => {
        renderSelectRecipeList();
        toggleOverlay(el.overlaySelectRecipe, true);
    };
    if (el.btnOpenAddCal) el.btnOpenAddCal.onclick = () => toggleOverlay(el.overlayAddCal, true);
    if (el.btnCreateRecipe) el.btnCreateRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, true);

    if (el.btnCloseAddCal) el.btnCloseAddCal.onclick = () => toggleOverlay(el.overlayAddCal, false);
    if (el.btnCloseAddRecipe) el.btnCloseAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, false);
    if (el.btnCloseSelectRecipe) el.btnCloseSelectRecipe.onclick = () => toggleOverlay(el.overlaySelectRecipe, false);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleOverlay(el.overlayAddCal, false);
            toggleOverlay(el.overlayAddRecipe, false);
            toggleOverlay(el.overlaySelectRecipe, false);
        }
    });

    if (el.formAddCal) el.formAddCal.onsubmit = (e) => {
        e.preventDefault();
        const n = el.inputName.value.trim();
        const k = parseFloat(el.inputKcal100.value);
        const g = parseFloat(el.inputGrams.value);
        if (n && k > 0 && g > 0) {
            addItem(n, Math.round((k * g) / 100));
            toggleOverlay(el.overlayAddCal, false);
        }
    };

    if (el.formAddRecipe) el.formAddRecipe.onsubmit = (e) => {
        e.preventDefault();
        const n = el.inputRecipeName.value.trim();
        const c = parseFloat(el.inputRecipeKcal.value);
        if (n && c > 0) {
            createRecipe(n, c);
            toggleOverlay(el.overlayAddRecipe, false);
        }
    };

    if (el.weight) el.weight.oninput = (e) => updateWeight(e.target.value);
    if (el.btnWeightConfirm) {
        el.btnWeightConfirm.onclick = () => {
            if (el.weight) updateWeight(el.weight.value);
        };
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkDateAndReset();
            render();
        }
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
}

document.addEventListener('DOMContentLoaded', init);