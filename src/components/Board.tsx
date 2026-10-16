"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import type { Company } from "@/lib/ats";
import {
  countBy,
  filterRoles,
  filtersFromSearch,
  filtersHref,
  formatDate,
  groupByCompany,
  localPlaces,
  summarizePlaces,
  type Filters,
  type Role,
} from "@/lib/roles";
import FilterLink from "./FilterLink";
import Footer from "./Footer";
import MobileBar from "./MobileBar";
import Sidebar from "./Sidebar";

type CompanyName = Pick<Company, "slug" | "name">;

function heading(f: Filters, companies: CompanyName[]): string {
  const company = f.company ? companies.find((c) => c.slug === f.company)?.name : undefined;
  let h = "Forward Deployed Engineers";
  if (company) h += ` at ${company}`;
  if (f.place === "Remote") h = `Remote ${h}`;
  else if (f.place) h += ` in ${f.place}`;
  return h;
}

// Every role ships with the page, so search and filters run in the browser and the URL just records them.
export default function Board({ roles, companies }: { roles: Role[]; companies: CompanyName[] }) {
  const [filters, setFilters] = useState<Filters>({});
  const shownFilters = useDeferredValue(filters);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const read = () => setFilters(filtersFromSearch(window.location.search));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const select = useCallback((next: Filters) => {
    setFilters(next);
    window.history.pushState(null, "", filtersHref(next));
    window.scrollTo({ top: 0 });
  }, []);

  const search = useCallback((q: string) => {
    setFilters((f) => {
      const next = { ...f, q: q.trim() ? q : undefined };
      window.history.replaceState(null, "", filtersHref({ ...next, q: next.q?.trim() }));
      return next;
    });
  }, []);

  const toggle = useCallback((slug: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });
  }, []);

  const query = shownFilters.q?.trim();
  const active = { ...shownFilters, q: query };
  const shown = filterRoles(roles, active);
  const groups = groupByCompany(shown);
  // On phones companies start collapsed, unless the filters already narrowed things down.
  const openAll = groups.length <= 3 || Boolean(active.company);

  return (
    <>
      <MobileBar roles={roles} companies={companies} filters={active} onSelect={select} query={filters.q ?? ""} onSearch={search} />
      <Sidebar
        roles={roles}
        companies={companies}
        filters={active}
        onSelect={select}
        query={filters.q ?? ""}
        onSearch={search}
        hideOnMobile
      />
      <article>
        <header>
          <h2>{heading(active, companies)}</h2>
          <h3>
            {shown.length} open {shown.length === 1 ? "role" : "roles"}
            {query ? ` matching \u201c${query}\u201d` : ""}
          </h3>
        </header>
        <div className="article-body">
          {shown.length ? (
            groups.map((g) => {
              const expanded = openAll || open.has(g.slug);
              return (
                <section key={g.slug} className={expanded ? "company" : "company collapsed"}>
                  <h4>
                    <FilterLink to={{ ...active, company: g.slug }} onSelect={select} className="desktop-only">
                      {g.name}
                    </FilterLink>
                    <small className="desktop-only">{g.roles.length}</small>
                    <button type="button" className="toggle" aria-expanded={expanded} onClick={() => toggle(g.slug)}>
                      <span>
                        {g.name}
                        <span className="meta">{summarizePlaces(localPlaces(countBy(g.roles, (r) => r.places).map(([p]) => p)))}</span>
                      </span>
                      <small>
                        {g.roles.length} {expanded ? "\u2212" : "+"}
                      </small>
                    </button>
                  </h4>
                  <ul className="roles">
                    {g.roles.map((r) => (
                      <li key={r.key}>
                        <Link href={r.href}>
                          <span>
                            {r.title}
                            {r.places.length ? <span className="meta">{summarizePlaces(r.places)}</span> : null}
                          </span>
                          <span className="time">{formatDate(r.postedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          ) : (
            <p className="empty">
              No roles match.{" "}
              <FilterLink to={{}} onSelect={select}>
                Clear filters
              </FilterLink>
            </p>
          )}
        </div>
        <Footer />
      </article>
    </>
  );
}
