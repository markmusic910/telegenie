import {
  albumPreviewPlaceholder,
  collectAlbumPreview,
  decodeVoiceWaveform,
  formatDialogPreviewText,
  Message,
} from './message.model';
import type { MessageEntity } from '../../types';

const DATA_URI = 'data:image/jpeg;base64,abc';

const sampleMessage = (overrides: Partial<MessageEntity> = {}): Message =>
  new Message({
    kind: 'message',
    id: '1',
    peerId: '-100',
    peerType: 'group',
    message: '',
    date: 1,
    out: false,
    fromId: '200',
    fromType: 'user',
    post: false,
    isEmpty: false,
    ...overrides,
  });

describe('formatDialogPreviewText', () => {
  it('replaces a self @username mention with @you', () => {
    const message = sampleMessage({
      message: '@dmike1115 hello',
      entities: [
        {
          className: 'MessageEntityMention',
          offset: 0,
          length: 10,
        },
      ],
    });
    expect(
      formatDialogPreviewText(message, { currentUsername: 'dmike1115' }),
    ).toBe('@you hello');
  });

  it('replaces a self mention-name entity with @you', () => {
    const message = sampleMessage({
      message: 'hi Alice',
      entities: [
        {
          className: 'MessageEntityMentionName',
          offset: 3,
          length: 5,
          userId: '42',
        },
      ],
    });
    expect(formatDialogPreviewText(message, { currentUserId: '42' })).toBe('hi @you');
  });

  it('falls back to @username replacement when mentioned but entities are missing', () => {
    const message = sampleMessage({
      message: '@dmike1115 hello',
      mentioned: true,
    });
    expect(
      formatDialogPreviewText(message, { currentUsername: 'dmike1115' }),
    ).toBe('@you hello');
  });

  it('leaves other usernames unchanged', () => {
    const message = sampleMessage({
      message: '@alice hello',
      entities: [
        {
          className: 'MessageEntityMention',
          offset: 0,
          length: 6,
        },
      ],
    });
    expect(
      formatDialogPreviewText(message, { currentUsername: 'dmike1115' }),
    ).toBe('@alice hello');
  });
});

describe('Message.hasUnreadMention', () => {
  it('is true only when mentioned and mediaUnread', () => {
    expect(sampleMessage({ mentioned: true, mediaUnread: true }).hasUnreadMention).toBe(true);
    expect(sampleMessage({ mentioned: true, mediaUnread: false }).hasUnreadMention).toBe(false);
    expect(sampleMessage({ mentioned: false, mediaUnread: true }).hasUnreadMention).toBe(false);
  });
});

