import {
  EDIT_TIME_LIMIT_SEC,
  canCopyMessage,
  canDeleteForAll,
  canDeleteMessage,
  canEditTextMessage,
  canForwardMessage,
  canNotifyPin,
  canPinMessage,
  canUnpinMessage,
  messageMenuActions,
  selectionMenuActions,
  type MessageActionChat,
  type MessageActionTarget,
} from './can-message-actions';

const NOW = 1_700_000_000;

function message(overrides: Partial<MessageActionTarget> = {}): MessageActionTarget {
  return {
    id: '12',
    kind: 'message',
    peerId: '42',
    out: false,
    message: '',
    date: 0,
    ...overrides,
  };
}

const privateChat: MessageActionChat = { peerKind: 'user' };
const basicGroup: MessageActionChat = { peerKind: 'chat' };
const supergroup: MessageActionChat = { peerKind: 'channel', megagroup: true };
const channel: MessageActionChat = { peerKind: 'channel', broadcast: true };

describe('message menu actions', () => {
  it('copies a normal message and hides protected or service messages', () => {
    expect(canCopyMessage({ message: message(), chat: privateChat })).toBe(true);
    expect(canCopyMessage({ message: message({ noforwards: true }), chat: privateChat })).toBe(false);
    expect(canCopyMessage({ message: message(), chat: { ...basicGroup, noforwards: true } })).toBe(false);
    expect(canCopyMessage({ message: message({ kind: 'service' }), chat: privateChat })).toBe(false);
    expect(canCopyMessage({ message: message({ isSticker: true }), chat: privateChat })).toBe(false);
  });

  it('forwards a normal message and hides TTL or protected messages', () => {
    expect(canForwardMessage({ message: message(), chat: privateChat })).toBe(true);
    expect(canForwardMessage({ message: message({ ttlPeriod: 30 }), chat: privateChat })).toBe(false);
    expect(canForwardMessage({ message: message({ noforwards: true }), chat: supergroup })).toBe(false);
    expect(canForwardMessage({ message: message(), chat: { ...channel, noforwards: true } })).toBe(false);
    expect(canForwardMessage({ message: message({ kind: 'service' }), chat: privateChat })).toBe(false);
  });

  it('lets private chats and creators pin, and requires rights elsewhere', () => {
    expect(canPinMessage({ message: message(), chat: privateChat })).toBe(true);
    expect(canPinMessage({ message: message(), chat: { ...supergroup, creator: true } })).toBe(true);
    expect(canPinMessage({ message: message(), chat: supergroup })).toBe(false);
    expect(
      canPinMessage({
        message: message(),
        chat: { ...supergroup, adminRights: { pinMessages: true } },
      }),
    ).toBe(true);
    expect(
      canPinMessage({
        message: message(),
        chat: { ...channel, adminRights: { editMessages: true } },
      }),
    ).toBe(true);
    expect(canPinMessage({ message: message(), chat: channel })).toBe(false);
    expect(
      canPinMessage({
        message: message(),
        chat: {
          ...basicGroup,
          adminRights: { pinMessages: true },
          defaultBannedRights: { pinMessages: true },
        },
      }),
    ).toBe(false);
    expect(
      canPinMessage({
        message: message(),
        chat: { ...basicGroup, forbidden: true, adminRights: { pinMessages: true } },
      }),
    ).toBe(false);
  });

  it('offers unpin when the message is pinned or listed', () => {
    expect(canUnpinMessage({ message: message({ pinned: true }), chat: privateChat })).toBe(true);
    expect(canPinMessage({ message: message({ pinned: true }), chat: privateChat })).toBe(false);
    expect(
      canUnpinMessage({
        message: message(),
        chat: privateChat,
        pinnedMessageIds: [12],
      }),
    ).toBe(true);
    expect(canUnpinMessage({ message: message({ kind: 'service', pinned: true }), chat: privateChat })).toBe(
      false,
    );
  });

  it('deletes in private chats, basic groups, and with rights', () => {
    expect(canDeleteMessage({ message: message(), chat: privateChat })).toBe(true);
    expect(canDeleteMessage({ message: message(), chat: basicGroup })).toBe(true);
    expect(canDeleteMessage({ message: message({ out: true }), chat: channel })).toBe(true);
    expect(canDeleteMessage({ message: message(), chat: channel })).toBe(false);
    expect(
      canDeleteMessage({
        message: message(),
        chat: { ...channel, adminRights: { deleteMessages: true } },
      }),
    ).toBe(true);
    expect(canDeleteMessage({ message: message({ kind: 'service' }), chat: privateChat })).toBe(false);
  });

  it('offers delete-for-everyone only in private chats and basic groups', () => {
    expect(canDeleteForAll({ message: message(), chat: privateChat })).toBe(true);
    expect(
      canDeleteForAll({
        message: message({ peerId: '7' }),
        chat: privateChat,
        currentUserId: '7',
      }),
    ).toBe(false);
    expect(canDeleteForAll({ message: message(), chat: { ...privateChat, bot: true } })).toBe(false);
    expect(canDeleteForAll({ message: message({ out: true }), chat: basicGroup })).toBe(true);
    expect(canDeleteForAll({ message: message(), chat: basicGroup })).toBe(false);
    expect(
      canDeleteForAll({
        message: message(),
        chat: { ...basicGroup, adminRights: { deleteMessages: true } },
      }),
    ).toBe(true);
    expect(canDeleteForAll({ message: message({ out: true }), chat: supergroup })).toBe(false);
    expect(canDeleteForAll({ message: message({ out: true }), chat: channel })).toBe(false);
    expect(
      canDeleteForAll({
        message: message({ out: true }),
        chat: { ...basicGroup, forbidden: true },
      }),
    ).toBe(false);
  });

  it('notifies on pin for other people, groups, and supergroups', () => {
    expect(canNotifyPin({ message: message(), chat: privateChat })).toBe(true);
    expect(
      canNotifyPin({
        message: message({ peerId: '7' }),
        chat: privateChat,
        currentUserId: '7',
      }),
    ).toBe(false);
    expect(canNotifyPin({ message: message(), chat: basicGroup })).toBe(false);
    expect(
      canNotifyPin({
        message: message(),
        chat: { ...basicGroup, adminRights: { pinMessages: true } },
      }),
    ).toBe(true);
    expect(
      canNotifyPin({
        message: message(),
        chat: { ...supergroup, adminRights: { pinMessages: true } },
      }),
    ).toBe(true);
    expect(
      canNotifyPin({
        message: message(),
        chat: { ...channel, adminRights: { editMessages: true } },
      }),
    ).toBe(false);
  });

  it('bundles the flags', () => {
    expect(messageMenuActions({ message: message(), chat: privateChat })).toMatchObject({
      canEdit: false,
      canCopy: true,
      canForward: true,
      canPin: true,
      canUnpin: false,
      canDelete: true,
      canDeleteForAll: true,
      canNotifyPin: true,
    });
    expect(
      messageMenuActions({
        message: message({ message: 'hello', out: true, date: NOW - 60 }),
        chat: privateChat,
        nowSec: NOW,
      }).canEdit,
    ).toBe(true);
  });
});

