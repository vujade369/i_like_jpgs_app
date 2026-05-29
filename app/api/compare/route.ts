import { NextRequest, NextResponse } from "next/server";
import { classifyNftTaste, type NormalizedNft } from "@/lib/jpgs/classifyNftTaste";
import { TASTE_CATEGORY_LABELS, type TasteCategory } from "@/lib/jpgs/tasteCategories";
import {
  fetchCollectionBySlug,
  fetchWalletNfts,
  resolveWalletIdentity,
  type FetchWalletNftsResult,
  type OsCollection,
  type OsWalletNft,
} from "@/lib/jpgs/opensea";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_VISIBLE_NFTS = 3333;
const MAX_COLLECTIONS_TO_ENRICH = 40;
const TOP_COLLECTION_LIMIT = 12;
const SHARED_COLLECTION_LIMIT = 12;
const TASTE_EXAMPLE_LIMIT = 4;
const DIFFERENCE_LIMIT = 4;

type CompareWalletSummary = {
  address: string;
  input?: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  openSeaUrl?: string | null;
  visibleNftCount: number;
  collectionCount: number;
  topCollections: Array<{
    slug?: string | null;
    name: string;
    imageUrl?: string | null;
    heldCount: number;
    openSeaUrl?: string | null;
  }>;
  tasteSignals: Array<{
    label: string;
    count: number;
    exampleCollections: string[];
  }>;
};

type CompareSharedCollection = {
  key: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  openSeaUrl?: string | null;
  walletAHeldCount: number;
  walletBHeldCount: number;
  combinedHeldCount: number;
  strengthLabel?: string;
};

type CompareTasteOverlap = {
  label: string;
  walletACount: number;
  walletBCount: number;
  combinedCount: number;
  exampleCollections: string[];
};

type CompareDifferenceSignal = {
  label: string;
  count: number;
  exampleCollections: string[];
};

type CompareDebug = {
  totalMs: number;
  walletAFetchMs: number;
  walletBFetchMs: number;
  walletAVisibleNftCount: number;
  walletBVisibleNftCount: number;
  walletACollectionCount: number;
  walletBCollectionCount: number;
  sharedCollectionCount: number;
  tasteOverlapCount: number;
  notes: string[];
  walletAStoppedReason?: FetchWalletNftsResult["stoppedReason"];
  walletBStoppedReason?: FetchWalletNftsResult["stoppedReason"];
  walletAComplete?: boolean;
  walletBComplete?: boolean;
  enrichedCollectionCount: number;
  maxVisibleNfts: number;
};

type CompareV1Response = {
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
  relationship: {
    label: string;
    headline: string;
    summary: string;
    proofPoints: string[];
    confidence?: "low" | "medium" | "high";
  };
  sharedCollections: CompareSharedCollection[];
  tasteOverlap: CompareTasteOverlap[];
  differences: {
    walletAOnly: CompareDifferenceSignal[];
    walletBOnly: CompareDifferenceSignal[];
  };
  debug?: CompareDebug;
};

type ResolvedCompareWallet = {
  input: string;
  address: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  openSeaUrl?: string | null;
};

type CompareCollectionRow = {
  key: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  openSeaUrl?: string | null;
  heldCount: number;
  metadataQuality: number;
};

type CompareTasteSignal = {
  category: TasteCategory;
  label: string;
  count: number;
  collections: Map<string, { name: string; count: number }>;
};

type CompareWalletData = {
  wallet: ResolvedCompareWallet;
  fetch: FetchWalletNftsResult;
  collections: Map<string, CompareCollectionRow>;
  sortedCollections: CompareCollectionRow[];
  tasteSignals: CompareTasteSignal[];
  summary: CompareWalletSummary;
};

type TimedWalletFetch = {
  fetch: FetchWalletNftsResult;
  elapsedMs: number;
};

function jsonError(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...details }, { status });
}

function cleanText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function collectionSlug(nft: OsWalletNft): string | undefined {
  return cleanText(nft.collection);
}

function collectionKey(nft: OsWalletNft): string {
  const slug = collectionSlug(nft)?.toLowerCase();
  if (slug) return `slug:${slug}`;

  const chain = nft.chain?.trim().toLowerCase();
  const contract = nft.contract?.trim().toLowerCase();
  if (chain && contract) return `contract:${chain}:${contract}`;

  const openSeaUrl = nft.opensea_url?.trim().toLowerCase();
  return openSeaUrl ? `opensea:${openSeaUrl}` : "unknown";
}

