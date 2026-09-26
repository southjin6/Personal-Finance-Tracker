import { redirect } from "next/navigation";

import { GoalFormDialog } from "@/components/goal-form";
import { GoalList } from "@/components/goal-list";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { pageCount, pageRange, parsePage } from "@/lib/pagination";
import { goalsHref, type RawSearchParams } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import type { SavingsGoal } from "@/lib/types";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const requestedPage = parsePage(raw.page);
  const { from, to } = pageRange(requestedPage);

  const supabase = await createClient();

  // Paged the way the transaction table is, with the count taken from the same
  // read: this list used to stop at 200 rows and the only sign of it was a short
  // page. Two goals can share a created_at, so id is the tiebreak that keeps a
  // row from repeating or skipping across the page boundary.
  const { data, error, count } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, saved_amount, deadline", {
      count: "exact",
    })
    .order("created_at")
    .order("id")
    .range(from, to);

  const goals: SavingsGoal[] = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = pageCount(totalCount);

  // PostgREST answers PGRST103 (416) once the requested window starts at or past
  // the end of the set, and reports no count with that answer -- so a page typed
  // past the last one arrives with nothing to clamp against, and the count cannot
  // be read from the same response. Ask for it on its own instead: a request with
  // no range cannot be unsatisfiable. Any other failure is a real one and falls
  // through to the message below.
  if (error?.code === "PGRST103") {
    const { count: total } = await supabase
      .from("savings_goals")
      .select("id", { count: "exact", head: true });

    if (total !== null) redirect(goalsHref(pageCount(total)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings goals</h1>
          <p className="text-muted-foreground text-sm">
            Track how much of each target you have put aside.
          </p>
          {/* The count is what the list itself cannot show: it is the only sign
              that there is more than one page of goals. */}
          {error ? null : (
            <p className="text-muted-foreground mt-1 text-sm">
              {totalCount} {totalCount === 1 ? "goal" : "goals"}
            </p>
          )}
        </div>

        <GoalFormDialog trigger={<Button>Add goal</Button>} />
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          Could not load your savings goals. Please refresh the page.
        </p>
      ) : (
        <>
          <GoalList goals={goals} />
          <ListPagination
            page={requestedPage}
            totalPages={totalPages}
            label="Goal pages"
            hrefFor={goalsHref}
          />
        </>
      )}
    </div>
  );
}
