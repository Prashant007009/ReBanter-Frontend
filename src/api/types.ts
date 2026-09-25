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

export type DropKind = "post" | "take" | "poll";

export interface Drop {
  id: string;
  author: UserSummary;
  kind?: DropKind;
  /** Hot take statement or poll question. */
  body?: string | null;
  caption: string | null;
  location: string | null;
  createdAt: string;
  media: Media[];
  counts: { reactions: number; replies: number };
}

/** A Stream card: the drop plus the viewer's state and everything the card renders. */
export interface StreamDrop extends Drop {
  kind: DropKind;
  author: UserSummary & { isVerified: boolean };
  relationship: Relationship;
  counts: { reactions: number; likes: number; saves: number; shares: number; replies: number };
  likedByMe: boolean;
  savedByMe: boolean;
  poll: {
    options: { id: string; label: string; votes: number }[];
    totalVotes: number;
    myVote: string | null;
    endsAt?: string | null;
    closed?: boolean;
  } | null;
  take: { facts: number; cap: number; myStance: "facts" | "cap" | null } | null;
  topReply: { author: Omit<UserSummary, "id">; body: string; likeCount: number } | null;
  // Composer options (Rebanter Drop).
  aspect?: "1:1" | "4:5" | "16:9" | null;
  takeColor?: string | null;
  soundLabel?: string | null;
  altText?: string | null;
  /** Set while scheduled; only the author sees it before then. */
  publishAt?: string | null;
  audience?: "everyone" | "crew" | "close";
  commentsOff?: boolean;
  /** The author hid cheer counts (true for everyone but the author). */
  countsHidden?: boolean;
  allowRemix?: boolean;
}

export type StreamTab = "forYou" | "following" | "takes";

export interface MomentFrame {
  id: string;
  mediaUrl: string | null;
  caption: string | null;
  captionBg: string | null;
  captionInk: string | null;
  createdAt: string;
  seen: boolean;
  likedByMe: boolean;
}

export interface MomentGroup {
  author: UserSummary;
  frames: MomentFrame[];
  allSeen: boolean;
  live: boolean;
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
  vibe: string | null;
  /** Where they last dropped from (that you can see). */
  place: string | null;
  /** Online / last seen: only shared between crew. */
  presence: { online: boolean; lastSeenAt: string | null } | null;
  mutuals: { count: number; people: UserSummary[] };
  pins: { id: string; emoji: string; label: string; color: string }[];
  /** Your switches for this person: 🔔 drop alerts, mute, restrict, block. */
  viewer: { alerts: boolean; muted: boolean; restricted: boolean; blocked: boolean };
}

export interface Room {
  id: string;
  title: string;
  status: "LIVE" | "SCHEDULED" | "ENDED";
  participantCount: number;
  host: UserSummary;
  /** Category shown on Roam cards ("Design", "Music", …). */
  tag: string | null;
  /** A few recent joiners, for the face stack. */
  faces: UserSummary[];
  joinedByMe: boolean;
}

export interface TagStat {
  tag: string;
  posts: number;
  takes: number;
}

export interface PersonResult extends UserSummary {
  isVerified: boolean;
  relationship: Relationship;
  /** One line of social context: "Followed by maya + 3 more", "In your crew", a bio snippet… */
  context: string | null;
}

export interface ExploreTile {
  type: "photo" | "carousel" | "take" | "loop";
  id: string;
  dropId: string | null;
  roomId: string | null;
  imageUrl: string | null;
  text: string | null;
  caption: string | null;
  author: string;
  likes: number;
  durationSec: number | null;
}

export interface Notification {
  id: string;
  recipientId: string;
  actorId: string | null;
  actor: UserSummary | null;
  type: "CHEER" | "REPLY" | "CREW_JOINED" | "CREW_REQUEST" | "MENTION" | "DROP_ALERT";
  dropId: string | null;
  read: boolean;
  createdAt: string;
  /** The drop it's about: thumbnail for posts, text for takes. */
  drop?: { id: string; kind: DropKind; body: string | null; caption: string | null; thumbUrl: string | null } | null;
  /** The comment behind a REPLY / MENTION. */
  reply?: { id: string; body: string; parentId: string | null } | null;
  /** CREW_REQUEST only: whether it's still waiting on you, and how many crew you share. */
  crew?: { status: "pending" | "accepted" | "skipped"; mutuals: number } | null;
}

export interface PulseWeek {
  days: { date: string; count: number }[];
  cheers: number;
  replies: number;
  crew: number;
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
  kind: "text" | "image" | "sticker" | "drop";
  /** Decrypted on device — the server only ever holds ciphertext. */
  body: string | null;
  imageUrl: string | null;
  /** For kind "drop": the shared drop (carried inside the encrypted payload). */
  dropId?: string | null;
  /** True when this device doesn't have (or can't verify) the key for this message. */
  undecryptable?: boolean;
  sharedDropId: string | null;
  createdAt: string;
  seenAt: string | null;
  reactions: MessageReaction[];
}

/** A message as it travels over the wire: content is end-to-end encrypted. */
export type EncryptedMessage = Omit<Message, "body" | "imageUrl" | "dropId" | "undecryptable"> & { ciphertext: string; keyId: string };

export interface MessagePage {
  items: Message[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}
