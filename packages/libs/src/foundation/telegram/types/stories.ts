// Auto-generated types from api.d.ts namespace: stories
// Generated on 2025-09-13T14:20:50.992Z

export type AllStories = {
  // flags: null // null;
  hasMore?: boolean // boolean;
  count: number // int -> number;
  state: string // string;
  peerStories: TypePeerStories[] // Api.TypePeerStories[] -> TypePeerStories[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
  stealthMode: TypeStoriesStealthMode // Api.TypeStoriesStealthMode -> TypeStoriesStealthMode;
};

export type AllStoriesNotModified = {
  // flags: null // null;
  state: string // string;
  stealthMode: TypeStoriesStealthMode // Api.TypeStoriesStealthMode -> TypeStoriesStealthMode;
};

export type FoundStories = {
  // flags: null // null;
  count: number // int -> number;
  stories: TypeFoundStory[] // Api.TypeFoundStory[] -> TypeFoundStory[];
  nextOffset?: string // string;
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type PeerStories = {
  stories: TypePeerStories // Api.TypePeerStories -> TypePeerStories;
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type Stories = {
  // flags: null // null;
  count: number // int -> number;
  stories: TypeStoryItem[] // Api.TypeStoryItem[] -> TypeStoryItem[];
  pinnedToTop?: number[] // int[] -> number[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type StoryReactionsList = {
  // flags: null // null;
  count: number // int -> number;
  reactions: TypeStoryReaction[] // Api.TypeStoryReaction[] -> TypeStoryReaction[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
  nextOffset?: string // string;
};

export type StoryViews = {
  views: TypeStoryViews[] // Api.TypeStoryViews[] -> TypeStoryViews[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
};

export type StoryViewsList = {
  // flags: null // null;
  count: number // int -> number;
  viewsCount: number // int -> number;
  forwardsCount: number // int -> number;
  reactionsCount: number // int -> number;
  views: TypeStoryView[] // Api.TypeStoryView[] -> TypeStoryView[];
  chats: TypeChat[] // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[] // Api.TypeUser[] -> TypeUser[];
  nextOffset?: string // string;
};

export type TypeAllStories = stories.AllStoriesNotModified | stories.AllStories; // stories.AllStoriesNotModified | stories.AllStories

export type TypeFoundStories = stories.FoundStories; // stories.FoundStories

export type TypePeerStories = stories.PeerStories; // stories.PeerStories

export type TypeStories = stories.Stories; // stories.Stories

export type TypeStoryReactionsList = stories.StoryReactionsList; // stories.StoryReactionsList

export type TypeStoryViews = stories.StoryViews; // stories.StoryViews

export type TypeStoryViewsList = stories.StoryViewsList; // stories.StoryViewsList

