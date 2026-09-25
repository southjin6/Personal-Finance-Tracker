import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <span className="sr-only">Loading your dashboard…</span>

      <div aria-hidden>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your income and expenses at a glance.
        </p>
      </div>

      {/* The insights panel is part of the same awaited work as the list, so the
          fallback has to reserve its shape too. */}
      <div aria-hidden className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
            <Skeleton className="h-5 w-52" />
          </div>
          <Skeleton className="h-7 w-44" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl p-3 ring-1 ring-foreground/10">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-7 w-28" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-72 w-full" />
        </div>
      </div>

      <div aria-hidden className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
            <p className="text-muted-foreground text-sm">
              Your income and expenses, most recent first.
            </p>
          </div>
          <Skeleton className="h-8 w-32" />
        </div>

        <Skeleton className="h-28 w-full rounded-lg" />

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-14" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
