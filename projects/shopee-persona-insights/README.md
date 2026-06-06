# Shopee Persona Insights

Experimental branch folder for simulating social-platform shopper behavior around
Shopee from text inputs such as posts, comments, reviews, creator captions, and
support complaints.

The immediate goal is a lightweight demo that can run locally without committing
to a heavy external stack. The longer-term path is to replace the local simulation
loop with MiroFish, OASIS, or a similar multi-agent social simulation engine.

## Concept

Turn noisy social text into an audience rehearsal room:

1. Ingest short-form social signals from Instagram, X, TikTok, Reddit-style threads,
   Shopee reviews, and support snippets.
2. Segment the signals into themes such as price sensitivity, voucher behavior,
   trust and authenticity, delivery anxiety, seller responsiveness, livestream
   conversion, and competitor switching.
3. Generate platform-native personas with different motives and platform habits.
4. Let the personas react to scenarios, campaigns, policy changes, or product
   experiences.
5. Synthesize predicted behavioral shifts, objections, content hooks, and risky
   assumptions.

## Current prototype

This folder includes a deterministic local simulator:

- `data/sample_social_posts.jsonl` contains sample social/shopping signals.
- `config/personas.json` defines shopper personas.
- `config/scenarios.json` defines what to test.
- `src/simulate.py` runs the simulation and writes a Markdown insight report.

Run:

```powershell
python projects\shopee-persona-insights\src\simulate.py
```

Output:

```text
projects/shopee-persona-insights/outputs/latest_report.md
```

## Persona webpage mockup

Open the static mock webpage:

```text
projects/shopee-persona-insights/mockup/index.html
```

It shows the simulated shoppers as visual personas with platform badges,
product-category tabs, demographic behavior maps, scenario tabs, and mock
posts/comments.

The influence graph page is here:

```text
projects/shopee-persona-insights/mockup/graph.html
```

It visualizes connected user clusters across thousands of real-world and
simulated shoppers. The graph is intentionally aggregated into communities so
interventions such as ad targeting, shipment priority, or recovery vouchers can
be explored without rendering unreadable individual-node noise.

## Why not directly vendor MiroFish yet?

MiroFish is promising for this use case because it is designed around document
seeding, entity/relation extraction, persona generation, multi-agent simulation,
and structured scenario reports. It is also a young, fast-moving project with
license, infrastructure, model-provider, memory-store, and setup choices that
should be checked before we make it part of this hackathon repo.

This prototype keeps the app surface separate and gives us a working demo path
while preserving the option to integrate MiroFish/OASIS once the team approves
the stack.

## Next build steps

1. Replace sample data with approved public or first-party Shopee-adjacent text.
2. Add an ingestion layer for CSV/JSON exports from social listening, reviews, or
   manual pasted snippets.
3. Add an LLM adapter with an OpenAI-compatible interface for persona reactions.
4. Add a simple dashboard for scenario input, simulated feed playback, and insight
   reports.
5. Evaluate MiroFish/OASIS as the simulation backend for larger agent populations.
