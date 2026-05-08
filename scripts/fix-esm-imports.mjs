#!/usr/bin/env node

/**
 * Post-build script: adds .js extensions to relative imports in dist/*.js files.
 *
 * TypeScript with "module":"Preserve" + "moduleResolution":"bundler" emits
 * bare specifiers (e.g. `from './foo'`).  Node.js ESM loaders (used by the
 * new Electron-based OpenCode) require explicit `.js` extensions.
 *
 * This script rewrites every relative `import … from './…'` and
 * `export … from './…'` that does NOT already end with `.js` so that
 * they point to the corresponding `.js` file.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(import.meta.dirname, '..', 'dist')

// Matches:  from './foo'  |  from '../bar/baz'
// Captures the quote char and the specifier.
const IMPORT_RE = /(from\s+['"])(\.\.?\/[^'"]*?)(['"])/g

function needsExtension(specifier) {
  // Already has .js / .mjs / .cjs / .json
  if (/\.\w+$/.test(specifier)) return false
  return true
}

function processFile(filePath) {
  const src = readFileSync(filePath, 'utf8')
  let changed = false

  const result = src.replace(IMPORT_RE, (match, prefix, specifier, quote) => {
    if (!needsExtension(specifier)) return match
    changed = true
    return `${prefix}${specifier}.js${quote}`
  })

  if (changed) {
    writeFileSync(filePath, result, 'utf8')
  }
  return changed
}

function walk(dir) {
  let count = 0
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      count += walk(full)
    } else if (full.endsWith('.js')) {
      if (processFile(full)) count++
    }
  }
  return count
}

const fixed = walk(DIST)
if (fixed > 0) {
  console.log(`fix-esm-imports: patched ${fixed} file(s) in dist/`)
} else {
  console.log('fix-esm-imports: all imports already have .js extensions')
}
