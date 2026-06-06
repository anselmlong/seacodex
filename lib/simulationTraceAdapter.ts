import type {
  AgentOpinion,
  DashboardTrace,
  ListingParameters,
  ProductListing,
  PropagationTick,
  SocialEdge,
  SocialNode,
  SimulationSettings
} from "./types";
import {
  buildPlatformRecommendations,
  buildRecommendations,
  createDashboardTrace,
  projectDemographics
} from "./simulationProjection";
import { defaultParameters, defaultProduct } from "./productModel";
import { singaporeSegments } from "./singaporeSegments";

type RawRecord = Record<string, unknown>;

type RawStepEvent = RawRecord;

type RawStep = RawRecord & {
  tick?: unknown;
  events?: unknown;
  state_counts?: unknown;
  node_states?: unknown;
  metrics?: unknown;
};

type RawTrace = RawRecord & {
  trace_id?: unknown;
  campaign?: unknown;
  communities?: unknown;
  nodes?: unknown;
  edges?: unknown;
  ticks?: unknown;
  steps?: unknown;
  tick_count?: unknown;
  graph?: unknown;
  campaign_id?: unknown;
  params?: unknown;
};

type DashboardNodeState = "unexposed" | "aware" | "interested" | "resistant" | "advocate";
type NormalizedStateCounts = {
  unexposed: number;
  exposed: number;
  adopted: number;
  resistant: number;
};

type ParsedMap = Record<string, unknown>;

const COMMUNITY_SEGMENT_MAP: Readonly<Record<string, string>> = {
  family: "parents-family",
  workplace: "young-professionals",
  fandom: "category-enthusiasts",
  reseller: "live-resellers",
  school_university: "gen-z-students"
};

const percentClamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const ratioClamp01 = (value: number) => Math.max(0, Math.min(1, value));
const titleCase = (value: string) =>
  value
    .toString()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const asObject = (value: unknown): ParsedMap | null => (value && typeof value === "object" ? (value as ParsedMap) : null);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length ? value.trim() : undefined;
const asNodeId = (value: unknown): string | undefined =>
  asString(value) ?? (typeof value === "number" && Number.isFinite(value) ? `${value}` : undefined);
const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
};
const hasAnyKeys = (value: unknown) => {
  const object = asObject(value);
  return Boolean(object && Object.keys(object).length);
};

const normalizeNodeState = (stateValue: unknown): DashboardNodeState => {
  const raw = asString(stateValue)?.toLowerCase();
  if (!raw) return "unexposed";
  if (raw === "unexposed") return "unexposed";
  if (raw === "aware" || raw === "exposed") return "aware";
  if (raw === "interested" || raw === "adopted" || raw === "reshare") return "interested";
  if (raw === "resistant" || raw === "resist") return "resistant";
  if (raw === "advocate" || raw === "champion") return "advocate";
  return "unexposed";
};

const normalizeEventActionToState = (action: unknown): DashboardNodeState | null => {
  const normalized = asString(action)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "expose" || normalized === "exposure") return "aware";
  if (normalized === "adopt" || normalized === "adoption" || normalized === "adopted") return "interested";
  if (normalized === "reshare") return "interested";
  if (normalized === "mutate" || normalized === "mutation") return "interested";
  if (normalized === "resist" || normalized === "resistance") return "resistant";
  return null;
};

const normalizeStepEventMessage = (event: RawStepEvent) =>
  asString(event.message_variant) ??
  asString(event.message) ??
  asString(event.messageText) ??
  asString(event.reasoning) ??
  asString(event.notes) ??
  asString(event.mutation_rule) ??
  (asString(event.mutation_applied) ? "Message mutation observed" : undefined);

const normalizeEventNodeId = (event: RawStepEvent): string | undefined => {
  const direct =
    asNodeId(event.node_id) ||
    asNodeId(event.target) ||
    asNodeId(event.source) ||
    asNodeId(event.mutation_id) ||
    asNodeId(event.source_node_id);
  if (!direct) return undefined;
  return direct;
};

