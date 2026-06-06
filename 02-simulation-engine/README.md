# Simulation Engine

## Target Result

Produce a deterministic `simulation_trace.json` for a 10-tick campaign propagation run.

This folder now includes a local interactive prototype:

```text
02-simulation-engine/index.html
```

It lets a user ask messy analyst questions like:

> We are considering priority delivery slots for parents buying laptops after payday. Will this lift conversion on Shopee, or should we lead with warranty proof first?

The UI infers product category, app or campaign change, demographic, and platform
from the question, runs a deterministic persona-swarm simulation, shows trend
curves, renders an aggregate graph network for thousands of modeled users, and
previews a schema-aligned simulation trace that can later be returned by
`04-analyst-api`.

## Build

- Generate a stochastic block model social graph with fixed seed `42`.
- Communities: family, workplace, fandom, reseller, school/university.
- Persona states: `unexposed`, `exposed`, `adopted`, `resistant`.
- Events per tick: exposure, adoption, resistance, reshare, mutation.
- Export a trace matching `../shared/contracts/simulation-trace.schema.json`.

## Demo Rule

Precompute the full trace before the live demo. Do not require live LLM calls during graph animation.

The current prototype has no live network or LLM dependency. It uses a local mock
swarm shaped after the `03-persona-data-pipeline` contract and can be swapped to
pipeline-generated fixtures once that lane lands richer persona data.

## Stop Condition

`../shared/fixtures/golden_trace.json` contains a complete 10-tick replay with at least one visible message mutation and one backlash pathway.

## Push-ready structure (folder-scoped)

```text
02-simulation-engine/
├── index.html
├── styles.css
├── src/
│   ├── app.js
│   ├── persona-swarm-data.js
│   └── simulation-engine.js
├── prepare_layer1_layer2.py
├── prepare_layer3_mirofish.py
├── prepare_layer4_model_integration.py
├── prepare_layer5_graph_network_analysis.py
├── prepare_layer6_simulation_engine.py
├── market-analysis-layer-skill-map.json
├── market-analysis-layer-skill-map.md
├── shared/contracts/simulation-trace.schema.json
└── mirofish/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── README.md
    ├── .env.example
    ├── backend/
    │   ├── app/
    │   ├── requirements.txt
    │   ├── pyproject.toml
    │   ├── run.py
    │   └── scripts/
    └── frontend/
        ├── src/
        ├── public/
        ├── index.html
        └── package.json
```

Note: this structure excludes `node_modules`, `.venv`, `.env`, log files, and runtime uploads so this folder remains push-safe.
