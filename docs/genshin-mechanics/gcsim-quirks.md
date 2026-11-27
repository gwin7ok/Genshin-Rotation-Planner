# gcsim 変換・シミュレーション特有の仕様とエラーの罠一覧

- 関連コード: `src/utils/gcsim/buildGcsimConfig.ts`, `src/utils/gcsim/actionMapping.ts`, `src/utils/gcsim/chargeRules.ts`, `src/utils/plungePrerequisites.ts`, `src/utils/rotationSearch/evaluate.ts`, `src/utils/rotationSearch/search.ts`
- 目的: アプリ内部のアクション記法を gcsim 設定へ変換して実行する際、**実行時 `ERROR` で候補が全滅したり、不自然な数値が出たりする既知の罠**を一覧化し、今後の新キャラ追加・ロジック改修時の再発を防ぐ。

---

## 1. `ca`（重撃 / 狙い撃ち）の `aim` vs `charge` 変換の罠

| ケース | gcsim コマンド | 罠・エラー内容 | 対策（アプリ側仕様） |
| :--- | :--- | :--- | :--- |
| **タルタリヤ（弓 ⇔ 双剣）** | 弓モード: `aim`<br>双剣モード: `charge` | 一律 `aim` にすると双剣中に `aim called when not in ranged stance` で 100% クラッシュ。逆に弓モードで `charge` を呼ぶと `charge called when not in melee stance`。さらに双剣中の `charge` 直前に `attack` が無いと `need to use attack right before charge`。 | `buildGcsimConfig.ts` で交代時に `inMelee = false` リセット、`e` 毎にトグルして出し分け。`chargeRules.ts`（`CHARGE_REQUIRES_ATTACK`）と `evaluate.ts` で双剣中の裸 `ca` を事前除外。 |
| **一般の近接キャラ**（片手剣・長柄等） | `charge` | gcsim 仕様上、多くの近接キャラは直前に `attack`（`n`）を挟まずに単独 `charge` を撃つと `need to use attack right before charge` でエラーになる。 | `CHARGE_REQUIRES_ATTACK` で事前チェック（`evaluate.ts` の `chargeViolation`）。 |
| **弓キャラ全般**（甘雨・ティナリ・リネ・九条裟羅・チャスカ・セトス等） | `aim`（または `aim[...]`） | 弓キャラの `ca` は `aim` に変換されるため、直前の `n` は不要。ただし `aim[hold=N]` 等の特殊チャージ仕様を持つキャラがある。 | 弓キャラは `CHARGE_REQUIRES_ATTACK` 対象外（タルタリヤ双剣のみ例外扱い）。 |
| **法器・特殊重撃キャラ**（ヌヴィレット・サンドローネ等） | `charge` / `ca_beamsN` | サンドローネは `ca_beams1`〜`ca_beams6` のように派生アクションIDが分かれている。 | 辞書登録時は必ず `characters_master_data.json` の `availableActions` に存在するアクションキーのみを使用（`check-knowledge-quality.ts` の `invalid-action` で検証）。 |

---

## 2. 落下攻撃（`lp` / `hp`）の前提エラー

- gcsim では、滞空・ジャンプ手段がない状態で `low_plunge` / `high_plunge` を呼ぶと実行エラーになる。
- **前提を満たすケース**（`src/utils/plungePrerequisites.ts` / `src/data/plungeRules.ts`）：
  1. 自力で跳躍するスキル直後：楓原万葉 `e`/`e_hold` → `hp`、アルハイゼン `e_hold` → `lp`、嘉明 `e` → `lp`/`hp`、ヴァレサ `e` → `lp`/`hp`、閑雲 `e` → `lp`/`hp`。
  2. 跳躍バフ中：魈 `Q` 中、または **閑雲 `Q` 効果時間中** の `jump` → `hp`/`lp`。
- これら以外のキャラに `hp`/`lp` を混ぜると全滅するため、辞書・近傍ともに `availableActions` と前提チェックを必ず通す。

---

## 3. 長押しスキル（`e_hold` / `e_shorthold`）と派生スキル

- **KQM パーサーの注意点**：gcsim 設定では `skill[hold=1]` だけでなく `skill[hold=15]`・`skill[hold=60]` のようにフレーム数が入るキャラ（早柚・シャルロット・綺良々・申鶴・鍾離・旅人風/水等）が多い。パーサーは `/\bhold\s*=\s*([1-9]\d*)/` で正の数値すべてを `e_hold` として扱う。
- **モード保持アクション（`modeHoldAction.ts`）**：早柚の `hE(8.85s)` のように保持秒数が可変のスキルは、保持時間が長すぎると次周の CT・エネルギーが破綻する。
- **派生アクションキー**：フリンズ（`e_spearstorm`, `q_special`）、ファルカ（`e_specialskill`）、マーヴィカ（`e_recastframestobike`, `e_recastframestoring`）、フィッシュル（`e_recast`）など、通常の `e`/`q` と別IDを持つキャラは `availableActions` との整合を必ず確認する。

---

## 4. `truncated`（打ち切り）と `energyWaits`（`endFrame` 非進行の罠）

- **最も危険な gcsim 集計の罠（Phase 2 で解決済み）**：
  - `dpsCalc.ts` の `summarizeDamage` は、`could not execute burst`（エネルギー不足による棒立ち待機）のフレームで `endFrame` を進めない仕様になっている。
  - そのため、**2周目で爆発が溜まらず 119 秒間棒立ちしてシミュレーション時間切れ（`truncated`）になった破綻ローテーションでも、「1周目（開始満タン）のダメージ ÷ 約20秒」で高 DPS に見えてしまう**。
- **不変の対策**：
  - 自動探索では必ず `computeDps` に `loops` を渡し、`out.result.truncated` を検知して強ペナルティ（`× 0.35 * ratio`）を掛ける。
  - `energyWaits`（1周あたり待ち秒数）も `rankScoreOf` に必ず組み込む。

---

## 5. 新キャラ追加・探索不具合調査時のクイックチェックリスト

ある編成で「探索 DPS が異常に低い（10k〜20k台）」「候補が 0 件になる」「不自然なローテが 1 位になる」ときは、以下の順番で切り分ける：
1. **プローブ実行（`scripts/probe-rotation.ts`）で王道ローテを 1 回直実行**し、gcsim が `ERROR:` を吐いていないか確認（タルタリヤ `aim`/`charge` 型バグの即発見）。
2. **`energyWaits` と `truncated`、およびビルドの ER・聖遺物（`undefined` でないか）** を確認（国際タルタリヤ仮値ビルドの聖遺物未装備・バッテリー渡し不足の即発見）。
3. **監査実行（`node scripts/check-knowledge-quality.ts --strict`）** で、該当4キャラの辞書に肥大化・先頭汚染・不要な凸制限が無いか確認。
4. **パイプライン脱落トレース**（`knowledgeSeeds` → `evaluate` → `stage1` → `山登り` → `rankScoreOf`）でどの段で王道ローテが落ちたかを特定。