const ALCHEMY_OWNER_CAP = 5_000;
const ALCHEMY_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 500;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

export type AlchemyNetwork =
  | "eth-mainnet"
  | "polygon-mainnet"
  | "base-mainnet"
  | "arb-mainnet"
  | "opt-mainnet";

export type AlchemyFallbackReason =
  | "missing_api_key"
  | "missing_contract"
  | "unmapped_chain"
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "parse_error"
  | "pagination_error";

export type AlchemyOwnerRecord = {
  address: string;
  quantity: number;
};

export type AlchemyOwnersResult = {
  owners: AlchemyOwnerRecord[];
  source: "alchemy";
  stoppedReason: "complete" | "owner_cap_reached";
  network: AlchemyNetwork;
  usableOwnerCount: number;
  blockedOwnerCount: number;
  invalidOwnerCount: number;
  missingTokenBalanceOwnerCount: number;
  unsafeTokenBalanceCount: number;
  pageCount: number;
  rawOwnerCount: number;
};

export class AlchemyOwnerFetchError extends Error {
  reason: AlchemyFallbackReason;

  constructor(reason: AlchemyFallbackReason, message = reason) {
    super(message);
    this.name = "AlchemyOwnerFetchError";
    this.reason = reason;
  }
}

export function alchemyNetworkForChain(chain?: string): AlchemyNetwork | null {
  const normalized = chain?.trim().toLowerCase() || "ethereum";
  switch (normalized) {
    case "ethereum":
    case "eth":
    case "mainnet":
      return "eth-mainnet";
    case "polygon":
    case "matic":
      return "polygon-mainnet";
    case "base":
      return "base-mainnet";
    case "arbitrum":
    case "arbitrum-one":
      return "arb-mainnet";
    case "optimism":
      return "opt-mainnet";
    default:
      return null;
  }
}

function alchemyApiKey(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new AlchemyOwnerFetchError("missing_api_key");
  return key;
}

function fallbackReasonForStatus(status: number): AlchemyFallbackReason {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "server_error";
}

function shouldRetry(reason: AlchemyFallbackReason): boolean {
  return reason === "timeout" || reason === "rate_limited" || reason === "server_error";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(
  url: URL,
): Promise<{ status: number; ok: boolean; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALCHEMY_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return { status: res.status, ok: res.ok, text: await res.text() };
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    throw new AlchemyOwnerFetchError(isTimeout ? "timeout" : "server_error");
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAlchemyPage(url: URL): Promise<unknown> {
  let lastReason: AlchemyFallbackReason | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);

    try {
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        const reason = fallbackReasonForStatus(res.status);
        if (attempt === 0 && shouldRetry(reason)) {
          lastReason = reason;
          continue;
        }
        throw new AlchemyOwnerFetchError(reason);
      }

      try {
        return res.text.trim() ? JSON.parse(res.text) : {};
      } catch {
        throw new AlchemyOwnerFetchError("parse_error");
      }
    } catch (error: unknown) {
      const reason =
        error instanceof AlchemyOwnerFetchError ? error.reason : "server_error";
      if (attempt === 0 && shouldRetry(reason)) {
        lastReason = reason;
        continue;
      }
      throw error instanceof AlchemyOwnerFetchError
        ? error
        : new AlchemyOwnerFetchError(lastReason ?? "server_error");
    }
  }

  throw new AlchemyOwnerFetchError(lastReason ?? "server_error");
}

function ownerAddressFromRow(row: unknown): string | null {
  if (typeof row === "string") return row;
  if (row && typeof row === "object" && "ownerAddress" in row) {
    const ownerAddress = (row as { ownerAddress?: unknown }).ownerAddress;
    return typeof ownerAddress === "string" ? ownerAddress : null;
  }
  return null;
}

function parseTokenBalanceValue(balance: unknown): {
  quantity: number | null;
  unsafe: boolean;
} {
  if (typeof balance !== "string" && typeof balance !== "number") {
    return { quantity: null, unsafe: false };
  }

  if (typeof balance === "string" && balance.trim() === "") {
    return { quantity: null, unsafe: false };
  }

  const parsed = Number(balance);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return { quantity: null, unsafe: false };
  }

  if (!Number.isSafeInteger(parsed)) {
    return { quantity: null, unsafe: true };
  }

  return { quantity: parsed, unsafe: false };
}

function tokenBalancesFromRow(row: unknown): unknown[] | null {
  if (!row || typeof row !== "object" || !("tokenBalances" in row)) {
    return null;
  }

  const tokenBalances = (row as { tokenBalances?: unknown }).tokenBalances;
  return Array.isArray(tokenBalances) ? tokenBalances : null;
}

