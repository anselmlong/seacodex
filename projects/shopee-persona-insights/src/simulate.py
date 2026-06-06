from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "sample_social_posts.jsonl"
PERSONA_PATH = ROOT / "config" / "personas.json"
SCENARIO_PATH = ROOT / "config" / "scenarios.json"
OUTPUT_PATH = ROOT / "outputs" / "latest_report.md"


THEME_KEYWORDS = {
    "price": ["cheap", "price", "codes", "voucher", "free shipping", "coins", "minimum spend"],
    "trust": ["reviews", "real", "official", "warranty", "seller", "verified", "authentic"],
    "delivery": ["delivery", "tomorrow", "late", "parcel", "predictable", "packed"],
    "support": ["refund", "returns", "replied", "support", "guarantee"],
    "livestream": ["live", "livestream", "creator", "reels", "showing"],
    "competitor": ["lazada", "competitor", "alternative"],
}

SCENARIO_THEME_WEIGHTS = {
    "free_shipping_floor_change": {"price": 1.0, "delivery": 0.25, "competitor": 0.35},
    "livestream_trust_badge": {"trust": 1.0, "livestream": 0.85, "support": 0.25},
    "late_delivery_recovery": {"delivery": 1.0, "support": 0.75, "price": 0.35},
}


@dataclass(frozen=True)
class Signal:
    platform: str
    author_type: str
    text: str
    engagement: int
    themes: Counter


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    platforms: list[str]
    motives: list[str]
    skepticism: float
    price_sensitivity: float
    trust_sensitivity: float
    delivery_sensitivity: float
    voice: str


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_signals(path: Path) -> list[Signal]:
    signals = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        text = item["text"]
        signals.append(
            Signal(
                platform=item["platform"],
                author_type=item["author_type"],
                text=text,
                engagement=int(item.get("engagement", 1)),
                themes=classify_themes(text),
            )
        )
    return signals


def classify_themes(text: str) -> Counter:
    lowered = text.lower()
    counts = Counter()
    for theme, keywords in THEME_KEYWORDS.items():
        for keyword in keywords:
            if keyword in lowered:
                counts[theme] += 1
    return counts


def aggregate_theme_pressure(signals: Iterable[Signal]) -> dict[str, float]:
    pressure = defaultdict(float)
    total_engagement = 0
    for signal in signals:
        total_engagement += signal.engagement
        for theme, count in signal.themes.items():
            pressure[theme] += count * math.log1p(signal.engagement)

    if not total_engagement:
        return {}

    peak = max(pressure.values(), default=1.0)
    return {theme: round(value / peak, 3) for theme, value in sorted(pressure.items())}


def persona_fit(persona: Persona, scenario_id: str, theme_pressure: dict[str, float]) -> float:
    weights = SCENARIO_THEME_WEIGHTS.get(scenario_id, {})
    price = theme_pressure.get("price", 0.0) * persona.price_sensitivity
    trust = theme_pressure.get("trust", 0.0) * persona.trust_sensitivity
    delivery = theme_pressure.get("delivery", 0.0) * persona.delivery_sensitivity
    weighted_context = sum(theme_pressure.get(theme, 0.0) * weight for theme, weight in weights.items())
    raw = 0.28 * price + 0.32 * trust + 0.28 * delivery + 0.12 * weighted_context
    return round(min(1.0, raw), 3)


def predict_reaction(persona: Persona, scenario: dict, theme_pressure: dict[str, float]) -> dict:
    scenario_id = scenario["id"]
    fit = persona_fit(persona, scenario_id, theme_pressure)
    skepticism_drag = persona.skepticism * 0.22
    intent = round(max(0.0, min(1.0, fit - skepticism_drag + 0.18)), 3)

    likely_objection = strongest_objection(persona, scenario_id, theme_pressure)
    hook = strongest_hook(persona, scenario_id)
    stance = "positive" if intent >= 0.62 else "mixed" if intent >= 0.38 else "negative"

    return {
        "persona": persona.name,
        "stance": stance,
        "intent_score": intent,
        "likely_objection": likely_objection,
        "message_hook": hook,
        "voice": persona.voice,
    }


