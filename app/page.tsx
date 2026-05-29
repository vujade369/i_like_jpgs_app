import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";

export default function Home() {
  return (
    <>
      <style>{`
        .home-card {
          display: block;
          text-decoration: none;
          background: var(--jpgs-surface);
          border: 1px solid var(--jpgs-border);
          border-radius: 8px;
          padding: clamp(18px, 3.6vw, 24px);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .home-card:hover {
          border-color: rgba(255, 255, 255, 0.13);
          background: rgba(255, 255, 255, 0.025);
        }
        .home-cta-outline {
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .home-cta-outline:hover {
          border-color: rgba(255, 255, 255, 0.18) !important;
          background: rgba(255, 255, 255, 0.04) !important;
        }
      `}</style>

      <main className="min-h-screen" style={{ background: "var(--jpgs-bg)", color: "var(--jpgs-text)" }}>
        {/* Hero */}
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "72px 24px 48px" }}>
          <BrandLockup marginBottom={32} />

          <h1
            style={{
              fontSize: "clamp(36px, 5.5vw, 52px)",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              marginTop: 0,
              marginBottom: 20,
            }}
          >
            I Like JPGs
          </h1>

          <p style={{ color: "var(--jpgs-muted)", fontSize: 16, lineHeight: 1.7, maxWidth: 500, marginTop: 0, marginBottom: 8 }}>
            Read the visible collecting signals behind a wallet.
          </p>
          <p style={{ color: "var(--jpgs-muted)", fontSize: 16, lineHeight: 1.7, maxWidth: 500, marginTop: 0, marginBottom: 36 }}>
            See what someone collects, where your taste overlaps, and which collectors sit close to your corner of the internet.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
            <Link
              href="/wallet"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--jpgs-accent)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "0 22px",
                minHeight: 50,
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Start with a wallet
            </Link>

            <Link
              href="/compare"
              className="home-cta-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid var(--jpgs-border)",
                borderRadius: 8,
                padding: "0 22px",
                minHeight: 50,
                color: "var(--jpgs-text)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Compare two wallets
            </Link>
          </div>

          <p style={{ margin: 0 }}>
            <Link
              href="/wallet?wallet=vuja-de.eth"
              style={{
                fontSize: 13,
                color: "var(--jpgs-muted)",
                textDecoration: "underline",
                textDecorationColor: "rgba(168,164,157,0.3)",
                textUnderlineOffset: 3,
              }}
            >
              Try Vuja De&apos;s vault
            </Link>
          </p>
        </section>

        {/* Feature cards */}
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 80px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: "clamp(10px, 2vw, 14px)",
            }}
          >
            <Link href="/wallet" className="home-card">
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--jpgs-text)", marginTop: 0, marginBottom: 8, lineHeight: 1.35 }}>
                Read a wallet
              </p>
              <p style={{ fontSize: 13, color: "var(--jpgs-muted)", lineHeight: 1.65, margin: 0 }}>
                Visible collections, artists, and collector signals from any public wallet.
              </p>
            </Link>

            <Link href="/compare" className="home-card">
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--jpgs-text)", marginTop: 0, marginBottom: 8, lineHeight: 1.35 }}>
                Compare taste
              </p>
              <p style={{ fontSize: 13, color: "var(--jpgs-muted)", lineHeight: 1.65, margin: 0 }}>
                Shared collections and overlap between two wallets side by side.
              </p>
            </Link>

            <Link href="/jpgs" className="home-card">
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--jpgs-text)", marginTop: 0, marginBottom: 8, lineHeight: 1.35 }}>
                Find nearby collectors
              </p>
              <p style={{ fontSize: 13, color: "var(--jpgs-muted)", lineHeight: 1.65, margin: 0 }}>
                Wallets with similar collecting patterns to yours.
              </p>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
