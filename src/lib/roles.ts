import type { Job } from "./ats.ts";

export interface Role {
  key: string;
  title: string;
  company: string;
  companySlug: string;
  places: string[];
  remote: boolean;
  postedAt: string | null;
  /** Detail page of the first posting. */
  href: string;
  /** Lowercased text that search matches against. */
  search: string;
}

export interface Filters {
  place?: string;
  company?: string;
  q?: string;
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function newest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Companies often post one listing per city; fold those into a single role. */
export function groupRoles(jobs: Job[]): Role[] {
  const roles = new Map<string, Role & { text: string[] }>();
  for (const job of jobs) {
    const key = `${job.companySlug}:${titleKey(job.title)}`;
    const text = `${job.location} ${job.team ?? ""}`;
    const role = roles.get(key);
    if (!role) {
      roles.set(key, {
        key,
        title: job.title,
        company: job.company,
        companySlug: job.companySlug,
        places: [...job.places],
        remote: job.remote,
        postedAt: job.postedAt,
        href: postingHref(job),
        search: "",
        text: [text],
      });
      continue;
    }
    role.text.push(text);
    role.remote ||= job.remote;
    role.postedAt = newest(role.postedAt, job.postedAt);
    for (const p of job.places) if (!role.places.includes(p)) role.places.push(p);
  }
  return [...roles.values()]
    .map(({ text, ...r }) => ({ ...r, search: `${r.title} ${r.company} ${r.places.join(" ")} ${text.join(" ")}`.toLowerCase() }))
    .sort(
      (a, b) =>
        (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0) || a.title.localeCompare(b.title),
    );
}

export function filterRoles(roles: Role[], f: Filters): Role[] {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return roles.filter((r) => {
    if (f.company && r.companySlug !== f.company) return false;
    if (f.place && !r.places.includes(f.place)) return false;
    return words.every((w) => r.search.includes(w));
  });
}

export function filtersHref(f: Filters): string {
  const p = new URLSearchParams();
  if (f.place) p.set("place", f.place);
  if (f.company) p.set("company", f.company);
  if (f.q) p.set("q", f.q);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  const one = (k: string) => p.get(k)?.trim() || undefined;
  return { place: one("place"), company: one("company"), q: one("q") };
}

export function countBy(roles: Role[], keys: (r: Role) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of roles) for (const k of keys(r)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
}

export function summarizePlaces(places: string[], max = 3): string {
  const shown = places.slice(0, max).join(", ");
  return places.length > max ? `${shown} +${places.length - max}` : shown;
}

export function postingHref(p: { companySlug: string; id: string }): string {
  const jobId = p.id.slice(p.companySlug.length + 1);
  return `/jobs/${encodeURIComponent(p.companySlug)}/${encodeURIComponent(jobId)}`;
}

export interface CompanyGroup {
  slug: string;
  name: string;
  roles: Role[];
}

// Companies sorted A–Z; roles keep their input (newest-first) order.
export function groupByCompany(roles: Role[]): CompanyGroup[] {
  const groups = new Map<string, CompanyGroup>();
  for (const r of roles) {
    let g = groups.get(r.companySlug);
    if (!g) groups.set(r.companySlug, (g = { slug: r.companySlug, name: r.company, roles: [] }));
    g.roles.push(r);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
