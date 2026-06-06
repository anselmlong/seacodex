export type Sentiment = "positive" | "mixed" | "negative";

export type NodeState = "unexposed" | "aware" | "interested" | "resistant" | "advocate";

export type ProductListing = {
  name: string;
  category: string;
  priceSgd: number;
  discountPercent: number;
  imageUrl: string;
  shopeeUrl: string;
  headline: string;
  description: string;
};

export type ListingParameters = {
  freeShipping: boolean;
  voucherEmphasis: number;
  urgency: number;
  creatorAngle: number;
  familyBulkBuyAngle: number;
  budgetPositioning: number;
  premiumPositioning: number;
};

export type SingaporeSegment = {
  id: string;
  label: string;
  shortLabel: string;
  influence: number;
  priceSensitivity: number;
  preferredAngle: keyof ListingParameters | "discountPercent";
  baselineInterest: number;
  objection: string;
  trigger: string;
};

export type SocialNode = {
  id: string;
  segmentId: string;
  label: string;
  influence: number;
};

export type SocialEdge = {
  source: string;
  target: string;
  strength: number;
};

export type DemographicProjection = {
  segmentId: string;
  segmentLabel: string;
  projectedSalesIndex: number;
  conversionLikelihood: number;
  priceSensitivity: number;
  chatterSentiment: Sentiment;
  mainTrigger: string;
  mainObjection: string;
  recommendedTweak: string;
};

export type PropagationTick = {
  tick: number;
  activeNodeIds: string[];
  nodeStates: Record<string, NodeState>;
  messageVariants: Record<string, string>;
  chatterVolume: number;
  backlashRisk: number;
};

export type Recommendation = {
  title: string;
  detail: string;
  severity: "opportunity" | "watch" | "risk";
};

export type DashboardTrace = {
  product: ProductListing;
  parameters: ListingParameters;
  segments: SingaporeSegment[];
  nodes: SocialNode[];
  edges: SocialEdge[];
  ticks: PropagationTick[];
  recommendations: Recommendation[];
};
