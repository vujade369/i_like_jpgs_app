# I Like JPGs — Milestone 0 Sprint Brief

## Working Date

Prepared after the initial Constellate → I Like JPGs research pass.

## Core Correction

Milestone 0 is not just a landing page and not just wallet-connect intent.

Milestone 0 is:

> Enter a wallet. Get a live taste read.

Milestone 1 is:

> Compare two wallets.

That gives the product a clean progression:

```txt
Milestone 0
Single-wallet live taste read

Milestone 1
Two-wallet comparison

Milestone 2
Collection / taste-based wallet discovery

Milestone 3+
Social graph, nearby collectors, events, clubs, broader cultural overlap
```

---

# 1. Milestone 0 Goal

Build a lightweight I Like JPGs experience where a user can enter a wallet, ENS, or OpenSea profile and receive a live taste read based on the NFTs in that wallet.

The experience should answer:

> What does this wallet seem drawn toward?

Not:

- What is this wallet worth?
- What is the rarest NFT?
- What can this wallet sell for?
- How does this wallet rank?

The read should feel cultural, visual, social, and taste-led.

---

# 2. Success Signal

Milestone 0 is successful when:

```txt
A user enters or connects a wallet and gets a taste read that feels accurate enough, interesting enough, and personal enough to make them want to keep exploring.
```

The main success signal:

```txt
Strong interest in connecting or entering a wallet for taste discovery.
```

Secondary signals:

- User reads the result page
- User recognizes the categories as meaningful
- User understands why top collections surfaced
- User finds the proof NFTs believable
- User wants to compare with another wallet afterward

---

# 3. Product Promise

## Short Promise

```txt
A taste read for your NFT wallet.
```

## Slightly Fuller Promise

```txt
Connect a wallet and see the cultural signals behind what you collect — art, memes, identity, access, worlds, and the patterns between them.
```

## Product Framing

```txt
Not portfolio value.
Not rarity scores.
A read on taste, culture, and collecting behavior.
```

## Possible Hero Copy

```txt
I Like JPGs
A taste read for your NFT wallet.

Your collection is not just an asset list.
It is a record of what you recognize.
```

CTA:

```txt
Read my wallet
```

---

# 4. Scope

## Milestone 0 Includes

- `/jpgs` landing/input page
- Wallet / ENS / OpenSea profile input
- Live wallet NFT fetch
- NFT normalization
- Spam/noise filtering
- Taste classification
- Category mix
- Top collection cards
- Object/format signals
- Proof NFT strip
- Simple deterministic wallet read
- Loading state
- Error/empty states
- Testing against the 10 researched wallets

## Milestone 0 Does Not Include

- Two-wallet comparison
- Collector matching
- Nearby collectors
- Social graph
- AI-generated long interpretation
- Market value
- Floor price
- Offers
- Rarity
- Transaction history
- Account creation
- Saving taste sets
- Public profiles
- Sharing links, unless easy

---

# 5. Category System

Use the working I Like JPGs taste taxonomy.

## Top-Level Categories

```txt
Art
Generative
PFP / Identity
Meme / Internet Culture
Gaming / Worlds
Access / Membership
Collectibles
Music / Media
Unsorted Signals
```

## Core Principle

NFTs can belong to more than one category.

Examples:

```txt
Art + Generative
PFP / Identity + Access / Membership
Meme / Internet Culture + Art
Gaming / Worlds + Collectibles
Access / Membership + PFP / Identity
Music / Media + Art
Art + AI + Edition
PFP / Identity + Meme / Internet Culture
```

The backend should support multi-label classification.

The frontend should show the clearest primary story.

---

# 6. Source Roles

## Alchemy

Use Alchemy as the primary inventory source.

```txt
Alchemy = ownership truth
```

Use it for:

- wallet NFT inventory
- contract address
- token ID
- token standard
- balance
- NFT name
- image
- animation fields
- raw metadata
- attributes / traits
- collection metadata carried through `contract.openSeaMetadata`

## OpenSea

