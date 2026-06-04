import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  hydrateAccountIdentities,
  type CollectionRef,
} from "@/lib/jpgs/holderDiscovery";
import {
  looksInstitutionalCollector,
  getInstitutionalWalletReason,
} from "@/lib/jpgs/institutionalWallets";

export const maxDuration = 300;

const MAX_COLLECTIONS = 15;
const MAX_DISCOVERED_COLLECTORS = 20;
const MAX_RETURNED_COLLECTORS = 10;
const MIN_SHARED_COLLECTIONS = 2;
const SLOW_REQUEST_LOG_THRESHOLD_MS = 5_000;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

type SimilarCollectorsBody = {
  sourceWallets?: string[];
  collections?: Array<{
    slug?: string;
    name?: string;
    imageUrl?: string;
    image_url?: string;
    contract?: string;
    chain?: string;
    contracts?: Array<{ address?: string; chain?: string }>;
  }>;
};

function shortWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeWallet(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  return WALLET_RE.test(trimmed) ? trimmed : null;
}

function nowMs(): number {
  return Date.now();
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
      contract: collection.contract?.trim(),
      chain: collection.chain?.trim(),
      contracts: collection.contracts
        ?.map((contract) => ({
          address: contract.address?.trim() ?? "",
          chain: contract.chain?.trim(),
        }))
        .filter((contract) => contract.address),
    });

    if (refs.length >= MAX_COLLECTIONS) break;
  }

  return refs;
}

