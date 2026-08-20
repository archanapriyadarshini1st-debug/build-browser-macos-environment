'use client';

import { useRef, useState } from 'react';
import { useOS } from '@/os/store';
import { AppIcon, TrashIcon } from './icons';
import { getApp, openApp } from '@/apps/registry';
import { openMenu } from './ui';
import * as fs from '@/os/fs';
import { cn } from '@/os/utils';

export function Dock() {
  const dock = useOS((s) => s.dock);
  const installed = useOS((s) => s.installed);
  const windows = useOS((s) => s.windows);
  const focusedWin = useOS((s) => s.focusedWin);
  const prefs = useOS((s) => s.prefs);
  const trashCount = useOS((s) => Object.values(s.nodes).filter((n) => n.trashed).length);
  const [mx, setMx] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const dragId = useRef<string | null>(null);

  const size = prefs.dockSize;
  const items = dock.filter((id) => installed.includes(id) || id === 'launchpad');

  const scaleFor = (centerX: number) => {
    if (mx == null || !prefs.dockMagnify) return 1;
    const dist = Math.abs(mx - centerX);
    const range = size * 2.6;
    if (dist > range) return 1;
    return 1 + 0.55 * Math.cos((dist / range) * (Math.PI / 2));
  };

  const clickApp = (id: string) => {
    if (id === 'launchpad') {
      useOS.getState().uiPatch({ launchpad: !useOS.getState().ui.launchpad });
      return;
    }
    const os = useOS.getState();
    const wins = Object.values(os.windows).filter((w) => w.appId === id);
    if (!wins.length) {
      openApp(id);
      return;
    }
    const top = wins.sort((a, b) => b.z - a.z)[0];
    const focused = os.focusedWin && os.windows[os.focusedWin]?.appId === id && !top.minimized;
    if (focused && !top.minimized) {
      os.setWin(top.id, { minimized: true });
    } else {
      os.focusWin(top.id);
      if (top.space !== os.activeSpace) os.setActiveSpace(top.space);
    }
  };

  const ctxApp = (e: React.MouseEvent, id: string) => {
    const os = useOS.getState();
    const running = Object.values(os.windows).some((w) => w.appId === id);
    openMenu(e, [
      { label: 'Open', onSelect: () => openApp(id) },
      ...(running ? [{ label: 'Quit', onSelect: () => { for (const w of Object.values(useOS.getState().windows)) if (w.appId === id) useOS.getState().closeWin(w.id); } }] : []),
      { sep: true },
      { label: 'Options', head: 'Options' },
      { label: os.dock.includes(id) ? 'Remove from Dock' : 'Keep in Dock', onSelect: () => {
        const d = useOS.getState().dock;
        useOS.getState().setDock(d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
      } },
    ]);
  };

  const onDrop = (targetId: string) => {
    const src = dragId.current;
    dragId.current = null;
    if (!src || src === targetId) return;
    const d = [...useOS.getState().dock];
    const si = d.indexOf(src);
    const ti = d.indexOf(targetId);
    if (si < 0 || ti < 0) return;
    d.splice(si, 1);
    d.splice(ti, 0, src);
    useOS.getState().setDock(d);
  };

  return (
    <>
      {prefs.dockAutoHide && !hidden && <div className="fixed inset-x-0 bottom-0 z-[8998] h-2" onMouseEnter={() => setHidden(true)} />}
      <div
        className={cn('dock-anchor fixed z-[9100] flex justify-center', prefs.dockPosition === 'bottom' ? 'inset-x-0 bottom-[6px]' : prefs.dockPosition === 'left' ? 'left-[6px] top-1/2 -translate-y-1/2' : 'right-[6px] top-1/2 -translate-y-1/2')}
        onMouseMove={(e) => setMx(e.clientX)}
        onMouseLeave={() => setMx(null)}
      >
        <div
          className={cn('dock flex items-end gap-1 rounded-[20px] px-2 pb-[7px] pt-[7px] transition-transform duration-300', prefs.dockPosition !== 'bottom' && 'flex-col items-center', prefs.dockAutoHide && hidden && 'translate-y-[calc(100%+12px)]', prefs.dockAutoHide && 'hover:translate-y-0')}
          onMouseLeave={() => prefs.dockAutoHide && setHidden(true)}
          role="toolbar"
          aria-label="Dock"
        >
          {items.map((id) => {
            const running = Object.values(windows).some((w) => w.appId === id);
            const isFocused = focusedWin != null && windows[focusedWin]?.appId === id;
            const name = id === 'launchpad' ? 'Launchpad' : (getApp(id)?.name ?? id);
            return (
              <DockItem key={id} size={size} scale={scaleFor} running={running} focused={isFocused} name={name} onClick={() => clickApp(id)} onCtx={(e) => ctxApp(e, id)} draggable onDragStart={() => { dragId.current = id; }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(id)} appId={id} />
            );
          })}
          <div className="mx-1 h-[calc(100%-8px)] w-px self-center bg-black/15 dark:bg-white/15" />
          <DockItem
            size={size}
            scale={scaleFor}
            running={false}
            focused={false}
            name={trashCount ? `Trash — ${trashCount} items` : 'Trash'}
            onClick={() => openApp('finder', { path: 'trash' })}
            onCtx={(e) => openMenu(e, [
              { label: 'Open Trash', onSelect: () => openApp('finder', { path: 'trash' }) },
              { label: 'Empty Trash…', disabled: !trashCount, danger: true, onSelect: () => { fs.emptyTrash(); } },
            ])}
            appId="trash"
            icon={<TrashIcon full={trashCount > 0} size={size} />}
          />
        </div>
      </div>
    </>
  );
}

function DockItem({ size, scale, running, focused, name, onClick, onCtx, icon, appId, draggable, onDragStart, onDragOver, onDrop }: {
  size: number;
  scale: (centerX: number) => number;
  running: boolean;
  focused: boolean;
  name: string;
  onClick: () => void;
  onCtx: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  appId: string;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const cx = () => {
    const r = ref.current?.getBoundingClientRect();
    return r ? r.left + r.width / 2 : 0;
  };
  const s = scale(cx());
  return (
    <div className="relative flex flex-col items-center">
      {hover && (
        <div className="dock-tip pointer-events-none absolute -top-9 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium">
          {name}
        </div>
      )}
      <button
        ref={ref}
        data-dock-app={appId}
        aria-label={name}
        className="relative origin-bottom transition-transform duration-100 ease-out"
        style={{ transform: `scale(${s}) translateY(${(1 - s) * 10}px)`, width: size, height: size }}
        onClick={onClick}
        onContextMenu={onCtx}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {icon ?? <AppIcon appId={appId} size={size} />}
        {focused && <span className="pointer-events-none absolute inset-0 rounded-[22%] ring-2 ring-white/60" />}
      </button>
      <div className={cn('mt-[3px] h-[4px] w-[4px] rounded-full bg-black/50 dark:bg-white/70 transition-opacity', running ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}
