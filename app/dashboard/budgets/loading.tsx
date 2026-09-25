import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetsLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">Loading budgets…</span>

      <div aria-hidden className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm">
            Set a limit for a category and track what you spend against it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div aria-hidden className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
