"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** On the list page the parent filters as you type; elsewhere, submitting opens the list with the query. */
export default function SearchBox({ value, onSearch }: { value?: string; onSearch?: (q: string) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const current = onSearch ? (value ?? "") : draft;

  return (
    <form
      className="search"
      role="search"
      action="/"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSearch) return;
        const q = draft.trim();
        router.push(q ? `/?${new URLSearchParams({ q })}` : "/");
      }}
    >
      <input
        type="search"
        name="q"
        value={current}
        placeholder="Search"
        aria-label="Search roles"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => (onSearch ? onSearch(e.target.value) : setDraft(e.target.value))}
      />
    </form>
  );
}
