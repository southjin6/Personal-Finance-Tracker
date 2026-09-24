import Link from "next/link";

import { Button } from "@/components/ui/button";

function pageHref(page: number) {
  return page <= 1 ? "/dashboard" : `/dashboard?page=${page}`;
}

export function TransactionPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Transaction pages"
      className="flex items-center justify-between gap-4"
    >
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={pageHref(page - 1)} rel="prev">
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
            <Link href={pageHref(page + 1)} rel="next">
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
