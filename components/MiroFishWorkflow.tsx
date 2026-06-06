"use client";

import { type ChangeEvent, useState } from "react";

type WorkflowState = {
  phase: "idle" | "running" | "done" | "error";
};

type LogLine = {
  time: string;
  message: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: string;
};

type OntologyResult = {
  project_id?: string;
  projectId?: string;
  project?: { id?: string; project_id?: string };
};

type GraphBuildResult = {
  graph_id?: string;
  graphId?: string;
  task_id?: string;
  taskId?: string;
};

type SimulationResult = {
  simulation_id?: string;
  simulationId?: string;
};

type ReportResult = {
  report_id?: string;
  reportId?: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_MIROFISH_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5001";
const STEPS = ["Upload + ontology", "Build graph", "Create simulation", "Start simulation", "Generate analyst report"] as const;

const formatTime = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  if (body && body.success === false) {
    throw new Error(body.error || body.message || "Request returned unsuccessful status");
  }
  return body;
}

async function postForm<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData
  });
  return parseJson<T>(res);
}

async function postJSON<T>(path: string, payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<T>(res);
}

async function getJson<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`);
  return parseJson<T>(res);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MiroFishWorkflow() {
  const [projectId, setProjectId] = useState("");
  const [graphId, setGraphId] = useState("");
  const [graphTaskId, setGraphTaskId] = useState("");
  const [simulationId, setSimulationId] = useState("");
  const [reportId, setReportId] = useState("");
  const [rounds, setRounds] = useState(6);
  const [maxMinutesPerRound, setMaxMinutesPerRound] = useState(30);
  const [files, setFiles] = useState<File[]>([]);
  const [requirement, setRequirement] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([
    { time: formatTime(), message: "Ready to run MiroFish workflow in this Next page." }
  ]);
  const [stepStates, setStepStates] = useState<WorkflowState[]>(
    STEPS.map(() => ({ phase: "idle" }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setStepState = (index: number, next: WorkflowState) => {
    setStepStates((current) => {
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  };

  const pushLog = (message: string) => {
    setLogs((previous) => [{ time: formatTime(), message }, ...previous].slice(0, 50));
  };

  const withLoading = async (
    runner: () => Promise<void>,
    onFailure: () => void = () => {}
  ): Promise<boolean> => {
    setError("");
    setLoading(true);
    try {
      await runner();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setError(msg);
      pushLog(`Error: ${msg}`);
      onFailure();
      return false;
    } finally {
      setLoading(false);
    }
  };

  const runStep = async (index: number): Promise<boolean> => {
    setStepState(index, { phase: "running" });

    const didSucceed = await withLoading(async () => {
      if (index === 0) {
        if (!requirement.trim()) {
          pushLog("Please provide simulation requirement before ontology run.");
          throw new Error("Simulation requirement is required.");
        }

        const formData = new FormData();
        formData.append("simulation_requirement", requirement);
        files.forEach((file) => formData.append("files", file));

        const ontology = await postForm<OntologyResult>("/api/graph/ontology/generate", formData);
        const pid = ontology.data?.project_id || ontology.data?.projectId || ontology.data?.project?.id || ontology.data?.project?.project_id;
        if (!pid) {
          throw new Error("Ontology response did not return a project id.");
        }

        setProjectId(pid);
        pushLog(`Ontology generated. project_id=${pid}`);
        return;
      }

      if (index === 1) {
        if (!projectId) {
          throw new Error("Project id required for graph build.");
        }

        const build = await postJSON<GraphBuildResult>("/api/graph/build", {
          project_id: projectId,
          graph_name: "wlias-dashboard-graph"
        });

        const graphBuildId =
          build.data?.graph_id || build.data?.graphId || build.data?.task_id || build.data?.taskId;

        if (!graphBuildId) {
          throw new Error("Build response did not include graph/task identifier.");
        }

        const shouldPollTask = Boolean(build.data?.task_id || build.data?.taskId);
        if (shouldPollTask) {
          setGraphTaskId(graphBuildId);
          pushLog(`Graph build started as async task. task_id=${graphBuildId}`);

          for (let attempt = 0; attempt < 10; attempt += 1) {
            await wait(1000);
            try {
              const taskStatus = await getJson<{ status?: string; graph_id?: string; success?: boolean }>(`/api/graph/task/${graphBuildId}`);
              pushLog(`Graph task status: ${JSON.stringify(taskStatus)}`);
              if (taskStatus.data?.status === "completed" && taskStatus.data?.graph_id) {
                setGraphId(taskStatus.data.graph_id);
                return;
              }
            } catch (statusErr) {
              pushLog(
                `Graph status not available yet (${statusErr instanceof Error ? statusErr.message : "unknown"}). Continuing.`
              );
            }
          }

          throw new Error("Graph build task did not complete within polling window.");
        }

        setGraphId(graphBuildId);
        pushLog(`Graph build completed. graph_id=${graphBuildId}`);
        return;
      }

      if (index === 2) {
        if (!projectId || !graphId) {
          throw new Error("Project and graph ids required for simulation.");
        }

        const sim = await postJSON<SimulationResult>("/api/simulation/create", {
          project_id: projectId,
          graph_id: graphId,
          enable_reddit: true,
          enable_twitter: true
        });

        const sid = sim.data?.simulation_id || sim.data?.simulationId;
        if (!sid) {
          throw new Error("Simulation creation response did not include simulation id.");
        }
        setSimulationId(sid);
        pushLog(`Simulation created. simulation_id=${sid}`);
        return;
      }

      if (index === 3) {
        if (!simulationId) {
          throw new Error("simulation_id required.");
        }

        await postJSON<unknown>("/api/simulation/start", {
          simulation_id: simulationId,
          max_rounds: rounds,
          time_config: {
            minutes_per_round: maxMinutesPerRound
          }
        });
        pushLog(`Simulation started for ${rounds} rounds (${maxMinutesPerRound}m / round).`);
        return;
      }

      if (index === 4) {
        if (!simulationId) {
          throw new Error("simulation_id required for report.");
        }

        const rpt = await postJSON<ReportResult>("/api/report/generate", {
          simulation_id: simulationId,
          force_regenerate: true
        });
        const rid = rpt.data?.report_id || rpt.data?.reportId;
        if (!rid) {
          throw new Error("Report API did not return report id.");
        }
        setReportId(rid);
        pushLog(`Report generated. report_id=${rid}`);
        return;
      }

      pushLog(`Workflow step ${index + 1} not implemented yet.`);
    }, () => setStepState(index, { phase: "error" }));

    if (didSucceed) {
      setStepState(index, { phase: "done" });
    }
    return didSucceed;
  };

  const runAll = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const previousComplete = i === 0 || stepStates[i - 1].phase === "done";
      if (!previousComplete) {
        break;
      }
      if (stepStates[i].phase === "done") {
        continue;
      }

      const ok = await runStep(i);
      if (!ok) {
        break;
      }
      await wait(250);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(selected));
  };

  const clearAll = () => {
    setProjectId("");
    setGraphId("");
    setGraphTaskId("");
    setSimulationId("");
    setReportId("");
    setStepStates(STEPS.map(() => ({ phase: "idle" })));
    setError("");
    setRequirement("");
    setFiles([]);
    setLogs([{ time: formatTime(), message: "Workflow was reset." }]);
  };

  return (
    <section className="report-panel mirofish-workflow" aria-label="MiroFish Next rewrite">
      <div className="timeline-controls">
        <h2>MiroFish workflow (Next.js rewrite)</h2>
        <p className="step-copy">
          This panel is a rewritten single-page version of the Vue teammate frontend so everything runs directly in this page.
        </p>
      </div>

      <div className="workflow-grid">
        <label className="field">
          <span>Simulation requirement</span>
          <textarea
            value={requirement}
            onChange={(event) => setRequirement(event.target.value)}
            placeholder="Describe the campaign brief for ontology generation"
            rows={4}
          />
        </label>

        <label className="field">
          <span>Upload documents (optional)</span>
          <input type="file" accept=".txt,.md,.pdf" multiple onChange={onFileChange} />
          <small>Selected files: {files.length}</small>
          <div className="mirofish-chip-row">
            {files.map((file) => (
              <span key={file.name} className="mirofish-chip">
                {file.name}
              </span>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Simulation rounds</span>
          <input
            type="number"
            min={1}
            max={20}
            value={rounds}
            onChange={(event) => setRounds(Math.max(1, Number(event.target.value || 1)))}
          />
        </label>

        <label className="field">
          <span>Minutes per round</span>
          <input
            type="number"
            min={1}
            max={240}
            value={maxMinutesPerRound}
            onChange={(event) => setMaxMinutesPerRound(Math.max(1, Number(event.target.value || 1)))}
          />
        </label>
      </div>

      <div className="timeline-controls">
        <span>
          <strong>Project:</strong> {projectId || "-"} | <strong>Graph:</strong> {graphId || "-"} |
          <strong>Task:</strong> {graphTaskId || "-"} | <strong>Simulation:</strong> {simulationId || "-"} |
          <strong>Report:</strong> {reportId || "-"}
        </span>
      </div>

      <div className="mirofish-steps">
        {STEPS.map((label, index) => {
          const state = stepStates[index];
          const previousComplete = index === 0 || stepStates[index - 1].phase === "done";
          return (
            <button
              key={label}
              type="button"
              onClick={() => runStep(index)}
              disabled={loading || !previousComplete || state.phase === "running"}
            >
              {label}
              <span className={`badge ${state.phase}`}>{state.phase}</span>
            </button>
          );
        })}
        <button type="button" onClick={runAll} disabled={loading}>
          Run full workflow
        </button>
        <button type="button" onClick={clearAll} disabled={loading}>
          Reset
        </button>
      </div>

      {error && <div className="mirofish-error">{error}</div>}

      <div className="mirofish-log" aria-live="polite">
        {logs.map((entry) => (
          <div key={`${entry.time}-${entry.message}`} className="mirofish-log-line">
            <span>{entry.time}</span>
            <p>{entry.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
