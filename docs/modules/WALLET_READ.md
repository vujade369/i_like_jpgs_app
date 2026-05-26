# Wallet Read Module

## Purpose

Wallet Read turns one wallet into a lightweight cultural taste profile based on visible NFT collection signals.

## User Promise

See what a wallet seems to care about, based on what it collects.

## Primary Flow

1. User enters a wallet address.
2. App fetches visible NFT holdings.
3. App identifies top collections and taste signals.
4. App renders a readable wallet profile.

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
- shortened address
- total visible NFTs checked
- total collections found
- top collections
- taste/category groups
- proof signals
- debug metadata in development

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
- No finance or trading language appears.

## Definition of Done

This module is done when:

- /wallet works locally.
- /api/wallet/read returns structured profile data.
- top collections render clearly.
- taste signals render clearly.
- errors and empty states work.
- QA is documented.
