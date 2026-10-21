/**
 * Samsung rlottie Emscripten glue (`public/rlottie/rlottie-wasm.js`) is a classic
 * script. Module workers have no `importScripts`, so the worker evals it on the
 * worker global after installing `Module` and an `importScripts` presence stub.
 * The stub exists so the glue selects its worker environment; it is not called.
 */

const WASM_SCRIPT = '/rlottie/rlottie-wasm.js';
const ALLOC_NORMAL = 0;

type RLottieModuleConfig = {
  locateFile?: (path: string) => string;
  onRuntimeInitialized?: () => void;
};

export type RLottieModule = RLottieModuleConfig & {
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => (...args: number[]) => number;
  allocate: (slab: number[], types: string, allocator: number) => number;
  intArrayFromString: (value: string) => number[];
  HEAPU8: Uint8Array;
};

type RlottieGlobal = typeof globalThis & {
  Module?: RLottieModuleConfig;
  importScripts?: (...urls: string[]) => void;
  eval?: (code: string) => void;
};

function isReadyModule(module: RLottieModuleConfig | undefined): module is RLottieModule {
  return Boolean(
    module &&
    'cwrap' in module &&
    'allocate' in module &&
    'intArrayFromString' in module &&
    'HEAPU8' in module,
  );
}

let modulePromise: Promise<RLottieModule> | undefined;

export function loadRLottieModule(): Promise<RLottieModule> {
  modulePromise ??= load();
  return modulePromise;
}

async function load(): Promise<RLottieModule> {
  const ready = new Promise<void>((resolve) => {
    const scope = globalThis as RlottieGlobal;
    scope.Module = {
      locateFile(path) {
        return `/rlottie/${path}`;
      },
      onRuntimeInitialized() {
        resolve();
      },
    };
    if (typeof scope.importScripts !== 'function') {
      scope.importScripts = () => {
        throw new Error('rlottie wasm glue is loaded by loadRLottieModule');
      };
    }
  });

  const response = await fetch(WASM_SCRIPT);
  if (!response.ok) throw new Error(`Failed to load ${WASM_SCRIPT}`);
  const source = await response.text();
  const evaluate = (globalThis as RlottieGlobal).eval as ((code: string) => void) | undefined;
  if (typeof evaluate !== 'function') {
    throw new Error('rlottie wasm glue requires global eval in the worker');
  }
  evaluate(source);
  await ready;

  const module = (globalThis as RlottieGlobal).Module;
  if (!isReadyModule(module)) {
    throw new Error('rlottie wasm glue did not adopt the Module config');
  }
  return module;
}

export function allocateJson(module: RLottieModule, json: string): number {
  return module.allocate(module.intArrayFromString(json), 'i8', ALLOC_NORMAL);
}
