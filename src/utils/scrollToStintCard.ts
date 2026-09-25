/** アクション構築エリアの固定表示部分（sticky）の要素ID */
export const ACTION_BUILDER_STICKY_ID = 'action-builder-sticky';
/** アクション構築エリア末尾の、スクロール位置合わせ用の下余白の要素ID */
export const ACTION_BUILDER_BOTTOM_SPACER_ID = 'action-builder-bottom-spacer';

const GAP_PX = 8;

/**
 * 出場キャラのカード（stint-card-<id>）を、固定表示エリア（ページヘッダー + アクション構築の固定部分）の
 * すぐ下にスクロールする。末尾付近のカードで届かない場合は、下余白を必要な分だけ広げる。
 * パイプラインのチップ・ガントチャートのアクションのクリックで共通に使う。
 */
export function scrollStintCardBelowSticky(stintId: string): void {
  // 選択状態の反映などでレイアウトが変わった後に位置を測る
  requestAnimationFrame(() => {
    const card = document.getElementById(`stint-card-${stintId}`);
    if (!card) return;
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const stickyHeight = document.getElementById(ACTION_BUILDER_STICKY_ID)?.offsetHeight ?? 0;
    const spacer = document.getElementById(ACTION_BUILDER_BOTTOM_SPACER_ID);
    if (spacer) spacer.style.height = '0px';
    const top = window.scrollY + card.getBoundingClientRect().top - headerHeight - stickyHeight - GAP_PX;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (spacer && top > maxScroll) spacer.style.height = `${Math.ceil(top - maxScroll)}px`;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

/** ガントチャートの固定表示ヘッダー（タイトル・時間目盛りなど）の要素ID */
export const GANTT_STICKY_HEADER_ID = 'gantt-sticky-header';
/** ガントチャート本体（横スクロールする領域）の要素ID */
export const GANTT_SCROLL_CONTAINER_ID = 'gantt-scroll-container';
/** ガントチャートの出場キャラ行の要素ID */
export const ganttStintRowId = (stintId: string) => `gantt-stint-row-${stintId}`;

/** ガントチャート左端のキャラ名列の幅（px） */
const GANTT_LABEL_COLUMN_PX = 180;

/**
 * ガントチャートの出場キャラ行を、ガントチャートの固定表示ヘッダーのすぐ下へ縦スクロールし、
 * その出場の最初のアクションがキャラ名列のすぐ右に来るよう横スクロールする
 */
export function scrollToGanttStintRow(stintId: string): void {
  requestAnimationFrame(() => {
    const row = document.getElementById(ganttStintRowId(stintId));
    if (!row) return;
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const ganttHeaderHeight = document.getElementById(GANTT_STICKY_HEADER_ID)?.offsetHeight ?? 0;
    const top = window.scrollY + row.getBoundingClientRect().top - headerHeight - ganttHeaderHeight - GAP_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

    const container = document.getElementById(GANTT_SCROLL_CONTAINER_ID);
    const firstBlock = row.querySelector<HTMLElement>('[draggable="true"]');
    if (container && firstBlock) {
      const delta = firstBlock.getBoundingClientRect().left - (container.getBoundingClientRect().left + GANTT_LABEL_COLUMN_PX + 24);
      container.scrollTo({ left: Math.max(0, container.scrollLeft + delta), behavior: 'smooth' });
    }
  });
}
