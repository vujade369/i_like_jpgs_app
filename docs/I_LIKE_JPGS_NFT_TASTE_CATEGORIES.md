# I Like JPGs — NFT Taste Categories

## Purpose

This note defines the working category system for **I Like JPGs** taste reports.

The goal is not to recreate marketplace filters. OpenSea-style categories are useful for navigation, but our product is trying to answer a different question:

> What does this wallet seem drawn toward?

So these categories should behave like **taste signals**, not rigid inventory bins.

An NFT can belong to more than one category. That is expected. The backend should preserve multiple signals, while the frontend should present the clearest category story.

---

## Preferred Top-Level Category Set

1. [[Art]]
2. [[Generative]]
3. [[PFP / Identity]]
4. [[Meme / Internet Culture]]
5. [[Gaming / Worlds]]
6. [[Access / Membership]]
7. [[Collectibles]]
8. [[Music / Media]]
9. [[Unsorted Signals]]

---

## Core Product Principle

### Categories are not shelves. They are signals.

A single NFT can be:

- Art + Generative
- PFP + Membership
- Meme + Art
- Gaming + Collectible
- Access + Domain
- Music + Membership
- Art + AI + Edition
- PFP + Meme + Community

The frontend should not force every NFT into one narrow bucket. The category system should allow overlap because NFT culture itself overlaps.

---

# 1. Art

## Definition

Artist-led visual work, editions, photography, illustration, conceptual work, digital painting, 1/1s, and culturally meaningful visual objects.

This is the broadest serious bucket.

## Includes

- Fine art
- Cryptoart
- 1/1s
- Editions
- Photography
- Illustration
- Digital painting
- Conceptual visual work
- Artist-led collections
- Experimental visual work
- AI art, when the primary signal is visual/artistic rather than agentic
- Video art, when the primary signal is artist-led

## Sub-tags

- Photography
- 1/1
- Edition
- AI
- Video
- Illustration
- Conceptual
- Artist-led
- Cryptoart
- On-chain art

## Examples

- SuperRare works
- Foundation-style 1/1s
- OSF Editions
- XCOPY-related works
- OONA editions
- Jeremy Booth works
- Matt Kane works
- mendezmendez editions
- Artist-led Manifold editions

## Backend Signals

Likely Art signals:

```ts
created_by
artist
metadata.artist
traits.Artist
collection.description includes "artist", "art", "edition", "cryptoart"
platform hints: SuperRare, Foundation, KnownOrigin, Manifold
token format: ERC-721 or ERC-1155
```

## Frontend Description

**Art**  
Artist-led visual work, editions, photography, and cultural objects.

## Notes

Photography should live under Art for now. It can become its own category later if enough wallets show a strong photo-specific collecting pattern.

---

# 2. Generative

## Definition

Work shaped by code, systems, variation, algorithms, chance, or on-chain/procedural output.

Generative deserves its own top-level bucket even though it is also art. Generative collecting behaves differently. Collectors often care about systems, provenance, outputs, rarity, long-form projects, Art Blocks-adjacent culture, and algorithmic process.

## Includes

- Long-form generative art
- On-chain generative art
- Algorithmic visual systems
- Procedural outputs
- Art Blocks-style projects
- Code-based visual work
- Interactive generative works
- Trait-based generative systems when the system itself is the point

## Sub-tags

- Long-form
- On-chain
- Algorithmic
- Art Blocks
- Interactive
- Trait-based
- Procedural
- Code-based
- System-led

## Examples

- Chromie Squiggle
- Art Blocks projects
- OnchainGlyphs
- LIFT by Snowfro
- ATAKTOS
- CUBE
- MINDWAVE
- Genesis by DCA
- Code/system-led visual projects

## Backend Signals

Likely Generative signals:

```ts
collection.name includes "Art Blocks", "generative", "on-chain", "onchain"
collection.slug includes "artblocks", "generative", "onchain"
metadata.description includes "algorithm", "code", "system", "procedural"
traits include "Palette", "Seed", "Algorithm", "Iteration", "Grid", "Geometry"
animation_url may exist
contract/project known in generative collection map
```

