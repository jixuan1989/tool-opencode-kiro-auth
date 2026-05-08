/**
 * SQLite compatibility layer.
 *
 * • Bun runtime → `bun:sqlite` (synchronous, native)
 * • Node.js / Electron → `node:sqlite` (built-in since Node 22.5+)
 *
 * Both are wrapped behind the same synchronous `Database` interface.
 * No native addons required — works in any Electron version that
 * ships Node ≥ 22.5.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── runtime detection ──────────────────────────────────────────────
const isBun = typeof globalThis.Bun !== 'undefined'

let BunDatabase: any = null
let NodeDatabaseSync: any = null

if (isBun) {
  try {
    BunDatabase = require('bun:sqlite').Database
  } catch { /* fall through to node:sqlite */ }
}

if (!BunDatabase) {
  try {
    NodeDatabaseSync = require('node:sqlite').DatabaseSync
  } catch {
    throw new Error(
      '[kiro-auth] Neither bun:sqlite nor node:sqlite is available. ' +
      'Node.js ≥ 22.5 or Bun is required.'
    )
  }
}

// ── public interfaces ──────────────────────────────────────────────
export interface StatementLike {
  all(...params: any[]): any[]
  get(...params: any[]): any
  run(...params: any[]): any
}

export interface DatabaseLike {
  prepare(sql: string): StatementLike
  run(sql: string, ...params: any[]): void
  close(): void
}

// ── node:sqlite statement wrapper ──────────────────────────────────
// node:sqlite's StatementSync has `.all()`, `.get()`, `.run()` but
// positional params are passed differently than bun:sqlite in some
// edge cases.  This thin wrapper normalises the interface.
class NodeStatementWrapper implements StatementLike {
  private inner: any
  constructor(stmt: any) { this.inner = stmt }
  all(...params: any[]): any[] { return this.inner.all(...params) }
  get(...params: any[]): any { return this.inner.get(...params) }
  run(...params: any[]): any { return this.inner.run(...params) }
}

// ── Database class ─────────────────────────────────────────────────
export class Database implements DatabaseLike {
  private inner: any
  private _isBun: boolean

  constructor(path: string, opts?: { readonly?: boolean }) {
    if (BunDatabase) {
      this._isBun = true
      this.inner = new BunDatabase(path, opts)
    } else {
      this._isBun = false
      // node:sqlite uses `readOnly` (camelCase) not `readonly`
      const nodeOpts: any = {}
      if (opts?.readonly) nodeOpts.readOnly = true
      // node:sqlite: open = true by default, but we need to ensure
      // the file can be created if it doesn't exist (for non-readonly)
      this.inner = new NodeDatabaseSync(path, nodeOpts)
    }
  }

  prepare(sql: string): StatementLike {
    if (this._isBun) {
      return this.inner.prepare(sql)
    }
    return new NodeStatementWrapper(this.inner.prepare(sql))
  }

  run(sql: string, ...params: any[]): void {
    if (this._isBun) {
      // bun:sqlite has db.run(sql, ...params)
      this.inner.run(sql, ...params)
    } else {
      // node:sqlite: use db.exec(sql) for DDL/statements without params
      if (params.length === 0) {
        this.inner.exec(sql)
      } else {
        this.inner.prepare(sql).run(...params)
      }
    }
  }

  close(): void {
    this.inner.close()
  }
}
