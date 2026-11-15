import { fetchBoard, type Ats, type Company } from "./ats.ts";

export interface BoardFailure {
  ats: Ats;
  slug: string;
  name: string;
  error: string;
}

/**
 * Fetches every board and returns the ones that fail (moved, deleted, or unreachable), sorted by name.
 * Each board gets a second try, since large boards sometimes time out and APIs return the odd 5xx.
 */
export async function findFailingBoards(
  companies: Company[],
  fetch: (company: Company) => Promise<unknown> = fetchBoard,
  { concurrency = 16, attempts = 2 } = {},
): Promise<BoardFailure[]> {
  const failures: BoardFailure[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, companies.length) }, async () => {
      while (next < companies.length) {
        const c = companies[next++];
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            await fetch(c);
            break;
          } catch (err) {
            if (attempt < attempts) continue;
            failures.push({ ats: c.ats, slug: c.slug, name: c.name, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
    }),
  );
  return failures.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** A log block listing failing boards, so the refresh job's output shows them. */
export function formatFailures(failures: BoardFailure[], total: number): string {
  if (!failures.length) return `all ${total} boards responded`;
  return [
    `FAILING BOARDS: ${failures.length} of ${total} boards failed; fix or remove them in data/companies.json`,
    ...failures.map((f) => `! ${f.name} (${f.ats}/${f.slug}): ${f.error}`),
  ].join("\n");
}
