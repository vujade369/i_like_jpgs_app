"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  SharedCollectionsStrip,
  type SharedCollectionCardItem,
} from "@/components/collectors/SharedCollectionsStrip";
import { SelectedCollectionEditor } from "@/components/jpgs/SelectedCollectionEditor";
import type { OsCollection } from "@/components/jpgs/CollectionSearchInput";
import { MAX_SELECTED_COLLECTIONS } from "@/lib/jpgs/limits";

type CollectionRef = {
  slug: string;
  name: string;
  image_url?: string;
  contract?: string;
  chain?: string;
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
  twitterUrl?: string | null;
  instagramUrl?: string | null;
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

function safeCollectionHref(slug?: string | null): string | null {
  const trimmed = slug?.trim();
  if (!trimmed || isRawContractIdentifier(trimmed)) return null;
  return `https://opensea.io/collection/${encodeURIComponent(trimmed)}`;
}

function sharedCollectionItems(collections: MatchedCollection[]): SharedCollectionCardItem[] {
  return collections.map((collection) => {
    const name = collectionProofLabel(collection);
    return {
      key: collection.slug || collection.name || name,
      name,
      imageUrl: collection.image_url,
      heldCount: collection.heldCount,
      href: safeCollectionHref(collection.slug),
    };
  });
}

function jpgsCollectorSummary(wallet: CollectorWallet): string {
  const collectionCount = wallet.matchedCollectionCount;
  const heldCount = wallet.totalHeldFromSelected;
  const collectionWord = collectionCount === 1 ? "collection" : "collections";

  if (heldCount > 0) return `${collectionCount} ${collectionWord} · ${heldCount} held`;
  return `Matches ${collectionCount} selected ${collectionWord}`;
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
      const rawUrlSlugs = slugsParam
        .split(",")
        .map((s) => decodeURIComponent(s))
        .filter(Boolean);
      const urlSlugs = rawUrlSlugs.slice(0, MAX_SELECTED_COLLECTIONS);

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

      const wasClamped = cols.length > MAX_SELECTED_COLLECTIONS || rawUrlSlugs.length > MAX_SELECTED_COLLECTIONS;
      cols = cols.slice(0, MAX_SELECTED_COLLECTIONS);
      setCollections(cols);
      if (wasClamped) writeCollectionState(cols);
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
    if (collections.length >= MAX_SELECTED_COLLECTIONS) return;
    const next = [
      ...collections,
      {
        slug: col.collection,
        name: col.name,
        image_url: col.image_url,
        contract: col.contracts?.[0]?.address,
        chain: col.contracts?.[0]?.chain,
      },
    ];
    setCollections(next);
    writeCollectionState(next);
  }

  return (
    <>
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px 40px" }}>
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
            maxCollections={MAX_SELECTED_COLLECTIONS}
          />
        )}
      </section>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 80px", overflowX: "clip" }}>
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
                Showing the strongest matches found so far. Ranked by shared collections first, then weighted depth across the selected mix.
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
        .ilj-jpgs-profile-action {
          color: rgb(149, 117, 255);
          font-size: 11px;
          line-height: 1.2;
          text-decoration: none;
          opacity: 0.9;
          transition: opacity 0.15s ease, color 0.15s ease;
        }
        .ilj-jpgs-profile-action:hover {
          opacity: 0.72;
        }
        .ilj-jpgs-profile-links {
          justify-self: start;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          color: rgba(168,164,157,0.46);
          font-size: 11px;
          line-height: 1.2;
        }
        .ilj-jpgs-collector-card {
          background: #161616;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
          min-width: 0;
        }
        .ilj-jpgs-collector-identity {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 12px;
          align-content: start;
          padding-right: 16px;
          border-right: 1px solid rgba(255,255,255,0.07);
          min-width: 0;
        }
        .ilj-jpgs-collector-avatar {
          flex-shrink: 0;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(149,117,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }
        .ilj-jpgs-collector-copy {
          min-width: 0;
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .ilj-jpgs-collector-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
        }
        .ilj-jpgs-collector-name {
          font-size: 14px;
          font-weight: 500;
          color: rgb(240,237,230);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-decoration: none;
          min-width: 0;
        }
        .ilj-jpgs-collector-rank {
          flex: 0 0 auto;
          border: 1px solid rgba(149,117,255,0.22);
          border-radius: 999px;
          padding: 2px 6px;
          background: rgba(149,117,255,0.10);
          color: rgba(214,204,255,0.82);
          font-size: 10px;
          line-height: 1;
          font-family: var(--font-geist-mono), monospace;
        }
        .ilj-jpgs-collector-secondary {
          color: rgba(168,164,157,0.62);
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ilj-jpgs-collector-summary {
          color: rgba(168,164,157,0.74);
          font-size: 12px;
          line-height: 1.45;
          margin-top: 4px;
        }
        .ilj-jpgs-collector-proof {
          min-width: 0;
          align-self: center;
        }
        @media (max-width: 760px) {
          .ilj-jpgs-collector-card {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
            padding: 15px;
          }
          .ilj-jpgs-collector-identity {
            border-right: 0;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            padding-right: 0;
            padding-bottom: 14px;
          }
        }
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
  const summary = jpgsCollectorSummary(wallet);
  const sharedCollections = sharedCollectionItems(wallet.matchedCollections);

  return (
    <article className="ilj-jpgs-collector-card">
      <div className="ilj-jpgs-collector-identity">
        <div className="ilj-jpgs-collector-avatar" aria-hidden="true">
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
        </div>

        <div className="ilj-jpgs-collector-copy">
          <div className="ilj-jpgs-collector-title-row">
            <span className="ilj-jpgs-collector-name">
              {label}
            </span>
            <span className="ilj-jpgs-collector-rank">#{rank}</span>
          </div>

          {secondaryIdentity && (
            <p className="ilj-jpgs-collector-secondary">{secondaryIdentity}</p>
          )}

          <p className="ilj-jpgs-collector-summary">{summary}</p>
          <div className="ilj-jpgs-profile-links">
            <a
              href={openSeaUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="ilj-jpgs-profile-action"
              aria-label={`View ${label} on OpenSea`}
            >
              View profile -&gt;
            </a>
            {wallet.twitterUrl ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={wallet.twitterUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ilj-jpgs-profile-action"
                  aria-label={`View ${label} on X`}
                >
                  X
                </a>
              </>
            ) : null}
            {wallet.instagramUrl ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={wallet.instagramUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ilj-jpgs-profile-action"
                  aria-label={`View ${label} on Instagram`}
                >
                  Instagram
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ilj-jpgs-collector-proof">
        <SharedCollectionsStrip
          label="COLLECTION OVERLAP"
          collections={sharedCollections}
        />
      </div>
    </article>
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
