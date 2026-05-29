# Sprint 3 - Compare v1

## Status

Active planning / next implementation sprint.

## Sprint Goal

Build Compare v1 as the first version of the wallet-to-wallet social bridge.

Compare should let a user enter two wallets and quickly understand where the wallets visibly overlap, where they differ, and what public collection signals could become a starting point for conversation.

## Product Framing

I Like JPGs has two complementary social loops:

- Find collectors near a taste.
- Find the overlap between two wallets.

Compare owns the second loop. It is the relationship layer built on top of Wallet Read.

Compare v1 should feel:

- social
- playful
- interpretive
- proof-backed
- behavior-led
- grounded in visible public collection signals

It should not feel like:

- generic NFT analytics
- portfolio comparison
- financial analysis
- status ranking
- a shallow compatibility gimmick
- a verdict on identity

## Sprint Constraints

- Build on Wallet Read v1.
- Keep v1 focused on two wallets only.
- Avoid broad Wallet Read refactors.
- Avoid reopening collection identity hardening unless explicitly scoped.
- Avoid scoring-first framing.
- Keep proof closer than clever copy.
- Use visible public collection signals only.
- Do not add marketplace, floor, price, valuation, rarity, offer, profit, or trading language.
- Do not add auth, accounts, messaging, following, contact actions, or saved social profiles.
- Do not change JPG Match discovery, ranking, filtering, caps, or wallet read behavior as part of this sprint.

## Current Repo Audit

Existing module/process docs:

- `docs/modules/WALLET_READ.md`
- `docs/modules/JPG_MATCH.md`
- `docs/MILESTONE_1_COMPLETION_PLAN.md`
- `docs/process/SPRINTS.md`
- `docs/process/BACKLOG.md`
- `docs/DECISIONS.md`
- `docs/WALLET_READ_PRODUCT_RULES.md`
- `docs/WALLET_READ_IDENTITY_LAYER.md`
- `.agents/skills/wallet-read-foundation.md`

Existing Compare docs:

- `docs/modules/COMPARE.md`
- `docs/process/sprints/SPRINT_3_COMPARE_V1.md`

Existing app routes/pages discovered:

- `/wallet` via `app/wallet/page.tsx`
- `/api/wallet/read` via `app/api/wallet/read/route.ts`
- `/api/wallet/suggest` via `app/api/wallet/suggest/route.ts`
- `/api/wallet/similar-collectors` via `app/api/wallet/similar-collectors/route.ts`
- `/jpgs` via `app/jpgs/page.tsx`
- `/jpgs/results` via `app/jpgs/results/page.tsx`
- `/api/jpgs/collections/search`
- `/api/jpgs/holders`
- `/api/jpgs/wallets/discover`

No existing `/compare` page or `/api/compare` route was found during planning.

Reusable code/data areas:

- wallet resolution and public identity helpers in `lib/jpgs/opensea.ts`
- Wallet Read data assembly in `app/api/wallet/read/route.ts`
- Wallet Read client types and visual patterns in `app/wallet/page.tsx`
- taste classification in `lib/jpgs/classifyNftTaste.ts`
- taste labels/categories in `lib/jpgs/tasteCategories.ts`
- nearby collector proof/discovery patterns in `app/api/wallet/similar-collectors/route.ts` and `lib/jpgs/holderDiscovery.ts`

Important finding:

`/api/wallet/read` already accepts up to two wallet inputs, but that mode creates a combined read and dedupes shared token identities. Compare needs side-by-side wallet summaries, per-wallet held counts, and shared collection proof. Implementation must decide whether to call Wallet Read once per wallet, or extract shared lower-level assembly utilities without changing Wallet Read behavior.

## Sprint Backlog

### Epic 1: Audit and Data Contract

Stories:

- Audit existing compare files/routes/pages/types.
- Confirm whether a `/compare` page or `/api/compare` route already exists.
- Identify reusable Wallet Read and JPG Results primitives.
- Identify the smallest safe data path for per-wallet summaries.
- Define the Compare v1 data contract.
- Keep diagnostics/debug fields separate from product UI fields.

Acceptance:

- Compare implementation starts from the documented contract in `docs/modules/COMPARE.md`.
- Open questions are either answered or captured before implementation.
- No unrelated app behavior changes are included in the audit step.

### Epic 2: API/Data Assembly

Stories:

- Resolve both wallet inputs using existing conventions.
- Fetch or assemble both visible wallet summaries.
- Preserve public identity fields for both wallets.
- Compute shared collections.
- Compute Wallet A held count and Wallet B held count for each shared collection.
- Compute combined/shared strength without financial meaning.
- Compute category-level overlap from visible metadata/taste signals.
- Compute mostly-unique difference signals for Wallet A.
- Compute mostly-unique difference signals for Wallet B.
- Add safe handling for low-overlap, sparse, invalid, failed, and same-wallet cases.
- Keep debug/diagnostics available only where useful and separate from product UI.

Acceptance:

