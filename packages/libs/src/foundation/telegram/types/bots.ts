// Auto-generated types from api.d.ts namespace: bots
// Generated on 2025-09-13T14:20:50.992Z
//
// Namespace results live here. TL constructor `botInfo` / TypeBotInfo live in api-types
// (to be moved to a bots constructors home later) — do not shadow them with bots.BotInfo.

import type { TypeBotPreviewMedia } from './api-types';
import type { TypeUser } from './users';

/** bots.BotInfo — result of bots.getBotInfo (name/about/description), not constructor botInfo */
export type BotsBotInfo = {
  name: string;
  about: string;
  description: string;
};

export type PopularAppBots = {
  nextOffset?: string;
  users: TypeUser[];
};

export type PreviewInfo = {
  media: TypeBotPreviewMedia[];
  langCodes: string[];
};

export type TypeBotsBotInfo = BotsBotInfo;

export type TypePopularAppBots = PopularAppBots;

export type TypePreviewInfo = PreviewInfo;
