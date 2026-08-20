'use client';

import { useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { Win } from '@/os/types';
import { getApp } from '@/apps/registry';
import { cn, clamp } from '@/os/utils';
import { openMenu } from './ui';

// remembered dock targets for genie restore animation
const dockTargets = new Map<string, { x: number; y: number }>();

type Zone = 'left' | 'right' | 'top' | 'bottom' | null;

export function WindowFrame({ win }: { win: Win }) {
  const os = useOS.getState();
  const prefs = useOS((s) => s.prefs);
  const focused = useOS((s) => s.focusedWin === win.id);
  const spaces = useOS((s) => s.spaces);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [zone, setZone] = useState<Zone>(null);
  const [genie, setGenie] = useState<'out' | 'in' | null>(null);
  const startRef = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0, mode: 'move' as 'move' | 'resize', handle: '' });
  const app = getApp(win.appId);
  const rm = prefs.reducedMotion;

  const commit = (p: Partial<Win>) => useOS.getState().setWin(win.id, p);

  const dockPoint = () => {
    const el = document.querySelector(`[data-dock-app="${win.appId === 'finder' ? 'finder' : win.appId}"]`);
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top } : { x: window.innerWidth / 2, y: window.innerHeight };
  };

  const doMinimize = () => {
    const pt = dockPoint();
    dockTargets.set(win.id, pt);
    if (rm) {
      commit({ minimized: true });
      return;
    }
    setGenie('out');
    const el = rootRef.current;
    if (el) {
      el.style.setProperty('--gx', `${pt.x - (win.x + win.w / 2)}px`);
      el.style.setProperty('--gy', `${pt.y - (win.y + win.h / 2)}px`);
    }
    setTimeout(() => commit({ minimized: true }), 300);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const restorePt = dockTargets.get(win.id);
  const startAnim = !rm && restorePt ? 'genie-in' : rm ? '' : 'win-in';

  const onTitleDown = (e: React.PointerEvent) => {
    useOS.getState().focusWin(win.id);
    if ((e.target as HTMLElement).closest('.traffic')) return;
    if (win.fullscreen || win.maximized) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h, mode: 'move', handle: '' };
    setDrag({ dx: 0, dy: 0 });
  };

  const onResizeDown = (handle: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    useOS.getState().focusWin(win.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h, mode: 'resize', handle };
    setDrag({ dx: 0, dy: 0 });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const s = startRef.current;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    setDrag({ dx, dy });
    if (s.mode === 'move') {
      if (e.clientX < 16) setZone('left');
      else if (e.clientX > window.innerWidth - 16) setZone('right');
      else if (e.clientY < 34) setZone('top');
      else setZone(null);
    }
  };

  const onUp = () => {
    if (!drag) return;
    const s = startRef.current;
    const dx = drag.dx;
    const dy = drag.dy;
    setDrag(null);
    setZone(null);
    if (s.mode === 'move') {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const prev = win.maximized || win.prevRect ? win.prevRect : { x: win.x, y: win.y, w: win.w, h: win.h };
      if (zone === 'left') commit({ x: 6, y: 36, w: Math.floor(W / 2) - 9, h: H - 44, maximized: false, prevRect: prev });
      else if (zone === 'right') commit({ x: Math.ceil(W / 2) + 3, y: 36, w: Math.floor(W / 2) - 9, h: H - 44, maximized: false, prevRect: prev });
      else if (zone === 'top') useOS.getState().toggleMaximize(win.id);
      else commit({ x: clamp(s.x + dx, -win.w + 80, W - 60), y: clamp(s.y + dy, 30, H - 40), maximized: false });
    } else {
      let { x, y, w, h } = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (s.handle.includes('e')) w = s.w + dx;
      if (s.handle.includes('s')) h = s.h + dy;
      if (s.handle.includes('w')) { w = s.w - dx; x = s.x + dx; }
      if (s.handle.includes('n')) { h = s.h - dy; y = s.y + dy; }
      w = Math.max(340, w);
      h = Math.max(220, h);
      commit({ x, y, w, h, maximized: false });
    }
  };

  const titleMenu = (e: React.MouseEvent) => {
    openMenu(e, [
      { label: 'Minimize', kbd: '⌘M', onSelect: doMinimize },
      { label: 'Zoom', onSelect: () => useOS.getState().toggleMaximize(win.id) },
      { label: win.fullscreen ? 'Exit Full Screen' : 'Enter Full Screen', onSelect: () => useOS.getState().toggleFullscreen(win.id) },
      { sep: true },
      ...spaces.filter((sp) => sp.id !== win.space).map((sp) => ({
        label: `Move to ${sp.name}`,
        onSelect: () => { useOS.getState().moveWinToSpace(win.id, sp.id); useOS.getState().setActiveSpace(sp.id); },
      })),
      { sep: true },
      { label: 'Close', kbd: '⌘W', danger: true, onSelect: () => useOS.getState().closeWin(win.id) },
    ]);
  };

  const x = win.maximized || win.fullscreen ? win.x : win.x + (drag?.dx ?? 0);
  const y = win.maximized || win.fullscreen ? win.y : win.y + (drag?.dy ?? 0);
  const w = win.maximized || win.fullscreen ? win.w : startRef.current.mode === 'resize' && drag ? undefined : win.w;

  const AppComp = app?.component;
  const stage = useOS((s) => s.prefs.stageManager);

  return (
    <>
      <div
        ref={rootRef}
        role="dialog"
        aria-label={win.title}
        className={cn(
          'window fixed flex flex-col',
          focused ? 'window-focused' : 'window-blur',
          startAnim,
          genie === 'out' && 'genie-out',
          prefs.transparency ? '' : 'window-opaque',
        )}
        style={{
          left: x, top: y, width: win.fullscreen ? '100vw' : (w ?? win.w), height: win.fullscreen ? '100dvh' : win.h,
          zIndex: win.fullscreen ? 9600 : 100 + win.z,
          transition: drag ? 'none' : undefined,
          ...(win.fullscreen ? { left: 0, top: 0, borderRadius: 0 } : {}),
        }}
        onPointerDown={() => useOS.getState().focusWin(win.id)}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <div
          className={cn('win-titlebar flex h-[38px] shrink-0 items-center px-2.5', drag && 'cursor-grabbing')}
          onPointerDown={onTitleDown}
          onDoubleClick={() => useOS.getState().toggleMaximize(win.id)}
          onContextMenu={titleMenu}
        >
          <div className="traffic flex items-center gap-2" onDoubleClick={(e) => e.stopPropagation()}>
            <button aria-label="Close" className="tlight tlight-red" onClick={() => useOS.getState().closeWin(win.id)}>
              <svg viewBox="0 0 8 8" width="7" height="7"><path d="M1.5 1.5l5 5m0-5l-5 5" stroke="#7a1610" strokeWidth="1.1" strokeLinecap="round" /></svg>
            </button>
            <button aria-label="Minimize" className="tlight tlight-yellow" onClick={doMinimize}>
              <svg viewBox="0 0 8 8" width="7" height="7"><path d="M1.2 4h5.6" stroke="#8a6008" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
            <button aria-label="Full screen" className="tlight tlight-green" onClick={() => useOS.getState().toggleFullscreen(win.id)}>
              <svg viewBox="0 0 8 8" width="7" height="7"><path d="M1.6 4.4V1.6h2.8M6.4 3.6v2.8H3.6" stroke="#1d5c14" strokeWidth="1.1" fill="none" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 text-[13px] font-semibold', focused ? 'opacity-90' : 'opacity-45')}>
            {win.title}
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden rounded-b-[10px] bg-[var(--win-bg)]">
          {AppComp ? <AppComp win={win} /> : <div className="p-4 text-sm">App not installed</div>}
        </div>
        {!win.fullscreen && !win.maximized && (
          <>
            <div className="rh rh-e" onPointerDown={onResizeDown('e')} />
            <div className="rh rh-s" onPointerDown={onResizeDown('s')} />
            <div className="rh rh-se" onPointerDown={onResizeDown('se')} />
            <div className="rh rh-w" onPointerDown={onResizeDown('w')} />
            <div className="rh rh-n" onPointerDown={onResizeDown('n')} />
          </>
        )}
      </div>
      {zone && drag && (
        <div
          className="pointer-events-none fixed z-[9500] rounded-xl border-2 border-[var(--accent)]/60 bg-[var(--accent)]/15 transition-all duration-150"
          style={{
            left: zone === 'right' ? window.innerWidth / 2 + 3 : 6,
            top: zone === 'top' ? 34 : 36,
            width: zone === 'top' ? window.innerWidth - 12 : window.innerWidth / 2 - 9,
            height: zone === 'top' ? window.innerHeight - 42 : window.innerHeight - 44,
          }}
        />
      )}
      {stage && null}
    </>
  );
}

export { dockTargets };
