// Definice verze pro cache management
const APP_VERSION = 'v1.15.0';
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
        
        // New: Selection List for Overview
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("State save failed", e);
    }
}

function checkDateAndReset() {
    const today = new Date().toISOString().split('T')[0];
    if (state.date && state.date !== today) {
        state.history[state.date] = {
            total: getTotalCalories(),
            weight: state.weight
        };
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

function hardResetApp() {
    if (!confirm("⚠️ Opravdu vymazat všechna data a resetovat aplikaci?\nTato akce je nevratná.")) return;
    
    console.log("Hard resetting application...");
    
    // 1. Clear LocalStorage
    localStorage.clear();
    
    // 2. Clear Caches & Unregister SW
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) caches.delete(name);
        });
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for(let registration of registrations) {
                registration.unregister();
            }
        }).finally(() => {
            // 3. Reload
            window.location.reload();
        });
    } else {
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
            // Vylepšený styl pro výběr
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
            
            // Clicking row or button adds the recipe
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

    // Daily List
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

    // Recipes List (Management View)
    if (el.recipesList) {
        el.recipesList.innerHTML = '';
        if (state.recipes.length > 0) {
            el.recipesPlaceholder.classList.add('hidden');
            state.recipes.forEach(r => {
                const li = document.createElement('li');
                li.className = 'list-item'; // Standard list item, no action button in management view per request
                li.innerHTML = `
                    <div class="recipe-info">
                        <span class="item-name">${r.name}</span>
                        <span class="item-kcal">${r.kcal} kcal</span>
                    </div>
                `;
                el.recipesList.appendChild(li);
            });
        } else {
            el.recipesPlaceholder.classList.remove('hidden');
        }
    }

    // Stats
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

    // Views & Nav
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
    // Debug Reset
    if (el.btnDebugReset) el.btnDebugReset.onclick = hardResetApp;

    // Nav
    if (el.nav.overview) el.nav.overview.onclick = () => switchView('overview');
    if (el.nav.foods) el.nav.foods.onclick = () => switchView('foods');
    if (el.nav.stats) el.nav.stats.onclick = () => switchView('stats');

    // Overview: Add Recipe -> Opens Selection
    if (el.btnOpenAddRecipe) el.btnOpenAddRecipe.onclick = () => {
        renderSelectRecipeList();
        toggleOverlay(el.overlaySelectRecipe, true);
    };
    
    // Recipes Tab: Create Recipe -> Opens Creation
    if (el.btnCreateRecipe) el.btnCreateRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, true);

    // Add Calories Overlay
    if (el.btnOpenAddCal) el.btnOpenAddCal.onclick = () => toggleOverlay(el.overlayAddCal, true);

    // Close Buttons
    if (el.btnCloseAddCal) el.btnCloseAddCal.onclick = () => toggleOverlay(el.overlayAddCal, false);
    if (el.btnCloseAddRecipe) el.btnCloseAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, false);
    if (el.btnCloseSelectRecipe) el.btnCloseSelectRecipe.onclick = () => toggleOverlay(el.overlaySelectRecipe, false);

    // Keyboard (Escape)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleOverlay(el.overlayAddCal, false);
            toggleOverlay(el.overlayAddRecipe, false);
            toggleOverlay(el.overlaySelectRecipe, false);
        }
    });

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
            createRecipe(n, c);
            toggleOverlay(el.overlayAddRecipe, false);
            // Stay in recipes view to see the new recipe
        }
    };

    // Weight
    if (el.weight) el.weight.oninput = (e) => updateWeight(e.target.value);
    if (el.btnWeightConfirm) {
        el.btnWeightConfirm.onclick = () => {
            if (el.weight) updateWeight(el.weight.value);
            // Visual feedback could be added here later (e.g. flash button)
        };
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
}

document.addEventListener('DOMContentLoaded', init);