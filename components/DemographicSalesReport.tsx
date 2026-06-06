import type { CSSProperties } from "react";
import type { DemographicProjection } from "../lib/types";

type DemographicSalesReportProps = {
  projections: DemographicProjection[];
};

export function DemographicSalesReport({ projections }: DemographicSalesReportProps) {
  return (
    <section className="report-panel" aria-label="Sales by demographic">
      <div className="section-kicker">Singapore Sales Readout</div>
      <div className="report-list">
        {projections.map((projection) => (
          <article className="segment-row" key={projection.segmentId}>
            <div className="segment-score" style={{ "--score": projection.projectedSalesIndex } as CSSProperties}>
              <span>{projection.projectedSalesIndex}</span>
            </div>
            <div>
              <div className="segment-heading">
                <h3>{projection.segmentLabel}</h3>
                <span className={`sentiment ${projection.chatterSentiment}`}>{projection.chatterSentiment}</span>
              </div>
              <p>{projection.mainTrigger}</p>
              <dl>
                <div>
                  <dt>Conversion</dt>
                  <dd>{projection.conversionLikelihood}%</dd>
                </div>
                <div>
                  <dt>Price sensitivity</dt>
                  <dd>{projection.priceSensitivity}%</dd>
                </div>
              </dl>
              <small>{projection.recommendedTweak}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
