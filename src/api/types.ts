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

export interface CrewSummary {
  id: string;
  name: string;
  ownerId: string;
  members: UserSummary[];
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
  crewId: string | null;
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
