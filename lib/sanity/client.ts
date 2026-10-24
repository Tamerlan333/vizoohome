import "server-only";
import { createClient } from "next-sanity";
const token = process.env.SANITY_API_READ_TOKEN || undefined;
/** perspective "published": draft documents are never returned. Token (if any) is server-only. */
export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2025-01-01", useCdn: !token, perspective: "published", token,
});
export const sanityFetch = <T,>(query: string, params: Record<string, unknown> = {}): Promise<T> =>
  client.fetch<T>(query, params, { next: { revalidate: 60, tags: ["property"] } });
