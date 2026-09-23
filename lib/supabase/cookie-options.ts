import type { CookieOptions } from "@supabase/ssr";

// Applied to every server-side Supabase client. `@supabase/ssr` merges this over
// its own defaults — { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400d }
// — so only the two attributes we disagree with are listed here and the rest are
// inherited unchanged.
//
// httpOnly is safe because nothing on the client ever reads the session. The only
// browser-side Supabase call is signInWithOAuth, which writes the PKCE verifier
// and navigates away without touching the stored session. Every read — the proxy's
// getUser(), the dashboard queries, signOut — happens on the server, which reads
// cookies from the request and is unaffected by the flag. Without it any XSS on
// this origin can exfiltrate a long-lived refresh token; with it, script cannot
// see the cookie at all.
//
// sameSite stays "lax" (the default). It cannot be "strict": returning from
// Google's consent screen is a cross-site top-level GET, so a strict cookie would
// be withheld on the one request that has to see it — the callback — and login
// would break.
//
// secure is gated on production because dev serves plain http://localhost, and
// browsers drop a Secure cookie sent over http. NODE_ENV is inlined at build time,
// so this is a constant in each bundle rather than a runtime lookup.
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
