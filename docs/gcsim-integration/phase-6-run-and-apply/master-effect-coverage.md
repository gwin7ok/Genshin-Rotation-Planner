# マスター効果とgcsimキーの対応表（カバレッジ）

作成: 2026-10-08 / gcsim辞書コミット 1f9c1f2e / 生成: `npm run coverage:master-effects`

対象は固有天賦・命ノ星座・武器・聖遺物・元素共鳴。アクション効果用の `effect_key_coverage.json` とは別ファイルで管理し、将来統合できる `effects` / `targets` / `links` / `unlinked` 形式を使う。
「未確認」はマスター側の対象またはgcsimキー側の効果について、対応付け・理由付き対象外・保留のいずれも無い状態。

## gcsimキー（1120件）

| 分類 / 状態 | 件数 |
|---|---:|
| artifact / excluded | 56 |
| artifact / linked | 82 |
| burst / linked | 12 |
| character / linked | 4 |
| constellation / excluded | 57 |
| constellation / linked | 267 |
| skill / linked | 11 |
| system / linked | 8 |
| talent / excluded | 30 |
| talent / linked | 178 |
| weapon / excluded | 38 |
| weapon / linked | 377 |

## マスター対象（810件）

| 種別 / 状態 | 件数 |
|---|---:|
| artifact / linked | 52 |
| artifact / unsupported | 3 |
| constellation / linked | 238 |
| resonance / linked | 6 |
| resonance / unreviewed | 1 |
| talent / linked | 154 |
| talent / unsupported | 119 |
| weapon / linked | 217 |
| weapon / unsupported | 20 |

## links（976件）

| 関係 | 件数 |
|---|---:|
| cooldown | 137 |
| effect | 741 |
| extra | 91 |
| resonance | 7 |

## 保留（0件）

なし

## 未確認（1件）

- target resonance:electro: 現行辞書に対応キーが無い。gcsimが別経路で扱うか、対象外かを確認する

整合性: 孤立リンク 0件
