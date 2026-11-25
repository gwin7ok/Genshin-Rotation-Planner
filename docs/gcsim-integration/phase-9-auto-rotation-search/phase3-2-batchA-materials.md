# Phase 3-2 バッチ A 主力 20 キャラ 辞書設計素材レポート

- 対象: 残りキャラのうち最優先の主力 20 キャラ（バッチ A）
- 目的: 精鋭辞書設計に向けた、現行 `characters.ts`・マスター定義・KQM-DB 新パーサー集計の集約

## 1. ヌヴィレット (`10000087-hydro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, q, dash, jump`

### 現在の `characters.ts`（9 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→Q→特殊重撃を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["ca"]×[3,4]` | - | - |
| 1 | 先頭 N・E と Q のあと 重撃 + 通常攻撃 2 回を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["ca","n","n"]×[4,5,6]` | `["n"]` | - |
| 2 | E→N のあと、もう一度 CA→Q→E→CA、さらに CA×2 | `attacker` | 40 | `["e","n"]` | `50:["ca","q","e","ca"] / 55:["ca","ca"]` | - | - | `{"min":0}` |
| 3 | E のあと、もう一度 CA→E→CA→Q、さらに CA×2 | `attacker` | 40 | `["e"]` | `50:["ca","e","ca","q"] / 55:["ca","ca"]` | - | - | `{"min":0}` |
| 4 | E のあと、もう一度 CA→Q→E→CA、さらに CA×2 | `attacker` | 40 | `["e"]` | `50:["ca","q","e","ca"] / 55:["ca","ca"]` | - | - | `{"min":0}` |
| 5 | N のあと、もう一度 E→CA→Q→CA、さらに CA→E→CA | `attacker` | 40 | `["n"]` | `50:["e","ca","q","ca"] / 55:["ca","e","ca"]` | - | - | `{"min":0}` |
| 6 | 重撃を繰り返す | `attacker` | 40 | `["ca","ca"]` | - | `["ca"]×[3,5]` | - | `{"min":0}` |
| 7 | ca→q→e→ca | `attacker` | 40 | `["ca","q","e","ca"]` | - | - | - | `{"min":0}` |
| 8 | ca→e→ca→q | `attacker` | 40 | `["ca","e","ca","q"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **380** 件 / 新パーサー有効 **317** 件（旧パーサー有効 310 件 → **+7 件**）
- ループ内正規化パターン上位 5 件:
  1. **106件 (33.4%)** 平均 80.9k / 最大 104.1k | `use=["e"] then=[["ca","e","ca","q"],["ca","ca"]]` | 代表生: `[e] → [ca e ca q] → [ca×2]`
  2. **79件 (24.9%)** 平均 81.1k / 最大 170.8k | `use=["e"] then=[["ca","q","e","ca"],["ca","ca"]]` | 代表生: `[e] → [ca q e ca] → [ca×2]`
  3. **26件 (8.2%)** 平均 55.8k / 最大 77.5k | `use=["n"] then=[["e","ca","q","ca"],["ca","e","ca"]]` | 代表生: `[n] → [e ca q ca] → [ca e ca]`
  4. **19件 (6.0%)** 平均 71.4k / 最大 92.5k | `use=["e","n"] then=[["ca","q","e","ca"],["ca","ca"]]` | 代表生: `[e n] → [ca q e ca] → [ca×2]`
  5. **11件 (3.5%)** 平均 73.3k / 最大 100.2k | `use=["e","n"] then=[["ca","e","ca","q"],["ca","ca"]]` | 代表生: `[e n] → [ca e ca q] → [ca×2]`
- 頻出 lead（初動）上位 3 件: `e n` (4件)
- ループ最終Stint末尾アクション: `ca` (305件), `n` (5件)

## 2. アルレッキーノ (`10000096-pyro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（4 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→重撃→Q のあと 通常 6 段を繰り返す | `attacker` | 40 | `["e","ca","q"]` | - | `["n","n","n","n","n","n"]×[2,3]` | - | - |
| 1 | E・通常攻撃のあと 通常攻撃 2 回 + 重撃を繰り返す | `attacker` | 40 | `["e","n"]` | - | `["n","n","ca"]×[4,5,6]` | - | - |
| 2 | E のあと、もう一度 CA→N×3→DASH→N×3→DASH→N×3→DASH→N×3→DASH→N×3→DASH→N×3 | `attacker` | 40 | `["e"]` | `50:["ca","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n"]` | - | - | `{"min":0}` |
| 3 | ca→n×3→dash→n×3→dash→n×3→dash→n×3→dash→n×3→dash→n×3 | `attacker` | 40 | `["ca","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n","dash","n","n","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **260** 件 / 新パーサー有効 **230** 件（旧パーサー有効 191 件 → **+39 件**）
- ループ内正規化パターン上位 5 件:
  1. **23件 (10.0%)** 平均 78.3k / 最大 104.9k | `use=["e"] then=[["ca","n"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[e] → [ca n×3 dash n×3 dash n×3 dash n×3 dash n×3]`
  2. **9件 (3.9%)** 平均 63.2k / 最大 82.9k | `use=["e"] then=[["ca"]] fill=["n","n","n","dash"] tail=["n"]` | 代表生: `[e] → [ca n×3 dash n×3 dash n×3 dash n×3 dash n×3 dash n]`
  3. **7件 (3.0%)** 平均 94.6k / 最大 112.9k | `use=["e"] then=[["n","ca","n"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[e] → [n ca n×3 dash n×3 dash n×3 dash n×3 dash n×3 dash n×3]`
  4. **7件 (3.0%)** 平均 105.7k / 最大 115.9k | `use=["e"] then=[["n","n","ca","n"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[e] → [n×2 ca n×3 dash n×3 dash n×3 dash n×3 dash n×3 dash n×3]`
  5. **7件 (3.0%)** 平均 83.6k / 最大 93.2k | `use=["e"] then=[["n"]] fill=["n","n","ca","n"] tail=["n","n"]` | 代表生: `[e] → [n×3 ca n×3 ca n×3 ca n×3 ca n×3 ca n×3]`
- 頻出 lead（初動）上位 3 件: `e` (21件), `e ca n×3 dash n×3 dash n×3 dash n×3 dash n×3 dash n×3` (2件), `e n×3 ca n×3 ca n×3 ca n×3 ca n×3 ca n×3 dash n` (1件)
- ループ最終Stint末尾アクション: `n` (170件), `dash` (17件), `e` (8件)

## 3. 胡桃 (`10000046-pyro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（5 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | Q→E→（通常2→重撃）×n | `attacker` | 40 | `["q","e"]` | - | `["n","n","ca"]×[8,9,10]` | - | - |
| 1 | E→（通常2→重撃）×n | `attacker` | 40 | `["e"]` | - | `["n","n","ca"]×[8,9,10,11]` | - | - |
| 2 | E のあと 通常攻撃 + 重撃を繰り返す | `attacker` | 40 | `["e"]` | - | `["n","ca"]×[4,5,6]` | - | - |
| 3 | 通常攻撃・E のあと 通常攻撃 + 重撃を繰り返す | `attacker` | 40 | `["n","e"]` | - | `["n","ca"]×[5,6]` | - | - |
| 4 | E→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N→CA→JUMP→N×2→CA→JUMP→N（KQM） | `attacker` | 40 | `["e","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","n","ca","jump","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **198** 件 / 新パーサー有効 **195** 件（旧パーサー有効 114 件 → **+81 件**）
- ループ内正規化パターン上位 5 件:
  1. **18件 (9.2%)** 平均 72.1k / 最大 91.2k | `use=["e","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump"] fill=["n","ca","jump","n"]` | 代表生: `[e n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n×2 ca jump n]`
  2. **11件 (5.6%)** 平均 188.3k / 最大 492.9k | `use=["e"] fill=["n","n","ca","dash"]` | 代表生: `[e n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash]`
  3. **6件 (3.1%)** 平均 70.4k / 最大 79.3k | `use=["e","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump","n","ca","jump"] fill=["n","ca","jump","n"] tail=["q"]` | 代表生: `[e n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n×2 ca jump n q]`
  4. **5件 (2.6%)** 平均 88.9k / 最大 107.4k | `use=["e"] fill=["n","n","ca","jump"] tail=["n","q"]` | 代表生: `[e n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n q]`
  5. **5件 (2.6%)** 平均 56.5k / 最大 107.7k | `use=["e"] fill=["n","n","ca","jump"]` | 代表生: `[e n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump n×2 ca jump]`
- 頻出 lead（初動）上位 3 件: `e n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n ca jump n×2 ca jump n q` (2件), `e n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash n×2 ca dash` (1件), `e` (1件)
- ループ最終Stint末尾アクション: `q` (30件), `n` (19件), `dash` (13件)

## 4. マーヴィカ (`10000106-pyro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, e_hold, e_recastframestobike, e_recastframestoring, q, dash, jump`

### 現在の `characters.ts`（6 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E・Q のあと 通常攻撃を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["n"]×[8,10,12]` | - | - |
| 1 | E・Q のあと 重撃を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["ca"]×[3,4,5]` | - | - |
| 2 | E・Q（サブ） | `subAttacker` | 20 | `["e","q"]` | - | - | - | - |
| 3 | Q→E（KQM） | `attacker` | 40 | `["q","e"]` | - | - | - | `{"min":0}` |
| 4 | Q→CA→E→DASH（KQM） | `attacker` | 40 | `["q","ca","e","dash"]` | - | - | - | `{"min":0}` |
| 5 | e→n | `subAttacker` | 20 | `["e","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **394** 件 / 新パーサー有効 **342** 件（旧パーサー有効 242 件 → **+100 件**）
- ループ内正規化パターン上位 5 件:
  1. **26件 (7.6%)** 平均 95.3k / 最大 468.3k | `use=["q","e"]` | 代表生: `[q e]`
  2. **23件 (6.7%)** 平均 73.1k / 最大 100.5k | `use=["q","e","dash"]` | 代表生: `[q e dash]`
  3. **16件 (4.7%)** 平均 102.2k / 最大 504.6k | `use=["q","ca","e","dash"]` | 代表生: `[q ca e dash]`
  4. **12件 (3.5%)** 平均 107.2k / 最大 539.5k | `use=["e","n"] then=[["q","ca","dash"]]` | 代表生: `[e n] → [q ca dash]`
  5. **10件 (2.9%)** 平均 160.4k / 最大 426.0k | `use=["q","ca","e"]` | 代表生: `[q ca e]`
- 頻出 lead（初動）上位 3 件: `e` (7件), `e_hold` (3件), `q e dash` (2件)
- ループ最終Stint末尾アクション: `dash` (62件), `ca` (45件), `n` (12件)

## 5. アルハイゼン (`10000078-dendro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（7 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→落下→Q | `attacker` | 40 | `["e","hp","q"]` | - | `["n"]×[8,10,12]` | - | - |
| 1 | Q→E→重撃（鏡の補充） | `attacker` | 40 | `["q","e","ca"]` | - | `["n"]×[8,10,12]` | - | - |
| 2 | Q のあと 通常攻撃を繰り返す | `attacker` | 40 | `["q"]` | - | `["n"]×[12,18]` | - | - |
| 3 | E_HOLD→LP→N×3→DASH→N×3→DASH→N×3 のあと、もう一度 Q、さらに N×3→DASH→N×3→CA→N×3→DASH→N×3→DASH→N×4 | `attacker` | 40 | `["e_hold","lp","n","n","n","dash","n","n","n","dash","n","n","n"]` | `50:["q"] / 55:["n","n","n","dash","n","n","n","ca","n","n","n","dash","n","n","n","dash","n","n","n","n"]` | - | - | `{"min":0}` |
| 4 | E_HOLD→LP→N×3→DASH→N×3→DASH→N×3 のあと、もう一度 Q、さらに N×3→DASH→N×3→CA→N×3→DASH→N×3→DASH→N×3 | `attacker` | 40 | `["e_hold","lp","n","n","n","dash","n","n","n","dash","n","n","n"]` | `50:["q"] / 55:["n","n","n","dash","n","n","n","ca","n","n","n","dash","n","n","n","dash","n","n","n"]` | - | - | `{"min":0}` |
| 5 | e_hold→lp→n×2→ca→dash→n×3→ca→dash | `attacker` | 40 | `["e_hold","lp","n","n","ca","dash","n","n","n","ca","dash"]` | - | - | - | `{"min":0}` |
| 6 | e_hold→lp→n×3→dash→n×3→dash→n×3 | `attacker` | 40 | `["e_hold","lp","n","n","n","dash","n","n","n","dash","n","n","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **175** 件 / 新パーサー有効 **168** 件（旧パーサー有効 126 件 → **+42 件**）
- ループ内正規化パターン上位 5 件:
  1. **8件 (4.8%)** 平均 57.0k / 最大 65.7k | `use=["e_hold","lp","n"] then=[["q"],["n","n","n","dash","n","n","n","ca","n","n"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[e_hold lp n×3 dash n×3 dash n×3] → [q] → [n×3 dash n×3 ca n×3 dash n×3 dash n×4]`
  2. **7件 (4.2%)** 平均 53.4k / 最大 66.7k | `use=["e_hold","lp","n"] then=[["q"],["n","n","n","dash","n","n","n","ca","n"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[e_hold lp n×3 dash n×3 dash n×3] → [q] → [n×3 dash n×3 ca n×3 dash n×3 dash n×3]`
  3. **5件 (3.0%)** 平均 55.9k / 最大 60.8k | `use=["q"] then=[["n","n","n","dash","n","n","n","ca","n","n","n","dash","n","n","n","e_hold","lp","n","n","n","dash","n","n"]]` | 代表生: `[q] → [n×3 dash n×3 ca n×3 dash n×3 e_hold lp n×3 dash n×2]`
  4. **4件 (2.4%)** 平均 83.9k / 最大 90.7k | `use=["q","n"] then=[["n"],["e_hold","lp"]] fill=["n","n","dash","n"] tail=["n","n"]` | 代表生: `[q n] → [n×3 dash n×3 dash n×3 dash n×3] → [e_hold lp n×3 dash n×3 dash n×3 dash]`
  5. **4件 (2.4%)** 平均 60.7k / 最大 67.1k | `use=["n","n","n","dash","n","n","n","ca","dash","n","n","n","ca","dash","n","e_hold","lp","n","n","n","n","ca","dash"] fill=["n","n"]` | 代表生: `[n×3 dash n×3 ca dash n×3 ca dash n e_hold lp n×4 ca dash n×4]`
- 頻出 lead（初動）上位 3 件: `n ca` (1件)
- ループ最終Stint末尾アクション: `n` (108件), `ca` (28件), `dash` (10件)

## 6. 神里綾華 (`10000002-cryo`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（3 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E・Q のあと ダッシュ + 通常攻撃を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["dash","n","n","n","n","n"]×[2,3,4]` | - | - |
| 1 | E・Q（爆発サブ） | `subAttacker` | 20 | `["e","q"]` | - | - | - | - |
| 2 | E→DASH→Q→N×2→CA→DASH→N×2→CA のあと、もう一度 DASH→N×2→CA→E→DASH→N×2→CA | `attacker` | 40 | `["e","dash","q","n","n","ca","dash","n","n","ca"]` | `50:["dash","n","n","ca","e","dash","n","n","ca"]` | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **142** 件 / 新パーサー有効 **135** 件（旧パーサー有効 114 件 → **+21 件**）
- ループ内正規化パターン上位 5 件:
  1. **6件 (4.4%)** 平均 65.4k / 最大 71.3k | `use=["e","dash","q","n","n","ca","dash","n","n","ca"] then=[["dash","n","n","ca","e","dash","n","n","ca"]]` | 代表生: `[e dash q n×2 ca dash n×2 ca] → [dash n×2 ca e dash n×2 ca]`
  2. **3件 (2.2%)** 平均 55.9k / 最大 58.1k | `use=["n","e","dash","n","q"] then=[["dash","n","ca"],["n","e","dash","n","n","ca"]]` | 代表生: `[n e dash n q] → [dash n ca] → [n e dash n×2 ca]`
  3. **3件 (2.2%)** 平均 64.1k / 最大 67.1k | `use=["e","dash","n","n","q","n","n","ca"] then=[["dash","n","n","ca","e","n","n","ca"]]` | 代表生: `[e dash n×2 q n×2 ca] → [dash n×2 ca e n×2 ca]`
  4. **3件 (2.2%)** 平均 47.6k / 最大 52.1k | `use=["dash","e"] then=[["dash","e","q"]]` | 代表生: `[dash e] → [dash e q]`
  5. **2件 (1.5%)** 平均 79.5k / 最大 80.1k | `use=["e","dash","n","q","n","ca","dash"] then=[["e","dash"]] fill=["n","n","ca"]` | 代表生: `[e dash n q n ca dash n×2 ca n×2 ca] → [e dash n ca n ca]`
- 頻出 lead（初動）上位 3 件: `dash` (27件), `dash e` (2件), `dash n e n ca` (1件)
- ループ最終Stint末尾アクション: `ca` (82件), `n` (17件), `e` (3件)

## 7. 神里綾人 (`10000066-hydro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（7 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | Q→E→通常を繰り返す | `attacker` | 40 | `["q","e"]` | - | `["n"]×[12,16,20]` | - | - |
| 1 | Q・ダッシュ・E のあと 通常攻撃を繰り返す | `attacker` | 40 | `["q","dash","e"]` | - | `["n"]×[18,21,24]` | - | - |
| 2 | Q のあと、もう一度 E→N×15、さらに E→N×15→Q | `attacker` | 40 | `["q"]` | `50:["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n"] / 55:["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n","q"]` | - | - | `{"min":0}` |
| 3 | Q のあと、もう一度 E→N×15、さらに E→N×15 | `attacker` | 40 | `["q"]` | `50:["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n"] / 55:["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n"]` | - | - | `{"min":0}` |
| 4 | E→N×15→Q のあと、もう一度 E→N×15 | `attacker` | 40 | `["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n","q"]` | `50:["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n"]` | - | - | `{"min":0}` |
| 5 | e→n×15 | `attacker` | 40 | `["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n"]` | - | - | - | `{"min":0}` |
| 6 | e→n×15→q | `attacker` | 40 | `["e","n","n","n","n","n","n","n","n","n","n","n","n","n","n","n","q"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **132** 件 / 新パーサー有効 **118** 件（旧パーサー有効 96 件 → **+22 件**）
- ループ内正規化パターン上位 5 件:
  1. **33件 (28.0%)** 平均 47.2k / 最大 99.2k | `use=["q"] then=[["e"],["e"]] fill=["n"]` | 代表生: `[q] → [e n×18] → [e n×15]`
  2. **23件 (19.5%)** 平均 74.7k / 最大 241.3k | `use=["e"] then=[["e"]] fill=["n"] tail=["q"]` | 代表生: `[e n×15 q] → [e n×14]`
  3. **10件 (8.5%)** 平均 54.9k / 最大 98.3k | `use=["q"] then=[["e"]] fill=["n"]` | 代表生: `[q] → [e n×13]`
  4. **8件 (6.8%)** 平均 44.9k / 最大 53.7k | `use=["e"] then=[["e"]] fill=["n"]` | 代表生: `[e n×15] → [e n×7 q]`
  5. **7件 (5.9%)** 平均 63.9k / 最大 73.3k | `use=["e"] then=[["n","e"]] fill=["n"] tail=["q"]` | 代表生: `[e n×15 q] → [n e n×15]`
- 頻出 lead（初動）上位 3 件: `q` (9件), `q e n×15 e n×15` (1件)
- ループ最終Stint末尾アクション: `n` (86件), `q` (11件)

## 8. 宵宮 (`10000049-pyro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, q, dash, jump`

### 現在の `characters.ts`（4 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | Q のあと 通常5×3 セット | `attacker` | 40 | `["q"]` | - | `["n","n","n","n","n"]×[3,4]` | - | - |
| 1 | E のあと 通常攻撃を繰り返す | `attacker` | 40 | `["e"]` | - | `["n"]×[17,19,21]` | - | - |
| 2 | E→N×5→DASH→N×5→DASH→N×5→DASH→N（KQM） | `attacker` | 40 | `["e","n","n","n","n","n","dash","n","n","n","n","n","dash","n","n","n","n","n","dash","n"]` | - | - | - | `{"min":0}` |
| 3 | E→N×5→DASH→N×5→DASH→N×5（KQM） | `attacker` | 40 | `["e","n","n","n","n","n","dash","n","n","n","n","n","dash","n","n","n","n","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **211** 件 / 新パーサー有効 **207** 件（旧パーサー有効 83 件 → **+124 件**）
- ループ内正規化パターン上位 5 件:
  1. **67件 (32.4%)** 平均 63.6k / 最大 298.8k | `use=["e","n","n","n","n","n","dash","n","n","n","n","n","dash","n","n","n","n","n","dash","n","q"]` | 代表生: `[e n×5 dash n×5 dash n×5 dash n q]`
  2. **35件 (16.9%)** 平均 62.2k / 最大 242.9k | `use=["e","n","n","n","n","n","dash","n","n","n","n","n","dash","n"] fill=["n","n"] tail=["dash","n"]` | 代表生: `[e n×5 dash n×5 dash n×5 dash n]`
  3. **15件 (7.2%)** 平均 55.2k / 最大 71.7k | `use=["e","n","n","n","n","n","dash","n","n","n","n","n","dash"] fill=["n","n"] tail=["n"]` | 代表生: `[e n×5 dash n×5 dash n×5]`
  4. **9件 (4.3%)** 平均 53.7k / 最大 60.6k | `use=["e","n","n","n","n","n","dash","n","n","n","n","n","dash","n"] then=[["q"]] fill=["n","n"] tail=["dash","n"]` | 代表生: `[e n×5 dash n×5 dash n×5 dash n] → [q]`
  5. **8件 (3.9%)** 平均 76.7k / 最大 97.4k | `use=["n","e","n","n","n","n","n","dash","n","n","n","n","n","dash","n","n","n","n","n","dash","n","q"]` | 代表生: `[n e n×5 dash n×5 dash n×5 dash n q]`
- 頻出 lead（初動）上位 3 件: `ca` (1件), `q` (1件)
- ループ最終Stint末尾アクション: `q` (85件), `n` (27件), `e` (1件)

## 9. エウルア (`10000051-cryo`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（3 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→Q→E→通常5→長押しE→通常2 | `attacker` | 40 | `["e","q","e","n","n","n","n","n","e_hold","n","n"]` | - | - | - | - |
| 1 | E→Q→長押しE→通常4→ダッシュ→通常4 | `attacker` | 40 | `["e","q","e_hold","n","n","n","n","dash","n","n","n","n"]` | - | - | - | - |
| 2 | E→Q→通常4→長押しE→通常4 | `attacker` | 40 | `["e","q","n","n","n","n","e_hold","n","n","n","n"]` | - | `["n"]×[4,8]` | - | - |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **99** 件 / 新パーサー有効 **98** 件（旧パーサー有効 4 件 → **+94 件**）
- ループ内正規化パターン上位 5 件:
  1. **5件 (5.1%)** 平均 78.8k / 最大 117.0k | `use=["e","n","q","n","n","n","n","e_hold"] fill=["n","n"]` | 代表生: `[e n q n×4 e_hold n×4]`
  2. **5件 (5.1%)** 平均 48.4k / 最大 74.9k | `use=["e","n"] then=[["q","n","n","n","n","e_hold"]] fill=["n","n"]` | 代表生: `[e n] → [q n×4 e_hold n×4]`
  3. **4件 (4.1%)** 平均 51.3k / 最大 60.3k | `use=["e","n","q","n","n","n","n","e_hold","n","n","n","n","dash","n","n"] then=[["n","n"]]` | 代表生: `[e n q n×4 e_hold n×4 dash n×2] → [n×2]`
  4. **4件 (4.1%)** 平均 59.5k / 最大 61.5k | `use=["e","n"] then=[["q","n","e_hold","jump","hp","dash"]]` | 代表生: `[e n] → [q n e_hold jump hp dash]`
  5. **4件 (4.1%)** 平均 37.6k / 最大 39.3k | `use=["e","n"] then=[["e","q","n","n","n","n","e_hold"],["n","n"],["n","n"]] fill=["n","n"]` | 代表生: `[e n] → [e q n×4 e_hold n×4] → [n×2] → [n×2]`
- 頻出 lead（初動）上位 3 件: `e` (4件)
- ループ最終Stint末尾アクション: `n` (39件), `dash` (13件), `e` (6件)

## 10. 荒瀧一斗 (`10000057-geo`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（7 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | Q→通常1→E→重撃 | `attacker` | 40 | `["q","n","e","ca"]` | - | `["n","n","ca"]×[2,3]` | - | - |
| 1 | 通常2→重撃の繰り返し | `attacker` | 40 | `[]` | - | `["n","n","ca"]×[4,6,8]` | - | - |
| 2 | E→重撃の繰り返し（爆発なし） | `attacker` | 40 | `[]` | - | `["e","ca"]×[4,6,8]` | - | - |
| 3 | E・Q のあと 通常攻撃 3 回 + 重撃を繰り返す | `attacker` | 40 | `["e","q"]` | - | `["n","n","n","ca"]×[3,4]` | - | - |
| 4 | N→Q→N→E→N×2→CA×5→DASH→N×4→CA×5→E→CA（KQM） | `attacker` | 40 | `["n","q","n","e","n","n","ca","ca","ca","ca","ca","dash","n","n","n","n","ca","ca","ca","ca","ca","e","ca"]` | - | - | - | `{"min":0}` |
| 5 | 通常→Q→通常→E→重撃連打の周回 | `attacker` | 40 | `["n","q","n","e","n","n","ca","ca","ca","ca","ca","n","n","n","n","ca","ca","ca","ca","ca","e","ca"]` | - | - | - | `{"min":0}` |
| 6 | Q→E→重撃→E→重撃（マーヴィカ編成など） | `attacker` | 40 | `["q","e","ca","n","e","ca"]` | - | - | - | - |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **76** 件 / 新パーサー有効 **76** 件（旧パーサー有効 40 件 → **+36 件**）
- ループ内正規化パターン上位 5 件:
  1. **23件 (30.3%)** 平均 50.9k / 最大 88.5k | `use=["n","q","n","e","n","n","ca","ca","ca","ca","ca","n","n","n","n","ca"] fill=["ca","ca"] tail=["e","ca"]` | 代表生: `[n q n e n×2 ca×5 n×4 ca×5 e ca]`
  2. **21件 (27.6%)** 平均 44.9k / 最大 60.0k | `use=["n","q","n","e","ca","ca","ca","ca","n","n","n","ca","ca","ca","ca","n","n","n","e"] fill=["ca","ca"]` | 代表生: `[n q n e ca×4 n×3 ca×4 n×3 e ca×4]`
  3. **8件 (10.5%)** 平均 57.7k / 最大 66.0k | `use=["n","q","n","e","n","n","ca","ca","ca","ca","ca","dash","n","n","n","n","ca"] fill=["ca","ca"] tail=["e","ca"]` | 代表生: `[n q n e n×2 ca×5 dash n×4 ca×5 e ca]`
  4. **4件 (5.3%)** 平均 70.3k / 最大 96.8k | `use=["ca"]` | 代表生: `[ca]`
  5. **3件 (3.9%)** 平均 38.5k / 最大 39.7k | `use=["n"] then=[["n","q","n","e","ca","ca","ca","ca","n","n","n","ca","ca","ca","ca","n","n","n","e"]] fill=["ca","ca"]` | 代表生: `[n] → [n q n e ca×4 n×3 ca×4 n×3 e ca×4]`
- 頻出 lead（初動）上位 3 件: `n q n e n×2 ca×5 n×4 ca×5 e ca` (27件), `n q e` (4件), `n q n e ca×7 n×4 ca×5 e ca` (1件)
- ループ最終Stint末尾アクション: `ca` (70件), `e` (2件)

## 11. ティナリ (`10000069-dendro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, q, dash, jump`

### 現在の `characters.ts`（7 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→重撃×3→Q | `attacker` | 40 | `["e","ca","ca","ca","q"]` | - | - | - | - |
| 1 | E・Q（サブ） | `subAttacker` | 20 | `["e","q"]` | - | - | - | - |
| 2 | E・Q のあと 狙い撃ちを繰り返す | `attacker` | 40 | `["e","q"]` | - | `["ca"]×[3,4]` | - | - |
| 3 | E→CA→Q→CA×2 のあと、もう一度 E→CA×3 | `attacker` | 40 | `["e","ca","q","ca","ca"]` | `50:["e","ca","ca","ca"]` | - | - | `{"min":0}` |
| 4 | E→CA→Q→CA×2 のあと、もう一度 E→CA→Q→CA×2 | `attacker` | 40 | `["e","ca","q","ca","ca"]` | `50:["e","ca","q","ca","ca"]` | - | - | `{"min":0}` |
| 5 | E→CA×3→Q のあと、もう一度 E→CA×3→Q | `attacker` | 40 | `["e","ca","ca","ca","q"]` | `50:["e","ca","ca","ca","q"]` | - | - | `{"min":0}` |
| 6 | e→ca→q→ca×2 | `attacker` | 40 | `["e","ca","q","ca","ca"]` | - | - | - | - |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **85** 件 / 新パーサー有効 **80** 件（旧パーサー有効 49 件 → **+31 件**）
- ループ内正規化パターン上位 5 件:
  1. **16件 (20.0%)** 平均 56.0k / 最大 69.4k | `use=["e","ca","q","ca","ca"]` | 代表生: `[e ca q ca×2]`
  2. **11件 (13.8%)** 平均 59.2k / 最大 77.5k | `use=["e","ca","q","ca","ca"] then=[["e","ca","q","ca","ca"]]` | 代表生: `[e ca q ca×2] → [e ca q ca×2]`
  3. **10件 (12.5%)** 平均 63.7k / 最大 79.4k | `use=["e","ca","q","ca","ca"] then=[["e","ca","ca","ca"]]` | 代表生: `[e ca q ca×2] → [e ca×3]`
  4. **5件 (6.3%)** 平均 83.8k / 最大 197.3k | `use=["e","ca","ca","ca","q"] then=[["e","ca","ca","ca","q"]]` | 代表生: `[e ca×3 q] → [e ca×3 q]`
  5. **4件 (5.0%)** 平均 40.4k / 最大 48.8k | `use=["e","ca","ca","ca","q"]` | 代表生: `[e ca×3 q]`
- 頻出 lead（初動）上位 3 件: `e ca×3 e ca×3 q` (1件), `e ca n ca n ca q` (1件)
- ループ最終Stint末尾アクション: `ca` (25件), `q` (9件), `n` (3件)

## 12. フリンズ (`10000120-electro`)
- **マスター roles**: `[attacker]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, e_spearstorm, q, q_special, dash, jump`

### 現在の `characters.ts`（4 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→E（特殊）→Q（特殊）のあと 通常 + E + Q | `attacker` | 40 | `["e","e","q"]` | - | `["n","n","n","n","e","q"]×[1,2]` | - | - |
| 1 | Q・E のあと 通常攻撃 2 回 + 重撃を繰り返す | `attacker` | 40 | `["q","e"]` | - | `["n","n","ca"]×[3,4,5]` | - | - |
| 2 | e→n→e→n→q→n×3→dash→n×3→e→n→q→n×3→dash→n×3→e→q→n | `attacker` | 40 | `["e","n","e","n","q","n","n","n","dash","n","n","n","e","n","q","n","n","n","dash","n","n","n","e","q","n"]` | - | - | - | `{"min":6}` |
| 3 | e→n→e→n→q→n×4→dash→n×4→dash→n×2→e→n→q→n×4 | `attacker` | 40 | `["e","n","e","n","q","n","n","n","n","dash","n","n","n","n","dash","n","n","e","n","q","n","n","n","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **34** 件 / 新パーサー有効 **34** 件（旧パーサー有効 18 件 → **+16 件**）
- ループ内正規化パターン上位 5 件:
  1. **4件 (11.8%)** 平均 119.5k / 最大 149.0k | `use=["e","n","e","n","q","n","n","n","n","dash","n","n","n","n","dash","n","n","e","n","q"] fill=["n","n"]` | 代表生: `[e n e n q n×4 dash n×4 dash n×2 e n q n×4]`
  2. **3件 (8.8%)** 平均 154.3k / 最大 179.9k | `use=["e","n","e","q","n","n","n","n","dash","n","n","e","n","q","n","n","n","n","dash","n","n","e","n","q","n","n"]` | 代表生: `[e n e q n×4 dash n×2 e n q n×4 dash n×2 e n q n×2]`
  3. **2件 (5.9%)** 平均 161.4k / 最大 168.2k | `use=["e","n","e","q","n","n","n","n","dash","n","n","e","n","q","n","n","n","n","dash","n","n","e","n","q","n"]` | 代表生: `[e n e q n×4 dash n×2 e n q n×4 dash n×2 e n q n]`
  4. **2件 (5.9%)** 平均 103.7k / 最大 118.3k | `use=["e","n","e","n","q","n","n","n","n","dash","n","n","n","n","dash","n","n","e","n","q","n","n"]` | 代表生: `[e n e n q n×4 dash n×4 dash n×2 e n q n×2]`
  5. **2件 (5.9%)** 平均 1002.5k / 最大 1463.8k | `use=["e","n","e","n","q","n","n","n","dash","n","n","n","e","n","q","n","n","n","dash","n","n","n","e","q","n"]` | 代表生: `[e n e n q n×3 dash n×3 e n q n×3 dash n×3 e q n]`
- ループ最終Stint末尾アクション: `n` (12件), `dash` (3件), `q` (2件)

## 13. 夜蘭 (`10000060-hydro`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, q, dash, jump`

### 現在の `characters.ts`（6 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E と Q | `supporter` | 30 | `["e","q"]` | - | - | - | - |
| 1 | E | `subAttacker` | 25 | `["e"]` | - | - | - | - |
| 2 | E→Q→N（KQM） | `supporter` | 10 | `["e","q","n"]` | - | - | - | `{"min":0}` |
| 3 | E→N→Q→N（KQM） | `supporter` | 10 | `["e","n","q","n"]` | - | - | - | `{"min":0}` |
| 4 | n→e→n | `supporter` | 30 | `["n","e","n"]` | - | - | - | `{"min":0}` |
| 5 | q→n→e→n | `supporter` | 30 | `["q","n","e","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **919** 件 / 新パーサー有効 **905** 件（旧パーサー有効 599 件 → **+306 件**）
- ループ内正規化パターン上位 5 件:
  1. **90件 (9.9%)** 平均 63.5k / 最大 89.2k | `use=["e","ca","q","n"]` | 代表生: `[e ca q n]`
  2. **86件 (9.5%)** 平均 65.8k / 最大 143.8k | `use=["e","q","n"]` | 代表生: `[e q n]`
  3. **78件 (8.6%)** 平均 70.8k / 最大 138.1k | `use=["e","n","q","n"]` | 代表生: `[e n q n]`
  4. **27件 (3.0%)** 平均 68.2k / 最大 96.4k | `use=["n","e","q","n","n"]` | 代表生: `[n e q n×2]`
  5. **26件 (2.9%)** 平均 78.7k / 最大 81.6k | `use=["e","n","q"] then=[["n","n","e","n"]]` | 代表生: `[e n q] → [n×2 e n]`
- 頻出 lead（初動）上位 3 件: `ca` (7件), `q n e n e n×2` (5件), `e q n` (3件)
- ループ最終Stint末尾アクション: `n` (145件), `dash` (4件), `e` (3件)

## 14. シロネン (`10000103-geo`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（6 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E と Q | `supporter` | 20 | `["e","q"]` | - | - | - | - |
| 1 | Q のあと、もう一度 E→N×2、さらに E→N×2 | `supporter` | 10 | `["q"]` | `30:["e","n","n"] / 35:["e","n","n"]` | - | - | `{"min":0}` |
| 2 | E→N×2→Q のあと、もう一度 E→N×2 | `supporter` | 10 | `["e","n","n","q"]` | `30:["e","n","n"]` | - | - | `{"min":0}` |
| 3 | E→Q→N×2 のあと、もう一度 E→N×2 | `supporter` | 10 | `["e","q","n","n"]` | `30:["e","n","n"]` | - | - | `{"min":0}` |
| 4 | E→N→N のあと、もう一度 E→N→N | `supporter` | 10 | `["e","n","n"]` | `30:["e","n","n"]` | - | - | `{"min":0}` |
| 5 | e→n×2 | `supporter` | 20 | `["e","n","n"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **676** 件 / 新パーサー有効 **650** 件（旧パーサー有効 515 件 → **+135 件**）
- ループ内正規化パターン上位 5 件:
  1. **173件 (26.6%)** 平均 113.1k / 最大 853.9k | `use=["e","n","n"]` | 代表生: `[e n×2]`
  2. **127件 (19.5%)** 平均 196.3k / 最大 2063.3k | `use=["e","n","n"] then=[["e","n","n"]]` | 代表生: `[e n×2] → [e n×2]`
  3. **70件 (10.8%)** 平均 67.7k / 最大 196.8k | `use=["q"] then=[["e","n","n"],["e","n","n"]]` | 代表生: `[q] → [e n×2] → [e n×2]`
  4. **48件 (7.4%)** 平均 75.1k / 最大 373.5k | `use=["e","n","n","q"] then=[["e","n","n"]]` | 代表生: `[e n×2 q] → [e n×2]`
  5. **27件 (4.2%)** 平均 102.1k / 最大 436.6k | `use=["e","q","n","n"] then=[["e","n","n"]]` | 代表生: `[e q n×2] → [e n×2]`
- 頻出 lead（初動）上位 3 件: `e n×2` (6件), `q e n×2 e n×2` (4件), `q e n×2` (1件)
- ループ最終Stint末尾アクション: `n` (62件), `q` (16件)

## 15. 鍾離 (`10000030-geo`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（7 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | 長押し E | `supporter` | 10 | `["e_hold"]` | - | - | - | - |
| 1 | N→E_HOLD→DASH（KQM） | `supporter` | 10 | `["n","e_hold","dash"]` | - | - | - | `{"min":0}` |
| 2 | E_HOLD→DASH（KQM） | `supporter` | 10 | `["e_hold","dash"]` | - | - | - | `{"min":0}` |
| 3 | E_HOLD→DASH×2→N（KQM） | `supporter` | 10 | `["e_hold","dash","dash","n"]` | - | - | - | `{"min":0}` |
| 4 | E_HOLD→DASH→N（KQM） | `supporter` | 10 | `["e_hold","dash","n"]` | - | - | - | `{"min":0}` |
| 5 | E_HOLD→DASH×2→N のあと、もう一度 E_HOLD→DASH×2→N | `supporter` | 10 | `["e_hold","dash","dash","n"]` | `30:["e_hold","dash","dash","n"]` | - | - | `{"min":0}` |
| 6 | E_HOLD→DASH のあと、もう一度 E_HOLD→DASH | `supporter` | 10 | `["e_hold","dash"]` | `30:["e_hold","dash"]` | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **530** 件 / 新パーサー有効 **504** 件（旧パーサー有効 264 件 → **+240 件**）
- ループ内正規化パターン上位 5 件:
  1. **73件 (14.5%)** 平均 55.5k / 最大 227.8k | `use=["e_hold","dash","n"]` | 代表生: `[e_hold dash n]`
  2. **72件 (14.3%)** 平均 62.8k / 最大 290.8k | `use=["e_hold","dash","n","n"]` | 代表生: `[e_hold dash n×2]`
  3. **49件 (9.7%)** 平均 58.1k / 最大 241.2k | `use=["e_hold","dash"]` | 代表生: `[e_hold dash]`
  4. **36件 (7.1%)** 平均 54.7k / 最大 77.5k | `use=["e_hold","dash","dash","n"] then=[["e_hold","dash","dash","n"]]` | 代表生: `[e_hold dash×2 n] → [e_hold dash×2 n]`
  5. **31件 (6.2%)** 平均 59.6k / 最大 302.3k | `use=["n","e_hold","dash","n"]` | 代表生: `[n e_hold dash n]`
- 頻出 lead（初動）上位 3 件: `e_hold dash` (16件), `e_hold` (2件), `e_hold dash n` (1件)
- ループ最終Stint末尾アクション: `n` (18件), `dash` (10件), `q` (9件)

## 16. ウェンティ (`10000022-anemo`)
- **マスター roles**: `[attacker, supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, hp, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（3 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E と Q | `supporter` | 30 | `["e","q"]` | - | - | - | - |
| 1 | Q のあと、もう一度 E→N、さらに E→N | `supporter` | 10 | `["q"]` | `30:["e","n"] / 35:["e","n"]` | - | - | `{"min":0}` |
| 2 | E→Q のあと、もう一度 E→N | `supporter` | 10 | `["e","q"]` | `30:["e","n"]` | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **64** 件 / 新パーサー有効 **63** 件（旧パーサー有効 55 件 → **+8 件**）
- ループ内正規化パターン上位 5 件:
  1. **34件 (54.0%)** 平均 47.0k / 最大 152.3k | `use=["e","q"] then=[["e","n"]]` | 代表生: `[e q] → [e n]`
  2. **11件 (17.5%)** 平均 70.8k / 最大 207.9k | `use=["e","q"]` | 代表生: `[e q]`
  3. **3件 (4.8%)** 平均 61.6k / 最大 70.5k | `use=["e","q","n"]` | 代表生: `[e q n]`
  4. **3件 (4.8%)** 平均 40.2k / 最大 45.6k | `use=["q"] then=[["e","n"],["e","n"]]` | 代表生: `[q] → [e n] → [e n]`
  5. **1件 (1.6%)** 平均 44.9k / 最大 44.9k | `use=["e","q"] then=[["e"]]` | 代表生: `[e q] → [e]`
- ループ最終Stint末尾アクション: `n` (12件), `e` (2件)

## 17. 申鶴 (`10000063-cryo`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（8 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→Q→E | `supporter` | 10 | `["e","q","e"]` | - | - | - | - |
| 1 | e q の出場 | `supporter` | 20 | `["e","q"]` | - | - | - | - |
| 2 | E_HOLD→N→Q→N（KQM） | `supporter` | 10 | `["e_hold","n","q","n"]` | - | - | - | `{"min":0}` |
| 3 | Q→E のあと、もう一度 E→N | `supporter` | 10 | `["q","e"]` | `30:["e","n"]` | - | - | `{"min":0}` |
| 4 | E→Q のあと、もう一度 N→E | `supporter` | 10 | `["e","q"]` | `30:["n","e"]` | - | - | `{"min":0}` |
| 5 | N→E_HOLD→N のあと、もう一度 N→E_HOLD→N | `supporter` | 10 | `["n","e_hold","n"]` | `30:["n","e_hold","n"]` | - | - | `{"min":0}` |
| 6 | E→Q のあと、もう一度 E→N | `supporter` | 10 | `["e","q"]` | `30:["e","n"]` | - | - | `{"min":0}` |
| 7 | 長押しE→Q | `supporter` | 10 | `["e_hold","q"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **301** 件 / 新パーサー有効 **297** 件（旧パーサー有効 202 件 → **+95 件**）
- ループ内正規化パターン上位 5 件:
  1. **42件 (14.1%)** 平均 57.1k / 最大 72.8k | `use=["e","q"] then=[["e","n"]]` | 代表生: `[e q] → [e n]`
  2. **35件 (11.8%)** 平均 126.1k / 最大 980.5k | `use=["e_hold","q"]` | 代表生: `[e_hold q]`
  3. **26件 (8.8%)** 平均 68.1k / 最大 110.0k | `use=["e_hold","n","q","n"]` | 代表生: `[e_hold n q n]`
  4. **16件 (5.4%)** 平均 69.9k / 最大 370.0k | `use=["q","e"] then=[["e","n"]]` | 代表生: `[q e] → [e n]`
  5. **12件 (4.0%)** 平均 52.4k / 最大 61.6k | `use=["e_hold","n","q"]` | 代表生: `[e_hold n q]`
- 頻出 lead（初動）上位 3 件: `e n×2` (1件), `n e_hold n` (1件)
- ループ最終Stint末尾アクション: `n` (14件), `e` (3件), `q` (1件)

## 18. 白朮 (`10000082-dendro`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★5
- **availableActions**: `n, ca, e, q, dash, jump`

### 現在の `characters.ts`（8 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | E→Q→E | `supporter` | 10 | `["e","q","e"]` | - | - | - | - |
| 1 | q の出場 | `supporter` | 10 | `["q"]` | - | - | - | - |
| 2 | N→E→Q（KQM） | `supporter` | 10 | `["n","e","q"]` | - | - | - | `{"min":0}` |
| 3 | E→N→Q のあと、もう一度 E→N | `supporter` | 10 | `["e","n","q"]` | `30:["e","n"]` | - | - | `{"min":0}` |
| 4 | E→Q のあと、もう一度 E→N | `supporter` | 10 | `["e","q"]` | `30:["e","n"]` | - | - | `{"min":0}` |
| 5 | E→Q（KQM） | `supporter` | 10 | `["e","q"]` | - | - | - | `{"min":0}` |
| 6 | e→q→n | `supporter` | 10 | `["e","q","n"]` | - | - | - | `{"min":0}` |
| 7 | e→n→q | `supporter` | 10 | `["e","n","q"]` | - | - | - | `{"min":0}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **157** 件 / 新パーサー有効 **152** 件（旧パーサー有効 127 件 → **+25 件**）
- ループ内正規化パターン上位 5 件:
  1. **27件 (17.8%)** 平均 65.3k / 最大 219.1k | `use=["e","q"]` | 代表生: `[e q]`
  2. **14件 (9.2%)** 平均 62.0k / 最大 78.2k | `use=["e","n","q"]` | 代表生: `[e n q]`
  3. **9件 (5.9%)** 平均 63.8k / 最大 73.0k | `use=["e","n","q"] then=[["e","n"]]` | 代表生: `[e n q] → [e n]`
  4. **7件 (4.6%)** 平均 58.7k / 最大 85.9k | `use=["n","e","q"]` | 代表生: `[n e q]`
  5. **6件 (3.9%)** 平均 55.4k / 最大 63.0k | `use=["e","n","q","n"]` | 代表生: `[e n q n]`
- ループ最終Stint末尾アクション: `n` (26件), `dash` (4件), `ca` (3件)

## 19. シュヴルーズ (`10000090-pyro`)
- **マスター roles**: `[supporter]` / **レアリティ**: ★4
- **availableActions**: `n, ca, e, e_hold, q, dash, jump`

### 現在の `characters.ts`（6 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | e_hold の出場 | `supporter` | 20 | `["e_hold"]` | - | - | - | - |
| 1 | Q→E_HOLD×2（KQM） | `supporter` | 10 | `["q","e_hold","e_hold"]` | - | - | - | `{"min":4}` |
| 2 | Q→E_HOLD（KQM） | `supporter` | 10 | `["q","e_hold"]` | - | - | - | - |
| 3 | E_HOLD→Q（KQM） | `supporter` | 10 | `["e_hold","q"]` | - | - | - | - |
| 4 | Q→E_HOLD→N（KQM） | `supporter` | 10 | `["q","e_hold","n"]` | - | - | - | `{"min":0}` |
| 5 | q→e_hold×3 | `supporter` | 20 | `["q","e_hold","e_hold","e_hold"]` | - | - | - | `{"min":4}` |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **437** 件 / 新パーサー有効 **305** 件（旧パーサー有効 220 件 → **+85 件**）
- ループ内正規化パターン上位 5 件:
  1. **65件 (21.3%)** 平均 83.8k / 最大 787.5k | `use=["q","e_hold","e_hold","e_hold"]` | 代表生: `[q e_hold×3]`
  2. **58件 (19.0%)** 平均 88.3k / 最大 774.7k | `use=["q","e_hold"]` | 代表生: `[q e_hold]`
  3. **39件 (12.8%)** 平均 94.0k / 最大 424.4k | `use=["e_hold","q"]` | 代表生: `[e_hold q]`
  4. **34件 (11.1%)** 平均 68.0k / 最大 96.8k | `use=["q","e_hold","e_hold"]` | 代表生: `[q e_hold×2]`
  5. **25件 (8.2%)** 平均 62.5k / 最大 96.0k | `use=["q","e_hold","n"]` | 代表生: `[q e_hold n]`
- 頻出 lead（初動）上位 3 件: `q e_hold` (22件), `q e_hold×3` (1件), `q e_hold×2 n` (1件)
- ループ最終Stint末尾アクション: `e_hold` (9件), `n` (3件), `dash` (1件)

## 20. スクロース (`10000043-anemo`)
- **マスター roles**: `[attacker, supporter]` / **レアリティ**: ★4
- **availableActions**: `n, ca, lp, hp, e, q, dash, jump`

### 現在の `characters.ts`（2 件）
| # | name | role | slot | use | then | fill | lead | const |
| ---: | :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 0 | n→e→dash | `subAttacker` | 30 | `["n","e","dash"]` | - | - | - | - |
| 1 | E・通常攻撃・重撃 | `subAttacker` | 30 | `["e","n","n","n","n","ca","n","n","n","ca"]` | - | - | - | - |

### KQM-DB 新パーサー集計
- 集計総件数: 登場 **273** 件 / 新パーサー有効 **265** 件（旧パーサー有効 101 件 → **+164 件**）
- ループ内正規化パターン上位 5 件:
  1. **16件 (6.0%)** 平均 119.6k / 最大 468.3k | `use=["e","dash","q"]` | 代表生: `[e dash q]`
  2. **8件 (3.0%)** 平均 103.9k / 最大 188.6k | `use=["e","dash","q","n"]` | 代表生: `[e dash q n]`
  3. **8件 (3.0%)** 平均 183.6k / 最大 541.1k | `use=["n","q"] then=[["n","e","dash"]]` | 代表生: `[n q] → [n e dash]`
  4. **7件 (2.6%)** 平均 112.7k / 最大 217.3k | `use=["n","e","dash"]` | 代表生: `[n e dash]`
  5. **7件 (2.6%)** 平均 65.7k / 最大 69.4k | `use=["n","n","e","dash","q"] then=[["n","e","dash","n"]]` | 代表生: `[n×2 e dash q] → [n e dash n]`
- 頻出 lead（初動）上位 3 件: `e dash q` (1件), `e dash q n` (1件), `e dash` (1件)
- ループ最終Stint末尾アクション: `n` (30件), `ca` (14件), `dash` (13件)
