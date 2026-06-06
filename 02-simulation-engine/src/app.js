const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  productId: "beverages",
  changeId: "targeted_ads",
  segmentId: "gen_z_deal_seekers",
  platform: "TikTok",
  result: null,
  creative: { name: "", type: "", size: 0, text: "", imageUrl: "" },
  creativeAnalysis: null,
  layer6Trace: null,
  layer6Status: "loading",
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
  creativeFile: $("#creativeFileInput"),
  creativeText: $("#creativeTextInput"),
  creativeAnalyze: $("#analyzeCreativeButton"),
  creativeClear: $("#clearCreativeButton"),
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
  state.result = window.SeaSimulationEngine.runSimulation(state, window.PersonaSwarmData, state.layer6Trace);
  state.creativeAnalysis = window.SeaSimulationEngine.analyzeCreative(state, window.PersonaSwarmData, state.creative);
  state.hasRun = true;
  renderAll(source);
}

function setPendingExperiment() {
  state.productId = controls.product.value;
  state.changeId = controls.change.value;
  state.segmentId = controls.segment.value;
  state.platform = controls.platform.value;
  $("#summaryMode").textContent = state.layer6Trace ? "Layer 6 trace ready" : "Mock experiment ready";
  $("#jobTitle").textContent = "Ready to simulate";
  $("#jobCopy").textContent = `Queued: ${label("changes", state.changeId)} for ${label("products", state.productId)} on ${state.platform}.`;
  $$("#jobSteps li").forEach((step) => step.className = "");
}

async function runMockSimulation(source = "control") {
  controls.run.disabled = true;
  controls.run.textContent = "Simulating";
  $("#jobTitle").textContent = state.layer6Trace ? "Reading Layer 6 trace" : "Running mocked swarm";
  $("#jobCopy").textContent = state.layer6Trace
    ? "Using the full market_analysis_layer6 simulation_trace.json as ground truth, with summaries generated for the dashboard."
    : "This demo uses deterministic local mock data while the larger data pipeline matures.";
  const steps = $$("#jobSteps li");
  steps.forEach((step) => step.className = "");

  for (const [index, step] of steps.entries()) {
    step.className = "active";
    await wait(260);
    step.className = "done";
  }

  runAndRender(source);
  $("#jobTitle").textContent = state.layer6Trace ? "Layer 6 simulation loaded" : "Mock simulation complete";
  $("#jobCopy").textContent = state.layer6Trace
    ? "Dashboard summaries updated from Layer 6; trace and contract tabs retain the full raw ground-truth log."
    : "Dashboards, graph network, trace, and analyst answer updated from the selected experiment.";
  controls.run.disabled = false;
  controls.run.textContent = "Run Simulation";
}

function renderAll(source) {
  renderMetrics();
  renderAnswer(source);
  renderTrendStats();
  renderTrendChart();
  renderCreativeFeedback();
  renderNetwork();
  renderTrace();
  renderJson();
}

