"use client";

import { useState, useRef, useCallback } from "react";

export type OsCollection = {
  collection: string;
  name: string;
  description?: string;
  image_url?: string;
  safelist_request_status?: string;
  safelist_status?: string;
  contracts?: Array<{ address: string; chain?: string }>;
  opensea_url?: string;
};

type Props = {
  onSelect: (col: OsCollection) => void;
  atMax: boolean;
  selectedSlugs: ReadonlySet<string>;
  placeholder?: string;
  style?: React.CSSProperties;
  onStateChange?: (state: { hasResults: boolean; showSelectHint: boolean }) => void;
  compact?: boolean;
};

function isVerified(col: OsCollection): boolean {
  return col.safelist_status === "verified" || col.safelist_request_status === "verified";
}

export function CollectionSearchInput({
  onSelect,
  atMax,
  selectedSlugs,
  placeholder,
  style,
  onStateChange,
  compact = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OsCollection[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSelectHint, setShowSelectHint] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePlaceholder = placeholder ?? (compact ? "Add a collection…" : "Search collections…");

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setShowSelectHint(false);
        onStateChange?.({ hasResults: false, showSelectHint: false });
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/jpgs/collections/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { collections?: OsCollection[] };
        const cols = data.collections ?? [];
        setResults(cols);
        setShowSelectHint(false);
        onStateChange?.({ hasResults: cols.length > 0, showSelectHint: false });
      } finally {
        setSearching(false);
      }
    },
    [onStateChange],
  );

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setShowSelectHint(false);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runSearch(val), 350);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (results.length === 1) {
      handleSelect(results[0]);
    } else if (query.trim()) {
      setShowSelectHint(true);
      onStateChange?.({ hasResults: results.length > 0, showSelectHint: true });
    }
  }

  function handleSelect(col: OsCollection) {
    if (atMax && !selectedSlugs.has(col.collection)) return;
    onSelect(col);
    setQuery("");
    setResults([]);
    setShowSelectHint(false);
    onStateChange?.({ hasResults: false, showSelectHint: false });
  }

  const showDropdown = results.length > 0;

  const inputBase: React.CSSProperties = compact
    ? {
        width: "100%",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "10px 14px",
        color: "rgb(240,237,230)",
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        background: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "16px 20px",
        color: "rgb(240,237,230)",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
      };

  return (
    <div style={style}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          aria-describedby={atMax ? "jpgs-collection-limit-message" : undefined}
          style={inputBase}
          onFocus={(e) => {
            if (!compact) e.currentTarget.style.borderColor = "rgba(149,117,255,0.5)";
          }}
          onBlur={(e) => {
            if (!compact) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          }}
        />
        {searching && (
          <div style={{
            position: "absolute",
            right: compact ? 12 : 16,
            top: "50%",
            transform: "translateY(-50%)",
          }}>
            <div style={{
              width: compact ? 14 : 16,
              height: compact ? 14 : 16,
              border: "1.5px solid rgb(149,117,255)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        )}
      </div>

      {showSelectHint && (
        <p style={{
          fontSize: 12,
          color: "rgb(149,117,255)",
          marginTop: 8,
          paddingLeft: compact ? 2 : 4,
          opacity: 0.8,
        }}>
          Select a collection from the list.
        </p>
      )}

      {atMax && (
        <p
          id="jpgs-collection-limit-message"
          style={{
            fontSize: 11,
            color: "rgba(168,164,157,0.45)",
            marginTop: 8,
            paddingLeft: compact ? 2 : 4,
          }}
        >
          Maximum 10. Remove a collection to add another.
        </p>
      )}

      {showDropdown && (
        <div style={{
          marginTop: 4,
          background: "#161616",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: compact ? 10 : 12,
          overflow: "hidden",
        }}>
          {results.map((col) => {
            const isSelected = selectedSlugs.has(col.collection);
            const disabled = atMax && !isSelected;
            return (
              <button
                key={col.collection}
                onClick={() => { if (!disabled) handleSelect(col); }}
                aria-disabled={disabled}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: compact ? 10 : 12,
                  padding: compact ? "10px 14px" : "12px 16px",
                  textAlign: "left",
                  background: isSelected ? "rgba(149,117,255,0.08)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  color: "rgb(240,237,230)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {col.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={col.image_url}
                    alt=""
                    style={{
                      width: compact ? 28 : 32,
                      height: compact ? 28 : 32,
                      borderRadius: 6,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: compact ? 28 : 32,
                    height: compact ? 28 : 32,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.08)",
                    flexShrink: 0,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: compact ? 13 : 14,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {col.name}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: "rgb(168,164,157)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 2,
                  }}>
                    {col.collection}
                    {isVerified(col) && (
                      <span style={{ marginLeft: 6, color: "rgb(149,117,255)", opacity: 0.8 }}>✓</span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "rgb(149,117,255)",
                    flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
