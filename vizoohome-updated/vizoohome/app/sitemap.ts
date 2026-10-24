import type { MetadataRoute } from "next";
import { allSlugs } from "@/lib/properties";
import { siteConfig } from "@/lib/config";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await allSlugs();
  return [{ url: siteConfig.url }, { url: `${siteConfig.url}/properties` }, ...rows.map((r) => ({ url: `${siteConfig.url}/properties/${r.slug}`, lastModified: r._updatedAt }))];
}
