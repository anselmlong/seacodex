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
import { defaultParameters, defaultProduct } from "../lib/productModel";
import { createDashboardTrace, projectDemographics } from "../lib/simulationProjection";
import { singaporeNodes } from "../lib/singaporeSegments";
import type { ListingParameters, ProductListing, SimulationSettings } from "../lib/types";

export default function DashboardDemoPage() {
  const [product, setProduct] = useState<ProductListing>(defaultProduct);
  const [parameters, setParameters] = useState<ListingParameters>(defaultParameters);
  const [simulationSettings, setSimulationSettings] = useState<SimulationSettings>({
    tickCount: 10,
    agentCount: singaporeNodes.length
  });
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMs, setSpeedMs] = useState(1000);

  const trace = useMemo(() => createDashboardTrace(product, parameters, simulationSettings), [parameters, product, simulationSettings]);
  const projections = useMemo(() => projectDemographics(product, parameters), [parameters, product]);
  const tick = trace.ticks[currentTick] ?? trace.ticks[0];
  const strongestProjection = useMemo(
    () => [...projections].sort((a, b) => b.projectedSalesIndex - a.projectedSalesIndex)[0],
    [projections]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTick((tick) => (tick >= trace.ticks.length - 1 ? 0 : tick + 1));
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, speedMs, trace.ticks.length]);

  useEffect(() => {
    setCurrentTick(0);
  }, [parameters, product, simulationSettings]);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">WLIAS / Singapore launch lab</span>
          <h1>Product listing agent lab</h1>
        </div>
        <p>
          We live in a society. Tune a Shopee listing and watch projected sales, objections, and chatter move through Singapore buyer networks.
        </p>
      </header>

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

      <section className="workbench">
        <div className="input-column">
          <ProductPreview product={product} />
          <ProductInputPanel product={product} onChange={setProduct} />
          <ListingParameterControls
            parameters={parameters}
            onChange={setParameters}
            simulationSettings={simulationSettings}
            maxAgentCount={singaporeNodes.length}
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
    </main>
  );
}
