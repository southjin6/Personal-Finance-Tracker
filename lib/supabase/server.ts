import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // `setAll` also receives headers (Cache-Control: private, no-cache,
        // no-store...) that belong on the response. They cannot be forwarded
        // from here: Next exposes no way to write response headers in this
        // context, and cookies() only writes cookies. Every path that can emit
        // a Set-Cookie covers them instead — the proxy (lib/supabase/proxy.ts),
        // Next's own action handler, and app/auth/callback/route.ts.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies. The proxy refreshes the
            // session on every request, so this is safe to ignore here.
          }
        },
      },
    }
  );
}
