import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "output", "WLIAS-hackathon-pitch.pptx");
const heroImage = path.join(root, "assets", "wlias-oracle-network.png");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "WLIAS Hackathon Team";
pptx.subject = "WLIAS hackathon pitch deck";
pptx.title = "WLIAS: We Live In A Society";
pptx.company = "SEA Codex";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US"
};
pptx.defineLayout({ name: "CUSTOM_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "CUSTOM_WIDE";

const W = 13.333;
const H = 7.5;
const C = {
  ink: "28231D",
  muted: "736957",
  paper: "F3EEE5",
  paperStrong: "FFF9EF",
  line: "D9CEBD",
  teal: "158A80",
  blue: "315FBA",
  green: "24885A",
  orange: "D85D2A",
  red: "B83B2D",
  ochre: "B3872F",
  white: "FFFFFF",
  black: "111111"
};

const font = {
  head: "Aptos Display",
  body: "Aptos"
};

function addBg(slide, dark = false) {
  slide.background = { color: dark ? C.ink : C.paper };
  if (!dark) {
    for (let x = 0.5; x < W; x += 0.55) {
      slide.addShape(pptx.ShapeType.line, {
        x,
        y: 0,
        w: 0,
        h: H,
        line: { color: "E6DCCD", transparency: 38, width: 0.35 }
      });
    }
    for (let y = 0.45; y < H; y += 0.55) {
      slide.addShape(pptx.ShapeType.line, {
        x: 0,
        y,
        w: W,
        h: 0,
        line: { color: "E6DCCD", transparency: 38, width: 0.35 }
      });
    }
  }
}

function addFooter(slide, n, dark = false) {
  slide.addText("WLIAS / SEA Social Contagion Lab", {
    x: 0.5,
    y: 7.08,
    w: 5.8,
    h: 0.18,
    fontFace: font.body,
    fontSize: 7,
    color: dark ? "D8CEC1" : C.muted,
    margin: 0
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: 12.36,
    y: 7.04,
    w: 0.45,
    h: 0.2,
    fontFace: font.body,
    fontSize: 8,
    bold: true,
    color: dark ? C.paper : C.ink,
    align: "right",
    margin: 0
  });
}

function kicker(slide, text, x, y, dark = false) {
  slide.addText(text.toUpperCase(), {
    x,
    y,
    w: 5.8,
    h: 0.22,
    fontFace: font.body,
    fontSize: 8.5,
    bold: true,
    color: dark ? "71D5CD" : C.teal,
    margin: 0,
    breakLine: false,
    fit: "shrink"
  });
}

function title(slide, text, x, y, w, size = 30, dark = false) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 1.08,
    fontFace: font.head,
    fontSize: size,
    bold: true,
    color: dark ? C.paper : C.ink,
    margin: 0.02,
    breakLine: false,
    fit: "shrink"
  });
}

function bodyText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontFace: font.body,
    fontSize: opts.fontSize ?? 13,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    valign: opts.valign ?? "mid",
    fit: "shrink",
    breakLine: false,
    margin: opts.margin ?? 0.06,
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 4
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: opts.fill ?? C.paperStrong, transparency: opts.transparency ?? 0 },
    line: { color: opts.line ?? C.line, width: opts.width ?? 1 }
  });
}

function pill(slide, text, x, y, w, color = C.teal) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color },
    line: { color },
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: 0.16,
    fontFace: font.body,
    fontSize: 7.5,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink"
  });
}

function metric(slide, value, label, x, y, color) {
  card(slide, x, y, 2.15, 1.05, { fill: "FFFFFF" });
  slide.addText(value, {
    x: x + 0.12,
    y: y + 0.16,
    w: 1.9,
    h: 0.36,
    fontFace: font.head,
    fontSize: 22,
    bold: true,
    color,
    margin: 0,
    fit: "shrink"
  });
  slide.addText(label, {
    x: x + 0.12,
    y: y + 0.64,
    w: 1.9,
    h: 0.24,
    fontFace: font.body,
    fontSize: 8.5,
    color: C.muted,
    margin: 0,
    fit: "shrink"
  });
}

function addNode(slide, x, y, label, stateColor, size = 0.34) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color: stateColor },
    line: { color: C.ink, width: 1 }
  });
  slide.addText(label, {
    x: x - 0.36,
    y: y + size + 0.07,
    w: size + 0.72,
    h: 0.22,
    fontFace: font.body,
    fontSize: 6.6,
    color: C.ink,
    align: "center",
    margin: 0,
    fit: "shrink"
  });
}

