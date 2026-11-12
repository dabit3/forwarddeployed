import type { MetadataRoute } from "next";
import { getPostings } from "@/lib/jobs";
import { postingHref } from "@/lib/roles";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

function lastModified(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const postings = await getPostings();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    ...postings.map((job) => ({
      url: `${SITE_URL}${postingHref(job)}`,
      lastModified: lastModified(job.postedAt),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
