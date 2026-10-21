// Auto-generated types from api.d.ts namespace: stats
// Generated on 2025-09-13T14:20:50.991Z

import type {
  TypeBroadcastRevenueBalances,
  TypeBroadcastRevenueTransaction,
  TypeChat,
  TypePostInteractionCounters,
  TypePublicForward,
  TypeStatsAbsValueAndPrev,
  TypeStatsDateRangeDays,
  TypeStatsGraph,
  TypeStatsGroupTopAdmin,
  TypeStatsGroupTopInviter,
  TypeStatsGroupTopPoster,
  TypeStatsPercentValue,
  TypeUser,
} from './api-types';

export type BroadcastRevenueStats = {
  topHoursGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  revenueGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  balances: TypeBroadcastRevenueBalances; // Api.TypeBroadcastRevenueBalances -> TypeBroadcastRevenueBalances;
  usdRate: number; // double -> number;
};

export type BroadcastRevenueTransactions = {
  count: number; // int -> number;
  transactions: TypeBroadcastRevenueTransaction[]; // Api.TypeBroadcastRevenueTransaction[] -> TypeBroadcastRevenueTransaction[];
};

export type BroadcastRevenueWithdrawalUrl = {
  url: string; // string;
};

export type BroadcastStats = {
  period: TypeStatsDateRangeDays; // Api.TypeStatsDateRangeDays -> TypeStatsDateRangeDays;
  followers: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  viewsPerPost: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  sharesPerPost: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  reactionsPerPost: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  viewsPerStory: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  sharesPerStory: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  reactionsPerStory: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  enabledNotifications: TypeStatsPercentValue; // Api.TypeStatsPercentValue -> TypeStatsPercentValue;
  growthGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  followersGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  muteGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  topHoursGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  interactionsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  ivInteractionsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  viewsBySourceGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  newFollowersBySourceGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  languagesGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  reactionsByEmotionGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  storyInteractionsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  storyReactionsByEmotionGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  recentPostsInteractions: TypePostInteractionCounters[]; // Api.TypePostInteractionCounters[] -> TypePostInteractionCounters[];
};

export type MegagroupStats = {
  period: TypeStatsDateRangeDays; // Api.TypeStatsDateRangeDays -> TypeStatsDateRangeDays;
  members: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  messages: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  viewers: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  posters: TypeStatsAbsValueAndPrev; // Api.TypeStatsAbsValueAndPrev -> TypeStatsAbsValueAndPrev;
  growthGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  membersGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  newMembersBySourceGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  languagesGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  messagesGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  actionsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  topHoursGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  weekdaysGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  topPosters: TypeStatsGroupTopPoster[]; // Api.TypeStatsGroupTopPoster[] -> TypeStatsGroupTopPoster[];
  topAdmins: TypeStatsGroupTopAdmin[]; // Api.TypeStatsGroupTopAdmin[] -> TypeStatsGroupTopAdmin[];
  topInviters: TypeStatsGroupTopInviter[]; // Api.TypeStatsGroupTopInviter[] -> TypeStatsGroupTopInviter[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type MessageStats = {
  viewsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  reactionsByEmotionGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
};

export type PublicForwards = {
  // flags: null // null;
  count: number; // int -> number;
  forwards: TypePublicForward[]; // Api.TypePublicForward[] -> TypePublicForward[];
  nextOffset?: string; // string;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type StoryStats = {
  viewsGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  reactionsByEmotionGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
};

export type TypeBroadcastRevenueStats = BroadcastRevenueStats; // BroadcastRevenueStats

export type TypeBroadcastRevenueTransactions = BroadcastRevenueTransactions; // BroadcastRevenueTransactions

export type TypeBroadcastRevenueWithdrawalUrl = BroadcastRevenueWithdrawalUrl; // BroadcastRevenueWithdrawalUrl

export type TypeBroadcastStats = BroadcastStats; // BroadcastStats

export type TypeMegagroupStats = MegagroupStats; // MegagroupStats

export type TypeMessageStats = MessageStats; // MessageStats

export type TypePublicForwards = PublicForwards; // PublicForwards

export type TypeStoryStats = StoryStats; // StoryStats
