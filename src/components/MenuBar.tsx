'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { MenuItem } from '@/os/types';
import { fmtClock } from '@/os/utils';
import { MenuPanel } from './ui';
import { getApp, openApp, openFileById } from '@/apps/registry';
import * as fs from '@/os/fs';
import { cn } from '@/os/utils';

export function MenuBar() {
  const focusedWin = useOS((s) => (s.focusedWin ? s.windows[s.focusedWin] : null));
  const prefs = useOS((s) => s.prefs);
  const ui = useOS((s) => s.ui);
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const appId = focusedWin?.appId ?? 'finder';
  const appName = appId === 'finder' ? 'Finder' : (getApp(appId)?.name ?? 'Finder');
  const menus = buildMenus(appId, focusedWin?.id ?? null);

  const d = new Date(now);
  const dateStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      ref={barRef}
      className={cn('menubar fixed inset-x-0 top-0 z-[9000] flex h-[30px] items-stretch px-2 text-[13px]', prefs.highContrast && 'contrast-more')}
      role="menubar"
    >
      <div className="flex items-stretch">
        <MenuButton
          label=""
          open={open === 'apple'}
          onToggle={() => setOpen(open === 'apple' ? null : 'apple')}
          onHover={() => open && setOpen('apple')}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-label="Apple menu">
            <path d="M11.6 8.6c0-1.5 1.2-2.2 1.3-2.3-.7-1-1.8-1.2-2.2-1.2-1-.1-1.9.6-2.4.6-.5 0-1.2-.6-2-.6-1 0-2 .6-2.5 1.5-1.1 1.9-.3 4.7.8 6.2.5.8 1.1 1.6 2 1.6.8 0 1.1-.5 2-.5s1.2.5 2 .5c.9 0 1.4-.8 1.9-1.5.6-.9.9-1.8.9-1.8s-1.8-.7-1.8-2.5zM10 4.1c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7.1 1.3-.3 1.7-.8z" fill="currentColor" />
          </svg>
        </MenuButton>
        <div className="flex items-center px-2.5 font-bold">{appName}</div>
        {menus.map((m) => (
          <MenuButton
            key={m.title}
            label={m.title}
            open={open === m.title}
            onToggle={() => setOpen(open === m.title ? null : m.title)}
            onHover={() => open && setOpen(m.title)}
          />
        ))}
      </div>

      <div className="ml-auto flex items-stretch">
        {prefs.focus !== 'off' && (
          <StatusIcon title={`Focus: ${prefs.focus}`} onClick={() => useOS.getState().uiPatch({ control: !ui.control })}>
            <path d="M12 3a7 7 0 004 12.7A8 8 0 0112 3z" fill="currentColor" transform="translate(-4 -2) scale(.9)" />
          </StatusIcon>
        )}
        <StatusIcon title="Battery — 86% (simulated)" >
          <g>
            <rect x="2" y="6" width="15" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <rect x="3.4" y="7.4" width="10" height="5.2" rx="1" fill="currentColor" />
            <path d="M18.5 8.5v3a1.6 1.6 0 000-3z" fill="currentColor" opacity=".6" />
          </g>
        </StatusIcon>
        <StatusIcon title={prefs.wifi ? 'Wi-Fi: BrowserNet (simulated)' : 'Wi-Fi off'} onClick={() => useOS.getState().setPrefs({ wifi: !prefs.wifi })}>
          <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={prefs.wifi ? 1 : 0.35}>
            <path d="M4 8.5a11 11 0 0114 0M6.5 11.3a7.5 7.5 0 019 0M9 14a4 4 0 014 0" />
            <circle cx="11" cy="16.4" r="1.3" fill="currentColor" stroke="none" />
          </g>
        </StatusIcon>
        <StatusIcon title={prefs.bluetooth ? 'Bluetooth: On (simulated)' : 'Bluetooth off'} onClick={() => useOS.getState().setPrefs({ bluetooth: !prefs.bluetooth })}>
          <path d="M8 6l7 5-7 5V6zm0 5l7-5m-7 10l7-5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" opacity={prefs.bluetooth ? 1 : 0.35} transform="translate(2.5 1)" />
        </StatusIcon>
        <StatusIcon title="Control Center" onClick={() => useOS.getState().uiPatch({ control: !ui.control, notifCenter: false })} active={ui.control}>
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M20.5 17h-.5" transform="translate(0 -1.5) scale(.82)" />
            <circle cx="11" cy="4.6" r="1.9" fill="currentColor" />
            <circle cx="7.6" cy="9.9" r="1.9" fill="currentColor" />
            <circle cx="13.5" cy="12.4" r="1.9" fill="currentColor" />
          </g>
        </StatusIcon>
        <button
          className="flex items-center gap-2 rounded px-2 text-[12.5px] font-medium hover:bg-black/10 dark:hover:bg-white/12"
          onClick={() => useOS.getState().uiPatch({ notifCenter: !ui.notifCenter, control: false })}
          aria-label="Notification center"
        >
          <span>{dateStr}</span>
          <span>{fmtClock(now)}</span>
        </button>
      </div>

      {open && open !== 'apple' && (
        <MenuBarDropdown title={open} menus={menus} close={() => setOpen(null)} barRef={barRef} />
      )}
      {open === 'apple' && <AppleMenu close={() => setOpen(null)} barRef={barRef} />}
    </div>
  );
}

