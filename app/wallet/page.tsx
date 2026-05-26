"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type TopCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource: "collection" | "nft" | "none";
  count: number;
  openseaUrl: string;
};

type TasteSignal = {
  category: string;
  label: string;
  nftCount: number;
  collectionCount: number;
  collections: Array<{ slug: string; name: string; count: number }>;
};

type WalletReadResponse = {
  wallet: string;
  shortWallet: string;
  nftCount: number;
  collectionCount: number;
  topCollections: TopCollection[];
  tasteSignals: TasteSignal[];
  debug?: {
    fetchedPages: number;
    chainsChecked: string[];
    chainCounts: Record<string, number>;
    fetchedPagesByChain: Record<string, number>;
    complete: boolean;
    stoppedReason: string;
    maxVisibleNfts: number;
    includeHidden: boolean;
  };
  error?: string;
};

type ReadState = "idle" | "loading" | "success" | "empty" | "error";
type SuggestState = "idle" | "loading" | "ready";

type WalletSuggestion = {
  label: string;
  displayName?: string;
  username?: string;
  ens?: string;
  address?: string;
  avatarUrl?: string;
  source: string;
};

const SAMPLE_WALLET = "0x5ffd8de19910efff95df729c54699aebcee8f747";
const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type WalletReadCopy = {
  headline: string;
  body: string;
};

const READ_LABELS: Record<string, string> = {
  Art: "art",
  Generative: "generative art",
  "PFP / Identity": "PFP culture",
  "Meme / Internet Culture": "meme culture",
  "Gaming / Worlds": "gaming and world-building objects",
  "Access / Membership": "access and membership objects",
  Collectibles: "collectibles",
  "Music / Media": "music and media",
  "Unsorted Signals": "visible collection clusters",
};