## Frontend Description

**Generative**  
Work shaped by code, systems, variation, and chance.

## Notes

Generative can overlap with Art, PFP / Identity, or Music / Media. The question is whether the system/process is meaningful enough to surface as a taste signal.

---

# 3. PFP / Identity

## Definition

Avatar-based collections and social identity objects.

PFPs are not just collectibles. They are identity signals. They carry community, status, humor, group belonging, visual persona, and sometimes access.

## Includes

- Avatar collections
- PFP projects
- Character-based identity collections
- ENS and name objects
- Social markers
- Profile-linked NFTs
- Community identity objects
- Trait-heavy identity collections
- Badge-like social objects when identity is the main function

## Sub-tags

- Avatar
- ENS
- Name
- Community
- Status
- Character
- Trait-heavy
- Blue-chip
- Social identity
- Profile object

## Examples

- ENS names
- NORMIES
- Pudgy Penguins / Pudgy-adjacent objects
- NodePunkes
- The Florentines
- Meebugs
- Still Alive
- Larvamigos
- Punks derivatives
- Milady derivatives
- Identity-signaling badges

## Backend Signals

Likely PFP / Identity signals:

```ts
traits include Eyes, Mouth, Body, Background, Clothes, Head, Hair, Skin
collection.description includes avatar, identity, profile, community
collection.slug === "ens"
contractAddress === ENS contract
token name ends with .eth
metadata resembles character/avatar trait schema
```

## Frontend Description

**PFP / Identity**  
Avatar collections and social identity objects.

## Notes

Domains should usually be a sub-tag here or under Access / Membership depending on context. ENS often behaves as identity first, access second.

---

# 4. Meme / Internet Culture

## Definition

Collecting shaped by humor, remix, references, crypto-native language, and shared internet culture.

A meme NFT is not the same as a PFP or an art edition, even when it visually overlaps. It signals internet fluency, cultural timing, humor, participation, and shared references.

## Includes

- Pepe culture
- 6529 ecosystem
- Meme cards
- Rememes
- Remix culture
- Crypto-native jokes
- Internet-native references
- Satire
- Absurdist editions
- GM culture
- Community memes

## Sub-tags

- Pepe
- 6529
- ReMeme
- Remix
- Crypto-native
- Viral
- Satire
- GM
- Internet-native
- Culture card

## Examples

- The Memes by 6529
- Meme Lab by 6529
- The Complaint Cards
- EcoMemes
- Dollar Meme Shop
- Notable Pepes
- Potentially Notable Pepes
- OPEPEPEN
- My Meme Folder
- SEIZING
- Pepe editions and derivatives

## Backend Signals

Likely Meme / Internet Culture signals:

```ts
collection.name includes "meme", "pepe", "gm", "seize", "6529"
collection.slug includes "meme", "pepe", "6529", "seizing"
traits include "Meme Name", "Punk 6529", "GM", "Pepe", "OM"
metadata.created_by includes 6529 Collections
known collection map includes 6529 ecosystem
```

## Frontend Description

**Meme / Internet Culture**  
Crypto-native humor, remix, references, and shared online language.

## Notes

This should remain separate from Art. Many meme NFTs are art, but the cultural signal is distinct enough to deserve its own layer.

---

# 5. Gaming / Worlds

## Definition

Playable assets, virtual places, wearables, characters, world-based collecting, and game/metaverse-adjacent objects.

This category merges gaming assets and virtual worlds. For our report, those are often part of the same collector behavior: people collecting objects that belong to places, systems, or fictional environments.

## Includes

- Game assets
- Characters
- Wearables
- Rooms
- Land
- Virtual spaces
- World objects
- Metaverse items
- In-game collectibles
- Consumables
- Avatars when the world/game context is stronger than the identity context

## Sub-tags

- Game asset
- Land
- Wearable
- Character
- Consumable
- Metaverse
- Room
- World object
- Virtual place
- Playable

