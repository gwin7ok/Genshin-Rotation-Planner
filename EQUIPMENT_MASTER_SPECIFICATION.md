# 武器・聖遺物マスターデータ動的生成および発動バフ実装計画書

## 1. 背景と目的

現在、キャラクターのマスターデータは `genshin-db API` および `gcsim` のソースコードを解析・統合して動的生成され、固有天賦などの発動タイミングが固定できない効果については「効果継続時間」と「クールタイム（CT）」のみを抽出し、ガントチャート上でユーザーがドラッグして発動位置を調整できる仕様となっています。

本計画では、これまで静的または未反映であった**武器（Weapon）**および**聖遺物（Artifact Set）**について、キャラクターと同様のデータ取得・解析パイプラインを構築し、**「効果継続時間・CT・アイコンを最新APIから動的生成し、ガントチャート上で発動位置を自在に調整できる発動バフ」**として利用可能にするための実装計画を定義します。

---

## 2. システム構成とデータフロー

```
[genshin-db API (v5)]
  ├─ 武器基本データ (名前, 武器種, レア度, 基礎攻撃力, サブステ, スキル説明文, filename_icon)
  └─ 聖遺物基本データ (セット名, レア度, 2P/4P効果説明文, filename_icon)
        │
        ▼
[enka.network] ─── 公式ゲーム内アイコン画像 URL 解決 (https://enka.network/ui/<filename_icon>.png)
        │
        ▼
[equipmentBuffParser.ts]
  ├─ 説明文から「継続時間 (秒)」「クールタイム (秒)」を正規表現で自動抽出
  └─ 人間による確認済み補正辞書 (equipmentBuffOverrides.ts) で表示名・要約を整形
        │
        ▼
[equipmentMasterGenerator.ts] (ブラウザ・Node 共通生成器)
  ├─ 武器マスターデータ (src/data/weapons_master_data.json)
  └─ 聖遺物マスターデータ (src/data/artifacts_master_data.json)
        │
        ▼
[アプリ内 DB / ガントチャート連携]
  ├─ DB管理モーダル: 「⚡ 最新マスターデータの動的生成 (武器 / 聖遺物)」ボタン
  ├─ アクション構築画面: 装備中武器・聖遺物の「+登録: 発動バフ」パレット表示
  └─ ガントチャート: 効果バー＆CTバーの描画、ドラッグによる発動位置連動、2周目ループ投影
```

---

## 3. データスキーマ定義（型設計）

固有天賦（`PassiveEffectDefinition`）と互換性を持つ共通インターフェースとして設計します。

```typescript
// 武器・聖遺物の発動バフ定義
export interface EquipmentBuffDefinition {
  id: string;                      // 例: "wbuff_freedom_sworn", "abuff_noblesse_4p"
  name: string;                    // 表示名 例: "蒼古: 抗争の歌" / "旧貴族4: 全員攻撃力+20%"
  sourceType: 'weapon' | 'artifact';
  sourceId: string;                // 武器ID または 聖遺物ID
  duration?: number;               // 効果継続時間 (秒) 例: 12.0
  cooldown?: number;               // クールタイム (秒) 例: 20.0
  description: string;             // バフの元となった効果説明文
  color?: string;                  // ガントチャート描画色
  statEffectSummary?: string;      // ツールチップ要約 例: "全員攻撃+20% / 通常重撃ダメ+16%"
  dataSource?: {
    duration?: string;             // 抽出元の文言 例: "12秒間"
    cooldown?: string;             // 抽出元の文言 例: "20秒に1回"
  };
}

// 武器マスターアイテム
export interface WeaponMasterItem {
  id: string;                      // 武器ID 例: "freedom_sworn"
  name: string;                    // 日本語名: "蒼古なる自由への誓い"
  englishName: string;             // 英語名: "Freedom-Sworn"
  weaponType: WeaponType;          // "sword" | "claymore" | "polearm" | "bow" | "catalyst"
  rarity: number;                  // 1 〜 5
  baseAttack: number;              // 基礎攻撃力
  subStat?: string;                // サブステータス 例: "元素熟知 198"
  avatarUrl: string;               // enka.network アイコン画像URL
  passiveName?: string;            // スキル名 例: "千年の大楽・抗争の歌"
  description?: string;            // スキル説明文
  buffEffects: EquipmentBuffDefinition[]; // 抽出・設定された発動バフ一覧
}

// 聖遺物セットマスターアイテム
export interface ArtifactSetMasterItem {
  id: string;                      // セットID 例: "noblesse_oblige"
  name: string;                    // セット名: "旧貴族のしつけ"
  englishName: string;             // 英語名: "Noblesse Oblige"
  rarityList: number[];            // レア度リスト 例: [4, 5]
  avatarUrl: string;               // 花 (Flower) の enka アイコンURL
  effect2p?: string;               // 2セット効果説明文
  effect4p?: string;               // 4セット効果説明文
  buffEffects: EquipmentBuffDefinition[]; // 4セット効果等から抽出された発動バフ一覧
}
```