export default function WalletReadPage() {
  const [wallet, setWallet] = useState("");
  const [state, setState] = useState<ReadState>("idle");
  const [profile, setProfile] = useState<WalletReadResponse | null>(null);
  const [error, setError] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState("");
  const [selectedIdentity, setSelectedIdentity] = useState("");
  const [suggestions, setSuggestions] = useState<WalletSuggestion[]>([]);
  const [suggestState, setSuggestState] = useState<SuggestState>("idle");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function readWallet(input: string, identityOverride?: string) {
    const trimmed = (identityOverride || resolvedWallet || input).trim();
    if (!trimmed) {
      setState("error");
      setError("Enter a wallet address to read.");
      setProfile(null);
      return;
    }

    setState("loading");
    setError("");
    setProfile(null);

    try {
      const res = await fetch(`/api/wallet/read?wallet=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as WalletReadResponse;

      if (!res.ok) {
        setState("error");
        setError(data.error || "The wallet read failed.");
        return;
      }

      setProfile(data);
      setState(data.nftCount === 0 ? "empty" : "success");
    } catch {
      setState("error");
      setError("Could not reach the wallet read service.");
    }
  }

  useEffect(() => {
    const q = wallet.trim();

    if (q.length < 2 || resolvedWallet || WALLET_ADDRESS_RE.test(q)) {
      setSuggestions([]);
      setSuggestState("idle");
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestState("loading");
      try {
        const res = await fetch(`/api/wallet/suggest?q=${encodeURIComponent(q)}`, {
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
  }, [wallet, resolvedWallet]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSuggestions(false);
    void readWallet(wallet);
  }

  function useSampleWallet() {
    setWallet(SAMPLE_WALLET);
    setResolvedWallet("");
    setSelectedIdentity("");
    setShowSuggestions(false);
    void readWallet(SAMPLE_WALLET, SAMPLE_WALLET);
  }

  function handleWalletChange(value: string) {
    setWallet(value);
    setResolvedWallet("");
    setSelectedIdentity("");
    setShowSuggestions(
      value.trim().length >= 2 && !WALLET_ADDRESS_RE.test(value.trim()) && suggestions.length > 0,
    );
  }

  function selectSuggestion(suggestion: WalletSuggestion) {
    const readableLabel = suggestion.displayName || suggestion.ens || suggestion.username || suggestion.address || suggestion.label;
    setWallet(readableLabel);
    setResolvedWallet(suggestion.address ?? "");
    setSelectedIdentity(suggestion.address || suggestion.ens || suggestion.username || suggestion.label);
    setShowSuggestions(false);
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--jpgs-bg)", color: "var(--jpgs-text)" }}>
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "72px 24px 40px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--jpgs-accent)", marginBottom: 20 }}>
          I Like JPGs
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.15, marginBottom: 14 }}>
          Read a wallet by what it collects.
        </h1>
        <p style={{ maxWidth: 560, color: "var(--jpgs-muted)", fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
          Enter a wallet, ENS, or OpenSea profile to see visible public collection signals across supported chains, grouped plainly.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 360px", minWidth: 0 }}>
            <input
              value={wallet}
              onChange={(event) => handleWalletChange(event.target.value)}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setShowSuggestions(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="Search name, ENS, OpenSea profile, or wallet address"
              aria-label="Wallet, ENS, OpenSea username, or OpenSea profile URL"
              aria-expanded={showSuggestions}
              aria-controls="wallet-suggestions"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--jpgs-surface-2)",
                border: "1px solid var(--jpgs-border)",
                borderRadius: 8,
                padding: "15px 16px",
                color: "var(--jpgs-text)",
                fontSize: 14,
                outline: "none",
              }}
            />
            {suggestState === "loading" && wallet.trim().length >= 2 && !resolvedWallet && (
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
            {showSuggestions && suggestions.length > 0 && (
              <div
                id="wallet-suggestions"
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
                      <span style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {suggestion.displayName || suggestion.label}
                      </span>
                      <span style={{ display: "block", color: "var(--jpgs-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
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
          <button
            type="submit"
            disabled={state === "loading"}
            style={{
              background: "var(--jpgs-accent)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "0 18px",
              color: "white",
              fontSize: 14,
              minHeight: 50,
              opacity: state === "loading" ? 0.7 : 1,
            }}
          >
            {state === "loading" ? "Reading..." : "Read wallet"}
          </button>
          <button
            type="button"
            onClick={useSampleWallet}
            disabled={state === "loading"}
            style={{
              background: "transparent",
              border: "1px solid var(--jpgs-border)",
              borderRadius: 8,
              padding: "0 14px",
              color: "var(--jpgs-muted)",
              fontSize: 14,
              minHeight: 50,
            }}
          >
            Try sample
          </button>
        </form>
      </section>

      <section style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 80px" }}>
        {state === "idle" && (
          <Panel>
            <p style={eyebrowStyle}>Ready</p>
            <h2 style={panelTitleStyle}>Start with a public wallet.</h2>
            <p style={mutedTextStyle}>
              The first read stays close to the raw collection data: counts, collection names, images, and simple category signals.
            </p>
          </Panel>
        )}

        {state === "loading" && (
          <Panel>
            <p style={eyebrowStyle}>Reading</p>
            <h2 style={panelTitleStyle}>Fetching visible NFTs.</h2>
            <p style={mutedTextStyle}>This can take a moment while collection metadata is gathered.</p>
          </Panel>
        )}

        {state === "error" && (
          <Panel>
            <p style={{ ...eyebrowStyle, color: "rgb(255, 138, 128)" }}>Error</p>
            <h2 style={panelTitleStyle}>That wallet could not be read.</h2>
            <p style={mutedTextStyle}>{error}</p>
          </Panel>
        )}

        {state === "empty" && profile && (
          <Panel>
            <WalletHeader profile={profile} />
            <div style={{ borderTop: "1px solid var(--jpgs-border)", marginTop: 22, paddingTop: 22 }}>
              <h2 style={panelTitleStyle}>No visible NFTs found.</h2>
              <p style={mutedTextStyle}>
                This wallet did not return visible NFT holdings from the current source.
              </p>
            </div>
          </Panel>
        )}

        {state === "success" && profile && (
          <div style={{ display: "grid", gap: 18 }}>
            <Panel>
              <WalletHeader profile={profile} />
            </Panel>

            <Panel>
              <WalletReadSummary profile={profile} />
            </Panel>

            <Panel>
              <SectionHeading title="Top collections" detail={`${profile.collectionCount} collections found`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {profile.topCollections.map((collection) => (
                  <a
                    key={collection.slug}
                    href={collection.openseaUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 1fr",
                      gap: 12,
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--jpgs-border)",
                      borderRadius: 8,
                      padding: 10,
                      textDecoration: "none",
                      color: "var(--jpgs-text)",
                    }}
                  >
                    <CollectionImage collection={collection} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {collection.name}
                      </p>
                      <p style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>
                        {collection.count} held
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </Panel>

            {profile.tasteSignals.length > 0 && (
              <Panel>
                <SectionHeading title="Taste signals" detail="Based on visible metadata" />
                <div style={{ display: "grid", gap: 12 }}>
                  {profile.tasteSignals.slice(0, 6).map((signal) => (
                    <div
                      key={signal.category}
                      style={{
                        border: "1px solid var(--jpgs-border)",
                        borderRadius: 8,
                        padding: 14,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 500 }}>{signal.label}</h3>
                        <span style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>
                          {signal.nftCount} NFTs
                        </span>
                      </div>
                      <p style={{ color: "var(--jpgs-muted)", fontSize: 13, lineHeight: 1.6 }}>
                        Seen across{" "}
                        {signal.collections.map((collection) => collection.name).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function shortWallet(wallet?: string): string {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
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

function buildWalletRead(profile: WalletReadResponse): WalletReadCopy {
  const signalPhrases = profile.tasteSignals
    .slice()
    .sort((a, b) => b.nftCount - a.nftCount)
    .map((signal) => READ_LABELS[signal.label] ?? signal.label.toLowerCase())
    .filter((label) => label !== "visible collection clusters")
    .slice(0, 3);

  const proofCollections = profile.topCollections
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((collection) => collection.name)
    .filter(Boolean)
    .slice(0, 5);

  const fallbackCollections = proofCollections.slice(0, 3);
  const hasMoreCollections = profile.collectionCount > proofCollections.length;

  let headline: string;
  if (signalPhrases.length > 1) {
    headline = `This wallet reads like a collection pattern around ${formatList(signalPhrases)}.`;
  } else if (signalPhrases.length === 1) {
    headline = `This wallet leans toward ${signalPhrases[0]}.`;
  } else if (fallbackCollections.length > 1) {
    headline = `This wallet appears clustered around ${formatList(fallbackCollections)}.`;
  } else if (fallbackCollections.length === 1) {
    headline = `This wallet appears centered on ${fallbackCollections[0]}.`;
  } else {
    headline = "This wallet has a sparse visible collection pattern.";
  }

  const body =
    proofCollections.length > 0
      ? `The clearest proof is the repetition across ${formatList(proofCollections)}${
          hasMoreCollections ? ", and other visible collection clusters" : ""
        }.`
      : "There is not enough visible collection data to make a stronger read yet.";

  return { headline, body };
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function WalletReadSummary({ profile }: { profile: WalletReadResponse }) {
  const read = buildWalletRead(profile);

  return (
    <>
      <p style={eyebrowStyle}>The Read</p>
      <h2 style={panelTitleStyle}>{read.headline}</h2>
      <p style={mutedTextStyle}>{read.body}</p>
    </>
  );
}

function WalletHeader({ profile }: { profile: WalletReadResponse }) {
  const isCappedRead = profile.debug
    ? !profile.debug.complete || profile.debug.stoppedReason === "max_reached"
    : false;
  const maxVisibleNfts = profile.debug?.maxVisibleNfts.toLocaleString() ?? "1,000";
  const supportedChainNote = profile.debug?.chainsChecked.length
    ? `Across supported chains: ${profile.debug.chainsChecked.join(", ")}.`
    : "Across supported chains.";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={eyebrowStyle}>Wallet</p>
          <h2 style={{ ...panelTitleStyle, fontFamily: "var(--font-geist-mono)" }}>{profile.shortWallet}</h2>
          <p style={{ ...mutedTextStyle, fontSize: 12, wordBreak: "break-all" }}>{profile.wallet}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Metric label="NFTs read" value={profile.nftCount} />
          <Metric label="Collections" value={profile.collectionCount} />
        </div>
      </div>
      <p style={{ ...mutedTextStyle, fontSize: 12 }}>{supportedChainNote}</p>
      {isCappedRead && (
        <p style={{ ...mutedTextStyle, fontSize: 12 }}>
          This read is based on the first {maxVisibleNfts} visible NFTs returned by the current source.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 108, border: "1px solid var(--jpgs-border)", borderRadius: 8, padding: "12px 14px" }}>
      <p style={{ color: "var(--jpgs-muted)", fontSize: 11, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--jpgs-surface)", border: "1px solid var(--jpgs-border)", borderRadius: 8, padding: 22 }}>
      {children}
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 14 }}>
      <h2 style={panelTitleStyle}>{title}</h2>
      <p style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>{detail}</p>
    </div>
  );
}

function CollectionImage({ collection }: { collection: TopCollection }) {
  if (!collection.imageUrl) {
    return (
      <div style={imageFallbackStyle} aria-hidden="true">
        {collection.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={collection.imageUrl}
      alt=""
      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
    />
  );
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--jpgs-accent)",
  marginBottom: 10,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 400,
  lineHeight: 1.25,
  marginBottom: 8,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 14,
  lineHeight: 1.65,
};

const imageFallbackStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "rgba(149,117,255,0.14)",
  color: "var(--jpgs-accent)",
  fontSize: 13,
};
