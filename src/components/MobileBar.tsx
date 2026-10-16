"use client";

import type { Company } from "@/lib/ats";
import { countBy, filterRoles, type Filters, type Role } from "@/lib/roles";
import FilterLink from "./FilterLink";
import SearchBox from "./SearchBox";

/** Phone layout: search and two dropdowns pinned to the top instead of the long place and company lists. */
export default function MobileBar({
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
  onSelect: (f: Filters) => void;
  query: string;
  onSearch: (q: string) => void;
}) {
  const places = countBy(filterRoles(roles, { ...filters, place: undefined }), (r) => r.places);
  if (filters.place && !places.some(([p]) => p === filters.place)) places.push([filters.place, 0]);

  const names = new Map(companies.map((c) => [c.slug, c.name]));
  const companyCounts = countBy(filterRoles(roles, { ...filters, company: undefined }), (r) => [r.companySlug]);
  if (filters.company && !companyCounts.some(([s]) => s === filters.company)) companyCounts.push([filters.company, 0]);
  const companyList = companyCounts
    .map(([slug, n]) => ({ slug, n, name: names.get(slug) ?? slug }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  return (
    <>
      <div className="mobile-head">
        <FilterLink to={{}} onSelect={onSelect}>
          <h1>
            <span>Forward Deployed</span>
            Engineering roles, nothing else
          </h1>
        </FilterLink>
      </div>
      <div className="mobile-bar">
        <SearchBox value={query} onSearch={onSearch} />
        <div className="pickers">
          <select
            aria-label="Place"
            value={filters.place ?? ""}
            onChange={(e) => onSelect({ ...filters, place: e.target.value || undefined })}
          >
            <option value="">Everywhere</option>
            {places.map(([place, n]) => (
              <option key={place} value={place}>
                {place} ({n})
              </option>
            ))}
          </select>
          <select
            aria-label="Company"
            value={filters.company ?? ""}
            onChange={(e) => onSelect({ ...filters, company: e.target.value || undefined })}
          >
            <option value="">All companies</option>
            {companyList.map(({ slug, n, name }) => (
              <option key={slug} value={slug}>
                {name} ({n})
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
