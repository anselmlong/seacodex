window.SeaSimulationEngine = (() => {
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const round = (value, places = 2) => Number(value.toFixed(places));

  function runSimulation(input, swarm = window.PersonaSwarmData, layer6Trace = null) {
    const product = swarm.products[input.productId];
    const change = swarm.changes[input.changeId];
    const segment = swarm.segments[input.segmentId];
    const platformFit = swarm.platformAffinity[input.platform][input.segmentId] || 0.4;
    const productFit = product.fit[input.segmentId] || 0.4;
    const platformRisk = product.risk[input.platform] || 0.45;
    const community = segment.community;
    const relevantPersonas = swarm.personas.filter((persona) => persona.traits.segment === input.segmentId);
    const sharing = average(relevantPersonas.map((persona) => persona.sharing_tendency), 0.58);
    const sensitivity = average(relevantPersonas.map((persona) => persona.backlash_sensitivity), 0.55);

    const baseAdoption = clamp(productFit * 0.42 + platformFit * 0.3 + sharing * 0.16 + change.adoptionBoost);
    const backlashRisk = clamp(platformRisk * 0.42 + sensitivity * 0.34 + change.backlashDelta);
    const spread = clamp(platformFit * 0.42 + sharing * 0.28 + change.spreadBoost);
    const confidence = clamp(0.54 + Math.abs(baseAdoption - backlashRisk) * 0.35 + relevantPersonas.length * 0.03);
    const recommendation = baseAdoption > 0.64 && backlashRisk < 0.52 ? "target" : backlashRisk > 0.62 ? "avoid" : "test";

    let resultRecommendation = recommendation;
    let resultAdoptionLift = round((baseAdoption - 0.5) * 100, 1);
    let resultBacklashRisk = round(backlashRisk);
    let resultConfidence = round(confidence);
    let nodes = buildNodes(swarm, community, input.segmentId, baseAdoption, backlashRisk);
    let edges = buildEdges(nodes, swarm, input.platform, spread);
    let trace = buildTrace({ input, swarm, product, change, segment, nodes, edges, baseAdoption, backlashRisk, spread });
    let trend = trace.ticks.map((tick) => ({ tick: tick.tick, ...tick.metrics }));
    let network = { nodes, edges };
    let suggestions = buildSuggestions({ input, recommendation, product, change, platformRisk, backlashRisk, baseAdoption });
    const layer6 = layer6Trace?.steps?.length ? adaptLayer6Trace(layer6Trace, { input, swarm, product, change, segment }) : null;

    if (layer6) {
      resultRecommendation = layer6.recommendation;
      resultAdoptionLift = layer6.adoptionLift;
      resultBacklashRisk = layer6.backlashRisk;
      resultConfidence = layer6.confidence;
      trace = layer6.trace;
      trend = layer6.trend;
      network = layer6.network;
      suggestions = layer6.suggestions;
      nodes = network.nodes;
    }

    trace.analyst_summary = {
      top_segment: segment.label,
      recommended_action: resultRecommendation,
      winning_message_variant: winningMessage(input, product, change, segment),
      backlash_risk_score: resultBacklashRisk,
      supporting_node_ids: nodes.slice(0, 5).map((node) => node.id),
      confidence: resultConfidence,
      narrative: layer6?.summary.narrative || buildNarrative({ input, product, change, segment, recommendation: resultRecommendation, baseAdoption, backlashRisk: resultBacklashRisk }),
    };

    return {
      input,
      source: layer6 ? "layer6_ground_truth_trace" : "local_mock_trace",
      recommendation: resultRecommendation,
      adoptionLift: resultAdoptionLift,
      backlashRisk: resultBacklashRisk,
      confidence: resultConfidence,
      spread: round(spread),
      suggestions,
      trace,
      trend,
      network,
      layer6,
    };
  }

  function analyzeCreative(input, swarm = window.PersonaSwarmData, creative = {}) {
    const product = swarm.products[input.productId];
    const change = swarm.changes[input.changeId];
    const text = `${creative.name || ""} ${creative.type || ""} ${creative.text || ""}`.toLowerCase();
    const signals = extractCreativeSignals(text, creative);
    const segmentRows = Object.entries(swarm.segments).map(([segmentId, segment]) => {
      const personas = swarm.personas.filter((persona) => persona.traits.segment === segmentId);
      const sensitivity = average(personas.map((persona) => persona.backlash_sensitivity), 0.55);
      const sharing = average(personas.map((persona) => persona.sharing_tendency), 0.58);
      const productFit = product.fit[segmentId] || 0.4;
      const platformFit = swarm.platformAffinity[input.platform]?.[segmentId] || 0.4;
      const signalFit = signalFitForSegment(segmentId, signals);
      const adoptionPotential = clamp(productFit * 0.35 + platformFit * 0.24 + sharing * 0.14 + signalFit * 0.27);
      const backlashRisk = clamp(
        product.risk[input.platform] * 0.25 +
          sensitivity * 0.24 +
          signals.urgency * 0.18 +
          signals.riskLanguage * 0.18 -
          signals.proof * 0.12 -
          signals.clarity * 0.08
      );
      const sentiment = adoptionPotential > 0.66 && backlashRisk < 0.48 ? "positive" : backlashRisk > 0.58 ? "negative" : "mixed";
      return {
        segmentId,
        label: segment.label,
        count: segment.count,
        sentiment,
        adoptionPotential: round(adoptionPotential * 100, 0),
        backlashRisk: round(backlashRisk * 100, 0),
        behavior: behaviorForSegment(segmentId, sentiment, signals, product, change),
        feedback: feedbackForSegment(segmentId, sentiment, signals, product),
        recommendation: recommendationForSegment(segmentId, sentiment, signals, product),
      };
    });
    const top = [...segmentRows].sort((a, b) => b.adoptionPotential - a.adoptionPotential)[0];
    const risk = [...segmentRows].sort((a, b) => b.backlashRisk - a.backlashRisk)[0];

    return {
      summary: {
        name: creative.name || "Pasted proposal",
        type: creative.type || "text/plain",
        topSegment: top.label,
        riskSegment: risk.label,
        source: "local MiroFish-compatible swarm mock",
      },
      signals: Object.entries(signals)
        .filter(([, value]) => typeof value === "number")
        .map(([key, value]) => ({ key, label: labelSignal(key), score: round(value * 100, 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 7),
      demographics: segmentRows.sort((a, b) => b.adoptionPotential - a.adoptionPotential),
      mirofishPayload: {
        source: "02-simulation-engine-static-mock",
        layer_hint: "Layer 3 - MiroFish Interest Tuning (Swarm)",
        simulation_requirement: [
          `Evaluate how uploaded creative for ${product.label} may spread across ${input.platform}.`,
          `Break expected reactions down by demographic segment, adoption potential, backlash risk, and likely feedback.`,
          `Use ${change.label.toLowerCase()} as the proposed app/product change context.`,
        ].join(" "),
        document: {
          name: creative.name || "pasted-proposal",
          mime_type: creative.type || "text/plain",
          text_excerpt: (creative.text || "").slice(0, 1200),
          has_image: Boolean(creative.imageUrl),
        },
        simulation_context: {
          product: product.label,
          change: change.label,
          platform: input.platform,
          target_segment: swarm.segments[input.segmentId].label,
        },
        event_config: {
          initial_posts: [
            {
              platform: input.platform,
              content: (creative.text || winningMessage(input, product, change, swarm.segments[input.segmentId])).slice(0, 280),
              target_segment: input.segmentId,
            },
          ],
          hot_topics: product.signals,
          narrative_direction: `Measure adoption, objections, and peer influence for ${product.label} creative.`,
        },
        agent_seed_segments: segmentRows.map((row) => ({
          segment_id: row.segmentId,
          label: row.label,
          count: row.count,
          expected_sentiment: row.sentiment,
          adoption_potential: row.adoptionPotential,
          backlash_risk: row.backlashRisk,
        })),
      },
    };
  }

  function extractCreativeSignals(text, creative) {
    const score = (patterns) => clamp(patterns.reduce((sum, pattern) => sum + (text.includes(pattern) ? 0.24 : 0), 0));
    return {
      proof: score(["review", "verified", "warranty", "official", "proof", "guarantee", "authentic", "before-after", "spec"]),
      discount: score(["discount", "voucher", "sale", "save", "deal", "cashback", "free gift", "bundle"]),
      urgency: score(["limited", "last chance", "only today", "countdown", "hurry", "flash", "ending soon"]),
      creator: score(["creator", "influencer", "live", "host", "tiktok", "stream", "ugc"]),
      family: score(["family", "parents", "household", "kids", "bulk", "weekday", "home"]),
      shipping: score(["shipping", "delivery", "arrives", "same day", "priority", "parcel"]),
      clarity: clamp(0.25 + Math.min((creative.text || "").length / 900, 0.45) + (creative.imageUrl ? 0.18 : 0)),
      riskLanguage: score(["miracle", "guaranteed results", "cheapest ever", "no risk", "fake", "cure", "secret"]),
      image: creative.imageUrl ? 0.85 : 0,
    };
  }

  function signalFitForSegment(segmentId, signals) {
    const weights = {
      gen_z_deal_seekers: signals.discount * 0.34 + signals.creator * 0.26 + signals.image * 0.14 + signals.clarity * 0.12,
      working_parents: signals.family * 0.3 + signals.shipping * 0.26 + signals.proof * 0.18 + signals.discount * 0.12,
      electronics_skeptics: signals.proof * 0.42 + signals.clarity * 0.2 + signals.shipping * 0.12 - signals.urgency * 0.12,
      livestream_regulars: signals.creator * 0.38 + signals.image * 0.22 + signals.discount * 0.12 + signals.clarity * 0.1,
      platform_switchers: signals.discount * 0.22 + signals.proof * 0.22 + signals.shipping * 0.16 + signals.clarity * 0.14,
    };
    return clamp(0.32 + (weights[segmentId] || 0.2));
  }

  function behaviorForSegment(segmentId, sentiment, signals, product, change) {
    const base = {
      gen_z_deal_seekers: "Shares if the deal mechanic is simple enough to screenshot or repost.",
      working_parents: "Compares practical usefulness against delivery and household value.",
      electronics_skeptics: "Pauses on claims and looks for proof before trusting the listing.",
      livestream_regulars: "Amplifies creator-led hooks when the offer feels native to live commerce.",
      platform_switchers: "Checks whether the same product is better on a competing marketplace.",
    };
    if (sentiment === "negative") return `Pushback likely: ${base[segmentId]} Weak proof or high urgency can turn ${change.label.toLowerCase()} into objection chatter.`;
    if (signals.proof > 0.55 && product.signals[1]) return `${base[segmentId]} Proof around ${product.signals[1]} reduces hesitation.`;
    return base[segmentId];
  }

  function feedbackForSegment(segmentId, sentiment, signals, product) {
    if (sentiment === "positive") return `Likely to repeat the ad if it keeps ${product.signals[0]} visible.`;
    if (sentiment === "negative") return "Likely to question the claim publicly or wait for comments/reviews.";
    if (segmentId === "electronics_skeptics") return "Needs warranty, seller identity, and review proof before conversion.";
    if (signals.urgency > 0.5) return "Understands the offer, but urgency may create suspicion.";
    return "Interested, but needs one clearer reason to act now.";
  }

  function recommendationForSegment(segmentId, sentiment, signals, product) {
    if (sentiment === "negative") return `Add proof for ${product.signals[1]} and soften hard-sell language.`;
    if (segmentId === "working_parents") return "Lead with delivery certainty and household usefulness.";
    if (segmentId === "livestream_regulars") return "Turn the upload into creator/live script variants.";
    if (signals.discount < 0.3) return "Make final price, voucher, or bundle math more explicit.";
    return `Keep ${product.signals[0]} prominent and test a narrower first audience.`;
  }

  function labelSignal(key) {
    const labels = {
      proof: "Proof / trust",
      discount: "Deal clarity",
      urgency: "Urgency pressure",
      creator: "Creator fit",
      family: "Household fit",
      shipping: "Shipping confidence",
      clarity: "Message clarity",
      riskLanguage: "Risky claims",
      image: "Visual creative",
    };
    return labels[key] || key;
  }

  function average(values, fallback) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
  }

  function buildNodes(swarm, targetCommunity, segmentId, adoption, risk) {
    return swarm.communities.map((community, index) => {
      const segmentMatch = community.id === targetCommunity || (segmentId === "platform_switchers" && community.id === "reseller");
      const state = segmentMatch && adoption > risk ? "adopted" : risk > 0.66 && ["reseller", "review_cluster"].includes(community.id) ? "resistant" : segmentMatch ? "exposed" : "unexposed";
      return {
        id: index + 1,
        community: community.id,
        state,
        label: community.label,
      };
    });
  }

  function buildEdges(nodes, swarm, platform, spread) {
    const baseEdges = [
      [1, 2, 0.55],
      [1, 3, 0.7],
      [2, 4, 0.45],
      [3, 5, 0.62],
      [4, 6, 0.66],
      [5, 6, 0.5],
      [2, 6, 0.32],
      [3, 4, 0.4],
    ];
    return baseEdges.map(([source, target, weight]) => {
      const sourceCommunity = swarm.communities[source - 1];
      const platformBoost = sourceCommunity.platform === platform ? 0.18 : 0;
      return { source, target, weight: round(clamp(weight + spread * 0.22 + platformBoost, 0.1, 1), 2) };
    });
  }

  function buildTrace(context) {
    const { input, product, change, segment, nodes, edges, baseAdoption, backlashRisk, spread } = context;
    const campaign = {
      id: `${product.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${change.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: `${product.label}: ${change.label}`,
      initial_message: winningMessage(input, product, change, segment),
      product_signals: product.signals,
    };

    const communities = context.swarm.communities.map(({ id, label }) => ({ id, label }));
    const ticks = [];
    let adopted = 0;
    let resistant = 0;
    let exposed = 0;
    const targetNode = nodes.find((node) => node.community === segment.community) || nodes[0];
    const reviewNode = nodes.find((node) => node.community === "review_cluster") || nodes[nodes.length - 1];
    const resellerNode = nodes.find((node) => node.community === "reseller") || nodes[3];
    const familyNode = nodes.find((node) => node.community === "family") || nodes[0];

    for (let tick = 0; tick < 10; tick += 1) {
      const events = [];
      const adoptionProgress = clamp(baseAdoption * ((tick + 1) / 10) + spread * 0.12);
      const riskProgress = clamp(backlashRisk * (tick / 9));
      exposed = Math.min(nodes.length, Math.max(exposed, Math.ceil((tick + 1) * spread * 0.72)));
      adopted = Math.min(nodes.length, Math.max(adopted, Math.round(adoptionProgress * nodes.length)));
      resistant = Math.min(nodes.length - adopted, Math.max(resistant, Math.round(riskProgress * 2.2)));

      if (tick === 0) {
        events.push(event(targetNode.id, "expose", campaign.initial_message, `${segment.label} sees the proposed ${change.label.toLowerCase()} on ${input.platform}.`, null));
      } else if (tick === 1) {
        events.push(event(targetNode.id, adoptionProgress > riskProgress ? "adopt" : "resist", mutateMessage(input, product, change, "target"), `${segment.label} weighs product fit against backlash risk.`, null));
      } else if (tick === 2) {
        events.push(event(familyNode.id, "reshare", mutateMessage(input, product, change, "household"), "Connected household nodes reframe the change around practical value.", targetNode.id));
      } else if (tick === 3) {
        events.push(event(resellerNode.id, backlashRisk > 0.52 ? "mutate" : "expose", mutateMessage(input, product, change, "skeptic"), "High-connection skeptic nodes test whether the claim has weak spots.", targetNode.id));
      } else if (tick === 5) {
        events.push(event(reviewNode.id, backlashRisk > 0.6 ? "resist" : "adopt", mutateMessage(input, product, change, "review"), "Review-heavy nodes decide whether proof is strong enough for checkout.", resellerNode.id));
      } else if (tick === 7) {
        events.push(event(targetNode.id, "mutate", mutateMessage(input, product, change, "optimized"), "The winning variant becomes more segment-specific after social feedback.", reviewNode.id));
      } else if (tick === 9) {
        events.push(event(targetNode.id, "reshare", winningMessage(input, product, change, segment), "The run converges on the strongest recommendation copy.", reviewNode.id));
      }

      ticks.push({
        tick,
        events,
        metrics: { adopted, resistant, exposed, backlash_risk: round(clamp(backlashRisk * (0.55 + tick * 0.06))) },
      });
    }

    return { campaign, communities, nodes, edges, ticks, analyst_summary: null };
  }

  function event(node_id, action, message_variant, reasoning, source_node_id) {
    return { node_id, action, message_variant, reasoning, source_node_id };
  }

  function winningMessage(input, product, change, segment) {
    const productProof = product.signals[0];
    return `${change.label} for ${product.label}: lead with ${productProof} for ${segment.label} on ${input.platform}.`;
  }

  function mutateMessage(input, product, change, flavor) {
    const variants = {
      target: `${product.label} shoppers respond when ${change.copy} feels specific, not generic.`,
      household: `Make ${product.label} useful for family or repeat purchase moments before asking for checkout.`,
      skeptic: `If ${product.label} proof is weak, connected skeptics turn ${change.label.toLowerCase()} into backlash.`,
      review: `Reviews need to confirm ${product.signals[1]} before the swarm trusts the change.`,
      optimized: `Best variant: ${product.signals[0]} + ${product.signals[2]} + clear ${change.label.toLowerCase()} benefit.`,
    };
    return variants[flavor];
  }

  function buildSuggestions({ input, recommendation, product, change, platformRisk, backlashRisk, baseAdoption }) {
    const suggestions = [];
    if (recommendation === "target") {
      suggestions.push(`Target ${input.segmentId.replaceAll("_", " ")} first, but cap spend until tick-3 backlash stays under 0.45.`);
    }
    if (recommendation === "test") {
      suggestions.push(`A/B test ${change.label.toLowerCase()} with proof-led copy before scaling across ${input.platform}.`);
    }
    if (recommendation === "avoid") {
      suggestions.push(`Avoid broad rollout; connected skeptic clusters are likely to reframe the change negatively.`);
    }
    if (backlashRisk > 0.55) {
      suggestions.push(`Add proof for ${product.signals[1]} and route complaints to Shopee-owned surfaces before X picks it up.`);
    }
    if (baseAdoption < 0.62) {
      suggestions.push(`Improve product fit by switching the lead message to ${product.signals[0]} or ${product.signals[2]}.`);
    }
    if (platformRisk > 0.6) {
      suggestions.push(`${input.platform} is a high-risk venue for this product; use it for listening before conversion.`);
    }
    return suggestions.slice(0, 4);
  }

  function buildNarrative({ input, product, change, segment, recommendation, baseAdoption, backlashRisk }) {
    const action = recommendation === "target" ? "is likely to help" : recommendation === "avoid" ? "is unlikely to help yet" : "needs a controlled test";
    return `${change.label} ${action} ${segment.label} for ${product.label} on ${input.platform}. Simulated adoption is ${round(baseAdoption)} with backlash risk ${round(backlashRisk)}. The model favors proof around ${product.signals.join(", ")}.`;
  }

  function adaptLayer6Trace(rawTrace, context) {
    const { input, swarm, product, change, segment } = context;
    const graph = rawTrace.graph || {};
    const graphNodes = graph.nodes || [];
    const graphEdges = graph.edges || [];
    const nodeCount = graph.node_count || graphNodes.length || 1;
    const steps = rawTrace.steps || [];
    const finalStep = steps[steps.length - 1] || {};
    const finalCounts = normalizeLayer6Counts(finalStep.state_counts || rawTrace.summary || {});
    const eventCount = steps.reduce((sum, step) => sum + (step.events?.length || 0), 0);
    const adoptedRate = finalCounts.adopted / nodeCount;
    const resistantRate = finalCounts.resistant / nodeCount;
    const initialRate = (rawTrace.params?.initial_exposed_count || 0) / nodeCount;
    const recommendation = adoptedRate > 0.52 && resistantRate < 0.12 ? "target" : resistantRate > 0.22 ? "avoid" : "test";
    const confidence = clamp(0.62 + Math.min(eventCount / Math.max(nodeCount * 3, 1), 0.22) + Math.abs(adoptedRate - resistantRate) * 0.18);
    const communityLabels = Object.fromEntries(swarm.communities.map((community) => [community.id, community.label]));
    const communities = (graph.communities || []).map((community) => ({
      id: community,
      label: communityLabels[community] || titleCase(community),
    }));
    const network = buildLayer6Network(rawTrace, swarm, finalStep.node_states || rawTrace.final_states || {});
    const trace = {
      campaign: {
        id: rawTrace.trace_id || "layer6-trace",
        name: rawTrace.campaign?.name || `${product.label}: ${change.label}`,
        initial_message: rawTrace.campaign?.description || winningMessage(input, product, change, segment),
        product_signals: product.signals,
      },
      communities,
      nodes: network.nodes,
      edges: network.edges,
      ticks: steps.map((step) => adaptLayer6Step(step, nodeCount)),
      analyst_summary: null,
      layer6_summary: {
        trace_id: rawTrace.trace_id,
        generated_at_utc: rawTrace.generated_at_utc,
        node_count: nodeCount,
        edge_count: graph.edge_count || graphEdges.length,
        event_count: eventCount,
        final_counts: finalCounts,
        schema: rawTrace.trace_schema || rawTrace.summary?.contract || null,
      },
    };
    const narrative = `Layer 6 ground truth shows ${finalCounts.adopted.toLocaleString()} adopted, ${finalCounts.exposed.toLocaleString()} still exposed, ${finalCounts.resistant.toLocaleString()} resistant, and ${finalCounts.unexposed.toLocaleString()} unexposed across ${nodeCount.toLocaleString()} personas after ${steps.length} ticks.`;

    return {
      rawTrace,
      trace,
      trend: trace.ticks.map((tick) => ({ tick: tick.tick, ...tick.metrics })),
      network,
      recommendation,
      adoptionLift: round((adoptedRate - initialRate) * 100, 1),
      backlashRisk: round(resistantRate),
      confidence: round(confidence),
      suggestions: [
        `Treat Layer 6 as ground truth: ${nodeCount.toLocaleString()} personas, ${(graph.edge_count || graphEdges.length).toLocaleString()} edges, ${eventCount.toLocaleString()} events.`,
        `Use summaries for scanning, but audit tick-level state_counts and events before approving targeting changes.`,
        adoptedRate > 0.52 ? `Adoption clears ${(adoptedRate * 100).toFixed(1)}%; inspect resistant clusters before scaling.` : `Adoption is ${(adoptedRate * 100).toFixed(1)}%; keep this as a controlled test.`,
        `Compare ${change.label.toLowerCase()} against product-specific creative feedback before generating the next Layer 6 run.`,
      ],
      summary: { narrative },
    };
  }

  function adaptLayer6Step(step, nodeCount) {
    const counts = normalizeLayer6Counts(step.state_counts || {});
    return {
      tick: step.tick,
      events: (step.events || []).map(adaptLayer6Event),
      metrics: {
        adopted: counts.adopted,
        resistant: counts.resistant,
        exposed: counts.exposed,
        backlash_risk: round(counts.resistant / Math.max(nodeCount, 1)),
      },
      state_counts: counts,
      ground_truth: true,
    };
  }

  function adaptLayer6Event(eventRow) {
    const actions = {
      exposure: "expose",
      adoption: "adopt",
      resistance: "resist",
      reshare: "reshare",
      mutation: "mutate",
    };
    return {
      node_id: eventRow.target || eventRow.source || eventRow.mutation_id || "trace",
      action: actions[eventRow.event_type] || eventRow.event_type || "event",
      message_variant: formatLayer6Event(eventRow),
      reasoning: eventRow.notes || eventRow.outcome || eventRow.mutation_rule || `${eventRow.event_type} event from Layer 6 trace.`,
      source_node_id: eventRow.source || null,
      raw_event: eventRow,
    };
  }

  function formatLayer6Event(eventRow) {
    if (eventRow.event_type === "mutation") {
      return eventRow.mutation_applied
        ? `mutation ${eventRow.mutation_id}: ${Object.keys(eventRow.changes || {}).join(", ")}`
        : `no mutation applied at tick ${eventRow.tick}`;
    }
    const target = eventRow.target || "none";
    const transition = eventRow.from_state && eventRow.to_state ? `${eventRow.from_state} -> ${eventRow.to_state}` : eventRow.event_type;
    const source = eventRow.source ? ` via ${eventRow.source}` : "";
    return `${target}: ${transition}${source}`;
  }

  function buildLayer6Network(rawTrace, swarm, finalStates) {
    const graph = rawTrace.graph || {};
    const communities = graph.communities || [];
    const nodeIndexByCommunity = Object.fromEntries(communities.map((community, index) => [community, index + 1]));
    const labels = Object.fromEntries(swarm.communities.map((community) => [community.id, community.label]));
    const nodes = communities.map((community, index) => {
      const members = (graph.nodes || []).filter((node) => node.community === community);
      const stateCounts = members.reduce(
        (counts, node) => {
          const state = finalStates[node.persona_id] || "unexposed";
          counts[state] = (counts[state] || 0) + 1;
          return counts;
        },
        { unexposed: 0, exposed: 0, adopted: 0, resistant: 0 }
      );
      return {
        id: index + 1,
        community,
        state: dominantState(stateCounts),
        label: labels[community] || titleCase(community),
        count: members.length,
        state_counts: stateCounts,
      };
    });
    const edgeGroups = new Map();
    for (const edge of graph.edges || []) {
      const sourceId = nodeIndexByCommunity[edge.source_community];
      const targetId = nodeIndexByCommunity[edge.target_community];
      if (!sourceId || !targetId) continue;
      const key = `${sourceId}:${targetId}`;
      const current = edgeGroups.get(key) || { source: sourceId, target: targetId, weightSum: 0, count: 0 };
      current.weightSum += Number(edge.weight || 0);
      current.count += 1;
      edgeGroups.set(key, current);
    }
    const maxCount = Math.max(...Array.from(edgeGroups.values()).map((edge) => edge.count), 1);
    const edges = Array.from(edgeGroups.values()).map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: round(clamp(edge.count / maxCount * 0.75 + (edge.weightSum / Math.max(edge.count, 1)) * 0.25, 0.1, 1), 2),
      edge_count: edge.count,
    }));
    return { nodes, edges };
  }

  function normalizeLayer6Counts(counts) {
    return {
      unexposed: Number(counts.unexposed || counts.unexposed_count || 0),
      exposed: Number(counts.exposed || counts.exposed_count || 0),
      adopted: Number(counts.adopted || counts.adopted_count || 0),
      resistant: Number(counts.resistant || counts.resistant_count || 0),
    };
  }

  function dominantState(counts) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unexposed";
  }

  function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function inferInputFromQuestion(question, defaults) {
    const text = question.toLowerCase();
    const productId = text.includes("computer") || text.includes("electronics") || text.includes("laptop") || text.includes("notebook") || text.includes("pc") || text.includes("monitor")
      ? "computers"
      : text.includes("clothes") || text.includes("fashion") || text.includes("apparel") || text.includes("fit") || text.includes("size") || text.includes("plus-size") || text.includes("return guarantee")
        ? "fashion"
        : text.includes("beverage") || text.includes("drink") || text.includes("viral drinks") || text.includes("taste") || text.includes("sampler")
          ? "beverages"
          : defaults.productId;
    const changeId = text.includes("ship") || text.includes("delivery") || text.includes("priority slot") || text.includes("arrive") || text.includes("parcel")
      ? "shipping_priority"
      : text.includes("badge") || text.includes("trust") || text.includes("warranty") || text.includes("official") || text.includes("return guarantee")
        ? "trust_badge"
      : text.includes("bundle") || text.includes("checkout")
          ? "checkout_bundle"
      : text.includes("recovery") || text.includes("late")
            ? "late_delivery_recovery"
      : text.includes("ad ") || text.includes("ads") || text.includes("target") || text.includes("campaign") || text.includes("creative")
        ? "targeted_ads"
            : "targeted_ads";
    const segmentId = text.includes("parent")
      ? "working_parents"
      : text.includes("skeptic") || text.includes("warranty") || text.includes("spec") || text.includes("research")
        ? "electronics_skeptics"
        : text.includes("live") || text.includes("creator") || text.includes("host")
          ? "livestream_regulars"
          : text.includes("switch") || text.includes("competitor") || text.includes("lazada")
            ? "platform_switchers"
            : text.includes("gen z") || text.includes("student") || text.includes("young")
              ? "gen_z_deal_seekers"
              : defaults.segmentId;
    const platform = ["Shopee Live", "Instagram", "TikTok", "Shopee", "X"].find((name) => text.includes(name.toLowerCase())) || defaults.platform;
    return { productId, changeId, segmentId, platform };
  }

  return { runSimulation, inferInputFromQuestion, analyzeCreative };
})();
