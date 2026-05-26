# JPG Match Module

## Purpose

JPG Match helps users choose NFT collections as taste signals and discover wallets with overlapping collection ownership.

## Inputs

- Selected collection objects
- Collection slugs
- OpenSea holder data

## Outputs

- Ranked wallet matches
- Matched collection counts
- OpenSea profile links

## Owned Pages

- /jpgs
- /jpgs/results

## Owned API Routes

- /api/jpgs/collections/search
- /api/jpgs/wallets/discover

## Shared Capabilities Used

- OpenSea collection search
- OpenSea collection details
- OpenSea collection holders
- OpenSea account profiles

## Must Not Own

- Wallet taste reports
- Wallet-to-wallet comparison
- User accounts
- Messaging
- Saved social profiles
- Event matching

## Extension Points

- ENS reverse-name fallback
- Better ranking
- More collection metadata
- Saved/shareable taste sets