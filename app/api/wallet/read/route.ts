import { NextRequest, NextResponse } from "next/server";
import { classifyNftTaste, type NormalizedNft } from "@/lib/jpgs/classifyNftTaste";
import { TASTE_CATEGORY_LABELS, type TasteCategory } from "@/lib/jpgs/tasteCategories";
import {
  fetchCollectionBySlug,
  fetchWalletNfts,
  resolveWalletIdentity,
  type OsCollection,
  type OsWalletNft,
} from "@/lib/jpgs/opensea";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_VISIBLE_NFTS = 1000;
const MAX_COLLECTIONS_TO_ENRICH = 20;

type TopCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource: "collection" | "nft" | "none";
  count: number;
  openseaUrl: string;
};

type TasteSignal = {
  category: TasteCategory;
  label: string;
  nftCount: number;
  collectionCount: number;
  collections: Array<{ slug: string; name: string; count: number }>;
};

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function collectionSlug(nft: OsWalletNft): string {
  return nft.collection?.trim() || "unknown";
}

function collectionName(slug: string, collection?: OsCollection | null): string {
  return collection?.name?.trim() || slug.replace(/-/g, " ");
}

function nftImage(nft: OsWalletNft): string | undefined {
  return nft.display_image_url || nft.image_url;
}

function nftBalance(nft: OsWalletNft): number {
  const ownerQuantity = nft.owners?.[0]?.quantity;
  const quantity = nft.quantity ?? ownerQuantity ?? 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function toNormalizedNft(
  nft: OsWalletNft,
  collection?: OsCollection | null,
): NormalizedNft {
  const tokenStandard =
    nft.token_standard === "ERC721" || nft.token_standard === "ERC1155"
      ? nft.token_standard
      : "UNKNOWN";

  return {
    name: nft.name,
    description: nft.description,
    collectionSlug: collectionSlug(nft),
    collectionName: collectionName(collectionSlug(nft), collection),
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

async function enrichCollections(slugs: string[]): Promise<Map<string, OsCollection | null>> {
  const limited = slugs.slice(0, MAX_COLLECTIONS_TO_ENRICH);
  const rows = await Promise.all(limited.map((slug) => fetchCollectionBySlug(slug, 1500)));
  return new Map(limited.map((slug, index) => [slug, rows[index]]));
}

export async function GET(req: NextRequest) {
  const walletParam = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";

  if (!walletParam) {
    return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
  }

  const resolved = WALLET_RE.test(walletParam)
    ? { address: walletParam.toLowerCase() }
    : await resolveWalletIdentity(walletParam);

  if (!resolved?.address || !WALLET_RE.test(resolved.address)) {
    return NextResponse.json({ error: "Enter a valid Ethereum wallet address." }, { status: 400 });
  }

  const wallet = resolved.address.toLowerCase();
  const visible = await fetchWalletNfts(wallet, MAX_VISIBLE_NFTS);

  if (
    visible.nfts.length === 0 &&
    !["exhausted", "max_reached"].includes(visible.stoppedReason)
  ) {
    return NextResponse.json(
      { error: "Visible NFT holdings could not be fetched right now." },
      { status: 502 },
    );
  }

  const collections = new Map<
    string,
    { slug: string; count: number; firstNftImage?: string }
  >();

  for (const nft of visible.nfts) {
    const slug = collectionSlug(nft);
    const existing = collections.get(slug);
    const count = nftBalance(nft);
    if (existing) {
      existing.count += count;
      existing.firstNftImage ||= nftImage(nft);
    } else {
      collections.set(slug, {
        slug,
        count,
        firstNftImage: nftImage(nft),
      });
    }
  }

  const sortedCollectionRows = Array.from(collections.values()).sort((a, b) => b.count - a.count);
  const enriched = await enrichCollections(sortedCollectionRows.map((row) => row.slug));

  const topCollections: TopCollection[] = sortedCollectionRows.slice(0, 8).map((row) => {
    const meta = enriched.get(row.slug);
    const imageUrl = meta?.image_url || row.firstNftImage;
    return {
      slug: row.slug,
      name: collectionName(row.slug, meta),
      imageUrl,
      imageSource: meta?.image_url ? "collection" : imageUrl ? "nft" : "none",
      count: row.count,
      openseaUrl: meta?.opensea_url || `https://opensea.io/collection/${row.slug}`,
    };
  });

  const signalBuckets = new Map<
    TasteCategory,
    { nftCount: number; collections: Map<string, { name: string; count: number }> }
  >();

  for (const nft of visible.nfts) {
    const slug = collectionSlug(nft);
    const classification = classifyNftTaste(toNormalizedNft(nft, enriched.get(slug)));
    const category = classification.primaryCategory;
    const bucket =
      signalBuckets.get(category) ?? { nftCount: 0, collections: new Map() };
    const count = nftBalance(nft);
    bucket.nftCount += count;
    const meta = enriched.get(slug);
    const name = collectionName(slug, meta);
    const collectionBucket = bucket.collections.get(slug) ?? { name, count: 0 };
    collectionBucket.count += count;
    bucket.collections.set(slug, collectionBucket);
    signalBuckets.set(category, bucket);
  }

  const tasteSignals: TasteSignal[] = Array.from(signalBuckets.entries())
    .map(([category, bucket]) => {
      const signalCollections = Array.from(bucket.collections.entries())
        .map(([slug, row]) => ({ slug, name: row.name, count: row.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return {
        category,
        label: TASTE_CATEGORY_LABELS[category],
        nftCount: bucket.nftCount,
        collectionCount: bucket.collections.size,
        collections: signalCollections,
      };
    })
    .sort((a, b) => b.nftCount - a.nftCount);

  return NextResponse.json({
    wallet,
    shortWallet: shortWallet(wallet),
    nftCount: visible.nfts.reduce((sum, nft) => sum + nftBalance(nft), 0),
    collectionCount: collections.size,
    topCollections,
    tasteSignals,
    ...(process.env.NODE_ENV === "development"
      ? {
          debug: {
            source: "opensea /api/v2/chain/{chain}/account/{wallet}/nfts",
            fetchedNfts: visible.nfts.length,
            fetchedPages: visible.fetchedPages,
            chainsChecked: visible.chainsChecked,
            chainCounts: visible.chainCounts,
            fetchedPagesByChain: visible.fetchedPagesByChain,
            complete: visible.complete,
            stoppedReason: visible.stoppedReason,
            maxVisibleNfts: MAX_VISIBLE_NFTS,
            includeHidden: visible.includeHidden,
            enrichedCollections: enriched.size,
          },
        }
      : {}),
  });
}
