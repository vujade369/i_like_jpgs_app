# Compare Module

## Status

Planned for Sprint 3 / Compare v1.

Wallet Read v1 is complete enough for feedback/testing and is the base layer for Compare. Compare should be designed before implementation as the wallet-to-wallet relationship layer on top of Wallet Read's visible collection signal model.

## Purpose

Compare is the wallet-to-wallet social bridge for I Like JPGs.

It helps two collectors see where two public wallets visibly meet, where they differ, and what shared collecting signals might give them something to talk about. It should feel like a relationship read built from public JPG behavior, not a portfolio comparison or analytics report.

Core framing:

> I Like JPGs helps collectors find their people - either by discovering wallets near a taste, or by seeing where two wallets already overlap.

Compare owns the second loop:

> Enter two wallets -> see shared visible signals -> inspect proof -> understand overlap and differences -> have a better starting point for conversation.

## Product Principles

- Visible public collection signals only. Compare uses public wallet metadata and visible NFT holdings; it does not infer private identity, intent, wealth, or complete collecting history.
- Proof near interpretation. Every interpretive statement should sit near collection, count, or category proof.
- Overlap before score. The primary product moment is "where these wallets meet," not a compatibility number.
- Differences without competition. Differences should feel curious and generous, never like a ranking of better/worse taste.
- Social bridge, not analytics dashboard. The page should support recognition and conversation, not dense reporting.
- Cautious language. Prefer "suggests," "appears," "meets around," "leans toward," "diverges around," and "visible overlap."
- No identity verdicts. Compare can describe visible collecting behavior; it should not claim to know the people behind the wallets.
- Objects first. Collection images, names, counts, and links are the proof layer. Interpretation should be short and legible.

## Primary User Story

A user enters two wallets and quickly sees:

- where their visible collection signals overlap
- where their visible collection signals differ
- what shared categories or collections might give them something to talk about
- why the wallets appear adjacent, similar, or meaningfully different based on public collecting behavior

Example moment:

> These wallets meet around Meme / Internet Culture and PFP / Identity, with several shared collection anchors. Wallet A appears more concentrated in meme-native editions, while Wallet B brings more identity and access signals into the mix.

## Owned Pages

Planned:

- `/compare`

No Compare page exists yet in the app structure as of this planning doc.

## Owned API Routes

Planned options:

- `/api/compare`
- or a page/server data assembly path that reuses Wallet Read utilities directly

No Compare API route exists yet as of this planning doc.

## Page Sections for Compare v1

### A. Comparison Hero

Purpose: orient the user immediately around the two wallets and the visible overlap.

Should include:

- Wallet A public identity:
  - display name, ENS, username, avatar, shortened address where available
  - OpenSea profile link where available
- Wallet B public identity:
  - display name, ENS, username, avatar, shortened address where available
  - OpenSea profile link where available
- visible JPG counts where available
- visible collection counts
- shared collection count
- short shared signal summary, such as:
  - `Meets around Meme / Internet Culture and PFP / Identity`
  - `Light visible overlap, but both wallets lean into Art`
  - `Few shared collections; different corners of the visible map`

Language guardrails:

- Use "Wallet A" and "Wallet B" in internal docs and empty states.
- UI can use public labels like `vuja-de.eth` or shortened addresses.
- Do not say "your wallet" or "their real identity."

### B. The Read

Purpose: give a short editorial interpretation of the relationship between the two wallets.

The Read should be:

- short enough to scan
- proof-backed by shared collections and category overlap
- deterministic/template-based for v1
- careful about identity claims
- free of financial, rarity, portfolio, or status language

Acceptable v1 approach:

- Choose a headline based on overlap strength and top shared categories.
- Generate 1-2 body sentences from deterministic templates.
- Include 2-4 proof points, such as shared collection names or category counts.

Example:

> These wallets visibly meet around meme-native culture and identity objects. The clearest proof is shared collection depth in The Memes by 6529 and overlapping PFP / Identity signals, while Wallet B appears to bring a wider access/pass thread into the read.

Avoid:

- `90% compatible`
- `Wallet A has better taste`
- `This collector is a meme maximalist`
- `These portfolios are worth comparing`

