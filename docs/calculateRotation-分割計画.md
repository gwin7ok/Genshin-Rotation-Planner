# `calculateRotation` の分割計画

作成: 2026-10-17（最初のコードレビューの項目 #3）。**同じ日に、段階 0〜5 まで実施済み（下の「実施結果」）。**

## 実施結果（2026-10-17）

`src/utils/rotationCalculator.ts`: 2633 行 → **111 行**（`calculateRotation` は約 90 行。出場の準備・アクションごとの計算・出場の締め・後処理を、順に呼ぶだけ）。計算の中身は、`src/utils/rotation/` に分けた。**挙動は変えていない**（143 並びのスナップショット・各検査が、すべて一致）。

| ファイル | 内容 |
|---|---|
| `state.ts` | `RotationState`（計算中の状態の入れ物）と `createRotationState` |
| `context.ts` | `StintContext`（出場の間の値）・`ActionContext`（アクションの段階から次の段階への受け渡し） |
| `stintFlow.ts` | `beginStint`（出場の準備）・`finishStint`（出場の締め） |
| `actionFlow.ts` | `processAction`（1 アクションの流れ。下の段階を順に呼ぶ） |
| `modePhases.ts` | モードの判定・終わらせる／もう一度使う・ゲージと減る値 |
| `durationPhases.ts` | フレームの選択・所要時間（ヒットストップ）・計算済みアクションの組み立て |
| `cooldownPhases.ts` | CT の計算・CT の発動の登録・モードを開く・キャラ固有の規則 |
| `effectPhases.ts` | 特殊スキルの受付・効果バー・副次効果・時刻を進める |
| `stintParts.ts` / `postProcess.ts` / `loopWrap.ts` | 発動バフ・警告・2 周目の折り返し（持ち越し）など |
| `modeHelpers.ts` / `attackSpeed.ts` / `violations.ts` / `frameTables.ts` / `stockSpans.ts` / `cooldownCheck.ts` / `types.ts` | 補助の関数・表・型 |

- 段階 0: `check:snapshots` に、プリセット 5 編成・2 周目の折り返し（`loopStartIndex` 1〜3）・グループの並びを足した（130 → 143 並び。既存の 130 は不変）。
- 段階 5（アクションのループ）は、手で分けず、TypeScript の構文解析で、どの変数が段階をまたぐかを調べて機械的に分けた（段階をまたぐ変数 → `ActionContext`、出場をまたぐ変数 → `StintContext`、実行全体の値 → `RotationState`）。取りこぼしがあれば、型の検査とスナップショットで見つかる。
- 新しいキャラを足すときは、対応する段階のファイルだけを読めばよい（例: 受付の規則 → `cooldownPhases.ts` の `applySpecialRules`）。

---

## 以降は、実施前の計画（経緯として残す）

> 作成時点では、コードは変更していない前提で書いた。

対象: `src/utils/rotationCalculator.ts`（2633 行）の `calculateRotation`（186〜2235 行。約 2050 行の 1 関数）

## 1. なぜ分けるのか

- 新しいキャラ（モード・受付・夜魂値など）を足すたびに、この 1 関数に分岐が増えている。どこに何があるかを探すのが難しく、変更の影響範囲も読めない。
- 1 関数の中に、`ModeWindow` の型・約 30 個の補助の関数（クロージャ）・約 40 個の状態（Map・配列）が入っている。外から単独でテストできない。
- ただし、挙動は `check:snapshots`（130 並び）などで固められている。**この検査を物差しにして、挙動を変えずに構造だけを動かせる**状態にある。

分けること自体が目的ではない。**「新キャラを足すときに、読む範囲・触る範囲が小さくなる」** ことが目的。

## 2. 今の構造（行番号は 2026-10-17 時点）

| 区間 | 行 | 内容 |
|---|---|---|
| A. 準備 | 192〜483 | 入力の展開、`calculatedStints`・`activeBuffs`・`ctEvents` など約 40 個の状態、`ModeWindow` 型、モード・トーテム・ゲージの補助の関数（`endMode`・`drainAdvance`・`placePickedField` など） |
| B. 出場ごとのループ | 484〜1885 | `for (sIdx …)`。約 1400 行 |
| B-1. 出場の準備 | 485〜573 | キャラ・アクション定義の取得、特殊スキル・特殊爆発の受付の補助、交代時間（swap）の追加 |
| B-2. アクションごとのループ | 574〜1692 | `for (aIdx …)`。**約 1120 行。全体の 55%** |
| B-3. 出場の締め | 1693〜1885 | モードの維持、モードの終わり方、交代の CT、発動バフ（固有天賦）・副次効果、`calculatedStints` への追加 |
| C. 後処理 | 1886〜2235 | モードの締め、`totalDuration`、検査（落下攻撃の前提など）、`checkCooldownViolations`（CT 違反）、祭礼の発動、2 周目の折り返し（持ち越し）、バフ重なり、返り値 |

