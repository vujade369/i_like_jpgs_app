import type { NextRequest } from "next/server";
import {
  fetchCollectionBySlug,
  osSearch,
  getCollectionSlug,
  getCollectionName,
  getSafelistStatus,
  calcRelevanceScore,
  calcQualityScore,
  type OsCollection,
} from "@/lib/jpgs/opensea";

const SEARCH_LIMIT = 15;
const SEARCH_FACTOR = 200;    // score gap between adjacent search positions
const CURATED_BONUS = 10_000; // pins curated above all organic results
const SEARCH_REL_CAP = 100;   // prevents per-result relevance from overriding search position order
const ENRICH_TIMEOUT = 1500;  // ms per enrichment call (parallel, so total ≈ this)
const ZERO_X_RE = /^0x[0-9a-f]{10,}$/i;

// Curated aliases: safety net for abbreviations/nicknames where search might not surface
// the canonical collection first. Keep this minimal — /search handles most cases now.
const CURATED: Record<string, string[]> = {
  "bayc": ["boredapeyachtclub"],
  "bored ape": ["boredapeyachtclub"],
  "bored ape yacht club": ["boredapeyachtclub"],
  "crypto punks": ["cryptopunks"],
  "the memes": ["thememes6529"],
  "memes 6529": ["thememes6529"],
  "memes by 6529": ["thememes6529"],
  "kamagang": ["thekamagang"],
  "kama gang": ["thekamagang"],
  "doodles": ["doodles-official"],
};

function generateSlugCandidates(q: string): string[] {
  const norm = q.toLowerCase().trim();
  const slugForm = norm.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const compact = norm.replace(/[\s\-_]+/g, "");
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (s: string) => {
    if (s && !seen.has(s)) { seen.add(s); result.push(s); }
  };
  add(slugForm);
  if (compact !== slugForm) add(compact);
  if (compact.length >= 3 && !compact.startsWith("the")) add("the" + compact);
  if (compact.startsWith("the") && compact.length > 3) add(compact.slice(3));
  return result;
}

function computeScore(
  col: OsCollection,
  query: string,
  searchPosition: number | null,
  searchN: number,
  isCurated: boolean,
): number {
  if (col.is_disabled) return -Infinity;
  const slug = getCollectionSlug(col).toLowerCase();
  const name = getCollectionName(col).toLowerCase();
  if (ZERO_X_RE.test(name) && ZERO_X_RE.test(slug)) return -Infinity;

  const rel = calcRelevanceScore(col, query);
  const qual = calcQualityScore(col);
  const safelist = getSafelistStatus(col);

  // Generated-only candidates (not from search, not curated) must have positive relevance.
  if (searchPosition === null && !isCurated && rel <= 0) return -Infinity;

  // Cap rel contribution for search results so high text-similarity on a derivative
  // collection (e.g. "bayc-feels" for query "bayc") cannot override the canonical
  // collection OpenSea already ranked at position 0.
  const relContrib = searchPosition !== null ? Math.min(rel, SEARCH_REL_CAP) : rel;
  const searchBonus = searchPosition !== null
    ? Math.max(0, (searchN - searchPosition) * SEARCH_FACTOR)
    : 0;
  const curatedBonus = isCurated ? CURATED_BONUS : 0;
  const verBonus = (safelist === "verified" || safelist === "approved") ? 50 : 0;

  let score = searchBonus + curatedBonus + relContrib + qual + verBonus;
  if (slug.startsWith("0x")) score -= 100;
  if (!col.image_url && !col.description) score -= 15;

  return score;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (!q.trim()) return Response.json({ collections: [] });
  if (ZERO_X_RE.test(q.trim())) return Response.json({ collections: [] });

  const norm = q.toLowerCase().trim();

  // Layer 1: real search — OpenSea's /search ranks by actual relevance
  const searchHits = await osSearch(q, SEARCH_LIMIT);
  const searchSlugs = searchHits.map((r) => r.slug);
  const searchPositionMap = new Map(searchSlugs.map((s, i) => [s, i]));

  // Layer 2: slug candidates generated from the query string
  const generatedSlugs = generateSlugCandidates(q);

  // Layer 3: curated aliases as safety net
  const curatedSlugs = CURATED[norm] ?? [];
  const curatedSet = new Set(curatedSlugs);

  // Merge all candidate slugs: curated first (pinned), then search order, then generated extras
  const allSeen = new Set<string>();
  const allSlugs: string[] = [];
  const addSlug = (s: string) => {
    if (s && !allSeen.has(s)) { allSeen.add(s); allSlugs.push(s); }
  };
  curatedSlugs.forEach(addSlug);
  searchSlugs.forEach(addSlug);
  generatedSlugs.forEach(addSlug);

  // Layer 4: enrich all candidates with full collection data (safelist, contracts, etc.)
  const enriched = await Promise.all(
    allSlugs.map((s) => fetchCollectionBySlug(s, ENRICH_TIMEOUT)),
  );

  // Score each result, falling back to partial search data when enrichment fails
  const scored: Array<{ col: OsCollection; score: number; slug: string }> = [];
  const dedupSlugs = new Set<string>();

  for (let i = 0; i < allSlugs.length; i++) {
    const requestedSlug = allSlugs[i];
    let col = enriched[i];

    if (!col) {
      // Enrichment failed — fall back to partial data from search if available
      const sIdx = searchPositionMap.get(requestedSlug);
      if (sIdx === undefined) continue;
      const hit = searchHits[sIdx];
      if (!hit || hit.is_disabled) continue;
      col = {
        collection: hit.slug,
        name: hit.name,
        image_url: hit.image_url,
        opensea_url: hit.opensea_url,
        is_disabled: hit.is_disabled,
        is_nsfw: hit.is_nsfw,
      };
    }

    if (col.is_disabled) continue;

    const colSlug = getCollectionSlug(col);
    if (!colSlug || dedupSlugs.has(colSlug)) continue;
    dedupSlugs.add(colSlug);

    const searchPosition = searchPositionMap.has(requestedSlug)
      ? searchPositionMap.get(requestedSlug)!
      : null;
    const isCurated = curatedSet.has(requestedSlug);
    const score = computeScore(col, q, searchPosition, searchHits.length, isCurated);
    if (!isFinite(score)) continue;
    scored.push({ col, score, slug: colSlug });
  }

  scored.sort((a, b) => b.score - a.score);
  const positive = scored.filter((s) => s.score > 0);
  const collections = (positive.length > 0 ? positive : scored.slice(0, 5)).map((s) => s.col);

  if (debug) {
    return Response.json({
      collections: collections.slice(0, 10),
      debug: {
        query: q,
        source: "opensea /api/v2/search",
        searchCandidates: searchSlugs,
        generatedCandidates: generatedSlugs,
        curatedCandidates: curatedSlugs,
        fetchedCandidates: allSlugs.filter((_, i) => enriched[i] !== null),
        failedCandidates: allSlugs.filter((_, i) => enriched[i] === null),
        finalResults: scored.slice(0, 10).map((s) => ({
          slug: s.slug,
          name: getCollectionName(s.col),
          score: s.score,
          safelist: getSafelistStatus(s.col),
          hasImage: !!s.col.image_url,
          hasContract: !!(s.col.contracts?.length),
          inSearch: searchPositionMap.has(s.slug),
          searchPosition: searchPositionMap.get(s.slug) ?? null,
          isCurated: curatedSet.has(s.slug),
        })),
      },
    });
  }

  return Response.json({ collections });
}
