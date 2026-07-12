import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * `import.meta.env` is not guaranteed to exist in every runtime. Accessing a
 * property on it directly throws when it is undefined, so we read it defensively
 * and fall back to an empty object.
 */
const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any).env || {};

// Only read client-safe, public variables. Server-only secrets (service role
// key, JWT secret, Postgres password) are intentionally NOT exposed to the
// browser bundle, so they are never referenced here.
//   VITE_SUPABASE_URL          — manually set in .env
//   NEXT_PUBLIC_SUPABASE_URL   — injected by the Vercel Supabase integration
const supabaseUrl =
  env.VITE_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Validate that env vars are real values, not the placeholder strings that
 * ship in the repo. A placeholder like "your-anon-key" is technically non-empty
 * but would produce confusing Supabase auth errors instead of a clean fallback.
 */
const PLACEHOLDER_PATTERNS = [
  'your-anon-key',
  'your-supabase-url',
  'your_anon_key',
  'your_supabase_url',
  'placeholder',
  '<',
];

function isRealValue(value: string | undefined): boolean {
  if (!value || value.trim().length < 20) return false;
  return !PLACEHOLDER_PATTERNS.some((p) => value.toLowerCase().includes(p));
}

const isValidUrl = isRealValue(supabaseUrl) && supabaseUrl?.startsWith('https://');
const isValidKey = isRealValue(supabaseAnonKey);

/**
 * The client is only created when BOTH env vars are real values. When they are
 * missing or placeholders we export `null` so the app renders with local seed
 * data instead of firing broken Supabase requests.
 */
export const supabase: SupabaseClient | null =
  isValidUrl && isValidKey
    ? createClient(supabaseUrl!, supabaseAnonKey!)
    : null;

export const isSupabaseConfigured = supabase !== null;
