# Analyst API

## Target Result

Expose the backend surface needed by the dashboard and generate the final analyst recommendation.

## Build

- FastAPI endpoint: `POST /run-simulation`.
- Return the precomputed trace by default.
- Optional OpenAI calls:
  - Vision extraction for campaign image signals.
  - Analyst summary after simulation replay.
- Fallback to `../shared/fixtures/golden_trace.json` and a static analyst summary when APIs fail.

## Contract

Return trace data matching `../shared/contracts/simulation-trace.schema.json`.

Return analyst data matching `../shared/contracts/analyst-summary.schema.json`.

## Stop Condition

Dashboard can call the API successfully, and the API still returns useful demo data without network access.

