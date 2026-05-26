"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ScoredCollector } from "@/lib/jpgs/scoreCollectors";
import type { OsCollection } from "@/lib/jpgs/opensea";

type Diagnostics = {
  selectedCollectionCount: number;
  requestedSlugs: string[];
  perCollection: { slug: string; nftSampleCount: number; uniqueHolderCount: number }[];
  totalCandidateWallets: number;
  returnedWallets: number;
  profileEnrichedCount: number;
  elapsedMs: number;
  warnings: string[];
};

type HoldersResponse = {
  collectors: ScoredCollector[];
  collections: OsCollection[];
  totalCandidates: number;
  diagnostics: Diagnostics;
  error?: string;
};

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function CollectorCard({
  collector,
  collectionMap,
  totalSelected,
}: {
  collector: ScoredCollector;
  collectionMap: Record<string, OsCollection>;
  totalSelected: number;
}) {
  return (
    <div style={{
      background: "#161616",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* Row: avatar + identity + score (secondary) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {collector.avatarUrl ? (
          // eslint-disable-next-line @next/next-image/no-img-element
          <img
            src={collector.avatarUrl}
            alt=""
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(149,117,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "rgb(149,117,255)", flexShrink: 0,
          }}>
            {(collector.displayName ?? collector.address).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {collector.displayName ?? shortenAddress(collector.address)}
          </div>
          {collector.displayName && (
            <div style={{ fontSize: 11, color: "rgb(168,164,157)", marginTop: 1, fontFamily: "monospace", opacity: 0.6 }}>
              {shortenAddress(collector.address)}
            </div>
          )}
        </div>
        {/* Score badge — visually secondary */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 11,
          color: "rgba(168,164,157,0.7)",
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}>
          {collector.matchScore}
        </div>
      </div>

      {/* Overlap count — the headline of this card */}
      <div>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: "rgb(240,237,230)" }}>
          {collector.matchedCollectionCount} of {totalSelected}
          <span style={{ fontSize: 15, fontWeight: 400, color: "rgb(168,164,157)", marginLeft: 8 }}>
            collection{totalSelected !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "rgb(168,164,157)", marginTop: 4 }}>
          {collector.totalHeldAcrossSelected} NFT{collector.totalHeldAcrossSelected !== 1 ? "s" : ""} held across selected
        </div>
      </div>

      {/* Matched collection chips */}
      {collector.matchedCollections.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {collector.matchedCollections.map((slug) => {
            const col = collectionMap[slug];
            return (
              <div
                key={slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  color: "rgb(168,164,157)",
                }}
              >
                {col?.image_url && (
                  // eslint-disable-next-line @next/next-image/no-img-element
                  <img
                    src={col.image_url}
                    alt=""
                    style={{ width: 14, height: 14, borderRadius: 3, objectFit: "cover" }}
                  />
                )}
                <span>{col?.name ?? slug}</span>
                <span style={{ color: "rgba(168,164,157,0.5)" }}>
                  ×{collector.heldCollections[slug] ?? 1}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* OpenSea link */}
      {collector.openseaUrl && (
        <a
          href={collector.openseaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "rgba(149,117,255,0.6)", textDecoration: "none" }}
        >
          View on OpenSea ↗
        </a>
      )}
    </div>
  );
}

function ResultsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const slugs = params.get("slugs") ?? "";

  const [data, setData] = useState<HoldersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugs) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/jpgs/holders?slugs=${encodeURIComponent(slugs)}`)
      .then((r) => r.json())
      .then((d: HoldersResponse) => {
        if (d.error) { setError(d.error); } else { setData(d); }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Request failed"))
      .finally(() => setLoading(false));
  }, [slugs]);

  const collectionMap: Record<string, OsCollection> =
    data?.collections.reduce(
      (acc, c) => ({ ...acc, [c.collection]: c }),
      {},
    ) ?? {};

  const slugList = slugs.split(",").filter(Boolean);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{
          width: 32, height: 32,
          border: "2px solid rgb(149,117,255)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <p style={{ color: "rgb(168,164,157)", fontSize: 14 }}>Reading holders…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "rgb(168,164,157)", marginBottom: 8, fontSize: 16 }}>
          We couldn&apos;t read one of those collections yet.
        </p>
        <p style={{ color: "rgba(168,164,157,0.5)", marginBottom: 28, fontSize: 13 }}>
          Try another slug or search result.
        </p>
        <button
          onClick={() => router.push("/jpgs")}
          style={{ fontSize: 13, color: "rgb(149,117,255)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Back to search
        </button>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!data || data.collectors.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "rgb(168,164,157)", marginBottom: 8, fontSize: 16 }}>
          No overlap found in this sample.
        </p>
        <p style={{ color: "rgba(168,164,157,0.5)", marginBottom: 28, fontSize: 13 }}>
          Try broader or more active collections.
        </p>
        <button
          onClick={() => router.push("/jpgs")}
          style={{ fontSize: 13, color: "rgb(149,117,255)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Try different collections
        </button>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 40px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgb(149,117,255)", marginBottom: 20 }}>
          I Like JPGs
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Collectors with overlap
        </h1>
        <p style={{ color: "rgb(168,164,157)", fontSize: 14 }}>
          Wallets ranked by how many of your selected collections they hold.
        </p>

        {/* Selected collection chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
          {slugList.map((slug) => {
            const col = collectionMap[slug];
            return (
              <div
                key={slug}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "rgb(240,237,230)",
                }}
              >
                {col?.image_url && (
                  // eslint-disable-next-line @next/next-image/no-img-element
                  <img src={col.image_url} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover" }} />
                )}
                {col?.name ?? slug}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => router.push("/jpgs")}
          style={{ marginTop: 20, fontSize: 12, color: "rgba(168,164,157,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← Refine selection
        </button>
      </section>

      {/* Collector cards */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
        {data.collectors.map((collector) => (
          <CollectorCard
            key={collector.address}
            collector={collector}
            collectionMap={collectionMap}
            totalSelected={slugList.length}
          />
        ))}
      </section>
    </>
  );
}

export default function ResultsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0e0e0e", color: "rgb(240,237,230)" }}>
      <Suspense fallback={
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "rgb(168,164,157)", fontSize: 14 }}>Loading…</p>
        </div>
      }>
        <ResultsInner />
      </Suspense>
    </main>
  );
}
