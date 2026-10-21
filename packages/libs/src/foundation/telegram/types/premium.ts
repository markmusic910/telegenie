// Auto-generated types from api.d.ts namespace: premium
// Generated on 2025-09-13T14:20:50.992Z

export type BoostsList = {
  // flags: null // null;
  count: number // int -> number;
  boosts: TypeBoost[] // Api.TypeBoost[] -> TypeBoost[];
  nextOffset?: string // string;
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type BoostsStatus = {
  // flags: null // null;
  myBoost?: boolean // boolean;
  level: number // int -> number;
  currentLevelBoosts: number // int -> number;
  boosts: number // int -> number;
  giftBoosts?: number // int -> number;
  nextLevelBoosts?: number // int -> number;
  premiumAudience?: TypeStatsPercentValue // Api.TypeStatsPercentValue -> TypeStatsPercentValue;
  boostUrl: string // string;
  prepaidGiveaways?: TypePrepaidGiveaway[] // Api.TypePrepaidGiveaway[] -> TypePrepaidGiveaway[];
  myBoostSlots?: number[] // int[] -> number[];
};

export type MyBoosts = {
  myBoosts: TypeMyBoost[] // Api.TypeMyBoost[] -> TypeMyBoost[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type TypeBoostsList = premium.BoostsList; // premium.BoostsList

export type TypeBoostsStatus = premium.BoostsStatus; // premium.BoostsStatus

export type TypeMyBoosts = premium.MyBoosts; // premium.MyBoosts

