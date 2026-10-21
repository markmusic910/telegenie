import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertTypeDataJSON,
  convertTypeInputDocument,
  convertTypeInputFile,
  convertTypeInputFileLocation,
  convertTypeInputGame,
  convertTypeInputGeoPoint,
  convertTypeInputMedia,
  convertTypeInputPhoto,
  convertTypeInputUser,
  convertTypeInputWebDocument,
  convertTypeInvoice,
  convertTypeLabeledPrice,
  convertTypeMessageEntity,
  convertTypePoll,
  convertTypePollAnswer,
  convertTypeTextWithEntities,
} from './input.converter';

const unknown = { className: 'TotallyUnknown' } as any;
const FILE_REF = Buffer.from([1, 2, 3]);

const inputFile = () =>
  new Api.InputFile({ id: bigInt(1), parts: 2, name: 'a.png', md5Checksum: 'md5' });
const inputPhoto = () =>
  new Api.InputPhoto({ id: bigInt(3), accessHash: bigInt(4), fileReference: FILE_REF });
const inputDocument = () =>
  new Api.InputDocument({ id: bigInt(5), accessHash: bigInt(6), fileReference: FILE_REF });
const inputGeoPoint = () => new Api.InputGeoPoint({ lat: 1.5, long: 2.5, accuracyRadius: 10 });

