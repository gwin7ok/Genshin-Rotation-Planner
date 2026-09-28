# フェーズ3b 計画: キャラの凸数（命ノ星座）

関連決定: D13（IDキーの原則）、D15（凸のデータ構造と範囲）
前提フェーズ: フェーズ2（IDキーの原則・プリセット削除）
後続フェーズ: フェーズ4（gcsim 設定文の `cons=<凸数>` に使う）

## 目的

- キャラのマスターデータに、命ノ星座の段階（1〜6凸）ごとの情報を持たせる。
- 編成画面のキャラカードで凸数を選べるようにする（初期値: 星4キャラは6凸、星5キャラは0凸）。
- 武器の精錬ランクと同じ構造（マスターデータに段階ごとのデータ／編成は番号だけ／解決役のモデルクラス）にする。
- gcsim 連携（フェーズ4）で凸数を gcsim に渡せるようにする。

## 現状（2026-09-28 調査）

| 項目 | 状態 |
|---|---|
| 編成の凸数 | `CharacterConfig.constellation` は型にあるが、設定する画面が無く、値も入っていない（キャラの登録し直し `stintReorder.ts` で引き継ぐ処理だけある） |
| マスターデータの凸の情報 | 生成時（`characterMasterGenerator.ts`）に genshin-db の `constellations`（日本語、c1〜c6 の名前・説明文）を取得しているが、保存していない |
| 凸による違い | 「効果時間が延びる」凸だけ、確認済み規則（`constellationEffects.ts` の `VERIFIED_RULES`、11キャラ）で「元素爆発: 旋火輪 (4凸)」のような**別アクション**（ID 例: `10000023-pyro_q_c4`）を追加している。凸数とは連動せず、利用者がアクションを選び分ける形 |
| 名前の使用（D13 との関係） | genshin-db の凸データをキャラの**名前**で突き合わせている（`applyConstellationVariants` の `byName`）。確認済み規則の見出しが「キャラ名_c凸数」（例: `'香菱_c4'`） |
| レアリティ | マスターデータの `rarity`（星4: 51人、星5: 76人）で初期値を決められる |

### 参考: 武器の精錬ランクの構造

1. マスターデータ: `WeaponDatabaseItem.refinements`（R1〜R5 の配列 `WeaponRefinementData[]`）
2. 編成: `CharacterConfig.weaponRefinementRank`（番号だけ）
3. 解決役: `WeaponModel`（番号に対応するデータを返す。番号が無ければ星5=1、星4以下=5 を既定値にする）

**凸との違い**: 精錬は「その段階のデータだけ」を使うが、凸は**累積**（3凸なら1〜3凸の効果をすべて重ねる）。

## 範囲（D15: 案a）

- 全キャラの1〜6凸の**名前と説明文**を保存し、画面に表示する。
- 数値として構造化するのは、今ある「**効果時間の延長**」（確認済み規則の11キャラ）だけ。
- CT短縮・使用回数の追加・新しい発動バフなどは構造化しない（説明文の表示のみ）。gcsim は凸数を渡せば全凸効果を自前で計算するため、gcsim 連携後はアプリ側での数値化がほぼ不要。

## 作業内容

### 3b-1. データ構造（型）

- 新しい型（`src/types/genshin.ts`）:
  ```ts
  /** 命ノ星座の1段階（マスターデータ） */
  interface CharacterConstellationData {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    name: string;
    description: string;
    /** この段階で変わるアクションの値（案a では効果時間の延長のみ） */
    actionChanges?: ConstellationActionChange[];
  }
  interface ConstellationActionChange {
    actionId: string;        // 変わるアクションの定義 ID（例: "10000023-pyro_q"）
    effectDuration?: number; // 変更後の効果継続時間（秒）
    source?: string;         // 根拠の説明文の抜粋
  }
  ```
- `CharacterConfig` に `constellations?: CharacterConstellationData[]`（マスターデータ）を追加。
- 編成の凸数は既存の `constellation?: number`（0〜6）を使う。

### 3b-2. マスターデータの生成

- `characterMasterGenerator.ts`: genshin-db の凸データを、キャラごとに `constellations`（1〜6凸の名前・説明文）として保存する。
  - 突き合わせ: genshin-db の凸データが ID を持つなら ID で突き合わせる。持たない場合は外部データとの突き合わせとして名前を使う（D13 の例外。計画書の完了条件と同じ扱い）。作業時に確認する。
