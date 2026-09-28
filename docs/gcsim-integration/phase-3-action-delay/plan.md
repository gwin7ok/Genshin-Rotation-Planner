# フェーズ3 計画: アクション遅延のアクションごとの個別化

関連決定: D6（アクションごとに個別の値を持たせ、gcsim の `delay` で入れる。アプリ側の一律挿入は撤廃）

## 目的

アクション遅延（人の操作の間）を、編成全体で1つの値ではなく、**アクションごと**に設定できるようにする。gcsim 変換時は、各アクションの後に `delay(<フレーム数>)` として出力する（フェーズ4）。

## 現状

- `actionDelay`（秒, 既定 0.10）は編成全体で1つの値。
  - 状態: `src/App.tsx`（`useState`、保存データ・プリセット・スロットに保存）
  - 計算: `src/utils/rotationCalculator.ts` の `calculateRotation` のオプションとして、アクションの間に一律で挿入
  - 表示・編集: `GanttChart.tsx`, `StintSequenceEditor.tsx`, `SaveLoadModal.tsx` などに受け渡し
- ループ開始点の計算（`resolveLoopStartIndex`）にも渡されている。

## gcsim 側の仕様（調査済み）

- `delay(n)`: 直前のアクションが**終わった後**、次のアクションの開始を n フレーム遅らせる。
- `sleep(n)`（旧 `wait`）はアクションのキャンセル可能時点から数えるため、遅延の用途には使わない。

## 作業内容

1. `CharacterActionInstance` に `delayAfter?: number`（秒）を追加する。
2. 時間計算（`rotationCalculator.ts`）で、一律の `actionDelay` の代わりに各アクションの `delayAfter` を使う。
3. アクションごとの遅延を編集するUIを追加する（出場ごとの操作画面 `StintSequenceEditor.tsx` のアクション詳細付近を想定）。
4. 一律の `actionDelay` の設定・状態・保存項目を撤廃する。
5. 保存データの移行: 既存の `actionDelay` をどう各アクションに引き継ぐかを決めて実装する（下の検討事項）。
6. プリセット（`src/data/presets.ts`）の `actionDelay` の扱いを合わせる。

## 検討事項（作業時に決める）

- 移行方針: 既存の `actionDelay` の値を全アクションの `delayAfter` にコピーする（時間が変わらない）か、既定値 0 にするか。
- 新しく追加したアクションの `delayAfter` の既定値。
- 交代（swap）アクションの後の遅延を別扱いにするか（交代遅延 `switchDelay` とは別物）。

## 完了条件

- アクションごとに遅延を設定でき、ガントチャートの時間に反映される。
- 一律の遅延設定がUI・状態・保存データから無くなっている。
- 既存の保存データを読み込んでも、移行方針どおりの時間になる。
- 型チェック・ビルドが通り、ブラウザで確認済み。

## 影響範囲

- 時間計算、出場ごとの操作画面、保存データ、プリセット。
