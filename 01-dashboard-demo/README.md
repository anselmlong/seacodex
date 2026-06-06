# Dashboard + Demo

Owner: Anselm.

## Target Result

A judge can tune a product listing, watch chatter propagate through Singapore buyer segments, see message mutation/backlash risk, and read concrete listing recommendations.

## Build

- Next.js dashboard app.
- Cytoscape.js graph replay from `fixtures/shopee_demo_trace.json` and deterministic projection code in `lib/`.
- Product listing input panel with a scripted Shopee-style demo default.
- Timeline controls: play, pause, reset, tick speed.
- Panels for projected sales, demographic response, chatter volume, backlash risk, mutation timeline, and listing recommendations.
- Primary hackathon pitch deck in `pitch-deck/html/index.html`.
- Secondary PowerPoint artifact in `pitch-deck/output/WLIAS-hackathon-pitch.pptx`.

## Contract

Keep the dashboard self-contained for the live demo. Backend and shared-contract integration can be added later only after the local replay path is stable.

The dashboard must run without the backend by loading local deterministic data and projection functions.

## Stop Condition

Demo can run locally in under 2 minutes with no live API dependency, and the HTML pitch deck is available for the hackathon presentation.

## Combined MiroFish workflow

The teammate Vue workflow has been rewritten into this same Next.js page in React.

### Local run

Run the combined page:

```bash
cd ..
npm run dev
```

The workflow section supports:

- Ontology generation (`/api/graph/ontology/generate`)
- Graph construction (`/api/graph/build`)
- Simulation creation and start (`/api/simulation/create`, `/api/simulation/start`)
- Analyst report generation (`/api/report/generate`)

By default, API base URL is `http://localhost:5001` and can be changed with `NEXT_PUBLIC_MIROFISH_API_URL`.

## Vercel deployment (standard web layout)

From repository root:

```bash
npm install
npm run build
```

Vercel uses root configuration (`vercel.json`) with `buildCommand: npm run build` and deploys `.next` as the production output.
