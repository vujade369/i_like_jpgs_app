"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { type SharedCollectionCardItem } from "@/components/collectors/SharedCollectionsStrip";
import { CollectionScrollRow } from "@/components/collectors/CollectionScrollRow";
import { WalletSearchInput, walletSuggestionValue, type WalletSuggestion } from "@/components/WalletSearchInput";

type TopCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource: "collection" | "nft" | "none";
  count: number;
  openseaUrl: string;
  contract?: string;
  chain?: string;
  contracts?: Array<{ address: string; chain?: string }>;
};

type TopArtist = {
  key: string;
  name: string;
  ownedCount: number;
  openseaCreatedUrl?: string;
  collections: Array<{ slug: string; name: string; count: number }>;
  samplePieces: Array<{
    name: string;
    collectionSlug: string;
    collectionName: string;
    imageUrl?: string;
    openseaUrl?: string;
  }>;
  sourceFields: string[];
};

type TasteSignal = {
  category: string;
  label: string;
  nftCount: number;
  collectionCount: number;
  collections: Array<{ slug: string; name: string; count: number }>;
};

type SourceWalletMetadata = {
  id: string;
  input: string;
  address?: string;
  shortWallet?: string;
  displayName?: string;
  username?: string;
  ens?: string;
  avatarUrl?: string;
  status: "included" | "invalid" | "fetch_failed";
  nftCount: number;
  collectionCount: number;
  error?: string;
};

type WalletReadResponse = {
  wallet: string;
  shortWallet: string;
  nftCount: number;
  collectionCount: number;
  topCollections: TopCollection[];
  similarCollectorCollections?: TopCollection[];
  topArtists?: TopArtist[];
  tasteSignals: TasteSignal[];
  wallets?: string[];
  shortWallets?: string[];
  primaryWallet?: string;
  walletCount?: number;
  includedWalletCount?: number;
  invalidWalletCount?: number;
  failedWalletCount?: number;
  sourceWallets?: SourceWalletMetadata[];
  dedupe?: {
    inputNftCount: number;
    dedupedNftCount: number;
    duplicateNftCount: number;
  };
  debug?: {
    fetchedPages: number;
    chainsChecked: string[];
    chainCounts: Record<string, number>;
    fetchedPagesByChain: Record<string, number>;
    complete: boolean;
    stoppedReason: string;
    maxVisibleNfts: number;
    includeHidden: boolean;
  };
  error?: string;
};

type WalletReadErrorResponse = Partial<WalletReadResponse> & {
  error?: string;
  sourceWallets?: SourceWalletMetadata[];
};

type ReadState = "idle" | "loading" | "success" | "empty" | "error";
type SimilarCollectorsState = "idle" | "loading" | "success" | "empty" | "error";
type ActiveWalletView = "combined" | string;

type SimilarCollector = {
  address: string;
  wallet?: string;
  shortWallet: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  openSeaUrl?: string;
  openseaProfileUrl: string;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  identitySource?: string;
  matchedCollections: Array<{
    slug: string;
    name: string;
    image_url?: string;
    heldCount: number;
    contract?: string;
    chain?: string;
    contracts?: Array<{ address: string; chain?: string }>;
  }>;
  sharedCollectionCount: number;
  totalHeldFromSelected: number;
  reason: string;
  isInstitutionalWallet: boolean;
  institutionalWalletReason: string | null;
};

type SimilarCollectorsResponse = {
  collectors?: SimilarCollector[];
};

type CollectorProofCollection = SimilarCollector["matchedCollections"][number];

const MAX_WALLETS = 2;
const SHOW_TOP_ARTISTS = false;
const SIMILAR_COLLECTOR_COLLECTION_LIMIT = 25;
const SIMILAR_COLLECTOR_COLLAPSED_DISPLAY_LIMIT = 5;
const SIMILAR_COLLECTOR_EXPANDED_DISPLAY_LIMIT = 10;
const MIN_SIMILAR_COLLECTOR_SHARED_COLLECTIONS = 2;
const WALLET_SIGNAL_BAR_SCALE_MAX = 30;
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const SUPPORTED_CHAIN_COPY = "Visible across supported chains: ethereum, base, polygon, arbitrum, optimism, zora.";

type WalletReadCopy = {
  headline: string;
  body: string;
};

const READ_LABELS: Record<string, string> = {
  Art: "art",
  Generative: "generative art",
  "PFP / Identity": "PFP culture",
  "Meme / Internet Culture": "meme culture",
  "Gaming / Worlds": "gaming and world-building objects",
  "Access / Membership": "access objects",
  Collectibles: "collectibles",
  "Music / Media": "music and media",
  "Unsorted Signals": "unsorted JPGs",
};

const CONTRACT_IDENTIFIER_RE = /^(?:[a-z0-9_-]+:)?0x[a-f0-9]{40}$/i;

function isRawContractIdentifier(value?: string | null): boolean {
  return CONTRACT_IDENTIFIER_RE.test((value ?? "").trim());
}

function collectionProofLabel(collection: Pick<CollectorProofCollection, "name" | "slug">): string {
  const name = collection.name?.trim();
  const slug = collection.slug?.trim();

  if (name && !isRawContractIdentifier(name)) return name;
  if (slug && !isRawContractIdentifier(slug)) return slug.replace(/[-_]+/g, " ");
  return name || slug || "Unknown collection";
}

function safeCollectionHref(slug?: string | null): string | null {
  const trimmed = slug?.trim();
  if (!trimmed || isRawContractIdentifier(trimmed)) return null;
  return `https://opensea.io/collection/${encodeURIComponent(trimmed)}`;
}

function safeOwnerCollectionHref(slug: string | undefined, address: string): string | null {
  const trimmed = slug?.trim();
  if (!trimmed || !address || isRawContractIdentifier(trimmed)) return null;
  return `https://opensea.io/${address}?tab=collected&search[collections][0]=${encodeURIComponent(trimmed)}`;
}

function sharedCollectorCollectionItems(collections: CollectorProofCollection[], walletAddress: string): SharedCollectionCardItem[] {
  return collections.map((collection) => {
    const name = collectionProofLabel(collection);
    return {
      key: collection.slug || collection.name || name,
      slug: collection.slug || null,
      name,
      imageUrl: collection.image_url,
      heldCount: collection.heldCount,
      href: safeCollectionHref(collection.slug),
      ownerHref: safeOwnerCollectionHref(collection.slug, walletAddress),
      contract: collection.contract,
      chain: collection.chain,
      contracts: collection.contracts,
    };
  });
}

function orderedSharedCollectionItems(collections: SharedCollectionCardItem[]): SharedCollectionCardItem[] {
  return collections.slice().sort((a, b) => (b.heldCount ?? 0) - (a.heldCount ?? 0));
}

