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

// `null` means "not filtering on this", never "the empty string". lib/search-params.ts
// is the only module that builds these from URL input.
export type TransactionFilters = {
  type: TransactionType | null;
  categoryId: string | null;
  from: string | null;
  to: string | null;
  q: string | null;
};

// `month: null` means the current month, so the default period never has to be
// spelled out in a URL. `page: null` means page 1.
export type DashboardQuery = TransactionFilters & {
  page: number | null;
  month: string | null;
};
