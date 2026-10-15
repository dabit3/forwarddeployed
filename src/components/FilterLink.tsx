import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { filtersHref, type Filters } from "@/lib/roles";

/** A real link to the filtered list; on the list page itself a plain click filters in place. */
export default function FilterLink({
  to,
  onSelect,
  className,
  current,
  children,
}: {
  to: Filters;
  onSelect?: (f: Filters) => void;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  function click(e: MouseEvent) {
    if (!onSelect || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(to);
  }
  return (
    <Link href={filtersHref(to)} className={className} aria-current={current || undefined} onClick={onSelect ? click : undefined}>
      {children}
    </Link>
  );
}
