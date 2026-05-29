"use client";

import { CSSProperties, useEffect, useId, useRef, useState } from "react";

export type WalletSuggestion = {
  label: string;
  displayName?: string;
  username?: string;
  ens?: string;
  address?: string;
  avatarUrl?: string;
  source: string;
};

type SuggestState = "idle" | "loading" | "ready";

type WalletSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: WalletSuggestion) => void;
  selectedAddress?: string;
  label?: string;
  placeholder: string;
  ariaLabel: string;
  name?: string;
  disabled?: boolean;
  containerStyle?: CSSProperties;
  fieldStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function walletSuggestionValue(suggestion: WalletSuggestion): string {
  return suggestion.displayName || suggestion.ens || suggestion.username || suggestion.address || suggestion.label;
}

export function WalletSearchInput({
  value,
  onChange,
  onSelect,
  selectedAddress = "",
  label,
  placeholder,
  ariaLabel,
  name,
  disabled = false,
  containerStyle,
  fieldStyle,
  labelStyle,
  inputStyle,
}: WalletSearchInputProps) {
  const suggestionsId = useId();
  const [suggestions, setSuggestions] = useState<WalletSuggestion[]>([]);
  const [suggestState, setSuggestState] = useState<SuggestState>("idle");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = value.trim();

  useEffect(() => {
    if (query.length < 2 || selectedAddress || WALLET_ADDRESS_RE.test(query) || disabled) {
      setSuggestions([]);
      setSuggestState("idle");
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestState("loading");
      try {
        const res = await fetch(`/api/wallet/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { suggestions?: WalletSuggestion[] };
        const nextSuggestions = data.suggestions ?? [];
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestState("ready");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedAddress, disabled]);

  function handleChange(nextValue: string) {
    onChange(nextValue);
    setShowSuggestions(
      nextValue.trim().length >= 2 &&
        !WALLET_ADDRESS_RE.test(nextValue.trim()) &&
        !disabled &&
        suggestions.length > 0,
    );
  }

  function selectSuggestion(suggestion: WalletSuggestion) {
    onSelect(suggestion);
    setShowSuggestions(false);
  }

  const input = (
    <div style={{ position: "relative", minWidth: 0, ...containerStyle }}>
      <input
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          if (suggestions.length > 0 && !disabled) setShowSuggestions(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setShowSuggestions(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setShowSuggestions(false);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={showSuggestions}
        aria-controls={suggestionsId}
        disabled={disabled}
        name={name}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "var(--jpgs-surface-2)",
          border: "1px solid var(--jpgs-border)",
          borderRadius: 8,
          padding: "15px 16px",
          color: "var(--jpgs-text)",
          fontSize: 14,
          opacity: disabled ? 0.62 : 1,
          ...inputStyle,
        }}
      />
      {suggestState === "loading" && query.length >= 2 && !selectedAddress && !disabled && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 14,
            top: 17,
            width: 14,
            height: 14,
            border: "1.5px solid var(--jpgs-accent)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      )}
      {showSuggestions && suggestions.length > 0 && !disabled && (
        <div
          id={suggestionsId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "rgb(18,18,18)",
            border: "1px solid var(--jpgs-border)",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
          }}
        >
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.source}-${suggestion.address ?? suggestion.username ?? suggestion.ens ?? suggestion.label}`}
              type="button"
              role="option"
              onMouseDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              onClick={() => selectSuggestion(suggestion)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "34px 1fr auto",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                color: "var(--jpgs-text)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <SuggestionAvatar suggestion={suggestion} />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {suggestion.displayName || suggestion.label}
                </span>
                <span
                  style={{
                    display: "block",
                    color: "var(--jpgs-muted)",
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 2,
                  }}
                >
                  {formatSuggestionHandle(suggestion)}
                </span>
              </span>
              <span style={{ color: "var(--jpgs-muted)", fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>
                {shortWallet(suggestion.address)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!label) return input;

  return (
    <label style={{ display: "grid", gap: 7, ...fieldStyle }}>
      <span style={{ color: "var(--jpgs-muted)", fontSize: 12, ...labelStyle }}>{label}</span>
      {input}
    </label>
  );
}

function formatSuggestionHandle(suggestion: WalletSuggestion): string {
  const handle = suggestion.ens || suggestion.username;
  const address = shortWallet(suggestion.address);
  if (handle && address) return `${handle} · ${address}`;
  return handle || address || suggestion.source;
}

function SuggestionAvatar({ suggestion }: { suggestion: WalletSuggestion }) {
  if (suggestion.avatarUrl) {
    return (
      <img
        src={suggestion.avatarUrl}
        alt=""
        style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 8, background: "rgba(255,255,255,0.06)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        background: "rgba(149,117,255,0.12)",
        color: "var(--jpgs-accent)",
        fontSize: 11,
      }}
    >
      {(suggestion.displayName || suggestion.username || suggestion.ens || suggestion.label).slice(0, 2).toUpperCase()}
    </span>
  );
}

function shortWallet(wallet?: string): string {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}
