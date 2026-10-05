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
  '10000007-hydro_e_shorthold': 'skill[hold=1,hold_ticks=1]',
  '10000007-hydro_e_shorthold0ticks': 'skill[hold=1,hold_ticks=0]',
  '10000106-pyro_e_recastframestobike': 'skill[recast=1]',
  '10000106-pyro_e_recastframestoring': 'skill[recast=1]',
  // 特殊元素スキル（別のCT。2026-10-01）: gcsim は、スキルの後の一定時間、同じ `skill` 命令を特殊スキルに自動で切り替える
  '10000150-cryo_e_recast': 'skill',
  '10000128-anemo_e_specialskill': 'skill',
  // 特殊爆発（フリンズ。嵐槍の後 6 秒の間、gcsim は同じ `burst` 命令を特殊爆発に自動で切り替える）
  '10000120-electro_q_special': 'burst',
};

/**
 * 長押しの長さ（フレーム）を `hold=<フレーム数>` で渡すアクション（gcsim の上限は 600 = 10 秒）。
 * 値はユーザーが編集した所要時間から逆算した長押し秒数（holdSeconds）。早柚・綺良々
 */
export const HOLD_FRAMES_ACTIONS = new Set<string>(['10000053-anemo_e_hold', '10000061-dendro_e_hold']);
const MAX_HOLD_FRAMES = 600;

/** 長押しの秒数を gcsim の命令に反映する（対象外のアクション・秒数が不明なときは、そのまま返す） */
export function applyHoldSeconds(actionTypeId: string, command: string, holdSeconds: number | undefined): string {
  if (!HOLD_FRAMES_ACTIONS.has(actionTypeId) || holdSeconds === undefined) return command;
  const frames = Math.min(MAX_HOLD_FRAMES, Math.max(1, Math.round(holdSeconds * 60)));
  return command.replace(/\[.*$/, '') + `[hold=${frames}]`;
}

export interface MappedAction {
  /** gcsim の命令（例: `attack`, `skill[hold=1]`）。対応なしは undefined */
  command?: string;
}

/** アクション定義 ID の末尾 */
export const actionSuffix = (actionTypeId: string): string =>
  actionTypeId.slice(actionTypeId.indexOf('_') + 1);

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
    // 落下攻撃（フェーズ3f / D48）。gcsim は空中状態などの前提条件があり、実行できない場合がある
    case 'lp': return { command: 'low_plunge' };
    case 'hp': return { command: 'high_plunge' };
    default: return {};
  }
}