## Examples

- DungeonRooms
- Rilato
- Worlds
- GoArt Keys
- Voxels Wearables
- Galaxy Warriors
- Galaxy Eggs
- Creature World
- FEWOCiOUS x FewoWorld objects
- World/land/wearable projects

## Backend Signals

Likely Gaming / Worlds signals:

```ts
collection.name includes game, world, land, room, dungeon, wearable, plot
collection.description includes playable, metaverse, virtual world, avatar, asset
traits include Character, World, Land, Room, Wearable, Item, Level, Power
metadata includes model, vrm_url, 3D asset fields
animation_url or model fields may indicate interactive/world object
```

## Frontend Description

**Gaming / Worlds**  
Playable assets, virtual places, wearables, and world-based collecting.

## Notes

Do not overuse this label just because a collection says “metaverse.” The NFT should feel like an object within a world, not simply art about a world.

---

# 6. Access / Membership

## Definition

Tokens that act less like objects and more like keys, passes, credentials, tickets, club signals, or belonging markers.

This category absorbs utility, memberships, passes, event tokens, POAP-like items, token-gated access, and some domain/credential objects.

## Includes

- Membership passes
- Access passes
- Tickets
- Event tokens
- POAP-like objects
- Token-gated access
- Credentials
- Community passes
- Mint passes
- Founder passes
- Allowlist objects
- Domain objects when access/credential function is primary

## Sub-tags

- Membership
- Pass
- POAP
- Domain
- Ticket
- Credential
- Token-gated
- Founder pass
- Mint pass
- Event
- Community access

## Examples

- SeizerDAO membership
- Storyverse Founders Pass
- NFC Summit tickets
- AMA / community passes
- FRSGHTD token
- Mint passes
- Event passes
- Access credentials
- Some ENS/domain-like objects

## Backend Signals

Likely Access / Membership signals:

```ts
collection.name includes pass, membership, ticket, credential, access, founders
metadata.name includes pass, ticket, credential
traits include Pass, Membership, Ticket, Utility, Access
description includes token-gated, membership, community access, event, admission
```

## Frontend Description

**Access / Membership**  
Passes, memberships, domains, credentials, and token-gated objects.

## Notes

Spam/phishing often imitates access language. This category must run after spam filtering.

---

# 7. Collectibles

## Definition

Set-based, object-based, character, card, branded, sports, physical-linked, toy-like, or completion-driven NFTs.

This category is for things collected as sets or objects, especially when they are not primarily art, PFP, meme, access, or game/world assets.

## Includes

- Trading cards
- Badges
- Souvenirs
- Toys
- Brand-linked drops
- Sports collectibles
- Physical-linked NFTs
- Set completion projects
- Object-like NFTs
- Edition objects where collectibility is stronger than art context

## Sub-tags

- Sports
- Cards
- Physical
- Brand
- Toy-like
- Set completion
- Badge
- Souvenir
- Object
- Trading card

## Examples

- CDT Trading Cards
- Posters
- Crypto Trading Cards
- Souvenirs
- Badges
- Toy-like collections
- Physical-linked drops
- Brand collectible projects
- Some ERC-1155 card sets

## Backend Signals

Likely Collectibles signals:

```ts
collection.name includes cards, trading, badge, souvenir, collectible, toy
metadata.description includes set, collectible, physical, card, badge
traits include Card Number, Rarity, Series, Set, Edition
ERC-1155 with card/set language
```

## Frontend Description

**Collectibles**  
Set-based, branded, character, sports, or physical-linked collecting.

## Notes

This should not become the junk drawer. If something is unclear, use Unsorted Signals instead.

---

# 8. Music / Media

## Definition

Sound, moving image, publishing, performance, audiovisual work, and media-native NFTs.

Music is niche but meaningfully different when present. It should not disappear into Art.

## Includes

- Music NFTs
- Songs
- Albums
- Audio editions
- Audiovisual editions
- Film/video projects
- Performance-based works
- Writing/publishing NFTs
- Podcast/media collectibles