describe('convertTypeInputMedia', () => {
  it('returns undefined without media', () => {
    expect(convertTypeInputMedia(undefined)).toBeUndefined();
  });

  it('returns undefined for InputMediaEmpty', () => {
    expect(convertTypeInputMedia(new Api.InputMediaEmpty())).toBeUndefined();
  });

  it('maps InputMediaUploadedPhoto', () => {
    const media = new Api.InputMediaUploadedPhoto({
      spoiler: true,
      file: inputFile(),
      stickers: [inputDocument(), unknown],
      ttlSeconds: 30,
    });
    expect(convertTypeInputMedia(media)).toEqual({
      spoiler: true,
      file: { id: '1', parts: 2, name: 'a.png', md5Checksum: 'md5' },
      stickers: [{ id: '5', accessHash: '6', fileReference: FILE_REF }],
      ttlSeconds: 30,
    });
  });

  it('maps InputMediaUploadedPhoto without stickers', () => {
    const media = new Api.InputMediaUploadedPhoto({ file: inputFile() });
    expect(convertTypeInputMedia(media)).toMatchObject({ stickers: undefined });
  });

  it('maps InputMediaPhoto', () => {
    const media = new Api.InputMediaPhoto({ spoiler: true, id: inputPhoto(), ttlSeconds: 5 });
    expect(convertTypeInputMedia(media)).toEqual({
      spoiler: true,
      id: { id: '3', accessHash: '4', fileReference: FILE_REF },
      ttlSeconds: 5,
    });
  });

  it('maps InputMediaGeoPoint', () => {
    const media = new Api.InputMediaGeoPoint({ geoPoint: inputGeoPoint() });
    expect(convertTypeInputMedia(media)).toEqual({
      geoPoint: { lat: 1.5, long: 2.5, accuracyRadius: 10 },
    });
  });

  it('maps InputMediaContact', () => {
    const media = new Api.InputMediaContact({
      phoneNumber: '+1',
      firstName: 'A',
      lastName: 'B',
      vcard: 'v',
    });
    expect(convertTypeInputMedia(media)).toEqual({
      phoneNumber: '+1',
      firstName: 'A',
      lastName: 'B',
      vcard: 'v',
    });
  });

  it('maps InputMediaUploadedDocument with a thumb and video cover', () => {
    const media = new Api.InputMediaUploadedDocument({
      nosoundVideo: true,
      forceFile: true,
      spoiler: true,
      file: inputFile(),
      thumb: new Api.InputFileBig({ id: bigInt(2), parts: 1, name: 'thumb' }),
      mimeType: 'video/mp4',
      attributes: [],
      stickers: [inputDocument()],
      ttlSeconds: 7,
    });
    (media as any).videoCover = inputPhoto();
    expect(convertTypeInputMedia(media)).toEqual({
      nosoundVideo: true,
      forceFile: true,
      spoiler: true,
      file: { id: '1', parts: 2, name: 'a.png', md5Checksum: 'md5' },
      thumb: { id: '2', parts: 1, name: 'thumb' },
      mimeType: 'video/mp4',
      attributes: [],
      stickers: [{ id: '5', accessHash: '6', fileReference: FILE_REF }],
      videoCover: { id: '3', accessHash: '4', fileReference: FILE_REF },
      ttlSeconds: 7,
    });
  });

  it('maps InputMediaUploadedDocument without a thumb or video cover', () => {
    const media = new Api.InputMediaUploadedDocument({
      file: inputFile(),
      mimeType: 'text/plain',
      attributes: [],
    });
    expect(convertTypeInputMedia(media)).toMatchObject({
      thumb: undefined,
      videoCover: undefined,
      stickers: undefined,
    });
  });

  it('maps InputMediaDocument with a video cover', () => {
    const media = new Api.InputMediaDocument({
      spoiler: true,
      id: inputDocument(),
      ttlSeconds: 8,
      query: 'q',
    });
    (media as any).videoCover = inputPhoto();
    (media as any).videoTimestamp = 12;
    expect(convertTypeInputMedia(media)).toEqual({
      spoiler: true,
      id: { id: '5', accessHash: '6', fileReference: FILE_REF },
      videoCover: { id: '3', accessHash: '4', fileReference: FILE_REF },
      videoTimestamp: 12,
      ttlSeconds: 8,
      query: 'q',
    });
  });

  it('maps InputMediaDocument without a video cover', () => {
    const media = new Api.InputMediaDocument({ id: inputDocument() });
    expect(convertTypeInputMedia(media)).toMatchObject({ videoCover: undefined });
  });

  it('maps InputMediaVenue', () => {
    const media = new Api.InputMediaVenue({
      geoPoint: inputGeoPoint(),
      title: 'T',
      address: 'A',
      provider: 'P',
      venueId: 'V',
      venueType: 'VT',
    });
    expect(convertTypeInputMedia(media)).toEqual({
      geoPoint: { lat: 1.5, long: 2.5, accuracyRadius: 10 },
      title: 'T',
      address: 'A',
      provider: 'P',
      venueId: 'V',
      venueType: 'VT',
    });
  });

  it('maps InputMediaPhotoExternal', () => {
    const media = new Api.InputMediaPhotoExternal({
      spoiler: true,
      url: 'http://x',
      ttlSeconds: 1,
    });
    expect(convertTypeInputMedia(media)).toEqual({
      spoiler: true,
      url: 'http://x',
      ttlSeconds: 1,
    });
  });

  it('maps InputMediaDocumentExternal with a video cover', () => {
    const media = new Api.InputMediaDocumentExternal({
      spoiler: true,
      url: 'http://y',
      ttlSeconds: 2,
    });
    (media as any).videoCover = inputPhoto();
    (media as any).videoTimestamp = 3;
    expect(convertTypeInputMedia(media)).toEqual({
      spoiler: true,
      url: 'http://y',
      ttlSeconds: 2,
      videoCover: { id: '3', accessHash: '4', fileReference: FILE_REF },
      videoTimestamp: 3,
    });
  });

  it('maps InputMediaDocumentExternal without a video cover', () => {
    const media = new Api.InputMediaDocumentExternal({ url: 'http://y' });
    expect(convertTypeInputMedia(media)).toMatchObject({ videoCover: undefined });
  });

  it('maps InputMediaGame', () => {
    const media = new Api.InputMediaGame({
      id: new Api.InputGameID({ id: bigInt(9), accessHash: bigInt(10) }),
    });
    expect(convertTypeInputMedia(media)).toEqual({ id: { id: '9', accessHash: '10' } });
  });

  it('maps InputMediaInvoice with a photo and extended media', () => {
    const media = new Api.InputMediaInvoice({
      title: 'Inv',
      description: 'D',
      photo: new Api.InputWebDocument({
        url: 'http://p',
        size: 10,
        mimeType: 'image/png',
        attributes: [],
      }),
      invoice: new Api.Invoice({
        currency: 'USD',
        prices: [new Api.LabeledPrice({ label: 'L', amount: bigInt(100) })],
      }),
      payload: Buffer.from([1]),
      provider: 'stripe',
      providerData: new Api.DataJSON({ data: '{}' }),
      startParam: 'sp',
      extendedMedia: new Api.InputMediaDice({ emoticon: '🎲' }),
    });
    expect(convertTypeInputMedia(media)).toMatchObject({
      title: 'Inv',
      description: 'D',
      photo: { url: 'http://p', size: 10, mimeType: 'image/png', attributes: [] },
      provider: 'stripe',
      providerData: { data: '{}' },
      startParam: 'sp',
      extendedMedia: { emoticon: '🎲' },
    });
  });

  it('maps InputMediaInvoice without a photo or extended media', () => {
    const media = new Api.InputMediaInvoice({
      title: 'Inv',
      description: 'D',
      invoice: new Api.Invoice({ currency: 'USD', prices: [] }),
      payload: Buffer.from([1]),
      provider: 'stripe',
      providerData: new Api.DataJSON({ data: '{}' }),
    });
    expect(convertTypeInputMedia(media)).toMatchObject({
      photo: undefined,
      extendedMedia: undefined,
    });
  });

  it('maps InputMediaGeoLive', () => {
    const media = new Api.InputMediaGeoLive({
      stopped: true,
      geoPoint: inputGeoPoint(),
      heading: 90,
      period: 60,
      proximityNotificationRadius: 100,
    });
    expect(convertTypeInputMedia(media)).toEqual({
      stopped: true,
      geoPoint: { lat: 1.5, long: 2.5, accuracyRadius: 10 },
      heading: 90,
      period: 60,
      proximityNotificationRadius: 100,
    });
  });

  it('maps InputMediaPoll', () => {
    const media = new Api.InputMediaPoll({
      poll: new Api.Poll({
        id: bigInt(1),
        question: new Api.TextWithEntities({ text: 'Q?', entities: [] }),
        answers: [
          new Api.PollAnswer({
            text: new Api.TextWithEntities({ text: 'A', entities: [] }),
            option: Buffer.from([0]),
          }),
        ],
      }),
      correctAnswers: [Buffer.from([0])],
      solution: 'because',
      solutionEntities: [new Api.MessageEntityBold({ offset: 0, length: 2 }), unknown],
    });
    expect(convertTypeInputMedia(media)).toMatchObject({
      poll: {
        id: '1',
        closed: false,
        question: { text: 'Q?', entities: [] },
        answers: [{ text: { text: 'A', entities: [] }, option: Buffer.from([0]) }],
      },
      solution: 'because',
      solutionEntities: [{ offset: 0, length: 2 }, unknown],
    });
  });

  it('maps InputMediaPoll without solution entities', () => {
    const media = new Api.InputMediaPoll({
      poll: new Api.Poll({
        id: bigInt(1),
        question: new Api.TextWithEntities({ text: 'Q?', entities: [] }),
        answers: [],
      }),
    });
    expect(convertTypeInputMedia(media)).toMatchObject({ solutionEntities: undefined });
  });

  it('maps InputMediaDice', () => {
    expect(convertTypeInputMedia(new Api.InputMediaDice({ emoticon: '🎯' }))).toEqual({
      emoticon: '🎯',
    });
  });

  it('maps InputMediaStory', () => {
    const media = new Api.InputMediaStory({
      peer: new Api.InputPeerChat({ chatId: bigInt(4) }),
      id: 11,
    });
    expect(convertTypeInputMedia(media)).toEqual({ peer: { chatId: '-4' }, id: 11 });
  });

  it('maps InputMediaWebPage', () => {
    const media = new Api.InputMediaWebPage({
      forceLargeMedia: true,
      forceSmallMedia: true,
      optional: true,
      url: 'http://z',
    });
    expect(convertTypeInputMedia(media)).toEqual({
      forceLargeMedia: true,
      forceSmallMedia: true,
      optional: true,
      url: 'http://z',
    });
  });

  it('maps InputMediaPaidMedia', () => {
    const media = new Api.InputMediaPaidMedia({
      starsAmount: bigInt(500),
      extendedMedia: [new Api.InputMediaDice({ emoticon: '🎲' }), new Api.InputMediaEmpty()],
      payload: 'pl',
    });
    expect(convertTypeInputMedia(media)).toEqual({
      starsAmount: '500',
      extendedMedia: [{ emoticon: '🎲' }],
      payload: 'pl',
    });
  });

  it('returns undefined for unknown media', () => {
    expect(convertTypeInputMedia(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputFile', () => {
  it('returns undefined without a file', () => {
    expect(convertTypeInputFile(undefined)).toBeUndefined();
  });

  it('maps InputFile', () => {
    expect(convertTypeInputFile(inputFile())).toEqual({
      id: '1',
      parts: 2,
      name: 'a.png',
      md5Checksum: 'md5',
    });
  });

  it('maps InputFileBig', () => {
    const file = new Api.InputFileBig({ id: bigInt(2), parts: 3, name: 'big.bin' });
    expect(convertTypeInputFile(file)).toEqual({ id: '2', parts: 3, name: 'big.bin' });
  });

  it('maps InputFileStoryDocument', () => {
    const file = new Api.InputFileStoryDocument({ id: inputDocument() });
    expect(convertTypeInputFile(file)).toEqual({
      id: { id: '5', accessHash: '6', fileReference: FILE_REF },
    });
  });

  it('returns undefined for an unknown file', () => {
    expect(convertTypeInputFile(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputFileLocation', () => {
  it('returns undefined without a location', () => {
    expect(convertTypeInputFileLocation(undefined)).toBeUndefined();
  });

  it('maps InputFileLocation', () => {
    const location = new Api.InputFileLocation({
      volumeId: bigInt(1),
      localId: 2,
      secret: bigInt(3),
      fileReference: FILE_REF,
    });
    expect(convertTypeInputFileLocation(location)).toEqual({
      volumeId: '1',
      localId: 2,
      secret: '3',
      fileReference: FILE_REF,
    });
  });

  it('maps InputEncryptedFileLocation', () => {
    const location = new Api.InputEncryptedFileLocation({
      id: bigInt(1),
      accessHash: bigInt(2),
    });
    expect(convertTypeInputFileLocation(location)).toEqual({ id: '1', accessHash: '2' });
  });

  it('maps InputDocumentFileLocation', () => {
    const location = new Api.InputDocumentFileLocation({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: FILE_REF,
      thumbSize: 'm',
    });
    expect(convertTypeInputFileLocation(location)).toEqual({
      id: '1',
      accessHash: '2',
      fileReference: FILE_REF,
      thumbSize: 'm',
    });
  });

  it('maps InputSecureFileLocation', () => {
    const location = new Api.InputSecureFileLocation({ id: bigInt(1), accessHash: bigInt(2) });
    expect(convertTypeInputFileLocation(location)).toEqual({ id: '1', accessHash: '2' });
  });

  it('maps InputPhotoFileLocation', () => {
    const location = new Api.InputPhotoFileLocation({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: FILE_REF,
      thumbSize: 'y',
    });
    expect(convertTypeInputFileLocation(location)).toEqual({
      id: '1',
      accessHash: '2',
      fileReference: FILE_REF,
      thumbSize: 'y',
    });
  });

  it('maps InputPhotoLegacyFileLocation', () => {
    const location = new Api.InputPhotoLegacyFileLocation({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: FILE_REF,
      volumeId: bigInt(3),
      localId: 4,
      secret: bigInt(5),
    });
    expect(convertTypeInputFileLocation(location)).toEqual({
      id: '1',
      accessHash: '2',
      fileReference: FILE_REF,
      volumeId: '3',
      localId: 4,
      secret: '5',
    });
  });

  it('maps InputStickerSetThumb', () => {
    const stickerset = new Api.InputStickerSetShortName({ shortName: 'pack' });
    const location = new Api.InputStickerSetThumb({ stickerset, thumbVersion: 2 });
    expect(convertTypeInputFileLocation(location)).toEqual({ stickerset, thumbVersion: 2 });
  });

  it('maps InputGroupCallStream', () => {
    const call = new Api.InputGroupCall({ id: bigInt(1), accessHash: bigInt(2) });
    const location = new Api.InputGroupCallStream({
      call,
      timeMs: bigInt(1000),
      scale: 1,
      videoChannel: 2,
      videoQuality: 3,
    });
    expect(convertTypeInputFileLocation(location)).toEqual({
      call,
      timeMs: '1000',
      scale: 1,
      videoChannel: 2,
      videoQuality: 3,
    });
  });

  it('returns undefined for an unknown location', () => {
    expect(convertTypeInputFileLocation(unknown)).toBeUndefined();
  });
});

describe('input photo/document/geo point converters', () => {
  it.each([
    ['convertTypeInputPhoto', convertTypeInputPhoto],
    ['convertTypeInputDocument', convertTypeInputDocument],
    ['convertTypeInputGeoPoint', convertTypeInputGeoPoint],
  ])('%s returns undefined for missing and unknown values', (_label, convert) => {
    expect((convert as (v?: unknown) => unknown)(undefined)).toBeUndefined();
    expect((convert as (v?: unknown) => unknown)(unknown)).toBeUndefined();
  });

  it('maps InputPhoto', () => {
    expect(convertTypeInputPhoto(inputPhoto())).toEqual({
      id: '3',
      accessHash: '4',
      fileReference: FILE_REF,
    });
  });

  it('maps InputDocument', () => {
    expect(convertTypeInputDocument(inputDocument())).toEqual({
      id: '5',
      accessHash: '6',
      fileReference: FILE_REF,
    });
  });

  it('maps InputGeoPoint', () => {
    expect(convertTypeInputGeoPoint(inputGeoPoint())).toEqual({
      lat: 1.5,
      long: 2.5,
      accuracyRadius: 10,
    });
  });

  it('returns undefined for InputGeoPointEmpty', () => {
    expect(convertTypeInputGeoPoint(new Api.InputGeoPointEmpty())).toBeUndefined();
  });
});

describe('convertTypeInputUser', () => {
  it('returns undefined without a user', () => {
    expect(convertTypeInputUser(undefined)).toBeUndefined();
  });

  it('maps InputUser', () => {
    const user = new Api.InputUser({ userId: bigInt(4), accessHash: bigInt(5) });
    expect(convertTypeInputUser(user)).toEqual({ userId: '4', accessHash: '5' });
  });

  it('maps InputUserFromMessage', () => {
    const user = new Api.InputUserFromMessage({
      peer: new Api.InputPeerChat({ chatId: bigInt(2) }),
      msgId: 7,
      userId: bigInt(4),
    });
    expect(convertTypeInputUser(user)).toEqual({
      peer: { chatId: '-2' },
      msgId: 7,
      userId: '4',
    });
  });

  it('returns undefined for InputUserSelf', () => {
    expect(convertTypeInputUser(new Api.InputUserSelf())).toBeUndefined();
  });
});

describe('convertTypeTextWithEntities', () => {
  it('maps TextWithEntities and drops unconvertible entities', () => {
    const text = new Api.TextWithEntities({
      text: 'hello',
      entities: [new Api.MessageEntityBold({ offset: 0, length: 5 })],
    });
    expect(convertTypeTextWithEntities(text)).toEqual({
      text: 'hello',
      entities: [{ offset: 0, length: 5, className: 'MessageEntityBold' }],
    });
  });

  it('handles a missing entity list', () => {
    const text = new Api.TextWithEntities({ text: 'hello' } as any);
    expect(convertTypeTextWithEntities(text)).toEqual({ text: 'hello', entities: undefined });
  });

  it('passes through unknown values', () => {
    expect(convertTypeTextWithEntities(unknown)).toBe(unknown);
  });
});

describe('convertTypePollAnswer', () => {
  it('maps PollAnswer', () => {
    const answer = new Api.PollAnswer({
      text: new Api.TextWithEntities({ text: 'A', entities: [] }),
      option: Buffer.from([1]),
    });
    expect(convertTypePollAnswer(answer)).toEqual({
      text: { text: 'A', entities: [] },
      option: Buffer.from([1]),
    });
  });

  it('passes through unknown values', () => {
    expect(convertTypePollAnswer(unknown)).toBe(unknown);
  });
});

describe('convertTypeInputGame', () => {
  it('returns undefined without a game', () => {
    expect(convertTypeInputGame(undefined)).toBeUndefined();
  });

  it('maps InputGameID', () => {
    const game = new Api.InputGameID({ id: bigInt(1), accessHash: bigInt(2) });
    expect(convertTypeInputGame(game)).toEqual({ id: '1', accessHash: '2' });
  });

  it('maps InputGameShortName', () => {
    const game = new Api.InputGameShortName({
      botId: new Api.InputUser({ userId: bigInt(3), accessHash: bigInt(4) }),
      shortName: 'game',
    });
    expect(convertTypeInputGame(game)).toEqual({
      botId: { userId: '3', accessHash: '4' },
      shortName: 'game',
    });
  });

  it('returns undefined for an unknown game', () => {
    expect(convertTypeInputGame(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputWebDocument', () => {
  it('returns undefined without a document', () => {
    expect(convertTypeInputWebDocument(undefined)).toBeUndefined();
  });

  it('maps InputWebDocument', () => {
    const doc = new Api.InputWebDocument({
      url: 'http://d',
      size: 5,
      mimeType: 'text/plain',
      attributes: [],
    });
    expect(convertTypeInputWebDocument(doc)).toEqual({
      url: 'http://d',
      size: 5,
      mimeType: 'text/plain',
      attributes: [],
    });
  });

  it('returns undefined for an unknown document', () => {
    expect(convertTypeInputWebDocument(unknown)).toBeUndefined();
  });
});

describe('convertTypeInvoice', () => {
  it('maps a full invoice', () => {
    const invoice = new Api.Invoice({
      test: true,
      nameRequested: true,
      phoneRequested: true,
      emailRequested: true,
      shippingAddressRequested: true,
      flexible: true,
      phoneToProvider: true,
      emailToProvider: true,
      recurring: true,
      currency: 'USD',
      prices: [new Api.LabeledPrice({ label: 'L', amount: bigInt(10) })],
      maxTipAmount: bigInt(20),
      suggestedTipAmounts: [bigInt(1), bigInt(2)],
      termsUrl: 'http://terms',
    });
    expect(convertTypeInvoice(invoice)).toEqual({
      test: true,
      nameRequested: true,
      phoneRequested: true,
      emailRequested: true,
      shippingAddressRequested: true,
      flexible: true,
      phoneToProvider: true,
      emailToProvider: true,
      recurring: true,
      currency: 'USD',
      prices: [{ label: 'L', amount: '10' }],
      maxTipAmount: '20',
      suggestedTipAmounts: ['1', '2'],
      termsUrl: 'http://terms',
    });
  });

  it('defaults missing invoice flags', () => {
    const invoice = new Api.Invoice({ currency: 'EUR', prices: [] });
    expect(convertTypeInvoice(invoice)).toMatchObject({
      test: false,
      nameRequested: false,
      recurring: false,
      prices: [],
      maxTipAmount: undefined,
      suggestedTipAmounts: undefined,
    });
  });

  it('passes through unknown invoices', () => {
    expect(convertTypeInvoice(unknown)).toBe(unknown);
  });
});

describe('convertTypeLabeledPrice', () => {
  it('maps LabeledPrice', () => {
    expect(convertTypeLabeledPrice(new Api.LabeledPrice({ label: 'L', amount: bigInt(3) }))).toEqual(
      { label: 'L', amount: '3' },
    );
  });

  it('passes through unknown prices', () => {
    expect(convertTypeLabeledPrice(unknown)).toBe(unknown);
  });
});

describe('convertTypeDataJSON', () => {
  it('maps DataJSON', () => {
    expect(convertTypeDataJSON(new Api.DataJSON({ data: '{"a":1}' }))).toEqual({ data: '{"a":1}' });
  });

  it('passes through unknown values', () => {
    expect(convertTypeDataJSON(unknown)).toBe(unknown);
  });
});

describe('convertTypePoll', () => {
  it('maps a full poll', () => {
    const poll = new Api.Poll({
      id: bigInt(12),
      closed: true,
      publicVoters: true,
      multipleChoice: true,
      quiz: true,
      question: new Api.TextWithEntities({ text: 'Q?', entities: [] }),
      answers: [
        new Api.PollAnswer({
          text: new Api.TextWithEntities({ text: 'A', entities: [] }),
          option: Buffer.from([0]),
        }),
      ],
      closePeriod: 60,
      closeDate: 100,
    });
    expect(convertTypePoll(poll)).toEqual({
      id: '12',
      closed: true,
      publicVoters: true,
      multipleChoice: true,
      quiz: true,
      question: { text: 'Q?', entities: [] },
      answers: [{ text: { text: 'A', entities: [] }, option: Buffer.from([0]) }],
      closePeriod: 60,
      closeDate: 100,
    });
  });

  it('defaults missing poll flags', () => {
    const poll = new Api.Poll({
      id: bigInt(12),
      question: new Api.TextWithEntities({ text: 'Q?', entities: [] }),
    } as any);
    expect(convertTypePoll(poll)).toMatchObject({
      closed: false,
      publicVoters: false,
      multipleChoice: false,
      quiz: false,
      answers: undefined,
    });
  });

  it('passes through unknown polls', () => {
    expect(convertTypePoll(unknown)).toBe(unknown);
  });
});

describe('convertTypeMessageEntity', () => {
  it('returns undefined without an entity', () => {
    expect(convertTypeMessageEntity(undefined as unknown as Api.TypeMessageEntity)).toBeUndefined();
  });

  it.each([
    ['MessageEntityUnknown', () => new Api.MessageEntityUnknown({ offset: 0, length: 1 })],
    ['MessageEntityMention', () => new Api.MessageEntityMention({ offset: 0, length: 1 })],
    ['MessageEntityHashtag', () => new Api.MessageEntityHashtag({ offset: 0, length: 1 })],
    ['MessageEntityBotCommand', () => new Api.MessageEntityBotCommand({ offset: 0, length: 1 })],
    ['MessageEntityUrl', () => new Api.MessageEntityUrl({ offset: 0, length: 1 })],
    ['MessageEntityEmail', () => new Api.MessageEntityEmail({ offset: 0, length: 1 })],
    ['MessageEntityBold', () => new Api.MessageEntityBold({ offset: 0, length: 1 })],
    ['MessageEntityItalic', () => new Api.MessageEntityItalic({ offset: 0, length: 1 })],
    ['MessageEntityCode', () => new Api.MessageEntityCode({ offset: 0, length: 1 })],
    ['MessageEntityPhone', () => new Api.MessageEntityPhone({ offset: 0, length: 1 })],
    ['MessageEntityCashtag', () => new Api.MessageEntityCashtag({ offset: 0, length: 1 })],
    ['MessageEntityUnderline', () => new Api.MessageEntityUnderline({ offset: 0, length: 1 })],
    ['MessageEntityStrike', () => new Api.MessageEntityStrike({ offset: 0, length: 1 })],
    ['MessageEntityBankCard', () => new Api.MessageEntityBankCard({ offset: 0, length: 1 })],
    ['MessageEntitySpoiler', () => new Api.MessageEntitySpoiler({ offset: 0, length: 1 })],
  ])('maps %s to the base offset/length/className shape', (label, build) => {
    expect(convertTypeMessageEntity(build())).toEqual({
      offset: 0,
      length: 1,
      className: label,
    });
  });

  it('maps MessageEntityPre with a language', () => {
    const entity = new Api.MessageEntityPre({ offset: 1, length: 2, language: 'ts' });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityPre',
      language: 'ts',
    });
  });

  it('maps MessageEntityTextUrl', () => {
    const entity = new Api.MessageEntityTextUrl({ offset: 1, length: 2, url: 'http://u' });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityTextUrl',
      url: 'http://u',
    });
  });

  it('maps MessageEntityMentionName', () => {
    const entity = new Api.MessageEntityMentionName({ offset: 1, length: 2, userId: bigInt(9) });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityMentionName',
      userId: '9',
    });
  });

  it('maps InputMessageEntityMentionName', () => {
    // The converter marks `userId` as a raw peer id, so a bare id is used here.
    const entity = new Api.InputMessageEntityMentionName({
      offset: 1,
      length: 2,
      userId: bigInt(9),
    } as any);
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'InputMessageEntityMentionName',
      userId: '9',
    });
  });

  it('maps MessageEntityCustomEmoji', () => {
    const entity = new Api.MessageEntityCustomEmoji({
      offset: 1,
      length: 2,
      documentId: bigInt(77),
    });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityCustomEmoji',
      documentId: '77',
    });
  });

  it('maps MessageEntityBlockquote', () => {
    const entity = new Api.MessageEntityBlockquote({ offset: 1, length: 2, collapsed: true });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityBlockquote',
      collapsed: true,
    });
  });

  it('defaults a missing blockquote collapsed flag', () => {
    const entity = new Api.MessageEntityBlockquote({ offset: 1, length: 2 });
    expect(convertTypeMessageEntity(entity)).toEqual({
      offset: 1,
      length: 2,
      className: 'MessageEntityBlockquote',
      collapsed: false,
    });
  });

  it('passes through unknown entities', () => {
    expect(convertTypeMessageEntity(unknown)).toBe(unknown);
  });
});
