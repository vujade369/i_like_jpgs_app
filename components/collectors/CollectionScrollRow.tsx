"use client";

import { useEffect, useRef, useState } from "react";
import type { SharedCollectionCardItem } from "./SharedCollectionsStrip";

const COUNT_FORMATTER = new Intl.NumberFormat("en-US");

function initialsForName(name: string): string {
  const words = name
    .replace(/^0x/i, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function heldLabel(count?: number | null): string | null {
  if (!Number.isFinite(count)) return null;
  return `${COUNT_FORMATTER.format(count as number)} held`;
}

// ─── NFT preview types ────────────────────────────────────────────────────────

type NftPreview = {
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  openseaUrl: string | null;
};

type NftCacheEntry = {
  nfts: NftPreview[];
  partial: boolean;
  fetchedAt: number;
};

type NftFetchState = "idle" | "loading" | "success" | "empty" | "error";

// Module-level cache shared across all card instances on the page.
const nftCache = new Map<string, NftCacheEntry>();
const NFT_CACHE_TTL_MS = 5 * 60 * 1000;

function makeCacheKey(address: string, slug: string): string {
  return `${address}::${slug}`;
}

function getCached(address: string, slug: string): NftCacheEntry | null {
  const key = makeCacheKey(address, slug);
  const entry = nftCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > NFT_CACHE_TTL_MS) {
    nftCache.delete(key);
    return null;
  }
  return entry;
}

const CONTRACT_RE = /^0x[0-9a-f]{10,}$/i;

function isPreviewable(collectorAddress: string | undefined, slug: string | null | undefined): boolean {
  return Boolean(collectorAddress) && Boolean(slug) && !CONTRACT_RE.test(slug ?? "");
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CollectionScrollRow({
  collections,
  collectorAddress,
}: {
  collections: SharedCollectionCardItem[];
  collectorAddress?: string;
}) {
  // All hooks before any early return.
  const [selectedKey, setSelectedKey] = useState<string | null>(
    collections[0]?.key ?? null,
  );

  // Set of fetchKeys the user has explicitly requested NFT previews for.
  // Once a key is in the set, switching back to that collection re-shows
  // the cached strip without requiring another click.
  const [previewedKeys, setPreviewedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // In-progress or most-recently-completed async fetch result.
  const [asyncResult, setAsyncResult] = useState<{
    fetchKey: string;
    state: "loading" | "success" | "empty" | "error";
    previews: NftPreview[];
  } | null>(null);

  const fetchSeq = useRef(0);
  const fetchController = useRef<AbortController | null>(null);

  // Carousel scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Track scroll position to show/hide arrows
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [collections]);

  // ── Derived values (for the selected collection's drawer) ─────────────────

  const selectedCollection =
    (selectedKey !== null
      ? collections.find((c) => c.key === selectedKey)
      : null) ?? collections[0];

  const selectedSlug = selectedCollection?.slug;
  const selectedFetchKey =
    isPreviewable(collectorAddress, selectedSlug)
      ? makeCacheKey(collectorAddress!, selectedSlug!)
      : null;

  const cacheHit = selectedFetchKey
    ? getCached(collectorAddress!, selectedSlug!)
    : null;

  const hasNftData =
    Boolean(selectedFetchKey) &&
    (cacheHit !== null ||
      (asyncResult !== null && asyncResult.fetchKey === selectedFetchKey));

  const wantsPreview =
    Boolean(selectedFetchKey) && previewedKeys.has(selectedFetchKey!);

  const showNftStrip = hasNftData && wantsPreview;

  const nftDisplayState: NftFetchState =
    !showNftStrip ? "idle" :
    cacheHit !== null ? (cacheHit.nfts.length === 0 ? "empty" : "success") :
    asyncResult !== null && asyncResult.fetchKey === selectedFetchKey
      ? asyncResult.state
      : "idle";

  const nftPreviews: NftPreview[] =
    cacheHit !== null ? cacheHit.nfts :
    asyncResult !== null && asyncResult.fetchKey === selectedFetchKey
      ? asyncResult.previews
      : [];

  // ── Click handler — selects collection and loads NFT previews ─────────────

  function handleCollectionClick(collection: SharedCollectionCardItem) {
    // Always select the clicked collection first.
    setSelectedKey(collection.key);

    const slug = collection.slug;
    if (!isPreviewable(collectorAddress, slug)) return;

    const address = collectorAddress!;
    const currentSlug = slug!;
    const currentFetchKey = makeCacheKey(address, currentSlug);

    // Mark as previewed so the strip renders.
    setPreviewedKeys((prev) => new Set([...prev, currentFetchKey]));

    // Cache hit — the derived render will show it immediately.
    if (getCached(address, currentSlug)) return;

    // Already loading this key — don't start a duplicate fetch.
    if (asyncResult?.fetchKey === currentFetchKey && asyncResult.state === "loading") return;

    // Cancel any prior in-flight fetch (different collection).
    fetchController.current?.abort();
    const controller = new AbortController();
    fetchController.current = controller;

    const seq = ++fetchSeq.current;

    setAsyncResult({ fetchKey: currentFetchKey, state: "loading", previews: [] });

    (async () => {
      try {
        const params = new URLSearchParams({ address, slug: currentSlug });
        const res = await fetch(
          `/api/wallet/collection-nfts?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { nfts: NftPreview[]; partial: boolean };
        if (fetchSeq.current !== seq) return;

        nftCache.set(currentFetchKey, {
          nfts: data.nfts,
          partial: data.partial,
          fetchedAt: Date.now(),
        });
        setAsyncResult({
          fetchKey: currentFetchKey,
          state: data.nfts.length === 0 ? "empty" : "success",
          previews: data.nfts,
        });
      } catch {
        if (controller.signal.aborted || fetchSeq.current !== seq) return;
        setAsyncResult({ fetchKey: currentFetchKey, state: "error", previews: [] });
      }
    })();
  }

  function scrollCarousel(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.75, behavior: "smooth" });
  }

  // Early return after all hooks.
  if (collections.length === 0) return null;

  return (
    <div className="ilj-csr">
      {/* Carousel: scroll row + arrow overlays */}
      <div className="ilj-csr__carousel">
        <div className="ilj-csr__scroll-wrap">
          <div className="ilj-csr__scroll" ref={scrollRef}>
            {collections.map((c) => (
              <CollectionThumb
                key={c.key}
                collection={c}
                isSelected={c.key === selectedCollection.key}
                onClick={() => handleCollectionClick(c)}
              />
            ))}
          </div>
        </div>

        {canScrollLeft && (
          <button
            type="button"
            className="ilj-csr__arrow ilj-csr__arrow--left"
            onClick={() => scrollCarousel(-1)}
            aria-label="Scroll left"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            className="ilj-csr__arrow ilj-csr__arrow--right"
            onClick={() => scrollCarousel(1)}
            aria-label="Scroll right"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      <div className="ilj-csr__drawer">
        <div className="ilj-csr__drawer-meta">
          <span className="ilj-csr__drawer-name">{selectedCollection.name}</span>
          {heldLabel(selectedCollection.heldCount) && (
            <span className="ilj-csr__drawer-held">
              {heldLabel(selectedCollection.heldCount)}
            </span>
          )}
        </div>

        {showNftStrip && (
          <NftStrip
            state={nftDisplayState}
            nfts={nftPreviews}
            heldCount={selectedCollection.heldCount ?? 0}
          />
        )}
      </div>

      <style>{`
        .ilj-csr {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        /* Carousel wrapper — positions arrows as overlays */
        .ilj-csr__carousel {
          position: relative;
          min-width: 0;
        }

        .ilj-csr__scroll-wrap {
          min-width: 0;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, black calc(100% - 48px), transparent 100%);
          mask-image: linear-gradient(to right, black calc(100% - 48px), transparent 100%);
        }

        .ilj-csr__scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
          padding-right: 48px;
          touch-action: pan-x;
        }

        .ilj-csr__scroll::-webkit-scrollbar {
          display: none;
        }

        /* Arrow buttons — dark glass, quiet purple outline */
        .ilj-csr__arrow {
          position: absolute;
          top: 40px;
          transform: translateY(-50%);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(12, 9, 28, 0.82);
          border: 1px solid rgba(149, 117, 255, 0.32);
          color: rgba(174, 148, 255, 0.85);
          cursor: pointer;
          padding: 0;
          line-height: 1;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          transition: background 0.14s ease, border-color 0.14s ease;
        }

        .ilj-csr__arrow--left {
          left: 4px;
        }

        .ilj-csr__arrow--right {
          right: 4px;
        }

        .ilj-csr__arrow:hover {
          background: rgba(22, 18, 48, 0.94);
          border-color: rgba(149, 117, 255, 0.58);
        }

        .ilj-csr__arrow:focus-visible {
          outline: 2px solid rgba(149, 117, 255, 0.55);
          outline-offset: 2px;
        }

        /* Outer tile: carries all visual styling so hover/selected state is unified */
        .ilj-csr__thumb {
          flex: 0 0 96px;
          width: 96px;
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.14s ease, background 0.14s ease;
        }

        .ilj-csr__thumb:hover {
          border-color: rgba(149, 117, 255, 0.38);
          background: rgba(255, 255, 255, 0.065);
        }

        .ilj-csr__thumb--selected {
          border-color: rgba(149, 117, 255, 0.7);
          background: rgba(149, 117, 255, 0.075);
        }

        .ilj-csr__thumb--selected:hover {
          border-color: rgba(149, 117, 255, 0.85);
        }

        /* Single button covering the full tile */
        .ilj-csr__thumb-select {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          min-width: 0;
          min-height: 0;
        }

        .ilj-csr__thumb-select:focus-visible {
          outline: 2px solid rgba(149, 117, 255, 0.6);
          outline-offset: -2px;
        }

        .ilj-csr__thumb-img {
          width: 100%;
          aspect-ratio: 1;
          background: rgba(149, 117, 255, 0.1);
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ilj-csr__thumb-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ilj-csr__thumb-fallback {
          color: rgb(149, 117, 255);
          font-family: var(--font-geist-mono), monospace;
          font-size: 15px;
          font-weight: 500;
        }

        .ilj-csr__thumb-name {
          margin: 0;
          padding: 5px 7px 0;
          color: rgb(240, 237, 230);
          font-size: 10px;
          font-weight: 500;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
        }

        .ilj-csr__thumb-held {
          display: block;
          padding: 2px 7px 6px;
          color: rgba(174, 148, 255, 0.82);
          font-family: var(--font-geist-mono), monospace;
          font-size: 9px;
          line-height: 1.2;
        }

        .ilj-csr__drawer {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 11px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          margin-top: 12px;
          min-width: 0;
        }

        .ilj-csr__drawer-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .ilj-csr__drawer-name {
          color: rgb(240, 237, 230);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.3;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ilj-csr__drawer-held {
          flex-shrink: 0;
          color: rgba(174, 148, 255, 0.82);
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          line-height: 1.2;
        }

        /* Small arrow modifier for NFT strip */
        .ilj-csr__arrow--sm {
          top: 50%;
          width: 24px;
          height: 24px;
        }

        /* ── NFT preview strip ── */

        /* Loading/error/empty states */
        .ilj-csr__nft-strip {
          display: flex;
          gap: 5px;
          align-items: flex-start;
          min-width: 0;
          overflow: hidden;
        }

        /* Success state: scrollable carousel */
        .ilj-csr__nft-carousel {
          position: relative;
          min-width: 0;
        }

        .ilj-csr__nft-scroll-wrap {
          min-width: 0;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
          mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
        }

        .ilj-csr__nft-scroll {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
          padding-right: 32px;
          touch-action: pan-x;
        }

        .ilj-csr__nft-scroll::-webkit-scrollbar {
          display: none;
        }

        .ilj-csr__nft-tile {
          flex: 0 0 56px;
          width: 56px;
          height: 56px;
          border-radius: 5px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ilj-csr__nft-tile--more {
          flex-direction: column;
          gap: 2px;
          background: rgba(149, 117, 255, 0.06);
          border-color: rgba(149, 117, 255, 0.18);
        }

        .ilj-csr__nft-tile--skeleton {
          animation: ilj-csr-pulse 1.5s ease-in-out infinite;
        }

        @keyframes ilj-csr-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.65; }
        }

        .ilj-csr__nft-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ilj-csr__nft-fallback {
          color: rgba(149, 117, 255, 0.4);
          font-family: var(--font-geist-mono), monospace;
          font-size: 9px;
          text-align: center;
          padding: 2px;
        }

        .ilj-csr__nft-more-count {
          color: rgba(174, 148, 255, 0.9);
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 500;
          line-height: 1;
        }

        .ilj-csr__nft-more-label {
          color: rgba(174, 148, 255, 0.5);
          font-family: var(--font-geist-mono), monospace;
          font-size: 8px;
          line-height: 1;
        }

        .ilj-csr__nft-quiet {
          color: rgba(168, 164, 157, 0.38);
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          line-height: 1.3;
          padding: 2px 0;
        }

        @media (max-width: 760px) {
          .ilj-csr__thumb {
            flex: 0 0 82px;
            width: 82px;
          }

          .ilj-csr__nft-tile {
            flex: 0 0 48px;
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </div>
  );
}

// ─── NFT preview strip ────────────────────────────────────────────────────────

function NftStrip({
  state,
  nfts,
  heldCount,
}: {
  state: NftFetchState;
  nfts: NftPreview[];
  heldCount: number;
}) {
  const nftScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = nftScrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [nfts]);

  function scrollNfts(direction: -1 | 1) {
    const el = nftScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.75, behavior: "smooth" });
  }

  if (state === "loading") {
    return (
      <div className="ilj-csr__nft-strip">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ilj-csr__nft-tile ilj-csr__nft-tile--skeleton" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return <p className="ilj-csr__nft-quiet">Preview unavailable.</p>;
  }

  if (state === "empty") {
    return <p className="ilj-csr__nft-quiet">No preview available.</p>;
  }

  if (state !== "success" || nfts.length === 0) return null;

  const moreCount = heldCount - nfts.length;
  const showMore = moreCount > 0;

  return (
    <div className="ilj-csr__nft-carousel">
      <div className="ilj-csr__nft-scroll-wrap">
        <div className="ilj-csr__nft-scroll" ref={nftScrollRef}>
          {nfts.map((nft, i) => (
            <NftTile key={nft.tokenId || i} nft={nft} />
          ))}
          {showMore && (
            <div
              className="ilj-csr__nft-tile ilj-csr__nft-tile--more"
              aria-label={`${moreCount} more`}
            >
              <span className="ilj-csr__nft-more-count">+{COUNT_FORMATTER.format(moreCount)}</span>
              <span className="ilj-csr__nft-more-label">more</span>
            </div>
          )}
        </div>
      </div>

      {canScrollLeft && (
        <button
          type="button"
          className="ilj-csr__arrow ilj-csr__arrow--sm ilj-csr__arrow--left"
          onClick={() => scrollNfts(-1)}
          aria-label="Scroll NFTs left"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M7 1.5L3 5l4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          className="ilj-csr__arrow ilj-csr__arrow--sm ilj-csr__arrow--right"
          onClick={() => scrollNfts(1)}
          aria-label="Scroll NFTs right"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function NftTile({ nft }: { nft: NftPreview }) {
  const [imgFailed, setImgFailed] = useState(false);
  const label = nft.name ?? (nft.tokenId ? `#${nft.tokenId}` : null);

  return (
    <div className="ilj-csr__nft-tile" title={label ?? undefined}>
      {nft.imageUrl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nft.imageUrl}
          alt={label ?? ""}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="ilj-csr__nft-image"
        />
      ) : (
        <span className="ilj-csr__nft-fallback" aria-hidden="true">
          {label ? label.slice(0, 3) : "—"}
        </span>
      )}
    </div>
  );
}

// ─── Collection thumbnail ─────────────────────────────────────────────────────

function CollectionThumb({
  collection,
  isSelected,
  onClick,
}: {
  collection: SharedCollectionCardItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeName = collection.name.trim() || "Unknown collection";
  const imageUrl = imageFailed ? null : collection.imageUrl;
  const countLabel = heldLabel(collection.heldCount);

  return (
    <div
      className={[
        "ilj-csr__thumb",
        isSelected ? "ilj-csr__thumb--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="ilj-csr__thumb-select"
        onClick={onClick}
        aria-pressed={isSelected}
        aria-label={countLabel ? `${safeName}, ${countLabel}` : safeName}
      >
        <div className="ilj-csr__thumb-img">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="ilj-csr__thumb-image"
            />
          ) : (
            <span className="ilj-csr__thumb-fallback" aria-hidden="true">
              {initialsForName(safeName)}
            </span>
          )}
        </div>
        <p className="ilj-csr__thumb-name">{safeName}</p>
        {countLabel && (
          <span className="ilj-csr__thumb-held">{countLabel}</span>
        )}
      </button>
    </div>
  );
}
