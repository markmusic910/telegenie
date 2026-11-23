// Shim for @grafeo-db/wasm under Turbopack:
// @grafeo-db/web accesses `wasmModule.default` on `import * as wasmModule from '@grafeo-db/wasm'`,
// whereas @grafeo-db/wasm (built with wasm-pack --target bundler) only has named exports.
// Exporting `default: undefined` satisfies Turbopack's static export check while keeping
// the bundler-target initialization path (`typeof init === 'function'` -> false).
// @ts-ignore - subpath import has no separate .d.ts mapping in package.json
export { AsOfView, Database, GraphHandle } from '@grafeo-db/wasm/grafeo_wasm.js';
export default undefined;
