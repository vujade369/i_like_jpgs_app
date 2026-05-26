# I Like JPGs

I Like JPGs is a lightweight collector-discovery app for finding overlap between NFT collections and the wallets that hold them.

The current product is not about floor prices, trading, rarity, offers, or portfolio value. It is about cultural signal: what people collect, where taste overlaps, and why that overlap might be interesting.

## Current Module: JPG Match

JPG Match lets someone choose a small set of NFT collections and discover wallets that hold meaningful overlap across those collections.

The goal is simple:

> Can someone pick NFT collections and immediately understand why finding overlapping collectors is interesting?

This is the active Milestone 0 loop.

## Milestone 0 Focus

Milestone 0 is a showable, testable product loop.

It should prove:

- collection search works
- selected collections feel intentional
- matching wallets appear quickly enough
- overlap is legible
- collector cards feel culturally interesting
- the product avoids finance/trading language

This is not a full social network yet.

## Owned Surfaces

### Pages

- `app/jpgs/page.tsx`  
  Main JPG Match experience.

### API Routes

- `app/api/jpgs/collections/search/route.ts`  
  Searches OpenSea collections and ranks likely matches.

- `app/api/jpgs/wallets/discover/route.ts`  
  Finds wallets that hold selected collections and returns overlap results.

## Product Principles

- Taste over trading.
- Cultural signal over portfolio value.
- Overlap over status.
- Clear, playful, and understandable.
- No market framing.
- No ranking people by wealth, rarity, or financial performance.
- Collection names and images should feel trustworthy.
- Address fallbacks are acceptable when identity data is unavailable.

## Non-Negotiables

Do not add:

- floor price language
- rarity language
- offer language
- trading language
- portfolio value
- financial advice
- wallet valuation
- “alpha” framing

JPG Match should help people find collector overlap, not evaluate financial worth.

## Development Boundaries

Before starting a new module, make sure JPG Match still works.

Avoid product drift. For now, do not expand into:

- messaging
- profiles
- social graph features
- ENS reverse-name fallback
- market analytics
- wallet valuation
- collection investment data

If a change affects search, holder discovery, scoring, or results display, run the regression QA checklist.

## Getting Started

Install dependencies:

```bash
npm install