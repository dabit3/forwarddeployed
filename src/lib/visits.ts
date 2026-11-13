export const VISIT_STORAGE_KEY = "forwarddeployed:visits:v1";
export const VISIT_GAP_MS = 30 * 60 * 1000;

interface Snapshot {
  version: 1;
  visitedAt: number;
  knownKeys: string[];
  baselineAt: number | null;
  baselineKeys: string[];
}

export interface VisitHighlights {
  previousVisitAt: number | null;
  newKeys: Set<string>;
}

function readSnapshot(raw: string | null, now: number): Snapshot | null {
  try {
    const s = JSON.parse(raw ?? "null");
    const keys = (v: unknown): v is string[] => Array.isArray(v) && v.every((k) => typeof k === "string");
    const timestamp = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= now;
    if (
      s?.version !== 1 || !timestamp(s.visitedAt) || !keys(s.knownKeys) || !keys(s.baselineKeys) ||
      (s.baselineAt !== null && (!timestamp(s.baselineAt) || s.baselineAt > s.visitedAt))
    ) return null;
    return s;
  } catch {
    return null;
  }
}

export function recordVisit(
  storage: Pick<Storage, "getItem" | "setItem">,
  roleKeys: string[],
  now = Date.now(),
): VisitHighlights {
  const previous = readSnapshot(storage.getItem(VISIT_STORAGE_KEY), now);
  const continuing = previous && now - previous.visitedAt < VISIT_GAP_MS;
  const baselineAt = continuing ? previous.baselineAt : previous?.visitedAt ?? null;
  const baselineKeys = continuing ? previous.baselineKeys : previous?.knownKeys ?? [];
  const known = new Set(baselineKeys);
  const newKeys = new Set(baselineAt === null ? [] : roleKeys.filter((key) => !known.has(key)));
  const snapshot: Snapshot = {
    version: 1,
    visitedAt: now,
    // Retain seen roles across temporary ATS failures and closed/reopened listings.
    knownKeys: [...new Set([...(previous?.knownKeys ?? []), ...roleKeys])],
    baselineAt,
    baselineKeys,
  };
  storage.setItem(VISIT_STORAGE_KEY, JSON.stringify(snapshot));
  return { previousVisitAt: baselineAt, newKeys };
}