function renderMetrics() {
  const result = state.result;
  $("#summaryMode").textContent = result.source === "layer6_ground_truth_trace" ? "Layer 6 trace loaded" : state.hasRun ? "Mock run complete" : "Mock mode";
  $("#metricRecommendation").textContent = result.recommendation;
  $("#metricAdoption").textContent = `${result.adoptionLift > 0 ? "+" : ""}${result.adoptionLift}%`;
  $("#metricBacklash").textContent = result.backlashRisk.toFixed(2);
  $("#metricConfidence").textContent = result.confidence.toFixed(2);
  $("#trendLabel").textContent = result.layer6 ? `Layer 6 / ${result.trace.campaign.name}` : `${label("products", state.productId)} / ${label("changes", state.changeId)}`;
  $("#networkScale").textContent = result.layer6
    ? `${result.layer6.trace.layer6_summary.node_count.toLocaleString()} personas / ${result.layer6.trace.layer6_summary.edge_count.toLocaleString()} edges`
    : `${window.PersonaSwarmData.products[state.productId].sampleSize.toLocaleString()} modeled users`;
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

function renderCreativeFeedback() {
  const creative = state.creative;
  const analysis = state.creativeAnalysis || window.SeaSimulationEngine.analyzeCreative(state, window.PersonaSwarmData, creative);
  const hasCreative = Boolean(creative.name || creative.text || creative.imageUrl);

  $("#creativePreview").innerHTML = hasCreative
    ? `
      ${creative.imageUrl ? `<img src="${creative.imageUrl}" alt="Uploaded creative preview">` : ""}
      <strong>${escapeHtml(creative.name || "Pasted proposal")}</strong>
      <span>${escapeHtml(creative.type || "Text brief")} ${creative.size ? `/${Math.round(creative.size / 1024)} KB` : ""}</span>
      <span>${escapeHtml((creative.text || "Visual creative uploaded. Add notes above for sharper text feedback.").slice(0, 180))}</span>
    `
    : `
      <strong>No creative uploaded yet</strong>
      <span>Upload a file or paste copy to generate demographic feedback.</span>
    `;

  $("#creativeFeedbackSource").textContent = analysis.summary.source;
  $("#creativeSignals").innerHTML = analysis.signals
    .map((signal) => `<span>${escapeHtml(signal.label)} ${signal.score}</span>`)
    .join("");
  $("#demographicFeedback").innerHTML = analysis.demographics
    .map(
      (row) => `
        <article class="feedback-card">
          <header>
            <div>
              <h4>${escapeHtml(row.label)}</h4>
              <p>${row.count.toLocaleString()} modeled users</p>
            </div>
            <span class="sentiment-pill ${row.sentiment}">${row.sentiment}</span>
          </header>
          <dl>
            <div>
              <dt>Adoption</dt>
              <dd>${row.adoptionPotential}%</dd>
            </div>
            <div>
              <dt>Backlash</dt>
              <dd>${row.backlashRisk}%</dd>
            </div>
          </dl>
          <p>${escapeHtml(row.behavior)}</p>
          <p><strong>Feedback:</strong> ${escapeHtml(row.feedback)}</p>
          <p><strong>Move:</strong> ${escapeHtml(row.recommendation)}</p>
        </article>
      `
    )
    .join("");
}

async function handleCreativeFile(file) {
  if (!file) return;
  const creative = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    text: controls.creativeText.value.trim(),
    imageUrl: "",
  };

  if (file.type.startsWith("image/")) {
    creative.imageUrl = await readFile(file, "dataUrl");
  } else if (isTextLikeFile(file)) {
    creative.text = await readFile(file, "text");
    controls.creativeText.value = creative.text;
  } else {
    creative.text = controls.creativeText.value.trim() || `${file.name} uploaded. Paste proposal notes or ad copy for deeper text feedback.`;
  }

  state.creative = creative;
  inferCreativeSetup();
  runAndRender("creative");
}

function analyzeCreativeFromControls() {
  state.creative = {
    ...state.creative,
    name: state.creative.name || "Pasted proposal",
    type: state.creative.type || "text/plain",
    text: controls.creativeText.value.trim(),
  };
  inferCreativeSetup();
  runMockSimulation("creative");
}

function clearCreative() {
  controls.creativeFile.value = "";
  controls.creativeText.value = "";
  state.creative = { name: "", type: "", size: 0, text: "", imageUrl: "" };
  state.creativeAnalysis = window.SeaSimulationEngine.analyzeCreative(state, window.PersonaSwarmData, state.creative);
  renderCreativeFeedback();
}

function inferCreativeSetup() {
  const text = `${state.creative.name} ${state.creative.text}`;
  const inferred = window.SeaSimulationEngine.inferInputFromQuestion(text, state);
  Object.assign(state, inferred);
  syncControls();
}

