import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  hydrateAccountIdentities,
  type CollectionRef,
  ACCOUNT_HYDRATION_LIMIT,
  ACCOUNT_HYDRATION_CONCURRENCY,
} from "@/lib/jpgs/holderDiscovery";

type DiscoverBody = { collections: CollectionRef[] };

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as DiscoverBody;
  const collections: CollectionRef[] = (body.collections ?? []).filter(
    (c) => c && typeof c.slug === "string" && typeof c.name === "string",
  );

  if (collections.length === 0) {
    return NextResponse.json({ error: "No collections provided" }, { status: 400 });
  }

  const discovery = await discoverWalletsForCollections(collections);
  const top50 = discovery.wallets.slice(0, 50);
  const n = Math.max(collections.length, 1);
  const hydration = await hydrateAccountIdentities(
    top50.map((wallet) => wallet.address),
    {
      limit: ACCOUNT_HYDRATION_LIMIT,
      concurrency: ACCOUNT_HYDRATION_CONCURRENCY,
    },
  );

  const wallets = top50.map((wallet) => {
    const identity = hydration.identities.get(wallet.address.toLowerCase());
    const score = Math.round(
      Math.min(
        1,
        (wallet.matchedCollectionCount / n) * 0.8 +
          Math.min(1, Math.log2(1 + wallet.totalHeldFromSelected) / Math.log2(26)) * 0.2,
      ) * 100,
    );
    const reason =
      wallet.matchedCollectionCount === 1
        ? "Holds 1 of your selected collections."
        : `Holds ${wallet.matchedCollectionCount} of your selected collections.`;

    return {
      address: wallet.address,
      displayName: identity?.displayName ?? shortenAddress(wallet.address),
      username: identity?.username,
      ens: identity?.ens,
      avatarUrl: identity?.avatarUrl,
      openseaUsername: identity?.username,
      openseaProfileUrl: identity?.openseaProfileUrl ?? `https://opensea.io/${wallet.address}`,
      identitySource: identity?.identitySource,
      matchedCollections: wallet.matchedCollections,
      matchedCollectionCount: wallet.matchedCollectionCount,
      totalHeldFromSelected: wallet.totalHeldFromSelected,
      score,
      reason,
    };
  });

  if (hydration.summary.fail > 0) {
    console.warn("[jpgs/wallets/discover] profile hydration failures:", hydration.summary.failures);
  }

  return NextResponse.json({
    wallets,
    collections,
    debug: { ...discovery.debug, hydrationSummary: hydration.summary },
  });
}
