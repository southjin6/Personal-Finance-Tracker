"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
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
      <h2 className="font-semibold">Could not load your transactions</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Something went wrong while loading this page. This is usually
        temporary.
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