function addArrow(slide, x1, y1, x2, y2, color = C.line, width = 1.2) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, beginArrowType: "none", endArrowType: "triangle" }
  });
}

// 1. Cover
{
  const slide = pptx.addSlide();
  addBg(slide, true);
  slide.addImage({ path: heroImage, x: 5.15, y: 0, w: 8.18, h: 7.5, transparency: 6 });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 7.4,
    h: 7.5,
    fill: { color: C.ink, transparency: 4 },
    line: { color: C.ink, transparency: 100 }
  });
  kicker(slide, "Hackathon pitch / Product intelligence", 0.62, 0.76, true);
  slide.addText("WLIAS", {
    x: 0.58,
    y: 1.32,
    w: 5.2,
    h: 1.0,
    fontFace: font.head,
    fontSize: 48,
    bold: true,
    color: C.paper,
    margin: 0,
    fit: "shrink"
  });
  slide.addText("We Live In A Society", {
    x: 0.64,
    y: 2.24,
    w: 4.9,
    h: 0.42,
    fontFace: font.body,
    fontSize: 18,
    color: "71D5CD",
    bold: true,
    margin: 0,
    fit: "shrink"
  });
  bodyText(
    slide,
    "Predict how a product listing spreads, mutates, and backfires after customers talk to each other.",
    0.66,
    3.05,
    5.15,
    0.9,
    { color: C.paper, fontSize: 18, margin: 0 }
  );
  pill(slide, "Singapore demo", 0.66, 4.34, 1.35, C.teal);
  pill(slide, "No live API risk", 2.16, 4.34, 1.45, C.blue);
  pill(slide, "Graph replay", 3.78, 4.34, 1.26, C.orange);
  addFooter(slide, 1, true);
}

// 2. Problem
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Problem", 0.58, 0.55);
  title(slide, "Market research stops before the interesting part.", 0.55, 0.9, 7.6, 31);
  bodyText(
    slide,
    "Brands can ask synthetic personas what they think. But listings win or lose after people forward, remix, joke about, and warn each other.",
    0.6,
    2.1,
    6.0,
    0.8,
    { fontSize: 15, color: C.muted }
  );
  const items = [
    ["Independent answers", "Persona tools treat buyers like isolated survey respondents."],
    ["No mutation model", "They miss how the message changes inside family, work, fandom, and reseller chats."],
    ["No backlash path", "They rarely show where a campaign creates resistance before launch."]
  ];
  items.forEach(([h, b], i) => {
    const y = 3.15 + i * 1.12;
    card(slide, 0.66, y, 5.9, 0.78);
    slide.addText(h, { x: 0.9, y: y + 0.13, w: 2.2, h: 0.22, fontFace: font.body, fontSize: 12.5, bold: true, color: C.ink, margin: 0 });
    slide.addText(b, { x: 3.0, y: y + 0.12, w: 3.2, h: 0.34, fontFace: font.body, fontSize: 9.2, color: C.muted, margin: 0.02, fit: "shrink" });
  });
  card(slide, 7.35, 1.1, 5.25, 4.95, { fill: "FFFFFF", line: C.ink, width: 1.2 });
  slide.addText("Current tools", { x: 7.72, y: 1.52, w: 1.8, h: 0.24, fontSize: 11, bold: true, color: C.muted, margin: 0 });
  slide.addText("ask", { x: 8.84, y: 2.15, w: 1.0, h: 0.4, fontSize: 25, bold: true, color: C.blue, align: "center", margin: 0 });
  addArrow(slide, 9.35, 2.72, 9.35, 3.42, C.line, 1.5);
  slide.addText("100 isolated personas", { x: 8.05, y: 3.62, w: 2.65, h: 0.32, fontSize: 11, bold: true, color: C.ink, align: "center", margin: 0 });
  slide.addShape(pptx.ShapeType.line, { x: 10.95, y: 1.45, w: 0, h: 4.2, line: { color: C.line, width: 1 } });
  slide.addText("WLIAS", { x: 11.33, y: 1.52, w: 0.9, h: 0.24, fontSize: 11, bold: true, color: C.teal, margin: 0 });
  slide.addText("simulates", { x: 10.86, y: 2.15, w: 1.9, h: 0.4, fontSize: 23, bold: true, color: C.teal, align: "center", margin: 0 });
  addArrow(slide, 11.8, 2.72, 11.8, 3.42, C.line, 1.5);
  slide.addText("what happens after they talk", { x: 10.76, y: 3.62, w: 2.05, h: 0.42, fontSize: 10.5, bold: true, color: C.ink, align: "center", margin: 0, fit: "shrink" });
  addFooter(slide, 2);
}

