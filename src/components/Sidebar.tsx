import Link from "next/link";
import { Suspense } from "react";
import type { Company } from "@/lib/ats";
import { countBy, filterRoles, type Filters, type Role } from "@/lib/roles";
import SearchBox from "./SearchBox";

const MAX_PLACES = 10;

function href(f: Filters): string {
  const p = new URLSearchParams();
  if (f.place) p.set("place", f.place);
  if (f.company) p.set("company", f.company);
  if (f.q) p.set("q", f.q);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function Sidebar({ roles, companies, filters }: { roles: Role[]; companies: Company[]; filters: Filters }) {
  const forPlaces = filterRoles(roles, { ...filters, place: undefined });
  const forCompanies = filterRoles(roles, { ...filters, company: undefined });
  const places = countBy(forPlaces, (r) => r.places);
  const remote = places.find(([p]) => p === "Remote");
  const cities = places.filter(([p]) => p !== "Remote").slice(0, MAX_PLACES);
  if (filters.place && filters.place !== "Remote" && !cities.some(([p]) => p === filters.place)) {
    cities.push([filters.place, places.find(([p]) => p === filters.place)?.[1] ?? 0]);
  }
  const companyCounts = new Map(countBy(forCompanies, (r) => [r.companySlug]));
  const names = new Map(companies.map((c) => [c.slug, c.name]));
  const companyList = [...companyCounts.keys()].sort((a, b) =>
    (names.get(a) ?? a).toLowerCase().localeCompare((names.get(b) ?? b).toLowerCase()),
  );
  const companyCount = new Set(forPlaces.map((r) => r.companySlug)).size;

  return (
    <header className="side">
      <div>
        <Link href="/" className="item">
          <h1>
            <span>Forward Deployed</span>
            Engineering roles, nothing else
          </h1>
        </Link>
        <Suspense>
          <SearchBox />
        </Suspense>
        <nav className="places" aria-label="Places">
          <Link href={href({ ...filters, place: undefined })} className="item" aria-current={!filters.place || undefined}>
            <span>Everywhere</span>
            <small>
              {plural(forPlaces.length, "role")} at {plural(companyCount, "company").replace("companys", "companies")}
            </small>
          </Link>
          {remote && (
            <Link
              href={href({ ...filters, place: "Remote" })}
              className="item"
              aria-current={filters.place === "Remote" || undefined}
            >
              <span>Remote</span>
              <small>{plural(remote[1], "role")}</small>
            </Link>
          )}
          {cities.map(([place, n]) => (
            <Link
              key={place}
              href={href({ ...filters, place })}
              className="item"
              aria-current={filters.place === place || undefined}
            >
              <span>{place}</span>
              <small>{plural(n, "role")}</small>
            </Link>
          ))}
        </nav>
        <p className="note">
          Every forward deployed engineering opening from {companies.length} company job boards, refreshed hourly.
        </p>
      </div>
      <nav className="companies" aria-label="Companies">
        <div className="label">Companies</div>
        <ul className="lines">
          <li>
            <Link
              href={href({ ...filters, company: undefined })}
              className="line"
              aria-current={!filters.company || undefined}
            >
              <span>All companies</span>
            </Link>
          </li>
          {companyList.map((slug) => (
            <li key={slug}>
              <Link
                href={href({ ...filters, company: slug })}
                className="line"
                aria-current={filters.company === slug || undefined}
              >
                <span>{names.get(slug) ?? slug}</span>
                <small>{companyCounts.get(slug)}</small>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
