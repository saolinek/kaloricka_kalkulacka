// Definice verze pro cache management (při změně logiky zvýšit)
const APP_VERSION = 'v1.5.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// State management
let state = {
    date: null,
    total: 0,
    target: 2200,
    weight: null,
    activeView: 'overview' // overview | foods | stats
};

// DOM Elements
const elements = {
    // Dashboard
    displayCurrent: document.getElementById('display-current'),
    displayTarget: document.getElementById('display-target'),
    progressFill: document.getElementById('progress-fill'),
    
    // Inputs
    weightInput: document.getElementById('weight-input'),
    form: document.getElementById('add-form'),
    calorieInput: document.getElementById('calorie-input'),
    
    // Views & Nav
    views: {
        overview: document.getElementById('view-overview'),
        foods: document.getElementById('view-foods'),
        stats: document.getElementById('view-stats')
    },
    navButtons: {
        overview: document.getElementById('nav-overview'),
        foods: document.getElementById('nav-foods'),
        stats: document.getElementById('nav-stats')
    }
};

/**
 * Inicializace aplikace
 */
function init() {
    console.log(`[App] Init ${APP_VERSION}`);
    loadState();
    
    // Default values migration
    if (!state.activeView) state.activeView = 'overview';
    if (!state.target) state.target = 2200;
    // weight can remain null/undefined

    checkDateAndReset();
    render();
    
    const versionDisplay = document.getElementById('app-version-display');
    if (versionDisplay) versionDisplay.textContent = APP_VERSION;
    
    registerServiceWorker();
    setupEventListeners();
}

/**
 * Načtení stavu z LocalStorage
 */
function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            state = { ...state, ...parsed };
        }
    } catch (e) {
        console.error("Chyba při načítání stavu", e);
    }
}

/**
 * Uložení stavu do LocalStorage
 */
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Chyba při ukládání stavu", e);
    }
}

/**
 * Kontrola data - pokud je nový den, resetuje počítadlo
 */
function checkDateAndReset() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (state.date !== today) {
        console.log(`[App] Nový den detekován. Reset: ${state.date} -> ${today}`);
        state.date = today;
        state.total = 0;
        state.weight = null; // Reset váhy pro nový den
        saveState();
    }
}

/**
 * Změna aktivního pohledu
 */
function switchView(viewName) {
    if (state.activeView === viewName) return;
    state.activeView = viewName;
    saveState();
    render();
}

/**
 * Vykreslení UI podle stavu
 */
function render() {
    // 1. Render Dashboard Data
    if (elements.displayCurrent) {
        elements.displayCurrent.textContent = state.total;
        elements.displayTarget.textContent = state.target;
        
        // Progress Bar Calculation
        const percentage = Math.min((state.total / state.target) * 100, 100);
        elements.progressFill.style.width = `${percentage}%`;
        
        // Color change based on completion (optional visual cue, staying simple for now)
        if (state.total > state.target) {
            elements.progressFill.classList.add('over-limit');
        } else {
            elements.progressFill.classList.remove('over-limit');
        }
    }

    // 2. Render Inputs
    if (elements.weightInput) {
        // Only update if not focused to avoid cursor jumping, or if empty
        if (document.activeElement !== elements.weightInput) {
            elements.weightInput.value = state.weight || '';
        }
    }

    // 3. Render Views (visibility)
    Object.keys(elements.views).forEach(key => {
        const el = elements.views[key];
        if (!el) return;
        if (key === state.activeView) {
            el.classList.add('active');
            el.classList.remove('hidden');
        } else {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });

    // 4. Render Nav (active state)
    Object.keys(elements.navButtons).forEach(key => {
        const btn = elements.navButtons[key];
        if (!btn) return;
        if (key === state.activeView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Přidání kalorií
 */
function addCalories(amount) {
    if (!amount || amount <= 0) return;
    checkDateAndReset();
    state.total += parseInt(amount, 10);
    saveState();
    render();
}

/**
 * Změna váhy
 */
function updateWeight(val) {
    checkDateAndReset();
    state.weight = val ? parseFloat(val) : null;
    saveState();
    // No explicit render call needed here usually if input is bound, but good practice
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    if (elements.form) {
        elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = elements.calorieInput.value;
            if (val) {
                addCalories(val);
                elements.calorieInput.value = '';
                elements.calorieInput.blur();
            }
        });
    }

    if (elements.weightInput) {
        elements.weightInput.addEventListener('input', (e) => {
            updateWeight(e.target.value);
        });
    }

    // Navigace
    if (elements.navButtons.overview) elements.navButtons.overview.addEventListener('click', () => switchView('overview'));
    if (elements.navButtons.foods) elements.navButtons.foods.addEventListener('click', () => switchView('foods'));
    if (elements.navButtons.stats) elements.navButtons.stats.addEventListener('click', () => switchView('stats'));

    // Kontrola data při návratu do okna
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkDateAndReset();
            render();
        }
    });
}

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