import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMonthLabel } from "@/lib/format";
import { addMonths } from "@/lib/search-params";

// Two links rather than a client-side picker: no state, no hydration, and the
// period survives the navigation.
//
// The month arithmetic and the "the current month is the absence of a month"
// rule live here, so they cannot be re-implemented per page; the href builder
// comes from the caller because only the caller knows its own path. Both
// builders live in lib/search-params.ts, so a link is still never assembled by
// hand. Every one of these is a server component, so the function prop crosses
// no serialization boundary.
export function MonthPicker({
  month,
  thisMonth,
  hrefFor,
}: {
  month: string;
  thisMonth: string;
  hrefFor: (month: string | null) => string;
}) {
  function stepHref(delta: number) {
    const target = addMonths(month, delta);
    // Landing back on the month we are in drops the param again, so there is
    // only ever one URL for "the current month" and a shared link keeps
    // following the calendar.
    return hrefFor(target === thisMonth ? null : target);
  }

  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon-sm">
        <Link href={stepHref(-1)} aria-label="Previous month">
          <ChevronLeftIcon />
        </Link>
      </Button>

      <span className="min-w-36 text-center text-sm font-medium">
        {formatMonthLabel(month)}
      </span>

      <Button asChild variant="outline" size="icon-sm">
        <Link href={stepHref(1)} aria-label="Next month">
          <ChevronRightIcon />
        </Link>
      </Button>
    </div>
  );
}
