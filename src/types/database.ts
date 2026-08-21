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

export interface Database {
  public: {
    Tables: {
      profiles: ProfilesTable
      workouts: WorkoutsTable
      nutrition: NutritionTable
      checkins: CheckinsTable
      aliments: AlimentsTable
      user_backups: UserBackupsTable
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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
