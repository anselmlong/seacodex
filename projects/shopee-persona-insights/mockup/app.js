const personas = {
  voucher_hunter: {
    id: "voucher_hunter",
    name: "Voucher Hunter",
    type: "Deal optimizer",
    avatar: "avatar-voucher",
    summary: "Stacks codes, waits for payday campaigns, and abandons carts when the final price disappoints.",
  },
  trust_guardian: {
    id: "trust_guardian",
    name: "Trust Guardian",
    type: "Risk reducer",
    avatar: "avatar-trust",
    summary: "Checks seller proof, return policy, warranty, and review authenticity before buying.",
  },
  livestream_impulse_buyer: {
    id: "livestream_impulse_buyer",
    name: "Livestream Impulse Buyer",
    type: "Creator-led buyer",
    avatar: "avatar-live",
    summary: "Moves fast when creator demos, urgency, and social proof line up.",
  },
  time_poor_parent: {
    id: "time_poor_parent",
    name: "Time-Poor Parent",
    type: "Convenience buyer",
    avatar: "avatar-parent",
    summary: "Values predictable delivery, clear returns, and low-friction household reorders.",
  },
  brand_switcher: {
    id: "brand_switcher",
    name: "Brand Switcher",
    type: "Comparator",
    avatar: "avatar-switcher",
    summary: "Compares platform experience, creator proof, and final cart value against alternatives.",
  },
};

