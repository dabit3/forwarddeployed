export type Ats = "greenhouse" | "lever" | "ashby";

export interface Company {
  slug: string;
  ats: Ats;
  name: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  places: string[];
  remote: boolean;
  team: string | null;
  compensation: string | null;
  url: string;
  postedAt: string | null;
  descriptionHtml?: string;
}

const FORWARD_DEPLOYED = /forward[\s-]*deploy|\bFDEs?\b/i;
const ENGINEERING = /engineer|engineering|\bFDEs?\b|developer|builder|software|technical staff/i;
const NOT_ENGINEERING =
  /strategist|account (executive|manager)|recruit|talent|sales|marketing|(product|program|project|engagement|delivery|partner|partnerships) manager|customer success|designer|operations|\bops\b/i;

export function isForwardDeployedEngineer(title: string): boolean {
  return FORWARD_DEPLOYED.test(title) && ENGINEERING.test(title) && !NOT_ENGINEERING.test(title);
}

const PLACE_ALIASES: [RegExp, string][] = [
  [/^(sf|san francisco.*|bay area|sf bay area|palo alto|mountain view|menlo park|south san francisco)$/i, "San Francisco"],
  [/^(nyc|new york.*|ny|brooklyn|manhattan)$/i, "New York"],
  [/^(washington|washington,? d\.?c\.?|dc|d\.c\.|washington dc.*|arlington|virginia|maryland|reston|mclean)$/i, "Washington, DC"],
  [/^(london.*)$/i, "London"],
  [/^(seattle.*|bellevue)$/i, "Seattle"],
  [/^(los angeles.*|la|el segundo|santa monica|costa mesa|irvine)$/i, "Los Angeles"],
  [/^(bengaluru|bangalore)$/i, "Bengaluru"],
  [/^(remote.*|anywhere)$/i, "Remote"],
];

export function normalizePlace(raw: string): string | null {
  const cleaned = raw.replace(/\(.*?\)/g, "").replace(/^[A-Z]{2}-[A-Z]{2}-/, "");
  const head = cleaned.split(",")[0].trim().replace(/\s+/g, " ");
  if (!head || /^(hybrid|on-?site|in-?office|office)$/i.test(head)) return null;
  for (const [re, name] of PLACE_ALIASES) if (re.test(head)) return name;
  if (/^(united states|usa|us|u\.s\.)$/i.test(head)) return "United States";
  if (/^(united kingdom|uk)$/i.test(head)) return "United Kingdom";
  return head.replace(/\b(office|hq)\b/gi, "").trim();
}

export function splitPlaces(locations: string[], remote: boolean): string[] {
  const out = new Set<string>();
  for (const loc of locations) {
    for (const part of loc.split(/\s*[;|/•]\s*|\s+or\s+/i)) {
      if (/remote/i.test(part)) out.add("Remote");
      const place = normalizePlace(part);
      if (place) out.add(place);
    }
  }
  if (remote) out.add("Remote");
  return [...out];
}

const TIMEOUT_MS = 25_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "forwarddeployed/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function jobId(company: Company, id: string | number): string {
  return `${company.slug}/${id}`;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
  content?: string;
  departments?: { name: string }[];
  metadata?: { name: string; value: unknown }[] | null;
}

function fromGreenhouse(company: Company, j: GreenhouseJob): Job {
  const location = j.location?.name?.trim() || "";
  const locationType = j.metadata?.find((m) => /location type|workplace/i.test(m.name))?.value;
  const remote = /remote/i.test(location) || (typeof locationType === "string" && /remote/i.test(locationType));
  return {
    id: jobId(company, j.id),
    title: j.title.trim(),
    company: company.name,
    companySlug: company.slug,
    location,
    places: splitPlaces([location], remote),
    remote,
    team: j.departments?.[0]?.name ?? null,
    compensation: null,
    url: j.absolute_url,
    postedAt: j.first_published ?? j.updated_at ?? null,
    descriptionHtml: j.content ? decodeEntities(j.content) : undefined,
  };
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; team?: string; allLocations?: string[] };
  description?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

function money(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, notation: "compact" }).format(n);
}

