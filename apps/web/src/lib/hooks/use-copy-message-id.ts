'use client';

import { toast } from 'sonner';
import { useCallback, type MouseEvent } from 'react';

export function useCopyMessageId(messageId: string | undefined) {
  return useCallback(
    (event: MouseEvent) => {
      if (process.env.NODE_ENV !== 'development') return;
      if (event.detail !== 3 || !messageId) return;

      event.preventDefault();
      void navigator.clipboard.writeText(messageId).then(
        () => {
          toast.success('copy message id succeed');
        },
        () => {
          toast.error('copy message id failed');
        },
      );
    },
    [messageId],
  );
}
