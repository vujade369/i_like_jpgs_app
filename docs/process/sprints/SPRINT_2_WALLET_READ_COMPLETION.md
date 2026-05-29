# Sprint 2 — Wallet Read Completion

Status: Complete enough for feedback / Wallet Read v1 baseline closed

## Sprint Goal

Complete the Wallet Read experience for I Like JPGs.

Sprint 1 proved the foundation: a user can enter a wallet and receive a lightweight, non-financial read based on visible NFT collection signals.

Sprint 2 turns that baseline into a stable Wallet Read v1: multi-wallet clarity, combined and individual views, visible proof, nearby collectors, and a clear path into comparison.

The goal is not perfection or a full social product. The goal is a stable, usable v1 that can support feedback/testing and become the base for Compare.

## Milestone Context

Sprint 2 closes:

- **Milestone 1 — Wallet Read Completion**

Wallet Read v1 is now complete enough to move into feedback/testing and prepare Compare work.

Accepted v1 capabilities:

- Wallet read for a single wallet.
- Two-wallet combined read.
- Individual wallet tabs.
- Top collections.
- Taste signals.
- Collectors nearby / collectors near this taste.
- OpenSea-linked proof where available.
- Sample wallet entry point.
- Nearby collector proof chips resilient to missing images and weaker labels.
- Responsive-enough presentation for early testing.

## Product Loop

Enter wallet → add another wallet if useful → read visible collecting patterns → inspect proof → explore nearby collectors → compare with another collector.

## User Promise

“See what a wallet set seems to care about, based on the JPGs it collects.”

## Current Starting Point

Already built before Sprint 2:

- `/wallet` page exists.
- `/api/wallet/read` exists.
- A user can enter a wallet, ENS, OpenSea profile, or address.
- Wallet suggestions work.
- Suggestion avatars are enriched.
- Multi-wallet foundation exists with a current two-wallet limit.
- Wallet chips exist.
- Add/remove wallet behavior exists.
- Wallet set is encoded in the URL.
- Backend dedupes duplicate NFTs across included wallets.
- Backend preserves source-wallet metadata internally.
- Header metrics now use `JPGs read` language.
- The page avoids obvious financial framing.
- TypeScript passed at the previous stopping point.

## Closeout Notes

Wallet Read v1 is good enough to move forward. Earlier archive/timeline ideas remain useful product direction, but they are not required to close this sprint.

Accepted deferrals:

- Timeline signals.
- From the Archive module.
- Fuller methodology/trust layer.
- Broader responsive polish beyond early testing needs.
- Data-layer hardening for overlap collection identity preservation.

Perfection is not the sprint goal. The sprint goal is a usable Wallet Read v1 that makes visible collection signals legible and can support feedback before Compare work begins.

## Nearby Collector Proof Chip Status

The defensive presentation pass is complete.

- Missing or failed collection images now render quiet designed fallbacks.
- Weak/raw-looking collection labels are cleaned up where possible.
- Held counts remain visible when present.
- Discovery, ranking, filtering, result caps, API behavior, enrichment, and image fetching were intentionally untouched.

## Deferred Known Issue — Overlap Collection Identity

Nearby collector proof chips now handle incomplete metadata gracefully at the presentation layer. A later data-layer hardening pass may still be useful to stabilize overlap collection identity so nearby collector proof chips preserve the best available collection name, image, slug, and OpenSea URL across discovery surfaces. Prevent weaker fallback data from overwriting stronger enriched data.

This is deferred resilience work and does not block Wallet Read v1.

Future acceptance criteria:

- Best-known collection name is preserved once discovered.
- Best-known collection image is preserved once discovered.
- Raw contract or slug fallback appears only as a last resort.
- Overlap chips expose enough diagnostics to identify where identity was lost.
- No ranking, discovery, API behavior, or result cap changes are bundled into this hardening task unless explicitly scoped.

## Original Sprint Scope (Historical)

The original scope below is retained for context. The closeout notes above are the current source of truth for Wallet Read v1 completion.

### In Scope

- Combined / individual view controls.
- Active wallet view state.
- Recalculated read for the active wallet view.
- Section rename and product framing pass.
- Rooms in the Collection.
- Places You Kept Returning.
- Timeline.
- From the Archive.
- Object-level proof cards.
- Source-wallet labels where useful.
- Small Signals.
- Methodology drawer or compact trust layer.
- Compare CTA.
- Empty/sparse/error/mobile QA.
- Docs updates after implementation.

