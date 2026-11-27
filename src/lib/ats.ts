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
  workplace?: string;
  team: string | null;
  compensation: string | null;
  url: string;
  postedAt: string | null;
  descriptionHtml?: string;
}

// Match words, not arbitrary substrings; ATS titles use Unicode dashes, NBSPs and full-width text.
function normalizedTitle(title: string): string {
  return decodeEntities(title).normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}

const FORWARD_DEPLOYED = /\bforward\s*deploy(?:ed|ment)?\b|\bfdes?\b/;
const ENGINEERING = /\b(?:engineers?|engineering|fdes?|developers?|builders?|software|architects?|architecture|technical staff|data scien(?:tists?|ce)|researchers?|research scientists?|strategists?)\b/;
// Other names companies use for the same customer-embedded engineering role.
const SIMILAR_TITLE = new RegExp(
  [
    String.raw`\bdeployed (?:(?:ai|ml|software|systems) )?(?:engineers?|engineering|architects?)\b`,
    String.raw`\bdelta engineers?\b`,
    String.raw`\bapplied ai (?:engineers?|engineering|architects?|architecture|specialists?)\b`,
    String.raw`\b(?:ai|agent) (?:deployment|implementation|integration|field) (?:engineers?|engineering|architects?)\b`,
    String.raw`\bcustomer (?:ai|deployment) engineers?\b`,
    String.raw`\bdeployment (?:strategists?|success engineers?)\b`,
    // Chainalysis publishes this same technical deployment role in Japanese.
    String.raw`デプロイメント\s*ストラテジスト`,
  ].join("|"),
  "i",
);
const APPLIED_RESEARCH = /\bapplied research engineers?\b/;
const EMBEDDED_AI = /\bembedded ai engineers?\b/;
const ON_DEVICE = /\b(?:on device|firmware|automotive|android|edge|hardware)\b/;
const CUSTOMER_FACING = /\b(?:customers?|clients?|field|deploy(?:ed|ment|ments|ing)?)\b/;
const NOT_ENGINEERING =
  /\b(?:account (?:executives?|managers?)|recruit\w*|talent|sales|marketing|(?:product|program|project|engagement|delivery|partner|partnerships|customer success) (?:managers?|management|directors?|leads?)|designers?|ux design|operations|chief of staff|bankers?|investors?|lawyers?)\b/;
const NON_SOFTWARE_ENGINEERING = /\b(?:hardware(?: integration)?|mechanical|electrical|build|finance|financial) engineers?\b/;
// Generic titles are only FDEs when the description identifies the current role as such,
// not merely when prior FDE experience appears in the qualifications.
const POSSIBLE_FDE = /\b(?:professional services engineers?|technical deployment leads?|software engineers? applied ai|(?:ai|platform) engineers?)\b/;
const QUALIFICATION_LABEL = String.raw`(?:qualifications|required qualifications|requirements|what you bring|what you.ll bring|who you are|what we.re looking for|what we look for|you may be a good fit|nice to have)`;
const QUALIFICATION_HEADING = new RegExp(
  String.raw`<(?:h[1-6]|strong|b)\b[^>]*>\s*${QUALIFICATION_LABEL}|<(?:p|div)\b[^>]*>\s*${QUALIFICATION_LABEL}\s*:?\s*</(?:p|div)>`,
  "i",
);
const INLINE_QUALIFICATION = new RegExp(String.raw`(?:^|[.!?\n])\s*${QUALIFICATION_LABEL}\s*:`, "i");

function describesFdeRole(html: string): boolean {
  const text = roleText(html);
  const namedRole = /\bas (?:(?:an?|our) forward[\s-]*deployed (?:software )?engineer|a technical deployment lead on the forward deployed engineering team)\b/gi;
  for (const match of text.matchAll(namedRole)) {
    // Inspect the clause BEFORE "as an FDE": experience after it can describe current duties.
    const prefix = text.slice(0, match.index).split(/[.!?\n]/).at(-1) ?? "";
    if (!/\b(?:experience|background|formerly|prior|previous|previously|worked|served|acted)\b/i.test(prefix)) return true;
  }
  return /(?:^|[\n|])\s*(?:(?:about (?:the|this) )?role|(?:ai )?engineering)\s*[|:]\s*forward[\s-]*deployed engineering\b/i.test(text);
}

/** These titles also describe internal product work or on-device AI, not just FDE work. */
function needsRoleContext(title: string): boolean {
  const normalized = normalizedTitle(title);
  return !FORWARD_DEPLOYED.test(normalized) &&
    (/\bapplied ai\b/.test(normalized) || EMBEDDED_AI.test(normalized) ||
      (APPLIED_RESEARCH.test(normalized) && !/\b(?:customers?|clients?|field)\b/.test(normalized)) ||
      (POSSIBLE_FDE.test(normalized) && !SIMILAR_TITLE.test(normalized)));
}

