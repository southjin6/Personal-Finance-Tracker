import * as z from "zod";

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
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a valid amount, like 12.50")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
  category_id: z.string().uuid("Choose a category"),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
    // The regex only checks the shape, so 2026-02-31 would reach Postgres and
    // fail there with a raw error. Round-trip it to prove it's a real date.
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Choose a valid date"),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional(),
  payment_method: z.string().trim().max(50).optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
