/**
 * 同梱のマスターデータ（キャラ・武器・聖遺物）の入れ物と、読み込み（D354）。
 *
 * マスターの JSON は合わせて約 6 MB あり、画面の最初のコードに含めると、初回の表示が重くなる。
 * そこで、実体（masterData.ts）は、起動のとき（main.tsx）に別のファイルとして読み込む。
 * このファイルは軽く、どこからでも読んでよい。読み込みが済んでから（getMasterBundle）使う。
 */
import type { AppDatabase, ArtifactSetDatabaseItem, WeaponDatabaseItem } from '../types/database';
import type { CharacterConfig } from '../types/genshin';

export interface MasterBundle {
  characters: CharacterConfig[];
  weapons: WeaponDatabaseItem[];
  artifacts: ArtifactSetDatabaseItem[];
  /** 同梱のマスターから作る初期データベース（オフラインで、すぐ使える） */
  initialDatabase: AppDatabase;
}

let bundle: MasterBundle | null = null;
let loading: Promise<MasterBundle> | null = null;

/** 同梱のマスターを読み込む（2 回目以降は、同じものを返す。失敗したときは、次の呼び出しでやり直す） */
export function loadMasterData(): Promise<MasterBundle> {
  if (bundle) return Promise.resolve(bundle);
  if (!loading) {
    loading = import('./masterData')
      .then(m => (bundle = m.buildMasterBundle()))
      .catch(e => { loading = null; throw e; });
  }
  return loading;
}

/** 読み込み済みの同梱のマスターを返す。読み込み前に呼ぶと、例外（起動のとき loadMasterData を待つ） */
export function getMasterBundle(): MasterBundle {
  if (!bundle) throw new Error('マスターデータが、まだ読み込まれていません（loadMasterData を待ってください）');
  return bundle;
}
