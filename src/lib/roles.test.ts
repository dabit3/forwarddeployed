import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "./ats.ts";
import {
  chunk,
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
  rolePlaces,
  sortByPosted,
  summarizePlaces,
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
    job({ id: "acme/1" }),
    job({ id: "acme/2", title: "Forward  Deployed Engineer ", places: ["Paris"], postedAt: "2026-10-05T00:00:00Z" }),
    job({ id: "b/1", companySlug: "beta", company: "Beta" }),
  ]);
  assert.equal(roles.length, 2);
  const acme = roles.find((r) => r.companySlug === "acme")!;
  assert.deepEqual(acme.places, ["London", "Paris"]);
  assert.equal(acme.href, "/jobs/acme/2");
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

test("narrows grouped locations and links to the newest matching posting", () => {
  const roles = groupRoles([
    job({ id: "acme/8899736002", location: "Munich, Germany", places: ["Munich", "Germany"], postedAt: "2026-10-15T00:00:00Z" }),
    job({ id: "acme/8503068002", location: "Remote - India", places: ["Remote", "India"], remote: true }),
    job({ id: "acme/3", location: "Bangalore, India", places: ["Bengaluru", "India"], postedAt: "2026-10-07T00:00:00Z" }),
  ]);
  for (const filters of [{ place: "India" }, { q: "India" }, { q: "engineer INDIA", place: "India" }]) {
    const [role] = filterRoles(roles, filters);
    assert.deepEqual(role.places, ["Remote", "India", "Bengaluru"]);
    assert.equal(role.href, "/jobs/acme/3");
    assert.equal(role.postedAt, "2026-10-07T00:00:00Z");
    assert.equal(role.remote, true);
    assert.equal(role.postings.length, 2);
  }
  for (const filters of [{}, { q: "deploy" }, { q: "acm" }, { q: "   " }]) {
    assert.deepEqual(filterRoles(roles, filters), roles);
  }
  assert.deepEqual(filterRoles(roles, { place: "Germany", q: "India" }), []);
  assert.deepEqual(filterRoles(roles, { q: "Munich Bangalore" }), []);
  assert.deepEqual(filterRoles(roles, { q: "unknown" }), []);
  assert.deepEqual(filterRoles([], { q: "India" }), []);
  assert.deepEqual(roles[0].places, ["Munich", "Germany", "Remote", "India", "Bengaluru"]);
});

