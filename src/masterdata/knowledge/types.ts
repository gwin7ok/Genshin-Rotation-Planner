/**
 * ローテーション探索の「知識辞書」の型（設計: docs/gcsim-integration/phase-9-auto-rotation-search/辞書設計.md）。
 * 辞書は、サーバー側（public/knowledge/）に置き、必要なキャラの分だけをクライアントが取得する。アプリ本体には入れない。
 * このファイルは、型だけ（node のスクリプトからも読めるよう、import を持たない）。
 */

/** 運用型: 編成の中での、そのキャラの使い方（出場の組み方） */
export interface Archetype {
  /** 型の名前（表示・記録用） */
  name: string;
  role: 'attacker' | 'subAttacker' | 'supporter';
  /** 出場の順番（小さい順）。同じ値のキャラは、並べ替えを全部試す。アタッカーの攻撃の出場（fill）は、いつも最後 */
  slot: number;
  /** 出場の中の動作（アクションの種類。e / e_hold / q / n / ca …。「@秒」で所要時間を決める）。アタッカーでは、スキル・爆発の出場（先置き） */
  use: string[];
  /** アタッカーの攻撃の出場の型（1 回分）。回数は fillRepeat から選ぶ */
  fill?: string[];
  /** fill の繰り返し回数の候補 */
  fillRepeat?: number[];
  /** 周回の前に、1 回だけ行う動作（アタッカーの最初の通常攻撃など）。付けた形と、付けない形の両方を作る */
  lead?: string[];
  /** 編成の条件: この ID のキャラが、編成にいるとき */
  withCharacters?: string[];
  /** 根拠（gcsim の実測・手組みなど。文章の転載はしない） */
  evidence: string;
}

export interface CharacterKnowledge {
  characterId: string;
  archetypes: Archetype[];
}

/** 辞書の 1 まとまり（キャラ ID → 辞書） */
export type KnowledgeBundle = Record<string, CharacterKnowledge>;

/** 辞書の版（index.json）。gcsim の版と合わない辞書は使わない */
export interface KnowledgeIndex {
  version: number;
  gcsimVersion: string;
  chars: Record<string, string>;
}
