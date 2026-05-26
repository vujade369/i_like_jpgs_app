export type TasteCategory =
  | "art"
  | "generative"
  | "pfp_identity"
  | "meme_internet_culture"
  | "gaming_worlds"
  | "access_membership"
  | "collectibles"
  | "music_media"
  | "unsorted_signals";

export const TASTE_CATEGORY_LABELS: Record<TasteCategory, string> = {
  art: "Art",
  generative: "Generative",
  pfp_identity: "PFP / Identity",
  meme_internet_culture: "Meme / Internet Culture",
  gaming_worlds: "Gaming / Worlds",
  access_membership: "Access / Membership",
  collectibles: "Collectibles",
  music_media: "Music / Media",
  unsorted_signals: "Unsorted Signals",
};

export const TASTE_CATEGORY_DESCRIPTIONS: Record<TasteCategory, string> = {
  art: "Artist-led visual work, editions, photography, and cultural objects.",
  generative: "Work shaped by code, systems, variation, and chance.",
  pfp_identity: "Avatar collections and social identity objects.",
  meme_internet_culture: "Crypto-native humor, remix, references, and shared online language.",
  gaming_worlds: "Playable assets, virtual places, wearables, and world-based collecting.",
  access_membership: "Passes, memberships, domains, credentials, and token-gated objects.",
  collectibles: "Set-based, branded, character, sports, or physical-linked collecting.",
  music_media: "Sound, film, publishing, performance, and media-based NFTs.",
  unsorted_signals: "Items without enough reliable metadata to classify confidently.",
};

// Priority order for primary category resolution when confidence is tied.
// Lower index = higher priority (more specific categories win).
export const CATEGORY_PRIORITY: TasteCategory[] = [
  "access_membership",
  "music_media",
  "generative",
  "pfp_identity",
  "meme_internet_culture",
  "gaming_worlds",
  "art",
  "collectibles",
  "unsorted_signals",
];

export const CONFIDENCE_THRESHOLD = 0.25;

// ─── Keyword maps ────────────────────────────────────────────────────────────

export const COLLECTION_NAME_KEYWORDS: Record<TasteCategory, string[]> = {
  art: [
    "superrare", "foundation", "knownorigin", "manifold", "art", "edition",
    "cryptoart", "photography", "photo", "paint", "illustration",
    "oona", "xcopy", "1/1", "1of1",
  ],
  generative: [
    "artblocks", "art blocks", "generative", "on-chain", "onchain",
    "algorithm", "procedural", "squiggle", "fidenza", "ringers",
    "chromie", "mindwave", "ataktos", "cube", "lift", "glyphs",
  ],
  pfp_identity: [
    "punk", "ape", "azuki", "doodle", "nouns", "milady", "goblin",
    "penguin", "pudgy", "normie", "florentine", "meebug", "larvamigo",
    "nodepunk", "still alive", "pfp", "avatar", "character", "identity",
  ],
  meme_internet_culture: [
    "meme", "pepe", "6529", "seizing", "gm", "rememe", "ecomeme",
    "opepepen", "complaint", "dollar meme", "meme lab", "meme folder",
    "internet culture", "remix", "crypto-native",
  ],
  gaming_worlds: [
    "dungeon", "room", "world", "land", "wearable", "game", "gaming",
    "rilato", "galaxy warrior", "galaxy egg", "creature world", "metaverse",
    "virtual", "plot", "character", "playable", "fewoworld",
  ],
  access_membership: [
    "pass", "membership", "ticket", "credential", "access", "founder",
    "allowlist", "mint pass", "poap", "event", "community pass",
    "seizer", "storyverse", "nfc summit", "frsghtd",
  ],
  collectibles: [
    "trading card", "card", "badge", "souvenir", "collectible", "toy",
    "sports", "physical", "poster", "cdt", "crypto trading",
    "set", "series",
  ],
  music_media: [
    "music", "song", "album", "audio", "track", "film", "video",
    "media", "performance", "publishing", "podcast", "audiovisual",
    "writing", "literature",
  ],
  unsorted_signals: [],
};

