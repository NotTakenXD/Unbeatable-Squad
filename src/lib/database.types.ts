// Generated from the Supabase project schema (roshan-rozgar).
// Regenerate after database changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          area: string | null;
          city: string;
          created_at: string;
          details: string | null;
          id: string;
          label: string;
          user_id: string;
        };
        Insert: {
          area?: string | null;
          city?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          label?: string;
          user_id?: string;
        };
        Update: {
          area?: string | null;
          city?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          label?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          agreed_price: number;
          area: string | null;
          city: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          job_id: string | null;
          offer_id: string | null;
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          agreed_price: number;
          area?: string | null;
          city?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          job_id?: string | null;
          offer_id?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          agreed_price?: number;
          area?: string | null;
          city?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          job_id?: string | null;
          offer_id?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: true;
            referencedRelation: "job_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_offers: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          message: string | null;
          proposed_price: number;
          status: Database["public"]["Enums"]["offer_status"];
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          message?: string | null;
          proposed_price: number;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          worker_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          message?: string | null;
          proposed_price?: number;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_offers_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_offers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          area: string | null;
          budget: number | null;
          city: string;
          created_at: string;
          customer_id: string;
          description: string | null;
          id: string;
          preferred_time: string | null;
          requested_worker_id: string | null;
          service_id: number | null;
          status: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at: string;
          voice_note_path: string | null;
        };
        Insert: {
          area?: string | null;
          budget?: number | null;
          city?: string;
          created_at?: string;
          customer_id?: string;
          description?: string | null;
          id?: string;
          preferred_time?: string | null;
          requested_worker_id?: string | null;
          service_id?: number | null;
          status?: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at?: string;
          voice_note_path?: string | null;
        };
        Update: {
          area?: string | null;
          budget?: number | null;
          city?: string;
          created_at?: string;
          customer_id?: string;
          description?: string | null;
          id?: string;
          preferred_time?: string | null;
          requested_worker_id?: string | null;
          service_id?: number | null;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string;
          updated_at?: string;
          voice_note_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_requested_worker_id_fkey";
            columns: ["requested_worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: number;
          job_id: string | null;
          read_at: string | null;
          recipient_id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: never;
          job_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          sender_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: never;
          job_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          city: string;
          created_at: string;
          full_name: string | null;
          id: string;
          last_role: Database["public"]["Enums"]["app_role"] | null;
          preferred_language: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          city?: string;
          created_at?: string;
          full_name?: string | null;
          id: string;
          last_role?: Database["public"]["Enums"]["app_role"] | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          city?: string;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          last_role?: Database["public"]["Enums"]["app_role"] | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          booking_id: string;
          comment: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          rating: number;
          worker_id: string;
        };
        Insert: {
          booking_id: string;
          comment?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          rating: number;
          worker_id: string;
        };
        Update: {
          booking_id?: string;
          comment?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          rating?: number;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_workers: {
        Row: {
          created_at: string;
          customer_id: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_workers_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_workers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          icon: string;
          id: number;
          name: string;
          name_ur: string | null;
          slug: string;
          sort_order: number;
        };
        Insert: {
          icon: string;
          id?: never;
          name: string;
          name_ur?: string | null;
          slug: string;
          sort_order?: number;
        };
        Update: {
          icon?: string;
          id?: never;
          name?: string;
          name_ur?: string | null;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      worker_portfolio: {
        Row: {
          caption: string | null;
          created_at: string;
          id: string;
          image_path: string;
          worker_id: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          image_path: string;
          worker_id?: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_portfolio_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_profiles: {
        Row: {
          area: string | null;
          bio: string | null;
          created_at: string;
          fixed_rate_from: number | null;
          headline: string | null;
          hourly_rate: number | null;
          id: string;
          is_available: boolean;
          rating_avg: number;
          rating_count: number;
          service_areas: string[];
          service_id: number;
          skills: string[];
          updated_at: string;
          voice_intro_path: string | null;
          years_experience: number | null;
        };
        Insert: {
          area?: string | null;
          bio?: string | null;
          created_at?: string;
          fixed_rate_from?: number | null;
          headline?: string | null;
          hourly_rate?: number | null;
          id: string;
          is_available?: boolean;
          rating_avg?: number;
          rating_count?: number;
          service_areas?: string[];
          service_id: number;
          skills?: string[];
          updated_at?: string;
          voice_intro_path?: string | null;
          years_experience?: number | null;
        };
        Update: {
          area?: string | null;
          bio?: string | null;
          created_at?: string;
          fixed_rate_from?: number | null;
          headline?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_available?: boolean;
          rating_avg?: number;
          rating_count?: number;
          service_areas?: string[];
          service_id?: number;
          skills?: string[];
          updated_at?: string;
          voice_intro_path?: string | null;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "worker_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_offer: { Args: { p_offer_id: string }; Returns: string };
      decline_offer: { Args: { p_offer_id: string }; Returns: undefined };
      update_booking_status: {
        Args: {
          p_booking_id: string;
          p_status: Database["public"]["Enums"]["booking_status"];
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "customer" | "worker";
      booking_status: "confirmed" | "on_the_way" | "working" | "done" | "cancelled";
      job_status: "open" | "assigned" | "completed" | "cancelled";
      offer_status: "pending" | "accepted" | "declined" | "withdrawn";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
