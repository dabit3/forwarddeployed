import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "./ats.ts";
import { filterRoles, filtersFromSearch, filtersHref, formatDate, groupByCompany, groupRoles } from "./roles.ts";

const job = (o: Partial<Job>): Job => ({
  id: "a/1",
  title: "Forward Deployed Engineer",
  company: "Acme",
  companySlug: "acme",
  location: "London",
  places: ["London"],
  remote: false,
  team: null,
  compensation: null,
  url: "https://example.com",
  postedAt: "2026-10-01T00:00:00Z",
  ...o,
});

test("groups per-city postings into one role", () => {
  const roles = groupRoles([
    job({ id: "a/1" }),
    job({ id: "a/2", title: "Forward  Deployed Engineer ", places: ["Paris"], postedAt: "2026-10-05T00:00:00Z" }),
    job({ id: "b/1", companySlug: "beta", company: "Beta" }),
  ]);
  assert.equal(roles.length, 2);
  const acme = roles.find((r) => r.companySlug === "acme")!;
  assert.deepEqual(acme.places, ["London", "Paris"]);
  assert.ok(acme.href.startsWith("/jobs/acme/"));
  assert.ok(acme.search.includes("paris"));
  assert.equal(acme.postedAt, "2026-10-05T00:00:00Z");
});

test("filters by place, company and words", () => {
  const roles = groupRoles([
    job({ id: "a/1", title: "Staff Forward Deployed Engineer" }),
    job({ id: "b/1", companySlug: "beta", company: "Beta", places: ["Remote"], remote: true }),
  ]);
  assert.equal(filterRoles(roles, { place: "Remote" }).length, 1);
  assert.equal(filterRoles(roles, { company: "acme" }).length, 1);
  assert.equal(filterRoles(roles, { q: "staff london" }).length, 1);
  assert.equal(filterRoles(roles, { q: "beta" })[0].company, "Beta");
});

test("formats dates like the archive list", () => {
  assert.equal(formatDate("2026-10-05T12:00:00Z"), "Oct 5 2026");
  assert.equal(formatDate(null), "");
});

test("groups roles by company, companies A-Z", () => {
  const role = (companySlug: string, title: string) => ({
    key: `${companySlug}:${title}`,
    title,
    company: companySlug.toUpperCase(),
    companySlug,
    places: [],
    remote: false,
    postedAt: null,
    href: "",
    search: "",
  });
  const groups = groupByCompany([role("b", "FDE"), role("a", "FDE"), role("b", "Senior FDE")]);
  assert.deepEqual(
    groups.map((g) => [g.name, g.roles.map((r) => r.title)]),
    [
      ["A", ["FDE"]],
      ["B", ["FDE", "Senior FDE"]],
    ],
  );
});

test("round-trips filters through the URL", () => {
  const f = { place: "New York", company: "acme", q: "staff" };
  assert.deepEqual(filtersFromSearch(filtersHref(f).slice(1)), f);
  assert.equal(filtersHref({}), "/");
  assert.deepEqual(filtersFromSearch("?q=%20"), { place: undefined, company: undefined, q: undefined });
});
