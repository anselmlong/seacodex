#!/usr/bin/env python3
"""Layer 5: Graph network analysis.

Consumes Layer 3 graph outputs (entities + edges), and optional Layer 4 node
features. Produces influence, centrality, communities, bridge edges, and
anomaly/propagation diagnostics for analyst use.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple


DEFAULT_LAYER3_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer3_mirofish')
DEFAULT_LAYER4_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer4_integration')
DEFAULT_OUTPUT_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer5_graph')


class PipelineError(RuntimeError):
    pass


@dataclass
class Layer5State:
    run_id: str
    layer3_entities_file: str
    layer3_edges_file: str
    layer4_features_file: str
    output_dir: str
    generated_at_utc: str
    version: str = '1.0'

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__.copy()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _safe_str(value: Any) -> str:
    return '' if value is None else str(value).strip()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == '':
            return default
        return float(value)
    except Exception:
        return default


def _clamp01(v: float) -> float:
    if v < 0:
        return 0.0
    if v > 1:
        return 1.0
    return v


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Run Layer 5 graph-network analysis')
    parser.add_argument('--run', choices=['analyze', 'all'], default='all')
    parser.add_argument('--check', action='store_true', help='Validate existing Layer 5 artifacts only')
    parser.add_argument('--input-entities', default=str(DEFAULT_LAYER3_DIR / 'layer3_entities.jsonl'))
    parser.add_argument('--input-edges', default=str(DEFAULT_LAYER3_DIR / 'layer3_edges.jsonl'))
    parser.add_argument('--input-layer4-features', default=str(DEFAULT_LAYER4_DIR / 'layer4_feature_matrix.jsonl'))
    parser.add_argument(
        '--require-layer4-features',
        action='store_true',
        default=False,
        help='Fail when Layer 4 feature file is missing instead of continuing with defaults'
    )
    parser.add_argument('--strict', action='store_true', help='Fail if checks do not pass')
    parser.add_argument('--output-dir', default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument('--pagerank-iterations', type=int, default=30)
    parser.add_argument('--pagerank-damping', type=float, default=0.85)
    parser.add_argument('--community-iterations', type=int, default=25)
    parser.add_argument('--influence-seeds', type=int, default=25)
    parser.add_argument('--influence-rounds', type=int, default=6)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--top-k', type=int, default=40)
    parser.add_argument('--betweenness-sample-frac', type=float, default=0.35)
    return parser.parse_args()


def _read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f'Missing JSONL input: {path}')
    rows = []
    with path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f'Invalid JSONL at line {i} in {path}') from e
    if not rows:
        raise ValueError(f'No rows in input {path}')
    return rows


def _to_jsonl(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')


def _to_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _build_graph(
    entity_rows: Sequence[Dict[str, Any]],
    edge_rows: Sequence[Dict[str, Any]]
) -> Tuple[
    Set[str],
    Dict[str, List[Tuple[str, float, str]]],
    Dict[str, List[Tuple[str, float, str]]],
    Dict[str, Set[str]]
]:
    node_ids: Set[str] = set()
    for row in entity_rows:
        nid = _safe_str(row.get('entity_id') or row.get('persona_id'))
        if not nid:
            continue
        node_ids.add(nid)

    out_edges: Dict[str, List[Tuple[str, float, str]]] = defaultdict(list)
    in_edges: Dict[str, List[Tuple[str, float, str]]] = defaultdict(list)
    undirected: Dict[str, Set[str]] = {node: set() for node in node_ids}

    for edge in edge_rows:
        src = _safe_str(edge.get('source'))
        dst = _safe_str(edge.get('target'))
        if not src or not dst:
            continue
        if src not in node_ids or dst not in node_ids:
            continue
        rel = _safe_str(edge.get('relation', 'related')) or 'related'
        weight = max(0.0, _safe_float(edge.get('weight'), default=1.0))
        out_edges[src].append((dst, weight, rel))
        in_edges[dst].append((src, weight, rel))
        undirected[src].add(dst)
        undirected[dst].add(src)

    return node_ids, out_edges, in_edges, undirected


def _pagerank(node_ids: Set[str], out_edges: Dict[str, List[Tuple[str, float, str]]], iterations: int,
             damping: float = 0.85) -> Dict[str, float]:
    n = max(1, len(node_ids))
    rank = {node: 1.0 / n for node in node_ids}
    base = (1.0 - damping) / n
    out_weight = {u: sum(w for _, w, _ in edges) for u, edges in out_edges.items()}

    iters = max(1, iterations)
    for _ in range(iters):
        nxt = {node: base for node in node_ids}
        dangling = 0.0
        for u in node_ids:
            denom = out_weight.get(u, 0.0)
            if denom <= 0:
                dangling += rank[u]
                continue
            for v, w, _ in out_edges.get(u, []):
                if v in node_ids and denom > 0:
                    nxt[v] += damping * rank[u] * (max(0.0, w) / denom)
        if dangling > 0:
            share = damping * dangling / n
            for node in node_ids:
                nxt[node] += share
        rank = nxt

    max_rank = max(rank.values()) if rank else 1.0
    if max_rank <= 0:
        return {node: 0.0 for node in node_ids}
    return {node: v / max_rank for node, v in rank.items()}


def _compute_degrees(
    node_ids: Set[str],
    out_edges: Dict[str, List[Tuple[str, float, str]]],
    in_edges: Dict[str, List[Tuple[str, float, str]]]
) -> Tuple[Dict[str, int], Dict[str, int], Dict[str, float], Dict[str, float]]:
    out_deg = {node: len(out_edges.get(node, [])) for node in node_ids}
    in_deg = {node: len(in_edges.get(node, [])) for node in node_ids}
    out_w = {node: sum(w for _, w, _ in out_edges.get(node, [])) for node in node_ids}
    in_w = {node: sum(w for _, w, _ in in_edges.get(node, [])) for node in node_ids}
    return in_deg, out_deg, in_w, out_w


def _bfs_shortest_paths(start: str, undirected: Dict[str, Set[str]]) -> Tuple[Dict[str, int], List[str]]:
    dist = {start: 0}
    prev: Dict[str, str] = {}
    q = deque([start])
    while q:
        u = q.popleft()
        for v in undirected.get(u, set()):
            if v not in dist:
                dist[v] = dist[u] + 1
                prev[v] = u
                q.append(v)
    return dist, prev


def _closeness(node_ids: Set[str], undirected: Dict[str, Set[str]]) -> Dict[str, float]:
    closeness = {}
    n = max(1, len(node_ids))
    for node in node_ids:
        dist, _ = _bfs_shortest_paths(node, undirected)
        if len(dist) <= 1:
            closeness[node] = 0.0
            continue
        reachable = [d for x, d in dist.items() if x != node]
        if not reachable:
            closeness[node] = 0.0
            continue
        total = sum(reachable)
        if total <= 0:
            closeness[node] = 0.0
        else:
            closeness[node] = (len(reachable) / total) * (len(reachable) / (n - 1))
    max_val = max(closeness.values()) or 1.0
    return {k: (v / max_val) for k, v in closeness.items()}


def _local_clustering(node: str, undirected: Dict[str, Set[str]]) -> float:
    nbrs = list(undirected.get(node, set()))
    k = len(nbrs)
    if k < 2:
        return 0.0
    links = 0
    for i, a in enumerate(nbrs):
        for b in nbrs[i + 1:]:
            if b in undirected.get(a, set()):
                links += 1
    denom = k * (k - 1) / 2
    return links / denom if denom > 0 else 0.0


def _clustering(node_ids: Set[str], undirected: Dict[str, Set[str]]) -> Dict[str, float]:
    return {node: _local_clustering(node, undirected) for node in node_ids}


def _components(node_ids: Set[str], undirected: Dict[str, Set[str]]) -> Dict[str, int]:
    comp_map: Dict[str, int] = {}
    comp_id = 0
    for node in node_ids:
        if node in comp_map:
            continue
        comp_id += 1
        q = deque([node])
        comp_map[node] = comp_id
        while q:
            u = q.popleft()
            for v in undirected.get(u, set()):
                if v not in comp_map:
                    comp_map[v] = comp_id
                    q.append(v)
    return comp_map


def _label_propagation(node_ids: Set[str], undirected: Dict[str, Set[str]], iterations: int = 25,
                      seed: int = 42, edge_weights: Optional[Dict[Tuple[str, str], float]] = None) -> Dict[str, int]:
    rng = random.Random(seed)
    node_list = list(node_ids)
    labels = {node: i for i, node in enumerate(node_list)}
    if not node_ids:
        return labels

    edge_weights = edge_weights or {}

    for _ in range(max(1, iterations)):
        changed = 0
        rng.shuffle(node_list)
        for node in node_list:
            scores: Dict[int, float] = defaultdict(float)
            for nbr in undirected.get(node, set()):
                w = edge_weights.get(tuple(sorted((node, nbr))), 1.0)
                scores[labels[nbr]] += max(0.0001, w)
            if not scores:
                continue
            best_score = max(scores.values())
            winners = [lbl for lbl, s in scores.items() if s == best_score]
            new_label = rng.choice(winners)
            if new_label != labels[node]:
                labels[node] = new_label
                changed += 1
        if changed == 0:
            break

    # compress labels
    ordered = sorted(set(labels.values()))
    renorm = {old: i for i, old in enumerate(ordered)}
    return {node: renorm[labels[node]] for node in node_ids}


def _bridge_edges_undirected(node_ids: Set[str], undirected: Dict[str, Set[str]]) -> List[Tuple[str, str]]:
    # Tarjan articulation edges (bridges)
    index = 0
    tin = {}
    low = {}
    bridges: List[Tuple[str, str]] = []

    def dfs(u: str, p: Optional[str]):
        nonlocal index
        index += 1
        tin[u] = low[u] = index
        for v in undirected.get(u, set()):
            if v == p:
                continue
            if v not in tin:
                dfs(v, u)
                low[u] = min(low[u], low[v])
                if low[v] > tin[u]:
                    bridges.append(tuple(sorted((u, v))))
            else:
                low[u] = min(low[u], tin[v])

    for node in node_ids:
        if node not in tin:
            dfs(node, None)
    return sorted(set(bridges))


def _approx_betweenness(node_ids: Set[str], undirected: Dict[str, Set[str]], sample_frac: float, seed: int) -> Dict[str, float]:
    if not node_ids:
        return {}
    rng = random.Random(seed)
    nodes = list(node_ids)
    sample_size = max(1, int(len(nodes) * min(1.0, max(0.05, sample_frac))))
    sources = rng.sample(nodes, sample_size) if sample_size < len(nodes) else nodes

    score = {node: 0.0 for node in node_ids}
    for s in sources:
        # BFS stack approach for unweighted betweenness approximation
        stack = []
        pred = defaultdict(list)
        dist = {s: 0}
        sigma = defaultdict(float)
        sigma[s] = 1.0
        q = deque([s])
        order = []

        while q:
            v = q.popleft()
            order.append(v)
            for w in undirected.get(v, set()):
                if w not in dist:
                    dist[w] = dist[v] + 1
                    q.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
                if w in dist and dist[w] == dist[v] - 1:
                    # backward-edge to visited earlier; ignore for directed shortest paths
                    pass

        delta = defaultdict(float)
        for v in reversed(order):
            for p in pred[v]:
                delta[p] += (sigma[p] / max(1e-12, sigma[v])) * (1 + delta[v])
            if v != s:
                score[v] += delta[v]

    max_b = max(score.values()) if score else 1.0
    if max_b <= 0:
        return {k: 0.0 for k in node_ids}
    return {k: v / max_b for k, v in score.items()}


def _community_stats(node_ids: Set[str], labels: Dict[str, int], pagerank: Dict[str, float],
                    in_deg: Dict[str, int], out_deg: Dict[str, int], top_k: int) -> List[Dict[str, Any]]:
    groups: Dict[int, List[str]] = defaultdict(list)
    for node in node_ids:
        groups[labels[node]].append(node)

    rows = []
    for community, members in sorted(groups.items(), key=lambda kv: kv[0]):
        if not members:
            continue
        sizes = len(members)
        top_nodes = sorted(members, key=lambda n: pagerank.get(n, 0.0), reverse=True)[:max(1, min(top_k, sizes))]
        avg_degree = mean([in_deg.get(n, 0) + out_deg.get(n, 0) for n in members]) if members else 0.0
        rows.append({
            'community_id': int(community),
            'size': sizes,
            'member_count': sizes,
            'avg_degree': round(avg_degree, 6),
            'top_nodes_pagerank': [
                {'persona_id': pid, 'pagerank_norm': round(pagerank.get(pid, 0.0), 6)} for pid in top_nodes
            ],
        })
    return rows


def _build_edge_weight_map(edge_rows: Sequence[Dict[str, Any]]) -> Dict[Tuple[str, str], float]:
    m: Dict[Tuple[str, str], float] = {}
    for e in edge_rows:
        s = _safe_str(e.get('source'))
        t = _safe_str(e.get('target'))
        if not s or not t:
            continue
        w = max(0.0, _safe_float(e.get('weight'), default=1.0))
        key = tuple(sorted((s, t)))
        cur = m.get(key)
        m[key] = w if cur is None else max(cur, w)
    return m


def _simulate_influence(seed_nodes: Sequence[str], out_edges: Dict[str, List[Tuple[str, float, str]]],
                        rounds: int = 6, base_activation_prob: float = 0.15) -> Dict[str, Any]:
    active = set(seed_nodes)
    frontier = set(seed_nodes)
    timeline = [{'round': 0, 'new_activated': len(frontier), 'active_total': len(active)}]

    for r in range(1, max(1, rounds) + 1):
        next_frontier = set()
        for u in list(frontier):
            for v, w, _ in out_edges.get(u, []):
                if v in active:
                    continue
                # Probabilistic threshold: deterministic due offline run by hashing edge+round
                p = _clamp01(base_activation_prob * max(0.0, min(1.0, w)))
                # deterministic pseudo-random via float hashing of identifiers
                edge_signature = f"{u}|{v}|{r}"
                token = int(hashlib.sha256(edge_signature.encode()).hexdigest()[:8], 16) / float(0xFFFFFFFF)
                if token <= p:
                    next_frontier.add(v)

        frontier = next_frontier
        active |= frontier
        timeline.append({'round': r, 'new_activated': len(frontier), 'active_total': len(active)})
        if not frontier:
            break

    return {
        'seed_nodes': list(seed_nodes),
        'timeline': timeline,
        'final_count': len(active),
        'coverage_ratio': round(len(active) / max(1, len(set(out_edges.keys()) | {n for arr in out_edges.values() for n, _, _ in arr})), 6),
    }


def _anomaly_flags(node_rows: Sequence[Dict[str, Any]], top_percentile: float = 0.95) -> Dict[str, int]:
    degree = [r['degree_total'] for r in node_rows]
    pager = [r['pagerank_norm'] for r in node_rows]
    if not degree:
        return {}

    def _threshold(vals: List[float], q: float) -> float:
        idx = int((len(vals) - 1) * q)
        s = sorted(vals)
        return float(s[idx]) if s else 0.0

    d_thr = _threshold(degree, top_percentile)
    p_thr = _threshold(pager, top_percentile)
    flags = {
        'degree_outlier_count': 0,
        'pagerank_outlier_count': 0,
        'bridge_nodes_count': 0,
    }
    for row in node_rows:
        if row['degree_total'] >= d_thr and d_thr > 0:
            flags['degree_outlier_count'] += 1
            row['anomaly_degree'] = True
        else:
            row['anomaly_degree'] = False

        if row['pagerank_norm'] >= p_thr and p_thr > 0:
            flags['pagerank_outlier_count'] += 1
            row['anomaly_pagerank'] = True
        else:
            row['anomaly_pagerank'] = False

        if row.get('is_bridge_node'):
            flags['bridge_nodes_count'] += 1
    return flags


def _build_layer5_checks(
    out_dir: Path,
    optional_layer4: bool = True,
    layer4_path: Optional[Path] = None
) -> Dict[str, Any]:
    checks = {
        'exists_output_dir': out_dir.exists(),
        'files': {},
        'pass': True,
    }

    required = {
        'node_scores': out_dir / 'layer5_node_scores.jsonl',
        'communities': out_dir / 'layer5_communities.jsonl',
        'bridge_edges': out_dir / 'layer5_bridge_edges.jsonl',
        'propagation': out_dir / 'layer5_propagation.json',
        'alerts': out_dir / 'layer5_alerts.jsonl',
        'manifest': out_dir / 'layer5_manifest.json',
        'readme': out_dir / 'README.md',
    }

    for key, path in required.items():
        checks['files'][key] = {'exists': path.exists(), 'path': str(path)}
        if path.exists():
            checks['files'][key]['sha256'] = _sha256_file(path)

    try:
        node_rows = [json.loads(line) for line in required['node_scores'].read_text(encoding='utf-8').splitlines() if line.strip()] if required['node_scores'].exists() else []
        comm_rows = [json.loads(line) for line in required['communities'].read_text(encoding='utf-8').splitlines() if line.strip()] if required['communities'].exists() else []
        bridge_rows = [json.loads(line) for line in required['bridge_edges'].read_text(encoding='utf-8').splitlines() if line.strip()] if required['bridge_edges'].exists() else []
        checks['counts'] = {
            'node_rows': len(node_rows),
            'community_rows': len(comm_rows),
            'bridge_rows': len(bridge_rows),
        }
        checks['node_unique'] = len({r.get('persona_id') for r in node_rows if isinstance(r, dict)}) == len(node_rows)
        checks['community_unique'] = len({r.get('community_id') for r in comm_rows if isinstance(r, dict)}) == len(comm_rows)
        if node_rows:
            checks['node_scores_have_pagerank'] = all(isinstance(r.get('pagerank_norm'), (int, float)) for r in node_rows)
            checks['node_scores_have_community'] = all('community_id' in r for r in node_rows)
        if comm_rows:
            checks['community_rows_have_members'] = all(isinstance(r.get('size'), int) for r in comm_rows)
    except Exception as e:
        checks.setdefault('errors', []).append(f'check parse failure: {e}')
        checks['pass'] = False
        return checks

    required_nonempty = ['node_scores', 'communities', 'bridge_edges']
    if not all(checks['files'][k]['exists'] for k in required_nonempty):
        checks['pass'] = False
    if checks['counts'].get('node_rows', 0) == 0:
        checks['pass'] = False
    if not checks.get('node_unique', False):
        checks['pass'] = False
    if not optional_layer4:
        layer4_missing = layer4_path is None or not layer4_path.exists()
        checks['files']['layer4_features'] = {'exists': not layer4_missing, 'path': str(layer4_path) if layer4_path else ''}
        checks['layer4_required_missing'] = layer4_missing
        if layer4_missing:
            checks['pass'] = False

    return checks


def _read_layer4_features(path: Path, optional: bool) -> Dict[str, Dict[str, Any]]:
    if not path.exists():
        if optional:
            return {}
        raise FileNotFoundError(f'Missing required Layer4 feature file: {path}')
    out = {}
    with path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f'Invalid Layer4 row line {i} in {path}') from e
            pid = _safe_str(row.get('persona_id'))
            if pid:
                out[pid] = row
    return out


def _write_readme(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    readme = output_dir / 'README.md'
    readme.write_text(
        '# Layer 5: Graph Network Analysis\n\n'
        'Artifacts\n'
        '- layer5_node_scores.jsonl\n'
        '- layer5_communities.jsonl\n'
        '- layer5_bridge_edges.jsonl\n'
        '- layer5_propagation.json\n'
        '- layer5_alerts.jsonl\n'
        '- layer5_manifest.json\n'
        '- README.md\n',
        encoding='utf-8'
    )


def run(args: argparse.Namespace) -> Dict[str, Any]:
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.check:
        checks = _build_layer5_checks(
            out_dir,
            optional_layer4=not args.require_layer4_features,
            layer4_path=Path(args.input_layer4_features)
        )
        if args.strict and not checks.get('pass', False):
            raise PipelineError(f'Layer 5 check failed: {json.dumps(checks, ensure_ascii=False)}')
        return {'layer': 5, 'checks': checks}

    entities = _read_jsonl(Path(args.input_entities))
    edges = _read_jsonl(Path(args.input_edges))
    layer4 = _read_layer4_features(Path(args.input_layer4_features), optional=not args.require_layer4_features)

    node_ids, out_edges, in_edges, undirected = _build_graph(entities, edges)
    if not node_ids:
        raise PipelineError('No valid nodes found in Layer 3 entities')

    in_deg, out_deg, in_w, out_w = _compute_degrees(node_ids, out_edges, in_edges)
    degree_total = {n: in_deg[n] + out_deg[n] for n in node_ids}
    pagerank = _pagerank(node_ids, out_edges, iterations=max(1, args.pagerank_iterations), damping=args.pagerank_damping)
    closeness = _closeness(node_ids, undirected)
    clustering = _clustering(node_ids, undirected)
    comp = _components(node_ids, undirected)
    edge_weight_map = _build_edge_weight_map(edges)
    communities = _label_propagation(node_ids, undirected, iterations=max(1, args.community_iterations), seed=args.seed, edge_weights=edge_weight_map)
    bridges = _bridge_edges_undirected(node_ids, undirected)
    bridge_nodes = set(n for e in bridges for n in e)
    betweenness = _approx_betweenness(node_ids, undirected, sample_frac=args.betweenness_sample_frac, seed=args.seed)

    community_rows = _community_stats(node_ids, communities, pagerank, in_deg, out_deg, top_k=max(1, min(10, args.top_k)))

    node_rows: List[Dict[str, Any]] = []
    for pid in sorted(node_ids):
        degree_out = out_deg.get(pid, 0)
        degree_in = in_deg.get(pid, 0)
        weighted_out = out_w.get(pid, 0.0)
        weighted_in = in_w.get(pid, 0.0)
        rec = layer4.get(pid, {})
        node_rows.append({
            'persona_id': pid,
            'degree_out': int(degree_out),
            'degree_in': int(degree_in),
            'degree_total': int(degree_total.get(pid, 0)),
            'weighted_degree_out': round(weighted_out, 6),
            'weighted_degree_in': round(weighted_in, 6),
            'pagerank_norm': round(pagerank.get(pid, 0.0), 6),
            'betweenness_norm': round(betweenness.get(pid, 0.0), 6),
            'closeness_norm': round(closeness.get(pid, 0.0), 6),
            'clustering_coef': round(clustering.get(pid, 0.0), 6),
            'component_id': int(comp.get(pid, 0)),
            'community_id': int(communities.get(pid, 0)),
            'is_bridge_node': pid in bridge_nodes,
            'recommendation_score_proxy': _safe_float(rec.get('rec_score_proxy'), default=0.0),
            'churn_proxy_score': _safe_float(rec.get('churn_proxy_score'), default=0.0),
            'segment': _safe_str(rec.get('segment', '')),
        })

    bridge_rows = []
    for src, dst in bridges:
        bridge_rows.append({
            'source': src,
            'target': dst,
            'edge_type': 'bridge',
            'weight': round(edge_weight_map.get(tuple(sorted((src, dst))), 0.0), 6),
        })

    # Influence spread for top N pagerank seeds
    top_seed_count = min(max(1, args.influence_seeds), len(node_rows))
    seed_order = sorted(node_rows, key=lambda r: float(r['pagerank_norm']), reverse=True)
    seeds = [row['persona_id'] for row in seed_order[:top_seed_count]]
    propagation = _simulate_influence(seeds, out_edges, rounds=max(1, args.influence_rounds), base_activation_prob=0.12)

    # Anomalies
    anomaly_stats = _anomaly_flags(node_rows)
    alerts = [
        {'level': 'warn', 'type': 'degree_outlier', 'count': anomaly_stats.get('degree_outlier_count', 0),
         'message': 'High-degree nodes above top percentile identified'},
        {'level': 'warn', 'type': 'pagerank_outlier', 'count': anomaly_stats.get('pagerank_outlier_count', 0),
         'message': 'High pagerank nodes above top percentile identified'},
        {'level': 'info', 'type': 'bridge_nodes', 'count': anomaly_stats.get('bridge_nodes_count', 0),
         'message': 'Nodes incident to bridges by structural vulnerability check'},
    ]

    # Write outputs
    node_path = out_dir / 'layer5_node_scores.jsonl'
    comm_path = out_dir / 'layer5_communities.jsonl'
    bridge_path = out_dir / 'layer5_bridge_edges.jsonl'
    propagation_path = out_dir / 'layer5_propagation.json'
    alerts_path = out_dir / 'layer5_alerts.jsonl'
    manifest_path = out_dir / 'layer5_manifest.json'

    _to_jsonl(node_path, node_rows)
    _to_jsonl(comm_path, community_rows)
    _to_jsonl(bridge_path, bridge_rows)
    _to_json(propagation_path, {
        'top_seed_count': top_seed_count,
        'seed_nodes': seeds,
        'results': propagation,
    })
    _to_jsonl(alerts_path, alerts)

    _write_readme(out_dir)

    checks = _build_layer5_checks(
        out_dir,
        optional_layer4=not args.require_layer4_features,
        layer4_path=Path(args.input_layer4_features)
    )
    state = Layer5State(
        run_id=f'layer5-{_now_iso()}',
        layer3_entities_file=str(Path(args.input_entities)),
        layer3_edges_file=str(Path(args.input_edges)),
        layer4_features_file=str(Path(args.input_layer4_features)),
        output_dir=str(out_dir),
        generated_at_utc=_now_iso(),
    )

    manifest = {
        'project': 'Autonomous Proactive Market Analysis',
        'layer': 5,
        'generated_at_utc': _now_iso(),
        'run_state': state.to_dict(),
        'inputs': {
            'node_count': len(node_ids),
            'edge_count': len(edges),
            'has_layer4_features': bool(layer4),
        },
        'outputs': {
            'node_scores': str(node_path),
            'communities': str(comm_path),
            'bridge_edges': str(bridge_path),
            'propagation': str(propagation_path),
            'alerts': str(alerts_path),
            'manifest': str(manifest_path),
        },
        'summary': {
            'top_nodes_by_pagerank': seed_order[:max(1, min(args.top_k, len(seed_order)))],
            'components': {
                'count': len(set(comp.values())),
            },
            'community_count': len(community_rows),
            'bridge_count': len(bridge_rows),
        },
        'checks': checks,
    }

    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    result = {
        'counts': {
            'nodes': len(node_rows),
            'communities': len(community_rows),
            'bridge_edges': len(bridge_rows),
        },
        'outputs': {
            'node_scores': str(node_path),
            'communities': str(comm_path),
            'bridge_edges': str(bridge_path),
            'propagation': str(propagation_path),
            'alerts': str(alerts_path),
            'manifest': str(manifest_path),
        },
        'checks': checks,
    }

    if args.strict and not checks.get('pass', False):
        raise PipelineError(f'Layer 5 strict check failed: {json.dumps(checks, ensure_ascii=False)}')
    return result


def main() -> None:
    args = _parse_args()
    result = run(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
