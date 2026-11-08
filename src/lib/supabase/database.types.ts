// Generado desde Supabase (MCP generate_typescript_types). No editar a mano.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          club_id: string
          from_status: Database["public"]["Enums"]["availability_status"] | null
          id: number
          player_id: string
          to_status: Database["public"]["Enums"]["availability_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          club_id: string
          from_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          id?: never
          player_id: string
          to_status: Database["public"]["Enums"]["availability_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          club_id?: string
          from_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          id?: never
          player_id?: string
          to_status?: Database["public"]["Enums"]["availability_status"]
        }
        Relationships: [
          {
            foreignKeyName: "availability_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          requested_role: Database["public"]["Enums"]["user_role"] | null
          roles: Database["public"]["Enums"]["user_role"][]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          requested_role?: Database["public"]["Enums"]["user_role"] | null
          roles?: Database["public"]["Enums"]["user_role"][]
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          requested_role?: Database["public"]["Enums"]["user_role"] | null
          roles?: Database["public"]["Enums"]["user_role"][]
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          category: string | null
          cover_path: string | null
          cover_position_x: number
          cover_position_y: number
          created_at: string
          dashboard_metrics: string[] | null
          dashboard_metrics_mobile: string[] | null
          has_sevens: boolean
          id: string
          kine_delegate_id: string | null
          logo_path: string | null
          name: string
          nomina_delegate_id: string | null
          nomina_mode: Database["public"]["Enums"]["nomina_mode"]
          slug: string
          sport: string
        }
        Insert: {
          category?: string | null
          cover_path?: string | null
          cover_position_x?: number
          cover_position_y?: number
          created_at?: string
          dashboard_metrics?: string[] | null
          dashboard_metrics_mobile?: string[] | null
          has_sevens?: boolean
          id?: string
          kine_delegate_id?: string | null
          logo_path?: string | null
          name: string
          nomina_delegate_id?: string | null
          nomina_mode?: Database["public"]["Enums"]["nomina_mode"]
          slug: string
          sport: string
        }
        Update: {
          category?: string | null
          cover_path?: string | null
          cover_position_x?: number
          cover_position_y?: number
          created_at?: string
          dashboard_metrics?: string[] | null
          dashboard_metrics_mobile?: string[] | null
          has_sevens?: boolean
          id?: string
          kine_delegate_id?: string | null
          logo_path?: string | null
          name?: string
          nomina_delegate_id?: string | null
          nomina_mode?: Database["public"]["Enums"]["nomina_mode"]
          slug?: string
          sport?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_kine_delegate_fkey"
            columns: ["kine_delegate_id", "id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["user_id", "club_id"]
          },
          {
            foreignKeyName: "clubs_nomina_delegate_fkey"
            columns: ["nomina_delegate_id", "id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["user_id", "club_id"]
          },
          {
            foreignKeyName: "clubs_sport_fkey"
            columns: ["sport"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      documents: {
        Row: {
          club_id: string
          created_at: string
          file_name: string
          id: string
          injury_id: string | null
          player_id: string
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          file_name: string
          id?: string
          injury_id?: string | null
          player_id: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          file_name?: string
          id?: string
          injury_id?: string | null
          player_id?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_injury_id_club_id_fkey"
            columns: ["injury_id", "club_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "documents_player_id_club_id_fkey"
            columns: ["player_id", "club_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          club_id: string
          event_id: string
          player_id: string
          present: boolean
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          club_id: string
          event_id: string
          player_id: string
          present: boolean
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          club_id?: string
          event_id?: string
          player_id?: string
          present?: boolean
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_club_id_fkey"
            columns: ["event_id", "club_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "event_attendance_player_id_club_id_fkey"
            columns: ["player_id", "club_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "event_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_callups: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          player_id: string
          removed_at: string | null
          removed_by: string | null
          slot: number | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          player_id: string
          removed_at?: string | null
          removed_by?: string | null
          slot?: number | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          player_id?: string
          removed_at?: string | null
          removed_by?: string | null
          slot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_callups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_callups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_callups_event_id_club_id_fkey"
            columns: ["event_id", "club_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "event_callups_player_id_club_id_fkey"
            columns: ["player_id", "club_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "event_callups_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participations: {
        Row: {
          callup_id: string
          club_id: string
          event_id: string
          minutes: number | null
          mode: Database["public"]["Enums"]["nomina_mode"]
          played: boolean
          player_id: string
          range_bucket: number | null
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          callup_id: string
          club_id: string
          event_id: string
          minutes?: number | null
          mode: Database["public"]["Enums"]["nomina_mode"]
          played: boolean
          player_id: string
          range_bucket?: number | null
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          callup_id?: string
          club_id?: string
          event_id?: string
          minutes?: number | null
          mode?: Database["public"]["Enums"]["nomina_mode"]
          played?: boolean
          player_id?: string
          range_bucket?: number | null
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participations_callup_id_event_id_player_id_club_id_fkey"
            columns: ["callup_id", "event_id", "player_id", "club_id"]
            isOneToOne: false
            referencedRelation: "event_callups"
            referencedColumns: ["id", "event_id", "player_id", "club_id"]
          },
          {
            foreignKeyName: "event_participations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          club_id: string
          created_at: string
          created_by: string
          ends_at: string
          format: string
          id: string
          location: string | null
          notes: string | null
          opponent: string | null
          series_id: string | null
          starts_at: string
          type: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          club_id: string
          created_at?: string
          created_by: string
          ends_at: string
          format?: string
          id?: string
          location?: string | null
          notes?: string | null
          opponent?: string | null
          series_id?: string | null
          starts_at: string
          type: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          format?: string
          id?: string
          location?: string | null
          notes?: string | null
          opponent?: string | null
          series_id?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          body_zone: Database["public"]["Enums"]["body_zone"] | null
          closed_on: string | null
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          doctor_estimate_unit: string | null
          doctor_estimate_value: number | null
          expected_return_on: string | null
          id: string
          laterality: Database["public"]["Enums"]["injury_laterality"] | null
          occurred_during: string | null
          player_id: string
          reported_by_player: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          severity: Database["public"]["Enums"]["injury_severity"] | null
          started_on: string
          status: Database["public"]["Enums"]["injury_status"]
          type: string
        }
        Insert: {
          body_zone?: Database["public"]["Enums"]["body_zone"] | null
          closed_on?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          doctor_estimate_unit?: string | null
          doctor_estimate_value?: number | null
          expected_return_on?: string | null
          id?: string
          laterality?: Database["public"]["Enums"]["injury_laterality"] | null
          occurred_during?: string | null
          player_id: string
          reported_by_player?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["injury_severity"] | null
          started_on?: string
          status?: Database["public"]["Enums"]["injury_status"]
          type: string
        }
        Update: {
          body_zone?: Database["public"]["Enums"]["body_zone"] | null
          closed_on?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          doctor_estimate_unit?: string | null
          doctor_estimate_value?: number | null
          expected_return_on?: string | null
          id?: string
          laterality?: Database["public"]["Enums"]["injury_laterality"] | null
          occurred_during?: string | null
          player_id?: string
          reported_by_player?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["injury_severity"] | null
          started_on?: string
          status?: Database["public"]["Enums"]["injury_status"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_player_id_club_id_fkey"
            columns: ["player_id", "club_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "injuries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injury_phases: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          ended_on: string | null
          id: string
          injury_id: string
          name: string
          position: number
          started_on: string | null
          status: Database["public"]["Enums"]["phase_status"]
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          ended_on?: string | null
          id?: string
          injury_id: string
          name: string
          position: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          ended_on?: string | null
          id?: string
          injury_id?: string
          name?: string
          position?: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
        }
        Relationships: [
          {
            foreignKeyName: "injury_phases_injury_id_club_id_fkey"
            columns: ["injury_id", "club_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id", "club_id"]
          },
        ]
      }
      nav_preferences: {
        Row: {
          club_id: string
          slots: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          slots?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          slots?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nav_preferences_user_id_club_id_fkey"
            columns: ["user_id", "club_id"]
            isOneToOne: true
            referencedRelation: "club_members"
            referencedColumns: ["user_id", "club_id"]
          },
        ]
      }
      player_contacts: {
        Row: {
          club_id: string
          phone: string
          player_id: string
          updated_at: string
        }
        Insert: {
          club_id: string
          phone: string
          player_id: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          phone?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_contacts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          availability: Database["public"]["Enums"]["availability_status"]
          club_id: string
          created_at: string
          first_name: string | null
          full_name: string
          height_cm: number | null
          id: string
          last_name: string | null
          position: string | null
          secondary_position: string | null
          status: Database["public"]["Enums"]["member_status"]
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          active?: boolean
          availability?: Database["public"]["Enums"]["availability_status"]
          club_id: string
          created_at?: string
          first_name?: string | null
          full_name: string
          height_cm?: number | null
          id?: string
          last_name?: string | null
          position?: string | null
          secondary_position?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          active?: boolean
          availability?: Database["public"]["Enums"]["availability_status"]
          club_id?: string
          created_at?: string
          first_name?: string | null
          full_name?: string
          height_cm?: number | null
          id?: string
          last_name?: string | null
          position?: string | null
          secondary_position?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          format: string
          id: string
          name: string
          sort: number
          sport: string
        }
        Insert: {
          format?: string
          id?: string
          name: string
          sort: number
          sport: string
        }
        Update: {
          format?: string
          id?: string
          name?: string
          sort?: number
          sport?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_sport_fkey"
            columns: ["sport"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          email_verified_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sevens_group: {
        Row: {
          added_at: string
          archived_at: string | null
          club_id: string
          id: string
          member_id: string
          position: string | null
          secondary_position: string | null
        }
        Insert: {
          added_at?: string
          archived_at?: string | null
          club_id: string
          id?: string
          member_id: string
          position?: string | null
          secondary_position?: string | null
        }
        Update: {
          added_at?: string
          archived_at?: string | null
          club_id?: string
          id?: string
          member_id?: string
          position?: string | null
          secondary_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sevens_group_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sevens_group_member_id_club_id_fkey"
            columns: ["member_id", "club_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["user_id", "club_id"]
          },
        ]
      }
      sport_format_config: {
        Row: {
          bench_size: number
          bucket2_from: number
          bucket3_from: number
          bucket4_from: number
          format: string
          match_minutes: number
          max_minutes: number
          sport: string
          starters: number
        }
        Insert: {
          bench_size: number
          bucket2_from: number
          bucket3_from: number
          bucket4_from: number
          format: string
          match_minutes: number
          max_minutes: number
          sport: string
          starters: number
        }
        Update: {
          bench_size?: number
          bucket2_from?: number
          bucket3_from?: number
          bucket4_from?: number
          format?: string
          match_minutes?: number
          max_minutes?: number
          sport?: string
          starters?: number
        }
        Relationships: [
          {
            foreignKeyName: "sport_format_config_sport_fkey"
            columns: ["sport"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      sports: {
        Row: {
          bench_size: number
          bucket2_from: number
          bucket3_from: number
          bucket4_from: number
          match_minutes: number
          max_minutes: number
          name: string
          slug: string
          starters: number
        }
        Insert: {
          bench_size: number
          bucket2_from: number
          bucket3_from: number
          bucket4_from: number
          match_minutes: number
          max_minutes: number
          name: string
          slug: string
          starters: number
        }
        Update: {
          bench_size?: number
          bucket2_from?: number
          bucket3_from?: number
          bucket4_from?: number
          match_minutes?: number
          max_minutes?: number
          name?: string
          slug?: string
          starters?: number
        }
        Relationships: []
      }
      test_definitions: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          created_by: string
          display_format: string
          higher_is_better: boolean
          id: string
          name: string
          unit: string
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          created_by: string
          display_format?: string
          higher_is_better?: boolean
          id?: string
          name: string
          unit: string
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          display_format?: string
          higher_is_better?: boolean
          id?: string
          name?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_definitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          club_id: string
          id: string
          measured_on: string
          note: string | null
          player_id: string
          recorded_at: string
          recorded_by: string
          test_id: string
          value: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          club_id: string
          id?: string
          measured_on: string
          note?: string | null
          player_id: string
          recorded_at?: string
          recorded_by: string
          test_id: string
          value: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          club_id?: string
          id?: string
          measured_on?: string
          note?: string | null
          player_id?: string
          recorded_at?: string
          recorded_by?: string
          test_id?: string
          value?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_club_id_fkey"
            columns: ["test_id", "club_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id", "club_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_own_injury_document: {
        Args: { p_injury_id: string; p_name: string; p_path: string }
        Returns: string
      }
      advance_injury_phase: {
        Args: { p_injury_id: string }
        Returns: undefined
      }
      allow_auth_email: {
        Args: { p_email: string; p_kind: string }
        Returns: boolean
      }
      archive_test_definition: { Args: { p_test: string }; Returns: undefined }
      attendance_ranking: {
        Args: { p_from: string; p_to: string }
        Returns: {
          attended: number
          full_name: string
          player_id: string
          total: number
        }[]
      }
      cancel_event: { Args: { p_event_id: string }; Returns: undefined }
      club_logo_path: { Args: { p_slug: string }; Returns: string }
      club_public_card: {
        Args: { p_slug: string }
        Returns: {
          category: string
          name: string
          sport: string
        }[]
      }
      club_public_info: {
        Args: { p_slug: string }
        Returns: {
          name: string
          sport: string
        }[]
      }
      complete_injury_report:
        | {
            Args: {
              p_body_zone: Database["public"]["Enums"]["body_zone"]
              p_description: string
              p_duration_unit: string
              p_duration_value: number
              p_files: Json
              p_injury_id: string
              p_laterality: Database["public"]["Enums"]["injury_laterality"]
            }
            Returns: undefined
          }
        | {
            Args: {
              p_description: string
              p_duration_unit: string
              p_duration_value: number
              p_files: Json
              p_injury_id: string
              p_type: string
            }
            Returns: undefined
          }
      create_email_verification: {
        Args: { p_profile_id: string }
        Returns: string
      }
      create_event: {
        Args: {
          p_ends_at: string
          p_format?: string
          p_location?: string
          p_notes?: string
          p_opponent?: string
          p_starts_at: string
          p_type: string
          p_weeks?: number
        }
        Returns: string[]
      }
      create_test_definition: {
        Args: {
          p_club: string
          p_display_format?: string
          p_higher_is_better?: boolean
          p_name: string
          p_unit: string
        }
        Returns: string
      }
      dash_availability_series:
        | {
            Args: { p_weeks?: number }
            Returns: {
              disponible: number
              en_revision: number
              lesionado: number
              reintegro: number
              week_start: string
            }[]
          }
        | {
            Args: { p_format: string; p_weeks: number }
            Returns: {
              disponible: number
              en_revision: number
              lesionado: number
              reintegro: number
              week_start: string
            }[]
          }
      dash_injuries_by_place:
        | {
            Args: never
            Returns: {
              injuries_count: number
              place_key: string
            }[]
          }
        | {
            Args: { p_format: string }
            Returns: {
              injuries_count: number
              place_key: string
            }[]
          }
      dash_injuries_by_position:
        | {
            Args: never
            Returns: {
              injuries_count: number
              players_count: number
              position_name: string
            }[]
          }
        | {
            Args: { p_format: string }
            Returns: {
              injuries_count: number
              players_count: number
              position_name: string
            }[]
          }
      dash_injuries_by_week:
        | {
            Args: { p_weeks?: number }
            Returns: {
              injuries_count: number
              week_start: string
            }[]
          }
        | {
            Args: { p_format: string; p_weeks: number }
            Returns: {
              injuries_count: number
              week_start: string
            }[]
          }
      dash_recurring_players:
        | {
            Args: never
            Returns: {
              full_name: string
              injuries_count: number
              last_injury_on: string
              player_id: string
              position_name: string
            }[]
          }
        | {
            Args: { p_format: string }
            Returns: {
              full_name: string
              injuries_count: number
              last_injury_on: string
              player_id: string
              position_name: string
            }[]
          }
      dash_summary:
        | {
            Args: never
            Returns: {
              disponibles: number
              en_revision: number
              lesionados: number
              reintegro: number
              total: number
            }[]
          }
        | {
            Args: { p_format: string }
            Returns: {
              disponibles: number
              en_revision: number
              lesionados: number
              reintegro: number
              total: number
            }[]
          }
      dash_upcoming_returns:
        | {
            Args: never
            Returns: {
              days_left: number
              full_name: string
              injury_id: string
              player_id: string
              position_name: string
              return_on: string
            }[]
          }
        | {
            Args: { p_format: string }
            Returns: {
              days_left: number
              full_name: string
              injury_id: string
              player_id: string
              position_name: string
              return_on: string
            }[]
          }
      delete_own_draft_document: {
        Args: { p_document_id: string }
        Returns: string
      }
      event_availability: {
        Args: { p_event_id: string }
        Returns: {
          full_name: string
          player_id: string
          player_position: string
          state: string
        }[]
      }
      format_load_scale: {
        Args: { p_format: string; p_sport: string }
        Returns: {
          bucket: number
          label: string
          midpoint: number
          min_from: number
          min_to: number
        }[]
      }
      get_player_phone: { Args: { p_player_id: string }; Returns: string }
      get_test_ranking: {
        Args: { p_test: string }
        Returns: {
          full_name: string
          measured_on: string
          player_id: string
          previous_value: number
          value: number
        }[]
      }
      mark_player_injured: {
        Args: {
          p_availability?: Database["public"]["Enums"]["availability_status"]
          p_note: string
          p_occurred_during: string
          p_occurred_on?: string
          p_player_id: string
        }
        Returns: string
      }
      my_match_load:
        | { Args: never; Returns: Json }
        | { Args: { p_format: string }; Returns: Json }
      record_test_results: {
        Args: { p_measured_on: string; p_results: Json; p_test: string }
        Returns: number
      }
      register_member: {
        Args: {
          p_club_slug: string
          p_first_name: string
          p_height_cm?: number
          p_kind: string
          p_last_name: string
          p_position?: string
          p_requested_role?: Database["public"]["Enums"]["user_role"]
          p_secondary_position?: string
          p_weight_kg?: number
        }
        Returns: undefined
      }
      report_injury:
        | {
            Args: {
              p_body_zone: Database["public"]["Enums"]["body_zone"]
              p_description: string
              p_duration_unit: string
              p_duration_value: number
              p_files: Json
              p_injury_date: string
              p_laterality: Database["public"]["Enums"]["injury_laterality"]
              p_occurred_during: string
            }
            Returns: string
          }
        | {
            Args: {
              p_description: string
              p_duration_unit: string
              p_duration_value: number
              p_files: Json
              p_injury_date: string
              p_occurred_during: string
              p_type: string
            }
            Returns: string
          }
      review_injury: {
        Args: {
          p_availability?: Database["public"]["Enums"]["availability_status"]
          p_decision: string
          p_expected_return_on?: string
          p_injury_id: string
          p_severity?: Database["public"]["Enums"]["injury_severity"]
        }
        Returns: undefined
      }
      review_member: {
        Args: {
          p_club_id?: string
          p_decision: string
          p_profile_id: string
          p_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Returns: undefined
      }
      set_club_category: { Args: { p_category: string }; Returns: undefined }
      set_club_cover: { Args: { p_path: string }; Returns: undefined }
      set_club_cover_position: {
        Args: { p_x: number; p_y: number }
        Returns: undefined
      }
      set_club_logo: { Args: { p_path: string }; Returns: undefined }
      set_club_sevens: { Args: { p_enabled: boolean }; Returns: undefined }
      set_dashboard_metrics: {
        Args: { p_metrics: string[] }
        Returns: undefined
      }
      set_dashboard_metrics_mobile: {
        Args: { p_metrics: string[] }
        Returns: undefined
      }
      set_event_attendance: {
        Args: { p_absent: string[]; p_event_id: string }
        Returns: undefined
      }
      set_event_callups: {
        Args: { p_event_id: string; p_player_ids: string[] }
        Returns: undefined
      }
      set_event_lineup: {
        Args: { p_event_id: string; p_lineup: Json }
        Returns: undefined
      }
      set_event_participation: {
        Args: { p_event_id: string; p_rows: Json }
        Returns: undefined
      }
      set_injury_phases: {
        Args: { p_injury_id: string; p_phases: Json }
        Returns: undefined
      }
      set_kine_delegate: {
        Args: { p_club_id?: string; p_profile_id: string }
        Returns: undefined
      }
      set_my_avatar: {
        Args: { p_club_id?: string; p_path: string }
        Returns: undefined
      }
      set_my_phone: { Args: { p_phone: string }; Returns: undefined }
      set_my_sevens_position: {
        Args: { p_position: string; p_secondary?: string }
        Returns: undefined
      }
      set_nav_slots: { Args: { p_slots: string[] }; Returns: undefined }
      set_nomina_delegate: {
        Args: { p_club_id?: string; p_profile_id: string }
        Returns: undefined
      }
      set_nomina_mode: {
        Args: { p_mode: Database["public"]["Enums"]["nomina_mode"] }
        Returns: undefined
      }
      set_player_availability: {
        Args: {
          p_availability: Database["public"]["Enums"]["availability_status"]
          p_player_id: string
        }
        Returns: undefined
      }
      set_sevens_group: { Args: { p_member_ids: string[] }; Returns: undefined }
      set_staff_roles: {
        Args: {
          p_club_id?: string
          p_profile_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: undefined
      }
      sport_load_scale: {
        Args: { p_sport: string }
        Returns: {
          bucket: number
          label: string
          midpoint: number
          min_from: number
          min_to: number
        }[]
      }
      squad_current_phases: {
        Args: never
        Returns: {
          phase_name: string
          player_id: string
        }[]
      }
      team_match_load:
        | { Args: { p_matches?: number }; Returns: Json }
        | { Args: { p_format: string; p_matches: number }; Returns: Json }
      update_event: {
        Args: {
          p_ends_at: string
          p_event_id: string
          p_location?: string
          p_notes?: string
          p_opponent?: string
          p_starts_at: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_club_id?: string
          p_first_name: string
          p_height_cm?: number
          p_last_name: string
          p_position?: string
          p_secondary_position?: string
          p_weight_kg?: number
        }
        Returns: undefined
      }
      verify_email: { Args: { p_token: string }; Returns: boolean }
      void_test_result: { Args: { p_result: string }; Returns: undefined }
    }
    Enums: {
      availability_status:
        | "disponible"
        | "reintegro"
        | "lesionado"
        | "en_revision"
      body_zone:
        | "cabeza_cuello"
        | "hombro"
        | "biceps"
        | "triceps"
        | "codo"
        | "antebrazo"
        | "mano"
        | "pecho"
        | "espalda_alta"
        | "lumbar"
        | "abdomen"
        | "cadera_ingle"
        | "gluteo"
        | "cuadriceps"
        | "isquiotibial"
        | "rodilla"
        | "tibia"
        | "gemelo"
        | "tobillo_pie"
      document_status: "borrador" | "revisado"
      injury_laterality: "derecha" | "izquierda" | "bilateral" | "no_aplica"
      injury_severity: "leve" | "moderada" | "grave"
      injury_status: "activa" | "cerrada" | "en_evaluacion" | "descartada"
      member_status: "pendiente" | "confirmado" | "rechazado"
      nomina_mode: "exacto" | "rango" | "jugo"
      phase_status: "pendiente" | "en_curso" | "completada"
      user_role:
        | "head_coach"
        | "kinesiologo"
        | "entrenador"
        | "jugador"
        | "manager"
        | "nutricionista"
        | "preparador_fisico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      availability_status: [
        "disponible",
        "reintegro",
        "lesionado",
        "en_revision",
      ],
      body_zone: [
        "cabeza_cuello",
        "hombro",
        "biceps",
        "triceps",
        "codo",
        "antebrazo",
        "mano",
        "pecho",
        "espalda_alta",
        "lumbar",
        "abdomen",
        "cadera_ingle",
        "gluteo",
        "cuadriceps",
        "isquiotibial",
        "rodilla",
        "tibia",
        "gemelo",
        "tobillo_pie",
      ],
      document_status: ["borrador", "revisado"],
      injury_laterality: ["derecha", "izquierda", "bilateral", "no_aplica"],
      injury_severity: ["leve", "moderada", "grave"],
      injury_status: ["activa", "cerrada", "en_evaluacion", "descartada"],
      member_status: ["pendiente", "confirmado", "rechazado"],
      nomina_mode: ["exacto", "rango", "jugo"],
      phase_status: ["pendiente", "en_curso", "completada"],
      user_role: [
        "head_coach",
        "kinesiologo",
        "entrenador",
        "jugador",
        "manager",
        "nutricionista",
        "preparador_fisico",
      ],
    },
  },
} as const
