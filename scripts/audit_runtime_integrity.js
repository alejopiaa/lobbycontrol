#!/usr/bin/env node
/**
 * ============================================================================
 * LOBBYCONTROL - AUDITORÍA UNIVERSAL DE INTEGRIDAD Y SEGURIDAD (v3.2)
 * ============================================================================
 * Arquitectura Modular con Ejecutor Central y Dimensión 18 (AppSec).
 * 
 * Dominios evaluados:
 *  1. [ui]        Integridad DOM, Clases, IDs y Tokens de Diseño
 *  2. [ipc]       IPC, APIs, Consumo, dataStore, Modales y Exportadores
 *  3. [ast]       Calidad de Código, AST, Código Muerto y Diálogos Nativos
 *  4. [lifecycle] Listeners IPC y Gating de Autenticación 401
 *  5. [security]  Seguridad y Vulnerabilidades (SQLi, DOM XSS, Electron Sandbox, Path Traversal)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { AuditContext } = require('./audits/context');

const domUiModule = require('./audits/01_dom_ui.audit');
const ipcDataflowModule = require('./audits/02_ipc_dataflow.audit');
const astQualityModule = require('./audits/03_ast_quality.audit');
const lifecycleModule = require('./audits/04_lifecycle.audit');
const securityAppsecModule = require('./audits/05_security_appsec.audit');
const hygieneModule = require('./audits/06_hygiene_ai_clean.audit');

const ALL_MODULES = [
  domUiModule,
  ipcDataflowModule,
  astQualityModule,
  lifecycleModule,
  securityAppsecModule,
  hygieneModule
];

// ─────────────────────────────────────────────────────────────────────────────
// PARSEO DE PARÁMETROS CLI
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let targetModuleId = null;
let isStrict = false;

for (const arg of args) {
  if (arg.startsWith('--module=')) {
    targetModuleId = arg.split('=')[1].toLowerCase().trim();
  } else if (arg === '--strict') {
    isStrict = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL REPORTE Y RECOLECTOR
// ─────────────────────────────────────────────────────────────────────────────
const report = {
  totalIssues: 0,
  totalErrors: 0,
  totalWarnings: 0,
  executionTimeMs: 0,
  executedModules: [],
  categories: {}
};

function addIssue(category, file, line, message, suggestion, codeSnippet, severity = 'error') {
  report.totalIssues++;
  if (severity === 'error') report.totalErrors++;
  else report.totalWarnings++;

  if (!report.categories[category]) {
    report.categories[category] = [];
  }

  report.categories[category].push({
    severity,
    file: path.relative(process.cwd(), file),
    line,
    message,
    suggestion,
    codeSnippet: codeSnippet ? codeSnippet.trim() : null
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EJECUCIÓN
// ─────────────────────────────────────────────────────────────────────────────
console.log('='.repeat(74));
console.log(' AUDITORÍA UNIVERSAL MODULAR DE INTEGRIDAD Y SEGURIDAD (v3.2)');
console.log('='.repeat(74));

const startTime = Date.now();
const ctx = new AuditContext(addIssue);

const modulesToRun = targetModuleId 
  ? ALL_MODULES.filter(m => m.id === targetModuleId)
  : ALL_MODULES;

if (modulesToRun.length === 0) {
  console.error(`\n[ERROR] Módulo desconocido: "${targetModuleId}". Opciones válidas: ui, ipc, ast, lifecycle, security, hygiene`);
  process.exit(1);
}

for (const mod of modulesToRun) {
  const modStart = Date.now();
  process.stdout.write(`▶ Ejecutando [${mod.id.toUpperCase()}] ${mod.name}... `);

  try {
    mod.run(ctx, addIssue);
    const duration = Date.now() - modStart;
    console.log(`✓ OK (${duration}ms)`);
    report.executedModules.push({ id: mod.id, name: mod.name, durationMs: duration, status: 'passed' });
  } catch (err) {
    const duration = Date.now() - modStart;
    console.log(`✗ ERROR (${duration}ms)`);
    console.error(err);
    addIssue('moduleExecution', 'scripts/audit_runtime_integrity.js', 1, `Fallo en módulo ${mod.id}: ${err.message}`, 'Revise la traza de error.', null, 'error');
    report.executedModules.push({ id: mod.id, name: mod.name, durationMs: duration, status: 'failed', error: err.message });
  }
}

report.executionTimeMs = Date.now() - startTime;

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO DEL REPORTE FINAL EN CONSOLA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(74));
console.log(` RESUMEN CONSOLIDADO: ${report.totalErrors} ERROR(ES) | ${report.totalWarnings} ADVERTENCIA(S) | Tiempo: ${report.executionTimeMs}ms`);
console.log('='.repeat(74));

if (report.totalIssues === 0) {
  console.log('\n✓ CERO INCIDENCIAS: Todos los flujos de interfaz, datos, ciclo de vida y seguridad están íntegros.');
} else {
  for (const [catName, issues] of Object.entries(report.categories)) {
    if (issues.length > 0) {
      console.log(`\n▶ CATEGORÍA: ${catName.toUpperCase()} (${issues.length} incidencias):`);
      issues.forEach((iss, i) => {
        const badge = iss.severity === 'error' ? '[ERROR]' : '[WARN]';
        console.log(`  ${i + 1}. ${badge} [${iss.file}:${iss.line}] ${iss.message}`);
        if (iss.codeSnippet) console.log(`     Código: ${iss.codeSnippet}`);
        console.log(`     Sugerencia: ${iss.suggestion}\n`);
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA DEL REPORTE
// ─────────────────────────────────────────────────────────────────────────────
const outputPath = path.join(process.cwd(), 'scripts/runtime-audit-report.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`✓ Reporte detallado guardado en: ${outputPath}`);
console.log('='.repeat(74));

const shouldFail = report.totalErrors > 0 || (isStrict && report.totalWarnings > 0);
process.exit(shouldFail ? 1 : 0);
