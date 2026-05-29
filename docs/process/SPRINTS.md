# Sprints

This file tracks the active build sequence for I Like JPGs.

Each sprint should stay narrow. Sprint docs describe what the sprint is meant to prove, what is in scope, what is intentionally out of scope, and what must be true before the sprint is considered complete.

---

## Sprint 0 — JPG Match Foundation

Status: Active / baseline foundation

### Goal

Make JPG Match reliable enough to demo and use as the first I Like JPGs product loop.

### Product Loop

Pick collections → discover overlapping collectors → understand why the overlap is interesting.

### Scope

- collection search
- selected taste set
- wallet discovery
- collector result cards
- OpenSea profile links
- basic QA docs
- hydration reliability

### Non-goals

- wallet taste report
- wallet-to-wallet comparison
- messaging
- user accounts
- saved profiles
- market data
- valuation
- rarity analysis

### Acceptance Criteria

- TypeScript passes
- collection search returns expected collections
- wallet discovery returns ranked matches
- collector cards include display name and OpenSea URL
- UI avoids financial framing
- regression QA is documented

### Demo Script

1. Open JPG Match.
2. Select two or more collections.
3. Run discovery.
4. Review overlapping collectors.
5. Explain that JPG Match finds cultural overlap, not portfolio value.

### Retro Notes

Sprint 0 established the first product loop: collection-led wallet discovery.

Keep future JPG Match work focused on reliability, search quality, result quality, and collector-card trust. Do not let wallet read or wallet comparison work get mixed into this sprint.

---

## Sprint 1 — Wallet Read

Status: Baseline built / completed by Sprint 2 closeout

### Goal

Build the first wallet-read foundation for I Like JPGs.

A user should be able to enter a wallet and receive a lightweight, culturally interesting, non-financial read based on visible NFT collection signals.

### Product Loop

Enter wallet → read visible collecting patterns → inspect proof → understand what the wallet seems to care about.

### Scope

- wallet input
- wallet address / ENS handling where supported
- visible NFT fetch
- top collections
- collection images
- basic category / taste grouping
- lightweight profile summary
- loading state
- empty state
- error state
- OpenSea links where useful

### Non-goals

- wallet-to-wallet comparison
- match feed
- messaging
- user accounts
- saved profiles
- claiming flow
- privacy controls
- valuation
- floor prices
- rarity analysis
- offers
- trading recommendations
- AI personality labeling
- psychological identity claims

### Acceptance Criteria

- TypeScript passes
- a user can enter a wallet
- the app returns a readable wallet profile
- top collections render with names and images
- category / taste signals are visible
- empty wallets do not crash
- failed API calls show a clear error
- loading state feels intentional
- no finance, rarity, offer, or valuation language appears
- the module has a documented QA path

### Demo Script

1. Open Wallet Read.
2. Enter a wallet.
3. Show the wallet header.
4. Explain the read.
5. Point to proof through top collections.
6. Show taste signals.
7. Explain what comes next: a richer multi-wallet read, then wallet comparison.

### Retro Notes

Sprint 1 established the first wallet-read baseline.

The baseline proved that a wallet can become a useful cultural mirror. Sprint 2 closed the v1 gaps needed for early feedback/testing.

Sprint 2 later added:

- multi-wallet support
- combined vs individual wallet views
- source-wallet clarity
- stronger visible proof
- collectors nearby / collectors near this taste
- nearby collector proof chip resilience
- documented QA across edge cases

See:

- `docs/MILESTONE_1_COMPLETION_PLAN.md`
- `docs/WALLET_READ_PRODUCT_RULES.md`
- `docs/process/sprints/SPRINT_1_WALLET_READ.md`
- `docs/process/sprints/SPRINT_2_WALLET_READ_COMPLETION.md`

---

## Sprint 2 — Wallet Read Completion

Status: Complete enough for feedback / Wallet Read v1 baseline closed

### Goal

Close Wallet Read v1 as a stable, usable read based on visible collection signals.

### Accepted Capabilities

- Single-wallet read.
- Two-wallet combined read.
- Individual wallet tabs.
- Top collections.
- Taste signals.
- Collectors nearby / collectors near this taste.
- Sample wallet entry point.
- OpenSea-linked proof where available.
- Nearby collector proof chips resilient to missing images and weaker labels.
- Responsive-enough presentation for early testing.

### Retro Notes

Wallet Read v1 is not perfect, and that is acceptable. It is now useful enough to gather feedback and serve as the base for Compare.

Deferred resilience: overlap collection identity preservation may need a later data-layer hardening pass so the best-known collection name, image, slug, and OpenSea URL are not downgraded by weaker fallback metadata. This is not a Wallet Read v1 blocker.

---

## Sprint 3 — Compare v1

Status: Next

### Goal

Build Compare as the relationship layer on top of Wallet Read.

Compare should answer what two wallets share, where they differ, what visible collection signals create the overlap, what taste categories they meet around, and what each wallet brings that the other does not.

### Product Loop

Choose two wallets → see shared visible signals → inspect shared collection proof → understand overlap and differences → decide what to explore next.

### Scope

- Comparison hero for Wallet A and Wallet B.
- Shared visible signal summary.
- Shared collection count.
- Visible JPG counts where available.
- Short proof-backed relationship read.
- Shared collection cards with both wallets' held counts.
- Category-level taste overlap.
- Taste differences by wallet.
- Optional nearby / next actions only if already supported.

### Non-goals

- Compatibility score as the primary framing.
- Financial, rarity, floor, value, or portfolio analysis.
- Ranking collectors by worth, status, or taste.
- Claims about identity beyond visible collection behavior.
- Broad Wallet Read refactors.
- Reopening collection identity hardening unless explicitly scoped.

### Implementation Sequence

1. Audit existing compare route/page/data structures.
2. Define Compare v1 data contract.
3. Build static page structure using existing Wallet Read patterns.
4. Add shared collection proof.
5. Add category overlap/difference sections.
6. Add editorial read last.