const scenarios = {
  free_shipping: {
    name: "Free Shipping Minimum Spend",
    summary: "Bundle nudges are tested across TikTok, Instagram, X, Shopee Live, and Shopee reviews.",
    lanes: [
      {
        platform: "TikTok",
        accent: "tikTok",
        surface: "Short-form video comments",
        question: "Will the offer feel worth acting on now?",
        dominant: "livestream_impulse_buyer",
        pull: 82,
        risk: 31,
        spread: 88,
        signals: ["Creator proof", "Limited bundle", "Stackable code"],
        post: "If the code stacks on this bundle, I am checking out before it expires.",
        reaction: "Turns urgency into checkout intent when the final savings are shown in-video.",
      },
      {
        platform: "Instagram",
        accent: "instagram",
        surface: "Saved reels and story replies",
        question: "Will shoppers save now and compare later?",
        dominant: "time_poor_parent",
        pull: 64,
        risk: 38,
        spread: 61,
        signals: ["Saved finds", "Household reorder", "Bundle clarity"],
        post: "I would save this if the bundle actually gets me to free shipping without random filler.",
        reaction: "Works when the visual shows a practical cart bundle, not just a campaign badge.",
      },
      {
        platform: "X",
        accent: "x",
        surface: "Public complaints and comparisons",
        question: "Will the rule change trigger backlash?",
        dominant: "trust_guardian",
        pull: 44,
        risk: 76,
        spread: 69,
        signals: ["Checkout frustration", "Lazada mention", "Rule transparency"],
        post: "Raising free shipping minimums is fine only if you do not hide it at checkout.",
        reaction: "Needs plain disclosure before cart review or the conversation turns negative.",
      },
      {
        platform: "Shopee Live",
        accent: "live",
        surface: "Creator stream chat",
        question: "Can the host convert bundle objections?",
        dominant: "voucher_hunter",
        pull: 86,
        risk: 34,
        spread: 73,
        signals: ["Host explanation", "Voucher stack", "Pinned bundle"],
        post: "Pin the exact bundle that unlocks shipping. I do not want to calculate during the stream.",
        reaction: "High conversion if the host makes the savings path instantly visible.",
      },
      {
        platform: "Shopee",
        accent: "shopee",
        surface: "Checkout and product reviews",
        question: "Will shoppers complete the cart?",
        dominant: "brand_switcher",
        pull: 71,
        risk: 52,
        spread: 32,
        signals: ["Checkout math", "Reviews", "Final cart total"],
        post: "Show the cheapest add-on and final total. Otherwise I compare somewhere else.",
        reaction: "Keeps shoppers when bundle suggestions feel useful rather than forced.",
      },
    ],
  },
  trust_badge: {
    name: "Livestream Trust Badge",
    summary: "Verified seller proof is tested in creator-led and marketplace-native contexts.",
    lanes: [
      {
        platform: "TikTok",
        accent: "tikTok",
        surface: "Creator video replies",
        question: "Does creator energy transfer into trust?",
        dominant: "livestream_impulse_buyer",
        pull: 79,
        risk: 42,
        spread: 84,
        signals: ["Creator demo", "Official seller tag", "Comment proof"],
        post: "Seeing it used live helps, but I still want the official seller tag before buying.",
        reaction: "Trust badge turns attention into intent when it appears inside the creator flow.",
      },
      {
        platform: "Instagram",
        accent: "instagram",
        surface: "Stories, saves, and DMs",
        question: "Will shoppers keep the find for later?",
        dominant: "time_poor_parent",
        pull: 68,
        risk: 35,
        spread: 58,
        signals: ["Save intent", "Return clarity", "Family-safe purchase"],
        post: "I would buy later if the story links to an official store with painless returns.",
        reaction: "Strong for practical buyers when the badge reduces research time.",
      },
      {
        platform: "X",
        accent: "x",
        surface: "Skeptical public threads",
        question: "Will the badge be challenged?",
        dominant: "trust_guardian",
        pull: 49,
        risk: 81,
        spread: 72,
        signals: ["Badge skepticism", "Warranty questions", "Policy receipts"],
        post: "Verified by who? Show the warranty and return terms, not just a shiny label.",
        reaction: "Needs evidence behind the badge or skeptical users will frame it as cosmetic.",
      },
      {
        platform: "Shopee Live",
        accent: "live",
        surface: "Live chat and pinned products",
        question: "Can badges reduce in-stream hesitation?",
        dominant: "voucher_hunter",
        pull: 83,
        risk: 29,
        spread: 66,
        signals: ["Pinned proof", "Seller badge", "Return guarantee"],
        post: "Badge plus return guarantee makes the deal feel safer.",
        reaction: "Best when creator mentions what the badge practically protects.",
      },
      {
        platform: "Shopee",
        accent: "shopee",
        surface: "Product page and reviews",
        question: "Does proof survive checkout scrutiny?",
        dominant: "brand_switcher",
        pull: 74,
        risk: 45,
        spread: 28,
        signals: ["Official shop", "Review quality", "Warranty clarity"],
        post: "If the official shop proof is clear, I stop comparing and checkout.",
        reaction: "Marketplace-native proof is the final trust lock before payment.",
      },
    ],
  },
  late_delivery: {
    name: "Late Delivery Recovery",
    summary: "Recovery vouchers and proactive messages are tested by platform and complaint stage.",
    lanes: [
      {
        platform: "TikTok",
        accent: "tikTok",
        surface: "Trend-led reaction comments",
        question: "Does delay kill hype?",
        dominant: "livestream_impulse_buyer",
        pull: 51,
        risk: 58,
        spread: 62,
        signals: ["Trend window", "Apology timing", "Voucher value"],
        post: "If it arrives after the trend is over, the recovery voucher feels weak.",
        reaction: "Urgency buyers need fast expectation resets before excitement fades.",
      },
      {
        platform: "Instagram",
        accent: "instagram",
        surface: "Story replies and DMs",
        question: "Will recovery feel considerate?",
        dominant: "time_poor_parent",
        pull: 56,
        risk: 66,
        spread: 45,
        signals: ["Early message", "Practical apology", "Delivery certainty"],
        post: "Tell me before I plan around the delivery. That matters more than a tiny voucher.",
        reaction: "Parents and household buyers need proactive certainty, not post-complaint compensation.",
      },
      {
        platform: "X",
        accent: "x",
        surface: "Complaint escalation",
        question: "Will delay become public anger?",
        dominant: "trust_guardian",
        pull: 35,
        risk: 88,
        spread: 80,
        signals: ["Public complaint", "Generic copy", "Support deflection"],
        post: "Do not send generic logistics copy. Explain what happened and what you are doing.",
        reaction: "Highest public-risk lane; vague messages amplify distrust.",
      },
      {
        platform: "Shopee Live",
        accent: "live",
        surface: "Post-stream buyer chat",
        question: "Will delayed items harm creator trust?",
        dominant: "voucher_hunter",
        pull: 54,
        risk: 61,
        spread: 52,
        signals: ["Creator credibility", "Delayed bundle", "Recovery code"],
        post: "The host sold the timing. If delivery slips, the next stream needs a better make-good.",
        reaction: "Recovery needs to protect both Shopee and creator credibility.",
      },
      {
        platform: "Shopee",
        accent: "shopee",
        surface: "Order tracking and reviews",
        question: "Will the shopper reorder?",
        dominant: "brand_switcher",
        pull: 59,
        risk: 70,
        spread: 31,
        signals: ["Tracking clarity", "Voucher sufficiency", "Review impact"],
        post: "Late once is okay. Late with unclear tracking makes me test another platform.",
        reaction: "Reorder intent depends on tracking clarity more than voucher size.",
      },
    ],
  },
};