### Out of Scope

Do not build:

- Wallet-to-wallet comparison logic.
- Match feed.
- Messaging.
- User accounts.
- Saved profiles.
- Claiming flow.
- Privacy controls.
- Floor prices.
- Offers.
- Portfolio valuation.
- Rarity ranking.
- Trading recommendations.
- AI identity labels.
- Psychological labels.

## Product Principles

- Objects first.
- Interpretation second.
- Proof near claims.
- Visible collecting behavior only.
- Combined reads should feel like one collector with multiple rooms, not several profiles stapled together.
- Source-wallet attribution should be available without dominating the page.
- Duplicate NFTs should not inflate counts.
- Hide empty modules.
- Explain uncertainty lightly.
- Keep the page cultural, not financial.

## Language Rules

Use:

- suggests
- appears
- leans
- points toward
- visible signal
- collection pattern
- repeat collecting
- anchor
- archive
- room
- thread

Avoid:

- proves
- is
- best
- most valuable
- floor
- offer
- ROI
- alpha
- smart money
- whale
- elite
- ranked
- superior

## Current Wallet Read v1 Shape

Wallet Read v1 includes:

1. Homepage wallet input
2. Wallet Set Controls
3. Combined / Individual View Controls
4. Wallet read results
5. Top collections
6. Taste signals
7. Collectors nearby / collectors near this taste
8. Sample wallet entry point
9. OpenSea-linked proof where available
10. Resilient nearby collector proof chips

Future Wallet Read ideas such as Timeline, From the Archive, and deeper methodology can return after Compare direction is validated.

## Original Build Tracks (Historical)

### Track 1 — Combined and Individual Views

Goal: make the multi-wallet foundation understandable and usable.

Build:

- Add active view state:
  - `combined`
  - individual wallet address / source id
- Add controls for:
  - Combined
  - Wallet 1
  - Wallet 2
- When active view is Combined, read all included wallets.
- When active view is an individual wallet, read only that wallet.
- Keep URL behavior stable.
- Keep remove wallet behavior stable.
- Make the active view visually obvious.

Recommended first implementation:

- Avoid a large API refactor.
- Let the frontend refetch `/api/wallet/read` with either all wallets or one selected wallet.
- Preserve the existing API response shape.
- Add a small loading state when switching views.

Acceptance:

- User can add two wallets.
- Combined read works.
- Individual wallet views work.
- Removing a wallet recalculates the active read.
- Wallet chips still show included sources.
- The read makes clear whether the user is looking at the combined set or one wallet.

### Track 2 — Archive Framing Pass

Goal: move the page away from dashboard language and toward collector-native archive language.

Rename / reframe:

- `Top collections` → `Places You Kept Returning`
- `Taste signals` → `Rooms in the Collection`
- `Wallet` / `Wallet set` header → `Collector Hero` framing where possible

Keep the language simple. Do not over-style it before the structure works.

Acceptance:

- The page feels less like analytics.
- Section names match the product direction.
- Counts remain useful but do not dominate.
- No finance, rarity, offer, or valuation language appears.

### Track 3 — Object-Level Proof

Goal: make the read trustworthy by showing actual JPGs near claims.

Build:

- Add curated proof NFTs to the API response.
- Add proof previews inside Rooms in the Collection.
- Show collection name, NFT name if available, and image.
- Link proof objects to OpenSea when possible.
- In multi-wallet reads, show a subtle source-wallet label when useful.
- Do not render the entire wallet.

Selection rules:

- Prefer visible images.
- Prefer representative pieces from the category or collection being discussed.
- Avoid duplicates across major modules where possible.
- Prefer collection-level image for collection cards; NFT thumbnails are proof, not decoration.

Acceptance:

- The Read points to visible proof.
- Rooms include actual NFT examples.
- Proof cards do not feel random.
- Source-wallet context is available for multi-wallet reads.
- Empty proof sections do not render.

### Track 4 — Timeline

Goal: give the read memory and orientation.

Build:

- First Known NFT.
- Latest Arrival.
- Deepest Return / strongest collection anchor.

Rules:

