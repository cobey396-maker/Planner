/**
 * Supabase connection settings. Both values are PUBLIC by design: the
 * publishable key only identifies the project, and row-level security
 * decides what anyone can actually read or write. (Never put the secret /
 * service-role key in a NEXT_PUBLIC_ variable: those ship to the browser.)
 *
 * When they're missing, the app runs in DEMO MODE: no accounts, sample data
 * only. That keeps local development, tests and previews working without a
 * Supabase project.
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}
