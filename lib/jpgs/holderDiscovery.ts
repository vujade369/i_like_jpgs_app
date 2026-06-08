import {
  fetchAccountWithDiagnostic,
  fetchResolvedAccountWithDiagnostic,
  normalizeOpenSeaAccountIdentity,
  type OpenSeaAccountIdentity,
  type OpenSeaAccountFetchDiagnostic,
  type OpenSeaIdentityFetchStatus,
  type OsAccount,
} from "./opensea";
import {
  AlchemyOwnerFetchError,
  alchemyNetworkForChain,
  fetchAlchemyOwnersForContract,
  type AlchemyFallbackReason,
} from "./alchemy";

const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const HOLDER_PAGE_SIZE = 100;
const MAX_HOLDERS_PER_COLLECTION = 10_000;
const MAX_COLLECTIONS_PER_DISCOVERY = 5;
const HOLDER_FETCH_TIMEOUT_MS = 200_000;
const HOLDER_PAGE_DELAY_MS = 750;
const COLLECTION_FETCH_CONCURRENCY = 1;
const MAX_RETRY_ATTEMPTS = 8;
const RETRY_BASE_DELAY_MS = 1_000;
const CACHE_TTL_MS = 20 * 60 * 1000;
const ACCOUNT_PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
// Shorter TTL for addresses where OpenSea returned a definitive 404 (no account exists).
// Prevents re-fetching known-empty addresses on every load while still expiring quickly.
const ACCOUNT_NO_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

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
  chain?: string;
  contracts?: Array<{ address: string; chain?: string }>;
};

type HolderRecord = { address: string; quantity: number };
type HolderDiscoverySource = "alchemy" | "opensea";

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
  rateLimitRetryAttempts: number;
  rateLimitedPageCount: number;
  retryExhaustedPageCount: number;
  lastRetryDelayMs: number;
  totalRetryDelayMs: number;
  retryDelayMsSamples: number[];
  lastRetryAfterHeader: string | undefined;
  lastRetryAfterMs: number | undefined;
  pageDelayMs: number;
  discoverySource: HolderDiscoverySource;
  fallbackReason?: AlchemyFallbackReason;
  usableOwnerCount?: number;
  blockedOwnerCount?: number;
  invalidOwnerCount?: number;
  missingTokenBalanceOwnerCount?: number;
  unsafeTokenBalanceCount?: number;
  fetchDurationMs?: number;
};

type AccountIdentityCacheEntry = {
  fetchedAt: number;
  identity: OpenSeaAccountIdentity;
  debug: AccountIdentityDebug;
};

export type MatchedCollection = {
  slug: string;
  name: string;
  image_url?: string;
  heldCount: number;
  contract?: string;
  chain?: string;
  contracts?: Array<{ address: string; chain?: string }>;
};

function collectionDepthScore(matchedCollections: MatchedCollection[]): number {
  return matchedCollections.reduce((sum, c) => sum + Math.log2(1 + c.heldCount), 0);
}

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
  rateLimitRetryAttempts: number;
  rateLimitedPageCount: number;
  retryExhaustedPageCount: number;
  lastRetryDelayMs: number;
  totalRetryDelayMs: number;
  retryDelayMsSamples: number[];
  lastRetryAfterHeader: string | undefined;
  lastRetryAfterMs: number | undefined;
  pageDelayMs: number;
  discoverySource: HolderDiscoverySource;
  fallbackReason?: AlchemyFallbackReason;
  usableOwnerCount?: number;
  blockedOwnerCount?: number;
  invalidOwnerCount?: number;
  missingTokenBalanceOwnerCount?: number;
  unsafeTokenBalanceCount?: number;
  fetchDurationMs?: number;
  alchemyFetchDurationMs?: number;
  openseaFetchDurationMs?: number;
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
    collectionFetchConcurrency: number;
    candidateHolderCount: number;
  };
};

export type AccountHydrationOutcome = {
  address: string;
  outcome: "ok" | "fail" | "cached" | "skip";
  hasAvatar: boolean;
  hasEns: boolean;
  hasUsername: boolean;
};

