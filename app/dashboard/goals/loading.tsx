import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">Loading savings goals…</span>

      <div aria-hidden className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Savings goals
          </h1>
          <p className="text-muted-foreground text-sm">
            Track how much of each target you have put aside.
          </p>
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      <div aria-hidden className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
