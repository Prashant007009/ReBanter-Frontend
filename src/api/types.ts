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

export interface MessageReaction {
  id: string;
  userId: string;
  emoji: string;
}

export interface Message {
  id: string;
  banterId: string;
  senderId: string;
  sender?: UserSummary;
  kind: "text" | "image" | "sticker";
  /** Decrypted on device — the server only ever holds ciphertext. */
  body: string | null;
  imageUrl: string | null;
  /** True when this device doesn't have (or can't verify) the key for this message. */
  undecryptable?: boolean;
  sharedDropId: string | null;
  createdAt: string;
  seenAt: string | null;
  reactions: MessageReaction[];
}

/** A message as it travels over the wire: content is end-to-end encrypted. */
export type EncryptedMessage = Omit<Message, "body" | "imageUrl" | "undecryptable"> & { ciphertext: string; keyId: string };

export interface MessagePage {
  items: Message[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}
