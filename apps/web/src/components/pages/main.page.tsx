'use client';

import { observer } from 'mobx-react-lite';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';

import GenieGlobalContainer from '@/components/genie/genie-global.container';
import LeftColumnContainer from '@/components/main/left-column/left-column.container';
import MainLayout, { usePanelRef } from '@/components/main/main.layout';
import MessagesContainer from '@/components/main/middle-column/messages.container';
import RightColumnContainer, {
  type RightColumnView,
} from '@/components/main/right-column/right-column.container';

/**
 * MainPage
 *
 * Coordinates LeftColumn (dialogs), MiddleColumn (messages or Genie Global View),
 * and RightColumn (Genie Copilot or Dialog Config).
 */
const MainPage = observer(() => {
  const configPanelRef = usePanelRef();
  const [isGlobalGenieOpen, setIsGlobalGenieOpen] = useState(false);
  const [rightColumnView, setRightColumnView] = useState<RightColumnView>('COPILOT');
  const wasCopilotOpenBeforeGlobal = useRef(false);

  function toggleConfig() {
    const panel = configPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      setRightColumnView('DIALOG_CONFIG');
      panel.expand();
    } else if (rightColumnView === 'COPILOT') {
      setRightColumnView('DIALOG_CONFIG');
    } else {
      panel.collapse();
    }
  }

  function openGenie() {
    const panel = configPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      setRightColumnView('COPILOT');
      panel.expand();
    } else if (rightColumnView === 'DIALOG_CONFIG') {
      setRightColumnView('COPILOT');
    } else {
      panel.collapse();
    }
  }

  function handleExpandGlobal() {
    wasCopilotOpenBeforeGlobal.current = !configPanelRef.current?.isCollapsed();
    configPanelRef.current?.collapse();
    setIsGlobalGenieOpen(true);
  }

  function handleCloseGlobal() {
    setIsGlobalGenieOpen(false);
    if (wasCopilotOpenBeforeGlobal.current) {
      wasCopilotOpenBeforeGlobal.current = false;
      setRightColumnView('COPILOT');
      requestAnimationFrame(() => {
        configPanelRef.current?.expand();
      });
    }
  }

  return (
    <MainLayout
      configPanelRef={configPanelRef}
      dialogSlot={<LeftColumnContainer />}
      messagesSlot={
        <div className="relative h-full w-full overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isGlobalGenieOpen ? (
              <motion.div
                key="global-genie-view"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="h-full w-full"
              >
                <GenieGlobalContainer onClose={handleCloseGlobal} />
              </motion.div>
            ) : (
              <motion.div
                key="messages-view"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="h-full w-full"
              >
                <MessagesContainer
                  onToggleConfig={toggleConfig}
                  onOpenGenie={openGenie}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      configSlot={
        <div className="relative h-full w-full overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {!isGlobalGenieOpen && (
              <motion.div
                key="right-column-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="h-full w-full"
              >
                <RightColumnContainer
                  view={rightColumnView}
                  onViewChange={setRightColumnView}
                  onClose={() => configPanelRef.current?.collapse()}
                  onExpandGlobal={handleExpandGlobal}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
    />
  );
});

export default MainPage;
