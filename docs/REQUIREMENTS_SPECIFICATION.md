# 【仕様書】原神キャラクター全スペックおよびモーションフレームデータ収集・統合パイプライン

## 1. システム概要 & 目的
本仕様書は、原神（Genshin Impact）の全実装・登場キャラクターについて、以下の2系統のデータソースを照合・統合し、正確なスキルスペック（クールタイム、効果継続時間、エネルギーコスト）およびモーション実行時間（60 FPS基準のスタートアップ・トータル・キャンセルフレーム）を構築・利用するためのアーキテクチャおよびデータ収集パイプラインを定義します。

---

## 2. アーキテクチャ構成と選択肢の検討（メリット・デメリット・推奨）

データ取得・収集・運用の方式について、以下の選択肢を比較検討し、本アプリケーションにおける最適な構成を選定・実装します。

### 【選択肢 1】 データ取得・配信・構築方式の選定

| 方式 | 概要 | メリット | デメリット | 評価・推奨度 |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: 静的事前ビルド＆ローカルマスターJSON化 (推奨)** | スクリプトにより `genshin-db` と `gcsim` を結合した高精度マスターデータ（`characters_master_data.json`）を事前生成し、アプリに同梱する。 | ・レスポンスが高速（0ms）<br>・外部API依存なしでオフライン動作可能<br>・型安全かつパース失敗時のUI崩れなし | 新キャラ追加時にビルド・更新スクリプトを再実行する必要がある。 | **【採用・推奨】** ★★★★★ |
| **Option B: 純粋オンデマンドAPI直接フェッチ** | ユーザーの画面操作時に毎回 `genshin-db` や `gcsim` GitHub Raw APIにアクセスクロールする。 | ・アプリ配布物にデータを持たず常に最新。 | ・ネットワーク遅延やGitHub APIのRate Limit制限を受ける<br>・CORSエラーや回線障害でUIがロード不能になる。 | **【非推奨】** ★☆☆☆☆ |
| **Option C: ハイブリッド（事前ビルド + オンライン補完）** | 基本データは事前ビルドマスターを利用し、未収録の新キャラのみオンラインAPI/Wikiからフォールバック取得する。 | ・初回表示が爆速<br>・未収録の新キャラもリアルタイム補完可能。 | ・実装コストがやや高い。 | **【準推奨・併用】** ★★★★☆ |

> **推奨:** **Option A（事前ビルド＆マスターデータ化）** を軸とし、最新未実装キャラのオンライン補完には **Option C** のフォールバックを適用。

---

### 【選択肢 2】 `gcsim` Go言語ソースコードの解析（パース）手法

| 手法 | 概要 | メリット | デメリット | 評価・推奨度 |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: 精緻な正規表現（RegEx）＆構文抽出器 (推奨)** | Node.js環境で `InitNormalCancelSlice`, `InitAbilSlice`, `hitmark` などのGo言語定数パターンを正規表現で抽出。 | ・外部コンパイラ不要<br>・全111+キャラのGoファイルを数秒で高速抽出可能<br>・依存関係が非常に軽量。 | 一部特殊な条件分岐を持つコードの自動抽出にフォールバック処理が必要。 | **【採用・推奨】** ★★★★★ |
| **Option B: Go compiler / Tree-Sitter ASTパーサーの導入** | Go言語のAST（抽象構文木）パーサーをWebAssembly化して完全構文解析する。 | ・構文レベルで完全な解析が可能。 | ・ビルド環境・依存パッケージが肥大化する<br>・Node/Vite環境での環境依存エラーリスクが高い。 | **【非推奨】** ★★☆☆☆ |

> **推奨:** **Option A（RegEx＆パターン抽出器）** を採用。

---

### 【選択肢 3】 ヒットラグ（Hitlag）発生時のフレーム補正の扱い

| 扱い | 概要 | メリット | デメリット | 評価・推奨度 |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: 純粋モーションフレーム（60 FPS換算秒数）を出力し、ヒットラグ有無フラグを保持 (推奨)** | 60 FPS換算の純粋アクション時間（例: 24f = 0.4s）を出力し、近接ヒットラグは属性値として管理。 | ・回転タイムライン（Gantt Chart）に組み込みやすく秒数換算（`Frames/60`）が完全一致する。 | 実戦で近接攻撃がヒットした際、ヒットラグ分（1〜3f）数ミリ秒伸びる。 | **【採用・推奨】** ★★★★★ |
| **Option B: ヒットラグ期待値をすべてフレーム数に一括加算** | 敵ヒットを前提としてヒットラグ時間をあらかじめフレームに加算。 | ・実戦の体感時間に近づく。 | ・空振り時と数値がズレる<br>・遠隔キャラと近接キャラのフレーム基準が不統一になる。 | **【非推奨】** ★★☆☆☆ |