### C. Shared Collections

Purpose: provide the concrete proof layer for the relationship read.

Each shared collection card should include:

- collection image where available
- collection name
- collection slug only as fallback
- Wallet A held count
- Wallet B held count
- combined/shared strength
- OpenSea collection link where available

Sorting for v1 can be simple and deterministic:

- highest combined held count
- then collections with counts on both sides
- then readable collection metadata quality
- then stable name/slug sort as a tie-breaker

Do not introduce price, floor, rarity, or value fields.

### D. Taste Overlap

Purpose: show category-level overlap from visible metadata.

Use the existing I Like JPGs taste categories where possible:

- Meme / Internet Culture
- PFP / Identity
- Art
- Generative
- Gaming / Worlds
- Collectibles
- Access / Membership
- Music / Media
- Unsorted Signals

Each overlap row should include:

- category label
- Wallet A visible count or collection count in that category
- Wallet B visible count or collection count in that category
- shared or adjacent collection examples when available
- cautious explanation of what the overlap suggests

This section should treat categories as interpretive signals, not rigid truth.

### E. Taste Differences

Purpose: make divergence useful and conversational.

Show:

- signals mostly unique to Wallet A
- signals mostly unique to Wallet B
- collection examples from each side
- category labels where useful

Tone:

- curious, not competitive
- "diverges around" rather than "beats"
- "Wallet A appears more concentrated in..." rather than "Wallet A is better at..."

Examples:

- `Wallet A diverges around meme-native editions.`
- `Wallet B brings more access and membership signals into the visible read.`
- `These wallets share identity objects, but Wallet A leans more toward art-led collections.`

### F. Empty / Low-Overlap State

Purpose: keep Compare useful even when the wallets do not visibly share many collections.

The page should:

- explain that the wallets do not visibly meet around many shared collection signals yet
- still show both wallet identities and visible counts where available
- show adjacent or different taste areas when possible
- avoid implying that no overlap means no relationship or no shared taste
- avoid blamey, broken, or dead-end language

Example:

> These wallets do not visibly meet around many shared collection signals yet. Wallet A appears to lean toward Meme / Internet Culture, while Wallet B shows more Art and Generative signals. That difference can still be useful: they may be looking at different corners of the same JPG map.

## Data Contract Draft

This draft is intentionally approximate. It should map to the existing Wallet Read response where possible before new fields are added.

```ts
type CompareV1Response = {
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
  summary: {
    sharedCollectionCount: number;
    sharedVisibleNftCount?: number;
    topSharedCategories: CompareCategoryOverlap[];
    overlapLevel: "strong" | "medium" | "light" | "none";
    headline: string;
  };
  read: {
    headline: string;
    body: string;
    proofPoints: Array<{
      label: string;
      detail?: string;
      collectionSlug?: string;
      category?: string;
    }>;
  };
  sharedCollections: CompareSharedCollection[];
  categoryOverlap: CompareCategoryOverlap[];
  differences: {
    walletA: CompareDifferenceSignal[];
    walletB: CompareDifferenceSignal[];
  };
  diagnostics?: CompareDiagnostics;
  debug?: CompareDebug;
};

type CompareWalletSummary = {
  input: string;
  address: string;
  shortWallet: string;
  displayName?: string;
  username?: string;
  ens?: string;
  avatarUrl?: string;
  openseaProfileUrl?: string;
  nftCount: number;
  collectionCount: number;
  topCollections: Array<{
    slug: string;
    name: string;
    imageUrl?: string;
    count: number;
    openseaUrl?: string;
  }>;
  tasteSignals: Array<{
    category: string;
    label: string;
    nftCount: number;
    collectionCount: number;
    collections: Array<{ slug: string; name: string; count: number }>;
  }>;
};

type CompareSharedCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource?: "collection" | "nft" | "none";
  openseaUrl?: string;
  walletACount: number;
  walletBCount: number;
  combinedCount: number;
  sharedStrength: "strong" | "medium" | "light";
  categories?: Array<{ category: string; label: string }>;
};

type CompareCategoryOverlap = {
  category: string;
  label: string;
  walletANftCount: number;
  walletBNftCount: number;
  walletACollectionCount: number;
  walletBCollectionCount: number;
  sharedCollectionSlugs: string[];
  exampleCollections: Array<{ slug: string; name: string; imageUrl?: string }>;
  summary: string;
};

type CompareDifferenceSignal = {
  category: string;
  label: string;
  nftCount: number;
  collectionCount: number;
  exampleCollections: Array<{ slug: string; name: string; count: number; imageUrl?: string }>;
  summary: string;
};

type CompareDiagnostics = {
  lowOverlap: boolean;
  sameWallet: boolean;
  partialData: boolean;
  walletAStatus?: "included" | "invalid" | "fetch_failed";
  walletBStatus?: "included" | "invalid" | "fetch_failed";
};

type CompareDebug = {
  source?: string;
  walletReadReuse?: "api" | "shared_utilities" | "other";
  maxVisibleNfts?: number;
  sharedCollectionIdentityFallbacks?: number;
  ignoredWalletInputs?: number;
};
```

