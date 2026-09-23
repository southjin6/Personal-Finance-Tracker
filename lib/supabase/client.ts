import { createBrowserClient } from "@supabase/ssr";

// Deliberately no `cookieOptions`. This client writes the PKCE code verifier with
// JavaScript, so that cookie has to stay readable by JavaScript — the httpOnly
// used by the server clients (lib/supabase/cookie-options.ts) would make it
// unreadable and break the Google sign-in round trip. The verifier is short-lived
// and single-use, so the XSS exposure that justifies httpOnly on the session
// cookie does not apply here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
