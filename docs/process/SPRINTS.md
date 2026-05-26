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

Status: Baseline built / pending Milestone 1 completion

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

The baseline proves that a wallet can become a useful cultural mirror, but the experience is not yet complete enough to close Milestone 1.

Milestone 1 completion now depends on:

- multi-wallet support
- combined vs individual wallet views
- source-wallet clarity
- stronger object-level proof
- archive-style rediscovery
- more collector-native section framing
- documented QA across edge cases

See:

- `docs/MILESTONE_1_COMPLETION_PLAN.md`
- `docs/WALLET_READ_PRODUCT_RULES.md`
- `docs/sprint-1-wallet-read.md`