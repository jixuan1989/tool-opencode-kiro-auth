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
export interface StatementLike {
    all(...params: any[]): any[];
    get(...params: any[]): any;
    run(...params: any[]): any;
}
export interface DatabaseLike {
    prepare(sql: string): StatementLike;
    run(sql: string, ...params: any[]): void;
    close(): void;
}
export declare class Database implements DatabaseLike {
    private inner;
    private _isBun;
    constructor(path: string, opts?: {
        readonly?: boolean;
    });
    prepare(sql: string): StatementLike;
    run(sql: string, ...params: any[]): void;
    close(): void;
}