const productProfiles = {
  beverages: {
    name: "Beverages",
    sample: "12,400 users",
    risk: "Taste mismatch",
    riskCopy: "Creator hype can trigger trial, but bad taste reviews spread quickly.",
    summary: "Fast-moving consumables where trial bundles, taste proof, and repeat purchase timing matter.",
    platformSummary: [
      ["TikTok", "Taste-test virality"],
      ["Instagram", "Lifestyle saves"],
      ["X", "Sugar and value debate"],
      ["Shopee Live", "Bundle sampling"],
      ["Shopee", "Repeat purchase"],
    ],
    modifiers: { TikTok: 8, Instagram: 4, X: 3, "Shopee Live": 7, Shopee: 6 },
    segmentRows: [
      ["Gen Z deal seekers", "18-24, promo-native, tries viral drinks if codes stack.", ["High", "Taste-test clips convert"], ["Medium", "Saves aesthetic packs"], ["Medium", "Mocks overpricing"], ["High", "Asks sampler bundles"], ["High", "Reorders if flavor lands"]],
      ["Working parents", "28-42, pantry restock and family-safe choices.", ["Medium", "Browses recipes"], ["High", "Saves multipacks"], ["Low", "Limited public debate"], ["Medium", "Buys if bundle is practical"], ["High", "Needs delivery reliability"]],
      ["Health-conscious buyers", "Checks sugar, ingredients, and reviews before trial.", ["Medium", "Watches ingredient claims"], ["High", "Saves wellness content"], ["High", "Challenges health claims"], ["Medium", "Asks label questions"], ["High", "Reads reviews carefully"]],
      ["Livestream regulars", "Responds to host tasting and limited sampler deals.", ["High", "Moves through taste clips"], ["Medium", "Follows creator reminders"], ["Low", "Less complaint-thread active"], ["High", "Converts on sample packs"], ["Medium", "Checks out after stream"]],
      ["Platform switchers", "Compares value per bottle, shipping, and competitor bundles.", ["Medium", "Finds new drink trends"], ["Medium", "Compares saved options"], ["High", "Amplifies price comparisons"], ["Medium", "Needs exclusive bundle"], ["High", "Switches if final price loses"]],
    ],
  },
  fashion: {
    name: "Clothes",
    sample: "18,900 users",
    risk: "Fit uncertainty",
    riskCopy: "Style discovery is strong, but sizing and return friction create hesitation.",
    summary: "Fashion and apparel where visual proof, fit confidence, returns, and creator styling matter.",
    platformSummary: [
      ["TikTok", "Try-on momentum"],
      ["Instagram", "Saved outfits"],
      ["X", "Quality complaints"],
      ["Shopee Live", "Fit Q&A"],
      ["Shopee", "Size and returns"],
    ],
    modifiers: { TikTok: 9, Instagram: 9, X: 5, "Shopee Live": 6, Shopee: 4 },
    segmentRows: [
      ["Gen Z style hunters", "18-24, trend-led, high save and share behavior.", ["High", "Try-ons create urgency"], ["High", "Saves outfit boards"], ["Medium", "Calls out dupes"], ["Medium", "Asks fit questions"], ["High", "Needs size confidence"]],
      ["Office basics buyers", "Repeat buyers looking for reliable fit and fabric.", ["Low", "Less impulse"], ["Medium", "Saves capsule outfits"], ["Medium", "Flags quality issues"], ["Medium", "Buys if host compares sizes"], ["High", "Reads fabric reviews"]],
      ["Plus-size shoppers", "Needs fit proof, measurements, and return reassurance.", ["Medium", "Watches body-type proof"], ["High", "Saves relevant creators"], ["High", "Challenges poor sizing"], ["Medium", "Asks measurements live"], ["High", "Needs return clarity"]],
      ["Livestream regulars", "Converts when host shows fabric, stretch, and fit variants.", ["High", "Moves through try-on clips"], ["High", "Follows creator styling"], ["Low", "Less active in threads"], ["High", "Converts on pinned sizes"], ["Medium", "Checks reviews after stream"]],
      ["Platform switchers", "Compares price, fabric, return policy, and creator proof.", ["Medium", "Finds trend items"], ["High", "Compares saved outfits"], ["High", "Amplifies quality complaints"], ["Medium", "Needs exclusive color or bundle"], ["High", "Switches if returns are easier elsewhere"]],
    ],
  },
  electronics: {
    name: "Computers",
    sample: "9,700 users",
    risk: "Warranty distrust",
    riskCopy: "High-ticket purchases need official seller proof, warranty clarity, and delivery confidence.",
    summary: "Computers and accessories where spec comparison, warranty trust, delivery risk, and review depth dominate.",
    platformSummary: [
      ["TikTok", "Spec demos"],
      ["Instagram", "Setup inspiration"],
      ["X", "Warranty scrutiny"],
      ["Shopee Live", "Deal explanation"],
      ["Shopee", "Review depth"],
    ],
    modifiers: { TikTok: 3, Instagram: 4, X: 9, "Shopee Live": 5, Shopee: 9 },
    segmentRows: [
      ["Student buyers", "Budget constrained, compares specs and installment options.", ["Medium", "Watches budget setup clips"], ["Medium", "Saves desk setups"], ["High", "Asks warranty questions"], ["Medium", "Needs deal explanation"], ["High", "Reads reviews deeply"]],
      ["Remote workers", "Needs reliability, fast delivery, and return certainty.", ["Low", "Less impulse"], ["Medium", "Saves setup inspiration"], ["High", "Escalates delivery failures"], ["Medium", "Asks productivity use cases"], ["High", "Needs official warranty"]],
      ["Electronics skeptics", "Warranty-aware shoppers with high trust thresholds.", ["Low", "Treats demos as awareness"], ["Medium", "Checks comments for proof"], ["High", "Challenges seller claims"], ["Medium", "Asks official-store questions"], ["High", "Reads warranty terms"]],
      ["Livestream regulars", "Will buy accessories live; slower for high-ticket machines.", ["Medium", "Moves on accessory clips"], ["Medium", "Follows creator reminders"], ["Low", "Less complaint-thread active"], ["High", "Converts on peripherals"], ["Medium", "Checks out after spec review"]],
      ["Platform switchers", "Compares official stores, warranty, delivery, and final price.", ["Low", "Finds awareness only"], ["Medium", "Compares saved alternatives"], ["High", "Amplifies warranty comparisons"], ["Medium", "Needs strong exclusive value"], ["High", "Switches if warranty unclear"]],
    ],
  },
};

