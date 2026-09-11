# KMI キャリブレーション計画

KMI v1（`kmi-v1` rubric / `kmi-consensus-v1` algorithm）は最初から「真の尺度」ではない。
設計尺度として運用を始め、人手ラベルで校正する。

## 1. データセット

[benchmark-dataset.md](benchmark-dataset.md) の 5 カテゴリ × 20 枚（計 100 枚程度）から開始する。

## 2. 人手ラベル

3 名以上の評価者が、各画像について以下を **独立に** 評価する。

| 項目 | 範囲 |
|---|---|
| KMI（総合的な霞ヶ関曼荼羅らしさ） | 0–100 |
| 胎蔵界型との形式的類似 | 0–100 |
| 金剛界型との形式的類似 | 0–100 |
| 可読性 | 0–100 |

任意で 9 軸それぞれの 0–5 評価も収集する（重み再推定に使う）。

## 3. 指標

- 評価者間一致: ICC(2,k)、Krippendorff's alpha
- モデル vs 人手: Spearman 順位相関、MAE
- ペア比較: 2 枚の画像のどちらがより曼荼羅的かの一致率（pairwise preference accuracy）
- 分類（taizokai / kongokai / hybrid / neither）の一致率

## 4. 重みの再推定

初期は固定重み（15/15/15/15/10/10/8/6/6）。データが揃ったら

```text
human_KMI ~ centrality + hierarchy + relation_density + information_density
          + semantic_breadth + modularity + radial_or_grid_structure
          + visual_coding + world_closure
```

で線形回帰（または順序回帰）し、重みを再推定する。再推定した重みは `lib/scoring/rubric.ts` に
新しい `RUBRIC_VERSION`（例: `kmi-v2`）として追加し、旧バージョンは残す。

## 5. ドリフト検出

- ベンチマーク画像を固定し、モデル更新（provider / model / prompt_version 変更）のたびに再解析する
- `model_runs` に保存された raw JSON を使い、各軸の分布・中央値の変化を比較する
- Judge の補正量（`dimension_adjustments`）の分布も監視し、Judge が中央値から系統的にずれていないか確認する

## 6. 記録

すべての解析に以下が保存されているため、再現・比較が可能。

```text
prompt_version, rubric_version, algorithm_version, provider, model,
prompt_hash, usage, latency_ms, created_at
```
