 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Auto-generated types from api.d.ts namespace: payments
// Generated on 2025-09-13T14:20:50.991Z

import type {
  TypeBankCardOpenUrl,
  TypeChat,
  TypeConnectedBotStarRef,
  TypeDataJSON,
  TypeInvoice,
  TypePaymentFormMethod,
  TypePaymentRequestedInfo,
  TypePaymentSavedCredentials,
  TypePeer,
  TypeSavedStarGift,
  TypeShippingOption,
  TypeStarGift,
  TypeStarGiftAttribute,
  TypeStarRefProgram,
  TypeStarsAmount,
  TypeStarsRevenueStatus,
  TypeStarsSubscription,
  TypeStarsTransaction,
  TypeStatsGraph,
  TypeUpdates,
  TypeUser,
  TypeWebDocument,
} from './api-types';

export type BankCardData = {
  title: string; // string;
  openUrls: TypeBankCardOpenUrl[]; // Api.TypeBankCardOpenUrl[] -> TypeBankCardOpenUrl[];
};

export type CheckedGiftCode = {
  // flags: null // null;
  viaGiveaway?: boolean; // boolean;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  giveawayMsgId?: number; // int -> number;
  toId?: string; // long -> string;
  date: number; // int -> number;
  months: number; // int -> number;
  usedDate?: number; // int -> number;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ConnectedStarRefBots = {
  count: number; // int -> number;
  connectedBots: TypeConnectedBotStarRef[]; // Api.TypeConnectedBotStarRef[] -> TypeConnectedBotStarRef[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ExportedInvoice = {
  url: string; // string;
};

export type GiveawayInfo = {
  // flags: null // null;
  participating?: boolean; // boolean;
  preparingResults?: boolean; // boolean;
  startDate: number; // int -> number;
  joinedTooEarlyDate?: number; // int -> number;
  adminDisallowedChatId?: string; // long -> string;
  disallowedCountry?: string; // string;
};

export type GiveawayInfoResults = {
  // flags: null // null;
  winner?: boolean; // boolean;
  refunded?: boolean; // boolean;
  startDate: number; // int -> number;
  giftCodeSlug?: string; // string;
  starsPrize?: string; // long -> string;
  finishDate: number; // int -> number;
  winnersCount: number; // int -> number;
  activatedCount?: number; // int -> number;
};

export type PaymentForm = {
  // flags: null // null;
  canSaveCredentials?: boolean; // boolean;
  passwordMissing?: boolean; // boolean;
  formId: string; // long -> string;
  botId: string; // long -> string;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
  providerId: string; // long -> string;
  url: string; // string;
  nativeProvider?: string; // string;
  nativeParams?: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
  additionalMethods?: TypePaymentFormMethod[]; // Api.TypePaymentFormMethod[] -> TypePaymentFormMethod[];
  savedInfo?: TypePaymentRequestedInfo; // Api.TypePaymentRequestedInfo -> TypePaymentRequestedInfo;
  savedCredentials?: TypePaymentSavedCredentials[]; // Api.TypePaymentSavedCredentials[] -> TypePaymentSavedCredentials[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PaymentFormStarGift = {
  formId: string; // long -> string;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
};

export type PaymentFormStars = {
  // flags: null // null;
  formId: string; // long -> string;
  botId: string; // long -> string;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PaymentReceipt = {
  // flags: null // null;
  date: number; // int -> number;
  botId: string; // long -> string;
  providerId: string; // long -> string;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
  info?: TypePaymentRequestedInfo; // Api.TypePaymentRequestedInfo -> TypePaymentRequestedInfo;
  shipping?: TypeShippingOption; // Api.TypeShippingOption -> TypeShippingOption;
  tipAmount?: string; // long -> string;
  currency: string; // string;
  totalAmount: string; // long -> string;
  credentialsTitle: string; // string;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PaymentReceiptStars = {
  // flags: null // null;
  date: number; // int -> number;
  botId: string; // long -> string;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
  currency: string; // string;
  totalAmount: string; // long -> string;
  transactionId: string; // string;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PaymentResult = {
  updates: TypeUpdates; // Api.TypeUpdates -> TypeUpdates;
};

export type PaymentVerificationNeeded = {
  url: string; // string;
};

export type SavedInfo = {
  // flags: null // null;
  hasSavedCredentials?: boolean; // boolean;
  savedInfo?: TypePaymentRequestedInfo; // Api.TypePaymentRequestedInfo -> TypePaymentRequestedInfo;
};

