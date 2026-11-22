import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("./[company]/[id]/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const params = Promise.resolve({ company: "acme", id: "123" });
const detail = {
  job: { title: "Forward Deployed Engineer", company: "Acme", places: [], location: "", remote: false },
  html: "",
  siblings: [],
};

function loadPage(getPosting: () => Promise<unknown>) {
  const notFoundError = new Error("NEXT_NOT_FOUND");
  let notFoundCalls = 0;
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(compiled, {
    exports,
    require(id: string) {
      if (id === "react/jsx-runtime") return require(id);
      if (id === "next/navigation") return { notFound() { notFoundCalls++; throw notFoundError; } };
      if (id === "@/lib/jobs") return { getPosting, getRoles: async () => [], companies: [] };
      if (id === "@/lib/roles") return { formatDate: () => "", postingHref: () => "/" };
      if (["next/link", "@/components/Sidebar", "@/components/Footer"].includes(id)) return { default: () => null };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return { page: exports.default, metadata: exports.generateMetadata, notFoundError, notFoundCalls: () => notFoundCalls };
}

test("job page propagates board errors instead of rendering notFound", async () => {
  const error = new Error("503 ATS unavailable");
  const route = loadPage(async () => { throw error; });
  await assert.rejects(route.page({ params }), (actual) => actual === error);
  assert.equal(route.notFoundCalls(), 0);
});

test("job metadata propagates board errors instead of returning a generic title", async () => {
  const error = new Error("ATS timeout");
  const route = loadPage(async () => { throw error; });
  await assert.rejects(route.metadata({ params }), (actual) => actual === error);
  assert.equal(route.notFoundCalls(), 0);
});

test("job page renders notFound for an absent job or unknown company", async () => {
  const route = loadPage(async () => null);
  await assert.rejects(route.page({ params }), (actual) => actual === route.notFoundError);
  assert.equal(route.notFoundCalls(), 1);
});

test("job page and metadata render a successfully fetched posting", async () => {
  const route = loadPage(async () => detail);
  assert.ok(await route.page({ params }));
  const metadata = await route.metadata({ params }) as { title: string };
  assert.equal(metadata.title, "Forward Deployed Engineer at Acme · Forward Deployed");
  assert.equal(route.notFoundCalls(), 0);
});

test("metadata keeps the generic title for a genuinely absent posting", async () => {
  const route = loadPage(async () => null);
  const metadata = await route.metadata({ params }) as { title: string };
  assert.equal(metadata.title, "Forward Deployed");
});
