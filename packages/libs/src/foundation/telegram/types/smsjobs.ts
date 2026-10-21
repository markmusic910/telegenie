// Auto-generated types from api.d.ts namespace: smsjobs
// Generated on 2025-09-13T14:20:50.992Z

export type EligibleToJoin = {
  termsUrl: string // string;
  monthlySentSms: number // int -> number;
};

export type Status = {
  // flags: null // null;
  allowInternational?: boolean // boolean;
  recentSent: number // int -> number;
  recentSince: number // int -> number;
  recentRemains: number // int -> number;
  totalSent: number // int -> number;
  totalSince: number // int -> number;
  lastGiftSlug?: string // string;
  termsUrl: string // string;
};

export type TypeEligibilityToJoin = smsjobs.EligibleToJoin; // smsjobs.EligibleToJoin

export type TypeStatus = smsjobs.Status; // smsjobs.Status

