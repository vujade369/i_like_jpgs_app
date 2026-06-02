"use client";

import { useMemo, useState } from "react";

export type SharedCollectionCardItem = {
  key: string;
  name: string;
  imageUrl?: string | null;
  heldCount?: number | null;
  chainLabel?: string | null;
  href?: string | null;
};

type SharedCollectionsStripProps = {
  label: string;
  collections: SharedCollectionCardItem[];
};

const COUNT_FORMATTER = new Intl.NumberFormat("en-US");
const COLLAPSED_COLLECTION_COUNT = 3;

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
  const value = count as number;
  return `${COUNT_FORMATTER.format(value)} held`;
}

export function SharedCollectionsStrip({
  label,
  collections,
}: SharedCollectionsStripProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sorted = useMemo(
    () => collections.slice().sort((a, b) => (b.heldCount ?? 0) - (a.heldCount ?? 0)),
    [collections],
  );
  const hasMoreCollections = sorted.length > COLLAPSED_COLLECTION_COUNT;
  const hiddenCollectionCount = Math.max(0, sorted.length - COLLAPSED_COLLECTION_COUNT);
  const visibleCollections = isExpanded || !hasMoreCollections
    ? sorted
    : sorted.slice(0, COLLAPSED_COLLECTION_COUNT);

  if (collections.length === 0) return null;

  return (
    <div className="ilj-shared-strip">
      <div className="ilj-shared-strip__header">
        <p className="ilj-shared-strip__label">{label}</p>
      </div>
      <div className="ilj-shared-strip__grid" aria-label={label}>
        {visibleCollections.map((collection) => (
          <SharedCollectionMiniCard key={collection.key} collection={collection} />
        ))}
      </div>
      {hasMoreCollections && (
        <button
          type="button"
          className="ilj-shared-strip__reveal"
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? "Show fewer shared collections"
              : `Show ${hiddenCollectionCount} more shared collections`
          }
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Show less" : `+ ${hiddenCollectionCount} more shared collections`}
        </button>
      )}
      <style>{`
        .ilj-shared-strip {
          min-width: 0;
          max-width: 100%;
          display: grid;
          gap: 10px;
        }

        .ilj-shared-strip__header {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .ilj-shared-strip__label {
          margin: 0;
          color: rgba(168, 164, 157, 0.62);
          font-size: 10px;
          line-height: 1.2;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-family: var(--font-geist-mono), monospace;
        }

        .ilj-shared-strip__grid {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          min-width: 0;
          max-width: 100%;
        }

        .ilj-shared-strip__reveal {
          justify-self: start;
          border: 1px solid rgba(149, 117, 255, 0.22);
          border-radius: 999px;
          padding: 5px 10px 6px;
          background: rgba(149, 117, 255, 0.075);
          color: rgba(223, 214, 255, 0.9);
          font: inherit;
          font-size: 11px;
          line-height: 1.1;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }

        .ilj-shared-strip__reveal:hover {
          border-color: rgba(149, 117, 255, 0.38);
          background: rgba(149, 117, 255, 0.12);
          color: rgb(240, 237, 230);
        }

        .ilj-shared-card {
          width: 180px;
          min-height: 86px;
          flex: 0 0 180px;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 11px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.04);
          color: rgb(240, 237, 230);
          text-decoration: none;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }

        .ilj-shared-card:hover {
          border-color: rgba(149, 117, 255, 0.34);
          background: rgba(255, 255, 255, 0.058);
          transform: translateY(-1px);
        }

        .ilj-shared-card__image,
        .ilj-shared-card__fallback {
          width: 56px;
          height: 56px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          background: rgba(149, 117, 255, 0.13);
          flex: 0 0 auto;
        }

        .ilj-shared-card__image {
          object-fit: cover;
          display: block;
        }

        .ilj-shared-card__fallback {
          display: grid;
          place-items: center;
          color: rgb(149, 117, 255);
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
        }

        .ilj-shared-card__body {
          min-width: 0;
          display: grid;
          gap: 7px;
          align-content: center;
        }

        .ilj-shared-card__name {
          margin: 0;
          color: rgb(240, 237, 230);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          overflow-wrap: anywhere;
        }

        .ilj-shared-card__held {
          justify-self: start;
          border: 1px solid rgba(149, 117, 255, 0.42);
          border-radius: 999px;
          padding: 3px 8px 4px;
          background: rgba(149, 117, 255, 0.14);
          color: rgba(229, 222, 255, 0.96);
          font-size: 10px;
          line-height: 1.1;
          font-family: var(--font-geist-mono), monospace;
          white-space: nowrap;
        }

        @media (max-width: 520px) {
          .ilj-shared-strip__header {
            align-items: baseline;
          }

          .ilj-shared-card {
            width: 176px;
            min-height: 76px;
            flex-basis: 176px;
            grid-template-columns: 48px minmax(0, 1fr);
            gap: 9px;
            padding: 8px;
          }

          .ilj-shared-card__image,
          .ilj-shared-card__fallback {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </div>
  );
}

function SharedCollectionMiniCard({
  collection,
}: {
  collection: SharedCollectionCardItem;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeName = collection.name.trim() || "Unknown collection";
  const imageUrl = imageFailed ? null : collection.imageUrl;
  const countLabel = heldLabel(collection.heldCount);
  const content = (
    <>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="ilj-shared-card__image"
        />
      ) : (
        <span className="ilj-shared-card__fallback" aria-hidden="true">
          {initialsForName(safeName)}
        </span>
      )}
      <div className="ilj-shared-card__body">
        <p className="ilj-shared-card__name">{safeName}</p>
        {countLabel && <span className="ilj-shared-card__held">{countLabel}</span>}
      </div>
    </>
  );

  if (collection.href) {
    return (
      <a
        href={collection.href}
        target="_blank"
        rel="noreferrer"
        className="ilj-shared-card"
        title={countLabel ? `${safeName} · ${countLabel}` : safeName}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className="ilj-shared-card"
      title={countLabel ? `${safeName} · ${countLabel}` : safeName}
    >
      {content}
    </div>
  );
}
