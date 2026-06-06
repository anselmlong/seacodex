"use client";

import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef } from "react";
import type { PropagationTick, SocialEdge, SocialNode } from "../lib/types";

type SingaporeGraphReplayProps = {
  nodes: SocialNode[];
  edges: SocialEdge[];
  ticks: PropagationTick[];
  currentTick: number;
};

const stateColor = {
  unexposed: "#c2bbb0",
  aware: "#17a798",
  interested: "#2563eb",
  resistant: "#d94c2b",
  advocate: "#24885a"
};

const layoutPositions: Record<string, { x: number; y: number }> = {
  n1: { x: 160, y: 90 },
  n2: { x: 270, y: 70 },
  n10: { x: 410, y: 115 },
  n11: { x: 520, y: 185 },
  n3: { x: 395, y: 275 },
  n4: { x: 295, y: 315 },
  n5: { x: 175, y: 300 },
  n6: { x: 90, y: 225 },
  n7: { x: 145, y: 390 },
  n8: { x: 280, y: 430 },
  n9: { x: 455, y: 385 },
  n12: { x: 570, y: 315 }
};

export function SingaporeGraphReplay({ nodes, edges, ticks, currentTick }: SingaporeGraphReplayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const tick = ticks[currentTick] ?? ticks[0];
  const activeNodeLabels = tick.activeNodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId)?.label ?? nodeId)
    .join(", ");

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        influence: node.influence,
        state: "unexposed",
        message: ""
      },
      position: layoutPositions[node.id]
    }));
    const edgeElements: ElementDefinition[] = edges.map((edge) => ({
      data: {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        strength: edge.strength
      }
    }));
    return [...nodeElements, ...edgeElements];
  }, [edges, nodes]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: "preset", fit: true, padding: 26 },
      minZoom: 0.8,
      maxZoom: 1.8,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#c2bbb0",
            "border-color": "#312c25",
            "border-width": 1,
            color: "#312c25",
            content: "data(label)",
            "font-family": "var(--font-body)",
            "font-size": 9,
            "font-weight": 700,
            "height": "mapData(influence, 0, 1, 24, 56)",
            "label": "data(label)",
            "overlay-opacity": 0,
            "text-background-color": "#f4efe7",
            "text-background-opacity": 0.86,
            "text-background-padding": "3px",
            "text-margin-y": -9,
            "text-wrap": "wrap",
            "text-max-width": "78px",
            "width": "mapData(influence, 0, 1, 24, 56)"
          }
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "#8a7d6c",
            "opacity": "mapData(strength, 0, 1, 0.28, 0.86)",
            "target-arrow-color": "#8a7d6c",
            "target-arrow-shape": "triangle",
            "width": "mapData(strength, 0, 1, 1, 4)"
          }
        },
        {
          selector: ".active",
          style: {
            "border-color": "#f97316",
            "border-width": 3
          }
        }
      ] as cytoscape.StylesheetStyle[]
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !tick) return;

    nodes.forEach((node) => {
      const state = tick.nodeStates[node.id] ?? "unexposed";
      const message = tick.messageVariants[node.id] ?? "";
      const cyNode = cy.getElementById(node.id);
      cyNode.data("state", state);
      cyNode.data("message", message);
      cyNode.style("background-color", stateColor[state]);
      cyNode.toggleClass("active", tick.activeNodeIds.includes(node.id));
    });
  }, [nodes, tick]);

  return (
    <section className="graph-panel" aria-label="Singapore social network chatter propagation">
      <div className="graph-header">
        <div>
          <div className="section-kicker">Singapore Social Graph</div>
          <h2>Chatter propagation</h2>
        </div>
        <div className="graph-stat">
          <span>Tick</span>
          <strong>{currentTick}</strong>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Tick {currentTick}. Active nodes: {activeNodeLabels || "none"}. Network has {nodes.length} nodes and {edges.length} links.
      </p>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="cytoscape-shell"
      />
      <div className="state-legend">
        {Object.entries(stateColor).map(([state, color]) => (
          <span key={state}>
            <i style={{ background: color }} />
            {state}
          </span>
        ))}
      </div>
      <dl className="sr-only">
        {nodes.map((node) => {
          const state = tick.nodeStates[node.id] ?? "unexposed";
          const message = tick.messageVariants[node.id];
          return (
            <div key={node.id}>
              <dt>{node.label}</dt>
              <dd>
                {state}
                {message ? `: ${message}` : ""}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
