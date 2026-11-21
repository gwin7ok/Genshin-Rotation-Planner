/**
 * 知識辞書の本体（手で保守する）。`npm run build:knowledge` が、public/knowledge/ に書き出す。
 * キャラは ID で指す（コメントは名前）。根拠（evidence）は、手組みの編成の gcsim の実測。
 */
import type { CharacterKnowledge } from './types.ts';

export const KNOWLEDGE: CharacterKnowledge[] = [
  {
    characterId: '10000125-hydro', // コロンビーナ
    archetypes: [
      {
        name: '重撃を最後にまとめる（月開花）',
        role: 'attacker',
        slot: 30,
        use: ['e', 'q'],
        fill: ['ca'],
        fillRepeat: [4, 5, 6],
        lead: ['n'],
        evidence: '手組み「月開花」184k（探索で登った後）。E・Q を先に置き、重撃を最後に撃つと、バフが重なる',
      },
    ],
  },
  {
    characterId: '10000073-dendro', // ナヒーダ
    archetypes: [
      { name: 'E と Q', role: 'supporter', slot: 10, use: ['e', 'n', 'q'], evidence: '手組み「月開花」の出場（E のあと通常攻撃 1 回、Q）' },
      { name: 'E と Q（通常攻撃なし）', role: 'supporter', slot: 10, use: ['e', 'q'], evidence: '探索の上位に出る形' },
    ],
  },
  {
    characterId: '10000070-hydro', // ニィロウ
    archetypes: [
      { name: 'E×4', role: 'supporter', slot: 20, use: ['e', 'e', 'e', 'e'], evidence: '手組み「月開花」。E×4 で別の効果（天を滌う水環）が出る。×2 にすると 124k に下がる' },
    ],
  },
  {
    characterId: '10000119-dendro', // ラウマ
    archetypes: [
      { name: '長押し E と Q', role: 'subAttacker', slot: 40, use: ['e_hold', 'q'], evidence: '手組み「月開花」。長押しで得た詠月を Q が消費する（+26k の実測）' },
    ],
  },
];
