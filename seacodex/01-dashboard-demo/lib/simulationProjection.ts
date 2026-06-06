import { singaporeEdges, singaporeNodes, singaporeSegments } from "./singaporeSegments";
import { clamp } from "./productModel";
import type {
  AgentOpinion,
  DashboardTrace,
  DemographicProjection,
  ListingParameters,
  NodeState,
  PlatformMarketingRecommendation,
  ProductListing,
  PropagationTick,
  Recommendation,
  SingaporeSegment
} from "./types";

const parameterScore = (segment: SingaporeSegment, product: ProductListing, params: ListingParameters) => {
  if (segment.preferredAngle === "discountPercent") return product.discountPercent;
  if (segment.preferredAngle === "freeShipping") return params.freeShipping ? 100 : 0;
  return params[segment.preferredAngle];
};

const sentimentFor = (salesIndex: number, backlash: number) => {
  if (backlash > 62) return "negative";
  if (salesIndex > 68 && backlash < 48) return "positive";
  return "mixed";
};

const tweakFor = (segment: SingaporeSegment, product: ProductListing, params: ListingParameters) => {
  if (segment.id === "young-professionals" && params.premiumPositioning < 52) {
    return "Add proof of convenience: delivery timing, warranty, and verified review snippets.";
  }
  if (segment.id === "live-resellers" && params.creatorAngle < 58) {
    return "Frame a creator bundle or repeat-purchase angle instead of pure consumer discount.";
  }
  if (segment.id === "heartland-value" && product.discountPercent < 34) {
    return "Show final price after vouchers and shipping above the fold.";
  }
  if (segment.id === "parents-family" && params.familyBulkBuyAngle < 58) {
    return "Lead with household usefulness and bundle savings.";
  }
  if (params.urgency > 76) {
    return "Reduce countdown pressure; keep urgency but make the value proof clearer.";
  }
  return `Lean into ${segment.trigger}.`;
};

export function projectDemographics(product: ProductListing, params: ListingParameters): DemographicProjection[] {
  return singaporeSegments.map((segment) => {
    const fit = parameterScore(segment, product, params);
    const shippingBoost = params.freeShipping ? 7 : -5;
    const discountBoost = product.discountPercent * segment.priceSensitivity * 0.32;
    const urgencyPenalty = Math.max(0, params.urgency - 68) * (segment.priceSensitivity > 0.7 ? 0.16 : 0.28);
    const premiumMismatch =
      Math.max(0, params.premiumPositioning - params.budgetPositioning) * segment.priceSensitivity * 0.12;
    const rawInterest =
      segment.baselineInterest * 100 + fit * 0.22 + discountBoost + shippingBoost - urgencyPenalty - premiumMismatch;
    const projectedSalesIndex = clamp(rawInterest);
    const backlash = clamp(
      28 + urgencyPenalty * 1.7 + (segment.id === "live-resellers" ? 20 - params.creatorAngle * 0.18 : 0)
    );

    return {
      segmentId: segment.id,
      segmentLabel: segment.label,
      projectedSalesIndex,
      conversionLikelihood: clamp(projectedSalesIndex * 0.72 + fit * 0.16 + (params.freeShipping ? 5 : -4)),
      priceSensitivity: clamp(segment.priceSensitivity * 100),
      chatterSentiment: sentimentFor(projectedSalesIndex, backlash),
      mainTrigger: segment.trigger,
      mainObjection: segment.objection,
      recommendedTweak: tweakFor(segment, product, params)
    };
  });
}