export async function POST(req: NextRequest) {
  const routeStartedAt = nowMs();
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  let body: SimilarCollectorsBody;
  try {
    body = (await req.json()) as SimilarCollectorsBody;
  } catch {
    return NextResponse.json({ collectors: [] });
  }

  const prepStartedAt = nowMs();
  const collections = collectionRefsFromBody(body);
  const collectionsReceived = body.collections?.length ?? 0;
  const collectionPrepMs = nowMs() - prepStartedAt;

  if (collections.length < 2) {
    return NextResponse.json({ collectors: [] });
  }

  const excludedWallets = new Set(
    (body.sourceWallets ?? [])
      .map(normalizeWallet)
      .filter((address): address is string => Boolean(address)),
  );

  const discoveryStartedAt = nowMs();
  const discovery = await discoverWalletsForCollections(collections, {
    maxCollections: MAX_COLLECTIONS,
  }).catch(() => null);
  const holderDiscoveryMs = nowMs() - discoveryStartedAt;

  if (!discovery) {
    return NextResponse.json({ collectors: [] });
  }

  const rankingStartedAt = nowMs();
  const matches = discovery.wallets
    .filter((wallet) => !excludedWallets.has(wallet.address.toLowerCase()))
    .filter((wallet) => wallet.matchedCollectionCount >= MIN_SHARED_COLLECTIONS)
    .slice(0, MAX_DISCOVERED_COLLECTORS);
  const returnedMatches = matches.slice(0, MAX_RETURNED_COLLECTORS);
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
  const rankingFilteringMs = nowMs() - rankingStartedAt;

  const hydrationStartedAt = nowMs();
  const hydration = await hydrateAccountIdentities(
    returnedMatches.map((wallet) => wallet.address),
    { limit: MAX_RETURNED_COLLECTORS },
  );
  const identityEnrichmentMs = nowMs() - hydrationStartedAt;

  const collectors = returnedMatches.map((wallet) => {
    const identity = hydration.identities.get(wallet.address.toLowerCase());
    const profileUrl = identity?.openSeaUrl ?? identity?.openseaProfileUrl ?? `https://opensea.io/${wallet.address}`;
    const institutionalCandidate = {
      ens: identity?.ens ?? null,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      openseaUsername: identity?.username ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      imageUrl: identity?.imageUrl ?? null,
      openSeaUrl: profileUrl,
      openseaProfileUrl: profileUrl,
    };

    return {
      address: wallet.address,
      wallet: wallet.address,
      shortWallet: shortWallet(wallet.address),
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      ens: identity?.ens ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      imageUrl: identity?.imageUrl ?? null,
      openSeaUrl: profileUrl,
      openseaProfileUrl: profileUrl,
      twitterUrl: identity?.twitterUrl ?? null,
      instagramUrl: identity?.instagramUrl ?? null,
      identitySource: identity?.identitySource ?? "fallback",
      matchedCollections: wallet.matchedCollections,
      sharedCollectionCount: wallet.matchedCollectionCount,
      totalHeldFromSelected: wallet.totalHeldFromSelected,
      reason:
        wallet.matchedCollectionCount === 1
          ? "Seen across 1 shared collection"
          : `Seen across ${wallet.matchedCollectionCount} shared collections`,
      isInstitutionalWallet: looksInstitutionalCollector(institutionalCandidate),
      institutionalWalletReason: getInstitutionalWalletReason(institutionalCandidate),
    };
  });

  const totalRouteMs = nowMs() - routeStartedAt;
  const sourceCounts = discovery.debug.collectionsFetched.reduce(
    (acc, collection) => {
      acc[collection.discoverySource] = (acc[collection.discoverySource] ?? 0) + 1;
      if (collection.fallbackReason) {
        acc.fallbacks[collection.fallbackReason] =
          (acc.fallbacks[collection.fallbackReason] ?? 0) + 1;
      }
      return acc;
    },
    {
      alchemy: 0,
      opensea: 0,
      fallbacks: {} as Record<string, number>,
    },
  );
  const timings = {
    totalRouteMs,
    collectionPrepMs,
    holderDiscoveryMs,
    rankingFilteringMs,
    identityEnrichmentMs,
  };

  if (totalRouteMs >= SLOW_REQUEST_LOG_THRESHOLD_MS) {
    console.info("[wallet/similar-collectors] slow request", {
      timings,
      collectionsReceived,
      collectionsAttempted: collections.length,
      collectionsFetched: discovery.debug.collectionsFetched.length,
      holderSources: {
        alchemy: sourceCounts.alchemy,
        opensea: sourceCounts.opensea,
      },
      alchemyFallbacks: sourceCounts.fallbacks,
      candidateHolders: discovery.debug.candidateHolderCount,
      rankedCandidates: discovery.wallets.length,
      filteredCandidates: matches.length,
      returnedCollectors: collectors.length,
      identitiesRequested: hydration.summary.requested,
      identitiesFetched: hydration.summary.unique,
      identityCacheHits: hydration.summary.cached,
    });
  }

  return NextResponse.json({
    collectors,
    ...(process.env.NODE_ENV === "development" || debug
      ? {
          debug: {
            collectionsAttempted: collections.length,
            collectionsReceived,
            maxCollections: MAX_COLLECTIONS,
            maxReturnedCollectors: MAX_RETURNED_COLLECTORS,
            timings,
            collectionsWithUsableHolders: collectionsWithUsableHolders.length,
            partial: discovery.debug.partial,
            errors: discovery.debug.errors,
            holderSources: {
              alchemy: sourceCounts.alchemy,
              opensea: sourceCounts.opensea,
            },
            alchemyFallbacks: sourceCounts.fallbacks,
            candidateHolders: discovery.debug.candidateHolderCount,
            collectionsFetched: discovery.debug.collectionsFetched.length,
            collectionsCompleted: discovery.debug.collectionsFetched.filter((collection) => collection.complete).length,
            collectionsContributingToResults: contributingCollectionSlugs.length,
            contributingCollectionSlugs,
            hydrationSummary: hydration.summary,
            ...(debug
              ? {
                  identity: collectors.map((collector) => {
                    const identity = hydration.identities.get(collector.address.toLowerCase());
                    const debugIdentity = identity?.debug;
                    return {
                      address: collector.address,
                      cacheHit: debugIdentity?.cacheHit ?? false,
                      cachedIdentitySource: debugIdentity?.cachedIdentitySource ?? null,
                      cachedHadAvatar: debugIdentity?.cachedHadAvatar ?? false,
                      accountFetchAttempted: debugIdentity?.accountFetchAttempted ?? false,
                      accountFetchStatus: debugIdentity?.accountFetchStatus ?? "not_attempted",
                      accountFetchError: debugIdentity?.accountFetchError ?? null,
                      accountFetchHadBody: debugIdentity?.accountFetchHadBody ?? false,
                      accountFetchUsername: debugIdentity?.accountFetchUsername ?? null,
                      accountFetchProfileImageUrl: debugIdentity?.accountFetchProfileImageUrl ?? null,
                      resolveFetchAttempted: debugIdentity?.resolveFetchAttempted ?? false,
                      resolveFetchStatus: debugIdentity?.resolveFetchStatus ?? "not_attempted",
                      resolveFetchError: debugIdentity?.resolveFetchError ?? null,
                      resolveFetchEns: debugIdentity?.resolveFetchEns ?? null,
                      rawAccount: debugIdentity?.rawAccount ?? null,
                      rawResolve: debugIdentity?.rawResolve ?? null,
                      finalUsername: collector.username,
                      finalDisplayName: collector.displayName,
                      finalEns: collector.ens,
                      finalAvatarUrl: collector.avatarUrl,
                      identitySource: collector.identitySource,
                      avatarBeforeMapping: debugIdentity?.avatarBeforeMapping ?? false,
                      avatarAfterMapping: Boolean(
                        collector.avatarUrl || collector.profileImageUrl || collector.imageUrl,
                      ),
                    };
                  }),
                }
              : {}),
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
