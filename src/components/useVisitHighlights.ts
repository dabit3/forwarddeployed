"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/roles";
import { recordVisit, type VisitHighlights } from "@/lib/visits";

export default function useVisitHighlights(roles: Role[]) {
  const [visit, setVisit] = useState<VisitHighlights | null>(null);
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
