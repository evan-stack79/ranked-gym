export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type ProfilesTable = {
  Row: {
    id: string
    pseudo: string
    level: number
    xp: number
    rank: string
    discipline: string
    custom_spots: Json
    active_checkin: Json | null
    current_streak: number
    last_login_date: string | null
    avatar_url: string | null
    is_ghost_mode_enabled?: boolean | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id: string
    pseudo: string
    level?: number
    xp?: number
    rank?: string
    discipline?: string
    custom_spots?: Json
    active_checkin?: Json | null
    current_streak?: number
    last_login_date?: string | null
    avatar_url?: string | null
    is_ghost_mode_enabled?: boolean
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    pseudo?: string
    level?: number
    xp?: number
    rank?: string
    discipline?: string
    custom_spots?: Json
    active_checkin?: Json | null
    current_streak?: number
    last_login_date?: string | null
    avatar_url?: string | null
    is_ghost_mode_enabled?: boolean
    updated_at?: string
  }
  Relationships: []
}

type WorkoutsTable = {
  Row: {
    user_id: string
    state: Json
    progress: Json
    updated_at: string
  }
  Insert: {
    user_id: string
    state?: Json
    progress?: Json
    updated_at?: string
  }
  Update: {
    state?: Json
    progress?: Json
    updated_at?: string
  }
  Relationships: []
}

type NutritionTable = {
  Row: {
    user_id: string
    profile: Json
    journal: Json
    updated_at: string
  }
  Insert: {
    user_id: string
    profile?: Json
    journal?: Json
    updated_at?: string
  }
  Update: {
    profile?: Json
    journal?: Json
    updated_at?: string
  }
  Relationships: []
}

type CheckinsTable = {
  Row: {
    id: string
    user_id: string
    salle_nom: string
    salle_lat: number | null
    salle_lng: number | null
    gym_payload: Json | null
    created_at: string
  }
  Insert: {
    id?: string
    user_id: string
    salle_nom: string
    salle_lat?: number | null
    salle_lng?: number | null
    gym_payload?: Json | null
    created_at?: string
  }
  Update: {
    salle_nom?: string
    salle_lat?: number | null
    salle_lng?: number | null
    gym_payload?: Json | null
  }
  Relationships: []
}

type AlimentsTable = {
  Row: {
    id: string
    user_id: string | null
    nom: string
    calories: number
    proteines: number
    glucides: number
    lipides: number
    barcode: string | null
    created_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    nom: string
    calories?: number
    proteines?: number
    glucides?: number
    lipides?: number
    barcode?: string | null
    created_at?: string
  }
  Update: {
    nom?: string
    calories?: number
    proteines?: number
    glucides?: number
    lipides?: number
    barcode?: string | null
  }
  Relationships: []
}

type UserBackupsTable = {
  Row: {
    user_id: string
    payload: Json
    updated_at: string
  }
  Insert: {
    user_id: string
    payload?: Json
    updated_at?: string
  }
  Update: {
    payload?: Json
    updated_at?: string
  }
  Relationships: []
}

type AiUsageLimitsTable = {
  Row: {
    user_id: string
    date_of_scan: string
    scan_count: number
    updated_at: string
  }
  Insert: {
    user_id: string
    date_of_scan: string
    scan_count?: number
    updated_at?: string
  }
  Update: {
    scan_count?: number
    updated_at?: string
  }
  Relationships: []
}

type ActivitiesTable = {
  Row: {
    id: string
    user_id: string
    activity_type: string
    action_text: string
    xp_earned: number
    origin_lat: number | null
    origin_lng: number | null
    created_at: string
  }
  Insert: {
    id?: string
    user_id: string
    activity_type: string
    action_text: string
    xp_earned?: number
    origin_lat?: number | null
    origin_lng?: number | null
    created_at?: string
  }
  Update: {
    activity_type?: string
    action_text?: string
    xp_earned?: number
    origin_lat?: number | null
    origin_lng?: number | null
  }
  Relationships: []
}

type ProfilesPublicView = {
  Row: {
    id: string
    pseudo: string
    level: number
    xp: number
    rank: string
    discipline: string
    avatar_url: string | null
  }
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: ProfilesTable
      workouts: WorkoutsTable
      nutrition: NutritionTable
      checkins: CheckinsTable
      aliments: AlimentsTable
      user_backups: UserBackupsTable
      ai_usage_limits: AiUsageLimitsTable
      activities: ActivitiesTable
    }
    Views: {
      profiles_public: ProfilesPublicView
    }
    Functions: {
      delete_own_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      reserve_ai_meal_scan: {
        Args: { p_user_id: string }
        Returns: { allowed: boolean; scan_count: number; daily_limit: number }[]
      }
      release_ai_meal_scan: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_social_activity_feed: {
        Args: {
          p_viewer_lat?: number | null
          p_viewer_lng?: number | null
          p_radius_km?: number | null
          p_limit?: number | null
        }
        Returns: {
          id: string
          user_id: string
          pseudo: string
          activity_type: string
          action_text: string
          xp_earned: number
          distance_label: string | null
          created_at: string
          is_self: boolean
          is_ghost_mode_enabled: boolean
        }[]
      }
      record_activity: {
        Args: {
          p_activity_type: string
          p_action_text: string
          p_xp_earned?: number | null
          p_origin_lat?: number | null
          p_origin_lng?: number | null
        }
        Returns: string
      }
      get_user_stats: {
        Args: { p_user_id?: string | null }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ProfileRow = ProfilesTable['Row']
export type WorkoutRow = WorkoutsTable['Row']
export type NutritionRow = NutritionTable['Row']
export type CheckinRow = CheckinsTable['Row']
export type AlimentRow = AlimentsTable['Row']
export type UserBackupRow = UserBackupsTable['Row']
export type AiUsageLimitRow = AiUsageLimitsTable['Row']
export type ActivityRow = ActivitiesTable['Row']
export type ProfilePublicRow = ProfilesPublicView['Row']
