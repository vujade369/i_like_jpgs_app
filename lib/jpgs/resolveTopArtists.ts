const ARTIST_TRAIT_FIELDS = [
  "Artist",
  "Artist 1",
  "Artist 2",
  "Artist 3",
  "Artist 4",
  "Creator",
  "Created By",
  "Author",
  "Artist Name",
  "Project Artist",
] as const;

const SEIZE_ARTIST_PROFILE_FIELD = "SEIZE Artist Profile";
const TOP_ARTIST_LIMIT = 3;
const ARTIST_SAMPLE_LIMIT = 3;
const ARTIST_COLLECTION_LIMIT = 4;

const IGNORED_ARTIST_VALUES = new Set(["", "-", "none", "n/a", "na", "unknown", "null", "undefined"]);

const ARTIST_ALIASES = new Map([
  ["mendezmendez", "mendez"],
]);

const KNOWN_ARTIST_CREATED_URLS = new Map([
  ["mendez", "https://opensea.io/mendezmendez/created"],
]);

export type ArtistTraitNft = {
  collection?: string;
  name?: string;
  display_image_url?: string;
  image_url?: string;
  opensea_url?: string;
  traits?: Array<{
    trait_type?: string;
    value?: string | number;
  }>;
};

export type TopArtist = {
  key: string;
  name: string;
  ownedCount: number;
  openseaCreatedUrl?: string;
  collections: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
  samplePieces: Array<{
    name: string;
    collectionSlug: string;
    collectionName: string;
    imageUrl?: string;
    openseaUrl?: string;
  }>;
  sourceFields: string[];
};

type ArtistMatch = {
  key: string;
  name: string;
  sourceField: string;
  openseaCreatedUrl?: string;
  linkHintField?: string;
};

type ArtistBucket = {
  key: string;
  name: string;
  ownedCount: number;
  openseaCreatedUrl?: string;
  collections: Map<string, { slug: string; name: string; count: number }>;
  samplePieces: TopArtist["samplePieces"];
  sourceFields: Set<string>;
};

export function resolveTopArtists<T extends ArtistTraitNft>(
  nftsForRead: T[],
  countNft: (nft: T) => number,
  options: { collectionNameForSlug?: (slug: string) => string } = {},
): TopArtist[] {
  const buckets = new Map<string, ArtistBucket>();

  for (const nft of nftsForRead) {
    const matches = artistMatchesForNft(nft);
    if (matches.length === 0) continue;

    const count = countNft(nft);
    const slug = collectionSlug(nft);
    const name = options.collectionNameForSlug?.(slug) ?? collectionName(slug);
    const piece = samplePiece(nft, slug, name);

    for (const match of matches) {
      const bucket: ArtistBucket =
        buckets.get(match.key) ??
        {
          key: match.key,
          name: match.name,
          ownedCount: 0,
          openseaCreatedUrl: match.openseaCreatedUrl,
          collections: new Map(),
          samplePieces: [],
          sourceFields: new Set(),
        };

      bucket.ownedCount += count;
      bucket.openseaCreatedUrl ||= match.openseaCreatedUrl;
      bucket.sourceFields.add(match.sourceField);
      if (match.linkHintField) bucket.sourceFields.add(match.linkHintField);

      const collection = bucket.collections.get(slug) ?? { slug, name, count: 0 };
      collection.count += count;
      bucket.collections.set(slug, collection);

      if (piece && bucket.samplePieces.length < ARTIST_SAMPLE_LIMIT) {
        bucket.samplePieces.push(piece);
      }

      buckets.set(match.key, bucket);
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      key: bucket.key,
      name: bucket.name,
      ownedCount: bucket.ownedCount,
      openseaCreatedUrl: bucket.openseaCreatedUrl,
      collections: Array.from(bucket.collections.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, ARTIST_COLLECTION_LIMIT),
      samplePieces: bucket.samplePieces,
      sourceFields: Array.from(bucket.sourceFields),
    }))
    .sort((a, b) => b.ownedCount - a.ownedCount || a.name.localeCompare(b.name))
    .slice(0, TOP_ARTIST_LIMIT);
}

function artistMatchesForNft(nft: ArtistTraitNft): ArtistMatch[] {
  const traits = nft.traits ?? [];
  const seizeHandleHints = traitValues(traits, SEIZE_ARTIST_PROFILE_FIELD).flatMap(splitArtistValue);
  const matches = new Map<string, ArtistMatch>();

  for (const field of ARTIST_TRAIT_FIELDS) {
    for (const value of traitValues(traits, field)) {
      for (const displayName of splitArtistValue(value)) {
        const key = artistKey(displayName);
        if (!key || matches.has(key)) continue;

        const directUrl = KNOWN_ARTIST_CREATED_URLS.get(key);
        const linkHint = directUrl ? {} : linkHintForArtist(key, seizeHandleHints);
        matches.set(key, {
          key,
          name: displayName,
          sourceField: field,
          openseaCreatedUrl: directUrl ?? linkHint.openseaCreatedUrl,
          linkHintField: linkHint.openseaCreatedUrl ? linkHint.field : undefined,
        });
      }
    }
  }

  return Array.from(matches.values());
}

function traitValues(
  traits: NonNullable<ArtistTraitNft["traits"]>,
  field: string,
): string[] {
  return traits
    .filter((trait) => sameTraitField(trait.trait_type, field))
    .map((trait) => String(trait.value ?? "").trim())
    .filter(Boolean);
}

function sameTraitField(actual: string | undefined, expected: string): boolean {
  return actual?.trim().toLowerCase() === expected.toLowerCase();
}

function splitArtistValue(value: string): string[] {
  return value
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map(cleanArtistDisplayName)
    .filter((name) => !isIgnoredArtistValue(name));
}

function cleanArtistDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isIgnoredArtistValue(value: string): boolean {
  const key = value.toLowerCase().replace(/[.\s]/g, "");
  return IGNORED_ARTIST_VALUES.has(value.toLowerCase()) || IGNORED_ARTIST_VALUES.has(key);
}

function artistKey(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return ARTIST_ALIASES.get(normalized) ?? normalized;
}

function linkHintForArtist(
  artistKeyValue: string,
  seizeHandleHints: string[],
): { openseaCreatedUrl?: string; field?: string } {
  for (const hint of seizeHandleHints) {
    const hintKey = artistKey(hint);
    const openseaCreatedUrl = KNOWN_ARTIST_CREATED_URLS.get(hintKey);
    if (openseaCreatedUrl && hintKey === artistKeyValue) {
      return { openseaCreatedUrl, field: SEIZE_ARTIST_PROFILE_FIELD };
    }
  }

  return {};
}

function collectionSlug(nft: ArtistTraitNft): string {
  return nft.collection?.trim() || "unknown";
}

function collectionName(slug: string): string {
  return slug.replace(/-/g, " ");
}

function samplePiece(
  nft: ArtistTraitNft,
  collectionSlug: string,
  collectionName: string,
): TopArtist["samplePieces"][number] | null {
  const name = nft.name?.trim();
  if (!name) return null;

  return {
    name,
    collectionSlug,
    collectionName,
    imageUrl: nft.display_image_url || nft.image_url,
    openseaUrl: nft.opensea_url,
  };
}
