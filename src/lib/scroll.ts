export function roleScrollTop(state: unknown, list: string): number {
  const saved = (state as { roleScroll?: { list?: unknown; top?: unknown } } | null)?.roleScroll;
  return saved?.list === list && typeof saved.top === "number" && Number.isFinite(saved.top) && saved.top >= 0
    ? saved.top
    : 0;
}