const normalizeEventReason = (event: RawStepEvent) =>
  asString(event.reasoning) ??
  asString(event.notes) ??
  asString(event.outcome) ??
  asString(event.notes_text) ??
  (asString(event.mutation_rule) ? `Event behavior changed: ${asString(event.mutation_rule)}` : undefined);

const clampWeight = (weight: unknown, fallback: number) =>
  ratioClamp01(asNumber(weight, fallback));

const inferCampaignLabel = (value: unknown): string => {
  const text = asString(value);
  return text ? `${text}` : "Market campaign";
};

const buildCampaignProduct = (campaign: RawRecord | null): ProductListing => {
  const campaignName = inferCampaignLabel(campaign?.name);
  return {
    ...defaultProduct,
    name: campaignName,
    headline: asString(campaign?.initial_message) ?? asString(campaign?.description) ?? defaultProduct.headline,
    description: asString(campaign?.description) ?? defaultProduct.description,
    category: asString(campaign?.industry) ?? asString(campaign?.category) ?? defaultProduct.category
  };
};

const readCommunityMap = (communitiesInput: unknown): Map<string, string> => {
  const communityMap = new Map<string, string>();
  for (const item of asArray(communitiesInput)) {
    if (typeof item === "string") {
      const raw = item.trim();
      if (raw) {
        communityMap.set(raw, titleCase(raw));
      }
      continue;
    }

    const itemObject = asObject(item);
    if (!itemObject) continue;
    const id = asString(itemObject.id);
    if (!id) continue;
    communityMap.set(id, asString(itemObject.label) ?? titleCase(id));
  }

  return communityMap;
};

const nodeLabelFromCampaign = (communityId: string, index: number) =>
  `${titleCase(communityId || "community")} node ${index + 1}`;

const initialsFromText = (value: string) => {
  const cleaned = value.replace(/[^a-z0-9]/gi, " ").trim();
  const pieces = cleaned.length ? cleaned.split(/\s+/) : [value];
  const first = (pieces[0] ?? "").charAt(0).toUpperCase();
  const second = (pieces[1] ?? "").charAt(0).toUpperCase();
  return `${first}${second}`.padEnd(2, "X").slice(0, 2);
};

const makeSocialNode = (node: RawRecord | null, index: number, communityLabelMap: Map<string, string>): SocialNode => {
  const id = asNodeId(node?.id) ?? asNodeId(node?.persona_id) ?? asNodeId(node?.node_id) ?? `n${index + 1}`;
  const rawCommunity = asString(node?.community) ?? asString(node?.community_id) ?? "community_unknown";
  const segmentId = COMMUNITY_SEGMENT_MAP[rawCommunity] || "heartland-value";
  const rawState = normalizeNodeState(node?.state);
  const label = asString(node?.label) ?? nodeLabelFromCampaign(rawCommunity, index);
  const stateBoost = rawState === "resistant" ? 0.1 : rawState === "aware" ? 0.2 : rawState === "interested" ? 0.35 : 0.25;
  const influence = ratioClamp01(stateBoost + ((index % 17) / 100));
  const communityLabel = communityLabelMap.get(rawCommunity) ?? titleCase(rawCommunity);
  return {
    id,
    segmentId,
    label,
    avatarInitials: initialsFromText(label),
    persona: `${communityLabel} participant`,
    channel: `${communityLabel} channel`,
    influence,
    personaDisposition: rawState === "resistant" ? "adversarial" : undefined
  };
};

const makeSocialEdge = (edge: RawRecord | null): SocialEdge | null => {
  const source = asNodeId(edge?.source) ?? asNodeId(edge?.source_id) ?? asNodeId(edge?.source_node);
  const target = asNodeId(edge?.target) ?? asNodeId(edge?.target_id) ?? asNodeId(edge?.target_node);
  if (!source || !target) return null;
  return {
    source,
    target,
    strength: Number((clampWeight(edge?.weight, 0.34) * 100).toFixed(2))
  };
};

