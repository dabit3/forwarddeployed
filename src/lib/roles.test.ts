import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "./ats.ts";
import {
  filterRoles,
  filtersFromSearch,
  filtersHref,
  formatDate,
  groupByCompany,
  groupRoles,
  localPlaces,
  pageFromPath,
  pageHref,
  paginate,
  roleListKey,
  type CompanyGroup,
} from "./roles.ts";

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

test("localPlaces shows cities ahead of their countries", () => {
  assert.deepEqual(localPlaces(["United States", "New York", "San Francisco", "Remote"]), ["New York", "San Francisco", "Remote"]);
  assert.deepEqual(localPlaces(["Canada", "CANADA", "Mexico"]), ["Canada", "Mexico"]);
  assert.deepEqual(localPlaces(["United States", "Remote"]), ["United States", "Remote"]);
});

test("pages break between companies once a page is full", () => {
  const group = (slug: string, n: number): CompanyGroup => ({
    slug,
    name: slug,
    roles: groupRoles(Array.from({ length: n }, (_, i) => job({ id: `${slug}/${i}`, title: `FDE ${i}`, companySlug: slug, company: slug }))),
  });
  const pages = paginate([group("a", 3), group("b", 2), group("c", 4), group("d", 1)], 5);
  assert.deepEqual(
    pages.map((p) => p.map((g) => g.slug)),
    [["a", "b"], ["c", "d"]],
  );
  assert.deepEqual(paginate([], 5), []);
  assert.equal(pages.flat().reduce((n, g) => n + g.roles.length, 0), 10);
});

test("page URLs round-trip", () => {
  assert.equal(pageHref(1), "/");
  assert.equal(pageHref(3), "/page/3");
  assert.equal(pageFromPath("/page/3"), 3);
  assert.equal(pageFromPath("/"), 1);
  assert.equal(pageFromPath("/jobs/acme/1"), 1);
});

test("new-only pagination starts at page one with separate restored list state", () => {
  assert.equal(roleListKey({}, 3), "/@3");
  assert.equal(roleListKey({}, 3, true), "/@1:new");
  assert.equal(roleListKey({}, 1, true), roleListKey({}, 3, true));
  assert.notEqual(roleListKey({}, 1), roleListKey({}, 1, true));
  for (const f of [{ place: "Remote" }, { company: "acme" }, { q: "engineer" }]) {
    assert.equal(roleListKey(f, 3), `${filtersHref(f)}@1`);
    assert.equal(roleListKey(f, 3, true), `${filtersHref(f)}@1:new`);
  }
});

test("filtering new keys before pagination keeps unseen roles beyond the first page reachable", () => {
  const roles = groupRoles(Array.from({ length: 250 }, (_, i) => job({
    id: `company${i}/1`,
    company: `Company ${String(i).padStart(3, "0")}`,
    companySlug: `company${i}`,
  })));
  const pages = paginate(groupByCompany(roles));
  const newKeys = new Set([pages[0][0].roles[0].key, pages[2][0].roles[0].key]);
  const matching = filterRoles(roles, { q: "engineer" }).filter((r) => newKeys.has(r.key));
  const newPages = paginate(groupByCompany(matching));
  assert.equal(newPages.length, 1);
  assert.deepEqual(new Set(newPages.flat().flatMap((g) => g.roles.map((r) => r.key))), newKeys);
});
