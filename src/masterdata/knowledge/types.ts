/**
 * ローテーション探索の「知識辞書」の型（設計: docs/gcsim-integration/phase-9-auto-rotation-search/辞書設計.md）。
 * 辞書は、サーバー側（public/knowledge/）に置き、必要なキャラの分だけをクライアントが取得する。アプリ本体には入れない。
 * このファイルは、型だけ（node のスクリプトからも読めるよう、import を持たない）。
 */

/** 運用型の、続きの出場（同じキャラの 2 回目以降の出場。間に別のキャラが入る） */
export interface ArchetypePart {
  /** 出場の順番（小さい順）。Archetype.slot と同じ尺度。別のキャラの出場を、この出場の前後に挟むために使う */
  slot: number;
  /** 出場の中の動作（use と同じ書式） */
  use: string[];
}

/** 運用型: 編成の中での、そのキャラの使い方（出場の組み方） */
export interface Archetype {
  /** 型の名前（表示・記録用） */
  name: string;
  role: 'attacker' | 'subAttacker' | 'supporter';
  /** 出場の順番（小さい順）。同じ値のキャラは、並べ替えを全部試す。アタッカーの攻撃の出場（fill）は、いつも最後 */
  slot: number;
  /** 出場の中の動作（アクションの種類。e / e_hold / q / n / ca …。「@秒」で所要時間を決める）。アタッカーでは、スキル・爆発の出場（先置き） */
  use: string[];
  /**
   * 続きの出場（同じキャラが、間に別のキャラを挟んで、もう一度出る形）。slot の大きい順に、use の後ろに並ぶ。
   * slot は、use の slot より大きくする。同じ slot の続きと use は、1 つの出場に結合する。
   * アタッカーの攻撃の出場（fill）は、続きの出場よりも、さらに後ろ。
   * 例: ドゥリン use=[e, q, e] slot=30 / then=[{ slot: 50, use: [e, e, q] }]（支援を slot 40 に置くと、その間に出る）
   */
  then?: ArchetypePart[];
  /**
   * この形を出発点に使うキャラの凸数の範囲（0〜6。両端を含む。省略は、その側に制限なし）。
   * 凸数で最適な動作が変わるキャラは、凸数の範囲ごとに別の形として書く。省略した形は、どの凸数でも使う。
   * 例: { min: 2 }（2 凸以上）、{ max: 1 }（1 凸まで）、{ min: 0, max: 0 }（0 凸だけ）
   */
  constellation?: { min?: number; max?: number };
  /** アタッカーの攻撃の出場の型（1 回分）。回数は fillRepeat から選ぶ */
  fill?: string[];
  /** fill の繰り返し回数の候補 */
  fillRepeat?: number[];
  /** 周回の前に、1 回だけ行う動作（アタッカーの最初の通常攻撃など）。付けた形と、付けない形の両方を作る */
  lead?: string[];
  /** fill の後ろ、ループの締めに置く動作（例: 雷電のループ末尾 ['e']） */
  tail?: string[];
  /** 編成の条件: この ID のキャラが、編成にいるとき */
  withCharacters?: string[];
  /** true のとき、このキャラが西風シリーズの武器を装備しているときだけ使う（西風粒子を出すための通常攻撃を挟む型など） */
  requiresFavonius?: boolean;
  /** 根拠（gcsim の実測・手組みなど。文章の転載はしない） */
  evidence: string;
}

export interface CharacterKnowledge {
  characterId: string;
  /** 原神 Wiki（wikiwiki.jp）の、そのキャラのページ。書き出し時に build-knowledge.ts が付ける（手で書かない） */
  wikiUrl?: string;
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