export type SavedStarGifts = {
  // flags: null // null;
  count: number; // int -> number;
  chatNotificationsEnabled?: boolean; // Bool -> boolean;
  gifts: TypeSavedStarGift[]; // Api.TypeSavedStarGift[] -> TypeSavedStarGift[];
  nextOffset?: string; // string;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type StarGifts = {
  hash: number; // int -> number;
  gifts: TypeStarGift[]; // Api.TypeStarGift[] -> TypeStarGift[];
};

export type StarGiftUpgradePreview = {
  sampleAttributes: TypeStarGiftAttribute[]; // Api.TypeStarGiftAttribute[] -> TypeStarGiftAttribute[];
};

export type StarGiftWithdrawalUrl = {
  url: string; // string;
};

export type StarsRevenueAdsAccountUrl = {
  url: string; // string;
};

export type StarsRevenueStats = {
  revenueGraph: TypeStatsGraph; // Api.TypeStatsGraph -> TypeStatsGraph;
  status: TypeStarsRevenueStatus; // Api.TypeStarsRevenueStatus -> TypeStarsRevenueStatus;
  usdRate: number; // double -> number;
};

export type StarsRevenueWithdrawalUrl = {
  url: string; // string;
};

export type StarsStatus = {
  // flags: null // null;
  balance: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
  subscriptions?: TypeStarsSubscription[]; // Api.TypeStarsSubscription[] -> TypeStarsSubscription[];
  subscriptionsNextOffset?: string; // string;
  subscriptionsMissingBalance?: string; // long -> string;
  history?: TypeStarsTransaction[]; // Api.TypeStarsTransaction[] -> TypeStarsTransaction[];
  nextOffset?: string; // string;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type SuggestedStarRefBots = {
  // flags: null // null;
  count: number; // int -> number;
  suggestedBots: TypeStarRefProgram[]; // Api.TypeStarRefProgram[] -> TypeStarRefProgram[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  nextOffset?: string; // string;
};

export type UniqueStarGift = {
  gift: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ValidatedRequestedInfo = {
  // flags: null // null;
  id?: string; // string;
  shippingOptions?: TypeShippingOption[]; // Api.TypeShippingOption[] -> TypeShippingOption[];
};

export type TypeBankCardData = BankCardData; // payments.BankCardData

export type TypeCheckedGiftCode = CheckedGiftCode; // payments.CheckedGiftCode

export type TypeConnectedStarRefBots = ConnectedStarRefBots; // payments.ConnectedStarRefBots

export type TypeExportedInvoice = ExportedInvoice; // payments.ExportedInvoice

export type TypeGiveawayInfo = GiveawayInfo | GiveawayInfoResults; // payments.GiveawayInfo | payments.GiveawayInfoResults

export type TypePaymentForm = PaymentForm | PaymentFormStars | PaymentFormStarGift; // payments.PaymentForm | payments.PaymentFormStars | payments.PaymentFormStarGift

export type TypePaymentReceipt = PaymentReceipt | PaymentReceiptStars; // payments.PaymentReceipt | payments.PaymentReceiptStars

export type TypePaymentResult = PaymentResult | PaymentVerificationNeeded; // payments.PaymentResult | payments.PaymentVerificationNeeded

export type TypeSavedInfo = SavedInfo; // payments.SavedInfo

export type TypeSavedStarGifts = SavedStarGifts; // payments.SavedStarGifts

export type TypeStarGifts = StarGiftsNotModified | StarGifts; // payments.StarGiftsNotModified | payments.StarGifts

export type TypeStarGiftUpgradePreview = StarGiftUpgradePreview; // payments.StarGiftUpgradePreview

export type TypeStarGiftWithdrawalUrl = StarGiftWithdrawalUrl; // payments.StarGiftWithdrawalUrl

export type TypeStarsRevenueAdsAccountUrl = StarsRevenueAdsAccountUrl; // payments.StarsRevenueAdsAccountUrl

export type TypeStarsRevenueStats = StarsRevenueStats; // payments.StarsRevenueStats

export type TypeStarsRevenueWithdrawalUrl = StarsRevenueWithdrawalUrl; // payments.StarsRevenueWithdrawalUrl

export type TypeStarsStatus = StarsStatus; // payments.StarsStatus

export type TypeSuggestedStarRefBots = SuggestedStarRefBots; // payments.SuggestedStarRefBots

export type TypeUniqueStarGift = UniqueStarGift; // payments.UniqueStarGift

export type TypeValidatedRequestedInfo = ValidatedRequestedInfo; // payments.ValidatedRequestedInfo
