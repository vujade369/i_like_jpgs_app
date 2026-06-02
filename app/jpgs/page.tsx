"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CollectionSearchInput } from "@/components/jpgs/CollectionSearchInput";
import type { OsCollection } from "@/components/jpgs/CollectionSearchInput";
import { MAX_SELECTED_COLLECTIONS } from "@/lib/jpgs/limits";

type PresetCollection = { slug: string; name: string; image_url: string };
type PresetSet = { label: string; collections: PresetCollection[] };

const PRESET_SETS: PresetSet[] = [
  {
    label: "Blue chips",
    collections: [
      { slug: "cryptopunks", name: "CryptoPunks", image_url: "" },
      { slug: "boredapeyachtclub", name: "Bored Ape Yacht Club", image_url: "" },
    ],
  },
  {
    label: "Meme culture",
    collections: [
      { slug: "thememes6529", name: "The Memes by 6529", image_url: "" },
      { slug: "cryptodickbutts-s3", name: "CryptoDickbutts S3", image_url: "" },
    ],
  },
  {
    label: "Generative",
    collections: [
      { slug: "fidenza-by-tyler-hobbs", name: "Fidenza by Tyler Hobbs", image_url: "" },
      { slug: "nouns", name: "Nouns", image_url: "" },
    ],
  },
  {
    label: "Cute culture",
    collections: [
      { slug: "pudgypenguins", name: "Pudgy Penguins", image_url: "" },
      { slug: "doodles-official", name: "Doodles", image_url: "" },
    ],
  },
];

export default function JpgsPage() {
  const [selected, setSelected] = useState<OsCollection[]>([]);
  const [presetLoadingSlugs, setPresetLoadingSlugs] = useState<Set<string>>(new Set());
  const [searchState, setSearchState] = useState({ hasResults: false, showSelectHint: false });
  const [searchResetKey, setSearchResetKey] = useState(0);
  const router = useRouter();

  function selectCollection(col: OsCollection) {
    toggleCollection(col);
  }

  function toggleCollection(col: OsCollection) {
    setSelected((prev) => {
      if (prev.some((c) => c.collection === col.collection)) {
        return prev.filter((c) => c.collection !== col.collection);
      }
      if (prev.length >= MAX_SELECTED_COLLECTIONS) return prev;
      return [...prev, col];
    });
  }

  async function applySet(set: PresetSet) {
    const capped = set.collections.slice(0, MAX_SELECTED_COLLECTIONS);
    const placeholders: OsCollection[] = capped.map((c) => ({
      collection: c.slug,
      name: c.name,
      image_url: "",
    }));
    setSelected(placeholders);
    setSearchResetKey((k) => k + 1);
    setPresetLoadingSlugs(new Set(capped.map((c) => c.slug)));

    await Promise.all(
      capped.map(async (c) => {
        try {
          const res = await fetch(`/api/jpgs/collections/search?q=${encodeURIComponent(c.slug)}`);
          const data = (await res.json()) as { collections?: OsCollection[] };
          const match = data.collections?.find((r) => r.collection === c.slug);
          if (match) {
            setSelected((prev) =>
              prev.map((item) => (item.collection === c.slug ? match : item)),
            );
          }
        } catch {
          // fall back to placeholder already in selected
        } finally {
          setPresetLoadingSlugs((prev) => {
            const next = new Set(prev);
            next.delete(c.slug);
            return next;
          });
        }
      }),
    );
  }

  function discover() {
    if (selected.length < 1) return;
    sessionStorage.setItem(
      "jpgs_selected_collections",
      JSON.stringify(
        selected.map((c) => ({
          slug: c.collection,
          name: c.name,
          image_url: c.image_url,
          contract: c.contracts?.[0]?.address,
        })),
      ),
    );
    const slugs = selected.map((c) => encodeURIComponent(c.collection)).join(",");
    router.push(`/jpgs/results?collections=${slugs}`);
  }

  const atMax = selected.length >= MAX_SELECTED_COLLECTIONS;

  return (
    <main className="min-h-screen" style={{ background: "#0e0e0e", color: "rgb(240,237,230)" }}>
      {/* Hero */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "96px 24px 24px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 16 }}>
          Find people who collect what you collect.
        </h1>
        <p style={{ color: "rgb(168,164,157)", fontSize: 16, lineHeight: 1.7, maxWidth: 480, marginBottom: 12 }}>
          Pick a few NFT collections you care about. I Like JPGs finds wallets with the strongest overlap.
        </p>
        <p style={{ color: "rgba(168,164,157,0.5)", fontSize: 13, lineHeight: 1.6 }}>
          No prices. No rarity. Just shared collecting signals.
        </p>
      </section>

      {/* Search */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
        <CollectionSearchInput
          key={searchResetKey}
          onSelect={selectCollection}
          atMax={atMax}
          selectedSlugs={new Set(selected.map((c) => c.collection))}
          onStateChange={setSearchState}
        />

        {/* Picker helper copy — contextual hint below search bar */}
        {!searchState.hasResults && !searchState.showSelectHint && (
          <p style={{ fontSize: 12, color: "rgba(168,164,157,0.5)", marginTop: 10, paddingLeft: 2 }}>
            {selected.length === 0
              ? "Search for collections, then choose the ones that feel like your taste."
              : selected.length === 1
              ? "Add another collection to sharpen the signal."
              : "This is your taste set."}
          </p>
        )}

        {/* Try a set */}
        {!searchState.hasResults && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(168,164,157,0.4)", marginBottom: 10 }}>
              Try a set
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESET_SETS.map((set) => (
                <button
                  key={set.label}
                  onClick={() => applySet(set)}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    color: "rgba(168,164,157,0.7)",
                    cursor: "pointer",
                    letterSpacing: "0.01em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.color = "rgba(240,237,230,0.85)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "rgba(168,164,157,0.7)";
                  }}
                >
                  {set.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Selected taste set + CTA */}
      {selected.length > 0 && (
        <section style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 0" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgb(168,164,157)", marginBottom: 16 }}>
            Your taste set
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: atMax ? 12 : 32 }}>
            {selected.map((col) => {
              const isLoading = presetLoadingSlugs.has(col.collection);
              return (
                <div
                  key={col.collection}
                  style={{
                    position: "relative",
                    background: "#161616",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    padding: "14px 14px 12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {col.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={col.image_url}
                      alt=""
                      style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: 8,
                      background: isLoading ? "rgba(149,117,255,0.15)" : "rgba(149,117,255,0.1)",
                      flexShrink: 0,
                      marginTop: 2,
                      animation: isLoading ? "pulse 1.4s ease-in-out infinite" : undefined,
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "rgb(240,237,230)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                      {col.name}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(168,164,157,0.6)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {col.collection}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCollection(col)}
                    aria-label={`Remove ${col.name}`}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.07)",
                      border: "none",
                      borderRadius: "50%",
                      color: "rgba(168,164,157,0.7)",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {atMax && (
            <p style={{ fontSize: 12, color: "rgba(168,164,157,0.45)", marginBottom: 20, paddingLeft: 2 }}>
              Maximum 10. Remove a collection to add another.
            </p>
          )}

          <button
            onClick={discover}
            style={{
              width: "100%",
              background: "rgb(149,117,255)",
              border: "none",
              borderRadius: 12,
              padding: "16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#0e0e0e",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            Find collectors near this taste
          </button>
        </section>
      )}

      <footer style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px 48px" }}>
        <p style={{ fontSize: 11, color: "rgb(168,164,157)", opacity: 0.4 }}>
          Collections are the proof. Overlap is the signal.
        </p>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </main>
  );
}
