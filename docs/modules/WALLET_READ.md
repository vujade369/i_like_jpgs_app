# Wallet Read Module

## Status

Wallet Read v1 is complete enough for feedback/testing and is now the base for Compare work.

## Purpose

Wallet Read turns one wallet into a lightweight cultural taste profile based on visible NFT collection signals.

## User Promise

See what a wallet seems to care about, based on what it collects.

## Primary Flow

1. User enters a wallet address, ENS, or supported public profile input.
2. App fetches visible NFT holdings.
3. App identifies top collections, taste signals, and nearby collectors where supported.
4. App renders a readable wallet profile.
5. User may add a second wallet and switch between combined and individual views.

## Owned Pages

- /wallet

## Owned API Routes

- /api/wallet/read

## Shared Capabilities Used

- OpenSea wallet/NFT data
- collection metadata normalization
- collection image fallback handling
- category/taste grouping
- OpenSea links

## Inputs

- wallet address

## Outputs

- wallet address
- included wallets
- shortened address
- total visible NFTs checked
- total collections found
- top collections
- taste/category groups
- nearby collector overlap proof
- proof signals
- debug metadata in development

## v1 Acceptance

- Single-wallet read works.
- Two-wallet combined read works.
- Individual wallet tabs work.
- Top collections and taste signals render.
- Collectors nearby / collectors near this taste renders where supported.
- OpenSea-linked proof appears where available.
- Sample wallet entry point works.
- Nearby collector proof chips handle missing images and weaker labels gracefully.
- The presentation is responsive enough for early testing.

## Non-Goals

This module should not own:

- wallet-to-wallet comparison
- match feed
- messaging
- accounts
- saved profiles
- valuation
- rarity
- offers
- floor prices
- trading recommendations

## QA Checklist

- TypeScript passes.
- Valid wallet returns a profile.
- Empty wallet returns a useful empty state.
- Invalid wallet returns a clear error.
- Top collections show readable names.
- Collection images are collection-level when available.
- Nearby collector proof chips degrade gracefully when collection metadata is incomplete.
- No finance or trading language appears.

## Deferred Resilience

Overlap collection identity may need a later data-layer hardening pass to preserve the best-known collection name, image, slug, and OpenSea URL across discovery surfaces. This should not be bundled into Compare work unless explicitly scoped.

## Definition of Done

This module is done when:

- /wallet works locally.
- /api/wallet/read returns structured profile data.
- top collections render clearly.
- taste signals render clearly.
- nearby collector proof renders without broken image or raw-label states.
- errors and empty states work.
- QA is documented.
