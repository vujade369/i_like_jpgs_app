export type CollectorCandidate = {
  address: string;
  displayName?: string;
  avatarUrl?: string;
  openseaUrl?: string;
  heldCollections: Record<string, number>; // slug → quantity held
  matchedCollections: string[];            // subset of selectedSlugs this wallet holds
  matchedCollectionCount: number;
  totalHeldAcrossSelected: number;
};

export type ScoredCollector = CollectorCandidate & {
  coverageScore: number;
  depthScore: number;
  profileBonus: number;
  matchScore: number;
};

export function scoreCollectors(
  candidates: CollectorCandidate[],
  selectedSlugs: string[],
): ScoredCollector[] {
  const n = Math.max(selectedSlugs.length, 1);

  return candidates
    .map((c): ScoredCollector => {
      const coverageScore = c.matchedCollectionCount / n;
      const depthScore = Math.min(
        1,
        Math.log2(1 + c.totalHeldAcrossSelected) / Math.log2(1 + 25),
      );
      const profileBonus = c.avatarUrl || c.displayName ? 0.03 : 0;
      const matchScore = Math.round(
        Math.min(1, 0.8 * coverageScore + 0.2 * depthScore + profileBonus) * 100,
      );
      return { ...c, coverageScore, depthScore, profileBonus, matchScore };
    })
    .sort((a, b) => {
      if (b.matchedCollectionCount !== a.matchedCollectionCount)
        return b.matchedCollectionCount - a.matchedCollectionCount;
      if (b.matchScore !== a.matchScore)
        return b.matchScore - a.matchScore;
      if (b.totalHeldAcrossSelected !== a.totalHeldAcrossSelected)
        return b.totalHeldAcrossSelected - a.totalHeldAcrossSelected;
      const aHas = a.avatarUrl || a.displayName ? 1 : 0;
      const bHas = b.avatarUrl || b.displayName ? 1 : 0;
      return bHas - aHas;
    });
}
