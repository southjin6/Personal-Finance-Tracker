import * as z from "zod";

export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Deliberately looser than zod's .uuid(): this matches what the Postgres uuid
// type accepts (any hex 8-4-4-4-12 shape, including the nil uuid and versions
// outside 1-5). lib/search-params.ts uses it to drop a junk filter value rather
// than handing PostgREST a string it would answer with a raw 22P02.
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A shape check alone lets 2026-02-31 through, which would reach Postgres and
// fail there with a raw error. Round-trip it to prove it is a real calendar date.
export function isRealISODate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// Amount is validated as a string so the exact same schema can validate both
// the browser form and the FormData the server action receives.
export const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  // Match the shape before coercing: Number() also accepts "1e9", "0x10" and
  // extra decimals, which numeric(12,2) would either store as a huge value or
  // silently round. {1,10} integer digits + {1,2} decimals mirrors numeric(12,2).
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .regex(AMOUNT_PATTERN, "Enter a valid amount, like 12.50")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
  category_id: z.string().uuid("Choose a category"),
  occurred_on: z
    .string()
    .regex(ISO_DATE_PATTERN, "Choose a valid date")
    .refine(isRealISODate, "Choose a valid date"),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional(),
  payment_method: z.string().trim().max(50).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// Mirrors the *_name_length CHECK constraints: char_length(name) between 1 and
// 100. Shared by categories and savings goals, which bound a name identically.
export const nameField = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(100, "Name must be 100 characters or fewer");

export const categorySchema = z.object({
  name: nameField,
  type: z.enum(["income", "expense"]),
});

// Renaming takes the name only. The type is immutable once a category exists —
// see app/dashboard/categories/actions.ts for why.
export const categoryRenameSchema = z.object({ name: nameField });

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryRenameInput = z.infer<typeof categoryRenameSchema>;

// Savings goals --------------------------------------------------------------

// Bounds mirror the savings_goals CHECK constraints: target_amount > 0 and
// 0 <= saved_amount <= target_amount. The cross-field rule is repeated here
// because the form should explain the problem, not surface a raw 23514 from
// PostgREST, which is directly reachable with a session.
const goalAmountField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(AMOUNT_PATTERN, "Enter a valid amount, like 12.50");

// Blank means "nothing saved yet", which is the normal case for a new goal, so
// an empty box is valid rather than an error — the action turns "" into 0.
// AMOUNT_PATTERN has no sign, so a negative value cannot be entered at all.
const optionalAmountField = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || AMOUNT_PATTERN.test(value),
    "Enter a valid amount, like 12.50"
  );

// Blank means "no deadline". A shape check alone would let 2026-02-31 through,
// so round-trip it the same way transactionSchema.occurred_on does.
const optionalDateField = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.length === 0 ||
      (ISO_DATE_PATTERN.test(value) && isRealISODate(value)),
    "Choose a valid date"
  );

export const savingsGoalSchema = z
  .object({
    name: nameField,
    target_amount: goalAmountField.refine(
      (value) => Number(value) > 0,
      "Target must be greater than 0"
    ),
    saved_amount: optionalAmountField,
    deadline: optionalDateField,
  })
  .refine(
    (goal) => Number(goal.saved_amount || "0") <= Number(goal.target_amount),
    {
      message: "Saved so far cannot be more than the target.",
      path: ["saved_amount"],
    }
  );

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
