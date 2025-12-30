// Definice verze pro cache management
const APP_VERSION = 'v1.10.0';
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

// DOM Cache (naplní se v init)
let el = {};

function init() {
    console.log(`[App] Booting ${APP_VERSION}...`);
    
    // 1. Cache DOM Elements
    el = {
        appVersion: document.getElementById('app-version-display'),
        
        // Displays
        current: document.getElementById('display-current'),
        target: document.getElementById('display-target'),
        progress: document.getElementById('progress-fill'),
        
        // Inputs
        weight: document.getElementById('weight-input'),
        
        // Containers
        dailyList: document.getElementById('daily-list'),
        dailyListContainer: document.getElementById('daily-list-container'),
        recipesList: document.getElementById('recipes-list'),
        recipesPlaceholder: document.getElementById('recipes-placeholder'),
        statsContent: document.getElementById('stats-content'),
        
        // Views
        views: {
            overview: document.getElementById('view-overview'),
            foods: document.getElementById('view-foods'),
            stats: document.getElementById('view-stats')
        },
        
        // Nav Buttons
        nav: {
            overview: document.getElementById('nav-overview'),
            foods: document.getElementById('nav-foods'),
            stats: document.getElementById('nav-stats')
        },
        
        // Overlay Triggers
        btnOpenAddCal: document.getElementById('btn-open-add-cal'),
        btnOpenAddRecipe: document.getElementById('btn-open-add-recipe'),
        
        // Overlay Close Buttons
        btnCloseAddCal: document.getElementById('btn-close-add-cal'),
        btnCloseAddRecipe: document.getElementById('btn-close-add-recipe'),
        
        // Overlays
        overlayAddCal: document.getElementById('overlay-add-cal'),
        overlayAddRecipe: document.getElementById('overlay-add-recipe'),
        
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

    // 2. Set Version immediately
    if (el.appVersion) {
        el.appVersion.textContent = APP_VERSION;
        el.appVersion.style.display = 'block'; // Ensure visibility
    }

    // 3. Load State & Logic
    loadState();
    checkDateAndReset();
    
    // 4. Bind Events (Once)
    bindEvents();
    
    // 5. Initial Render
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("State save failed", e);
    }
}

function checkDateAndReset() {
    const today = new Date().toISOString().split('T')[0];
    
    if (state.date && state.date !== today) {
        // Save history
        state.history[state.date] = {
            total: getTotalCalories(),
            weight: state.weight
        };
        // Reset day
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

function addRecipe(name, kcal) {
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

// --- UI ---

function render() {
    const total = getTotalCalories();

    // 1. Dashboard
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

    // 2. Daily List
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

    // 3. Recipes
    if (el.recipesList) {
        el.recipesList.innerHTML = '';
        if (state.recipes.length > 0) {
            el.recipesPlaceholder.classList.add('hidden');
            state.recipes.forEach(r => {
                const li = document.createElement('li');
                li.className = 'list-item recipe-item';
                li.innerHTML = `
                    <div class="recipe-info">
                        <span class="item-name">${r.name}</span>
                        <span class="item-kcal">${r.kcal} kcal</span>
                    </div>
                    <button class="add-recipe-btn">+</button>
                `;
                li.querySelector('.add-recipe-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    addItem(r.name, r.kcal);
                    switchView('overview');
                });
                el.recipesList.appendChild(li);
            });
        } else {
            el.recipesPlaceholder.classList.remove('hidden');
        }
    }

    // 4. Stats
    if (el.statsContent) {
        const dates = Object.keys(state.history).sort().reverse();
        if (dates.length === 0) {
            el.statsContent.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top:20px">Žádná historie.</p>';
        } else {
            let html = '<ul class="daily-list" style="padding-top:10px;">';
            dates.forEach(d => {
                const h = state.history[d];
                html += `<li class="list-item">
                    <span>${new Date(d).toLocaleDateString('cs-CZ')}</span>
                    <div style="text-align:right">
                        <div>${h.total} kcal</div>
                        <div style="font-size:0.8em;opacity:0.7">${h.weight ? h.weight + ' kg' : '-'}</div>
                    </div>
                </li>`;
            });
            html += '</ul>';
            el.statsContent.innerHTML = html;
        }
    }

    // 5. Navigation & Views
    Object.keys(el.views).forEach(key => {
        const view = el.views[key];
        const nav = el.nav[key];
        const isActive = key === state.activeView;

        if (view) {
            view.classList.toggle('active', isActive);
            view.classList.toggle('hidden', !isActive);
        }
        if (nav) {
            nav.classList.toggle('active', isActive);
        }
    });
}

function bindEvents() {
    // Nav
    if (el.nav.overview) el.nav.overview.onclick = () => switchView('overview');
    if (el.nav.foods) el.nav.foods.onclick = () => switchView('foods');
    if (el.nav.stats) el.nav.stats.onclick = () => switchView('stats');

    // Overlays
    const toggleOverlay = (overlay, show) => {
        if (!overlay) return;
        overlay.classList.toggle('active', show);
        if (show) {
            const inp = overlay.querySelector('input');
            if (inp) setTimeout(() => inp.focus(), 50);
        } else {
            const form = overlay.querySelector('form');
            if (form) form.reset();
        }
    };

    if (el.btnOpenAddCal) el.btnOpenAddCal.onclick = () => toggleOverlay(el.overlayAddCal, true);
    if (el.btnCloseAddCal) el.btnCloseAddCal.onclick = () => toggleOverlay(el.overlayAddCal, false);
    
    if (el.btnOpenAddRecipe) el.btnOpenAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, true);
    if (el.btnCloseAddRecipe) el.btnCloseAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, false);

    // Forms
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
            addRecipe(n, c);
            toggleOverlay(el.overlayAddRecipe, false);
            switchView('foods');
        }
    };

    // Weight
    if (el.weight) el.weight.oninput = (e) => updateWeight(e.target.value);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);

/**
 * Registrace Service Workeru
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[SW] Registrován', reg.scope))
            .catch(err => console.error('[SW] Chyba registrace', err));
    }
}

// Spuštění
init();