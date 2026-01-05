// Firebase SDK Imports (Modular CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

const APP_VERSION = 'v1.42.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyB_dnACYt-hW0J1_H4-fteRMZ-ps5gXH4U",
  authDomain: "kaloricka-kalkulacka.firebaseapp.com",
  projectId: "kaloricka-kalkulacka",
  storageBucket: "kaloricka-kalkulacka.firebasestorage.app",
  messagingSenderId: "1033390420010",
  appId: "1:1033390420010:web:230d237833ba36abdc9353",
  measurementId: "G-5694GG9PPL"
};

// Initialize Firebase (fail-safe)
let app, auth, provider, analytics;
try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        provider = new GoogleAuthProvider();
        if (firebaseConfig.measurementId) {
            analytics = getAnalytics(app);
        }
    }
} catch (e) {
    console.error("Firebase init fail", e);
}

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

// Auth State
let currentUser = null;

// --- DATE HELPERS ---

function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let selectedRecipeForConsume = null;
let editingRecipeId = null;
let el = {};

function init() {
    console.log(`[App] Booting ${APP_VERSION}...`);
    
    el = {
        settingsVersion: document.getElementById('settings-version-display'),
        authUnlogged: document.getElementById('auth-unlogged'),
        authLogged: document.getElementById('auth-logged'),
        userName: document.getElementById('user-name'),
        userEmail: document.getElementById('user-email'),
        btnLoginGoogle: document.getElementById('btn-login-google'),
        btnLogout: document.getElementById('btn-logout'),
        current: document.getElementById('display-current'),
        target: document.getElementById('display-target'),
        progress: document.getElementById('progress-fill'),
        weight: document.getElementById('weight-input'),
        btnWeightConfirm: document.getElementById('btn-weight-confirm'),
        dailyList: document.getElementById('daily-list'),
        dailyListContainer: document.getElementById('daily-list-container'),
        recipesList: document.getElementById('recipes-list'),
        recipesPlaceholder: document.getElementById('recipes-placeholder'),
        
        // Stats Elements
        statsChartContainer: document.getElementById('stats-chart-container'),
        btnShowHistory: document.getElementById('btn-show-history'),
        historySheet: document.getElementById('stats-history-sheet'),
        btnCloseHistory: document.getElementById('btn-close-history'),
        historyListContainer: document.getElementById('stats-history-list'),
        sheetBackdrop: document.getElementById('sheet-backdrop'),

        listSelectRecipe: document.getElementById('list-select-recipe'),
        placeholderSelectRecipe: document.getElementById('placeholder-select-recipe'),
        views: { overview: document.getElementById('view-overview'), foods: document.getElementById('view-foods'), stats: document.getElementById('view-stats'), settings: document.getElementById('view-settings') },
        nav: { overview: document.getElementById('nav-overview'), foods: document.getElementById('nav-foods'), stats: document.getElementById('nav-stats'), settings: document.getElementById('nav-settings') },
        overlayAddCal: document.getElementById('overlay-add-cal'),
        overlayAddRecipe: document.getElementById('overlay-add-recipe'),
        overlaySelectRecipe: document.getElementById('overlay-select-recipe'),
        overlayConsumeRecipe: document.getElementById('overlay-consume-recipe'),
        btnOpenAddCal: document.getElementById('btn-open-add-cal'),
        btnOpenAddRecipe: document.getElementById('btn-open-add-recipe'),
        btnCreateRecipe: document.getElementById('btn-create-recipe'),
        btnAddIngredient: document.getElementById('btn-add-ingredient'),
        btnSaveSettings: document.getElementById('btn-save-settings'),
        btnCloseAddCal: document.getElementById('btn-close-add-cal'),
        btnCloseAddRecipe: document.getElementById('btn-close-add-recipe'),
        btnCloseSelectRecipe: document.getElementById('btn-close-select-recipe'),
        btnCloseConsumeRecipe: document.getElementById('btn-close-consume-recipe'),
        formAddCal: document.getElementById('form-add-cal'),
        formAddRecipe: document.getElementById('form-add-recipe'),
        formConsumeRecipe: document.getElementById('form-consume-recipe'),
        inputName: document.getElementById('input-name'),
        inputKcal100: document.getElementById('input-kcal-100'),
        inputGrams: document.getElementById('input-grams'),
        inputRecipeName: document.getElementById('input-recipe-name'),
        ingredientsListForm: document.getElementById('ingredients-list-form'),
        inputConsumeGrams: document.getElementById('input-consume-grams'),
        consumeRecipeTitle: document.getElementById('consume-recipe-title'),
        consumeRecipeInfo: document.getElementById('consume-recipe-info'),
        inputTargetKcal: document.getElementById('input-target-kcal'),
        addRecipeTitle: document.querySelector('#overlay-add-recipe h2'),
        btnSaveRecipe: document.querySelector('#form-add-recipe button[type="submit"]'),
        recipeActions: document.querySelector('#form-add-recipe .overlay-actions')
    };

    if (el.settingsVersion) el.settingsVersion.textContent = APP_VERSION;

    // MANDATORY: Hard Default State
    if (el.authUnlogged) el.authUnlogged.classList.remove('hidden');
    if (el.authLogged) el.authLogged.classList.add('hidden');

    loadState();
    checkDateAndReset();
    bindEvents();
    if (auth) initAuth();
    render();
    registerServiceWorker();
}

