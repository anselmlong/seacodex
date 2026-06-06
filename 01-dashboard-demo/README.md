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
- Hackathon pitch deck in `pitch-deck/output/WLIAS-hackathon-pitch.pptx`.

## Contract

Keep the dashboard self-contained for the live demo. Backend and shared-contract integration can be added later only after the local replay path is stable.

The dashboard must run without the backend by loading local deterministic data and projection functions.

## Stop Condition

Demo can run locally in under 2 minutes with no live API dependency, and the pitch deck is available for the hackathon presentation.
