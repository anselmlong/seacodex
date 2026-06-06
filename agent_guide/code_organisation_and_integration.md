# Code Organisation and Integration Guide

Use this guide when adding code to the SEA Social Contagion Lab. The goal is to keep
parallel agent work compatible while the repo moves from scaffold to demo.

## Core Rule

Each lane should own its implementation, but all lanes must integrate through
`shared/contracts/` and checked-in fixtures. Do not make another lane depend on
private globals, ad hoc response shapes, local screenshots, live scraping, or live
LLM calls for the main demo path.

## Lane Responsibilities

### `01-dashboard-demo/`

Owns the judge-facing replay experience.

- Build the interactive app here, preferably with the stack named in the lane README.
- Consume simulation data through `shared/contracts/simulation-trace.schema.json`.
- Run without backend access by loading `shared/fixtures/golden_trace.json`.
- Treat API calls as optional enhancement: the fallback trace must still work.
- Keep presentation-specific components here, not in the simulator or API lanes.

### `02-simulation-engine/`

Owns simulation logic, graph generation, state transitions, and trace export.

- Keep reusable simulation logic separate from UI code.
- Export or expose a deterministic `runSimulation(input, personasOrSwarm)` path.
- Output objects that validate against `shared/contracts/simulation-trace.schema.json`.
- Keep browser mock UI code in clearly named files such as `index.html`, `styles.css`,
  and `src/app.js`; do not make the core engine require DOM access.
- If adding a Python or Node CLI, make it write a checked-in or reproducible
  `simulation_trace.json` style artifact.

### `03-persona-data-pipeline/`

Owns persona fixtures and mocked social/product signals.

- Store demo-safe fixtures in this lane, for example `fixtures/personas.json` and
  `fixtures/campaign_signals.json`.
- Every persona fixture must validate against `shared/contracts/persona.schema.json`.
- Live scraping or external APIs should be optional and never required during demo.
- Normalize data before it reaches the simulator; the simulator should not clean up
  malformed persona records at runtime.

### `04-analyst-api/`

Owns the backend interface and optional analyst generation.

- Implement `POST /run-simulation` here.
- Return the simulation trace using `shared/contracts/simulation-trace.schema.json`.
- Return or embed analyst output using `shared/contracts/analyst-summary.schema.json`.
- Fall back to `shared/fixtures/golden_trace.json` when simulation, OpenAI, or network
  calls are unavailable.
- Keep secrets in environment variables only. Never commit API keys or credentials.

### `shared/`

Owns integration boundaries.

- `shared/contracts/` is the source of truth for cross-lane data shapes.
- `shared/fixtures/golden_trace.json` is the minimum reliable demo artifact.
- Update schemas before changing data shape, then update all consumers in the same
  branch or clearly document the migration.

## Integration Flow

Use this target flow for new work:

```text
03-persona-data-pipeline fixtures
  -> 02-simulation-engine runSimulation
  -> simulation trace matching shared/contracts
  -> 04-analyst-api /run-simulation
  -> 01-dashboard-demo replay UI
```

The static simulator mock can remain as a useful local prototype, but it should not
be the only integration path once the API and dashboard exist.

## File Placement Rules

- Put reusable code in lane-local `src/` folders.
- Put lane-specific tests beside the lane they verify, such as
  `02-simulation-engine/tests/`.
- Put cross-lane validation scripts in a root `scripts/` folder if multiple lanes use
  them.
- Put demo fixtures under the producing lane or `shared/fixtures/` when they are
  consumed by more than one lane.
- Do not commit generated screenshots, browser captures, local caches, dependency
  folders, credentials, or temporary exports unless the README explicitly names them
  as demo assets.

## Compatibility Checklist

Before pushing a branch, check:

- JSON files parse cleanly.
- Persona fixtures match `shared/contracts/persona.schema.json`.
- Simulation traces match `shared/contracts/simulation-trace.schema.json`.
- Analyst summaries match `shared/contracts/analyst-summary.schema.json`.
- The dashboard can still load `shared/fixtures/golden_trace.json`.
- The demo path runs without live API, scraping, or LLM dependencies.
- Any new command is documented in the relevant lane README.

## Contract Change Policy

Schema changes are allowed, but they are integration changes.

When changing a schema:

1. Update the schema in `shared/contracts/`.
2. Update `shared/fixtures/golden_trace.json` or persona fixtures if affected.
3. Update all current producers and consumers.
4. Mention the contract change in the commit or PR description.

Avoid adding optional fields casually. Prefer a small stable contract that every lane
can reliably produce and consume during the hackathon demo.

## Demo Readiness Priority

If time is short, prioritize in this order:

1. Dashboard replay from `shared/fixtures/golden_trace.json`.
2. API endpoint returning the fallback trace.
3. Simulator generating a fresh compatible trace.
4. Persona pipeline fixtures feeding the simulator.
5. Optional OpenAI, MiroFish-like, scraping, image, or richer agentic analysis layers.

The judging demo should never fail because a stretch integration is unavailable.