// --- AUTH ---

function initAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        renderAuth(user);
    });
}

async function loginGoogle() {
    if (!auth) return;
    try { await signInWithPopup(auth, provider); }
    catch (e) { console.error("Login fail", e); }
}

async function logoutUser() {
    if (!auth) return;
    try { await signOut(auth); } catch (e) { console.error("Logout fail", e); }
}

function renderAuth(user) {
    if (!el.authUnlogged || !el.authLogged) return;
    if (user) {
        el.authUnlogged.classList.add('hidden');
        el.authLogged.classList.remove('hidden');
        if (el.userName) el.userName.textContent = user.displayName || "Uživatel";
        if (el.userEmail) el.userEmail.textContent = user.email;
    } else {
        el.authUnlogged.classList.remove('hidden');
        el.authLogged.classList.add('hidden');
        if (el.userName) el.userName.textContent = "";
        if (el.userEmail) el.userEmail.textContent = "";
    }
}

// --- DATA ---

function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            state = { ...state, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [], recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [], history: parsed.history || {} };
            // Ensure ID and Ingredients
            state.recipes = state.recipes.map(r => {
                let updated = r;
                if (!updated.id) updated.id = Date.now() + Math.random(); 
                if (!updated.ingredients) updated = { ...updated, ingredients: [], incompatible: true };
                return updated;
            });
        }
    } catch (e) { console.error("Load fail", e); }
}

function saveState() {
    try {
        if (state.date) state.history[state.date] = { total: getTotalCalories(), weight: state.weight };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.error("Save fail", e); }
}

function checkDateAndReset() {
    const today = getLocalDateString();
    if (state.date && state.date !== today) {
        state.history[state.date] = { total: getTotalCalories(), weight: state.weight };
        state.items = []; state.weight = null;
    }
    state.date = today;
    saveState();
}

function getTotalCalories() { return state.items.reduce((sum, item) => sum + item.kcal, 0); }

function addItem(name, kcal) { checkDateAndReset(); state.items.push({ id: Date.now(), name, kcal: parseInt(kcal) }); saveState(); render(); }
function deleteItem(id) { state.items = state.items.filter(i => i.id !== id); saveState(); render(); }
function deleteRecipe(id) { state.recipes = state.recipes.filter(r => r.id !== id); saveState(); render(); }
function updateWeight(val) { checkDateAndReset(); state.weight = val ? parseFloat(val) : null; saveState(); }
function updateTargetKcal(val) { const v = parseInt(val); if (!isNaN(v) && v > 0) { state.target = v; saveState(); render(); } }
function switchView(viewName) { state.activeView = viewName; saveState(); render(); }