- Use reliable event/acquisition data only when available.
- If acquisition timing is weak or missing, hide the date-dependent module rather than faking certainty.
- Deepest Return can use strongest collection anchor by count as the first version.

Acceptance:

- Timeline renders when enough data exists.
- Timeline hides gracefully when data is missing.
- The module feels like memory, not analytics.
- The page does not overclaim historical precision.

### Track 5 — From the Archive

Goal: create a rediscovery moment that makes the wallet feel personal.

Build:

- Add `archivePieces` or equivalent API output.
- Render a small section of older, quieter, or underrepresented pieces.

Selection should favor:

- older acquisitions where reliable
- visible images
- pieces not already shown in top modules
- quieter collections
- underrepresented categories
- source-wallet variety in multi-wallet reads

Acceptance:

- Archive pieces feel intentionally selected.
- Archive pieces are not duplicates of the main signal cards.
- The section hides if good candidates are unavailable.
- The copy avoids nostalgia clichés.

### Track 6 — Small Signals

Goal: add lightweight collector-native observations without becoming personality analysis.

Build 2–4 deterministic callouts from structured data.

Possible signals:

- Broad vs deep collection pattern.
- One room/category dominates the read.
- One wallet contributes most of a visible signal.
- A collection acts as the spine of the read.
- The wallet set has more range than repetition.
- The wallet set has more repetition than range.

Rules:

- Use cautious language.
- Avoid identity claims.
- Avoid status claims.
- Avoid market claims.
- Keep proof nearby or obvious.

Acceptance:

- Signals feel specific to the wallet.
- Signals are not generic filler.
- Signals do not sound like labels or judgments.

### Track 7 — Trust and Methodology Layer

Goal: explain how the read works without weighing down the page.

Build:

- A compact methodology drawer, note, or collapsible section.
- Explain visible public holdings.
- Explain supported chains.
- Explain category uncertainty.
- Explain dedupe behavior.
- Explain missing metadata lightly.

Acceptance:

- A user can understand why the read may be incomplete.
- The page does not pretend classification is perfect.
- The trust layer is available but not visually dominant.

### Track 8 — Compare CTA

Goal: give the user a clear next action without prematurely building comparison logic.

Build:

- A final CTA toward comparison.
- Frame comparison as overlap, resonance, or shared collecting patterns.

Possible copy:

- `Compare this read with another collector.`
- `Find the overlap between two collectors.`
- `See where two collections start to rhyme.`

Acceptance:

- The next step is obvious.
- The CTA does not imply ranking, scoring, or financial comparison.
- The CTA can point to a placeholder or future compare route if the route is not ready.

## Recommended Build Order

### Pass 1 — View Controls and Section Rename

Ship first:

1. Combined / individual view controls.
2. Active view state.
3. Refetch selected individual wallet.
4. Rename Top Collections to Places You Kept Returning.
5. Rename Taste Signals to Rooms in the Collection.
6. Adjust header copy for combined vs individual reads.

This pass closes the most important structural gap.

### Pass 2 — Proof Cards

Ship next:

1. API proof NFT selection.
2. Proof cards for rooms.
3. Source-wallet labels on proof cards.
4. OpenSea proof links.
5. Empty-module hiding.

This pass turns interpretation into trust.

### Pass 3 — Timeline and Archive

Ship next:

1. First Known NFT.
2. Latest Arrival.
3. Deepest Return.
4. From the Archive.
5. graceful fallbacks when date/object data is weak.

This pass makes the read feel like a collector archive.

### Pass 4 — Small Signals and Methodology

Ship next:

1. Deterministic small signals.
2. Methodology drawer.
3. Language pass.
4. Overclaiming pass.

This pass makes the read more understandable and trustworthy.

### Pass 5 — QA and Docs Closeout

Ship last:

1. Full manual QA.
2. Mobile QA.
3. TypeScript.
4. Update sprint docs.
5. Update Milestone 1 checklist.
6. Decide whether Milestone 1 is complete.

## QA Checklist

Run:

```bash
npx tsc --noEmit
```

Manual checks:

