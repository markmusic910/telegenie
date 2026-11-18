const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const wasmDir = path.dirname(require.resolve('@grafeo-db/wasm/package.json'));
const bgJsSource = fs.readFileSync(path.join(wasmDir, 'grafeo_wasm_bg.js'), 'utf8');
const wasmBytes = fs.readFileSync(path.join(wasmDir, 'grafeo_wasm_bg.wasm'));

const transpiled = ts.transpileModule(bgJsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    allowJs: true,
  },
});

const bgModule = { exports: {} };
const fn = new Function('exports', 'require', 'module', transpiled.outputText);
fn(bgModule.exports, require, bgModule);

const wasmModule = new WebAssembly.Module(wasmBytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  './grafeo_wasm_bg.js': bgModule.exports,
});

bgModule.exports.__wbg_set_wasm(wasmInstance.exports);
if (typeof wasmInstance.exports.__wbindgen_start === 'function') {
  wasmInstance.exports.__wbindgen_start();
}

module.exports = {
  AsOfView: bgModule.exports.AsOfView,
  Database: bgModule.exports.Database,
  GraphHandle: bgModule.exports.GraphHandle,
};
