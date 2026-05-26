import {
  TasteCategory,
  CATEGORY_PRIORITY,
  COLLECTION_NAME_KEYWORDS,
  COLLECTION_DESCRIPTION_KEYWORDS,
  TRAIT_NAME_KEYWORDS,
  KNOWN_COLLECTION_OVERRIDES,
  CONFIDENCE_THRESHOLD,
} from "./tasteCategories";

// ─── Input shape ─────────────────────────────────────────────────────────────

export type NftTrait = {
  trait_type: string;
  value: string | number;
};

export type NormalizedNft = {
  name?: string;
  collectionName?: string;
  collectionSlug?: string;
  collectionDescription?: string;
  description?: string;
  tokenStandard?: "ERC721" | "ERC1155" | "UNKNOWN";
  traits?: NftTrait[];
  animationUrl?: string;
  imageUrl?: string;
  contractAddress?: string;
  balance?: number;
};

// ─── Output shape ────────────────────────────────────────────────────────────

export type EvidenceItem = {
  source: "alchemy" | "opensea" | "metadata" | "traits" | "knownCollectionMap" | "heuristic";
  field: string;
  value: string;
  category: TasteCategory;
  weight: number;
};

export type NftTasteClassification = {
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
  evidence: EvidenceItem[];
};

// ─── Scoring helpers ─────────────────────────────────────────────────────────

type ScoreAccumulator = Map<TasteCategory, number>;

function norm(s: string): string {
  return s.toLowerCase().trim();
}

function scoreKeywords(
  text: string,
  keywordMap: Record<TasteCategory, string[]>,
  weight: number,
  acc: ScoreAccumulator,
  evidence: EvidenceItem[],
  source: EvidenceItem["source"],
  field: string,
): void {
  const normalizedText = norm(text);
  for (const [cat, keywords] of Object.entries(keywordMap) as [TasteCategory, string[]][]) {
    for (const kw of keywords) {
      if (kw && normalizedText.includes(norm(kw))) {
        acc.set(cat, (acc.get(cat) ?? 0) + weight);
        evidence.push({ source, field, value: kw, category: cat, weight });
        break; // one match per category per field is enough
      }
    }
  }
}

function applyMediaHeuristics(
  nft: NormalizedNft,
  acc: ScoreAccumulator,
  evidence: EvidenceItem[],
): void {
  const url = nft.animationUrl ?? "";
  if (!url) return;
  const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac"];
  const videoExts = [".mp4", ".webm", ".mov", ".avi"];
  const lower = norm(url);
  if (audioExts.some((e) => lower.includes(e)) || lower.includes("audio")) {
    const w = 0.6;
    acc.set("music_media", (acc.get("music_media") ?? 0) + w);
    evidence.push({ source: "metadata", field: "animationUrl", value: url, category: "music_media", weight: w });
  } else if (videoExts.some((e) => lower.includes(e)) || lower.includes("video")) {
    // animated video could be art or music_media; give both a small bump
    const w = 0.3;
    acc.set("music_media", (acc.get("music_media") ?? 0) + w);
    acc.set("art", (acc.get("art") ?? 0) + w);
    evidence.push({ source: "metadata", field: "animationUrl", value: url, category: "music_media", weight: w });
  } else {
    // animation_url present but not audio/video → interactive/generative hint
    const w = 0.25;
    acc.set("generative", (acc.get("generative") ?? 0) + w);
    evidence.push({ source: "metadata", field: "animationUrl", value: "interactive", category: "generative", weight: w });
  }
}

function applyTokenStandardHeuristic(
  nft: NormalizedNft,
  acc: ScoreAccumulator,
  evidence: EvidenceItem[],
): void {
  if (nft.tokenStandard === "ERC1155") {
    // ERC-1155 leans edition-like → art or collectibles bump
    const w = 0.15;
    acc.set("art", (acc.get("art") ?? 0) + w);
    acc.set("collectibles", (acc.get("collectibles") ?? 0) + w);
    evidence.push({ source: "heuristic", field: "tokenStandard", value: "ERC1155", category: "art", weight: w });
  }
}

function applyEnsHeuristic(
  nft: NormalizedNft,
  acc: ScoreAccumulator,
  evidence: EvidenceItem[],
): void {
  const name = norm(nft.name ?? "");
  const slug = norm(nft.collectionSlug ?? "");
  if (name.endsWith(".eth") || slug.includes("ens") || slug.includes("ethereum-name-service")) {
    const w = 0.9;
    acc.set("pfp_identity", (acc.get("pfp_identity") ?? 0) + w);
    evidence.push({ source: "heuristic", field: "name", value: nft.name ?? ".eth", category: "pfp_identity", weight: w });
  }
}