const segmentRows = [
  {
    segment: "Gen Z deal seekers",
    description: "18-24, promo-native, fast to react when codes feel scarce.",
    cells: {
      TikTok: ["High", "Creator proof converts impulse"],
      Instagram: ["Medium", "Saves finds for payday"],
      X: ["Medium", "Mocks weak promo math"],
      "Shopee Live": ["High", "Asks for stackable codes"],
      Shopee: ["High", "Compares final cart total"],
    },
  },
  {
    segment: "Working parents",
    description: "28-42, convenience-led, household replenishment focus.",
    cells: {
      TikTok: ["Low", "Browses, rarely impulse buys"],
      Instagram: ["High", "Saves practical bundles"],
      X: ["Medium", "Escalates delivery failures"],
      "Shopee Live": ["Medium", "Buys if host saves time"],
      Shopee: ["High", "Needs delivery predictability"],
    },
  },
  {
    segment: "Electronics skeptics",
    description: "Warranty-aware shoppers with high trust thresholds.",
    cells: {
      TikTok: ["Low", "Treats demos as awareness"],
      Instagram: ["Medium", "Checks comments for proof"],
      X: ["High", "Challenges seller claims"],
      "Shopee Live": ["Medium", "Asks official-store questions"],
      Shopee: ["High", "Reads reviews and warranty terms"],
    },
  },
  {
    segment: "Livestream regulars",
    description: "Habitual stream watchers who respond to host credibility.",
    cells: {
      TikTok: ["High", "Moves through creator clips"],
      Instagram: ["Medium", "Follows creator reminders"],
      X: ["Low", "Less active in complaint threads"],
      "Shopee Live": ["High", "Converts on pinned bundles"],
      Shopee: ["Medium", "Checks out after stream"],
    },
  },
  {
    segment: "Platform switchers",
    description: "Value comparers who mention competitors and test alternatives.",
    cells: {
      TikTok: ["Medium", "Finds products through trends"],
      Instagram: ["Medium", "Compares saved alternatives"],
      X: ["High", "Amplifies competitor comparisons"],
      "Shopee Live": ["Medium", "Needs obvious exclusive value"],
      Shopee: ["High", "Switches if final price loses"],
    },
  },
];