// 3. Solution
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Solution", 0.58, 0.55);
  title(slide, "A listing contagion console for brand teams.", 0.55, 0.92, 7.3, 31);
  bodyText(slide, "Enter a product listing, tune the selling angles, and watch projected demand and social chatter move through Singapore buyer networks.", 0.6, 1.95, 7.1, 0.64, { fontSize: 14, color: C.muted });

  const steps = [
    ["Input", "Product name, price, image, Shopee URL, headline, description", C.blue],
    ["Tune", "Voucher, free shipping, urgency, creator, family, budget/premium", C.teal],
    ["Simulate", "10-tick social graph replay with mutation and resistance", C.orange],
    ["Recommend", "Concrete listing edits by demographic segment", C.green]
  ];
  steps.forEach(([h, b, color], i) => {
    const x = 0.75 + i * 3.03;
    card(slide, x, 3.0, 2.45, 2.2);
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.18, y: 3.26, w: 0.48, h: 0.48, fill: { color }, line: { color } });
    slide.addText(String(i + 1), { x: x + 0.33, y: 3.39, w: 0.18, h: 0.15, fontSize: 8, bold: true, color: C.white, align: "center", margin: 0 });
    slide.addText(h, { x: x + 0.22, y: 3.92, w: 1.9, h: 0.26, fontSize: 15, bold: true, color: C.ink, margin: 0 });
    bodyText(slide, b, x + 0.22, 4.36, 1.95, 0.54, { fontSize: 9.5, color: C.muted, margin: 0 });
    if (i < steps.length - 1) addArrow(slide, x + 2.52, 4.1, x + 2.95, 4.1, C.line, 1.2);
  });
  metric(slide, "2 min", "pitchable live demo", 0.75, 5.85, C.teal);
  metric(slide, "0", "required live API calls", 3.12, 5.85, C.blue);
  metric(slide, "10", "replay ticks", 5.49, 5.85, C.orange);
  metric(slide, "6", "Singapore segments", 7.86, 5.85, C.green);
  addFooter(slide, 3);
}

// 4. Live demo architecture
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Demo architecture", 0.58, 0.55);
  title(slide, "Deterministic first. Backend-ready later.", 0.55, 0.9, 7.6, 31);

  const boxes = [
    ["Product Listing", "Name, category, price, Shopee URL, headline, image", 0.78, 2.0, C.blue],
    ["Parameter Controls", "Voucher, shipping, urgency, creator, family, positioning", 3.8, 2.0, C.teal],
    ["Projection Logic", "Transparent scoring rules; no live network dependency", 6.82, 2.0, C.orange],
    ["Dashboard Replay", "Graph, timeline, demographic report, recommendations", 9.84, 2.0, C.green]
  ];
  boxes.forEach(([h, b, x, y, color]) => {
    card(slide, x, y, 2.42, 1.42);
    slide.addText(h, { x: x + 0.16, y: y + 0.18, w: 2.1, h: 0.22, fontSize: 12.5, bold: true, color, margin: 0, fit: "shrink" });
    bodyText(slide, b, x + 0.16, y + 0.54, 2.08, 0.46, { fontSize: 8.5, color: C.muted, margin: 0 });
  });
  addArrow(slide, 3.22, 2.71, 3.62, 2.71, C.line, 1.4);
  addArrow(slide, 6.24, 2.71, 6.64, 2.71, C.line, 1.4);
  addArrow(slide, 9.26, 2.71, 9.66, 2.71, C.line, 1.4);

  card(slide, 0.78, 4.2, 5.6, 1.65, { fill: "FFFFFF" });
  slide.addText("Why this is the right hackathon cut", { x: 1.02, y: 4.46, w: 3.2, h: 0.24, fontSize: 13, bold: true, color: C.ink, margin: 0 });
  bodyText(slide, "The demo can run offline from a fixture, but the same data model can later point at FastAPI, OpenAI vision, and a real simulation engine.", 1.02, 4.9, 4.95, 0.48, { fontSize: 10.2, color: C.muted, margin: 0 });
  card(slide, 6.9, 4.2, 5.6, 1.65, { fill: "FFFFFF" });
  slide.addText("Current implementation signal", { x: 7.14, y: 4.46, w: 3.2, h: 0.24, fontSize: 13, bold: true, color: C.ink, margin: 0 });
  bodyText(slide, "The dashboard app already uses Next.js, React, Cytoscape.js, local types, segment data, and deterministic projection code.", 7.14, 4.9, 4.92, 0.48, { fontSize: 10.2, color: C.muted, margin: 0 });
  addFooter(slide, 4);
}

