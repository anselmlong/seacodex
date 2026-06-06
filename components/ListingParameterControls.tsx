"use client";

import { SlidersHorizontal, Truck } from "lucide-react";
import type { ListingParameters, SimulationSettings } from "../lib/types";

type ListingParameterControlsProps = {
  parameters: ListingParameters;
  onChange: (parameters: ListingParameters) => void;
  simulationSettings: SimulationSettings;
  maxAgentCount: number;
  maxTickCount: number;
  onSettingsChange: (settings: SimulationSettings) => void;
};

const controls: Array<{
  key: keyof Omit<ListingParameters, "freeShipping">;
  label: string;
}> = [
  { key: "voucherEmphasis", label: "Voucher emphasis" },
  { key: "urgency", label: "Urgency" },
  { key: "creatorAngle", label: "Creator angle" },
  { key: "familyBulkBuyAngle", label: "Family bulk-buy" },
  { key: "budgetPositioning", label: "Budget positioning" },
  { key: "premiumPositioning", label: "Premium positioning" }
];

export function ListingParameterControls({
  parameters,
  onChange,
  simulationSettings,
  maxAgentCount,
  maxTickCount,
  onSettingsChange
}: ListingParameterControlsProps) {
  const safeMaxAgentCount = Math.max(1, maxAgentCount);
  const safeMaxTickCount = Math.max(1, maxTickCount);
  const tickMin = safeMaxTickCount >= 2 ? 2 : 1;

  return (
    <section className="parameter-panel" aria-label="Listing parameters">
      <details open>
        <summary>
          <span>
            <SlidersHorizontal size={16} />
            Listing levers
          </span>
          <small>Tune the simulation</small>
        </summary>
        <button
          aria-pressed={parameters.freeShipping}
          className={`shipping-toggle ${parameters.freeShipping ? "active" : ""}`}
          type="button"
          onClick={() => onChange({ ...parameters, freeShipping: !parameters.freeShipping })}
        >
          <Truck size={18} />
          <span>Free shipping</span>
        </button>
        <div className="slider-stack">
          {controls.map((control) => (
            <label className="slider-field" key={control.key}>
              <span>
                {control.label}
                <strong>{parameters[control.key]}</strong>
              </span>
              <input
                max={100}
                min={0}
                type="range"
                value={parameters[control.key]}
                onChange={(event) => onChange({ ...parameters, [control.key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <label className="slider-field">
            <span>
              Tick count
              <strong>{simulationSettings.tickCount}</strong>
            </span>
            <input
              max={safeMaxTickCount}
              min={tickMin}
              step={1}
              type="range"
              value={simulationSettings.tickCount}
              onChange={(event) =>
                onSettingsChange({ ...simulationSettings, tickCount: Number(event.target.value) })
              }
            />
          </label>
          <label className="slider-field">
            <span>
              Agent count
              <strong>{simulationSettings.agentCount}</strong>
            </span>
            <input
              max={safeMaxAgentCount}
              min={1}
              step={1}
              type="range"
              value={simulationSettings.agentCount}
              onChange={(event) =>
                onSettingsChange({ ...simulationSettings, agentCount: Number(event.target.value) })
              }
            />
          </label>
        </div>
      </details>
    </section>
  );
}
