'use client';

import { observer } from 'mobx-react-lite';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import GenieCopilotPanel from '@/components/genie/genie-copilot.panel';
import DialogConfigContainer from '@/components/main/right-column/dialog-config.container';
import { useStore } from '@/lib/contexts/sdk.context';

export type RightColumnView = 'COPILOT' | 'DIALOG_CONFIG';

export interface RightColumnContainerProps {
  onClose: () => void;
  onExpandGlobal?: () => void;
  view?: RightColumnView;
  onViewChange?: (view: RightColumnView) => void;
}

/**
 * RightColumnContainer coordinates switching between the in-chat Genie Copilot
 * and the Dialog Config / Settings panel with a smooth motion transition.
 */
export const RightColumnContainer = observer(function RightColumnContainer({
  onClose,
  onExpandGlobal,
  view: controlledView,
  onViewChange,
}: RightColumnContainerProps) {
  const [internalView, setInternalView] = useState<RightColumnView>('COPILOT');
  const activeView = controlledView ?? internalView;

  // Allows switching views from within right column
  void onViewChange;

  const globalStore = useStore('global');
  const peerId = globalStore.nav.selectedDialogId;

  return (
    <div className="relative h-full w-full overflow-hidden bg-card">
      <AnimatePresence mode="wait" initial={false}>
        {activeView === 'COPILOT' ? (
          <motion.div
            key="copilot-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <GenieCopilotPanel
              peerId={peerId}
              onClose={onClose}
              onExpandGlobal={onExpandGlobal}
            />
          </motion.div>
        ) : (
          <motion.div
            key="config-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <DialogConfigContainer onClose={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default RightColumnContainer;
