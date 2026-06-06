window.SeaSimulationEngine = (() => {
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const round = (value, places = 2) => Number(value.toFixed(places));

  function runSimulation(input, swarm = window.PersonaSwarmData) {
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

    const nodes = buildNodes(swarm, community, input.segmentId, baseAdoption, backlashRisk);
    const edges = buildEdges(nodes, swarm, input.platform, spread);
    const trace = buildTrace({ input, swarm, product, change, segment, nodes, edges, baseAdoption, backlashRisk, spread });
    const suggestions = buildSuggestions({ input, recommendation, product, change, platformRisk, backlashRisk, baseAdoption });

    trace.analyst_summary = {
      top_segment: segment.label,
      recommended_action: recommendation,
      winning_message_variant: winningMessage(input, product, change, segment),
      backlash_risk_score: round(backlashRisk),
      supporting_node_ids: nodes.slice(0, 5).map((node) => node.id),
      confidence: round(confidence),
      narrative: buildNarrative({ input, product, change, segment, recommendation, baseAdoption, backlashRisk }),
    };

    return {
      input,
      recommendation,
      adoptionLift: round((baseAdoption - 0.5) * 100, 1),
      backlashRisk: round(backlashRisk),
      confidence: round(confidence),
      spread: round(spread),
      suggestions,
      trace,
      trend: trace.ticks.map((tick) => ({ tick: tick.tick, ...tick.metrics })),
      network: { nodes, edges },
    };
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

    const communities = window.PersonaSwarmData.communities.map(({ id, label }) => ({ id, label }));
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

  return { runSimulation, inferInputFromQuestion };
})();
