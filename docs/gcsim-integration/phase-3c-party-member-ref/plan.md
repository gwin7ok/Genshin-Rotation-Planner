# フェーズ3c 計画: 編成のキャラを ID 参照にする

関連決定: D13（IDキーの原則）、D16（編成のキャラの持ち方: 案B）
前提フェーズ: フェーズ3b（凸数）
後続フェーズ: フェーズ4（gcsim 設定文への変換は、この形の編成を入力にする）

## 目的

編成のキャラを「マスターデータの丸ごとのコピー」ではなく、**キャラの ID と編成ごとの設定だけ**で持つ。キャラのデータ（名前・アクション・固有天賦・凸データなど）は、表示や計算のたびに DB から引く。

- マスターデータの更新（凸データの追加など）が、編成に**すぐ反映**される（「全パーティメンバーをマスターデータで再登録」が不要になる）。
- 武器・聖遺物（ID で参照）と同じ持ち方になり、IDキーの原則（D13）に一致する。

## 背景（2026-09-28）

- 編成でキャラを選ぶと、DB のキャラを丸ごとコピーして持つ（`PartyConfigModal.tsx` の `handleSwapCharacter` で `...newRosterChar`）。
- そのため、フェーズ3bで凸データ付きのマスターデータに更新した後も、それ以前に選んだキャラは凸データを持たず、編成画面で「凸データなし」と表示され、凸による効果時間の延長も計算に反映されなかった。
- 対処として「全パーティメンバーをマスターデータで再登録」（`stintReorder.ts` の `refreshCharactersFromDatabase`）があるが、マスターデータを更新するたびに利用者の操作が要る。

## 持ち方（案）

```ts
/** 編成の1枠（保存データ） */
interface PartyMember {
  characterId: string;            // DB のキャラ ID（未設定枠は empty_slot_<n>）
  constellation?: number;         // 凸数
  weaponId?: string;              // 武器 ID
  weaponRefinementRank?: number;  // 精錬ランク
  artifactSetId?: string;         // 聖遺物セット ID
  artifactSetMode?: ArtifactSetMode;
  energyRecharge?: number;        // 元素チャージ効率（編成ごとの値。今の CharacterConfig から移す）
}
```

- 状態・保存データ（現在の編成、保存スロット、JSON 書き出し）は `PartyMember[]` を持つ。
- 表示・計算に渡すときは、`PartyMember` と DB のキャラを合わせた `CharacterConfig`（今と同じ形）を作る関数（例: `resolvePartyCharacters(members, database.characters)`）で解決する。
  - 画面・計算処理の多くは今の `CharacterConfig` のまま使えるので、変更を解決関数とその呼び出し元に集められる。
- 編成ごとの設定（凸数・武器・精錬・聖遺物・2+2・元素チャージ効率）は `PartyMember` だけが持つ。マスターデータ側の同名の項目は使わない。

## 作業内容

### 3c-1. 型と解決関数

1. `PartyMember` 型を追加する（`src/types/genshin.ts`）。
2. `resolvePartyCharacters(members, databaseCharacters)` を作る。DB に無いキャラ（DB管理で削除された等）の扱いは下の検討事項で決める。
3. 未設定枠（`empty_slot_<n>`）は今の `createEmptySlotCharacter` と同じ表示用のキャラに解決する。

### 3c-2. 状態と保存データ

1. `App.tsx` の編成の状態を `PartyMember[]` に変え、表示・計算には解決済みのキャラを渡す（`calculateRotation`・ガントチャート・出場ごとの操作画面・手順書・記法・保存名の生成など）。
2. 現在の編成の保存（`storage.ts` の `saveActiveState` / `loadActiveState`）、保存スロット（`SavedRotationSlot`、`saveSlot` / `getSavedSlots`）、JSON 書き出し・読み込みを `PartyMember[]` にする。
3. 旧形式（キャラを丸ごと持つ）の保存データは移行しない（D13）。

### 3c-3. 編成画面

1. 編成画面（`PartyConfigModal.tsx`）の編集中の状態を `PartyMember[]` にする。キャラを選ぶと `characterId` と初期値（凸数の既定値など）だけを持つ。
2. 表示（キャラカード・設定欄）は解決済みのキャラを使う。
3. 「全パーティメンバーをマスターデータで再登録」ボタンと `refreshCharactersFromDatabase` を削除する（不要になるため）。
4. キャラを入れ替えたときの出場ブロックの付け替え（`migrateStintsToNewCharacter`）は、解決済みの新しいキャラを渡して今と同じように使う。

### 3c-4. DB 管理との関係

1. DB管理でキャラを編集すると、その内容が編成に**すぐ反映**される（今は反映されない）。
2. DB管理でキャラを削除したときの処理（`App.tsx` の `onUpdateDatabase` で編成から外す処理）を、新しい持ち方に合わせる。今は枠ごと取り除いて枠の数が減るので、未設定枠に置き換える形にするかを検討事項で決める。

## 検討事項（作業時に決める）

- DB に無いキャラを参照している枠: 未設定枠として扱うか、「DB に見つからないキャラ」として表示して利用者に知らせるか。
- DB管理でキャラを削除したとき: 枠を未設定にする（枠の数は4のまま）か、今のように枠を取り除くか。
- 元素チャージ効率（`energyRecharge`）: gcsim 連携では使わない（D3: `ignore_burst_energy`）。編成の設定として残すか、削除するか。

## 完了条件

- 編成・保存スロット・JSON 書き出しに、キャラのデータの丸ごとのコピーが入らない（ID と編成ごとの設定だけ）。
- マスターデータを更新すると、編成し直さなくても編成のキャラに反映される（例: 凸データの無い古い DB から更新しても、編成画面に凸データが出る）。
- DB管理でキャラを編集すると、編成に反映される。
- 凸数・武器・精錬・聖遺物・2+2 の設定が、保存・読み込み・スロット・JSON でこれまでどおり保たれる。
- 「全パーティメンバーをマスターデータで再登録」ボタンが無くなっている。
- 型チェック・ビルドが通り、ブラウザで確認済み。

## 影響範囲

- 編成の状態と保存データの形（現在の編成・保存スロット・JSON）、編成画面、DB 管理との連動。
- キャラを受け取る画面・計算処理は、解決済みの `CharacterConfig` を受け取る形のまま（呼び出し元の変更が中心）。
- 旧形式の保存データは読み込めなくなる（D13: 保存データは作り直す）。