function fromLever(company: Company, j: LeverJob): Job {
  const locations = j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location ?? ""];
  const location = locations.filter(Boolean).join("; ");
  const remote = j.workplaceType === "remote" || /remote/i.test(location);
  const lists = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
  const s = j.salaryRange;
  return {
    id: jobId(company, j.id),
    title: j.text.trim(),
    company: company.name,
    companySlug: company.slug,
    location,
    places: splitPlaces(locations, remote),
    remote,
    team: j.categories?.team ?? null,
    compensation: s?.min && s?.max ? `${money(s.min, s.currency)} – ${money(s.max, s.currency)}` : null,
    url: j.hostedUrl,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    descriptionHtml: `${j.description ?? ""}${lists}${j.additional ?? ""}`,
  };
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean | null;
  workplaceType?: string | null;
  isListed?: boolean;
  team?: string;
  department?: string;
  publishedAt?: string;
  descriptionHtml?: string;
  compensation?: { compensationTierSummary?: string | null; scrapeableCompensationSalarySummary?: string | null };
}

function fromAshby(company: Company, j: AshbyJob): Job {
  const locations = [j.location ?? "", ...(j.secondaryLocations ?? []).map((l) => l.location ?? "")].filter(Boolean);
  const location = locations.join("; ");
  const remote = Boolean(j.isRemote) || j.workplaceType === "Remote" || /remote/i.test(location);
  return {
    id: jobId(company, j.id),
    title: j.title.trim(),
    company: company.name,
    companySlug: company.slug,
    location,
    places: splitPlaces(locations, remote),
    remote,
    team: j.department || j.team || null,
    compensation: j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || null,
    url: j.jobUrl,
    postedAt: j.publishedAt ?? null,
    descriptionHtml: j.descriptionHtml,
  };
}

/** Fetches a company's board and returns only its forward deployed engineering roles. */
export async function fetchBoard(company: Company): Promise<Job[]> {
  const slug = encodeURIComponent(company.slug);
  let jobs: Job[];
  if (company.ats === "greenhouse") {
    const d = await getJson<{ jobs: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    jobs = d.jobs.filter((j) => isForwardDeployedEngineer(j.title)).map((j) => fromGreenhouse(company, j));
  } else if (company.ats === "lever") {
    const d = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    jobs = d.filter((j) => isForwardDeployedEngineer(j.text)).map((j) => fromLever(company, j));
  } else {
    const d = await getJson<{ jobs: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    );
    jobs = d.jobs
      .filter((j) => j.isListed !== false && isForwardDeployedEngineer(j.title))
      .map((j) => fromAshby(company, j));
  }
  return jobs;
}

/** Greenhouse list responses omit descriptions; fetch one posting in full. */
export async function fetchGreenhouseDescription(company: Company, id: string): Promise<string | undefined> {
  const j = await getJson<GreenhouseJob>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}/jobs/${encodeURIComponent(id)}`,
  );
  return j.content ? decodeEntities(j.content) : undefined;
}

/** Recognises a public Greenhouse, Lever or Ashby posting/board URL. */
const INVESTOR_BOARD =
  /(^|[-_. ])(vc|ventures?|capital|portfolio)([-_. ]|$)|^(a16z|sequoia|accel|greylock|kleiner|lightspeed|index[-_ ]?ventures|general[-_ ]?catalyst|founders[-_ ]?fund|y[-_ ]?combinator)/i;

// VC portfolio boards list jobs from many companies under one slug.
export function isInvestorBoard(slugOrName: string): boolean {
  return INVESTOR_BOARD.test(slugOrName);
}

export function parseBoardUrl(raw: string): { ats: Ats; slug: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const first = u.pathname.split("/").filter(Boolean)[0];
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const embed = u.searchParams.get("for");
    if (embed) return { ats: "greenhouse", slug: embed.toLowerCase() };
    if (first && first !== "embed") return { ats: "greenhouse", slug: first.toLowerCase() };
    return null;
  }
  if (host === "jobs.lever.co" && first) return { ats: "lever", slug: first.toLowerCase() };
  if (host === "jobs.ashbyhq.com" && first) return { ats: "ashby", slug: decodeURIComponent(first) };
  return null;
}
