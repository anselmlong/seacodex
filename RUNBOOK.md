# Dashboard-First Runbook

Use this runbook to run the current demo and understand how the four lanes should
fit together. The dashboard is the main product surface. Other lanes should feed it
without making it depend on live network calls during the presentation.

## Current Runnable Pieces

### `01-dashboard-demo`

Status: runnable Next.js dashboard after dependencies are installed.

Purpose: the judge-facing demo surface. It lets a user tune a Shopee-style product
listing and watch projected Singapore segment response, chatter propagation,
backlash risk, and listing recommendations.

Run:

```powershell
cd 01-dashboard-demo
npm ci
npm run dev -- --port 3000
```

Open:

```text
http://localhost:3000
```

### `02-simulation-engine`

Status: runnable static browser mockup.

Purpose: prototype for agent-style product/app-change simulation, graph network,
trend curves, trace output, and analyst answer. It currently runs independently of
the dashboard.

Open directly:

```text
02-simulation-engine/index.html
```

Or serve it locally:

```powershell
python -m http.server 3100 --directory 02-simulation-engine
```

Open:

```text
http://localhost:3100
```

### `03-persona-data-pipeline`

Status: README-only lane.

Expected next runnable output: checked-in persona and campaign fixtures that validate
against `shared/contracts/persona.schema.json`.

### `04-analyst-api`

Status: README-only lane.

Expected next runnable output: `POST /run-simulation`, returning a trace compatible
with `shared/contracts/simulation-trace.schema.json` and a fallback response from
`shared/fixtures/golden_trace.json`.

## Concurrent Local Run

From the repo root:

```powershell
.\scripts\dev-all.cmd
```

If running the PowerShell script directly, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-all.ps1
```

The script starts:

- dashboard on `http://localhost:3000`;
- static simulation mock on `http://localhost:3100` when Python is available;
- API server only if `04-analyst-api` later adds a recognizable FastAPI entrypoint.

Use the dashboard as the primary tab. The simulation engine tab is a supporting
prototype until its core logic is wired behind the API.

## Target Integration Flow

```text
03-persona-data-pipeline fixtures
  -> 02-simulation-engine core simulation
  -> 04-analyst-api /run-simulation
  -> 01-dashboard-demo primary dashboard
```

## Dashboard Integration Priority

1. Keep `01-dashboard-demo` runnable without the API.
2. Add a dashboard data adapter that can read either local deterministic projection
   data or `/run-simulation`.
3. Make `/run-simulation` return the shared trace shape.
4. Map shared trace ticks into the dashboard graph/timeline state.
5. Keep the current dashboard controls close to their visible consequences.

The dashboard should stay the command center. Other lanes should enrich it, not
replace it with separate demo surfaces.

## Known Gaps

- Dashboard dependency install requires local Node/npm. This Codex runtime has Node
  but no npm executable on PATH.
- On Windows, run the `.cmd` wrapper or use `powershell -ExecutionPolicy Bypass`
  because local PowerShell scripts may be disabled by policy.
- Dashboard currently uses its own `DashboardTrace` type, not the shared
  `simulation-trace.schema.json` shape.
- `01-dashboard-demo/fixtures/shopee_demo_trace.json` is a seed fixture with empty
  arrays; the live UI generates data through `lib/simulationProjection.ts`.
- `02-simulation-engine` still exposes browser globals for the static mockup.
- `03-persona-data-pipeline` has no fixtures or scripts yet.
- `04-analyst-api` has no server implementation yet.

## Validation Checklist

Before presenting:

- `npm run dev` works in `01-dashboard-demo`.
- Dashboard loads at `http://localhost:3000`.
- Timeline play/pause/reset works.
- Product/listing controls update graph, metrics, demographics, and recommendations.
- Static simulator still opens if needed as supporting context.
- No demo step requires live scraping, OpenAI, or API keys.
