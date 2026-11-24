'use client';

import MessagePreview from '@/lib/components/message.preview';
import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Popover, PopoverPopup, PopoverTrigger } from '@/lib/components/ui/popover';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';
import { Field, FieldError } from '@/lib/components/ui/field';
import { Textarea } from '@/lib/components/ui/textarea';
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { useGlobalStoreThread, useMessage, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import { cn } from '@/lib/utils';
import { coveringCustomEmojiId, rebaseEntities, soleEmoji } from '@/lib/utils/emoji.grapheme';
import {
  Channel,
  Chat,
  Dialog,
  MAIN_THREAD_ID,
  SERVICE_NOTIFICATIONS_USER_ID,
  type Document,
  type OutgoingMessageEntity,
  type User,
} from '@telegenie/sdk';
import type { InputCompletionOption } from '@telegenie/agent/worker';
import { BellOff, Check, Clock, Forward, Pencil, Send, Smile, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { z } from 'zod';
import ComposerAttachMenu from './composer-attach.menu';
import ComposerCompleteSuggest from './composer-complete.suggest';
import ComposerEmojiMirror, {
  type ComposerEmojiSpan,
  type ComposerMentionSpan,
} from './composer-emoji.mirror';
import EmojiSuggest from './emoji.suggest';
import MentionSuggest from './mention.suggest';
import { buildMentionInsertion, type MentionQueryMatch } from './mention.utils';
import { useComposerMentions } from './use-composer-mentions';
import MessageStickerPicker from '../message.sticker-picker';
import MediaSendDialog from '../media-send/media-send.dialog';

const SUGGEST_INPUT_COMPLETIONS_TOOL = 'suggest_input_completions';

const suggestInputCompletionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        text: z
          .string()
          .min(1)
          .describe('The full suggested message text to place into the composer input.'),
        label: z
          .string()
          .optional()
          .describe('Short 1-2 word tone or style label, e.g. "Natural", "Concise", "Warm".'),
      }),
    )
    .min(1)
    .max(4)
    .describe('3 to 4 distinct message completion options for the user to choose from.'),
});

function serverDraftKey(dialog: Dialog | null): string {
  const draft = dialog?.draft;
  if (!draft || !('message' in draft) || !draft.message) return '';
  const replyToMsgId =
    draft.replyTo && 'replyToMsgId' in draft.replyTo ? draft.replyTo.replyToMsgId : '';
  return `${draft.message}\n${replyToMsgId}`;
}

export interface MessageComposerProps {
  peerId: string;
}

function mediaRightBanned(
  channel: Channel | null,
  chat: Chat | null,
  right: 'sendStickers' | 'sendGifs',
): boolean {
  if (channel?.bannedRights?.[right] || channel?.defaultBannedRights?.[right]) return true;
  if (chat?.defaultBannedRights?.[right]) return true;
  return false;
}

function postingDisabled(peerId: string, channel: Channel | null, chat: Chat | null): boolean {
  if (peerId === SERVICE_NOTIFICATIONS_USER_ID) return true;
  const kind = Dialog.peerKindFromId(peerId);
  if (kind === 'channel' && channel) {
    if (channel.bannedRights?.sendMessages || channel.defaultBannedRights?.sendMessages) return true;
    if (channel.broadcast && !channel.creator && !channel.adminRights?.postMessages) return true;
  }
  if (kind === 'chat' && chat?.defaultBannedRights?.sendMessages) return true;
  return false;
}

const ComposerReply = observer(function ComposerReply({
  peerId,
  messageId,
  onClear,
}: {
  peerId: string;
  messageId: string;
  onClear: () => void;
}) {
  const message = useMessage(peerId, messageId);
  return (
    <div className="flex min-w-0 items-center gap-2 border-s-2 border-primary ps-2">
      <MessagePreview
        variant="reply"
        text={message?.summaryText || 'Message'}
        className="min-w-0 flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Cancel reply"
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  );
});

