'use client';

import { decodeTgs } from '@/lib/utils/tgs';
import type { AnimationItem } from 'lottie-web';
import { useEffect, useRef } from 'react';

interface MediaStickerAnimatedProps {
  src: string;
  onLoad: () => void;
}

export default function MediaStickerAnimated({ src, onLoad }: MediaStickerAnimatedProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let cancelled = false;
    let animation: AnimationItem | undefined;

    (async () => {
      const response = await fetch(src);
      if (!response.ok) return;
      const animationData = await decodeTgs(await response.arrayBuffer());
      if (cancelled || !hostRef.current) return;

      const lottie = (await import('lottie-web/build/player/lottie_light')).default;
      if (cancelled || !hostRef.current) return;

      animation = lottie.loadAnimation({
        container: hostRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      });
      animation.addEventListener('DOMLoaded', () => onLoadRef.current());
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [src]);

  return <div ref={hostRef} className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full" />;
}
