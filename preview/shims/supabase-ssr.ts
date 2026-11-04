// The preview never talks to Supabase; accounts stay in on-device mode.
export function createBrowserClient(): null {
  return null;
}
export function createServerClient(): null {
  return null;
}
