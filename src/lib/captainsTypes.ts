export type CaptainsScoringMode = "automatic" | "manual";
export type CaptainsEventStatus = "draft" | "scheduled" | "active" | "finished" | "archived";
export type CaptainsEvidenceType = "photo" | "video" | "question";
export type CaptainsDifficulty = "easy" | "medium" | "hard" | "special";
export type CaptainsThemeStyle = "pixel" | "romantic" | "modern" | "classic";
export type CaptainsExperienceVersion = "legacy" | "v2";
export type CaptainsHostTone = "divertido" | "elegante" | "gamberro" | "epico" | "romantico";
export type CaptainsHostFrequency = "low" | "normal" | "high";
export type CaptainsHostTrigger =
  | "GAME_STARTED" | "FIRST_CHALLENGE_COMPLETED" | "POINTS_25" | "POINTS_50" | "POINTS_100"
  | "HALFWAY_TIME" | "ENTERED_PODIUM" | "LEFT_PODIUM" | "BECAME_LEADER" | "LOST_LEAD"
  | "TEAM_OVERTAKEN" | "TIME_REMAINING_30" | "TIME_REMAINING_10" | "FINAL_CHALLENGES" | "GAME_FINISHED";
export type CaptainsHostSpeaker = "character_1" | "character_2" | "both";
export type CaptainsHostInterventionStatus = "pending" | "shown" | "dismissed";

export interface CaptainsWeddingContext {
  partner_1_name: string;
  partner_1_nickname: string;
  partner_2_name: string;
  partner_2_nickname: string;
  years_together: number | null;
  relationship_start_date: string;
  venue_name: string;
  venue_city: string;
  venue_region: string;
  venue_country: string;
  venue_address: string;
  how_they_met: string;
  met_location: string;
  city_where_they_live: string;
  shared_hobby: string;
  special_song: string;
  inside_phrase: string;
  most_competitive_partner: string;
  fun_fact: string;
}

export interface CaptainsHostCharacterConfig {
  linked_partner: "partner_1" | "partner_2" | "none";
  display_name: string;
  skin_tone: "light" | "medium" | "tan" | "deep";
  hair_style: "short" | "wave" | "long" | "curly" | "bald";
  hair_color: "blonde" | "brown" | "dark" | "red" | "gray";
  facial_hair: "none" | "stubble" | "beard";
  glasses: "none" | "round" | "square";
  head_accessory: "none" | "hat" | "crown";
  outfit: "classic_suit" | "informal_suit" | "classic_dress" | "modern_dress" | "party" | "casual" | "custom";
  primary_color: string;
  secondary_color: string;
  accessory: "none" | "bowtie" | "tie" | "bouquet" | "glass";
}

export interface CaptainsHostConfig {
  enabled: boolean;
  tone: CaptainsHostTone;
  frequency: CaptainsHostFrequency;
  wedding: CaptainsWeddingContext;
  character_1: CaptainsHostCharacterConfig;
  character_2: CaptainsHostCharacterConfig;
}

export interface CaptainsHostInterventionRecord {
  id: string;
  event_id: string;
  table_id: string;
  intervention_type: string;
  trigger: CaptainsHostTrigger;
  variant: number;
  status: CaptainsHostInterventionStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
  shown_at: string | null;
  dismissed_at: string | null;
}
export type CaptainsSpriteStyle = "suit" | "dress" | "jacket" | "skirt" | "festival" | "tunic" | "uniform" | "kimono";
export type CaptainsSpriteSex = "female" | "male" | "unspecified";
export type CaptainsSpriteHairLength = "short" | "long";
export type CaptainsSpriteHairColor = "blonde" | "dark" | "brown";
export type CaptainsSpriteSkinColor = "very_fair" | "fair" | "tan" | "dark";
export type CaptainsSpriteOutfitType = "dress" | "long_dress" | "suit" | "tuxedo" | "shirt" | "casual" | "jumpsuit" | "skirt";

export interface CaptainsSpriteConfig {
  sex: CaptainsSpriteSex;
  hair_length: CaptainsSpriteHairLength;
  hair_color: CaptainsSpriteHairColor;
  skin_color: CaptainsSpriteSkinColor;
  outfit_type: CaptainsSpriteOutfitType;
  dress_color: string;
  suit_color: string;
  tie_color: string;
  outfit_color?: string;
  bottom_color?: string;
}
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
  owner_id?: string | null;
  name: string;
  slug: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  scoring_mode: CaptainsScoringMode;
  status: CaptainsEventStatus;
  show_live_gallery_after_completion: boolean;
  theme_style: CaptainsThemeStyle | null;
  experience_version: CaptainsExperienceVersion;
  wedding_context?: CaptainsWeddingContext | null;
  character_1_config?: CaptainsHostCharacterConfig | null;
  character_2_config?: CaptainsHostCharacterConfig | null;
  host_characters_enabled?: boolean;
  host_tone?: CaptainsHostTone | null;
  host_frequency?: CaptainsHostFrequency | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_image_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
  captain_photo_url: string | null;
  captain_sprite: CaptainsSpriteStyle | null;
  captain_sprite_config: CaptainsSpriteConfig | null;
  session_token: string;
  total_points: number;
  completed_challenges: number;
  failed_challenges: number;
  current_challenge_id: string | null;
  last_activity_at: string | null;
  claimed_at?: string | null;
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
  question_options: string[] | null;
  question_correct_option: string | null;
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
  question_options: string[] | null;
  question_correct_option: string | null;
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
  question_answer?: string | null;
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

export type CaptainsEvidenceIndexItem = Pick<
  CaptainsEvidence,
  "id" | "table_id" | "table_challenge_id" | "evidence_type" | "file_url" | "status" | "created_at"
>;

export interface CaptainsEventDetail {
  event: CaptainsEvent;
  tables: CaptainsTable[];
  challenges: CaptainsEventChallenge[];
}

export interface CaptainsRankingItem extends CaptainsTable {
  rank: number;
  all_challenges_finished: boolean;
  completion_duration_seconds: number | null;
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
  theme_style?: CaptainsThemeStyle | null;
  experience_version?: CaptainsExperienceVersion;
  primary_color?: string | null;
  secondary_color?: string | null;
  background_image_url?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  wedding_context?: CaptainsWeddingContext | null;
  character_1_config?: CaptainsHostCharacterConfig | null;
  character_2_config?: CaptainsHostCharacterConfig | null;
  host_characters_enabled?: boolean;
  host_tone?: CaptainsHostTone;
  host_frequency?: CaptainsHostFrequency;
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
  question_options?: string[] | null;
  question_correct_option?: string | null;
  order_index?: number;
  is_required?: boolean;
}
