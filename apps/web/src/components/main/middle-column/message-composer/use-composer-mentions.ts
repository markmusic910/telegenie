'use client';

import { useSDK, useStore, useStoreEntities } from '@/lib/contexts/sdk.context';
import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import { Dialog, type User } from '@telegenie/sdk';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  extractMentionQuery,
  filterMentionUsers,
  type MentionQueryMatch,
} from './mention.utils';

const SUPERGROUP_SEARCH_DEBOUNCE_MS = 250;
const SUPERGROUP_INITIAL_LIMIT = 200;

export type UseComposerMentionsOptions = {
  peerId: string;
  text: string;
  disabled?: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInsertUser: (user: User, range: MentionQueryMatch) => void;
};

export type UseComposerMentionsResult = {
  isOpen: boolean;
  users: User[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  dismiss: () => void;
  selectUser: (user: User) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  syncSelection: (input?: HTMLTextAreaElement | null) => void;
};

export function useComposerMentions({
  peerId,
  text,
  disabled = false,
  inputRef,
  onInsertUser,
}: UseComposerMentionsOptions): UseComposerMentionsResult {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const userStore = useStore('user');
  const peerKind = Dialog.peerKindFromId(peerId);
  const channel = useStoreEntities('channel', peerKind === 'channel' ? peerId : null);
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);
  const currentUserId = globalStore.auth.currentUser?.id;

  const isBasicGroup = peerKind === 'chat';
  const isSupergroup = peerKind === 'channel' && Boolean(channel?.megagroup);

  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [supergroupParticipantIds, setSupergroupParticipantIds] = useState<string[]>([]);
  const [supergroupSearchIds, setSupergroupSearchIds] = useState<string[]>([]);
  const [remoteUserSearchIds, setRemoteUserSearchIds] = useState<string[]>([]);
  const [topInlineBotIds, setTopInlineBotIds] = useState<string[]>([]);

  const requestedBasicGroupRef = useRef<string | null>(null);
  const requestedSupergroupRef = useRef<string | null>(null);
  const requestedTopBotsRef = useRef(false);
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncSelection = useStableCallback((target?: HTMLTextAreaElement | null) => {
    const el = target ?? inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setSelection((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  });

  // Reset per-dialog state when switching dialogs
  useEffect(() => {
    setDismissedKey(null);
    setSelectedIndex(0);
    setSupergroupParticipantIds([]);
    setSupergroupSearchIds([]);
    setRemoteUserSearchIds([]);
    requestedBasicGroupRef.current = null;
    requestedSupergroupRef.current = null;
  }, [peerId]);

  const match = useMemo(() => {
    if (disabled) return undefined;
    return extractMentionQuery(text, selection.start, selection.end);
  }, [disabled, text, selection.start, selection.end]);

  const matchKey = match ? `${match.startIndex}:${match.query}` : null;

  // Clear manual dismissal when the active `@query` changes or clears
  useEffect(() => {
    if (dismissedKey && dismissedKey !== matchKey) {
      setDismissedKey(null);
    }
  }, [dismissedKey, matchKey]);

  const loadBasicGroupMembers = useStableCallback((targetPeerId: string) => {
    if (requestedBasicGroupRef.current === targetPeerId) return;
    requestedBasicGroupRef.current = targetPeerId;
    void sdk.chat.getFullChatByIds([targetPeerId], { forceRefresh: true }).catch(() => {
      if (requestedBasicGroupRef.current === targetPeerId) {
        requestedBasicGroupRef.current = null;
      }
    });
  });

  const loadSupergroupRecentParticipants = useStableCallback((targetPeerId: string) => {
    if (requestedSupergroupRef.current === targetPeerId) return;
    requestedSupergroupRef.current = targetPeerId;
    void sdk.channel
      .getParticipants(targetPeerId, { limit: SUPERGROUP_INITIAL_LIMIT, forceRefresh: true })
      .then(({ userIds }) => {
        if (!mountedRef.current || peerIdRef.current !== targetPeerId) return;
        setSupergroupParticipantIds(userIds);
      })
      .catch(() => {
        if (requestedSupergroupRef.current === targetPeerId) {
          requestedSupergroupRef.current = null;
        }
      });
  });

  const scheduleSupergroupSearch = useStableCallback(
    (targetPeerId: string, query: string): (() => void) => {
      let cancelled = false;
      const timer = setTimeout(() => {
        void sdk.channel
          .getParticipants(targetPeerId, { q: query, limit: 50 })
          .then(({ userIds }) => {
            if (!cancelled && mountedRef.current && peerIdRef.current === targetPeerId) {
              setSupergroupSearchIds(userIds);
            }
          })
          .catch(() => {
            if (!cancelled && mountedRef.current && peerIdRef.current === targetPeerId) {
              setSupergroupSearchIds([]);
            }
          });
      }, SUPERGROUP_SEARCH_DEBOUNCE_MS);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
  );

  const scheduleRemoteUserSearch = useStableCallback(
    (targetPeerId: string, query: string): (() => void) => {
      let cancelled = false;
      const timer = setTimeout(() => {
        void sdk.user
          .searchContacts(query, 20)
          .then((userIds) => {
            if (!cancelled && mountedRef.current && peerIdRef.current === targetPeerId) {
              setRemoteUserSearchIds(userIds);
            }
          })
          .catch(() => {
            if (!cancelled && mountedRef.current && peerIdRef.current === targetPeerId) {
              setRemoteUserSearchIds([]);
            }
          });
      }, SUPERGROUP_SEARCH_DEBOUNCE_MS);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
  );

  const loadTopInlineBots = useStableCallback(() => {
    if (requestedTopBotsRef.current) return;
    requestedTopBotsRef.current = true;
    void sdk.user
      .getTopInlineBots(true)
      .then((userIds) => {
        if (mountedRef.current) setTopInlineBotIds(userIds);
      })
      .catch(() => {
        requestedTopBotsRef.current = false;
      });
  });

  // Always fetch mention candidates from remote and sync to local cache when `@` is active
  useEffect(() => {
    if (!match) {
      setSupergroupSearchIds([]);
      setRemoteUserSearchIds([]);
      return;
    }

    if (match.atStartOfMessage) {
      loadTopInlineBots();
    }

    const query = match.query.trim();

    if (isBasicGroup) {
      loadBasicGroupMembers(peerId);
      setSupergroupSearchIds([]);
      setRemoteUserSearchIds([]);
      return;
    }

    if (isSupergroup) {
      setRemoteUserSearchIds([]);
      loadSupergroupRecentParticipants(peerId);
      if (!query) {
        setSupergroupSearchIds([]);
        return;
      }
      return scheduleSupergroupSearch(peerId, query);
    }

    setSupergroupSearchIds([]);
    if (!query) {
      setRemoteUserSearchIds([]);
      return;
    }
    return scheduleRemoteUserSearch(peerId, query);
  }, [
    match,
    isBasicGroup,
    isSupergroup,
    peerId,
    loadBasicGroupMembers,
    loadSupergroupRecentParticipants,
    scheduleSupergroupSearch,
    scheduleRemoteUserSearch,
    loadTopInlineBots,
  ]);

  const basicGroupMemberIds = useMemo(() => {
    if (!isBasicGroup || !chatFull?.participants) return [];
    const participants = chatFull.participants;
    if (!('participants' in participants) || !Array.isArray(participants.participants)) {
      return [];
    }
    return participants.participants
      .map((entry) => ('userId' in entry ? entry.userId : undefined))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }, [isBasicGroup, chatFull?.participants]);

  // Resolve User models from MobX store (reactive under observer())
  const candidateIds: string[] = [];
  if (match?.atStartOfMessage && topInlineBotIds.length > 0) {
    candidateIds.push(...topInlineBotIds);
  }
  if (isBasicGroup) {
    candidateIds.push(...basicGroupMemberIds);
  } else if (isSupergroup) {
    if (supergroupSearchIds.length > 0) {
      candidateIds.push(...supergroupSearchIds);
    }
    candidateIds.push(...supergroupParticipantIds);
  } else if (remoteUserSearchIds.length > 0) {
    candidateIds.push(...remoteUserSearchIds);
  }

  const candidateUsers: User[] = [];
  for (const id of candidateIds) {
    const user = userStore.get(id);
    if (user) candidateUsers.push(user);
  }

  const users = match
    ? filterMentionUsers(candidateUsers, match.query, currentUserId)
    : [];

  const isOpen = Boolean(match && users.length > 0 && dismissedKey !== matchKey);

  // Keep selectedIndex within bounds when filtered list changes
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (users.length === 0) return 0;
      return prev >= users.length ? 0 : prev;
    });
  }, [users.length]);

  const dismiss = useStableCallback(() => {
    if (matchKey) setDismissedKey(matchKey);
  });

  const selectUser = useStableCallback((user: User) => {
    if (!match) return;
    onInsertUser(user, match);
    setSelectedIndex(0);
    setDismissedKey(null);
  });

  const handleKeyDown = useStableCallback((event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isOpen || users.length === 0) return false;

    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return true;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % users.length);
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      return true;
    }

    if (
      (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) ||
      (event.key === 'Tab' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.nativeEvent.isComposing)
    ) {
      event.preventDefault();
      const chosen = users[selectedIndex] ?? users[0];
      if (chosen) selectUser(chosen);
      return true;
    }

    return false;
  });

  return {
    isOpen,
    users,
    selectedIndex,
    setSelectedIndex,
    dismiss,
    selectUser,
    handleKeyDown,
    syncSelection,
  };
}
