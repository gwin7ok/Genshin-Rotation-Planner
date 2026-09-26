# 武器・聖遺物マスターデータ動的生成および発動バフ実装仕様書

## 1. 背景と目的

現在、キャラクターのマスターデータは `genshin-db API` および `gcsim` のソースコードを解析・統合して動的生成され、固有天賦などの発動タイミングが固定できない効果については「効果継続時間」と「クールタイム（CT）」のみを抽出し、ガントチャート上でユーザーがドラッグして発動位置を調整できる仕様となっています。

本計画では、**武器（Weapon）**および**聖遺物（Artifact Set）**について、キャラクターと同様のデータ取得・解析パイプラインを構築し、**「効果継続時間・CT・アイコンを最新APIから動的生成し、ガントチャート上で発動位置を自在に調整できる発動バフ」**として利用可能にするための仕様および実装計画を定義します。

---

## 2. システム構成とデータフロー

```
[genshin-db API (v5)]
  ├─ 武器基本データ (公式武器ID, 名前, 英名, 武器種, レア度, 基礎攻撃力, サブステ, スキル説明文, filename_icon)
  └─ 聖遺物基本データ (公式聖遺物ID, セット名, 英名, レア度, 2P/4P効果説明文, filename_icon)
        │
        ▼
[enka.network] ─── 公式ゲーム内アイコン画像 URL 解決 (https://enka.network/ui/<filename_icon>.png)
        │
        ▼
[equipmentBuffParser.ts]
  ├─ 説明文から「継続時間 (秒)」「クールタイム (秒)」を強化正規表現で自動抽出
  │   ・「発動後(の)20秒間、...再度獲得することはできない」（実CT）とスタック獲得CT（0.2秒）の優先判定
  │   ・「クールタイムはXX秒」「最短でX秒毎に1回」「再発動可能になるまでX秒」等の構文抽出
  └─ 人間による確認済み補正辞書 (equipmentBuffOverrides.ts) で表示名・要約・テーマカラーを整形
        │
        ▼
[equipmentMasterGenerator.ts] (ブラウザ・Node 共通生成器)
  ├─ 武器マスターデータ (src/data/weapons_master_data.json) - genshin-db公式IDキー (例: "15503")
  └─ 聖遺物マスターデータ (src/data/artifacts_master_data.json) - genshin-db公式IDキー (例: "15007")
        │
        ▼
[アプリ内 DB / ガントチャート連携]
  ├─ DB管理モーダル: 「⚡ 最新マスターデータの動的生成 (武器 / 聖遺物)」ボタン & レポート表示
  ├─ 定義編集モーダル: 「バフ表示名」「持続時間 (秒)」「CT / クールタイム (秒)」の直接入力・保存
  ├─ アクション構築画面: 装備中武器・聖遺物の「+登録: 発動バフ」パレット表示
  └─ ガントチャート: 効果バー＆CTバーの描画、ドラッグによる発動位置連動、2周目ループ投影
```

---

## 3. ID・キー体系およびデータスキーマ仕様

### 3.1. 主キー（`id`）の統一仕様
キャラクターの主キー（`genshin-db公式キャラID-元素` 例: `10000002-cryo`）と体系を統一し、**武器および聖遺物の主キーも `genshin-db` の公式ID（数値文字列）を使用**します。

* **武器主キー (`WeaponDatabaseItem.id`)**: `genshin-db` 公式武器ID（例: 終焉を嘆く詩 → `"15503"`, 西風剣 → `"11401"`）
* **聖遺物主キー (`ArtifactSetDatabaseItem.id`)**: `genshin-db` 公式聖遺物ID（例: 翠緑の影 → `"15002"`, 旧貴族のしつけ → `"15007"`）
* **バフ一意キー (`EquipmentBuffDefinition.id`)**:
  * 武器バフ: `wbuff_${weapon.id}`（例: `wbuff_15503`）
  * 聖遺物バフ: `abuff_${artifact.id}`（例: `abuff_15007`）

### 3.2. データ型定義（TypeScript）

