"use client";

import { CollectionSearchInput } from "./CollectionSearchInput";
import type { OsCollection } from "./CollectionSearchInput";

type CollectionRef = {
  slug: string;
  name: string;
  image_url?: string;
  contract?: string;
};

type Props = {
  collections: CollectionRef[];
  onRemove: (slug: string) => void;
  onAdd: (col: OsCollection) => void;
  maxCollections?: number;
};

export function SelectedCollectionEditor({ collections, onRemove, onAdd, maxCollections = 5 }: Props) {
  const atMax = collections.length >= maxCollections;
  const canRemove = collections.length > 1;
  const selectedSlugs = new Set(collections.map((c) => c.slug));

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(168,164,157,0.45)",
        marginBottom: 10,
      }}>
        Refine this taste
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {collections.map((col) => (
          <div
            key={col.slug}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              padding: canRemove ? "4px 6px 4px 6px" : "5px 10px 5px 6px",
              fontSize: 12,
              color: "rgb(240,237,230)",
            }}
          >
            {col.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={col.image_url}
                alt=""
                style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            )}
            <span style={{ marginRight: canRemove ? 1 : 0 }}>{col.name}</span>
            {canRemove && (
              <button
                onClick={() => onRemove(col.slug)}
                aria-label={`Remove ${col.name}`}
                style={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  borderRadius: "50%",
                  color: "rgba(168,164,157,0.55)",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "rgb(240,237,230)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "rgba(168,164,157,0.55)";
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {!atMax ? (
        <CollectionSearchInput
          onSelect={onAdd}
          atMax={atMax}
          selectedSlugs={selectedSlugs}
          compact
          placeholder="Add a collection…"
        />
      ) : (
        <p style={{
          fontSize: 11,
          color: "rgba(168,164,157,0.4)",
          marginTop: 4,
          paddingLeft: 2,
        }}>
          Maximum 5. Remove a collection to add another.
        </p>
      )}
    </div>
  );
}