> **推奨:** **Option A** を採用し、正確なフレーム数および秒数換算値をタイムラインへ反映。

---

## 3. データ構造（JSON Schema）仕様

生成される `characters_master_data.json` の構造定義：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GenshinCharacterMasterData",
  "type": "object",
  "patternProperties": {
    "^[a-z0-9_-]+$": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": "胡桃",
        "englishName": "Hu Tao",
        "element": "pyro",
        "weaponType": "polearm",
        "rarity": 5,
        "skills": {
          "skill": {
            "name": { "type": "string" },
            "cooldown": { "type": "number", "description": "スキルCT (秒)" },
            "duration": { "type": "number", "description": "効果継続時間 (秒)" }
          },
          "burst": {
            "name": { "type": "string" },
            "cooldown": { "type": "number", "description": "爆発CT (秒)" },
            "duration": { "type": "number", "description": "効果継続時間 (秒)" },
            "energyCost": { "type": "number", "description": "必要元素エネルギー" }
          }
        },
        "frameData": {
          "type": "object",
          "description": "60 FPS基準のモーションフレーム指標",
          "properties": {
            "startupFrames": { "type": "number" },
            "totalFrames": { "type": "number" },
            "cancelableFrames": {
              "type": "object",
              "properties": {
                "dash": { "type": "number" },
                "jump": { "type": "number" },
                "swap": { "type": "number" }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 4. 生成ロジック・実行・連携フロー

生成ロジックは `src/masterdata/characterMasterGenerator.ts` の1本に集約し、ブラウザと Node の両方から同じコードを使う。

1. **データ取得 (毎回ネットから最新を取得)**
   - genshin-db API (`https://genshin-db-api.vercel.app/api/v5`): キャラ基本データ、天賦ラベルから CT・効果継続時間、アイコンのファイル名
   - gcsim GitHub: `git/trees/main` (ファイル一覧, API 1回) と `internal/characters/<dir>/{attack,charge,aimed,skill,burst}.go`
   - アイコン: `https://enka.network/ui/<filename_icon>.png`
2. **キャラの突き合わせ**: gcsim の `ui/packages/ui/src/data/character.dm.json` にある公式キャラID (例: 胡桃 = 10000046) で genshin-db と結合する。フォルダは `zz_<key>.dm.go` の位置から求める。
3. **フレーム抽出** (`src/masterdata/gcsimParser.ts`): `frames.InitAbilSlice(N)` / `InitNormalCancelSlice(hit, N)` と `[action.ActionXxx] = n` を読み、定数・配列添字・`len()` を含む算術式を評価する。
4. **アクション定義**: CT・効果継続時間・フレームはアクションごとに持つ (N1..Nn / CA / E / 長押しE / 派生E / Q / ダッシュ)。キャラ単位の CT、爆発必要エネルギー、スキル粒子数は持たない。
5. **欠損の扱い**: 取得できなかった値は捏造せず、タイムライン用の仮の秒数を使ったアクションとしてレポートに記録する。
6. **実行方法**
   - アプリ: DB管理 → 最新データ同期 → 「最新マスターデータの動的生成 (キャラ)」
   - 同梱 JSON の再生成: `npm run build:master` (`src/data/characters_master_data.json` を上書き)

---

## 5. 編成のデータ構造と保存データ（フェーズ3c / 決定 D13・D16・D18）

マスターデータと編成のデータは、名前ではなく必ず ID をキーにして持つ。編成はキャラのデータをコピーせず、**キャラの ID と編成ごとの設定だけ**を持つ。キャラのデータ（名前・アクション・固有天賦・凸データなど）は、表示・計算のたびに DB から引く。

### 5.1 編成の1枠 `PartyMember`（`src/types/genshin.ts`）

| 項目 | 内容 |
| :--- | :--- |
| `characterId` | DB のキャラ ID（例: `10000073-dendro`）。未設定枠は `empty_slot_<n>` |
| `constellation` | 凸数 0〜6（未指定時は星4=6凸・星5=0凸） |
| `weaponId` / `weaponRefinementRank` | 武器 ID（DB の武器）と精錬ランク 1〜5 |
| `artifactSetId` / `artifactSetMode` | 聖遺物セット ID と、組み合わせ（`4pc` / `2+2`。`2+2` は聖遺物を「効果なし」に固定） |
| `energyRecharge` | 元素チャージ効率（%）。gcsim 連携では使わないが、編成ごとの値として保持 |

- 編成は 4 枠の配列（`PartyMember[]`）。順序がガントチャートのレーンの並びになる。
- 編成ごとの設定は `PartyMember` だけが持つ。DB のキャラ側の同名の項目は使わない。

### 5.2 解決（`src/utils/party.ts`）

- `resolvePartyCharacters(party, database.characters)` が、`PartyMember` と DB のキャラを合わせた表示・計算用の `CharacterConfig` を作る。画面・計算処理は解決済みの `CharacterConfig` を受け取る。
- **DB に無いキャラを参照している枠**（DB 管理での削除など）は、未設定枠として扱う。保存データの `characterId` は書き換えないので、DB にキャラが戻れば（再生成など）元のキャラに復活する。
- **DB に無いキャラの出場ブロック**は、計算・表示から除く。保存データには残り、編成がそのキャラの ID を参照している間は、出場ブロックや編成を編集しても消えない（`mergeHiddenStints`）。編成画面でそのキャラを別のキャラに入れ替えたとき、または「編成・アクションを全クリア」を押したときは、参照がなくなるので消える。

### 5.3 保存データ

| 保存先 | キー | 内容 |
| :--- | :--- | :--- |
| 現在の編成（localStorage） | `genshin_rotation_current_state_v2` | `party`, `stints`, `loopStartIndex`, `switchDelay`, `actionDelay`, `activeSlotId` |
| 保存スロット（localStorage） | `genshin_rotation_saved_slots_v2` | スロットごとに `party`, `stints`, `loopStartIndex`, 名前・メモ など |
| JSON 書き出し・読み込み | — | `party`, `stints`, `loopStartIndex` など（編成管理・ヘッダーの書き出し） |

- キャラのデータの丸ごとのコピーは保存しない（ID と設定だけ）。
- 保存データのキーは `characters` から `party` に変わった。**旧形式の保存データ（`characters` を持つもの）は読み込まない**（D13: 保存データは作り直す前提で、移行処理は作らない）。
- 出場ブロックのアクションは、登録時のアクション ID・所要時間のコピーを持つ。マスターデータの更新でアクション ID が変わった場合の付け替えは行わない。

### 5.4 編成画面

- キャラを選ぶと `characterId` と初期値（凸数の既定値・元素チャージ効率 100）だけを持つ。同じキャラは複数の枠に入れられない。
- 「全パーティメンバーをマスターデータで再登録」ボタンは無い（DB から引くので不要）。
- DB 管理でキャラを編集すると、編成し直さなくても編成のキャラに反映される。

---

## 6. DB 管理画面の仕様

キャラ・武器・聖遺物の一覧（タブ）で、マスターデータの確認・編集・追加ができる。

### 6.1 ロックとカスタム

| 区分 | 内容 |
| :--- | :--- |
| ロック（`isLocked`） | 最新マスターデータの同期で上書きされず、一括削除・全データクリアでも削除されない。個別に外せば通常どおり削除できる |
| カスタム（`isCustom`） | ユーザーが DB 管理で作成・編集したキャラ |

- ロック中のキャラには、マスターデータの更新（凸データなど）が届かない。

### 6.2 一括削除と編成

- 「全キャラ一括削除」は、ロック中のキャラだけを残す。「全武器一括削除」「全聖遺物一括削除」も同様。「全データクリア」はロック中のキャラ・武器・聖遺物だけを残す。
- 削除しても編成の枠・出場ブロックは書き換えない（5.2）。「一括削除 → 再生成」で編成は元に戻る。

### 6.3 一覧の絞り込み

- 3タブ共通の「ロック中のみ」ボタンで、ロック中のものだけを表示する。状態は3タブで共通。
- 検索・元素・武器種の絞り込みと AND で効く。「一括削除 (件)」の件数は、絞り込みではなく DB 全体の数。

### 6.4 gcsim の対応表の取得先

- 公式 ID → gcsim キーの対応表は、gcsim リポジトリの `ui/packages/ui/src/data/{character,weapon,artifact}.dm.json`（キャラは 4. の手順 2、武器・聖遺物は `equipmentMasterGenerator.ts`）。
- gcsim 側でフォルダが移動すると、生成が HTTP 404 で失敗する（GitHub API の回数制限では 403/429 になる）。2026-09-29 に `Data` → `data` の移動へ追随した。
