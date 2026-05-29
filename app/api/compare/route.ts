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
const SHARED_COLLECTION_NFT_LIMIT = 8;
const TASTE_EXAMPLE_LIMIT = 4;
const DIFFERENCE_LIMIT = 4;
const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const ACCOUNT_EVENT_LIMIT = 200;
const ACCOUNT_EVENT_MAX_PAGES_PER_CHAIN = 8;
const ACCOUNT_EVENT_TIMEOUT_MS = 2500;

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
  walletANfts: CompareSharedCollectionNft[];
  walletBNfts: CompareSharedCollectionNft[];
  walletAEnteredMonth: string | null;
  walletBEnteredMonth: string | null;
};

type CompareSharedCollectionNft = {
  key: string;
  name?: string | null;
  imageUrl?: string | null;
  openSeaUrl?: string | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  quantity?: number;
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
  enteredMonth?: {
    walletAEventAddress: string;
    walletBEventAddress: string;
    walletAEventRowsFetched: number;
    walletBEventRowsFetched: number;
    walletAAcquiredMapSize: number;
    walletBAcquiredMapSize: number;
    walletAAcquiredMapComplete: boolean;
    walletBAcquiredMapComplete: boolean;
    firstSharedCollection?: {
      name: string;
      walletANftsChecked: number;
      walletBNftsChecked: number;
      walletAMatchesFound: number;
      walletBMatchesFound: number;
    };
  };
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

type AccountTransferEvent = Record<string, unknown>;

type AcquiredMapResult = {
  acquiredAtByNftKey: Map<string, number>;
  complete: boolean;
  eventsFetched: number;
};

function jsonError(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...details }, { status });
}

function openSeaApiKey(): string | undefined {
  return process.env.OPENSEA_API_KEY;
}

function cleanText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cleanUnknownText(value: unknown): string | undefined {
  return typeof value === "string" ? cleanText(value) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nestedValue(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function firstTextAtPath(source: Record<string, unknown>, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = cleanUnknownText(nestedValue(source, path));
    if (value) return value;
  }
  return undefined;
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

function nftQuantity(nft: OsWalletNft): number | undefined {
  const quantity = nft.quantity ?? nft.owners?.[0]?.quantity;
  return typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : undefined;
}

function nftTokenId(nft: OsWalletNft): string | undefined {
  return cleanText(nft.identifier);
}

function nftContractAddress(nft: OsWalletNft): string | undefined {
  return cleanText(nft.contract);
}

function acquiredNftKey(contractAddress?: string | null, tokenId?: string | null): string | undefined {
  const contract = cleanText(contractAddress)?.toLowerCase();
  const token = cleanText(tokenId);
  return contract && token ? `${contract}:${token}` : undefined;
}

function nftDisplayKey(nft: OsWalletNft, index: number): string {
  const chain = cleanText(nft.chain)?.toLowerCase();
  const contract = nftContractAddress(nft)?.toLowerCase();
  const tokenId = nftTokenId(nft);

  if (chain && contract && tokenId) return `${chain}:${contract}:${tokenId}`;
  if (contract && tokenId) return `${contract}:${tokenId}`;

  const openSeaUrl = cleanText(nft.opensea_url)?.toLowerCase();
  if (openSeaUrl) return `opensea:${openSeaUrl}`;

  const name = cleanText(nft.name)?.toLowerCase();
  return `${collectionKey(nft)}:${name || "unnamed"}:${index}`;
}

function toSharedCollectionNfts(
  nfts: OsWalletNft[],
  sharedCollectionKey: string,
): CompareSharedCollectionNft[] {
  const rows = new Map<string, CompareSharedCollectionNft>();
  const order = new Map<string, number>();

  nfts.forEach((nft, index) => {
    if (collectionKey(nft) !== sharedCollectionKey) return;

    const key = nftDisplayKey(nft, index);
    const quantity = nftQuantity(nft);
    const existing = rows.get(key);

    if (existing) {
      if (quantity !== undefined) {
        existing.quantity = (existing.quantity ?? 0) + quantity;
      }
      return;
    }

    rows.set(key, {
      key,
      name: cleanText(nft.name) ?? null,
      imageUrl: nftImage(nft) ?? null,
      openSeaUrl: cleanText(nft.opensea_url) ?? null,
      contractAddress: nftContractAddress(nft) ?? null,
      tokenId: nftTokenId(nft) ?? null,
      ...(quantity !== undefined ? { quantity } : {}),
    });
    order.set(key, index);
  });

  return Array.from(rows.values())
    .sort((a, b) => {
      const aIndex = order.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = order.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;

      const contractCompare = (a.contractAddress ?? "").localeCompare(b.contractAddress ?? "");
      if (contractCompare !== 0) return contractCompare;

      const tokenCompare = (a.tokenId ?? a.name ?? "").localeCompare(b.tokenId ?? b.name ?? "");
      if (tokenCompare !== 0) return tokenCompare;

      return a.key.localeCompare(b.key);
    })
    .slice(0, SHARED_COLLECTION_NFT_LIMIT);
}

function nftsForCollection(nfts: OsWalletNft[], sharedCollectionKey: string): OsWalletNft[] {
  return nfts.filter((nft) => collectionKey(nft) === sharedCollectionKey);
}

function formatEnteredMonth(timestampMs: number): string | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestampMs));
}

