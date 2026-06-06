# SEA Social Contagion Lab

Hackathon scaffold for the approved design doc:
`~/.gstack/projects/Projects/anselmlong-main-design-20260606-112705.md`.

Core demo line:

> Traditional synthetic persona tools ask 100 people what they think. We simulate what happens after those 100 people talk to each other.

## Four Work Lanes

### `01-dashboard-demo/`

Owner: Anselm.

Build the 2-minute demo surface: campaign input, animated graph replay, adoption/backlash charts, mutation tree, and final analyst panel.

Recommended stack: Next.js + Cytoscape.js. The dashboard should be able to run entirely from `shared/fixtures/golden_trace.json` if backend work is not ready.

### `02-simulation-engine/`

Owner: teammate 2.

Generate the social graph and 10-tick campaign propagation trace. This lane owns persona state transitions, message mutation, adoption/backlash events, and golden trace generation.

Recommended stack: Python + NetworkX, with Mesa only if it speeds implementation.

### `03-persona-data-pipeline/`

Owner: teammate 3.

Prepare SEA persona seed data and mocked social-media/campaign inputs. This lane turns the SEA data source plus mocked post/image signals into the persona JSON consumed by the simulator.

Recommended stack: Python scripts plus static JSON fixtures.

### `04-analyst-api/`

Owner: teammate 4.

Expose the minimal backend and analyst output for the demo. This lane owns `/run-simulation`, the OpenAI analyst summary call, and fallback behavior when API calls fail.

Recommended stack: FastAPI + OpenAI API.

## Shared Contracts

All lanes should treat files in `shared/contracts/` as integration boundaries:

- `persona.schema.json`: input shape for generated personas.
- `simulation-trace.schema.json`: replay trace consumed by the dashboard.
- `analyst-summary.schema.json`: final recommendation shape.

Use `shared/fixtures/golden_trace.json` as the dashboard fallback and demo rehearsal artifact.

## Demo Scope

Ship the graph animation first. Faces, voices, live scraping, and MiroFish integration are stretch goals only after the core demo can run end to end.