let activeScenario = "free_shipping";
let activeProduct = "beverages";
let activeLaneIndex = 0;

const scenarioName = document.querySelector("#scenarioName");
const scenarioSummary = document.querySelector("#scenarioSummary");
const platformBoard = document.querySelector("#platformBoard");
const detailAvatar = document.querySelector("#detailAvatar");
const detailPlatform = document.querySelector("#detailPlatform");
const detailName = document.querySelector("#detailName");
const detailSummary = document.querySelector("#detailSummary");
const detailStance = document.querySelector("#detailStance");
const detailReaction = document.querySelector("#detailReaction");
const detailPost = document.querySelector("#detailPost");
const barPull = document.querySelector("#barPull");
const barRisk = document.querySelector("#barRisk");
const barSpread = document.querySelector("#barSpread");
const segmentMatrix = document.querySelector("#segmentMatrix");
const platformSummary = document.querySelector("#platformSummary");
const productName = document.querySelector("#productName");
const productSample = document.querySelector("#productSample");
const productRisk = document.querySelector("#productRisk");
const productRiskCopy = document.querySelector("#productRiskCopy");
const productSummary = document.querySelector("#productSummary");

function renderAvatar(persona, size = "") {
  return `
    <div class="avatar ${size} ${persona.avatar}" aria-hidden="true">
      <span class="hair"></span>
      <span class="face"></span>
      <span class="shirt"></span>
    </div>
  `;
}

function stanceFor(lane) {
  const net = lane.pull - lane.risk * 0.35 + lane.spread * 0.1;
  if (net >= 63) return "positive";
  if (net >= 42) return "mixed";
  return "negative";
}

