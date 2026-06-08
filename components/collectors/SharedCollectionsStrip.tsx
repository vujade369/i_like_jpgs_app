"use client";

import { useMemo, useState } from "react";

export type SharedCollectionCardItem = {
  key: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  heldCount?: number | null;
  chainLabel?: string | null;
  href?: string | null;
  ownerHref?: string | null;
  contract?: string | null;
  chain?: string | null;
  contracts?: Array<{ address: string; chain?: string }> | null;
};

type SharedCollectionsStripProps = {
  label: string;
  collections: SharedCollectionCardItem[];
  desktopVisibleCount?: number;
  mobileVisibleCount?: number;
  variant?: "compact" | "ranked-card";
};

const COUNT_FORMATTER = new Intl.NumberFormat("en-US");
const DEFAULT_DESKTOP_VISIBLE_COUNT = 3;
const DEFAULT_MOBILE_VISIBLE_COUNT = 2;
const SHARED_STRIP_NARROW_BREAKPOINT_PX = 760;

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

function moreCollectionsLabel(count: number): string {
  const collectionWord = count === 1 ? "collection" : "collections";
  return `+${count} more shared ${collectionWord}`;
}

export function SharedCollectionsStrip({
  label,
  collections,
  desktopVisibleCount = DEFAULT_DESKTOP_VISIBLE_COUNT,
  mobileVisibleCount = DEFAULT_MOBILE_VISIBLE_COUNT,
  variant = "compact",
}: SharedCollectionsStripProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sorted = useMemo(
    () => collections.slice().sort((a, b) => (b.heldCount ?? 0) - (a.heldCount ?? 0)),
    [collections],
  );
  const desktopCount = Math.max(1, desktopVisibleCount);
  const mobileCount = Math.max(1, mobileVisibleCount);
  const visibleCollections = isExpanded ? sorted : sorted.slice(0, desktopCount);
  const desktopHiddenCount = Math.max(0, sorted.length - desktopCount);
  const mobileHiddenCount = Math.max(0, sorted.length - mobileCount);
  const hasMoreDesktopCollections = desktopHiddenCount > 0;
  const hasMoreMobileCollections = mobileHiddenCount > 0;
  const desktopMoreLabel = moreCollectionsLabel(desktopHiddenCount);
  const mobileMoreLabel = moreCollectionsLabel(mobileHiddenCount);

  if (collections.length === 0) return null;

  return (
    <div className={`ilj-shared-strip ilj-shared-strip--${variant}`}>
      <div className="ilj-shared-strip__header">
        <p className="ilj-shared-strip__label">{label}</p>
      </div>
      <div className="ilj-shared-strip__grid" aria-label={label}>
        {visibleCollections.map((collection, index) => (
          <SharedCollectionMiniCard
            key={collection.key}
            collection={collection}
            className={!isExpanded && index >= mobileCount ? "ilj-shared-card--mobile-extra" : undefined}
          />
        ))}
        {isExpanded ? (
          <button
            type="button"
            className="ilj-shared-strip__more-pill"
            aria-expanded="true"
            aria-label="Show fewer shared collections"
            onClick={() => setIsExpanded(false)}
          >
            Show fewer
          </button>
        ) : (
          <>
            {hasMoreDesktopCollections && (
              <button
                type="button"
                className="ilj-shared-strip__more-pill ilj-shared-strip__more-pill--desktop"
                aria-expanded="false"
                aria-label={`Show ${desktopMoreLabel.slice(1)}`}
                onClick={() => setIsExpanded(true)}
              >
                {desktopMoreLabel}
              </button>
            )}
            {hasMoreMobileCollections && (
              <button
                type="button"
                className="ilj-shared-strip__more-pill ilj-shared-strip__more-pill--mobile"
                aria-expanded="false"
                aria-label={`Show ${mobileMoreLabel.slice(1)}`}
                onClick={() => setIsExpanded(true)}
              >
                {mobileMoreLabel}
              </button>
            )}
          </>
        )}
      </div>
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
          align-items: stretch;
        }

        .ilj-shared-strip__more-pill--mobile {
          display: none;
        }

        .ilj-shared-strip__more-pill {
          align-self: center;
          flex: 0 0 auto;
          border: 1px solid rgba(149, 117, 255, 0.22);
          border-radius: 999px;
          padding: 5px 10px 6px;
          background: rgba(149, 117, 255, 0.075);
          color: rgba(223, 214, 255, 0.9);
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          line-height: 1.1;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }

        .ilj-shared-strip__more-pill:hover {
          border-color: rgba(149, 117, 255, 0.38);
          background: rgba(149, 117, 255, 0.12);
          color: rgb(240, 237, 230);
        }

        .ilj-shared-strip__more-pill:focus-visible {
          outline: 2px solid rgba(149, 117, 255, 0.55);
          outline-offset: 2px;
        }

        .ilj-shared-card {
          width: 180px;
          min-height: 86px;
          flex: 0 0 180px;
          min-width: 0;
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

        .ilj-shared-card__media-link,
        .ilj-shared-card__media {
          display: block;
          width: 56px;
          height: 56px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          overflow: hidden;
          background: rgba(149, 117, 255, 0.13);
          flex: 0 0 auto;
        }

        .ilj-shared-card__media-link:focus-visible {
          outline: 2px solid rgba(149, 117, 255, 0.55);
          outline-offset: -2px;
        }

        .ilj-shared-card__image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.15s ease;
        }

        .ilj-shared-card__media-link:hover .ilj-shared-card__image {
          opacity: 0.88;
        }

        .ilj-shared-card__fallback {
          width: 100%;
          height: 100%;
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

        .ilj-shared-card__action {
          display: none;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-strip__header {
          display: none;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-strip__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card {
          width: auto;
          min-height: 0;
          flex: initial;
          max-width: none;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          border-radius: 8px;
          padding: 0;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.052), rgba(255, 255, 255, 0.026));
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__media-link,
        .ilj-shared-strip--ranked-card .ilj-shared-card__media {
          width: 100%;
          height: auto;
          aspect-ratio: 1.08;
          border: 0;
          border-radius: 0;
          background: rgba(149, 117, 255, 0.10);
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__fallback {
          font-size: 18px;
          font-weight: 500;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__body {
          min-height: 116px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__name {
          line-height: 1.25;
          min-height: calc(2 * 1.25em);
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__held {
          align-self: flex-start;
          justify-self: auto;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-card__action {
          margin-top: auto;
          padding-top: 4px;
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          line-height: 1.2;
          color: rgba(149, 117, 255, 0.82);
          text-decoration: none;
          font-family: var(--font-geist-mono), monospace;
          white-space: nowrap;
          transition: color 0.15s ease;
        }

        .ilj-shared-card__action:hover {
          color: rgb(149, 117, 255);
        }

        .ilj-shared-card__action:focus-visible {
          outline: 2px solid rgba(149, 117, 255, 0.55);
          outline-offset: 2px;
          border-radius: 2px;
        }

        .ilj-shared-strip--ranked-card .ilj-shared-strip__more-pill {
          justify-self: start;
        }

        @media (max-width: ${SHARED_STRIP_NARROW_BREAKPOINT_PX}px) {
          .ilj-shared-card--mobile-extra,
          .ilj-shared-strip__more-pill--desktop {
            display: none;
          }

          .ilj-shared-strip__more-pill--mobile {
            display: inline-flex;
          }

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

          .ilj-shared-card__media-link,
          .ilj-shared-card__media {
            width: 48px;
            height: 48px;
          }

          .ilj-shared-strip--ranked-card .ilj-shared-strip__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ilj-shared-strip--ranked-card .ilj-shared-card {
            width: auto;
            min-height: 0;
            flex-basis: auto;
            display: flex;
            gap: 0;
            padding: 0;
          }

          .ilj-shared-strip--ranked-card .ilj-shared-card__media-link,
          .ilj-shared-strip--ranked-card .ilj-shared-card__media {
            width: 100%;
            height: auto;
          }

          .ilj-shared-strip--ranked-card .ilj-shared-card__body {
            min-height: 112px;
          }
        }

        @media (max-width: 460px) {
          .ilj-shared-strip--ranked-card .ilj-shared-strip__grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

function SharedCollectionMiniCard({
  collection,
  className,
}: {
  collection: SharedCollectionCardItem;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeName = collection.name.trim() || "Unknown collection";
  const imageUrl = imageFailed ? null : collection.imageUrl;
  const countLabel = heldLabel(collection.heldCount);

  const imageEl = imageUrl ? (
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
  );

  const mediaArea = collection.href ? (
    <a
      href={collection.href}
      target="_blank"
      rel="noreferrer"
      className="ilj-shared-card__media-link"
      aria-label={safeName}
      tabIndex={0}
    >
      {imageEl}
    </a>
  ) : (
    <div className="ilj-shared-card__media">{imageEl}</div>
  );

  return (
    <div
      className={["ilj-shared-card", className].filter(Boolean).join(" ")}
      title={countLabel ? `${safeName} · ${countLabel}` : safeName}
    >
      {mediaArea}
      <div className="ilj-shared-card__body">
        <p className="ilj-shared-card__name">{safeName}</p>
        {countLabel && <span className="ilj-shared-card__held">{countLabel}</span>}
        {collection.ownerHref && (
          <a
            href={collection.ownerHref}
            target="_blank"
            rel="noreferrer"
            className="ilj-shared-card__action"
            aria-label={`See owned JPGs from ${safeName}`}
          >
            See owned JPGs →
          </a>
        )}
      </div>
    </div>
  );
}