Use OpenSea as the public/display enrichment layer.

```txt
OpenSea = public/display truth
```

Use it for:

- public collection display names
- collection images
- collection slugs
- visible inventory filtering when needed
- wallet/account profile display when needed
- collection pages / source links

## I Like JPGs Classifier

Use our own logic for taste interpretation.

```txt
Our classifier = taste interpretation
```

Use it for:

- category classification
- tags
- confidence
- evidence
- frontend-friendly display labels
- read generation inputs

---

# 7. Data Lessons From Research

From the 10-wallet audit, we learned:

## Reliable Enough

Most NFTs provide:

- token standard
- contract address
- token ID
- NFT name
- image
- collection slug
- collection name
- collection image
- traits / attributes, often enough to classify
- animation/media fields, sometimes
- collection metadata

## Strong Signals

The following signals are useful for classification:

- ERC-721
- ERC-1155
- edition-like
- PFP-like
- meme-culture
- generative-like
- access-pass
- domain / identity object
- animated / interactive
- game/world asset
- artist-led
- traits like Artist, Meme Name, Palette, Background, Eyes, Mouth, etc.

## Cautions

- Alchemy spam flags are not enough.
- Our early spam heuristic was too broad.
- “Agentic / AI-adjacent” is interesting but noisy.
- “Open Metaverse” is better as a tag or ecosystem signal, not a top-level category.
- “Other” should be called **Unsorted Signals**.
- Marketplace categories are useful, but not enough for our product.

---

# 8. Recommended Backend Model

## NFT Classification Shape

```ts
type TasteCategory =
  | "art"
  | "generative"
  | "pfp_identity"
  | "meme_internet_culture"
  | "gaming_worlds"
  | "access_membership"
  | "collectibles"
  | "music_media"
  | "unsorted_signals";

type NftTasteClassification = {
  primaryCategory: TasteCategory;
  secondaryCategories: TasteCategory[];

  tags: string[];

  signals: {
    tokenStandard?: "ERC721" | "ERC1155" | "UNKNOWN";
    isArtistLed?: boolean;
    isEditionLike?: boolean;
    isOneOfOneLike?: boolean;
    isGenerative?: boolean;
    isPfpLike?: boolean;
    isMemeCulture?: boolean;
    isAccessPass?: boolean;
    isGameAsset?: boolean;
    isWorldObject?: boolean;
    isMusicOrMedia?: boolean;
    isIdentityObject?: boolean;
    isOnChain?: boolean;
    isInteractive?: boolean;
    isSpamSuspect?: boolean;
  };

  confidence: Partial<Record<TasteCategory, number>>;

  evidence: {
    source: "alchemy" | "opensea" | "metadata" | "traits" | "knownCollectionMap" | "heuristic";
    field: string;
    value: string;
    category: TasteCategory;
    weight: number;
  }[];
};
```

## Wallet Taste Read Shape

```ts
type WalletTasteRead = {
  wallet: {
    input: string;
    address: string;
    displayName?: string;
    avatarUrl?: string;
    openseaUrl?: string;
  };

  summary: {
    headline: string;
    read: string;
    confidence: "high" | "medium" | "low";
  };

  categoryMix: {
    category: TasteCategory;
    label: string;
    count: number;
    percentage: number;
  }[];

  topSignals: {
    label: string;
    strength: number;
    evidenceCount: number;
  }[];

  topCollections: {
    name: string;
    slug: string;
    imageUrl?: string;
    heldCount: number;
    categories: TasteCategory[];
    tags: string[];
  }[];

  proofNfts: {
    name: string;
    imageUrl?: string;
    collectionName: string;
    categories: TasteCategory[];
    tokenStandard?: "ERC721" | "ERC1155" | "UNKNOWN";
  }[];

  diagnostics?: {
    fetchedCount: number;
    classifiedCount: number;
    filteredSpamCount: number;
    unsortedCount: number;
    sourceWarnings: string[];
  };
};
```

---

# 9. Read Page Structure