function textMessage(overrides: Partial<MessageActionTarget> = {}): MessageActionTarget {
  return message({
    message: 'hello',
    out: true,
    date: NOW - 60,
    ...overrides,
  });
}

describe('canEditTextMessage', () => {
  it('allows an own text message inside the edit window', () => {
    expect(canEditTextMessage({ message: textMessage(), nowSec: NOW })).toBe(true);
  });

  it('allows a message one second inside the 48 hour window', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ date: NOW - (EDIT_TIME_LIMIT_SEC - 1) }),
        nowSec: NOW,
      }),
    ).toBe(true);
  });

  it('hides Edit once the 48 hour window has elapsed', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ date: NOW - EDIT_TIME_LIMIT_SEC }),
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('keeps Saved Messages editable after the window', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ peerId: '7', date: NOW - EDIT_TIME_LIMIT_SEC - 10 }),
        currentUserId: '7',
        nowSec: NOW,
      }),
    ).toBe(true);
  });

  it('hides forwarded messages', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ fwdFrom: { date: 1 } }),
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('hides stickers and other non-text media', () => {
    expect(
      canEditTextMessage({
        message: textMessage({
          media: { document: { id: '1' } } as MessageActionTarget['media'],
        }),
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('allows a text message that only has a webpage preview', () => {
    expect(
      canEditTextMessage({
        message: textMessage({
          media: { webpage: { id: '1', url: 'https://example.com' } } as MessageActionTarget['media'],
        }),
        nowSec: NOW,
      }),
    ).toBe(true);
  });

  it('lets a broadcast-channel admin edit another post after the window', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ out: false, date: NOW - EDIT_TIME_LIMIT_SEC - 10 }),
        chat: { broadcast: true, adminRights: { editMessages: true } },
        nowSec: NOW,
      }),
    ).toBe(true);
  });

  it('hides another user post in a broadcast channel without edit rights', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ out: false }),
        chat: { broadcast: true },
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('lets a supergroup member with pin rights edit their own message indefinitely', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ date: NOW - EDIT_TIME_LIMIT_SEC - 10 }),
        chat: { megagroup: true, adminRights: { pinMessages: true } },
        nowSec: NOW,
      }),
    ).toBe(true);
  });

  it('does not let pin rights edit someone else in a supergroup', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ out: false }),
        chat: { megagroup: true, adminRights: { pinMessages: true } },
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('does not give a basic-group creator an unlimited window', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ date: NOW - EDIT_TIME_LIMIT_SEC }),
        chat: { creator: true },
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('hides Edit in a forbidden chat', () => {
    expect(
      canEditTextMessage({
        message: textMessage(),
        chat: { forbidden: true },
        nowSec: NOW,
      }),
    ).toBe(false);
  });

  it('hides service messages and empty text', () => {
    expect(
      canEditTextMessage({
        message: textMessage({ kind: 'service' }),
        nowSec: NOW,
      }),
    ).toBe(false);
    expect(
      canEditTextMessage({
        message: textMessage({ message: '   ' }),
        nowSec: NOW,
      }),
    ).toBe(false);
  });
});

describe('selection menu actions', () => {
  it('allows nothing for an empty selection', () => {
    expect(selectionMenuActions([])).toEqual({
      canCopy: false,
      canDelete: false,
      canDeleteForAll: false,
    });
  });

  it('requires every selected message to allow the action', () => {
    const mine = message({ id: '1', out: true });
    const theirs = message({ id: '2', out: false });
    expect(selectionMenuActions([{ message: mine, chat: supergroup }, { message: theirs, chat: supergroup }]))
      .toEqual({ canCopy: true, canDelete: false, canDeleteForAll: false });
    expect(selectionMenuActions([{ message: mine, chat: privateChat }, { message: theirs, chat: privateChat }]))
      .toEqual({ canCopy: true, canDelete: true, canDeleteForAll: true });
  });

  it('hides Copy when any selected message is protected', () => {
    const result = selectionMenuActions([
      { message: message({ id: '1' }), chat: privateChat },
      { message: message({ id: '2', noforwards: true }), chat: privateChat },
    ]);
    expect(result.canCopy).toBe(false);
    expect(result.canDelete).toBe(true);
  });
});
