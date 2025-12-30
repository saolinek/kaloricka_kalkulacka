// Definice verze pro cache management (při změně logiky zvýšit)
const APP_VERSION = 'v1.4.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// State management
let state = {
    date: null,
    total: 0,
    activeView: 'overview' // overview | foods | stats
};

// DOM Elements
const elements = {
    totalDisplay: document.getElementById('total-display'),
    form: document.getElementById('add-form'),
    input: document.getElementById('calorie-input'),
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
    // Default view if not present (migration from v1.0)
    if (!state.activeView) {
        state.activeView = 'overview';
    }
    checkDateAndReset();
    render();
    document.getElementById('app-version-display').textContent = APP_VERSION;
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
            state = { ...state, ...parsed }; // Merge to ensure new keys exist
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
        // Note: Active view is preserved
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
    // Render Total (data)
    if (elements.totalDisplay) {
        elements.totalDisplay.textContent = state.total;
    }

    // Render Views (visibility)
    Object.keys(elements.views).forEach(key => {
        const el = elements.views[key];
        if (key === state.activeView) {
            el.classList.add('active');
            el.classList.remove('hidden');
        } else {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });

    // Render Nav (active state)
    Object.keys(elements.navButtons).forEach(key => {
        const btn = elements.navButtons[key];
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
    
    // Pojistka: zkontrolovat datum před zápisem
    checkDateAndReset();

    state.total += parseInt(amount, 10);
    saveState();
    render();
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    if (elements.form) {
        elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = elements.input.value;
            if (val) {
                addCalories(val);
                elements.input.value = '';
                elements.input.blur(); // Skryje klávesnici na mobilu
            }
        });
    }

    // Navigace
    elements.navButtons.overview.addEventListener('click', () => switchView('overview'));
    elements.navButtons.foods.addEventListener('click', () => switchView('foods'));
    elements.navButtons.stats.addEventListener('click', () => switchView('stats'));

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