// 5. Dashboard spec
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Dashboard spec", 0.58, 0.55);
  title(slide, "One screen: input, graph, report, recommendations.", 0.55, 0.9, 8.6, 30);
  card(slide, 0.72, 1.9, 3.0, 4.35, { fill: "FFFFFF", line: C.ink });
  card(slide, 4.04, 1.9, 5.3, 4.35, { fill: "FFFFFF", line: C.ink });
  card(slide, 9.66, 1.9, 2.95, 4.35, { fill: "FFFFFF", line: C.ink });
  slide.addText("Product + controls", { x: 0.94, y: 2.18, w: 2.4, h: 0.22, fontSize: 12, bold: true, color: C.blue, margin: 0 });
  slide.addText("Timeline + graph replay", { x: 4.28, y: 2.18, w: 2.5, h: 0.22, fontSize: 12, bold: true, color: C.teal, margin: 0 });
  slide.addText("Report + actions", { x: 9.9, y: 2.18, w: 2.2, h: 0.22, fontSize: 12, bold: true, color: C.orange, margin: 0 });
  bodyText(slide, "Listing headline\nDescription\nPrice + discount\nImage / URL\nVoucher and shipping sliders", 0.96, 2.68, 2.25, 1.6, { fontSize: 10.5, color: C.ink });
  const nodes = [
    [5.0, 3.18, "Students", C.blue],
    [6.64, 2.78, "Parents", C.green],
    [7.72, 3.8, "Resellers", C.red],
    [5.58, 4.42, "Heartland", C.orange],
    [7.0, 5.0, "Pros", C.teal]
  ];
  addArrow(slide, 5.2, 3.38, 6.75, 2.98, C.line, 1.1);
  addArrow(slide, 6.82, 3.05, 7.84, 3.95, C.line, 1.1);
  addArrow(slide, 7.8, 4.05, 7.12, 5.08, C.line, 1.1);
  addArrow(slide, 5.78, 4.53, 7.04, 5.07, C.line, 1.1);
  addArrow(slide, 5.18, 3.45, 5.75, 4.52, C.line, 1.1);
  nodes.forEach(([x, y, l, c]) => addNode(slide, x, y, l, c, 0.38));
  bodyText(slide, "Projected sales index\nConversion likelihood\nBacklash risk\nRecommended listing tweak", 9.94, 2.66, 2.1, 1.3, { fontSize: 10.5, color: C.ink });
  metric(slide, "74", "family bulk-buy fit", 10.06, 4.5, C.green);
  addFooter(slide, 5);
}

// 6. Differentiation
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Differentiation", 0.58, 0.55);
  title(slide, "Not persona polling. Social prediction.", 0.55, 0.9, 7.3, 32);
  const rows = [
    ["Synthetic survey", "Independent persona responses", "Averages opinions"],
    ["WLIAS", "Networked buyer segments with message mutation", "Shows spread, drift, and backlash"],
    ["Why judges remember it", "The graph is the demo", "They can see the listing travel"]
  ];
  rows.forEach(([a, b, c], i) => {
    const y = 2.05 + i * 1.28;
    slide.addShape(pptx.ShapeType.rect, { x: 0.72, y, w: 11.8, h: 0.86, fill: { color: i === 1 ? "E7F4F2" : "FFFFFF" }, line: { color: i === 1 ? C.teal : C.line, width: i === 1 ? 1.4 : 1 } });
    slide.addText(a, { x: 0.98, y: y + 0.2, w: 2.3, h: 0.22, fontSize: 12.5, bold: true, color: i === 1 ? C.teal : C.ink, margin: 0, fit: "shrink" });
    slide.addText(b, { x: 3.75, y: y + 0.2, w: 3.9, h: 0.22, fontSize: 11.5, color: C.ink, margin: 0, fit: "shrink" });
    slide.addText(c, { x: 8.05, y: y + 0.2, w: 3.8, h: 0.22, fontSize: 11.5, color: C.muted, margin: 0, fit: "shrink" });
  });
  slide.addText("Core claim", { x: 0.78, y: 6.15, w: 1.2, h: 0.2, fontSize: 9, bold: true, color: C.orange, margin: 0 });
  bodyText(slide, "WLIAS lets a brand rehearse word-of-mouth before spending real campaign money.", 1.75, 6.02, 7.9, 0.42, { fontSize: 16, color: C.ink, bold: true, margin: 0 });
  addFooter(slide, 6);
}