function deleteHistoryDay(date) {
    if (!confirm(`Opravdu smazat záznam pro ${new Date(date).toLocaleDateString('cs-CZ')}? Akce je nevratná.`)) return;
    
    // If deleting today, clear current state
    if (date === state.date) {
        state.items = [];
        state.weight = null; // Also clear today's weight if deleting the day
    }
    
    delete state.history[date];
    saveState();
    render();
}

function deleteHistoryWeight(date) {
    if (!confirm(`Smazat váhu pro ${new Date(date).toLocaleDateString('cs-CZ')}?`)) return;
    
    // If deleting today, clear current weight
    if (date === state.date) {
        state.weight = null;
    }
    
    if (state.history[date]) {
        state.history[date].weight = null;
    }
    
    saveState();
    render();
}

async function hardResetApp() {
    if (!confirm("⚠️ OPRAVDU vymazat všechna data, cache a restartovat aplikaci?")) return;
    try {
        localStorage.clear(); sessionStorage.clear();
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
        window.location.reload(true);
    } catch (err) { window.location.reload(); }
}

// --- UI HELPERS ---

function toggleOverlay(overlay, show) {
    if (!overlay) return;
    overlay.classList.toggle('active', show);
    if (show) { const inp = overlay.querySelector('input'); if (inp) setTimeout(() => inp.focus(), 50); }
    else { 
        const form = overlay.querySelector('form'); 
        if (form) form.reset(); 
        if (overlay === el.overlayAddRecipe) { 
            // Reset modal state on close
            editingRecipeId = null;
            el.ingredientsListForm.innerHTML = ''; 
            // We don't add default row here anymore, will be handled by open logic
        } 
    }
}

function openRecipeModal(recipe = null) {
    el.ingredientsListForm.innerHTML = '';
    
    // Remove existing cancel button if any
    const existingCancel = el.recipeActions.querySelector('.btn-cancel-edit');
    if (existingCancel) existingCancel.remove();

    if (recipe) {
        // Edit mode
        editingRecipeId = recipe.id;
        if (el.addRecipeTitle) el.addRecipeTitle.textContent = "Upravit recept";
        if (el.btnSaveRecipe) el.btnSaveRecipe.textContent = "Uložit změny";
        el.inputRecipeName.value = recipe.name;
        
        recipe.ingredients.forEach(ing => {
            addIngredientRow(ing.name, ing.kcal100, ing.grams);
        });
        
        if (recipe.ingredients.length === 0) addIngredientRow();

        // Add Cancel Button
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'full-width-btn secondary btn-cancel-edit';
        btnCancel.textContent = 'Zrušit změny';
        btnCancel.style.marginTop = '10px';
        btnCancel.style.border = '1px solid var(--md-sys-color-outline)';
        btnCancel.style.color = 'var(--md-sys-color-on-surface)';
        btnCancel.onclick = () => toggleOverlay(el.overlayAddRecipe, false);
        el.recipeActions.appendChild(btnCancel);

    } else {
        // Create mode
        editingRecipeId = null;
        if (el.addRecipeTitle) el.addRecipeTitle.textContent = "Nový recept";
        if (el.btnSaveRecipe) el.btnSaveRecipe.textContent = "Uložit recept";
        el.inputRecipeName.value = "";
        addIngredientRow(); 
    }
    
    updateIngredientRemoveButtons();
    toggleOverlay(el.overlayAddRecipe, true);
}

function updateIngredientRemoveButtons() {
    const rows = el.ingredientsListForm.querySelectorAll('.ingredient-card');
    const count = rows.length;
    rows.forEach(row => {
        const btn = row.querySelector('.btn-remove-ing');
        if (btn) {
            btn.style.display = count <= 1 ? 'none' : 'block';
        }
    });
}