export type AccountHydrationSummary = {
  ok: number;
  fail: number;
  cached: number;
  skip: number;
  withAvatar: number;
  withEns: number;
  withUsername: number;
  failures: string[];
  limit: number;
  concurrency: number;
  requested: number;
  unique: number;
  durationMs: number;
};

export type AccountIdentityDebug = {
  address: string;
  cacheHit: boolean;
  cachedIdentitySource?: OpenSeaAccountIdentity["identitySource"];
  cachedHadAvatar: boolean;
  accountFetchAttempted: boolean;
  accountFetchStatus: OpenSeaIdentityFetchStatus;
  accountFetchError?: string;
  accountFetchHadBody: boolean;
  accountFetchUsername?: string;
  accountFetchProfileImageUrl?: string;
  resolveFetchAttempted: boolean;
  resolveFetchStatus: OpenSeaIdentityFetchStatus;
  resolveFetchError?: string;
  resolveFetchEns?: string;
  rawAccount: {
    username?: string;
    display_name?: string;
    displayName?: string;
    name?: string;
    profile_image_url?: string;
    profileImageUrl?: string;
    image_url?: string;
    imageUrl?: string;
    avatar_url?: string;
    avatarUrl?: string;
    avatar?: string;
  } | null;
  rawResolve: {
    ens?: string;
    ens_name?: string;
    ensName?: string;
  } | null;
  finalUsername?: string;
  finalDisplayName?: string;
  finalEns?: string;
  finalAvatarUrl?: string;
  identitySource: OpenSeaAccountIdentity["identitySource"];
  avatarBeforeMapping: boolean;
};

export type HydratedAccountIdentity = OpenSeaAccountIdentity & {
  address: string;
  hydrated: boolean;
  cached: boolean;
  debug?: AccountIdentityDebug;
};

export type AccountHydrationResult = {
  identities: Map<string, HydratedAccountIdentity>;
  summary: AccountHydrationSummary;
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

const holderCache = new Map<string, HolderCacheEntry>();
const accountIdentityCache = new Map<string, AccountIdentityCacheEntry>();
// Hard-negative cache: addresses OpenSea confirmed have no account (clean 404 + no resolve data).
// Soft failures (timeout, 429, 5xx, network error) are intentionally excluded so refresh can recover.
const accountNoProfileCache = new Map<string, { fetchedAt: number }>();

function getCached(slug: string): HolderCacheEntry | null {
  const entry = holderCache.get(slug);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    holderCache.delete(slug);
    return null;
  }
  return entry;
}

async function runConcurrently<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return Date.now();
}