```typescript
// 武器・聖遺物の発動バフ定義
export interface EquipmentBuffDefinition {
  id: string;                      // 例: "wbuff_15503", "abuff_15007"
  name: string;                    // 表示名 例: "終焉: 別れの歌" / "旧貴族4: 全員攻撃力+20%"
  sourceType: 'weapon' | 'artifact';
  sourceId: string;                // 武器公式ID または 聖遺物公式ID
  duration?: number;               // 効果継続時間 (秒) 例: 12.0
  cooldown?: number;               // クールタイム (秒) 例: 20.0
  description: string;             // バフの元となった効果説明文
  color?: string;                  // ガントチャート描画色
  statEffectSummary?: string;      // ツールチップ要約 例: "全員元素熟知+100 / 攻撃力+20%"
  dataSource?: {
    duration?: string;             // 抽出元の文言 例: "12秒継続"
    cooldown?: string;             // 抽出元の文言 例: "発動後の20秒間、追憶の欠片を再度"
  };
}

// 武器マスターアイテム
export interface WeaponDatabaseItem {
  id: string;                      // genshin-db公式ID (例: "15503")
  name: string;                    // 日本語名: "終焉を嘆く詩"
  englishName: string;             // 英語名: "Elegy for the End"
  weaponType: WeaponType;          // "sword" | "claymore" | "polearm" | "bow" | "catalyst"
  rarity: number;                  // 3 〜 5
  baseAttack?: number;             // 基礎攻撃力
  avatarUrl: string;               // enka.network アイコン画像URL
  passiveName?: string;            // スキル名 例: "追憶と別れの歌"
  description?: string;            // スキル説明文
  buffEffects?: EquipmentBuffDefinition[]; // 抽出・設定された発動バフ一覧
  buffEffect?: {                   // UI編集・旧形式互換用
    id: string;
    name: string;
    duration: number;              // 持続時間 (秒)
    cooldown?: number;             // CT (秒)
    statEffect: string;
    description: string;
    color: string;
  };
  isLocked?: boolean;              // ユーザー編集ロック保護フラグ
  isCustom?: boolean;              // ユーザー作成カスタム武器フラグ
  updatedAt?: string;              // 更新日時
}

// 聖遺物セットマスターアイテム
export interface ArtifactSetDatabaseItem {
  id: string;                      // genshin-db公式ID (例: "15007")
  name: string;                    // セット名: "旧貴族のしつけ"
  englishName: string;             // 英語名: "Noblesse Oblige"
  rarity: number;                  // 代表レアリティ (最大値 4 または 5)
  rarityList: number[];            // レア度リスト 例: [4, 5]
  avatarUrl?: string;              // 花 (Flower) の enka アイコンURL
  effect2p: string;                // 2セット効果説明文
  effect4p: string;                // 4セット効果説明文
  buffEffects?: EquipmentBuffDefinition[]; // 4セット効果等から抽出された発動バフ一覧
  buffEffect?: {                   // UI編集・旧形式互換用
    id: string;
    name: string;
    duration: number;              // 持続時間 (秒)
    cooldown?: number;             // CT (秒)
    statEffect: string;
    description: string;
    color: string;
  };
  isLocked?: boolean;              // ユーザー編集ロック保護フラグ
  isCustom?: boolean;              // ユーザー作成カスタム聖遺物フラグ
  updatedAt?: string;              // 更新日時
}
```

---

## 4. バフ効果テキスト解析仕様 (`equipmentBuffParser.ts`)

### 4.1. 抽出正規表現ルール
1. **クールタイム (Cooldown)**:
   - `/(?:CD|クールタイム|CT)[：:\s]*(?:は)?\s*([\d.]+)\s*秒/i`
   - `/(?:発動後|発動すると)(?:の)?\s*([\d.]+)\s*秒(?:間|の間)?、?[^。]*?(?:再度|再発動|CT|再び|獲得することはできな|発動できな)/i`
   - `/(?:再発動可能になるまで|再発動のクールタイムは|次の発動まで)\s*([\d.]+)\s*秒/i`
   - `/最短で\s*([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/i`
   - `/([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/i`
   - `/([\d.]+)\s*秒に(?:1|一)回(?:のみ)?(?:発動|獲得)?/i`
2. **継続時間 (Duration)**:
   - `/(?:継続時間|持続時間)\s*([\d.]+)\s*秒/i`
   - `/([\d.]+)\s*秒継続/i`
   - `/(?<!発動後(?:の)?)\b([\d.]+)\s*秒間(?![^。]*?(?:再度|再発動|獲得することはできな))/i`
   - `/([\d.]+)\s*秒(?:の間|持続)/i`
   - `/([\d.]+)\s*秒間/i`