const messageForSegment = (segmentId: string, product: ProductListing, params: ListingParameters) => {
  const base = product.name.replace("Shopee 11.11 ", "");
  const messages: Record<string, string> = {
    "gen-z-students": `${base} is worth it if the voucher stack really lands under $${Math.max(
      1,
      product.priceSgd - 18
    )}.`,
    "young-professionals": `${base} works if delivery is fast and reviews prove it is not a gimmick.`,
    "parents-family": `${base} makes sense for family snacks and small-kitchen dinners.`,
    "heartland-value": `${base}: compare final checkout price after vouchers and free shipping.`,
    "live-resellers":
      params.creatorAngle > 58
        ? `${base} could move in live bundles if margins are protected.`
        : `${base} is okay for consumers, but reseller margins look thin.`,
    "category-enthusiasts": `${base} needs creator proof, specs, and real before-after clips.`
  };
  return messages[segmentId] ?? product.headline;
};

const opinionForNode = (
  segment: SingaporeSegment,
  product: ProductListing,
  params: ListingParameters,
  projection: DemographicProjection | undefined,
  state: NodeState,
  message: string
): AgentOpinion => {
  const confidence = projection
    ? clamp(projection.projectedSalesIndex * 0.58 + projection.conversionLikelihood * 0.32 + (state === "advocate" ? 14 : 0))
    : 24;
  const stance: AgentOpinion["stance"] =
    state === "unexposed"
      ? "unaware"
      : state === "resistant"
        ? "skeptical"
        : state === "advocate"
          ? "advocating"
          : confidence > 68
            ? "convinced"
            : "curious";
  const priceRead =
    product.discountPercent >= 34 || params.freeShipping
      ? "The final checkout price feels worth comparing."
      : "The price needs a clearer voucher or shipping story.";
  const proofRead =
    params.creatorAngle > 58 || params.premiumPositioning > 52
      ? "Creator proof and quality cues make the listing easier to trust."
      : "They still want stronger proof from reviews, demos, or creators.";
  const urgencyRead =
    params.urgency > 76
      ? "Countdown pressure is making them question whether the deal is real."
      : "Urgency is present without feeling like pressure.";

  return {
    stance,
    confidence,
    summary: message || `${segment.label} has not formed a product opinion yet.`,
    reasons: [segment.trigger, priceRead, proofRead],
    objection: projection?.mainObjection ?? segment.objection,
    nextAction: state === "unexposed" ? "Wait for a trusted contact to mention it." : urgencyRead
  };
};

export function buildPropagationTicks(
  product: ProductListing,
  params: ListingParameters,
  projections: DemographicProjection[]
): PropagationTick[] {
  const bySegment = new Map(projections.map((projection) => [projection.segmentId, projection]));
  const ticks: PropagationTick[] = [];

  for (let tick = 0; tick < 10; tick += 1) {
    const nodeStates: Record<string, NodeState> = {};
    const messageVariants: Record<string, string> = {};
    const agentOpinions: Record<string, AgentOpinion> = {};
    const activeNodeIds: string[] = [];

    singaporeNodes.forEach((node, index) => {
      const projection = bySegment.get(node.segmentId);
      const segment = singaporeSegments.find((entry) => entry.id === node.segmentId);
      const activationTick = Math.floor(index * 0.72);
      const isActive = tick >= activationTick;
      const isHot = projection ? projection.projectedSalesIndex > 70 : false;
      const isResistant = projection ? projection.chatterSentiment === "negative" : false;
      const state: NodeState = !isActive
        ? "unexposed"
        : isResistant && tick > activationTick + 1
          ? "resistant"
          : isHot && tick > activationTick + 2
            ? "advocate"
            : tick > activationTick
              ? "interested"
              : "aware";

      nodeStates[node.id] = state;
      if (isActive) activeNodeIds.push(node.id);
      if (isActive) messageVariants[node.id] = messageForSegment(node.segmentId, product, params);
      if (segment) {
        agentOpinions[node.id] = opinionForNode(
          segment,
          product,
          params,
          projection,
          state,
          messageVariants[node.id] ?? ""
        );
      }
    });

    const avgSales = projections.reduce((sum, projection) => sum + projection.projectedSalesIndex, 0) / projections.length;
    const resellerRisk = bySegment.get("live-resellers")?.chatterSentiment === "negative" ? 20 : 0;
    ticks.push({
      tick,
      activeNodeIds,
      nodeStates,
      messageVariants,
      agentOpinions,
      chatterVolume: clamp(activeNodeIds.length * 7 + avgSales * 0.38),
      backlashRisk: clamp(params.urgency * 0.32 + resellerRisk + Math.max(0, 32 - product.discountPercent) * 0.7)
    });
  }

  return ticks;
}