// 7. Build plan
{
  const slide = pptx.addSlide();
  addBg(slide);
  kicker(slide, "Hackathon execution", 0.58, 0.55);
  title(slide, "Four lanes, one demo contract.", 0.55, 0.9, 7.4, 32);
  const lanes = [
    ["Dashboard demo", "Next.js/Cytoscape live console, 2-minute story", C.blue],
    ["Simulation engine", "Graph generation, 10-tick trace, mutation events", C.teal],
    ["Persona data", "Singapore segments, listing fixtures, mocked signals", C.orange],
    ["Analyst API", "FastAPI endpoint, OpenAI summary, fallback path", C.green]
  ];
  lanes.forEach(([h, b, color], i) => {
    const x = 0.72 + (i % 2) * 6.18;
    const y = 2.05 + Math.floor(i / 2) * 1.55;
    card(slide, x, y, 5.55, 1.12, { fill: "FFFFFF" });
    slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.12, h: 1.12, fill: { color }, line: { color } });
    slide.addText(h, { x: x + 0.32, y: y + 0.2, w: 2.6, h: 0.22, fontSize: 13, bold: true, color, margin: 0, fit: "shrink" });
    bodyText(slide, b, x + 0.32, y + 0.56, 4.65, 0.28, { fontSize: 9.5, color: C.muted, margin: 0 });
  });
  slide.addShape(pptx.ShapeType.line, { x: 1.0, y: 5.45, w: 10.9, h: 0, line: { color: C.line, width: 2 } });
  ["0h", "1h", "3h", "5h"].forEach((t, i) => {
    const x = 1.0 + i * 3.63;
    slide.addShape(pptx.ShapeType.ellipse, { x: x - 0.08, y: 5.37, w: 0.16, h: 0.16, fill: { color: C.ink }, line: { color: C.ink } });
    slide.addText(t, { x: x - 0.18, y: 5.62, w: 0.42, h: 0.16, fontSize: 8.5, bold: true, color: C.ink, align: "center", margin: 0 });
  });
  bodyText(slide, "Scope lock", 0.74, 6.05, 1.3, 0.22, { fontSize: 10, bold: true, color: C.orange, margin: 0 });
  bodyText(slide, "Graph animation first. Faces, voices, live scraping, and backend cleverness only after the deterministic dashboard works.", 1.72, 5.96, 9.4, 0.38, { fontSize: 12, color: C.ink, margin: 0 });
  addFooter(slide, 7);
}

// 8. Closing ask
{
  const slide = pptx.addSlide();
  addBg(slide, true);
  slide.addImage({ path: heroImage, x: 7.0, y: 0.38, w: 5.65, h: 4.88, transparency: 4 });
  kicker(slide, "Demo close", 0.62, 0.74, true);
  slide.addText("WLIAS shows what happens after your customers talk to each other.", {
    x: 0.58,
    y: 1.32,
    w: 6.6,
    h: 1.7,
    fontFace: font.head,
    fontSize: 33,
    bold: true,
    color: C.paper,
    margin: 0.02,
    fit: "shrink"
  });
  const ask = [
    "Upload or paste a listing.",
    "Tune the angles.",
    "Watch the network mutate the message.",
    "Ship the version that survives."
  ];
  ask.forEach((t, i) => {
    const y = 3.42 + i * 0.55;
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.74, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: [C.blue, C.teal, C.orange, C.green][i] }, line: { color: [C.blue, C.teal, C.orange, C.green][i] } });
    bodyText(slide, t, 1.02, y, 4.7, 0.24, { fontSize: 14, color: C.paper, margin: 0 });
  });
  slide.addText("We Live In A Society", { x: 0.72, y: 6.26, w: 3.2, h: 0.28, fontSize: 16, bold: true, color: "71D5CD", margin: 0 });
  addFooter(slide, 8, true);
}

await pptx.writeFile({ fileName: outPath });
console.log(outPath);
