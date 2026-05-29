"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "./BrandLockup";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Wallet", href: "/wallet" },
  { label: "Compare", href: "/compare" },
  { label: "JPG Match", href: "/jpgs" },
] as const;

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 64,
        background: "var(--jpgs-bg)",
        borderBottom: "1px solid var(--jpgs-border)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 24px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          href="/"
          style={{ textDecoration: "none", flexShrink: 0 }}
          aria-label="I Like JPGs home"
        >
          <BrandLockup marginBottom={0} />
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            flexShrink: 0,
          }}
        >
          {NAV_ITEMS.map(({ label, href }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                  border: active
                    ? "1px solid var(--jpgs-border)"
                    : "1px solid transparent",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                  color: active ? "var(--jpgs-text)" : "var(--jpgs-muted)",
                  transition: "color 0.15s, background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--jpgs-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--jpgs-muted)";
                  }
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