### Mapping to Wallet Read

Existing Wallet Read fields that should be reused or adapted:

- `sourceWallets` -> `walletA` / `walletB` identity summaries
- `nftCount` -> visible JPG count per wallet
- `collectionCount` -> visible collection count per wallet
- `topCollections` -> collection summaries and difference examples
- `tasteSignals` -> category overlap and differences
- `debug` -> implementation diagnostics, kept separate from product UI

Important implementation note:

The current `/api/wallet/read` endpoint supports up to two wallets, but its combined read intentionally dedupes and merges visible holdings into one read. Compare needs per-wallet counts and shared collection proof, so implementation must either call/read each wallet separately or share lower-level utilities that preserve per-wallet collection rows.

## Reuse Strategy

Compare should reuse existing product infrastructure before inventing new paths:

- wallet resolution conventions from Wallet Read and OpenSea helpers
- Wallet Read visible collection signal model
- existing taste taxonomy and `classifyNftTaste`
- top collections and taste signal structures from `/api/wallet/read`
- collection image/name fallback rules:
  - collection image first
  - NFT image only when collection image is unavailable
  - readable collection name before slug
  - raw contract-looking labels only as last resort
- OpenSea profile and collection links where available
- existing dark editorial visual language from Wallet Read
- wallet suggestion behavior where practical
- development-only diagnostics/debug separation

Compare should not slow Wallet Read materially. If shared utilities are extracted, keep the change narrow and preserve existing Wallet Read behavior.

## Non-Goals

Compare v1 should not include:

- broad Wallet Read refactor
- collection identity hardening unless explicitly scoped
- marketplace, price, floor, offer, rarity, or valuation data
- compatibility score as primary framing
- rankings by wallet value, status, or taste quality
- multi-wallet comparison beyond two wallets
- auth/account system
- wallet claiming
- messaging, following, contact, or social profile features
- saved comparisons
- share cards unless trivial and already supported by route state
- changes to JPG Match discovery, ranking, filtering, or caps

## Acceptance Criteria

Compare v1 is ready when:

- user can compare two wallets
- both wallets resolve using existing conventions
- public wallet identities render
- visible JPG and collection counts render where available
- shared collections render with held counts for both wallets
- shared collection cards include readable names, images/fallbacks, and OpenSea links where available
- category-level overlap renders
- meaningful differences render for each wallet
- a short proof-backed read renders
- low/no-overlap state is acceptable and useful
- invalid wallet state is clear
- same-wallet comparison is handled intentionally
- page matches Wallet Read visual language
- no financial, ranking, trading, or identity-verdict language appears
- TypeScript and diff checks pass after implementation

## Open Implementation Questions

- Should Compare call `/api/wallet/read` twice, or should Wallet Read data assembly be extracted into shared utilities first?
- If shared utilities are extracted, how can that happen without changing Wallet Read response behavior?
- Should Compare v1 have a dedicated `/api/compare` endpoint, or should the route assemble data server-side?
- How should same-wallet comparison read: a self-overlap proof state, a gentle warning, or both?
- What is the first v1 sorting rule for shared collections when counts tie?
- Should category overlap use NFT counts, collection counts, or both in the UI?
- Should low-overlap still show nearby/different taste areas if one wallet is sparse?
