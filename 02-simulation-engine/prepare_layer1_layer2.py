#!/usr/bin/env python3
"""
Layer 1 and Layer 2 preparation for Autonomous Proactive Market Analysis.

Layer 1:
- Read Nemotron persona parquet files.
- Produce validated, deduplicated persona seeds.
- Emit quality checks and audit artifacts.

Layer 2:
- Initialize N simulation personas from seeds.
- Emit a compact persona object for downstream MiroFish/swarm inputs.

Usage:
python /Users/.../prepare_layer1_layer2.py --run layer1
python /Users/.../prepare_layer1_layer2.py --run layer2 --n 1000
python /Users/.../prepare_layer1_layer2.py --run both --n 5000
python /Users/.../prepare_layer1_layer2.py --check
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


DEFAULT_SOURCE_DIR = Path('/Users/kyiwaithant/Documents/Shopee/nemotron-personas-singapore')
DEFAULT_OUT_DIR = Path('/Users/kyiwaithant/Documents/Shopee/market_analysis_layer1_layer2')
REQUIRED_COLUMNS = {
    'uuid',
    'professional_persona',
    'sports_persona',
    'arts_persona',
    'travel_persona',
    'culinary_persona',
    'persona',
    'cultural_background',
    'skills_and_expertise',
    'skills_and_expertise_list',
    'hobbies_and_interests',
    'hobbies_and_interests_list',
    'career_goals_and_ambitions',
    'sex',
    'age',
    'marital_status',
    'education_level',
    'occupation',
    'industry',
    'planning_area',
    'country',
}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def _hash_dataframe(df) -> str:
    import pandas as pd

    # Stable fingerprint for deterministic data-change checks
    return pd.util.hash_pandas_object(df.astype(str).fillna('<NA>'), index=True).sum()


def _jsonable(obj):
    try:
        import numpy as np  # type: ignore

        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        if isinstance(obj, (set, tuple)):
            return list(obj)
    except Exception:
        pass

    if isinstance(obj, (int, float, str, bool, type(None), dict, list)):
        return obj
    return str(obj)


def _to_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, (int, float)):
        return []
    s = str(value).strip()
    if not s:
        return []
    try:
        parsed = ast.literal_eval(s)
    except Exception:
        # Fallback split
        if ',' in s:
            parsed = [x.strip().strip("\'") for x in s.strip('[]').split(',')]
        else:
            parsed = [s]
    if isinstance(parsed, (list, tuple)):
        return [str(x).strip().strip("\'").strip() for x in parsed if str(x).strip()]
    if isinstance(parsed, set):
        return [str(x).strip().strip("\'").strip() for x in sorted(parsed) if str(x).strip()]
    return [str(parsed).strip()] if str(parsed).strip() else []


def _clean_text(value: Any) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    return text


def _normalize_series_to_bool(s):
    return s.notna() if hasattr(s, 'notna') else True


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Run Layer 1 and Layer 2 preparation for persona pipeline')
    parser.add_argument('--run', choices=['layer1', 'layer2', 'both'], default='both')
    parser.add_argument('--source-dir', default=str(DEFAULT_SOURCE_DIR))
    parser.add_argument('--output-dir', default=str(DEFAULT_OUT_DIR))
    parser.add_argument('--n', type=int, default=5000)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--max-rows', type=int, default=None)
    parser.add_argument('--check', action='store_true', help='Validate only the existing generated artifacts')
    return parser.parse_args()


def load_parquet_dataset(source_dir: Path):
    # local import so script fails with an explicit message if env is missing deps
    try:
        import pandas as pd
    except ImportError as e:
        raise RuntimeError(
            'Pandas/pyarrow are required for parquet loading. '\
            'Create venv and pip install pandas pyarrow, then rerun.'
        ) from e

    data_dir = source_dir / 'data'
    if not data_dir.exists():
        raise FileNotFoundError(f'Mata source missing: {data_dir}')
    files = sorted(data_dir.glob('train-*.parquet'))
    if not files:
        raise FileNotFoundError(f'No parquet files found under {data_dir}')

    df = pd.concat([pd.read_parquet(str(f)) for f in files], ignore_index=True)
    return df


def validate_layer1_dataframe(df) -> Dict[str, Any]:
    present = set(df.columns)
    missing = sorted(REQUIRED_COLUMNS - present)

    if missing:
        raise ValueError(f'Missing required columns: {missing}')

    dup = int(df['uuid'].duplicated().sum())
    empty_uuid = int(df['uuid'].isna().sum())
    critical_missing = {c: int(df[c].isna().sum()) for c in ['uuid', 'sex', 'age', 'occupation', 'industry', 'planning_area', 'country']}

    # country-level check
    top_countries = df['country'].fillna('UNKNOWN').value_counts().head(5).to_dict()
    top_areas = df['planning_area'].fillna('UNKNOWN').value_counts().head(5).to_dict()

    summary = {
        'rows_total': int(len(df)),
        'columns_total': int(len(df.columns)),
        'missing_required': missing,
        'duplicates_on_uuid': dup,
        'null_uuid': empty_uuid,
        'critical_missing': critical_missing,
        'top_countries': top_countries,
        'top_planning_area': top_areas,
    }

    # keep only required columns for output
    return summary, df


def build_layer1(df, max_rows: int | None = None) -> Tuple[Any, Dict[str, Any]]:
    import pandas as pd

    # ensure column spelling consistency
    if 'professional_persona' not in df.columns and 'professionaL_persona' in df.columns:
        df = df.rename(columns={'professionaL_persona': 'professional_persona'})

    before = len(df)
    df = df.dropna(subset=['uuid']).copy()
    dropped_uuid = before - len(df)
    df = df.drop_duplicates(subset=['uuid'], keep='first').copy()
    dropped_dup = before - dropped_uuid - len(df)

    # canonical types
    df['age'] = pd.to_numeric(df['age'], errors='coerce')

    # parse list-like fields
    for col in ['hobbies_and_interests_list', 'skills_and_expertise_list']:
        df[f'{col}_parsed'] = df[col].apply(_to_list)

    # derive normalized fields for downstream layer 2
    df['interests_seed'] = df['hobbies_and_interests_list_parsed'].apply(lambda v: v[:12])
    df['skills_seed'] = df['skills_and_expertise_list_parsed'].apply(lambda v: v[:12])

    # keep compact layer1 dataset
    layer1_cols = [
        'uuid',
        'professional_persona',
        'sports_persona',
        'arts_persona',
        'travel_persona',
        'culinary_persona',
        'persona',
        'cultural_background',
        'skills_and_expertise',
        'skills_and_expertise_list_parsed',
        'hobbies_and_interests',
        'hobbies_and_interests_list_parsed',
        'career_goals_and_ambitions',
        'sex',
        'age',
        'marital_status',
        'education_level',
        'occupation',
        'industry',
        'planning_area',
        'country',
        'interests_seed',
        'skills_seed',
    ]
    seed_df = df[layer1_cols].copy()

    if max_rows and len(seed_df) > max_rows:
        seed_df = seed_df.head(max_rows)

    parse_failures = {
        'hobbies_and_interests_list_parsed_empty': int((seed_df['hobbies_and_interests_list_parsed'].str.len() == 0).sum()),
        'skills_and_expertise_list_parsed_empty': int((seed_df['skills_and_expertise_list_parsed'].str.len() == 0).sum()),
    }

    quality = {
        'rows_after_uuid_clean': int(len(seed_df)),
        'rows_dropped_missing_uuid': int(dropped_uuid),
        'rows_dropped_duplicates': int(dropped_dup),
        'parse_failures': parse_failures,
    }
    return seed_df, quality


def build_layer2(layer1_df, n: int, seed: int) -> Tuple[Any, Dict[str, Any]]:
    import pandas as pd
    import numpy as np

    n = min(max(n, 1), len(layer1_df))
    selected = layer1_df.sample(n=n, random_state=seed, replace=False)

    def _as_list(value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, np.ndarray):
            value = value.tolist()
        if isinstance(value, str):
            return [v for v in _to_list(value) if v]
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, (np.generic, int, float)):
            if pd.isna(value):
                return []
        return [str(value)] if str(value).strip() else []

    def _clean_scalar(value: Any) -> Any:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
        return value

    def row_to_persona(row) -> Dict[str, Any]:
        get = row.get
        interests_seed = _as_list(get('interests_seed'))
        skills_seed = _as_list(get('skills_seed'))
        return {
            'persona_id': f'syn_{get("uuid")}',
            'source_uuid': _clean_scalar(get("uuid")),
            'lifecycle': 'initialized',
            'demographics': {
                'sex': _clean_scalar(get('sex')),
                'age': None if pd.isna(get('age')) else int(get('age')),
                'marital_status': _clean_scalar(get('marital_status')),
                'education_level': _clean_scalar(get('education_level')),
            },
            'location': {
                'country': _clean_scalar(get('country')),
                'planning_area': _clean_scalar(get('planning_area')),
            },
            'profession': {
                'occupation': _clean_scalar(get('occupation')),
                'industry': _clean_scalar(get('industry')),
            },
            'profiles': {
                'persona_description': _clean_text(_clean_scalar(get('persona'))),
                'professional_persona': _clean_text(_clean_scalar(get('professional_persona'))),
                'sports_persona': _clean_text(_clean_scalar(get('sports_persona'))),
                'arts_persona': _clean_text(_clean_scalar(get('arts_persona'))),
                'travel_persona': _clean_text(_clean_scalar(get('travel_persona'))),
                'culinary_persona': _clean_text(_clean_scalar(get('culinary_persona'))),
            },
            'interests_seed': interests_seed[:10],
            'skills_seed': skills_seed[:10],
            'swarm_inputs': {
                'interest_prompt_seed': f'Profile interests from synthetic seed: {"; ".join([x for x in interests_seed[:10]])}',
                'context_tags': [
                    t for t in [
                        str(_clean_scalar(get('country'))), str(_clean_scalar(get('planning_area'))), str(_clean_scalar(get('industry'))), str(_clean_scalar(get('occupation')))
                    ] if t and t != 'nan'
                ],
            },
            'metadata': {
                'seed_method': 'random_sample',
                'seed_id': seed,
                'source_dataset': 'nvidia/Nemotron-Personas-Singapore',
            },
        }

    personas = [row_to_persona(r) for r in selected.to_dict(orient='records')]

    report = {
        'requested_n': n,
        'total_available': int(len(layer1_df)),
        'sample_seed': int(seed),
        'produced_n': int(len(personas)),
        'sampled_row_ids': [p['source_uuid'] for p in personas],
    }
    return personas, report


def write_layer1_outputs(layer1_df, out_dir: Path, quality: Dict[str, Any], source_hash: str) -> Dict[str, Any]:
    import pandas as pd

    layer1_dir = out_dir / 'layer1'
    layer1_dir.mkdir(parents=True, exist_ok=True)

    parquet_path = layer1_dir / 'persona_seed.parquet'
    jsonl_path = layer1_dir / 'persona_seed.jsonl'
    csv_path = layer1_dir / 'persona_seed.csv'

    layer1_df = layer1_df.copy()
    layer1_df['skills_and_expertise_list'] = layer1_df['skills_and_expertise_list_parsed']
    layer1_df['hobbies_and_interests_list'] = layer1_df['hobbies_and_interests_list_parsed']
    layer1_out = layer1_df.drop(columns=['skills_and_expertise_list_parsed', 'hobbies_and_interests_list_parsed'])

    layer1_out.to_parquet(parquet_path, index=False)
    layer1_out.to_csv(csv_path, index=False)
    with jsonl_path.open('w', encoding='utf-8') as f:
        for rec in layer1_out.to_dict(orient='records'):
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    report = {
        'layer': 'layer1',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source_dir': str(DEFAULT_SOURCE_DIR),
        'source_sha256': source_hash,
        'records': int(len(layer1_out)),
        'columns': list(layer1_out.columns),
        'quality_checks': quality,
        'outputs': {
            'parquet': str(parquet_path),
            'jsonl': str(jsonl_path),
            'csv': str(csv_path),
        },
        'file_hashes': {
            'parquet_sha256': _sha256_file(parquet_path),
            'jsonl_sha256': _sha256_file(jsonl_path),
            'csv_sha256': _sha256_file(csv_path),
        },
    }

    report_path = layer1_dir / 'layer1_report.json'
    with report_path.open('w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=_jsonable)

    return report


def write_layer2_outputs(personas: List[Dict[str, Any]], out_dir: Path, layer1_report: Dict[str, Any], n: int, seed: int) -> Dict[str, Any]:
    layer2_dir = out_dir / 'layer2'
    layer2_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = layer2_dir / f'personas_initial_n{n}_seed{seed}.jsonl'
    md_path = layer2_dir / f'personas_initial_n{n}_seed{seed}.json'

    with jsonl_path.open('w', encoding='utf-8') as f:
        for rec in personas:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    report = {
        'layer': 'layer2',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'requested_n': n,
        'seed': seed,
        'produced_n': len(personas),
        'layer1_source': layer1_report['outputs']['parquet'],
        'layer1_report_hash': layer1_report.get('source_sha256'),
        'layer1_sha': layer1_report['quality_checks'].get('source_df_hash', None),
        'outputs': {
            'jsonl': str(jsonl_path)
        },
        'file_hashes': {
            'jsonl_sha256': _sha256_file(jsonl_path),
        },
        'required_fields': {
            'has_persona_id': all('persona_id' in p for p in personas),
            'has_source_uuid': all('source_uuid' in p for p in personas),
            'has_demographics': all('demographics' in p for p in personas),
            'has_swarm_inputs': all('swarm_inputs' in p for p in personas),
        }
    }
    with md_path.open('w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=_jsonable)

    return report


def build_manifest(out_dir: Path, layer1_report: Dict[str, Any] | None, layer2_report: Dict[str, Any] | None) -> None:
    manifest = {
        'project': 'Autonomous Proactive Market Analysis',
        'version': '1.0',
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'artifacts': {
            'layer1': layer1_report,
            'layer2': layer2_report,
        },
    }
    p = out_dir / 'pipeline_manifest.json'
    with p.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, default=_jsonable)


def check_outputs(out_dir: Path) -> Dict[str, Any]:
    checks = {
        'exists_output_dir': out_dir.exists(),
        'exists_layer1': False,
        'exists_layer2': False,
        'layer1_ok': False,
        'layer2_ok': False,
        'errors': [],
    }
    if not checks['exists_output_dir']:
        checks['errors'].append(f'Output directory missing: {out_dir}')
        return checks

    layer1_dir = out_dir / 'layer1'
    layer2_dir = out_dir / 'layer2'
    checks['exists_layer1'] = layer1_dir.exists()
    checks['exists_layer2'] = layer2_dir.exists()

    if layer1_dir.exists():
        rp = layer1_dir / 'layer1_report.json'
        if rp.exists():
            checks['layer1_report'] = json.loads(rp.read_text())
            checks['layer1_ok'] = all(
                k in checks['layer1_report']['outputs'] for k in ['parquet', 'jsonl', 'csv']
            )
        else:
            checks['errors'].append('Missing layer1 report')

    if layer2_dir.exists():
        # latest layer2 JSON (seeded file)
        json_files = sorted(
            layer2_dir.glob('personas_initial_n*_seed*.json'),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if json_files:
            rp = json.loads(json_files[0].read_text())
            checks['layer2_report'] = rp
            checks['layer2_ok'] = rp.get('required_fields', {}).get('has_persona_id', False)
        else:
            checks['errors'].append('Missing layer2 report file')

    checks['pass'] = checks['exists_output_dir'] and checks['layer1_ok'] and checks['layer2_ok']
    return checks


def run_pipeline(args: argparse.Namespace) -> None:
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.check:
        result = check_outputs(out_dir)
        print(json.dumps(result, indent=2))
        return

    if args.run in {'layer1', 'both'}:
        source_dir = Path(args.source_dir)
        source_parquet = sorted((source_dir / 'data').glob('train-*.parquet'))
        source_hash = hashlib.sha256('||'.join(str(p) for p in source_parquet).encode()).hexdigest()

        df = load_parquet_dataset(source_dir)
        _validation_summary, df = validate_layer1_dataframe(df)
        layer1_df, quality = build_layer1(df, max_rows=args.max_rows)
        quality.update(_validation_summary)

        # optional stable fingerprint for source data for auditing
        try:
            quality['source_df_hash'] = _hash_dataframe(layer1_df)
        except Exception:
            quality['source_df_hash'] = None

        layer1_report = write_layer1_outputs(layer1_df, out_dir, quality, source_hash)
    else:
        # try to read prior layer1 report
        l1_report_path = out_dir / 'layer1' / 'layer1_report.json'
        if not l1_report_path.exists():
            raise FileNotFoundError(f'Need layer1 outputs first at {l1_report_path}')
        layer1_report = json.loads(l1_report_path.read_text())
        # and parquet
        layer1_df = pd_read_parquet_from_report(layer1_report['outputs']['parquet'])

    if args.run in {'layer2', 'both'}:
        if args.run == 'both' and 'layer1' in locals():
            seed_df = pd_read_parquet_from_dataframe(layer1_report, out_dir)
        else:
            seed_df = pd_read_parquet_from_report(layer1_report['outputs']['parquet'])
        personas, layer2_report = build_layer2(seed_df, n=args.n, seed=args.seed)
        layer2_report = write_layer2_outputs(personas, out_dir, layer1_report, n=args.n, seed=args.seed)
    else:
        layer2_report = None

    build_manifest(out_dir, layer1_report if 'layer1_report' in locals() else None, layer2_report)

    # print quick human-check summary
    summary = {
        'output_dir': str(out_dir),
        'layer1_records': layer1_report['records'] if args.run in {'layer1', 'both'} else 'reuse',
        'layer2_records': layer2_report['produced_n'] if layer2_report else 'n/a',
        'layer1_parquet': layer1_report['outputs']['parquet'] if args.run in {'layer1', 'both'} else 'reuse',
        'layer2_jsonl': layer2_report['outputs']['jsonl'] if layer2_report else 'n/a',
    }
    print(json.dumps(summary, indent=2))


def pd_read_parquet_from_report(parquet_path: str):
    try:
        import pandas as pd
    except ImportError as e:
        raise RuntimeError('Pandas is required to read layer1 outputs') from e
    return pd.read_parquet(parquet_path)


def pd_read_parquet_from_dataframe(_layer1_report: Dict[str, Any], _out_dir: Path):
    return pd_read_parquet_from_report(_layer1_report['outputs']['parquet'])


def main() -> None:
    args = parse_arguments()
    run_pipeline(args)


if __name__ == '__main__':
    main()
