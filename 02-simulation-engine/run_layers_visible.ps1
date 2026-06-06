$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Python = "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$Engine = Join-Path $RepoRoot "02-simulation-engine"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host $Name -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Set-Location $RepoRoot

Write-Host "Seacodex visible layer runner" -ForegroundColor Green
Write-Host "Repo: $RepoRoot"
Write-Host "Engine: $Engine"
Write-Host "Python: $Python"
Write-Host ""

Run-Step "Git status before layer run" {
  git status --short --branch
}

Run-Step "Layer 1/2: persona seed + initialized personas" {
  & $Python "$Engine\prepare_layer1_layer2.py" `
    --run both `
    --source-dir "$Engine\synthetic_nemotron_input" `
    --output-dir "$Engine\market_analysis_layer1_layer2" `
    --n 200 `
    --seed 42 `
    --split `
    --split-strategy stratified `
    --split-by industry `
    --split-train-ratio 0.7 `
    --split-val-ratio 0.15 `
    --split-test-ratio 0.15
}

Run-Step "Layer 1/2 check" {
  & $Python "$Engine\prepare_layer1_layer2.py" `
    --check `
    --output-dir "$Engine\market_analysis_layer1_layer2"
}

Run-Step "Layer 3: MiroFish-compatible swarm tuning (local mock mode)" {
  & $Python "$Engine\prepare_layer3_mirofish.py" `
    --run full `
    --input-layer2 "$Engine\market_analysis_layer1_layer2\layer2\personas_initial_n200_seed42.jsonl" `
    --output-dir "$Engine\market_analysis_layer3_mirofish" `
    --mock `
    --max-layer2-sample 200
}

Run-Step "Layer 3 check" {
  & $Python "$Engine\prepare_layer3_mirofish.py" `
    --check `
    --output-dir "$Engine\market_analysis_layer3_mirofish"
}

Run-Step "Layer 4: model-ready signal tables" {
  & $Python "$Engine\prepare_layer4_model_integration.py" `
    --run all `
    --input-personas "$Engine\market_analysis_layer3_mirofish\layer3_tuned_personas.jsonl" `
    --input-entities "$Engine\market_analysis_layer3_mirofish\layer3_entities.jsonl" `
    --input-edges "$Engine\market_analysis_layer3_mirofish\layer3_edges.jsonl" `
    --input-snapshot "$Engine\market_analysis_layer3_mirofish\layer3_graph_snapshot.json" `
    --output-dir "$Engine\market_analysis_layer4_model_integration"
}

Run-Step "Layer 4 check" {
  & $Python "$Engine\prepare_layer4_model_integration.py" `
    --check `
    --input-personas "$Engine\market_analysis_layer3_mirofish\layer3_tuned_personas.jsonl" `
    --input-entities "$Engine\market_analysis_layer3_mirofish\layer3_entities.jsonl" `
    --input-edges "$Engine\market_analysis_layer3_mirofish\layer3_edges.jsonl" `
    --input-snapshot "$Engine\market_analysis_layer3_mirofish\layer3_graph_snapshot.json" `
    --output-dir "$Engine\market_analysis_layer4_model_integration"
}

Run-Step "Layer 5: graph network analysis" {
  & $Python "$Engine\prepare_layer5_graph_network_analysis.py" `
    --run all `
    --input-entities "$Engine\market_analysis_layer3_mirofish\layer3_entities.jsonl" `
    --input-edges "$Engine\market_analysis_layer3_mirofish\layer3_edges.jsonl" `
    --input-layer4-features "$Engine\market_analysis_layer4_model_integration\layer4_feature_matrix.jsonl" `
    --output-dir "$Engine\market_analysis_layer5_graph_analysis" `
    --seed 42
}

Run-Step "Layer 5 check" {
  & $Python "$Engine\prepare_layer5_graph_network_analysis.py" `
    --check `
    --input-entities "$Engine\market_analysis_layer3_mirofish\layer3_entities.jsonl" `
    --input-edges "$Engine\market_analysis_layer3_mirofish\layer3_edges.jsonl" `
    --input-layer4-features "$Engine\market_analysis_layer4_model_integration\layer4_feature_matrix.jsonl" `
    --output-dir "$Engine\market_analysis_layer5_graph_analysis"
}

Run-Step "Layer 6: full deterministic trace generation" {
  & $Python "$Engine\prepare_layer6_simulation_engine.py" `
    --ticks 10 `
    --nodes 200 `
    --seed 42 `
    --initial-exposed 8 `
    --campaign-name "Air Fryer" `
    --campaign-description "Synthetic first-half market-behavior propagation study" `
    --exposure-base 0.14 `
    --adoption-rate 0.22 `
    --output "$Engine\market_analysis_layer6_simulation\simulation_trace.json" `
    --schema "$Engine\shared\contracts\simulation-trace.schema.json"
}

Run-Step "Layer 6 strict check" {
  & $Python "$Engine\prepare_layer6_simulation_engine.py" `
    --check-only `
    --strict `
    --output "$Engine\market_analysis_layer6_simulation\simulation_trace.json" `
    --schema "$Engine\shared\contracts\simulation-trace.schema.json"
}

Run-Step "Final git status" {
  git status --short --branch
}

Write-Host ""
Write-Host "Layer runner complete. Keep this window open to inspect the run output." -ForegroundColor Green
