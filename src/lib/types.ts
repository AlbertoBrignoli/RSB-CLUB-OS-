// Tipi del dominio — rispecchiano le migrations in supabase/migrations.

export type PlayerPosition = "GK" | "DF" | "MF" | "FW";
export type PlayerStatus = "available" | "injured" | "suspended" | "unavailable";
export type MatchStatus = "upcoming" | "live" | "finished" | "postponed" | "cancelled";
export type MatchEventType =
  | "goal" | "own_goal" | "assist" | "yellow_card" | "red_card"
  | "sub_in" | "sub_out" | "penalty_scored" | "penalty_missed";
export type MediaKind = "photo" | "video" | "graphic" | "document";
export type ContentStatus =
  | "idea" | "planned" | "copy" | "graphic_requested" | "in_production"
  | "review" | "approved" | "scheduled" | "published" | "cancelled";
export type GraphicStatus = "requested" | "todo" | "in_progress" | "review" | "approved" | "published";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type EntityKind = "content" | "graphic" | "task" | "match" | "player" | "media";
export type NotificationType =
  | "mention" | "task_assigned" | "graphic_assigned" | "graphic_ready" | "content_review"
  | "content_approved" | "deadline" | "upcoming_match" | "media_uploaded" | "status_change";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Club {
  id: string;
  organization_id: string;
  name: string;
  short_name: string | null;
  slug: string;
  logo_url: string | null;
  colors: { primary?: string; accent?: string };
  settings: Record<string, unknown>;
}

export interface Season {
  id: string;
  club_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface Competition {
  id: string;
  club_id: string;
  name: string;
}

export interface Role {
  id: string;
  club_id: string | null;
  slug: string;
  name: string;
  description: string | null;
}

export interface Membership {
  id: string;
  user_id: string;
  club_id: string;
  role_id: string;
  role?: Role;
  profile?: Profile;
}

export interface Player {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  position: PlayerPosition;
  role_detail: string | null;
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  foot: "left" | "right" | "both" | null;
  height_cm: number | null;
  weight_kg: number | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  socials: Record<string, string>;
  photo_url: string | null;
  status: PlayerStatus;
  status_note: string | null;
  custom_fields: Record<string, string>;
  notes: string | null;
  is_active: boolean;
}

export interface Match {
  id: string;
  club_id: string;
  season_id: string | null;
  competition_id: string | null;
  opponent: string;
  opponent_logo_url: string | null;
  is_home: boolean;
  kickoff_at: string;
  venue: string | null;
  matchday: string | null;
  status: MatchStatus;
  our_score: number | null;
  opponent_score: number | null;
  notes: string | null;
  competition?: Competition | null;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  club_id: string;
  type: MatchEventType;
  player_id: string | null;
  minute: number | null;
  note: string | null;
  player?: Player | null;
}

export interface MatchLineupEntry {
  match_id: string;
  player_id: string;
  club_id: string;
  is_starting: boolean;
  player?: Player | null;
}

export interface ContentType {
  id: string;
  club_id: string;
  slug: string;
  name: string;
  sort: number;
  is_active: boolean;
}

export interface SocialChannel {
  id: string;
  club_id: string;
  slug: string;
  name: string;
  sort: number;
  is_active: boolean;
}

export interface MediaItem {
  id: string;
  club_id: string;
  title: string;
  kind: MediaKind;
  category: string | null;
  tags: string[];
  storage_path: string | null;
  url: string | null;
  thumb_url: string | null;
  match_id: string | null;
  content_id: string | null;
  author_id: string | null;
  taken_at: string | null;
  notes: string | null;
  created_at: string;
  author?: Profile | null;
  match?: Match | null;
  media_players?: { player_id: string; player?: Player }[];
}

export interface ContentItem {
  id: string;
  club_id: string;
  title: string;
  content_type_id: string | null;
  channel_id: string | null;
  status: ContentStatus;
  publish_date: string | null;
  publish_time: string | null;
  caption: string | null;
  hashtags: string | null;
  notes: string | null;
  match_id: string | null;
  owner_id: string | null;
  reviewer_id: string | null;
  priority: PriorityLevel;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  content_type?: ContentType | null;
  channel?: SocialChannel | null;
  match?: Match | null;
  owner?: Profile | null;
  reviewer?: Profile | null;
  content_players?: { player_id: string; player?: Player }[];
}

export interface Graphic {
  id: string;
  club_id: string;
  title: string;
  content_id: string | null;
  match_id: string | null;
  player_id: string | null;
  designer_id: string | null;
  requested_by: string | null;
  deadline: string | null;
  priority: PriorityLevel;
  status: GraphicStatus;
  brief: string | null;
  reference_url: string | null;
  created_at: string;
  updated_at: string;
  designer?: Profile | null;
  requester?: Profile | null;
  content?: ContentItem | null;
  match?: Match | null;
  player?: Player | null;
  versions?: GraphicVersion[];
}

export interface GraphicVersion {
  id: string;
  graphic_id: string;
  label: string;
  media_id: string | null;
  file_url: string | null;
  note: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: Profile | null;
}

export interface Task {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  deadline: string | null;
  priority: PriorityLevel;
  status: TaskStatus;
  player_id: string | null;
  match_id: string | null;
  content_id: string | null;
  graphic_id: string | null;
  created_by: string | null;
  created_at: string;
  owner?: Profile | null;
  match?: Match | null;
  player?: Player | null;
  task_assignees?: { user_id: string; profile?: Profile }[];
}

export interface Comment {
  id: string;
  club_id: string;
  entity_type: EntityKind;
  entity_id: string;
  author_id: string | null;
  body: string;
  mentions: string[];
  created_at: string;
  author?: Profile | null;
}

export interface Notification {
  id: string;
  club_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: EntityKind | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  club_id: string;
  actor_id: string | null;
  action: string;
  entity_type: EntityKind | null;
  entity_id: string | null;
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: Profile | null;
}

export interface ContentTemplate {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  is_match_pack: boolean;
  defaults: Record<string, unknown>;
  sort: number;
}
