"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { type SharedCollectionCardItem } from "@/components/collectors/SharedCollectionsStrip";
import { CollectionScrollRow } from "@/components/collectors/CollectionScrollRow";
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
  contract?: string;
  chain?: string;
  contracts?: Array<{ address: string; chain?: string }>;
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

function safeOwnerCollectionHref(slug: string | undefined, address: string): string | null {
  const trimmed = slug?.trim();
  if (!trimmed || !address || isRawContractIdentifier(trimmed)) return null;
  return `https://opensea.io/${address}?tab=collected&search[collections][0]=${encodeURIComponent(trimmed)}`;
}

function sharedCollectionItems(collections: MatchedCollection[], walletAddress: string): SharedCollectionCardItem[] {
  return collections.map((collection) => {
    const name = collectionProofLabel(collection);
    return {
      key: collection.slug || collection.name || name,
      slug: collection.slug || null,
      name,
      imageUrl: collection.image_url,
      heldCount: collection.heldCount,
      href: safeCollectionHref(collection.slug),
      ownerHref: safeOwnerCollectionHref(collection.slug, walletAddress),
      contract: collection.contract,
      chain: collection.chain,
      contracts: collection.contracts,
    };
  });
}

function orderedSharedCollectionItems(collections: SharedCollectionCardItem[]): SharedCollectionCardItem[] {
  return collections.slice().sort((a, b) => (b.heldCount ?? 0) - (a.heldCount ?? 0));
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
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 34px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: "0", margin: 0, lineHeight: 1.15 }}>
            Top Collector Matches
          </h1>
          {!loading && !noCollections && !error ? (
            <span className="ilj-jpgs-results-count-pill">
              {wallets.length} {wallets.length === 1 ? "result" : "results"}
            </span>
          ) : null}
        </div>
        <p style={{ color: "rgb(168,164,157)", fontSize: 14, marginBottom: 24 }}>
          Collectors ranked by collection overlap
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

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", overflowX: "clip" }}>
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
        .ilj-jpgs-results-count-pill {
          border: 1px solid rgba(149,117,255,0.38);
          border-radius: 999px;
          padding: 4px 10px 5px;
          background: rgba(149,117,255,0.12);
          color: rgba(214,204,255,0.86);
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          line-height: 1;
          white-space: nowrap;
        }
        .ilj-jpgs-profile-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: rgba(174, 148, 255, 0.76);
          font-size: 11px;
          line-height: 1.2;
          text-decoration: none;
          opacity: 0.82;
          transition: opacity 0.15s ease, color 0.15s ease;
        }
        .ilj-jpgs-profile-action:hover {
          color: rgba(196, 178, 255, 0.9);
          opacity: 0.86;
        }
        .ilj-jpgs-profile-links {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: flex-start;
          gap: 5px;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          color: rgba(168,164,157,0.36);
          font-size: 10px;
          line-height: 1.2;
          margin-top: auto;
          white-space: nowrap;
        }
        .ilj-jpgs-profile-separator {
          flex: 0 0 auto;
        }
        .ilj-jpgs-collector-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.024)), #141516;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 0;
          min-width: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 14px 34px rgba(0,0,0,0.16);
        }
        .ilj-jpgs-collector-card:first-child {
          border-color: rgba(149,117,255,0.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.045), 0 0 0 1px rgba(149,117,255,0.055), 0 18px 38px rgba(0,0,0,0.2);
        }
        .ilj-jpgs-collector-card:nth-child(even) {
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.022)), #171719;
        }
        .ilj-jpgs-collector-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 16px;
          margin-bottom: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ilj-jpgs-collector-identity {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .ilj-jpgs-collector-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          flex-shrink: 0;
          box-sizing: border-box;
          border: 1px solid rgba(214,204,255,0.24);
          background: rgba(149,117,255,0.15);
          overflow: hidden;
        }
        .ilj-jpgs-collector-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 50%;
        }
        .ilj-jpgs-collector-rank {
          flex-shrink: 0;
          border: 1px solid rgba(149,117,255,0.36);
          border-radius: 7px;
          padding: 4px 8px;
          background: rgba(149,117,255,0.18);
          color: rgba(225,217,255,0.92);
          font-size: 12px;
          line-height: 1.2;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          white-space: nowrap;
        }
        .ilj-jpgs-collector-copy {
          min-width: 0;
          display: grid;
          gap: 5px;
          align-content: center;
          flex: 1;
        }
        .ilj-jpgs-collector-name {
          font-size: 15px;
          font-weight: 650;
          line-height: 1.25;
          color: rgb(240,237,230);
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          overflow-wrap: anywhere;
          text-decoration: none;
          min-width: 0;
        }
        .ilj-jpgs-collector-secondary {
          margin: 0;
          color: rgba(168,164,157,0.42);
          font-size: 10px;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ilj-jpgs-collector-count-block {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
        }
        .ilj-jpgs-collector-count {
          color: rgb(170,126,255);
          font-family: var(--font-geist-mono), monospace;
          font-size: 44px;
          font-weight: 750;
          line-height: 0.9;
          letter-spacing: -1px;
          text-shadow: 0 0 14px rgba(149,117,255,0.18);
          font-variant-numeric: tabular-nums;
        }
        .ilj-jpgs-collector-count-label {
          color: rgba(168,164,157,0.62);
          font-family: var(--font-geist-mono), monospace;
          font-size: 9px;
          line-height: 1.2;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        @media (max-width: 760px) {
          .ilj-jpgs-collector-card {
            padding: 14px;
          }
          .ilj-jpgs-collector-count {
            font-size: 36px;
          }
          .ilj-jpgs-collector-avatar {
            width: 52px;
            height: 52px;
          }
        }
        @media (max-width: 460px) {
          .ilj-jpgs-collector-card {
            padding: 12px;
          }
          .ilj-jpgs-collector-avatar {
            width: 46px;
            height: 46px;
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
  const profileLinks = [
    wallet.openSeaUrl || wallet.openseaProfileUrl
      ? {
          label: "OpenSea",
          href: wallet.openSeaUrl || wallet.openseaProfileUrl,
          ariaLabel: `View ${label} on OpenSea`,
        }
      : null,
    wallet.twitterUrl
      ? { label: "X", href: wallet.twitterUrl, ariaLabel: `View ${label} on X` }
      : null,
    wallet.instagramUrl
      ? { label: "IG", href: wallet.instagramUrl, ariaLabel: `View ${label} on Instagram` }
      : null,
  ].filter((link): link is { label: string; href: string; ariaLabel: string } => Boolean(link));
  const initials = label.replace(/^0x/i, "").slice(0, 2).toUpperCase();
  const sharedCollections = sharedCollectionItems(wallet.matchedCollections, wallet.address);
  const orderedSharedCollections = orderedSharedCollectionItems(sharedCollections);

  return (
    <article className="ilj-jpgs-collector-card">
      <div className="ilj-jpgs-collector-header">
        <div className="ilj-jpgs-collector-identity">
          <span className="ilj-jpgs-collector-rank">#{rank}</span>
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
              <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", overflow: "hidden", fontSize: 20, color: "rgb(149,117,255)", fontWeight: 500 }}>{initials}</span>
            )}
          </div>
          <div className="ilj-jpgs-collector-copy">
            <span className="ilj-jpgs-collector-name">{label}</span>
            {secondaryIdentity && (
              <p className="ilj-jpgs-collector-secondary">{secondaryIdentity}</p>
            )}
            {profileLinks.length > 0 ? (
              <div className="ilj-jpgs-profile-links">
                {profileLinks.map((link, index) => (
                  <Fragment key={link.label}>
                    {index > 0 ? <span className="ilj-jpgs-profile-separator" aria-hidden="true">·</span> : null}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ilj-jpgs-profile-action"
                      aria-label={link.ariaLabel}
                    >
                      {link.label}
                      {link.label === "OpenSea" ? <span aria-hidden="true">↗</span> : null}
                    </a>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ilj-jpgs-collector-count-block">
          <span className="ilj-jpgs-collector-count">{wallet.matchedCollectionCount}</span>
          <span className="ilj-jpgs-collector-count-label">SHARED COLLECTIONS</span>
        </div>
      </div>
      <CollectionScrollRow collections={orderedSharedCollections} collectorAddress={wallet.address} />
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
