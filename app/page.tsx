"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatterTimeline } from "../components/ChatterTimeline";
import { DemographicSalesReport } from "../components/DemographicSalesReport";
import { ListingParameterControls } from "../components/ListingParameterControls";
import { ListingRecommendations } from "../components/ListingRecommendations";
import { MetricCharts } from "../components/MetricCharts";
import { PlatformMarketingSplit } from "../components/PlatformMarketingSplit";
import { ProductInputPanel } from "../components/ProductInputPanel";
import { ProductPreview } from "../components/ProductPreview";
import { SingaporeGraphReplay } from "../components/SingaporeGraphReplay";
import { TimelineControls } from "../components/TimelineControls";
import { projectDemographics } from "../lib/simulationProjection";
import { applyDashboardControlsToTrace, buildFallbackTrace, normalizeSimulationTrace } from "../lib/simulationTraceAdapter";
import type { SimulationSettings } from "../lib/types";
import layer6Trace from "../02-simulation-engine/market_analysis_layer6_simulation/simulation_trace.json";
import fallbackTraceRaw from "../shared/fixtures/golden_trace.json";
import { MiroFishWorkflow } from "../components/MiroFishWorkflow";

const seedTrace =
  normalizeSimulationTrace(layer6Trace) ?? normalizeSimulationTrace(fallbackTraceRaw) ?? buildFallbackTrace();

const seedSimulationSettings: SimulationSettings = {
  tickCount: Math.max(1, Math.min(10, seedTrace.ticks.length)),
  agentCount: Math.max(1, Math.min(24, seedTrace.nodes.length))
};

export default function DashboardDemoPage() {
  const [product, setProduct] = useState(seedTrace.product);
  const [parameters, setParameters] = useState(seedTrace.parameters);
  const [simulationSettings, setSimulationSettings] = useState<SimulationSettings>(seedSimulationSettings);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMs, setSpeedMs] = useState(1000);

  const trace = useMemo(
    () => applyDashboardControlsToTrace(seedTrace, product, parameters, simulationSettings),
    [parameters, product, simulationSettings]
  );
  const projections = useMemo(() => projectDemographics(product, parameters), [parameters, product]);
  const tick = trace.ticks[currentTick] ?? trace.ticks[0];
  const strongestProjection = useMemo(
    () => [...projections].sort((a, b) => b.projectedSalesIndex - a.projectedSalesIndex)[0],
    [projections]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTick((tickIndex) => (tickIndex >= trace.ticks.length - 1 ? 0 : tickIndex + 1));
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, speedMs, trace.ticks.length]);

  useEffect(() => {
    setCurrentTick(0);
  }, [parameters, product, simulationSettings]);

  return (
    <main className="dashboard-shell">
      <nav className="system-nav" aria-label="SEA Codex workspace">
        <a className="system-brand" href="#dashboard">
          <span>SC</span>
          <strong>Seacodex</strong>
        </a>
        <div>
          <a href="#dashboard">Dashboard</a>
          <a href="#mirofish">MiroFish</a>
          <a href="http://localhost:3100/index.html">02 Simulator</a>
          <a href="http://localhost:8000/docs">Analyst API</a>
        </div>
      </nav>

      <header className="topbar">
        <div>
          <span className="eyebrow">WLIAS / Singapore launch lab</span>
          <h1>Market simulation command center</h1>
        </div>
        <p>
          Tune a Shopee listing, replay the Layer 6 trace, run MiroFish workflow steps, and watch projected sales, objections,
          and chatter move through Singapore buyer networks.
        </p>
      </header>

      <section className="hero-console" id="dashboard" aria-label="Integrated repository console">
        <div className="hero-copy">
          <span className="eyebrow">Integrated frontend and backend lanes</span>
          <h2>One surface for listing experiments, social swarm replay, creative upload feedback, and agentic workflow runs.</h2>
          <p>
            The root Next app is the primary dashboard. The static 02 simulator remains available for trace-level inspection,
            while the embedded MiroFish panel calls the backend workflow when its API is running.
          </p>
        </div>
        <div className="hero-stack" aria-hidden="true">
          <div className="hero-card hero-card-large">
            <span>Layer 6 trace</span>
            <strong>{trace.nodes.length.toLocaleString()} agents</strong>
            <i />
          </div>
          <div className="hero-card">
            <span>Current tick</span>
            <strong>t{currentTick}</strong>
          </div>
          <div className="hero-card">
            <span>Primary segment</span>
            <strong>{strongestProjection.segmentLabel}</strong>
          </div>
        </div>
      </section>

      <section className="summary-strip" aria-label="Current simulation summary">
        <div>
          <span>Best segment</span>
          <strong>{strongestProjection.segmentLabel}</strong>
        </div>
        <div>
          <span>Chatter volume</span>
          <strong>{tick.chatterVolume}</strong>
        </div>
        <div>
          <span>Backlash risk</span>
          <strong>{tick.backlashRisk}</strong>
        </div>
      </section>

      <section className="workbench" aria-label="Product simulation dashboard">
        <div className="input-column">
          <ProductPreview product={product} />
          <ProductInputPanel product={product} onChange={setProduct} />
          <ListingParameterControls
            parameters={parameters}
            onChange={setParameters}
            simulationSettings={simulationSettings}
            maxAgentCount={seedTrace.nodes.length}
            maxTickCount={seedTrace.ticks.length}
            onSettingsChange={setSimulationSettings}
          />
        </div>

        <div className="simulation-column">
          <TimelineControls
            currentTick={currentTick}
            isPlaying={isPlaying}
            maxTick={trace.ticks.length - 1}
            speedMs={speedMs}
            onPlayToggle={() => setIsPlaying((playing) => !playing)}
            onReset={() => setCurrentTick(0)}
            onSpeedChange={setSpeedMs}
            onTickChange={setCurrentTick}
          />
          <SingaporeGraphReplay nodes={trace.nodes} edges={trace.edges} ticks={trace.ticks} currentTick={currentTick} />
          <PlatformMarketingSplit recommendations={trace.platformRecommendations} />
          <div className="lower-grid">
            <ChatterTimeline ticks={trace.ticks} currentTick={currentTick} />
            <MetricCharts ticks={trace.ticks} currentTick={currentTick} />
          </div>
        </div>

        <aside className="report-column">
          <DemographicSalesReport projections={projections} />
          <ListingRecommendations recommendations={trace.recommendations} />
        </aside>
      </section>

      <section className="integration-banner" id="mirofish" aria-label="workflow-heading">
        <span>Combined workflow:</span>
        <strong>MiroFish workflow rewritten directly in Next.js below</strong>
        <a href="http://localhost:3100/index.html">Open the 02 static simulator</a>
      </section>
      <section className="report-column">
        <MiroFishWorkflow />
      </section>
    </main>
  );
}
