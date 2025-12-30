// Definice verze pro cache management (při změně logiky zvýšit)
const APP_VERSION = 'v1.7.0';
const STORAGE_KEY = 'kaloricka_kalkulacka_state';

// State management
let state = {
    date: null,
    items: [], // [{ name: string, kcal: number, id: number }]
    target: 2200,
    weight: null,
    activeView: 'overview'
};

// DOM Elements
const elements = {
    // Dashboard
    displayCurrent: document.getElementById('display-current'),
    displayTarget: document.getElementById('display-target'),
    progressFill: document.getElementById('progress-fill'),
    weightInput: document.getElementById('weight-input'),
    
    // List
    listContainer: document.getElementById('daily-list-container'),
    listElement: document.getElementById('daily-list'),
    
    // Buttons (Overview)
    btnOpenAddCal: document.getElementById('btn-open-add-cal'),
    btnOpenAddRecipe: document.getElementById('btn-open-add-recipe'),

    // Overlays
    overlayAddCal: document.getElementById('overlay-add-cal'),
    overlayAddRecipe: document.getElementById('overlay-add-recipe'),
    
    // Add Calorie Form Elements
    formAddCal: document.getElementById('form-add-cal'),
    inputName: document.getElementById('input-name'),
    inputKcal100: document.getElementById('input-kcal-100'),
    inputGrams: document.getElementById('input-grams'),
    btnCloseAddCal: document.getElementById('btn-close-add-cal'),
    btnCloseAddRecipe: document.getElementById('btn-close-add-recipe'),
    
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
    if (!Array.isArray(state.items)) state.items = [];

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
            
            // Migration for v1.7.0: Convert old 'total' to an item if items are empty
            if (parsed.total > 0 && (!state.items || state.items.length === 0)) {
                state.items = [{
                    id: Date.now(),
                    name: 'Importováno',
                    kcal: parsed.total
                }];
            }
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
        state.items = []; // Reset seznamu
        state.weight = null;
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
 * Overlay Management
 */
function openOverlay(overlayElement) {
    if (!overlayElement) return;
    overlayElement.classList.add('active');
    const firstInput = overlayElement.querySelector('input');
    if (firstInput) firstInput.focus();
}

function closeOverlay(overlayElement) {
    if (!overlayElement) return;
    overlayElement.classList.remove('active');
    const form = overlayElement.querySelector('form');
    if (form) form.reset();
}

/**
 * Výpočet celkového součtu kalorií
 */
function getTotalCalories() {
    return state.items.reduce((sum, item) => sum + item.kcal, 0);
}

/**
 * Vykreslení UI podle stavu
 */
function render() {
    const currentTotal = getTotalCalories();

    // 1. Render Dashboard Data
    if (elements.displayCurrent) {
        elements.displayCurrent.textContent = currentTotal;
        elements.displayTarget.textContent = state.target;
        
        // Progress Bar Calculation
        const percentage = Math.min((currentTotal / state.target) * 100, 100);
        elements.progressFill.style.width = `${percentage}%`;
        
        if (currentTotal > state.target) {
            elements.progressFill.classList.add('over-limit');
        } else {
            elements.progressFill.classList.remove('over-limit');
        }
    }

    // 2. Render Inputs
    if (elements.weightInput) {
        if (document.activeElement !== elements.weightInput) {
            elements.weightInput.value = state.weight || '';
        }
    }

    // 3. Render List
    renderList();

    // 4. Render Views (visibility)
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

    // 5. Render Nav (active state)
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
 * Vykreslení seznamu položek
 */
function renderList() {
    if (!elements.listContainer || !elements.listElement) return;

    if (state.items.length === 0) {
        elements.listContainer.classList.add('hidden');
        return;
    }

    elements.listContainer.classList.remove('hidden');
    elements.listElement.innerHTML = '';

    // Seřadit od nejnovějšího (reverse order of addition basically)
    // Nebo zachovat pořadí. Zde zachovám pořadí vložení.
    const reversedItems = [...state.items].reverse();

    reversedItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <span class="item-name">${item.name}</span>
            <span class="item-kcal">${item.kcal} kcal</span>
        `;
        elements.listElement.appendChild(li);
    });
}

/**
 * Přidání položky (Item)
 */
function addItem(name, kcal) {
    checkDateAndReset();
    state.items.push({
        id: Date.now(),
        name: name,
        kcal: parseInt(kcal, 10)
    });
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
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    // Weight Input
    if (elements.weightInput) {
        elements.weightInput.addEventListener('input', (e) => {
            updateWeight(e.target.value);
        });
    }

    // Navigace
    if (elements.navButtons.overview) elements.navButtons.overview.addEventListener('click', () => switchView('overview'));
    if (elements.navButtons.foods) elements.navButtons.foods.addEventListener('click', () => switchView('foods'));
    if (elements.navButtons.stats) elements.navButtons.stats.addEventListener('click', () => switchView('stats'));

    // Open Overlays
    if (elements.btnOpenAddCal) elements.btnOpenAddCal.addEventListener('click', () => openOverlay(elements.overlayAddCal));
    if (elements.btnOpenAddRecipe) elements.btnOpenAddRecipe.addEventListener('click', () => openOverlay(elements.overlayAddRecipe));

    // Close Overlays
    if (elements.btnCloseAddCal) elements.btnCloseAddCal.addEventListener('click', () => closeOverlay(elements.overlayAddCal));
    if (elements.btnCloseAddRecipe) elements.btnCloseAddRecipe.addEventListener('click', () => closeOverlay(elements.overlayAddRecipe));

    // Handle Add Calorie Submit
    if (elements.formAddCal) {
        elements.formAddCal.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.inputName.value.trim();
            const kcal100 = parseFloat(elements.inputKcal100.value) || 0;
            const grams = parseFloat(elements.inputGrams.value) || 0;
            
            if (name && kcal100 > 0 && grams > 0) {
                const totalKcal = Math.round((kcal100 * grams) / 100);
                addItem(name, totalKcal);
                closeOverlay(elements.overlayAddCal);
            }
        });
    }

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