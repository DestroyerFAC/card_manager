import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

// Null when env is invalid: the app renders a configuration error instead of crashing at import.
export const supabase: AppSupabaseClient | null = env
  ? createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
