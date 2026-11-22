import { test } from "node:test";
import assert from "node:assert/strict";
import { roleListKey } from "./roles.ts";
import { roleScrollTop } from "./scroll.ts";

test("restores a history entry's article offset for the same role list", () => {
  for (const list of [roleListKey({}, 1), roleListKey({ q: "OpenAI" }, 1), roleListKey({ sort: "newest" }, 1), roleListKey({}, 1, true)]) {
    assert.equal(roleScrollTop({ roleScroll: { list, top: 5116.5 }, roleList: { list, count: 3 }, __NA: true }, list), 5116.5);
    assert.equal(roleScrollTop({ roleScroll: { list, top: 0 } }, list), 0);
    assert.equal(roleScrollTop({ roleScroll: { list, top: 5116 } }, `${list}:other`), 0);
  }
});

test("missing or malformed history offsets start at the top", () => {
  for (const state of [null, undefined, {}, { roleScroll: null }, { roleScroll: {} }]) {
    assert.equal(roleScrollTop(state, "/@1"), 0);
  }
  for (const top of [-1, NaN, Infinity, "5116", null]) {
    assert.equal(roleScrollTop({ roleScroll: { list: "/@1", top } }, "/@1"), 0);
  }
});
