import type { CSSProperties } from "react";
import type { PlatformMarketingRecommendation } from "../lib/types";

type PlatformMarketingSplitProps = {
  recommendations: PlatformMarketingRecommendation[];
};

export function PlatformMarketingSplit({ recommendations }: PlatformMarketingSplitProps) {
  const topRecommendation = recommendations[0];

  return (
    <section className="platform-panel" aria-label="Marketing split by platform">
      <div className="platform-header">
        <div>
          <div className="section-kicker">Platform split</div>
          <h2>Where each marketing angle works</h2>
        </div>
        {topRecommendation ? (
          <div className="platform-topline">
            <span>Best platform</span>
            <strong>{topRecommendation.platform}</strong>
          </div>
        ) : null}
      </div>

      <div className="platform-table" role="table" aria-label="Recommended marketing by platform">
        <div className="platform-table-head" role="row">
          <span role="columnheader">Platform</span>
          <span role="columnheader">Fit</span>
          <span role="columnheader">Marketing that works</span>
          <span role="columnheader">Best audience</span>
        </div>
        {recommendations.map((recommendation) => (
          <article className="platform-row" key={recommendation.platform} role="row">
            <div className="platform-name" role="cell">
              <strong>{recommendation.platform}</strong>
              <span>{recommendation.whyItWorks}</span>
            </div>
            <div className="platform-fit" role="cell">
              <div
                aria-hidden="true"
                className="platform-score"
                style={{ "--score": `${recommendation.score}%` } as CSSProperties}
              >
                <span />
              </div>
              <strong>{recommendation.score}</strong>
              <span className="sr-only">Fit score {recommendation.score} out of 100.</span>
            </div>
            <div className="platform-angle" role="cell">
              <strong>{recommendation.marketingAngle}</strong>
              <span>{recommendation.watchOut}</span>
            </div>
            <div className="platform-audience" role="cell">
              <span>{recommendation.bestSegmentLabel}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
