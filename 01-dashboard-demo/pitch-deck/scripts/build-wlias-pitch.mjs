import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "output", "WLIAS-hackathon-pitch.pptx");
const heroImage = path.join(root, "assets", "wlias-oracle-network.png");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "WLIAS Hackathon Team";
pptx.company = "SEA Codex";
pptx.subject = "Editable WLIAS hackathon pitch deck";
pptx.title = "WLIAS: We Live In A Society";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US"
};

const C = {
  ink: "251F19",
  ink2: "3C332A",
  paper: "F4EEE4",
  paperStrong: "FFFAF1",
  line: "D8CBB8",
  muted: "766A59",
  teal: "13877E",
  blue: "315FBA",
  green: "24885A",
  orange: "D85D2A",
  red: "B83B2D",
  night: "111823",
  night2: "1B2633",
  white: "FFFAF1"
};

const W = 13.333;
const H = 7.5;
const font = { head: "Georgia", body: "Aptos" };

function bg(slide, dark = false) {
  slide.background = { color: dark ? C.night : C.paper };
  if (dark) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: C.night },
      line: { transparency: 100 }
    });
    slide.addShape(pptx.ShapeType.arc, {
      x: 8.5,
      y: 0.4,
      w: 5.8,
      h: 5.8,
      adjustPoint: 0.3,
      line: { color: C.teal, transparency: 70, width: 2 }
    });
    slide.addShape(pptx.ShapeType.arc, {
      x: 9.8,
      y: 3.1,
      w: 4.6,
      h: 4.6,
      adjustPoint: 0.45,
      line: { color: C.orange, transparency: 72, width: 2 }
    });
    return;
  }

  for (let x = 0.45; x < W; x += 0.58) {
    slide.addShape(pptx.ShapeType.line, {
      x,
      y: 0,
      w: 0,
      h: H,
      line: { color: "E6DCCD", transparency: 42, width: 0.35 }
    });
  }
  for (let y = 0.45; y < H; y += 0.58) {
    slide.addShape(pptx.ShapeType.line, {
      x: 0,
      y,
      w: W,
      h: 0,
      line: { color: "E6DCCD", transparency: 42, width: 0.35 }
    });
  }
}

function top(slide, label, n, dark = false) {
  text(slide, label.toUpperCase(), 0.55, 0.42, 5.8, 0.22, {
    size: 8.5,
    bold: true,
    color: dark ? "7FE0D7" : C.teal,
    margin: 0
  });
  text(slide, `${String(n).padStart(2, "0")} / 08`, 12.05, 0.42, 0.75, 0.22, {
    size: 8.5,
    bold: true,
    color: dark ? "CBBFAC" : C.muted,
    align: "right",
    margin: 0
  });
}

function footer(slide, copy, dark = false) {
  text(slide, copy, 0.55, 7.08, 6.5, 0.2, {
    size: 8.2,
    bold: true,
    color: dark ? "CBBFAC" : C.muted,
    margin: 0
  });
  text(slide, "WLIAS / We Live In A Society", 10.2, 7.08, 2.6, 0.2, {
    size: 8.2,
    bold: true,
    color: dark ? "CBBFAC" : C.muted,
    align: "right",
    margin: 0
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    fontFace: opts.font ?? font.body,
    fontSize: opts.size ?? 13,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    align: opts.align ?? "left",
    valign: opts.valign ?? "mid",
    margin: opts.margin ?? 0.05,
    breakLine: false,
    fit: "shrink",
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 2
  });
}

function headline(slide, value, x, y, w, h, dark = false, size = 41) {
  text(slide, value, x, y, w, h, {
    font: font.head,
    size,
    bold: true,
    color: dark ? C.white : C.ink,
    margin: 0.02,
    paraSpaceAfterPt: 0
  });
}

function subhead(slide, value, x, y, w, h, dark = false, size = 18) {
  text(slide, value, x, y, w, h, {
    size,
    bold: true,
    color: dark ? "D9CEBD" : C.muted,
    margin: 0.02,
    paraSpaceAfterPt: 0
  });
}