function enteredMonthForCollectionNfts(
  currentNfts: OsWalletNft[],
  acquiredAtByNftKey?: Map<string, number>,
): string | null {
  if (!acquiredAtByNftKey) return null;

  let earliest: number | undefined;
  for (const nft of currentNfts) {
    const key = acquiredNftKey(nftContractAddress(nft), nftTokenId(nft));
    if (!key) continue;

    const timestamp = acquiredAtByNftKey.get(key);
    if (timestamp === undefined) continue;
    if (earliest === undefined || timestamp < earliest) earliest = timestamp;
  }

  return earliest === undefined ? null : formatEnteredMonth(earliest);
}

function acquiredMatchesForCollectionNfts(
  currentNfts: OsWalletNft[],
  acquiredAtByNftKey?: Map<string, number>,
): number {
  if (!acquiredAtByNftKey) return 0;

  let matches = 0;
  for (const nft of currentNfts) {
    const key = acquiredNftKey(nftContractAddress(nft), nftTokenId(nft));
    if (key && acquiredAtByNftKey.has(key)) matches++;
  }

  return matches;
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

function sharedCollectionKeys(
  walletACollections: Map<string, CompareCollectionRow>,
  walletBCollections: Map<string, CompareCollectionRow>,
): Set<string> {
  const keys = new Set<string>();
  for (const key of walletACollections.keys()) {
    if (walletBCollections.has(key)) keys.add(key);
  }
  return keys;
}

function chainsForSharedNfts(nfts: OsWalletNft[], sharedKeys: Set<string>): string[] {
  return Array.from(
    nfts.reduce((chains, nft) => {
      const chain = cleanText(nft.chain);
      if (chain && sharedKeys.has(collectionKey(nft))) chains.add(chain);
      return chains;
    }, new Set<string>()),
  ).sort((a, b) => a.localeCompare(b));
}

function parseEventTimestampMs(event: AccountTransferEvent): number | undefined {
  const value =
    nestedValue(event, ["event_timestamp"]) ??
    nestedValue(event, ["timestamp"]) ??
    nestedValue(event, ["created_date"]) ??
    nestedValue(event, ["transaction", "timestamp"]);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function eventRecipientAddress(event: AccountTransferEvent): string | undefined {
  return firstTextAtPath(event, [
    ["to_account", "address"],
    ["to_account"],
    ["to", "address"],
    ["to"],
    ["recipient", "address"],
    ["recipient"],
    ["receiver", "address"],
    ["receiver"],
    ["to_address"],
    ["recipient_address"],
  ])?.toLowerCase();
}

function eventContractAddress(event: AccountTransferEvent): string | undefined {
  return firstTextAtPath(event, [
    ["asset", "contract"],
    ["asset", "contract_address"],
    ["asset", "asset_contract", "address"],
    ["nft", "contract"],
    ["nft", "contract_address"],
    ["contract"],
    ["contract_address"],
    ["token_address"],
    ["criteria", "contract", "address"],
  ]);
}

function eventTokenId(event: AccountTransferEvent): string | undefined {
  return firstTextAtPath(event, [
    ["asset", "identifier"],
    ["asset", "token_id"],
    ["nft", "identifier"],
    ["nft", "token_id"],
    ["identifier"],
    ["token_id"],
  ]);
}

function addInboundTransferToAcquiredMap(
  acquiredAtByNftKey: Map<string, number>,
  event: AccountTransferEvent,
  walletAddress: string,
) {
  const eventType = cleanUnknownText(event.event_type)?.toLowerCase();
  if (eventType && eventType !== "transfer") return;

  const recipient = eventRecipientAddress(event);
  if (!recipient || recipient !== walletAddress.toLowerCase()) return;

  const key = acquiredNftKey(eventContractAddress(event), eventTokenId(event));
  if (!key) return;

  const timestamp = parseEventTimestampMs(event);
  if (timestamp === undefined) return;

  const existing = acquiredAtByNftKey.get(key);
  if (existing === undefined || timestamp < existing) {
    acquiredAtByNftKey.set(key, timestamp);
  }
}

async function fetchAccountTransferEventPage(
  walletAddress: string,
  chain: string,
  cursor?: string,
): Promise<{ events: AccountTransferEvent[]; next?: string }> {
  const apiKey = openSeaApiKey();
  if (!apiKey) throw new Error("OPENSEA_API_KEY is not set");

  const params = new URLSearchParams({
    event_type: "transfer",
    chain,
    limit: String(ACCOUNT_EVENT_LIMIT),
  });
  if (cursor) params.set("next", cursor);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCOUNT_EVENT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${OPENSEA_BASE}/events/accounts/${encodeURIComponent(walletAddress)}?${params.toString()}`,
      {
        signal: controller.signal,
        cache: "no-store",
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      },
    );

    if (!response.ok) throw new Error(`OpenSea ${response.status} on account events`);

    const data = await response.json() as { asset_events?: unknown; next?: unknown };
    const events = Array.isArray(data.asset_events)
      ? data.asset_events.filter((event): event is AccountTransferEvent => Boolean(asRecord(event)))
      : [];

    return {
      events,
      next: cleanUnknownText(data.next),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWalletChainAcquiredMap(
  walletAddress: string,
  chain: string,
): Promise<AcquiredMapResult> {
  const acquiredAtByNftKey = new Map<string, number>();
  let complete = true;
  let eventsFetched = 0;

  let cursor: string | undefined;
  for (let page = 0; page < ACCOUNT_EVENT_MAX_PAGES_PER_CHAIN; page++) {
    const result = await fetchAccountTransferEventPage(walletAddress, chain, cursor);
    eventsFetched += result.events.length;
    for (const event of result.events) {
      addInboundTransferToAcquiredMap(acquiredAtByNftKey, event, walletAddress);
    }

    cursor = result.next;
    if (!cursor) break;
  }

  if (cursor) complete = false;
  return { acquiredAtByNftKey, complete, eventsFetched };
}

async function fetchWalletAcquiredMap(
  walletAddress: string,
  chains: string[],
): Promise<AcquiredMapResult> {
  const chainResults = await Promise.allSettled(
    chains.map((chain) => fetchWalletChainAcquiredMap(walletAddress, chain)),
  );
  const acquiredAtByNftKey = new Map<string, number>();
  let complete = true;
  let eventsFetched = 0;

  for (const result of chainResults) {
    if (result.status !== "fulfilled") {
      complete = false;
      continue;
    }

    if (!result.value.complete) complete = false;
    eventsFetched += result.value.eventsFetched;
    for (const [key, timestamp] of result.value.acquiredAtByNftKey) {
      const existing = acquiredAtByNftKey.get(key);
      if (existing === undefined || timestamp < existing) {
        acquiredAtByNftKey.set(key, timestamp);
      }
    }
  }

  return { acquiredAtByNftKey, complete, eventsFetched };
}

function usableAcquiredMap(result: PromiseSettledResult<AcquiredMapResult>): Map<string, number> | undefined {
  if (result.status !== "fulfilled") return undefined;
  return result.value.acquiredAtByNftKey;
}

function acquiredMapSize(result: PromiseSettledResult<AcquiredMapResult>): number {
  return result.status === "fulfilled" ? result.value.acquiredAtByNftKey.size : 0;
}

function acquiredEventRowsFetched(result: PromiseSettledResult<AcquiredMapResult>): number {
  return result.status === "fulfilled" ? result.value.eventsFetched : 0;
}

function acquiredMapComplete(result: PromiseSettledResult<AcquiredMapResult>): boolean {
  return result.status === "fulfilled" && result.value.complete;
}

function computeSharedCollections(
  walletACollections: Map<string, CompareCollectionRow>,
  walletBCollections: Map<string, CompareCollectionRow>,
  walletANfts: OsWalletNft[],
  walletBNfts: OsWalletNft[],
  walletAAcquiredAtByNftKey?: Map<string, number>,
  walletBAcquiredAtByNftKey?: Map<string, number>,
): CompareSharedCollection[] {
  const shared: CompareSharedCollection[] = [];

  for (const [key, walletACollection] of walletACollections.entries()) {
    const walletBCollection = walletBCollections.get(key);
    if (!walletBCollection) continue;

    const combinedHeldCount = walletACollection.heldCount + walletBCollection.heldCount;
    const walletACollectionNfts = nftsForCollection(walletANfts, key);
    const walletBCollectionNfts = nftsForCollection(walletBNfts, key);

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
      walletANfts: toSharedCollectionNfts(walletACollectionNfts, key),
      walletBNfts: toSharedCollectionNfts(walletBCollectionNfts, key),
      walletAEnteredMonth: enteredMonthForCollectionNfts(walletACollectionNfts, walletAAcquiredAtByNftKey),
      walletBEnteredMonth: enteredMonthForCollectionNfts(walletBCollectionNfts, walletBAcquiredAtByNftKey),
    });
  }

  return shared
    .sort((a, b) => {
      const mutualDelta =
        Math.min(b.walletAHeldCount, b.walletBHeldCount) -
        Math.min(a.walletAHeldCount, a.walletBHeldCount);
      if (mutualDelta !== 0) return mutualDelta;

      if (b.combinedHeldCount !== a.combinedHeldCount) return b.combinedHeldCount - a.combinedHeldCount;

      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;

      return a.key.localeCompare(b.key);
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

    const sharedKeys = sharedCollectionKeys(walletAData.collections, walletBData.collections);
    const [walletAAcquiredMapResult, walletBAcquiredMapResult] = await Promise.allSettled([
      fetchWalletAcquiredMap(walletA.address, chainsForSharedNfts(walletAFetch.nfts, sharedKeys)),
      fetchWalletAcquiredMap(walletB.address, chainsForSharedNfts(walletBFetch.nfts, sharedKeys)),
    ]);

    const sharedCollections = computeSharedCollections(
      walletAData.collections,
      walletBData.collections,
      walletAFetch.nfts,
      walletBFetch.nfts,
      usableAcquiredMap(walletAAcquiredMapResult),
      usableAcquiredMap(walletBAcquiredMapResult),
    );
    const tasteOverlap = computeTasteOverlap(walletAData.tasteSignals, walletBData.tasteSignals);
    const differences = {
      walletAOnly: computeDifferenceSignals(walletAData.tasteSignals, walletBData.tasteSignals),
      walletBOnly: computeDifferenceSignals(walletBData.tasteSignals, walletAData.tasteSignals),
    };
    const relationship = buildDeterministicRelationshipRead(sharedCollections, tasteOverlap, differences);
    const firstSharedCollection = sharedCollections[0];
    const walletAAcquiredAtByNftKey = usableAcquiredMap(walletAAcquiredMapResult);
    const walletBAcquiredAtByNftKey = usableAcquiredMap(walletBAcquiredMapResult);
    const firstWalletANfts = firstSharedCollection
      ? nftsForCollection(walletAFetch.nfts, firstSharedCollection.key)
      : [];
    const firstWalletBNfts = firstSharedCollection
      ? nftsForCollection(walletBFetch.nfts, firstSharedCollection.key)
      : [];
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
              enteredMonth: {
                walletAEventAddress: walletA.address,
                walletBEventAddress: walletB.address,
                walletAEventRowsFetched: acquiredEventRowsFetched(walletAAcquiredMapResult),
                walletBEventRowsFetched: acquiredEventRowsFetched(walletBAcquiredMapResult),
                walletAAcquiredMapSize: acquiredMapSize(walletAAcquiredMapResult),
                walletBAcquiredMapSize: acquiredMapSize(walletBAcquiredMapResult),
                walletAAcquiredMapComplete: acquiredMapComplete(walletAAcquiredMapResult),
                walletBAcquiredMapComplete: acquiredMapComplete(walletBAcquiredMapResult),
                ...(firstSharedCollection
                  ? {
                      firstSharedCollection: {
                        name: firstSharedCollection.name,
                        walletANftsChecked: firstWalletANfts.length,
                        walletBNftsChecked: firstWalletBNfts.length,
                        walletAMatchesFound: acquiredMatchesForCollectionNfts(firstWalletANfts, walletAAcquiredAtByNftKey),
                        walletBMatchesFound: acquiredMatchesForCollectionNfts(firstWalletBNfts, walletBAcquiredAtByNftKey),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    };

    return NextResponse.json(response);
  } catch {
    return jsonError("Compare data could not be built right now.", 502);
  }
}
