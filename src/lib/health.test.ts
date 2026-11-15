import { test } from "node:test";
import assert from "node:assert/strict";
import type { Company } from "./ats.ts";
import { findFailingBoards, formatFailures } from "./health.ts";

const companies: Company[] = [
  { ats: "ashby", slug: "zeta", name: "Zeta" },
  { ats: "greenhouse", slug: "acme", name: "Acme" },
  { ats: "lever", slug: "ok", name: "Okay" },
  { ats: "ashby", slug: "flaky", name: "flaky" },
];

const fetchStub = async (c: Company) => {
  if (c.slug === "ok") return [];
  if (c.slug === "flaky") throw "timeout";
  throw new Error(`404 https://example.com/${c.slug}`);
};

test("reports every board that fails, sorted by name", async () => {
  const failures = await findFailingBoards(companies, fetchStub, { concurrency: 2 });
  assert.deepEqual(failures, [
    { ats: "greenhouse", slug: "acme", name: "Acme", error: "404 https://example.com/acme" },
    { ats: "ashby", slug: "flaky", name: "flaky", error: "timeout" },
    { ats: "ashby", slug: "zeta", name: "Zeta", error: "404 https://example.com/zeta" },
  ]);
});

test("retries a board before reporting it", async () => {
  const calls = new Map<string, number>();
  const failsOnce = async (c: Company) => {
    const n = (calls.get(c.slug) ?? 0) + 1;
    calls.set(c.slug, n);
    if (n === 1) throw new Error("500");
  };
  assert.deepEqual(await findFailingBoards(companies, failsOnce), []);
  assert.equal(calls.get("acme"), 2);
  assert.equal(calls.get("ok"), 2);
  assert.deepEqual(
    (await findFailingBoards(companies, fetchStub, { attempts: 1 })).map((f) => f.slug),
    ["acme", "flaky", "zeta"],
  );
});

test("reports nothing when every board responds", async () => {
  assert.deepEqual(await findFailingBoards(companies, async () => []), []);
  assert.deepEqual(await findFailingBoards([], fetchStub), []);
});

test("formats failures as a visible log block", () => {
  assert.equal(formatFailures([], 481), "all 481 boards responded");
  assert.equal(
    formatFailures([{ ats: "ashby", slug: "zeta", name: "Zeta", error: "404 https://example.com/zeta" }], 481),
    [
      "FAILING BOARDS: 1 of 481 boards failed; fix or remove them in data/companies.json",
      "! Zeta (ashby/zeta): 404 https://example.com/zeta",
    ].join("\n"),
  );
});
