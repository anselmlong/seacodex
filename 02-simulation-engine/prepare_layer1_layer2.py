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
import random
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict
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
    parser.add_argument('--ground-truth-json', default=None,
                        help='Optional JSON file containing mined ground-truth persona/profile evidence (single object or list)')
    parser.add_argument('--ground-truth-mode', choices=['append', 'inject'], default='append',
                        help='append = add GT personas in addition to sampled personas; inject = replace some sampled personas if matching signals are high')
    parser.add_argument('--split', action='store_true',
                        help='Split Layer2 personas into train/val/test sets')
    parser.add_argument('--split-train-ratio', type=float, default=0.7,
                        help='Train ratio when --split is enabled (default: 0.7)')
    parser.add_argument('--split-val-ratio', type=float, default=0.15,
                        help='Validation ratio when --split is enabled (default: 0.15)')
    parser.add_argument('--split-test-ratio', type=float, default=0.15,
                        help='Test ratio when --split is enabled (default: 0.15)')
    parser.add_argument('--split-strategy', choices=['random', 'stratified'], default='stratified',
                        help='How to split personas: random or stratified by a single field')
    parser.add_argument('--split-by', default='industry',
                        help='Stratification field when --split-strategy=stratified (industry, planning_area, country, sex, age_bucket)')
    parser.add_argument('--check', action='store_true', help='Validate only the existing generated artifacts')
    return parser.parse_args()


