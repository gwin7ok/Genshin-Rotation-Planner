/**
 * 重撃（charge）の直前に通常攻撃（attack）が必要なキャラ（gcsim の制約）
 *
 * gcsim はこれらのキャラの重撃を「通常攻撃の派生」として実装しており、直前のアクションが attack でないと
 * `need to use attack right before charge` で実行エラーになる（pkg/core/player/exec.go の ErrInvalidChargeAction）。
 * 直前がスキル・爆発・重撃・キャラ交代のときも同じ。ゲームでは長押しで通常1段目のあとに重撃が出るので、
 * アプリ上は「N の次に CA」と並べる必要がある。
 *
 * 一覧は、gcsim ローカルサーバー（辞書と同じ 1e6…のコミット付近）で、全キャラを「重撃を最初のアクションにした設定文」で
 * 実行して集めた（2026-09-30。エラーが `need to use attack right before charge` のキャラ 58 人）。
 * gcsim の更新で変わりうるため、gcsim を更新したときは同じ手順で確かめ直す。
 * 弓の重撃（aim）は対象外。大剣の多くは `charge` 自体が未実装（別の問題。progress.md 参照）。
 */
export const CHARGE_REQUIRES_ATTACK = new Set<string>([
  'aetheranemo', 'aethercryo', 'aetherdendro', 'aetherelectro', 'aethergeo', 'aetherhydro', 'aetherpyro',
  'albedo', 'alhaitham', 'bennett', 'candace', 'chevreuse', 'chiori', 'clorinde', 'cyno', 'dahlia', 'durin',
  'emilie', 'escoffier', 'flins', 'hutao', 'iansan', 'ineffa', 'jean', 'kaedeharakazuha', 'kaeya',
  'kamisatoayaka', 'kamisatoayato', 'keqing', 'kirara', 'kukishinobu', 'layla',
  'lumineanemo', 'luminecryo', 'luminedendro', 'lumineelectro', 'luminegeo', 'luminehydro', 'luminepyro',
  'lynette', 'mika', 'nilou', 'odette', 'prune', 'qiqi', 'raidenshogun', 'rosaria', 'shenhe', 'shikanoinheizou',
  'thoma', 'wriothesley', 'xiangling', 'xiao', 'xilonen', 'xingqiu', 'yaoyao', 'yunjin', 'zhongli',
]);

/** 直前のアクション（gcsim の命令）の表示名 */
export const PREVIOUS_ACTION_LABELS: Record<string, string> = {
  swap: 'キャラ交代',
  skill: '元素スキル',
  burst: '元素爆発',
  charge: '重撃',
  attack: '通常攻撃',
  dash: 'ダッシュ',
  jump: 'ジャンプ',
  low_plunge: '低空落下攻撃',
  high_plunge: '高空落下攻撃',
  aim: '狙い撃ち',
};
