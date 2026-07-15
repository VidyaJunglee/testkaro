#!/usr/bin/env node
// asyncbox >=6 (a transitive dep of appium-adb, via asyncmap/asyncfilter) calls
// require('p-limit').limitFunction(fn, {concurrency}) — an API p-limit only
// added in v5+, the same versions that dropped CommonJS support entirely.
// The `p-limit` override in package.json pins a CJS-safe v3.x (no
// limitFunction), so this postinstall step appends a small CJS-compatible
// implementation of limitFunction on top of it. Runs after every `npm
// install` since node_modules is not committed.
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '__testkaro_limitFunction_patch__';

function findPLimitDirs(root, found = new Set()) {
  const dir = path.join(root, 'node_modules', 'p-limit');
  if (fs.existsSync(path.join(dir, 'package.json'))) found.add(dir);

  const nodeModules = path.join(root, 'node_modules');
  if (!fs.existsSync(nodeModules)) return found;
  for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(nodeModules, entry.name);
    if (entry.name === 'p-limit') continue; // already handled above
    if (entry.name.startsWith('.')) continue;
    findPLimitDirs(sub, found);
  }
  return found;
}

function patchOne(dir) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const mainFile = path.join(dir, pkg.main || 'index.js');
  if (!fs.existsSync(mainFile)) return;

  const src = fs.readFileSync(mainFile, 'utf-8');
  if (src.includes(MARKER)) return; // already patched

  const patch = `
// ${MARKER}
module.exports.limitFunction = (fn, options) => {
  const limit = module.exports(options.concurrency);
  return (...args) => limit(() => fn(...args));
};
`;
  fs.writeFileSync(mainFile, src + patch);
  console.log(`[patch-p-limit] patched ${mainFile}`);
}

const dirs = findPLimitDirs(path.resolve(__dirname, '..'));
if (dirs.size === 0) {
  console.log('[patch-p-limit] no p-limit installs found — nothing to do');
} else {
  for (const dir of dirs) patchOne(dir);
}