- Data shape can power all v1 page sections.
- Shared collection proof is based on visible collection signals.
- Low/no-overlap state still returns useful summaries where possible.
- Existing Wallet Read response behavior remains unchanged unless explicitly approved.

### Epic 3: Page UI

Stories:

- Build Compare route/page shell.
- Add two-wallet input flow.
- Render comparison hero:
  - Wallet A identity
  - Wallet B identity
  - visible JPG counts where available
  - collection counts
  - shared collection count
  - short shared signal summary
- Render The Read:
  - short deterministic/editorial interpretation
  - proof-backed
  - no financial or identity-verdict language
- Render shared collections:
  - image/name
  - Wallet A held count
  - Wallet B held count
  - combined/shared strength
  - OpenSea link where available
- Render taste overlap:
  - category-level overlap
  - examples from visible metadata
- Render taste differences:
  - signals mostly unique to Wallet A
  - signals mostly unique to Wallet B
  - curious, not competitive
- Add loading, error, invalid, sparse, same-wallet, and low/no-overlap states.
- Keep the page visually aligned with Wallet Read's dark editorial language.

Acceptance:

- The page is useful without a compatibility score.
- The page shows proof before or near interpretation.
- Empty and sparse states feel intentional.
- UI does not introduce dashboard/finance/productivity-tool framing.

### Epic 4: QA and Sprint Close

Stories:

- QA known wallet pair.
- QA strong-overlap pair.
- QA low-overlap pair.
- QA sparse wallet.
- QA invalid wallet.
- QA same wallet twice.
- QA mobile layout.
- QA loading and error states.
- Run TypeScript.
- Run diff whitespace checks.
- Update docs with any implementation decisions that land.

Acceptance:

- Known QA cases are documented.
- TypeScript passes.
- `git diff --check` passes.
- Any deferred work is captured in backlog/docs.

## Implementation Sequence

1. Audit current compare route/page/data structures.
2. Define Compare v1 data contract.
3. Implement or adapt API/data response shape.
4. Build static page shell using Wallet Read visual patterns.
5. Add shared collection proof.
6. Add category overlap and differences.
7. Add deterministic The Read.
8. QA and close sprint.

Recommended build bias:

- Start with data clarity, then page proof, then editorial copy.
- Keep the first implementation boring and deterministic.
- Extract shared utilities only if calling existing routes creates duplicated network work or makes counts unreliable.

## QA Wallet Pairs

Known pair for initial implementation/testing:

- `vuja-de.eth`
- `0x16f3d833bb91aebb5066884501242d8b3c3b5e61`

Additional QA placeholders:

- Strong-overlap pair: TBD
- Low-overlap pair: TBD
- Sparse wallet: TBD
- Invalid wallet: `not-a-wallet`
- Same wallet twice: `vuja-de.eth` + `vuja-de.eth`

QA scenarios:

- Both wallets resolve.
- One wallet resolves, one is invalid.
- One wallet fetch fails.
- Both wallets have visible holdings.
- One wallet has very sparse visible holdings.
- Shared collection count is zero or near zero.
- Shared collection count is meaningful.
- Same wallet is entered twice.
- Mobile viewport preserves readable wallet identities and collection proof.

## Definition of Done

Sprint 3 is done when:

- A user can compare two wallets.
- Both wallets resolve using existing conventions.
- Public wallet identities render for both wallets.
- Visible JPG counts render where available.
- Collection counts render for both wallets.
- Shared collection count renders.
- Shared collections render with Wallet A and Wallet B held counts.
- Shared collection cards include readable names and resilient image fallbacks.
- OpenSea collection/profile links render where available.
- Category-level overlap renders.
- Meaningful taste differences render for each wallet.
- A short proof-backed read renders.
- Low/no-overlap state is acceptable and useful.
- Invalid wallet state is clear.
- Same-wallet state is intentional.
- Page matches Wallet Read visual language.
- Product language avoids finance, ranking, trading, status, and identity-verdict framing.
- TypeScript passes.
- `git diff --check` passes.

## Open Implementation Questions

- Should Compare call existing Wallet Read APIs internally/client-side, or should it share lower-level utilities with `/api/wallet/read`?
- If utilities are extracted from `app/api/wallet/read/route.ts`, how do we keep the existing Wallet Read API response unchanged?
- Should Compare v1 use a dedicated `/api/compare` endpoint, or assemble data inside the route/page?
- Should the shared collection match key be collection slug only for v1, or should contract/chain identity be included when available?
- How should same-wallet comparison be framed in UI: self-overlap proof, gentle warning, or both?
- Should category overlap prioritize NFT counts, collection counts, or a blended visible-signal summary?
- Should low-overlap differences render even when one wallet has too little metadata to classify confidently?
- How much of Wallet Read's wallet suggestion UI should be reused for two inputs?

## Sprint Close Notes

To be filled after implementation:

- Final data path chosen:
- QA wallet pairs used:
- Known limitations:
- Deferred follow-up:
