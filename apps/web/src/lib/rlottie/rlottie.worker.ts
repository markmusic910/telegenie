import { exposeWorkerApi, rpcTransfer, type RpcHandlers } from '@telegenie/libs/foundation/worker-rpc';
import type { RLottieInitResult, RLottieWorkerApi } from './rlottie.api';
import { playbackTiming } from './rlottie.playback';
import { allocateJson, loadRLottieModule, type RLottieModule } from './rlottie.wasm';

type LottieApi = {
  init: () => number;
  destroy: (handle: number) => void;
  resize: (handle: number, width: number, height: number) => void;
  buffer: (handle: number) => number;
  render: (handle: number, frame: number) => void;
  loadFromData: (handle: number, dataPtr: number) => number;
};

type Renderer = {
  handle: number;
  imgSize: number;
  reduceFactor: number;
  imageData: ImageData;
};

const renderers = new Map<string, Renderer>();
const cancelled = new Set<string>();
let api: LottieApi | undefined;
let wasm: RLottieModule | undefined;

async function readyApi(): Promise<LottieApi> {
  if (api && wasm) return api;
  const module = await loadRLottieModule();
  wasm = module;
  api = {
    init: module.cwrap('lottie_init', '', []) as LottieApi['init'],
    destroy: module.cwrap('lottie_destroy', '', ['number']) as LottieApi['destroy'],
    resize: module.cwrap('lottie_resize', '', ['number', 'number', 'number']) as LottieApi['resize'],
    buffer: module.cwrap('lottie_buffer', 'number', ['number']) as LottieApi['buffer'],
    render: module.cwrap('lottie_render', '', ['number', 'number']) as LottieApi['render'],
    loadFromData: module.cwrap('lottie_load_from_data', 'number', [
      'number',
      'number',
    ]) as LottieApi['loadFromData'],
  };
  return api;
}

async function inflateToString(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const payload =
    bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).arrayBuffer()
      : buffer;
  return new TextDecoder().decode(payload);
}

async function loadJson(tgsUrl: string): Promise<string> {
  const response = await fetch(tgsUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${tgsUrl}`);
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.startsWith('text/')) return response.text();
  return inflateToString(await response.arrayBuffer());
}

async function initRenderer(
  key: string,
  tgsUrl: string,
  imgSize: number,
  isLowPriority: boolean,
): Promise<RLottieInitResult | null> {
  const lottie = await readyApi();
  cancelled.delete(key);
  const existing = renderers.get(key);
  if (existing) {
    lottie.destroy(existing.handle);
    renderers.delete(key);
  }
  const json = await loadJson(tgsUrl);
  if (cancelled.has(key)) return null;
  if (!wasm) throw new Error('rlottie wasm missing');
  const handle = lottie.init();
  const framesCount = lottie.loadFromData(handle, allocateJson(wasm, json));
  if (cancelled.has(key)) {
    lottie.destroy(handle);
    return null;
  }
  lottie.resize(handle, imgSize, imgSize);
  const timing = playbackTiming(json, isLowPriority, framesCount);
  renderers.set(key, {
    handle,
    imgSize,
    reduceFactor: timing.reduceFactor,
    imageData: new ImageData(imgSize, imgSize),
  });
  return timing;
}

async function renderFrame(key: string, frameIndex: number): Promise<ImageBitmap> {
  const lottie = await readyApi();
  const renderer = renderers.get(key);
  if (!renderer || !wasm) throw new Error(`Missing rlottie renderer ${key}`);
  lottie.render(renderer.handle, frameIndex * renderer.reduceFactor);
  const bufferPointer = lottie.buffer(renderer.handle);
  const byteLength = renderer.imgSize * renderer.imgSize * 4;
  const data = wasm.HEAPU8.subarray(bufferPointer, bufferPointer + byteLength);
  renderer.imageData.data.set(data);
  return createImageBitmap(renderer.imageData);
}

function destroyRenderer(key: string): void {
  cancelled.add(key);
  const renderer = renderers.get(key);
  if (!renderer) return;
  try {
    api?.destroy(renderer.handle);
  } catch {
    // Destroy can race initialization.
  }
  renderers.delete(key);
}

const handlers: RpcHandlers<RLottieWorkerApi> = {
  init: (key, tgsUrl, imgSize, isLowPriority) =>
    initRenderer(key, tgsUrl, imgSize, isLowPriority),
  render: async (key, frameIndex) => {
    const bitmap = await renderFrame(key, frameIndex);
    return rpcTransfer(bitmap, [bitmap]);
  },
  destroy: (key) => {
    destroyRenderer(key);
  },
};

exposeWorkerApi<RLottieWorkerApi>({
  handlers,
  tag: 'rlottie-worker',
  logRequests: false,
});
