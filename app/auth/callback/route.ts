import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A route handler's `request.url` origin comes from server config, not the Host
// header, so `new URL(path, origin)` always yields http://localhost:3000 even
// when the browser is on 127.0.0.1 or a LAN IP. Redirecting there would move the
// browser to a different origin than the one the session cookie was just set on,
// which surfaces as a login loop rather than an error. A relative Location keeps
// the browser on whatever host it used — the same thing Next does for proxy
// redirects — and cannot point off-site at all.
//
// Every response here can carry a Set-Cookie — either the new session or the
// PKCE verifier being cleared — so none of them may be cached by a CDN or
// reverse proxy, or one user's cookie could be served to another.
function noStoreRedirect(location: string) {
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: location },
  });
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0"
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // OAuth puts the machine-readable code in `error` and human text in
  // `error_description`. Only the code is forwarded, because the login page maps
  // codes to its own copy rather than rendering text from the query string.
  const oauthError = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

  if (oauthError) {
    return noStoreRedirect(`/login?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return noStoreRedirect("/login?error=missing_code");
  }

  // In a Route Handler, cookies() is writable, so the session cookies set here
  // are attached to the outgoing response automatically.
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Same reasoning: `error.message` is free text from the auth server. Pass
    // the stable code and let the login page pick the copy to show.
    return noStoreRedirect(
      `/login?error=${encodeURIComponent(error.code ?? "exchange_failed")}`
    );
  }

  // Keep `next` only if it resolves back to our own origin. A prefix check is
  // not enough: new URL() treats "\" as "/" for http(s), so "/\evil.com" passes
  // startsWith("/") and redirects off-site. The origin comparison catches that.
  //
  // The separate "//" guard exists because the result is used as a *relative*
  // Location: a path can legitimately start with "//" when the authority was
  // explicit (new URL("http://host//evil.com")), and a browser reads "//host" in
  // Location as protocol-relative, i.e. off-site.
  const base = new URL(origin);
  let destination = "/dashboard";

  try {
    const target = new URL(next, base);
    if (target.origin === base.origin && !target.pathname.startsWith("//")) {
      destination = `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Malformed value such as "http://" — keep the default.
  }

  return noStoreRedirect(destination);
}
