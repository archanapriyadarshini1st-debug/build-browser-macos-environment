'use client';

import { useEffect, useState } from 'react';
import { useOS } from '@/os/store';
import * as fs from '@/os/fs';
import { wallpaperStyle } from '@/os/utils';
import { Desktop } from '@/components/Desktop';
import { MenuBar } from '@/components/MenuBar';
import { Dock } from '@/components/Dock';
import { WindowFrame } from '@/components/Window';
import { ContextMenuHost, closeMenu } from '@/components/ui';
import {
  Spotlight, QuickLook, MissionControl, AppSwitcher, Launchpad,
  ControlCenter, NotificationCenter, GetInfoPanel, ConflictDialog, StageStrip, Toasts,
} from '@/components/Overlays';

export default function OS() {
  const prefs = useOS((s) => s.prefs);
  const windows = useOS((s) => s.windows);
  const activeSpace = useOS((s) => s.activeSpace);
  const focusedWin = useOS((s) => s.focusedWin);
  const locked = useOS((s) => s.locked);
  const off = useOS((s) => s.off);
  const [booting, setBooting] = useState(true);

  // seed + boot
  useEffect(() => {
    void fs.seed();
    const t = setTimeout(() => setBooting(false), prefs.reducedMotion ? 250 : 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // appearance side-effects
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const dark = prefs.appearance === 'dark' || (prefs.appearance === 'auto' && mq.matches);
    root.classList.toggle('dark', dark);
    root.style.setProperty('--accent', prefs.accent);
    root.style.setProperty('--accent-deep', prefs.accent);
    root.style.fontSize = `${16 * prefs.textScale}px`;
    root.classList.toggle('high-contrast', prefs.highContrast);
    root.classList.toggle('reduce-motion', prefs.reducedMotion);
  }, [prefs.appearance, prefs.accent, prefs.textScale, prefs.highContrast, prefs.reducedMotion]);

  // global shortcuts
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const os = useOS.getState();
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === ' ') { e.preventDefault(); os.uiPatch({ spotlight: !os.ui.spotlight, mission: false }); return; }
      if (e.key === 'F3' || (e.ctrlKey && e.key === 'ArrowUp')) { e.preventDefault(); os.uiPatch({ mission: !os.ui.mission, spotlight: false }); return; }
      if (e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') { e.preventDefault(); os.shiftSpace(-1); return; }
      if (e.ctrlKey && !e.metaKey && e.key === 'ArrowRight') { e.preventDefault(); os.shiftSpace(1); return; }

      if (mod && e.key === 'Tab') {
        e.preventDefault();
        const order = Object.values(os.windows).sort((a, b) => b.z - a.z).map((w) => w.appId).filter((v, i, arr) => arr.indexOf(v) === i);
        if (!order.length) return;
        const sw = os.ui.switcher;
        if (!sw) os.uiPatch({ switcher: { ids: order, index: e.shiftKey ? order.length - 1 : Math.min(1, order.length - 1) } });
        else os.uiPatch({ switcher: { ...sw, index: (sw.index + (e.shiftKey ? -1 : 1) + sw.ids.length) % sw.ids.length } });
        return;
      }

      if (e.key === 'Escape') {
        if (os.ui.menu) { closeMenu(); return; }
        if (os.ui.quicklook) { os.uiPatch({ quicklook: null }); return; }
        if (os.ui.spotlight || os.ui.mission || os.ui.launchpad || os.ui.control || os.ui.notifCenter) {
          os.uiPatch({ spotlight: false, mission: false, launchpad: false, control: false, notifCenter: false });
          return;
        }
        if (os.focusedWin && os.windows[os.focusedWin]?.fullscreen) {
          os.toggleFullscreen(os.focusedWin);
        }
        return;
      }

      if (mod && !typing) {
        const key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); if (e.shiftKey) fs.fsRedo(); else fs.fsUndo(); return; }
        if (key === 'n') { e.preventDefault(); openAppSafe('finder'); return; }
      }
      if (mod) {
        const key = e.key.toLowerCase();
        if (key === 'w' && os.focusedWin) { e.preventDefault(); os.closeWin(os.focusedWin); return; }
        if (key === 'm' && os.focusedWin) { e.preventDefault(); os.setWin(os.focusedWin, { minimized: true }); return; }
        if (key === ',' ) { e.preventDefault(); openAppSafe('settings'); return; }
        if (key === 'f' && e.ctrlKey && os.focusedWin) { e.preventDefault(); os.toggleFullscreen(os.focusedWin); return; }
      }
      // ⌘Tab release handled on keyup
    };
    const onUp = (e: KeyboardEvent) => {
      if ((e.key === 'Meta' || e.key === 'Control') || e.key === 'Alt') {
        const os = useOS.getState();
        const sw = os.ui.switcher;
        if (sw) {
          const appId = sw.ids[sw.index];
          const wins = Object.values(os.windows).filter((w) => w.appId === appId).sort((a, b) => b.z - a.z);
          if (wins.length) { os.focusWin(wins[0].id); if (wins[0].space !== os.activeSpace) os.setActiveSpace(wins[0].space); }
          os.uiPatch({ switcher: null });
        }
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  if (off) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <button
          className="flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/25 text-[30px] transition-all hover:border-white/70 hover:bg-white/5"
          onClick={() => useOS.getState().set({ off: false })}
          aria-label="Power on"
        >⏻</button>
        <div className="mt-4 text-[12px] opacity-40">Click to start up BrowserMac</div>
      </div>
    );
  }

  if (booting) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <div className="mb-8 text-[44px] font-light"></div>
        <div className="h-[5px] w-[180px] overflow-hidden rounded-full bg-white/20">
          <div className="boot-bar h-full rounded-full bg-white" />
        </div>
      </div>
    );
  }

  const stage = prefs.stageManager;
  const focusedApp = focusedWin ? windows[focusedWin]?.appId : null;
  const visible = Object.values(windows)
    .filter((w) => w.space === activeSpace && !w.minimized)
    .filter((w) => (stage && focusedApp ? w.appId === focusedApp : true))
    .sort((a, b) => a.z - b.z);

  return (
    <div
      className="os-root fixed inset-0 overflow-hidden font-sans"
      style={{ filter: `brightness(${prefs.brightness / 100 + 0.001})` }}
      onContextMenu={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <Desktop />
      {visible.map((w) => <WindowFrame key={w.id} win={w} />)}
      <MenuBar />
      <StageStrip />
      <Dock />
      <Spotlight />
      <MissionControl />
      <AppSwitcher />
      <Launchpad />
      <QuickLook />
      <ControlCenter />
      <NotificationCenter />
      <GetInfoPanel />
      <ConflictDialog />
      <ContextMenuHost />
      <Toasts />
      {prefs.nightShift && <div className="pointer-events-none fixed inset-0 z-[9990]" style={{ background: '#ff9329', opacity: 0.09, mixBlendMode: 'multiply' }} />}
      {locked && <LockScreen wallpaper={prefs.wallpaper} />}
    </div>
  );
}

function openAppSafe(id: string) {
  import('@/apps/registry').then((m) => m.openApp(id));
}

function LockScreen({ wallpaper }: { wallpaper: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const unlock = () => useOS.getState().set({ locked: false });
    window.addEventListener('keydown', unlock);
    return () => { clearInterval(t); window.removeEventListener('keydown', unlock); };
  }, []);
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center text-white" style={wallpaperStyle(wallpaper)} onClick={() => useOS.getState().set({ locked: false })} role="button" aria-label="Unlock">
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative text-center">
        <div className="text-[19px] font-medium drop-shadow">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="text-[76px] font-bold leading-tight drop-shadow tabular-nums">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        <div className="mt-10 rounded-full bg-white/20 px-4 py-1.5 text-[12.5px] backdrop-blur">Click or press any key to unlock</div>
      </div>
    </div>
  );
}


