import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  type CollectionRef,
  ACCOUNT_HYDRATION_LIMIT,
  ACCOUNT_HYDRATION_CONCURRENCY,
} from "@/lib/jpgs/holderDiscovery";
import { fetchAccount } from "@/lib/jpgs/opensea";

type DiscoverBody = { collections: CollectionRef[] };

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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

  // ENS reverse-name fallback requires RPC/provider setup (viem or ethers + RPC env var).

  type HydrationOutcome = { address: string; outcome: "ok" | "skip" | "fail" };
  const hydrationLog: HydrationOutcome[] = [];

  const tasks = top50.map((wallet, i) => async () => {
    let profile = null;
    let outcome: HydrationOutcome["outcome"] = "skip";
    if (i < ACCOUNT_HYDRATION_LIMIT) {
      profile = await fetchAccount(wallet.address);
      outcome = profile !== null ? "ok" : "fail";
    }
    hydrationLog.push({ address: wallet.address, outcome });

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
      displayName: profile?.username ?? shortenAddress(wallet.address),
      avatarUrl: profile?.profile_image_url ?? undefined,
      openseaUsername: profile?.username ?? undefined,
      openseaProfileUrl: profile?.username
        ? `https://opensea.io/${profile.username}`
        : `https://opensea.io/${wallet.address}`,
      matchedCollections: wallet.matchedCollections,
      matchedCollectionCount: wallet.matchedCollectionCount,
      totalHeldFromSelected: wallet.totalHeldFromSelected,
      score,
      reason,
    };
  });

  const wallets = await runConcurrently(tasks, ACCOUNT_HYDRATION_CONCURRENCY);

  const hydrationSummary = {
    ok: hydrationLog.filter((h) => h.outcome === "ok").length,
    fail: hydrationLog.filter((h) => h.outcome === "fail").length,
    skip: hydrationLog.filter((h) => h.outcome === "skip").length,
    failures: hydrationLog.filter((h) => h.outcome === "fail").map((h) => h.address),
  };

  if (hydrationSummary.fail > 0) {
    console.warn("[jpgs/wallets/discover] profile hydration failures:", hydrationSummary.failures);
  }

  return NextResponse.json({
    wallets,
    collections,
    debug: { ...discovery.debug, hydrationSummary },
  });
}
