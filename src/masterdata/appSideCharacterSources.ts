/**
 * gcsim に未実装のキャラの、アプリ側だけの対応（issue #36）で使うフレームの出どころ。
 *
 * gcsim のリリースには入っていないが、gcsim の main または未マージの PR に、モーションフレームを含む実装があるキャラについて、
 * その時点のコミットの Go ソース（attack.go / skill.go など）を、リリースのキャラと同じ解析で読み、フレームを入れる。
 * キャラの gcsim キー（source.gcsimKey）は付けない（gcsim では実行できないまま。「gcsim未実装」のバーも出続ける）。
 *
 * 注意:
 *   - 未マージの PR の値は、作業中・未検証。変わる可能性がある（ユーザー了承 2026-10-11）。画面には「出典: PR #…（未マージ・未検証）」と出す
 *   - コミットは固定する（PR の更新で、勝手に値が変わらないように）。更新するときは、ここを書き換えて再生成する
 *   - gcsim のリリースに入ったら、この表の行を消す（gcsim.config.json のバージョンを上げて取り込む。docs/ゲーム新キャラの取り込み手順.md）
 */
export interface AppSideSource {
  /** 公式キャラ ID（genshin-db） */
  genshinId: number;
  /** internal/characters/<dir> */
  dir: string;
  /** 読むコミット（gcsim のリポジトリから参照できるもの。PR の先頭コミットも可） */
  ref: string;
  /** 画面に出す出典 */
  label: string;
  /** 取り込み状態 */
  status: 'merged-main' | 'open-pr';
}

export const APP_SIDE_SOURCES: AppSideSource[] = [
  { genshinId: 10000100, dir: 'kachina', ref: '72cff353067312bcb182f4bd61e6135bc8170e93', label: 'gcsim PR #2697（未マージ・未検証。2026-08-12 時点）', status: 'open-pr' },
  { genshinId: 10000122, dir: 'nefer', ref: '4932d0e7c4d84713a33e6289d82712bae5871fdf', label: 'gcsim PR #3045（未マージ・未検証。2026-09-20 時点）', status: 'open-pr' },
  { genshinId: 10000130, dir: 'linnea', ref: 'ef71cdb05e55c649d88ecf7a7e7ae21cf09ebb8c', label: 'gcsim PR #2596（未マージ・未検証。2026-10-06 時点）', status: 'open-pr' },
  { genshinId: 10000148, dir: 'alyosha', ref: '8349db60294ce0459ba2a1817da24e497211cb6c', label: 'gcsim PR #3207（未マージ・未検証。2026-10-08 時点）', status: 'open-pr' },
  // 兹白: main にマージ済み（PR #3093。2026-10-03）。次のリリースで gcsim 本体に入る
  { genshinId: 10000126, dir: 'zibai', ref: 'a3b24946babe26eb5b9e9101d0e0a55c20a2ea59', label: 'gcsim main（PR #3093 マージ済み・リリース前）', status: 'merged-main' },
];

export const appSideSourceByGenshinId = (genshinId: number): AppSideSource | undefined =>
  APP_SIDE_SOURCES.find(s => s.genshinId === genshinId);
