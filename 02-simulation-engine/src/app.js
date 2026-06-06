const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  productId: "beverages",
  changeId: "targeted_ads",
  segmentId: "gen_z_deal_seekers",
  platform: "TikTok",
  result: null,
  hasRun: false,
};

const controls = {
  product: $("#productSelect"),
  change: $("#changeSelect"),
  segment: $("#segmentSelect"),
  platform: $("#platformSelect"),
  run: $("#runButton"),
  theme: $("#themeToggle"),
  themeLabel: $("#themeToggleLabel"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  promptButtons: $$(".prompt-chips button"),
};

function syncControls() {
  controls.product.value = state.productId;
  controls.change.value = state.changeId;
  controls.segment.value = state.segmentId;
  controls.platform.value = state.platform;
}

function runAndRender(source = "control") {
  state.productId = controls.product.value;
  state.changeId = controls.change.value;
  state.segmentId = controls.segment.value;
  state.platform = controls.platform.value;
  state.result = window.SeaSimulationEngine.runSimulation(state);
  state.hasRun = true;
  renderAll(source);
}

function setPendingExperiment() {
  state.productId = controls.product.value;
  state.changeId = controls.change.value;
  state.segmentId = controls.segment.value;
  state.platform = controls.platform.value;
  $("#summaryMode").textContent = "Mock experiment ready";
  $("#jobTitle").textContent = "Ready to simulate";
  $("#jobCopy").textContent = `Queued: ${label("changes", state.changeId)} for ${label("products", state.productId)} on ${state.platform}.`;
  $$("#jobSteps li").forEach((step) => step.className = "");
}

async function runMockSimulation(source = "control") {
  controls.run.disabled = true;
  controls.run.textContent = "Simulating";
  $("#jobTitle").textContent = "Running mocked swarm";
  $("#jobCopy").textContent = "This demo uses deterministic local persona data while the real 03-persona-data-pipeline matures.";
  const steps = $$("#jobSteps li");
  steps.forEach((step) => step.className = "");

  for (const [index, step] of steps.entries()) {
    step.className = "active";
    await wait(260);
    step.className = "done";
  }

  runAndRender(source);
  $("#jobTitle").textContent = "Mock simulation complete";
  $("#jobCopy").textContent = "Dashboards, graph network, trace, and analyst answer updated from the selected experiment.";
  controls.run.disabled = false;
  controls.run.textContent = "Run Simulation";
}

function renderAll(source) {
  renderMetrics();
  renderAnswer(source);
  renderTrendStats();
  renderTrendChart();
  renderNetwork();
  renderTrace();
  renderJson();
}

function renderMetrics() {
  const result = state.result;
  $("#summaryMode").textContent = state.hasRun ? "Mock run complete" : "Mock mode";
  $("#metricRecommendation").textContent = result.recommendation;
  $("#metricAdoption").textContent = `${result.adoptionLift > 0 ? "+" : ""}${result.adoptionLift}%`;
  $("#metricBacklash").textContent = result.backlashRisk.toFixed(2);
  $("#metricConfidence").textContent = result.confidence.toFixed(2);
  $("#trendLabel").textContent = `${label("products", state.productId)} / ${label("changes", state.changeId)}`;
  $("#networkScale").textContent = `${window.PersonaSwarmData.products[state.productId].sampleSize.toLocaleString()} modeled users`;
}

function renderAnswer(source) {
  const result = state.result;
  const product = window.PersonaSwarmData.products[state.productId];
  const segment = window.PersonaSwarmData.segments[state.segmentId];
  const change = window.PersonaSwarmData.changes[state.changeId];
  const answer =
    result.recommendation === "target"
      ? "Yes, likely worth targeting."
      : result.recommendation === "avoid"
        ? "No, not as currently framed."
        : "Maybe, but run it as a controlled test.";

  $("#answerTitle").textContent = answer;
  $("#answerCopy").textContent = buildAnalystMemo(result, "panel");
  $("#suggestionList").innerHTML = result.suggestions.map((item) => `<span>${item}</span>`).join("");

  if (source === "chat") {
    addChatMessage("assistant", buildAnalystMemo(result, "chat"));
  } else if (source === "control") {
    addChatMessage("assistant", buildAnalystMemo(result, "chat"));
  }
}

function buildAnalystMemo(result, mode) {
  const product = window.PersonaSwarmData.products[state.productId];
  const segment = window.PersonaSwarmData.segments[state.segmentId];
  const change = window.PersonaSwarmData.changes[state.changeId];
  const verdict =
    result.recommendation === "target"
      ? "Yes, but target it with guardrails."
      : result.recommendation === "avoid"
        ? "Not yet. The swarm is likely to turn this into a trust problem."
        : "Promising, but keep it in a controlled test cell.";
  const evidence = [
    `${product.sampleSize.toLocaleString()} modeled ${product.label.toLowerCase()} shoppers`,
    `${segment.count.toLocaleString()} ${segment.label.toLowerCase()}`,
    `${state.platform} affinity and backlash risk`,
    "10-tick propagation trace",
  ];
  const failureMode = result.backlashRisk > 0.55
    ? `The weak point is public skepticism around ${product.signals[1]}; connected X/review clusters can mutate the message before checkout.`
    : `The weak point is not adoption, it is over-scaling before tick-3 backlash stays below 0.45.`;
  const betterMove = result.suggestions[0] || `Lead with ${product.signals[0]} and keep the first run narrow.`;

  if (mode === "panel") {
    return `${verdict} I inferred ${change.label.toLowerCase()} for ${product.label} aimed at ${segment.label} on ${state.platform}. Adoption lift is ${result.adoptionLift > 0 ? "+" : ""}${result.adoptionLift}% with backlash risk ${result.backlashRisk.toFixed(2)}. ${failureMode}`;
  }

  return [
    `Verdict: ${verdict}`,
    `Inferred setup: ${change.label} / ${product.label} / ${segment.label} / ${state.platform}`,
    `Pulled: ${evidence.join("; ")}`,
    `Read: adoption lift ${result.adoptionLift > 0 ? "+" : ""}${result.adoptionLift}%, backlash risk ${result.backlashRisk.toFixed(2)}, confidence ${result.confidence.toFixed(2)}`,
    `Watchout: ${failureMode}`,
    `Better move: ${betterMove}`,
  ].join("\n");
}

function renderTrendStats() {
  const trend = state.result.trend;
  const last = trend[trend.length - 1];
  const peakRisk = Math.max(...trend.map((point) => point.backlash_risk));
  $("#trendStats").innerHTML = [
    ["Final adopted", last.adopted, "adopted"],
    ["Final exposed", last.exposed, "exposed"],
    ["Final resistant", last.resistant, "resistant"],
    ["Peak backlash", peakRisk.toFixed(2), "risk"],
  ]
    .map(([labelText, value, tone]) => `<article class="${tone}"><span>${labelText}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTrendChart() {
  const trend = state.result.trend;
  const maxCount = Math.max(...trend.flatMap((point) => [point.adopted, point.resistant, point.exposed]), 6);
  const width = 900;
  const height = 260;
  const padLeft = 54;
  const padRight = 24;
  const padTop = 30;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xFor = (index) => padLeft + (index / (trend.length - 1)) * plotW;
  const yForCount = (value) => height - padBottom - (value / maxCount) * plotH;
  const yForRisk = (value) => height - padBottom - value * plotH;
  const linePath = (key) =>
    trend
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yForCount(point[key]).toFixed(1)}`)
      .join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxCount * ratio));
  const xTicks = [0, 3, 6, 9];

  $("#trendChart").innerHTML = `
    <g class="chart-grid">
      ${yTicks
        .map((tick) => {
          const y = yForCount(tick);
          return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}"></line><text x="${padLeft - 12}" y="${y + 4}" text-anchor="end">${tick}</text>`;
        })
        .join("")}
      ${xTicks
        .map((tick) => {
          const x = xFor(tick);
          return `<line class="vertical" x1="${x}" y1="${padTop}" x2="${x}" y2="${height - padBottom}"></line><text x="${x}" y="${height - 15}" text-anchor="middle">t${tick}</text>`;
        })
        .join("")}
    </g>
    <g class="chart-legend">
      <circle class="legend-dot adopted" cx="66" cy="18" r="5"></circle><text x="78" y="22">adopted</text>
      <circle class="legend-dot exposed" cx="150" cy="18" r="5"></circle><text x="162" y="22">exposed</text>
      <circle class="legend-dot resistant" cx="235" cy="18" r="5"></circle><text x="247" y="22">resistant</text>
      <circle class="legend-dot risk" cx="330" cy="18" r="5"></circle><text x="342" y="22">backlash risk</text>
    </g>
    <path class="series exposed" d="${linePath("exposed")}" fill="none"></path>
    <path class="series adopted" d="${linePath("adopted")}" fill="none"></path>
    <path class="series resistant" d="${linePath("resistant")}" fill="none"></path>
    <g class="chart-points">
      ${trend
        .map((point, index) => {
          const x = xFor(index);
          return `<circle class="dot adopted" cx="${x}" cy="${yForCount(point.adopted)}" r="3.5"></circle><circle class="dot risk" cx="${x}" cy="${yForRisk(point.backlash_risk)}" r="3.5"></circle>`;
        })
        .join("")}
    </g>
  `;
}

function renderNetwork() {
  const { nodes, edges } = state.result.network;
  const communities = window.PersonaSwarmData.communities;
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const communityById = Object.fromEntries(communities.map((community, index) => [index + 1, community]));
  const targetCommunity = window.PersonaSwarmData.segments[state.segmentId].community;

  $("#networkChart").innerHTML = `
    <defs>
      <marker id="netArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#8b9890"></path>
      </marker>
      <marker id="netArrowHot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#ee4d2d"></path>
      </marker>
    </defs>
    ${edges
      .map((edge) => {
        const source = communityById[edge.source];
        const target = communityById[edge.target];
        const hot = byId[edge.source]?.community === targetCommunity || source.platform === state.platform;
        return `<line class="net-edge ${hot ? "hot" : ""}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke-width="${2 + edge.weight * 5}" marker-end="url(#${hot ? "netArrowHot" : "netArrow"})"></line>`;
      })
      .join("")}
    ${nodes
      .map((node) => {
        const community = communityById[node.id];
        const segment = Object.values(window.PersonaSwarmData.segments).find((item) => item.community === node.community);
        const count = segment ? segment.count : Math.round(window.PersonaSwarmData.products[state.productId].sampleSize / 7);
        return `
          <g class="net-node ${node.state} ${node.community === targetCommunity ? "target" : ""}" transform="translate(${community.x} ${community.y})">
            <circle r="${26 + Math.min(18, count / 180)}"></circle>
            <text class="net-label" y="-2">${shortLabel(node.label)}</text>
            <text class="net-count" y="15">${count.toLocaleString()} users</text>
          </g>
        `;
      })
      .join("")}
  `;
}

function renderTrace() {
  $("#traceList").innerHTML = state.result.trace.ticks
    .map(
      (tick) => `
        <article>
          <div>
            <strong>Tick ${tick.tick}</strong>
            <span>${tick.metrics.adopted} adopted / ${tick.metrics.resistant} resistant / risk ${tick.metrics.backlash_risk.toFixed(2)}</span>
          </div>
          <ul>
            ${
              tick.events.length
                ? tick.events.map((event) => `<li><b>${event.action}</b> node ${event.node_id}: ${event.message_variant}</li>`).join("")
                : "<li>No major visible event; latent exposure continues.</li>"
            }
          </ul>
        </article>
      `
    )
    .join("");
}

function renderJson() {
  $("#jsonPreview").textContent = JSON.stringify(state.result.trace, null, 2);
}

function addChatMessage(role, text) {
  const log = $("#chatLog");
  const node = document.createElement("div");
  node.className = `chat-message ${role}`;
  node.textContent = text;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function label(group, key) {
  const source = group === "products" ? window.PersonaSwarmData.products : window.PersonaSwarmData.changes;
  return source[key].label;
}

function shortLabel(value) {
  return value.replace(" and ", " + ").replace(" chats", "").replace(" sharers", "").replace(" validators", "");
}

controls.run.addEventListener("click", () => runMockSimulation("control"));

controls.theme.addEventListener("click", () => {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

[controls.product, controls.change, controls.segment, controls.platform].forEach((control) => {
  control.addEventListener("change", setPendingExperiment);
});

controls.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAgentQuestion(controls.chatInput.value);
});

controls.promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    controls.chatInput.value = button.dataset.prompt;
    submitAgentQuestion(button.dataset.prompt);
  });
});

function submitAgentQuestion(questionText) {
  const question = questionText.trim();
  if (!question) return;
  addChatMessage("user", question);
  const inferred = window.SeaSimulationEngine.inferInputFromQuestion(question, state);
  Object.assign(state, inferred);
  syncControls();
  runMockSimulation("chat");
}

$("#copyTraceButton").addEventListener("click", async () => {
  const text = $("#jsonPreview").textContent;
  try {
    await navigator.clipboard.writeText(text);
    $("#copyTraceButton").textContent = "Copied";
    setTimeout(() => ($("#copyTraceButton").textContent = "Copy JSON"), 1200);
  } catch {
    $("#copyTraceButton").textContent = "Select JSON";
  }
});

$$(".nav-item[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".nav-item[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $$(".view").forEach((view) => view.classList.remove("active"));
    $(`#${button.dataset.view}View`).classList.add("active");
  });
});

syncControls();
applyTheme(localStorage.getItem("seacodex-theme") || "light");
addChatMessage("assistant", "Mock analyst is ready. Give it a messy product/app-change brief, not a perfect form query. I will infer the setup, run the swarm, and tell you what to target, avoid, or test.");
runAndRender("initial");
state.hasRun = false;
setPendingExperiment();

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("seacodex-theme", theme);
  controls.themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
}
