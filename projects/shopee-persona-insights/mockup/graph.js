const interventions = {
  ad_targeting: {
    name: "Targeted Ads to Connectors",
    summary:
      "Seed ad creative with creator-led and voucher-led connectors first, then watch downstream movement across TikTok, Instagram, X, and Shopee checkout.",
    read:
      "High-connectivity users are not always the best conversion targets, but they are the fastest way to test whether a story spreads or mutates into complaints.",
    metrics: ["4 high-connectors", "2.8x", "+14%", "Medium"],
    hotNodes: ["creator_maya", "voucher_ken", "switcher_afiq", "parent_lina"],
    hotEdges: ["creator_maya-voucher_ken", "creator_maya-live_chat", "voucher_ken-checkout_cluster", "switcher_afiq-x_thread"],
    list: [
      ["Creator-led buyer", "High reach, high intent when product proof is visible."],
      ["Voucher hunter", "Pulls checkout clusters if savings are concrete."],
      ["Brand switcher", "Spreads competitor comparison risk across X."],
    ],
  },
  shipping_priority: {
    name: "Priority Shipping for Connected Buyers",
    summary:
      "Prioritize reliable shipment updates for high-degree household and electronics buyers before expected delivery anxiety spills into public channels.",
    read:
      "Shipping priority has the strongest retention effect on practical buyers, but it only becomes social proof when they are connected to deal and review clusters.",
    metrics: ["3 logistics-sensitive", "1.9x", "+9%", "Low"],
    hotNodes: ["parent_lina", "review_dina", "electronics_raj", "checkout_cluster"],
    hotEdges: ["parent_lina-family_cluster", "review_dina-checkout_cluster", "electronics_raj-x_thread", "checkout_cluster-family_cluster"],
    list: [
      ["Time-poor parent", "Delivery certainty protects repeat purchase intent."],
      ["Electronics researcher", "Tracking clarity reduces warranty anxiety."],
      ["Review cluster", "Positive shipment stories lift marketplace trust."],
    ],
  },
  recovery_voucher: {
    name: "Recovery Voucher After Late Delivery",
    summary:
      "Simulate whether a voucher suppresses complaint spread or feels too small once delay frustration has already reached X and review clusters.",
    read:
      "Recovery works best before complaint behavior starts. Once X connectors pick it up, the voucher needs explanation, not just value.",
    metrics: ["5 at-risk nodes", "3.4x", "-6%", "High"],
    hotNodes: ["trust_jo", "switcher_afiq", "x_thread", "review_dina"],
    hotEdges: ["trust_jo-x_thread", "switcher_afiq-x_thread", "x_thread-review_dina", "review_dina-checkout_cluster"],
    list: [
      ["Trust guardian", "Demands the reason for delay, not just compensation."],
      ["X complaint thread", "Amplifies weak recovery copy quickly."],
      ["Review cluster", "Can convert anger into durable seller distrust."],
    ],
  },
};

const graphProducts = {
  beverages: {
    sample: "12,400 modeled users",
    productLift: 0,
    focus: "trial, repeat purchase, taste proof",
    hotByIntervention: {
      ad_targeting: ["creator_maya", "voucher_ken", "checkout_cluster", "live_chat"],
      shipping_priority: ["parent_lina", "family_cluster", "checkout_cluster", "review_dina"],
      recovery_voucher: ["trust_jo", "x_thread", "review_dina", "switcher_afiq"],
    },
  },
  fashion: {
    sample: "18,900 modeled users",
    productLift: 4,
    focus: "try-on proof, fit risk, return clarity",
    hotByIntervention: {
      ad_targeting: ["creator_maya", "parent_lina", "live_chat", "checkout_cluster"],
      shipping_priority: ["parent_lina", "family_cluster", "review_dina", "checkout_cluster"],
      recovery_voucher: ["trust_jo", "x_thread", "review_dina", "switcher_afiq"],
    },
  },
  electronics: {
    sample: "9,700 modeled users",
    productLift: -3,
    focus: "spec comparison, warranty proof, delivery confidence",
    hotByIntervention: {
      ad_targeting: ["electronics_raj", "trust_jo", "review_dina", "checkout_cluster"],
      shipping_priority: ["electronics_raj", "checkout_cluster", "review_dina", "parent_lina"],
      recovery_voucher: ["trust_jo", "x_thread", "electronics_raj", "review_dina"],
    },
  },
};

const nodes = [
  { id: "creator_maya", label: "Creators", type: "2.1k creator-led buyers", platform: "TikTok", x: 145, y: 105, size: 34 },
  { id: "live_chat", label: "Live Chat", type: "1.4k stream responders", platform: "Live", x: 350, y: 110, size: 28 },
  { id: "voucher_ken", label: "Deals", type: "2.6k voucher hunters", platform: "TikTok", x: 245, y: 250, size: 36 },
  { id: "checkout_cluster", label: "Checkout", type: "3.8k cart evaluators", platform: "Shopee", x: 475, y: 255, size: 40 },
  { id: "parent_lina", label: "Parents", type: "1.9k convenience buyers", platform: "Instagram", x: 180, y: 410, size: 32 },
  { id: "family_cluster", label: "Household", type: "1.3k repeat buyers", platform: "Instagram", x: 380, y: 430, size: 28 },
  { id: "trust_jo", label: "Trust", type: "1.8k proof seekers", platform: "X", x: 635, y: 145, size: 34 },
  { id: "x_thread", label: "Complaint Hub", type: "2.4k public amplifiers", platform: "X", x: 760, y: 270, size: 38 },
  { id: "review_dina", label: "Reviews", type: "2.0k review writers", platform: "Shopee", x: 635, y: 420, size: 32 },
  { id: "electronics_raj", label: "Research", type: "1.5k spec comparers", platform: "Reddit", x: 770, y: 470, size: 30 },
  { id: "switcher_afiq", label: "Switchers", type: "1.7k competitor comparers", platform: "X", x: 560, y: 55, size: 32 },
];

