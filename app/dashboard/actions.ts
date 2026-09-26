"use server";

import { revalidatePath } from "next/cache";
import {
  blankToNull,
  firstIssue,
  messageForError,
  requireUser,
  type ActionState,
  type Supabase,
} from "@/lib/actions";
import {
  transactionSchema,
  UUID_PATTERN,
  type TransactionInput,
} from "@/lib/validations";

export type TransactionFormState = ActionState;

function parseForm(formData: FormData) {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) } as const;
  }
  return { data: parsed.data } as const;
}

// The database does not enforce that a transaction's type matches its
// category's type, so check it here.
async function categoryMatchesType(
  supabase: Supabase,
  userId: string,
  data: TransactionInput
) {
  const { data: category, error } = await supabase
    .from("categories")
    .select("type")
    .eq("id", data.category_id)
    // Paired with the owner, the way every other read of a caller-supplied
    // category id is -- see saveBudget in app/dashboard/budgets/actions.ts. RLS
    // already hides another user's category, so this is a second barrier rather
    // than the only one: without it, a policy regression would let a foreign
    // category pass this check and leave the composite foreign key to catch the
    // write, which it does with a message about something else entirely.
    .eq("user_id", userId)
    .maybeSingle();

  // Distinct from the branch below on purpose: a failed read means we could not
  // ask, which is not the same claim as "that id is not one of yours".
  if (error) return messageForError(error);
  if (!category) return "Choose a valid category.";
  if (category.type !== data.type) {
    return "That category does not match the transaction type.";
  }
  return null;
}

function toRow(data: TransactionInput, userId: string) {
  return {
    user_id: userId,
    category_id: data.category_id,
    type: data.type,
    amount: Number(data.amount),
    occurred_on: data.occurred_on,
    notes: blankToNull(data.notes),
    payment_method: blankToNull(data.payment_method),
  };
}

export async function createTransaction(
  formData: FormData
): Promise<TransactionFormState> {
  const { supabase, userId } = await requireUser();

  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const mismatch = await categoryMatchesType(supabase, userId, parsed.data);
  if (mismatch) return { error: mismatch };

  const { error } = await supabase
    .from("transactions")
    .insert(toRow(parsed.data, userId));

  if (error) return { error: messageForError(error) };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTransaction(
  formData: FormData
): Promise<TransactionFormState> {
  const { supabase, userId } = await requireUser();

  // Shape-checked rather than merely non-empty: a junk id reaches PostgREST as a
  // uuid comparison and fails there with 22P02, which messageForError has no
  // branch for -- the caller would get generic copy where a missing row says
  // "not found". Same guard as updateGoal in app/dashboard/goals/actions.ts.
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Transaction not found." };
  }

  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const mismatch = await categoryMatchesType(supabase, userId, parsed.data);
  if (mismatch) return { error: mismatch };

  const { data, error } = await supabase
    .from("transactions")
    .update(toRow(parsed.data, userId))
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  // PostgREST reports success even when the filter matched nothing, so the
  // returning rows are the only proof the row existed. Without this an update
  // that RLS (or a bad id) silently skipped would look like it worked.
  if (!data || data.length === 0) return { error: "Transaction not found." };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTransaction(
  id: string
): Promise<TransactionFormState> {
  const { supabase, userId } = await requireUser();

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Transaction not found." };
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  if (!data || data.length === 0) return { error: "Transaction not found." };

  revalidatePath("/dashboard");
  return { ok: true };
}