function roleText(html: string): string {
  // Source formatting newlines are soft wraps, unlike the HTML block boundaries below.
  const decoded = decodeEntities(html).replace(/\s+/g, " ");
  // Prior customer/FDE experience in a requirements list does not make an internal role an FDE.
  const qualifications = decoded.search(QUALIFICATION_HEADING);
  const text = (qualifications < 0 ? decoded : decoded.slice(0, qualifications))
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ").replace(/[^\S\n]+/g, " ");
  const inlineQualifications = text.search(INLINE_QUALIFICATION);
  return inlineQualifications < 0 ? text : text.slice(0, inlineQualifications);
}

function hasCustomerDeliveryContext(html: string): boolean {
  const text = roleText(html)
    .split(/(?<=[.!?\n])/)
    // Ignore qualification sentences, not responsibilities that improve "customer experience".
    .filter((sentence) =>
      !/\b(?:prior|previous|years? of) (?:experience|background)\b/i.test(sentence) &&
      !/\b(?:candidates?|applicants?)\b.{0,50}\b(?:experience|background)\b/i.test(sentence) &&
      !/^\s*(?:(?:we|you) (?:require|value|have|bring) )?(?:(?:strong|extensive|relevant|proven) )?(?:experience|background)\b/i.test(sentence))
    .join(" ").replace(/\s+/g, " ");
  // Customer-facing presales architecture is not a post-sale deployment role.
  if (/\byou (?:will|would) be (?:an? )?pre[\s-]sales (?:architect|engineer)\b/i.test(text)) return false;
  return describesFdeRole(html) || /\bcustomer[\s-]*embedded\b/i.test(text) ||
    /\bembed\w*\b.{0,100}\b(?:customers?|clients?|partners?|enterprise|integrators?|gsis?|rsis?)\b/i.test(text) ||
    /\bwork(?:ing)? with (?:research partners|labs)\b.{0,160}\b(?:production code|end.to.end)\b/i.test(text) ||
    /\btechnical (?:partner|point of contact)\b.{0,40}\b(?:clients?|customers?)\b/i.test(text) ||
    /\b(?:works?|working|partners?|partnering|collaborates?|collaborating)\b.{0,60}\b(?:directly|closely|side.by.side)\b.{0,40}\b(?:customers?|clients?)\b/i.test(text) ||
    /\b(?:works?|working|partners?|partnering|pairs?|pairing)\b.{0,60}\b(?:with|alongside)\b.{0,40}\b(?:customers?|clients?)\b/i.test(text) ||
    /\b(?:help|helping|enable|enabling|guide|guiding|support|supporting)\b.{0,40}\b(?:customers?|clients?|enterprises?)\b.{0,100}\b(?:build|deploy\w*|integrat\w*|implement\w*|production|adopt\w*)\b/i.test(text) ||
    /\b(?:build|building|implement\w*|deploy\w*)\b.{0,40}\b(?:alongside|with|for)\b.{0,40}\b(?:customers?|clients?|partners?)\b/i.test(text) ||
    /\b(?:hands.on|technical|engineering)\b.{0,40}\bpartner[\s-]+(?:facing|engagement|journey)\b/i.test(text) ||
    /\bfield product engineer\b|\b(?:customer|client) (?:engineering engagements|repositories|codebases|infrastructure|use cases)\b/i.test(text) ||
    /\b(?:customer|client) (?:engineering|technical) (?:partner|lead|advisor|engagement)\w*\b/i.test(text) ||
    /\b(?:customer|client)[\s-]+(?:facing|specific)\s+(?:engineer\w*|technical|role|position|solutions?|implementations?|deployments?|integrations?)\b/i.test(text) ||
    /\b(?:customer|client)(?:s['’]?|['’]s)?[\s-]+(?:environments?|deployments?|implementations?|integrations?|workflows?)\b/i.test(text);
}

