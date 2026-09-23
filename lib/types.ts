export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  notes: string | null;
  payment_method: string | null;
  category_id: string;
};
