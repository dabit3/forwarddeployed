import type { Company } from "@/lib/ats";
import { countBy, filterRoles, type Filters, type Role } from "@/lib/roles";
import FilterLink from "./FilterLink";
import SearchBox from "./SearchBox";

const MAX_PLACES = 10;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function Sidebar({
  roles,
  companies,
  filters,
  onSelect,
  query,
  onSearch,
}: {
  roles: Role[];
  companies: Pick<Company, "slug" | "name">[];
  filters: Filters;
  onSelect?: (f: Filters) => void;
  query?: string;
  onSearch?: (q: string) => void;
}) {
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
        <FilterLink to={{}} onSelect={onSelect} className="item">
          <h1>
            <span>Forward Deployed</span>
            Engineering roles, nothing else
          </h1>
        </FilterLink>
        <SearchBox value={query} onSearch={onSearch} />
        <nav className="places" aria-label="Places">
          <FilterLink to={{ ...filters, place: undefined }} onSelect={onSelect} className="item" current={!filters.place}>
            <span>Everywhere</span>
            <small>
              {plural(forPlaces.length, "role")} at {plural(companyCount, "company").replace("companys", "companies")}
            </small>
          </FilterLink>
          {remote && (
            <FilterLink to={{ ...filters, place: "Remote" }} onSelect={onSelect} className="item" current={filters.place === "Remote"}>
              <span>Remote</span>
              <small>{plural(remote[1], "role")}</small>
            </FilterLink>
          )}
          {cities.map(([place, n]) => (
            <FilterLink key={place} to={{ ...filters, place }} onSelect={onSelect} className="item" current={filters.place === place}>
              <span>{place}</span>
              <small>{plural(n, "role")}</small>
            </FilterLink>
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
            <FilterLink to={{ ...filters, company: undefined }} onSelect={onSelect} className="line" current={!filters.company}>
              <span>All companies</span>
            </FilterLink>
          </li>
          {companyList.map((slug) => (
            <li key={slug}>
              <FilterLink to={{ ...filters, company: slug }} onSelect={onSelect} className="line" current={filters.company === slug}>
                <span>{names.get(slug) ?? slug}</span>
                <small>{companyCounts.get(slug)}</small>
              </FilterLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
