# マスター効果とgcsimキーの対応表（カバレッジ）

作成: 2026-11-12 / gcsim辞書コミット b107b5dc / 生成: `npm run coverage:master-effects`

対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。
「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。

## gcsimキー（1173件）

| 分類 / 状態 | 件数 |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 82 |
| burst / linked | 12 |
| character / linked | 6 |
| constellation / excluded | 61 |
| constellation / linked | 289 |
| skill / linked | 12 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 182 |
| weapon / excluded | 42 |
| weapon / linked | 393 |

## マスター対象（840件）

| 種別 / 状態 | 件数 |
|---|---:|
| artifact / linked | 52 |
| artifact / unsupported | 3 |
| constellation / linked | 246 |
| constellation / unsupported | 22 |
| resonance / linked | 6 |
| resonance / unsupported | 1 |
| talent / linked | 158 |
| talent / unsupported | 113 |
| weapon / linked | 223 |
| weapon / unsupported | 16 |

## links（1021件）

| 関係 | 件数 |
|---|---:|
| cooldown | 140 |
| effect | 776 |
| extra | 98 |
| resonance | 7 |

## 保留（0件）

なし

## 未確認（0件）

なし

整合性: 孤立リンク 0件