// ─── Tag derivation ──────────────────────────────────────────────────────────

function deriveTags(
  nft: NormalizedNft,
  confidence: Partial<Record<TasteCategory, number>>,
  signals: NftTasteClassification["signals"],
): string[] {
  const tags: string[] = [];

  if (signals.isGenerative) tags.push("generative");
  if (signals.isOnChain) tags.push("on-chain");
  if (signals.isInteractive) tags.push("interactive");
  if (signals.isEditionLike) tags.push("edition");
  if (signals.isOneOfOneLike) tags.push("1/1");
  if (signals.isArtistLed) tags.push("artist-led");
  if (signals.isPfpLike) tags.push("avatar");
  if (signals.isMemeCulture) tags.push("crypto-native");
  if (signals.isAccessPass) tags.push("pass");
  if (signals.isIdentityObject) tags.push("identity");
  if (signals.isGameAsset) tags.push("game-asset");
  if (signals.isWorldObject) tags.push("world-object");
  if (signals.isMusicOrMedia) tags.push("audio-visual");
  if (signals.isSpamSuspect) tags.push("spam-suspect");

  const slug = norm(nft.collectionSlug ?? "");
  if (slug.includes("6529") || slug.includes("meme")) tags.push("6529");
  if (slug.includes("pepe")) tags.push("pepe");
  if (slug.includes("ens")) tags.push("ens");

  const colName = norm(nft.collectionName ?? "");
  if (colName.includes("artblock") || colName.includes("art block")) tags.push("art-blocks");

  if ((confidence["art"] ?? 0) > 0.4 && (confidence["generative"] ?? 0) > 0.4) tags.push("generative-art");
  if (nft.tokenStandard === "ERC1155") tags.push("erc-1155");
  if (nft.tokenStandard === "ERC721") tags.push("erc-721");

  return [...new Set(tags)];
}

// ─── Signal derivation ───────────────────────────────────────────────────────

function deriveSignals(
  nft: NormalizedNft,
  confidence: Partial<Record<TasteCategory, number>>,
): NftTasteClassification["signals"] {
  const colName = norm(nft.collectionName ?? "");
  const colSlug = norm(nft.collectionSlug ?? "");
  const colDesc = norm(nft.collectionDescription ?? "");
  const traitNames = (nft.traits ?? []).map((t) => norm(t.trait_type));
  const traitValues = (nft.traits ?? []).map((t) => norm(String(t.value)));

  const pfpTraits = ["eyes", "mouth", "body", "background", "clothes", "head", "hair", "skin", "fur"];
  const generativeTraits = ["seed", "algorithm", "iteration", "grid", "geometry", "variation", "feature hash"];

  return {
    tokenStandard: nft.tokenStandard,
    isArtistLed: traitNames.some((t) => ["artist", "creator", "created by"].includes(t)),
    isEditionLike: nft.tokenStandard === "ERC1155" || colName.includes("edition") || colDesc.includes("edition"),
    isOneOfOneLike: colName.includes("1/1") || colName.includes("1of1") || colDesc.includes("1/1"),
    isGenerative:
      (confidence["generative"] ?? 0) > 0.3 ||
      colName.includes("generative") ||
      colName.includes("art block") ||
      generativeTraits.some((t) => traitNames.includes(t)),
    isPfpLike:
      (confidence["pfp_identity"] ?? 0) > 0.3 ||
      pfpTraits.some((t) => traitNames.includes(t)),
    isMemeCulture:
      (confidence["meme_internet_culture"] ?? 0) > 0.3 ||
      colName.includes("meme") ||
      colSlug.includes("6529"),
    isAccessPass:
      (confidence["access_membership"] ?? 0) > 0.3 ||
      ["pass", "membership", "ticket", "credential"].some((w) => colName.includes(w)),
    isGameAsset:
      (confidence["gaming_worlds"] ?? 0) > 0.3 ||
      ["game", "dungeon", "land", "wearable", "world"].some((w) => colName.includes(w)),
    isWorldObject:
      colName.includes("world") || colDesc.includes("virtual world") || colDesc.includes("metaverse"),
    isMusicOrMedia:
      (confidence["music_media"] ?? 0) > 0.3 ||
      !!nft.animationUrl?.match(/\.(mp3|wav|mp4|webm|mov)/i),
    isIdentityObject:
      colSlug.includes("ens") ||
      traitNames.some((t) => t.includes("domain") || t.includes("name")) ||
      traitValues.some((v) => v.endsWith(".eth")),
    isOnChain:
      colName.includes("onchain") ||
      colName.includes("on-chain") ||
      colDesc.includes("on-chain") ||
      colDesc.includes("stored on"),
    isInteractive: !!nft.animationUrl && !nft.animationUrl.match(/\.(mp3|wav|mp4|webm|mov)/i),
    isSpamSuspect: detectSpam(nft),
  };
}

