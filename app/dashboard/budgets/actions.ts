"use server";

import { revalidatePath } from "next/cache";

import {
  firstIssue,
  messageForError,
  requireUser,
  type ActionState,
} from "@/lib/actions";
import { budgetSchema, UUID_PATTERN } from "@/lib/validations";

export type BudgetFormState = ActionState;

// One action for both "add" and "edit": a budget is identified by the category
// it limits (category_budgets_user_id_category_id_key), not by its own id, so
// there is no second code path to keep in step. The edit dialog disables the
// category select rather than sending a different payload.
export async function saveBudget(formData: FormData): Promise<BudgetFormState> {
  const { supabase, userId } = await requireUser();

  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const categoryId = parsed.data.category_id;

  // A budget is a spending limit, so it only means something on an expense
  // category. The database cannot check that: it would take a trigger reading
  // another table on every write, and the composite foreign key proves only that
  // the category is *this* user's, not what kind it is. So it is checked here,
  // once, for both the insert and the overwrite.
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("type, id")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (categoryError) return { error: messageForError(categoryError) };
  // RLS already hides another user's category, so this covers both "deleted
  // while the dialog was open" and "not yours".
  if (!category) return { error: "That category no longer exists." };
  if (category.type !== "expense") {
    return { error: "Budgets can only be set on expense categories." };
  }

  // Upsert rather than insert: picking a category that already has a limit sets
  // that limit, instead of failing on the unique constraint with a message about
  // something that already exists. onConflict names the constraint's columns,
  // which is what makes PostgREST resolve it to an UPDATE.
  const { data, error } = await supabase
    .from("category_budgets")
    .upsert(
      {
        user_id: userId,
        category_id: categoryId,
        amount: Number(parsed.data.amount),
      },
      { onConflict: "user_id,category_id" }
    )
    .select("id");

  if (error) return { error: messageForError(error) };
  // An upsert always writes a row, so an empty result would mean the write was
  // filtered out rather than performed — worth reporting instead of a success
  // toast over nothing.
  if (!data || data.length === 0) {
    return { error: "Could not save that budget. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Addressed by the budget's own id, like deleteGoal. The category's spending
// history is untouched — only the limit goes.
export async function deleteBudget(id: string): Promise<BudgetFormState> {
  const { supabase, userId } = await requireUser();

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { error: "Budget not found." };
  }

  const { data, error } = await supabase
    .from("category_budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: messageForError(error) };
  // PostgREST reports success even when the filter matched nothing, so the
  // returning rows are the only proof the budget existed.
  if (!data || data.length === 0) return { error: "Budget not found." };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