- `constellationEffects.ts`:
  - 別アクション（`_c<凸>`）の追加をやめ、該当段階の `actionChanges` に `{ actionId, effectDuration }` を入れる形に変える。
  - 確認済み規則（`VERIFIED_RULES`）と対象外一覧（`NOT_APPLICABLE`）の見出しを「キャラ名_c凸数」から「キャラID_c凸数」（例: `'10000023-pyro_c4'`）に変える（D13）。
  - レポート（追加・未確認・エラー）は今の内容を保つ。
- マスターデータを再生成する（`npm run build:master`）。差分が「`constellations` の追加」と「11キャラの別アクションの削除」だけであることを確認する。
- DB のバージョン（`src/data/databaseMaster.ts` の `DATABASE_VERSION`）を上げ、保存DBのキャラが新しいマスターに置き換わるようにする（既存の方針「データ構造を更新したら上げる」。ロック中・カスタムのキャラは保護される）。

### 3b-3. 解決役 `CharacterModel`

- 新規 `src/models/CharacterModel.ts`（`WeaponModel` と同じ役割）:
  - `constructor(data: CharacterConfig, constellation?: number)`。凸数が無ければ既定値（星4=6、星5=0。それ以外・不明は0）。
  - `constellation`: 有効な凸数（0〜6）
  - `activeConstellations`: 凸数以下の段階の一覧（表示用）
  - `actions`: `availableActions` に、凸数以下の段階の `actionChanges` を**累積で**適用したもの（同じアクションに複数段階の変更があれば、段階の大きい方が勝つ）
  - `passiveEffects`: 今は元のまま（案a）
  - 既定値の関数（例: `defaultConstellation(rarity)`）を公開し、編成画面の初期値と共通にする。
- アクションの定義を引いている箇所を、`CharacterModel` の `actions` を使う形にそろえる:
  - `src/utils/rotationCalculator.ts`（`char.availableActions.find(...)` で CT・効果時間を取得）
  - `src/components/StintSequenceEditor.tsx`（アクション一覧のボタン、アクション定義の参照）
  - `src/utils/characterActions.ts`（CT の表示）
  - DB管理画面（`DatabaseManagerModal.tsx`）はマスターデータそのものを編集する画面なので、凸を適用しない元のデータを使う。
- 「(n凸)」ラベルの処理（`characterActions.ts` の `constellationTag`）は、別アクションが無くなるため削除する。

### 3b-4. 編成画面

- `PartyConfigModal.tsx` のキャラカード（SLOT 1〜4）の右下に、凸数の選択（0凸〜6凸）を追加する。
- キャラを選んだとき（`handleSwapCharacter`）に、凸数の初期値を `defaultConstellation(rarity)` で設定する（武器を選んだときの精錬ランクの初期値と同じ扱い）。
- 選択中スロットの設定欄に、凸の説明を表示する（1〜6凸を並べ、選んだ凸数までの段階を有効として強調。武器の効果説明の表示にそろえる）。
- 未設定スロット・カスタムキャラ（凸データなし）の扱い: 未設定スロットは選択を出さない。カスタムキャラは選択は出すが説明は「凸データなし」。

### 3b-5. gcsim 連携への受け渡し

- フェーズ4の設定文の `<key> char ... cons=<凸数>` に、`CharacterModel` の凸数（未設定なら既定値）を使う。フェーズ4の計画に記載済みの項目と対応させる。

## 完了条件

- マスターデータの全キャラ（凸データのある公式キャラ）が1〜6凸の名前・説明文を持つ。
- 11キャラの「効果時間の延長」が、別アクションではなく凸数に連動して反映される（例: 香菱を4凸以上にすると旋火輪の効果時間が延び、3凸以下では延びない）。
- 編成画面のキャラカードで凸数を選べ、キャラを選んだときの初期値が星4=6凸・星5=0凸になる。設定欄に凸の説明が出る。
- 確認済み規則の見出しが ID キーになっている。
- 型チェック・ビルドが通り、ブラウザで確認済み。

## 影響範囲

- マスターデータ（キャラ）、DB のバージョン、時間計算（アクションの効果時間）、出場ごとの操作画面（アクション一覧から「(n凸)」の別アクションが無くなる）、編成画面。
- 既存の保存データで「(n凸)」の別アクションを使っている出場は、アクション定義が見つからなくなる（D13: 保存データは作り直すため移行しない）。
