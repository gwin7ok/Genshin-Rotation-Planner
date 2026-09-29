# フェーズ3f 計画: 落下攻撃（LP / HP）のアクション追加

関連決定: D48（この計画の決定）、D25・D26（アクションの整理）、D13（IDキー）、D22（変換の対応表）
前提フェーズ: 3d・4（完了）。フェーズ5の次の段階（5-2a）の前に実施する

## 目的

現状、落下攻撃がマスターのアクションとして無い。gcsim のフレーム（`plunge.go`）から、落下攻撃を新種のアクションとして追加する。

## 調査結果（2026-09-29）

- **アプリの現状**: `ActionType` に `'plunge'`（PA）があり、`rotationCalculator.ts` の `cancelKeyOf` は `plunge` を `lowPlunge` に対応付けている。DB管理のカスタムアクションの種類にも「落下 (PA)」がある。マスターの生成（`characterMasterGenerator.ts`）は落下攻撃を作らない。`gcsimParser.ts` は、他のアクションから落下攻撃へのキャンセル（`lowPlunge` / `highPlunge`）は読める。
- **gcsim のソース**: `internal/characters/<キー>/plunge.go` があるのは 55 キャラ。`low_plunge`（`lowPlungeFrames`）と `high_plunge`（`highPlungeFrames`）は別のフレーム表で、`frames.InitAbilSlice(全体)` ＋ `xxxFrames[action.ActionYyy] = n` の形（既存パーサーで読める）。
  - 低のみ: チャスカ・イファ・放浪者・千織。高のみ: ウェンティ。旅人は別の書き方（実装時に確認）。
  - 定義が無いキャラは、`not implemented` のエラーになる（gcsim では実行不可）。
- **前提条件（空中状態）**: 55 キャラのうち 46 キャラの `plunge.go` は `Airborne()` が `AirborneXianyun` のときだけ実行できる（「low_plunge can only be used while airborne」）。他は、直前のアクションに条件がある（ウェンティ: E の直後、アルハイゼン・千織: 長押し E の直後、ガミング: E の直後、楽十: 低は E の直後は不可・高は長押し E の直後など、魈: 仙人の空中バフ）。
- **実測**（利用者のローカル gcsim サーバーで `/sample` を実行）: 香菱の `jump` → `low_plunge`、`attack` → `low_plunge`、閑雲の爆発 → 香菱の `low_plunge` は、いずれも「low_plunge can only be used while airborne」のエラー。楽十の `skill[hold=1]` → `high_plunge` は成功（フレーム 71 に実行、全体 61）。この gcsim のソースを検索した範囲では、`Airborne` を地面以外にする呼び出しが見つからなかった。したがって、多くのキャラの落下攻撃は、現状の gcsim では実行できない可能性が高い。
- **アプリ側のフレーム**: 落下攻撃の所要時間は、その落下攻撃のフレーム表の「次のアクションへのキャンセル」（他のアクションと同じ規則）。空中に上がる時間は、直前のアクション（長押し E など）のフレームに含まれる。

## 決定事項（D48, 2026-09-29）

1. **ボタン構成**: 低・高の 2 つ（**LP** / **HP**）。gcsim に定義があるものだけ出す。
2. **対象キャラ**: gcsim に `plunge.go` がある 55 キャラだけ。定義が無いキャラには出さない（仮値は作らない）。
3. **前提条件**: アプリでは制限しない（自由に置ける）。gcsim 変換時に警告し、gcsim 実行のエラー（フェーズ6）をユーザーに知らせる。前提条件の規則辞書は作らない。
4. **型**: `ActionType` を `plunge_low` / `plunge_high` に分ける（`skill` / `skill_hold` と同じ流儀）。既存の `plunge` は廃止して、DB管理のカスタムアクションの種類も 2 つにする（未リリースなので旧データは考慮しない）。

## 作業内容

1. **型**: `ActionType` に `plunge_low` / `plunge_high` を追加し、`plunge` を廃止。`rotationCalculator.ts` の `cancelKeyOf` を `plunge_low` → `lowPlunge`、`plunge_high` → `highPlunge` にする。
2. **マスター生成**: `plunge.go` を取得（`GCSIM_FILES` に追加）し、`lowPlungeFrames` / `highPlungeFrames` から、アクション `<キャラID>_lp`（名前「落下攻撃(低)」、`LP`）・`<キャラID>_hp`（名前「落下攻撃(高)」、`HP`）を生成する。所要時間の既定は全体フレーム、`frames` に全体・キャンセル・ヒットマークを持つ。旅人の書き方は実装時に確認する。定義が無いキャラは何も出さず、レポートに一覧を出す。
3. **変換**（`src/utils/gcsim/actionMapping.ts`）: 末尾 `lp` → `low_plunge`、`hp` → `high_plunge`。フェーズ4の計画書の対応表を更新する。変換時の警告: 落下攻撃を含むとき「gcsim は空中状態の前提条件があり、実行できない場合がある」。
4. **UI**: 追加ボタン・ガントチャートのブロックの色・DB管理の種類の選択肢に、LP / HP を反映する。
5. **DB バージョン**を上げ、マスターを再生成する。

## 完了条件

- 楽十・ウェンティ（HP のみ）・チャスカ（LP のみ）などで、追加ボタンに LP / HP が出る。定義が無いキャラには出ない。
- LP / HP の所要時間が、次に続くアクションに応じて変わる（他のアクションと同じ規則）。
- 「gcsim設定文をコピー」で `low_plunge` / `high_plunge` が出力され、`/validate` を通る。
- 楽十の `skill[hold=1]` → `high_plunge` の編成で、gcsim を実行できる（実測済みの条件）。
- 型チェック・ビルドが通り、マスターの再生成と登録の後、ブラウザで確認済み。

## 影響範囲

- 型（`ActionType`）、マスター生成、`rotationCalculator.ts`、`actionMapping.ts`、DB管理、追加ボタンの一覧。
- 既存の N・E・Q の計算・表示には影響しない。

## 未確認・リスク

- gcsim の前提条件（空中状態）は、この gcsim のバージョンでは満たせないキャラが多い。アプリでは置けるが、フェーズ6で gcsim を実行するとエラーになる。フェーズ6のエラー表示・部分実行の方針は、フェーズ6で決める。
- 旅人の落下攻撃のフレームの書き方は、実装時に確認する。