function addIngredientRow(name = '', kcal = '', grams = '') {
    const row = document.createElement('div'); row.className = 'ingredient-card';
    row.innerHTML = `
        <div class="ingredient-header">
            <span>Ingredience</span>
            <button type="button" class="btn-remove-ing">Odstranit</button>
        </div>
        <div class="input-group">
            <input type="text" placeholder="Název" class="ing-name" required value="${name}">
        </div>
        <div class="ing-inputs-grid">
            <div class="input-group">
                <div class="input-suffix-group">
                    <input type="number" placeholder="0" class="ing-kcal" required value="${kcal}">
                    <span class="suffix">kcal</span>
                </div>
            </div>
            <div class="input-group">
                <div class="input-suffix-group">
                    <input type="number" placeholder="0" class="ing-grams" required value="${grams}">
                    <span class="suffix">g</span>
                </div>
            </div>
        </div>`;
    row.querySelector('.btn-remove-ing').onclick = () => { 
        if (el.ingredientsListForm.children.length > 1) {
            row.remove();
            updateIngredientRemoveButtons();
        }
    };
    el.ingredientsListForm.appendChild(row);
    updateIngredientRemoveButtons();
}

function calculateRecipeTotals(ings) { let w = 0; let k = 0; ings.forEach(i => { w += i.grams; k += (i.kcal100 * i.grams) / 100; }); return { totalWeight: w, totalKcal: k }; }

function renderSelectRecipeList() {
    if (!el.listSelectRecipe) return; el.listSelectRecipe.innerHTML = '';
    const valid = state.recipes.filter(r => !r.incompatible);
    if (valid.length === 0) el.placeholderSelectRecipe.classList.remove('hidden');
    else {
        el.placeholderSelectRecipe.classList.add('hidden');
        valid.forEach(r => {
            const { totalWeight, totalKcal } = calculateRecipeTotals(r.ingredients);
            const li = document.createElement('li'); li.className = 'recipe-card';
            li.innerHTML = `<div class="recipe-info"><span class="recipe-name-main">${r.name}</span><span class="recipe-meta-sub">${Math.round(totalKcal)} kcal / ${totalWeight} g</span></div><button class="add-recipe-btn"><svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg></button>`;
            li.querySelector('.add-recipe-btn').onclick = (e) => { e.stopPropagation(); selectedRecipeForConsume = r; toggleOverlay(el.overlaySelectRecipe, false); openConsumeOverlay(r); };
            el.listSelectRecipe.appendChild(li);
        });
    }
}

function openConsumeOverlay(recipe) { const { totalWeight, totalKcal } = calculateRecipeTotals(recipe.ingredients); el.consumeRecipeTitle.textContent = recipe.name; el.consumeRecipeInfo.textContent = `Celý recept: ${Math.round(totalKcal)} kcal / ${totalWeight} g`; el.inputConsumeGrams.value = totalWeight; toggleOverlay(el.overlayConsumeRecipe, true); }