function renderBoard() {
  const scenario = scenarios[activeScenario];
  const product = productProfiles[activeProduct];
  scenarioName.textContent = scenario.name;
  scenarioSummary.textContent = `${product.name}: ${scenario.summary}`;
  productName.textContent = product.name;
  productSample.textContent = product.sample;
  productRisk.textContent = product.risk;
  productRiskCopy.textContent = product.riskCopy;
  productSummary.textContent = product.summary;

  platformSummary.innerHTML = product.platformSummary
    .map(([platform, behavior]) => `<article><span>${platform}</span><strong>${behavior}</strong></article>`)
    .join("");

  platformBoard.innerHTML = scenario.lanes
    .map((lane, index) => {
      const persona = personas[lane.dominant];
      const active = index === activeLaneIndex ? "active" : "";
      const adjustedLane = adjustLaneForProduct(lane, product);
      const stance = stanceFor(adjustedLane);
      return `
        <button class="platform-lane ${active} ${lane.accent}" type="button" data-lane="${index}">
          <div class="lane-header">
            <span class="platform-icon">${lane.platform.slice(0, 2)}</span>
            <div>
              <p class="eyebrow">${lane.surface}</p>
              <h3>${lane.platform}</h3>
            </div>
          </div>
          <p class="lane-question">${lane.question}</p>
          <div class="mini-feed">
            <div class="mini-feed-top">
              ${renderAvatar(persona, "small")}
              <div>
                <strong>${persona.name}</strong>
                <span>${persona.type}</span>
              </div>
            </div>
            <p>${lane.post}</p>
          </div>
          <div class="lane-tags">
            ${productSignals(activeProduct, lane.platform, lane.signals).map((signal) => `<span>${signal}</span>`).join("")}
          </div>
          <div class="lane-metrics">
            <span><b>${adjustedLane.pull}%</b> pull</span>
            <span><b>${adjustedLane.risk}%</b> risk</span>
            <span class="stance ${stance}">${stance}</span>
          </div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".platform-lane").forEach((lane) => {
    lane.addEventListener("click", () => {
      activeLaneIndex = Number(lane.dataset.lane);
      renderBoard();
      renderDetails();
    });
  });
}

function renderSegments() {
  const product = productProfiles[activeProduct];
  const platforms = ["TikTok", "Instagram", "X", "Shopee Live", "Shopee"];
  segmentMatrix.innerHTML = [
    `<div class="matrix-cell header">Segment</div>`,
    ...platforms.map((platform) => `<div class="matrix-cell header">${platform}</div>`),
    ...product.segmentRows.flatMap((row) => [
      `<div class="matrix-cell segment-name"><strong>${row[0]}</strong><span>${row[1]}</span></div>`,
      ...platforms.map((platform) => {
        const platformIndex = platforms.indexOf(platform) + 2;
        const [level, behavior] = row[platformIndex];
        return `<div class="matrix-cell behavior ${level.toLowerCase()}"><strong>${level}</strong><span>${behavior}</span></div>`;
      }),
    ]),
  ].join("");
}

function renderDetails() {
  const product = productProfiles[activeProduct];
  const lane = adjustLaneForProduct(scenarios[activeScenario].lanes[activeLaneIndex], product);
  const persona = personas[lane.dominant];
  const stance = stanceFor(lane);

  detailAvatar.className = `avatar large ${persona.avatar}`;
  detailPlatform.textContent = `${lane.platform} simulation`;
  detailName.textContent = persona.name;
  detailSummary.textContent = persona.summary;
  detailStance.textContent = `${stance[0].toUpperCase()}${stance.slice(1)} behavior`;
  detailReaction.textContent = lane.reaction;
  detailPost.textContent = `"${lane.post}"`;
  barPull.style.width = `${lane.pull}%`;
  barRisk.style.width = `${lane.risk}%`;
  barSpread.style.width = `${lane.spread}%`;
}

function adjustLaneForProduct(lane, product) {
  const modifier = product.modifiers[lane.platform] ?? 0;
  const riskModifier = activeProduct === "electronics" && ["X", "Shopee"].includes(lane.platform) ? 10 : 0;
  return {
    ...lane,
    pull: Math.max(15, Math.min(96, lane.pull + modifier - 4)),
    risk: Math.max(12, Math.min(95, lane.risk + riskModifier + Math.round(modifier / 3) - 2)),
    spread: Math.max(10, Math.min(96, lane.spread + Math.round(modifier / 2))),
  };
}

function productSignals(productId, platform, baseSignals) {
  const extras = {
    beverages: {
      TikTok: "Taste test",
      Instagram: "Lifestyle pack",
      X: "Sugar debate",
      "Shopee Live": "Sampler bundle",
      Shopee: "Repeat order",
    },
    fashion: {
      TikTok: "Try-on proof",
      Instagram: "Outfit save",
      X: "Quality complaint",
      "Shopee Live": "Fit Q&A",
      Shopee: "Size reviews",
    },
    electronics: {
      TikTok: "Spec demo",
      Instagram: "Desk setup",
      X: "Warranty scrutiny",
      "Shopee Live": "Deal explainer",
      Shopee: "Official store",
    },
  };
  return [extras[productId][platform], ...baseSignals.slice(0, 2)];
}

document.querySelectorAll(".scenario-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.product) {
      activeProduct = tab.dataset.product;
      document.querySelectorAll("[data-product]").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      renderBoard();
      renderDetails();
      renderSegments();
      return;
    }
    activeScenario = tab.dataset.scenario;
    activeLaneIndex = 0;
    document.querySelectorAll("[data-scenario]").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    renderBoard();
    renderDetails();
    renderSegments();
  });
});

renderBoard();
renderDetails();
renderSegments();
