import Link from "next/link";

import { Button } from "@/components/ui/button";

// Shared by every paginated list. It takes an href builder rather than a query
// object, because each page owns its own URL shape -- /dashboard carries filters
// and a month, /dashboard/goals carries only a page. What lives here is the
// markup and the "page 1 needs no parameter" rule, which is the builder's.
export function ListPagination({
  page,
  totalPages,
  label,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  label: string;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page - 1)} rel="prev">
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}

        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page + 1)} rel="next">
              Next
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}
