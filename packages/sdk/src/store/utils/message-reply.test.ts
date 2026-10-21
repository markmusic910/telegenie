import {
  collectMissingReplyTargetIds,
  stampReplyTargetVerified,
} from './message-reply';
import type { MessageEntity } from '../types';

function entity(overrides: Partial<MessageEntity> = {}): MessageEntity {
  return {
    kind: 'message',
    id: '1',
    peerId: '7',
    peerType: 'user',
    date: 1,
    message: '',
    isEmpty: false,
    ...overrides,
  };
}

describe('stampReplyTargetVerified', () => {
  it('marks inline header previews as verified without a stored target', () => {
    const [stamped] = stampReplyTargetVerified(
      [entity({ id: '2', replyTo: { replyToMsgId: 1, quoteText: 'quoted' } })],
      () => undefined,
    );
    expect(stamped.replyTargetVerified).toBe(true);
  });

  it('marks store-only replies verified when the target is in the same batch', () => {
    const target = entity({ id: '1', message: 'hello' });
    const reply = entity({ id: '2', replyTo: { replyToMsgId: 1 } });
    const stamped = stampReplyTargetVerified([target, reply], () => undefined);
    expect(stamped.find((item) => item.id === '2')?.replyTargetVerified).toBe(true);
  });

  it('marks store-only replies verified when the target is already stored', () => {
    const stored = entity({ id: '1', message: 'hello' });
    const [stamped] = stampReplyTargetVerified(
      [entity({ id: '2', replyTo: { replyToMsgId: 1 } })],
      (peerId, messageId) => (peerId === '7' && messageId === '1' ? stored : undefined),
    );
    expect(stamped.replyTargetVerified).toBe(true);
  });

  it('hides replies whose target is missing', () => {
    const [stamped] = stampReplyTargetVerified(
      [entity({ id: '2', replyTo: { replyToMsgId: 99 } })],
      () => undefined,
    );
    expect(stamped.replyTargetVerified).toBe(false);
  });
});

describe('collectMissingReplyTargetIds', () => {
  it('skips inline previews and targets already in the batch', () => {
    const missing = collectMissingReplyTargetIds(
      [
        entity({ id: '1', message: 'hello' }),
        entity({ id: '2', replyTo: { replyToMsgId: 1 } }),
        entity({ id: '3', replyTo: { replyToMsgId: 8, quoteText: 'q' } }),
      ],
      () => undefined,
    );
    expect(missing.size).toBe(0);
  });

  it('collects store-only targets that are not in the batch or store', () => {
    const missing = collectMissingReplyTargetIds(
      [entity({ id: '2', replyTo: { replyToMsgId: 40 } })],
      () => undefined,
    );
    expect(missing.get('7')).toEqual(['40']);
  });
});