def _lower_text(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip().lower()


def _as_set(values: Any) -> List[str]:
    if values is None:
        return []
    if isinstance(values, list):
        out = values
    elif isinstance(values, str):
        if not values.strip():
            return []
        try:
            parsed = ast.literal_eval(values)
            out = parsed if isinstance(parsed, list) else [values]
        except Exception:
            out = [values]
    else:
        out = [values]
    normalized = []
    for item in out:
        txt = _clean_text(item).lower().strip()
        if txt:
            normalized.append(txt)
    return sorted(set(normalized))


def _load_ground_truth_profiles(path: str | Path) -> List[Dict[str, Any]]:
    p = Path(path)
    raw = json.loads(p.read_text(encoding='utf-8'))
    profiles: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        profiles = raw
    elif isinstance(raw, dict):
        if 'customer_id' in raw:
            profiles = [raw]
        elif 'profiles' in raw and isinstance(raw['profiles'], list):
            profiles = raw['profiles']
        elif 'profiles' in raw and isinstance(raw['profiles'], dict):
            profiles = [raw['profiles']]
    else:
        raise ValueError('ground-truth json should be an object or array')

    out = []
    for item in profiles:
        if not isinstance(item, dict):
            continue
        cid = _clean_text(item.get('customer_id')) or _clean_text(item.get('id')) or 'ground_truth_unknown'
        product_usage = item.get('product_usage', {}) if isinstance(item.get('product_usage'), dict) else {}
        lifestyle = item.get('lifestyle', {}) if isinstance(item.get('lifestyle'), dict) else {}
        personality = item.get('personality_profile', {}) if isinstance(item.get('personality_profile'), dict) else {}
        batch_reports = item.get('batch_reports', [])

        # aggregate batch signals for robustness
        batch_products = _as_set(sum([_as_set(_maybe_list) for _maybe_list in [
            product_usage.get('product_types', []),
            product_usage.get('product_styles', []),
            item.get('product_types', []),
        ]], []))
        batch_activities = _as_set(sum([_as_set(_maybe_list) for _maybe_list in [
            lifestyle.get('activities', []),
            lifestyle.get('social_context', []),
            item.get('activities', []),
        ]], []))
        batch_traits = _as_set(sum([_as_set(_maybe_list) for _maybe_list in [
            personality.get('traits', []),
            personality.get('identity_style', []),
            item.get('traits', []),
        ]], []))
        contexts = _as_set(sum([_as_set(_maybe_list) for _maybe_list in [
            lifestyle.get('settings', []),
            product_usage.get('usage_contexts', []),
            item.get('usage_contexts', []),
            item.get('settings', []),
        ]], []))

        # lightweight uncertainty encoding for transparency
        uncertainty = item.get('uncertainties', [])
        if isinstance(uncertainty, list):
            uncertainty = [x for x in uncertainty if _clean_text(x)]
        else:
            uncertainty = []

        out.append({
            'source_profile_id': cid,
            'source_path': str(p),
            'product_usage': {
                'product_types': _as_set(product_usage.get('product_types', [])),
                'product_styles': _as_set(product_usage.get('product_styles', [])),
                'usage_contexts': _as_set(product_usage.get('usage_contexts', [])),
                'usage_frequency_hint': _clean_text(product_usage.get('usage_frequency_hint')),
            },
            'lifestyle': {
                'settings': _as_set(lifestyle.get('settings', [])),
                'activities': _as_set(lifestyle.get('activities', [])),
                'social_context': _as_set(lifestyle.get('social_context', [])),
                'spending_tier_signal': _clean_text(lifestyle.get('spending_tier_signal')),
            },
            'personality': {
                'traits': _as_set(personality.get('traits', [])),
                'identity_style': _as_set(personality.get('identity_style', [])),
                'risk_tolerance': _clean_text(personality.get('risk_tolerance')),
                'decision_style': _clean_text(personality.get('decision_style')),
            },
            'coverage_note': _clean_text(item.get('coverage_note', '')),
            'uncertainties': _as_set(uncertainty),
            'batch_count': len(batch_reports) if isinstance(batch_reports, list) else 0,
            'interests_seed': _as_set(_as_set(product_usage.get('product_types', [])) + _as_set(product_usage.get('product_styles', []))),
            'skills_seed': _as_set(_as_set(batch_traits)),
            'context_tags': list(dict.fromkeys(_as_set(contexts) + _as_set([_clean_text(item.get('customer_id'))]))),
            'raw_profile': item,
        })
    return out


def _ground_truth_similarity(row_record: Dict[str, Any], gt_profile: Dict[str, Any]) -> float:
    row_interests = set(_as_set(row_record.get('interests_seed')))
    row_skills = set(_as_set(row_record.get('skills_seed')))
    row_country = _lower_text(row_record.get('country'))
    row_area = _lower_text(row_record.get('planning_area'))
    row_occupation = _lower_text(row_record.get('occupation'))
    row_industry = _lower_text(row_record.get('industry'))

    gt_interests = set(gt_profile.get('interests_seed', []))
    gt_styles = set(gt_profile.get('product_usage', {}).get('product_styles', []))
    gt_ctx = set(gt_profile.get('context_tags', []))

    score = 0.0
    score += len(row_interests & gt_interests) * 2.0
    score += len(row_skills & set(gt_profile.get('skills_seed', []))) * 1.2
    score += len(row_interests & gt_styles) * 1.5
    score += len(set([row_country, row_area, row_occupation, row_industry]) & set(gt_ctx))
    if row_area and _lower_text(row_record.get('planning_area')) == 'school':
        score += 0.5
    return score


def _coerce_split_ratios(
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
) -> Dict[str, float]:
    if train_ratio < 0 or val_ratio < 0 or test_ratio < 0:
        raise ValueError('Split ratios must be non-negative')
    total = train_ratio + val_ratio + test_ratio
    if total <= 0:
        raise ValueError('Split ratios must sum to a positive value')

    # if user entered percentage-style ratios
    if total > 1.5:
        train_ratio /= total
        val_ratio /= total
        test_ratio /= total
        total = train_ratio + val_ratio + test_ratio

    if abs(total - 1.0) > 1e-9:
        train_ratio /= total
        val_ratio /= total
        test_ratio /= total

    return {
        'train': train_ratio,
        'val': val_ratio,
        'test': test_ratio,
    }


def _compute_split_counts(total: int, ratios: Dict[str, float], split_names: Tuple[str, ...] = ('train', 'val', 'test')) -> Dict[str, int]:
    if total <= 0:
        return {name: 0 for name in split_names}
    if total == 1:
        return {split_names[0]: 1, split_names[1]: 0, split_names[2]: 0}

    raw = {name: ratios[name] * total for name in split_names}
    base = {name: int(v) for name, v in raw.items()}
    remainder = total - sum(base.values())
    if remainder > 0:
        fractional = sorted(split_names, key=lambda s: raw[s] - int(raw[s]), reverse=True)
        for idx in range(remainder):
            base[fractional[idx % len(split_names)]] += 1
    return base


def _stratify_key(row: Dict[str, Any], by: str) -> str:
    if by == 'industry':
        value = row.get('profession', {}).get('industry')
    elif by == 'planning_area':
        value = row.get('location', {}).get('planning_area')
    elif by == 'country':
        value = row.get('location', {}).get('country')
    elif by == 'sex':
        value = row.get('demographics', {}).get('sex')
    elif by == 'age_bucket':
        age = row.get('demographics', {}).get('age')
        if age is None:
            value = None
        else:
            try:
                age_int = int(age)
            except Exception:
                age_int = None
            if age_int is None:
                value = None
            elif age_int < 18:
                value = 'under_18'
            elif age_int < 25:
                value = '18_24'
            elif age_int < 35:
                value = '25_34'
            elif age_int < 45:
                value = '35_44'
            elif age_int < 55:
                value = '45_54'
            else:
                value = '55_plus'
    else:
        value = row.get(by) if isinstance(row, dict) else None
    return _lower_text(value) or 'unknown'


def _split_persona_records(
    personas: List[Dict[str, Any]],
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
    seed: int,
    strategy: str = 'random',
    split_by: str = 'industry',
) -> Dict[str, List[Dict[str, Any]]]:
    ratios = _coerce_split_ratios(train_ratio, val_ratio, test_ratio)
    if strategy == 'random':
        rng = random.Random(seed)
        rows = personas.copy()
        rng.shuffle(rows)
        counts = _compute_split_counts(len(rows), ratios)
        split = {'train': [], 'val': [], 'test': []}
        cursor = 0
        for name in ('train', 'val', 'test'):
            end = cursor + counts[name]
            split[name] = rows[cursor:end]
            cursor = end
        return split

    if strategy != 'stratified':
        raise ValueError(f'Unknown split strategy: {strategy}')

    buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in personas:
        buckets[_stratify_key(row, split_by)].append(row)

    split = {'train': [], 'val': [], 'test': []}
    rng = random.Random(seed)
    for group in buckets.values():
        rows = group.copy()
        rng.shuffle(rows)
        counts = _compute_split_counts(len(rows), ratios)
        cursor = 0
        for name in ('train', 'val', 'test'):
            end = cursor + counts[name]
            split[name].extend(rows[cursor:end])
            cursor = end

    for name in split:
        rng.shuffle(split[name])

    return split


def _build_ground_truth_persona(profile: Dict[str, Any]) -> Dict[str, Any]:
    gt_interests = profile.get('interests_seed', [])
    gt_skills = profile.get('skills_seed', [])
    traits = _as_set(profile.get('personality', {}).get('traits', []))
    decision_style = profile.get('personality', {}).get('decision_style', '')
    risk_tolerance = profile.get('personality', {}).get('risk_tolerance', '')

    return {
        'persona_id': f"gt_{_clean_text(profile.get('source_profile_id')).replace('.', '_')}",
        'source_uuid': _clean_text(profile.get('source_profile_id')),
        'lifecycle': 'ground_truth_anchor',
        'demographics': {
            'sex': None,
            'age': None,
            'marital_status': None,
            'education_level': None,
        },
        'location': {
            'country': None,
            'planning_area': None,
        },
        'profession': {
            'occupation': None,
            'industry': None,
        },
        'profiles': {
            'persona_description': f'Ground-truth anchor profile for { _clean_text(profile.get("source_profile_id")) }',
            'professional_persona': '',
            'sports_persona': '',
            'arts_persona': '',
            'travel_persona': '',
            'culinary_persona': '',
        },
        'interests_seed': list(_as_set(gt_interests)),
        'skills_seed': list(_as_set(gt_skills)),
        'swarm_inputs': {
            'interest_prompt_seed': f'Ground-truth profile hints: products={"; ".join(profile.get("product_usage", {}).get("product_types", []))}; context={"; ".join(profile.get("context_tags", []))}',
            'context_tags': [t for t in profile.get('context_tags', []) if t],
            'ground_truth_anchor': True,
            'source_profile_id': _clean_text(profile.get('source_profile_id')),
            'uncertainty_profile': profile.get('uncertainties', []),
            'risk_tolerance_hint': risk_tolerance,
            'decision_style_hint': decision_style,
            'traits': traits,
        },
        'metadata': {
            'seed_method': 'ground_truth_anchor',
            'source_dataset': 'online_ground_truth_profile',
            'source_profile_path': profile.get('source_path'),
            'source_profile_id': _clean_text(profile.get('source_profile_id')),
            'ground_truth_coverage': _as_set(profile.get('coverage_note', '') or []),
        },
    }


def _inject_ground_truth_profiles(
    selected_rows: List[Dict[str, Any]],
    ground_truth_profiles: List[Dict[str, Any]],
    mode: str,
    row_to_persona_fn,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    summary = {'requested': len(ground_truth_profiles), 'added': 0, 'mode': mode, 'assignments': []}
    if not ground_truth_profiles:
        return selected_rows, summary

    personas = [row_to_persona_fn(row) for row in selected_rows]

    if mode == 'append':
        for gt in ground_truth_profiles:
            personas.append(_build_ground_truth_persona(gt))
            summary['added'] += 1
            summary['assignments'].append({
                'source_profile_id': gt.get('source_profile_id'),
                'target_persona_id': personas[-1]['persona_id'],
                'match_mode': 'append_only',
                'replaced_profile_id': None,
            })
        return personas, summary

    # inject mode: replace nearest persona candidates (highest-sim score)
    used = set()
    for gt in sorted(ground_truth_profiles, key=lambda g: g.get('batch_count', 0), reverse=True):
        scores = []
        for idx, row in enumerate(selected_rows):
            if idx in used:
                continue
            score = _ground_truth_similarity(row, gt)
            scores.append((score, idx))
        scores.sort(reverse=True, key=lambda x: x[0])
        if not scores:
            continue
        best_idx = scores[0][1]
        personas[best_idx] = _build_ground_truth_persona(gt)
        used.add(best_idx)
        summary['added'] += 1
        summary['assignments'].append({
            'source_profile_id': gt.get('source_profile_id'),
            'target_persona_id': personas[best_idx]['persona_id'],
            'match_mode': 'inject_replace',
            'replaced_profile_id': selected_rows[best_idx].get('source_uuid'),
            'match_score': float(scores[0][0]),
        })
    return personas, summary


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


def build_layer2(
    layer1_df,
    n: int,
    seed: int,
    ground_truth_profiles: List[Dict[str, Any]] | None = None,
    ground_truth_mode: str = 'append',
    split: bool = False,
    split_train_ratio: float = 0.7,
    split_val_ratio: float = 0.15,
    split_test_ratio: float = 0.15,
    split_strategy: str = 'stratified',
    split_by: str = 'industry',
) -> Tuple[Any, Dict[str, Any], Dict[str, List[Dict[str, Any]]] | None]:
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

    selected_rows = selected.to_dict(orient='records')
    personas = [row_to_persona(r) for r in selected_rows]

    personas, gt_report = personas, {
        'requested': 0,
        'added': 0,
        'mode': 'none',
        'assignments': [],
    }

    if ground_truth_profiles:
        try:
            personas, gt_report = _inject_ground_truth_profiles(
                selected_rows,
                ground_truth_profiles,
                ground_truth_mode,
                row_to_persona,
            )
        except Exception as e:
            raise RuntimeError(f'ground truth profile enrichment failed: {e}') from e

    report = {
        'requested_n': n,
        'total_available': int(len(layer1_df)),
        'sample_seed': int(seed),
        'produced_n': int(len(personas)),
        'sampled_row_ids': [p['source_uuid'] for p in personas],
        'ground_truth_enrichment': gt_report,
        'split': {
            'enabled': split,
        },
    }
    if split:
        split_parts = _split_persona_records(
            personas,
            split_train_ratio,
            split_val_ratio,
            split_test_ratio,
            seed=seed,
            strategy=split_strategy,
            split_by=split_by,
        )
        report['split'].update({
            'strategy': split_strategy,
            'split_by': split_by,
            'ratios': {
                'train': split_train_ratio,
                'val': split_val_ratio,
                'test': split_test_ratio,
            },
            'meta': {
                'strategy': split_strategy,
                'split_by': split_by,
                'ratios': {
                    'train': split_train_ratio,
                    'val': split_val_ratio,
                    'test': split_test_ratio,
                },
                'seed': seed,
            },
            'split_counts': {
                'train': len(split_parts.get('train', [])),
                'val': len(split_parts.get('val', [])),
                'test': len(split_parts.get('test', [])),
            },
            'partitions': {
                'train': [r['persona_id'] for r in split_parts.get('train', [])],
                'val': [r['persona_id'] for r in split_parts.get('val', [])],
                'test': [r['persona_id'] for r in split_parts.get('test', [])],
            },
        })
        return personas, report, split_parts
    return personas, report, None


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


def write_layer2_outputs(
    personas: List[Dict[str, Any]],
    out_dir: Path,
    layer1_report: Dict[str, Any],
    n: int,
    seed: int,
    split: bool = False,
    split_details: Dict[str, Any] | None = None,
    layer2_report: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    layer2_dir = out_dir / 'layer2'
    layer2_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = layer2_dir / f'personas_initial_n{n}_seed{seed}.jsonl'
    md_path = layer2_dir / f'personas_initial_n{n}_seed{seed}.json'

    with jsonl_path.open('w', encoding='utf-8') as f:
        for rec in personas:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    split_output = None
    if split and split_details:
        split_output = {
            'train': {
                'count': len(split_details.get('train', [])),
                'file': None,
            },
            'val': {
                'count': len(split_details.get('val', [])),
                'file': None,
            },
            'test': {
                'count': len(split_details.get('test', [])),
                'file': None,
            },
        }
        split_dir = layer2_dir / 'splits'
        strategy = split_details.get('meta', {}).get('strategy', 'stratified')
        split_by = split_details.get('meta', {}).get('split_by', 'industry')
        split_ratio_info = split_details.get('meta', {}).get('ratios', {})
        split_seed = split_details.get('meta', {}).get('seed', seed)
        split_case_dir = split_dir / f'{strategy}_{split_by}_seed{split_seed}'
        split_case_dir.mkdir(parents=True, exist_ok=True)
        for split_name in ('train', 'val', 'test'):
            split_path = split_case_dir / f'personas_{split_name}_n{n}_seed{seed}.jsonl'
            with split_path.open('w', encoding='utf-8') as sf:
                for row in split_details.get(split_name, []):
                    sf.write(json.dumps(row, ensure_ascii=False) + '\n')
            split_output[split_name]['file'] = str(split_path)
        split_output['metadata'] = {
            'strategy': strategy,
            'split_by': split_by,
            'ratios': split_ratio_info,
            'seed': split_seed,
        }

    report = {
        'layer': 'layer2',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'requested_n': n,
        'seed': seed,
        'produced_n': len(personas),
        'layer1_source': layer1_report['outputs']['parquet'],
        'layer1_report_hash': layer1_report.get('source_sha256'),
        'layer1_sha': layer1_report['quality_checks'].get('source_df_hash', None),
    }

    if layer2_report:
        for k in ['total_available', 'sample_seed', 'sampled_row_ids', 'ground_truth_enrichment']:
            if k in layer2_report:
                report[k] = layer2_report[k]

    report.update({
        'outputs': {
            'jsonl': str(jsonl_path),
        },
        'split_outputs': split_output,
        'file_hashes': {
            'jsonl_sha256': _sha256_file(jsonl_path),
        },
        'required_fields': {
            'has_persona_id': all('persona_id' in p for p in personas),
            'has_source_uuid': all('source_uuid' in p for p in personas),
            'has_demographics': all('demographics' in p for p in personas),
            'has_swarm_inputs': all('swarm_inputs' in p for p in personas),
        }
    })
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

        ground_truth_profiles = []
        if args.ground_truth_json:
            ground_truth_profiles = _load_ground_truth_profiles(args.ground_truth_json)

        personas, layer2_report, split_parts = build_layer2(
            seed_df,
            n=args.n,
            seed=args.seed,
            ground_truth_profiles=ground_truth_profiles,
            ground_truth_mode=args.ground_truth_mode,
            split=args.split,
            split_train_ratio=args.split_train_ratio,
            split_val_ratio=args.split_val_ratio,
            split_test_ratio=args.split_test_ratio,
            split_strategy=args.split_strategy if args.split else 'stratified',
            split_by=args.split_by,
        )
        layer2_report = write_layer2_outputs(
            personas,
            out_dir,
            layer1_report,
            n=args.n,
            seed=args.seed,
            split=args.split,
            split_details=(
                {
                    'meta': {
                        'strategy': args.split_strategy if args.split else 'stratified',
                        'split_by': args.split_by,
                        'ratios': {
                            'train': args.split_train_ratio,
                            'val': args.split_val_ratio,
                            'test': args.split_test_ratio,
                        },
                        'seed': args.seed,
                    },
                    'train': split_parts.get('train', []) if split_parts else [],
                    'val': split_parts.get('val', []) if split_parts else [],
                    'test': split_parts.get('test', []) if split_parts else [],
                }
                if args.split
                else None
            ),
            layer2_report=layer2_report,
        )
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
