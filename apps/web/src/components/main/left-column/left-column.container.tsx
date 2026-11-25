'use client';

import { observer } from 'mobx-react-lite';

import ContactContainer from './contact.container';
import DialogContainer from './dialog.container';

export type LeftColumnMode = 'dialogs' | 'contacts';

interface LeftColumnContainerProps {
  mode?: LeftColumnMode;
}

/** Left column container switching between folder-scoped dialogs and contacts (folder rail lives in `(main)/layout`). */
const LeftColumnContainer = observer(({ mode = 'dialogs' }: LeftColumnContainerProps) => {
  return (
    <div className="flex h-full min-w-0 w-full flex-1 overflow-x-hidden">
      {mode === 'contacts' ? <ContactContainer /> : <DialogContainer />}
    </div>
  );
});

export default LeftColumnContainer;