describe('Message preview helpers', () => {
  it('classifies a real photo and exposes a stripped thumb data URI', () => {
    const message = sampleMessage({
      media: {
        photo: {
          id: '50',
          accessHash: '51',
          fileReference: 'aGk=',
          date: 1,
          sizes: [{ type: 'i', bytes: DATA_URI }],
          dcId: 2,
        },
      },
    });
    expect(message.previewKind).toBe('photo');
    expect(message.previewThumbDataUri).toBe(DATA_URI);
    expect(message.summaryText).toBe('Photo');
  });

  it('classifies a video document including round video messages', () => {
    const message = sampleMessage({
      media: {
        video: true,
        round: true,
        document: {
          id: '1',
          accessHash: '2',
          fileReference: 'AQ==',
          date: 1,
          mimeType: 'video/mp4',
          size: '1',
          thumbs: [{ type: 'j', bytes: DATA_URI }],
          dcId: 1,
          attributes: [{ roundMessage: true, duration: 3, w: 4, h: 5 }],
        },
      },
    });
    expect(message.previewKind).toBe('video');
    expect(message.previewThumbDataUri).toBe(DATA_URI);
    expect(message.summaryText).toBe('Video message');
  });

  it('does not preview voice messages', () => {
    const message = sampleMessage({
      media: {
        voice: true,
        document: {
          id: '1',
          accessHash: '2',
          fileReference: 'AQ==',
          date: 1,
          mimeType: 'audio/ogg',
          size: '1',
          dcId: 1,
          attributes: [{ voice: true, duration: 2 }],
        },
      },
    });
    expect(message.previewKind).toBeUndefined();
    expect(message.previewThumbDataUri).toBeUndefined();
    expect(message.summaryText).toBe('Voice message');
    expect(message.isVoice).toBe(true);
    expect(message.voiceDocument?.id).toBe('1');
    expect(message.voiceDuration).toBe(2);
    expect(message.voiceWaveform).toEqual([]);
    expect(message.isDocument).toBe(false);
    expect(message.isVideo).toBe(false);
  });

  it('decodes a packed voice waveform', () => {
    const waveform = globalThis.btoa(String.fromCharCode(0x1f));
    expect(decodeVoiceWaveform(waveform)).toEqual([31]);
    expect(decodeVoiceWaveform(undefined)).toEqual([]);

    const message = sampleMessage({
      media: {
        voice: true,
        document: {
          id: '1',
          accessHash: '2',
          fileReference: 'AQ==',
          date: 1,
          mimeType: 'audio/ogg',
          size: '1',
          dcId: 1,
          attributes: [{ voice: true, duration: 4, waveform }],
        },
      },
    });
    expect(message.voiceDuration).toBe(4);
    expect(message.voiceWaveform).toEqual([31]);
  });

  it('collects up to 3 album thumbs and uses the first caption', () => {
    const album = [
      sampleMessage({
        id: '11',
        groupedId: '9',
        media: {
          photo: {
            id: '1',
            accessHash: '1',
            fileReference: '',
            date: 1,
            sizes: [{ type: 'i', bytes: `${DATA_URI}1` }],
            dcId: 2,
          },
        },
      }),
      sampleMessage({
        id: '12',
        groupedId: '9',
        message: 'album caption',
        media: {
          photo: {
            id: '2',
            accessHash: '2',
            fileReference: '',
            date: 1,
            sizes: [{ type: 'i', bytes: `${DATA_URI}2` }],
            dcId: 2,
          },
        },
      }),
      sampleMessage({
        id: '13',
        groupedId: '9',
        media: {
          photo: {
            id: '3',
            accessHash: '3',
            fileReference: '',
            date: 1,
            sizes: [{ type: 'i', bytes: `${DATA_URI}3` }],
            dcId: 2,
          },
        },
      }),
      sampleMessage({
        id: '14',
        groupedId: '9',
        media: {
          photo: {
            id: '4',
            accessHash: '4',
            fileReference: '',
            date: 1,
            sizes: [{ type: 'i', bytes: `${DATA_URI}4` }],
            dcId: 2,
          },
        },
      }),
    ];
    const preview = collectAlbumPreview(album, album[3]!);
    expect(preview).toEqual({
      kind: 'photo',
      count: 4,
      thumbs: [`${DATA_URI}1`, `${DATA_URI}2`, `${DATA_URI}3`],
      caption: 'album caption',
    });
  });

  it('skips thumbs without a data URI and uses Photo/Photos placeholders', () => {
    const last = sampleMessage({
      media: {
        photo: {
          id: '1',
          accessHash: '1',
          fileReference: '',
          date: 1,
          sizes: [{ type: 'm', w: 1, h: 2, size: 3 }],
          dcId: 2,
        },
      },
    });
    const preview = collectAlbumPreview([last], last);
    expect(preview).toEqual({
      kind: 'photo',
      count: 1,
      thumbs: [],
      caption: undefined,
    });
    expect(albumPreviewPlaceholder('photo', 1)).toBe('Photo');
    expect(albumPreviewPlaceholder('photo', 2)).toBe('Photos');
    expect(albumPreviewPlaceholder('video', 1)).toBe('Video');
    expect(albumPreviewPlaceholder('video', 2)).toBe('Videos');
  });

  it('exposes media convenience getters for photos, videos, and documents', () => {
    const photoMsg = sampleMessage({
      groupedId: '42',
      media: {
        photo: {
          id: '100',
          accessHash: '200',
          fileReference: '',
          date: 1000,
          sizes: [
            { type: 's', w: 100, h: 100, size: 500 },
            { type: 'y', w: 800, h: 600, size: 50000 },
          ],
          dcId: 2,
        },
      },
    });

    expect(photoMsg.isPhoto).toBe(true);
    expect(photoMsg.isVideo).toBe(false);
    expect(photoMsg.isDocument).toBe(false);
    expect(photoMsg.isInAlbum).toBe(true);
    expect(photoMsg.photo?.id).toBe('100');
    expect(photoMsg.mediaDimensions).toEqual({ width: 800, height: 600 });
    expect(photoMsg.mediaMimeType).toBe('image/jpeg');

    const videoMsg = sampleMessage({
      media: {
        document: {
          id: '300',
          accessHash: '400',
          fileReference: '',
          date: 2000,
          mimeType: 'video/mp4',
          size: '10485760',
          dcId: 2,
          attributes: [
            { w: 1920, h: 1080, duration: 45, roundMessage: false },
            { fileName: 'clip.mp4' },
          ],
        },
      },
    });

    expect(videoMsg.isPhoto).toBe(false);
    expect(videoMsg.isVideo).toBe(true);
    expect(videoMsg.isRoundVideo).toBe(false);
    expect(videoMsg.isDocument).toBe(false);
    expect(videoMsg.mediaFileName).toBe('clip.mp4');
    expect(videoMsg.mediaFileSize).toBe(10485760);
    expect(videoMsg.mediaDuration).toBe(45);
    expect(videoMsg.mediaDimensions).toEqual({ width: 1920, height: 1080 });

    const docMsg = sampleMessage({
      media: {
        document: {
          id: '500',
          accessHash: '600',
          fileReference: '',
          date: 3000,
          mimeType: 'application/pdf',
          size: '2048500',
          dcId: 1,
          attributes: [{ fileName: 'report.pdf' }],
        },
      },
    });

    expect(docMsg.isPhoto).toBe(false);
    expect(docMsg.isVideo).toBe(false);
    expect(docMsg.isDocument).toBe(true);
    expect(docMsg.isInAlbum).toBe(false);
    expect(docMsg.isInFileGroup).toBe(false);
    const groupedDocMsg = sampleMessage({
      groupedId: '123',
      media: {
        document: {
          id: '600',
          accessHash: '700',
          fileReference: '',
          date: 3000,
          mimeType: 'application/pdf',
          size: '2048500',
          dcId: 2,
          attributes: [{ fileName: 'report.pdf' }],
        },
      },
    });
    expect(groupedDocMsg.isInFileGroup).toBe(true);
    expect(docMsg.mediaFileName).toBe('report.pdf');
    expect(docMsg.mediaFileSize).toBe(2048500);
    expect(docMsg.mediaMimeType).toBe('application/pdf');

    // Document image (e.g. baldhead.jpg sent as document)
    const imgDocMsg = sampleMessage({
      media: {
        document: {
          id: '700',
          accessHash: '800',
          fileReference: '',
          date: 4000,
          mimeType: 'image/jpeg',
          size: '17400',
          dcId: 2,
          attributes: [
            { w: 640, h: 480 },
            { fileName: 'baldhead.jpg' },
          ],
        },
      },
    });

    expect(imgDocMsg.isPhoto).toBe(true);
    expect(imgDocMsg.isVideo).toBe(false);
    expect(imgDocMsg.isDocument).toBe(false);
    expect(imgDocMsg.photoDocument?.id).toBe('700');
    expect(imgDocMsg.mediaFileName).toBe('baldhead.jpg');
    expect(imgDocMsg.mediaDimensions).toEqual({ width: 640, height: 480 });
    expect(imgDocMsg.previewKind).toBe('photo');

    // Single video with duration < 30s
    const shortVideoMsg = sampleMessage({
      media: {
        document: {
          id: '900',
          accessHash: '901',
          fileReference: '',
          date: 5000,
          mimeType: 'video/mp4',
          size: '3900000',
          dcId: 2,
          attributes: [
            { w: 1280, h: 720, duration: 15 },
            { fileName: 'sample.mp4' },
          ],
        },
      },
    });

    expect(shortVideoMsg.isPhoto).toBe(false);
    expect(shortVideoMsg.isVideo).toBe(true);
    expect(shortVideoMsg.isDocument).toBe(false);
    expect(shortVideoMsg.mediaDuration).toBe(15);
    expect(shortVideoMsg.mediaDuration! < 30).toBe(true);
    expect(shortVideoMsg.previewKind).toBe('video');

    // Static WebP sticker
    const staticStickerMsg = sampleMessage({
      media: {
        document: {
          id: '800',
          accessHash: '801',
          fileReference: '',
          date: 6000,
          mimeType: 'image/webp',
          size: '12000',
          dcId: 2,
          attributes: [
            { w: 512, h: 512 },
            {
              alt: '👍',
              stickerset: { _: 'inputStickerSetID', id: '100', accessHash: '200' },
            },
          ],
        },
      },
    });

    expect(staticStickerMsg.isSticker).toBe(true);
    expect(staticStickerMsg.isStaticSticker).toBe(true);
    expect(staticStickerMsg.isAnimatedSticker).toBe(false);
    expect(staticStickerMsg.isVideoSticker).toBe(false);
    expect(staticStickerMsg.isPhoto).toBe(false);
    expect(staticStickerMsg.isVideo).toBe(false);
    expect(staticStickerMsg.isDocument).toBe(false);
    expect(staticStickerMsg.stickerEmoji).toBe('👍');
    expect(staticStickerMsg.stickerSet).toEqual({
      _: 'inputStickerSetID',
      id: '100',
      accessHash: '200',
    });
    expect(staticStickerMsg.stickerDocument?.id).toBe('800');
    expect(staticStickerMsg.previewKind).toBe('sticker');
    expect(staticStickerMsg.summaryText).toBe('👍 Sticker');

    // Animated TGS sticker
    const animatedStickerMsg = sampleMessage({
      media: {
        document: {
          id: '810',
          accessHash: '811',
          fileReference: '',
          date: 6001,
          mimeType: 'application/x-tgsticker',
          size: '8000',
          dcId: 2,
          attributes: [
            { w: 512, h: 512 },
            {
              alt: '🎉',
              stickerset: { _: 'inputStickerSetID', id: '101', accessHash: '201' },
            },
          ],
        },
      },
    });

    expect(animatedStickerMsg.isSticker).toBe(true);
    expect(animatedStickerMsg.isAnimatedSticker).toBe(true);
    expect(animatedStickerMsg.isStaticSticker).toBe(false);
    expect(animatedStickerMsg.isDocument).toBe(false);
    expect(animatedStickerMsg.previewKind).toBe('sticker');
    expect(animatedStickerMsg.summaryText).toBe('🎉 Sticker');

    // Video WebM sticker
    const videoStickerMsg = sampleMessage({
      media: {
        document: {
          id: '820',
          accessHash: '821',
          fileReference: '',
          date: 6002,
          mimeType: 'video/webm',
          size: '15000',
          dcId: 2,
          attributes: [
            { w: 512, h: 512 },
            {
              alt: '🔥',
              stickerset: { _: 'inputStickerSetID', id: '102', accessHash: '202' },
            },
          ],
        },
      },
    });

    expect(videoStickerMsg.isSticker).toBe(true);
    expect(videoStickerMsg.isVideoSticker).toBe(true);
    expect(videoStickerMsg.isVideo).toBe(false);
    expect(videoStickerMsg.isPhoto).toBe(false);
    expect(videoStickerMsg.isDocument).toBe(false);
    expect(videoStickerMsg.previewKind).toBe('sticker');
    expect(videoStickerMsg.summaryText).toBe('🔥 Sticker');
  });
});

