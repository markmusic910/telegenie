'use client';

import { env } from '@/env';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { observer } from 'mobx-react-lite';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import StoreDebugPanel from './debug/store.debug';

interface AppInitializerProps {
  children: React.ReactNode;
}

const AppInitializer = observer(({ children }: AppInitializerProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const sdk = useSDK();
  const globalStore = useStore('global');

  useEffect(() => {
    void sdk.init({
      apiId: Number(env.telegramApiId),
      apiHash: env.telegramApiHash,
    });
  }, [sdk]);

  const isAuthPage = pathname === '/auth';
  const isInitializing = globalStore.auth.authStep === 'idle' || globalStore.auth.authIsLoading;
  const isAuthenticated = globalStore.auth.authStep === 'success';

  useEffect(() => {
    if (!isInitializing && !isAuthenticated && !isAuthPage) {
      router.push('/auth');
    }
  }, [isInitializing, isAuthenticated, isAuthPage, router]);

  if (!isAuthPage && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 -m-4 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
            <svg className="relative w-16 h-16" viewBox="0 0 512 512" fill="none">
              <defs>
                <linearGradient id="neon-grad-init" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#41D1FF" />
                  <stop offset="100%" stopColor="#BD34FE" />
                </linearGradient>
              </defs>
              <g
                stroke="url(#neon-grad-init)"
                strokeWidth="44"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M 180 400 H 332" />
                <path d="M 256 400 V 350 C 180 350, 160 260, 256 260 C 352 260, 332 350, 256 350" />
                <path d="M 175 290 C 110 290, 80 230, 100 200" />
                <path d="M 330 290 C 390 290, 390 350, 320 350" />
              </g>
            </svg>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-bounce" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {isInitializing ? 'Connecting to Telegram...' : 'Redirecting to login...'}
          </p>
        </div>
        {process.env.NODE_ENV === 'development' ? <StoreDebugPanel /> : null}
      </div>
    );
  }

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' ? <StoreDebugPanel /> : null}
    </>
  );
});

export default AppInitializer;
