"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema, type TransactionInput } from "@/lib/validations";

export type TransactionFormState = { error?: string; ok?: boolean };

type Supabase = Awaited<ReturnType<typeof createClient>>;

function blankToNull(value?: string) {
  return value && value.length > 0 ? value : null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { supabase, userId: user.id };
}

function parseForm(formData: FormData) {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;
  }
  return { data: parsed.data } as const;
}

// The database does not enforce that a transaction's type matches its
// category's type, so check it here.
async function categoryMatchesType(supabase: Supabase, data: TransactionInput) {
  const { data: category } = await supabase
    .from("categories")
    .select("type")
    .eq("id", data.category_id)
    .maybeSingle();

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

  const mismatch = await categoryMatchesType(supabase, parsed.data);
  if (mismatch) return { error: mismatch };

  const { error } = await supabase
    .from("transactions")
    .insert(toRow(parsed.data, userId));

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTransaction(
  formData: FormData
): Promise<TransactionFormState> {
  const { supabase, userId } = await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Missing transaction id." };
  }

  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const mismatch = await categoryMatchesType(supabase, parsed.data);
  if (mismatch) return { error: mismatch };

  const { data, error } = await supabase
    .from("transactions")
    .update(toRow(parsed.data, userId))
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: error.message };
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

  if (typeof id !== "string" || id.length === 0) {
    return { error: "Missing transaction id." };
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Transaction not found." };

  revalidatePath("/dashboard");
  return { ok: true };
}
