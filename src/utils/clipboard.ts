/**
 * クリックの処理の中から、文字列をクリップボードにコピーする。
 *
 * **必ず、クリックの処理の中で（await の前に）呼ぶ**。ブラウザは、ユーザーの操作の直後だけ、コピーを許す。
 * さらに Firefox などは、コピーのあとに、新しいタブを開く（フォーカスが移る）と、非同期のコピー（navigator.clipboard）を断ることがある。
 * そのため、次の順で試す:
 *   1. 見えない textarea を選択して execCommand('copy')（その場で完了する。古い方式だが、Firefox・Chrome のどちらでも、クリックの処理の中なら通る）
 *   2. navigator.clipboard.writeText（1 が使えなかったとき。結果は、あとから分かる）
 * どちらも失敗したときは false（呼び出し側が、手でコピーする案内を出す）。
 */
export function copyTextFromClick(text: string): Promise<boolean> {
  if (legacyCopy(text)) return Promise.resolve(true);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => false);
    }
  } catch { /* 同期的に投げられたときは、失敗として扱う */ }
  return Promise.resolve(false);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const active = document.activeElement as HTMLElement | null;
  // フォーカスを閉じ込めるダイアログの中でも選択できるように、操作した要素の隣に置く
  const host = active?.parentElement ?? document.body;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none';
  host.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
    active?.focus?.();
  }
}
