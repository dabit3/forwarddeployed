import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import sanitizeHtml from "sanitize-html";
import companiesData from "../../data/companies.json";
import { fetchBoard, fetchGreenhouseDescription, isForwardDeployedEngineer, splitPlaces, type Company, type Job } from "./ats";
import { groupRoles, type Role } from "./roles";

export const REVALIDATE_SECONDS = 3600;
const CONCURRENCY = 16;

export const companies = companiesData as Company[];

export function getCompany(slug: string): Company | undefined {
  return companies.find((c) => c.slug === slug);
}

// Bump both board and role cache keys when matching changes: these caches contain filtered data.
// Re-filtering alone can remove old matches, but cannot recover previously excluded postings.
async function getBoard(company: Company): Promise<Job[]> {
  const jobs = await unstable_cache(() => fetchBoard(company), ["board-v3-matching-workplace", company.ats, company.slug], {
    revalidate: REVALIDATE_SECONDS,
    tags: ["jobs"],
  })();
  return jobs
    .filter((j) => isForwardDeployedEngineer(j.title, j.descriptionHtml ?? ""))
    .map((j) => ({ ...j, places: splitPlaces([j.location], j.remote) }));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function readAllBoards(): Promise<Job[]> {
  const boards = await mapPool(companies, CONCURRENCY, async (c) => {
    try {
      return await getBoard(c);
    } catch (err) {
      console.error(`board ${c.ats}/${c.slug} failed:`, err instanceof Error ? err.message : err);
      return [];
    }
  });
  return boards.flat();
}

async function buildRoles(): Promise<Role[]> {
  return groupRoles(await readAllBoards());
}

// Reading every board takes seconds, so pages share one cached, fully classified role index.
// Its key changes with the company list; board/role versions above change with matching rules.
// Version the role shape too: location filtering needs main's per-posting metadata.
const COMPANIES_KEY = createHash("sha1").update(JSON.stringify(companies)).digest("hex").slice(0, 12);

export const getRoles = cache(async (): Promise<Role[]> => {
  const roles = await unstable_cache(buildRoles, ["roles-v5-date-link", COMPANIES_KEY], {
    revalidate: REVALIDATE_SECONDS,
    tags: ["jobs"],
  })();
  return roles;
});

/** Every posting with its own detail page, including each city of a folded role. */
export const getPostings = cache(readAllBoards);

const getGreenhouseDescription = (company: Company, id: string) =>
  unstable_cache(() => fetchGreenhouseDescription(company, id), ["gh-desc-v1", company.slug, id], {
    revalidate: REVALIDATE_SECONDS * 6,
  })();

function clean(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "a", "h3", "h4", "blockquote"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      h1: "h3",
      h2: "h3",
      h5: "h4",
      h6: "h4",
      div: "p",
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
    exclusiveFilter: (frame) => ["p", "li", "h3", "h4", "strong", "b"].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren.length,
  });
}

export interface PostingDetail {
  job: Job;
  html: string;
  siblings: Job[];
}

export async function getPosting(companySlug: string, id: string): Promise<PostingDetail | null> {
  const company = getCompany(companySlug);
  if (!company) return null;
  const board = await getBoard(company);
  const job = board.find((j) => j.id === `${companySlug}/${id}`);
  if (!job) return null;
  let raw = job.descriptionHtml;
  if (!raw && company.ats === "greenhouse") raw = await getGreenhouseDescription(company, id).catch(() => undefined);
  const key = job.title.toLowerCase().replace(/\s+/g, " ").trim();
  const siblings = board.filter((j) => j.id !== job.id && j.title.toLowerCase().replace(/\s+/g, " ").trim() === key);
  return { job, html: raw ? clean(raw) : "", siblings };
}