- One valid wallet returns a read.
- One valid ENS returns a read.
- One valid OpenSea profile/username returns a read.
- Two wallets can be added.
- Two-wallet limit state appears.
- Combined view works.
- Individual wallet views work.
- Removing a wallet recalculates the read.
- Duplicate NFTs do not inflate combined counts.
- Source-wallet context appears where useful.
- Empty wallet does not crash.
- Sparse wallet does not render empty modules.
- Invalid wallet shows a clear error.
- Missing metadata does not break the page.
- Collection names are readable.
- Collection images prefer collection-level metadata.
- NFT thumbnails are used as proof, not random decoration.
- OpenSea links work.
- Mobile layout remains usable.
- No floor, offer, value, rarity, alpha, whale, ROI, or trading language appears.

## Test Inputs

Use these as the first QA set:

- `vuja-de.eth`
- `0x5ffd8de19910efff95df729c54699aebcee8f747`
- `vuja_de_vault`
- `0x16f3d833bb91aebb5066884501242d8b3c3b5e61`
- combined main + vault wallet
- one sparse wallet
- one invalid input

Add more wallets as bugs appear.

## Acceptance Criteria

Sprint 2 is complete when:

- One-wallet read feels complete.
- Multi-wallet read works.
- Combined view works.
- Individual wallet views work.
- Wallet chips are visible and useful.
- Source-wallet metadata is preserved and shown where useful.
- Duplicate NFTs are deduped in combined reads.
- Top collections render with readable proof.
- Taste signals render and stay non-financial.
- Collectors nearby / collectors near this taste renders when supported.
- Nearby collector proof chips handle missing images and weaker labels gracefully.
- OpenSea-linked proof appears where available.
- Sample wallet entry point works.
- Empty states are graceful.
- Error states are clear.
- Mobile layout is usable enough for early feedback.
- TypeScript passes.
- QA notes are documented.
- The experience remains non-financial.

## Milestone Exit Question

Would a collector send this page to someone and say:

> “This is actually kind of me.”

If yes, Milestone 1 can close.

## First Codex Prompt

Use this prompt to begin Sprint 2:

```text
We are starting Sprint 2 — Wallet Read Completion for I Like JPGs.

Before editing, read:
- README.md
- docs/process/SPRINTS.md
- docs/process/sprints/SPRINT_1_WALLET_READ.md
- docs/process/sprints/SPRINT_2_WALLET_READ_COMPLETION.md
- docs/MILESTONE_1_COMPLETION_PLAN.md
- docs/WALLET_READ_PRODUCT_RULES.md
- app/wallet/page.tsx
- app/api/wallet/read/route.ts

Task for this pass:
Add Combined / Individual wallet views to /wallet and reframe the baseline sections into Sprint 2 archive language.

Scope:
- Add active view state for combined vs individual wallet reads.
- Add simple controls for Combined, Wallet 1, Wallet 2 when multiple wallets are included.
- Combined view should read all included wallets.
- Individual views should read only that selected wallet.
- Avoid a large API refactor unless absolutely necessary.
- Preserve existing wallet chips, add/remove behavior, URL behavior, suggestions, and two-wallet limit.
- Rename Top Collections to Places You Kept Returning.
- Rename Taste Signals to Rooms in the Collection.
- Update header copy so the user understands whether they are seeing a combined wallet set or one wallet.
- Keep language non-financial and cautious.
- Do not add comparison logic, market data, rarity, offers, valuation, accounts, messaging, or saved profiles.

After changes:
- Run npx tsc --noEmit.
- Manually test one wallet, two wallets, combined view, individual views, remove wallet, invalid wallet, and mobile layout if possible.
- Summarize files changed and any follow-up work.
```

## Notes

Start boring.

The main risk is trying to make the page feel rich before the view model is clean. First make the wallet set understandable. Then make the read beautiful, archival, and specific.

---

## Implementation Note — Wallet Read Identity Header

Wallet Read now uses the first included wallet as the public identity anchor.

Combined reads show additional wallets as included context and address proof, not as equal social profiles. This keeps the header recognizable without making it feel like a contact card or social profile.

Public social/profile links remain deferred until account metadata is inspected and confirmed.

Implementation notes:

- Header uses existing `sourceWallets` metadata only.
- No `/api/wallet/read` changes were needed.
- Duplicate NFT dedupe remains part of the read logic but is no longer surfaced as visible header copy.
- Wallet chips no longer show an “identity anchor” label.
- Header avatar, identity text, and metrics were visually aligned as one restrained identity block.
