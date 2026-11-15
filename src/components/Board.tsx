"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Company } from "@/lib/ats";
import {
  countBy,
  filterRoles,
  filtersFromSearch,
  filtersHref,
  formatDate,
  groupByCompany,
  localPlaces,
  pageFromPath,
  pageHref,
  paginate,
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

const WIDE = "(min-width: 1000px)";

function subscribeWide(onChange: () => void): () => void {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Null while the server renders and during hydration, when both layouts are in the HTML. */
function useWide(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

function listKey(f: Filters, page: number): string {
  return `${filtersHref(f)}@${f.place || f.company || f.q ? 1 : page}`;
}

interface Shown {
  list: string;
  count: number;
}

/** How many pages of the list this history entry had open, so going back restores the list and its scroll. */
function savedShown(list: string): Shown {
  const saved = window.history.state?.roleList as Shown | undefined;
  return { list, count: saved?.list === list && Number.isInteger(saved.count) ? saved.count : 1 };
}

function readLocation() {
  const filters = filtersFromSearch(window.location.search);
  const firstPage = pageFromPath(window.location.pathname);
  return { filters, firstPage, shown: savedShown(listKey(filters, firstPage)) };
}

// After the first page load the list mounts on client navigations, where it can start from the URL.
let hydrated = false;

// Every role ships with the page, so search and filters run in the browser and the URL just records them.
// The list renders a page of companies at a time and adds the next as you near the end; each unfiltered
// page also has its own URL (/page/2, ...), so the "More roles" link is a real link for crawlers.
export default function Board({ roles, companies, page = 1 }: { roles: Role[]; companies: CompanyName[]; page?: number }) {
  const [initial] = useState(() => (hydrated ? readLocation() : null));
  const [filters, setFilters] = useState<Filters>(initial?.filters ?? {});
  const shownFilters = useDeferredValue(filters);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [firstPage, setFirstPage] = useState(initial?.firstPage ?? page);
  const [more, setMore] = useState<Shown>(initial?.shown ?? { list: "", count: 1 });
  const listRef = useRef<HTMLDivElement>(null);
  // Phones and desktops use different filter controls; once the browser knows which it is, drop the other.
  const wide = useWide();
  const moreRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    hydrated = true;
    const read = () => {
      const v = readLocation();
      setFilters(v.filters);
      setFirstPage(v.firstPage);
      setMore(v.shown);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const select = useCallback((next: Filters) => {
    setFilters(next);
    setFirstPage(1);
    window.history.pushState(null, "", filtersHref(next));
    window.scrollTo({ top: 0 });
  }, []);

  const search = useCallback((q: string) => {
    setFilters((f) => {
      const next = { ...f, q: q.trim() ? q : undefined };
      window.history.replaceState(null, "", filtersHref({ ...next, q: next.q?.trim() }));
      return next;
    });
    setFirstPage(1);
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
  const filtered = Boolean(active.place || active.company || active.q);
  const shown = filterRoles(roles, active);
  const groups = groupByCompany(shown);
  const pages = paginate(groups);
  const first = Math.max(1, Math.min(filtered ? 1 : firstPage, pages.length));
  const list = listKey(active, first);
  const count = more.list === list ? more.count : 1;
  const last = Math.min(first + count - 1, pages.length);
  const visible = pages.slice(first - 1, last).flat();
  const hasMore = last < pages.length;
  // On phones companies start collapsed, unless the filters already narrowed things down.
  const openAll = groups.length <= 3 || Boolean(active.company);

  const showMore = useCallback(() => {
    const next = { list, count: count + 1 };
    setMore(next);
    window.history.replaceState({ ...window.history.state, roleList: next }, "");
  }, [list, count]);

  useEffect(() => {
    const target = moreRef.current;
    if (!hasMore || !target) return;
    // On wide screens the role column scrolls on its own; on phones the window does.
    const column = listRef.current?.closest("article");
    const root = column && /auto|scroll/.test(getComputedStyle(column).overflowY) ? column : null;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && showMore(), {
      root,
      rootMargin: "0px 0px 600px 0px",
    });
    io.observe(target);
    return () => io.disconnect();
  }, [hasMore, showMore]);

  return (
    <>
      {wide !== true && (
        <MobileBar roles={roles} companies={companies} filters={active} onSelect={select} query={filters.q ?? ""} onSearch={search} />
      )}
      {wide !== false && (
        <Sidebar
          roles={roles}
          companies={companies}
          filters={active}
          onSelect={select}
          query={filters.q ?? ""}
          onSearch={search}
          hideOnMobile
        />
      )}
      <article>
        <header>
          <h2>{heading(active, companies)}</h2>
          <h3>
            {shown.length} open {shown.length === 1 ? "role" : "roles"}
            {query ? ` matching \u201c${query}\u201d` : ""}
          </h3>
        </header>
        <div className="article-body" ref={listRef}>
          {!filtered && first > 1 ? (
            <p className="more">
              <Link href={pageHref(first - 1)} prefetch={false}>
                Earlier roles
              </Link>
            </p>
          ) : null}
          {shown.length ? (
            visible.map((g) => {
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
          {hasMore ? (
            <p className="more" ref={moreRef}>
              {filtered ? (
                <button type="button" onClick={showMore}>
                  More roles
                </button>
              ) : (
                <Link
                  href={pageHref(last + 1)}
                  prefetch={false}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    showMore();
                  }}
                >
                  More roles
                </Link>
              )}
            </p>
          ) : null}
        </div>
        <Footer />
      </article>
    </>
  );
}
