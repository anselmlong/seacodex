import { AlertTriangle, CheckCircle2, Telescope } from "lucide-react";
import type { Recommendation } from "../lib/types";

type ListingRecommendationsProps = {
  recommendations: Recommendation[];
};

const iconFor = {
  opportunity: CheckCircle2,
  watch: Telescope,
  risk: AlertTriangle
};

export function ListingRecommendations({ recommendations }: ListingRecommendationsProps) {
  return (
    <section className="recommendations-panel" aria-label="Listing recommendations">
      <div className="section-kicker">Listing Moves</div>
      <div className="recommendation-stack">
        {recommendations.map((recommendation) => {
          const Icon = iconFor[recommendation.severity];
          return (
            <article className={`recommendation ${recommendation.severity}`} key={recommendation.title}>
              <Icon aria-hidden="true" size={18} />
              <div>
                <h3>{recommendation.title}</h3>
                <p>{recommendation.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
