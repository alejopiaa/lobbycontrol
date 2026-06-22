const fs = require('fs');
const path = require('path');

// Mock a minimal DOM/Browser environment
const globalMock = {
  window: {},
  document: {
    getElementById: (id) => {
      console.log(`[DOM] getElementById: ${id}`);
      return {
        set innerHTML(html) {
          console.log(`[DOM] set innerHTML on #${id}`);
        },
        get innerHTML() {
          return '';
        },
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        appendChild: () => {},
        remove: () => {}
      };
    },
    querySelector: () => null,
    addEventListener: () => {}
  },
  lucide: {
    createIcons: () => {
      console.log('[Lucide] createIcons called');
    }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => null
  },
  debounce: (fn) => fn
};

// Expose mock globals
global.window = globalMock.window;
global.document = globalMock.document;
global.lucide = globalMock.lucide;
global.localStorage = globalMock.localStorage;
global.debounce = globalMock.debounce;

// Mock dataStore and state variables
global.currentUser = { rol: 'Administrador' };
global.currentView = 'administracion';
global.activeAdminTab = 'usuarios';
global.paginationState = { administracion: { page: 1 } };
global.dataStore = {
  usuarios: [],
  solicitudes: [],
  publicadas: [],
  sujetos_pasivos: [],
  stats: {
    usuarios: 10,
    solicitudes: 50,
    publicadas: 30,
    sujetos_pasivos: 20
  },
  dbHealth: {
    dbSize: '20MB',
    excelSize: '4MB',
    integrity: 'ok',
    excelPath: 'C:\\test\\path'
  },
  syncHistory: [
    { timestamp: '2026-06-17 14:04:00', estado: 'Exitoso', usuario: 'Admin', detalles: '{}' }
  ],
  dashboardRawData: [],
  reportesRawData: [],
  auditoria: [],
  alertas: null
};

// Load helper, components, views
const helpersCode = fs.readFileSync(path.join(__dirname, '../public/js/helpers.js'), 'utf8');
const componentsCode = fs.readFileSync(path.join(__dirname, '../public/js/components.js'), 'utf8');
const viewsCode = fs.readFileSync(path.join(__dirname, '../public/js/views.js'), 'utf8');

// Evaluate them in global context
eval(helpersCode);
eval(componentsCode);
eval(viewsCode);

console.log('--- Environment loaded successfully ---');

// Test switching tab
try {
  console.log('Calling changeAdminTab("database")...');
  changeAdminTab('database');
  console.log('SUCCESS! No errors thrown.');
} catch (e) {
  console.error('FAILED with error:', e);
}
