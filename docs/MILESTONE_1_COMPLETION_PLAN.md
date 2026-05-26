# Milestone 1 — Wallet Read Completion Plan

## Goal

Complete the wallet read experience for I Like JPGs.

A user should be able to enter one or more wallets and receive a culturally interesting, non-financial collector read that feels accurate, visual, and worth exploring.

## Success Criteria

Milestone 1 is complete when:

- A user can read one wallet.
- A user can add multiple wallets.
- A user can switch between combined and individual wallet views.
- The read shows actual NFT proof near interpretive claims.
- The page includes origin, latest arrival, taste rooms, collection anchors, and archive pieces.
- The read avoids financial, rarity, and trading language.
- Empty, sparse, invalid, and metadata-poor wallets behave gracefully.
- The page has a documented QA path.
- The next action toward comparison is clear.

## Non-Goals

Do not build:

- wallet-to-wallet comparison logic
- match feed
- messaging
- accounts
- saved profiles
- claiming
- privacy controls
- floor prices
- offers
- valuation
- rarity ranking
- AI identity labels

## Experience Principle

The wallet read should feel like a living archive, not a dashboard.

Objects first.
Interpretation second.
Metrics only when useful.
Proof always nearby.

## Required Sections

1. Collector Hero
2. Wallet Set Controls
3. Timeline
4. The Read
5. Rooms in the Collection
6. Places You Kept Returning
7. From the Archive
8. Small Signals
9. Compare CTA

## Build Tracks

### Track 1 — Multi-wallet foundation

- Add multiple wallet input support.
- Show wallet chips.
- Support add/remove wallet.
- Encode wallet set in URL.
- Dedupe NFTs across wallets.
- Preserve source wallet metadata.

### Track 2 — Single vs combined toggles

- Add Combined view.
- Add individual wallet views.
- Recalculate read based on active wallet set.
- Keep source attribution available.

### Track 3 — More interesting read

- Add Timeline.
- Add From the Archive.
- Rename Top Collections to Places You Kept Returning.
- Reframe Taste Signals as Rooms in the Collection.
- Add small collector-native signal callouts.

### Track 4 — Trust and transparency

- Add proof near claims.
- Add info notes for combined wallets, taste rooms, first known NFT, and archive logic.
- Add methodology drawer.
- Avoid overclaiming.

### Track 5 — QA

- Test valid wallet.
- Test multi-wallet.
- Test sparse wallet.
- Test invalid wallet.
- Test missing metadata.
- Test mobile.
- Run TypeScript.

## Completion Checklist

- [ ] One wallet read works.
- [ ] Multi-wallet read works.
- [ ] Combined toggle works.
- [ ] Individual wallet toggles work.
- [ ] Wallet chips are visible.
- [ ] Source wallet metadata is preserved.
- [ ] First Known NFT renders if available.
- [ ] Latest Arrival renders if available.
- [ ] Taste rooms render.
- [ ] Collection anchors render.
- [ ] Archive module renders.
- [ ] Small signals render.
- [ ] Compare CTA exists.
- [ ] No financial language appears.
- [ ] Empty states are graceful.
- [ ] Error states are clear.
- [ ] `npx tsc --noEmit` passes.
- [ ] QA notes are documented.

## Milestone Exit Question

Would a collector send this page to someone and say, “This is actually kind of me”?

If yes, Milestone 1 is complete.