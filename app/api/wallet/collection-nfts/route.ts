import { type NextRequest, NextResponse } from "next/server";

const OPENSEA_BASE = "https://api.opensea.io/api/v2";

// Chains searched in order. ethereum first because that's where most relevant NFTs live.
const PREVIEW_CHAINS = ["ethereum", "base", "polygon", "arbitrum", "optimism", "zora"] as const;

// Return at most this many previews. Enough to show 8 tiles + a "+N more" tile.
const MAX_PREVIEWS = 12;

const CONTRACT_RE = /^0x[0-9a-f]{10,}$/i;

function apiKey(): string {
  const k = process.env.OPENSEA_API_KEY;
  if (!k) throw new Error("OPENSEA_API_KEY is not set");
  return k;
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
};

type OsAccountNftsResponse = {
  nfts?: OsAccountNft[];
};

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

  const nfts: NftPreview[] = [];
  let partial = false;
  const key = apiKey();

  for (const chain of PREVIEW_CHAINS) {
    if (nfts.length >= MAX_PREVIEWS) {
      partial = true;
      break;
    }

    const params = new URLSearchParams({
      collection: slug,
      limit: "50",
      include_hidden: "false",
    });

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
        // Rate-limited: stop searching further chains.
        if (res.status === 429) { partial = true; break; }
        // Any other error: skip this chain silently.
        continue;
      }

      const data = (await res.json()) as OsAccountNftsResponse;

      for (const nft of data.nfts ?? []) {
        if (nfts.length >= MAX_PREVIEWS) { partial = true; break; }
        nfts.push({
          tokenId: nft.identifier ?? "",
          name: nft.name ?? null,
          imageUrl: nft.display_image_url ?? nft.image_url ?? null,
          openseaUrl: nft.opensea_url ?? null,
        });
      }
    } catch {
      // Timeout or network error — skip this chain.
      continue;
    }
  }

  return NextResponse.json({ nfts, partial });
}
