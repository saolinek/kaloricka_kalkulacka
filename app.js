const APP_VERSION = 'v1.23.0';
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

// Temp variable for consumption flow
let selectedRecipeForConsume = null;

// DOM Cache
let el = {};

function init() {
    console.log(`[App] Booting ${APP_VERSION}...`);
    
    // 1. Cache DOM Elements
    el = {
        appVersion: document.getElementById('app-version-display'),
        btnDebugReset: document.getElementById('btn-debug-reset'),
        
        current: document.getElementById('display-current'),
        target: document.getElementById('display-target'),
        progress: document.getElementById('progress-fill'),
        
        weight: document.getElementById('weight-input'),
        btnWeightConfirm: document.getElementById('btn-weight-confirm'),
        
        dailyList: document.getElementById('daily-list'),
        dailyListContainer: document.getElementById('daily-list-container'),
        recipesList: document.getElementById('recipes-list'),
        recipesPlaceholder: document.getElementById('recipes-placeholder'),
        statsContent: document.getElementById('stats-content'),
        
        listSelectRecipe: document.getElementById('list-select-recipe'),
        placeholderSelectRecipe: document.getElementById('placeholder-select-recipe'),
        
        views: {
            overview: document.getElementById('view-overview'),
            foods: document.getElementById('view-foods'),
            stats: document.getElementById('view-stats'),
            settings: document.getElementById('view-settings')
        },
        nav: {
            overview: document.getElementById('nav-overview'),
            foods: document.getElementById('nav-foods'),
            stats: document.getElementById('nav-stats'),
            settings: document.getElementById('nav-settings')
        },
        
        // Overlays
        overlayAddCal: document.getElementById('overlay-add-cal'),
        overlayAddRecipe: document.getElementById('overlay-add-recipe'),
        overlaySelectRecipe: document.getElementById('overlay-select-recipe'),
        overlayConsumeRecipe: document.getElementById('overlay-consume-recipe'),
        
        // Buttons
        btnOpenAddCal: document.getElementById('btn-open-add-cal'),
        btnOpenAddRecipe: document.getElementById('btn-open-add-recipe'),
        btnCreateRecipe: document.getElementById('btn-create-recipe'),
        btnAddIngredient: document.getElementById('btn-add-ingredient'),
        btnSaveSettings: document.getElementById('btn-save-settings'),
        
        // Close Buttons
        btnCloseAddCal: document.getElementById('btn-close-add-cal'),
        btnCloseAddRecipe: document.getElementById('btn-close-add-recipe'),
        btnCloseSelectRecipe: document.getElementById('btn-close-select-recipe'),
        btnCloseConsumeRecipe: document.getElementById('btn-close-consume-recipe'),
        
        // Forms
        formAddCal: document.getElementById('form-add-cal'),
        formAddRecipe: document.getElementById('form-add-recipe'),
        formConsumeRecipe: document.getElementById('form-consume-recipe'),
        
        // Inputs
        inputName: document.getElementById('input-name'),
        inputKcal100: document.getElementById('input-kcal-100'),
        inputGrams: document.getElementById('input-grams'),
        inputRecipeName: document.getElementById('input-recipe-name'),
        ingredientsListForm: document.getElementById('ingredients-list-form'),
        inputConsumeGrams: document.getElementById('input-consume-grams'),
        consumeRecipeTitle: document.getElementById('consume-recipe-title'),
        consumeRecipeInfo: document.getElementById('consume-recipe-info'),
        inputTargetKcal: document.getElementById('input-target-kcal')
    };

    if (el.appVersion) el.appVersion.textContent = APP_VERSION;

    loadState();
    checkDateAndReset();
    bindEvents();
    render();
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
            
            // Migration for recipes
            state.recipes = state.recipes.map(r => {
                if (!r.ingredients) return { ...r, ingredients: [], incompatible: true };
                return r;
            });
        }
    } catch (e) {
        console.error("State load failed", e);
    }
}