### 4.2. フィルタリング＆優先度基準
- 「攻撃力+20%」「HP上限+20%」など、文中に時間の概念（秒）が含まれない常時パッシブは `buffEffects: []`（発動バフなし）として処理。
- 終焉を嘆く詩などのようにスタック獲得間隔（例: `0.2秒毎に1回`）とバフ本発動後のクールタイム（例: `発動後の20秒間、追憶の欠片を再度獲得することはできない`）が混在する場合、**本発動のクールタイム（20秒）**を優先して抽出。

---

## 5. 人間による確認・補正辞書 (`equipmentBuffOverrides.ts`)

テキスト自動抽出のみでは名称が長くなりすぎる場合や、特殊な発動条件に対して短い名称・要約テキスト・テーマカラーを補正します。

| 装備名 | 種別 | 公式ID | 補正後の表示バフ名 | 継続時間 / CT | 要約効果 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **蒼古なる自由への誓い** | 武器 | 11503 | `蒼古: 抗争の歌` | 12s / 20s | 全員攻撃+20% / 通常重撃ダメ+16% |
| **終焉を嘆く詩** | 武器 | 15503 | `終焉: 別れの歌` | 12s / 20s | 全員元素熟知+100 / 攻撃力+20% |
| **聖顕の鍵** | 武器 | 11511 | `聖顕の鍵: 全員熟知バフ` | 20s / - | チーム全員の元素熟知加算 |
| **原木刀** | 武器 | 11417 | `原木刀: 唯空の葉` | 12s / 20s | 拾ったキャラの元素熟知+120 |
| **龍殺しの英傑譚** | 武器 | 14302 | `龍殺し: 交代先攻撃力UP` | 10s / 20s | 次に出場するキャラの攻撃力+48% |
| **サーンドルの渡守** | 武器 | 11426 | `サーンドル: スキル後チャージUP` | 5s / - | チャージ効率+32% |
| **旧貴族のしつけ** | 聖遺物 | 15007 | `旧貴族4: 全員攻撃力+20%` | 12s / - | チーム全員の攻撃力+20% |
| **翠緑の影** | 聖遺物 | 15002 | `翠緑4: 拡散耐性-40%` | 10s / - | 該当元素耐性-40% |
| **深林の記憶** | 聖遺物 | 15025 | `深林4: 草元素耐性-30%` | 8s / - | 敵の草元素耐性-30% |
| **千岩牢固** | 聖遺物 | 15017 | `千岩4: 全員攻撃力+20%` | 3s / 0.5s | 全員攻撃力+20% / シールド強化+30% |
| **灰燼の都に立ち寄る英雄の絵巻** | 聖遺物 | 15037 | `絵巻4: 該当元素ダメバフ+40%` | 20s / - | 関連元素ダメバフ+40% |
| **教官** | 聖遺物 | 10007 | `教官4: 全員元素熟知+120` | 8s / - | チーム全員の元素熟知+120 |

---

## 6. 実装フェーズと進捗状況

### ✅ Phase 1: 武器・聖遺物マスター生成器の実装（完了）
1. `src/masterdata/equipmentBuffParser.ts` の作成（正規表現抽出 & 補正辞書）
2. `src/masterdata/equipmentMasterGenerator.ts` の作成（genshin-db公式IDキー対応、enka アイコン解決、重複ID防止）
3. `src/data/weapons_master_data.json` および `src/data/artifacts_master_data.json` の全件再生成（公式ID化）

### ✅ Phase 2: DB管理モーダル（UI）の更新（完了）
1. `DatabaseManagerModal.tsx` の「最新データ同期」タブに武器・聖遺物の動的生成ボタン & 進捗プログレスバーを実装
2. 武器・聖遺物カード一覧に「連動バフ（持続時間 / CT）」のバッジ表示を追加
3. `EditWeaponSubModal` および `EditArtifactSubModal` に「**CT / クールタイム (秒)**」入力欄を追加し、保存時の同期ロジックを実装

### 🔄 Phase 3: アクション構築 & ガントチャートへの統合（次期実装）
1. キャラクターの装備（`weapon` / `artifactSet`）に紐づく `buffEffects` を `StintSequenceEditor` に「+登録: 発動バフ」ボタンとして表示
2. 発動バフ（`PassiveTriggerInstance`）のデータ構造を拡張し、武器バフ・聖遺物バフも同一の仕組みで出場ブロックに登録可能にする
3. `GanttChart.tsx` 上で効果バー・CTバーを描画し、ドラッグで発動タイミング（秒数オフセット）を調整可能にする
4. `rotationCalculator.ts` のバフシナジー（重複カウント）に武器・聖遺物バフを合算
