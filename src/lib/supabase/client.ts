// Adapted from nextjs-supabase-shadcn-boilerplate (https://github.com/Barty-Bart/nextjs-supabase-shadcn-boilerplate, MIT).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase, SUPABASE_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** Returns a browser client, or null when Supabase isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