test("matches whole location words and normalized places, but title and company substrings", () => {
  const roles = groupRoles([
    job({ id: "acme/1", location: "Indiana", places: ["Indiana", "United States"] }),
    job({ id: "acme/2", location: "Bangalore, India", places: ["Bengaluru", "India"] }),
  ]);
  assert.equal(filterRoles(roles, { q: "india" })[0].href, "/jobs/acme/2");
  assert.equal(filterRoles(roles, { q: "Bengaluru" })[0].href, "/jobs/acme/2");
  assert.equal(filterRoles(roles, { q: "Indiana" })[0].href, "/jobs/acme/1");
  assert.deepEqual(filterRoles(roles, { q: "Bangal" }), []);
  assert.deepEqual(filterRoles(groupRoles([job({ location: "Indiana", places: ["Indiana"] })]), { q: "India" }), []);
  const titleMatch = groupRoles([job({ title: "Indiana Engineer" })]);
  assert.deepEqual(filterRoles(titleMatch, { q: "India" }), titleMatch);
  const companyMatch = groupRoles([job({ company: "Indiana AI" })]);
  assert.deepEqual(filterRoles(companyMatch, { q: "India" }), companyMatch);
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
    postings: [],
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

test("rolePlaces omits derived countries while keeping standalone country postings", () => {
  const [threeCities] = groupRoles([
    job({ id: "acme/1", location: "Munich, Germany", places: ["Munich", "Germany"] }),
    job({ id: "acme/2", location: "London, UK", places: ["London", "United Kingdom"] }),
    job({ id: "acme/3", location: "Paris, France", places: ["Paris", "France"] }),
  ]);
  assert.deepEqual(rolePlaces(threeCities), ["Munich", "London", "Paris"]);
  assert.equal(summarizePlaces(rolePlaces(threeCities)), "Munich, London, Paris");

  const [mixed] = groupRoles([
    job({ id: "acme/1", location: "Cambridge, MA", places: ["Cambridge", "United States"] }),
    job({ id: "acme/2", location: "India", places: ["India"] }),
    job({ id: "acme/3", location: "London, UK", places: ["London", "United Kingdom"] }),
    job({ id: "acme/4", location: "Remote", places: ["Remote"], remote: true }),
  ]);
  assert.deepEqual(rolePlaces(mixed), ["Cambridge", "India", "London", "Remote"]);
  assert.equal(summarizePlaces(rolePlaces(mixed)), "Cambridge, India, London +1");

  const [countryRemote] = groupRoles([
    job({ id: "acme/1", location: "Remote - United States", places: ["Remote", "United States"], remote: true }),
  ]);
  assert.deepEqual(rolePlaces(countryRemote), ["Remote", "United States"]);

  const [commaRemote] = groupRoles([
    job({ id: "acme/1", location: "Remote, United States", places: ["Remote", "United States"], remote: true }),
  ]);
  assert.deepEqual(rolePlaces(commaRemote), ["Remote", "United States"]);

  const [codedRemote] = groupRoles([
    job({ id: "acme/1", location: "US-Remote", places: ["Remote", "United States"], remote: true }),
  ]);
  assert.deepEqual(rolePlaces(codedRemote), ["Remote", "United States"]);

  const [mixedSinglePosting] = groupRoles([
    job({
      id: "acme/1",
      location: "London, UK; Remote - India",
      places: ["London", "United Kingdom", "Remote", "India"],
      remote: true,
    }),
  ]);
  assert.deepEqual(rolePlaces(mixedSinglePosting), ["London", "Remote", "India"]);

  const [europeCountries] = groupRoles([
    job({
      id: "acme/1",
      location: "Belgium; Germany; Netherlands; United Kingdom",
      places: ["Belgium", "Germany", "Netherlands", "Remote", "United Kingdom"],
      remote: true,
    }),
  ]);
  assert.deepEqual(rolePlaces(europeCountries), ["Belgium", "Germany", "Netherlands", "Remote", "United Kingdom"]);
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

test("sorts roles by posting date, newest first and undated last", () => {
  const roles = groupRoles([
    job({ id: "a/1", title: "A", postedAt: "2026-10-01T00:00:00Z" }),
    job({ id: "b/1", title: "B", companySlug: "beta", company: "Beta", postedAt: null }),
    job({ id: "c/1", title: "C", companySlug: "gamma", company: "Gamma", postedAt: "2026-11-01T00:00:00Z" }),
  ]);
  assert.deepEqual(sortByPosted([...roles].reverse()).map((r) => r.title), ["C", "A", "B"]);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test("keeps the date sort in the URL", () => {
  assert.equal(filtersHref({ place: "Remote", sort: "newest" }), "/?place=Remote&sort=newest");
  assert.equal(filtersFromSearch("?sort=newest").sort, "newest");
  assert.equal(filtersFromSearch("?sort=bogus").sort, undefined);
});

test("new-only pagination starts at page one with separate restored list state", () => {
  assert.equal(roleListKey({}, 3), "/@3");
  assert.equal(roleListKey({}, 3, true), "/@1:new");
  assert.equal(roleListKey({}, 1, true), roleListKey({}, 3, true));
  assert.notEqual(roleListKey({}, 1), roleListKey({}, 1, true));
  for (const f of [{ place: "Remote" }, { company: "acme" }, { q: "engineer" }, { sort: "newest" as const }]) {
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
