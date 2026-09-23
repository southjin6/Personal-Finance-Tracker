import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

const PROTECTED_PATHS = ["/dashboard"];

// `nextUrl.pathname` keeps the raw spelling from the request, so comparing it
// directly misses "/%64ashboard", "/DASHBOARD" and "//dashboard". Today those
// all 404 before the dashboard layout ever runs, so nothing is reachable through
// them — but a guard that quietly skips is worse than no guard, because it hides
// the day a route stops being covered. Normalise first: decode, collapse
// repeated slashes, drop a trailing slash, compare case-insensitively.
function isProtected(pathname: string) {
  let decoded = pathname;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed escape such as "%E0%A4%A" throws; fall back to the raw value.
  }

  const normalized = decoded
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();

  return PROTECTED_PATHS.some((path) => {
    const target = path.toLowerCase();
    return normalized === target || normalized.startsWith(`${target}/`);
  });
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          // Required so a refreshed session cookie is never served to another
          // user by a CDN or reverse proxy.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        },
      },
    }
  );

  // Must run before the response is committed, otherwise a token refresh that
  // completes later cannot write its cookies back to the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