export const TRAIT_NAME_KEYWORDS: Record<TasteCategory, string[]> = {
  art: ["artist", "created by", "creator", "palette", "medium", "style"],
  generative: [
    "seed", "algorithm", "iteration", "grid", "geometry", "variation",
    "feature hash", "output", "palette", "color scheme",
  ],
  pfp_identity: [
    "eyes", "mouth", "body", "background", "clothes", "head", "hair",
    "skin", "fur", "beak", "hat", "accessory", "expression",
  ],
  meme_internet_culture: [
    "meme name", "punk 6529", "gm", "pepe", "om", "season", "card number",
    "seize the memes",
  ],
  gaming_worlds: [
    "character", "world", "land", "room", "wearable", "item", "level",
    "power", "class", "race", "weapon", "armor",
  ],
  access_membership: ["pass", "membership", "ticket", "utility", "access", "tier", "role"],
  collectibles: ["card number", "rarity", "series", "set", "edition", "number", "print"],
  music_media: ["track", "album", "bpm", "key", "duration", "artist", "genre"],
  unsorted_signals: [],
};

export const COLLECTION_DESCRIPTION_KEYWORDS: Record<TasteCategory, string[]> = {
  art: ["artist", "art", "edition", "cryptoart", "visual", "photography", "collector"],
  generative: ["algorithm", "code", "system", "procedural", "generative", "on-chain", "script"],
  pfp_identity: ["avatar", "identity", "profile", "community", "pfp", "social"],
  meme_internet_culture: ["meme", "pepe", "gm", "internet culture", "6529", "remix", "humor"],
  gaming_worlds: ["game", "playable", "metaverse", "virtual world", "asset", "world"],
  access_membership: [
    "membership", "token-gated", "community access", "event", "admission",
    "pass", "credential", "founders",
  ],
  collectibles: ["set", "collectible", "physical", "card", "badge", "trading", "sports"],
  music_media: ["music", "film", "media", "performance", "publishing", "writing", "audio"],
  unsorted_signals: [],
};

// Known collection slug overrides — highest-confidence classification.
export const KNOWN_COLLECTION_OVERRIDES: Record<string, TasteCategory> = {
  // Meme / Internet Culture
  "the-memes-by-6529": "meme_internet_culture",
  "memelab-by-6529": "meme_internet_culture",
  "seizing-the-memes-of-production": "meme_internet_culture",
  "opepepen": "meme_internet_culture",
  "ecomemes": "meme_internet_culture",
  "notable-pepes": "meme_internet_culture",
  "potentially-notable-pepes": "meme_internet_culture",
  "my-meme-folder": "meme_internet_culture",
  "dollar-meme-shop": "meme_internet_culture",
  "the-complaint-cards": "meme_internet_culture",
  // Generative
  "art-blocks": "generative",
  "artblocks": "generative",
  "chromie-squiggle-by-snowfro": "generative",
  "fidenza-by-tyler-hobbs": "generative",
  "ringers-by-dmitri-cherniak": "generative",
  "onchainglyphs": "generative",
  // PFP / Identity
  "ens": "pfp_identity",
  "ethereum-name-service": "pfp_identity",
  "pudgy-penguins": "pfp_identity",
  "normies": "pfp_identity",
  "the-florentines": "pfp_identity",
  "meebugs": "pfp_identity",
  "larvamigos": "pfp_identity",
  "nodepunkes": "pfp_identity",
  // Access / Membership
  "storyverse-founders-pass": "access_membership",
  "seizer-dao": "access_membership",
  "nfc-summit": "access_membership",
  // Gaming / Worlds
  "dungeonrooms": "gaming_worlds",
  "rilato": "gaming_worlds",
};
