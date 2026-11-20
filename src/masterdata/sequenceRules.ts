/**
 * アクションの並びの決まり（ローテーション自動探索が、候補を作る・捨てるのに使う）。
 *
 * 文章（説明文）にしか書かれていなかった「前提条件」と「ひとまとまりの並び」を、データにしたもの（2026-11-20）。
 *   - PREREQUISITES: そのアクションを使うには、先に何が起きている必要があるか（満たさない並びは、gcsim が実行できない）
 *   - SEQUENCE_MACROS: ひとまとまりで使うと初めて効く並び（途中までだと効かない・弱い）。探索が、1 つの部品として差し込む
 *   - 自動検出（`npm run probe:macros`）の結果は sequenceMacros.detected.json に入り、SEQUENCE_MACROS と合わせて使う
 * キャラは ID で指す。アクションは「キャラ ID_」を除いた種類（e / e_hold / q / n / ca …）。
 */
import detected from './sequenceMacros.detected.json';

export interface Prerequisite {
  characterId: string;
  /** 対象のアクション（種類） */
  steps: string[];
  /** 必要な資源の名前（表示用） */
  resource: string;
  /** その資源を作る反応に要る元素。ローテーションの先頭から数えて、そのアクションより前（同じ出場の前の動作を含む）に、この元素のキャラが動いている必要がある */
  needsElementsBefore: string[];
  /** 根拠（説明文の要点） */
  note: string;
}

export const PREREQUISITES: Prerequisite[] = [
  {
    characterId: '10000119-dendro', // ラウマ
    steps: ['e_hold'],
    resource: '草露',
    needsElementsBefore: ['hydro', 'dendro'],
    note: '長押しの元素スキルは「草露を持っている時のみ発動可能」。草露は月開花反応（水 + 草）で得る。先に水元素と草元素のキャラが動いていない 1 周目は、gcsim が「Cannot use Skill Hold without Dew」で失敗する',
  },
];

/** ひとまとまりの並び（キャラ ID → 並びの一覧） */
export const SEQUENCE_MACROS: Record<string, string[][]> = {
  '10000119-dendro': [['e_hold', 'q']], // ラウマ: 長押しで得た「詠月」を Q が消費し、1 層につき「蒼の讃歌」6 層になる（+26k の実測）
  '10000070-hydro': [['e', 'n', 'n', 'n']], // ニィロウ: 剣舞の E のあと通常攻撃 3 回 → 祈月（actionEffectExtras）
};

/** 手書き + 自動検出の合算 */
export function macrosOf(characterId: string): string[][] {
  const out = [...(SEQUENCE_MACROS[characterId] ?? [])];
  for (const d of detected as Array<{ characterId: string; steps: string[] }>) if (d.characterId === characterId) out.push(d.steps);
  const seen = new Set<string>();
  return out.filter(m => { const k = m.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** 前提を満たさないアクションの一覧（出場の番号・動作の番号・説明）。1 周目の並びだけを見る */
export function prerequisiteViolations(
  stints: Array<{ characterId: string; actions: Array<{ actionTypeId: string }> }>,
  elementOf: (characterId: string) => string | undefined,
): Array<{ stint: number; action: number; rule: Prerequisite }> {
  const out: Array<{ stint: number; action: number; rule: Prerequisite }> = [];
  const applied = new Set<string>();
  stints.forEach((s, si) => {
    s.actions.forEach((a, ai) => {
      const step = a.actionTypeId.slice(s.characterId.length + 1);
      for (const rule of PREREQUISITES) {
        if (rule.characterId === s.characterId && rule.steps.includes(step) && !rule.needsElementsBefore.every(e => applied.has(e))) out.push({ stint: si, action: ai, rule });
      }
      const el = elementOf(s.characterId);
      if (el) applied.add(el);
    });
  });
  return out;
}
