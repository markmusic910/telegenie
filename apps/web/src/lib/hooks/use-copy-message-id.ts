'use client';

import { toastManager } from '@/lib/components/ui/toast';
import { useCallback, type MouseEvent } from 'react';

export function useCopyMessageId(messageId: string | undefined) {
  return useCallback(
    (event: MouseEvent) => {
      if (process.env.NODE_ENV !== 'development') return;
      if (event.detail !== 3 || !messageId) return;

      event.preventDefault();
      void navigator.clipboard.writeText(messageId).then(
        () => {
          toastManager.add({
            type: 'success',
            title: 'copy message id succeed',
          });
        },
        () => {
          toastManager.add({
            type: 'error',
            title: 'copy message id failed',
          });
        },
      );
    },
    [messageId],
  );
}
