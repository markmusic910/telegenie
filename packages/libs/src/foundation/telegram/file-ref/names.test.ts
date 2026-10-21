import {
  classNameToPredicate,
  predicateToClassName,
  snakeToCamel,
} from './names';
import { decodeFileId, encodeFileId, encodeStoredConstructor, kindFromStoredConstructor } from './file-id';
import { indexFileRefMap } from './map-index';
import { parseFileRefError, isUpdatesEnvelope } from './engine';
import { Api } from '@telegenie/teleproto';
import type { FileReferenceMapJson } from './types';

describe('file-ref names', () => {
  it('converts snake_case params', () => {
    expect(snakeToCamel('file_reference')).toBe('fileReference');
    expect(snakeToCamel('quick_reply_shortcut_id')).toBe('quickReplyShortcutId');
  });

  it('maps className and predicates both ways', () => {
    expect(classNameToPredicate('Document')).toBe('document');
    expect(classNameToPredicate('messages.GetHistory')).toBe('messages.getHistory');
    expect(predicateToClassName('document')).toBe('Document');
    expect(predicateToClassName('messages.getHistory')).toBe('messages.GetHistory');
  });
});

describe('file-ref ids', () => {
  it('encodes and decodes photo/document keys', () => {
    expect(encodeFileId('photo', '12')).toBe('p:12');
    expect(encodeFileId('document', 99)).toBe('d:99');
    expect(decodeFileId('p:12')).toEqual({ kind: 'photo', id: '12' });
    expect(decodeFileId('d:9')).toEqual({ kind: 'document', id: '9' });
    expect(decodeFileId('x:1')).toBeUndefined();
    expect(encodeStoredConstructor('fileIdPhoto', '1')).toBe('p:1');
    expect(encodeStoredConstructor('fileIdDocument', '2')).toBe('d:2');
    expect(kindFromStoredConstructor('fileIdPhoto')).toBe('photo');
    expect(kindFromStoredConstructor('fileIdDocument')).toBe('document');
  });
});

describe('indexFileRefMap', () => {
  it('indexes incoming, outgoing, and refresh nodes', () => {
    const map = indexFileRefMap({
      _: 'fileReferenceMap',
      layer: 1,
      traversers_incoming: [
        { _: 'traverseMethodResult', name: 'messages.getHistory', push_sources: [] },
        {
          _: 'traverseIncomingConstructor',
          type: 'Message',
          predicate: 'message',
          params: [],
          push_sources: [],
        },
        {
          _: 'traverseCommitSourceLocation',
          type: 'Document',
          predicate: 'document',
          push_sources: [],
          stored_constructor: 'fileIdDocument',
        },
      ],
      traversers_outgoing: [
        { _: 'traverseMethodCall', name: 'messages.sendMedia', params: [] },
        {
          _: 'traverseOutgoingConstructor',
          type: 'InputMedia',
          predicate: 'inputMediaDocument',
          params: [],
        },
        {
          _: 'traverseSwapLocation',
          type: 'InputDocument',
          predicate: 'inputDocument',
          stored_constructor: 'fileIdDocument',
        },
      ],
      refresh_actions: [
        { _: 'refreshAction', stored_constructor: 'fileSourceMessage', action: { _: 'getMessageOp' } },
      ],
    } as FileReferenceMapJson);

    expect(map.layer).toBe(1);
    expect(map.methodResults.has('messages.getHistory')).toBe(true);
    expect(map.incomingByPredicate.has('message')).toBe(true);
    expect(map.commitsByPredicate.get('document')?.stored_constructor).toBe('fileIdDocument');
    expect(map.outgoingMethods.has('messages.sendMedia')).toBe(true);
    expect(map.outgoingByPredicate.has('inputMediaDocument')).toBe(true);
    expect(map.swapsByPredicate.has('inputDocument')).toBe(true);
    expect(map.refreshByKind.has('fileSourceMessage')).toBe(true);
  });
});

describe('parseFileRefError', () => {
  it('parses indexed and plain FILE_REFERENCE errors', () => {
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_EXPIRED' })).toEqual({});
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_INVALID' })).toEqual({});
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_EMPTY' })).toEqual({});
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_2_EXPIRED' })).toEqual({ index: 2 });
    expect(parseFileRefError({ errorMessage: 'FILE_REFERENCE_0_INVALID' })).toEqual({ index: 0 });
    expect(parseFileRefError({ errorMessage: 'FLOOD_WAIT_3' })).toBeUndefined();
    expect(parseFileRefError('nope')).toBeUndefined();
  });
});

describe('isUpdatesEnvelope', () => {
  it('detects Updates constructors', () => {
    expect(isUpdatesEnvelope(new Api.UpdatesTooLong())).toBe(true);
    expect(isUpdatesEnvelope({})).toBe(false);
  });
});