function rect(slide, x, y, w, h, opts = {}) {
  slide.addShape(opts.shape ?? pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    rectRadius: opts.radius ?? 0.05,
    fill: { color: opts.fill ?? C.paperStrong, transparency: opts.transparency ?? 0 },
    line: { color: opts.line ?? C.line, transparency: opts.lineTransparency ?? 0, width: opts.width ?? 1 }
  });
}

function circle(slide, x, y, s, fill, line = C.ink) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: s,
    h: s,
    fill: { color: fill },
    line: { color: line, width: 1.1 }
  });
}

function arrow(slide, x1, y1, x2, y2, color = C.line, width = 1.2) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, endArrowType: "triangle" }
  });
}

function pill(slide, value, x, y, w, color) {
  rect(slide, x, y, w, 0.34, { fill: color, line: color, shape: pptx.ShapeType.roundRect, radius: 0.07 });
  text(slide, value, x + 0.08, y + 0.08, w - 0.16, 0.16, {
    size: 7.8,
    bold: true,
    color: "FFFFFF",
    align: "center",
    margin: 0
  });
}

function card(slide, x, y, w, h, title, body, accent = C.teal) {
  rect(slide, x, y, w, h, { fill: C.paperStrong });
  rect(slide, x, y, 0.12, h, { fill: accent, line: accent });
  text(slide, title, x + 0.28, y + 0.24, w - 0.56, 0.32, {
    font: font.head,
    size: 17,
    bold: true,
    color: C.ink,
    margin: 0
  });
  text(slide, body, x + 0.28, y + 0.72, w - 0.52, h - 0.96, {
    size: 11,
    bold: true,
    color: C.muted,
    valign: "top"
  });
}

function smallNode(slide, x, y, label, color, size = 0.62) {
  circle(slide, x, y, size, color);
  text(slide, label, x - 0.22, y + size + 0.07, size + 0.44, 0.22, {
    size: 6.8,
    bold: true,
    color: C.ink,
    align: "center",
    margin: 0
  });
}

// 1. Title
{
  const slide = pptx.addSlide();
  bg(slide, true);
  top(slide, "Hackathon pitch / WLIAS", 1, true);
  slide.addImage({ path: heroImage, x: 6.55, y: 0.75, w: 6.25, h: 5.45, transparency: 4 });
  rect(slide, 6.55, 0.75, 6.25, 5.45, { fill: C.night, transparency: 82, line: "FFFFFF", lineTransparency: 82 });
  circle(slide, 0.72, 1.06, 0.58, C.night, "7FE0D7");
  text(slide, "W", 0.91, 1.23, 0.2, 0.16, { size: 12, bold: true, color: "7FE0D7", align: "center", margin: 0 });
  text(slide, "WLIAS", 1.48, 1.13, 1.4, 0.22, { size: 13, bold: true, color: C.white, margin: 0 });
  text(slide, "We Live In A Society", 1.48, 1.38, 2.2, 0.18, { size: 9.5, bold: true, color: "CBBFAC", margin: 0 });
  headline(slide, "Test the ad before society gets to it.", 0.72, 2.02, 5.75, 1.86, true, 42);
  subhead(slide, "WLIAS helps brands see how a product listing or marketing ad spreads, mutates, and backfires across buyer networks before launch.", 0.76, 4.12, 5.4, 0.84, true, 16);
  pill(slide, "Brand ad reaction simulator", 0.76, 5.32, 1.96, C.teal);
  pill(slide, "Editable PPTX", 2.92, 5.32, 1.22, C.blue);
  pill(slide, "Google Slides ready", 4.32, 5.32, 1.56, C.orange);
  footer(slide, "Product listing contagion console", true);
}

