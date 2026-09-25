import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearFiltersHref,
  dashboardSearch,
  hasActiveFilters,
} from "@/lib/search-params";
import type { Category, DashboardQuery } from "@/lib/types";

// A plain GET form: the browser replaces the entire query string with these
// fields, so submitting resets to page 1 and drops the pagination params without
// any client JS. Any param the form does not own has to be carried explicitly or
// applying a filter would silently forget it — that is what the month input is
// for.
export function TransactionFilters({
  query,
  categories,
}: {
  query: DashboardQuery;
  categories: Category[];
}) {
  const active = hasActiveFilters(query);

  return (
    <form
      method="get"
      action="/dashboard"
      // Keyed by the canonical query so a soft navigation (a Clear click, a
      // pagination link) remounts the controls and the URL stays the source of
      // truth for what the fields show.
      key={dashboardSearch(query, { includePage: false })}
      className="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {query.month ? (
        <input type="hidden" name="month" value={query.month} />
      ) : null}

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="filter-q">Search notes</Label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          placeholder="e.g. groceries…"
          defaultValue={query.q ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-type">Type</Label>
        <select
          id="filter-type"
          name="type"
          className={inputClassName}
          defaultValue={query.type ?? ""}
        >
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-category">Category</Label>
        <select
          id="filter-category"
          name="category_id"
          className={inputClassName}
          defaultValue={query.categoryId ?? ""}
        >
          <option value="">All categories</option>
          {/* Grouped by type because the same name can exist as both — the
              seeded set already has "Groceries" on the expense side and the app
              allows the pair. */}
          {(["expense", "income"] as const).map((type) => {
            const group = categories.filter((category) => category.type === type);
            if (group.length === 0) return null;

            return (
              <optgroup
                key={type}
                label={type === "expense" ? "Expense" : "Income"}
              >
                {group.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-from">From</Label>
        <Input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={query.from ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-to">To</Label>
        <Input
          id="filter-to"
          name="to"
          type="date"
          defaultValue={query.to ?? ""}
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
        <Button type="submit" variant="secondary" size="sm">
          Apply filters
        </Button>

        {active ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={clearFiltersHref(query)}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