function detectSpam(nft: NormalizedNft): boolean {
  const name = norm(nft.name ?? "");
  const colName = norm(nft.collectionName ?? "");
  const spamPhrases = [
    "claim", "free mint", "airdrop reward", "visit", "go to", "http",
    "congratulations", "winner", "you have been selected",
  ];
  return spamPhrases.some((p) => name.includes(p) || colName.includes(p));
}

// ─── Main classifier ─────────────────────────────────────────────────────────

export function classifyNftTaste(nft: NormalizedNft): NftTasteClassification {
  const scores: ScoreAccumulator = new Map();
  const evidence: EvidenceItem[] = [];

  // 1. Known collection override — highest confidence
  const slug = norm(nft.collectionSlug ?? "");
  for (const [knownSlug, cat] of Object.entries(KNOWN_COLLECTION_OVERRIDES)) {
    if (slug === norm(knownSlug) || slug.includes(norm(knownSlug))) {
      scores.set(cat, (scores.get(cat) ?? 0) + 1.0);
      evidence.push({ source: "knownCollectionMap", field: "collectionSlug", value: nft.collectionSlug ?? "", category: cat, weight: 1.0 });
      break;
    }
  }

  // 2. Collection name keywords
  if (nft.collectionName) {
    scoreKeywords(nft.collectionName, COLLECTION_NAME_KEYWORDS, 0.5, scores, evidence, "metadata", "collectionName");
  }

  // 3. Collection description keywords
  if (nft.collectionDescription) {
    scoreKeywords(nft.collectionDescription, COLLECTION_DESCRIPTION_KEYWORDS, 0.35, scores, evidence, "metadata", "collectionDescription");
  }

  // 4. NFT name keywords (lighter — names can be arbitrary)
  if (nft.name) {
    scoreKeywords(nft.name, COLLECTION_NAME_KEYWORDS, 0.2, scores, evidence, "metadata", "name");
  }

  // 5. Trait name keywords
  for (const trait of nft.traits ?? []) {
    scoreKeywords(trait.trait_type, TRAIT_NAME_KEYWORDS, 0.3, scores, evidence, "traits", `trait:${trait.trait_type}`);
    scoreKeywords(String(trait.value), TRAIT_NAME_KEYWORDS, 0.2, scores, evidence, "traits", `trait_value:${trait.trait_type}`);
  }

  // 6. Heuristics
  applyMediaHeuristics(nft, scores, evidence);
  applyTokenStandardHeuristic(nft, scores, evidence);
  applyEnsHeuristic(nft, scores, evidence);

  // ── Normalize scores to [0,1] confidence ────────────────────────────────
  const maxScore = Math.max(...scores.values(), 0.01);
  const confidence: Partial<Record<TasteCategory, number>> = {};
  for (const [cat, score] of scores.entries()) {
    confidence[cat] = Math.min(score / maxScore, 1);
  }

  // ── Resolve primary and secondary categories ─────────────────────────────
  const aboveThreshold = (Object.entries(confidence) as [TasteCategory, number][])
    .filter(([, c]) => c >= CONFIDENCE_THRESHOLD)
    .sort(([catA, cA], [catB, cB]) => {
      if (Math.abs(cA - cB) > 0.1) return cB - cA; // higher confidence wins
      return CATEGORY_PRIORITY.indexOf(catA) - CATEGORY_PRIORITY.indexOf(catB); // tie-break by priority
    });

  const primaryCategory: TasteCategory =
    aboveThreshold.length > 0 ? aboveThreshold[0][0] : "unsorted_signals";
  const secondaryCategories: TasteCategory[] = aboveThreshold
    .slice(1)
    .map(([cat]) => cat)
    .filter((cat) => cat !== primaryCategory);

  // ── Derive signals and tags ──────────────────────────────────────────────
  const signals = deriveSignals(nft, confidence);
  const tags = deriveTags(nft, confidence, signals);

  return {
    primaryCategory,
    secondaryCategories,
    tags,
    signals,
    confidence,
    evidence,
  };
}