const ComposerForward = observer(function ComposerForward({ peerId }: { peerId: string }) {
  const sdk = useSDK();
  const thread = useGlobalStoreThread(peerId);
  const forwarding = thread?.forwarding;
  const message = useMessage(forwarding?.fromPeerId, forwarding?.messageId);
  if (!forwarding) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2 border-s-2 border-primary ps-2">
        <Forward className="size-4 shrink-0 text-primary" aria-hidden />
        <MessagePreview
          variant="reply"
          text={message?.summaryText || 'Message'}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Cancel forward"
          onClick={() => sdk.messageDraft.clearForward(peerId)}
        >
          <X />
        </Button>
      </div>
      <label className="flex items-center gap-2 ps-1 text-sm">
        <Checkbox
          checked={forwarding.dropAuthor}
          onCheckedChange={(checked) => sdk.messageDraft.setForwardDropAuthor(peerId, checked === true)}
        />
        Hide sender name
      </label>
    </div>
  );
});

const ComposerEdit = observer(function ComposerEdit({
  peerId,
  messageId,
  onClear,
}: {
  peerId: string;
  messageId: string;
  onClear: () => void;
}) {
  const message = useMessage(peerId, messageId);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Pencil className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-2 border-s-2 border-primary ps-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-4 text-primary">Edit Message</div>
          <div className="truncate text-xs leading-4 text-muted-foreground">
            {message?.message || 'Message'}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Cancel edit"
          onClick={onClear}
        >
          <X />
        </Button>
      </div>
    </div>
  );
});

function composerInputClass(multiline: boolean): string {
  return cn(
    'w-full',
    '[&_[data-slot=textarea]]:!min-h-0',
    '[&_[data-slot=textarea]]:!field-sizing-fixed',
    '[&_[data-slot=textarea]]:resize-none',
    '[&_[data-slot=textarea]]:ps-3',
    '[&_[data-slot=textarea]]:pe-12',
    '[&_[data-slot=textarea]]:leading-5',
    '[&_[data-slot=textarea]]:py-2.5',
    multiline
      ? '[&_[data-slot=textarea]]:max-h-64 [&_[data-slot=textarea]]:overflow-y-auto sm:[&_[data-slot=textarea]]:max-h-[26rem]'
      : '[&_[data-slot=textarea]]:!h-10 [&_[data-slot=textarea]]:overflow-hidden',
  );
}

function contentScrollHeight(textarea: HTMLTextAreaElement): number {
  textarea.style.setProperty('height', '0px', 'important');
  textarea.style.setProperty('min-height', '0px', 'important');
  textarea.style.setProperty('max-height', 'none', 'important');
  const height = textarea.scrollHeight;
  textarea.style.removeProperty('height');
  textarea.style.removeProperty('min-height');
  textarea.style.removeProperty('max-height');
  return height;
}

function fitComposerTextarea(textarea: HTMLTextAreaElement): boolean {
  if (textarea.value.length === 0) {
    textarea.style.removeProperty('height');
    return false;
  }
  const contentHeight = contentScrollHeight(textarea);
  const styles = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
  const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
  const multiline =
    textarea.value.includes('\n') || contentHeight > lineHeight + padding + lineHeight * 0.75;
  if (!multiline) {
    textarea.style.removeProperty('height');
    return false;
  }
  const maxHeight = Number.parseFloat(styles.maxHeight);
  const next = Number.isFinite(maxHeight) ? Math.min(contentHeight, maxHeight) : contentHeight;
  textarea.style.setProperty('height', `${next}px`, 'important');
  return true;
}

