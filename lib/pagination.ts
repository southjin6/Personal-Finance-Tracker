export const PAGE_SIZE = 10;

// Bounds the offset so a hand-typed ?page= cannot send PostgREST a malformed Range header.
const MAX_PAGE = 10_000;

export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return page > 0 && page <= MAX_PAGE ? page : 1;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}
