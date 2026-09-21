#!/usr/bin/env node
/**
 * ============================================================================
 * LOBBYCONTROL - AUDITORÍA UNIVERSAL DE INTEGRIDAD Y SEGURIDAD (v3.3)
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
const resilienceModule = require('./audits/07_network_resilience_errors.audit');
const packagingModule = require('./audits/08_dependencies_packaging.audit');
const accessibilityModule = require('./audits/09_accessibility_ux_compliance.audit');
const hardcodedModule = require('./audits/10_datos_hardcodeados.audit');
const commentsModule = require('./audits/11_comments_clean_code.audit');

const ALL_MODULES = [
  domUiModule,
  ipcDataflowModule,
  astQualityModule,
  lifecycleModule,
  securityAppsecModule,
  hygieneModule,
  resilienceModule,
  packagingModule,
  accessibilityModule,
  hardcodedModule,
  commentsModule
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
console.log(' AUDITORÍA UNIVERSAL MODULAR DE INTEGRIDAD Y SEGURIDAD (v3.3)');
console.log('='.repeat(74));

const startTime = Date.now();
const ctx = new AuditContext(addIssue);

const modulesToRun = targetModuleId 
  ? ALL_MODULES.filter(m => m.id === targetModuleId)
  : ALL_MODULES;

if (modulesToRun.length === 0) {
  console.error(`\n[ERROR] Módulo desconocido: "${targetModuleId}". Opciones válidas: ${ALL_MODULES.map(m => m.id).join(', ')}`);
  process.exit(1);
}

for (const mod of modulesToRun) {
  const modStart = Date.now();
  process.stdout.write(`▶ Ejecutando [${mod.id.toUpperCase()}] ${mod.name}... `);

  const errorsBefore = report.totalErrors;
  const warningsBefore = report.totalWarnings;

  try {
    mod.run(ctx, addIssue);
    const duration = Date.now() - modStart;
    const modErrors = report.totalErrors - errorsBefore;
    const modWarnings = report.totalWarnings - warningsBefore;

    let status = 'passed';
    let consoleBadge = '✓ APROBADO';
    if (modErrors > 0) {
      status = 'failed';
      consoleBadge = `✗ FALLÓ (${modErrors} err, ${modWarnings} adv)`;
    } else if (modWarnings > 0) {
      status = 'warning';
      consoleBadge = `▲ OBSERVADO (${modWarnings} adv)`;
    }

    console.log(`${consoleBadge} (${duration}ms)`);
    report.executedModules.push({
      id: mod.id,
      name: mod.name,
      durationMs: duration,
      status,
      errors: modErrors,
      warnings: modWarnings
    });
  } catch (err) {
    const duration = Date.now() - modStart;
    console.log(`💥 ERROR DE EJECUCIÓN (${duration}ms)`);
    console.error(err);
    addIssue('moduleExecution', 'scripts/audit_runtime_integrity.js', 1, `Fallo en módulo ${mod.id}: ${err.message}`, 'Revise la traza de error.', null, 'error');
    report.executedModules.push({
      id: mod.id,
      name: mod.name,
      durationMs: duration,
      status: 'crashed',
      errors: 1,
      warnings: 0,
      error: err.message
    });
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
// PERSISTENCIA DEL REPORTE (JSON Y MARKDOWN TÉCNICO DETALLADO)
// ─────────────────────────────────────────────────────────────────────────────
function generateMarkdownReport(rep) {
  const lines = [];
  const dateStr = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

  lines.push('# 📋 Informe Técnico de Auditoría de Integridad y Seguridad');
  lines.push('');
  lines.push(`> **LobbyControl Suite v3.3** | **Fecha:** \`${dateStr}\` | **Tiempo de Ejecución:** \`${rep.executionTimeMs} ms\``);
  lines.push('');
  lines.push('## 📊 Resumen Ejecutivo');
  lines.push('');
  lines.push('| Métrica | Total | Estado |');
  lines.push('| :--- | :---: | :---: |');
  lines.push(`| **Total de Incidencias** | \`${rep.totalIssues}\` | ${rep.totalIssues === 0 ? '🟢 APROBADO' : '🟡 REVISIÓN REQUERIDA'} |`);
  lines.push(`| **Errores Críticos** | \`${rep.totalErrors}\` | ${rep.totalErrors === 0 ? '🟢 0' : '🔴 ' + rep.totalErrors} |`);
  lines.push(`| **Advertencias** | \`${rep.totalWarnings}\` | ${rep.totalWarnings === 0 ? '🟢 0' : '🟡 ' + rep.totalWarnings} |`);
  lines.push('');
  lines.push('### ⏱️ Desglose por Módulos Ejecutados');
  lines.push('');
  lines.push('| Módulo | ID | Duración | Hallazgos | Estado |');
  lines.push('| :--- | :---: | :---: | :---: | :---: |');
  for (const m of rep.executedModules) {
    let icon = '🟢';
    let statusText = 'APROBADO';
    if (m.status === 'failed') {
      icon = '🔴';
      statusText = 'FALLÓ';
    } else if (m.status === 'warning') {
      icon = '🟡';
      statusText = 'OBSERVADO';
    } else if (m.status === 'crashed') {
      icon = '💥';
      statusText = 'ERROR RUNNER';
    }
    const findings = (m.errors === 0 && m.warnings === 0)
      ? '0 incidencias'
      : `${m.errors || 0} err / ${m.warnings || 0} adv`;
    lines.push(`| **${m.name}** | \`${m.id}\` | \`${m.durationMs} ms\` | \`${findings}\` | ${icon} **${statusText}** |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 📑 Índice de Categorías Evaluadas');
  lines.push('');
  for (const [catName, issues] of Object.entries(rep.categories)) {
    if (issues.length > 0) {
      const errCount = issues.filter(i => i.severity === 'error').length;
      const warnCount = issues.filter(i => i.severity === 'warning').length;
      lines.push(`- [${catName.toUpperCase()}](#${catName.toLowerCase()}) — **${issues.length}** hallazgos (🔴 ${errCount} errores, 🟡 ${warnCount} advertencias)`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 🔍 Detalle Técnico de Hallazgos');
  lines.push('');

  if (rep.totalIssues === 0) {
    lines.push('🟢 **No se detectaron incidencias.** Todos los componentes cumplen con los estándares de integridad y seguridad.');
    lines.push('');
  } else {
    for (const [catName, issues] of Object.entries(rep.categories)) {
      if (issues.length === 0) continue;
      lines.push(`<a id="${catName.toLowerCase()}"></a>`);
      lines.push(`### 📁 ${catName.toUpperCase()} (${issues.length} incidencias)`);
      lines.push('');

      issues.forEach((iss, index) => {
        const badge = iss.severity === 'error' ? '🔴 **ERROR CRÍTICO**' : '🟡 **ADVERTENCIA**';
        const normFile = iss.file.replace(/\\/g, '/');
        lines.push(`#### ${index + 1}. ${badge} \`${normFile}:${iss.line}\``);
        lines.push('');
        lines.push(`- **Diagnóstico:** ${iss.message}`);
        if (iss.codeSnippet) {
          lines.push('- **Código Afectado:**');
          lines.push('  ```javascript');
          lines.push(`  ${iss.codeSnippet}`);
          lines.push('  ```');
        }
        lines.push(`- **Remediación Sugerida:** ${iss.suggestion}`);
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

const outputPathJson = path.join(process.cwd(), 'scripts/runtime-audit-report.json');
fs.writeFileSync(outputPathJson, JSON.stringify(report, null, 2), 'utf8');

const outputPathMd = path.join(process.cwd(), 'scripts/runtime-audit-report.md');
fs.writeFileSync(outputPathMd, generateMarkdownReport(report), 'utf8');

console.log(`✓ Reporte JSON guardado en: ${outputPathJson}`);
console.log(`✓ Reporte técnico Markdown guardado en: ${outputPathMd}`);
console.log('='.repeat(74));

const shouldFail = report.totalErrors > 0 || (isStrict && report.totalWarnings > 0);
process.exit(shouldFail ? 1 : 0);