function heldQuantityFromRow(row: unknown): {
  quantity: number;
  missingTokenBalance: boolean;
  unsafeTokenBalanceCount: number;
} {
  const tokenBalances = tokenBalancesFromRow(row);
  if (!tokenBalances || tokenBalances.length === 0) {
    return {
      quantity: 1,
      missingTokenBalance: true,
      unsafeTokenBalanceCount: 0,
    };
  }

  let quantity = 0;
  let unsafeTokenBalanceCount = 0;

  for (const tokenBalance of tokenBalances) {
    const balance =
      tokenBalance && typeof tokenBalance === "object" && "balance" in tokenBalance
        ? (tokenBalance as { balance?: unknown }).balance
        : undefined;
    const parsed = parseTokenBalanceValue(balance);
    if (parsed.unsafe) {
      unsafeTokenBalanceCount++;
      continue;
    }
    if (parsed.quantity === null) continue;
    if (quantity > Number.MAX_SAFE_INTEGER - parsed.quantity) {
      unsafeTokenBalanceCount++;
      continue;
    }
    quantity += parsed.quantity;
  }

  if (quantity <= 0) {
    return {
      quantity: 1,
      missingTokenBalance: true,
      unsafeTokenBalanceCount,
    };
  }

  return {
    quantity,
    missingTokenBalance: false,
    unsafeTokenBalanceCount,
  };
}

export async function fetchAlchemyOwnersForContract({
  contractAddress,
  chain,
}: {
  contractAddress: string;
  chain?: string;
}): Promise<AlchemyOwnersResult> {
  const cleanContract = contractAddress.trim();
  if (!cleanContract) throw new AlchemyOwnerFetchError("missing_contract");

  const network = alchemyNetworkForChain(chain);
  if (!network) throw new AlchemyOwnerFetchError("unmapped_chain");

  const apiKey = alchemyApiKey();
  const owners = new Map<string, number>();
  const seenPageKeys = new Set<string>();
  let pageKey: string | undefined;
  let stoppedReason: AlchemyOwnersResult["stoppedReason"] = "complete";
  let blockedOwnerCount = 0;
  let invalidOwnerCount = 0;
  let missingTokenBalanceOwnerCount = 0;
  let unsafeTokenBalanceCount = 0;
  let rawOwnerCount = 0;
  let pageCount = 0;

  while (owners.size < ALCHEMY_OWNER_CAP) {
    const url = new URL("https://example.com");
    url.hostname = `${network}.g.alchemy.com`;
    url.pathname = `/nft/v3/${apiKey}/getOwnersForContract`;
    url.searchParams.set("contractAddress", cleanContract);
    url.searchParams.set("withTokenBalances", "true");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const data = await fetchAlchemyPage(url) as {
      owners?: unknown[];
      pageKey?: unknown;
    };
    if (!Array.isArray(data.owners)) {
      throw new AlchemyOwnerFetchError("parse_error");
    }

    pageCount++;
    rawOwnerCount += data.owners.length;

    for (const row of data.owners) {
      const rawAddress = ownerAddressFromRow(row);
      if (!rawAddress || !WALLET_RE.test(rawAddress)) {
        invalidOwnerCount++;
        continue;
      }

      const address = rawAddress.toLowerCase();
      if (address === ZERO_ADDRESS || address === DEAD_ADDRESS) {
        blockedOwnerCount++;
        continue;
      }

      if (!owners.has(address)) {
        const quantityResult = heldQuantityFromRow(row);
        owners.set(address, quantityResult.quantity);
        if (quantityResult.missingTokenBalance) missingTokenBalanceOwnerCount++;
        unsafeTokenBalanceCount += quantityResult.unsafeTokenBalanceCount;
      }

      if (owners.size >= ALCHEMY_OWNER_CAP) {
        stoppedReason = "owner_cap_reached";
        break;
      }
    }

    if (owners.size >= ALCHEMY_OWNER_CAP) break;
    if (typeof data.pageKey !== "string" || !data.pageKey) break;
    if (seenPageKeys.has(data.pageKey)) {
      throw new AlchemyOwnerFetchError("pagination_error");
    }
    seenPageKeys.add(data.pageKey);
    pageKey = data.pageKey;
  }

  return {
    owners: Array.from(owners, ([address, quantity]) => ({ address, quantity })),
    source: "alchemy",
    stoppedReason,
    network,
    usableOwnerCount: owners.size,
    blockedOwnerCount,
    invalidOwnerCount,
    missingTokenBalanceOwnerCount,
    unsafeTokenBalanceCount,
    pageCount,
    rawOwnerCount,
  };
}