const edges = [
  ["creator_maya", "live_chat", 3],
  ["creator_maya", "voucher_ken", 4],
  ["creator_maya", "switcher_afiq", 2],
  ["live_chat", "checkout_cluster", 3],
  ["voucher_ken", "checkout_cluster", 5],
  ["voucher_ken", "parent_lina", 2],
  ["parent_lina", "family_cluster", 4],
  ["family_cluster", "checkout_cluster", 2],
  ["switcher_afiq", "x_thread", 4],
  ["switcher_afiq", "trust_jo", 3],
  ["trust_jo", "x_thread", 5],
  ["x_thread", "review_dina", 4],
  ["review_dina", "checkout_cluster", 3],
  ["electronics_raj", "review_dina", 3],
  ["electronics_raj", "x_thread", 2],
  ["checkout_cluster", "review_dina", 2],
];

let activeIntervention = "ad_targeting";
let activeProduct = "beverages";

const graph = document.querySelector("#networkGraph");
const graphSample = document.querySelector("#graphSample");
const metricSeeds = document.querySelector("#metricSeeds");
const metricReach = document.querySelector("#metricReach");
const metricLift = document.querySelector("#metricLift");
const metricRisk = document.querySelector("#metricRisk");
const interventionName = document.querySelector("#interventionName");
const interventionSummary = document.querySelector("#interventionSummary");
const interventionRead = document.querySelector("#interventionRead");
const influenceList = document.querySelector("#influenceList");

function platformClass(platform) {
  return `node-${platform.toLowerCase().replace(/\s+/g, "-")}`;
}

function renderGraph() {
  const intervention = interventions[activeIntervention];
  const product = graphProducts[activeProduct];
  const hotNodes = new Set(product.hotByIntervention[activeIntervention] ?? intervention.hotNodes);
  const hotEdges = new Set(intervention.hotEdges);
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

  graph.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#84908a"></path>
      </marker>
      <marker id="arrowHot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#ee4d2d"></path>
      </marker>
    </defs>
    ${edges
      .map(([from, to, weight]) => {
        const source = byId[from];
        const target = byId[to];
        const key = `${from}-${to}`;
        const hot = hotEdges.has(key) ? "edge hot" : "edge";
        return `<line class="${hot}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke-width="${weight}" marker-end="url(#${hotEdges.has(key) ? "arrowHot" : "arrow"})"></line>`;
      })
      .join("")}
    ${nodes
      .map((node) => {
        const hot = hotNodes.has(node.id) ? "hot" : "";
        return `
          <g class="graph-node ${platformClass(node.platform)} ${hot}" transform="translate(${node.x} ${node.y})">
            <circle r="${node.size}"></circle>
            <text class="node-label" y="-2">${node.label}</text>
            <text class="node-type" y="14">${node.type}</text>
          </g>
        `;
      })
      .join("")}
  `;
}

function renderDetails() {
  const intervention = interventions[activeIntervention];
  const product = graphProducts[activeProduct];
  graphSample.textContent = product.sample;
  metricSeeds.textContent = intervention.metrics[0];
  metricReach.textContent = intervention.metrics[1];
  metricLift.textContent = adjustLift(intervention.metrics[2], product.productLift);
  metricRisk.textContent = activeProduct === "electronics" && activeIntervention !== "shipping_priority" ? "High" : intervention.metrics[3];
  interventionName.textContent = `${intervention.name}: ${labelForProduct(activeProduct)}`;
  interventionSummary.textContent = `${intervention.summary} Product lens: ${product.focus}.`;
  interventionRead.textContent = `${intervention.read} The graph is aggregated into communities so thousands of modeled users remain legible.`;
  influenceList.innerHTML = intervention.list
    .map(
      ([title, copy]) => `
        <article>
          <strong>${title}</strong>
          <span>${copy}</span>
        </article>
      `
    )
    .join("");
}

function labelForProduct(productId) {
  return { beverages: "Beverages", fashion: "Clothes", electronics: "Computers" }[productId];
}

function adjustLift(liftText, delta) {
  const value = Number(liftText.replace("%", ""));
  const adjusted = value + delta;
  return `${adjusted > 0 ? "+" : ""}${adjusted}%`;
}

document.querySelectorAll("[data-intervention]").forEach((button) => {
  button.addEventListener("click", () => {
    activeIntervention = button.dataset.intervention;
    document.querySelectorAll("[data-intervention]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDetails();
    renderGraph();
  });
});

document.querySelectorAll("[data-product]").forEach((button) => {
  button.addEventListener("click", () => {
    activeProduct = button.dataset.product;
    document.querySelectorAll("[data-product]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderDetails();
    renderGraph();
  });
});

renderDetails();
renderGraph();
