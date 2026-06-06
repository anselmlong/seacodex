#!/usr/bin/env python3
"""Layer 6: Offline deterministic campaign propagation simulation trace.

This script generates a synthetic Stochastic Block Model (SBM) social graph and
simulates 10-tick campaign propagation with no live LLM calls.

States:
- unexposed
- exposed
- adopted
- resistant

Event types per tick:
- exposure
- adoption
- resistance
- reshare
- mutation

The full event trace is fully precomputed before output, so demo playback can
be driven from a static file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


DEFAULT_OUTPUT_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer6_simulation')
DEFAULT_SCHEMA_PATH = Path('/Users/kyiwaithant/Documents/Shopee/shared/contracts/simulation-trace.schema.json')

COMMUNITIES = [
    'family',
    'workplace',
    'fandom',
    'reseller',
    'school_university',
]

# Within-community vs cross-community edges (directed p_u->v)
SBM_EDGE_PROB = [
    [0.28, 0.06, 0.04, 0.03, 0.04],  # family
    [0.06, 0.24, 0.03, 0.06, 0.05],  # workplace
    [0.04, 0.03, 0.26, 0.03, 0.02],  # fandom
    [0.03, 0.05, 0.03, 0.23, 0.04],  # reseller
    [0.04, 0.05, 0.02, 0.04, 0.21],  # school_university
]


@dataclass
class CampaignParams:
    exposure_base: float = 0.22
    adoption_rate: float = 0.18
    adoption_boost_for_adopters: float = 1.4
    resistance_rate_exposed: float = 0.03
    resistance_rate_adopted: float = 0.01
    reshare_rate: float = 0.16
    cross_community_penalty: float = 0.55
    mutation_every: int = 2
    mutation_change_scale: float = 0.04


@dataclass
class CampaignState:
    seed: int
    tick_count: int
    node_count: int
    community_sizes: List[int]
    community_names: List[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'seed': self.seed,
            'tick_count': self.tick_count,
            'node_count': self.node_count,
            'community_names': self.community_names or COMMUNITIES,
            'community_sizes': self.community_sizes,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_int(v: Any, default: int) -> int:
    try:
        if v is None or v == '':
            return default
        return int(v)
    except Exception:
        return default


def _safe_float(v: Any, default: float) -> float:
    try:
        if v is None or v == '':
            return default
        return float(v)
    except Exception:
        return default


def _sha256_bytes(payload: str) -> str:
    h = hashlib.sha256(payload.encode('utf-8'))
    return h.hexdigest()


def _build_communities(node_count: int, community_names: Sequence[str], seed: int) -> Dict[str, List[str]]:
    base, rem = divmod(node_count, len(community_names))
    sizes = [base + (1 if i < rem else 0) for i in range(len(community_names))]
    nodes_by_comm: Dict[str, List[str]] = {}
    idx = 0
    for i, cname in enumerate(community_names):
        size = sizes[i]
        nodes = []
        for j in range(size):
            nodes.append(f'{cname}_{j+1:03d}_{seed}')
            idx += 1
        nodes_by_comm[cname] = nodes
    return nodes_by_comm


def _build_node_records(
    nodes_by_comm: Dict[str, List[str]],
    comm_order: Sequence[str],
) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, str], Dict[Tuple[str, str], float]]:
    node_records: List[Dict[str, Any]] = []
    node_order: List[str] = []
    community_map: Dict[str, str] = {}
    for community in comm_order:
        for node_id in nodes_by_comm.get(community, []):
            node_order.append(node_id)
            community_map[node_id] = community
            node_records.append(
                {
                    'persona_id': node_id,
                    'community': community,
                    'seed': int(node_id.rsplit('_', 1)[-1]),
                }
            )
    return node_records, node_order, community_map, {k: v for k, v in zip(comm_order, comm_order)}


def _build_sbm_edges(
    nodes_by_comm: Dict[str, List[str]],
    community_names: Sequence[str],
    seed: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, List[Tuple[str, float]]], Dict[Tuple[str, str], int]]:
    rng = random.Random(seed)
    edges: List[Dict[str, Any]] = []
    adjacency: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
    comm_edge_counts: Dict[Tuple[str, str], int] = defaultdict(int)

    all_nodes = {c: nodes_by_comm[c] for c in community_names}

    community_index = {community: idx for idx, community in enumerate(community_names)}
    node_by_comm: List[Tuple[str, str]] = []
    for cname in community_names:
        for node_id in nodes_by_comm[cname]:
            node_by_comm.append((node_id, cname))

    for src_id, src_comm in node_by_comm:
        for dst_id, dst_comm in node_by_comm:
            if src_id == dst_id:
                continue
            p = SBM_EDGE_PROB[community_index[src_comm]][community_index[dst_comm]]
            if rng.random() <= p:
                w = round(rng.uniform(0.25, 1.0), 4)
                edges.append(
                    {
                        'source': src_id,
                        'target': dst_id,
                        'weight': w,
                        'source_community': src_comm,
                        'target_community': dst_comm,
                    }
                )
                adjacency[src_id].append((dst_id, w))
                comm_edge_counts[(src_comm, dst_comm)] += 1

    # deterministic ordering for reproducibility and stable traces
    for src in adjacency:
        adjacency[src].sort(key=lambda item: item[0])

    return edges, adjacency, dict(comm_edge_counts)


def _sample_initial_exposed(nodes: Sequence[str], rng: random.Random, count: int) -> List[str]:
    return sorted(rng.sample(list(nodes), k=min(count, len(nodes))))


def _build_trace_id(params: CampaignState) -> str:
    base = f"sim-{params.seed}-{params.node_count}-{params.tick_count}-{_now_iso()}"
    return 'trace-' + _sha256_bytes(base)[:14]


def _build_schema_reference() -> Dict[str, Any]:
    return {
        'schema_uri': 'file:///shared/contracts/simulation-trace.schema.json',
        'schema_version': '1.0.0',
    }


def _simulate(
    node_order: List[str],
    adjacency: Dict[str, List[Tuple[str, float]]],
    community_map: Dict[str, str],
    params: CampaignParams,
    seed: int,
    ticks: int,
    initial_exposed: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    rng = random.Random(seed + 11_001)
    states: Dict[str, str] = {node: 'unexposed' for node in node_order}

    # Tick 0 seed: initial exposures
    tick_records: List[Dict[str, Any]] = []
    nodes_to_seed = _sample_initial_exposed(node_order, rng, initial_exposed)
    tick0_events: List[Dict[str, Any]] = []
    tick0_state_counts = {'unexposed': len(node_order), 'exposed': 0, 'adopted': 0, 'resistant': 0}
    for node_id in nodes_to_seed:
        states[node_id] = 'exposed'
        event = {
            'event_type': 'exposure',
            'tick': 0,
            'source': 'campaign_seed',
            'target': node_id,
            'from_state': 'unexposed',
            'to_state': 'exposed',
            'community': community_map[node_id],
            'notes': 'deterministic initial seed exposure',
        }
        tick0_events.append(event)

    tick0_state_counts['unexposed'] -= len(nodes_to_seed)
    tick0_state_counts['exposed'] += len(nodes_to_seed)

    # optional baseline mutation at tick 0 to make demo contract explicit
    baseline_params = {
        'exposure_base': params.exposure_base,
        'adoption_rate': params.adoption_rate,
        'resistance_rate_exposed': params.resistance_rate_exposed,
        'resistance_rate_adopted': params.resistance_rate_adopted,
        'reshare_rate': params.reshare_rate,
        'adoption_boost_for_adopters': params.adoption_boost_for_adopters,
    }

    _ensure_event_coverage(tick0_events, 0)

    tick_records.append(
        {
            'tick': 0,
            'timestamp_utc': _now_iso(),
            'events': _normalize_events(tick0_events),
            'state_counts': dict(tick0_state_counts),
            'params_snapshot': {
                'exposure_base': params.exposure_base,
                'adoption_rate': params.adoption_rate,
                'resistance_rate_exposed': params.resistance_rate_exposed,
                'resistance_rate_adopted': params.resistance_rate_adopted,
                'reshare_rate': params.reshare_rate,
                'adoption_boost_for_adopters': params.adoption_boost_for_adopters,
            },
            'node_states': dict(states),
        }
    )

    for tick in range(1, ticks):
        tick_events: List[Dict[str, Any]] = []

        # --- mutation ---
        mutation_event = _maybe_mutate(params, tick, rng, params.mutation_every)
        tick_events.extend(mutation_event)

        # --- exposure phase ---
        exposure_candidates = []
        current_sources = [node for node, state in states.items() if state in {'exposed', 'adopted'}]
        for source in sorted(current_sources):
            src_state = states[source]
            for target, weight in sorted(adjacency.get(source, []), key=lambda e: e[0]):
                if states[target] != 'unexposed':
                    continue
                src_comm = community_map[source]
                tgt_comm = community_map[target]
                cross_factor = 1.0 if src_comm == tgt_comm else params.cross_community_penalty
                base = params.exposure_base
                if src_state == 'adopted':
                    base *= params.adoption_boost_for_adopters
                exposure_p = min(0.98, base * weight * cross_factor)
                if rng.random() <= exposure_p:
                    exposure_candidates.append((source, target, exposure_p, weight))

        # deterministically dedupe while keeping order and no duplicate targets in one tick
        exposed_by_target: Dict[str, Dict[str, Any]] = {}
        for source, target, exposure_p, weight in exposure_candidates:
            if target in exposed_by_target:
                continue
            previous = states[target]
            states[target] = 'exposed'
            exposed_by_target[target] = {
                'event_type': 'exposure',
                'tick': tick,
                'source': source,
                'target': target,
                'from_state': previous,
                'to_state': 'exposed',
                'community': community_map[target],
                'source_community': community_map[source],
                'edge_weight': weight,
                'probability': round(exposure_p, 6),
            }

        tick_events.extend(exposed_by_target.values())

        # --- adoption phase ---
        adoption_events = []
        for node in sorted(states.keys()):
            if states[node] != 'exposed':
                continue
            p_adopt = params.adoption_rate
            if rng.random() <= p_adopt:
                previous = states[node]
                states[node] = 'adopted'
                adoption_events.append(
                    {
                        'event_type': 'adoption',
                        'tick': tick,
                        'source': node,
                        'target': node,
                        'from_state': previous,
                        'to_state': 'adopted',
                        'community': community_map[node],
                        'probability': round(p_adopt, 6),
                    }
                )
        tick_events.extend(adoption_events)

        # --- resistance phase ---
        resistance_events = []
        for node in sorted(states.keys()):
            if states[node] not in {'exposed', 'adopted'}:
                continue
            rate = params.resistance_rate_adopted if states[node] == 'adopted' else params.resistance_rate_exposed
            if rng.random() <= rate:
                previous = states[node]
                states[node] = 'resistant'
                resistance_events.append(
                    {
                        'event_type': 'resistance',
                        'tick': tick,
                        'source': node,
                        'target': node,
                        'from_state': previous,
                        'to_state': 'resistant',
                        'community': community_map[node],
                        'rate': round(rate, 6),
                    }
                )
        tick_events.extend(resistance_events)

        # --- reshare phase ---
        reshare_events = []
        adopted_nodes = [node for node, state in states.items() if state == 'adopted']
        for source in sorted(adopted_nodes):
            if rng.random() > params.reshare_rate:
                continue
            nbrs = [n for n, _ in sorted(adjacency.get(source, []), key=lambda e: e[0])]
            if not nbrs:
                continue
            target = rng.choice(nbrs)
            if states[target] == 'unexposed':
                states[target] = 'exposed'
                reshare_events.append(
                    {
                        'event_type': 'reshare',
                        'tick': tick,
                        'source': source,
                        'target': target,
                        'from_state': 'unexposed',
                        'to_state': 'exposed',
                        'source_community': community_map[source],
                        'target_community': community_map[target],
                    }
                )
            else:
                reshare_events.append(
                    {
                        'event_type': 'reshare',
                        'tick': tick,
                        'source': source,
                        'target': target,
                        'from_state': states[target],
                        'to_state': states[target],
                        'source_community': community_map[source],
                        'target_community': community_map[target],
                        'outcome': 'already_active',
                    }
                )
        tick_events.extend(reshare_events)
        _ensure_event_coverage(tick_events, tick)

        state_counts = Counter(states.values())
        tick_records.append(
            {
                'tick': tick,
                'timestamp_utc': _now_iso(),
                'events': _normalize_events(tick_events),
                'state_counts': {
                    'unexposed': int(state_counts.get('unexposed', 0)),
                    'exposed': int(state_counts.get('exposed', 0)),
                    'adopted': int(state_counts.get('adopted', 0)),
                    'resistant': int(state_counts.get('resistant', 0)),
                },
                'params_snapshot': {
                    'exposure_base': params.exposure_base,
                    'adoption_rate': params.adoption_rate,
                    'resistance_rate_exposed': params.resistance_rate_exposed,
                    'resistance_rate_adopted': params.resistance_rate_adopted,
                    'reshare_rate': params.reshare_rate,
                    'adoption_boost_for_adopters': params.adoption_boost_for_adopters,
                },
                'node_states': dict(states),
            }
        )

    # Keep event order deterministic for trace replay consumers.
    # Event types grouped by tick are already ordered as:
    # mutation -> exposure -> adoption -> resistance -> reshare.
    summary = {
        'adopted_count': sum(1 for v in states.values() if v == 'adopted'),
        'resistant_count': sum(1 for v in states.values() if v == 'resistant'),
        'exposed_count': sum(1 for v in states.values() if v == 'exposed'),
        'unexposed_count': sum(1 for v in states.values() if v == 'unexposed'),
    }

    return tick_records, [dict(states),], summary




def _ensure_event_coverage(tick_events: List[Dict[str, Any]], tick: int) -> None:
    present = {ev.get('event_type') for ev in tick_events if isinstance(ev, dict)}
    defaults = {
        'mutation': {
            'event_type': 'mutation',
            'tick': tick,
            'mutation_id': f'mut-none-{tick}',
            'mutation_applied': False,
            'mutation_rule': 'none',
            'changes': {},
        },
        'exposure': {
            'event_type': 'exposure',
            'tick': tick,
            'source': 'campaign_engine',
            'target': None,
            'from_state': 'none',
            'to_state': 'none',
            'community': 'all',
            'notes': 'no new exposures this tick',
        },
        'adoption': {
            'event_type': 'adoption',
            'tick': tick,
            'source': 'campaign_engine',
            'target': None,
            'from_state': 'none',
            'to_state': 'none',
            'community': 'all',
            'notes': 'no new adoption this tick',
        },
        'resistance': {
            'event_type': 'resistance',
            'tick': tick,
            'source': 'campaign_engine',
            'target': None,
            'from_state': 'none',
            'to_state': 'none',
            'community': 'all',
            'notes': 'no new resistance this tick',
        },
        'reshare': {
            'event_type': 'reshare',
            'tick': tick,
            'source': 'campaign_engine',
            'target': None,
            'from_state': 'none',
            'to_state': 'none',
            'source_community': 'all',
            'target_community': 'all',
            'notes': 'no new reshare this tick',
        },
    }
    for event_type in ('mutation', 'exposure', 'adoption', 'resistance', 'reshare'):
        if event_type not in present:
            tick_events.append(defaults[event_type])


def _normalize_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Ensure deterministic field sets for consistent precomputed outputs and consumer.
    ordered: List[Dict[str, Any]] = []
    for ev in events:
        ev_type = ev.get('event_type')
        if ev_type == 'mutation':
            order = ['event_type', 'tick', 'mutation_id', 'mutation_applied', 'mutation_rule', 'changes', 'timestamp_utc']
        elif ev_type == 'exposure':
            order = ['event_type', 'tick', 'source', 'target', 'from_state', 'to_state', 'community', 'source_community', 'edge_weight', 'probability', 'notes']
        elif ev_type == 'adoption':
            order = ['event_type', 'tick', 'source', 'target', 'from_state', 'to_state', 'community', 'probability']
        elif ev_type == 'resistance':
            order = ['event_type', 'tick', 'source', 'target', 'from_state', 'to_state', 'community', 'rate']
        elif ev_type == 'reshare':
            order = ['event_type', 'tick', 'source', 'target', 'from_state', 'to_state', 'source_community', 'target_community', 'outcome']
        else:
            order = []

        if not order:
            ordered.append(ev)
            continue
        new_row: Dict[str, Any] = {}
        for key in order:
            if key in ev:
                new_row[key] = ev[key]
        # Keep any non-list fields if they appeared unexpectedly but not in order.
        for k, v in ev.items():
            if k not in new_row:
                new_row[k] = v
        ordered.append(new_row)

    return ordered


def _maybe_mutate(params: CampaignParams, tick: int, rng: random.Random, mutation_every: int) -> List[Dict[str, Any]]:
    if mutation_every <= 0:
        return [{
            'event_type': 'mutation',
            'tick': tick,
            'mutation_id': f'mut-none-{tick}',
            'mutation_applied': False,
            'mutation_rule': 'none',
            'changes': {},
            'timestamp_utc': _now_iso(),
        }]

    if tick % mutation_every != 0:
        return [{
            'event_type': 'mutation',
            'tick': tick,
            'mutation_id': f'mut-none-{tick}',
            'mutation_applied': False,
            'mutation_rule': 'none',
            'changes': {},
            'timestamp_utc': _now_iso(),
        }]

    # Deterministically mutate all parameters by bounded, signed deltas.
    raw = ((tick * 17 + int(rng.random() * 1000)) % 7) - 3
    sign = -1 if raw < 0 else 1
    # Keep deltas in deterministic, small range and avoid negatives.
    exposure_delta = sign * ((raw % 3) + 1) * params.mutation_change_scale
    adoption_delta = -sign * ((raw % 2) + 1) * params.mutation_change_scale

    old = {
        'exposure_base': params.exposure_base,
        'adoption_rate': params.adoption_rate,
    }

    params.exposure_base = max(0.01, min(0.95, params.exposure_base + exposure_delta))
    params.adoption_rate = max(0.01, min(0.70, params.adoption_rate + adoption_delta))

    return [{
        'event_type': 'mutation',
        'tick': tick,
        'mutation_id': f'mut-{tick:02d}',
        'mutation_applied': True,
        'mutation_rule': 'campaign_parameter_shift',
        'changes': {
            'exposure_base': {
                'old': round(old['exposure_base'], 6),
                'new': round(params.exposure_base, 6),
                'delta': round(params.exposure_base - old['exposure_base'], 6),
            },
            'adoption_rate': {
                'old': round(old['adoption_rate'], 6),
                'new': round(params.adoption_rate, 6),
                'delta': round(params.adoption_rate - old['adoption_rate'], 6),
            },
        },
        'timestamp_utc': _now_iso(),
    }]


def _build_contract_snapshot(trace: Dict[str, Any], schema_uri: str) -> Dict[str, Any]:
    return {
        'schema_uri': schema_uri,
        'schema_version': '1.0.0',
        'required_fields': {
            'trace_id': 'string',
            'seed': 'integer',
            'tick_count': 'integer',
            'nodes': 'list',
            'edges': 'list',
            'steps': 'list',
            'events': {
                'types': ['mutation', 'exposure', 'adoption', 'resistance', 'reshare'],
            },
        },
        'notes': {
            'deterministic': True,
            'seeded': True,
            'no_llm_calls': True,
            'simulation_length_ticks': trace['tick_count'],
        },
    }


def _run_check(trace: Dict[str, Any]) -> Dict[str, Any]:
    checks = {
        'valid': True,
        'errors': [],
        'warnings': [],
    }

    if 'steps' not in trace:
        checks['valid'] = False
        checks['errors'].append('missing steps')
        return checks

    expected_ticks = int(trace.get('tick_count', 0))
    if len(trace['steps']) != expected_ticks:
        checks['valid'] = False
        checks['errors'].append(f'steps length {len(trace['steps'])} mismatch tick_count {expected_ticks}')

    first_tick = trace['steps'][0].get('tick') if trace['steps'] else None
    if first_tick != 0:
        checks['valid'] = False
        checks['errors'].append(f'first tick expected 0, got {first_tick}')

    node_ids = {node['persona_id'] for node in trace.get('graph', {}).get('nodes', [])}
    if not node_ids:
        checks['valid'] = False
        checks['errors'].append('no nodes in graph')

    all_events = 0
    required_event_types = {'mutation', 'exposure', 'adoption', 'resistance', 'reshare'}

    for step in trace['steps']:
        if 'events' not in step:
            continue
        if not isinstance(step['events'], list):
            checks['valid'] = False
            checks['errors'].append(f'step {step.get('tick')} events not list')
            continue
        tick_event_types = {ev.get('event_type') for ev in step['events'] if isinstance(ev, dict)}
        missing = required_event_types - tick_event_types
        if missing and step.get('tick') > 0:
            checks['warnings'].append(f'step {step.get('tick')} missing event_types={sorted(missing)}')

        for ev in step['events']:
            all_events += 1
            event_type = ev.get('event_type')
            if event_type == 'mutation':
                continue

            source = ev.get('source')
            target = ev.get('target')

            # Allow deterministic placeholders to preserve one-row coverage for each event type per tick.
            if source == 'campaign_engine' and target is None:
                continue

            if source not in node_ids and source != 'campaign_seed':
                checks['valid'] = False
                checks['errors'].append(f"invalid source {source} in tick {step.get('tick')}")
            if target not in node_ids and target is not None:
                checks['valid'] = False
                checks['errors'].append(f"invalid target {target} in tick {step.get('tick')}")

    checks['event_count'] = all_events
    return checks


def build_trace(args: argparse.Namespace) -> Dict[str, Any]:
    nodes_by_comm = _build_communities(
        node_count=args.nodes,
        community_names=COMMUNITIES,
        seed=args.seed,
    )
    node_records, node_order, community_map, _ = _build_node_records(nodes_by_comm, COMMUNITIES)
    edges, adjacency, _ = _build_sbm_edges(nodes_by_comm, COMMUNITIES, args.seed)

    params = CampaignParams(
        exposure_base=_safe_float(args.exposure_base, 0.22),
        adoption_rate=_safe_float(args.adoption_rate, 0.18),
        adoption_boost_for_adopters=_safe_float(args.adoption_boost_for_adopters, 1.4),
        resistance_rate_exposed=_safe_float(args.resistance_rate_exposed, 0.03),
        resistance_rate_adopted=_safe_float(args.resistance_rate_adopted, 0.01),
        reshare_rate=_safe_float(args.reshare_rate, 0.16),
        cross_community_penalty=_safe_float(args.cross_community_penalty, 0.55),
        mutation_every=max(1, _safe_int(args.mutation_every, 2)),
        mutation_change_scale=_safe_float(args.mutation_change_scale, 0.04),
    )

    state = CampaignState(
        seed=args.seed,
        tick_count=args.ticks,
        node_count=args.nodes,
        community_names=list(COMMUNITIES),
        community_sizes=[len(nodes_by_comm[c]) for c in COMMUNITIES],
    )

    steps, final_states, summary = _simulate(
        node_order=node_order,
        adjacency=adjacency,
        community_map=community_map,
        params=params,
        seed=args.seed,
        ticks=args.ticks,
        initial_exposed=max(1, args.initial_exposed),
    )

    edge_densities = [
        {
            'from_community': edge['source_community'],
            'to_community': edge['target_community'],
            'weight': edge['weight'],
        }
        for edge in edges
    ]

    mean_weight = round(mean([e['weight'] for e in edges]), 6) if edges else 0.0

    schema_path = Path(args.schema)
    trace = {
        'trace_id': _build_trace_id(state),
        'trace_schema': _build_schema_reference(),
        'generated_at_utc': _now_iso(),
        'seed': args.seed,
        'tick_count': args.ticks,
        'campaign': {
            'name': args.campaign_name,
            'description': args.campaign_description,
        },
        'params': {
            'initial_exposed_count': max(1, args.initial_exposed),
            'exposure_base': params.exposure_base,
            'adoption_rate': params.adoption_rate,
            'adoption_boost_for_adopters': params.adoption_boost_for_adopters,
            'resistance_rate_exposed': params.resistance_rate_exposed,
            'resistance_rate_adopted': params.resistance_rate_adopted,
            'reshare_rate': params.reshare_rate,
            'cross_community_penalty': params.cross_community_penalty,
            'mutation_every': params.mutation_every,
            'mutation_change_scale': params.mutation_change_scale,
        },
        'graph': {
            'directed': True,
            'communities': list(COMMUNITIES),
            'nodes': node_records,
            'edges': edges,
            'edge_count': len(edges),
            'node_count': len(node_order),
            'mean_edge_weight': mean_weight,
            'community_size': {
                c: len(nodes_by_comm[c]) for c in COMMUNITIES
            },
            'edge_samples': edge_densities[:min(5, len(edge_densities))],
        },
        'steps': steps,
        'final_states': final_states[0],
        'summary': {
            'contract': _build_contract_snapshot({'tick_count': args.ticks, 'steps': steps}, 'file://' + str(schema_path.resolve())),
            'node_count': len(node_order),
            'edge_count': len(edges),
            'adopted': summary['adopted_count'],
            'resistant': summary['resistant_count'],
            'exposed': summary['exposed_count'],
            'unexposed': summary['unexposed_count'],
        },
    }

    trace['checks'] = _run_check(trace)
    return trace


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate a deterministic simulation_trace.json for campaign spread.')
    parser.add_argument('--ticks', type=int, default=10, help='Number of ticks to simulate.')
    parser.add_argument('--nodes', type=int, default=120, help='Total personas in synthetic SBM graph.')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for deterministic graph and event generation.')
    parser.add_argument('--initial-exposed', type=int, default=6, help='Number of initial seed nodes exposed at tick 0.')
    parser.add_argument('--campaign-name', default='autonomous-market-campaign', help='Campaign name.')
    parser.add_argument('--campaign-description', default='Deterministic offline 10-tick propagation with state machine transitions.', help='Campaign description.')
    parser.add_argument('--exposure-base', type=float, default=0.22)
    parser.add_argument('--adoption-rate', type=float, default=0.18)
    parser.add_argument('--adoption-boost-for-adopters', type=float, default=1.4)
    parser.add_argument('--resistance-rate-exposed', type=float, default=0.03)
    parser.add_argument('--resistance-rate-adopted', type=float, default=0.01)
    parser.add_argument('--reshare-rate', type=float, default=0.16)
    parser.add_argument('--cross-community-penalty', type=float, default=0.55)
    parser.add_argument('--mutation-every', type=int, default=2)
    parser.add_argument('--mutation-change-scale', type=float, default=0.04)
    parser.add_argument('--output', default=str(DEFAULT_OUTPUT_DIR / 'simulation_trace.json'))
    parser.add_argument('--schema', default=str(DEFAULT_SCHEMA_PATH))
    parser.add_argument('--check-only', action='store_true', help='Validate existing output and print checks only.')
    parser.add_argument('--strict', action='store_true', help='Exit non-zero if checks.valid is false')
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    schema_path = Path(args.schema)
    schema_path.parent.mkdir(parents=True, exist_ok=True)

    if args.check_only:
        if not output_path.exists():
            raise FileNotFoundError(f'Missing trace file: {output_path}')
        payload = json.loads(output_path.read_text(encoding='utf-8'))
        checks = _run_check(payload)
        if args.strict and not checks.get('valid', False):
            raise RuntimeError(f'Validation failed: {checks}')
        print(json.dumps({'trace': str(output_path), 'checks': checks}, indent=2, ensure_ascii=False))
        return

    trace = build_trace(args)
    output_path.write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding='utf-8')

    # Write schema too so the path exists as requested.
    schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$id': 'simulation-trace.schema.json',
        'title': 'Simulation Trace',
        'description': 'State transition trace for offline campaign simulation.',
        'type': 'object',
        'required': ['trace_id', 'seed', 'tick_count', 'steps', 'graph', 'final_states'],
        'properties': {
            'trace_id': {'type': 'string'},
            'seed': {'type': 'integer'},
            'tick_count': {'type': 'integer', 'minimum': 1},
            'campaign': {
                'type': 'object',
                'required': ['name'],
                'properties': {
                    'name': {'type': 'string'},
                    'description': {'type': 'string'},
                },
            },
            'params': {
                'type': 'object',
                'properties': {
                    'initial_exposed_count': {'type': 'integer'},
                    'exposure_base': {'type': 'number'},
                    'adoption_rate': {'type': 'number'},
                    'adoption_boost_for_adopters': {'type': 'number'},
                    'resistance_rate_exposed': {'type': 'number'},
                    'resistance_rate_adopted': {'type': 'number'},
                    'reshare_rate': {'type': 'number'},
                    'cross_community_penalty': {'type': 'number'},
                    'mutation_every': {'type': 'integer'},
                    'mutation_change_scale': {'type': 'number'},
                },
            },
            'graph': {
                'type': 'object',
                'required': ['directed', 'nodes', 'edges'],
                'properties': {
                    'directed': {'type': 'boolean'},
                    'communities': {'type': 'array', 'items': {'type': 'string'}},
                    'nodes': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'required': ['persona_id', 'community'],
                            'properties': {
                                'persona_id': {'type': 'string'},
                                'community': {'type': 'string'},
                                'seed': {'type': 'integer'},
                            },
                        },
                    },
                    'edges': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'required': ['source', 'target', 'weight'],
                            'properties': {
                                'source': {'type': 'string'},
                                'target': {'type': 'string'},
                                'weight': {'type': 'number'},
                                'source_community': {'type': 'string'},
                                'target_community': {'type': 'string'},
                            },
                        },
                    },
                },
            },
            'steps': {
                'type': 'array',
                'minItems': 1,
                'items': {
                    'type': 'object',
                    'required': ['tick', 'events', 'state_counts', 'params_snapshot', 'node_states'],
                    'properties': {
                        'tick': {'type': 'integer', 'minimum': 0},
                        'events': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'required': ['event_type', 'tick'],
                                'properties': {
                                    'event_type': {
                                        'type': 'string',
                                        'enum': ['mutation', 'exposure', 'adoption', 'resistance', 'reshare'],
                                    },
                                    'tick': {'type': 'integer', 'minimum': 0},
                                },
                            },
                        },
                        'state_counts': {
                            'type': 'object',
                            'properties': {
                                'unexposed': {'type': 'integer', 'minimum': 0},
                                'exposed': {'type': 'integer', 'minimum': 0},
                                'adopted': {'type': 'integer', 'minimum': 0},
                                'resistant': {'type': 'integer', 'minimum': 0},
                            },
                        },
                        'params_snapshot': {'type': 'object'},
                        'node_states': {'type': 'object'},
                    },
                },
            },
            'final_states': {'type': 'object'},
            'summary': {'type': 'object'},
            'checks': {'type': 'object'},
        },
    }
    schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding='utf-8')

    print(json.dumps({'status': 'ok', 'output': str(output_path), 'schema': str(schema_path), 'checks': trace['checks']}, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
