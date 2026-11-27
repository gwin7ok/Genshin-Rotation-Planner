# Phase 0 知識辞書 品質監査レポート

- 監査対象: KNOWLEDGE 136 キャラ / マスター 136 キャラ
- 検出合計: 8 件（error: 0 件 / warn: 8 件）

## 種別サマリー

| 種別 | 件数 | 重大度 |
| :--- | ---: | :--- |
| `wrong-character` | 0 | warn |
| `inline-closing-bug-risk` | 0 | warn |
| `invalid-action` | 0 | warn |
| `duplicate-shape` | 0 | warn |
| `bad-first-entry` | 0 | warn |
| `four-star-high-constellation` | 6 | warn |
| `excessive-stints` | 2 | warn |
| `excessive-length` | 0 | warn |
| `bloat-or-sparse` | 0 | warn |

## four-star-high-constellation（6 件）

- **ファルザン** (`10000076-anemo`) [#4: Q（KQM）]: 星4キャラに constellation.min=6 が付いています（KQMの6凸偏りによる誤制限か要確認）
- **凝光** (`10000027-geo`) [#2: E→Q→E→重撃]: 星4キャラに constellation.min=6 が付いています（KQMの6凸偏りによる誤制限か要確認）
- **ドリー** (`10000068-electro`) [#3: Q→E のあと N2D 連打（完凸雷付与ドライバー）]: 星4キャラに constellation.min=6 が付いています（KQMの6凸偏りによる誤制限か要確認）
- **シュヴルーズ** (`10000090-pyro`) [#3: Q→長押しE×3（4凸CTリセット）]: 星4キャラに constellation.min=4 が付いています（KQMの6凸偏りによる誤制限か要確認）
- **藍硯** (`10000108-anemo`) [#1: E×2 のあと、もう一度 E×2]: 星4キャラに constellation.min=6 が付いています（KQMの6凸偏りによる誤制限か要確認）
- **藍硯** (`10000108-anemo`) [#2: E×2→Q のあと、もう一度 E×2]: 星4キャラに constellation.min=6 が付いています（KQMの6凸偏りによる誤制限か要確認）

## excessive-stints（2 件）

- **ヌヴィレット** (`10000087-hydro`) [#2: E → CA→Q→E→CA → CA×2（雫4重撃）]: 1周に 3 回出場する形です（不自然な細切れ出場の原因になりやすい）
- **ヌヴィレット** (`10000087-hydro`) [#3: E → CA→E→CA→Q → CA×2（KQM最多33%）]: 1周に 3 回出場する形です（不自然な細切れ出場の原因になりやすい）
