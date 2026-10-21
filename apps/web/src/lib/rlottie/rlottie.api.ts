/** Timing returned by `RLottieWorkerApi.init` after a `.tgs` file is loaded. */
export type RLottieInitResult = {
  reduceFactor: number;
  msPerFrame: number;
  framesCount: number;
};

/**
 * Per-worker RPC surface (main tab → `telegenie-rlottie:N`).
 * `render` transfers the ImageBitmap; the pool draws it on the main thread.
 * `init` returns null when `destroy` wins the race during fetch or compile.
 */
export type RLottieWorkerApi = {
  init: {
    args: [key: string, tgsUrl: string, imgSize: number, isLowPriority: boolean];
    result: RLottieInitResult | null;
  };
  render: {
    args: [key: string, frameIndex: number];
    result: ImageBitmap;
  };
  destroy: {
    args: [key: string];
    result: void;
  };
};
