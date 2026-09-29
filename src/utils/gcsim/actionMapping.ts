/**
 * アプリのアクション定義 ID → gcsim の命令 の対応（フェーズ4 / O4）
 *
 * アクション定義 ID は「<キャラID>_<末尾>」（例: 10000073-dendro_e_hold）。
 * 共通規則は末尾で引き、共通規則に当てはまらない派生アクションは、キャラごとの対応表（アクション定義 ID をキー）で指定する。
 * どちらにも無いアクションは「変換規則なし」として警告する。
 */

/** キャラごとの対応表（キー: アクション定義 ID、値: gcsim の命令。パラメータ付きは `skill[hold=1]` の形） */
export const CHARACTER_ACTION_OVERRIDES: Record<string, string> = {
  // gcsim へのパラメータ指定が必要な派生スキル（B。フェーズ3d）
  '10000031-electro_e_recast': 'skill[recast=1]',
  '10000053-anemo_e_shorthold': 'skill[short_hold=1]',
  '10000061-dendro_e_shorthold': 'skill[short_hold=1]',
  '10000005-hydro_e_shorthold': 'skill[hold=1,hold_ticks=1]',
  '10000005-hydro_e_shorthold0ticks': 'skill[hold=1,hold_ticks=0]',
  '10000106-pyro_e_recastframestobike': 'skill[recast=1]',
  '10000106-pyro_e_recastframestoring': 'skill[recast=1]',
};

export interface MappedAction {
  /** gcsim の命令（例: `attack`, `skill[hold=1]`）。対応なしは undefined */
  command?: string;
}

/** アクション定義 ID の末尾（旅人の性別サフィックスは除く） */
export const actionSuffix = (actionTypeId: string): string =>
  actionTypeId.slice(actionTypeId.indexOf('_') + 1).replace(/_(aether|lumine)$/, '');

export function mapAction(actionTypeId: string, weaponType?: string): MappedAction {
  const override = CHARACTER_ACTION_OVERRIDES[actionTypeId];
  if (override) return { command: override };

  const suffix = actionSuffix(actionTypeId);
  switch (suffix) {
    // 通常攻撃はボタン「N」1つ。段は gcsim が連続した attack から自動で数える
    case 'n': return { command: 'attack' };
    case 'ca': return { command: weaponType === 'bow' ? 'aim' : 'charge' };
    case 'e': return { command: 'skill' };
    case 'e_hold': return { command: 'skill[hold=1]' };
    case 'q': return { command: 'burst' };
    case 'dash': return { command: 'dash' };
    default: return {};
  }
}
