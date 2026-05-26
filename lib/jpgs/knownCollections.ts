export type KnownCollection = {
  slug: string;
  name: string;
  contract: string;
  openseaUrl: string;
  image_url?: string;
};

export const KNOWN_COLLECTIONS: KnownCollection[] = [
  {
    slug: "nouns",
    name: "Nouns",
    contract: "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03",
    openseaUrl: "https://opensea.io/collection/nouns",
  },
  {
    slug: "thememes6529",
    name: "The Memes by 6529",
    contract: "0x33fd426905f149f8376e227d0c9d3340aad17af1",
    openseaUrl: "https://opensea.io/collection/thememes6529",
  },
  {
    slug: "no-bad-trippers",
    name: "No Bad Trippers",
    contract: "0x5f7162ce5b6a7747a0152a820254b8726e63b95f",
    openseaUrl: "https://opensea.io/collection/no-bad-trippers",
  },
];

export const KNOWN_BY_CONTRACT = new Map(
  KNOWN_COLLECTIONS.map((c) => [c.contract.toLowerCase(), c]),
);

export const KNOWN_BY_SLUG = new Map(
  KNOWN_COLLECTIONS.map((c) => [c.slug, c]),
);

const STOP_WORDS = new Set([
  "a", "an", "the", "by", "of", "and", "or", "for", "to", "in", "on",
]);

export function getMeaningfulTokens(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/[\s\-_]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

export function findKnownByQuery(query: string): KnownCollection[] {
  const q = query.toLowerCase().trim();
  const qSlugForm = q.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // Contract lookup is always exact — no token logic needed
  const byContract = KNOWN_BY_CONTRACT.get(q);
  if (byContract) return [byContract];

  const meaningfulTokens = getMeaningfulTokens(query);

  // Stopword-only query: only allow exact slug or name matches
  if (meaningfulTokens.length === 0) {
    return KNOWN_COLLECTIONS.filter(
      (col) => col.slug === q || col.name.toLowerCase() === q,
    );
  }

  // Short query (< 4 non-space chars): require prefix or token-prefix; no substring
  const isShortQuery = q.replace(/\s+/g, "").length < 4;

  const results: KnownCollection[] = [];
  for (const col of KNOWN_COLLECTIONS) {
    const name = col.name.toLowerCase();
    const slug = col.slug.toLowerCase();

    // Exact slug or name always matches regardless of length
    if (slug === q || slug === qSlugForm || name === q) {
      results.push(col);
      continue;
    }

    if (isShortQuery) {
      // Only prefix or token-prefix — no arbitrary substring inside a larger word
      const nameTokens = name.split(/[\s\-_\/]+/);
      const slugTokens = slug.split("-");
      const prefixMatch = slug.startsWith(qSlugForm) || name.startsWith(q);
      const tokenPrefixMatch =
        slugTokens.some((t) => t.startsWith(qSlugForm)) ||
        nameTokens.some((t) => t.startsWith(q));
      if (prefixMatch || tokenPrefixMatch) results.push(col);
    } else {
      // Normal query: prefix, contains, or all meaningful tokens present
      const slugNorm = slug.replace(/-/g, " ");
      if (
        slug.startsWith(qSlugForm) ||
        name.startsWith(q) ||
        name.includes(q) ||
        slug.includes(qSlugForm) ||
        meaningfulTokens.every((w) => name.includes(w) || slugNorm.includes(w))
      ) {
        results.push(col);
      }
    }
  }
  return results;
}

export function resolveKnownContract(input: string): KnownCollection | null {
  return KNOWN_BY_CONTRACT.get(input.toLowerCase().trim()) ?? null;
}
