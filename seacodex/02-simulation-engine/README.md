# Simulation Engine

## Target Result

Produce a deterministic `simulation_trace.json` for a 10-tick campaign propagation run.

## Build

- Generate a stochastic block model social graph with fixed seed `42`.
- Communities: family, workplace, fandom, reseller, school/university.
- Persona states: `unexposed`, `exposed`, `adopted`, `resistant`.
- Events per tick: exposure, adoption, resistance, reshare, mutation.
- Export a trace matching `../shared/contracts/simulation-trace.schema.json`.

## Demo Rule

Precompute the full trace before the live demo. Do not require live LLM calls during graph animation.

## Stop Condition

`../shared/fixtures/golden_trace.json` contains a complete 10-tick replay with at least one visible message mutation and one backlash pathway.