### B-2（アクションごとのループ）の内訳

| 行 | 段階 | 内容 |
|---|---|---|
| 575〜660 | 1. モードの判定 | 今のアクションが、モードを開く・終わらせる・再押しするか、ブロックされるか |
| 657〜847 | 2. 受付・ゲージ | 特殊スキルの受付（ファルカ）、延長、夜魂値・ゲージ（カチーナ・キィニチ） |
| 848〜1036 | 3. フレームと所要時間 | 通常攻撃の段、モード専用フレーム、ヒットストップ、`autoDuration` |
| 1037〜1098 | 4. 実行結果の確定 | 長押し、`duration`、`actionEndTime`、`computedAction` の組み立て |
| 1099〜1172 | 5. 層・CT の計算 | 層が溜まる効果（ヴェスナ）、外部（gcsim）の CT 待ち、`cooldown`・`ctOffset` |
| 1173〜1304 | 6. CT のイベント登録 | `ctEvents.push`（CT 違反の検査の入力） |
| 1305〜1569 | 7. キャラ固有の後処理 | 八重神子・ヴァレサ、モードを開く、特殊爆発・受付の閉じ方、CT 短縮 |
| 1570〜1692 | 8. 効果バーの生成 | 効果バー、殺生桜・炎場、領域、副次効果、アクション後の遅延 |

## 3. 分割の方針

### 3-1. 方針 1: 状態を 1 つの入れ物にまとめる（`RotationState`）

今は、約 40 個の状態が関数のローカル変数で、補助の関数がそれを直接閉じ込めている（クロージャ）。これを分けるには、状態を 1 つのオブジェクトにして、各部分に渡す必要がある。

```ts
interface RotationState {
  rawStints: Stint[]; characterMap: Map<string, CharacterConfig>; switchDelay: number; loopStartIndex: number;
  currentTime: number;
  calculatedStints: Stint[]; activeBuffs: ActiveBuffSpan[]; skillCooldowns: CooldownSpan[]; burstCooldowns: CooldownSpan[];
  passiveSpans: PassiveSpan[]; validationIssues: ValidationIssue[]; ctEvents: CooldownEvent[];
  modeWindows: Map<string, ModeWindow>; retiredModes: ModeWindow[];
  // …（ByChar の Map 群、トーテム、夜魂値）
}
```

- **挙動を変えない**ために、最初は「変数を、そのまま入れ物のプロパティに置き換える」だけにする（機械的な置換）。
- `ModeWindow` など、関数の中で定義されている型は、モジュールの先頭（または別ファイル）へ出す。

### 3-2. 方針 2: ファイルを分ける（案）

```
src/utils/rotation/
  types.ts            RotationState・ModeWindow・CooldownEvent など
  modeHelpers.ts      endMode・drainAdvance・drainProject・modeMaxUses など（状態を引数に取る）
  actionFrames.ts     3. フレームと所要時間（hitlagFor・通常攻撃の段）
  actionCooldown.ts   5〜6. CT の計算とイベント登録
  characterRules.ts   7. キャラ固有（八重神子・ヴァレサ・ファルカなど）
  effectBars.ts       8. 効果バーの生成
  stintFinish.ts      B-3. 出場の締め
  loopWrap.ts         C. 2 周目の折り返し（wrapTotems・wrapEffect・持ち越し）
  cooldownCheck.ts    checkCooldownViolations（今も別関数）
rotationCalculator.ts  公開の関数 calculateRotation（組み立てだけ）
```

- 公開の入口（`calculateRotation`・型）は変えない。呼び出し側（`App.tsx` など）は無変更。
- 既に別関数になっている `buildStockSpans`・`buildBuffOverlapSegments`・`wrapTotems`・`endAtNextStart`・`checkCooldownViolations` は、最初に移せる（低リスク）。

### 3-3. 方針 3: アクションのループは「段階の関数」に分ける

B-2 は、1 アクションの計算が、前の段階の結果（例: `frames`・`duration`）を次に使う、直列の流れ。これを、段階ごとの関数に分け、途中の結果を `ActionContext`（1 アクション分の入れ物）で受け渡す。

```ts
for (const act of rawActions) {
  const ac = beginAction(state, stintCtx, act);        // 1. 開始・モードの判定
  applyWindowsAndGauges(state, stintCtx, ac);          // 2. 受付・ゲージ
  resolveFramesAndDuration(state, stintCtx, ac);       // 3. フレーム・所要時間
  commitAction(state, stintCtx, ac);                   // 4. computedAction の確定
  computeCooldown(state, stintCtx, ac);                // 5〜6. CT
  applyCharacterRules(state, stintCtx, ac);            // 7. キャラ固有
  buildEffectBars(state, stintCtx, ac);                // 8. 効果バー
}
```

