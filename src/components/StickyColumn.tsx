"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Scrolls with the sidebar until its last line is in view, then stays put while the companies keep scrolling. */
export default function StickyColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const scroller = el?.parentElement;
    if (!el || !scroller) return;
    const place = () => {
      const pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      // Sticky offsets count from inside the sidebar's padding.
      el.style.top = `${Math.min(0, scroller.clientHeight - el.offsetHeight - 2 * pad)}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="sticky-column">
      {children}
    </div>
  );
}
