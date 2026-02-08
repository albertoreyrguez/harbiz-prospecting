export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "sdr";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "sdr";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "sdr";
          created_at?: string;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          instagram_handle: string;
          full_name: string | null;
          business_type: string | null;
          city: string | null;
          country: string | null;
          source_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instagram_handle: string;
          full_name?: string | null;
          business_type?: string | null;
          city?: string | null;
          country?: string | null;
          source_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instagram_handle?: string;
          full_name?: string | null;
          business_type?: string | null;
          city?: string | null;
          country?: string | null;
          source_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      leads: {
        Row: {
          id: string;
          workspace_id: string;
          profile_id: string;
          owner_id: string;
          status: "new" | "contacted" | "replied" | "qualified" | "disqualified";
          notes: string | null;
          source_query: string | null;
          confidence: number | null;
          discovered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          profile_id: string;
          owner_id: string;
          status?: "new" | "contacted" | "replied" | "qualified" | "disqualified";
          notes?: string | null;
          source_query?: string | null;
          confidence?: number | null;
          discovered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          profile_id?: string;
          owner_id?: string;
          status?: "new" | "contacted" | "replied" | "qualified" | "disqualified";
          notes?: string | null;
          source_query?: string | null;
          confidence?: number | null;
          discovered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      search_runs: {
        Row: {
          id: string;
          workspace_id: string;
          owner_id: string;
          query: string;
          filters: Json | null;
          results_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          owner_id: string;
          query: string;
          filters?: Json | null;
          results_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          owner_id?: string;
          query?: string;
          filters?: Json | null;
          results_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