## Route

```txt
/jpgs/read?wallet=
```

## Sections

### 1. Header

```txt
Your JPG Read
A live read of the cultural signals in this wallet.
```

### 2. Short Interpretation

Example:

```txt
This wallet leans toward Meme / Internet Culture and PFP / Identity, with a secondary pull toward Generative work. The strongest signal is not portfolio value, but repeated participation in shared cultural objects.
```

### 3. Taste Map

Show category mix using the nine categories.

Avoid making the first impression feel too dashboard-like.

Use the visual breakdown as support, not the whole story.

### 4. Top Signals

Display concise pills:

```txt
Edition-heavy
Meme-native
Identity-led
Generative-leaning
Interactive work
Access objects
```

### 5. Top Collections

Show collection cards:

- collection image
- collection name
- held count
- primary category
- tags

### 6. Proof NFTs

Show a small strip/grid of NFTs that explain the read:

- NFT image
- NFT name
- collection
- category tags

### 7. Debug/Diagnostics

Only show in dev or behind a debug flag.

---

# 10. Deterministic Read Generation

No AI required for Milestone 0.

Use rules.

## Example Rules

If top category is `meme_internet_culture`:

```txt
This wallet carries a strong internet-native signal: humor, remix, references, and crypto-cultural language.
```

If `edition-like` is high:

```txt
It also leans toward editions, cards, and repeatable cultural objects — things collected as shared signals rather than isolated trophies.
```

If `pfp_identity` is high:

```txt
There is a visible social identity layer here: avatars, names, characters, and objects that signal belonging.
```

If `generative` is high:

```txt
There is a clear pull toward systems-based visual work: code, variation, structure, and chance.
```

If `access_membership` is high:

```txt
This wallet includes objects that behave like keys: passes, credentials, memberships, and community markers.
```

If `unsorted_signals` is high:

```txt
Some parts of this wallet resist clean classification, either because the metadata is thin, the contracts are unusual, or the objects are still unresolved.
```

---

# 11. Proposed Repo Structure

```txt
app/jpgs/
  page.tsx
  read/
    page.tsx
  jpgs.css

app/api/jpgs/read/
  route.ts

lib/jpgs/
  tasteCategories.ts
  normalizeNft.ts
  spamFilter.ts
  classifyNftTaste.ts
  buildWalletTasteRead.ts
  readCopy.ts

docs/
  I_LIKE_JPGS_MILESTONE_0.md
  NFT_TASTE_CATEGORIES.md
```

---

# 12. Build Sprint

## Sprint 0.1 — Category + Classifier Foundation

Create:

```txt
lib/jpgs/tasteCategories.ts
lib/jpgs/spamFilter.ts
lib/jpgs/classifyNftTaste.ts
```

Goal:

```txt
Given a normalized NFT, return categories, tags, confidence, and evidence.
```

Tasks:

- Define `TasteCategory`
- Define category labels/descriptions
- Add keyword and trait mappings
- Add known collection overrides
- Add stricter spam filtering
- Add category confidence scoring
- Allow multiple categories

Done when:

```txt
A sample NFT can produce a primary category, secondary categories, tags, confidence, and evidence.
```

---

## Sprint 0.2 — Normalize NFT Data

Create:

```txt
lib/jpgs/normalizeNft.ts
```

Goal:

```txt
Turn Alchemy/OpenSea-shaped NFTs into a consistent object for classification.
```

Tasks:

- Normalize token standard
- Normalize contract address
- Normalize token ID
- Normalize balance
- Normalize NFT name
- Normalize image/animation
- Normalize collection name/slug/image
- Normalize traits
- Preserve raw fields for evidence

Done when:

```txt
Classifier does not need to know whether the NFT came from Alchemy or OpenSea.
```

---

## Sprint 0.3 — Live Read API

Create:

```txt
app/api/jpgs/read/route.ts
lib/jpgs/buildWalletTasteRead.ts
```

Goal:

```txt
/api/jpgs/read?wallet= returns a live WalletTasteRead object.
```

