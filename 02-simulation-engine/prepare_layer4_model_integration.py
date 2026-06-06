#!/usr/bin/env python3
"""Layer 4: Analyst transformation of Layer 3 outputs into model-ready signals.

Inputs
------
- Layer 3 tuned personas (JSONL)
- Layer 3 graph entities (JSONL)
- Layer 3 edges (JSONL)
- Layer 3 graph snapshot (JSON)

Outputs
-------
- layer4_feature_matrix.jsonl
- layer4_recommendation_features.jsonl
- layer4_churn_features.jsonl
- layer4_segments.json
- layer4_manifest.json
- layer4_feature_lineage.csv
- README.md

This layer is designed to be local-only: no external services, no API keys,
no model calls. It transforms already materialized Layer 3 outputs into
feature tables and analyst-style summaries you can plug into recommendation
and churn modeling projects.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


DEFAULT_LAYER3_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer3_mirofish')
DEFAULT_OUTPUT_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer4_integration')


@dataclass
class Layer4State:
    run_id: str
    layer3_personas_file: str
    layer3_entities_file: str
    layer3_edges_file: str
    layer3_snapshot_file: str
    output_dir: str
    generated_at_utc: str
    version: str = '1.0'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'run_id': self.run_id,
            'layer3_personas_file': self.layer3_personas_file,
            'layer3_entities_file': self.layer3_entities_file,
            'layer3_edges_file': self.layer3_edges_file,
            'layer3_snapshot_file': self.layer3_snapshot_file,
            'output_dir': self.output_dir,
            'generated_at_utc': self.generated_at_utc,
            'version': self.version,
        }


class PipelineError(RuntimeError):
    pass


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Run Layer 4 model-integration feature preparation')
    parser.add_argument('--run', choices=['transform', 'all'], default='all', help='Run mode (transform runs local computation only)')
    parser.add_argument('--check', action='store_true', help='Validate existing Layer 4 artifacts only')
    parser.add_argument('--input-personas', default=str(DEFAULT_LAYER3_DIR / 'layer3_tuned_personas.jsonl'))
    parser.add_argument('--input-entities', default=str(DEFAULT_LAYER3_DIR / 'layer3_entities.jsonl'))
    parser.add_argument('--input-edges', default=str(DEFAULT_LAYER3_DIR / 'layer3_edges.jsonl'))
    parser.add_argument('--input-snapshot', default=str(DEFAULT_LAYER3_DIR / 'layer3_graph_snapshot.json'))
    parser.add_argument('--output-dir', default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument('--top-trend-interests', type=int, default=40)
    parser.add_argument('--top-trend-skills', type=int, default=30)
    parser.add_argument('--pagerank-iterations', type=int, default=24)
    parser.add_argument('--strict', action='store_true', help='Fail if checks do not pass')
    parser.add_argument('--sample-head', type=int, default=0, help='Optional limit for processing first N personas for fast dry runs')
    return parser.parse_args()


def _read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f'Missing JSONL input file: {path}')
    rows = []
    with path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f'Invalid JSONL at {path}:{i}') from e
    if not rows:
        raise ValueError(f'No rows loaded from {path}')
    return rows


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, (set, tuple)):
        return list(obj)
    if hasattr(obj, 'tolist'):
        try:
            return obj.tolist()
        except Exception:
            pass
    return obj


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


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        return int(float(value))
    except Exception:
        return None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == '':
            return default
        return float(value)
    except Exception:
        return default


def _normalize_token(value: Any) -> str:
    text = _safe_str(value).lower()
    text = text.replace('\u2013', '-')
    text = text.replace('\u2014', '-')
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        return ''
    return text


def _split_tokens(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        vals = value
    elif isinstance(value, tuple):
        vals = list(value)
    elif isinstance(value, str):
        # Keep semicolon-delimited or list-like fallback behavior.
        txt = value.strip()
        if not txt:
            return []
        txt = txt.strip('[]')
        split = [x for x in re.split(r',|;', txt) if x.strip()]
        vals = split
    else:
        vals = [value]
    out = []
    for item in vals:
        token = _normalize_token(item)
        if token:
            out.append(token)
    # de-dup while keeping order
    seen = set()
    deduped = []
    for t in out:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped


def _to_jsonl(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=_jsonable) + '\n')


def _to_csv(path: Path, rows: Sequence[Dict[str, Any]], fieldnames: Optional[Sequence[str]] = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open('w', encoding='utf-8', newline='') as f:
            f.write('')
        return
    if fieldnames is None:
        fieldnames = sorted({k for r in rows for k in r.keys()})
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(fieldnames))
        writer.writeheader()
        for row in rows:
            safe_row = {}
            for k in fieldnames:
                value = row.get(k)
                if isinstance(value, (dict, list)):
                    safe_row[k] = json.dumps(value, ensure_ascii=False)
                else:
                    safe_row[k] = value
            writer.writerow(safe_row)


def _age_bucket(age: Optional[int]) -> str:
    if age is None:
        return 'unknown'
    if age < 18:
        return 'under_18'
    if age < 25:
        return '18_24'
    if age < 35:
        return '25_34'
    if age < 45:
        return '35_44'
    if age < 55:
        return '45_54'
    if age < 65:
        return '55_64'
    return '65_plus'


def _occupation_bucket(occupation: str) -> str:
    text = _safe_str(occupation).lower()
    if not text:
        return 'unknown'
    if 'student' in text:
        return 'student'
    if 'manager' in text or 'official' in text or 'professional' in text or 'specialist' in text:
        return 'professional'
    if 'technician' in text or 'associate' in text or 'analyst' in text or 'assistant' in text:
        return 'knowledge_worker'
    if 'sales' in text or 'service' in text or 'retail' in text or 'agent' in text:
        return 'service'
    if 'cleaner' in text or 'operator' in text or 'maintenance' in text:
        return 'operations'
    if 'unemployed' in text:
        return 'unemployed'
    if 'retired' in text:
        return 'retired'
    if 'homemaker' in text:
        return 'homemaker'
    return 'other'


def _build_graph_components(nodes: Sequence[str], out_edges: Dict[str, List[Tuple[str, float, str]]]) -> Dict[str, int]:
    undirected = defaultdict(set)
    for src, targets in out_edges.items():
        for dst, _, _ in targets:
            undirected[src].add(dst)
            undirected[dst].add(src)
    for node in nodes:
        undirected.setdefault(node, set())

    comp_id = 0
    comp_map: Dict[str, int] = {}
    seen = set()
    for node in nodes:
        if node in seen:
            continue
        comp_id += 1
        q = deque([node])
        seen.add(node)
        component_nodes = []
        while q:
            cur = q.popleft()
            component_nodes.append(cur)
            for nxt in undirected[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    q.append(nxt)
        for n in component_nodes:
            comp_map[n] = comp_id
    return comp_map


def _pagerank(nodes: Sequence[str], out_edges: Dict[str, List[Tuple[str, float, str]]], iterations: int = 24, damping: float = 0.85) -> Dict[str, float]:
    if not nodes:
        return {}
    node_set = set(nodes)
    n = len(node_set)
    rank = {node: 1.0 / n for node in node_set}
    base = (1.0 - damping) / n

    out_weight_totals = {node: sum(max(0.0, w) for _, w, _ in outs) for node, outs in out_edges.items()}

    for _ in range(max(1, iterations)):
        next_rank = {node: base for node in node_set}
        dangling_sum = 0.0
        for u in node_set:
            outgoing = out_edges.get(u, [])
            denom = out_weight_totals.get(u, 0.0)
            if not outgoing or denom <= 0:
                dangling_sum += rank[u]
                continue
            for v, w, _ in outgoing:
                if v not in node_set or denom <= 0:
                    continue
                next_rank[v] += damping * rank[u] * (max(0.0, w) / denom)

        if dangling_sum:
            share = damping * dangling_sum / n
            for node in node_set:
                next_rank[node] += share
        rank = next_rank

    # Normalize to [0,1]
    max_rank = max(rank.values()) if rank else 1.0
    if max_rank <= 0:
        return {k: 0.0 for k in node_set}
    return {k: v / max_rank for k, v in rank.items()}


def _build_graph_index(persona_ids: Sequence[str], edges: Sequence[Dict[str, Any]], pagerank_iterations: int = 24) -> Tuple[Dict[str, float], Dict[str, float], Dict[str, float], Dict[str, Dict[str, float]], Dict[str, int], Dict[str, List[Tuple[str, float, str]]], Dict[str, int]]:
    node_set = set(persona_ids)
    out_degree = Counter()
    in_degree = Counter()
    out_weight = Counter()
    in_weight = Counter()
    out_edges: Dict[str, List[Tuple[str, float, str]]] = defaultdict(list)
    for edge in edges:
        src = _safe_str(edge.get('source'))
        dst = _safe_str(edge.get('target'))
        if not src or not dst:
            continue
        if src not in node_set or dst not in node_set:
            continue
        rel = _safe_str(edge.get('relation', 'related')) or 'related'
        weight = _safe_float(edge.get('weight'), default=1.0)
        weight = max(0.0, weight)
        out_edges[src].append((dst, weight, rel))
        out_degree[src] += 1
        in_degree[dst] += 1
        out_weight[src] += weight
        in_weight[dst] += weight

    component_map = _build_graph_components(list(node_set), out_edges)
    pagerank_scores = _pagerank(list(node_set), out_edges, iterations=max(1, pagerank_iterations), damping=0.85)

    # Edge relation features can be recovered by summing by relation for each node
    in_relation = defaultdict(Counter)
    for src, targets in out_edges.items():
        for dst, weight, rel in targets:
            in_relation[dst][rel] += weight

    return (
        in_degree,
        out_degree,
        pagerank_scores,
        {node: {k: v for k, v in in_relation[node].items()} for node in node_set},
        {node: in_weight[node] for node in node_set},
        out_edges,
        {node: out_weight[node] for node in node_set},
    )


def _score_risk(val: float) -> str:
    if val >= 0.67:
        return 'high'
    if val >= 0.33:
        return 'medium'
    return 'low'


def _clamp01(v: float) -> float:
    if v < 0:
        return 0.0
    if v > 1:
        return 1.0
    return v


def build_layer4_outputs(
    personas: Sequence[Dict[str, Any]],
    entities: Sequence[Dict[str, Any]],
    edges: Sequence[Dict[str, Any]],
    snapshot: Dict[str, Any],
    top_trend_interests: int,
    top_trend_skills: int,
    pagerank_iterations: int,
    sample_head: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    rows = list(personas)
    if sample_head > 0:
        rows = rows[:sample_head]

    persona_ids = [_safe_str(r.get('persona_id')) for r in rows]
    persona_ids = [pid for pid in persona_ids if pid]

    in_degree, out_degree, pagerank_scores, in_relation, in_weight, out_edges, out_weight = _build_graph_index(
        persona_ids,
        edges,
        pagerank_iterations=pagerank_iterations,
    )
    component_map = _build_graph_components(persona_ids, out_edges)

    # Global frequency maps
    all_interests: List[str] = []
    all_skills: List[str] = []
    node_interest_map: Dict[str, List[str]] = {}
    node_skill_map: Dict[str, List[str]] = {}

    for row in rows:
        pid = _safe_str(row.get('persona_id'))
        interests = _split_tokens(row.get('interests_tuned', row.get('interests_seed', [])))
        skills = _split_tokens(row.get('skills_tuned', row.get('skills_seed', [])))
        node_interest_map[pid] = interests
        node_skill_map[pid] = skills
        all_interests.extend(interests)
        all_skills.extend(skills)

    interest_counter = Counter(all_interests)
    skill_counter = Counter(all_skills)
    top_interests = [k for k, _ in interest_counter.most_common(max(1, top_trend_interests))]
    top_skills = [k for k, _ in skill_counter.most_common(max(1, top_trend_skills))]
    def _node_feature_values(pid: str, fields: Dict[str, int]) -> float:
        return fields.get(pid, 0)

    max_degree = max([_node_feature_values(pid, out_degree) + _node_feature_values(pid, in_degree) for pid in persona_ids] or [0])
    max_weighted_degree = max([_node_feature_values(pid, out_weight) + _node_feature_values(pid, in_weight) for pid in persona_ids] or [1.0])
    component_sizes = Counter(component_map.values())

    feature_rows: List[Dict[str, Any]] = []
    recommendation_rows: List[Dict[str, Any]] = []
    churn_rows: List[Dict[str, Any]] = []

    for idx, row in enumerate(rows):
        pid = _safe_str(row.get('persona_id')) or f'person_{idx}'
        demographics = row.get('input', {}).get('demographics', {}) if isinstance(row.get('input'), dict) else row.get('demographics', {})
        location = row.get('input', {}).get('location', {}) if isinstance(row.get('input'), dict) else row.get('location', {})
        profession = row.get('input', {}).get('profession', {}) if isinstance(row.get('input'), dict) else row.get('profession', {})

        sex = _safe_str(demographics.get('sex'))
        age = _safe_int(demographics.get('age'))
        marital_status = _safe_str(demographics.get('marital_status'))
        education_level = _safe_str(demographics.get('education_level'))

        country = _safe_str(location.get('country')) or _safe_str(row.get('country'))
        planning_area = _safe_str(location.get('planning_area')) or _safe_str(row.get('planning_area'))
        occupation = _safe_str(profession.get('occupation')) or _safe_str(row.get('occupation'))
        industry = _safe_str(profession.get('industry')) or _safe_str(row.get('industry'))

        age_b = _age_bucket(age)
        occ_b = _occupation_bucket(occupation)
        segment = f'{occ_b}|{age_b}'

        interests = node_interest_map.get(pid, [])
        skills = node_skill_map.get(pid, [])
        interest_count = len(interests)
        skill_count = len(skills)

        trend_interests = [t for t in interests if t in top_interests][:10]
        trend_overlap_ratio = len(trend_interests) / max(1, len(interests))
        trend_rarity = 0.0
        for t in interests:
            share = interest_counter[t] / max(1, len(all_interests))
            trend_rarity += (1.0 - share)
        trend_rarity = trend_rarity / max(1, len(interests))

        in_deg = float(in_degree.get(pid, 0))
        out_deg = float(out_degree.get(pid, 0))
        deg_total = in_deg + out_deg
        in_w = float(in_weight.get(pid, 0.0))
        out_w = float(out_weight.get(pid, 0.0))
        weighted_total = in_w + out_w

        norm_degree = deg_total / max(1.0, float(max_degree))
        norm_weight = weighted_total / max(1.0, float(max_weighted_degree))
        peer_in = float(in_relation.get(pid, {}).get('peer_influence', 0.0))
        overlap_in = float(in_relation.get(pid, {}).get('interest_overlap', 0.0))
        raw_pagerank = float(pagerank_scores.get(pid, 0.0))

        rec_score = _clamp01(0.45 * _clamp01(raw_pagerank) + 0.30 * _clamp01(trend_overlap_ratio) + 0.15 * _clamp01(norm_weight) + 0.10 * _clamp01(_clamp01(interest_count / 20.0)))

        # Churn proxy is engineered from synthetic proxy logic only.
        connection_risk = 1.0 - _clamp01(norm_degree)
        low_interest_risk = _clamp01(1.0 - _clamp01(interest_count / 12.0))
        age_risk = 0.35 if age is not None and age >= 65 else (0.22 if age is not None and age >= 50 else 0.12)
        occupation_risk = 0.22 if occ_b in {'unemployed', 'student', 'homemaker', 'retired'} else 0.12
        churn_risk = _clamp01(0.40 * connection_risk + 0.25 * low_interest_risk + 0.25 * age_risk + 0.10 * occupation_risk)

        comp = int(component_map.get(pid, 0))
        comp_size = int(component_sizes.get(comp, 1))

        # Segment-level aggregation-friendly row
        feat: Dict[str, Any] = {
            'persona_id': pid,
            'segment': segment,
            'age': age,
            'age_bucket': age_b,
            'sex': sex,
            'marital_status': marital_status,
            'education_level': education_level,
            'country': country,
            'planning_area': planning_area,
            'occupation': occupation,
            'occupation_bucket': occ_b,
            'industry': industry,
            'input_index': idx,
            'interest_count': interest_count,
            'skill_count': skill_count,
            'trend_interest_count': len(trend_interests),
            'trend_overlap_ratio': round(trend_overlap_ratio, 4),
            'trend_rarity': round(trend_rarity, 6),
            'top_trend_interests': trend_interests,
            'top_skills': skills[:10],
            'degree_in': int(in_deg),
            'degree_out': int(out_deg),
            'degree_total': int(deg_total),
            'norm_degree': round(norm_degree, 6),
            'weighted_degree_in': round(in_w, 6),
            'weighted_degree_out': round(out_w, 6),
            'weighted_degree_total': round(weighted_total, 6),
            'norm_weight': round(norm_weight, 6),
            'pagerank_norm': round(raw_pagerank, 6),
            'peer_influence_in': round(peer_in, 6),
            'interest_overlap_in': round(overlap_in, 6),
            'component_id': comp,
            'component_size': comp_size,
            'rec_score_proxy': round(rec_score, 6),
            'churn_proxy_score': round(churn_risk, 6),
            'churn_risk_tier': _score_risk(churn_risk),
            'tuning_state': _safe_str((row.get('tuning') or {}).get('tuning_state', 'seed_only')),
        }

        rec = {
            'persona_id': pid,
            'rec_score_proxy': round(rec_score, 6),
            'segment': segment,
            'top_recommendation_candidates': trend_interests[:6],
            'rec_candidate_count': len(trend_interests),
            'recommendation_reason': 'Interest overlap with global Layer 3 top trends and local graph influence',
            'graph_centrality': round(raw_pagerank, 6),
            'neighbor_influence_band': 'high' if peer_in > 2.0 else ('medium' if peer_in > 0.6 else 'low'),
        }

        churn = {
            'persona_id': pid,
            'churn_proxy_score': round(churn_risk, 6),
            'churn_risk_tier': _score_risk(churn_risk),
            'churn_reason_pack': {
                'connection_risk': round(connection_risk, 6),
                'low_interest_risk': round(low_interest_risk, 6),
                'age_risk': age_risk,
                'occupation_risk': occupation_risk,
            },
            'churn_component_score': {
                'norm_degree': round(norm_degree, 6),
                'norm_interest_count': round(_clamp01(interest_count / 15.0), 6),
                'component_size': comp_size,
            },
        }

        feature_rows.append(feat)
        recommendation_rows.append(rec)
        churn_rows.append(churn)

    # Segment summaries for analysts
    segment_stats: Dict[str, Dict[str, Any]] = {}
    for row in feature_rows:
        seg = row['segment']
        st = segment_stats.setdefault(seg, {
            'segment': seg,
            'persona_count': 0,
            'avg_degree_total': 0.0,
            'avg_rec_score': 0.0,
            'avg_churn_risk': 0.0,
            'avg_interest_count': 0.0,
            'top_trend_interests': Counter(),
        })
        st['persona_count'] += 1
        st['avg_degree_total'] += row['degree_total']
        st['avg_rec_score'] += row['rec_score_proxy']
        st['avg_churn_risk'] += row['churn_proxy_score']
        st['avg_interest_count'] += row['interest_count']
        for t in row['top_trend_interests']:
            st['top_trend_interests'][t] += 1

    for st in segment_stats.values():
        c = max(1, st['persona_count'])
        st['avg_degree_total'] = round(st['avg_degree_total'] / c, 4)
        st['avg_rec_score'] = round(st['avg_rec_score'] / c, 6)
        st['avg_churn_risk'] = round(st['avg_churn_risk'] / c, 6)
        st['avg_interest_count'] = round(st['avg_interest_count'] / c, 4)
        st['top_trend_interests'] = [
            {'interest': int_item, 'personas': count}
            for int_item, count in st['top_trend_interests'].most_common(min(12, top_trend_interests))
        ]

    segment_rows = [
        {
            'segment': v['segment'],
            'persona_count': v['persona_count'],
            'avg_degree_total': v['avg_degree_total'],
            'avg_rec_score': v['avg_rec_score'],
            'avg_churn_risk': v['avg_churn_risk'],
            'avg_interest_count': v['avg_interest_count'],
            'top_interests': v['top_trend_interests'],
        }
        for v in sorted(segment_stats.values(), key=lambda x: x['segment'])
    ]

    # Top global trend snapshot for analyst inspection
    trend_snapshot = {
        'generated_at_utc': _now_iso(),
        'inputs': {
            'num_personas': len(rows),
            'num_edges': len(edges),
            'num_entities': len(entities),
            'snapshot_source': 'layer3_graph_snapshot.json',
            'snapshot_keys': sorted(snapshot.keys()) if isinstance(snapshot, dict) else [],
        },
        'top_interests': [
            {'interest': k, 'count': int(v), 'share': round(v / max(1, len(all_interests)), 6)}
            for k, v in interest_counter.most_common(top_trend_interests)
        ],
        'top_skills': [
            {'skill': k, 'count': int(v), 'share': round(v / max(1, len(all_skills)), 6)}
            for k, v in skill_counter.most_common(top_trend_skills)
        ],
        'segment_count': len(segment_rows),
        'high_influence_personas': [
            {
                'persona_id': pid,
                'pagerank': round(float(pagerank_scores.get(pid, 0.0)), 6),
                'degree_total': int((in_degree.get(pid, 0) + out_degree.get(pid, 0))),
            }
            for pid, _ in sorted(pagerank_scores.items(), key=lambda x: x[1], reverse=True)[:15]
        ],
        'top_relation_breakdown': [
            {'relation': k, 'count': int(v)} for k, v in Counter(edge.get('relation', 'related') for edge in edges).most_common()
        ],
    }

    return feature_rows, recommendation_rows, churn_rows, {
        'trends': trend_snapshot,
        'segments': segment_rows,
        'pagerank_iterations': pagerank_iterations,
        'top_trend_interests': top_interests,
        'top_trend_skills': top_skills,
        'nodes': len(persona_ids),
    }


def _build_layer4_checks(out_dir: Path) -> Dict[str, Any]:
    checks: Dict[str, Any] = {
        'exists_output_dir': out_dir.exists(),
        'files': {},
        'pass': True,
    }
    required = {
        'feature_matrix': out_dir / 'layer4_feature_matrix.jsonl',
        'recommendations': out_dir / 'layer4_recommendation_features.jsonl',
        'churn': out_dir / 'layer4_churn_features.jsonl',
        'segments': out_dir / 'layer4_segments.json',
        'lineage': out_dir / 'layer4_feature_lineage.csv',
        'manifest': out_dir / 'layer4_manifest.json',
    }
    for key, p in required.items():
        checks['files'][key] = {
            'path': str(p),
            'exists': p.exists(),
        }
        if p.exists():
            checks['files'][key]['sha256'] = _sha256_file(p)

    try:
        features = list(_read_jsonl(required['feature_matrix'])) if required['feature_matrix'].exists() else []
        rec = list(_read_jsonl(required['recommendations'])) if required['recommendations'].exists() else []
        churn = list(_read_jsonl(required['churn'])) if required['churn'].exists() else []
        checks['counts'] = {
            'feature_rows': len(features),
            'recommendation_rows': len(rec),
            'churn_rows': len(churn),
        }
        checks['has_unique_persona_ids'] = len({r.get('persona_id') for r in features}) == len(features)
        checks['feature_rows_have_scores'] = all(isinstance(r.get('rec_score_proxy'), (int, float)) for r in features)
        checks['churn_scores_valid'] = all(0.0 <= float(r.get('churn_proxy_score', 0.0)) <= 1.0 for r in churn if isinstance(r.get('churn_proxy_score'), (int, float, str))
)
    except Exception as e:
        checks.setdefault('errors', []).append(f'Check parse failure: {e}')
        checks['pass'] = False
        return checks

    required_keys = ['feature_rows', 'recommendation_rows', 'churn_rows']
    if not all(checks['counts'].get(k, 0) > 0 for k in required_keys):
        checks['pass'] = False
    if not checks.get('has_unique_persona_ids', False):
        checks['pass'] = False
    if not checks.get('feature_rows_have_scores', False):
        checks['pass'] = False
    if not checks.get('churn_scores_valid', False):
        checks['pass'] = False

    # Ensure row counts align when possible
    if checks['counts'].get('feature_rows') and checks['counts']['feature_rows'] != checks['counts']['recommendation_rows']:
        checks['counts']['row_mismatch'] = 'feature/recommendation mismatch'
        checks['pass'] = False
    if checks['counts'].get('feature_rows') and checks['counts']['feature_rows'] != checks['counts']['churn_rows']:
        checks['counts']['row_mismatch'] = checks['counts'].get('row_mismatch', 'feature/churn mismatch')
        checks['pass'] = False
    return checks


def _run_check_mode(out_dir: Path, strict: bool) -> Dict[str, Any]:
    checks = _build_layer4_checks(out_dir)
    if strict and not checks.get('pass', False):
        raise PipelineError(f'Layer 4 checks failed: {json.dumps(checks, ensure_ascii=False)}')
    return {'layer': 4, 'checks': checks}


def _write_readme(out_dir: Path) -> None:
    readme = out_dir / 'README.md'
    readme.write_text(
        '# Layer 4: Analyst Integration Features\n\n'
        'This layer converts Layer 3 graph/persona outputs into model-ready features:\n'
        '- layer4_feature_matrix.jsonl: persona-level feature table\n'
        '- layer4_recommendation_features.jsonl: recommendation feature table\n'
        '- layer4_churn_features.jsonl: churn proxy table\n'
        '- layer4_segments.json: trend and segment summary\n'
        '- layer4_feature_lineage.csv: source mapping for feature columns\n'
        '- layer4_manifest.json: manifest + checks\n\n'
        'Check command:\n'
        'python /Users/kyiwaithant/Documents/Shopee/prepare_layer4_model_integration.py --check --output-dir /Users/kyiwaithant/Documents/Shopee/market_analysis_layer4_integration\n'
        , encoding='utf-8'
    )


def run(args: argparse.Namespace) -> Dict[str, Any]:
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.check:
        return _run_check_mode(output_dir, args.strict)

    personas = _read_jsonl(Path(args.input_personas))
    entities = _read_jsonl(Path(args.input_entities))
    edges = _read_jsonl(Path(args.input_edges))
    snapshot = _read_json(Path(args.input_snapshot))

    feature_rows, rec_rows, churn_rows, summary = build_layer4_outputs(
        personas=personas,
        entities=entities,
        edges=edges,
        snapshot=snapshot,
        top_trend_interests=args.top_trend_interests,
        top_trend_skills=args.top_trend_skills,
        pagerank_iterations=args.pagerank_iterations,
        sample_head=args.sample_head,
    )

    feature_path = output_dir / 'layer4_feature_matrix.jsonl'
    rec_path = output_dir / 'layer4_recommendation_features.jsonl'
    churn_path = output_dir / 'layer4_churn_features.jsonl'
    segment_path = output_dir / 'layer4_segments.json'
    lineage_path = output_dir / 'layer4_feature_lineage.csv'

    _to_jsonl(feature_path, feature_rows)
    _to_jsonl(rec_path, rec_rows)
    _to_jsonl(churn_path, churn_rows)

    with segment_path.open('w', encoding='utf-8') as f:
        segment_payload = {
            'segments': summary.get('segments', []),
            'trends': summary.get('trends', {}),
            'pagerank_iterations': summary.get('pagerank_iterations'),
            'top_trend_interests': summary.get('top_trend_interests'),
            'top_trend_skills': summary.get('top_trend_skills'),
            'nodes': summary.get('nodes'),
        }
        json.dump(segment_payload, f, ensure_ascii=False, indent=2, default=_jsonable)

    lineage_fields = [
        'feature_name', 'feature_type', 'source', 'definition', 'owner', 'notes',
    ]
    lineage_rows = [
        {
            'feature_name': 'age_bucket',
            'feature_type': 'categorical',
            'source': 'layer3_tuned_personas.input.demographics.age',
            'definition': 'Age bucket for cohorting',
            'owner': 'analyst',
            'notes': 'Deterministic bucket by static rules',
        },
        {
            'feature_name': 'rec_score_proxy',
            'feature_type': 'numeric',
            'source': 'layer3_edges + layer3_tuned_personas.interests_tuned',
            'definition': 'Synthetic recommendation score proxy from pagerank + trend overlap + graph weight',
            'owner': 'analyst',
            'notes': 'Not a production score. Recalibrate with labels before use',
        },
        {
            'feature_name': 'churn_proxy_score',
            'feature_type': 'numeric',
            'source': 'layer3 graph degree + demographics',
            'definition': 'Synthetic churn risk proxy for prioritization / triage',
            'owner': 'analyst',
            'notes': 'Composite risk only; requires real outcome labels',
        },
    ]
    _to_csv(lineage_path, lineage_rows, fieldnames=lineage_fields)

    run_state = Layer4State(
        run_id=f'layer4-{_now_iso()}',
        layer3_personas_file=str(Path(args.input_personas)),
        layer3_entities_file=str(Path(args.input_entities)),
        layer3_edges_file=str(Path(args.input_edges)),
        layer3_snapshot_file=str(Path(args.input_snapshot)),
        output_dir=str(output_dir),
        generated_at_utc=_now_iso(),
    )

    manifest = {
        'generated_at_utc': _now_iso(),
        'project': 'Autonomous Proactive Market Analysis',
        'layer': 4,
        'run_state': run_state.to_dict(),
        'outputs': {
            'feature_matrix': str(feature_path),
            'recommendation_features': str(rec_path),
            'churn_features': str(churn_path),
            'segments': str(segment_path),
            'lineage': str(lineage_path),
        },
        'summary': summary,
    }
    manifest['outputs']['run_config'] = {
        'top_trend_interests': args.top_trend_interests,
        'top_trend_skills': args.top_trend_skills,
        'pagerank_iterations': args.pagerank_iterations,
        'sample_head': args.sample_head,
    }
    manifest['checks'] = _build_layer4_checks(output_dir)
    manifest_path = output_dir / 'layer4_manifest.json'
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, default=_jsonable)

    _write_readme(output_dir)

    result = {
        'run_id': run_state.run_id,
        'outputs': {
            'feature_matrix': str(feature_path),
            'recommendation_features': str(rec_path),
            'churn_features': str(churn_path),
            'segments': str(segment_path),
            'lineage': str(lineage_path),
            'manifest': str(manifest_path),
        },
        'counts': {
            'layer4_features': len(feature_rows),
            'recommendation_rows': len(rec_rows),
            'churn_rows': len(churn_rows),
        },
        'checks': manifest['checks'],
    }

    if args.strict and not result['checks'].get('pass', False):
        raise PipelineError(f'Layer 4 strict checks failed: {json.dumps(result["checks"], ensure_ascii=False, default=_jsonable)}')
    return result


def main() -> None:
    args = _parse_args()
    result = run(args)
    print(json.dumps(result, ensure_ascii=False, indent=2, default=_jsonable))


if __name__ == '__main__':
    main()
