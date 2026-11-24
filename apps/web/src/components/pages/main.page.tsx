'use client';

import { observer } from 'mobx-react-lite';
import { AnimatePresence, motion } from 'motion/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import GenieGlobalContainer from '@/components/genie/genie-global.container';
import LeftColumnContainer from '@/components/main/left-column/left-column.container';
import MainLayout, { usePanelRef } from '@/components/main/main.layout';
import MessagesContainer from '@/components/main/middle-column/messages.container';
import RightColumnContainer, {
  type RightColumnView,
} from '@/components/main/right-column/right-column.container';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { dialogHref } from '@/lib/utils/dialog-url';

/**
 * MainPage
 *
 * Coordinates LeftColumn (dialogs), MiddleColumn (messages or Genie Global View),
 * and RightColumn (Genie Copilot or Dialog Config).
 *
 * Mounted inside `app/(main)/(chats)/layout.tsx` so navigating between `/` and
 * `/chat/[dialogId]` keeps the layout, dialog list, and scroll state intact.
 */
const MainPage = observer(() => {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const router = useRouter();
  const params = useParams<{ dialogId?: string | string[] }>();
  const rawDialogId = Array.isArray(params?.dialogId) ? params.dialogId[0] : params?.dialogId;
  let dialogId: string | undefined;
  if (rawDialogId) {
    try {
      dialogId = decodeURIComponent(rawDialogId);
    } catch {
      dialogId = rawDialogId;
    }
  }
  const configPanelRef = usePanelRef();
  const [isGlobalGenieOpen, setIsGlobalGenieOpen] = useState(false);
  const [rightColumnView, setRightColumnView] = useState<RightColumnView>('GENIE');
  const wasGenieOpenBeforeGlobal = useRef(false);

  // Sync Next.js route param -> store (handles direct links and Back/Forward),
  // or redirect `/` to `/chat/<selectedDialogId>` when restored from cache.
  useEffect(() => {
    if (dialogId) {
      if (globalStore.nav.selectedDialogId !== dialogId) {
        void sdk.messageLoad.selectDialog(dialogId);
      }
      return;
    }

    const restoredId = globalStore.nav.selectedDialogId;
    if (restoredId) {
      router.replace(dialogHref(restoredId));
    }
  }, [dialogId, globalStore, router, sdk.messageLoad]);

  function toggleConfig() {
    const panel = configPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      setRightColumnView('DIALOG_CONFIG');
      panel.expand();
    } else if (rightColumnView === 'GENIE') {
      setRightColumnView('DIALOG_CONFIG');
    } else {
      panel.collapse();
    }
  }

  function openGenie() {
    const panel = configPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      setRightColumnView('GENIE');
      panel.expand();
    } else if (rightColumnView === 'GENIE') {
      setRightColumnView('DIALOG_CONFIG');
    } else {
      setRightColumnView('GENIE');
    }
  }

  function handleExpandGlobal() {
    wasGenieOpenBeforeGlobal.current = !configPanelRef.current?.isCollapsed();
    configPanelRef.current?.collapse();
    setIsGlobalGenieOpen(true);
  }

  function handleCloseGlobal() {
    setIsGlobalGenieOpen(false);
    if (wasGenieOpenBeforeGlobal.current) {
      wasGenieOpenBeforeGlobal.current = false;
      setRightColumnView('GENIE');
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
