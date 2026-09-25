import { redirect } from "next/navigation";
import * as z from "zod";

import { createClient } from "@/lib/supabase/server";

// Mutating actions return their failures instead of throwing, so every action
// module in the app shares this shape.
export type ActionState = { error?: string; ok?: boolean };

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export function blankToNull(value?: string) {
  return value && value.length > 0 ? value : null;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, userId: user.id };
}

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input";
}

// PostgREST surfaces raw Postgres messages, which are written for a developer
// reading a log rather than for the person who just clicked a button. Map the
// violation codes a mutation can realistically hit; anything else falls back to
// generic copy with the original logged so it is still diagnosable.
//   23503 foreign_key_violation  23505 unique_violation  23514 check_violation
export function messageForError(error: { code?: string; message: string }) {
  switch (error.code) {
    case "23503":
      return "That item is still in use.";
    case "23505":
      return "That already exists.";
    case "23514":
      return "That value is out of range.";
    default:
      console.error("Unhandled database error", error);
      return "Something went wrong. Please try again.";
  }
}
