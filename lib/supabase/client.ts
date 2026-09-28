import { createBrowserClient } from "@supabase/ssr";

// Deliberately no `cookieOptions`. `@supabase/ssr` writes the PKCE code verifier
// with `document.cookie` and spreads `cookieOptions` into that write, so the
// server clients' options (lib/supabase/cookie-options.ts) cannot be reused here:
// a cookie carrying `HttpOnly` from a non-HTTP API is discarded outright by the
// browser rather than stored, and sign-in then fails at the callback as
// `pkce_code_verifier_not_found`. Leaving the verifier readable by script is an
// acceptable trade — it is single-use, useless without the `code` delivered to
// /auth/callback, and bounded by Supabase expiring the matching flow state.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
