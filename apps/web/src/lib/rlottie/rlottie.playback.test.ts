import { playbackTiming } from '@/lib/rlottie/rlottie.playback';

describe('playbackTiming', () => {
  it('skips frames when the source rate divides the low-priority cap', () => {
    const timing = playbackTiming(JSON.stringify({ fr: 60 }), true, 60);
    expect(timing.reduceFactor).toBe(2);
    expect(timing.framesCount).toBe(30);
    expect(timing.msPerFrame).toBeCloseTo(1000 / 30);
  });

  it('keeps every frame when the rates do not divide evenly', () => {
    const timing = playbackTiming(JSON.stringify({ fr: 50 }), true, 50);
    expect(timing.reduceFactor).toBe(1);
    expect(timing.framesCount).toBe(50);
    expect(timing.msPerFrame).toBeCloseTo(20);
  });

  it('falls back to the priority cap when the file is not JSON', () => {
    const timing = playbackTiming('not-json', false, 10);
    expect(timing.reduceFactor).toBe(1);
    expect(timing.framesCount).toBe(10);
    expect(timing.msPerFrame).toBeCloseTo(1000 / 60);
  });
});