export function buildRecommendations(
  product: ProductListing,
  params: ListingParameters,
  projections: DemographicProjection[]
): Recommendation[] {
  const strongest = [...projections].sort((a, b) => b.projectedSalesIndex - a.projectedSalesIndex)[0];
  const weakest = [...projections].sort((a, b) => a.projectedSalesIndex - b.projectedSalesIndex)[0];
  const reseller = projections.find((projection) => projection.segmentId === "live-resellers");

  return [
    {
      title: `Lead with ${strongest.segmentLabel.toLowerCase()}`,
      detail: strongest.recommendedTweak,
      severity: "opportunity"
    },
    {
      title: `Repair ${weakest.segmentLabel.toLowerCase()} objections`,
      detail: weakest.mainObjection,
      severity: weakest.chatterSentiment === "negative" ? "risk" : "watch"
    },
    {
      title: params.urgency > 70 ? "Soften countdown pressure" : "Keep urgency controlled",
      detail:
        params.urgency > 70
          ? "The network starts debating whether the promo is real. Shift copy toward final price proof."
          : "Urgency is present without dominating the value story.",
      severity: params.urgency > 70 ? "risk" : "opportunity"
    },
    {
      title: "Protect the reseller flank",
      detail:
        reseller?.chatterSentiment === "negative"
          ? "Reseller chatter can sour the wider network. Avoid margin language unless creator bundles are credible."
          : `${product.name} has enough creator context to keep reseller chatter from turning negative.`,
      severity: reseller?.chatterSentiment === "negative" ? "risk" : "watch"
    }
  ];
}

const bestProjectionFor = (
  projections: DemographicProjection[],
  segmentIds: string[]
): DemographicProjection => {
  const candidates = projections.filter((projection) => segmentIds.includes(projection.segmentId));
  return [...(candidates.length > 0 ? candidates : projections)].sort(
    (a, b) => b.projectedSalesIndex - a.projectedSalesIndex
  )[0];
};