const toOpinion = (node: SocialNode, state: DashboardNodeState, message: string, reason: string): AgentOpinion => {
  const isResistant = state === "resistant";
  const isActive = state !== "unexposed";
  const confidence = percentClamp(
    (isResistant ? 82 : isActive ? 58 : 22) + Math.round(node.influence * 22) + (state === "aware" ? 12 : 0)
  );
  const objections = isResistant
    ? [
        "Proof appears weak or unverified.",
        "Tone is moving too fast for trust.",
        "Needs stronger segment-specific framing."
      ]
    : [
        "May need clearer practical value.",
        "Trust rises with stronger platform-specific proof.",
        "Watch for message fatigue at higher urgency."
      ];

  return {
    stance: isResistant
      ? "skeptical"
      : state === "aware"
        ? "curious"
        : state === "interested"
          ? "convinced"
          : "unaware",
    confidence,
    summary: message ? `${node.label}: ${message}` : `${node.label} is currently ${state}.`,
    reasons: [reason || `${node.channel} signal is present.`, ...objections.slice(0, 2)],
    objection: isResistant ? "High proof bar required to change this state." : "Need stronger message reinforcement.",
    nextAction: isResistant
      ? "Hold until stronger claims and proof are shared."
      : state === "aware"
        ? "Seek one trusted source and then resurface key price details."
        : state === "interested"
          ? "Reinforce with one practical conversion example."
          : "Remain exposed and monitor sentiment drift."
  };
};

const toAbsoluteCount = (value: unknown, totalNodes: number): number => {
  const raw = asNumber(value, 0);
  if (!Number.isFinite(raw) || raw < 0 || totalNodes <= 0) return 0;

  if (raw <= 1) {
    return Math.round(raw * totalNodes);
  }

  if (raw <= totalNodes) {
    return Math.round(raw);
  }

  if (raw <= 100) {
    return Math.round((raw / 100) * totalNodes);
  }

  return Math.round(raw);
};

const normalizeStateCountsFromStep = (countsInput: unknown, totalNodes: number): NormalizedStateCounts => {
  if (!hasAnyKeys(countsInput)) {
    return { unexposed: 0, exposed: 0, adopted: 0, resistant: 0 };
  }
  const counts = countsInput as ParsedMap;
  return {
    unexposed: toAbsoluteCount(counts.unexposed ?? counts.unexposed_count, totalNodes),
    exposed: toAbsoluteCount(counts.exposed ?? counts.exposed_count, totalNodes),
    adopted: toAbsoluteCount(counts.adopted ?? counts.adopted_count, totalNodes),
    resistant: toAbsoluteCount(counts.resistant ?? counts.resistant_count, totalNodes)
  };
};

const countNodeStates = (nodeStates: Record<string, DashboardNodeState>) => {
  const counts: NormalizedStateCounts = { unexposed: 0, exposed: 0, adopted: 0, resistant: 0 };
  for (const state of Object.values(nodeStates)) {
    if (state === "unexposed") counts.unexposed += 1;
    else if (state === "aware") counts.exposed += 1;
    else if (state === "advocate" || state === "interested") counts.adopted += 1;
    else if (state === "resistant") counts.resistant += 1;
  }
  return counts;
};

const mergeCounts = (primary: NormalizedStateCounts, fallback: NormalizedStateCounts): NormalizedStateCounts => {
  const total = primary.unexposed + primary.exposed + primary.adopted + primary.resistant;
  if (total === 0) return fallback;

  return {
    unexposed: Math.max(0, primary.unexposed || 0),
    exposed: Math.max(0, primary.exposed || 0),
    adopted: Math.max(0, primary.adopted || 0),
    resistant: Math.max(0, primary.resistant || 0)
  };
};

const extractBacklash = (metrics: ParsedMap, stateCounts: NormalizedStateCounts, stateTotal: number): number => {
  const raw = asNumber(metrics.backlash_risk ?? metrics.backlashRisk ?? metrics.backlash, Number.NaN);
  if (Number.isFinite(raw)) {
    return percentClamp(raw > 1 ? raw : raw * 100);
  }

  if (stateTotal <= 0) return 0;
  return percentClamp((stateCounts.resistant / stateTotal) * 100);
};

