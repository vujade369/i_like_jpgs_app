import { type NextRequest, NextResponse } from "next/server";
import { alchemyNetworkForChain } from "@/lib/jpgs/alchemy";

const OPENSEA_BASE = "https://api.opensea.io/api/v2";

// Chains searched in order. ethereum first because that's where most relevant NFTs live.
const PREVIEW_CHAINS = ["ethereum", "base", "polygon", "arbitrum", "optimism", "zora"] as const;

// Safety cap: return at most this many NFTs for a selected collection.
const MAX_PREVIEWS = 100;

const CONTRACT_RE = /^0x[0-9a-f]{10,}$/i;
const WALLET_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function openseatApiKey(): string {
  const k = process.env.OPENSEA_API_KEY;
  if (!k) throw new Error("OPENSEA_API_KEY is not set");
  return k;
}

function alchemyApiKey(): string {
  return process.env.ALCHEMY_API_KEY ?? "";
}

type NftPreview = {
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  openseaUrl: string | null;
};

type OsAccountNft = {
  identifier?: string;
  name?: string;
  image_url?: string;
  display_image_url?: string;
  opensea_url?: string;
  contract?: string;
};

type OsAccountNftsResponse = {
  nfts?: OsAccountNft[];
  next?: string | null;
};

type ContractEntry = { address: string; chain: string };

type AlchemyNftItem = {
  tokenId?: string;
  name?: string;
  image?: {
    cachedUrl?: string;
    thumbnailUrl?: string;
    originalUrl?: string;
  };
  raw?: { metadata?: { image?: string; name?: string } };
};

type AlchemyNftsResponse = {
  ownedNfts?: AlchemyNftItem[];
  pageKey?: string;
};

function openseaAssetUrl(
  chain: string | undefined,
  contract: string | undefined,
  tokenId: string | undefined,
): string | undefined {
  if (!contract || !tokenId) return undefined;
  const normalizedChain = (chain || "ethereum").toLowerCase();
  const openseaChain =
    normalizedChain === "polygon" ? "matic" :
    normalizedChain === "mainnet" ? "ethereum" :
    normalizedChain;
  return `https://opensea.io/assets/${openseaChain}/${contract}/${tokenId}`;
}

function normalizeTokenId(tokenId: string | undefined): string | undefined {
  if (!tokenId) return undefined;
  if (tokenId.startsWith("0x") || tokenId.startsWith("0X")) {
    try {
      return BigInt(tokenId).toString(10);
    } catch {
      return tokenId;
    }
  }
  return tokenId;
}

// Parse contracts from repeated "contracts" param entries (each: "0xADDR:chain" or "0xADDR")
// and from fallback single "contract"+"chain" params.
function parseContractsParam(
  contractsParam: string[],
  contractParam: string | null,
  chainParam: string | null,
): ContractEntry[] {
  const seen = new Set<string>();
  const entries: ContractEntry[] = [];

  function addEntry(address: string, chain: string) {
    const addr = address.toLowerCase();
    const key = `${addr}:${chain.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ address: addr, chain: chain.toLowerCase() });
  }

  for (const raw of contractsParam) {
    // Format: "0xADDR:chain" — address is always 42 chars (0x + 40 hex), no colons in it.
    const colonIdx = raw.indexOf(":", 2);
    if (colonIdx > 0) {
      const addr = raw.slice(0, colonIdx);
      const chain = raw.slice(colonIdx + 1).trim();
      if (WALLET_ADDRESS_RE.test(addr) && chain) addEntry(addr, chain);
    } else if (WALLET_ADDRESS_RE.test(raw)) {
      addEntry(raw, "ethereum");
    }
  }

  if (entries.length === 0 && contractParam && WALLET_ADDRESS_RE.test(contractParam)) {
    addEntry(contractParam, chainParam?.trim() || "ethereum");
  }

  return entries;
}

async function fetchAlchemyNftsForOwner(
  owner: string,
  contractAddress: string,
  network: string,
  apiKey: string,
  pageKey?: string,
): Promise<AlchemyNftsResponse> {
  const url = new URL(
    `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`,
  );
  url.searchParams.set("owner", owner);
  url.searchParams.append("contractAddresses[]", contractAddress);
  url.searchParams.set("withMetadata", "true");
  url.searchParams.set("pageSize", "100");
  if (pageKey) url.searchParams.set("pageKey", pageKey);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
  return res.json() as Promise<AlchemyNftsResponse>;
}

async function fetchNftsViaAlchemy(
  owner: string,
  contracts: ContractEntry[],
): Promise<{ nfts: NftPreview[]; partial: boolean } | null> {
  const key = alchemyApiKey();
  if (!key) return null;

  const usable = contracts
    .map((c) => ({ address: c.address, chain: c.chain, network: alchemyNetworkForChain(c.chain) }))
    .filter((c): c is { address: string; chain: string; network: NonNullable<ReturnType<typeof alchemyNetworkForChain>> } =>
      c.network !== null,
    );

  if (usable.length === 0) return null;

  const seen = new Set<string>();
  const nfts: NftPreview[] = [];
  let partial = false;

  for (const { address: contractAddress, chain, network } of usable) {
    if (nfts.length >= MAX_PREVIEWS) { partial = true; break; }

    let pageKey: string | undefined;
    do {
      try {
        const data = await fetchAlchemyNftsForOwner(owner, contractAddress, network, key, pageKey);
        for (const item of data.ownedNfts ?? []) {
          if (nfts.length >= MAX_PREVIEWS) { partial = true; break; }
          const rawTokenId = item.tokenId ?? "";
          const tokenId = normalizeTokenId(rawTokenId) ?? rawTokenId;
          const dedupeKey = `${contractAddress}:${tokenId}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          const imageUrl =
            item.image?.cachedUrl ??
            item.image?.thumbnailUrl ??
            item.image?.originalUrl ??
            item.raw?.metadata?.image ??
            null;
          nfts.push({
            tokenId,
            name: item.name ?? item.raw?.metadata?.name ?? null,
            imageUrl,
            openseaUrl: openseaAssetUrl(chain, contractAddress, tokenId) ?? null,
          });
        }
        pageKey = nfts.length < MAX_PREVIEWS ? data.pageKey : undefined;
      } catch {
        pageKey = undefined;
      }
    } while (pageKey);
  }

  return { nfts, partial };
}

