"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Reached only when the page throws — the PostgREST failures it can describe are
// handled inline, where the reader can still see the month picker and the rest of
// the shell. This boundary is for everything unexpected.
export default function BudgetsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center">
      <h2 className="font-semibold">Could not load your budgets</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Something went wrong while loading this page. This is usually temporary.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button className="mt-4" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
