"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(params.get("q") ?? ""), [params]);

  function go(q: string) {
    const next = new URLSearchParams(pathname === "/" ? params.toString() : "");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  return (
    <form
      className="search"
      role="search"
      action="/"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <input
        type="search"
        name="q"
        value={value}
        placeholder="Search"
        aria-label="Search roles"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const q = e.target.value;
          setValue(q);
          if (timer.current) clearTimeout(timer.current);
          if (pathname === "/") timer.current = setTimeout(() => go(q), 180);
        }}
      />
    </form>
  );
}
