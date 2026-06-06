"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

type TimelineControlsProps = {
  currentTick: number;
  maxTick: number;
  isPlaying: boolean;
  speedMs: number;
  onPlayToggle: () => void;
  onReset: () => void;
  onTickChange: (tick: number) => void;
  onSpeedChange: (speed: number) => void;
};

export function TimelineControls({
  currentTick,
  maxTick,
  isPlaying,
  speedMs,
  onPlayToggle,
  onReset,
  onTickChange,
  onSpeedChange
}: TimelineControlsProps) {
  return (
    <div className="timeline-controls" aria-label="Replay controls">
      <button aria-label={isPlaying ? "Pause replay" : "Play replay"} type="button" onClick={onPlayToggle}>
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <button aria-label="Reset replay" type="button" onClick={onReset}>
        <RotateCcw size={17} />
      </button>
      <label>
        <span>Tick {currentTick}</span>
        <input
          max={maxTick}
          min={0}
          type="range"
          value={currentTick}
          onChange={(event) => onTickChange(Number(event.target.value))}
        />
      </label>
      <select
        aria-label="Replay speed"
        value={speedMs}
        onChange={(event) => onSpeedChange(Number(event.target.value))}
      >
        <option value={1400}>Measured</option>
        <option value={1000}>Demo</option>
        <option value={650}>Fast</option>
      </select>
    </div>
  );
}