export default function WalletReadPage() {
  const [wallet, setWallet] = useState("");
  const [walletSet, setWalletSet] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveWalletView>("combined");
  const [state, setState] = useState<ReadState>("idle");
  const [profile, setProfile] = useState<WalletReadResponse | null>(null);
  const [walletSources, setWalletSources] = useState<SourceWalletMetadata[]>([]);
  const [errorSources, setErrorSources] = useState<SourceWalletMetadata[]>([]);
  const [error, setError] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<WalletSuggestion | null>(null);
  const [similarCollectors, setSimilarCollectors] = useState<SimilarCollector[]>([]);
  const [similarCollectorsState, setSimilarCollectorsState] = useState<SimilarCollectorsState>("idle");
  const [hideInstitutional, setHideInstitutional] = useState(false);
  const [showAllNearbyCollectors, setShowAllNearbyCollectors] = useState(false);
  const [showAllTopCollections, setShowAllTopCollections] = useState(false);
  const requestSeq = useRef(0);
  const didHydrateUrl = useRef(false);

  async function readWalletSet(
    inputs: string[],
    options: { syncUrl?: boolean; activeView?: ActiveWalletView } = {},
  ) {
    const nextInputs = normalizeWalletInputs(inputs);
    const nextActiveView = normalizeActiveWalletView(options.activeView ?? activeView, nextInputs);
    const readInputs = activeReadInputs(nextInputs, nextActiveView);

    if (nextInputs.length === 0) {
      setWalletSet([]);
      setActiveView("combined");
      setState("idle");
      setError("");
      setProfile(null);
      setWalletSources([]);
      setErrorSources([]);
      if (options.syncUrl !== false) updateWalletUrl([]);
      return;
    }

    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setWalletSet(nextInputs);
    setActiveView(nextActiveView);
    if (options.syncUrl !== false) updateWalletUrl(nextInputs);
    setState("loading");
    setError("");
    setProfile(null);
    setErrorSources([]);

    try {
      const params = new URLSearchParams();
      readInputs.forEach((input) => params.append("wallet", input));
      const res = await fetch(`/api/wallet/read?${params.toString()}`);
      const data = (await res.json()) as WalletReadResponse | WalletReadErrorResponse;

      if (requestSeq.current !== requestId) return;

      if (!res.ok || !isWalletReadResponse(data)) {
        setState("error");
        setError(data.error || "The wallet read failed.");
        setErrorSources(data.sourceWallets ?? []);
        setWalletSources((currentSources) =>
          mergeWalletSources(currentSources, data.sourceWallets ?? [], nextInputs),
        );
        return;
      }

      setProfile(data);
      setShowAllTopCollections(false);
      setState(data.nftCount === 0 ? "empty" : "success");
      setErrorSources([]);

      const canonicalReadInputs = canonicalWalletInputsFromResponse(data, readInputs);
      const canonicalInputs =
        nextActiveView === "combined"
          ? canonicalWalletInputsFromResponse(data, nextInputs)
          : replaceActiveWalletInput(nextInputs, nextActiveView, canonicalReadInputs[0] ?? readInputs[0]);
      const canonicalActiveView = normalizeActiveWalletView(
        nextActiveView === "combined" ? "combined" : canonicalReadInputs[0] ?? nextActiveView,
        canonicalInputs,
      );

      setWalletSources((currentSources) =>
        mergeWalletSources(currentSources, data.sourceWallets ?? [], canonicalInputs),
      );
      setActiveView(canonicalActiveView);

      if (!sameWalletInputs(canonicalInputs, nextInputs)) {
        setWalletSet(canonicalInputs);
        if (options.syncUrl !== false) updateWalletUrl(canonicalInputs);
      }
    } catch {
      if (requestSeq.current !== requestId) return;
      setState("error");
      setError("Could not reach the wallet read service.");
      setErrorSources([]);
    }
  }

  useEffect(() => {
    function hydrateFromUrl() {
      const inputs = walletInputsFromSearch(window.location.search);
      void readWalletSet(inputs, { syncUrl: false });
    }

    if (!didHydrateUrl.current) {
      didHydrateUrl.current = true;
      hydrateFromUrl();
    }

    window.addEventListener("popstate", hydrateFromUrl);
    return () => window.removeEventListener("popstate", hydrateFromUrl);
  }, []);

  useEffect(() => {
    const similarCollectorCollections = profile?.similarCollectorCollections ?? profile?.topCollections ?? [];

    if (state !== "success" || !profile || similarCollectorCollections.length < 2) {
      return;
    }

    const controller = new AbortController();
    const sourceWallets = sourceWalletAddressesFromProfile(profile);
    const collections = similarCollectorCollections
      .slice(0, SIMILAR_COLLECTOR_COLLECTION_LIMIT)
      .map((collection) => ({
        slug: collection.slug,
        name: collection.name,
        imageUrl: collection.imageUrl,
        contract: collection.contract,
        chain: collection.chain,
        contracts: collection.contracts,
      }));

    async function fetchSimilarCollectors() {
      setSimilarCollectors([]);
      setSimilarCollectorsState("loading");

      try {
        const res = await fetch("/api/wallet/similar-collectors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ sourceWallets, collections }),
        });
        if (!res.ok) {
          if (!controller.signal.aborted) setSimilarCollectorsState("error");
          return;
        }

        const data = (await res.json()) as SimilarCollectorsResponse;
        if (!controller.signal.aborted) {
          const meaningfulCollectors = (data.collectors ?? [])
            .filter((collector) => collector.sharedCollectionCount >= MIN_SIMILAR_COLLECTOR_SHARED_COLLECTIONS);
          setSimilarCollectors(meaningfulCollectors);
          setShowAllNearbyCollectors(false);
          setSimilarCollectorsState(meaningfulCollectors.length > 0 ? "success" : "empty");
        }
      } catch {
        if (!controller.signal.aborted) {
          setSimilarCollectors([]);
          setSimilarCollectorsState("error");
        }
      }
    }

    void fetchSimilarCollectors();

    return () => controller.abort();
  }, [profile, state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (walletSet.length >= MAX_WALLETS) return;

    const candidate = (selectedSuggestion?.address || resolvedWallet || wallet).trim();
    if (!candidate) {
      setState("error");
      setError("Enter a wallet address to read.");
      setProfile(null);
      setErrorSources([]);
      return;
    }

    const nextInputs = normalizeWalletInputs([...walletSet, candidate]);
    setWallet("");
    setResolvedWallet("");
    setSelectedSuggestion(null);
    void readWalletSet(nextInputs);
  }

  function handleWalletChange(value: string) {
    setWallet(value);
    setResolvedWallet("");
    setSelectedSuggestion(null);
  }

  function selectSuggestion(suggestion: WalletSuggestion) {
    setWallet(walletSuggestionValue(suggestion));
    setResolvedWallet(suggestion.address ?? "");
    setSelectedSuggestion(suggestion);
  }

  function removeWallet(addressOrInput: string) {
    const nextInputs = walletSet.filter((input) => input.toLowerCase() !== addressOrInput.toLowerCase());
    void readWalletSet(nextInputs);
  }

  function switchActiveView(nextActiveView: ActiveWalletView) {
    void readWalletSet(walletSet, { activeView: nextActiveView });
  }

  const sourceWallets = walletSources.length > 0 ? walletSources : profile?.sourceWallets ?? errorSources;
  const includedSources = sourceWallets.filter((source) => source.status === "included");
  const sourceNotices = sourceWallets.filter((source) => source.status !== "included");
  const atWalletLimit = walletSet.length >= MAX_WALLETS;
  const activeReadLabel = readLabelForView(walletSet, activeView);
  const sourceCollectors = similarCollectors;
  const visibleCollectorPool = (hideInstitutional
    ? sourceCollectors.filter((collector) => !collector.isInstitutionalWallet)
    : sourceCollectors
  ).slice(0, SIMILAR_COLLECTOR_EXPANDED_DISPLAY_LIMIT);
  const visibleCollectors = showAllNearbyCollectors
    ? visibleCollectorPool
    : visibleCollectorPool.slice(0, SIMILAR_COLLECTOR_COLLAPSED_DISPLAY_LIMIT);
  const remainingVisibleCollectorCount = Math.min(
    SIMILAR_COLLECTOR_COLLAPSED_DISPLAY_LIMIT,
    Math.max(0, visibleCollectorPool.length - SIMILAR_COLLECTOR_COLLAPSED_DISPLAY_LIMIT),
  );
  const hasMoreVisibleCollectors = remainingVisibleCollectorCount > 0;
  const hiddenInstitutionalCollectorCount = hideInstitutional
    ? sourceCollectors.filter((c) => c.isInstitutionalWallet).length
    : 0;
  const canFetchSimilarCollectors =
    state === "success" &&
    Boolean(profile) &&
    (profile?.similarCollectorCollections ?? profile?.topCollections ?? []).length >= 2;
  const isSimilarCollectorsLoading = similarCollectorsState === "loading";
  const showNearbyCollectorsSection =
    canFetchSimilarCollectors && (isSimilarCollectorsLoading || similarCollectors.length > 0);
  const hiddenTopCollectionCount = Math.max(0, (profile?.topCollections.length ?? 0) - 6);
  const hasMoreTopCollections = hiddenTopCollectionCount > 0;

  const hasResult = state === "success" || state === "empty";

  return (
    <main className="min-h-screen" style={{ background: "var(--jpgs-bg)", color: "var(--jpgs-text)" }}>
      <section style={{ maxWidth: 920, margin: "0 auto", padding: hasResult ? "20px 24px 16px" : "72px 24px 40px" }}>
        <h1
          style={{
            fontSize: hasResult ? 13 : 38,
            fontWeight: hasResult ? 400 : 300,
            lineHeight: hasResult ? 1.3 : 1.15,
            marginBottom: hasResult ? 6 : 14,
            opacity: hasResult ? 0.38 : 1,
            whiteSpace: hasResult ? "nowrap" : undefined,
            overflow: hasResult ? "hidden" : undefined,
            textOverflow: hasResult ? "ellipsis" : undefined,
          }}
        >
          A wallet read for people who know the JPGs were never just JPGs.
        </h1>
        <p style={{ maxWidth: 560, color: "var(--jpgs-muted)", fontSize: 16, lineHeight: 1.7, marginBottom: 28, display: hasResult ? "none" : undefined }}>
          Enter a wallet, ENS, or OpenSea profile to see the public collection signals hiding in plain sight.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <WalletSearchInput
            value={wallet}
            onChange={handleWalletChange}
            onSelect={selectSuggestion}
            selectedAddress={resolvedWallet}
            placeholder={atWalletLimit ? "Two-wallet reads are the current limit." : "Search a wallet, ENS, OpenSea profile, or collector name"}
            ariaLabel="Wallet, ENS, OpenSea username, or OpenSea profile URL"
            disabled={atWalletLimit}
            name="wallet"
            containerStyle={{ flex: "1 1 min(100%, 360px)", minWidth: 0 }}
          />
          <button
            type="submit"
            disabled={state === "loading" || atWalletLimit}
            style={{
              background: atWalletLimit ? "rgba(255,255,255,0.06)" : "var(--jpgs-accent)",
              border: atWalletLimit ? "1px solid var(--jpgs-border)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "0 18px",
              color: atWalletLimit ? "var(--jpgs-muted)" : "white",
              fontSize: 14,
              minHeight: 50,
              opacity: state === "loading" ? 0.7 : 1,
              cursor: state === "loading" || atWalletLimit ? "not-allowed" : "pointer",
            }}
          >
            {state === "loading" ? "Reading…" : atWalletLimit ? "Limit reached" : "Add wallet"}
          </button>
        </form>

        {(includedSources.length > 0 || sourceNotices.length > 0 || atWalletLimit) && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {includedSources.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Included wallets">
                {includedSources.map((source, index) => (
                  <WalletChip
                    key={source.id}
                    source={source}
                    onRemove={() => removeWallet(source.address || source.input)}
                  />
                ))}
              </div>
            )}
            {sourceNotices.length > 0 && (
              <WalletSourceNotices
                sources={sourceNotices}
                onRemove={(source) => removeWallet(source.address || source.input)}
              />
            )}
            {atWalletLimit && (
              <p style={{ ...mutedTextStyle, fontSize: 12 }}>Two-wallet reads are the current limit.</p>
            )}
            {includedSources.length === MAX_WALLETS && (
              <WalletViewControls
                activeView={activeView}
                walletSet={walletSet}
                onChange={switchActiveView}
              />
            )}
          </div>
        )}
      </section>

      <section style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 80px" }}>
        {state === "idle" && (
          <Panel>
            <p style={eyebrowStyle}>Ready</p>
            <h2 style={panelTitleStyle}>Start with a wallet.</h2>
            <p style={mutedTextStyle}>
              We’ll look for the visible signals hiding in plain sight: collections, counts, images, and simple taste patterns.
            </p>
          </Panel>
        )}

        {state === "loading" && (
          <Panel>
            <p style={eyebrowStyle}>Reading</p>
            <h2 style={panelTitleStyle}>Fetching visible JPGs.</h2>
            <p style={mutedTextStyle}>This can take a moment while collection metadata is gathered.</p>
          </Panel>
        )}

        {state === "error" && (
          <Panel>
            <p style={{ ...eyebrowStyle, color: "rgb(255, 138, 128)" }}>Error</p>
            <h2 style={panelTitleStyle}>That wallet could not be read.</h2>
            <p style={mutedTextStyle}>{error}</p>
            {sourceNotices.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <WalletSourceNotices
                  sources={sourceNotices}
                  onRemove={(source) => removeWallet(source.address || source.input)}
                />
              </div>
            )}
          </Panel>
        )}

        {state === "empty" && profile && (
          <Panel>
            <WalletHeader
              profile={profile}
              sourceWallets={includedSources}
              readLabel={activeReadLabel}
              walletSet={walletSet}
              activeView={activeView}
            />
            <div style={{ borderTop: "1px solid var(--jpgs-border)", marginTop: 22, paddingTop: 22 }}>
              <h2 style={panelTitleStyle}>No visible JPGs found.</h2>
              <p style={mutedTextStyle}>
                {activeView === "combined" && walletSet.length > 1
                  ? "These wallets did not return visible JPG holdings from the current source."
                  : "This wallet did not return visible JPG holdings from the current source."}
              </p>
            </div>
          </Panel>
        )}

        {state === "success" && profile && (
          <div style={successBodyStyle}>
            <Panel>
              <WalletHeader
                profile={profile}
                sourceWallets={includedSources}
                readLabel={activeReadLabel}
                walletSet={walletSet}
                activeView={activeView}
              />
            </Panel>

            <div style={readAndSupportStyle}>
              <Panel style={readPanelStyle}>
                <WalletReadSummary profile={profile} />
              </Panel>

              <Panel style={supportPanelStyle}>
                <SectionHeading title="Top collections" detail={`Top 12 of ${profile.collectionCount} visible collections`} />
                <div style={{ display: "grid", gap: 16 }}>
                  <style>{`
                    .ilj-top-collections-reveal {
                      display: none;
                      justify-self: start;
                      min-height: 44px;
                      border: 1px solid rgba(149, 117, 255, 0.22);
                      border-radius: 999px;
                      padding: 8px 12px;
                      background: rgba(149, 117, 255, 0.075);
                      color: rgba(223, 214, 255, 0.9);
                      font-family: var(--font-geist-mono), monospace;
                      font-size: 11px;
                      line-height: 1.1;
                      cursor: pointer;
                      transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
                    }
                    .ilj-top-collections-reveal:hover {
                      border-color: rgba(149, 117, 255, 0.38);
                      background: rgba(149, 117, 255, 0.12);
                      color: rgb(240, 237, 230);
                    }
                    .ilj-top-collections-reveal:focus-visible {
                      outline: 2px solid rgba(149, 117, 255, 0.55);
                      outline-offset: 2px;
                    }
                    @media (max-width: 760px) {
                      .ilj-top-collection-mobile-extra--collapsed {
                        display: none !important;
                      }
                      .ilj-top-collections-reveal {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                      }
                    }
                  `}</style>
                  {profile.topCollections.slice(0, 3).length > 0 && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))",
                      gap: 12,
                    }}>
                      {profile.topCollections.slice(0, 3).map((collection) => (
                        <a
                          key={collection.slug}
                          href={collection.openseaUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 8,
                            padding: 10,
                            textDecoration: "none",
                            color: "var(--jpgs-text)",
                            overflow: "hidden",
                          }}
                        >
                          <div style={{
                            width: "100%",
                            aspectRatio: "1",
                            overflow: "hidden",
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.04)",
                            flexShrink: 0,
                          }}>
                            {collection.imageUrl ? (
                              <img
                                src={collection.imageUrl}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              <span style={{
                                width: "100%",
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                                background: "rgba(149,117,255,0.14)",
                                color: "var(--jpgs-accent)",
                                fontSize: 16,
                                fontFamily: "var(--font-geist-mono)",
                              }}>
                                {collection.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {collection.name}
                            </p>
                            <p style={{ color: "var(--jpgs-muted)", fontSize: 11 }}>
                              {collection.count} held
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  {profile.topCollections.slice(3).length > 0 && (
                    <div style={collectionGridStyle}>
                      {profile.topCollections.slice(3).map((collection, index) => (
                        <a
                          key={collection.slug}
                          className={
                            !showAllTopCollections && index >= 3
                              ? "ilj-top-collection-mobile-extra--collapsed"
                              : undefined
                          }
                          href={collection.openseaUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "64px minmax(0, 1fr)",
                            gap: 14,
                            alignItems: "center",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--jpgs-border)",
                            borderRadius: 8,
                            padding: 12,
                            textDecoration: "none",
                            color: "var(--jpgs-text)",
                            minHeight: 90,
                          }}
                        >
                          <CollectionImage collection={collection} size={64} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 14, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {collection.name}
                            </p>
                            <p style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>
                              {collection.count} held
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  {hasMoreTopCollections && (
                    <button
                      type="button"
                      className="ilj-top-collections-reveal"
                      aria-expanded={showAllTopCollections}
                      aria-label={
                        showAllTopCollections
                          ? "Show fewer top collections"
                          : `Show ${hiddenTopCollectionCount} more top collections`
                      }
                      onClick={() => setShowAllTopCollections((current) => !current)}
                    >
                      {showAllTopCollections
                        ? "Show fewer"
                        : `+${hiddenTopCollectionCount} more top collections`}
                    </button>
                  )}
                </div>
              </Panel>

              {SHOW_TOP_ARTISTS && (profile.topArtists?.length ?? 0) > 0 && (
                <Panel style={supportPanelStyle}>
                  <SectionHeading title="Top artists" detail="From token artist traits" />
                  <div style={topArtistGridStyle}>
                    {profile.topArtists?.map((artist) => (
                      <TopArtistCard key={artist.key} artist={artist} />
                    ))}
                  </div>
                </Panel>
              )}

              {profile.tasteSignals.length > 0 && (
                <Panel style={supportPanelStyle}>
                  <SectionHeading title="Taste signals" detail="Grouped from visible metadata" />
                  <div style={tasteSignalGridStyle}>
                    {profile.tasteSignals.slice(0, 6).map((signal) => (
                      <WalletTasteSignalCard
                        key={signal.category}
                        signal={signal}
                        totalVisibleJpgs={profile.nftCount}
                        walletLabel={tasteSignalWalletLabel(profile, includedSources, walletSet, activeView)}
                      />
                    ))}
                  </div>
                </Panel>
              )}

              {showNearbyCollectorsSection && (
                <Panel style={supportPanelStyle}>
                  <SectionHeading
                    title="Collectors nearby"
                    detail="Looking across this wallet's top 25 visible collections to find collectors with nearby taste. Ranked by shared collection count first, then weighted by how deeply each collector holds those shared collections."
                  />
                  <style>{`
                    .ilj-similar-collector-link { transition: opacity 0.15s; }
                    .ilj-similar-collector-link:hover { opacity: 0.7; }
                    .ilj-wallet-profile-action {
                      display: inline-flex;
                      align-items: center;
                      gap: 5px;
                      color: rgba(174, 148, 255, 0.76);
                      font-size: 11px;
                      line-height: 1.2;
                      text-decoration: none;
                      opacity: 0.82;
                      transition: opacity 0.15s ease, color 0.15s ease;
                    }
                    .ilj-wallet-profile-action:hover {
                      color: rgba(196, 178, 255, 0.9);
                      opacity: 0.86;
                    }
                    .ilj-wallet-profile-links {
                      display: flex;
                      flex-wrap: nowrap;
                      align-items: center;
                      justify-content: flex-start;
                      gap: 5px;
                      max-width: 100%;
                      min-width: 0;
                      overflow: hidden;
                      color: rgba(168,164,157,0.36);
                      font-size: 10px;
                      line-height: 1.2;
                      margin-top: auto;
                      white-space: nowrap;
                    }
                    .ilj-wallet-profile-separator {
                      flex: 0 0 auto;
                    }
                    .ilj-wallet-similar-card {
                      display: flex;
                      flex-direction: column;
                      gap: 0;
                      min-width: 0;
                      border: 1px solid rgba(255,255,255,0.07);
                      border-radius: 14px;
                      padding: 18px;
                      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.024)), #141516;
                      color: var(--jpgs-text);
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 14px 34px rgba(0,0,0,0.16);
                    }
                    .ilj-wallet-similar-card:first-child {
                      border-color: rgba(149,117,255,0.24);
                      box-shadow: inset 0 1px 0 rgba(255,255,255,0.045), 0 0 0 1px rgba(149,117,255,0.055), 0 18px 38px rgba(0,0,0,0.2);
                    }
                    .ilj-wallet-similar-card:nth-child(even) {
                      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.022)), #171719;
                    }
                    .ilj-wallet-similar-header {
                      display: flex;
                      align-items: flex-start;
                      justify-content: space-between;
                      gap: 12px;
                      padding-bottom: 16px;
                      margin-bottom: 14px;
                      border-bottom: 1px solid rgba(255,255,255,0.07);
                    }
                    .ilj-wallet-similar-identity {
                      display: flex;
                      flex-direction: row;
                      align-items: center;
                      gap: 12px;
                      min-width: 0;
                      flex: 1;
                    }
                    .ilj-wallet-similar-avatar-wrap {
                      width: 44px;
                      height: 44px;
                      border-radius: 50%;
                      flex-shrink: 0;
                      box-sizing: border-box;
                      border: 1px solid rgba(214,204,255,0.24);
                      background: rgba(149,117,255,0.15);
                      overflow: hidden;
                    }
                    .ilj-wallet-similar-avatar-wrap img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                      display: block;
                      border-radius: 50%;
                    }
                    .ilj-wallet-similar-rank {
                      flex-shrink: 0;
                      border: 1px solid rgba(149,117,255,0.36);
                      border-radius: 7px;
                      padding: 4px 8px;
                      background: rgba(149,117,255,0.18);
                      color: rgba(225,217,255,0.92);
                      font-size: 12px;
                      line-height: 1.2;
                      font-family: var(--font-geist-mono), monospace;
                      font-weight: 600;
                      white-space: nowrap;
                    }
                    .ilj-wallet-similar-copy {
                      min-width: 0;
                      display: grid;
                      gap: 5px;
                      align-content: center;
                      flex: 1;
                    }
                    .ilj-wallet-similar-count-block {
                      flex-shrink: 0;
                      display: flex;
                      flex-direction: column;
                      align-items: flex-end;
                      gap: 3px;
                    }
                    .ilj-wallet-similar-count {
                      color: rgb(170,126,255);
                      font-family: var(--font-geist-mono), monospace;
                      font-size: 44px;
                      font-weight: 750;
                      line-height: 0.9;
                      letter-spacing: -1px;
                      text-shadow: 0 0 14px rgba(149,117,255,0.18);
                      font-variant-numeric: tabular-nums;
                    }
                    .ilj-wallet-similar-count-label {
                      color: rgba(168,164,157,0.62);
                      font-family: var(--font-geist-mono), monospace;
                      font-size: 9px;
                      line-height: 1.2;
                      letter-spacing: 0.14em;
                      text-transform: uppercase;
                    }
                    @media (max-width: 760px) {
                      .ilj-wallet-similar-card {
                        padding: 14px;
                      }
                      .ilj-wallet-similar-count {
                        font-size: 36px;
                      }
                    }
                    @media (max-width: 460px) {
                      .ilj-wallet-similar-card {
                        padding: 12px;
                      }
                    }
                    .ilj-wallet-similar-loading {
                      display: grid;
                      gap: 16px;
                      border: 1px solid rgba(255,255,255,0.07);
                      border-radius: 14px;
                      padding: 18px;
                      background: #161616;
                    }
                    .ilj-wallet-similar-loading-bars {
                      display: grid;
                      gap: 10px;
                    }
                    .ilj-wallet-similar-loading-bar {
                      height: 10px;
                      border-radius: 999px;
                      background: linear-gradient(90deg, rgba(255,255,255,0.055), rgba(149,117,255,0.16), rgba(255,255,255,0.055));
                      background-size: 200% 100%;
                      animation: iljWalletSimilarLoading 1.6s ease-in-out infinite;
                    }
                    @keyframes iljWalletSimilarLoading {
                      0% { background-position: 100% 0; }
                      100% { background-position: -100% 0; }
                    }
                  `}</style>
                  {isSimilarCollectorsLoading ? (
                    <SimilarCollectorsLoadingState />
                  ) : (
                    <div style={similarCollectorGridStyle}>
                      {visibleCollectors.map((collector) => (
                        <SimilarCollectorCard
                          key={collector.address}
                          collector={collector}
                          rank={sourceCollectors.findIndex((item) => item.address === collector.address) + 1}
                        />
                      ))}
                    </div>
                  )}
                  {!isSimilarCollectorsLoading && hasMoreVisibleCollectors && (
                    <button
                      type="button"
                      aria-expanded={showAllNearbyCollectors}
                      aria-label={
                        showAllNearbyCollectors
                          ? "Show fewer nearby collectors"
                          : `Show ${remainingVisibleCollectorCount} more nearby collectors`
                      }
                      onClick={() => setShowAllNearbyCollectors((current) => !current)}
                      style={similarCollectorRevealButtonStyle}
                    >
                      {showAllNearbyCollectors
                        ? "Show fewer collectors"
                        : `Show ${remainingVisibleCollectorCount} more collectors`}
                    </button>
                  )}
                </Panel>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function isWalletReadResponse(data: WalletReadResponse | WalletReadErrorResponse): data is WalletReadResponse {
  return (
    typeof data.wallet === "string" &&
    typeof data.shortWallet === "string" &&
    typeof data.nftCount === "number" &&
    Array.isArray(data.topCollections) &&
    (!("topArtists" in data) || Array.isArray(data.topArtists)) &&
    Array.isArray(data.tasteSignals)
  );
}

function walletInputsFromSearch(search: string): string[] {
  return normalizeWalletInputs(new URLSearchParams(search).getAll("wallet"));
}

function normalizeActiveWalletView(activeView: ActiveWalletView, walletInputs: string[]): ActiveWalletView {
  if (walletInputs.length < 2) return "combined";
  if (activeView === "combined") return "combined";
  return findWalletInput(walletInputs, activeView) ?? "combined";
}

function activeReadInputs(walletInputs: string[], activeView: ActiveWalletView): string[] {
  if (activeView === "combined") return walletInputs;
  const activeInput = findWalletInput(walletInputs, activeView);
  return activeInput ? [activeInput] : walletInputs;
}

function replaceActiveWalletInput(
  walletInputs: string[],
  activeView: ActiveWalletView,
  replacementInput?: string,
): string[] {
  if (activeView === "combined" || !replacementInput) return walletInputs;
  const nextInputs = walletInputs.map((input) =>
    sameWalletInput(input, activeView) ? replacementInput : input,
  );
  return normalizeWalletInputs(nextInputs);
}

function findWalletInput(walletInputs: string[], target: string): string | undefined {
  return walletInputs.find((input) => sameWalletInput(input, target));
}

function sameWalletInput(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeWalletInputs(inputs: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const input of inputs) {
    const trimmed = input.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length >= MAX_WALLETS) break;
  }

  return normalized;
}

function canonicalWalletInputsFromResponse(profile: WalletReadResponse, fallbackInputs: string[]): string[] {
  const sourceInputs = (profile.sourceWallets ?? [])
    .map((source) => source.address || source.input)
    .filter((input): input is string => Boolean(input?.trim()));

  return normalizeWalletInputs(sourceInputs.length > 0 ? sourceInputs : fallbackInputs);
}

function sourceWalletAddressesFromProfile(profile: WalletReadResponse): string[] {
  const sourceWallets = (profile.sourceWallets ?? [])
    .filter((source) => source.status === "included")
    .map((source) => source.address)
    .filter((address): address is string => Boolean(address?.trim()));

  return sourceWallets.length > 0 ? sourceWallets : profile.wallets ?? [profile.wallet];
}

function mergeWalletSources(
  currentSources: SourceWalletMetadata[],
  incomingSources: SourceWalletMetadata[],
  walletInputs: string[],
): SourceWalletMetadata[] {
  const currentByKey = sourceLookup(currentSources);
  const incomingByKey = sourceLookup(incomingSources);

  return walletInputs.map((input) => {
    const key = input.toLowerCase();
    return (
      incomingByKey.get(key) ??
      currentByKey.get(key) ??
      {
        id: `wallet-input:${key}`,
        input,
        status: "included",
        nftCount: 0,
        collectionCount: 0,
      }
    );
  });
}

function sourceLookup(sources: SourceWalletMetadata[]): Map<string, SourceWalletMetadata> {
  const lookup = new Map<string, SourceWalletMetadata>();
  for (const source of sources) {
    [source.input, source.address, source.shortWallet]
      .filter((value): value is string => Boolean(value?.trim()))
      .forEach((value) => lookup.set(value.toLowerCase(), source));
  }
  return lookup;
}

function sameWalletInputs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((input, index) => input.toLowerCase() === b[index]?.toLowerCase());
}

function readLabelForView(walletInputs: string[], activeView: ActiveWalletView): string {
  if (walletInputs.length > 1 && activeView !== "combined") return "Individual Read";
  if (walletInputs.length > 1) return "Combined Read";
  return "Wallet Read";
}

function updateWalletUrl(inputs: string[]) {
  const params = new URLSearchParams();
  normalizeWalletInputs(inputs).forEach((input) => params.append("wallet", input));
  const nextUrl = params.toString() ? `/wallet?${params.toString()}` : "/wallet";
  window.history.replaceState(null, "", nextUrl);
}

function shortWallet(wallet?: string): string {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function sourceLabel(source: SourceWalletMetadata): string {
  return source.displayName || source.ens || source.username || source.shortWallet || source.address || source.input;
}

function displayTasteSignalLabel(label: string): string {
  return label === "Unsorted Signals" ? "Unsorted JPGs" : label;
}

function formatCount(count: number): string {
  return NUMBER_FORMATTER.format(count);
}

function tasteSignalWalletLabel(
  profile: WalletReadResponse,
  sourceWallets: SourceWalletMetadata[],
  walletSet: string[],
  activeView: ActiveWalletView,
): string {
  if (walletSet.length > 1 && activeView === "combined") return "Combined wallets";

  const identityProfile = sourceWallets.length > 0 ? { ...profile, sourceWallets } : profile;
  const activeSource = activeSourceForView(identityProfile, walletSet, activeView);
  return sourceIdentityLabel(activeSource, profile.shortWallet || profile.wallet) || "This wallet";
}

function WalletTasteSignalCard({
  signal,
  totalVisibleJpgs,
  walletLabel,
}: {
  signal: TasteSignal;
  totalVisibleJpgs: number;
  walletLabel: string;
}) {
  const rawPct = totalVisibleJpgs > 0 ? (signal.nftCount / totalVisibleJpgs) * 100 : 0;
  const displayPct = Math.round(rawPct);
  const barWidth = Math.min((rawPct / WALLET_SIGNAL_BAR_SCALE_MAX) * 100, 100);
  const collectionNames = signal.collections.map((collection) => collection.name).join(", ");

  return (
    <article style={walletSignalCardStyle}>
      <div style={walletSignalHeaderStyle}>
        <h3 style={walletSignalTitleStyle}>{displayTasteSignalLabel(signal.label)}</h3>
        <span style={walletSignalCountPillStyle}>{formatCount(signal.nftCount)} JPGs</span>
      </div>
      {collectionNames && (
        <p style={walletSignalExampleLineStyle}>Seen around {collectionNames}</p>
      )}
      <div style={walletSignalBarRowStyle}>
        <div style={walletSignalBarHeaderStyle}>
          <span style={walletSignalNameStyle}>{walletLabel}</span>
          <span style={walletSignalStatStyle}>
            {displayPct}% of visible JPGs · {formatCount(signal.nftCount)} / {formatCount(totalVisibleJpgs)} JPGs
          </span>
        </div>
        <div style={walletSignalBarTrackStyle}>
          <div style={{ ...walletSignalBarFillStyle, width: `${barWidth}%` }} />
        </div>
      </div>
    </article>
  );
}

function includedSourceWallets(profile: WalletReadResponse): SourceWalletMetadata[] {
  const sources = profile.sourceWallets ?? [];
  const includedSources = sources.filter((source) => source.status === "included");
  return includedSources.length > 0 ? includedSources : sources;
}

function activeSourceForView(
  profile: WalletReadResponse,
  walletSet: string[],
  activeView: ActiveWalletView,
): SourceWalletMetadata | undefined {
  const sources = includedSourceWallets(profile);
  if (activeView === "combined") return sources[0];

  return (
    sources.find((source) =>
      [source.input, source.address, source.shortWallet]
        .filter((value): value is string => Boolean(value?.trim()))
        .some((value) => sameWalletInput(value, activeView)),
    ) ??
    sources.find((source) => walletSet.some((input) => sameWalletInput(source.input, input))) ??
    sources[0]
  );
}

function sourceIdentityLabel(source?: SourceWalletMetadata, fallback?: string): string {
  return (
    source?.displayName ||
    source?.ens ||
    source?.username ||
    source?.shortWallet ||
    shortWallet(source?.address) ||
    source?.address ||
    source?.input ||
    fallback ||
    ""
  );
}

function sourceIdentitySecondary(source?: SourceWalletMetadata, fallback?: string): string {
  if (!source) return fallback || "";

  const proof = source.shortWallet || shortWallet(source.address);
  const handle = source.ens || source.username;
  if (handle && proof) return `${handle} · ${proof}`;
  return handle || proof || source.address || source.input || fallback || "";
}

function sourceInitials(source?: SourceWalletMetadata): string {
  const label = sourceIdentityLabel(source, "??");
  const words = label
    .replace(/^0x/i, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : label.slice(0, 2);
  return initials.toUpperCase();
}

function addressProofLine(sources: SourceWalletMetadata[]): string {
  return sources
    .map((source) => source.shortWallet || shortWallet(source.address) || source.address || source.input)
    .filter(Boolean)
    .join(" + ");
}

function WalletChip({
  source,
  onRemove,
}: {
  source: SourceWalletMetadata;
  onRemove: () => void;
}) {
  const label = sourceLabel(source);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
        minHeight: 34,
        padding: "6px 8px 6px 10px",
        border: "1px solid var(--jpgs-border)",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        color: "var(--jpgs-text)",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
          {label}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--jpgs-muted)",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

function WalletSourceNotices({
  sources,
  onRemove,
}: {
  sources: SourceWalletMetadata[];
  onRemove?: (source: SourceWalletMetadata) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {sources.map((source) => (
        <div
          key={source.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            color: "var(--jpgs-muted)",
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          <span>{sourceLabel(source)} was not included: {source.error || "This wallet could not be read."}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(source)}
              style={{
                border: "1px solid var(--jpgs-border)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--jpgs-muted)",
                cursor: "pointer",
                fontSize: 11,
                padding: "3px 6px",
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function WalletViewControls({
  activeView,
  walletSet,
  onChange,
}: {
  activeView: ActiveWalletView;
  walletSet: string[];
  onChange: (activeView: ActiveWalletView) => void;
}) {
  const options = [
    { label: "Combined", value: "combined" },
    ...walletSet.map((input, index) => ({ label: `Wallet ${index + 1}`, value: input })),
  ];

  return (
    <div style={{ display: "grid", gap: 7, maxWidth: 520 }}>
      <div
        role="group"
        aria-label="Wallet read view"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: 4,
          border: "1px solid var(--jpgs-border)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        {options.map((option) => {
          const isActive =
            option.value === "combined"
              ? activeView === "combined"
              : activeView !== "combined" && sameWalletInput(activeView, option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              style={{
                flex: "1 1 120px",
                minHeight: 34,
                border: isActive ? "1px solid rgba(255,255,255,0.16)" : "1px solid transparent",
                borderRadius: 6,
                background: isActive ? "var(--jpgs-accent)" : "transparent",
                color: isActive ? "white" : "var(--jpgs-muted)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p style={{ ...mutedTextStyle, fontSize: 12 }}>
        Combined reads treat included wallets as one visible collection set. Individual reads isolate one wallet.
      </p>
    </div>
  );
}

function buildWalletRead(profile: WalletReadResponse): WalletReadCopy {
  const subject = profile.walletCount && profile.walletCount > 1 ? "These wallets" : "This wallet";
  const subjectVerb = subject === "This wallet" ? "has" : "have";
  const signalPhrases = profile.tasteSignals
    .slice()
    .sort((a, b) => b.nftCount - a.nftCount)
    .map((signal) => READ_LABELS[signal.label] ?? signal.label.toLowerCase())
    .slice(0, 3);

  const proofCollections = profile.topCollections
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((collection) => collection.name)
    .filter(Boolean)
    .slice(0, 5);

  const fallbackCollections = proofCollections.slice(0, 3);
  const hasMoreCollections = profile.collectionCount > proofCollections.length;

  let headline: string;
  if (signalPhrases.length > 1) {
    headline = `${subject} ${subjectVerb} recognizable JPG taste: ${formatList(signalPhrases)} keep showing up as the main signals.`;
  } else if (signalPhrases.length === 1) {
    headline = `${subject} ${subjectVerb} recognizable JPG taste: ${signalPhrases[0]} keeps showing up as the main signal.`;
  } else if (fallbackCollections.length > 1) {
    headline = `${subject} ${subject === "This wallet" ? "appears" : "appear"} clustered around ${formatList(fallbackCollections)}.`;
  } else if (fallbackCollections.length === 1) {
    headline = `${subject} ${subject === "This wallet" ? "appears" : "appear"} centered on ${fallbackCollections[0]}.`;
  } else {
    headline = `${subject} ${subjectVerb} a sparse visible collection pattern.`;
  }

  const body =
    proofCollections.length > 0
      ? `The clearest proof is the repetition across ${formatProofList(proofCollections, hasMoreCollections)}.`
      : "There is not enough visible collection data to make a more specific read yet.";

  return { headline, body };
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatProofList(collections: string[], hasMoreCollections: boolean): string {
  if (!hasMoreCollections) return formatList(collections);
  return formatListWithFinalItem(collections, "other visible collection clusters");
}

function formatListWithFinalItem(items: string[], finalItem: string): string {
  if (items.length === 0) return finalItem;
  if (items.length === 1) return `${items[0]} and ${finalItem}`;
  return `${items.join(", ")}, and ${finalItem}`;
}

function WalletReadSummary({ profile }: { profile: WalletReadResponse }) {
  const read = buildWalletRead(profile);

  return (
    <>
      <p style={eyebrowStyle}>The Read</p>
      <h2 style={{ ...panelTitleStyle, fontSize: 28, lineHeight: 1.3, marginBottom: 12 }}>{read.headline}</h2>
      <p style={{ ...mutedTextStyle, fontSize: 15, lineHeight: 1.8 }}>{read.body}</p>
    </>
  );
}

const WALLET_HEADER_BLOCK_SIZE = 90;

function WalletHeader({
  profile,
  sourceWallets,
  readLabel,
  walletSet,
  activeView,
}: {
  profile: WalletReadResponse;
  sourceWallets: SourceWalletMetadata[];
  readLabel: string;
  walletSet: string[];
  activeView: ActiveWalletView;
}) {
  const identityProfile = sourceWallets.length > 0 ? { ...profile, sourceWallets } : profile;
  const sources = includedSourceWallets(identityProfile);
  const activeSource = activeSourceForView(identityProfile, walletSet, activeView);
  const sourceWalletCount = profile.includedWalletCount ?? profile.walletCount ?? sources.length;
  const walletCount = sourceWalletCount > 0 ? sourceWalletCount : 1;
  const identityTitle = sourceIdentityLabel(activeSource, profile.shortWallet || profile.wallet);
  const secondaryIdentity = sourceIdentitySecondary(activeSource, profile.shortWallet || profile.wallet);
  const proofLine = addressProofLine(sources);
  const detailLine =
    walletSet.length > 1 && activeView !== "combined"
      ? `Selected wallet from ${walletSet.length} included wallets.`
      : walletCount > 1
        ? `Includes ${walletCount} wallets${proofLine ? ` · ${proofLine}` : ""}`
        : "";
  const isCappedRead = profile.debug
    ? !profile.debug.complete || profile.debug.stoppedReason === "max_reached"
    : false;
  const maxVisibleNfts = profile.debug?.maxVisibleNfts.toLocaleString() ?? "1,000";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <p style={eyebrowStyle}>{readLabel}</p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, display: "flex", gap: 12, alignItems: "flex-end", flex: "1 1 360px" }}>
            <SourceAvatar source={activeSource} size={WALLET_HEADER_BLOCK_SIZE} />
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  ...panelTitleStyle,
                  overflowWrap: "anywhere",
                  textWrap: "balance",
                }}
              >
                {identityTitle}
              </h2>
              {secondaryIdentity && (
                <p style={{ ...mutedTextStyle, fontSize: 12, overflowWrap: "anywhere" }}>
                  {secondaryIdentity}
                </p>
              )}
              {detailLine && (
                <p style={{ ...mutedTextStyle, fontSize: 12, overflowWrap: "anywhere", marginTop: 2 }}>
                  {detailLine}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Metric label="JPGs read" value={profile.nftCount} />
            <Metric label="Collections" value={profile.collectionCount} />
          </div>
        </div>
      </div>
      <p style={{ ...mutedTextStyle, fontSize: 12 }}>{SUPPORTED_CHAIN_COPY}</p>
      {isCappedRead && (
        <p style={{ ...mutedTextStyle, fontSize: 12 }}>
          This read is based on the first {maxVisibleNfts} visible NFTs returned by the current source.
        </p>
      )}
    </div>
  );
}

function SourceAvatar({ source, size }: { source?: SourceWalletMetadata; size: number }) {
  if (source?.avatarUrl) {
    return (
      <img
        src={source.avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          flex: "0 0 auto",
          objectFit: "cover",
          borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        background: "rgba(149,117,255,0.12)",
        color: "var(--jpgs-accent)",
        fontSize: 20,
        fontFamily: "var(--font-geist-mono)",
      }}
    >
      {sourceInitials(source)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        minWidth: 108,
        minHeight: WALLET_HEADER_BLOCK_SIZE,
        boxSizing: "border-box",
        border: "1px solid var(--jpgs-border)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "var(--jpgs-muted)", fontSize: 11, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...panelShellStyle, ...style }}>
      {children}
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={sectionHeadingStyle}>
      <h2 style={{ ...panelTitleStyle, flex: "1 1 220px", marginBottom: 0 }}>{title}</h2>
      <p style={sectionHeadingDetailStyle}>{detail}</p>
    </div>
  );
}

function CollectionImage({ collection, size = 56 }: { collection: TopCollection; size?: number }) {
  if (!collection.imageUrl) {
    return (
      <div style={{ ...imageFallbackStyle, width: size, height: size }} aria-hidden="true">
        {collection.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={collection.imageUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
    />
  );
}

function SimilarCollectorsLoadingState() {
  return (
    <div
      className="ilj-wallet-similar-loading"
      role="status"
      aria-live="polite"
      aria-label="Finding nearby collectors"
    >
      <div>
        <p style={{ ...eyebrowStyle, marginBottom: 8 }}>Reading overlap</p>
        <h3 style={nearbyCollectorsLoadingTitleStyle}>Finding nearby collectors</h3>
        <p style={nearbyCollectorsLoadingBodyStyle}>
          {"Reading this wallet's top collections and looking for people with overlapping taste."}
        </p>
      </div>
      <div className="ilj-wallet-similar-loading-bars" aria-hidden="true">
        <span className="ilj-wallet-similar-loading-bar" style={{ width: "88%" }} />
        <span className="ilj-wallet-similar-loading-bar" style={{ width: "64%" }} />
        <span className="ilj-wallet-similar-loading-bar" style={{ width: "76%" }} />
      </div>
    </div>
  );
}

function SimilarCollectorCard({ collector, rank }: { collector: SimilarCollector; rank: number }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const label = collector.ens || collector.displayName || collector.username || collector.shortWallet;
  const secondaryIdentity = collector.username
    ? `${collector.username} · ${collector.shortWallet}`
    : collector.shortWallet;
  const avatarSrc = avatarFailed
    ? null
    : collector.avatarUrl || collector.profileImageUrl || collector.imageUrl || null;
  const profileLinks = [
    collector.openSeaUrl || collector.openseaProfileUrl
      ? {
          label: "OpenSea",
          href: collector.openSeaUrl || collector.openseaProfileUrl,
          ariaLabel: `View ${label} on OpenSea`,
        }
      : null,
    collector.twitterUrl
      ? { label: "X", href: collector.twitterUrl, ariaLabel: `View ${label} on X` }
      : null,
    collector.instagramUrl
      ? { label: "IG", href: collector.instagramUrl, ariaLabel: `View ${label} on Instagram` }
      : null,
  ].filter((link): link is { label: string; href: string; ariaLabel: string } => Boolean(link));
  const initials = label.replace(/^0x/i, "").slice(0, 2).toUpperCase();
  const sharedCollections = sharedCollectorCollectionItems(collector.matchedCollections, collector.address);
  const orderedSharedCollections = orderedSharedCollectionItems(sharedCollections);

  return (
    <article className="ilj-wallet-similar-card">
      <div className="ilj-wallet-similar-header">
        <div className="ilj-wallet-similar-identity">
          <span className="ilj-wallet-similar-rank">#{rank}</span>
          <div className="ilj-wallet-similar-avatar-wrap" aria-hidden="true">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                loading="lazy"
                onError={() => setAvatarFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={similarCollectorAvatarFallbackStyle} aria-hidden="true">
                {initials}
              </span>
            )}
          </div>
          <div className="ilj-wallet-similar-copy">
            <span style={similarCollectorNameStyle}>{label}</span>
            {secondaryIdentity && (
              <p style={similarCollectorIdentityStyle}>{secondaryIdentity}</p>
            )}
            {profileLinks.length > 0 ? (
              <div className="ilj-wallet-profile-links">
                {profileLinks.map((link, index) => (
                  <Fragment key={link.label}>
                    {index > 0 ? <span className="ilj-wallet-profile-separator" aria-hidden="true">·</span> : null}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ilj-wallet-profile-action"
                      aria-label={link.ariaLabel}
                    >
                      {link.label}
                      {link.label === "OpenSea" ? <span aria-hidden="true">↗</span> : null}
                    </a>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ilj-wallet-similar-count-block">
          <span className="ilj-wallet-similar-count">{collector.sharedCollectionCount}</span>
          <span className="ilj-wallet-similar-count-label">SHARED</span>
        </div>
      </div>
      <CollectionScrollRow collections={orderedSharedCollections} collectorAddress={collector.address} />
    </article>
  );
}

function TopArtistCard({ artist }: { artist: TopArtist }) {
  const proofCollections = artist.collections.map((collection) => collection.name).filter(Boolean).slice(0, 3);
  const sourceFields = artist.sourceFields.join(", ");

  return (
    <div style={topArtistCardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          {artist.openseaCreatedUrl ? (
            <a
              href={artist.openseaCreatedUrl}
              target="_blank"
              rel="noreferrer"
              style={topArtistNameLinkStyle}
            >
              {artist.name}
            </a>
          ) : (
            <h3 style={topArtistNameStyle}>{artist.name}</h3>
          )}
          <p style={{ color: "var(--jpgs-muted)", fontSize: 12, marginTop: 4 }}>
            {formatPieceCount(artist.ownedCount)} found
          </p>
        </div>
        {artist.samplePieces.length > 0 && (
          <div style={topArtistThumbsStyle} aria-hidden="true">
            {artist.samplePieces.slice(0, 3).map((piece) => (
              <ArtistPieceImage key={`${artist.key}-${piece.openseaUrl ?? piece.name}`} piece={piece} />
            ))}
          </div>
        )}
      </div>
      {proofCollections.length > 0 && (
        <p style={topArtistProofStyle}>
          Seen in {formatList(proofCollections)}.
        </p>
      )}
      {artist.samplePieces.length > 0 && (
        <p style={topArtistProofStyle}>
          Proof pieces: {formatList(artist.samplePieces.map((piece) => piece.name).slice(0, 2))}.
        </p>
      )}
      {sourceFields && (
        <p style={topArtistSourceStyle}>
          Source traits: {sourceFields}
        </p>
      )}
    </div>
  );
}

function ArtistPieceImage({
  piece,
}: {
  piece: TopArtist["samplePieces"][number];
}) {
  if (!piece.imageUrl) {
    return (
      <span style={artistPieceFallbackStyle}>
        {piece.name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={piece.imageUrl}
      alt=""
      width={42}
      height={42}
      loading="lazy"
      style={artistPieceImageStyle}
    />
  );
}

function formatPieceCount(count: number): string {
  return `${count} ${count === 1 ? "piece" : "pieces"}`;
}

const panelShellStyle: React.CSSProperties = {
  background: "var(--jpgs-surface)",
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "clamp(18px, 3.6vw, 24px)",
};

const successBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(24px, 4vw, 34px)",
};

const readAndSupportStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(16px, 2.5vw, 20px)",
};

const readPanelStyle: React.CSSProperties = {
  padding: "clamp(28px, 5.5vw, 44px)",
};

const supportPanelStyle: React.CSSProperties = {
  padding: "clamp(18px, 3vw, 22px)",
};

const collectionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: "clamp(12px, 2vw, 16px)",
};

const topArtistGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(10px, 1.8vw, 12px)",
};

const topArtistCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.018)",
};

const topArtistNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
};

const topArtistNameLinkStyle: React.CSSProperties = {
  ...topArtistNameStyle,
  color: "var(--jpgs-text)",
  textDecorationColor: "rgba(149,117,255,0.55)",
  textUnderlineOffset: 3,
};

const topArtistThumbsStyle: React.CSSProperties = {
  display: "flex",
  flex: "0 0 auto",
  justifyContent: "flex-end",
  minWidth: 42,
};

const artistPieceImageStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  objectFit: "cover",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  marginLeft: -8,
};

const artistPieceFallbackStyle: React.CSSProperties = {
  ...artistPieceImageStyle,
  display: "grid",
  placeItems: "center",
  color: "var(--jpgs-accent)",
  fontSize: 10,
};

const topArtistProofStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 13,
  lineHeight: 1.55,
};

const topArtistSourceStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 11,
  lineHeight: 1.45,
  fontFamily: "var(--font-geist-mono)",
  opacity: 0.78,
};

const tasteSignalGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(10px, 1.8vw, 12px)",
};

const walletSignalCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "16px 18px",
  background: "rgba(255,255,255,0.018)",
};

const walletSignalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const walletSignalTitleStyle: React.CSSProperties = {
  color: "var(--jpgs-text)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const walletSignalCountPillStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 999,
  padding: "4px 10px",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(238,235,229,0.72)",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const walletSignalExampleLineStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 13,
  lineHeight: 1.55,
  marginTop: 1,
  overflowWrap: "anywhere",
};

const walletSignalBarRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  marginTop: 4,
};

const walletSignalBarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};

const walletSignalNameStyle: React.CSSProperties = {
  minWidth: 0,
  color: "var(--jpgs-muted)",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const walletSignalStatStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  textAlign: "right",
};

const walletSignalBarTrackStyle: React.CSSProperties = {
  height: 4,
  borderRadius: 99,
  background: "rgba(255,255,255,0.07)",
  overflow: "hidden",
};

const walletSignalBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 99,
  background: "rgba(126,148,234,0.82)",
  transition: "width 0.3s ease",
};

const similarCollectorGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(10px, 1.8vw, 12px)",
};

const similarCollectorRevealButtonStyle: React.CSSProperties = {
  justifySelf: "start",
  marginTop: 12,
  border: "1px solid rgba(149,117,255,0.22)",
  borderRadius: 999,
  padding: "5px 10px 6px",
  background: "rgba(149,117,255,0.075)",
  color: "rgba(223,214,255,0.9)",
  font: "inherit",
  fontSize: 11,
  lineHeight: 1.1,
  cursor: "pointer",
};

const nearbyCollectorsLoadingTitleStyle: React.CSSProperties = {
  color: "rgb(240,237,230)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.35,
  marginBottom: 6,
};

const nearbyCollectorsLoadingBodyStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 13,
  lineHeight: 1.6,
  maxWidth: 520,
};


const similarCollectorAvatarFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  overflow: "hidden",
  color: "rgb(149,117,255)",
  fontSize: 16,
  fontWeight: 500,
};

const similarCollectorNameStyle: React.CSSProperties = {
  display: "-webkit-box",
  fontSize: 15,
  fontWeight: 650,
  lineHeight: 1.25,
  color: "rgb(240,237,230)",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
  textDecoration: "none",
  minWidth: 0,
};

const similarCollectorIdentityStyle: React.CSSProperties = {
  color: "rgba(168,164,157,0.42)",
  fontSize: 10,
  lineHeight: 1.35,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "6px 14px",
  alignItems: "baseline",
  flexWrap: "wrap",
  marginBottom: 16,
};

const sectionHeadingDetailStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
  lineHeight: 1.4,
  flex: "0 1 auto",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--jpgs-accent)",
  marginBottom: 10,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 400,
  lineHeight: 1.25,
  marginBottom: 8,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 14,
  lineHeight: 1.65,
};

const imageFallbackStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "rgba(149,117,255,0.14)",
  color: "var(--jpgs-accent)",
  fontSize: 13,
};
