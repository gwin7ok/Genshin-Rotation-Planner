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
2. **キャラの突き合わせ**: gcsim の `ui/packages/ui/src/Data/character.dm.json` にある公式キャラID (例: 胡桃 = 10000046) で genshin-db と結合する。フォルダは `zz_<key>.dm.go` の位置から求める。
3. **フレーム抽出** (`src/masterdata/gcsimParser.ts`): `frames.InitAbilSlice(N)` / `InitNormalCancelSlice(hit, N)` と `[action.ActionXxx] = n` を読み、定数・配列添字・`len()` を含む算術式を評価する。
4. **アクション定義**: CT・効果継続時間・フレームはアクションごとに持つ (N1..Nn / CA / E / 長押しE / 派生E / Q / ダッシュ)。キャラ単位の CT、爆発必要エネルギー、スキル粒子数は持たない。
5. **欠損の扱い**: 取得できなかった値は捏造せず、タイムライン用の仮の秒数を使ったアクションとしてレポートに記録する。
6. **実行方法**
   - アプリ: DB管理 → 最新データ同期 → 「最新マスターデータの動的生成 (キャラ)」
   - 同梱 JSON の再生成: `npm run build:master` (`src/data/characters_master_data.json` を上書き)
