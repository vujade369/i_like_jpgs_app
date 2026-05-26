import type { NextRequest } from "next/server";
import {
  searchCollections,
  rankAndFilterCollections,
  getCollectionSlug,
  getCollectionName,
  getSafelistStatus,
  calcRelevanceScore,
  calcQualityScore,
} from "@/lib/jpgs/opensea";
import { findKnownByQuery } from "@/lib/jpgs/knownCollections";

const ZERO_X_RE = /^0x[0-9a-f]{10,}$/i;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (!q.trim()) return Response.json({ collections: [] });

  try {
    // If query is a known contract address, skip OpenSea search entirely
    const isContractQuery = ZERO_X_RE.test(q.trim());

    // For unknown 0x contract queries return empty — OpenSea won't find them either
    if (isContractQuery) {
      const { collections: ranked } = await rankAndFilterCollections([], q);
      if (ranked.length === 0) return Response.json({ collections: [] });
      return Response.json({ collections: ranked.slice(0, 8) });
    }

    const raw = await searchCollections(q);
    const {
      collections: ranked,
      slugFallbackUsed,
      slugFallbackSuppressed,
      meaningfulTokens,
    } = await rankAndFilterCollections(raw, q);
    const returned = ranked.slice(0, 8);

    if (debug) {
      const knownMatches = findKnownByQuery(q);
      return Response.json({
        collections: returned,
        debug: {
          query: q,
          meaningfulTokens,
          rawCount: raw.length,
          knownMatches: knownMatches.map((k) => k.slug),
          rankedCount: ranked.length,
          returnedCount: returned.length,
          slugFallbackUsed,
          slugFallbackSuppressed,
          rawSample: raw.slice(0, 5).map((c) => {
            const slug = getCollectionSlug(c);
            const name = getCollectionName(c);
            return {
              collection: c.collection ?? null,
              slug: c.slug ?? null,
              name,
              normalizedSlug: slug.toLowerCase(),
              normalizedName: name.toLowerCase().trim(),
              relevanceScore: calcRelevanceScore(c, q),
              qualityScore: calcQualityScore(c),
              hasImage: !!c.image_url,
              safelist_status: getSafelistStatus(c) || null,
            };
          }),
          topReturned: returned.map((c) => ({
            slug: c.collection,
            name: c.name,
            score: c._score,
            relevanceScore: c._relevanceScore,
            qualityScore: c._qualityScore,
            knownBoost: c._knownBoost,
            hasImage: !!c.image_url,
            contract: c.contracts?.[0]?.address ?? null,
            safelist_status: getSafelistStatus(c) || null,
          })),
        },
      });
    }

    return Response.json({ collections: returned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