function isTitleCandidate(title: string): boolean {
  const normalized = normalizedTitle(title);
  // Post-sales engineers build customer integrations; this is not the sales-engineer job family.
  const jobFamily = normalized.replace(/\bpost sales\b/g, "")
    .replace(/\bprogram lead(?= .*deployment strategist)/g, "");
  const matches =
    (FORWARD_DEPLOYED.test(normalized) && ENGINEERING.test(normalized)) ||
    SIMILAR_TITLE.test(normalized) ||
    (APPLIED_RESEARCH.test(normalized) && CUSTOMER_FACING.test(normalized)) ||
    (EMBEDDED_AI.test(normalized) && !ON_DEVICE.test(normalized)) ||
    POSSIBLE_FDE.test(normalized);
  return matches && !NOT_ENGINEERING.test(jobFamily) && !NON_SOFTWARE_ENGINEERING.test(normalized) &&
    !(EMBEDDED_AI.test(normalized) && ON_DEVICE.test(normalized)) &&
    !/\binternal (?:tools?|automation|ai)\b/.test(normalized);
}

/** Ambiguous aliases must describe customer delivery, not just internal product engineering. */
export function isForwardDeployedEngineer(title: string, descriptionHtml = ""): boolean {
  if (!isTitleCandidate(title)) return false;
  if (!needsRoleContext(title)) return true;
  const normalized = normalizedTitle(title);
  if (POSSIBLE_FDE.test(normalized) && !/\bapplied ai\b/.test(normalized) && !EMBEDDED_AI.test(normalized)) {
    return describesFdeRole(descriptionHtml);
  }
  return hasCustomerDeliveryContext(descriptionHtml);
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

const US_STATE =
  /^(al|ak|az|ar|ca|co|ct|fl|ga|hi|id|il|ia|ks|ky|la|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc|d\.c\.|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|united states|usa|us|u\.s\.a?\.?|america)$/i;
const US_CITY =
  /^(san francisco|sf|sunnyvale|new york|nyc|brooklyn|washington, dc|seattle|los angeles|austin|chicago|boston|san diego|honolulu|atlanta|denver|dallas|houston|miami|philadelphia|pittsburgh|phoenix|salt lake city|portland|detroit|nashville|raleigh|minneapolis|san jose|oakland|cambridge, ma)$/i;
const UK = /^(uk|united kingdom|england|scotland|wales|london|manchester|edinburgh|bristol)$/i;
const COUNTRIES: [RegExp, string][] = [
  [/^(canada|toronto|vancouver|montreal|ottawa)$/i, "Canada"],
  [/^(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt)$/i, "Germany"],
  [/^(france|paris)$/i, "France"],
  [/^(japan|tokyo)$/i, "Japan"],
  [/^(south korea|korea|republic of korea|seoul)$/i, "South Korea"],
  [/^(india|bengaluru|bangalore|mumbai|hyderabad|new delhi|delhi|pune|chennai|gurgaon|gurugram)$/i, "India"],
  [/^(australia|sydney|melbourne)$/i, "Australia"],
  [/^(ireland|dublin)$/i, "Ireland"],
  [/^(netherlands|amsterdam)$/i, "Netherlands"],
  [/^(spain|madrid|barcelona)$/i, "Spain"],
  [/^(switzerland|zurich|zürich|geneva)$/i, "Switzerland"],
  [/^(poland|warsaw|krakow|kraków)$/i, "Poland"],
  [/^(sweden|stockholm)$/i, "Sweden"],
  [/^(brazil|são paulo|sao paulo)$/i, "Brazil"],
  [/^(mexico|mexico city)$/i, "Mexico"],
  [/^(portugal|lisbon)$/i, "Portugal"],
];

const COUNTRY_NAMES = new Map(
  ["United States", "United Kingdom", ...COUNTRIES.map(([, name]) => name)]
    .map((name) => [name.toLowerCase(), name]),
);

export function isCountry(place: string): boolean {
  return COUNTRY_NAMES.has(place.toLowerCase());
}

/** The country a location is in, so a country filter also covers its cities. */
export function countryOf(raw: string, place: string | null): string | null {
  if (/^US-[A-Z]{2}-/.test(raw)) return "United States";
  const parts = raw
    .replace(/\(.*?\)/g, "")
    .split(/\s*,\s*|\s+-\s+/)
    .map((p) => p.replace(/\b(office|hq|soc|remote|hybrid)\b/gi, "").trim())
    .filter(Boolean);
  if (place) parts.push(place);
  for (const p of parts) {
    if (US_STATE.test(p) || US_CITY.test(p)) return "United States";
    if (UK.test(p)) return "United Kingdom";
    for (const [re, name] of COUNTRIES) if (re.test(p)) return name;
  }
  return null;
}

const REGION_NAMES = new Intl.DisplayNames("en", { type: "region", fallback: "none" });

function namedCountries(raw: string): string[] {
  const location = raw.trim();
  const qualification =
    /^remote(?:\s+in\s+(?:the\s+)?|\s*[-–]\s*)(.+)$/i.exec(location)?.[1] ??
    /^(.+?)\s*-\s*remote$/i.exec(location)?.[1] ??
    /^remote\s*\(([^)]+)\)$/i.exec(location)?.[1].split(/\s+-\s+/)[0];
  const parts = (qualification ?? location).split(/\s*(?:&|\band\b)\s*/i);
  if (!qualification && parts.length === 1) return [];
  const countries: string[] = [];
  for (const part of parts) {
    const name = part.trim().toLowerCase();
    const country = /^(us|usa|u\.s\.)$/.test(name) ? "United States" :
      name === "uk" ? "United Kingdom" : COUNTRY_NAMES.get(name);
    if (!country) return [];
    countries.push(country);
  }
  return countries;
}

