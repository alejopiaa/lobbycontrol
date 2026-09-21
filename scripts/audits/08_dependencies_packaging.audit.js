/**
 * scripts/audits/08_dependencies_packaging.audit.js
 * Dominio 8: Empaquetado, Dependencias y Archivos Residuales
 * 
 * Abarca:
 *  - Dimensión 20.1: Bloqueo de dependencias de desarrollo (devDependencies) en código runtime de producción
 *  - Dimensión 20.2: Detección de archivos residuales, sensibles o de backup (.env, *.bak, *.db-journal, *.tmp) en producción
 */

const fs = require('fs');
const path = require('path');
const walk = require('acorn-walk');

module.exports = {
  id: 'packaging',
  name: 'Empaquetado, Dependencias y Archivos Residuales',

  run(ctx, addIssue) {
    const pkgPath = path.join(ctx.rootDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    let pkg = {};
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      return;
    }

    const devDeps = new Set(Object.keys(pkg.devDependencies || {}));
    const prodDeps = new Set(Object.keys(pkg.dependencies || {}));

    // ─────────────────────────────────────────────────────────────────────────
    // 20.1 BLOQUEO DE DEVDEPENDENCIES EN RUNTIME
    // ─────────────────────────────────────────────────────────────────────────
    const runtimeFiles = [];
    const collectFiles = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(full);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          runtimeFiles.push(full);
        }
      }
    };

    collectFiles(ctx.publicJsDir);
    collectFiles(ctx.srcDir);
    ['main.js', 'preload.js'].forEach(f => {
      const p = path.join(ctx.rootDir, f);
      if (fs.existsSync(p)) runtimeFiles.push(p);
    });

    const RUNTIME_BUILTINS = new Set([
      'electron', 'fs', 'path', 'crypto', 'os', 'child_process', 'events',
      'stream', 'util', 'http', 'https', 'net', 'url', 'querystring', 'buffer', 'zlib', 'assert', 'dns', 'tls'
    ]);

    for (const filePath of runtimeFiles) {
      const ast = ctx.getJsAst(filePath);
      const lines = ctx.getFileLines(filePath);
      if (!ast) continue;

      walk.simple(ast, {
        ImportDeclaration(node) {
          if (node.source && typeof node.source.value === 'string') {
            const mod = node.source.value;
            if (!mod.startsWith('.') && !mod.startsWith('/')) {
              const rootPkg = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
              if (!RUNTIME_BUILTINS.has(rootPkg) && devDeps.has(rootPkg) && !prodDeps.has(rootPkg)) {
                const lineNum = node.loc?.start?.line || 1;
                addIssue(
                  'devDependencyLeak',
                  filePath,
                  lineNum,
                  `Dependencia de desarrollo "${rootPkg}" importada en archivo de runtime de producción.`,
                  `Mueva "${rootPkg}" a "dependencies" en package.json o elimine su importación de los archivos de producción.`,
                  lines[lineNum - 1] || '',
                  'error'
                );
              }
            }
          }
        },
        CallExpression(node) {
          if (node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              const mod = arg.value;
              if (!mod.startsWith('.') && !mod.startsWith('/')) {
                const rootPkg = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
                if (!RUNTIME_BUILTINS.has(rootPkg) && devDeps.has(rootPkg) && !prodDeps.has(rootPkg)) {
                  const lineNum = node.loc?.start?.line || 1;
                  addIssue(
                    'devDependencyLeak',
                    filePath,
                    lineNum,
                    `Módulo de desarrollo "${rootPkg}" requerido vía require() en archivo de producción.`,
                    `Mueva "${rootPkg}" a "dependencies" o evite requerirlo en runtime de producción.`,
                    lines[lineNum - 1] || '',
                    'error'
                  );
                }
              }
            }
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 20.2 DETECCIÓN DE ARCHIVOS RESIDUALES O SENSIBLES EN EL ALCANCE DE EMPAQUETADO
    // ─────────────────────────────────────────────────────────────────────────
    const sensitivePatterns = [
      /\.env(\..+)?$/i,
      /\.(bak|backup|old|orig)$/i,
      /\.db-(journal|wal|shm)$/i,
      /\.tmp$/i,
      /~$/
    ];

    // Solo auditar carpetas que forman parte del empaquetado de producción (según package.json: build.files)
    const packagingDirs = [ctx.publicDir, ctx.srcDir];

    for (const pDir of packagingDirs) {
      const scanDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', '.vscode', '.gemini', 'dist', 'release'].includes(entry.name)) {
              scanDir(full);
            }
          } else if (entry.isFile()) {
            const isResidual = sensitivePatterns.some(pat => pat.test(entry.name));
            if (isResidual) {
              addIssue(
                'residualFiles',
                full,
                1,
                `Archivo residual, temporal o potencialmente sensible detectado dentro del paquete de producción: "${entry.name}"`,
                'Elimine este archivo de las carpetas de distribución para evitar empaquetarlo en el build de producción.',
                entry.name,
                'warning'
              );
            }
          }
        }
      };
      scanDir(pDir);
    }
  }
};
