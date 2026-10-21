import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppInitializer } from '@/components';
import { ToastProvider } from '@/lib/components/ui/toast';
import { SDKProvider } from '@/lib/contexts/sdk.context';
import { Inter, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'TeleGenie',
  description: 'A premium, agent-powered portal connected directly to Telegram',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-mono", inter.variable, interHeading.variable, geistMono.variable)}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        <SDKProvider>
          <ToastProvider position="top-center">
            <AppInitializer>{children}</AppInitializer>
          </ToastProvider>
        </SDKProvider>
      </body>
    </html>
  );
}

