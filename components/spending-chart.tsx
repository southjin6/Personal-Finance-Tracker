"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPHPFromCents } from "@/lib/format";
import { OTHER_SLICE_ID, type SpendingSlice } from "@/lib/insights";

const chartConfig = {
  expenseCents: { label: "Spent", color: "var(--chart-2)" },
} satisfies ChartConfig;

// The axis is a rough scale, so it drops the cents the tooltip keeps.
function axisPeso(cents: number) {
  return `₱${Math.round(cents / 100).toLocaleString("en-PH")}`;
}

// One series, so one colour: cycling a palette across bars of the same series
// implies a second dimension that is not there, and the length of the bar is
// already the value. The greyscale ramp in --chart-1..5 is therefore unused
// here; the bucket that is not a single category is marked by opacity instead.
export function SpendingChart({ slices }: { slices: SpendingSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.expenseCents, 0);

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <BarChart data={slices} layout="vertical" margin={{ left: 0, right: 12 }}>
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={axisPeso}
          />
          <YAxis
            type="category"
            dataKey="categoryName"
            width={112}
            // Every category gets a label; the default would drop ticks and
            // leave bars with nothing to identify them.
            interval={0}
            tickLine={false}
            axisLine={false}
            reversed
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => String(label)}
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatPHPFromCents(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="expenseCents" radius={4}>
            {slices.map((slice) => (
              <Cell
                key={slice.categoryId}
                fill="var(--chart-2)"
                fillOpacity={slice.categoryId === OTHER_SLICE_ID ? 0.45 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* The same numbers as text: a bar chart is not readable by a screen
          reader, and this is more useful than a legend would be. */}
      <ul className="space-y-1.5">
        {slices.map((slice) => (
          <li
            key={slice.categoryId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="truncate">
              {slice.categoryName}
              <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                {total > 0
                  ? Math.round((slice.expenseCents / total) * 100)
                  : 0}
                %
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {formatPHPFromCents(slice.expenseCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
