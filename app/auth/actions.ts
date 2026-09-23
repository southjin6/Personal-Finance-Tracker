"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

// Supabase stores the session in `sb-<project-ref>-auth-token`, splitting a
// large value into chunks named `<key>.0`, `<key>.1`, ... (`@supabase/ssr`).
const AUTH_COOKIE = /^sb-.*-auth-token(\.\d+)?$/;

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  // auth-js returns from signOut() without touching storage when it cannot read
  // the session (GoTrueClient#_signOut early-returns on a session error), so a
  // non-null error can mean the session cookie is still there and still valid.
  // Delete it ourselves rather than trusting the library, so the redirect below
  // is always a real sign-out.
  if (error) {
    const cookieStore = await cookies();
    for (const { name } of cookieStore.getAll()) {
      if (!AUTH_COOKIE.test(name)) continue;
      // Mirror the attributes the cookie was set with. Removal matches on name and
      // path, so this is not required for the delete to land — but a bare
      // delete(name) emits an auth cookie with no HttpOnly and no Secure, which is
      // indistinguishable from the defect this app just fixed.
      cookieStore.delete({ name, ...AUTH_COOKIE_OPTIONS });
    }
  }

  redirect("/login");
}
