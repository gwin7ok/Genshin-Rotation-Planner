import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface ListSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ListSelectProps {
  value: string;
  options: ListSelectOption[];
  onChange: (value: string) => void;
  /** 未選択（value が options に無い）ときに表示する文字 */
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  /** ボタンの見た目（幅・色など） */
  className?: string;
}

const LIST_MAX_HEIGHT_PX = 288;

/**
 * 長い一覧用のドロップダウン。
 * 標準の <select> は開いた一覧をブラウザが描画・スクロールするため、Windows の「1画面ずつスクロール」設定で
 * 1ページより大きく送られてしまう。ここでは一覧をアプリで描画し、ページ単位のホイール操作を
 * 一覧の表示領域の高さちょうどでスクロールさせる。
 */
export const ListSelect: React.FC<ListSelectProps> = ({ value, options, onChange, placeholder, disabled, title, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    const r = buttonRef.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const maxHeight = Math.min(LIST_MAX_HEIGHT_PX, Math.max(below, above));
    const top = below >= Math.min(LIST_MAX_HEIGHT_PX, above) ? r.bottom + 2 : r.top - 2 - maxHeight;
    setRect({ top, left: r.left, width: r.width, maxHeight });
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex(o => !o.disabled));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  // 開いたら選択中の項目を見える位置に
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  // 外側のクリック・一覧以外のスクロール・画面サイズ変更で閉じる（固定位置の一覧がボタンからずれるため）
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // ページ単位のホイール（Windows の「1画面ずつ」設定）は、表示領域の高さちょうどだけ送る。
  // React の onWheel は passive で既定動作を止められないため、直接登録する
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaMode !== WheelEvent.DOM_DELTA_PAGE || e.deltaY === 0) return;
      e.preventDefault();
      list.scrollTop += Math.sign(e.deltaY) * list.clientHeight;
    };
    list.addEventListener('wheel', onWheel, { passive: false });
    return () => list.removeEventListener('wheel', onWheel);
  }, [open]);

  const moveActive = (from: number, step: number) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = Math.min(options.length - 1, Math.max(0, i + step));
      if (!options[i]?.disabled) return i;
      if (i === 0 || i === options.length - 1) break;
    }
    return from;
  };

  const itemsPerPage = () => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[data-index]');
    return list && item ? Math.max(1, Math.floor(list.clientHeight / item.offsetHeight)) : 10;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    const keySteps: Record<string, number> = {
      ArrowDown: 1, ArrowUp: -1, PageDown: itemsPerPage(), PageUp: -itemsPerPage(), End: options.length, Home: -options.length,
    };
    if (e.key in keySteps) {
      e.preventDefault();
      setActiveIndex(i => moveActive(i, keySteps[e.key]));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-between gap-1 text-left cursor-pointer disabled:cursor-not-allowed ${className}`}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ''}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </button>

      {open && rect && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          style={{ position: 'fixed', top: rect.top, left: rect.left, minWidth: rect.width, maxHeight: rect.maxHeight, zIndex: 1000 }}
          className="overflow-y-auto overscroll-contain rounded border border-slate-600 bg-slate-900 py-0.5 text-xs text-white shadow-xl"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              onMouseEnter={() => !o.disabled && setActiveIndex(i)}
              onClick={() => choose(i)}
              className={`px-2.5 py-1 whitespace-nowrap select-none ${
                o.disabled
                  ? 'text-slate-500 cursor-default'
                  : i === activeIndex
                  ? 'bg-sky-700 text-white cursor-pointer'
                  : o.value === value
                  ? 'text-amber-300 font-semibold cursor-pointer'
                  : 'cursor-pointer'
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
};
