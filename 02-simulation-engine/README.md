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

## Current status

- `index.html` plus `src/`/`styles.css` is the currently used local prototype path.
- `shared/contracts/simulation-trace.schema.json` is the active contract for trace output.
- `prepare_layer*.py` scripts and the `mirofish/` subtree are included for future integration and alignment.
- `mirofish/` is not currently wired into the primary local demo flow.

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

## Layer 1/2 split recommendation (research-informed)

For recommendation/churn modeling downstream, use a split that preserves feature
distribution to avoid leakage and overfitting:

- Standard baseline: `train:val:test = 70:15:15` with a fixed seed.
- If sample size is very small, reduce to `80:10:10` or `60:20:20`.
- Prefer stratified split over random split when you need each side to preserve
  industry/planning-area/country balance.
- Keep ground-truth anchors and synthetic rows in the same sampling pool, but track
  them as a metadata flag so you can audit whether GT is in `train`, `val`, or `test`.

Implementation (already added):

```bash
python /Users/kyiwaithant/Documents/Shopee/seacodex/02-simulation-engine/prepare_layer1_layer2.py \
  --run both \
  --n 200 \
  --seed 42 \
  --split \
  --split-strategy stratified \
  --split-by industry \
  --split-train-ratio 0.7 \
  --split-val-ratio 0.15 \
  --split-test-ratio 0.15 \
  --ground-truth-json /Users/kyiwaithant/Downloads/bern.ice__profile.json \
  --ground-truth-mode append
```

Artifacts produced:

- `market_analysis_layer1_layer2/layer2/personas_initial_n{N}_seed{S}.jsonl`
- `market_analysis_layer1_layer2/layer2/splits/{strategy}_{split_by}_seed{S}/personas_{split}.jsonl`
- `market_analysis_layer1_layer2/layer2/layer2_report.json`
- The split metadata is also written into the Layer 2 report so automation can pick
  paths automatically.

## How to use this folder today

1. Use `02-simulation-engine/index.html` as the canonical local simulation entry point.
2. Keep emitted trace fields compatible with `../shared/contracts/simulation-trace.schema.json`.
3. Regenerate `../shared/fixtures/golden_trace.json` only when contracts change.

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