- 段階の境目は、2 節の表の行番号が目安。実際には、段階をまたいで使う変数（`frames`・`hitlagFrames`・`modeEnder` など）を、`ActionContext` に先に出す作業が最初に要る。

## 4. 進め方（段階とリスク）

**各段階で、必ず次を実行し、すべて一致してから次へ進む。挙動を変えない。1 段階ごとにコミット（ユーザーが行う）。**

- `npm run check:snapshots`（130 並び。差があれば、構造の変更が原因なので、その場で戻す）
- `npm run lint`（`tsc`）
- 段階 3 以降は、あわせて `npm run check:hitlag`・`npm run check:sacrificial-seed`（gcsim サーバーが要る）・`npm run check:groups`・`npm run check:cooldown-log`

| 段階 | 内容 | 変更量 | リスク |
|---|---|---|---|
| 0 | **検査を増やす**（先に）。次の 5 節 | 小 | 無し |
| 1 | 型の移動（`ModeWindow` ほか）・既に別関数のもの（`buildStockSpans` など）を別ファイルへ | 小 | 低。移動のみ |
| 2 | 後処理 C（2 周目の折り返し・祭礼・バフ重なり）を、関数にして別ファイルへ。入力・出力が、はっきりしている | 中 | 低〜中。入力の取りこぼしに注意 |
| 3 | 出場の締め B-3 を関数にする | 中 | 中 |
| 4 | `RotationState` を導入し、準備 A の補助（`endMode` など）を、状態を引数に取る関数にして移す | 大 | 中。クロージャの変数の取りこぼし。`tsc` が検出する |
| 5 | アクションのループ B-2 を、段階 8 → 1 の順に（後ろのほうが独立しているので）、`ActionContext` を使って分ける | 大 | **高**。段階をまたぐ変数が多い。1 段階ずつ |
| 6 | キャラ固有（7）を、データ駆動に寄せるか検討（既に `mode` / `special` などの定義がある。分岐を定義に移せるものは、別の設計の話） | — | 別計画 |

- 段階 5 が最も重い。**段階 4 までを先に終えて**、効果を見てから続けるか決める。
- 段階 5 は、1 回の作業で終わらせず、「段階 8 だけ」「段階 6 だけ」のように、小さく区切る。

## 5. 段階 0（先にやること）: 検査の穴を埋める

`check:snapshots` は、特定のキャラ・並びが中心。分割で壊れやすいのは、**キャラの組み合わせと 2 周目の折り返し**。分割の前に、次を足すと安全になる。

1. 同梱のプリセット 5 編成の計算結果を、スナップショットに追加する（今は、プリセットが対象外。`totalDuration`・持ち越し・CT・バーの並びが一致すること）。
2. 2 周目の折り返し（`loopStartIndex` が 0 以外）の並びを、数件追加する。
3. 出場が長い並び・グループ化したアクション（`expandGroupedStints`）を含む並びを、数件追加する。

→ 追加の見積り: スクリプト 1 つの更新と、保存結果の更新（`--update`）。**追加した直後の保存結果は、今のコードの結果なので、必ず現状と一致する（検査の基準を作る作業）**。

## 6. やらないこと・注意

- **挙動の変更**（CT の許容値・丸めなど）は、分割と同時にしない。別のコミット・別の作業にする（#4 の調査で、現状維持と決めた）。
- 分割の途中で、キャラの追加・修正をしない（差分が混ざって、原因が分からなくなる）。
- 公開の関数・型の名前・引数は変えない（`App.tsx`・`GanttChart.tsx`・各種スクリプトが使っている）。
- 名前ではなく ID で扱う規則（CLAUDE.md）は、そのまま守る。

## 7. 判断してほしいこと

1. **やるかどうか**: すぐに困っている症状はない。新キャラを足す頻度が高いなら、段階 1〜4 までを先にやる価値がある。
2. **ファイルの置き場所**: `src/utils/rotation/` の新しいフォルダでよいか。
3. **範囲**: 段階 5（アクションのループ）まで含めるか、段階 4 までで止めるか。

## 8. 見積り（目安）

| 範囲 | 作業のまとまり | 備考 |
|---|---|---|
| 段階 0 | 小 | 先にやる |
| 段階 1〜2 | 小〜中 | 効果は小さいが、安全 |
| 段階 3〜4 | 中〜大 | ここまでで、読みやすさが大きく変わる |
| 段階 5 | 大 | 1 段階ずつ。最後 |
