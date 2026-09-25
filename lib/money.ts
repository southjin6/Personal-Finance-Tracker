// Money helpers. Leaf module on purpose: no imports, so bare Node can run it as
// a probe with nothing resolved.
//
// Every amount in this app comes from a numeric(12, 2) column, so PostgREST
// hands JavaScript a double within ~1e-10 of a two-decimal value and rounding to
// cents is exact for those inputs — the 0.5 threshold is never in doubt. So sums
// and comparisons are done in integer cents; division only ever happens for
// display, where the result is rounded immediately.
//
// What that does NOT promise: a single amount is still a double once it is in
// JS. The invariant is "sums and comparisons happen in cents", not "numbers are
// decimal" — hence a "use numeric in Postgres, not floats" caveat in the README.

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + toCents(value), 0);
}
