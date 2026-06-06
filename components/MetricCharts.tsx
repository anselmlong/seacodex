import type { PropagationTick } from "../lib/types";

type MetricChartsProps = {
  ticks: PropagationTick[];
  currentTick: number;
};

export function MetricCharts({ ticks, currentTick }: MetricChartsProps) {
  const tick = ticks[currentTick] ?? ticks[0];
  const chartTitleId = "chatter-trend-title";
  const chartDescriptionId = "chatter-trend-description";
  const toSeries = (reader: (entry: typeof tick) => number) =>
    ticks.map((entry, index) => {
      const x = (index / Math.max(1, ticks.length - 1)) * 100;
      const value = Math.max(0, Math.min(100, reader(entry)));
      const y = 100 - value;
      return `${x},${y}`;
    });

  const volumePoints = toSeries((entry) => entry.chatterVolume);
  const riskPoints = toSeries((entry) => entry.backlashRisk);
  const adoptionPoints = toSeries((entry) => entry.adoptionRate);
  const resistancePoints = toSeries((entry) => entry.resistanceRate);
  const adversarialPoints = toSeries((entry) => entry.adversarialRate);

  return (
    <section className="metrics-panel" aria-label="Chatter metrics">
      <div className="metric-pair">
        <div>
          <span>Chatter volume</span>
          <strong>{tick.chatterVolume}</strong>
        </div>
        <div>
          <span>Backlash risk</span>
          <strong>{tick.backlashRisk}</strong>
        </div>
        <div>
          <span>Adoption rate</span>
          <strong>{tick.adoptionRate}</strong>
        </div>
        <div>
          <span>Resistance rate</span>
          <strong>{tick.resistanceRate}</strong>
        </div>
        <div>
          <span>Adversarial rate</span>
          <strong>{tick.adversarialRate}</strong>
        </div>
      </div>
      <svg
        aria-describedby={chartDescriptionId}
        aria-labelledby={chartTitleId}
        className="line-chart"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        <title id={chartTitleId}>Chatter, risk, and adoption trends</title>
        <desc id={chartDescriptionId}>
          Current tick {tick.tick}: chatter volume {tick.chatterVolume}, backlash risk {tick.backlashRisk}, adoption {tick.adoptionRate}, resistance {tick.resistanceRate}, adversarial {tick.adversarialRate}.
        </desc>
        <polyline className="chart-grid" points="0,75 100,75" />
        <polyline className="chart-grid" points="0,50 100,50" />
        <polyline className="chart-line volume" points={volumePoints.join(" ")} />
        <polyline className="chart-line risk" points={riskPoints.join(" ")} />
        <polyline className="chart-line adoption" points={adoptionPoints.join(" ")} />
        <polyline className="chart-line resistance" points={resistancePoints.join(" ")} />
        <polyline className="chart-line adversarial" points={adversarialPoints.join(" ")} />
      </svg>
      <div className="chart-legend">
        <span className="volume">Volume</span>
        <span className="risk">Backlash</span>
        <span className="adoption">Adoption</span>
        <span className="resistance">Resistance</span>
        <span className="adversarial">Adversarial</span>
      </div>
      <dl className="sr-only">
        {ticks.map((entry) => (
          <div key={entry.tick}>
            <dt>Tick {entry.tick}</dt>
            <dd>
              Chatter volume {entry.chatterVolume}; backlash risk {entry.backlashRisk}; adoption {entry.adoptionRate}; resistance {entry.resistanceRate}; adversarial {entry.adversarialRate}.
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
