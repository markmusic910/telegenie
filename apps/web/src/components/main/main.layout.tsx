'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';

export { usePanelRef };
export type { PanelImperativeHandle };

function ResizeHandle({ className }: { className?: string }) {
  return (
    <Separator
      className={cn(
        'group relative flex w-px shrink-0 bg-border',
        'transition-colors hover:bg-primary/30 data-[active]:bg-primary/50',
        // Wider invisible hit area for easier grabbing
        'after:absolute after:inset-y-0 after:-left-1 after:right-[-4px] after:content-[""]',
        className,
      )}
    />
  );
}

interface MainLayoutProps {
  /** Slot: left column (dialog list) */
  dialogSlot: React.ReactNode;
  /** Slot: middle column (messages) */
  messagesSlot: React.ReactNode;
  /** Slot: right column (config) */
  configSlot: React.ReactNode;
  /** panelRef for the right (config) panel — allows imperative collapse/expand */
  configPanelRef?: React.RefObject<PanelImperativeHandle | null>;
}

export default function MainLayout({
  dialogSlot,
  messagesSlot,
  configSlot,
  configPanelRef,
}: MainLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-background">
      <Group
        id="telegenie-layout"
        orientation="horizontal"
        className="h-full w-full"
      >
        {/* Left — Dialog list */}
        <Panel
          id="dialog-list"
          defaultSize={"22%"}
          minSize={"16%"}
          maxSize={"35%"}
          className="flex flex-col"
        >
          <div className="flex h-full min-w-0 flex-col overflow-x-hidden border-r border-border bg-card">
            {dialogSlot}
          </div>
        </Panel>

        <ResizeHandle />

        {/* Middle — Messages */}
        <Panel
          id="messages"
          defaultSize={"53%"}
          minSize={"30%"}
          className="flex flex-col"
        >
          <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
            {messagesSlot}
          </div>
        </Panel>

        <ResizeHandle />

        {/* Right — Config (collapsible) */}
        <Panel
          id="dialog-config"
          panelRef={configPanelRef}
          defaultSize={"25%"}
          minSize={"18%"}
          maxSize={"35%"}
          collapsible
          collapsedSize={"0%"}
          className="flex flex-col"
        >
          <div className="flex h-full flex-col border-l border-border bg-card">
            {configSlot}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