// 2. Problem
{
  const slide = pptx.addSlide();
  bg(slide);
  top(slide, "The brand problem", 2);
  headline(slide, "The ad is not the campaign. The reaction is.", 0.62, 0.98, 7.55, 1.28, false, 38);
  subhead(slide, "A brand can optimize copy, price, and visuals, but the real outcome depends on what customers say to each other.", 0.66, 2.36, 6.8, 0.55);

  const items = [
    ["Survey answers are isolated", "Personas tell you what one buyer thinks, not how their group chat changes the story.", C.blue],
    ["Marketing copy mutates", "A discount becomes a reseller margin complaint, a family deal, or a creator-code debate.", C.orange],
    ["Backlash arrives late", "Brands usually learn the risky segment after the campaign is already public.", C.red]
  ];
  items.forEach(([t, b, color], i) => card(slide, 0.7 + i * 4.0, 3.45, 3.55, 1.88, t, b, color));
  text(slide, "Traditional research asks. WLIAS simulates.", 0.72, 6.05, 8.2, 0.38, {
    font: font.head,
    size: 25,
    bold: true,
    color: C.ink
  });
  footer(slide, "The missing layer is the social reaction.");
}

// 3. Product flow
{
  const slide = pptx.addSlide();
  bg(slide);
  top(slide, "What WLIAS does", 3);
  headline(slide, "A brand rehearses word-of-mouth.", 0.62, 0.98, 7.8, 0.96, false, 40);

  const steps = [
    ["Paste the listing", "Product, price, image, headline, campaign angle, Shopee URL, and description.", C.blue],
    ["Tune the ad", "Voucher emphasis, free shipping, urgency, creator angle, family bulk-buy framing.", C.teal],
    ["Simulate society", "Buyer segments react, share, mutate, resist, and amplify across a social graph.", C.orange],
    ["Change the plan", "WLIAS recommends what to rewrite, which segment to target, and what to avoid.", C.green]
  ];

  steps.forEach(([t, b, color], i) => {
    const x = 0.7 + i * 3.05;
    rect(slide, x, 2.45, 2.55, 2.72, { fill: C.paperStrong });
    circle(slide, x + 0.22, 2.75, 0.48, C.ink);
    text(slide, String(i + 1), x + 0.39, 2.9, 0.14, 0.12, {
      size: 8,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0
    });
    text(slide, t, x + 0.22, 3.62, 2.05, 0.42, {
      font: font.head,
      size: 20,
      bold: true,
      color: C.ink,
      margin: 0
    });
    text(slide, b, x + 0.22, 4.15, 2.08, 0.62, {
      size: 9.6,
      bold: true,
      color: C.muted,
      valign: "top"
    });
    if (i < steps.length - 1) arrow(slide, x + 2.66, 3.82, x + 2.92, 3.82, color, 1.2);
  });

  text(slide, "Input → reaction → mutation → recommendation", 0.72, 6.02, 7.6, 0.36, {
    font: font.head,
    size: 25,
    bold: true,
    color: C.ink
  });
  footer(slide, "This is a rehearsal system for marketing decisions.");
}

