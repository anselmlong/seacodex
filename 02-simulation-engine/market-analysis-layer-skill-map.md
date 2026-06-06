# Autonomous Proactive Market Analysis: Layer-to-Skill Map

This document maps the end-to-end workflow (from synthetic persona data to model integration) and the reusable skills needed at each layer.

## Layer 1 — Data Ingestion: Synthetic Persona Foundation

- **Purpose**: Ingest Nemotron dataset, normalize schema, and create a clean persona seed repository.
- **Primary Inputs**:
  - Raw dataset files (e.g., `nemotron-personas-singapore` parquet/json)
  - Source schema docs + license/privacy constraints
- **Primary Outputs**:
  - Versioned `persona_seed.csv` / `persona_seed.jsonl`
  - Data quality report (coverage, duplicates, missingness)
- **Required skills**:
  - `data-quality-engineering`
  - `data-ops-and-ingestion`
  - `schema-design-and-validation`
  - `governance-privacy-safety`
- **Optional/recommended skills**:
  - `storage-versioning`
  - `metadata-cataloging`
- **Quick checks before moving on**:
  - No critical missing required fields
  - No duplicated person IDs
  - Reproducible snapshot with timestamp + hash

## Layer 2 — Persona Bootstrapping and Initialization

- **Purpose**: Convert seeds into initialized N personas with consistent baseline profiles.
- **Primary Inputs**:
  - Clean seeds from Layer 1
  - Product or market constraints (region, segment, vertical)
- **Primary Outputs**:
  - `personas_initial.jsonl`
  - Calibration metadata (`seed_version`, generation assumptions)
- **Required skills**:
  - `prompt-database-reproducibility`
  - `persona-schema-engineering`
  - `evaluation-and-label-calibration`
  - `governance-privacy-safety`
- **Optional/recommended skills**:
  - `llm-orchestration-ops`
  - `sampling-strategy-design`

## Layer 3 — MiroFish Interest Tuning (Swarm)

- **Purpose**: Use MiroFish agents to refine persona interests and peer influence hypotheses.
- **Primary Inputs**:
  - `personas_initial`
  - Simulation context + constraints
  - Context files and prompt templates
- **Primary Outputs**:
  - `personas_refined.jsonl`
  - Agent decision traces (prompt + action + rationale)
  - Influence hypotheses / interaction suggestions
- **Required skills**:
  - `orchestration-and-multi-agent-planning`
  - `prompt-database-reproducibility`
  - `graph-network-analysis` *(for building interactions)*
  - `quality-assurance-and-validation`
  - `mcp-or-integration-ops` 
- **Optional/recommended skills**:
  - `failure-recovery-retry-strategy`
  - `cost-performance-monitoring`

## Layer 4 — Interest + Trend Reasoning

- **Purpose**: Extract trends, clusters, and possible intent shifts from refined personas.
- **Primary Inputs**:
  - `personas_refined`
  - Optional external trend context and historical windows
- **Primary Outputs**:
  - Trend candidate list with confidence
  - Interest clusters and timeline tags
  - Drift flags / anomaly notes
- **Required skills**:
  - `evaluation-and-label-calibration`
  - `time-series-and-windowing`
  - `explainability-and-significance`
  - `statistical-testing-basics`
- **Optional/recommended skills**:
  - `trend-detection`
  - `topic-modeling`

## Layer 5 — Graph Network Analysis

- **Purpose**: Model peer influence and community dynamics using relation edges.
- **Primary Inputs**:
  - Entity graph nodes/edges
  - Edge weights and timestamps
- **Primary Outputs**:
  - Centrality and influence score tables
  - Communities and bridge nodes
  - Influence propagation and anomaly snapshots
- **Required skills**:
  - `graph-network-analysis`
  - `evaluation-and-label-calibration`
  - `statistical-testing-basics`
  - `quality-assurance-and-validation`
- **Optional/recommended skills**:
  - `visual-analytics`
  - `causal-inference-readiness`

## Layer 6 — Analyst Transformation to ML-Usable Signals

- **Purpose**: Convert narrative outputs into structured model features and segment summaries.
- **Primary Inputs**:
  - Trends + graph outputs
  - Historical outcomes/labels (where available)
- **Primary Outputs**:
  - Feature tables for recommendations/churn
  - Mapping doc: feature -> meaning -> source -> owner
  - Data dictionary and lineage report
- **Required skills**:
  - `feature-engineering-for-product-ml`
  - `data-quality-engineering`
  - `evaluation-and-label-calibration`
  - `schema-design-and-validation`
- **Optional/recommended skills**:
  - `dashboarding-and-reporting`
  - `mlops-feature-store-management`

## Layer 7 — Product ML Integration (Recommendation and Churn)

- **Purpose**: Serve calibrated features into downstream models and scoring paths.
- **Primary Inputs**:
  - Feature tables from Layer 6
  - Current user/event features
- **Primary Outputs**:
  - Model-ready scores + confidence
  - Integration contracts and serving wrappers
  - Monitoring report (quality, drift, fairness signals)
- **Required skills**:
  - `mlops-and-serving`
  - `evaluation-and-label-calibration`
  - `governance-privacy-safety`
  - `human-in-the-loop-governance`
- **Optional/recommended skills**:
  - `experiment-design`
  - `model-interpretability`

---

## Global skill index (reusable across layers)

- `data-ops-and-ingestion`: dataset extraction, parsing, dedup, schema mapping.
- `schema-design-and-validation`: strong entity and relation contracts.
- `data-quality-engineering`: completeness, type checks, duplicates, outlier QA.
- `governance-privacy-safety`: PII, consent, responsible synthetic-to-production transfer.
- `prompt-database-reproducibility`: versioned prompts, seeds, temperature, model hash.
- `persona-schema-engineering`: stable person/profile schema, lifecycle states, timestamps.
- `evaluation-and-label-calibration`: metric definitions, inter-rater checks, confidence calibration.
- `orchestration-and-multi-agent-planning`: task graph, retries, role prompts, coordination.
- `mcp-or-integration-ops`: local tooling wiring, API keys, service endpoints.
- `graph-network-analysis`: topology, centrality, propagation, communities.
- `time-series-and-windowing`: temporal trend handling and seasonality checks.
- `quality-assurance-and-validation`: acceptance criteria + regression checks.
- `feature-engineering-for-product-ml`: stable feature definitions + production-safe transforms.
- `mlops-and-serving`: deployment, versioning, rollback, scoring API contracts.
- `human-in-the-loop-governance`: manual review gates and escalation path.
- `experiment-design`: A/B strategy, lift tests, confidence intervals.

---

## Retrieval guide

- For quick access during execution, read this file first and then load:
  - `/Users/kyiwaithant/Documents/Shopee/market-analysis-layer-skill-map.json`
- In later sessions, reuse this map by referencing layer name + `required skills` and checking dependencies before each stage.