## Sub-tags

- Music
- Audio
- Film
- Video
- Audiovisual
- Writing
- Publishing
- Performance
- Podcast
- Media edition

## Examples

- Music NFT drops
- Song/album editions
- Audiovisual performances
- Film-related NFTs
- Writing/literature editions
- Media publishing collectibles

## Backend Signals

Likely Music / Media signals:

```ts
metadata.animation_url points to audio/video media
metadata includes audio, music, song, album, track
collection.description includes music, film, media, performance, publishing, writing
media MIME type indicates audio or video
file extensions: .mp3, .wav, .mp4, .mov, .webm
```

## Frontend Description

**Music / Media**  
Sound, film, publishing, performance, and media-based NFTs.

## Notes

Not every animated NFT belongs here. Animated visual art should remain Art unless the media/publishing/audio context is central.

---

# 9. Unsorted Signals

## Definition

Items without enough reliable metadata to classify confidently.

This is better than “Other.” It acknowledges that the wallet contains signals, but we do not yet have enough confidence to name them.

## Includes

- Missing metadata
- Conflicting signals
- Unknown contracts
- Unrecognized formats
- Edge cases
- Very low-confidence classifications
- Spam-suspected items before removal/downranking
- Weird contracts
- Broken or unrevealed items

## Sub-tags

- Unknown
- Low confidence
- Unrevealed
- Broken metadata
- Conflicting
- Spam suspect
- Edge case
- Unrecognized

## Examples

- Unknown collections
- Unrevealed assets
- Broken metadata objects
- Contracts without collection context
- Objects with no name/image/description
- Spam-suspected items not yet filtered

## Backend Signals

Likely Unsorted Signals:

```ts
missing name
missing image
missing collectionName
missing collectionSlug
no reliable metadata
conflicting category scores
all category scores below threshold
spam suspicion but not definite spam
```

## Frontend Description

**Unsorted Signals**  
Items without enough reliable metadata to classify confidently.

## Notes

Use this intentionally. It should not feel like a failure. It protects the system from overclaiming.

---

# Backend Category Model

## Recommended Shape

```ts
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

  confidence: {
    art?: number;
    generative?: number;
    pfpIdentity?: number;
    memeInternetCulture?: number;
    gamingWorlds?: number;
    accessMembership?: number;
    collectibles?: number;
    musicMedia?: number;
    unsortedSignals?: number;
  };

  evidence: {
    source: "alchemy" | "opensea" | "metadata" | "traits" | "knownCollectionMap" | "heuristic";
    field: string;
    value: string;
    category: TasteCategory;
    weight: number;
  }[];
};
```

