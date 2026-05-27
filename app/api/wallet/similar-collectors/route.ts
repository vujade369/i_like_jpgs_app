import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  type CollectionRef,
} from "@/lib/jpgs/holderDiscovery";
import { fetchAccount } from "@/lib/jpgs/opensea";

const MAX_COLLECTIONS = 22;
const MAX_COLLECTORS = 5;
const MIN_SHARED_COLLECTIONS = 2;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

type SimilarCollectorsBody = {
  sourceWallets?: string[];
  collections?: Array<{
    slug?: string;
    name?: string;
    imageUrl?: string;
    image_url?: string;
  }>;
};

function shortWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeWallet(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  return WALLET_RE.test(trimmed) ? trimmed : null;
}

function collectionRefsFromBody(body: SimilarCollectorsBody): CollectionRef[] {
  const seen = new Set<string>();
  const refs: CollectionRef[] = [];

  for (const collection of body.collections ?? []) {
    const slug = collection.slug?.trim();
    if (!slug) continue;

    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push({
      slug,
      name: collection.name?.trim() || slug.replace(/-/g, " "),
      image_url: collection.image_url || collection.imageUrl,
    });

    if (refs.length >= MAX_COLLECTIONS) break;
  }

  return refs;
}

export async function POST(req: NextRequest) {
  let body: SimilarCollectorsBody;
  try {
    body = (await req.json()) as SimilarCollectorsBody;
  } catch {
    return NextResponse.json({ collectors: [] });
  }

  const collections = collectionRefsFromBody(body);
  const collectionsReceived = body.collections?.length ?? 0;

  if (collections.length < 2) {
    return NextResponse.json({ collectors: [] });
  }

  const excludedWallets = new Set(
    (body.sourceWallets ?? [])
      .map(normalizeWallet)
      .filter((address): address is string => Boolean(address)),
  );

  const discovery = await discoverWalletsForCollections(collections, {
    maxCollections: MAX_COLLECTIONS,
  }).catch(() => null);

  if (!discovery) {
    return NextResponse.json({ collectors: [] });
  }

  const matches = discovery.wallets
    .filter((wallet) => !excludedWallets.has(wallet.address.toLowerCase()))
    .filter((wallet) => wallet.matchedCollectionCount >= MIN_SHARED_COLLECTIONS)
    .slice(0, MAX_COLLECTORS);
  const collectionsWithUsableHolders = discovery.debug.collectionsFetched.filter(
    (collection) => collection.fetchedCount > 0,
  );
  const contributingCollectionSlugs = Array.from(
    new Set(
      matches.flatMap((wallet) =>
        wallet.matchedCollections.map((collection) => collection.slug),
      ),
    ),
  );

  const collectors = await Promise.all(
    matches.map(async (wallet) => {
      const profile = await fetchAccount(wallet.address);
      const displayName =
        profile?.display_name?.trim() ||
        profile?.username?.trim() ||
        profile?.ens?.trim() ||
        profile?.ens_name?.trim() ||
        shortWallet(wallet.address);
      const avatarUrl =
        profile?.profile_image_url ||
        profile?.image_url ||
        profile?.avatar_url ||
        profile?.avatar ||
        undefined;
      const openseaProfileUrl = profile?.username
        ? `https://opensea.io/${profile.username}`
        : `https://opensea.io/${wallet.address}`;

      return {
        address: wallet.address,
        shortWallet: shortWallet(wallet.address),
        displayName,
        avatarUrl,
        openseaProfileUrl,
        matchedCollections: wallet.matchedCollections,
        sharedCollectionCount: wallet.matchedCollectionCount,
        totalHeldFromSelected: wallet.totalHeldFromSelected,
        reason:
          wallet.matchedCollectionCount === 1
            ? "Seen across 1 shared collection"
            : `Seen across ${wallet.matchedCollectionCount} shared collections`,
      };
    }),
  );

  return NextResponse.json({
    collectors,
    ...(process.env.NODE_ENV === "development"
      ? {
          debug: {
            collectionsAttempted: collections.length,
            collectionsReceived,
            maxCollections: MAX_COLLECTIONS,
            collectionsWithUsableHolders: collectionsWithUsableHolders.length,
            partial: discovery.debug.partial,
            errors: discovery.debug.errors,
            collectionsFetched: discovery.debug.collectionsFetched.length,
            collectionsCompleted: discovery.debug.collectionsFetched.filter((collection) => collection.complete).length,
            collectionsContributingToResults: contributingCollectionSlugs.length,
            contributingCollectionSlugs,
            partialCollections: discovery.debug.collectionsFetched
              .filter((collection) => !collection.complete)
              .map((collection) => ({
                slug: collection.slug,
                stoppedReason: collection.stoppedReason,
                fetchedCount: collection.fetchedCount,
              })),
          },
        }
      : {}),
  });
}