function MenuButton({ label, open, onToggle, onHover, children }: { label: string; open: boolean; onToggle: () => void; onHover: () => void; children?: React.ReactNode }) {
  return (
    <button
      className={cn('flex items-center rounded px-2.5 py-0.5 text-[13px]', open ? 'bg-black/12 dark:bg-white/18' : 'hover:bg-black/8 dark:hover:bg-white/10')}
      onClick={onToggle}
      onPointerEnter={onHover}
    >
      {children ?? label}
    </button>
  );
}

function StatusIcon({ children, title, onClick, active }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      className={cn('flex w-[30px] items-center justify-center rounded hover:bg-black/8 dark:hover:bg-white/10', active && 'bg-black/12 dark:bg-white/15')}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 22 22" width="15" height="15">{children}</svg>
    </button>
  );
}

function MenuBarDropdown({ title, menus, close, barRef }: { title: string; menus: Array<{ title: string; items: MenuItem[] }>; close: () => void; barRef: React.RefObject<HTMLDivElement | null> }) {
  const menu = menus.find((m) => m.title === title);
  const [pos, setPos] = useState({ x: 0, y: 30 });
  useEffect(() => {
    const btns = barRef.current?.querySelectorAll('button');
    if (btns) {
      for (const b of Array.from(btns)) {
        if (b.textContent === title) {
          const r = b.getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom + 4 });
          break;
        }
      }
    }
  }, [title, barRef]);
  if (!menu) return null;
  return (
    <>
      <div className="fixed inset-0 z-[8999]" onPointerDown={close} />
      <div className="fixed z-[9001]">
        <MenuPanel x={pos.x} y={pos.y} items={menu.items} onClose={close} />
      </div>
    </>
  );
}

function AppleMenu({ close, barRef }: { close: () => void; barRef: React.RefObject<HTMLDivElement | null> }) {
  const items: MenuItem[] = [
    { label: 'About This Mac', onSelect: () => openApp('settings', { section: 'about' }) },
    { sep: true },
    { label: 'System Settings…', onSelect: () => openApp('settings') },
    { label: 'App Store…', onSelect: () => openApp('appstore') },
    { sep: true },
    { label: 'Recent Items', head: 'Recent Items' },
    ...fs.recents(4).map((n) => ({ label: n.name, onSelect: () => openFileById(n.id) })),
    { sep: true },
    { label: 'Sleep', onSelect: () => useOS.getState().set({ locked: true }) },
    { label: 'Restart…', onSelect: () => window.location.reload() },
    { label: 'Shut Down…', onSelect: () => useOS.getState().set({ off: true }) },
    { sep: true },
    { label: 'Lock Screen', kbd: '⌃⌘Q', onSelect: () => useOS.getState().set({ locked: true }) },
  ];
  return (
    <>
      <div className="fixed inset-0 z-[8999]" onPointerDown={close} />
      <div className="fixed left-2 top-[32px] z-[9001]">
        <MenuPanel x={0} y={0} items={items} onClose={close} />
      </div>
    </>
  );
}

