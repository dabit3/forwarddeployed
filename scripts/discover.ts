// Finds companies hiring forward deployed engineers (or the same role under another name) with xAI web search,
// verifies each board against its public ATS API, and adds new ones to data/companies.json.
import { readFile, writeFile } from "node:fs/promises";
import { fetchBoard, type Company } from "../src/lib/ats.ts";
import { discoveryCandidates, type Found } from "../src/lib/discovery.ts";
import { findFailingBoards, formatFailures } from "../src/lib/health.ts";

const FILE = new URL("../data/companies.json", import.meta.url);
const FAILING_FILE = new URL("../data/failing-boards.json", import.meta.url);
const MODEL = process.env.XAI_SEARCH_MODEL ?? "grok-4.20-non-reasoning";

const ANGLES = [
  "AI labs and foundation model companies",
  "AI application startups (agents, copilots, vertical AI)",
  "defense, government and national security technology",
  "fintech, banking and insurance software",
  "healthcare and life sciences software",
  "developer tools, data infrastructure and cloud",
  "companies based in Europe and the UK",
  "companies based in Asia-Pacific, India and the Middle East",
  "seed and Series A startups hiring their first forward deployed engineers",
  "enterprise SaaS and later-stage companies",
];

const TITLES = [
  "Deployed Engineer",
  "Applied AI Engineer",
  "Delta Engineer",
  "Forward Deployed AI Engineer",
  "Forward Deployed ML Engineer",
  "Forward Deployed Research Engineer",
  "AI Deployment Engineer",
  "AI Implementation Engineer",
  "AI Integration Engineer",
  "Applied AI Architect",
  "Applied AI Specialist",
  "AI Field Engineer",
  "Embedded AI Engineer",
  "Customer AI Engineer",
  "Agent Deployment Engineer",
  "customer-facing Applied Research Engineer",
  "Deployment Strategist",
];

const QUERIES = [
  ...ANGLES.map((angle) => `Forward Deployed Engineer job postings at ${angle}`),
  ...TITLES.map((title) => `"${title}" job postings at any company`),
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["postings"],
  properties: {
    postings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "url"],
        properties: { company: { type: "string" }, url: { type: "string" } },
      },
    },
  },
};

async function search(query: string, known: string[]): Promise<Found[]> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");
  const prompt = [
    `Search the web for open ${query}.`,
    "Only include postings hosted on jobs.ashbyhq.com, job-boards.greenhouse.io, boards.greenhouse.io or jobs.lever.co.",
    "Return up to 30 postings, one per company, with the exact posting URL. Skip venture capital portfolio job boards.",
    `Skip these companies, which are already known: ${known.join(", ")}.`,
  ].join("\n");
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_schema", name: "postings", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`xAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { output: { type: string; content?: { type: string; text?: string }[] }[] };
  const text = body.output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .map((c) => c.text ?? "")
    .join("");
  return (parseFirstJson(text) as { postings: Found[] }).postings;
}

// The model sometimes appends a second copy after the JSON; keep the first value.
function parseFirstJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    const at = /after JSON at position (\d+)/.exec(String(err))?.[1];
    if (!at) throw err;
    return JSON.parse(text.slice(0, Number(at)));
  }
}

const existing = JSON.parse(await readFile(FILE, "utf8")) as Company[];
const knownNames = existing.map((c) => c.name);

// Moved or deleted boards fail silently on the site, so report them on every refresh.
const failing = await findFailingBoards(existing);
console.log(formatFailures(failing, existing.length));
await writeFile(FAILING_FILE, `${JSON.stringify(failing, null, 2)}\n`);

const results = await Promise.allSettled(QUERIES.map((q) => search(q, knownNames)));
const postings = results.flatMap((r, i) => {
  if (r.status === "fulfilled") return r.value;
  console.warn(`search "${QUERIES[i]}" failed: ${r.reason}`);
  return [];
});
const candidates = discoveryCandidates(postings, existing);
console.log(`${candidates.length} new boards to verify`);

const added: Company[] = [];
await Promise.all(
  candidates.map(async (c) => {
    try {
      const jobs = await fetchBoard(c);
      if (jobs.length) {
        added.push(c);
        console.log(`+ ${c.name} (${c.ats}/${c.slug}): ${jobs.length} roles`);
      }
    } catch {
      // Not a live public board.
    }
  }),
);

if (added.length) {
  const merged = [...existing, ...added].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  await writeFile(FILE, `${JSON.stringify(merged, null, 2)}\n`);
}
console.log(`added ${added.length} companies (${existing.length + added.length} total); ${failing.length} failing boards`);