function saveState() {
    try {
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
        state.history[state.date] = { total: getTotalCalories(), weight: state.weight };
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

function deleteItem(id) {
    state.items = state.items.filter(i => i.id !== id);
    saveState();
    render();
}

function deleteRecipe(id) {
    state.recipes = state.recipes.filter(r => r.id !== id);
    saveState();
    render();
}

function updateWeight(val) {
    checkDateAndReset();
    state.weight = val ? parseFloat(val) : null;
    saveState();
}

function updateTargetKcal(val) {
    const newVal = parseInt(val);
    if (!isNaN(newVal) && newVal > 0) {
        state.target = newVal;
        saveState();
        render();
    }
}

function switchView(viewName) {
    state.activeView = viewName;
    saveState();
    render();
}

/**
 * Hard Reset
 */
async function hardResetApp() {
    if (!confirm("⚠️ OPRAVDU vymazat všechna data, cache a restartovat aplikaci?")) return;
    try {
        localStorage.clear(); sessionStorage.clear();
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
        }
        window.location.reload(true);
    } catch (err) {
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
        if (overlay === el.overlayAddRecipe) {
            el.ingredientsListForm.innerHTML = '';
            addIngredientRow();
        }
    }
}

function addIngredientRow() {
    const row = document.createElement('div');
    row.className = 'ingredient-card';
    row.innerHTML = `
        <div class="ingredient-header">
            <span>Ingredience</span>
            <button type="button" class="btn-remove-ing">Odstranit</button>
        </div>
        <div class="input-group">
            <input type="text" placeholder="Název (např. Mouka)" class="ing-name" required>
        </div>
        <div class="ing-inputs-grid">
            <div class="input-group">
                <input type="number" placeholder="kcal / 100g" class="ing-kcal" required>
            </div>
            <div class="input-group">
                <input type="number" placeholder="gramy" class="ing-grams" required>
            </div>
        </div>
    `;
    row.querySelector('.btn-remove-ing').onclick = () => { if (el.ingredientsListForm.children.length > 1) row.remove(); };
    el.ingredientsListForm.appendChild(row);
}

function calculateRecipeTotals(ingredients) {
    let totalWeight = 0; let totalKcal = 0;
    ingredients.forEach(ing => { totalWeight += ing.grams; totalKcal += (ing.kcal100 * ing.grams) / 100; });
    return { totalWeight, totalKcal };
}

function renderSelectRecipeList() {
    if (!el.listSelectRecipe) return;
    el.listSelectRecipe.innerHTML = '';
    const validRecipes = state.recipes.filter(r => !r.incompatible);
    if (validRecipes.length === 0) el.placeholderSelectRecipe.classList.remove('hidden');
    else {
        el.placeholderSelectRecipe.classList.add('hidden');
        validRecipes.forEach(r => {
            const { totalWeight, totalKcal } = calculateRecipeTotals(r.ingredients);
            const li = document.createElement('li'); 
            li.className = 'recipe-card';
            li.innerHTML = `
                <div class="recipe-info">
                    <span class="recipe-name-main">${r.name}</span>
                    <span class="recipe-meta-sub">${Math.round(totalKcal)} kcal / ${totalWeight} g</span>
                </div>
                <button class="add-recipe-btn" title="Použít recept">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>
                </button>
            `;
            li.querySelector('.add-recipe-btn').onclick = (e) => { 
                e.stopPropagation();
                selectedRecipeForConsume = r; 
                toggleOverlay(el.overlaySelectRecipe, false); 
                openConsumeOverlay(r); 
            };
            el.listSelectRecipe.appendChild(li);
        });
    }
}

function openConsumeOverlay(recipe) {
    const { totalWeight, totalKcal } = calculateRecipeTotals(recipe.ingredients);
    el.consumeRecipeTitle.textContent = recipe.name;
    el.consumeRecipeInfo.textContent = `Celý recept: ${Math.round(totalKcal)} kcal / ${totalWeight} g`;
    el.inputConsumeGrams.value = totalWeight;
    toggleOverlay(el.overlayConsumeRecipe, true);
}

function render() {
    const total = getTotalCalories();
    if (el.current) el.current.textContent = Math.round(total);
    if (el.target) el.target.textContent = state.target;
    if (el.progress) {
        const pct = Math.min((total / state.target) * 100, 100);
        el.progress.style.width = `${pct}%`;
        el.progress.className = total > state.target ? 'progress-fill over-limit' : 'progress-fill';
    }
    if (el.weight && document.activeElement !== el.weight) el.weight.value = state.weight || '';
    if (el.inputTargetKcal && document.activeElement !== el.inputTargetKcal) el.inputTargetKcal.value = state.target;

    if (el.dailyList) {
        el.dailyList.innerHTML = '';
        if (state.items.length > 0) {
            el.dailyListContainer.classList.remove('hidden');
            [...state.items].reverse().forEach(item => {
                const li = document.createElement('li'); 
                li.className = 'list-item-v2';
                li.innerHTML = `
                    <div class="item-main-info">
                        <span class="item-name">${item.name}</span>
                    </div>
                    <div class="item-right-group">
                        <span class="item-kcal-v2">${Math.round(item.kcal)} kcal</span>
                        <button class="btn-delete-small" title="Smazat">✕</button>
                    </div>
                `;
                li.querySelector('.btn-delete-small').onclick = () => deleteItem(item.id);
                el.dailyList.appendChild(li);
            });
        } else el.dailyListContainer.classList.add('hidden');
    }

    if (el.recipesList) {
        el.recipesList.innerHTML = '';
        if (state.recipes.length > 0) {
            el.recipesPlaceholder.classList.add('hidden');
            state.recipes.forEach(r => {
                const li = document.createElement('li'); 
                li.className = 'recipe-card';
                if (r.incompatible) {
                    li.style.opacity = '0.5';
                    li.innerHTML = `<div class="recipe-info"><span class="recipe-name-main">${r.name}</span><span class="recipe-meta-sub">Nekompatibilní verze</span></div><button class="btn-delete-small">🗑️</button>`;
                } else {
                    const { totalWeight, totalKcal } = calculateRecipeTotals(r.ingredients);
                    li.innerHTML = `
                        <div class="recipe-info">
                            <span class="recipe-name-main">${r.name}</span>
                            <span class="recipe-meta-sub">${Math.round(totalKcal)} kcal / ${totalWeight} g</span>
                        </div>
                        <button class="btn-delete-small" title="Smazat recept">
                            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                        </button>
                    `;
                }
                li.querySelector('.btn-delete-small').onclick = (e) => { e.stopPropagation(); deleteRecipe(r.id); };
                el.recipesList.appendChild(li);
            });
        } else el.recipesPlaceholder.classList.remove('hidden');
    }

    if (state.activeView === 'stats') renderStats();

    Object.keys(el.views).forEach(key => {
        const isActive = key === state.activeView;
        if (el.views[key]) { el.views[key].classList.toggle('active', isActive); el.views[key].classList.toggle('hidden', !isActive); }
        if (el.nav[key]) { el.nav[key].classList.toggle('active', isActive); }
    });
}

function renderStats() {
    if (!el.statsContent) return;
    const allDates = Object.keys(state.history).sort();
    if (allDates.length === 0) { el.statsContent.innerHTML = '<div class="center-placeholder"><p>Zatím nejsou k dispozici žádná data.</p></div>'; return; }
    const weightData = allDates.filter(d => state.history[d].weight !== null && state.history[d].weight !== undefined).map(d => ({ date: d, value: state.history[d].weight }));
    let html = '';
    if (weightData.length > 0) html += `<div class="chart-container growable-chart"><h3>Vývoj váhy (kg)</h3><div class="svg-chart-wrapper responsive-svg-container">${generateWeightSVG(weightData)}</div></div>`;
    else html += `<div class="chart-container"><p style="opacity:0.5; font-size:0.8rem;">Zatím nejsou data o váze.</p></div>`;
    html += '<h3 style="margin: 20px 0 10px 12px; font-size: 1rem; opacity: 0.7;">Historie dní</h3><ul class="daily-list" style="flex-shrink: 0;">';
    [...allDates].reverse().forEach(d => {
        const h = state.history[d];
        const dayLabel = new Date(d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
        html += `<li class="list-item"><span>${dayLabel}</span><div style="text-align:right"><div>${Math.round(h.total)} kcal</div><div style="font-size:0.8em;opacity:0.7">${h.weight ? h.weight + ' kg' : '-'}</div></div></li>`;
    });
    html += '</ul>'; el.statsContent.innerHTML = html;
}

function generateWeightSVG(data) {
    const width = 1000; const height = 500; const paddingX = 60; const paddingY = 40;
    const minW = 40; const maxW = 70; const rangeW = 30;
    const getX = (index) => paddingX + (index * (width - 2 * paddingX) / (data.length - 1 || 1));
    const getY = (val) => { const clipped = Math.max(minW, Math.min(maxW, val)); return height - paddingY - ((clipped - minW) / rangeW * (height - 2 * paddingY)); };
    let pts = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;"><line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="#C4C6CF" stroke-width="2" /><line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${height - paddingY}" stroke="#C4C6CF" stroke-width="2" />${[40, 50, 60, 70].map(v => `<line x1="${paddingX - 5}" y1="${getY(v)}" x2="${paddingX}" y2="${getY(v)}" stroke="#C4C6CF" stroke-width="2" /><text x="${paddingX - 10}" y="${getY(v) + 5}" font-size="16" text-anchor="end" fill="#74777F">${v}</text>`).join('')}<polyline fill="none" stroke="var(--md-sys-color-primary)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />`;
    data.forEach((d, i) => { const x = getX(i); const y = getY(d.value); svg += `<circle cx="${x}" cy="${y}" r="6" fill="var(--md-sys-color-primary)" />`; if (data.length < 12 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) { const lbl = new Date(d.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }); svg += `<text x="${x}" y="${height - 10}" font-size="16" text-anchor="middle" fill="#74777F">${lbl}</text>`; } });
    return svg + `</svg>`;
}

// --- EVENTS ---

function bindEvents() {
    if (el.btnDebugReset) el.btnDebugReset.onclick = hardResetApp;
    if (el.nav.overview) el.nav.overview.onclick = () => switchView('overview');
    if (el.nav.foods) el.nav.foods.onclick = () => switchView('foods');
    if (el.nav.stats) el.nav.stats.onclick = () => switchView('stats');
    if (el.nav.settings) el.nav.settings.onclick = () => switchView('settings');

    if (el.btnOpenAddRecipe) el.btnOpenAddRecipe.onclick = () => { renderSelectRecipeList(); toggleOverlay(el.overlaySelectRecipe, true); };
    if (el.btnOpenAddCal) el.btnOpenAddCal.onclick = () => toggleOverlay(el.overlayAddCal, true);
    if (el.btnCreateRecipe) el.btnCreateRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, true);
    if (el.btnAddIngredient) el.btnAddIngredient.onclick = () => addIngredientRow();
    if (el.btnSaveSettings) el.btnSaveSettings.onclick = () => { updateTargetKcal(el.inputTargetKcal.value); switchView('overview'); };

    if (el.btnCloseAddCal) el.btnCloseAddCal.onclick = () => toggleOverlay(el.overlayAddCal, false);
    if (el.btnCloseAddRecipe) el.btnCloseAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, false);
    if (el.btnCloseSelectRecipe) el.btnCloseSelectRecipe.onclick = () => toggleOverlay(el.overlaySelectRecipe, false);
    if (el.btnCloseConsumeRecipe) el.btnCloseConsumeRecipe.onclick = () => toggleOverlay(el.overlayConsumeRecipe, false);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleOverlay(el.overlayAddCal, false); toggleOverlay(el.overlayAddRecipe, false);
            toggleOverlay(el.overlaySelectRecipe, false); toggleOverlay(el.overlayConsumeRecipe, false);
        }
    });

    if (el.formAddCal) el.formAddCal.onsubmit = (e) => {
        e.preventDefault();
        const n = el.inputName.value.trim(); const k = parseFloat(el.inputKcal100.value); const g = parseFloat(el.inputGrams.value);
        if (n && k > 0 && g > 0) { addItem(n, Math.round((k * g) / 100)); toggleOverlay(el.overlayAddCal, false); }
    };

    if (el.formAddRecipe) el.formAddRecipe.onsubmit = (e) => {
        e.preventDefault();
        const name = el.inputRecipeName.value.trim();
        const rows = el.ingredientsListForm.querySelectorAll('.ingredient-card');
        const ingredients = [];
        rows.forEach(row => {
            const ingName = row.querySelector('.ing-name').value.trim();
            const ingKcal = parseFloat(row.querySelector('.ing-kcal').value);
            const ingGrams = parseFloat(row.querySelector('.ing-grams').value);
            if (ingName && ingKcal >= 0 && ingGrams > 0) ingredients.push({ name: ingName, kcal100: ingKcal, grams: ingGrams });
        });
        if (name && ingredients.length > 0) { state.recipes.push({ id: Date.now(), name, ingredients }); saveState(); render(); toggleOverlay(el.overlayAddRecipe, false); }
    };

    if (el.formConsumeRecipe) el.formConsumeRecipe.onsubmit = (e) => {
        e.preventDefault();
        if (!selectedRecipeForConsume) return;
        const gramsEaten = parseFloat(el.inputConsumeGrams.value);
        if (gramsEaten > 0) {
            const { totalWeight, totalKcal } = calculateRecipeTotals(selectedRecipeForConsume.ingredients);
            addItem(selectedRecipeForConsume.name, totalKcal * (gramsEaten / totalWeight));
            toggleOverlay(el.overlayConsumeRecipe, false);
            selectedRecipeForConsume = null;
        }
    };

    if (el.weight) el.weight.oninput = (e) => updateWeight(e.target.value);
    if (el.btnWeightConfirm) { el.btnWeightConfirm.onclick = () => { if (el.weight) updateWeight(el.weight.value); }; }
    if (el.inputTargetKcal) el.inputTargetKcal.oninput = (e) => updateTargetKcal(e.target.value);

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkDateAndReset(); render(); } });
}

function registerServiceWorker() { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(console.error); } }
document.addEventListener('DOMContentLoaded', init);