// ---------- menu definitions with real actions ----------
function buildMenus(appId: string, winId: string | null): Array<{ title: string; items: MenuItem[] }> {
  const os = useOS.getState();
  const win = winId ? os.windows[winId] : null;
  const close = () => winId && os.closeWin(winId);
  const min = () => winId && os.setWin(winId, { minimized: true });
  const zoom = () => winId && os.toggleMaximize(winId);
  const fsToggle = () => winId && os.toggleFullscreen(winId);

  const editMenu: MenuItem[] = [
    { label: 'Undo', kbd: '⌘Z', disabled: os.fsHistoryLen === 0, onSelect: () => fs.fsUndo() },
    { label: 'Redo', kbd: '⇧⌘Z', disabled: os.fsRedoLen === 0, onSelect: () => fs.fsRedo() },
    { sep: true },
    { label: 'Cut', kbd: '⌘X', disabled: !os.clipboard, onSelect: () => os.setClipboard(os.clipboard && { ...os.clipboard, mode: 'cut' }) },
    { label: 'Copy', kbd: '⌘C', disabled: !os.clipboard, onSelect: () => os.setClipboard(os.clipboard && { ...os.clipboard, mode: 'copy' }) },
    { label: 'Paste', kbd: '⌥⌘V', disabled: !os.clipboard, onSelect: () => fs.paste(fs.DESKTOP) },
  ];

  const fileMenu: MenuItem[] = appId === 'finder'
    ? [
        { label: 'New Finder Window', kbd: '⌘N', onSelect: () => openApp('finder') },
        { label: 'New Folder', kbd: '⇧⌘N', onSelect: () => fs.createFolder(win?.props?.path as string ?? fs.DOCUMENTS) },
        { label: 'Import Files…', onSelect: () => window.dispatchEvent(new CustomEvent('os-import')) },
        { sep: true },
        { label: 'Close Window', kbd: '⌘W', onSelect: close },
      ]
    : appId === 'notes'
      ? [
          { label: 'New Note', kbd: '⌘N', onSelect: () => window.dispatchEvent(new CustomEvent('notes-new')) },
          { sep: true },
          { label: 'Close Window', kbd: '⌘W', onSelect: close },
        ]
      : appId === 'textedit'
        ? [
            { label: 'New', kbd: '⌘N', onSelect: () => openApp('textedit') },
            { label: 'Open…', onSelect: () => openApp('finder', { path: fs.DOCUMENTS }) },
            { label: 'Save', kbd: '⌘S', onSelect: () => window.dispatchEvent(new CustomEvent('textedit-save')) },
            { sep: true },
            { label: 'Close Window', kbd: '⌘W', onSelect: close },
          ]
        : [
            { label: 'New Window', kbd: '⌘N', onSelect: () => openApp(appId) },
            { label: 'Close Window', kbd: '⌘W', onSelect: close },
          ];

  const viewMenu: MenuItem[] = [
    { label: 'Enter Full Screen', kbd: '⌃⌘F', onSelect: fsToggle },
    { sep: true },
    { label: 'Mission Control', kbd: 'F3', onSelect: () => os.uiPatch({ mission: true }) },
    { label: 'Show Desktop', onSelect: () => { for (const w of Object.values(os.windows)) os.setWin(w.id, { minimized: true }); } },
  ];

  const goMenu: MenuItem[] = [
    { label: 'Desktop', kbd: '⇧⌘D', onSelect: () => openApp('finder', { path: fs.DESKTOP }) },
    { label: 'Documents', kbd: '⇧⌘O', onSelect: () => openApp('finder', { path: fs.DOCUMENTS }) },
    { label: 'Downloads', kbd: '⌥⌘L', onSelect: () => openApp('finder', { path: fs.DOWNLOADS }) },
    { label: 'Recents', onSelect: () => openApp('finder', { path: 'recents' }) },
    { sep: true },
    { label: 'Utilities', head: 'Utilities' },
    { label: 'Terminal', onSelect: () => openApp('terminal') },
    { label: 'Activity Monitor', onSelect: () => openApp('activity') },
  ];

  const windowMenu: MenuItem[] = [
    { label: 'Minimize', kbd: '⌘M', disabled: !winId, onSelect: min },
    { label: 'Zoom', disabled: !winId, onSelect: zoom },
    { sep: true },
    ...Object.values(os.windows).filter((w) => !w.minimized).slice(0, 8).map((w) => ({
      label: w.title, checked: w.id === winId, onSelect: () => os.focusWin(w.id),
    })),
  ];

  const helpMenu: MenuItem[] = [
    { label: `About ${getApp(appId)?.name ?? 'App'}`, onSelect: () => openApp('settings', { section: 'about' }) },
    { label: 'Keyboard Shortcuts', onSelect: () => openApp('settings', { section: 'keyboard' }) },
  ];

  const menus: Array<{ title: string; items: MenuItem[] }> = [
    { title: 'File', items: fileMenu },
    { title: 'Edit', items: editMenu },
    { title: 'View', items: viewMenu },
  ];
  if (appId === 'finder') menus.push({ title: 'Go', items: goMenu });
  menus.push({ title: 'Window', items: windowMenu }, { title: 'Help', items: helpMenu });
  return menus;
}
