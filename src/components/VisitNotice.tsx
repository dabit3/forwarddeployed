import type { VisitHighlights } from "@/lib/visits";

export default function VisitNotice({ visit, unavailable, newOnly, onToggle }: {
  visit: VisitHighlights | null;
  unavailable: boolean;
  newOnly: boolean;
  onToggle: () => void;
}) {
  if (unavailable) return <p className="visit-notice">New-role highlights are unavailable: browser storage couldn’t be saved.</p>;
  if (!visit) return null;

  return (
    <div className="visit-notice">
      <p role="status">
        {visit.previousVisitAt === null ? "First visit? We’ll mark new roles next time." : (
          <><strong>{visit.newKeys.size} new</strong> since <time dateTime={new Date(visit.previousVisitAt).toISOString()}>
            {new Date(visit.previousVisitAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </time></>
        )}
        {visit.newKeys.size > 0 && (
          <> · <button type="button" aria-pressed={newOnly} onClick={onToggle}>
            {newOnly ? "Show all roles" : "Show only new"}
          </button></>
        )}
      </p>
      <details>
        <summary>Saved only in this browser</summary>
        <p>New means not seen by this browser on an earlier visit, not a posting date. Visits reset after 30 minutes between board visits. No accounts, cookies, or server history. Clear this site’s browser storage to forget.</p>
      </details>
    </div>
  );
}