function readableNameFromSlug(slug?: string | null): string | undefined {
  const trimmed = cleanText(slug);
  if (!trimmed) return undefined;
  if (/^0x[a-f0-9]{10,}$/i.test(trimmed)) return undefined;
  return trimmed.replace(/-/g, " ");
}

function collectionName(
  key: string,
  slug?: string | null,
  collection?: OsCollection | null,
): string {
  return (
    cleanText(collection?.name) ||
    readableNameFromSlug(slug) ||
    cleanText(slug) ||
    key.replace(/^(slug|contract|opensea):/, "")
  );
}

function nftImage(nft: OsWalletNft): string | undefined {
  return cleanText(nft.display_image_url) || cleanText(nft.image_url);
}

function nftBalance(nft: OsWalletNft): number {
  const quantity = nft.quantity ?? nft.owners?.[0]?.quantity ?? 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function collectionOpenSeaUrl(slug?: string | null, collection?: OsCollection | null): string | null {
  return cleanText(collection?.opensea_url) || (cleanText(slug) ? `https://opensea.io/collection/${slug}` : null);
}

function metadataQuality(row: Pick<CompareCollectionRow, "slug" | "imageUrl" | "name" | "openSeaUrl">): number {
  let score = 0;
  if (row.slug) score += 1;
  if (row.imageUrl) score += 1;
  if (row.openSeaUrl) score += 1;
  if (!/^0x[a-f0-9]{10,}$/i.test(row.name)) score += 1;
  return score;
}

function balanceScore(a: number, b: number): number {
  return Math.min(a, b) / Math.max(a, b, 1);
}

function toNormalizedNft(nft: OsWalletNft, collection?: OsCollection | null): NormalizedNft {
  const slug = collectionSlug(nft);
  const tokenStandard =
    nft.token_standard === "ERC721" || nft.token_standard === "ERC1155"
      ? nft.token_standard
      : "UNKNOWN";

  return {
    name: nft.name,
    description: nft.description,
    collectionSlug: slug,
    collectionName: collectionName(collectionKey(nft), slug, collection),
    collectionDescription: collection?.description,
    tokenStandard,
    imageUrl: nftImage(nft),
    animationUrl: nft.display_animation_url || nft.animation_url,
    contractAddress: nft.contract,
    chain: nft.chain,
    balance: nftBalance(nft),
    traits: (nft.traits ?? [])
      .filter((trait) => trait.trait_type && trait.value !== undefined)
      .map((trait) => ({
        trait_type: String(trait.trait_type),
        value: trait.value as string | number,
      })),
  };
}

async function resolveCompareWalletInput(input: string): Promise<ResolvedCompareWallet | null> {
  const resolved = await resolveWalletIdentity(input);
  const address = resolved?.address?.toLowerCase();

  if (!resolved || !address || !WALLET_RE.test(address)) return null;

  return {
    input,
    address,
    displayName: resolved.displayName ?? null,
    username: resolved.username ?? null,
    ens: resolved.ens ?? null,
    avatarUrl: resolved.avatarUrl ?? null,
    openSeaUrl: `https://opensea.io/${resolved.username || resolved.ens || address}`,
  };
}

async function enrichCollections(slugs: string[]): Promise<Map<string, OsCollection | null>> {
  const seen = new Set<string>();
  const limited = slugs
    .map((slug) => slug.trim())
    .filter(Boolean)
    .filter((slug) => {
      const key = slug.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_COLLECTIONS_TO_ENRICH);

  const rows = await Promise.all(limited.map((slug) => fetchCollectionBySlug(slug, 1500)));
  return new Map(limited.map((slug, index) => [slug.toLowerCase(), rows[index]]));
}

function groupCollectionsForCompare(
  nfts: OsWalletNft[],
  enriched: Map<string, OsCollection | null>,
): Map<string, CompareCollectionRow> {
  const rows = new Map<string, CompareCollectionRow>();

  for (const nft of nfts) {
    const key = collectionKey(nft);
    const slug = collectionSlug(nft) ?? null;
    const meta = slug ? enriched.get(slug.toLowerCase()) : null;
    const existing = rows.get(key);
    const heldCount = nftBalance(nft);

    if (existing) {
      existing.heldCount += heldCount;
      if (!existing.imageUrl && !meta?.image_url) existing.imageUrl = nftImage(nft) ?? null;
      continue;
    }

    const imageUrl = cleanText(meta?.image_url) || nftImage(nft) || null;
    const row = {
      key,
      slug,
      name: collectionName(key, slug, meta),
      imageUrl,
      openSeaUrl: collectionOpenSeaUrl(slug, meta),
      heldCount,
      metadataQuality: 0,
    };

    row.metadataQuality = metadataQuality(row);
    rows.set(key, row);
  }

  return rows;
}

function sortedCollectionRows(collections: Map<string, CompareCollectionRow>): CompareCollectionRow[] {
  return Array.from(collections.values()).sort((a, b) => {
    if (b.heldCount !== a.heldCount) return b.heldCount - a.heldCount;
    if (b.metadataQuality !== a.metadataQuality) return b.metadataQuality - a.metadataQuality;
    return a.name.localeCompare(b.name);
  });
}

function buildTasteSignals(
  nfts: OsWalletNft[],
  enriched: Map<string, OsCollection | null>,
): CompareTasteSignal[] {
  const buckets = new Map<TasteCategory, CompareTasteSignal>();

  for (const nft of nfts) {
    const key = collectionKey(nft);
    const slug = collectionSlug(nft);
    const meta = slug ? enriched.get(slug.toLowerCase()) : null;
    const category = classifyNftTaste(toNormalizedNft(nft, meta)).primaryCategory;
    const bucket =
      buckets.get(category) ??
      {
        category,
        label: TASTE_CATEGORY_LABELS[category],
        count: 0,
        collections: new Map<string, { name: string; count: number }>(),
      };
    const count = nftBalance(nft);
    const collectionBucket =
      bucket.collections.get(key) ??
      { name: collectionName(key, slug, meta), count: 0 };

    bucket.count += count;
    collectionBucket.count += count;
    bucket.collections.set(key, collectionBucket);
    buckets.set(category, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}

function signalExampleCollections(signal: CompareTasteSignal): string[] {
  return Array.from(signal.collections.values())
    .sort((a, b) => b.count - a.count)
    .map((collection) => collection.name)
    .slice(0, TASTE_EXAMPLE_LIMIT);
}

function buildCompareWalletSummary(
  wallet: ResolvedCompareWallet,
  fetch: FetchWalletNftsResult,
  sortedCollections: CompareCollectionRow[],
  tasteSignals: CompareTasteSignal[],
): CompareWalletSummary {
  return {
    address: wallet.address,
    input: wallet.input,
    displayName: wallet.displayName ?? null,
    username: wallet.username ?? null,
    ens: wallet.ens ?? null,
    avatarUrl: wallet.avatarUrl ?? null,
    openSeaUrl: wallet.openSeaUrl ?? null,
    visibleNftCount: fetch.nfts.length,
    collectionCount: sortedCollections.length,
    topCollections: sortedCollections.slice(0, TOP_COLLECTION_LIMIT).map((collection) => ({
      slug: collection.slug ?? null,
      name: collection.name,
      imageUrl: collection.imageUrl ?? null,
      heldCount: collection.heldCount,
      openSeaUrl: collection.openSeaUrl ?? null,
    })),
    tasteSignals: tasteSignals.map((signal) => ({
      label: signal.label,
      count: signal.count,
      exampleCollections: signalExampleCollections(signal),
    })),
  };
}

async function fetchCompareWalletData(
  wallet: ResolvedCompareWallet,
  fetch: FetchWalletNftsResult,
  enriched: Map<string, OsCollection | null>,
): Promise<Omit<CompareWalletData, "summary">> {
  const collections = groupCollectionsForCompare(fetch.nfts, enriched);
  const sortedCollections = sortedCollectionRows(collections);
  const tasteSignals = buildTasteSignals(fetch.nfts, enriched);

  return {
    wallet,
    fetch,
    collections,
    sortedCollections,
    tasteSignals,
  };
}

async function timedFetchWalletNfts(address: string): Promise<TimedWalletFetch> {
  const startedAt = Date.now();
  const fetch = await fetchWalletNfts(address, MAX_VISIBLE_NFTS);

  return {
    fetch,
    elapsedMs: Date.now() - startedAt,
  };
}

function computeSharedCollections(
  walletACollections: Map<string, CompareCollectionRow>,
  walletBCollections: Map<string, CompareCollectionRow>,
): CompareSharedCollection[] {
  const shared: CompareSharedCollection[] = [];

  for (const [key, walletACollection] of walletACollections.entries()) {
    const walletBCollection = walletBCollections.get(key);
    if (!walletBCollection) continue;

    const combinedHeldCount = walletACollection.heldCount + walletBCollection.heldCount;
    shared.push({
      key,
      slug: walletACollection.slug ?? walletBCollection.slug ?? null,
      name: walletACollection.name || walletBCollection.name,
      imageUrl: walletACollection.imageUrl ?? walletBCollection.imageUrl ?? null,
      openSeaUrl: walletACollection.openSeaUrl ?? walletBCollection.openSeaUrl ?? null,
      walletAHeldCount: walletACollection.heldCount,
      walletBHeldCount: walletBCollection.heldCount,
      combinedHeldCount,
      strengthLabel:
        combinedHeldCount >= 10 ? "Strong shared signal" : combinedHeldCount >= 4 ? "Clear overlap" : "Light overlap",
    });
  }

  return shared
    .sort((a, b) => {
      if (b.combinedHeldCount !== a.combinedHeldCount) {
        return b.combinedHeldCount - a.combinedHeldCount;
      }

      const balanceDelta =
        balanceScore(b.walletAHeldCount, b.walletBHeldCount) -
        balanceScore(a.walletAHeldCount, a.walletBHeldCount);
      if (balanceDelta !== 0) return balanceDelta;

      const aQuality = metadataQuality(a);
      const bQuality = metadataQuality(b);
      if (bQuality !== aQuality) return bQuality - aQuality;

      return a.name.localeCompare(b.name);
    })
    .slice(0, SHARED_COLLECTION_LIMIT);
}

function computeTasteOverlap(
  walletATasteSignals: CompareTasteSignal[],
  walletBTasteSignals: CompareTasteSignal[],
): CompareTasteOverlap[] {
  const walletBByCategory = new Map(walletBTasteSignals.map((signal) => [signal.category, signal]));

  return walletATasteSignals
    .flatMap((walletASignal) => {
      const walletBSignal = walletBByCategory.get(walletASignal.category);
      if (!walletBSignal) return [];

      return [{
        label: walletASignal.label,
        walletACount: walletASignal.count,
        walletBCount: walletBSignal.count,
        combinedCount: walletASignal.count + walletBSignal.count,
        exampleCollections: Array.from(
          new Set([
            ...signalExampleCollections(walletASignal),
            ...signalExampleCollections(walletBSignal),
          ]),
        ).slice(0, TASTE_EXAMPLE_LIMIT),
      }];
    })
    .sort((a, b) => b.combinedCount - a.combinedCount);
}

function computeDifferenceSignals(
  sourceSignals: CompareTasteSignal[],
  otherSignals: CompareTasteSignal[],
): CompareDifferenceSignal[] {
  const otherByCategory = new Map(otherSignals.map((signal) => [signal.category, signal]));

  return sourceSignals
    .flatMap((signal) => {
      const otherCount = otherByCategory.get(signal.category)?.count ?? 0;
      const difference = signal.count - otherCount;
      const mostlyUnique = otherCount === 0 || signal.count >= otherCount * 2;

      if (difference <= 0 || !mostlyUnique) return [];

      return [{
        label: signal.label,
        count: difference,
        exampleCollections: signalExampleCollections(signal),
      }];
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, DIFFERENCE_LIMIT);
}

function buildDeterministicRelationshipRead(
  sharedCollections: CompareSharedCollection[],
  tasteOverlap: CompareTasteOverlap[],
  differences: CompareV1Response["differences"],
): CompareV1Response["relationship"] {
  const topTasteLabels = tasteOverlap.slice(0, 2).map((signal) => signal.label);
  const topSharedNames = sharedCollections.slice(0, 3).map((collection) => collection.name);
  const primaryTaste = topTasteLabels.length > 0 ? topTasteLabels.join(" and ") : "visible collection signals";
  const proofPoints = [
    ...topSharedNames.map((name) => `Shared collection: ${name}`),
    ...tasteOverlap.slice(0, 2).map((signal) => (
      `${signal.label}: ${signal.walletACount} and ${signal.walletBCount} visible signals`
    )),
  ].slice(0, 4);

  if (sharedCollections.length >= 5) {
    return {
      label: "Strong shared signal",
      headline: `These wallets meet around ${primaryTaste}.`,
      summary: `The strongest visible overlap appears across ${sharedCollections.length} shared collection anchors, with both wallets showing repeat collection signals in the same parts of the JPG map.`,
      proofPoints,
      confidence: "high",
    };
  }

  if (sharedCollections.length >= 2) {
    return {
      label: "Clear overlap",
      headline: `These wallets share a clear visible thread around ${primaryTaste}.`,
      summary: `The read points toward shared worlds with different expressions: enough collection overlap to create context, while each wallet still brings its own visible emphasis.`,
      proofPoints,
      confidence: "medium",
    };
  }

  if (tasteOverlap.length > 0) {
    const walletADifference = differences.walletAOnly[0]?.label;
    const walletBDifference = differences.walletBOnly[0]?.label;
    const differenceCopy = walletADifference && walletBDifference
      ? ` One wallet leans more toward ${walletADifference}, while the other brings more ${walletBDifference}.`
      : "";

    return {
      label: "Adjacent taste",
      headline: `These wallets appear adjacent around ${primaryTaste}.`,
      summary: `The visible collection overlap is light, but the category signals suggest nearby taste rather than a blank read.${differenceCopy}`,
      proofPoints,
      confidence: "medium",
    };
  }

  return {
    label: "Light visible overlap",
    headline: "These wallets do not visibly meet around many shared signals yet.",
    summary: "The first pass finds different corners of the visible JPG map. That can still be useful context for a conversation, but the shared proof layer is currently sparse.",
    proofPoints,
    confidence: "low",
  };
}

function compareDebugNotes(walletA: CompareWalletData, walletB: CompareWalletData): string[] {
  const notes: string[] = [];

  if (!walletA.fetch.complete) {
    notes.push(`walletA fetch stopped: ${walletA.fetch.stoppedReason}`);
  }
  if (!walletB.fetch.complete) {
    notes.push(`walletB fetch stopped: ${walletB.fetch.stoppedReason}`);
  }
  if (walletA.fetch.nfts.length === 0) {
    notes.push("walletA has no visible NFTs in the fetched set");
  }
  if (walletB.fetch.nfts.length === 0) {
    notes.push("walletB has no visible NFTs in the fetched set");
  }

  return notes;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const walletAInput = req.nextUrl.searchParams.get("walletA")?.trim();
  const walletBInput = req.nextUrl.searchParams.get("walletB")?.trim();
  const includeDebug = req.nextUrl.searchParams.get("debug") === "1";

  if (!walletAInput || !walletBInput) {
    return jsonError("Both walletA and walletB are required.", 400);
  }

  try {
    const [walletA, walletB] = await Promise.all([
      resolveCompareWalletInput(walletAInput),
      resolveCompareWalletInput(walletBInput),
    ]);

    if (!walletA || !walletB) {
      return jsonError("Enter two valid Ethereum wallet addresses or supported public wallet inputs.", 422, {
        walletA: walletA
          ? { input: walletAInput, address: walletA.address }
          : { input: walletAInput, status: "invalid" },
        walletB: walletB
          ? { input: walletBInput, address: walletB.address }
          : { input: walletBInput, status: "invalid" },
      });
    }

    const [walletATimedFetch, walletBTimedFetch] = await Promise.all([
      timedFetchWalletNfts(walletA.address),
      timedFetchWalletNfts(walletB.address),
    ]);
    const walletAFetch = walletATimedFetch.fetch;
    const walletBFetch = walletBTimedFetch.fetch;
    const walletAFetchMs = walletATimedFetch.elapsedMs;
    const walletBFetchMs = walletBTimedFetch.elapsedMs;

    const walletAFetchFailed =
      walletAFetch.nfts.length === 0 &&
      !["exhausted", "max_reached"].includes(walletAFetch.stoppedReason);
    const walletBFetchFailed =
      walletBFetch.nfts.length === 0 &&
      !["exhausted", "max_reached"].includes(walletBFetch.stoppedReason);

    if (walletAFetchFailed || walletBFetchFailed) {
      return jsonError("Visible NFT holdings could not be fetched right now.", 502, {
        walletA: { address: walletA.address, stoppedReason: walletAFetch.stoppedReason },
        walletB: { address: walletB.address, stoppedReason: walletBFetch.stoppedReason },
      });
    }

    const rawWalletACollections = groupCollectionsForCompare(walletAFetch.nfts, new Map());
    const rawWalletBCollections = groupCollectionsForCompare(walletBFetch.nfts, new Map());
    const sharedRawSlugs = Array.from(rawWalletACollections.keys())
      .filter((key) => rawWalletBCollections.has(key))
      .flatMap((key) => [
        rawWalletACollections.get(key)?.slug,
        rawWalletBCollections.get(key)?.slug,
      ])
      .filter((slug): slug is string => Boolean(slug));
    const slugsToEnrich = [
      ...sharedRawSlugs,
      ...sortedCollectionRows(rawWalletACollections).slice(0, TOP_COLLECTION_LIMIT).flatMap((row) => row.slug ?? []),
      ...sortedCollectionRows(rawWalletBCollections).slice(0, TOP_COLLECTION_LIMIT).flatMap((row) => row.slug ?? []),
      ...sortedCollectionRows(rawWalletACollections).flatMap((row) => row.slug ?? []),
      ...sortedCollectionRows(rawWalletBCollections).flatMap((row) => row.slug ?? []),
    ];
    const enriched = await enrichCollections(slugsToEnrich);
    const walletADataBase = await fetchCompareWalletData(
      { ...walletA, openSeaUrl: walletA.openSeaUrl || `https://opensea.io/${walletA.address}` },
      walletAFetch,
      enriched,
    );
    const walletBDataBase = await fetchCompareWalletData(
      { ...walletB, openSeaUrl: walletB.openSeaUrl || `https://opensea.io/${walletB.address}` },
      walletBFetch,
      enriched,
    );

    const walletAData: CompareWalletData = {
      ...walletADataBase,
      fetch: walletAFetch,
      summary: buildCompareWalletSummary(
        walletADataBase.wallet,
        walletAFetch,
        walletADataBase.sortedCollections,
        walletADataBase.tasteSignals,
      ),
    };
    const walletBData: CompareWalletData = {
      ...walletBDataBase,
      fetch: walletBFetch,
      summary: buildCompareWalletSummary(
        walletBDataBase.wallet,
        walletBFetch,
        walletBDataBase.sortedCollections,
        walletBDataBase.tasteSignals,
      ),
    };

    const sharedCollections = computeSharedCollections(walletAData.collections, walletBData.collections);
    const tasteOverlap = computeTasteOverlap(walletAData.tasteSignals, walletBData.tasteSignals);
    const differences = {
      walletAOnly: computeDifferenceSignals(walletAData.tasteSignals, walletBData.tasteSignals),
      walletBOnly: computeDifferenceSignals(walletBData.tasteSignals, walletAData.tasteSignals),
    };
    const relationship = buildDeterministicRelationshipRead(sharedCollections, tasteOverlap, differences);
    const response: CompareV1Response = {
      walletA: walletAData.summary,
      walletB: walletBData.summary,
      relationship,
      sharedCollections,
      tasteOverlap,
      differences,
      ...(includeDebug
        ? {
            debug: {
              totalMs: Date.now() - startedAt,
              walletAFetchMs,
              walletBFetchMs,
              walletAVisibleNftCount: walletAFetch.nfts.length,
              walletBVisibleNftCount: walletBFetch.nfts.length,
              walletACollectionCount: walletAData.collections.size,
              walletBCollectionCount: walletBData.collections.size,
              sharedCollectionCount: sharedCollections.length,
              tasteOverlapCount: tasteOverlap.length,
              notes: compareDebugNotes(walletAData, walletBData),
              walletAStoppedReason: walletAFetch.stoppedReason,
              walletBStoppedReason: walletBFetch.stoppedReason,
              walletAComplete: walletAFetch.complete,
              walletBComplete: walletBFetch.complete,
              enrichedCollectionCount: enriched.size,
              maxVisibleNfts: MAX_VISIBLE_NFTS,
            },
          }
        : {}),
    };

    return NextResponse.json(response);
  } catch {
    return jsonError("Compare data could not be built right now.", 502);
  }
}