function readFile(file, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(reader.error);
    if (mode === "dataUrl") {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

function isTextLikeFile(file) {
  return file.type.startsWith("text/") || /\.(txt|md|json|csv)$/i.test(file.name);
}

function buildAnalystMemo(result, mode) {
  const product = window.PersonaSwarmData.products[state.productId];
  const segment = window.PersonaSwarmData.segments[state.segmentId];
  const change = window.PersonaSwarmData.changes[state.changeId];
  if (result.layer6) {
    const summary = result.layer6.trace.layer6_summary;
    const counts = summary.final_counts;
    const verdict = result.recommendation === "target" ? "Yes, Layer 6 supports targeting with guardrails." : result.recommendation === "avoid" ? "No, Layer 6 shows too much resistance." : "Promising, but keep it in a controlled test.";
    const evidence = `${summary.node_count.toLocaleString()} personas, ${summary.edge_count.toLocaleString()} edges, ${summary.event_count.toLocaleString()} trace events`;
    const read = `${counts.adopted.toLocaleString()} adopted / ${counts.exposed.toLocaleString()} exposed / ${counts.resistant.toLocaleString()} resistant / ${counts.unexposed.toLocaleString()} unexposed`;

    if (mode === "panel") {
      return `${verdict} I’m using the full Layer 6 ground-truth trace for the dashboard summary: ${evidence}. Final state counts: ${read}.`;
    }

    return [
      `Verdict: ${verdict}`,
      `Inferred setup: ${change.label} / ${product.label} / ${segment.label} / ${state.platform}`,
      `Pulled: Layer 6 simulation_trace.json ground truth`,
      `Trace scale: ${evidence}`,
      `Final states: ${read}`,
      `Better move: ${result.suggestions[1] || result.suggestions[0]}`,
    ].join("\n");
  }
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
  const riskPath = trend
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yForRisk(point.backlash_risk).toFixed(1)}`)
    .join(" ");
  const yTicks = buildYAxisTicks(maxCount);
  const xTicks = Array.from(new Set([0, Math.floor((trend.length - 1) / 3), Math.floor(((trend.length - 1) * 2) / 3), trend.length - 1]));
  const dot = (key, className) =>
    trend
      .map((point, index) => `<circle class="dot ${className}" cx="${xFor(index)}" cy="${yForCount(point[key])}" r="3.5"></circle>`)
      .join("");

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
    <path class="series risk" d="${riskPath}" fill="none"></path>
    <g class="chart-points">
      ${dot("exposed", "exposed")}
      ${dot("adopted", "adopted")}
      ${dot("resistant", "resistant")}
      ${trend
        .map((point, index) => `<circle class="dot risk" cx="${xFor(index)}" cy="${yForRisk(point.backlash_risk)}" r="3.5"></circle>`)
        .join("")}
    </g>
  `;
}

function buildYAxisTicks(maxCount) {
  if (maxCount <= 12) return Array.from({ length: maxCount + 1 }, (_, tick) => tick);
  const roughStep = Math.ceil(maxCount / 5);
  const magnitude = 10 ** Math.max(0, String(roughStep).length - 1);
  const step = Math.ceil(roughStep / magnitude) * magnitude;
  const ticks = [];
  for (let value = 0; value <= maxCount; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== maxCount) ticks.push(maxCount);
  return ticks;
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
        const count = node.count || (segment ? segment.count : Math.round(window.PersonaSwarmData.products[state.productId].sampleSize / 7));
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
  const layer6Summary = state.result.layer6?.trace.layer6_summary;
  $("#traceSourceBadge").textContent = state.result.layer6 ? "Layer 6 ground truth" : "schema-aligned replay";
  $("#traceSummary").innerHTML = layer6Summary
    ? [
        ["Trace ID", layer6Summary.trace_id || "layer6"],
        ["Personas", layer6Summary.node_count.toLocaleString()],
        ["Edges", layer6Summary.edge_count.toLocaleString()],
        ["Events", layer6Summary.event_count.toLocaleString()],
        ["Adopted", layer6Summary.final_counts.adopted.toLocaleString()],
        ["Resistant", layer6Summary.final_counts.resistant.toLocaleString()],
      ]
        .map(([labelText, value]) => `<article><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong></article>`)
        .join("")
    : "";
  $("#traceList").innerHTML = state.result.trace.ticks
    .map(
      (tick) => `
        <article>
          <div>
            <strong>Tick ${tick.tick}</strong>
            <span>${tick.metrics.adopted} adopted / ${tick.metrics.exposed} exposed / ${tick.metrics.resistant} resistant / risk ${tick.metrics.backlash_risk.toFixed(2)}</span>
            ${tick.ground_truth ? `<span>${tick.events.length.toLocaleString()} ground-truth events</span>` : ""}
          </div>
          <ul>
            ${
              tick.events.length
                ? tick.events.map((event) => `<li><b>${escapeHtml(event.action)}</b> node ${escapeHtml(event.node_id)}: ${escapeHtml(event.message_variant)}</li>`).join("")
                : "<li>No major visible event; latent exposure continues.</li>"
            }
          </ul>
        </article>
      `
    )
    .join("");
}

function renderJson() {
  const payload = state.result.layer6
    ? {
        dashboard_summary_trace: state.result.trace,
        layer6_ground_truth: state.result.layer6.rawTrace,
        creative_handoff: state.creativeAnalysis?.mirofishPayload || null,
      }
    : {
        ...state.result.trace,
        creative_handoff: state.creativeAnalysis?.mirofishPayload || null,
      };
  $("#jsonPreview").textContent = JSON.stringify(payload, null, 2);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadLayer6Trace() {
  try {
    const response = await fetch("./market_analysis_layer6_simulation/simulation_trace.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Layer 6 trace request failed: ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
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

controls.creativeFile.addEventListener("change", (event) => {
  handleCreativeFile(event.target.files?.[0]).catch(() => {
    $("#creativePreview").innerHTML = `
      <strong>Could not read file</strong>
      <span>Try pasting the proposal text or uploading an image/text file.</span>
    `;
  });
});

controls.creativeAnalyze.addEventListener("click", analyzeCreativeFromControls);
controls.creativeClear.addEventListener("click", clearCreative);

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

async function boot() {
  syncControls();
  applyTheme(localStorage.getItem("seacodex-theme") || "light");
  addChatMessage("assistant", "Analyst is ready. I will use the full Layer 6 trace log when available, summarize it for the dashboard, and keep the ground-truth JSON visible in the contract view.");
  state.layer6Trace = await loadLayer6Trace();
  state.layer6Status = state.layer6Trace ? "loaded" : "missing";
  runAndRender("initial");
  state.hasRun = false;
  setPendingExperiment();
}

boot();

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("seacodex-theme", theme);
  controls.themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
}