const buildFallbackTick = (nodes: SocialNode[], activeNodes: Record<string, DashboardNodeState>): PropagationTick => {
  const counts = countNodeStates(activeNodes);
  const total = Object.keys(activeNodes).length || 1;
  return {
    tick: 0,
    activeNodeIds: Object.entries(activeNodes)
      .filter(([, state]) => state !== "unexposed")
      .map(([nodeId]) => nodeId),
    nodeStates: activeNodes,
    messageVariants: {},
    agentOpinions: Object.fromEntries(
      Object.entries(activeNodes)
        .filter(([, state]) => state !== "unexposed")
        .map(([nodeId]) => [
          nodeId,
          {
            stance: "unaware",
            confidence: percentClamp(28),
            summary: `${nodeId} has not changed state yet.`,
            reasons: ["No direct event has reached this state yet."],
            objection: "Insufficient visibility in current graph snapshot.",
            nextAction: "Wait for more exposures before concluding the sentiment."
          }
        ])
    ),
    chatterVolume: 0,
    backlashRisk: percentClamp((counts.resistant / total) * 100),
    adoptionRate: percentClamp((counts.adopted / total) * 100),
    resistanceRate: percentClamp((counts.resistant / total) * 100),
    adversarialRate: percentClamp((counts.resistant / total) * 100)
  };
};

const convertStepsToTicks = (steps: RawStep[], nodes: SocialNode[], totalNodes: number): PropagationTick[] => {
  const orderedSteps = [...steps].sort((a, b) => asNumber(a.tick, 0) - asNumber(b.tick, 0));
  const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
  const nodeSet = new Set(nodes.map((node) => node.id));

  const baseNodeStates: Record<string, DashboardNodeState> = {};
  for (const node of nodes) {
    baseNodeStates[node.id] = "unexposed";
  }

  let currentStates = { ...baseNodeStates };
  const latestMessages: Record<string, string> = {};
  const latestReasoning: Record<string, string> = {};
  const normalizedTicks: PropagationTick[] = [];

  for (const step of orderedSteps) {
    const stepEvents = asArray(step.events);
    const nextStates = { ...currentStates };

    const stateByNode = asObject(step.node_states) ?? {};
    for (const [nodeId, rawState] of Object.entries(stateByNode)) {
      if (!nodeSet.has(nodeId)) continue;
      nextStates[nodeId] = normalizeNodeState(rawState);
    }

    for (const rawEvent of stepEvents) {
      const event = asObject(rawEvent);
      if (!event) continue;

      const nodeId = normalizeEventNodeId(event);
      if (!nodeId || !nodeSet.has(nodeId)) continue;

      const updatedState = normalizeEventActionToState(event.action ?? event.event_type);
      if (updatedState) {
        nextStates[nodeId] = updatedState;
      }

      const message = normalizeStepEventMessage(event);
      if (message) {
        latestMessages[nodeId] = message;
      }

      const reason = normalizeEventReason(event);
      if (reason) {
        latestReasoning[nodeId] = reason;
      }
    }

    currentStates = nextStates;
    const explicitCounts = normalizeStateCountsFromStep(step.state_counts, totalNodes);
    const stateCounts = mergeCounts(explicitCounts, countNodeStates(currentStates));

    const total = Math.max(1, stateCounts.unexposed + stateCounts.exposed + stateCounts.adopted + stateCounts.resistant);
    const stateAdopted = stateCounts.adopted;
    const stateResistant = stateCounts.resistant;
    const stateExposed = stateCounts.exposed;

    const activeNodeIds = Object.entries(currentStates)
      .filter(([, state]) => state !== "unexposed")
      .map(([nodeId]) => nodeId);

    const messageVariants: Record<string, string> = {};
    const agentOpinions: Record<string, AgentOpinion> = {};
    for (const nodeId of activeNodeIds) {
      const node = nodeIndex.get(nodeId);
      if (!node) continue;
      const state = currentStates[nodeId] ?? "unexposed";
      const message = latestMessages[nodeId] ?? "";
      const reason = latestReasoning[nodeId] ?? `${node.channel} is carrying the current campaign update.`;
      if (message) {
        messageVariants[nodeId] = message;
      }
      agentOpinions[nodeId] = toOpinion(node, state, message, reason);
    }

    const chatterVolume = percentClamp(((stateAdopted + stateResistant + stateExposed) / total) * 100);
    const metrics = asObject(step.metrics) ?? {};

    normalizedTicks.push({
      tick: asNumber(step.tick, normalizedTicks.length),
      activeNodeIds,
      nodeStates: { ...currentStates },
      messageVariants,
      agentOpinions,
      chatterVolume,
      backlashRisk: extractBacklash(metrics, stateCounts, total),
      adoptionRate: percentClamp((stateAdopted / total) * 100),
      resistanceRate: percentClamp((stateResistant / total) * 100),
      adversarialRate: percentClamp((stateResistant / total) * 100)
    });
  }

  if (normalizedTicks.length > 0) {
    return normalizedTicks;
  }

  return [
    buildFallbackTick(nodes, {
      ...baseNodeStates
    })
  ];
};

