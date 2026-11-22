import { test } from "node:test";
import assert from "node:assert/strict";
import { readVisit, recordVisit, VISIT_GAP_MS, VISIT_STORAGE_KEY } from "./visits.ts";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const storage = (initial: string | null = null) => {
  let value = initial;
  return {
    getItem: (key: string) => { assert.equal(key, VISIT_STORAGE_KEY); return value; },
    setItem: (key: string, next: string) => { assert.equal(key, VISIT_STORAGE_KEY); value = next; },
  };
};

test("first visit saves a baseline without marking every role new", () => {
  const store = storage();
  const result = recordVisit(store, ["acme:fde", "beta:fde"], NOW);
  assert.equal(result.previousVisitAt, null);
  assert.equal(result.newKeys.size, 0);
  assert.deepEqual(JSON.parse(store.getItem(VISIT_STORAGE_KEY)!).knownKeys, ["acme:fde", "beta:fde"]);
});

test("a return visit marks only previously unknown role keys, regardless of posting dates", () => {
  const store = storage();
  recordVisit(store, ["acme:fde"], NOW);
  const result = recordVisit(store, ["acme:fde", "beta:fde", "beta:fde"], NOW + VISIT_GAP_MS);
  assert.equal(result.previousVisitAt, NOW);
  assert.deepEqual([...result.newKeys], ["beta:fde"]);
});

test("refresh, detail-page returns, and another tab preserve highlights within a visit", () => {
  const store = storage();
  recordVisit(store, ["acme:fde"], NOW);
  const returnedAt = NOW + VISIT_GAP_MS;
  recordVisit(store, ["acme:fde", "beta:fde"], returnedAt);
  const again = recordVisit(store, ["acme:fde", "beta:fde", "gamma:fde"], returnedAt + 1000);
  assert.equal(again.previousVisitAt, NOW);
  assert.deepEqual([...again.newKeys], ["beta:fde", "gamma:fde"]);
});

test("first-visit refreshes stay first visits until the inactivity gap", () => {
  const store = storage();
  recordVisit(store, ["acme:fde"], NOW);
  assert.equal(recordVisit(store, ["acme:fde", "beta:fde"], NOW + 1000).previousVisitAt, null);
});

test("reading highlights before a restored page renders does not write or acknowledge them", () => {
  const store = storage();
  const keys = ["acme:fde", "beta:fde"];
  recordVisit(store, ["acme:fde"], NOW);
  recordVisit(store, keys, NOW + VISIT_GAP_MS);
  const before = store.getItem(VISIT_STORAGE_KEY);
  assert.deepEqual([...readVisit(store, keys, NOW + VISIT_GAP_MS + 1000).newKeys], ["beta:fde"]);
  assert.equal(store.getItem(VISIT_STORAGE_KEY), before);
  assert.deepEqual(readVisit(store, keys, NOW + VISIT_GAP_MS + 1000), recordVisit(store, keys, NOW + VISIT_GAP_MS + 1000));
});

test("the next visit acknowledges prior highlights and detects later additions", () => {
  const store = storage();
  recordVisit(store, ["acme:fde"], NOW);
  recordVisit(store, ["acme:fde", "beta:fde"], NOW + VISIT_GAP_MS);
  const result = recordVisit(store, ["acme:fde", "beta:fde", "gamma:fde"], NOW + VISIT_GAP_MS * 2);
  assert.equal(result.previousVisitAt, NOW + VISIT_GAP_MS);
  assert.deepEqual([...result.newKeys], ["gamma:fde"]);
});

test("missing roles or temporary board failures do not make old roles new later", () => {
  const store = storage();
  recordVisit(store, ["acme:fde", "beta:fde"], NOW);
  recordVisit(store, ["acme:fde"], NOW + VISIT_GAP_MS);
  assert.equal(recordVisit(store, ["acme:fde", "beta:fde"], NOW + VISIT_GAP_MS * 2).newKeys.size, 0);
});

test("unchanged keys stay known when dates, locations, or posting URLs change", () => {
  const store = storage();
  recordVisit(store, ["acme:fde"], NOW);
  assert.equal(recordVisit(store, ["acme:fde"], NOW + VISIT_GAP_MS).newKeys.size, 0);
});

test("cleared, corrupt, future, or incompatible storage starts a fresh baseline", () => {
  for (const raw of [
    null, "broken", "[]", "{}", "null",
    JSON.stringify({ version: 2, visitedAt: NOW, knownKeys: [], baselineAt: null, baselineKeys: [] }),
    JSON.stringify({ version: 1, visitedAt: NOW + 1, knownKeys: [], baselineAt: null, baselineKeys: [] }),
    JSON.stringify({ version: 1, visitedAt: NOW, knownKeys: [5], baselineAt: null, baselineKeys: [] }),
    JSON.stringify({ version: 1, visitedAt: NOW, knownKeys: [], baselineAt: "Tuesday", baselineKeys: [] }),
  ]) {
    const result = recordVisit(storage(raw), ["acme:fde"], NOW);
    assert.equal(result.previousVisitAt, null);
    assert.equal(result.newKeys.size, 0);
  }
});

test("storage read and quota failures can be handled without claiming a saved visit", () => {
  assert.throws(() => recordVisit({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }, [], NOW), /blocked/);
  assert.throws(() => recordVisit({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, [], NOW), /quota/);
});