## Category Type

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
```

---

# Classification Principles

## 1. Multi-label by default

Do not force one NFT into one category too early.

Example:

```ts
primaryCategory: "meme_internet_culture",
secondaryCategories: ["art", "collectibles"],
tags: ["6529", "edition", "crypto-native"]
```

## 2. Primary category controls the taste map

The primary category decides where the NFT contributes most visibly in the taste breakdown.

## 3. Secondary categories enrich the interpretation

Secondary categories should show up in reads, supporting badges, and explanations.

## 4. Tags provide texture

Tags are smaller signals like:

- Edition
- 6529
- Pepe
- ENS
- Ticket
- On-chain
- Artist-led
- Video
- Interactive
- AI
- Photography
- Card
- Pass
- 1/1
- Long-form

## 5. Confidence matters

Avoid overclaiming. If confidence is low, use Unsorted Signals.

---

# Suggested Category Priority

When multiple categories fire, choose primary category using this general order:

1. Definite Access / Membership  
2. Definite Music / Media  
3. Definite Generative  
4. Definite PFP / Identity  
5. Definite Meme / Internet Culture  
6. Definite Gaming / Worlds  
7. Definite Art  
8. Definite Collectibles  
9. Unsorted Signals

This order is not absolute. It should be adjusted by confidence.

## Why this order?

Access, Music, and Generative are more specific than broad Art or Collectibles.

PFP / Identity and Meme / Internet Culture are strong cultural/social signals.

Art is broad and should catch artist-led work, but should not erase more specific signals.

Collectibles is useful, but should not become the default for everything.

---

# Known Mapping From Current Audit Signals

## Existing audit labels → display categories

```txt
edition-like → Art or Collectibles, depending on context
ERC-1155 → backend standard, not display category
ERC-721 → backend standard, not display category
meme-culture → Meme / Internet Culture
pfp-like → PFP / Identity
generative-like → Generative
dynamic-or-generative → Generative or Music / Media
animated-or-interactive → Music / Media, Generative, or Art depending on context
domain-identity → PFP / Identity or Access / Membership
access-pass → Access / Membership
game-world-asset → Gaming / Worlds
agentic-or-ai-adjacent → tag only for now, not a top-level category
spam-or-phishing-suspect → risk tag, not display category
```

---

# Frontend Display Guidance

## Avoid

```txt
43% Art, 22% PFPs, 18% Gaming
```

This is technically clear, but it can feel dashboard-like.

## Prefer

```txt
This wallet leans heavily toward Art and Internet Culture, with a secondary pull toward identity-based collections.
```

Then show the visual breakdown below.

The report should interpret categories as taste tendencies, not inventory bins.

---

# Example Frontend Read Patterns

## Art + Meme / Internet Culture

> This wallet leans toward artist-led work with a strong current of internet-native humor, remix, and crypto-cultural references.

## Generative + Art

> This wallet shows a clear attraction to systems-based visual work: code, variation, and algorithmic composition.

## PFP / Identity + Access

> This wallet contains a lot of social identity objects: avatars, names, passes, and community-linked markers.

## Gaming / Worlds + Collectibles

> This wallet appears drawn to world-based objects: characters, places, assets, and set-like collectibles.

## Meme / Internet Culture + Collectibles

> This wallet collects culture in card form: memes, editions, references, and repeatable objects that feel closer to shared language than isolated artworks.

---

# Display Copy

## Category descriptions

**Art**  
Artist-led visual work, editions, photography, and cultural objects.

**Generative**  
Work shaped by code, systems, variation, and chance.

**PFP / Identity**  
Avatar collections and social identity objects.

**Meme / Internet Culture**  
Crypto-native humor, remix, references, and shared online language.

**Gaming / Worlds**  
Playable assets, virtual places, wearables, and world-based collecting.

**Access / Membership**  
Passes, memberships, domains, credentials, and token-gated objects.

**Collectibles**  
Set-based, branded, character, sports, or physical-linked collecting.

**Music / Media**  
Sound, film, publishing, performance, and media-based NFTs.

**Unsorted Signals**  
Items without enough reliable metadata to classify confidently.

---

# Product Implication For Results Page

The results page should have three layers:

## 1. Collections as proof

Show the actual shared collections.

Examples:

- The Memes by 6529
- OSF Editions
- NORMIES
- OnchainGlyphs
- ENS
- DungeonRooms
- EcoMemes

## 2. Categories as meaning

Show the larger taste pattern.

Examples:

- Art
- Meme / Internet Culture
- PFP / Identity
- Generative

## 3. Types / tags as texture

Show how they collect.

Examples:

- Edition-heavy
- ERC-1155-heavy
- Interactive
- Identity objects
- Access passes
- 1/1-like
- On-chain
- AI-adjacent

---

# Working Conclusion

The category system should be simple on the surface and flexible underneath.

## Frontend

Use nine clean categories:

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

## Backend

Store multi-label classifications with:

```txt
primaryCategory
secondaryCategories
tags
signals
confidence
evidence
```

## Philosophy

Collections are the proof.  
Categories are the meaning.  
Formats are the behavior.  
Traits and artists are the texture.

That gives I Like JPGs a taste report that feels interpretive, social, and useful without becoming a marketplace dashboard.
