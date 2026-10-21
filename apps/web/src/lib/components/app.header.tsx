'use client';

import Link from 'next/link';
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-blue-600 text-white p-6 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">TeleGenie</h1>
          <p className="text-blue-100 mt-2">
            A modern Next.js app with TypeScript, Tailwind CSS, MobX, and PWA
          </p>
        </div>
        <nav>
          <Link href="/auth" className="text-sm font-medium text-white hover:text-blue-100 underline">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
