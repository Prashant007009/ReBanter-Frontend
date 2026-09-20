export interface UserSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Media {
  id: string;
  url: string;
  kind: "image" | "video";
  position: number;
}

export interface Drop {
  id: string;
  author: UserSummary;
  caption: string | null;
  location: string | null;
  createdAt: string;
  media: Media[];
  counts: { reactions: number; replies: number };
}

export interface Reply {
  id: string;
  dropId: string;
  authorId: string;
  parentId: string | null;
  author: UserSummary;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies?: Reply[];
}

export type Relationship = "self" | "none" | "requested" | "incoming" | "crew";

export interface PublicUserProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  link: string | null;
  isPrivate: boolean;
  stats: { drops: number; crew: number };
  relationship: Relationship;
  canViewDrops: boolean;
}

export interface Room {
  id: string;
  title: string;
  status: "LIVE" | "SCHEDULED" | "ENDED";
  participantCount: number;
  host: UserSummary;
}

export interface Notification {
  id: string;
  recipientId: string;
  actorId: string | null;
  actor: UserSummary | null;
  type: "CHEER" | "REPLY" | "CREW_JOINED" | "CREW_REQUEST" | "MENTION";
  dropId: string | null;
  read: boolean;
  createdAt: string;
}

export interface BanterListItem {
  id: string;
  isGroup: boolean;
  title: string | null;
  participants: UserSummary[];
  lastMessage: Message | null;
}

export interface Message {
  id: string;
  banterId: string;
  senderId: string;
  sender?: UserSummary;
  body: string | null;
  sharedDropId: string | null;
  createdAt: string;
  seenAt: string | null;
}
