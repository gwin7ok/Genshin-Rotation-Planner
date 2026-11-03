# マスター効果とgcsimキーの対応表（カバレッジ）

作成: 2026-11-03 / gcsim辞書コミット 3877a1a3 / 生成: `npm run coverage:master-effects`

対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。
「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。

## gcsimキー（1163件）

| 分類 / 状態 | 件数 |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 82 |
| burst / linked | 12 |
| character / linked | 6 |
| constellation / excluded | 58 |
| constellation / linked | 285 |
| skill / linked | 12 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 181 |
| weapon / excluded | 42 |
| weapon / linked | 391 |

## マスター対象（834件）

| 種別 / 状態 | 件数 |
|---|---:|
| artifact / linked | 52 |
| artifact / unsupported | 3 |
| constellation / linked | 244 |
| constellation / unsupported | 20 |
| resonance / linked | 6 |
| resonance / unsupported | 1 |
| talent / linked | 157 |
| talent / unsupported | 113 |
| weapon / linked | 222 |
| weapon / unsupported | 16 |

## links（1014件）

| 関係 | 件数 |
|---|---:|
| cooldown | 139 |
| effect | 771 |
| extra | 97 |
| resonance | 7 |

## 保留（0件）

なし

## 未確認（0件）

なし

整合性: 孤立リンク 0件