async function fetchNftsViaOpensea(
  address: string,
  slug: string,
  key: string,
): Promise<{ nfts: NftPreview[]; partial: boolean }> {
  const nfts: NftPreview[] = [];
  let partial = false;

  for (const chain of PREVIEW_CHAINS) {
    if (nfts.length >= MAX_PREVIEWS) { partial = true; break; }

    let cursor: string | null = null;

    do {
      const params = new URLSearchParams({
        collection: slug,
        limit: "50",
        include_hidden: "true",
      });
      if (cursor) params.set("next", cursor);

      try {
        const res = await fetch(
          `${OPENSEA_BASE}/chain/${chain}/account/${encodeURIComponent(address)}/nfts?${params.toString()}`,
          {
            cache: "no-store",
            headers: { "X-API-KEY": key, Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
          },
        );

        if (!res.ok) {
          if (res.status === 429) { partial = true; cursor = null; break; }
          cursor = null; break;
        }

        const data = (await res.json()) as OsAccountNftsResponse;

        for (const nft of data.nfts ?? []) {
          if (nfts.length >= MAX_PREVIEWS) { partial = true; break; }
          const tokenId = nft.identifier ?? "";
          const builtUrl = openseaAssetUrl(chain, nft.contract, tokenId);
          nfts.push({
            tokenId,
            name: nft.name ?? null,
            imageUrl: nft.display_image_url ?? nft.image_url ?? null,
            openseaUrl: nft.opensea_url ?? builtUrl ?? null,
          });
        }

        cursor = nfts.length < MAX_PREVIEWS ? (data.next ?? null) : null;
      } catch {
        cursor = null;
      }
    } while (cursor);
  }

  return { nfts, partial };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const address = searchParams.get("address")?.trim() ?? "";
  const slug = searchParams.get("slug")?.trim() ?? "";

  if (!address || !slug) {
    return NextResponse.json({ error: "Missing address or slug" }, { status: 400 });
  }

  // Raw contract identifiers are not valid slugs — return empty rather than a bad query.
  if (CONTRACT_RE.test(slug)) {
    return NextResponse.json({ nfts: [], partial: false });
  }

  const contractParam = searchParams.get("contract")?.trim() ?? null;
  const chainParam = searchParams.get("chain")?.trim() ?? null;
  const contractsParam = searchParams.getAll("contracts");
  const contracts = parseContractsParam(contractsParam, contractParam, chainParam);

  // Alchemy primary path — used when contract data is available.
  if (contracts.length > 0) {
    const alchemyResult = await fetchNftsViaAlchemy(address, contracts).catch(() => null);
    if (alchemyResult !== null && alchemyResult.nfts.length > 0) {
      return NextResponse.json(alchemyResult);
    }
    // Alchemy returned nothing or failed — fall through to OpenSea slug query.
  }

  // OpenSea slug path — primary when no contracts, fallback otherwise.
  const osResult = await fetchNftsViaOpensea(address, slug, openseatApiKey());
  return NextResponse.json(osResult);
}
