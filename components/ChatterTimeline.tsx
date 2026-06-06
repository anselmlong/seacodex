import type { PropagationTick } from "../lib/types";

type ChatterTimelineProps = {
  ticks: PropagationTick[];
  currentTick: number;
};

export function ChatterTimeline({ ticks, currentTick }: ChatterTimelineProps) {
  const tick = ticks[currentTick] ?? ticks[0];
  const variants = Object.entries(tick.messageVariants).slice(-5);

  return (
    <section className="timeline-panel" aria-label="Chatter timeline">
      <div className="section-kicker">Chatter Mutations</div>
      <div className="tick-rail">
        {ticks.map((entry) => (
          <div className={`tick-mark ${entry.tick <= currentTick ? "active" : ""}`} key={entry.tick}>
            <span>{entry.tick}</span>
          </div>
        ))}
      </div>
      <div className="timeline-copy">
        {variants.length === 0 ? (
          <p>The listing has not hit the Singapore network yet.</p>
        ) : (
          variants.map(([nodeId, message]) => (
            <p key={`${tick.tick}-${nodeId}`}>
              <b>{nodeId}</b>
              {message}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
