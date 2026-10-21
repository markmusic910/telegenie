// Auto-generated types from api.d.ts namespace: help
// Generated on 2025-09-13T14:20:50.990Z

export type AppConfig = {
  hash: number // int -> number;
  config: TypeJSONValue // Api.TypeJSONValue -> TypeJSONValue;
};

export type AppUpdate = {
  // flags: null // null;
  canNotSkip?: boolean // boolean;
  id: number // int -> number;
  version: string // string;
  text: string // string;
  entities: TypeMessageEntity[] // Api.TypeMessageEntity[] -> TypeMessageEntity[];
  document?: TypeDocument // Api.TypeDocument -> TypeDocument;
  url?: string // string;
  sticker?: TypeDocument // Api.TypeDocument -> TypeDocument;
};

export type ConfigSimple = {
  date: number // int -> number;
  expires: number // int -> number;
  rules: TypeAccessPointRule[] // Api.TypeAccessPointRule[] -> TypeAccessPointRule[];
};

export type CountriesList = {
  countries: help.TypeCountry[] // help.TypeCountry[];
  hash: number // int -> number;
};

export type Country = {
  // flags: null // null;
  hidden?: boolean // boolean;
  iso2: string // string;
  defaultName: string // string;
  name?: string // string;
  countryCodes: help.TypeCountryCode[] // help.TypeCountryCode[];
};

export type CountryCode = {
  // flags: null // null;
  countryCode: string // string;
  prefixes?: string[] // string[];
  patterns?: string[] // string[];
};

export type DeepLinkInfo = {
  // flags: null // null;
  updateApp?: boolean // boolean;
  message: string // string;
  entities?: TypeMessageEntity[] // Api.TypeMessageEntity[] -> TypeMessageEntity[];
};

export type InviteText = {
  message: string // string;
};

export type PassportConfig = {
  hash: number // int -> number;
  countriesLangs: TypeDataJSON // Api.TypeDataJSON -> TypeDataJSON;
};

export type PeerColorOption = {
  // flags: null // null;
  hidden?: boolean // boolean;
  colorId: number // int -> number;
  colors?: help.TypePeerColorSet // help.TypePeerColorSet;
  darkColors?: help.TypePeerColorSet // help.TypePeerColorSet;
  channelMinLevel?: number // int -> number;
  groupMinLevel?: number // int -> number;
};

export type PeerColorProfileSet = {
  paletteColors: number[] // int[] -> number[];
  bgColors: number[] // int[] -> number[];
  storyColors: number[] // int[] -> number[];
};

export type PeerColors = {
  hash: number // int -> number;
  colors: help.TypePeerColorOption[] // help.TypePeerColorOption[];
};

export type PeerColorSet = {
  colors: number[] // int[] -> number[];
};

export type PremiumPromo = {
  statusText: string // string;
  statusEntities: TypeMessageEntity[] // Api.TypeMessageEntity[] -> TypeMessageEntity[];
  videoSections: string[] // string[];
  videos: TypeDocument[] // Api.TypeDocument[] -> TypeDocument[];
  periodOptions: TypePremiumSubscriptionOption[] // Api.TypePremiumSubscriptionOption[] -> TypePremiumSubscriptionOption[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type PromoData = {
  // flags: null // null;
  proxy?: boolean // boolean;
  expires: number // int -> number;
  peer: TypePeer // Api.TypePeer -> TypePeer;
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
  psaType?: string // string;
  psaMessage?: string // string;
};

export type PromoDataEmpty = {
  expires: number // int -> number;
};

export type RecentMeUrls = {
  urls: TypeRecentMeUrl[] // Api.TypeRecentMeUrl[] -> TypeRecentMeUrl[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type Support = {
  phoneNumber: string // string;
  user: TypeUser // Api.TypeUser -> TypeUser;
};

export type SupportName = {
  name: string // string;
};

export type TermsOfService = {
  // flags: null // null;
  popup?: boolean // boolean;
  id: TypeDataJSON // Api.TypeDataJSON -> TypeDataJSON;
  text: string // string;
  entities: TypeMessageEntity[] // Api.TypeMessageEntity[] -> TypeMessageEntity[];
  minAgeConfirm?: number // int -> number;
};

export type TermsOfServiceUpdate = {
  expires: number // int -> number;
  termsOfService: help.TypeTermsOfService // help.TypeTermsOfService;
};

export type TermsOfServiceUpdateEmpty = {
  expires: number // int -> number;
};

export type TimezonesList = {
  timezones: TypeTimezone[] // Api.TypeTimezone[] -> TypeTimezone[];
  hash: number // int -> number;
};

export type UserInfo = {
  message: string // string;
  entities: TypeMessageEntity[] // Api.TypeMessageEntity[] -> TypeMessageEntity[];
  author: string // string;
  date: number // int -> number;
};

export type TypeAppConfig = help.AppConfigNotModified | help.AppConfig; // help.AppConfigNotModified | help.AppConfig

export type TypeAppUpdate = help.AppUpdate | help.NoAppUpdate; // help.AppUpdate | help.NoAppUpdate

export type TypeConfigSimple = help.ConfigSimple; // help.ConfigSimple

export type TypeCountriesList = help.CountriesListNotModified | help.CountriesList; // help.CountriesListNotModified | help.CountriesList

export type TypeCountry = help.Country; // help.Country

export type TypeCountryCode = help.CountryCode; // help.CountryCode

export type TypeDeepLinkInfo = help.DeepLinkInfoEmpty | help.DeepLinkInfo; // help.DeepLinkInfoEmpty | help.DeepLinkInfo

export type TypeInviteText = help.InviteText; // help.InviteText

export type TypePassportConfig = help.PassportConfigNotModified | help.PassportConfig; // help.PassportConfigNotModified | help.PassportConfig

export type TypePeerColorOption = help.PeerColorOption; // help.PeerColorOption

export type TypePeerColors = help.PeerColorsNotModified | help.PeerColors; // help.PeerColorsNotModified | help.PeerColors

export type TypePeerColorSet = help.PeerColorSet | help.PeerColorProfileSet; // help.PeerColorSet | help.PeerColorProfileSet

export type TypePremiumPromo = help.PremiumPromo; // help.PremiumPromo

export type TypePromoData = help.PromoDataEmpty | help.PromoData; // help.PromoDataEmpty | help.PromoData

export type TypeRecentMeUrls = help.RecentMeUrls; // help.RecentMeUrls

export type TypeSupport = help.Support; // help.Support

export type TypeSupportName = help.SupportName; // help.SupportName

export type TypeTermsOfService = help.TermsOfService; // help.TermsOfService

export type TypeTermsOfServiceUpdate = help.TermsOfServiceUpdateEmpty | help.TermsOfServiceUpdate; // help.TermsOfServiceUpdateEmpty | help.TermsOfServiceUpdate

export type TypeTimezonesList = help.TimezonesListNotModified | help.TimezonesList; // help.TimezonesListNotModified | help.TimezonesList

export type TypeUserInfo = help.UserInfoEmpty | help.UserInfo; // help.UserInfoEmpty | help.UserInfo

