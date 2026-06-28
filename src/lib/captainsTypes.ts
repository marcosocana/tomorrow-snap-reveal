export type CaptainsScoringMode = "automatic" | "manual";
export type CaptainsEventStatus = "draft" | "scheduled" | "active" | "finished" | "archived";
export type CaptainsEvidenceType = "photo" | "video" | "audio";
export type CaptainsDifficulty = "easy" | "medium" | "hard" | "special";
export type CaptainsTableChallengeStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "submitted"
  | "completed"
  | "failed"
  | "time_expired"
  | "pending_review"
  | "rejected"
  | "deleted";
export type CaptainsEvidenceStatus = "uploaded" | "pending_review" | "approved" | "rejected" | "deleted";

export interface CaptainsEvent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  scoring_mode: CaptainsScoringMode;
  status: CaptainsEventStatus;
  show_live_gallery_after_completion: boolean;
  qr_url: string | null;
  public_url: string;
  created_at: string;
  updated_at: string;
}

export interface CaptainsTable {
  id: string;
  event_id: string;
  table_number: number;
  table_name: string;
  captain_name: string | null;
  active_captain_name: string | null;
  session_token: string;
  total_points: number;
  completed_challenges: number;
  failed_challenges: number;
  current_challenge_id: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaptainsChallengeCatalogItem {
  id: string;
  title: string;
  description: string;
  evidence_type: CaptainsEvidenceType;
  category: string;
  difficulty: CaptainsDifficulty;
  default_points: number;
  has_time_limit: boolean;
  time_limit_seconds: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaptainsEventChallenge {
  id: string;
  event_id: string;
  catalog_challenge_id: string | null;
  title: string;
  description: string;
  evidence_type: CaptainsEvidenceType;
  points: number;
  category: string;
  difficulty: CaptainsDifficulty;
  has_time_limit: boolean;
  time_limit_seconds: number | null;
  order_index: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaptainsTableChallenge {
  id: string;
  event_id: string;
  table_id: string;
  challenge_id: string;
  randomized_order_index: number;
  status: CaptainsTableChallengeStatus;
  points_awarded: number;
  started_at: string | null;
  submitted_at: string | null;
  elapsed_seconds: number | null;
  remaining_seconds: number | null;
  is_time_expired: boolean;
  automatic_score_calculated: boolean;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaptainsEvidence {
  id: string;
  event_id: string;
  table_id: string;
  table_challenge_id: string;
  captain_name: string | null;
  evidence_type: CaptainsEvidenceType;
  file_url: string;
  thumbnail_url: string | null;
  status: CaptainsEvidenceStatus;
  points_awarded: number;
  admin_comment: string | null;
  elapsed_seconds: number | null;
  remaining_seconds: number | null;
  created_at: string;
  reviewed_at: string | null;
  deleted_at: string | null;
}

export interface CaptainsEventDetail {
  event: CaptainsEvent;
  tables: CaptainsTable[];
  challenges: CaptainsEventChallenge[];
}

export interface CaptainsRankingItem extends CaptainsTable {
  rank: number;
}

export interface CaptainsEventListItem extends CaptainsEvent {
  table_count: number;
  challenge_count: number;
}

export interface CreateCaptainsEventInput {
  name: string;
  slug?: string;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  scoring_mode?: CaptainsScoringMode;
  status?: CaptainsEventStatus;
  show_live_gallery_after_completion?: boolean;
}

export interface CaptainsChallengeInput {
  id?: string;
  catalog_challenge_id?: string | null;
  title: string;
  description: string;
  evidence_type: CaptainsEvidenceType;
  points: number;
  category: string;
  difficulty: CaptainsDifficulty;
  has_time_limit?: boolean;
  time_limit_seconds?: number | null;
  order_index?: number;
  is_required?: boolean;
}