const MessageComposer = observer(function MessageComposer({ peerId }: MessageComposerProps) {
  const sdk = useSDK();
  const thread = useGlobalStoreThread(peerId);
  const peerKind = Dialog.peerKindFromId(peerId);
  const dialog = useStoreEntities('dialog', peerId);
  const channel = useStoreEntities('channel', peerKind === 'channel' ? peerId : null);
  const chat = useStoreEntities('chat', peerKind === 'chat' ? peerId : null);
  const editingId = thread?.editingId;
  const editingMessage = useMessage(peerId, editingId);
  const editing = Boolean(editingId);
  const text = editing
    ? (thread?.editingText ?? editingMessage?.message ?? '')
    : (thread?.draft?.text ?? '');
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [multiline, setMultiline] = useState(false);
  const [dismissedEmoji, setDismissedEmoji] = useState<string>();
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionOptions, setCompletionOptions] = useState<InputCompletionOption[]>([]);
  const [completionSelectedIndex, setCompletionSelectedIndex] = useState(0);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const completionRequestIdRef = useRef(0);
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const threadDraft = thread?.draft;
  const serverDraft = serverDraftKey(dialog);
  const seenReplyIdRef = useRef(thread?.replyingToId);
  const seenEditingIdRef = useRef(editingId);
  const draftRef = useRef(threadDraft);

  const postingBlocked = postingDisabled(peerId, channel, chat);
  const disabled = editing ? false : postingBlocked;
  const canSendStickers = !editing && !mediaRightBanned(channel, chat, 'sendStickers');
  const canSendGifs = !editing && !mediaRightBanned(channel, chat, 'sendGifs');
  const originalText = editingMessage?.message ?? '';
  const activeEntities = editing
    ? (thread?.editingEntities ?? editingMessage?.entities)
    : threadDraft?.entities;
  const originalEntitiesKey = editing
    ? JSON.stringify(editingMessage?.entities ?? [])
    : '';
  const activeEntitiesKey = editing ? JSON.stringify(activeEntities ?? []) : '';
  const replyingToId = thread?.replyingToId;
  const forwarding = editing ? undefined : thread?.forwarding;
  const forwardKey = forwarding ? `${forwarding.fromPeerId}:${forwarding.messageId}` : undefined;
  const canSend = editing
    ? !sending &&
      text.trim().length > 0 &&
      (text !== originalText || activeEntitiesKey !== originalEntitiesKey)
    : !postingBlocked && !sending && (text.trim().length > 0 || Boolean(forwarding));
  const grapheme = soleEmoji(text);
  const customEmojiId = coveringCustomEmojiId(text, editing ? undefined : threadDraft?.entities);
  const emojiSpans: ComposerEmojiSpan[] = (activeEntities ?? []).flatMap((entity) =>
    entity.className === 'MessageEntityCustomEmoji' &&
    'documentId' in entity &&
    typeof entity.documentId === 'string'
      ? [{ offset: entity.offset, length: entity.length, documentId: entity.documentId }]
      : [],
  );
  const mentionSpans: ComposerMentionSpan[] = (activeEntities ?? []).flatMap((entity) =>
    entity.className === 'MessageEntityMentionName' &&
    'userId' in entity &&
    typeof entity.userId === 'string'
      ? [{ offset: entity.offset, length: entity.length, userId: entity.userId }]
      : [],
  );
  const hasMirrorSpans = emojiSpans.length > 0 || mentionSpans.length > 0;
  const suggestEmoji =
    !editing && !postingBlocked && grapheme && !customEmojiId ? grapheme : undefined;
  const showSuggest = Boolean(suggestEmoji) && dismissedEmoji !== suggestEmoji;
  const dismissSuggest = useStableCallback(() => {
    if (suggestEmoji) setDismissedEmoji(suggestEmoji);
  });

  const dismissCompletion = useStableCallback(() => {
    completionRequestIdRef.current += 1;
    setCompletionOpen(false);
    setCompletionLoading(false);
    setCompletionOptions([]);
    setCompletionSelectedIndex(0);
    setCompletionError(null);
  });

  // Dismiss any open AI completion suggestions when switching dialogs
  useEffect(() => {
    dismissCompletion();
  }, [peerId, dismissCompletion]);

  // Register the composer-scoped tab tool so the agent worker can push multi-option
  // completions directly to this composer when triggered via Tab.
  useEffect(() => {
    return sdk.agent.registerTool(
      {
        name: SUGGEST_INPUT_COMPLETIONS_TOOL,
        description:
          'Present 3 to 4 distinct message completion options above the Telegram message input box for the user to choose from.',
        parameters: suggestInputCompletionsSchema,
        scope: 'composer',
      },
      async ({ suggestions }, context) => {
        if (context.peerId && context.peerId !== peerIdRef.current) {
          return { delivered: false, reason: 'Active dialog changed' };
        }
        setCompletionOptions(suggestions);
        setCompletionSelectedIndex(0);
        setCompletionLoading(false);
        setCompletionError(null);
        setCompletionOpen(true);
        return { delivered: true, count: suggestions.length };
      },
    );
  }, [sdk.agent]);
  // Resting height matches the left-column nav bar (`h-16`) so the top borders line up.
  const stacked = Boolean(editingId || replyingToId || forwarding || error);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const nextMultiline = fitComposerTextarea(textarea);
    setMultiline((current) => (current === nextMultiline ? current : nextMultiline));
  }, [text, multiline]);

  const syncMirrorScroll = useStableCallback(() => {
    const textarea = inputRef.current;
    const mirror = mirrorRef.current;
    if (textarea && mirror) mirror.scrollTop = textarea.scrollTop;
  });

  useLayoutEffect(() => {
    syncMirrorScroll();
  }, [text, multiline, hasMirrorSpans, syncMirrorScroll]);

  useLayoutEffect(() => {
    if (seenReplyIdRef.current === replyingToId) return;
    seenReplyIdRef.current = replyingToId;
    if (!replyingToId || editingId || postingBlocked) return;
    inputRef.current?.focus();
  }, [replyingToId, editingId, postingBlocked]);

  useLayoutEffect(() => {
    if (!forwardKey || editingId || postingBlocked) return;
    inputRef.current?.focus();
  }, [forwardKey, editingId, postingBlocked]);

  useLayoutEffect(() => {
    if (seenEditingIdRef.current === editingId) return;
    seenEditingIdRef.current = editingId;
    if (!editingId) return;
    inputRef.current?.focus();
  }, [editingId]);

  useLayoutEffect(() => {
    sdk.messageDraft.adoptDialogDraft(peerId);
  }, [sdk, peerId, serverDraft]);

  useLayoutEffect(() => {
    draftRef.current = threadDraft;
  }, [threadDraft]);

  useLayoutEffect(() => {
    const peer = peerId;
    return () => {
      const draft = draftRef.current;
      if (!draft?.text) return;
      sdk.messageDraft.setDraft(peer, { ...draft });
    };
  }, [peerId, sdk]);

  const submit = useStableCallback(async () => {
    if (sendingRef.current) return;
    if (editingId) {
      if (
        text.trim().length === 0 ||
        (text === (editingMessage?.message ?? '') && activeEntitiesKey === originalEntitiesKey)
      ) {
        return;
      }
      const value = text;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      try {
        const result = await sdk.messageSend.editText(peerId, editingId, value);
        if (!result.ok) setError('Could not edit');
      } catch {
        setError('Could not edit');
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
      return;
    }
    if (postingBlocked || (text.trim().length === 0 && !forwarding)) return;
    const value = text;
    const staged = forwarding;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      if (value.trim().length > 0) {
        const result = await sdk.messageSend.sendText(peerId, value);
        if (!result.ok) {
          setError('Could not send');
          return;
        }
      }
      if (staged) {
        const forwarded = await sdk.messageSend.forwardStaged(peerId);
        if (!forwarded.ok) setError('Could not forward');
      }
    } catch {
      setError('Could not send');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  });

  const sendOutbound = useStableCallback(async (run: () => Promise<{ ok: boolean }>) => {
    if (sendingRef.current || disabled || editingId) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const result = await run();
      if (!result.ok) {
        setError('Could not send');
        return;
      }
      setPickerOpen(false);
    } catch {
      setError('Could not send');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  });

  const handleMediaSent = useStableCallback(() => {
    setPendingMediaFiles([]);
    writeText('');
  });

  const handleSendFiles = useStableCallback(
    async (files: FileList | File[], forceDocument: boolean) => {
      if (sendingRef.current || disabled || editingId || postingBlocked || !files.length) return;
      const fileList = Array.from(files);
      if (
        !forceDocument &&
        fileList.length > 0 &&
        fileList.every((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      ) {
        setPendingMediaFiles(fileList);
        setMediaDialogOpen(true);
        return;
      }
      const caption = text;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const fileCaption = i === 0 ? caption : '';
          const result = await sdk.messageSend.sendFile(peerId, file, fileCaption, {
            forceDocument,
          });
          if (!result.ok) {
            setError('Could not send');
            break;
          }
        }
      } catch {
        setError('Could not send');
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
  );

  const handlePaste = useStableCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setPendingMediaFiles([file]);
          setMediaDialogOpen(true);
          return;
        }
      }
    }
  });

  /** Write edited composer text. Custom-emoji & mention entities follow the text instead of being lost. */
  const writeText = useStableCallback((next: string) => {
    const entities = rebaseEntities(text, next, activeEntities);
    if (editingId) {
      sdk.messageDraft.setEditingText(peerId, next, MAIN_THREAD_ID, entities);
      return;
    }
    sdk.messageDraft.setDraft(
      peerId,
      next ? { text: next, ...(entities.length ? { entities } : {}) } : undefined,
    );
  });

  const insertMention = useStableCallback((user: User, range: MentionQueryMatch) => {
    const input = inputRef.current;
    const current = input?.value ?? text;
    const inserted = buildMentionInsertion(current, activeEntities, range, user);
    if (editingId) {
      sdk.messageDraft.setEditingText(peerId, inserted.text, MAIN_THREAD_ID, inserted.entities);
    } else {
      sdk.messageDraft.setDraft(
        peerId,
        inserted.text
          ? {
              text: inserted.text,
              ...(inserted.entities.length ? { entities: inserted.entities } : {}),
            }
          : undefined,
      );
    }
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(inserted.caret, inserted.caret);
      mentions.syncSelection(input);
    });
  });

  const mentions = useComposerMentions({
    peerId,
    text,
    disabled: disabled || sending,
    inputRef,
    onInsertUser: insertMention,
  });

  const insertEmoji = useStableCallback((emoji: string) => {
    const input = inputRef.current;
    const current = input?.value ?? text;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    writeText(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  });

  const insertCustomEmoji = useStableCallback((document: Document, alt: string) => {
    sdk.sticker.rememberCustomEmoji([document]);
    const input = inputRef.current;
    const current = input?.value ?? text;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${alt}${current.slice(end)}`;
    const delta = alt.length - (end - start);
    const entities = (activeEntities ?? []).flatMap((entity) => {
      if (typeof entity.offset !== 'number' || typeof entity.length !== 'number') return [];
      if (entity.offset >= end) return [{ ...entity, offset: entity.offset + delta }];
      if (entity.offset + entity.length <= start) return [entity];
      return [];
    });
    entities.push({
      className: 'MessageEntityCustomEmoji',
      offset: start,
      length: alt.length,
      documentId: document.id,
    });
    if (editingId) {
      sdk.messageDraft.setEditingText(peerId, next, MAIN_THREAD_ID, entities);
    } else {
      sdk.messageDraft.setDraft(peerId, next ? { text: next, entities } : undefined);
    }
    const caret = start + alt.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  });

  const applyCompletionOption = useStableCallback((option: InputCompletionOption) => {
    writeText(option.text);
    dismissCompletion();
    const caret = option.text.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  });

  const triggerInputCompletion = useStableCallback(async () => {
    if (disabled || sending || completionLoading) return;
    const reqId = completionRequestIdRef.current + 1;
    completionRequestIdRef.current = reqId;
    setCompletionOpen(true);
    setCompletionLoading(true);
    setCompletionError(null);
    setCompletionOptions([]);
    setCompletionSelectedIndex(0);

    try {
      const result = await sdk.agent.completeInput({
        peerId,
        currentInput: text,
        replyToMessageId: replyingToId,
        editingMessageId: editingId,
        maxOptions: 3,
      });
      if (completionRequestIdRef.current !== reqId) return;
      if (result.options.length > 0) {
        setCompletionOptions(result.options);
        setCompletionSelectedIndex(0);
      } else {
        setCompletionError('No suggestions generated. Try typing a bit more context.');
      }
    } catch (err) {
      if (completionRequestIdRef.current !== reqId) return;
      setCompletionError((err as Error)?.message || 'Failed to generate suggestions.');
    } finally {
      if (completionRequestIdRef.current === reqId) {
        setCompletionLoading(false);
      }
    }
  });

  const onKeyDown = useStableCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.handleKeyDown(event)) return;

    if (completionOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissCompletion();
        return;
      }
      if (completionOptions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setCompletionSelectedIndex((prev) => (prev + 1) % completionOptions.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setCompletionSelectedIndex(
            (prev) => (prev - 1 + completionOptions.length) % completionOptions.length,
          );
          return;
        }
        if (
          (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) ||
          (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)
        ) {
          event.preventDefault();
          const chosen = completionOptions[completionSelectedIndex] ?? completionOptions[0];
          if (chosen) applyCompletionOption(chosen);
          return;
        }
      }
    }

    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.nativeEvent.isComposing &&
      !disabled &&
      !sending
    ) {
      event.preventDefault();
      void triggerInputCompletion();
      return;
    }

    if (event.key === 'Escape' && editingId) {
      event.preventDefault();
      sdk.messageDraft.cancelEditing(peerId);
      return;
    }
    if (event.key === 'Escape' && forwarding) {
      event.preventDefault();
      sdk.messageDraft.clearForward(peerId);
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  });

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col border-t border-border px-3',
        multiline || stacked ? 'min-h-16 justify-center gap-2 py-2' : 'h-16 justify-center',
      )}
    >
      {forwarding ? <ComposerForward peerId={peerId} /> : null}
      {editingId ? (
        <ComposerEdit
          peerId={peerId}
          messageId={editingId}
          onClear={() => sdk.messageDraft.cancelEditing(peerId)}
        />
      ) : replyingToId ? (
        <ComposerReply
          peerId={peerId}
          messageId={replyingToId}
          onClear={() => sdk.messageDraft.setReplyingTo(peerId, undefined)}
        />
      ) : null}
      <TooltipProvider>
        <Field
          className={cn(
            'relative w-full gap-1',
            (showSuggest || completionOpen || mentions.isOpen) && 'z-20',
          )}
        >
          {mentions.isOpen ? (
            <MentionSuggest
              users={mentions.users}
              selectedIndex={mentions.selectedIndex}
              onSelect={mentions.selectUser}
              onHover={mentions.setSelectedIndex}
              onDismiss={mentions.dismiss}
            />
          ) : completionOpen ? (
            <ComposerCompleteSuggest
              loading={completionLoading}
              options={completionOptions}
              selectedIndex={completionSelectedIndex}
              error={completionError}
              onSelect={applyCompletionOption}
              onHover={setCompletionSelectedIndex}
              onDismiss={dismissCompletion}
            />
          ) : showSuggest && suggestEmoji ? (
            <EmojiSuggest
              emoji={suggestEmoji}
              canSendStickers={canSendStickers}
              sending={sending}
              onDismiss={dismissSuggest}
              onPickEmoji={(document, fallback) => {
                sdk.sticker.rememberCustomEmoji([document]);
                sdk.messageDraft.setDraft(peerId, {
                  text: fallback,
                  entities: [
                    {
                      className: 'MessageEntityCustomEmoji',
                      offset: 0,
                      length: fallback.length,
                      documentId: document.id,
                    },
                  ],
                });
                const caret = fallback.length;
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  inputRef.current?.setSelectionRange(caret, caret);
                });
              }}
              onSendSticker={(document) => {
                void sendOutbound(() => sdk.messageSend.sendSticker(peerId, document));
              }}
            />
          ) : null}
          <div className={cn('flex w-full gap-1', multiline ? 'items-end' : 'items-center')}>
            <ComposerAttachMenu
              disabled={postingBlocked || sending}
              onSendFiles={handleSendFiles}
            />
            <div className="relative min-w-0 flex-1">
              <Textarea
                ref={inputRef}
                aria-label="Message"
                aria-invalid={error ? true : undefined}
                placeholder={postingBlocked && !editing ? "You can't send messages here" : 'Message'}
                size="sm"
                rows={1}
                value={text}
                disabled={disabled || sending}
                className={cn(
                  composerInputClass(multiline),
                  hasMirrorSpans &&
                    '[&_[data-slot=textarea]]:relative [&_[data-slot=textarea]]:z-20 [&_[data-slot=textarea]]:text-transparent [&_[data-slot=textarea]]:[-webkit-text-fill-color:transparent] [&_[data-slot=textarea]]:caret-foreground',
                )}
                onChange={(event) => {
                  writeText(event.target.value);
                  mentions.syncSelection(event.currentTarget);
                  if (completionOpen) dismissCompletion();
                  if (error) setError(null);
                }}
                onSelect={(event) => mentions.syncSelection(event.currentTarget)}
                onClick={(event) => mentions.syncSelection(event.currentTarget)}
                onKeyUp={(event) => mentions.syncSelection(event.currentTarget)}
                onScroll={syncMirrorScroll}
                onKeyDown={onKeyDown}
                onPaste={handlePaste}
              />
              {hasMirrorSpans ? (
                <ComposerEmojiMirror
                  ref={mirrorRef}
                  text={text}
                  spans={emojiSpans}
                  mentionSpans={mentionSpans}
                  multiline={multiline}
                />
              ) : null}
              <div
                className={cn(
                  'absolute end-1.5 z-30',
                  multiline ? 'bottom-1' : 'top-1/2 -translate-y-1/2',
                )}
              >
                {disabled ? null : (
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Emoji"
                          className="text-muted-foreground"
                        />
                      }
                    >
                      <Smile aria-hidden />
                    </PopoverTrigger>
                    <PopoverPopup
                      side="top"
                      align="end"
                      className="w-auto [&_[data-slot=popover-viewport]]:px-0 [&_[data-slot=popover-viewport]]:py-0"
                    >
                      <MessageStickerPicker
                        peerId={peerId}
                        canSendStickers={canSendStickers}
                        canSendGifs={canSendGifs}
                        sending={sending}
                        onInsertEmoji={insertEmoji}
                        onInsertCustomEmoji={insertCustomEmoji}
                        onSendSticker={(document) => {
                          void sendOutbound(() => sdk.messageSend.sendSticker(peerId, document));
                        }}
                        onSendGifResult={(queryId, resultId) => {
                          void sendOutbound(() =>
                            sdk.messageSend.sendGifResult(peerId, queryId, resultId),
                          );
                        }}
                      />
                    </PopoverPopup>
                  </Popover>
                )}
              </div>
            </div>
            <ContextMenu>
              <ContextMenuTrigger className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  aria-label={editing ? 'Save edit' : 'Send'}
                  aria-disabled={!canSend || undefined}
                  loading={sending}
                  className={cn(!canSend && 'opacity-64')}
                  onClick={() => {
                    if (!canSend) return;
                    void submit();
                  }}
                >
                  {editing ? <Check aria-hidden /> : <Send aria-hidden />}
                </Button>
              </ContextMenuTrigger>
              <ContextMenuPopup>
                <ContextMenuItem disabled={!canSend || editing}>
                  <BellOff aria-hidden />
                  Send Without Sound
                </ContextMenuItem>
                <ContextMenuItem disabled={!canSend || editing}>
                  <Clock aria-hidden />
                  Schedule Message
                </ContextMenuItem>
              </ContextMenuPopup>
            </ContextMenu>
          </div>
          {error ? <FieldError match>{error}</FieldError> : null}
        </Field>
      </TooltipProvider>

      <MediaSendDialog
        open={mediaDialogOpen}
        onOpenChange={setMediaDialogOpen}
        files={pendingMediaFiles}
        peerId={peerId}
        threadId={MAIN_THREAD_ID}
        initialCaption={text}
        initialEntities={threadDraft?.entities as OutgoingMessageEntity[] | undefined}
        onSent={handleMediaSent}
      />
    </div>
  );
});

export default MessageComposer;