function firstText(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function usernameForDebug(account?: OsAccount | null): string | undefined {
  return firstText(account?.username, account?.account?.username, account?.user?.username);
}

function profileImageForDebug(account?: OsAccount | null): string | undefined {
  return firstText(
    account?.profile_image_url,
    account?.profileImageUrl,
    account?.account?.profile_image_url,
    account?.account?.profileImageUrl,
    account?.user?.profile_image_url,
    account?.user?.profileImageUrl,
  );
}

function ensForDebug(account?: OsAccount | null): string | undefined {
  return firstText(
    account?.ens,
    account?.ens_name,
    account?.ensName,
    account?.account?.ens,
    account?.account?.ens_name,
    account?.account?.ensName,
    account?.user?.ens,
    account?.user?.ens_name,
    account?.user?.ensName,
  );
}

function notAttemptedDiagnostic(): OpenSeaAccountFetchDiagnostic {
  return {
    attempted: false,
    status: "not_attempted",
    hadBody: false,
    account: null,
  };
}

function identityHasAvatar(identity: OpenSeaAccountIdentity): boolean {
  return Boolean(identity.avatarUrl || identity.profileImageUrl || identity.imageUrl);
}

function cacheHitDebug(
  cached: AccountIdentityCacheEntry,
): AccountIdentityDebug {
  return {
    ...cached.debug,
    cacheHit: true,
    cachedIdentitySource: cached.identity.identitySource,
    cachedHadAvatar: identityHasAvatar(cached.identity),
    accountFetchAttempted: false,
    accountFetchStatus: "not_attempted",
    accountFetchError: undefined,
    accountFetchHadBody: false,
    accountFetchUsername: undefined,
    accountFetchProfileImageUrl: undefined,
    resolveFetchAttempted: false,
    resolveFetchStatus: "not_attempted",
    resolveFetchError: undefined,
    resolveFetchEns: undefined,
  };
}

function negativeHitDebug(address: string): AccountIdentityDebug {
  return {
    address,
    cacheHit: true,
    cachedIdentitySource: "fallback",
    cachedHadAvatar: false,
    accountFetchAttempted: false,
    accountFetchStatus: "not_attempted",
    accountFetchHadBody: false,
    resolveFetchAttempted: false,
    resolveFetchStatus: "not_attempted",
    rawAccount: null,
    rawResolve: null,
    identitySource: "fallback",
    avatarBeforeMapping: false,
  };
}

async function getAccountIdentity(
  address: string,
): Promise<{
  identity: OpenSeaAccountIdentity;
  debug: AccountIdentityDebug;
  outcome: "ok" | "fail" | "cached";
}> {
  const cacheKey = address.toLowerCase();

  // Hard-negative cache: skip addresses where OpenSea gave a definitive "no identity" response
  // (404, or 200/4xx with empty profile). Soft failures are excluded so refresh can recover.
  const negative = accountNoProfileCache.get(cacheKey);
  if (negative) {
    if (Date.now() - negative.fetchedAt <= ACCOUNT_NO_PROFILE_CACHE_TTL_MS) {
      const identity = normalizeOpenSeaAccountIdentity(address, null, null);
      return { identity, debug: negativeHitDebug(address), outcome: "fail" };
    }
    accountNoProfileCache.delete(cacheKey);
  }

  const cached = accountIdentityCache.get(cacheKey);

  if (cached) {
    if (Date.now() - cached.fetchedAt <= ACCOUNT_PROFILE_CACHE_TTL_MS) {
      return { identity: cached.identity, debug: cacheHitDebug(cached), outcome: "cached" };
    }
    accountIdentityCache.delete(cacheKey);
  }

  const accountFetch = await fetchAccountWithDiagnostic(address);
  const account = accountFetch.account;
  const resolveFetch = hasReadableAccountName(account) && hasAccountEns(account)
    ? notAttemptedDiagnostic()
    : await fetchResolvedAccountWithDiagnostic(address);
  const resolvedAccount = resolveFetch.account;
  const identity = normalizeOpenSeaAccountIdentity(address, account, resolvedAccount);
  const debug = accountIdentityDebug(address, accountFetch, resolveFetch, identity);
  const shouldCache = hasCompleteIdentityForCache(identity, account);

  if (shouldCache) {
    accountIdentityCache.set(cacheKey, {
      fetchedAt: Date.now(),
      identity,
      debug,
    });
  } else if (!hasSuccessfulIdentity(identity, account, resolvedAccount)) {
    // Hard negative: OpenSea responded (not a transient failure) but returned no usable identity.
    // Covers clean 404s and 200s with empty profiles. Soft failures (timeout, 429, 5xx, network
    // error) are excluded so refresh can still recover from transient conditions.
    const isSoftFailure =
      accountFetch.status === "timeout" ||
      accountFetch.status === "error" ||
      accountFetch.status === 429 ||
      (typeof accountFetch.status === "number" && accountFetch.status >= 500);
    if (!isSoftFailure) {
      accountNoProfileCache.set(cacheKey, { fetchedAt: Date.now() });
    }
  }

  return { identity, debug, outcome: shouldCache ? "ok" : "fail" };
}

function accountIdentityDebug(
  address: string,
  accountFetch: OpenSeaAccountFetchDiagnostic,
  resolveFetch: OpenSeaAccountFetchDiagnostic,
  identity: OpenSeaAccountIdentity,
): AccountIdentityDebug {
  const account = accountFetch.account;
  const resolvedAccount = resolveFetch.account;

  return {
    address,
    cacheHit: false,
    cachedHadAvatar: false,
    accountFetchAttempted: accountFetch.attempted,
    accountFetchStatus: accountFetch.status,
    accountFetchError: accountFetch.error,
    accountFetchHadBody: accountFetch.hadBody,
    accountFetchUsername: usernameForDebug(account),
    accountFetchProfileImageUrl: profileImageForDebug(account),
    resolveFetchAttempted: resolveFetch.attempted,
    resolveFetchStatus: resolveFetch.status,
    resolveFetchError: resolveFetch.error,
    resolveFetchEns: ensForDebug(resolvedAccount),
    rawAccount: account
      ? {
          username: account.username,
          display_name: account.display_name,
          displayName: account.displayName,
          name: account.name,
          profile_image_url: account.profile_image_url,
          profileImageUrl: account.profileImageUrl,
          image_url: account.image_url,
          imageUrl: account.imageUrl,
          avatar_url: account.avatar_url,
          avatarUrl: account.avatarUrl,
          avatar: account.avatar,
        }
      : null,
    rawResolve: resolvedAccount
      ? {
          ens: resolvedAccount.ens,
          ens_name: resolvedAccount.ens_name,
          ensName: resolvedAccount.ensName,
        }
      : null,
    finalUsername: identity.username,
    finalDisplayName: identity.displayName,
    finalEns: identity.ens,
    finalAvatarUrl: identity.avatarUrl,
    identitySource: identity.identitySource,
    avatarBeforeMapping: Boolean(identity.avatarUrl || identity.profileImageUrl || identity.imageUrl),
  };
}

function hasReadableAccountName(account?: OsAccount | null): boolean {
  return Boolean(
    account?.username?.trim() ||
      account?.display_name?.trim() ||
      account?.displayName?.trim() ||
      account?.name?.trim() ||
      account?.ens?.trim() ||
      account?.ens_name?.trim() ||
      account?.ensName?.trim() ||
      account?.account?.username?.trim() ||
      account?.account?.display_name?.trim() ||
      account?.account?.displayName?.trim() ||
      account?.account?.name?.trim() ||
      account?.account?.ens?.trim() ||
      account?.account?.ens_name?.trim() ||
      account?.account?.ensName?.trim() ||
      account?.user?.username?.trim() ||
      account?.user?.display_name?.trim() ||
      account?.user?.displayName?.trim() ||
      account?.user?.name?.trim() ||
      account?.user?.ens?.trim() ||
      account?.user?.ens_name?.trim() ||
      account?.user?.ensName?.trim(),
  );
}

function hasAccountAvatar(account?: OsAccount | null): boolean {
  return Boolean(
    account?.profile_image_url?.trim() ||
      account?.profileImageUrl?.trim() ||
      account?.image_url?.trim() ||
      account?.imageUrl?.trim() ||
      account?.avatar_url?.trim() ||
      account?.avatarUrl?.trim() ||
      account?.avatar?.trim() ||
      account?.account?.profile_image_url?.trim() ||
      account?.account?.profileImageUrl?.trim() ||
      account?.account?.image_url?.trim() ||
      account?.account?.imageUrl?.trim() ||
      account?.account?.avatar_url?.trim() ||
      account?.account?.avatarUrl?.trim() ||
      account?.account?.avatar?.trim() ||
      account?.user?.profile_image_url?.trim() ||
      account?.user?.profileImageUrl?.trim() ||
      account?.user?.image_url?.trim() ||
      account?.user?.imageUrl?.trim() ||
      account?.user?.avatar_url?.trim() ||
      account?.user?.avatarUrl?.trim() ||
      account?.user?.avatar?.trim(),
  );
}

function hasAccountEns(account?: OsAccount | null): boolean {
  return Boolean(
    account?.ens?.trim() ||
      account?.ens_name?.trim() ||
      account?.ensName?.trim() ||
      account?.account?.ens?.trim() ||
      account?.account?.ens_name?.trim() ||
      account?.account?.ensName?.trim() ||
      account?.user?.ens?.trim() ||
      account?.user?.ens_name?.trim() ||
      account?.user?.ensName?.trim(),
  );
}

function hasSuccessfulIdentity(
  identity: OpenSeaAccountIdentity,
  account?: OsAccount | null,
  resolvedAccount?: OsAccount | null,
): boolean {
  return Boolean(
    identity.username ||
      identity.ens ||
      identity.avatarUrl ||
      identity.profileImageUrl ||
      identity.imageUrl ||
      hasReadableAccountName(account) ||
      hasReadableAccountName(resolvedAccount) ||
      hasAccountAvatar(account) ||
      hasAccountAvatar(resolvedAccount),
  );
}

function hasCompleteIdentityForCache(
  identity: OpenSeaAccountIdentity,
  account?: OsAccount | null,
): boolean {
  return Boolean(account && hasSuccessfulIdentity(identity, account, null));
}

function hydrationSummary(
  log: AccountHydrationOutcome[],
  limit: number,
  concurrency: number,
  requested: number,
  unique: number,
  durationMs: number,
): AccountHydrationSummary {
  return {
    ok: log.filter((entry) => entry.outcome === "ok").length,
    fail: log.filter((entry) => entry.outcome === "fail").length,
    cached: log.filter((entry) => entry.outcome === "cached").length,
    skip: log.filter((entry) => entry.outcome === "skip").length,
    withAvatar: log.filter((entry) => entry.hasAvatar).length,
    withEns: log.filter((entry) => entry.hasEns).length,
    withUsername: log.filter((entry) => entry.hasUsername).length,
    failures: log.filter((entry) => entry.outcome === "fail").map((entry) => entry.address),
    limit,
    concurrency,
    requested,
    unique,
    durationMs,
  };
}

export async function hydrateAccountIdentities(
  addresses: string[],
  options: {
    limit?: number;
    concurrency?: number;
  } = {},
): Promise<AccountHydrationResult> {
  const startedAt = nowMs();
  const limit = options.limit ?? ACCOUNT_HYDRATION_LIMIT;
  const concurrency = options.concurrency ?? ACCOUNT_HYDRATION_CONCURRENCY;
  const orderedUniqueAddresses = Array.from(
    new Set(addresses.map((address) => address.toLowerCase())),
  );
  const limitedAddresses = orderedUniqueAddresses.slice(0, limit);
  const skippedAddresses = orderedUniqueAddresses.slice(limit);
  const log: AccountHydrationOutcome[] = skippedAddresses.map((address) => ({
    address,
    outcome: "skip",
    hasAvatar: false,
    hasEns: false,
    hasUsername: false,
  }));

  const hydrated = await runConcurrently(
    limitedAddresses.map((address) => async () => {
      const { identity, debug, outcome } = await getAccountIdentity(address);
      const entry: HydratedAccountIdentity = {
        ...identity,
        address: identity.address || address,
        hydrated: outcome !== "fail",
        cached: outcome === "cached",
        debug,
      };

      log.push({
        address,
        outcome,
        hasAvatar: Boolean(identity.avatarUrl || identity.profileImageUrl || identity.imageUrl),
        hasEns: Boolean(identity.ens),
        hasUsername: Boolean(identity.username),
      });

      return entry;
    }),
    concurrency,
  );

  const identities = new Map<string, HydratedAccountIdentity>();
  for (let i = 0; i < hydrated.length; i++) {
    const identity = hydrated[i];
    const requestedAddress = limitedAddresses[i];
    identities.set(requestedAddress, identity);
    identities.set(identity.address.toLowerCase(), identity);
  }

  return {
    identities,
    summary: hydrationSummary(
      log,
      limit,
      concurrency,
      addresses.length,
      limitedAddresses.length,
      nowMs() - startedAt,
    ),
  };
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
  let rateLimitRetryAttempts = 0;
  let rateLimitedPageCount = 0;
  let retryExhaustedPageCount = 0;
  let lastRetryDelayMs = 0;
  let totalRetryDelayMs = 0;
  const retryDelayMsSamples: number[] = [];
  let lastRetryAfterHeader: string | undefined;
  let lastRetryAfterMs: number | undefined;

  try {
    outer: while (holderMap.size < MAX_HOLDERS_PER_COLLECTION) {
      // URLSearchParams encodes special characters (=, +, etc.) correctly.
      // OpenSea /collections/{slug}/holders uses "cursor" (not "next") as the
      // pagination query parameter, even though the response field is called "next".
      const params = new URLSearchParams({ limit: String(HOLDER_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);

      const requestUrl = `${OPENSEA_BASE}/collections/${encodeURIComponent(slug)}/holders?${params.toString()}`;
      if (requestUrls.length < 2) requestUrls.push(requestUrl);

      // Retry loop for 429 responses on this page.
      let res!: Response;
      let pageHit429 = false;

      for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          const retryAfterHeader = res.headers.get("Retry-After");
          lastRetryAfterHeader = retryAfterHeader ?? undefined;
          const retryAfterSec = retryAfterHeader
            ? Math.max(parseInt(retryAfterHeader, 10), 1)
            : null;
          const delay =
            retryAfterSec != null
              ? retryAfterSec * 1000
              : RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) * (0.75 + Math.random() * 0.5);
          lastRetryAfterMs = retryAfterSec != null ? delay : undefined;
          const delayRounded = Math.round(delay);
          lastRetryDelayMs = delayRounded;
          totalRetryDelayMs += delayRounded;
          if (retryDelayMsSamples.length < 5) retryDelayMsSamples.push(delayRounded);
          rateLimitRetryAttempts++;
          await sleep(delay);
        }

        res = await fetch(requestUrl, {
          signal: controller.signal,
          headers: { "X-API-KEY": apiKey(), Accept: "application/json" },
          cache: "no-store",
        });

        if (res.status !== 429) break;

        pageHit429 = true;

        if (attempt === MAX_RETRY_ATTEMPTS) {
          retryExhaustedPageCount++;
          stoppedReason = "rate_limited_exhausted";
          break outer;
        }
      }

      if (pageHit429 && res.status !== 429) rateLimitedPageCount++;

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

      await sleep(HOLDER_PAGE_DELAY_MS);
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
    rateLimitRetryAttempts,
    rateLimitedPageCount,
    retryExhaustedPageCount,
    lastRetryDelayMs,
    totalRetryDelayMs,
    retryDelayMsSamples,
    lastRetryAfterHeader,
    lastRetryAfterMs,
    pageDelayMs: HOLDER_PAGE_DELAY_MS,
    discoverySource: "opensea",
  };
}

export async function fetchCollectionHolders(
  slug: string,
): Promise<{ entry: HolderCacheEntry; cached: boolean }> {
  const hit = getCached(slug);
  if (hit) {
    return {
      entry: {
        ...hit,
        fetchDurationMs: 0,
      },
      cached: true,
    };
  }
  const startedAt = nowMs();
  const result = await fetchFromApi(slug);
  result.fetchDurationMs = nowMs() - startedAt;
  if (result.complete) {
    holderCache.set(slug, result);
  }
  return { entry: result, cached: false };
}

function collectionContractAndChain(collection: CollectionRef): {
  contractAddress?: string;
  chain?: string;
} {
  const firstContract = collection.contracts?.[0];
  return {
    contractAddress: firstContract?.address || collection.contract,
    chain: firstContract?.chain || collection.chain || "ethereum",
  };
}

function emptyAlchemyFallbackEntry(
  reason: AlchemyFallbackReason,
): Pick<
  HolderCacheEntry,
  | "discoverySource"
  | "fallbackReason"
  | "usableOwnerCount"
  | "blockedOwnerCount"
  | "invalidOwnerCount"
  | "missingTokenBalanceOwnerCount"
  | "unsafeTokenBalanceCount"
> {
  return {
    discoverySource: "opensea",
    fallbackReason: reason,
    usableOwnerCount: undefined,
    blockedOwnerCount: undefined,
    invalidOwnerCount: undefined,
    missingTokenBalanceOwnerCount: undefined,
    unsafeTokenBalanceCount: undefined,
  };
}

function logAlchemyFallback(
  collection: CollectionRef,
  reason: AlchemyFallbackReason,
  chain?: string,
): void {
  const unexpectedProductionError = reason === "server_error";
  if (process.env.NODE_ENV === "development" || unexpectedProductionError) {
    console.warn("[jpgs/holder-discovery] Alchemy holder discovery fallback", {
      slug: collection.slug,
      chain: chain ?? null,
      reason,
    });
  }
}

async function fetchAlchemyCollectionHolders(
  collection: CollectionRef,
): Promise<
  | { status: "ok"; value: { entry: HolderCacheEntry; cached: boolean } }
  | { status: "fallback"; reason: AlchemyFallbackReason }
> {
  const { contractAddress, chain } = collectionContractAndChain(collection);

  if (!contractAddress) {
    return { status: "fallback", reason: "missing_contract" };
  }

  const network = alchemyNetworkForChain(chain);
  if (!network) {
    logAlchemyFallback(collection, "unmapped_chain", chain);
    return { status: "fallback", reason: "unmapped_chain" };
  }

  const cacheKey = `alchemy:${network}:${contractAddress.toLowerCase()}`;
  const hit = getCached(cacheKey);
  if (hit) {
    return {
      status: "ok",
      value: {
        entry: {
          ...hit,
          fetchDurationMs: 0,
        },
        cached: true,
      },
    };
  }

  try {
    const startedAt = nowMs();
    const result = await fetchAlchemyOwnersForContract({ contractAddress, chain });
    const fetchDurationMs = nowMs() - startedAt;
    const holders = result.owners;
    const entry: HolderCacheEntry = {
      fetchedAt: Date.now(),
      holders,
      complete: result.stoppedReason === "complete",
      fetchedCount: holders.length,
      nextCursorStoppedReason: result.stoppedReason,
      pageCount: result.pageCount,
      rawRowsFetched: result.rawOwnerCount,
      uniqueHolderCount: holders.length,
      duplicateHolderRows: Math.max(0, result.rawOwnerCount - holders.length),
      firstPageFirstHolder: holders[0]?.address,
      lastPageFirstHolder: holders[0]?.address,
      cursorChanged: result.pageCount > 1,
      requestUrls: [],
      rateLimitRetryAttempts: 0,
      rateLimitedPageCount: 0,
      retryExhaustedPageCount: 0,
      lastRetryDelayMs: 0,
      totalRetryDelayMs: 0,
      retryDelayMsSamples: [],
      lastRetryAfterHeader: undefined,
      lastRetryAfterMs: undefined,
      pageDelayMs: 0,
      discoverySource: "alchemy",
      usableOwnerCount: result.usableOwnerCount,
      blockedOwnerCount: result.blockedOwnerCount,
      invalidOwnerCount: result.invalidOwnerCount,
      missingTokenBalanceOwnerCount: result.missingTokenBalanceOwnerCount,
      unsafeTokenBalanceCount: result.unsafeTokenBalanceCount,
      fetchDurationMs,
    };

    holderCache.set(cacheKey, entry);
    return { status: "ok", value: { entry, cached: false } };
  } catch (error: unknown) {
    const reason =
      error instanceof AlchemyOwnerFetchError ? error.reason : "server_error";
    logAlchemyFallback(collection, reason, chain);
    return { status: "fallback", reason };
  }
}

async function fetchCollectionHoldersForDiscovery(
  collection: CollectionRef,
): Promise<{
  entry: HolderCacheEntry;
  cached: boolean;
  alchemyFetchDurationMs?: number;
  openseaFetchDurationMs?: number;
}> {
  const alchemyStartedAt = nowMs();
  const alchemyAttempt = await fetchAlchemyCollectionHolders(collection);
  const alchemyFetchDurationMs = nowMs() - alchemyStartedAt;
  if (alchemyAttempt.status === "ok") {
    return {
      ...alchemyAttempt.value,
      alchemyFetchDurationMs,
    };
  }

  const openseaStartedAt = nowMs();
  const result = await fetchCollectionHolders(collection.slug);
  const openseaFetchDurationMs = nowMs() - openseaStartedAt;
  return {
    ...result,
    alchemyFetchDurationMs,
    openseaFetchDurationMs,
    entry: {
      ...result.entry,
      ...emptyAlchemyFallbackEntry(alchemyAttempt.reason),
    },
  };
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export async function discoverWalletsForCollections(
  collections: CollectionRef[],
  options: { maxCollections?: number } = {},
): Promise<DiscoveryResult> {
  const maxCollections = options.maxCollections ?? MAX_COLLECTIONS_PER_DISCOVERY;
  const limited = collections.slice(0, maxCollections);

  type SettledResult =
    | {
        status: "fulfilled";
        value: {
          entry: HolderCacheEntry;
          cached: boolean;
          alchemyFetchDurationMs?: number;
          openseaFetchDurationMs?: number;
        };
      }
    | { status: "rejected"; reason: unknown };

  const settled = await runConcurrently(
    limited.map((col) => async (): Promise<SettledResult> => {
      try {
        const value = await fetchCollectionHoldersForDiscovery(col);
        return { status: "fulfilled", value };
      } catch (reason) {
        return { status: "rejected", reason };
      }
    }),
    COLLECTION_FETCH_CONCURRENCY,
  );

  const collectionsFetched: CollectionFetchDebug[] = [];
  const errors: string[] = [];
  const holdersBySlug = new Map<string, HolderRecord[]>();

  for (let i = 0; i < limited.length; i++) {
    const col = limited[i];
    const result = settled[i];
    const endpointPath = `/api/v2/collections/${col.slug}/holders`;
    if (result.status === "fulfilled") {
      const { entry, cached, alchemyFetchDurationMs, openseaFetchDurationMs } = result.value;
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
        rateLimitRetryAttempts: entry.rateLimitRetryAttempts,
        rateLimitedPageCount: entry.rateLimitedPageCount,
        retryExhaustedPageCount: entry.retryExhaustedPageCount,
        lastRetryDelayMs: entry.lastRetryDelayMs,
        totalRetryDelayMs: entry.totalRetryDelayMs,
        retryDelayMsSamples: entry.retryDelayMsSamples,
        lastRetryAfterHeader: entry.lastRetryAfterHeader,
        lastRetryAfterMs: entry.lastRetryAfterMs,
        pageDelayMs: entry.pageDelayMs,
        discoverySource: entry.discoverySource,
        fallbackReason: entry.fallbackReason,
        usableOwnerCount: entry.usableOwnerCount,
        blockedOwnerCount: entry.blockedOwnerCount,
        invalidOwnerCount: entry.invalidOwnerCount,
        missingTokenBalanceOwnerCount: entry.missingTokenBalanceOwnerCount,
        unsafeTokenBalanceCount: entry.unsafeTokenBalanceCount,
        fetchDurationMs: entry.fetchDurationMs,
        alchemyFetchDurationMs,
        openseaFetchDurationMs,
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
        rateLimitRetryAttempts: 0,
        rateLimitedPageCount: 0,
        retryExhaustedPageCount: 0,
        lastRetryDelayMs: 0,
        totalRetryDelayMs: 0,
        retryDelayMsSamples: [],
        lastRetryAfterHeader: undefined,
        lastRetryAfterMs: undefined,
        pageDelayMs: HOLDER_PAGE_DELAY_MS,
        discoverySource: "opensea",
        fallbackReason: undefined,
        usableOwnerCount: undefined,
        blockedOwnerCount: undefined,
        invalidOwnerCount: undefined,
        missingTokenBalanceOwnerCount: undefined,
        unsafeTokenBalanceCount: undefined,
        fetchDurationMs: 0,
        alchemyFetchDurationMs: undefined,
        openseaFetchDurationMs: undefined,
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
          contract: col.contract,
          chain: col.chain,
          contracts: col.contracts,
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

  // Rank: matchedCollectionCount desc → balanced collection depth desc → totalHeldFromSelected desc → address asc
  const ranked = Array.from(walletMap.values())
    .map((wallet) => ({
      wallet,
      collectionDepthScore: collectionDepthScore(wallet.matchedCollections),
    }))
    .sort((a, b) => {
      if (b.wallet.matchedCollectionCount !== a.wallet.matchedCollectionCount)
        return b.wallet.matchedCollectionCount - a.wallet.matchedCollectionCount;
      if (b.collectionDepthScore !== a.collectionDepthScore)
        return b.collectionDepthScore - a.collectionDepthScore;
      if (b.wallet.totalHeldFromSelected !== a.wallet.totalHeldFromSelected)
        return b.wallet.totalHeldFromSelected - a.wallet.totalHeldFromSelected;
      return a.wallet.address.localeCompare(b.wallet.address);
    })
    .map(({ wallet }) => wallet);

  return {
    wallets: ranked,
    debug: {
      holderSource: "opensea_collection_holders",
      maxHoldersPerCollection: MAX_HOLDERS_PER_COLLECTION,
      collectionsFetched,
      partial: errors.length > 0 || collectionsFetched.some((c) => !c.complete),
      errors,
      collectionFetchConcurrency: COLLECTION_FETCH_CONCURRENCY,
      candidateHolderCount: walletMap.size,
    },
  };
}
