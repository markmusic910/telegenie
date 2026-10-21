'use client';

import CustomEmojiCell from '@/lib/components/custom-emoji.cell';
import { useStoreEntities } from '@/lib/contexts/sdk.context';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { observer } from 'mobx-react-lite';

export interface CustomEmojiProps {
  documentId?: string;
  fallback: string;
  size?: number;
  observeIntersectionForPlaying?: ObserveFn;
  /** See `CustomEmojiCellProps.placeholder`. */
  placeholder?: boolean;
}

/**
 * A custom emoji inside message text. The entity only has a document id, so
 * this shows `fallback` until the `customEmoji` store has the document, then
 * renders a `CustomEmojiCell`.
 */
const CustomEmoji = observer(function CustomEmoji({
  documentId,
  fallback,
  size = 20,
  observeIntersectionForPlaying,
  placeholder,
}: CustomEmojiProps) {
  const document = useStoreEntities('customEmoji', documentId);
  if (!document?.mimeType) {
    return (
      <span
        className="inline-flex items-center justify-center align-text-bottom leading-none"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.9) }}
      >
        {fallback}
      </span>
    );
  }
  return (
    <CustomEmojiCell
      document={document}
      size={size}
      observe={observeIntersectionForPlaying}
      label={fallback}
      placeholder={placeholder}
      className="pointer-events-none"
    />
  );
});

export default CustomEmoji;
