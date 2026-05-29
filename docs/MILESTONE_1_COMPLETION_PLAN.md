# Milestone 1 — Wallet Read Closeout and Compare Preparation

## Goal

Close Wallet Read v1 as the visible collection signal foundation, then move into Compare.

Wallet Read v1 should be stable enough for feedback/testing. Compare v1 should build on that model as the relationship layer between two wallet reads.

## Wallet Read v1 Status

Wallet Read v1 is complete enough to move forward when:

- A user can read one wallet.
- A user can create a two-wallet combined read.
- A user can switch between combined and individual wallet views.
- Top collections render as visible collection anchors.
- Taste signals render as visible metadata-based signals.
- Collectors nearby / collectors near this taste renders where supported.
- OpenSea-linked proof appears where available.
- The sample wallet entry point works.
- Nearby collector proof chips are resilient to missing images and weaker labels.
- Empty, sparse, invalid, and metadata-poor wallets behave gracefully enough for early testing.
- The read avoids financial, rarity, and trading language.

Perfection is not the goal. The goal is a stable, usable v1 that can support feedback and become the base for Compare.

## Nearby Collector Proof Chips

The presentation hardening pass is complete:

- Missing or failed collection images render quiet fallbacks.
- Weak/raw-looking labels are cleaned up where possible.
- Held counts remain visible when present.
- Discovery, ranking, filtering, result caps, API behavior, enrichment, and image fetching were intentionally untouched.

## Deferred Resilience

Nearby collector proof chips now handle incomplete metadata gracefully at the presentation layer. A later data-layer hardening pass may still be useful to preserve best-known collection name, image, slug, and OpenSea URL once discovered, and prevent later fallback data from downgrading stronger metadata.

This is deferred and does not block Wallet Read v1.

Future acceptance criteria:

- Best-known collection name is preserved once discovered.
- Best-known collection image is preserved once discovered.
- Raw contract or slug fallback appears only as a last resort.
- Overlap chips expose enough diagnostics to identify where identity was lost.
- No ranking, discovery, API behavior, or result cap changes are bundled into this hardening task unless explicitly scoped.

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

## Wallet Read Experience Principle

The wallet read should feel like a living archive, not a dashboard.

Objects first.
Interpretation second.
Metrics only when useful.
Proof always nearby.

## Next Focus — Compare v1

Compare v1 is the relationship layer built on top of Wallet Read.

Canonical docs:

- `docs/modules/COMPARE.md`
- `docs/process/sprints/SPRINT_3_COMPARE_V1.md`

It should answer:

- What do these two wallets share?
- Where do they differ?
- What visible collection signals create the overlap?
- What taste categories do they meet around?
- What does each wallet bring that the other does not?

Recommended Compare v1 sections:

1. Comparison hero: Wallet A, Wallet B, shared visible signal summary, shared collection count, visible JPG counts where available.
2. The Read: short editorial interpretation of the relationship, proof-backed, not financial, not forensic, and not a verdict on identity.
3. Shared collections: concrete proof layer with collection cards and both wallets' held counts.
4. Taste overlap: category-level overlap across visible metadata.
5. Taste differences: signals mostly unique to Wallet A and mostly unique to Wallet B.
6. Nearby / next actions: optional, only if already supported.

Compare voice:

- Social.
- Playful.
- Interpretive.
- Proof-backed.
- Slightly dating-app energy without becoming shallow or creepy.
- Avoid financialized language.
- Avoid ranking collectors by worth or status.
- Avoid pretending the app knows the whole person.

Suggested language:

- shared signal
- visible overlap
- collection signal
- taste overlap
- adjacent taste
- strongest shared signals
- different corner of the map
- meets around
- diverges around

Avoid:

- compatibility score as the primary framing
- soulmate/match cliche
- portfolio analysis language
- net worth/status/taste ranking
- claims about identity beyond visible collection behavior

## Compare Implementation Notes

Compare should reuse Wallet Read data contracts where possible and should not reopen Wallet Read collection identity hardening unless explicitly scoped.

Do not begin with a broad refactor.

Suggested sequence:

1. Audit existing compare route/page/data structures.
2. Define Compare v1 data contract.
3. Build static page structure using existing Wallet Read patterns.
4. Add shared collection proof.
5. Add category overlap/difference sections.
6. Add editorial read last.
