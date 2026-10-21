'use client';

import { observer } from 'mobx-react-lite';

import DialogContainer from './dialog.container';

/** Folder-scoped dialog list (folder rail lives in `(main)/layout`). */
const LeftColumnContainer = observer(() => {
  return (
    <div className="flex h-full min-w-0 w-full flex-1 overflow-x-hidden">
      <DialogContainer />
    </div>
  );
});

export default LeftColumnContainer;
