# Dashboard Demo Architecture

## Scope

This folder owns the brand-facing dashboard and 2-minute local demo for the SEA
Social Contagion Lab. All implementation for this slice lives under
`01-dashboard-demo/`.

The dashboard must run without a backend, OpenAI calls, scraping, or network
access during the live demo. External services can be added later behind the
same data interfaces, but the hackathon demo path is deterministic and
client-side.

## Product Goal

Brands should be able to enter or paste a product listing, adjust listing
parameters, and immediately see:

- projected sales performance across Singapore demographics;
- how chatter about the product propagates through a Singapore social network;
- which message variants survive, mutate, or create resistance;
- concrete listing recommendations.

The demo should make the core claim obvious: traditional market research asks
people what they think, while this dashboard shows what happens after they talk
to each other.

## User Flow

1. The brand enters product details:
   - product name;
   - category;
   - price;
   - discount or promotion;
   - product image file or image URL;
   - Shopee listing URL;
   - listing headline and description.
2. The brand adjusts listing parameters:
   - discount level;
   - free shipping emphasis;
   - voucher emphasis;
   - urgency or scarcity level;
   - creator or influencer angle;
   - family bulk-buy angle;
   - premium versus budget positioning.
3. The dashboard updates a deterministic projection.
4. The user reviews:
   - sales report by demographic;
   - Singapore chatter propagation graph;
   - chatter and mutation timeline;
   - recommended listing changes.

## Application Structure

```text
01-dashboard-demo/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    ProductInputPanel.tsx
    ListingParameterControls.tsx
    SingaporeGraphReplay.tsx
    DemographicSalesReport.tsx
    ChatterTimeline.tsx
    ListingRecommendations.tsx
  fixtures/
    shopee_demo_trace.json
  lib/
    demoTrace.ts
    productModel.ts
    simulationProjection.ts
    singaporeSegments.ts
    types.ts
  docs/
    architecture.md
  pitch-deck/
    output/WLIAS-hackathon-pitch.pptx
```

## Data Model

`ProductListing` represents the user input:

```ts
type ProductListing = {
  name: string;
  category: string;
  priceSgd: number;
  discountPercent: number;
  imageUrl: string;
  shopeeUrl: string;
  headline: string;
  description: string;
};
```

`ListingParameters` represents demo controls:

```ts
type ListingParameters = {
  freeShipping: boolean;
  voucherEmphasis: number;
  urgency: number;
  creatorAngle: number;
  familyBulkBuyAngle: number;
  budgetPositioning: number;
  premiumPositioning: number;
};
```

`DemographicProjection` drives the report:

```ts
type DemographicProjection = {
  segmentId: string;
  segmentLabel: string;
  projectedSalesIndex: number;
  conversionLikelihood: number;
  priceSensitivity: number;
  chatterSentiment: "positive" | "mixed" | "negative";
  mainTrigger: string;
  mainObjection: string;
  recommendedTweak: string;
};
```

`PropagationTick` drives the graph and timeline:

```ts
type PropagationTick = {
  tick: number;
  activeNodeIds: string[];
  nodeStates: Record<string, "unexposed" | "aware" | "interested" | "resistant" | "advocate">;
  messageVariants: Record<string, string>;
  chatterVolume: number;
  backlashRisk: number;
};
```

## Singapore Segments

The deterministic demo uses Singapore-specific communities:

- Gen Z students;
- young professionals;
- parents and family buyers;
- heartland value shoppers;
- resellers and livestream sellers;
- category-specific enthusiasts, such as beauty/fashion fandom or tech buyers.

Each segment has fixed baseline traits: price sensitivity, influence, trust
channel, typical objection, and preferred listing angle. The projection logic
combines those traits with the current product listing and parameters.

## Projection Logic

`lib/simulationProjection.ts` is a deterministic scoring layer, not a predictive
model. It should be transparent enough to explain in the pitch.

The projection calculates:

- sales interest from product category fit, price, discount, and positioning;
- conversion likelihood from shipping, voucher emphasis, and trust angle;
- sentiment from mismatch between listing claims and segment objections;
- backlash risk from high urgency, weak discount, or reseller margin pressure;
- message variants from segment-specific reframing rules.

This keeps the demo responsive and reliable while preserving the future backend
contract: later, the same inputs can be sent to `/run-simulation`.

## Interface Layout

The first screen is the product simulation workspace, not a landing page.

```text
+------------------------------------------------------------------+
| Product listing input + parameter controls                        |
+-----------------------------------+------------------------------+
| Singapore social graph replay      | Demographic sales report     |
| chatter propagation                | segment scores + objections  |
+-----------------------------------+------------------------------+
| Chatter and mutation timeline      | Listing recommendations      |
+-----------------------------------+------------------------------+
```

The visual hierarchy should keep the graph and report visible together. The
dashboard should feel like an operational tool for a brand team, not a marketing
site.

## Graph Replay

`SingaporeGraphReplay` renders the Singapore social network.

- Node color represents state:
  - unexposed: neutral gray;
  - aware: teal;
  - interested: blue;
  - advocate: green;
  - resistant: orange/red.
- Node size represents influence.
- Edge intensity represents chatter volume.
- Tick replay advances once per second by default.
- Transitions use about 500ms easing.
- Node tooltip shows segment, state, current message variant, and buying trigger.

The graph can use Cytoscape.js or a lightweight custom SVG if Cytoscape adds too
much setup overhead. The API boundary should stay the same either way.

## Report Output

`DemographicSalesReport` shows one row/card per segment:

- projected sales index;
- conversion likelihood;
- price sensitivity;
- chatter sentiment;
- main buying trigger;
- main objection;
- recommended listing tweak.

The report must include concrete Singapore demographic names rather than generic
persona labels.

## Recommendations

`ListingRecommendations` converts the projection into specific actions, such as:

- increase voucher emphasis for heartland value shoppers;
- reduce urgency language if backlash risk rises;
- emphasize delivery speed for young professionals;
- frame family bulk-buy value for parents;
- avoid reseller-margin claims when reseller resistance rises.

## Demo Fixture

`fixtures/shopee_demo_trace.json` is the locked fallback trace for the live demo.
It should contain the default Shopee-style listing, Singapore segment graph,
10 replay ticks, demographic projections, and recommendations.

The app may later support loading a trace from the parent repo's shared fixtures
or a backend endpoint, but the local fixture remains the primary stopgap.

## Validation

The dashboard slice is complete when:

- `npm run dev` starts the app locally;
- the app renders from `fixtures/shopee_demo_trace.json` with no backend;
- changing listing parameters updates report scores and graph/timeline state;
- the Singapore graph visibly propagates chatter over multiple ticks;
- the report explains projected sales across Singapore demographics;
- the demo can be presented in under 2 minutes.

## Non-Goals

- No live scraping in this slice.
- No live OpenAI call in this slice.
- No backend implementation in this slice.
- No edits outside `01-dashboard-demo/`.
- No faces or voice narration until the core dashboard is running.
