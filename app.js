// Definice verze pro cache management (při změně logiky zvýšit)
const APP_VERSION = 'v1.0.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// State management
let state = {
    date: null,
    total: 0
};

// DOM Elements
const elements = {
    totalDisplay: document.getElementById('total-display'),
    form: document.getElementById('add-form'),
    input: document.getElementById('calorie-input')
};

/**
 * Inicializace aplikace
 */
function init() {
    console.log(`[App] Init ${APP_VERSION}`);
    loadState();
    checkDateAndReset();
    render();
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
            state = JSON.parse(stored);
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
        saveState();
    }
}

/**
 * Vykreslení UI podle stavu
 */
function render() {
    elements.totalDisplay.textContent = state.total;
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
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = elements.input.value;
        if (val) {
            addCalories(val);
            elements.input.value = '';
            elements.input.blur(); // Skryje klávesnici na mobilu
        }
    });

    // Kontrola data při návratu do okna (proti stale data pokud aplikace běžela na pozadí přes půlnoc)
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