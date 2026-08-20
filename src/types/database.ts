export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type ProfilesTable = {
  Row: {
    id: string
    pseudo: string
    level: number
    xp: number
    rank: string
    discipline: string
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
    created_at: string
  }
  Insert: {
    id?: string
    user_id: string
    salle_nom: string
    salle_lat?: number | null
    salle_lng?: number | null
    created_at?: string
  }
  Update: {
    salle_nom?: string
    salle_lat?: number | null
    salle_lng?: number | null
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

export interface Database {
  public: {
    Tables: {
      profiles: ProfilesTable
      checkins: CheckinsTable
      aliments: AlimentsTable
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ProfileRow = ProfilesTable['Row']
export type CheckinRow = CheckinsTable['Row']
export type AlimentRow = AlimentsTable['Row']