// 4. Demo dashboard
{
  const slide = pptx.addSlide();
  bg(slide);
  top(slide, "Live demo screen", 4);
  headline(slide, "The dashboard makes the social reaction visible.", 0.6, 0.86, 8.1, 0.86, false, 34);

  rect(slide, 0.68, 2.0, 3.05, 4.35, { fill: C.paperStrong });
  rect(slide, 4.0, 2.0, 5.25, 4.35, { fill: C.paperStrong });
  rect(slide, 9.52, 2.0, 3.05, 4.35, { fill: C.paperStrong });

  text(slide, "Brand input", 0.93, 2.25, 1.7, 0.28, { font: font.head, size: 20, bold: true });
  [
    ["Product", "Hydrating sunscreen bundle"],
    ["Campaign line", "11.11 lowest prices for every family"],
    ["Voucher emphasis", "high"],
    ["Urgency", "medium-high"]
  ].forEach(([label, value], i) => {
    const y = 2.86 + i * 0.72;
    text(slide, label.toUpperCase(), 0.94, y, 1.5, 0.14, { size: 6.8, bold: true, color: C.teal, margin: 0 });
    text(slide, value, 0.94, y + 0.18, 2.35, 0.26, { size: 11, bold: true, color: C.ink, margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x: 0.94, y: y + 0.52, w: 2.25, h: 0, line: { color: C.line, width: 0.7 } });
  });

  text(slide, "Social graph replay", 4.28, 2.25, 2.3, 0.28, { font: font.head, size: 20, bold: true });
  // Edges first.
  arrow(slide, 5.05, 3.32, 6.35, 3.62, C.line, 1.0);
  arrow(slide, 6.62, 3.72, 7.65, 3.18, C.line, 1.0);
  arrow(slide, 5.42, 4.94, 6.55, 4.0, C.line, 1.0);
  arrow(slide, 6.95, 4.2, 7.72, 5.05, C.line, 1.0);
  smallNode(slide, 4.62, 3.0, "Gen Z", C.blue, 0.72);
  smallNode(slide, 6.25, 3.46, "Parents", C.green, 0.92);
  smallNode(slide, 7.78, 2.86, "Reseller", C.orange, 0.72);
  smallNode(slide, 5.3, 5.02, "Heartland", C.teal, 0.84);
  smallNode(slide, 7.86, 5.12, "Risk", C.red, 0.66);

  text(slide, "WLIAS verdict", 9.82, 2.25, 1.9, 0.28, { font: font.head, size: 20, bold: true });
  const recs = [
    ["Lead with family bundle value", "Parents and heartland shoppers amplify this frame.", C.teal],
    ["Reduce urgency language", "High urgency feels suspicious to young professionals.", C.orange],
    ["Avoid reseller-margin claims", "Reseller nodes turn the ad into a margin complaint.", C.red]
  ];
  recs.forEach(([t, b, color], i) => {
    const y = 2.9 + i * 0.98;
    rect(slide, 9.85, y, 2.15, 0.74, { fill: "F6EFE3", line: "F6EFE3" });
    rect(slide, 9.85, y, 0.08, 0.74, { fill: color, line: color });
    text(slide, t, 10.02, y + 0.12, 1.82, 0.18, { size: 9.2, bold: true, color: C.ink, margin: 0 });
    text(slide, b, 10.02, y + 0.34, 1.82, 0.24, { size: 7.8, bold: true, color: C.muted, margin: 0 });
  });
  footer(slide, "One screen, one story: society reacts.");
}

// 5. Mutation
{
  const slide = pptx.addSlide();
  bg(slide);
  top(slide, "Why the graph matters", 5);
  headline(slide, "The same ad becomes different stories.", 0.62, 0.9, 8.0, 0.9, false, 38);

  const rows = [
    ["Tick 0", "11.11 lowest prices for every family.", "Brand message", C.blue],
    ["Tick 3", "Good for family bulk buys if the voucher stacks.", "Parents and heartland shoppers", C.green],
    ["Tick 6", "Looks cheap, but are the seller margins even worth it?", "Reseller network", C.red],
    ["Tick 9", "Best version: bundle value, clear vouchers, no fake urgency.", "WLIAS recommendation", C.teal]
  ];
  rows.forEach(([tick, copy, source, color], i) => {
    const y = 2.16 + i * 0.98;
    rect(slide, 0.78, y, 11.8, 0.72, { fill: C.paperStrong });
    text(slide, tick, 1.02, y + 0.22, 1.0, 0.18, { size: 10.5, bold: true, color, margin: 0 });
    text(slide, copy, 2.18, y + 0.14, 7.05, 0.3, { font: font.head, size: 17.5, bold: true, color: C.ink, margin: 0 });
    text(slide, source, 9.6, y + 0.22, 2.4, 0.18, { size: 8.8, bold: true, color: C.muted, align: "right", margin: 0 });
  });
  footer(slide, "Mutation is the demo, not an extra chart.");
}

