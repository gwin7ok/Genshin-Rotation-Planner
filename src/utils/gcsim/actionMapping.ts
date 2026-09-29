/**
 * アプリのアクション定義 ID → gcsim の命令 の対応（フェーズ4 / O4）
 *
 * アクション定義 ID は「<キャラID>_<末尾>」（例: 10000073-dendro_e_hold）。
 * 共通規則は末尾で引き、共通規則に当てはまらない派生アクションは、キャラごとの対応表（アクション定義 ID をキー）で指定する。
 * どちらにも無いアクションは「変換規則なし」として警告する。
 */

/** キャラごとの対応表（キー: アクション定義 ID、値: gcsim の命令。パラメータ付きは `skill[hold=1]` の形） */
export const CHARACTER_ACTION_OVERRIDES: Record<string, string> = {
  // ニィロウ: E 後の「七域のダンス」中は、通常攻撃が剣舞、スキルがステップになる（gcsim の pirouette 状態）
  '10000070-hydro_e_sworddance': 'attack',
  '10000070-hydro_e_whirlingsteps': 'skill',
};

export interface MappedAction {
  /** gcsim の命令（例: `attack`, `skill[hold=1]`）。対応なしは undefined */
  command?: string;
  /** 通常攻撃の段数（`nN` のとき）。連続性の確認に使う */
  normalIndex?: number;
}

/** アクション定義 ID の末尾（旅人の性別サフィックスは除く） */
export const actionSuffix = (actionTypeId: string): string =>
  actionTypeId.slice(actionTypeId.indexOf('_') + 1).replace(/_(aether|lumine)$/, '');

export function mapAction(actionTypeId: string, weaponType?: string): MappedAction {
  const override = CHARACTER_ACTION_OVERRIDES[actionTypeId];
  if (override) return { command: override };

  const suffix = actionSuffix(actionTypeId);
  const normal = /^n(\d+)$/.exec(suffix);
  if (normal) return { command: 'attack', normalIndex: Number(normal[1]) };
  switch (suffix) {
    case 'ca': return { command: weaponType === 'bow' ? 'aim' : 'charge' };
    case 'e': return { command: 'skill' };
    case 'e_hold': return { command: 'skill[hold=1]' };
    case 'q': return { command: 'burst' };
    case 'dash': return { command: 'dash' };
    default: return {};
  }
}
