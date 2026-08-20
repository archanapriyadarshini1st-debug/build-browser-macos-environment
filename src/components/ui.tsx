'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOS } from '@/os/store';
import type { MenuItem } from '@/os/types';
import { cn } from '@/os/utils';

// ---------- context menu ----------
export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[]) {
  e.preventDefault?.();
  e.stopPropagation?.();
  useOS.getState().uiPatch({ menu: { x: e.clientX, y: e.clientY, items }, control: false, notifCenter: false, spotlight: false });
}

export function closeMenu() {
  useOS.getState().uiPatch({ menu: null });
}

export function ContextMenuHost() {
  const menu = useOS((s) => s.ui.menu);
  if (!menu) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onPointerDown={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
      <MenuPanel x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />
    </>,
    document.body,
  );
}

export function MenuPanel({ x, y, items, onClose, minWidth = 210 }: { x: number; y: number; items: MenuItem[]; onClose?: () => void; minWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (rect.right > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - rect.height - 8);
    if (nx !== x || ny !== y) el.style.transform = `translate(${nx}px, ${ny}px)`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        closeMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="ctx-menu"
      style={{ transform: `translate(${Math.min(x, window.innerWidth - 40)}px, ${Math.min(y, window.innerHeight - 40)}px)`, minWidth }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.sep) return <div key={i} className="mx-2 my-1 h-px bg-black/10 dark:bg-white/10" />;
        if (it.head) return <div key={i} className="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">{it.head}</div>;
        return (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            className={cn(
              'menu-item',
              it.danger && 'text-[#ff453a]',
              it.disabled && 'opacity-40 pointer-events-none',
            )}
            onClick={() => {
              if (it.onSelect && !it.disabled) {
                it.onSelect();
                closeMenu();
                onClose?.();
              }
            }}
          >
            <span className="flex-1 text-left">{it.label}</span>
            {it.checked && <span className="mr-1 text-[12px]">✓</span>}
            {it.kbd && <span className="ml-6 text-[11px] opacity-50">{it.kbd}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- controls ----------
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200',
        on ? 'bg-[var(--accent)]' : 'bg-black/25 dark:bg-white/25',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all duration-200',
          on ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

export function Slider({ value, min = 0, max = 100, step = 1, onChange, label }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; label?: string }) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mac-slider w-full"
      style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ id: T; label: ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-black/8 p-[2px] dark:bg-white/10">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md px-2.5 py-[3px] text-[12px] font-medium transition-all',
            value === o.id ? 'bg-white text-black shadow-sm dark:bg-white/25 dark:text-white' : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ title, children, onClose, width = 400 }: { title: string; children: ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[9800] flex items-center justify-center" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/25" />
      <div
        className="dialog relative rounded-xl p-4"
        style={{ width, maxWidth: '92vw', maxHeight: '84vh', overflow: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <h2 className="mb-3 text-[14px] font-bold">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Row({ label, children, sub }: { label: string; children?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px]">
      <div className="min-w-0">
        <div className="text-[13px]">{label}</div>
        {sub && <div className="text-[11px] opacity-50">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
