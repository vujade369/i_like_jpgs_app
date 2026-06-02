"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SelectedCollectionEditor } from "@/components/jpgs/SelectedCollectionEditor";
import type { OsCollection } from "@/components/jpgs/CollectionSearchInput";

type CollectionRef = {
  slug: string;
  name: string;
  image_url?: string;
  contract?: string;
};

type MatchedCollection = {
  slug: string;
  name: string;
  image_url?: string;
  heldCount: number;
};

type CollectorWallet = {
  address: string;
  wallet?: string;
  shortWallet?: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  openseaUsername?: string | null;
  openSeaUrl?: string;
  openseaProfileUrl: string;
  identitySource?: string;
  matchedCollections: MatchedCollection[];
  matchedCollectionCount: number;
  totalHeldFromSelected: number;
  score: number;
  reason: string;
  isInstitutionalWallet: boolean;
  institutionalWalletReason: string | null;
};

type DiscoverResponse = {
  wallets: CollectorWallet[];
  collections: CollectionRef[];
  debug: {
    partial: boolean;
    errors: string[];
  };
};

const MAX_SELECTED = 5;

const CONTRACT_IDENTIFIER_RE = /^(?:[a-z0-9_-]+:)?0x[a-f0-9]{40}$/i;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isRawContractIdentifier(value?: string | null): boolean {
  return CONTRACT_IDENTIFIER_RE.test((value ?? "").trim());
}

function collectionProofLabel(collection: Pick<MatchedCollection, "name" | "slug">): string {
  const name = collection.name?.trim();
  const slug = collection.slug?.trim();

  if (name && !isRawContractIdentifier(name)) return name;
  if (slug && !isRawContractIdentifier(slug)) return slug.replace(/[-_]+/g, " ");
  return name || slug || "Unknown collection";
}

function whyLine(collections: MatchedCollection[]): string {
  if (collections.length === 0) return "";
  const sorted = collections.slice().sort((a, b) => b.heldCount - a.heldCount);
  const names = sorted.map((c) => collectionProofLabel(c));
  if (names.length === 1) return `Overlaps on ${names[0]}`;
  if (names.length === 2) return `Overlaps on ${names[0]} and ${names[1]}`;
  return `Overlaps on ${names.join(", ")}`;
}

function ResultsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [wallets, setWallets] = useState<CollectorWallet[]>([]);
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [noCollections, setNoCollections] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Stable string key — only changes when the set of slugs changes, not on array reference changes.
  // Used as the useEffect dependency for refetching to prevent infinite loops when metadata is
  // updated without changing the actual collection set.
  const slugKey = collections.map((c) => c.slug).join(",");

  // Effect 1: initialization — runs once, reads collections from sessionStorage or URL
  useEffect(() => {
    function init() {
      let cols: CollectionRef[] | null = null;

      try {
        const raw = sessionStorage.getItem("jpgs_selected_collections");
        if (raw) cols = JSON.parse(raw) as CollectionRef[];
      } catch {
        // ignore parse errors — fall through to URL fallback
      }

      const slugsParam = params.get("collections") ?? "";
      const urlSlugs = slugsParam
        .split(",")
        .map((s) => decodeURIComponent(s))
        .filter(Boolean);

      // URL wins when sessionStorage slugs differ (shared-link scenario)
      if (cols && urlSlugs.length > 0) {
        const stored = cols.map((c) => c.slug).sort().join(",");
        const fromUrl = [...urlSlugs].sort().join(",");
        if (stored !== fromUrl) cols = null;
      }

      if (!cols || cols.length === 0) {
        if (urlSlugs.length === 0) {
          setNoCollections(true);
          setLoading(false);
          return;
        }
        cols = urlSlugs.map((slug) => ({ slug, name: slug }));
      }

      setCollections(cols);
      setInitialized(true);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: fetch collector results whenever the collection set changes
  useEffect(() => {
    if (!initialized || collections.length === 0) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/jpgs/wallets/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collections }),
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = (await res.json()) as DiscoverResponse;
        if (cancelled) return;
        setWallets(data.wallets ?? []);
        setPartial(data.debug?.partial ?? false);
        // Do not write data.collections back to state — the API echoes the input unchanged,
        // and writing it back creates a new array reference that would change slugKey and
        // trigger this effect again.
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Discovery failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, slugKey]);

  function writeCollectionState(next: CollectionRef[]) {
    const nextSlugs = next.map((c) => encodeURIComponent(c.slug)).join(",");
    router.replace(`/jpgs/results?collections=${nextSlugs}`, { scroll: false });
    try {
      sessionStorage.setItem("jpgs_selected_collections", JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function removeCollection(slug: string) {
    if (collections.length <= 1) return;
    const next = collections.filter((c) => c.slug !== slug);
    setCollections(next);
    writeCollectionState(next);
  }

  function addCollection(col: OsCollection) {
    if (collections.some((c) => c.slug === col.collection)) return;
    if (collections.length >= MAX_SELECTED) return;
    const next = [
      ...collections,
      {
        slug: col.collection,
        name: col.name,
        image_url: col.image_url,
        contract: col.contracts?.[0]?.address,
      },
    ];
    setCollections(next);
    writeCollectionState(next);
  }

  return (
    <>
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 40px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Collectors near this taste
        </h1>
        <p style={{ color: "rgb(168,164,157)", fontSize: 14, marginBottom: 24 }}>
          Wallets with visible overlap across your selected collections.
        </p>

        {collections.length > 0 && (
          <SelectedCollectionEditor
            collections={collections}
            onRemove={removeCollection}
            onAdd={addCollection}
          />
        )}
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px" }}>
        {loading && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "48px 32px",
            textAlign: "center",
          }}>
            <div style={{
              width: 24,
              height: 24,
              border: "2px solid rgb(149,117,255)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }} />
            <p style={{ fontSize: 14, color: "rgb(168,164,157)" }}>Finding collectors near this taste…</p>
          </div>
        )}

        {!loading && noCollections && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgb(168,164,157)", marginBottom: 12 }}>Choose a few collections first.</p>
            <button
              onClick={() => router.push("/jpgs")}
              style={{ fontSize: 12, color: "rgb(149,117,255)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Back to picker
            </button>
          </div>
        )}

        {!loading && !noCollections && error && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,80,80,0.2)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgba(255,120,120,0.9)" }}>{error}</p>
          </div>
        )}

        {!loading && !noCollections && !error && wallets.length === 0 && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgb(168,164,157)" }}>No collectors found for this mix yet. Try removing one collection or adding a broader signal.</p>
          </div>
        )}

        {!loading && !noCollections && !error && wallets.length > 0 && (
          <>
            {partial && (
              <p style={{ fontSize: 12, color: "rgba(168,164,157,0.5)", marginBottom: 16 }}>
                Showing the strongest matches found so far.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {wallets.map((wallet, index) => (
                <CollectorCard key={wallet.address} wallet={wallet} rank={index + 1} />
              ))}
            </div>
          </>
        )}
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ilj-collector-link { transition: opacity 0.15s; }
        .ilj-collector-link:hover { opacity: 0.7; }
      `}</style>
    </>
  );
}

function CollectorCard({ wallet, rank }: { wallet: CollectorWallet; rank: number }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const shortWallet = shortAddress(wallet.address);
  const label = wallet.ens || wallet.displayName || wallet.username || shortWallet;
  const username = wallet.username || wallet.openseaUsername;
  const secondaryIdentity = username ? `${username} · ${shortWallet}` : shortWallet;
  const avatarSrc = avatarFailed
    ? null
    : wallet.avatarUrl || wallet.profileImageUrl || wallet.imageUrl || null;
  const profileIdentifier = username || wallet.ens || wallet.address;
  const openSeaUrl =
    wallet.openSeaUrl ||
    wallet.openseaProfileUrl ||
    `https://opensea.io/${profileIdentifier}`;
  const initials = label.replace(/^0x/i, "").slice(0, 2).toUpperCase();
  const why = whyLine(wallet.matchedCollections);

  return (
    <div style={{
      background: "#161616",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    }}>
      <a
        href={openSeaUrl}
        target="_blank"
        rel="noreferrer"
        className="ilj-collector-link"
        style={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: "50%",
          overflow: "hidden",
          background: "rgba(149,117,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt=""
            onError={() => setAvatarFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 14, color: "rgb(149,117,255)", fontWeight: 500 }}>{initials}</span>
        )}
      </a>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
          <a
            href={openSeaUrl}
            target="_blank"
            rel="noreferrer"
            className="ilj-collector-link"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgb(240,237,230)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: "none",
              minWidth: 0,
            }}
          >
            {label}
          </a>
          <span style={{ fontSize: 10, color: "rgba(168,164,157,0.4)", fontFamily: "monospace", flexShrink: 0 }}>
            #{rank}
          </span>
        </div>

        {secondaryIdentity && (
          <p style={{ fontSize: 11, color: "rgba(168,164,157,0.62)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {secondaryIdentity}
          </p>
        )}

        <CollectionImageStrip collections={wallet.matchedCollections} />

        {why && (
          <p style={{ fontSize: 12, color: "rgba(168,164,157,0.7)", marginBottom: 10 }}>
            {why}
          </p>
        )}

      </div>
    </div>
  );
}

function CollectionImageDot({ collection, index, visibleCount }: { collection: MatchedCollection; index: number; visibleCount: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : collection.image_url ?? null;
  const showBadge = collection.heldCount > 1;

  return (
    <div
      title={showBadge ? `${collection.name} · ${collection.heldCount} held` : collection.name}
      style={{
        position: "relative",
        width: 44,
        height: 44,
        flexShrink: 0,
        zIndex: visibleCount - index,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #161616",
          background: "rgba(149,117,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
      {showBadge && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -5,
            right: -5,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            background: "rgba(14,14,14,0.9)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            fontSize: 9,
            fontFamily: "monospace",
            color: "rgba(168,164,157,0.75)",
            lineHeight: 1,
          }}
        >
          {collection.heldCount}
        </span>
      )}
    </div>
  );
}

function CollectionImageStrip({ collections }: { collections: MatchedCollection[] }) {
  const sorted = collections.slice().sort((a, b) => b.heldCount - a.heldCount);

  if (sorted.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
      {sorted.map((col, i) => (
        <CollectionImageDot key={col.slug || col.name} collection={col} index={i} visibleCount={sorted.length} />
      ))}
    </div>
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
