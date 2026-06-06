"use client";

import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
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

const segmentAngles: Record<string, number> = {
  "gen-z-students": -2.35,
  "young-professionals": -1.2,
  "parents-family": -0.1,
  "heartland-value": 0.95,
  "adversarial-voices": 4.15,
  "live-resellers": 2.05,
  "category-enthusiasts": 3.05
};

const positionForNode = (node: SocialNode, index: number, nodes: SocialNode[]) => {
  const sameSegmentIndex = nodes.slice(0, index).filter((entry) => entry.segmentId === node.segmentId).length;
  const angle = (segmentAngles[node.segmentId] ?? -1.9) + sameSegmentIndex * 0.16;
  const ring = 112 + (sameSegmentIndex % 5) * 33 + Math.floor(sameSegmentIndex / 5) * 18;
  const center = { x: 360, y: 260 };

  return {
    x: center.x + Math.cos(angle) * ring,
    y: center.y + Math.sin(angle) * ring
  };
};

export function SingaporeGraphReplay({ nodes, edges, ticks, currentTick }: SingaporeGraphReplayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");
  const tick = ticks[currentTick] ?? ticks[0];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const selectedState = selectedNode ? (tick.nodeStates[selectedNode.id] ?? "unexposed") : "unexposed";
  const selectedOpinion = selectedNode ? tick.agentOpinions[selectedNode.id] : undefined;
  const activeNodeLabels = tick.activeNodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId)?.label ?? nodeId)
    .join(", ");

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = nodes.map((node, index) => ({
      data: {
        id: node.id,
        initials: node.avatarInitials,
        label: node.label,
        influence: node.influence,
        state: "unexposed",
        message: ""
      },
      position: positionForNode(node, index, nodes)
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
    if (!containerRef.current) return;
    cyRef.current?.destroy();
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
            "border-width": 2,
            color: "#312c25",
            content: "data(initials)",
            "font-family": "var(--font-body)",
            "font-size": 10,
            "font-weight": 900,
            "height": "mapData(influence, 0, 1, 28, 48)",
            "label": "data(initials)",
            "overlay-opacity": 0,
            "text-valign": "center",
            "text-halign": "center",
            "width": "mapData(influence, 0, 1, 28, 48)"
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
        },
        {
          selector: ".selected",
          style: {
            "border-color": "#16120e",
            "border-width": 4
          }
        }
      ] as cytoscape.StylesheetStyle[]
    });
    cyRef.current.on("tap", "node", (event) => {
      setSelectedNodeId(event.target.id());
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
      cyNode.toggleClass("selected", node.id === selectedNodeId);
    });
  }, [nodes, selectedNodeId, tick]);

  useEffect(() => {
    if (nodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId(nodes[0]?.id ?? "");
  }, [nodes, selectedNodeId]);

  return (
    <section className="graph-panel" aria-label="Singapore social network chatter propagation">
      <div className="graph-header">
        <div>
          <div className="section-kicker">Singapore Agent Network</div>
          <h2>Buyer agents</h2>
        </div>
        <div className="graph-stat">
          <span>Tick</span>
          <strong>{currentTick}</strong>
        </div>
        <div className="graph-stat">
          <span>Agents</span>
          <strong>{nodes.length}</strong>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Tick {currentTick}. Active nodes: {activeNodeLabels || "none"}. Network has {nodes.length} nodes and {edges.length} links.
      </p>
      <div className="agent-network-layout">
        <div ref={containerRef} aria-hidden="true" className="cytoscape-shell" />
        {selectedNode && selectedOpinion ? (
          <aside className="agent-inspector" aria-label={`${selectedNode.label} opinion`}>
            <div className="agent-profile">
              <div className={`agent-avatar ${selectedState}`}>{selectedNode.avatarInitials}</div>
              <div>
                <span>{selectedNode.persona}</span>
                <h3>{selectedNode.label}</h3>
                <p>{selectedNode.channel}</p>
              </div>
            </div>
            <div className="opinion-meter">
              <span>{selectedOpinion.stance}</span>
              <strong>{selectedOpinion.confidence}</strong>
            </div>
            <p className="opinion-summary">{selectedOpinion.summary}</p>
            <div className="opinion-section">
              <h4>Why they think this</h4>
              <ul>
                {selectedOpinion.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="opinion-section">
              <h4>Objection</h4>
              <p>{selectedOpinion.objection}</p>
            </div>
            <div className="opinion-section">
              <h4>Next thought</h4>
              <p>{selectedOpinion.nextAction}</p>
            </div>
          </aside>
        ) : null}
      </div>
      <div className="agent-selector" aria-label="Select an agent">
        {nodes.map((node) => {
          const state = tick.nodeStates[node.id] ?? "unexposed";
          return (
            <button
              className={node.id === selectedNodeId ? "selected" : undefined}
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              type="button"
            >
              <span className={`agent-avatar small ${state}`}>{node.avatarInitials}</span>
              {node.label}
            </button>
          );
        })}
      </div>
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
