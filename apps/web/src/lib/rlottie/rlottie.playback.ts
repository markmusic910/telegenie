import type { RLottieInitResult } from './rlottie.api';

const LOW_PRIORITY_MAX_FPS = 30;
const HIGH_PRIORITY_MAX_FPS = 60;

/** Frame skip and delay for one loaded animation. */
export function playbackTiming(
  json: string,
  isLowPriority: boolean,
  framesCount: number,
): RLottieInitResult {
  let sourceFps = isLowPriority ? LOW_PRIORITY_MAX_FPS : HIGH_PRIORITY_MAX_FPS;
  try {
    const animation = JSON.parse(json) as { fr?: unknown };
    if (animation && typeof animation.fr === 'number' && animation.fr > 0) {
      sourceFps = animation.fr;
    }
  } catch {
    // Keep the fallback frame rate when the file is not JSON.
  }
  const maxFps = isLowPriority ? LOW_PRIORITY_MAX_FPS : HIGH_PRIORITY_MAX_FPS;
  const reduceFactor = sourceFps % maxFps === 0 ? sourceFps / maxFps : 1;
  return {
    reduceFactor,
    msPerFrame: 1000 / (sourceFps / reduceFactor),
    framesCount: Math.max(1, Math.ceil(framesCount / reduceFactor)),
  };
}