describe('Message reply preview', () => {
  const replyMessage = (
    replyTo: MessageEntity['replyTo'],
    overrides: Partial<MessageEntity> = {},
  ) =>
    sampleMessage({
      replyTo,
      ...overrides,
    });

  it('hasInlineReplyPreview is false for replyToMsgId only', () => {
    const message = replyMessage({ replyToMsgId: 1 });
    expect(message.hasInlineReplyPreview).toBe(false);
  });

  it('hasInlineReplyPreview is true for quoteText', () => {
    const message = replyMessage({ replyToMsgId: 1, quoteText: 'quoted' });
    expect(message.hasInlineReplyPreview).toBe(true);
  });

  it('hasReplyPreviewContent hides when only replyToMsgId and no store message', () => {
    const message = replyMessage({ replyToMsgId: 99 });
    expect(message.hasReplyPreviewContent(null)).toBe(false);
  });

  it('hasReplyPreviewContent shows when the replied message is in the store', () => {
    const message = replyMessage({ replyToMsgId: 1 });
    const replied = sampleMessage({ id: '1', message: 'Kimi and gpt5.6' });
    expect(message.hasReplyPreviewContent(replied)).toBe(true);
  });

  it('hasReplyPreviewContent shows when header carries quoteText', () => {
    const message = replyMessage({ replyToMsgId: 1, quoteText: 'quoted part' });
    expect(message.hasReplyPreviewContent(null)).toBe(true);
  });

  it('replyPreviewVerificationState is true when ingest already verified the target', () => {
    const message = replyMessage({ replyToMsgId: 1 }, { replyTargetVerified: true });
    const replied = sampleMessage({ id: '1', message: 'text' });
    expect(message.replyPreviewVerificationState(replied)).toBe(true);
    expect(message.needsReplyTargetVerification(replied)).toBe(false);
  });

  it('replyPreviewVerificationState is false when ingest found no target', () => {
    const message = replyMessage({ replyToMsgId: 1 }, { replyTargetVerified: false });
    const replied = sampleMessage({ id: '1', message: 'text' });
    expect(message.replyPreviewVerificationState(replied)).toBe(false);
  });

  it('replyPreviewVerificationState returns true for inline header preview', () => {
    const message = replyMessage({ replyToMsgId: 1, quoteText: 'quoted' });
    expect(message.replyPreviewVerificationState(null)).toBe(true);
  });

  it('replyPreviewText prefers quoteText over store message', () => {
    const message = replyMessage({ replyToMsgId: 1, quoteText: 'quote wins' });
    const replied = sampleMessage({ id: '1', message: 'store loses' });
    expect(message.replyPreviewText(replied)).toBe('quote wins');
  });

  it('replyPreviewContent shows filename for document replies', () => {
    const message = replyMessage({ replyToMsgId: 1 });
    const replied = sampleMessage({
      id: '1',
      media: {
        document: {
          id: '1',
          accessHash: '2',
          fileReference: 'AQ==',
          date: 1,
          mimeType: 'application/x-sh',
          size: '1',
          dcId: 1,
          attributes: [{ fileName: 'metacomp-prod-test.sh' }],
        },
      },
    });
    const preview = message.replyPreviewContent(replied);
    expect(preview.text).toBe('metacomp-prod-test.sh');
    expect(preview.thumbs).toEqual([]);
  });

  it('replyPreviewContent includes thumb for photo replies', () => {
    const message = replyMessage({ replyToMsgId: 1 });
    const replied = sampleMessage({
      id: '1',
      media: {
        photo: {
          id: '50',
          accessHash: '51',
          fileReference: 'aGk=',
          date: 1,
          sizes: [{ type: 'i', bytes: 'data:image/jpeg;base64,abc' }],
          dcId: 2,
        },
      },
    });
    const preview = message.replyPreviewContent(replied);
    expect(preview.text).toBe('Photo');
    expect(preview.thumbs).toEqual(['data:image/jpeg;base64,abc']);
  });
});

