"use client";

import Image from "next/image";

type BrandLockupProps = {
  marginBottom?: number;
};

export function BrandLockup({ marginBottom = 20 }: BrandLockupProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginBottom,
        color: "var(--jpgs-accent)",
      }}
    >
      <Image
        src="/i-like-jpgs-logo-mark-purple.png"
        alt=""
        width={512}
        height={512}
        sizes="32px"
        style={{
          width: 32,
          height: 32,
          objectFit: "contain",
        }}
      />
      <span
        style={{
          fontSize: 11,
          lineHeight: 1,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          transform: "translateY(1px)",
        }}
      >
        I Like JPGs
      </span>
    </div>
  );
}
