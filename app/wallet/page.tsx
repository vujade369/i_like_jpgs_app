"use client";

import { FormEvent, useState } from "react";

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
  error?: string;
};

type ReadState = "idle" | "loading" | "success" | "empty" | "error";

const SAMPLE_WALLET = "0x5ffd8de19910efff95df729c54699aebcee8f747";

export default function WalletReadPage() {
  const [wallet, setWallet] = useState("");
  const [state, setState] = useState<ReadState>("idle");
  const [profile, setProfile] = useState<WalletReadResponse | null>(null);
  const [error, setError] = useState("");

  async function readWallet(input: string) {
    const trimmed = input.trim();
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void readWallet(wallet);
  }

  function useSampleWallet() {
    setWallet(SAMPLE_WALLET);
    void readWallet(SAMPLE_WALLET);
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
          Enter an Ethereum wallet and see visible collection signals, grouped plainly.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="0x..."
            aria-label="Wallet address"
            style={{
              flex: "1 1 360px",
              minWidth: 0,
              background: "var(--jpgs-surface-2)",
              border: "1px solid var(--jpgs-border)",
              borderRadius: 8,
              padding: "15px 16px",
              color: "var(--jpgs-text)",
              fontSize: 14,
              outline: "none",
            }}
          />
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
              <p style={eyebrowStyle}>The Read</p>
              <h2 style={panelTitleStyle}>
                This wallet appears strongest around {profile.topCollections[0]?.name ?? "its top collections"}.
              </h2>
              <p style={mutedTextStyle}>
                The clearest signals come from repeated holdings within visible collections and simple metadata categories.
              </p>
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

function WalletHeader({ profile }: { profile: WalletReadResponse }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <p style={eyebrowStyle}>Wallet</p>
        <h2 style={{ ...panelTitleStyle, fontFamily: "var(--font-geist-mono)" }}>{profile.shortWallet}</h2>
        <p style={{ ...mutedTextStyle, fontSize: 12, wordBreak: "break-all" }}>{profile.wallet}</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Metric label="Visible NFTs" value={profile.nftCount} />
        <Metric label="Collections" value={profile.collectionCount} />
      </div>
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
