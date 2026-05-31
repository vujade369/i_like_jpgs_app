# Sprint 3 — Taste Room Foundation

## Sprint Theme

Make I Like JPGs feel less like an analytics dashboard and more like entering a collector’s taste room.

This sprint translates the design audit into a focused foundation pass: visual hierarchy, identity consistency, stronger use of collection imagery, and reusable presentation patterns. It should not become a full redesign of every page.

## Source

Based on the Claude Design audit of I Like JPGs across Home, Wallet Read, Compare, Shared Collections, JPG Match, loading states, and desktop screenshots using Vuja_De, MLow, mendezmendez, and ALIENQUEEN as test collectors.

## Core Diagnosis

I Like JPGs has a strong human premise: what someone collects is a cultural signal, and overlap between wallets can feel like recognition.

The current interface often translates that human signal into dashboard grammar: uniform bordered cards, small thumbnails, repeated stat blocks, and count-forward layouts.

The next step is not decoration. The next step is hierarchy.

Collectors should feel distinct. Vuja_De, MLow, mendezmendez, and ALIENQUEEN should not feel like four rows in the same table. They should feel like four different rooms.

## Product Direction

### Recommended Metaphor: The Taste Room

Every wallet is a room you walk into, hung with its own art.

Comparing two wallets is two rooms sharing a wall.

JPG Match is finding rooms next door.

This direction fits I Like JPGs because it is:

- image-led
- editorial
- architectural
- quietly premium
- social without feeling like surveillance
- compatible with the existing dark palette and restrained brand language

### Secondary Influence: The Collector Passport

Borrow the passport idea for wallet identity: a collector has a face, a handle, a record of worlds entered, and visible cultural stamps.

### Later Exploration: The Signal Map

Hold the Signal Map / constellation idea for a later JPG Match mode. It has strong discovery potential, but it is more abstract and riskier to build before the core visual system is solid.

## Design Principles

### 1. Imagery leads, numbers whisper

Collection art is the product’s emotional material. When an image and a number compete, the image wins and the number becomes a caption.

Use the collection-level metadata image first. Do not substitute sample NFT images except as a final fallback.

### 2. Every wallet is a person, not an address

A wallet should open like a profile, not a query result. Face, handle, and a wall of collected art should appear before dense stats.

ENS, OpenSea handle, and raw address inputs should resolve into the same identity treatment.

### 3. Overlap is recognition, not analysis

The product should create an “oh, you too?” feeling. Describe overlap by kind before quantity.

Useful overlap types:

- Mutual conviction
- Asymmetric pull
- Rare spark
- Light touch

Avoid reducing compatibility to a percentage score.

### 4. Two collectors, two colors, everywhere

Wallet A and Wallet B need stable identities across every compare surface.

Suggested system:

- Wallet A: coral
- Wallet B: periwinkle
- CTA color: distinct violet-blue
- Spark / rare moment: gold

Remove stray green bars, blue focus rings, and one-off color treatments.

### 5. Scale equals meaning

A flat grid of equal cards makes everything feel equally important. The interface should rank what matters through scale, spacing, and surface treatment.

### 6. Reveal is a reward, not a default

Keep default states calm and scannable. Individual NFTs, dates, contracts, and deeper detail should appear on demand.

## Sprint Scope

This is a foundation and visual-system sprint.

The goal is to establish the reusable visual language and apply the first high-leverage consistency pass.

## Non-Goals

Do not change:

- ranking logic
- wallet matching logic
- result-count caps
- collection filtering logic
- API contracts unless required for display-only fields
- OpenSea / Alchemy data fetching behavior
- institutional wallet filtering logic
- date derivation logic
- JPG Match discovery algorithm

This sprint is about visual system, layout hierarchy, and presentation.

## Priority Work

### P0 — Foundation / Consistency

#### 1. Lock A/B identity colors globally

Apply consistent Wallet A / Wallet B colors anywhere both collectors appear.

Surfaces to check:

- Compare wallet summary cards
- Shared Collections rows
- Expanded shared collection NFT columns
- Taste overlap bars
- Since-date pills
- owner pips
- hover / focus / active states

Acceptance criteria:

- Wallet A is always coral.
- Wallet B is always periwinkle.
- No green/teal bars remain for Wallet B.
- No stray blue focus rings remain.
- CTA color is visually distinct from Wallet B identity color.