function render() {
    const total = getTotalCalories();
    if (el.current) el.current.textContent = Math.round(total);
    if (el.target) el.target.textContent = state.target;
    if (el.progress) { const pct = Math.min((total / state.target) * 100, 100); el.progress.style.width = `${pct}%`; el.progress.className = total > state.target ? 'progress-fill over-limit' : 'progress-fill'; }
    if (el.weight && document.activeElement !== el.weight) el.weight.value = state.weight || '';
    if (el.inputTargetKcal && document.activeElement !== el.inputTargetKcal) el.inputTargetKcal.value = state.target;

    if (el.dailyList) {
        el.dailyList.innerHTML = '';
        if (state.items.length > 0) {
            el.dailyListContainer.classList.remove('hidden');
            [...state.items].reverse().forEach(item => {
                const li = document.createElement('li'); li.className = 'list-item-v2';
                li.innerHTML = `<div class="item-main-info"><span class="item-name">${item.name}</span></div><div class="item-right-group"><span class="item-kcal-v2">${Math.round(item.kcal)} kcal</span><button class="btn-delete-small">✕</button></div>`;
                li.querySelector('.btn-delete-small').onclick = () => deleteItem(item.id); el.dailyList.appendChild(li);
            });
        } else el.dailyListContainer.classList.add('hidden');
    }

    if (el.recipesList) {
        el.recipesList.innerHTML = '';
        if (state.recipes.length > 0) {
            el.recipesPlaceholder.classList.add('hidden');
            state.recipes.forEach(r => {
                const li = document.createElement('li'); li.className = 'recipe-card';
                if (r.incompatible) { 
                    li.style.opacity = '0.5'; 
                    li.innerHTML = `<div class="recipe-info"><span class="recipe-name-main">${r.name}</span><span class="recipe-meta-sub">Nekompatibilní verze</span></div><button class="btn-delete-small">🗑️</button>`; 
                    li.querySelector('.btn-delete-small').onclick = (e) => { e.stopPropagation(); deleteRecipe(r.id); };
                }
                else { 
                    const { totalWeight, totalKcal } = calculateRecipeTotals(r.ingredients); 
                    li.innerHTML = `
                        <div class="recipe-info" style="cursor: pointer; flex: 1;">
                            <span class="recipe-name-main">${r.name}</span>
                            <span class="recipe-meta-sub">${Math.round(totalKcal)} kcal / ${totalWeight} g</span>
                        </div>
                        <div class="recipe-actions">
                            <button class="btn-mobile-touch edit" title="Upravit">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
                            </button>
                            <button class="btn-mobile-touch delete" title="Smazat">
                                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                            </button>
                        </div>`; 
                    li.querySelector('.recipe-info').onclick = () => openRecipeModal(r);
                    li.querySelector('.btn-mobile-touch.edit').onclick = (e) => { e.stopPropagation(); openRecipeModal(r); };
                    li.querySelector('.btn-mobile-touch.delete').onclick = (e) => { e.stopPropagation(); if(confirm(`Opravdu smazat recept "${r.name}"?`)) deleteRecipe(r.id); }; 
                }
                el.recipesList.appendChild(li);
            });
        } else el.recipesPlaceholder.classList.remove('hidden');
    }

    if (state.activeView === 'stats') renderStats();

    Object.keys(el.views).forEach(key => { const isActive = key === state.activeView; if (el.views[key]) { el.views[key].classList.toggle('active', isActive); el.views[key].classList.toggle('hidden', !isActive); } if (el.nav[key]) el.nav[key].classList.toggle('active', isActive); });
}

