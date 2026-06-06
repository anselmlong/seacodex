#!/usr/bin/env python3
"""
Layer 3: Persona tuning + graph/network extraction with MiroFish.

This script consumes Layer 2 persona seed artifacts and builds the MiroFish
stack to tune personas and extract graph/entity artifacts.

Outputs:
- layer3_tuned_personas.jsonl
- layer3_entities.jsonl
- layer3_edges.jsonl
- layer3_graph_snapshot.json
- layer3_tuned_report.json
- layer3_manifest.json
- README.md (output-folder usage notes)

Default outputs are written to:
    /Users/kyiwaithant/Documents/Shopee/market_analysis_layer3_mirofish
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_LAYER2_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer1_layer2/layer2')
DEFAULT_LAYER2_FILE = DEFAULT_LAYER2_DIR / 'personas_initial_n1000_seed42.jsonl'
DEFAULT_OUTPUT_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer3_mirofish')
DEFAULT_BASE_URL = 'http://localhost:5001'
DEFAULT_SIMULATION_REQUIREMENT = (
    "Identify short-term trends and peer influence patterns for proactive market analysis. "
    "Use synthetic personas as seed agents to infer likely product interests and community-level \n"
    "interaction dynamics relevant to recommendations and churn prediction workflows."
)


class PipelineError(RuntimeError):
    pass


@dataclass
class Layer3State:
    run_id: str
    base_url: str
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    graph_id: Optional[str] = None
    simulation_id: Optional[str] = None
    prepare_task_id: Optional[str] = None
    run_state: Optional[dict] = None
    mode: str = "pipeline"
    started_utc: str = ""
    phases: Dict[str, Any] | None = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Run Layer 3 (MiroFish-backed) persona tuning + graph extraction')
    parser.add_argument('--run', choices=['layer3', 'full'], default='full',
                        help='layer3=prepare+extract only, full=prepare+run simulation')
    parser.add_argument('--check', action='store_true', help='Only validate existing Layer 3 outputs')
    parser.add_argument('--input-layer2', default=str(DEFAULT_LAYER2_FILE),
                        help='Layer2 JSONL input path')
    parser.add_argument('--output-dir', default=str(DEFAULT_OUTPUT_DIR),
                        help='Layer3 output directory')
    parser.add_argument('--base-url', default=DEFAULT_BASE_URL,
                        help='MiroFish backend base URL, e.g. http://localhost:5001')
    parser.add_argument('--project-name', default='Market Analysis Layer3 Project',
                        help='MiroFish project name')
    parser.add_argument('--simulation-requirement', default=DEFAULT_SIMULATION_REQUIREMENT,
                        help='Simulation requirement text for ontology generation')
    parser.add_argument('--additional-context', default='',
                        help='Additional context passed to ontology generation')
    parser.add_argument('--doc-file', default='',
                        help='Optional local doc file to feed ontology; defaults to generated summary from Layer2 personas')
    parser.add_argument('--use-llm-for-profiles', type=lambda x: str(x).lower() != 'false', default=True,
                        help='Whether to generate profiles with LLM (default: true)')
    parser.add_argument('--parallel-profile-count', type=int, default=5,
                        help='Parallel profile generation count')
    parser.add_argument('--force-regenerate', action='store_true',
                        help='Force simulation prepare regeneration')
    parser.add_argument('--run-sim', action='store_true',
                        help='Start simulation after prepare step')
    parser.add_argument('--max-rounds', type=int, default=3,
                        help='Max rounds for simulation if --run-sim')
    parser.add_argument('--poll-interval', type=int, default=3,
                        help='Polling interval in seconds for async tasks')
    parser.add_argument('--poll-timeout-sec', type=int, default=1200,
                        help='Max wait time for async preparation/simulation run')
    parser.add_argument('--entity-types', default='',
                        help='Comma-separated entity types for filtering')
    parser.add_argument('--max-layer2-sample', type=int, default=240,
                        help='Max Layer2 personas used to build ontology text seed')
    parser.add_argument('--top-entities', type=int, default=1200,
                        help='Max entities to write in layer3_entities.jsonl')
    parser.add_argument('--top-edges', type=int, default=4000,
                        help='Max edges to write in layer3_edges.jsonl')
    parser.add_argument('--strict', action='store_true',
                        help='Strict validation: fail if expected files are missing')
    parser.add_argument('--mock', action='store_true',
                        help='Generate deterministic mock Layer3 outputs without calling MiroFish')
    parser.add_argument('--no-allow-mock', action='store_true',
                        help='Do not fallback to mock if live API fails')
    return parser.parse_args()


def _read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f'Missing input file: {path}')
    rows: List[Dict[str, Any]] = []
    with path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f'Invalid JSONL at line {i}: {line[:80]!r}') from e
    if not rows:
        raise ValueError(f'No records found in {path}')
    return rows


def _ensure_parent_file_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _split_csv(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str):
        chunks = [x.strip() for x in value.replace(';', ',').split(',')]
        return [x for x in chunks if x]
    return [str(value)]


def _normalize_text(value: Any) -> str:
    return '' if value is None else str(value).strip()


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        if isinstance(value, (int,)):
            return int(value)
        if isinstance(value, float):
            if value.is_integer():
                return int(value)
            return int(value)
        s = str(value).strip()
        if not s:
            return None
        return int(float(s))
    except Exception:
        return None


def _build_input_doc(path: Path, layer2_rows: Sequence[Dict[str, Any]], max_records: int) -> None:
    """Create a compact artifact that explains personas to MiroFish."""
    sample = layer2_rows[:max_records]
    payload = {
        'records_count': len(layer2_rows),
        'sample_count': len(sample),
        'record_schema': sorted({k for r in sample for k in r.keys()}),
        'records': [
            {
                'persona_id': r.get('persona_id'),
                'demographics': {
                    'sex': r.get('demographics', {}).get('sex') if isinstance(r.get('demographics'), dict) else r.get('sex'),
                    'age': r.get('demographics', {}).get('age') if isinstance(r.get('demographics'), dict) else r.get('age'),
                    'marital_status': (r.get('demographics', {}).get('marital_status') if isinstance(r.get('demographics'), dict) else r.get('marital_status')),
                    'education_level': (r.get('demographics', {}).get('education_level') if isinstance(r.get('demographics'), dict) else r.get('education_level')),
                },
                'location': {
                    'country': (r.get('location', {}).get('country') if isinstance(r.get('location'), dict) else r.get('country')),
                    'planning_area': (r.get('location', {}).get('planning_area') if isinstance(r.get('location'), dict) else r.get('planning_area')),
                    'industry': (r.get('profession', {}).get('industry') if isinstance(r.get('profession'), dict) else r.get('industry')),
                    'occupation': (r.get('profession', {}).get('occupation') if isinstance(r.get('profession'), dict) else r.get('occupation')),
                },
                'profiles': {
                    'description': _normalize_text(r.get('profiles', {}).get('persona_description') if isinstance(r.get('profiles'), dict) else r.get('persona')),
                    'professional_persona': _normalize_text(r.get('profiles', {}).get('professional_persona')),
                    'sports_persona': _normalize_text(r.get('profiles', {}).get('sports_persona')),
                    'arts_persona': _normalize_text(r.get('profiles', {}).get('arts_persona')),
                    'travel_persona': _normalize_text(r.get('profiles', {}).get('travel_persona')),
                    'culinary_persona': _normalize_text(r.get('profiles', {}).get('culinary_persona')),
                },
                'interests_seed': _split_csv(r.get('interests_seed', []))[:16],
                'skills_seed': _split_csv(r.get('skills_seed', []))[:16],
                'swarm_inputs': r.get('swarm_inputs', {}),
            }
            for r in sample
        ],
    }
    with path.open('w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def _to_jsonl(path: Path, records: Sequence[Dict[str, Any]]) -> None:
    _ensure_parent_file_dir(path)
    with path.open('w', encoding='utf-8') as f:
        for row in records:
            f.write(json.dumps(row, ensure_ascii=False, default=_jsonable) + '\n')


def _normalize_entities(raw: Any) -> List[Dict[str, Any]]:
    if isinstance(raw, dict):
        if 'entities' in raw and isinstance(raw['entities'], list):
            return [dict(e) for e in raw['entities'] if isinstance(e, dict)]
        if 'nodes' in raw and isinstance(raw['nodes'], list):
            return [dict(n) for n in raw['nodes'] if isinstance(n, dict)]
        if 'items' in raw and isinstance(raw['items'], list):
            return [dict(e) for e in raw['items'] if isinstance(e, dict)]
    if isinstance(raw, list):
        return [dict(e) for e in raw if isinstance(e, dict)]
    return []


def _normalize_edges(raw: Any) -> List[Dict[str, Any]]:
    if isinstance(raw, dict):
        if 'edges' in raw and isinstance(raw['edges'], list):
            return [dict(e) for e in raw['edges'] if isinstance(e, dict)]
        if 'relationships' in raw and isinstance(raw['relationships'], list):
            return [dict(e) for e in raw['relationships'] if isinstance(e, dict)]
    if isinstance(raw, list):
        return [dict(e) for e in raw if isinstance(e, dict)]
    return []


def _merge_profiles(base: Dict[str, Any], profile: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = dict(base)
    profile = profile or {}
    tuning = {
        'tuning_state': 'live' if profile else 'seed_only',
        'tuning_source': 'mirofish' if profile else 'seed_only',
        'raw_profile_keys': sorted(profile.keys()) if isinstance(profile, dict) else [],
    }

    if profile:
        for k in ('persona_description', 'name', 'description', 'summary'):
            if isinstance(profile.get(k), str) and profile.get(k).strip():
                tuning.setdefault('profile_text', profile.get(k))
                break

    interests = []
    for key in ('interests', 'interests_seed', 'interest', 'topic_interests'):
        for token in _split_csv(profile.get(key)):
            if token:
                interests.append(token)

    merged['tuning'] = tuning
    merged['interests_tuned'] = _dedupe_preserve_order(_split_csv(base.get('interests_seed', [])) + interests)
    merged['skills_tuned'] = _dedupe_preserve_order(_split_csv(base.get('skills_seed', [])) + _split_csv(profile.get('skills')))

    if 'lifecycle' in merged:
        merged['lifecycle'] = 'tuned'

    merged['mirofish_profile'] = {
        'available': bool(profile),
        'agent_id': profile.get('agent_id') if isinstance(profile, dict) else None,
        'source_uuid': profile.get('source_uuid') if isinstance(profile, dict) else None,
    }
    return merged


def _dedupe_preserve_order(items: Sequence[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        s = str(x).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _build_tuned_personas(layer2_rows: Sequence[Dict[str, Any]], profiles: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    profile_map = {}
    for p in profiles:
        for key in ('persona_id', 'agent_id', 'source_uuid', 'id', 'uuid'):
            if isinstance(p, dict) and p.get(key) is not None:
                profile_map[str(p.get(key))] = p

    tuned = []
    for idx, row in enumerate(layer2_rows):
        candidate: Optional[Dict[str, Any]] = None
        for key in ('persona_id', 'source_uuid'):
            if row.get(key) and str(row[key]) in profile_map:
                candidate = profile_map[str(row[key])]
                break
        if candidate is None:
            candidate = profiles[idx] if idx < len(profiles) else None

        base = {
            'persona_id': row.get('persona_id'),
            'source_uuid': row.get('source_uuid'),
            'generated_at_utc': _now_iso(),
            'layer': 3,
            'input': {
                'demographics': row.get('demographics', {}),
                'location': row.get('location', {}),
                'profession': row.get('profession', {}),
                'profiles': row.get('profiles', {}),
            },
            'interests_seed': _split_csv(row.get('interests_seed', [])),
            'skills_seed': _split_csv(row.get('skills_seed', [])),
            'metadata': {
                'source_dataset': 'layer2/personas_initial_n1000_seed42',
                'source_file': str(DEFAULT_LAYER2_FILE),
                'source_index': idx,
            },
        }
        tuned.append(_merge_profiles(base, candidate))

    return tuned


def _build_mock_graph(layer2_rows: Sequence[Dict[str, Any]], top_entities: int, top_edges: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    entities: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    for r in layer2_rows[:top_entities]:
        pa = r.get('persona', r.get('persona_id'))
        entities.append({
            'entity_id': r.get('persona_id'),
            'name': pa or r.get('source_uuid') or r.get('uuid'),
            'type': 'SyntheticPersona',
            'industry': r.get('industry') or (r.get('profession', {}) or {}).get('industry'),
            'country': r.get('country') or (r.get('location', {}) or {}).get('country'),
            'planning_area': r.get('planning_area') or (r.get('location', {}) or {}).get('planning_area'),
        })

    for i in range(min(len(entities), top_edges)):
        src = entities[i]['entity_id']
        dst = entities[(i + 1) % len(entities)]['entity_id'] if entities else None
        if src and dst:
            edges.append({
                'edge_id': f'e{i:06d}',
                'source': src,
                'target': dst,
                'relation': 'interest_overlap' if i % 2 == 0 else 'peer_influence',
                'weight': round(0.35 + (i % 10) * 0.05, 3),
            })

    snapshot = {
        'source': 'mock',
        'nodes_count': len(entities),
        'edges_count': len(edges),
        'generated_by': 'prepare_layer3_mirofish.py (mock)',
        'created_utc': _now_iso(),
        'notes': 'Fallback graph generated from Layer2 personas because live MiroFish was unavailable or mocked.',
    }

    return entities[:top_entities], edges[:top_edges], snapshot


class SimpleHttpClient:
    def __init__(self, base_url: str, timeout_sec: int = 30) -> None:
        self.base_url = base_url.rstrip('/')
        self.timeout_sec = timeout_sec

    def _url(self, path: str) -> str:
        if path.startswith('http://') or path.startswith('https://'):
            return path
        return f'{self.base_url.rstrip('/')}{path}'

    def _read_response(self, resp) -> Tuple[int, Dict[str, Any], str]:
        status = getattr(resp, 'status', 200)
        data = resp.read().decode('utf-8', errors='ignore') if resp else ''
        try:
            payload = json.loads(data) if data else {}
        except json.JSONDecodeError:
            payload = {'raw': data}
        return status, payload, data

    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None,
                 files: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        if headers is None:
            headers = {}
        data = None
        req_headers = dict(headers)
        if files:
            boundary = uuid.uuid4().hex
            parts: List[bytes] = []
            req_headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
            for k, v in (payload or {}).items():
                parts.append(f'--{boundary}\r\n'.encode())
                parts.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
                parts.append(f'{v}'.encode())
                parts.append(b'\r\n')
            for f in files:
                field_name = f['field_name']
                file_path = f['path']
                filename = Path(file_path).name
                ftype = f.get('content_type', 'application/octet-stream')
                with open(file_path, 'rb') as fp:
                    content = fp.read()
                parts.append(f'--{boundary}\r\n'.encode())
                parts.append(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode())
                parts.append(f'Content-Type: {ftype}\r\n\r\n'.encode())
                parts.append(content)
                parts.append(b'\r\n')
            parts.append(f'--{boundary}--\r\n'.encode())
            data = b''.join(parts)
        elif payload is not None:
            req_headers.setdefault('Content-Type', 'application/json')
            data = json.dumps(payload, ensure_ascii=False).encode('utf-8')

        req = Request(self._url(path), data=data, method=method)
        req_headers.setdefault('User-Agent', 'prepare-layer3-mirofish/1.0')
        req_headers.setdefault('Accept', 'application/json')
        for key, value in req_headers.items():
            req.add_header(key, value)

        try:
            with urlopen(req, timeout=self.timeout_sec) as resp:
                status, parsed, _ = self._read_response(resp)
                if status >= 400:
                    raise PipelineError(f'HTTP {status} for {method} {path}: {parsed}')
                return parsed
        except HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')
            try:
                payload_obj = json.loads(body)
            except Exception:
                payload_obj = {'raw': body}
            raise PipelineError(f'HTTP {e.code} for {method} {path}: {payload_obj}') from None
        except URLError as e:
            raise PipelineError(f'Unable to connect to {self.base_url}: {e}') from None

    def get(self, path: str) -> Dict[str, Any]:
        return self._request('GET', path)

    def post_json(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('POST', path, payload=payload)

    def post_form(self, path: str, payload: Dict[str, Any], files: List[Dict[str, str]]) -> Dict[str, Any]:
        return self._request('POST', path, payload=payload, files=files)


def _check_health(client: SimpleHttpClient) -> bool:
    try:
        r = client.get('/health')
        return bool(r)
    except Exception:
        return False


def api_generate_ontology(client: SimpleHttpClient, base_file: Path, args: argparse.Namespace) -> Dict[str, Any]:
    payload = {
        'simulation_requirement': args.simulation_requirement,
        'project_name': args.project_name,
        'additional_context': args.additional_context,
    }
    files = [
        {'field_name': 'files', 'path': str(base_file), 'content_type': 'application/json'},
    ]
    return client.post_form('/api/graph/ontology/generate', payload, files)


def api_build_graph(client: SimpleHttpClient, project_id: str, args: argparse.Namespace) -> Dict[str, Any]:
    payload = {
        'project_id': project_id,
        'graph_name': f"{args.project_name} - graph",
        'chunk_size': 500,
        'chunk_overlap': 50,
    }
    return client.post_json('/api/graph/build', payload)


def api_get_task(client: SimpleHttpClient, task_id: str) -> Dict[str, Any]:
    return client.get(f'/api/graph/task/{task_id}')


def api_create_simulation(client: SimpleHttpClient, project_id: str, graph_id: str) -> Dict[str, Any]:
    return client.post_json('/api/simulation/create', {
        'project_id': project_id,
        'graph_id': graph_id,
        'enable_twitter': True,
        'enable_reddit': True,
    })


def api_prepare_simulation(client: SimpleHttpClient, simulation_id: str, args: argparse.Namespace) -> Dict[str, Any]:
    payload = {
        'simulation_id': simulation_id,
        'entity_types': [x.strip() for x in args.entity_types.split(',') if x.strip()] or None,
        'use_llm_for_profiles': bool(args.use_llm_for_profiles),
        'parallel_profile_count': int(args.parallel_profile_count),
        'force_regenerate': bool(args.force_regenerate),
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return client.post_json('/api/simulation/prepare', payload)


def api_prepare_status(client: SimpleHttpClient, simulation_id: str, task_id: Optional[str]) -> Dict[str, Any]:
    payload = {'simulation_id': simulation_id}
    if task_id:
        payload['task_id'] = task_id
    return client.post_json('/api/simulation/prepare/status', payload)


def api_get_graph_data(client: SimpleHttpClient, graph_id: str) -> Dict[str, Any]:
    return client.get(f'/api/graph/data/{graph_id}')


def api_get_entities(client: SimpleHttpClient, graph_id: str) -> Dict[str, Any]:
    return client.get(f'/api/simulation/entities/{graph_id}')


def api_get_profiles(client: SimpleHttpClient, simulation_id: str, platform: str = 'reddit') -> Dict[str, Any]:
    return client.get(f'/api/simulation/{simulation_id}/profiles?platform={urlencode({'platform': platform})}' )


def api_get_simulation(client: SimpleHttpClient, simulation_id: str) -> Dict[str, Any]:
    return client.get(f'/api/simulation/{simulation_id}')


def api_run_status(client: SimpleHttpClient, simulation_id: str) -> Dict[str, Any]:
    return client.get(f'/api/simulation/{simulation_id}/run-status')


def api_start_sim(client: SimpleHttpClient, simulation_id: str, max_rounds: int) -> Dict[str, Any]:
    payload = {
        'simulation_id': simulation_id,
        'platform': 'parallel',
        'max_rounds': max_rounds,
        'enable_graph_memory_update': False,
        'force': False,
    }
    return client.post_json('/api/simulation/start', payload)


def wait_task_loop(total_seconds: int, poll_interval: int, fn) -> Dict[str, Any]:
    deadline = time.time() + total_seconds
    last = None
    while True:
        res = fn()
        if res is None:
            res = {}
        data = res.get('data', res)
        status = str(data.get('status', '')).lower()
        if status in {'ready', 'completed', 'failed', 'stopped', 'error'}:
            return data
        if time.time() >= deadline:
            raise PipelineError(f'Async task timeout after {total_seconds}s, last status={status}, payload={data}')
        last = data
        time.sleep(poll_interval)


def wait_prepare(client: SimpleHttpClient, simulation_id: str, task_id: Optional[str], timeout: int, poll_interval: int) -> Dict[str, Any]:
    def _poll() -> Dict[str, Any]:
        return api_prepare_status(client, simulation_id, task_id)

    return wait_task_loop(timeout, poll_interval, _poll)


def wait_graph_build(client: SimpleHttpClient, task_id: str, timeout: int, poll_interval: int) -> Dict[str, Any]:
    def _poll() -> Dict[str, Any]:
        return api_get_task(client, task_id)

    return wait_task_loop(timeout, poll_interval, _poll)


def wait_simulation_run(client: SimpleHttpClient, simulation_id: str, timeout: int, poll_interval: int, max_rounds: Optional[int]) -> Dict[str, Any]:
    deadline = time.time() + timeout

    while True:
        run_payload = api_run_status(client, simulation_id)
        data = run_payload.get('data', run_payload)
        status = str(data.get('runner_status', '')).lower()
        current_round = int(data.get('current_round', 0) or 0)
        total_rounds = int(data.get('total_rounds', 0) or 0)

        if status in {'completed', 'stopped', 'idle', 'paused', 'error'}:
            return data
        if max_rounds and current_round >= max_rounds:
            return data
        if max_rounds and total_rounds and current_round >= total_rounds:
            return data
        if time.time() >= deadline:
            raise PipelineError(f'Simulation run timeout after {timeout}s; last status={status}, round={current_round}/{total_rounds}')
        time.sleep(poll_interval)


def _extract_data_field(payload: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(payload, dict):
        if 'data' in payload and isinstance(payload['data'], dict):
            return payload['data']
        return payload
    return {}


def _extract_report_records(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f'Missing report: {path}')
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def write_layer3_readme(layer3_dir: Path, out: Dict[str, Any]) -> None:
    readme = layer3_dir / 'README.md'
    readme.write_text(
        '# Layer 3: MiroFish Persona Tuning Outputs\n\n'
        'Generated files:\n'
        f"- layer3_tuned_personas.jsonl ({out['counts'].get('tuned_personas', 0)} rows)\n"
        f"- layer3_entities.jsonl ({out['counts'].get('entities', 0)} rows)\n"
        f"- layer3_edges.jsonl ({out['counts'].get('edges', 0)} rows)\n"
        '- layer3_graph_snapshot.json\n'
        '- layer3_tuned_report.json\n'
        '- layer3_manifest.json\n\n'
        'Quick check:\n'
        'python /Users/kyiwaithant/Documents/Shopee/prepare_layer3_mirofish.py --check --output-dir ' + str(layer3_dir) + '\n\n'
        'Run command used:\n'
        'python /Users/kyiwaithant/Documents/Shopee/prepare_layer3_mirofish.py --run full --output-dir ' + str(layer3_dir) + '\n'
        '--input-layer2 ...\n',
        encoding='utf-8',
    )


def run_mock_pipeline(input_rows: List[Dict[str, Any]], args: argparse.Namespace, state: Layer3State,
                    out_dir: Path) -> Dict[str, Any]:
    entities, edges, snapshot = _build_mock_graph(input_rows, args.top_entities, args.top_edges)
    tuned = _build_tuned_personas(input_rows, [])

    tuned_path = out_dir / 'layer3_tuned_personas.jsonl'
    entity_path = out_dir / 'layer3_entities.jsonl'
    edge_path = out_dir / 'layer3_edges.jsonl'
    snapshot_path = out_dir / 'layer3_graph_snapshot.json'
    report_path = out_dir / 'layer3_tuned_report.json'
    manifest_path = out_dir / 'layer3_manifest.json'

    _to_jsonl(tuned_path, tuned)
    _to_jsonl(entity_path, entities[:args.top_entities])
    _to_jsonl(edge_path, edges[:args.top_edges])
    snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding='utf-8')

    report = {
        'layer': 'layer3',
        'generated_at_utc': _now_iso(),
        'mode': 'mock',
        'state': state.to_dict(),
        'inputs': {
            'layer2_file': str(DEFAULT_LAYER2_FILE),
            'input_count': len(input_rows),
        },
        'artifacts': {
            'layer3_tuned_personas': str(tuned_path),
            'layer3_entities': str(entity_path),
            'layer3_edges': str(edge_path),
            'graph_snapshot': str(snapshot_path),
        },
        'counts': {
            'tuned_personas': len(tuned),
            'entities': len(entities),
            'edges': len(edges),
        },
        'hashes': {
            'layer3_tuned_personas': _sha256_file(tuned_path),
            'layer3_entities': _sha256_file(entity_path),
            'layer3_edges': _sha256_file(edge_path),
            'graph_snapshot': _sha256_file(snapshot_path),
        },
    }
    with report_path.open('w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=_jsonable)

    manifest = {
        'generated_at_utc': _now_iso(),
        'project': 'Autonomous Proactive Market Analysis',
        'layer': 3,
        'mode': 'mock',
        'outputs': {
            'tuned_personas': str(tuned_path),
            'entities': str(entity_path),
            'edges': str(edge_path),
            'graph_snapshot': str(snapshot_path),
            'report': str(report_path),
        },
        'checks': build_layer3_checks(out_dir),
    }
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    write_layer3_readme(out_dir, report)
    return {
        'mode': 'mock',
        'reports': {
            'report': str(report_path),
            'manifest': str(manifest_path),
        },
        'counts': {
            'tuned_personas': len(tuned),
            'entities': len(entities),
            'edges': len(edges),
        },
        'hashes': report['hashes'],
    }


def run_live_pipeline(input_rows: List[Dict[str, Any]], args: argparse.Namespace, out_dir: Path) -> Dict[str, Any]:
    client = SimpleHttpClient(args.base_url, timeout_sec=max(5, args.poll_interval))
    if not _check_health(client):
        raise PipelineError(f'Backend not healthy at {args.base_url}')

    state = Layer3State(
        run_id=str(uuid.uuid4()),
        base_url=args.base_url,
        mode='live',
        started_utc=_now_iso(),
        phases={},
    )

    seed_file = out_dir / 'layer3_seed_input.json'
    if args.doc_file:
        doc_file = Path(args.doc_file)
    else:
        _build_input_doc(seed_file, layer2_rows=input_rows, max_records=args.max_layer2_sample)
        doc_file = seed_file

    phase_log: List[Dict[str, Any]] = []

    try:
        # 1) Ontology
        ont = api_generate_ontology(client, doc_file, args)
        ont_data = _extract_data_field(ont)
        project_id = ont_data.get('project_id')
        if not project_id:
            raise PipelineError(f'ontology generation response did not return project_id: {ont}')
        state.project_id = project_id
        phase_log.append({'phase': 'ontology', 'status': 'ok', 'project_id': project_id})

        # 2) Graph build
        build_resp = api_build_graph(client, project_id, args)
        build_data = _extract_data_field(build_resp)
        build_task = build_data.get('task_id')
        if not build_task:
            raise PipelineError(f'graph build response missing task_id: {build_resp}')
        state.task_id = build_task
        phase_log.append({'phase': 'build_graph', 'status': 'started', 'task_id': build_task})

        build_done = wait_graph_build(client, build_task, timeout=args.poll_timeout_sec, poll_interval=args.poll_interval)
        if build_done.get('status', '').lower() in {'failed', 'error'}:
            raise PipelineError(f'Graph build failed: {build_done}')

        result = build_done.get('result', build_done)
        graph_id = result.get('graph_id') or build_data.get('graph_id') or state.project_id
        if not graph_id:
            # fallback: query project
            sim_state = api_get_simulation(client, state.simulation_id) if state.simulation_id else {'data': {}}
            graph_id = sim_state.get('data', {}).get('graph_id', None)

        state.graph_id = graph_id
        phase_log.append({'phase': 'build_graph', 'status': 'ok', 'graph_id': graph_id})

        # 3) Simulation create
        sim_resp = api_create_simulation(client, project_id, graph_id)
        sim_data = _extract_data_field(sim_resp)
        simulation_id = sim_data.get('simulation_id')
        if not simulation_id:
            raise PipelineError(f'simulation create failed: {sim_resp}')
        state.simulation_id = simulation_id
        phase_log.append({'phase': 'simulation_create', 'status': 'ok', 'simulation_id': simulation_id})

        # 4) Simulation prepare
        prepare_resp = api_prepare_simulation(client, simulation_id, args)
        prepare_data = _extract_data_field(prepare_resp)
        prepare_task_id = prepare_data.get('task_id')
        already_prepared = bool(prepare_data.get('already_prepared'))
        state.prepare_task_id = prepare_task_id
        phase_log.append({'phase': 'prepare_start', 'status': 'ok', 'already_prepared': already_prepared, 'task_id': prepare_task_id})

        prepare_done = wait_prepare(client, simulation_id, prepare_task_id if not already_prepared else None,
                                   timeout=args.poll_timeout_sec, poll_interval=args.poll_interval)

        if str(prepare_done.get('status', '')).lower() in {'failed', 'error'}:
            raise PipelineError(f'prepare failed: {prepare_done}')

        # 5) Snapshot and profiles
        simulation_state = api_get_simulation(client, simulation_id)
        simulation_data = _extract_data_field(simulation_state)

        graph_data_raw = api_get_graph_data(client, graph_id)
        graph_data = _extract_data_field(graph_data_raw)

        entities_raw = api_get_entities(client, graph_id)
        entities_data = _extract_data_field(entities_raw)

        profiles_raw = api_get_profiles(client, simulation_id, platform='reddit')
        profile_payload = _extract_data_field(profiles_raw)
        profiles = profile_payload.get('profiles', []) if isinstance(profile_payload, dict) else []
        tuned = _build_tuned_personas(input_rows, profiles)

        if args.run_sim and (args.run == 'full'):
            start_resp = api_start_sim(client, simulation_id, args.max_rounds)
            _ = _extract_data_field(start_resp)
            run_done = wait_simulation_run(
                client,
                simulation_id,
                timeout=args.poll_timeout_sec,
                poll_interval=args.poll_interval,
                max_rounds=args.max_rounds,
            )
            state.run_state = run_done
            phase_log.append({'phase': 'simulation_run', 'status': 'ok', 'run_status': run_done.get('runner_status')})

        entities = _normalize_entities(graph_data.get('data', graph_data))
        if not entities:
            entities = _normalize_entities(entities_data.get('data', entities_data))
            if not entities and 'data' in entities_data and isinstance(entities_data['data'], dict):
                entities = _normalize_entities(entities_data['data'])

        # graph snapshot
        edges = _normalize_edges(graph_data.get('data', graph_data))

        snapshot = {
            'mode': 'live',
            'generated_at_utc': _now_iso(),
            'project_id': state.project_id,
            'graph_id': state.graph_id,
            'simulation_id': state.simulation_id,
            'project': _extract_data_field(prepare_done if isinstance(prepare_done, dict) else {}),
            'graph_data': {
                'node_count': graph_data.get('node_count', len(entities)),
                'edge_count': graph_data.get('edge_count', len(edges)),
                'graph_data_file_present': bool(graph_data),
            },
            'prepare_result': prepare_done,
            'simulation_result': simulation_data,
            'phase_log': phase_log,
            'run_state': state.run_state,
        }

        entities = [e for e in entities if isinstance(e, dict)][:args.top_entities]
        edges = [e for e in edges if isinstance(e, dict)][:args.top_edges]

        tuned_path = out_dir / 'layer3_tuned_personas.jsonl'
        entity_path = out_dir / 'layer3_entities.jsonl'
        edge_path = out_dir / 'layer3_edges.jsonl'
        snapshot_path = out_dir / 'layer3_graph_snapshot.json'
        report_path = out_dir / 'layer3_tuned_report.json'
        manifest_path = out_dir / 'layer3_manifest.json'

        _to_jsonl(tuned_path, tuned)
        _to_jsonl(entity_path, entities)
        _to_jsonl(edge_path, edges)
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=_jsonable), encoding='utf-8')

        report = {
            'layer': 'layer3',
            'generated_at_utc': _now_iso(),
            'mode': 'live',
            'state': state.to_dict(),
            'inputs': {
                'layer2_file': str(args.input_layer2),
                'input_count': len(input_rows),
            },
            'artifacts': {
                'layer3_tuned_personas': str(tuned_path),
                'layer3_entities': str(entity_path),
                'layer3_edges': str(edge_path),
                'graph_snapshot': str(snapshot_path),
            },
            'counts': {
                'tuned_personas': len(tuned),
                'entities': len(entities),
                'edges': len(edges),
            },
            'hashes': {
                'layer3_tuned_personas': _sha256_file(tuned_path),
                'layer3_entities': _sha256_file(entity_path),
                'layer3_edges': _sha256_file(edge_path),
                'graph_snapshot': _sha256_file(snapshot_path),
            },
            'phase_log': phase_log,
            'sim_state': simulation_data,
        }
        with report_path.open('w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=_jsonable)

        manifest = {
            'generated_at_utc': _now_iso(),
            'project': 'Autonomous Proactive Market Analysis',
            'layer': 3,
            'mode': 'live',
            'outputs': {
                'tuned_personas': str(tuned_path),
                'entities': str(entity_path),
                'edges': str(edge_path),
                'graph_snapshot': str(snapshot_path),
                'report': str(report_path),
            },
            'checks': build_layer3_checks(out_dir),
        }
        with manifest_path.open('w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        write_layer3_readme(out_dir, report)

        return {
            'mode': 'live',
            'reports': {
                'report': str(report_path),
                'manifest': str(manifest_path),
            },
            'counts': {
                'tuned_personas': len(tuned),
                'entities': len(entities),
                'edges': len(edges),
            },
            'hashes': report['hashes'],
        }
    finally:
        if seed_file.exists():
            # Keep as audit trace; do not delete
            pass


def build_layer3_checks(out_dir: Path) -> Dict[str, Any]:
    checks = {
        'exists_output_dir': out_dir.exists(),
        'files': {},
    }

    if not checks['exists_output_dir']:
        checks['pass'] = False
        checks['errors'] = ['Output directory missing']
        return checks

    tuned = out_dir / 'layer3_tuned_personas.jsonl'
    entities = out_dir / 'layer3_entities.jsonl'
    edges = out_dir / 'layer3_edges.jsonl'
    snapshot = out_dir / 'layer3_graph_snapshot.json'
    report = out_dir / 'layer3_tuned_report.json'

    for name, p in {
        'tuned_personas': tuned,
        'entities': entities,
        'edges': edges,
        'graph_snapshot': snapshot,
        'report': report,
    }.items():
        checks['files'][name] = {
            'exists': p.exists(),
            'path': str(p),
        }
        if p.exists():
            checks['files'][name]['sha256'] = _sha256_file(p)

    checks['exists_tuned_personas'] = tuned.exists()
    checks['exists_entities'] = entities.exists()
    checks['exists_edges'] = edges.exists()
    checks['exists_snapshot'] = snapshot.exists()
    checks['exists_report'] = report.exists()

    try:
        if tuned.exists():
            rows = list(_read_jsonl(tuned))
            checks['tuned_count'] = len(rows)
            checks['unique_persona_ids'] = len({r.get('persona_id') for r in rows if isinstance(r, dict) and r.get('persona_id')})
            checks['all_tuning_rows_have_metadata'] = all(
                isinstance(r, dict) and isinstance(r.get('metadata'), dict)
                for r in rows
            )
        if entities.exists():
            rows = list(_read_jsonl(entities))
            checks['entity_count'] = len(rows)
        if edges.exists():
            rows = list(_read_jsonl(edges))
            checks['edge_count'] = len(rows)
        if snapshot.exists():
            with snapshot.open('r', encoding='utf-8') as f:
                checks['snapshot_keys'] = sorted(json.load(f).keys())
    except Exception as e:
        checks.setdefault('errors', []).append(f'Check parse failure: {e}')

    checks['pass'] = all([
        checks['exists_output_dir'],
        checks['exists_tuned_personas'],
        checks['exists_entities'],
        checks['exists_edges'],
        checks['exists_snapshot'],
        checks['exists_report'],
    ])

    return checks


def run_check(out_dir: Path) -> Dict[str, Any]:
    return build_layer3_checks(out_dir)


def run(args: argparse.Namespace) -> Dict[str, Any]:
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.check:
        result = run_check(out_dir)
        if args.strict and not result.get('pass'):
            raise PipelineError(f'Layer3 check failed: {json.dumps(result, ensure_ascii=False, default=_jsonable)}')
        return result

    if args.mock:
        rows = _read_jsonl(Path(args.input_layer2))
        state = Layer3State(
            run_id=str(uuid.uuid4()),
            base_url=args.base_url,
            mode='mock',
            started_utc=_now_iso(),
            phases={},
        )
        return _post_run_check(out_dir, run_mock_pipeline(rows, args, state, out_dir), args)

    rows = _read_jsonl(Path(args.input_layer2))
    try:
        return _post_run_check(out_dir, run_live_pipeline(rows, args, out_dir), args)
    except PipelineError as e:
        if args.no_allow_mock:
            raise
        # fallback
        rows_preview = rows[:args.max_layer2_sample]
        state = Layer3State(
            run_id=str(uuid.uuid4()),
            base_url=args.base_url,
            mode='mock_fallback',
            started_utc=_now_iso(),
            phases={},
        )
        with (out_dir / 'layer3_fallback_reason.txt').open('w', encoding='utf-8') as f:
            f.write(str(e))
        return _post_run_check(out_dir, run_mock_pipeline(rows_preview, args, state, out_dir), args)


def _post_run_check(out_dir: Path, result: Dict[str, Any], args: argparse.Namespace) -> Dict[str, Any]:
    checks = build_layer3_checks(out_dir)
    if args.strict and not checks.get('pass'):
        raise PipelineError(f'Layer3 post-run check failed: {json.dumps(checks, ensure_ascii=False, default=_jsonable)}')
    result['checks'] = checks
    return result


def main() -> None:
    args = parse_arguments()
    result = run(args)
    print(json.dumps(result, indent=2, default=_jsonable))


if __name__ == '__main__':
    main()