Tasks:

- Accept wallet/ENS/OpenSea profile input
- Resolve wallet address using existing resolver if possible
- Fetch NFTs using Alchemy
- Normalize NFTs
- Remove definite spam
- Classify NFTs
- Build category mix
- Build top signals
- Build top collections
- Select proof NFTs
- Generate deterministic read
- Return diagnostics in dev/debug mode

Done when:

```txt
The endpoint returns a valid live read for the 10 test wallets.
```

---

## Sprint 0.4 — Landing/Input Page

Create:

```txt
app/jpgs/page.tsx
app/jpgs/jpgs.css
```

Goal:

```txt
User can enter a wallet and start a read.
```

Sections:

- Hero
- Wallet input
- Category preview
- Philosophy line
- CTA

Done when:

```txt
User can enter a wallet and navigate to /jpgs/read?wallet=
```

---

## Sprint 0.5 — Read Page UI

Create:

```txt
app/jpgs/read/page.tsx
```

Goal:

```txt
User sees a live, readable, visually clear wallet taste read.
```

Sections:

- Header
- Summary read
- Taste map
- Top signals
- Top collections
- Proof NFTs
- Error/loading states

Done when:

```txt
The result feels like a taste report, not an NFT dashboard.
```

---

## Sprint 0.6 — QA Against Test Wallets

Use the 10 researched wallets.

QA checklist:

- Does the wallet load?
- Are top collections correct?
- Are category labels sane?
- Are obvious spam objects removed?
- Are legitimate objects not over-filtered?
- Do proof NFTs visually support the read?
- Does the summary feel true?
- Is the page fast enough?
- Does it feel like I Like JPGs, not Constellate?

Done when:

```txt
At least 8 of 10 test wallets produce a credible read without manual intervention.
```

---

# 13. Test Wallets

Use the wallets from the research pass.

## Initial Set

```txt
0x5ffd8de19910efff95df729c54699aebcee8f747
0x6ecae358e99dfdd1abe900bebe5f775431c12324
0x16f3d833bb91aebb5066884501242d8b3c3b5e61
0x39cc9c86e67baf2129b80fe3414c397492ea8026
0x9f6ae0370d74f0e591c64cec4a8ae0d627817014
```

## Second Set

```txt
0x250dc85178fb6859e9ee02c925d46aab946a55e7
0x77ffea617cb5e85f30eaca48d420df7e48b3c633
0x8a8035f056af830b7205c58c1dc037f826fc2b92
0x590c55ddacb5e047b5b531b8300ef04c5431b9c3
0x6f33e7b6460dac803c53ab6e02da8c675633d516
```

---

# 14. Acceptance Criteria

Milestone 0 is done when:

```txt
A user can enter a wallet.
The app fetches live NFTs.
The app classifies most NFTs into the new taste categories.
The user sees a readable taste map.
The top collections and proof NFTs feel accurate.
The read feels cultural, not financial.
Spam/noise is mostly controlled.
The result makes the user curious to compare with another wallet.
```

Internal acceptance:

```txt
The category model is reusable.
The classifier has evidence and confidence.
The API returns a clear WalletTasteRead object.
The frontend is decoupled from raw Alchemy/OpenSea shapes.
The system is ready for Milestone 1 comparison.
```

---

# 15. Milestone 1 Preview

Milestone 1 compares two `WalletTasteRead` objects.

It should reuse Milestone 0.

Compare:

- shared collections
- shared categories
- shared object signals
- shared artists / tags
- differences in collecting behavior
- proof NFTs from both wallets

Milestone 1 page framing:

```txt
Where your collections overlap.
Where your taste rhymes.
Where your wallets diverge.
```

Milestone 0 proves the mirror.  
Milestone 1 proves the overlap.

---

# 16. Guiding Philosophy

```txt
Collections are the proof.
Categories are the meaning.
Formats are the behavior.
Traits and artists are the texture.
```

The product should feel like taste discovery, not portfolio analysis.