---

## 4. バフ効果テキスト解析仕様 (`equipmentBuffParser.ts`)

### 4.1. 抽出正規表現ルール
1. **継続時間 (Duration)**:
   - `/(?:継続時間|持続時間)\s*([\d.]+)\s*秒/`
   - `/([\d.]+)\s*秒間/`
   - `/([\d.]+)\s*秒継続/`
2. **クールタイム (Cooldown)**:
   - `/([\d.]+)\s*秒(?:毎|ごと)に\s*(?:1|一)\s*回/`
   - `/(?:CD|クールタイム|CT)[：:\s]*([\d.]+)\s*秒/`
   - `/([\d.]+)\s*秒に1回のみ発動/`

### 4.2. フィルタリング基準
- 「攻撃力+20%」「HP上限+20%」など、文中に時間（秒）の概念が含まれない常時パッシブは `buffEffects: []`（発動バフなし）として処理。
- 1つの説明文から複数の継続時間・CTが検出された場合は、主要な発動バフとして分解して登録。

---

## 5. 人間による確認・補正辞書 (`equipmentBuffOverrides.ts`)

テキスト自動抽出のみでは名称が長くなりすぎる場合や、特殊なスタック条件（蒼古・終焉・西風など）に対して、分かりやすい短い名称・要約テキスト・テーマカラーを付与します。

| 装備名 | 種別 | 補正後の表示バフ名 | 継続時間 / CT | 要約効果 |
| :--- | :--- | :--- | :--- | :--- |
| **蒼古なる自由への誓い** | 武器 | `蒼古: 抗争の歌` | 12s / 20s | 全員攻撃+20% / 通常重撃ダメ+16% |
| **終焉を嘆く詩** | 武器 | `終焉: 別れの歌` | 12s / 20s | 全員元素熟知+100 / 攻撃力+20% |
| **聖顕の鍵** | 武器 | `聖顕の鍵: 全員熟知バフ` | 20s / - | チーム全員の元素熟知加算 |
| **原木刀** | 武器 | `原木刀: 唯空の葉` | 12s / 20s | 拾ったキャラの元素熟知+120 |
| **龍殺しの英傑譚** | 武器 | `龍殺し: 交代先攻撃力UP` | 10s / 20s | 次に出場するキャラの攻撃力+48% |
| **サーンドルの渡守** | 武器 | `サーンドル: スキル後チャージUP` | 5s / - | チャージ効率+32% |
| **旧貴族のしつけ** | 聖遺物 | `旧貴族4: 全員攻撃力+20%` | 12s / - | チーム全員の攻撃力+20% |
| **翠緑の影** | 聖遺物 | `翠緑4: 拡散耐性-40%` | 10s / - | 該当元素耐性-40% |
| **深林の記憶** | 聖遺物 | `深林4: 草元素耐性-30%` | 8s / - | 敵の草元素耐性-30% |
| **千岩牢固** | 聖遺物 | `千岩4: 全員攻撃力+20%` | 3s / - | 全員攻撃力+20% / シールド強化+30% |
| **灰燼の街に響く英雄の絵巻** | 聖遺物 | `絵巻4: 該当元素ダメバフ+40%` | 15s / - | 関連元素ダメバフ+40% |
| **教官** | 聖遺物 | `教官4: 全員元素熟知+120` | 8s / - | チーム全員の元素熟知+120 |

---

## 6. 実装フェーズとステップ

### Phase 1: 武器・聖遺物マスター生成器の実装
1. `src/masterdata/equipmentBuffParser.ts` の作成（正規表現抽出 & 補正辞書）
2. `src/masterdata/equipmentMasterGenerator.ts` の作成（genshin-db + enka からの動的生成）
3. `scripts/build-equipment-master.ts` の作成 (`npm run build:equipment` コマンドで同梱JSONを生成)
4. `src/data/weapons_master_data.json` および `src/data/artifacts_master_data.json` の再生成・更新

### Phase 2: DB管理モーダル（UI）の更新
1. `DatabaseManagerModal.tsx` における武器・聖遺物の動的生成ボタンを新ジェネレーターに接続
2. 生成進捗プログレスバー、生成レポート（抽出されたバフ一覧、スキップされた常時効果等）の表示

### Phase 3: アクション構築 & ガントチャートへの統合
1. キャラクターの装備（`weaponName`, `artifactSetName`）に紐づく `buffEffects` を `StintSequenceEditor` に表示
2. 発動バフ（`PassiveTriggerInstance`）のデータ構造を拡張し、武器バフ・聖遺物バフも同一の仕組みで出場ブロックに登録可能にする
3. `GanttChart.tsx` 上で効果バー・CTバーを描画し、ドラッグで発動タイミング（秒数オフセット）を調整可能にする
4. `rotationCalculator.ts` のバフシナジー（重複カウント）に武器・聖遺物バフを合算
