import type { NextRequest } from "next/server";
import {
  fetchCollectionHolders,
  fetchCollectionBySlug,
  fetchAccount,
  type OsCollection,
} from "@/lib/jpgs/opensea";
import {
  scoreCollectors,
  type CollectorCandidate,
} from "@/lib/jpgs/scoreCollectors";

export async function GET(req: NextRequest) {
  const startMs = Date.now();

  const slugsParam = req.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = slugsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return Response.json({ error: "No slugs provided" }, { status: 400 });
  }

  // Fetch collection metadata and holders for all slugs in parallel.
  const [holderResults, collectionResults] = await Promise.all([
    Promise.all(
      slugs.map(async (slug) => {
        const result = await fetchCollectionHolders(slug).catch(() => ({
          holders: new Map<string, number>(),
          nftSampleCount: 0,
        }));
        return { slug, holders: result.holders, nftSampleCount: result.nftSampleCount };
      }),
    ),
    Promise.all(slugs.map((slug) => fetchCollectionBySlug(slug))),
  ]);

  const collections = collectionResults.filter((c): c is OsCollection => c !== null);

  const warnings: string[] = [];
  for (const { slug, nftSampleCount, holders } of holderResults) {
    if (nftSampleCount === 0) {
      warnings.push(`Could not read NFTs for collection: ${slug}`);
    } else if (holders.size === 0) {
      warnings.push(`No holders found in sample for collection: ${slug}`);
    }
  }

  // Build candidate map: address → { slug → quantity }
  const candidateMap = new Map<string, Record<string, number>>();
  for (const { slug, holders } of holderResults) {
    for (const [address, quantity] of holders.entries()) {
      if (!candidateMap.has(address)) candidateMap.set(address, {});
      candidateMap.get(address)![slug] = quantity;
    }
  }

  // Build CollectorCandidate list.
  const candidates: CollectorCandidate[] = [];
  for (const [address, heldCollections] of candidateMap.entries()) {
    const matchedCollections = slugs.filter((s) => s in heldCollections);
    if (matchedCollections.length === 0) continue;
    const totalHeldAcrossSelected = matchedCollections.reduce(
      (sum, s) => sum + (heldCollections[s] ?? 0),
      0,
    );
    candidates.push({
      address,
      heldCollections,
      matchedCollections,
      matchedCollectionCount: matchedCollections.length,
      totalHeldAcrossSelected,
    });
  }

  // Sort all candidates, keep top 50 for output; enrich only the top 30 with profiles.
  const top50 = [...candidates]
    .sort((a, b) => b.matchedCollectionCount - a.matchedCollectionCount)
    .slice(0, 50);

  const enriched = await Promise.all(
    top50.map(async (c, i) => {
      if (i >= 30) {
        return {
          ...c,
          displayName: undefined,
          avatarUrl: undefined,
          openseaUrl: `https://opensea.io/${c.address}`,
        };
      }
      const account = await fetchAccount(c.address);
      return {
        ...c,
        displayName: account?.username ?? undefined,
        avatarUrl: account?.profile_image_url ?? undefined,
        openseaUrl: account?.username
          ? `https://opensea.io/${account.username}`
          : `https://opensea.io/${c.address}`,
      };
    }),
  );

  const profileEnrichedCount = enriched.filter(
    (e) => e.avatarUrl || e.displayName,
  ).length;

  const collectors = scoreCollectors(enriched, slugs);

  const diagnostics = {
    selectedCollectionCount: slugs.length,
    requestedSlugs: slugs,
    perCollection: holderResults.map(({ slug, nftSampleCount, holders }) => ({
      slug,
      nftSampleCount,
      uniqueHolderCount: holders.size,
    })),
    totalCandidateWallets: candidates.length,
    returnedWallets: collectors.length,
    profileEnrichedCount,
    elapsedMs: Date.now() - startMs,
    warnings,
  };

  return Response.json({
    collectors,
    collections,
    totalCandidates: candidates.length,
    diagnostics,
  });
}