const buildTraceFromStandardTicks = (sourceTrace: RawTrace): DashboardTrace | null => {
  const nodesInput = asArray(sourceTrace.nodes);
  const edgesInput = asArray(sourceTrace.edges);
  const ticksInput = asArray(sourceTrace.ticks);

  if (!nodesInput.length || !ticksInput.length) {
    return null;
  }

  const campaign = asObject(sourceTrace.campaign);
  const communities = asArray(sourceTrace.communities);
  const communityLabelMap = readCommunityMap(communities);
  const nodes = nodesInput.map((node, index) => makeSocialNode(asObject(node), index, communityLabelMap));
  const edges = edgesInput
    .map((edge) => makeSocialEdge(asObject(edge)))
    .filter((edge): edge is SocialEdge => Boolean(edge));

  const totalNodes = nodes.length;
  const normalizedSteps: RawStep[] = ticksInput
    .map((entry, fallbackTick) => {
      const step = asObject(entry);
      if (!step) return null;
      return {
        tick: step.tick,
        metrics: step.metrics,
        events: step.events,
        state_counts: step.state_counts,
        node_states: asObject(step.node_states)
      } as RawStep;
    })
    .filter((entry): entry is RawStep => entry !== null)
    .sort((a, b) => asNumber(a.tick, 0) - asNumber(b.tick, 0));

  const rawTicks = convertStepsToTicks(normalizedSteps, nodes, totalNodes);
  const product = buildCampaignProduct(campaign ?? null);
  const parameters = { ...defaultParameters };
  const projections = projectDemographics(product, parameters);

  return {
    product,
    parameters,
    segments: singaporeSegments,
    nodes,
    edges,
    ticks: rawTicks,
    platformRecommendations: buildPlatformRecommendations(product, parameters, projections),
    recommendations: buildRecommendations(product, parameters, projections)
  };
};

const buildTraceFromLayer6Steps = (sourceTrace: RawTrace): DashboardTrace | null => {
  const graph = asObject(sourceTrace.graph);
  if (!graph) return null;

  const graphNodesInput = asArray(graph.nodes);
  const graphEdgesInput = asArray(graph.edges);
  const stepRows = asArray(sourceTrace.steps);
  const communities = asArray(graph.communities);

  if (!graphNodesInput.length || !stepRows.length) {
    return null;
  }

  const communityLabelMap = readCommunityMap(communities);
  const nodes = graphNodesInput.map((node, index) => makeSocialNode(asObject(node), index, communityLabelMap));
  const edges = graphEdgesInput
    .map((edge) => makeSocialEdge(asObject(edge)))
    .filter((edge): edge is SocialEdge => Boolean(edge));

  const totalNodes = nodes.length;
  const campaign = asObject(sourceTrace.campaign);
  const normalizedSteps = stepRows
    .map((step, fallbackTick) => {
      const stepObject = asObject(step);
      if (!stepObject) return null;
      return {
        tick: stepObject.tick ?? fallbackTick,
        metrics: asObject(stepObject.metrics) ?? {},
        events: stepObject.events,
        state_counts: stepObject.state_counts,
        node_states: stepObject.node_states
      } as RawStep;
    })
    .filter((entry): entry is RawStep => entry !== null)
    .sort((a, b) => asNumber(a.tick, 0) - asNumber(b.tick, 0));

  const rawTicks = convertStepsToTicks(normalizedSteps, nodes, totalNodes);
  const campaignName = inferCampaignLabel(campaign?.name ?? campaign?.campaign_name);
  const product = {
    ...buildCampaignProduct(campaign ?? null),
    name: campaignName,
    headline: asString(campaign?.name) ?? asString(campaign?.campaign_name) ?? asString(campaign?.description) ?? defaultProduct.headline,
    description: asString(campaign?.description) ?? defaultProduct.description
  };
  const parameters = { ...defaultParameters };
  const projections = projectDemographics(product, parameters);

  return {
    product,
    parameters,
    segments: singaporeSegments,
    nodes,
    edges,
    ticks: rawTicks,
    platformRecommendations: buildPlatformRecommendations(product, parameters, projections),
    recommendations: buildRecommendations(product, parameters, projections)
  };
};

