import { test } from "node:test";
import assert from "node:assert/strict";
import { roleListKey } from "./roles.ts";
import { debounceScrollSave, roleScrollTop } from "./scroll.ts";

test("restores a history entry's article offset for the same role list", () => {
  for (const list of [roleListKey({}, 1), roleListKey({ q: "OpenAI" }, 1), roleListKey({ sort: "newest" }, 1), roleListKey({}, 1, true)]) {
    assert.equal(roleScrollTop({ roleScroll: { list, top: 5116.5 }, roleList: { list, count: 3 }, __NA: true }, list), 5116.5);
    assert.equal(roleScrollTop({ roleScroll: { list, top: 0 } }, list), 0);
    assert.equal(roleScrollTop({ roleScroll: { list, top: 5116 } }, `${list}:other`), 0);
  }
});

test("scroll saves trail a burst of events by 150ms", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let saves = 0;
  const saver = debounceScrollSave(() => saves++);
  for (let i = 0; i < 100; i++) {
    saver.schedule();
    t.mock.timers.tick(10);
  }
  assert.equal(saves, 0);
  t.mock.timers.tick(139);
  assert.equal(saves, 0);
  t.mock.timers.tick(1);
  assert.equal(saves, 1);
});

test("navigation flushes the latest offset synchronously without a later duplicate", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let top = 100;
  const saved: number[] = [];
  const saver = debounceScrollSave(() => saved.push(top));
  saver.schedule();
  t.mock.timers.tick(50);
  top = 5116;
  saver.flush();
  assert.deepEqual(saved, [5116]);
  t.mock.timers.tick(150);
  assert.deepEqual(saved, [5116]);
  top = 5200;
  saver.flush();
  assert.deepEqual(saved, [5116, 5200]);
});

test("cleanup cancels pending saves and an idle saver does not write", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let saves = 0;
  const saver = debounceScrollSave(() => saves++);
  t.mock.timers.tick(200);
  assert.equal(saves, 0);
  saver.schedule();
  saver.cancel();
  t.mock.timers.tick(200);
  assert.equal(saves, 0);
});

test("missing or malformed history offsets start at the top", () => {
  for (const state of [null, undefined, {}, { roleScroll: null }, { roleScroll: {} }]) {
    assert.equal(roleScrollTop(state, "/@1"), 0);
  }
  for (const top of [-1, NaN, Infinity, "5116", null]) {
    assert.equal(roleScrollTop({ roleScroll: { list: "/@1", top } }, "/@1"), 0);
  }
});
