# Dashboard + Demo

Owner: Anselm.

## Target Result

A judge can watch a campaign propagate through a SEA social graph, see message mutation and backlash hotspots, then read a specific analyst recommendation.

## Build

- Next.js app shell.
- Cytoscape.js graph replay from `../shared/fixtures/golden_trace.json`.
- Campaign input panel with a scripted Shopee 11.11 demo default.
- Timeline controls: play, pause, reset, tick speed.
- Panels for adoption curve, backlash risk, mutation tree, and analyst summary.

## Contract

Consume `../shared/contracts/simulation-trace.schema.json` and `../shared/contracts/analyst-summary.schema.json`.

The dashboard must run without the backend by loading `../shared/fixtures/golden_trace.json`.

## Stop Condition

Demo can run locally in under 2 minutes with no live API dependency.

