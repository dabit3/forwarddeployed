"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/roles";
import { readVisit, recordVisit, type VisitHighlights } from "@/lib/visits";

export default function useVisitHighlights(roles: Role[], restoring = false) {
  const [visit, setVisit] = useState<VisitHighlights | null>(() => {
    if (!restoring || !roles.length) return null;
    try {
      // Back needs the full list height before the router restores its scroll position.
      return readVisit(window.localStorage, roles.map((role) => role.key));
    } catch {
      return null;
    }
  });
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!roles.length) return;
    try {
      setVisit(recordVisit(window.localStorage, roles.map((role) => role.key)));
      setUnavailable(false);
    } catch {
      setVisit(null);
      setUnavailable(true);
    }
  }, [roles]);

  return { visit, unavailable };
}
