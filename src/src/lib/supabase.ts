import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * `import.meta.env` is not guaranteed to exist in every runtime. Accessing a
 * property on it directly throws when it is undefined, so we read it defensively
 * and fall back to an empty object.
 */
const env: Record<string, string | undefined> =
typeof import.meta !== 'undefined' && (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

/**
 * The client is only created when BOTH env vars are present. When they are
 * missing we export `null` instead of throwing so the app still renders and
 * can fall back to local seed data.
 */
export const supabase: SupabaseClient | null =
supabaseUrl && supabaseAnonKey ?
createClient(supabaseUrl, supabaseAnonKey) :
null;

export const isSupabaseConfigured = supabase !== null;