export function buildPlatformRecommendations(
  product: ProductListing,
  params: ListingParameters,
  projections: DemographicProjection[]
): PlatformMarketingRecommendation[] {
  const discountStrength = clamp(product.discountPercent * 1.25 + params.voucherEmphasis * 0.45 + (params.freeShipping ? 12 : -4));
  const creatorStrength = clamp(params.creatorAngle * 0.68 + params.premiumPositioning * 0.22 + product.discountPercent * 0.12);
  const familyStrength = clamp(params.familyBulkBuyAngle * 0.72 + discountStrength * 0.2 + (params.freeShipping ? 8 : 0));
  const proofStrength = clamp(params.premiumPositioning * 0.48 + params.creatorAngle * 0.3 + (params.urgency > 72 ? -8 : 6));
  const urgencyStrength = clamp(params.urgency * 0.42 + discountStrength * 0.34 + params.voucherEmphasis * 0.18);
  const productShortName = product.name.replace("Shopee 11.11 ", "");

  const shopeeBest = bestProjectionFor(projections, ["heartland-value", "parents-family"]);
  const tiktokBest = bestProjectionFor(projections, ["category-enthusiasts", "gen-z-students", "live-resellers"]);
  const instagramBest = bestProjectionFor(projections, ["young-professionals", "category-enthusiasts"]);
  const telegramBest = bestProjectionFor(projections, ["gen-z-students", "heartland-value"]);
  const facebookBest = bestProjectionFor(projections, ["parents-family", "heartland-value"]);
  const youtubeBest = bestProjectionFor(projections, ["category-enthusiasts", "young-professionals"]);

  const recommendations: PlatformMarketingRecommendation[] = [
    {
      platform: "Shopee",
      score: clamp(shopeeBest.projectedSalesIndex * 0.52 + discountStrength * 0.38 + (params.freeShipping ? 7 : 0)),
      bestSegmentId: shopeeBest.segmentId,
      bestSegmentLabel: shopeeBest.segmentLabel,
      marketingAngle: "Final checkout price and shipping proof",
      whyItWorks: `${productShortName} benefits when the deal is visible at the moment buyers compare listings.`,
      watchOut: "Avoid hiding vouchers below dense copy; price-sensitive shoppers need the net price first."
    },
    {
      platform: "TikTok Shop",
      score: clamp(tiktokBest.projectedSalesIndex * 0.46 + creatorStrength * 0.44 + params.urgency * 0.08),
      bestSegmentId: tiktokBest.segmentId,
      bestSegmentLabel: tiktokBest.segmentLabel,
      marketingAngle: "Creator demo with a fast reason to act",
      whyItWorks: "Short demos can turn curiosity into intent when the creator explains the use case quickly.",
      watchOut: "If creator proof is weak, high urgency reads like pressure instead of momentum."
    },
    {
      platform: "Instagram",
      score: clamp(instagramBest.projectedSalesIndex * 0.5 + proofStrength * 0.34 + params.premiumPositioning * 0.12),
      bestSegmentId: instagramBest.segmentId,
      bestSegmentLabel: instagramBest.segmentLabel,
      marketingAngle: "Visual proof, review snippets, and save-worthy use cases",
      whyItWorks: "The platform rewards product context that looks useful enough to share or save.",
      watchOut: "Pure discount posts underperform if quality cues and review proof are not visible."
    },
    {
      platform: "Telegram",
      score: clamp(telegramBest.projectedSalesIndex * 0.48 + urgencyStrength * 0.34 + discountStrength * 0.14),
      bestSegmentId: telegramBest.segmentId,
      bestSegmentLabel: telegramBest.segmentLabel,
      marketingAngle: "Deal alert with exact voucher stack",
      whyItWorks: "Group chats spread concise claims when the savings are easy to verify.",
      watchOut: "Overusing countdown language can trigger skepticism and forwarding without buying."
    },
    {
      platform: "Facebook Groups",
      score: clamp(facebookBest.projectedSalesIndex * 0.52 + familyStrength * 0.36 + proofStrength * 0.08),
      bestSegmentId: facebookBest.segmentId,
      bestSegmentLabel: facebookBest.segmentLabel,
      marketingAngle: "Household value and practical comparison",
      whyItWorks: "Family and neighbourhood buyers respond to usefulness, bundle value, and peer validation.",
      watchOut: "Flash-sale framing alone feels noisy; lead with why it solves a real household need."
    },
    {
      platform: "YouTube Shorts",
      score: clamp(youtubeBest.projectedSalesIndex * 0.48 + creatorStrength * 0.3 + proofStrength * 0.18),
      bestSegmentId: youtubeBest.segmentId,
      bestSegmentLabel: youtubeBest.segmentLabel,
      marketingAngle: "Before-after proof in one repeatable demo",
      whyItWorks: "A repeatable demo gives skeptical buyers enough evidence to search or compare later.",
      watchOut: "Weak opening claims lose attention before the product benefit is understood."
    }
  ];

  return recommendations.sort((a, b) => b.score - a.score);
}

export function createDashboardTrace(product: ProductListing, params: ListingParameters): DashboardTrace {
  const projections = projectDemographics(product, params);
  return {
    product,
    parameters: params,
    segments: singaporeSegments,
    nodes: singaporeNodes,
    edges: singaporeEdges,
    ticks: buildPropagationTicks(product, params, projections),
    platformRecommendations: buildPlatformRecommendations(product, params, projections),
    recommendations: buildRecommendations(product, params, projections)
  };
}