const recomputeRecommendations = (product: ProductListing, parameters: ListingParameters) => {
  const projections = projectDemographics(product, parameters);
  return {
    platformRecommendations: buildPlatformRecommendations(product, parameters, projections),
    recommendations: buildRecommendations(product, parameters, projections)
  };
};

export function normalizeSimulationTrace(rawTrace: unknown): DashboardTrace | null {
  const trace = asObject(rawTrace);
  if (!trace) return null;

  const hasLayer6Shape = Array.isArray(trace.steps) && asObject(trace.graph);
  if (hasLayer6Shape) {
    return buildTraceFromLayer6Steps(trace);
  }

  if (Array.isArray(trace.ticks) && Array.isArray(trace.nodes) && Array.isArray(trace.edges)) {
    return buildTraceFromStandardTicks(trace);
  }

  return null;
}

export function applyDashboardControlsToTrace(
  source: DashboardTrace,
  product: ProductListing,
  parameters: ListingParameters,
  settings: SimulationSettings
): DashboardTrace {
  const safeSettings: SimulationSettings = {
    tickCount: Math.max(1, Math.min(settings.tickCount, source.ticks.length)),
    agentCount: Math.max(1, Math.min(settings.agentCount, source.nodes.length))
  };

  const selectedNodeIds = new Set(source.nodes.slice(0, safeSettings.agentCount).map((node) => node.id));
  const filteredNodes = source.nodes.filter((node) => selectedNodeIds.has(node.id));
  const filteredEdges = source.edges.filter((edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target));
  const filteredTicks: PropagationTick[] = source.ticks.slice(0, safeSettings.tickCount).map((tick) => {
    const filteredNodeStates: Record<string, DashboardNodeState> = {};
    const filteredMessages: Record<string, string> = {};
    const filteredOpinions: Record<string, AgentOpinion> = {};

    for (const nodeId of selectedNodeIds) {
      const state = tick.nodeStates[nodeId];
      if (state) filteredNodeStates[nodeId] = state;
      if (tick.messageVariants[nodeId]) filteredMessages[nodeId] = tick.messageVariants[nodeId];
      if (tick.agentOpinions[nodeId]) filteredOpinions[nodeId] = tick.agentOpinions[nodeId];
    }

    return {
      ...tick,
      activeNodeIds: tick.activeNodeIds.filter((nodeId) => selectedNodeIds.has(nodeId)),
      nodeStates: filteredNodeStates,
      messageVariants: filteredMessages,
      agentOpinions: filteredOpinions
    };
  });

  return {
    ...source,
    product,
    parameters,
    nodes: filteredNodes,
    edges: filteredEdges,
    ticks: filteredTicks,
    segments: singaporeSegments,
    ...recomputeRecommendations(product, parameters)
  };
}

export const buildFallbackTrace = (): DashboardTrace =>
  createDashboardTrace(defaultProduct, defaultParameters, {
    tickCount: 10,
    agentCount: Math.min(24, 24)
  });