// 6. Before and after
{
  const slide = pptx.addSlide();
  bg(slide);
  top(slide, "Brand outcome", 6);
  headline(slide, "WLIAS turns reaction into edits.", 0.62, 0.9, 7.3, 0.9, false, 38);

  rect(slide, 0.82, 2.1, 5.55, 3.9, { fill: C.paperStrong });
  rect(slide, 6.88, 2.1, 5.55, 3.9, { fill: C.paperStrong, line: C.teal, width: 1.4 });
  text(slide, "BEFORE WLIAS", 1.12, 2.43, 1.6, 0.2, { size: 8.8, bold: true, color: C.muted, margin: 0 });
  headline(slide, "Lowest prices. Limited time. Buy now.", 1.12, 3.0, 4.3, 0.9, false, 27);
  [
    "Generic urgency competes with every marketplace ad.",
    "Reseller segment reframes the deal as margin pressure.",
    "High backlash risk stays hidden until launch."
  ].forEach((b, i) => text(slide, `• ${b}`, 1.2, 4.3 + i * 0.34, 4.45, 0.22, { size: 10.5, bold: true, color: C.muted, margin: 0 }));

  text(slide, "AFTER WLIAS", 7.18, 2.43, 1.5, 0.2, { size: 8.8, bold: true, color: C.teal, margin: 0 });
  headline(slide, "Bundle value for families, clear voucher math.", 7.18, 3.0, 4.65, 0.9, false, 27);
  [
    "Family and value-shopper segments amplify the message.",
    "Voucher clarity removes suspicion around the promotion.",
    "Reseller claims are removed before they become backlash."
  ].forEach((b, i) => text(slide, `• ${b}`, 7.26, 4.3 + i * 0.34, 4.45, 0.22, { size: 10.5, bold: true, color: C.muted, margin: 0 }));
  footer(slide, "The product is pre-launch correction, not just prediction.");
}

// 7. Why now
{
  const slide = pptx.addSlide();
  bg(slide, true);
  top(slide, "Why now", 7, true);
  headline(slide, "OpenAI makes the missing layer possible.", 0.72, 1.0, 5.65, 1.68, true, 39);
  subhead(slide, "Vision models read marketing assets. Language models simulate reactions. WLIAS adds the network layer that shows how those reactions collide.", 0.76, 3.0, 5.45, 0.9, true, 15.5);

  const nums = [
    ["1", "Product listing or ad creative as input."],
    ["6", "Singapore buyer segments in the dashboard demo."],
    ["10", "Replay ticks showing spread, mutation, and resistance."],
    ["0", "Live API calls needed for the pitch demo path."]
  ];
  nums.forEach(([n, b], i) => {
    const x = 7.0 + (i % 2) * 2.55;
    const y = 1.35 + Math.floor(i / 2) * 2.0;
    rect(slide, x, y, 2.25, 1.52, { fill: "FFFAF1", transparency: 92, line: "FFFAF1", lineTransparency: 80 });
    text(slide, n, x + 0.22, y + 0.18, 0.72, 0.48, { font: font.head, size: 32, bold: true, color: "7FE0D7", margin: 0 });
    text(slide, b, x + 0.22, y + 0.82, 1.78, 0.42, { size: 9.5, bold: true, color: "E6DAC7", valign: "top" });
  });
  footer(slide, "Grounded now, extensible later.", true);
}

// 8. Close
{
  const slide = pptx.addSlide();
  bg(slide, true);
  top(slide, "Close", 8, true);
  pill(slide, "WLIAS", 0.72, 1.06, 0.78, C.teal);
  headline(slide, "We show brands what society will do to their marketing.", 0.72, 1.72, 8.6, 1.7, true, 44);
  subhead(slide, "The ask: let us demo a listing, tune the ad live, and show which version survives the network.", 0.76, 4.08, 6.6, 0.72, true, 18);
  slide.addImage({ path: heroImage, x: 8.4, y: 1.05, w: 4.1, h: 3.6, transparency: 12 });
  text(slide, "We Live In A Society", 0.76, 5.82, 3.6, 0.3, { size: 16, bold: true, color: "7FE0D7", margin: 0 });
  footer(slide, "End", true);
}

await pptx.writeFile({ fileName: outPath });
console.log(outPath);
