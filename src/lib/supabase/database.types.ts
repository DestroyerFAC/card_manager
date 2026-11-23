// Mirrors supabase/migrations. Regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CollectionItemRow = {
  id: string;
  user_id: string;
  tcg: string;
  card_id: string;
  quantity: number;
  condition: string;
  variant: string;
  card_name: string;
  set_id: string;
  set_name: string;
  local_id: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string };
        Insert: never;
        Update: { display_name?: string | null };
        Relationships: [];
      };
      collection_items: {
        Row: CollectionItemRow;
        Insert: Omit<CollectionItemRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
          id?: string;
          user_id?: string;
        };
        Update: Partial<Pick<CollectionItemRow, 'quantity'>>;
        Relationships: [];
      };
      card_prices: {
        Row: {
          tcg: string;
          card_id: string;
          currency: string;
          low: number | null;
          mid: number | null;
          market: number | null;
          holo_low: number | null;
          holo_mid: number | null;
          holo_market: number | null;
          source: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      add_collection_item: {
        Args: {
          p_card_id: string;
          p_condition: string;
          p_variant: string;
          p_quantity: number;
          p_card_name: string;
          p_set_id: string;
          p_set_name: string;
          p_local_id: string;
          p_image_url: string | null;
          p_tcg?: string;
        };
        Returns: CollectionItemRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
