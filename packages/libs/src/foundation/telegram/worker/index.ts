export {
  createTelegramWorkerClient,
  type CreateTelegramWorkerClientOptions,
  type TelegramWorkerClient,
} from './create-telegram-worker-client';
export { createLazyTelegramWorkerClient } from './create-lazy-telegram-worker-client';
export {
  GET_HISTORY_LIMIT,
  GET_MESSAGES_FILL_LIMIT,
  SESSION_PASSWORD_NEEDED_CODE,
  type DialogBatch,
  type DialogFilterBatch,
  type FolderFilter,
  type FileDownloadItem,
  type FilePeerPhotoItem,
  type FileDownloadResult,
  type FileGetPartParams,
  type FileGetPartResult,
  type FullChannelBundle,
  type FullChatBundle,
  type FullUserBundle,
  type MessageNotificationPayload,
  type PeerIdAccessHash,
  type PeerIdAccessHashRequired,
  type SendCodeResult,
  type SendMediaWorkerPayload,
  type SendMediaWorkerProgressEvent,
  type SendMultiMediaWorkerItem,
  type SendMultiMediaWorkerProgressEvent,
  type SendMultiMediaWorkerPayload,
  type StoreSyncPayload,
  type DialogOrderPayload,
  type TelegramWorkerApi,
  type TelegramWorkerEvents,
  type WorkerFilePayload,
} from './telegram.api';
export { createTelegramWorkerHandlers } from './telegram.handlers';
export {
  peerIdFromTypePeer,
  toStoreSyncPayloads,
  type StoreSyncMessageOp,
} from './store-sync';
export { DialogOrderTracker } from '../services/dialog.order-tracker';
export { RpcError } from '../../worker-rpc';

// NOTE: createDefaultTelegramWorker lives in ./create-default-telegram-worker.ts
// and is intentionally not re-exported here — it uses `import.meta.url` which
// breaks Jest CJS. Import it directly from
// `@telegenie/libs/foundation/telegram/worker/create-default-telegram-worker`.
