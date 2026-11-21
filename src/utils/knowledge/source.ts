/**
 * 知識辞書の取得（設計: docs/gcsim-integration/phase-9-auto-rotation-search/辞書設計.md）。
 * 辞書は、サーバー側（いまは同じ配信元の静的ファイル public/knowledge/）に置き、必要なキャラの分だけ取得する。アプリ本体には入れない。
 * 取得できなかった（オフライン・辞書にないキャラ・版が合わない）ときは、その分を飛ばす（辞書は、探索の必須ではなく、加算）。
 * 置き場を別のサーバー（API）に移すときは、KnowledgeSource の実装を差し替える。
 */
import type { CharacterKnowledge, KnowledgeBundle, KnowledgeIndex } from '../../masterdata/knowledge/types';

export interface KnowledgeSource {
  /** 指定したキャラの辞書を取得する（無いキャラは、結果に含めない） */
  load(characterIds: string[]): Promise<KnowledgeBundle>;
}

/** 受け付ける辞書の版（build-knowledge.ts の KNOWLEDGE_VERSION と同じ） */
export const SUPPORTED_KNOWLEDGE_VERSION = 1;

const baseUrl = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** 静的ファイル（public/knowledge/）から取得する */
export class StaticFileSource implements KnowledgeSource {
  private index: Promise<KnowledgeIndex | null> | null = null;
  private cache = new Map<string, CharacterKnowledge | null>();
  constructor(private readonly base: string = `${baseUrl()}knowledge/`, private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  private loadIndex(): Promise<KnowledgeIndex | null> {
    if (!this.index) {
      this.index = this.fetcher(`${this.base}index.json`)
        .then(r => (r.ok ? (r.json() as Promise<KnowledgeIndex>) : null))
        .then(i => (i && i.version === SUPPORTED_KNOWLEDGE_VERSION ? i : null))
        .catch(() => null);
    }
    return this.index;
  }

  async load(characterIds: string[]): Promise<KnowledgeBundle> {
    const index = await this.loadIndex();
    if (!index) return {};
    const out: KnowledgeBundle = {};
    await Promise.all(characterIds.map(async id => {
      if (!this.cache.has(id)) {
        const file = index.chars[id];
        this.cache.set(id, file ? await this.fetcher(`${this.base}${file}`).then(r => (r.ok ? (r.json() as Promise<CharacterKnowledge>) : null)).catch(() => null) : null);
      }
      const k = this.cache.get(id);
      if (k) out[id] = k;
    }));
    return out;
  }
}

/** 既定の取得元 */
export const knowledgeSource: KnowledgeSource = new StaticFileSource();
