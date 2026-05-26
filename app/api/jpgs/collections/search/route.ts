import type { NextRequest } from "next/server";
import {
  fetchCollectionBySlug,
  getCollectionSlug,
  getCollectionName,
  type OsCollection,
} from "@/lib/jpgs/opensea";

const ZERO_X_RE = /^0x[0-9a-f]{10,}$/i;
const OPENSEA_BASE = "https://api.opensea.io/api/v2";

// Curated query → canonical slug(s).
// Required for collections whose slug cannot be derived from the common search term
// (e.g. "bored ape" → "boredapeyachtclub", "the memes" → "thememes6529").
// Curated results always rank above generated slug variations.
const CURATED: Record<string, string[]> = {
  "bored ape": ["boredapeyachtclub"],
  "bored ape yacht club": ["boredapeyachtclub"],
  "bayc": ["boredapeyachtclub"],
  "the memes": ["thememes6529"],
  "the memes by 6529": ["thememes6529"],
  "memes by 6529": ["thememes6529"],
  "memes 6529": ["thememes6529"],
  "kamagang": ["thekamagang"],
  "kama": ["thekamagang"],
  "crypto punks": ["cryptopunks"],
  "punks": ["cryptopunks"],
  "doodles": ["doodles-official"],
};

type CandidateSource = "curated" | "generated";
type Candidate = { slug: string; source: CandidateSource };

// Build ordered slug candidates tagged with their source.
// OpenSea's /collections list endpoint ignores all search params — direct slug
// lookup is the only reliable v2 mechanism.
function buildCandidates(q: string): Candidate[] {
  const norm = q.toLowerCase().trim();
  const slugForm = norm.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const compact = norm.replace(/[\s\-_]+/g, "");

  const seen = new Set<string>();
  const result: Candidate[] = [];

  const add = (slug: string, source: CandidateSource) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    result.push({ slug, source });
  };

  // Curated aliases first — these encode explicit intent for the query.
  for (const s of CURATED[norm] ?? []) add(s, "curated");

  // Generated variations: slug-form, compact (no separators),
  // "the"-prefix (very common in NFT slugs), and "the"-stripped inverse.
  add(slugForm, "generated");
  if (compact !== slugForm) add(compact, "generated");
  if (compact.length >= 3 && !compact.startsWith("the")) add("the" + compact, "generated");
  if (compact.startsWith("the") && compact.length > 3) add(compact.slice(3), "generated");

  return result;
}

// Priority: curated > generated. Tiebreaker: name/slug similarity to the query.
const SOURCE_RANK: Record<CandidateSource, number> = { curated: 1, generated: 0 };

function nameMatchScore(col: OsCollection, norm: string, slugForm: string): number {
  const slug = getCollectionSlug(col).toLowerCase();
  const name = getCollectionName(col).toLowerCase();
  if (slug === norm || slug === slugForm || name === norm) return 3;
  if (name.startsWith(norm) || slug.startsWith(slugForm)) return 2;
  if (name.includes(norm) || slug.includes(slugForm)) return 1;
  return 0;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (!q.trim()) return Response.json({ collections: [] });
  if (ZERO_X_RE.test(q.trim())) return Response.json({ collections: [] });

  const norm = q.toLowerCase().trim();
  const slugForm = norm.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const candidates = buildCandidates(q);
  const lookupUrls = candidates.map(
    (c) => `${OPENSEA_BASE}/collections/${encodeURIComponent(c.slug)}`,
  );
  console.log("[collections/search] candidates for", JSON.stringify(q), "->", candidates);

  // Fetch all candidates in parallel.
  const fetched = await Promise.all(
    candidates.map((c) => fetchCollectionBySlug(c.slug)),
  );

  // Build a slug → source map from the candidates that actually resolved.
  const sourceMap = new Map<string, CandidateSource>();
  for (let i = 0; i < candidates.length; i++) {
    const col = fetched[i];
    if (!col) continue;
    const slug = getCollectionSlug(col);
    // First writer wins — preserves curated priority when a slug is both curated
    // and happens to also be a generated candidate.
    if (slug && !sourceMap.has(slug)) sourceMap.set(slug, candidates[i].source);
  }

  // Deduplicate by returned slug.
  const seen = new Set<string>();
  const valid: OsCollection[] = [];
  for (const col of fetched) {
    if (!col) continue;
    const slug = getCollectionSlug(col);
    const name = getCollectionName(col);
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    valid.push(col);
  }

  // Sort: curated > generated, then name/slug match quality as tiebreaker.
  valid.sort((a, b) => {
    const aSource = sourceMap.get(getCollectionSlug(a)) ?? "generated";
    const bSource = sourceMap.get(getCollectionSlug(b)) ?? "generated";
    const srcDiff = SOURCE_RANK[bSource] - SOURCE_RANK[aSource];
    if (srcDiff !== 0) return srcDiff;
    return nameMatchScore(b, norm, slugForm) - nameMatchScore(a, norm, slugForm);
  });

  console.log("[collections/search] found", valid.length, "for", JSON.stringify(q));

  if (debug) {
    return Response.json({
      collections: valid,
      debug: {
        query: q,
        openSeaUrl: lookupUrls[0] ?? null,
        lookupUrls,
        rawCount: candidates.length,
        validCount: valid.length,
        results: valid.slice(0, 10).map((c) => ({
          collection: c.collection ?? null,
          name: c.name,
          slug: getCollectionSlug(c),
          source: sourceMap.get(getCollectionSlug(c)) ?? "generated",
          hasImage: !!c.image_url,
        })),
      },
    });
  }

  return Response.json({ collections: valid });
}