describe('Message.toJSON', () => {
  it('serializes nested bigint fields as decimal strings', () => {
    const message = sampleMessage({
      media: {
        photo: {
          id: 50n as unknown as string,
          accessHash: 51n as unknown as string,
          fileReference: 'aGk=',
          date: 1,
          dcId: 2,
        },
      },
    });
    const parsed = JSON.parse(message.toJSON()) as {
      media: { photo: { id: string; accessHash: string } };
    };
    expect(parsed.media.photo.id).toBe('50');
    expect(parsed.media.photo.accessHash).toBe('51');
  });
});

describe('Message service messages', () => {
  it('identifies pin message and provides appropriate summaryText', () => {
    const pinWithAction = sampleMessage({
      kind: 'service',
      action: { type: 'pinMessage', isPin: true } as any,
      replyTo: { replyToMsgId: 10 } as any,
    });
    expect(pinWithAction.isPinMessage).toBe(true);
    expect(pinWithAction.summaryText).toBe('Pinned a message');

    const pinWithReplyOnly = sampleMessage({
      kind: 'service',
      action: {} as any,
      replyTo: { replyToMsgId: 10 } as any,
    });
    expect(pinWithReplyOnly.isPinMessage).toBe(true);
    expect(pinWithReplyOnly.summaryText).toBe('Pinned a message');

    const regularService = sampleMessage({
      kind: 'service',
      action: { title: 'New Group' } as any,
    });
    expect(regularService.isPinMessage).toBe(false);
    expect(regularService.summaryText).toBe('Service message');
  });

  it('identifies boost message and provides appropriate summaryText', () => {
    const singleBoost = sampleMessage({
      kind: 'service',
      action: { type: 'boostApply', boosts: 1 } as any,
    });
    expect(singleBoost.isBoostMessage).toBe(true);
    expect(singleBoost.boostCount).toBe(1);
    expect(singleBoost.summaryText).toBe('Boosted the group');

    const multiBoost = sampleMessage({
      kind: 'service',
      action: { type: 'boostApply', boosts: 4 } as any,
    });
    expect(multiBoost.isBoostMessage).toBe(true);
    expect(multiBoost.boostCount).toBe(4);
    expect(multiBoost.summaryText).toBe('Boosted the group 4 times');

    const rawBoost = sampleMessage({
      kind: 'service',
      action: { boosts: 7 } as any,
    });
    expect(rawBoost.isBoostMessage).toBe(true);
    expect(rawBoost.boostCount).toBe(7);
    expect(rawBoost.summaryText).toBe('Boosted the group 7 times');
  });
});

