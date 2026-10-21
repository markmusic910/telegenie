'use client';

import FolderRail from '@/components/main/left-column/folder.rail';

export default function MainShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <FolderRail />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
