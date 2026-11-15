const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

/** Absolute origin used in the sitemap and robots.txt. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (productionHost ? `https://${productionHost}` : "https://forwarddeployed-sigma.vercel.app")
).replace(/\/+$/, "");