function renderStats() {
    // 1. Generate Content
    const all = Object.keys(state.history).sort();
    const wData = all.filter(d => state.history[d].weight).map(d => ({ date: d, value: state.history[d].weight }));
    
    // Clear containers
    if(el.statsChartContainer) el.statsChartContainer.innerHTML = '';
    if(el.historyListContainer) el.historyListContainer.innerHTML = '';

    // Render Chart (Top Area)
    if (wData.length > 0) {
        if(el.statsChartContainer) el.statsChartContainer.innerHTML = `<h3 style="margin-bottom:10px; font-size:1rem; opacity:0.8;">Vývoj váhy</h3><div class="svg-chart-wrapper responsive-svg-container" style="flex:1;">${generateWeightSVG(wData)}</div>`;
    } else {
        if(el.statsChartContainer) el.statsChartContainer.innerHTML = `<div class="center-placeholder"><p style="opacity:0.5;">Zatím žádná data o váze.</p></div>`;
    }

    // Render List (Bottom Sheet Content)
    if (all.length === 0) {
        if(el.historyListContainer) el.historyListContainer.innerHTML = '<p style="text-align:center; opacity:0.6;">Žádná historie.</p>';
    } else {
        const ul = document.createElement('ul');
        ul.className = 'daily-list';
        ul.style.paddingBottom = '20px';

        [...all].reverse().forEach(d => { 
            const h = state.history[d]; 
            const lbl = new Date(d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }); 
            
            const li = document.createElement('li');
            li.className = 'list-item-v2';
            
            // Weight Chip logic
            let weightHtml = '';
            if (h.weight) {
                weightHtml = `<div class="weight-chip">
                                ${h.weight} kg 
                                <button class="btn-del-weight" title="Smazat váhu">✕</button>
                              </div>`;
            }

            li.innerHTML = `
                <div class="stats-row">
                    <div class="stats-date">${lbl}</div>
                    <div class="stats-info">
                        <span style="font-weight:500; color:var(--md-sys-color-primary);">${Math.round(h.total)} kcal</span>
                        ${weightHtml}
                    </div>
                    <div class="stats-action">
                        <button class="btn-mobile-touch delete btn-del-day" style="margin-left:8px;" title="Smazat den">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                        </button>
                    </div>
                </div>`;
            
            // Event Listeners
            const btnDelDay = li.querySelector('.btn-del-day');
            if (btnDelDay) btnDelDay.onclick = () => deleteHistoryDay(d);

            const btnDelWeight = li.querySelector('.btn-del-weight');
            if (btnDelWeight) btnDelWeight.onclick = () => deleteHistoryWeight(d);

            ul.appendChild(li);
        });
        
        if(el.historyListContainer) el.historyListContainer.appendChild(ul);
    }
}

function generateWeightSVG(data) {
    const width = 1000; const height = 500; const px = 60; const py = 40; const minW = 50; const maxW = 80; const rangeW = 30;
    const getX = (i) => px + (i * (width - 2 * px) / (data.length - 1 || 1));
    const getY = (v) => { const c = Math.max(minW, Math.min(maxW, v)); return height - py - ((c - minW) / rangeW * (height - 2 * py)); };
    let pts = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;"><line x1="${px}" y1="${height - py}" x2="${width - px}" y2="${height - py}" stroke="#C4C6CF" stroke-width="3" /><line x1="${px}" y1="${py}" x2="${px}" y2="${height - py}" stroke="#C4C6CF" stroke-width="3" />${[50, 60, 70, 80].map(v => `<line x1="${px - 10}" y1="${getY(v)}" x2="${px}" y2="${getY(v)}" stroke="#C4C6CF" stroke-width="3" /><text x="${px - 20}" y="${getY(v) + 8}" font-size="24" font-weight="500" text-anchor="end" fill="#74777F">${v}</text>`).join('')}<polyline fill="none" stroke="var(--md-sys-color-primary)" stroke-width="6" points="${pts}" />`;
    data.forEach((d, i) => { const x = getX(i); const y = getY(d.value); svg += `<circle cx="${x}" cy="${y}" r="10" fill="var(--md-sys-color-primary)" />`; if (data.length < 10 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) { const lbl = new Date(d.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }); svg += `<text x="${x}" y="${height - 15}" font-size="22" font-weight="500" text-anchor="middle" fill="#74777F">${lbl}</text>`; } });
    return svg + `</svg>`;
}

// --- EVENTS ---

