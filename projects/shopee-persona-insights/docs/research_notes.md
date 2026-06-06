# Research Notes

## Candidate simulation engines

### MiroFish

Best fit for the requested direction. Public material describes MiroFish as a
multi-agent scenario simulation engine that ingests seed documents, builds a
knowledge graph, generates personas, lets agents interact in social environments,
and returns structured prediction reports.

Potential fit:

- Shopper personas from Shopee/social text.
- Simulated X/Reddit/TikTok-like discussion rounds.
- Scenario testing before a campaign, voucher change, or trust-policy rollout.
- Strong Codex story: agents help build, evaluate, and simulate users.

Risks to check before adopting:

- License implications for a public hackathon repo.
- Whether the official repo setup is stable enough for the deadline.
- Model-provider requirements and API cost.
- Memory/graph dependencies such as Neo4j, Graphiti, Zep, or equivalents.
- Whether real social data can be used under event and platform rules.

### OASIS

OASIS is an open-source social interaction simulator from CAMEL-AI. It is a strong
candidate if we want lower-level control over platform mechanics like feed, follow,
post, comment, and like behavior.

Potential fit:

- More direct control over Instagram/X/TikTok-inspired platform abstractions.
- Scales better for larger agent populations.
- Useful if MiroFish is too productized or too heavy to adapt quickly.

### Y Social / other social simulators

Y Social and similar agent-based social media simulators may be useful for testing
recommender-system effects, misinformation-style spread, or topic diffusion. They
are less directly aligned with Shopee shopper insights than MiroFish/OASIS but may
offer useful architecture patterns.

## Recommended hackathon path

1. Keep this folder as the isolated working product.
2. Build a local dashboard and deterministic simulator first.
3. Add an LLM adapter for persona reactions once data shape is stable.
4. Integrate MiroFish/OASIS only after a quick install/license check.
5. Use approved public/sample data unless the team confirms first-party data rights.