#### 2. Remove duplicate hero logo lockup

Keep the logo in the nav only. Remove repeated logo marks from page heroes/results states where they duplicate the nav.

Acceptance criteria:

- Nav logo remains and links home.
- Page hero/result headers do not repeat the logo lockup.
- Brand presence still feels intentional through type, spacing, and color.

#### 3. Standardize Reveal pieces control

The reveal control should feel like part of the button system, not a separate one-off element.

Acceptance criteria:

- “Reveal pieces” and “Hide pieces” use the same focus, hover, and active language as the rest of the app.
- Blue browser-like focus ring is replaced with an on-brand accessible focus treatment.
- Tap target is at least 44px on mobile.

#### 4. Standardize started-collecting dates

Dates should become a consistent scannable cue, not a sporadic pill.

Acceptance criteria:

- If `walletAEnteredMonth` or `walletBEnteredMonth` exists, it appears in a consistent place and style.
- Missing dates have a graceful absence state; no awkward layout gaps.
- Date styling uses the relevant wallet identity color subtly.

#### 5. Enlarge collection avatars

Collection imagery should become materially more visible across the product.

Acceptance criteria:

- Collection-level metadata image is used first.
- Top collection avatars and shared collection avatars are enlarged meaningfully.
- Images are framed consistently.
- Counts no longer dominate the visual hierarchy.

### P1 — Component System

#### 6. Add reusable card tier patterns

Create or refactor reusable presentation patterns for:

- Hero collection tile
- Standard collection card
- Quiet collection row
- Collector result card
- Shared collection row

Acceptance criteria:

- Components visually express hierarchy through scale and spacing.
- Existing data can be rendered without changing API behavior.
- Long names, missing images, and raw-address identities degrade gracefully.

#### 7. Add overlap-type presentation model

Begin preparing the UI for overlap-by-type language without overhauling the algorithm yet.

Initial display labels may be derived from existing counts/ratios for presentation only.

Possible labels:

- Mutual conviction
- A leans deeper
- B leans deeper
- Rare spark
- Light touch

Acceptance criteria:

- Shared collections can display an overlap-type tag.
- The tag does not replace exact held counts; it reframes them.
- Copy feels human, restrained, and non-gimmicky.

### P2 — State Polish

#### 8. Replace bare loading spinner with image-led loading state

Loading should build anticipation.

Acceptance criteria:

- JPG Match loading no longer uses only a centered spinner.
- Loading state uses shimmering collection-art tile placeholders or equivalent restrained image-led skeleton.
- Copy uses the existing brand voice, such as “Reading the wallet…” or “Finding collectors near this taste…”

#### 9. Add seeded empty states

Empty states should show the product, not only instruct the user.

Acceptance criteria:

- Home / Compare empty state can point to a real example pairing such as Vuja_De × MLow.
- Empty states remain quiet and useful.
- No hypey onboarding language.

## Page-Specific Notes

### Home

Current issue: reads like a utility form and three explanatory cards.

Next direction:

- Show a real collector above the fold.
- Lead with an example wallet read or art wall.
- Make Read the primary path, Compare the social hook, Match the discovery path.

Do not rebuild Home fully in this sprint unless foundation work finishes early.

### Wallet Read

Current issue: result starts too far down; top collections are visually underpowered.

Next direction:

- Collapse search into a slim persistent bar after a wallet loads.
- Lead with collector face + name + art wall.
- Give “The Read” more editorial weight.
- Make top 2–3 collections large image-led tiles.
- Let the long tail recede.

This is likely the next major sprint after foundation.

### Compare

Current issue: the compare panel dominates the top; A/B identity is inconsistent; overlap is split across multiple visual languages.

Next direction:

- Persistent A/B identity system.
- Two collectors should feel like they are in the same room.
- Merge Shared Collections and Taste Overlap into one coherent overlap story over time.

### Shared Collections

Current issue: rows feel like a ledger; counts dominate; every overlap has the same weight.

Next direction:

- Lead with collection avatar at a larger scale.
- Classify by overlap type.
- Use scale to differentiate strong mutual overlaps from light coincidences.
- Keep NFTs hidden until expansion.
- Keep per-wallet NFT columns on reveal.

### JPG Match

Current issue: results are near-identical cards and do not explain why someone is worth opening.

Next direction:

