"use server";

import { revalidatePath } from "next/cache";

import {
  blankToNull,
  firstIssue,
  messageForError,
  requireUser,
  type ActionState,
} from "@/lib/actions";
import {
  savingsGoalSchema,
  UUID_PATTERN,
  type SavingsGoalInput,
} from "@/lib/validations";

export type SavingsGoalFormState = ActionState;

// Saved-so-far is optional in the form; blank means "nothing yet". AMOUNT_PATTERN
// has no sign, so a negative value can never reach the CHECK constraint.
function toRow(data: SavingsGoalInput, userId: string) {
  return {
    user_id: userId,
    name: data.name,
    target_amount: Number(data.target_amount),
    saved_amount: Number(data.saved_amount || "0"),
    deadline: blankToNull(data.deadline),
  };
}

export async function createGoal(
  formData: FormData
): Promise<SavingsGoalFormState> {
  const { supabase, userId } = await requireUser();

  const parsed = savingsGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { error } = await supabase
    .from("savings_goals")
    .insert(toRow(parsed.data, userId));

  if (error) return { error: messageForError(error) };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function updateGoal(
  formData: FormData
): Promise<SavingsGoalFormState> {
  const { supabase, userId } = await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Goal not found." };
  }

  const parsed = savingsGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data, error } = await supabase
    .from("savings_goals")
    .update(toRow(parsed.data, userId))
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  // PostgREST reports success even when the filter matched nothing, so the
  // returning rows are the only proof the goal existed. Without this an update
  // that RLS (or a bad id) silently skipped would look like it worked.
  if (!data || data.length === 0) return { error: "Goal not found." };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<SavingsGoalFormState> {
  const { supabase, userId } = await requireUser();

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Goal not found." };
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  if (!data || data.length === 0) return { error: "Goal not found." };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
