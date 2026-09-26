"use server";

import { revalidatePath } from "next/cache";

import {
  firstIssue,
  messageForError,
  requireUser,
  type ActionState,
  type Supabase,
} from "@/lib/actions";
import { categoryRenameSchema, categorySchema } from "@/lib/validations";
import type { TransactionType } from "@/lib/types";

export type CategoryFormState = ActionState;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// There is no unique constraint on (user_id, type, name): the seed values can't
// collide with each other, and a duplicate name is a UX wart rather than an
// integrity hole, so forcing a schema re-run for it isn't worth it. Compare in
// JS instead of with ilike so there is no LIKE wildcard escaping to get wrong;
// a user has at most a few dozen categories.
async function nameTaken(
  supabase: Supabase,
  userId: string,
  type: TransactionType,
  name: string,
  excludeId?: string
): Promise<{ taken: boolean } | { error: string }> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", type);

  // A discarded error here read as "no duplicate", so a transient read failure
  // let a duplicate through. Separate "checked, not taken" from "not checked".
  if (error) {
    return { error: "Could not check your categories. Please try again." };
  }

  const target = name.toLowerCase();
  return {
    taken: (data ?? []).some(
      (row) => row.id !== excludeId && row.name.trim().toLowerCase() === target
    ),
  };
}

export async function createCategory(
  formData: FormData
): Promise<CategoryFormState> {
  const { supabase, userId } = await requireUser();

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { name, type } = parsed.data;

  const nameCheck = await nameTaken(supabase, userId, type, name);
  if ("error" in nameCheck) return { error: nameCheck.error };
  if (nameCheck.taken) {
    return { error: `You already have an ${type} category called "${name}".` };
  }

  // Appended within the user's own (user_id, type) group. Reading the current
  // maximum and writing max + 1 can race across two tabs, but two equal
  // sort_order values are harmless because every reader falls back to id.
  const { data: last, error: lastError } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("user_id", userId)
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Without this the failure fell through as `last = null`, so the new row took
  // sort_order 1 and collided with an existing row instead of appending.
  if (lastError) {
    return { error: "Could not add your category. Please try again." };
  }

  const { error } = await supabase.from("categories").insert({
    user_id: userId,
    name,
    type,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) return { error: messageForError(error) };

  // A layout path invalidates the layout and every nested page, so this covers
  // /dashboard, /dashboard/categories and every future sub-route. A renamed or
  // added category shows up in the transaction list badges as well as here.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function renameCategory(
  formData: FormData
): Promise<CategoryFormState> {
  const { supabase, userId } = await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Category not found." };
  }

  const parsed = categoryRenameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data: current, error: currentError } = await supabase
    .from("categories")
    .select("type")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  // A discarded error made a failed read indistinguishable from "no such row",
  // so a transient failure reported "Category not found." for a category that
  // exists.
  if (currentError) {
    return { error: "Could not load this category. Please try again." };
  }

  if (!current) return { error: "Category not found." };

  const nameCheck = await nameTaken(
    supabase,
    userId,
    current.type,
    parsed.data.name,
    id
  );
  if ("error" in nameCheck) return { error: nameCheck.error };
  if (nameCheck.taken) {
    return { error: `You already have a category called "${parsed.data.name}".` };
  }

  // `type` is deliberately not part of this update. The database does not
  // enforce that a transaction's type matches its category's type (the check
  // lives in app/dashboard/actions.ts and only runs on write), so changing a
  // category's type would silently strand every transaction already filed
  // under it, with no way back through the UI.
  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  if (!data || data.length === 0) return { error: "Category not found." };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryFormState> {
  const { supabase, userId } = await requireUser();

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Category not found." };
  }

  // transactions_category_id_user_id_fkey is `on delete no action`, so deleting
  // a referenced category fails with a raw 23503. Count first so the common case
  // gets a message that explains what to do about it.
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("user_id", userId);

  if (countError) {
    return { error: "Could not check this category. Please try again." };
  }

  if ((count ?? 0) > 0) {
    const noun = count === 1 ? "transaction" : "transactions";
    const pronoun = count === 1 ? "it" : "them";
    return {
      error: `This category is used by ${count} ${noun}. Move or delete ${pronoun} first, then try again.`,
    };
  }

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  // Counting and deleting are not atomic: another tab can file a transaction in
  // between, so the constraint is the real guard. Map it to the same story the
  // count above tells rather than letting a Postgres message reach the toast.
  if (error?.code === "23503") {
    return {
      error:
        "This category is used by transactions. Move or delete them first, then try again.",
    };
  }
  if (error) return { error: messageForError(error) };
  if (!data || data.length === 0) return { error: "Category not found." };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
