const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const HOLDER_PAGE_SIZE = 100;
const MAX_HOLDERS_PER_COLLECTION = 10_000;
const MAX_COLLECTIONS_PER_DISCOVERY = 5;
const HOLDER_FETCH_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 20 * 60 * 1000;

export const ACCOUNT_HYDRATION_LIMIT = 10;
export const ACCOUNT_HYDRATION_CONCURRENCY = 2;

function apiKey(): string {
  const k = process.env.OPENSEA_API_KEY;
  if (!k) throw new Error("OPENSEA_API_KEY is not set");
  return k;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollectionRef = {
  slug: string;
  name: string;
  image_url?: string;
  contract?: string;
};

type HolderRecord = { address: string; quantity: number };

type HolderCacheEntry = {
  fetchedAt: number;
  holders: HolderRecord[];
  complete: boolean;
  fetchedCount: number;
  nextCursorStoppedReason: string;
  pageCount: number;
  rawRowsFetched: number;
  uniqueHolderCount: number;
  duplicateHolderRows: number;
  firstPageFirstHolder: string | undefined;
  lastPageFirstHolder: string | undefined;
  cursorChanged: boolean;
  requestUrls: string[];
};

export type MatchedCollection = {
  slug: string;
  name: string;
  image_url?: string;
  heldCount: number;
};

export type WalletMatch = {
  address: string;
  matchedCollections: MatchedCollection[];
  matchedCollectionCount: number;
  totalHeldFromSelected: number;
};

export type CollectionFetchDebug = {
  slug: string;
  endpointPath: string;
  fetchedCount: number;
  complete: boolean;
  stoppedReason: string;
  pageCount: number;
  rawRowsFetched: number;
  uniqueHolderCount: number;
  duplicateHolderRows: number;
  firstPageFirstHolder: string | undefined;
  lastPageFirstHolder: string | undefined;
  cursorChanged: boolean;
  cached: boolean;
  requestUrls: string[];
  error?: string;
};

export type DiscoveryResult = {
  wallets: WalletMatch[];
  debug: {
    holderSource: string;
    maxHoldersPerCollection: number;
    collectionsFetched: CollectionFetchDebug[];
    partial: boolean;
    errors: string[];
  };
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

const holderCache = new Map<string, HolderCacheEntry>();

function getCached(slug: string): HolderCacheEntry | null {
  const entry = holderCache.get(slug);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    holderCache.delete(slug);
    return null;
  }
  return entry;
}

// ─── Holder fetching ──────────────────────────────────────────────────────────

async function fetchFromApi(slug: string): Promise<HolderCacheEntry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOLDER_FETCH_TIMEOUT_MS);

  // Dedupe by address: store address → quantity, keeping only the first-seen quantity.
  const holderMap = new Map<string, number>();
  let cursor: string | undefined;
  let stoppedReason = "exhausted";
  let pageCount = 0;
  let rawRowsFetched = 0;
  let firstPageFirstHolder: string | undefined;
  let lastPageFirstHolder: string | undefined;
  let cursorChanged = false;
  const seenCursors = new Set<string>();
  const seenPageSigs = new Set<string>();
  const requestUrls: string[] = [];

  const endpointPath = `/api/v2/collections/${slug}/holders`;

  try {
    while (holderMap.size < MAX_HOLDERS_PER_COLLECTION) {
      // URLSearchParams encodes special characters (=, +, etc.) correctly.
      // OpenSea /collections/{slug}/holders uses "cursor" (not "next") as the
      // pagination query parameter, even though the response field is called "next".
      const params = new URLSearchParams({ limit: String(HOLDER_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);

      const requestUrl = `${OPENSEA_BASE}/collections/${encodeURIComponent(slug)}/holders?${params.toString()}`;
      if (requestUrls.length < 2) requestUrls.push(requestUrl);

      const res = await fetch(
        requestUrl,
        {
          signal: controller.signal,
          headers: { "X-API-KEY": apiKey(), Accept: "application/json" },
          cache: "no-store",
        },
      );

      if (res.status === 429) { stoppedReason = "rate_limited"; break; }
      if (!res.ok) { stoppedReason = `http_${res.status}`; break; }

      const data = await res.json() as {
        holders?: Array<{ address: string; quantity: number }>;
        next?: string;
      };

      const rows = data.holders ?? [];
      rawRowsFetched += rows.length;
      pageCount++;

      // Page signature: first 5 holder addresses. If this page was already seen,
      // pagination is stuck (cursor not advancing) — stop immediately.
      const pageSig = rows.slice(0, 5).map((h) => h.address).join(",");
      if (pageSig) {
        if (seenPageSigs.has(pageSig)) {
          stoppedReason = "repeated_page";
          break;
        }
        seenPageSigs.add(pageSig);
      }

      if (pageCount === 1) firstPageFirstHolder = rows[0]?.address;
      lastPageFirstHolder = rows[0]?.address;

      // Only record each address once — quantity comes from the first page it appears on.
      for (const h of rows) {
        if (h.address && !holderMap.has(h.address.toLowerCase())) {
          holderMap.set(h.address.toLowerCase(), h.quantity ?? 1);
        }
      }

      if (!data.next || rows.length === 0) break;

      // Cursor loop detection: if OpenSea returns the same cursor twice, stop.
      if (seenCursors.has(data.next)) {
        stoppedReason = "repeated_cursor";
        break;
      }
      seenCursors.add(data.next);

      if (cursor !== undefined && cursor !== data.next) cursorChanged = true;
      cursor = data.next;

      if (holderMap.size >= MAX_HOLDERS_PER_COLLECTION) {
        stoppedReason = "max_reached";
        break;
      }
    }
  } catch (err: unknown) {
    stoppedReason =
      err instanceof Error && err.name === "AbortError" ? "timeout" : "error";
  } finally {
    clearTimeout(timer);
  }

  const holders = Array.from(holderMap.entries()).map(([address, quantity]) => ({
    address,
    quantity,
  }));

  const uniqueHolderCount = holders.length;
  const duplicateHolderRows = rawRowsFetched - uniqueHolderCount;

  return {
    fetchedAt: Date.now(),
    holders,
    complete: stoppedReason === "exhausted",
    fetchedCount: uniqueHolderCount,
    nextCursorStoppedReason: stoppedReason,
    pageCount,
    rawRowsFetched,
    uniqueHolderCount,
    duplicateHolderRows,
    firstPageFirstHolder,
    lastPageFirstHolder,
    cursorChanged,
    requestUrls,
  };
}

export async function fetchCollectionHolders(
  slug: string,
): Promise<{ entry: HolderCacheEntry; cached: boolean }> {
  const hit = getCached(slug);
  if (hit) return { entry: hit, cached: true };
  const result = await fetchFromApi(slug);
  holderCache.set(slug, result);
  return { entry: result, cached: false };
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export async function discoverWalletsForCollections(
  collections: CollectionRef[],
): Promise<DiscoveryResult> {
  const limited = collections.slice(0, MAX_COLLECTIONS_PER_DISCOVERY);

  const settled = await Promise.allSettled(
    limited.map((col) => fetchCollectionHolders(col.slug)),
  );

  const collectionsFetched: CollectionFetchDebug[] = [];
  const errors: string[] = [];
  const holdersBySlug = new Map<string, HolderRecord[]>();

  for (let i = 0; i < limited.length; i++) {
    const col = limited[i];
    const result = settled[i];
    const endpointPath = `/api/v2/collections/${col.slug}/holders`;
    if (result.status === "fulfilled") {
      const { entry, cached } = result.value;
      holdersBySlug.set(col.slug, entry.holders);
      collectionsFetched.push({
        slug: col.slug,
        endpointPath,
        fetchedCount: entry.fetchedCount,
        complete: entry.complete,
        stoppedReason: entry.nextCursorStoppedReason,
        pageCount: entry.pageCount,
        rawRowsFetched: entry.rawRowsFetched,
        uniqueHolderCount: entry.uniqueHolderCount,
        duplicateHolderRows: entry.duplicateHolderRows,
        firstPageFirstHolder: entry.firstPageFirstHolder,
        lastPageFirstHolder: entry.lastPageFirstHolder,
        cursorChanged: entry.cursorChanged,
        cached,
        requestUrls: entry.requestUrls,
      });
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${col.slug}: ${msg}`);
      collectionsFetched.push({
        slug: col.slug,
        endpointPath,
        fetchedCount: 0,
        complete: false,
        stoppedReason: "error",
        pageCount: 0,
        rawRowsFetched: 0,
        uniqueHolderCount: 0,
        duplicateHolderRows: 0,
        firstPageFirstHolder: undefined,
        lastPageFirstHolder: undefined,
        cursorChanged: false,
        cached: false,
        requestUrls: [],
        error: msg,
      });
    }
  }

  // Build wallet overlap map — one entry per (wallet, collection) slug pair.
  // fetchFromApi already deduped holders by address, so each address appears at
  // most once per collection. We do NOT accumulate heldCount across duplicate
  // rows; if somehow the same address appears twice, we keep only the first entry.
  type WalletAccum = { address: string; collectionsBySlug: Map<string, MatchedCollection> };
  const accumMap = new Map<string, WalletAccum>();

  for (const col of limited) {
    const holders = holdersBySlug.get(col.slug);
    if (!holders) continue;
    for (const h of holders) {
      let accum = accumMap.get(h.address);
      if (!accum) {
        accum = { address: h.address, collectionsBySlug: new Map() };
        accumMap.set(h.address, accum);
      }
      // Only set once per (wallet, collection) — do not accumulate.
      if (!accum.collectionsBySlug.has(col.slug)) {
        accum.collectionsBySlug.set(col.slug, {
          slug: col.slug,
          name: col.name,
          image_url: col.image_url,
          heldCount: h.quantity,
        });
      }
    }
  }

  // Flatten accumulators into final WalletMatch shape
  const walletMap = new Map<string, WalletMatch>();
  for (const [address, accum] of accumMap) {
    const matchedCollections = Array.from(accum.collectionsBySlug.values());
    walletMap.set(address, {
      address,
      matchedCollections,
      matchedCollectionCount: matchedCollections.length,
      totalHeldFromSelected: matchedCollections.reduce((sum, c) => sum + c.heldCount, 0),
    });
  }

  // Rank: matchedCollectionCount desc → totalHeldFromSelected desc → address asc
  const ranked = Array.from(walletMap.values()).sort((a, b) => {
    if (b.matchedCollectionCount !== a.matchedCollectionCount)
      return b.matchedCollectionCount - a.matchedCollectionCount;
    if (b.totalHeldFromSelected !== a.totalHeldFromSelected)
      return b.totalHeldFromSelected - a.totalHeldFromSelected;
    return a.address.localeCompare(b.address);
  });

  return {
    wallets: ranked,
    debug: {
      holderSource: "opensea_collection_holders",
      maxHoldersPerCollection: MAX_HOLDERS_PER_COLLECTION,
      collectionsFetched,
      partial: errors.length > 0 || collectionsFetched.some((c) => !c.complete),
      errors,
    },
  };
}
