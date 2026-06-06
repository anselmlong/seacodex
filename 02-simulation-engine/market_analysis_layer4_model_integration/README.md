# Layer 4: Analyst Integration Features

This layer converts Layer 3 graph/persona outputs into model-ready features:
- layer4_feature_matrix.jsonl: persona-level feature table
- layer4_recommendation_features.jsonl: recommendation feature table
- layer4_churn_features.jsonl: churn proxy table
- layer4_segments.json: trend and segment summary
- layer4_feature_lineage.csv: source mapping for feature columns
- layer4_manifest.json: manifest + checks

Check command:
python /Users/kyiwaithant/Documents/Shopee/prepare_layer4_model_integration.py --check --output-dir /Users/kyiwaithant/Documents/Shopee/market_analysis_layer4_integration
