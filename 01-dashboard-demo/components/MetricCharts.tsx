import type { PropagationTick } from "../lib/types";

type MetricChartsProps = {
  ticks: PropagationTick[];
  currentTick: number;
};

export function MetricCharts({ ticks, currentTick }: MetricChartsProps) {
  const tick = ticks[currentTick] ?? ticks[0];
  const chartTitleId = "chatter-trend-title";
  const chartDescriptionId = "chatter-trend-description";
  const points = ticks.map((entry, index) => {
    const x = (index / Math.max(1, ticks.length - 1)) * 100;
    const y = 100 - entry.chatterVolume;
    return `${x},${y}`;
  });
  const riskPoints = ticks.map((entry, index) => {
    const x = (index / Math.max(1, ticks.length - 1)) * 100;
    const y = 100 - entry.backlashRisk;
    return `${x},${y}`;
  });

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
      </div>
      <svg
        aria-describedby={chartDescriptionId}
        aria-labelledby={chartTitleId}
        className="line-chart"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        <title id={chartTitleId}>Chatter and backlash trend</title>
        <desc id={chartDescriptionId}>
          Current tick {tick.tick}: chatter volume {tick.chatterVolume}, backlash risk {tick.backlashRisk}.
        </desc>
        <polyline className="chart-grid" points="0,75 100,75" />
        <polyline className="chart-grid" points="0,50 100,50" />
        <polyline className="chart-line volume" points={points.join(" ")} />
        <polyline className="chart-line risk" points={riskPoints.join(" ")} />
      </svg>
      <div className="chart-legend">
        <span className="volume">Volume</span>
        <span className="risk">Backlash</span>
      </div>
      <dl className="sr-only">
        {ticks.map((entry) => (
          <div key={entry.tick}>
            <dt>Tick {entry.tick}</dt>
            <dd>
              Chatter volume {entry.chatterVolume}; backlash risk {entry.backlashRisk}.
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
