import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMonthLabel } from "@/lib/format";
import { addMonths, dashboardHref } from "@/lib/search-params";
import type { DashboardQuery } from "@/lib/types";

// Two links rather than a client-side picker: no state, no hydration, and the
// page, filters and period survive the navigation because every href is built by
// the one URL owner (lib/search-params.ts).
export function MonthPicker({
  query,
  month,
  thisMonth,
}: {
  query: DashboardQuery;
  month: string;
  thisMonth: string;
}) {
  // Landing back on the month we are in drops the param again, so there is only
  // ever one URL for "the current month" and a shared link keeps following the
  // calendar.
  function hrefFor(delta: number) {
    const target = addMonths(month, delta);
    return dashboardHref({
      ...query,
      month: target === thisMonth ? null : target,
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon-sm">
        <Link href={hrefFor(-1)} aria-label="Previous month">
          <ChevronLeftIcon />
        </Link>
      </Button>

      <span className="min-w-36 text-center text-sm font-medium">
        {formatMonthLabel(month)}
      </span>

      <Button asChild variant="outline" size="icon-sm">
        <Link href={hrefFor(1)} aria-label="Next month">
          <ChevronRightIcon />
        </Link>
      </Button>
    </div>
  );
}
