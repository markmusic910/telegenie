# @telegenie/sdk

TeleGenie SDK - A comprehensive Telegram SDK for building Telegram applications.

## Overview

This package provides a complete SDK for interacting with Telegram's API, including:

- **Foundation Layer**: Core Telegram API services and types
- **Store Layer**: MobX entity stores + global store. Every `*.slice.ts` under `src/store/global` extends `GlobalStoreSlice` (`AuthSlice`, `LeaderSlice`, `NavSlice`, `DialogSlice`, `ThreadSlice`). Controllers write; UI reads through `TeleGenieSDKView` / `StoreMapView` (no NotificationCenter bus)
- **SDK StoreCache**: Separate IndexedDB (`telegenie-sdk-cache_*`) for dialog, dialogFilter, per-peer messages, custom-emoji documents, and global. It does **not** duplicate LocalDb peers/*Full. Thread `msgIndexes` persist inside the existing `global` snapshot. Custom-emoji documents use their own `customEmoji` object store.
- **LocalDb bridge**: On `init`, opens foundation LocalDb and mirrors peer/*Full puts into MobX stores
- **Modules**: Auth, dialog, message, user, chat, channel, SW

### Message list cache

`listedIds` is the on-screen listed-scroller window (slides trim to 150; live follow on the newest window may exceed 150). `ThreadUIState.msgIndexes` remembers every cached/deleted id for that thread so scroll can slide `listedIds` from cache first.

Private chats (users / basic groups) are **not** sequential per dialog. Example: `cachedIds = [10, 12, 14, 79, 80, 82]`, `breaksAfter = [14]` → two islands `10–14` and `79–82`. Sliding `listedIds` must stop at `14` going newer (or at `79` going older). Fill with `messages.getHistory` from the edge, never by enumerating `15..78`. Deleting a cached id does not create a break.

Channels **are** sequential. `resolvedRanges` mark ID spans we have resolved. Missing ids inside a span are deleted; ids outside are unknown and may be filled with `messages.getMessages`.

LocalDb `msgIdRanges` tracks the update stream (`noteMessageId` / `DifferenceTooLong` pending). Do not use it to drive the list.

### Custom emoji documents

A custom emoji in a message is only a document id. The `customEmoji` entity store holds the document (thumb, mime type, file location). Lookup order is memory, then the `customEmoji` object store in `telegenie-sdk-cache_*`, then `messages.getCustomEmojiDocuments`. Remote calls send at most 100 ids and wait 200ms between batches. The leader tab writes IndexedDB; other tabs read it. A row with an empty `mimeType` is a placeholder, not a loaded document.

LocalDb `fileRefs` / `fileSources` only store an expired `file_reference` (`d:{id}`). Service-worker `v1-media` stores file bytes after `/media/` is fetched. Neither replaces this store.

UI reads with `useStoreEntities('customEmoji', documentId)`. Documents the UI already has (picker, composer, emoji suggest) go through `sdk.sticker.rememberCustomEmoji`. Do not keep a per-tab document map in `apps/web`.

`MessageController.selectDialog` is the dialog-list click path: it selects a chat and restores `listedIds` from the global `ThreadUI` when already loaded; otherwise it fills from `msgIndexes` or fetches around unread / latest. Jump to a specific message with `focusMessage`. `slideListedWindow` slides cache then fetches. See `packages/sdk/src/store/utils/message-cache-index.ts`.

## Installation

This is a private workspace package. Install dependencies:

```bash
yarn install
```

## Usage

App / UI code **writes through controllers** and **reads stores**. `useSDK()` is typed as `TeleGenieSDKView` so slice/entity mutators are not callable from `apps/web`.

```typescript
import { TeleGenieSDK } from '@telegenie/sdk';

const sdk = new TeleGenieSDK({ debug: false });
await sdk.init({
  apiId: Number(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH!,
  accountSlot: 'default',
});

// Writes
await sdk.message.selectDialog(peerId);
await sdk.message.slideListedWindow(peerId, 'older');
sdk.dialogFilter.selectFolder('0');

// Reads (MobX). UI hooks return StoreMapView / GlobalStoreView.
const user = sdk.store.get('user').get(userId);
const { auth, nav, dialogs } = sdk.globalStore;
const listed = sdk.getMessageStore(peerId).getAllData();
```

| Write | Controller |
| --- | --- |
| Listed window, focus, pin-to-bottom, send, mark-read | `sdk.message` |
| Folder rail selection / reorder | `sdk.dialogFilter` |
| Login | `sdk.auth` |
| Dialog list / pin order | `sdk.dialog` |
| Users, chats, channels | `sdk.user` / `sdk.chat` / `sdk.channel` |
| Custom-emoji documents already in hand | `sdk.sticker.rememberCustomEmoji` |

Store `update` / `hydrate` / `deleteByIds` and `GlobalStoreSlice` mutators (`DialogSlice`, `ThreadSlice`, …) are SDK-internal (`UpdatesController`, persist, other controllers). Do not call them from UI.

## Development

```bash
# Build teleproto (dependency) and the web app
yarn build

# Type checking
yarn workspace @telegenie/sdk exec tsc -p tsconfig.json --noEmit

# Unit tests
yarn workspace @telegenie/sdk test
```

## Dependencies

- `@telegenie/teleproto` — vendored [teleproto](https://github.com/sanyok12345/teleproto) (`packages/teleproto`)
- `mobx` — State management
- `lodash-es` — Utility functions
- `eventemitter2` — Event handling

teleproto is built automatically before every root/web build. To rebuild manually:

```bash
yarn workspace @telegenie/teleproto build
```