def strongest_objection(persona: Persona, scenario_id: str, theme_pressure: dict[str, float]) -> str:
    if scenario_id == "free_shipping_floor_change":
        if persona.price_sensitivity > 0.8:
            return "Higher free-shipping floors feel like a hidden price increase."
        return "Bundle suggestions must not feel manipulative or clutter checkout."
    if scenario_id == "livestream_trust_badge":
        if persona.trust_sensitivity > 0.75:
            return "Badges need proof, not just another marketplace label."
        return "Creator excitement may not transfer to checkout confidence."
    if scenario_id == "late_delivery_recovery":
        if persona.delivery_sensitivity > 0.8:
            return "A small voucher does not compensate for broken delivery expectations."
        return "Recovery only works if the message arrives before the shopper complains."
    if theme_pressure.get("trust", 0) > theme_pressure.get("price", 0):
        return "Trust cues need to be stronger than discount cues."
    return "The offer needs clearer value before shoppers switch behavior."


def strongest_hook(persona: Persona, scenario_id: str) -> str:
    if scenario_id == "free_shipping_floor_change":
        return "Show the cheapest path to free shipping before checkout."
    if scenario_id == "livestream_trust_badge":
        return "Pair creator demos with verified seller proof and return clarity."
    if scenario_id == "late_delivery_recovery":
        return "Message early, explain plainly, and make recovery feel automatic."
    return f"Speak to {persona.motives[0]} in {persona.voice} language."


def render_report(signals: list[Signal], personas: list[Persona], scenarios: list[dict]) -> str:
    theme_pressure = aggregate_theme_pressure(signals)
    platform_counts = Counter(signal.platform for signal in signals)

    lines = [
        "# Shopee Persona Simulation Report",
        "",
        "## Input Snapshot",
        "",
        f"- Signals analyzed: {len(signals)}",
        f"- Platforms: {', '.join(f'{platform} ({count})' for platform, count in platform_counts.items())}",
        f"- Dominant themes: {', '.join(f'{theme}={score}' for theme, score in theme_pressure.items())}",
        "",
        "## Scenario Reactions",
        "",
    ]

    for scenario in scenarios:
        reactions = [predict_reaction(persona, scenario, theme_pressure) for persona in personas]
        avg_intent = sum(item["intent_score"] for item in reactions) / len(reactions)
        lines.extend(
            [
                f"### {scenario['name']}",
                "",
                scenario["description"],
                "",
                f"Average simulated intent: {avg_intent:.2f}",
                "",
                "| Persona | Stance | Intent | Likely objection | Message hook |",
                "| --- | --- | ---: | --- | --- |",
            ]
        )
        for reaction in reactions:
            lines.append(
                "| {persona} | {stance} | {intent_score:.2f} | {likely_objection} | {message_hook} |".format(
                    **reaction
                )
            )
        lines.extend(["", ""])

    lines.extend(
        [
            "## Strategic Read",
            "",
            "- Discount mechanics are a conversion lever, but they quickly become a trust risk if shoppers feel rules changed late.",
            "- Trust cues should be concrete: verified seller status, review authenticity, return terms, and warranty clarity.",
            "- Delivery recovery must happen before complaint behavior starts; late vouchers work better as apology proof than as the whole fix.",
            "- TikTok and livestream contexts can create intent, but checkout confidence still depends on marketplace-native trust proof.",
            "",
            "## MiroFish/OASIS Integration Slot",
            "",
            "Replace `predict_reaction` with a backend adapter that:",
            "",
            "1. Sends approved seed documents and scenario prompts to the simulation engine.",
            "2. Maps generated agents back to these persona dimensions.",
            "3. Stores posts, comments, likes, shares, and sentiment shifts per round.",
            "4. Returns a machine-readable report for the dashboard.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    personas = [Persona(**item) for item in load_json(PERSONA_PATH)]
    scenarios = load_json(SCENARIO_PATH)
    signals = load_signals(DATA_PATH)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_report(signals, personas, scenarios), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