- Result = face + strip of actual collection art + one human “why” line.
- Keep “Try a set” chips.
- Avoid percentage match scores.
- Hold Signal Map as a later mode.

## QA Checklist

Test with:

- Vuja_De
- MLow
- mendezmendez
- ALIENQUEEN
- raw wallet address input
- ENS input
- OpenSea profile URL input

Check:

- Same identity output regardless of input type
- A/B color consistency across all compare sections
- Collection metadata images appear before sample NFTs
- Missing image fallback looks intentional
- Missing started-collecting dates do not break layout
- Mobile stacking and tap targets
- Loading, empty, invalid address, unresolved ENS, empty wallet states
- Institutional wallet toggle still behaves correctly

## Suggested Sprint Milestones

### Milestone 0 — Direction Lock

Commit to The Taste Room as the system metaphor.

Define:

- color tokens
- card tiers
- type roles
- spacing tempo
- pill/tag system
- motion principles

### Milestone 1 — Foundation Pass

Implement:

- A/B identity colors
- duplicate logo removal
- reveal control standardization
- larger collection avatars
- consistent date cue
- button/focus cleanup

### Milestone 2 — Component Kit

Implement:

- hero collection tile
- standard collection card
- quiet collection row
- shared collection row shell
- collector result shell

### Milestone 3 — First Surface Application

Apply the kit first to Shared Collections or Wallet Read.

Recommended first application: Shared Collections, because it is the clearest proof of the “overlap is recognition” thesis and already has a known pain point.

### Milestone 4 — Mobile / State QA

Harden mobile and state behavior before deeper redesign work.

## Claude Code Implementation Prompt

Use `frontend-design`, `web-design-guidelines`, and `vercel-react-best-practices`.

We are starting the next design-system sprint for I Like JPGs. The goal is to make the product feel less like an analytics dashboard and more like entering a collector’s taste room.

This is a presentation-layer sprint. Do not change ranking logic, wallet matching logic, caps, filtering logic, API contracts, institutional wallet filtering, entered-month derivation, or OpenSea/Alchemy fetch behavior unless explicitly required for display-only rendering.

Primary direction:

- Metaphor: The Taste Room.
- Every wallet should feel like a room hung with its own art.
- Comparing two wallets should feel like two rooms sharing a wall.
- JPG Match should feel like finding rooms next door.

Implement Milestone 1 first:

1. Lock Wallet A and Wallet B identity colors globally.
   - Wallet A = coral.
   - Wallet B = periwinkle.
   - Remove green/teal overlap bars and stray blue focus rings.
   - CTA color must remain distinct from wallet identity colors.

2. Remove duplicate hero logo lockups.
   - Keep the logo in the nav only.
   - Remove repeated logo marks from page heroes/results states.

3. Standardize the Reveal pieces / Hide pieces control.
   - Use the app’s button/focus system.
   - Remove the off-brand blue focus outline.
   - Preserve accessibility and mobile tap targets.

4. Make started-collecting dates consistent.
   - If walletAEnteredMonth or walletBEnteredMonth exists, render it in a consistent place and style.
   - Use the corresponding wallet identity color subtly.
   - Missing dates should not create awkward gaps.

5. Enlarge collection avatars across Wallet Read, Compare Shared Collections, and JPG Match where applicable.
   - Always use the collection-level metadata image first.
   - Do not use sample NFT images as collection avatars except as a final fallback.
   - Counts should not visually dominate the image.

6. Start introducing a three-tier surface hierarchy.
   - Hero: large image, generous spacing, strongest signal.
   - Standard: medium art, normal result card.
   - Quiet: light overlaps / long tail, lower contrast.

Important product rules:

- No price, floor, rarity, offer, valuation, or trading language.
- Use “JPGs” language.
- Keep the voice human, restrained, and interpretive.
- Do not add gamified compatibility percentages.
- Keep NFTs hidden until the user expands details.

After implementation, run:

- `npx tsc --noEmit`
- `git diff --check`

Then report:

- files changed
- visual changes made
- what logic was intentionally untouched
- any mobile/state issues discovered
- screenshots or local URLs checked

## Definition of Done

This sprint is done when the product visibly feels more coherent even before the deeper page redesigns happen.

The clear signs:

- A/B identity is stable everywhere.
- Collection art has more presence.
- The UI has fewer one-off treatments.
- Counts feel secondary to imagery and meaning.
- The app feels less like a dashboard and more like a collector space.