function bindEvents() {
    if (el.btnLoginGoogle) el.btnLoginGoogle.onclick = loginGoogle;
    if (el.btnLogout) el.btnLogout.onclick = logoutUser;
    if (el.nav.overview) el.nav.overview.onclick = () => switchView('overview');
    if (el.nav.foods) el.nav.foods.onclick = () => switchView('foods');
    if (el.nav.stats) el.nav.stats.onclick = () => switchView('stats');
    if (el.nav.settings) el.nav.settings.onclick = () => switchView('settings');
    if (el.btnOpenAddRecipe) el.btnOpenAddRecipe.onclick = () => { renderSelectRecipeList(); toggleOverlay(el.overlaySelectRecipe, true); };
    if (el.btnOpenAddCal) el.btnOpenAddCal.onclick = () => toggleOverlay(el.overlayAddCal, true);
    if (el.btnCreateRecipe) el.btnCreateRecipe.onclick = () => openRecipeModal(null); // Changed to openRecipeModal
    if (el.btnAddIngredient) el.btnAddIngredient.onclick = () => addIngredientRow();
    if (el.btnSaveSettings) el.btnSaveSettings.onclick = () => { updateTargetKcal(el.inputTargetKcal.value); switchView('overview'); };
    if (el.btnCloseAddCal) el.btnCloseAddCal.onclick = () => toggleOverlay(el.overlayAddCal, false);
    if (el.btnCloseAddRecipe) el.btnCloseAddRecipe.onclick = () => toggleOverlay(el.overlayAddRecipe, false);
    if (el.btnCloseSelectRecipe) el.btnCloseSelectRecipe.onclick = () => toggleOverlay(el.overlaySelectRecipe, false);
    if (el.btnCloseConsumeRecipe) el.btnCloseConsumeRecipe.onclick = () => toggleOverlay(el.overlayConsumeRecipe, false);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleOverlay(el.overlayAddCal, false); toggleOverlay(el.overlayAddRecipe, false); toggleOverlay(el.overlaySelectRecipe, false); toggleOverlay(el.overlayConsumeRecipe, false); } });
    if (el.formAddCal) el.formAddCal.onsubmit = (e) => { e.preventDefault(); const n = el.inputName.value.trim(); const k = parseFloat(el.inputKcal100.value); const g = parseFloat(el.inputGrams.value); if (n && k > 0 && g > 0) { addItem(n, Math.round((k * g) / 100)); toggleOverlay(el.overlayAddCal, false); } };
    
    // Updated formAddRecipe.onsubmit
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
        
        if (name && ingredients.length > 0) { 
            if (editingRecipeId) {
                // Edit existing
                const idx = state.recipes.findIndex(r => r.id === editingRecipeId);
                if (idx !== -1) {
                    state.recipes[idx] = { ...state.recipes[idx], name, ingredients };
                }
            } else {
                // Create new
                state.recipes.push({ id: Date.now(), name, ingredients }); 
            }
            saveState(); 
            render(); 
            toggleOverlay(el.overlayAddRecipe, false); 
        } 
    };

    if (el.formConsumeRecipe) el.formConsumeRecipe.onsubmit = (e) => { e.preventDefault(); if (!selectedRecipeForConsume) return; const g = parseFloat(el.inputConsumeGrams.value); if (g > 0) { const { totalWeight, totalKcal } = calculateRecipeTotals(selectedRecipeForConsume.ingredients); addItem(selectedRecipeForConsume.name, totalKcal * (g / totalWeight)); toggleOverlay(el.overlayConsumeRecipe, false); selectedRecipeForConsume = null; } };
    if (el.weight) el.weight.oninput = (e) => updateWeight(e.target.value);
    if (el.btnWeightConfirm) el.btnWeightConfirm.onclick = () => { if (el.weight) updateWeight(el.weight.value); };
    if (el.inputTargetKcal) el.inputTargetKcal.oninput = (e) => updateTargetKcal(e.target.value);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkDateAndReset(); render(); } });

    // History Sheet Events
    if (el.btnShowHistory) el.btnShowHistory.onclick = () => {
        if(el.historySheet) el.historySheet.classList.add('active');
        if(el.sheetBackdrop) el.sheetBackdrop.classList.add('active');
    };
    
    const closeHistory = () => {
        if(el.historySheet) el.historySheet.classList.remove('active');
        if(el.sheetBackdrop) el.sheetBackdrop.classList.remove('active');
    };

    if (el.btnCloseHistory) el.btnCloseHistory.onclick = closeHistory;
    if (el.sheetBackdrop) el.sheetBackdrop.onclick = closeHistory;
}

function registerServiceWorker() { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(console.error); } }
document.addEventListener('DOMContentLoaded', init);