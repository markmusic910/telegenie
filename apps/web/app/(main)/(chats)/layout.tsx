import MainPage from '@/components/pages/main.page';
import type { ReactNode } from 'react';

export default function ChatsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MainPage />
      {children}
    </>
  );
}