export function splitPlaces(locations: string[], remote: boolean): string[] {
  const out = new Set<string>();
  for (const loc of locations) {
    for (const raw of loc.split(/\s*[;|/•]\s*|\s+or\s+/i)) {
      const geographic = raw.trim().replace(
        /^(?:hybrid|on-?site)(?:\s*[-–:]\s*|\s+|$)|(?:\s*[-–:]\s*|\s+)(?:hybrid|on-?site)$/gi,
        "",
      );
      const [, code, location] = /^([A-Z]{2})-(?![A-Z]{2}-)([A-Z].*?)(?:-Remote)?$/.exec(geographic) ?? [];
      const region = code && code !== "ZZ" ? REGION_NAMES.of(code) : undefined;
      const part = region ? location : geographic;
      if (/remote/i.test(raw)) out.add("Remote");
      const countries = region ? [] : namedCountries(part);
      if (countries.length) {
        for (const country of countries) out.add(country);
        continue;
      }
      const place = normalizePlace(part);
      if (place) out.add(place);
      const country = region ?? countryOf(part, place);
      if (country) out.add(country);
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
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity, value: string) => {
      const code = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value);
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/&(?:ndash|mdash|hyphen);/g, "-")
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

function workplaceLabel(value?: string | null): Job["workplace"] {
  const match = /^(remote|hybrid|on-?site)(\s+\([^()]+\))?$/i.exec(value?.trim() ?? "");
  if (!match) return undefined;
  const qualifier = match[2] ?? "";
  switch (match[1].toLowerCase()) {
    case "remote": return `Remote${qualifier}`;
    case "hybrid": return `Hybrid${qualifier}`;
    case "onsite":
    case "on-site": return `On-site${qualifier}`;
  }
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
  const workplace = j.metadata
    ?.filter((m) => /location type|workplace|^work (type|arrangement)$/i.test(m.name.trim()))
    .map((m) => workplaceLabel(typeof m.value === "string" ? m.value : undefined))
    .find(Boolean);
  return {
    id: jobId(company, j.id),
    title: j.title.trim(),
    company: company.name,
    companySlug: company.slug,
    location,
    places: splitPlaces([location], remote),
    remote,
    workplace,
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
    workplace: workplaceLabel(j.workplaceType),
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
  const workplace = workplaceLabel(j.workplaceType);
  const remote = workplace ? workplace.startsWith("Remote") : Boolean(j.isRemote) || /remote/i.test(location);
  return {
    id: jobId(company, j.id),
    title: j.title.trim(),
    company: company.name,
    companySlug: company.slug,
    location,
    places: splitPlaces(locations, remote).filter((place) => !workplace || remote || place !== "Remote"),
    remote,
    workplace,
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
    jobs = d.jobs.filter((j) => isTitleCandidate(j.title)).map((j) => fromGreenhouse(company, j));
  } else if (company.ats === "lever") {
    const d = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    jobs = d.filter((j) => isTitleCandidate(j.text)).map((j) => fromLever(company, j));
  } else {
    const d = await getJson<{ jobs: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    );
    jobs = d.jobs
      .filter((j) => j.isListed !== false && isTitleCandidate(j.title))
      .map((j) => fromAshby(company, j));
  }
  // Only ambiguous Greenhouse aliases need detail requests. Do not download every job's
  // description (?content=true) or make an unbounded request burst on large boards.
  const accepted: boolean[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      if (company.ats === "greenhouse" && needsRoleContext(job.title) && !job.descriptionHtml) {
        try {
          job.descriptionHtml = await fetchGreenhouseDescription(company, job.id.slice(company.slug.length + 1));
        } catch (err) {
          console.error(`role context ${job.id} failed:`, err instanceof Error ? err.message : err);
        }
      }
      accepted[i] = isForwardDeployedEngineer(job.title, job.descriptionHtml ?? "");
    }
  }));
  return jobs.filter((_, i) => accepted[i]);
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
