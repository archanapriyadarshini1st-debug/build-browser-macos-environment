'use client';

import { useEffect, useState } from 'react';
import { useOS, STORE_APPS } from '@/os/store';
import type { Win, FocusMode } from '@/os/types';
import { ACCENTS, WALLPAPERS, fmtBytes } from '@/os/utils';
import { cn } from '@/os/utils';
import { Row, Segmented, Slider, Toggle } from '@/components/ui';
import { AppIcon } from '@/components/icons';
import { storageEstimate } from '@/os/fs';
import { allApps } from './registry';

const SECTIONS = [
  { id: 'appearance', name: 'Appearance', icon: '🌗' },
  { id: 'wallpaper', name: 'Wallpaper', icon: '🏞' },
  { id: 'desktop', name: 'Desktop & Dock', icon: '🖥' },
  { id: 'displays', name: 'Displays', icon: '🔆' },
  { id: 'focus', name: 'Focus & Notifications', icon: '🌙' },
  { id: 'keyboard', name: 'Keyboard', icon: '⌨' },
  { id: 'privacy', name: 'Privacy & Storage', icon: '🔒' },
  { id: 'about', name: 'About This Mac', icon: '' },
];

export function SettingsApp({ win }: { win: Win }) {
  const section = (win.props?.section as string) ?? 'appearance';
  const prefs = useOS((s) => s.prefs);
  const installed = useOS((s) => s.installed);
  const notifications = useOS((s) => s.prefs.notifEnabled);
  const os = useOS.getState();
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });

  useEffect(() => { storageEstimate().then(setUsage); const t = setInterval(() => storageEstimate().then(setUsage), 8000); return () => clearInterval(t); }, []);

  const set = (p: Partial<typeof prefs>) => os.setPrefs(p);

  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <div className="w-[210px] shrink-0 overflow-y-auto border-r border-black/10 p-2 dark:border-white/10">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => os.setWinProps(win.id, { section: s.id })}
            className={cn('mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px]', section === s.id ? 'bg-[var(--accent)]/20 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/8')}
          >
            <span className="w-5 text-center text-[13px]">{s.icon}</span>{s.name}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        {section === 'appearance' && (
          <Pane title="Appearance">
            <Row label="Mode" sub="Auto follows your system preference">
              <Segmented options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'auto', label: 'Auto' }]} value={prefs.appearance} onChange={(v) => set({ appearance: v })} />
            </Row>
            <Row label="Accent color">
              <div className="flex gap-1.5">
                {ACCENTS.map((a) => (
                  <button key={a.id} aria-label={a.name} title={a.name} onClick={() => set({ accent: a.color })} className={cn('h-[20px] w-[20px] rounded-full', prefs.accent === a.color && 'ring-2 ring-offset-2 ring-offset-[var(--win-bg)]')} style={{ background: a.color, ['--tw-ring-color' as string]: a.color }} />
                ))}
              </div>
            </Row>
            <Row label="Transparency" sub="Translucent windows and menus"><Toggle on={prefs.transparency} onChange={(v) => set({ transparency: v })} /></Row>
            <Row label="Reduce motion"><Toggle on={prefs.reducedMotion} onChange={(v) => set({ reducedMotion: v })} /></Row>
            <Row label="Increase contrast"><Toggle on={prefs.highContrast} onChange={(v) => set({ highContrast: v })} /></Row>
            <Row label="Text scaling" sub={`${Math.round(prefs.textScale * 100)}%`}>
              <div className="w-[160px]"><Slider value={prefs.textScale * 100} min={85} max={125} onChange={(v) => set({ textScale: v / 100 })} label="Text scaling" /></div>
            </Row>
          </Pane>
        )}

        {section === 'wallpaper' && (
          <Pane title="Wallpaper">
            <div className="grid grid-cols-3 gap-3">
              {WALLPAPERS.map((w) => (
                <button key={w.id} onClick={() => set({ wallpaper: w.id })} className={cn('overflow-hidden rounded-lg ring-offset-2 transition-all', prefs.wallpaper === w.id ? 'ring-2 ring-[var(--accent)]' : 'hover:opacity-90')} aria-label={w.name}>
                  <div className="h-[72px] w-full" style={w.src ? { backgroundImage: `url(${w.src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: w.css }} />
                  <div className="py-1 text-[11.5px]">{w.name}</div>
                </button>
              ))}
            </div>
          </Pane>
        )}

        {section === 'desktop' && (
          <Pane title="Desktop & Dock">
            <Row label="Show icons on desktop"><Toggle on={prefs.showDesktopIcons} onChange={(v) => set({ showDesktopIcons: v })} /></Row>
            <Row label="Use Stacks" sub="Group desktop items by kind"><Toggle on={prefs.stacks} onChange={(v) => set({ stacks: v })} /></Row>
            <Row label="Icon size" sub={`${prefs.desktopIconSize}px`}>
              <div className="w-[180px]"><Slider value={prefs.desktopIconSize} min={40} max={76} onChange={(v) => set({ desktopIconSize: v })} label="Icon size" /></div>
            </Row>
            <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
            <Row label="Dock size" sub={`${prefs.dockSize}px`}>
              <div className="w-[180px]"><Slider value={prefs.dockSize} min={40} max={68} onChange={(v) => set({ dockSize: v })} label="Dock size" /></div>
            </Row>
            <Row label="Magnification"><Toggle on={prefs.dockMagnify} onChange={(v) => set({ dockMagnify: v })} /></Row>
            <Row label="Automatically hide and show the Dock"><Toggle on={prefs.dockAutoHide} onChange={(v) => set({ dockAutoHide: v })} /></Row>
            <Row label="Position on screen">
              <Segmented options={[{ id: 'left', label: 'Left' }, { id: 'bottom', label: 'Bottom' }, { id: 'right', label: 'Right' }]} value={prefs.dockPosition} onChange={(v) => set({ dockPosition: v })} />
            </Row>
            <Row label="Stage Manager" sub="Group windows into switchable sets"><Toggle on={prefs.stageManager} onChange={(v) => set({ stageManager: v })} /></Row>
            <Row label="Finder default view">
              <Segmented options={[{ id: 'icons', label: '⊞' }, { id: 'list', label: '☰' }, { id: 'columns', label: '▥' }, { id: 'gallery', label: '▤' }]} value={prefs.finderView} onChange={(v) => set({ finderView: v })} />
            </Row>
          </Pane>
        )}

        {section === 'displays' && (
          <Pane title="Displays">
            <Row label="Brightness" sub={`${prefs.brightness}%`}>
              <div className="w-[220px]"><Slider value={prefs.brightness} min={35} max={100} onChange={(v) => set({ brightness: v })} label="Brightness" /></div>
            </Row>
            <Row label="Night Shift" sub="Warm color overlay (simulated)"><Toggle on={prefs.nightShift} onChange={(v) => set({ nightShift: v })} /></Row>
            <p className="mt-4 max-w-[420px] text-[12px] opacity-55">The browser cannot change your real display&apos;s backlight — brightness here dims the desktop surface instead.</p>
          </Pane>
        )}

        {section === 'focus' && (
          <Pane title="Focus & Notifications">
            <Row label="Focus mode" sub="Silences non-system notifications">
              <Segmented
                options={([['off', 'Off'], ['personal', 'Personal'], ['work', 'Work'], ['study', 'Study'], ['sleep', 'Sleep']] as [FocusMode, string][]).map(([id, label]) => ({ id, label }))}
                value={prefs.focus}
                onChange={(v) => set({ focus: v })}
              />
            </Row>
            <div className="mt-3 text-[12px] font-semibold opacity-60">Notifications per app</div>
            {['system', 'finder', 'safari', 'notes', 'appstore', 'messages'].map((app) => (
              <Row key={app} label={app[0].toUpperCase() + app.slice(1)}>
                <Toggle on={prefs.notifEnabled[app] !== false} onChange={(v) => set({ notifEnabled: { ...notifications, [app]: v } })} />
              </Row>
            ))}
          </Pane>
        )}

        {section === 'keyboard' && (
          <Pane title="Keyboard Shortcuts">
            {[
              ['⌘ Space', 'Spotlight search'], ['⌘ Tab', 'Application switcher (hold ⌘)'], ['F3 or ⌃ ↑', 'Mission Control'],
              ['⌃ ← / ⌃ →', 'Switch between Spaces'], ['Space', 'Quick Look selected item'], ['⌘ N', 'New window'],
              ['⇧⌘ N', 'New folder'], ['⌘ W', 'Close window'], ['⌘ M', 'Minimize'], ['⌃ ⌘ F', 'Fullscreen'],
              ['⌘ Z / ⇧⌘ Z', 'Undo / Redo file operations'], ['⌫', 'Move selected to Trash'], ['⌘ C / ⌘ X / ⌥⌘ V', 'Copy / Cut / Paste'],
              ['⌘ I', 'Get Info'], ['Esc', 'Close overlays'],
            ].map(([kbd, desc]) => (
              <Row key={kbd} label={desc}><kbd className="kbd">{kbd}</kbd></Row>
            ))}
          </Pane>
        )}

        {section === 'privacy' && (
          <Pane title="Privacy & Storage">
            <div className="mb-3 rounded-lg bg-black/5 p-3 text-[12.5px] dark:bg-white/8">
              <div className="mb-1 font-semibold">Everything stays on this device</div>
              Files you import are stored in your browser&apos;s IndexedDB — they are never uploaded anywhere. Notes, settings and window layouts persist in localStorage.
            </div>
            <Row label="Storage used" sub={usage.quota ? `${fmtBytes(usage.usage)} of ${fmtBytes(usage.quota)} available` : 'calculating…'}>
              <div className="h-[8px] w-[140px] overflow-hidden rounded-full bg-black/15 dark:bg-white/15">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${usage.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 0}%` }} />
              </div>
            </Row>
            <Row label="Wi-Fi / Bluetooth / AirDrop" sub="Simulated — browsers can&apos;t control radios"><span className="text-[11px] opacity-50">Simulation</span></Row>
            <Row label="Location" sub="Not requested by this system"><Toggle on={false} onChange={() => os.notify('system', 'Location', 'Location access is not implemented in this browser environment.')} /></Row>
            <div className="my-3 h-px bg-black/10 dark:bg-white/10" />
            <Row label="Erase All Content and Settings" sub="Clears local storage and reloads">
              <button className="mac-btn text-[#ff453a]" onClick={() => {
                if (window.confirm('Erase everything? Files, notes and settings will be permanently removed from this browser.')) {
                  indexedDB.deleteDatabase('browsermac');
                  localStorage.clear();
                  window.location.reload();
                }
              }}>Erase…</button>
            </Row>
          </Pane>
        )}

        {section === 'about' && (
          <div className="flex flex-col items-center pt-4">
            <div className="mb-4 flex h-[86px] w-[86px] items-center justify-center rounded-[24px] bg-gradient-to-b from-[#3a3f47] to-[#16181c] text-[38px] shadow-lg"></div>
            <div className="text-[20px] font-bold">BrowserMac</div>
            <div className="mb-4 text-[12.5px] opacity-60">Version 26.0 “Sequoia Web”</div>
            <div className="w-full max-w-[420px] rounded-xl bg-black/4 p-3 text-[12.5px] dark:bg-white/6">
              <Row label="Chip" sub="JavaScriptCore / V8 · WebAssembly class" />
              <Row label="Memory" sub="Shared with your browser tabs" />
              <Row label="Startup disk" sub="IndexedDB · local to this browser" />
              <Row label="Display" sub={`${window.innerWidth} × ${window.innerHeight} @ ${typeof window !== 'undefined' ? window.devicePixelRatio : 1}x`} />
              <Row label="Apps installed" sub={`${installed.length} of ${allApps().length}`} />
              <Row label="App Store extras" sub={STORE_APPS.filter((a) => installed.includes(a.id)).map((a) => a.name).join(', ') || 'None installed'} />
            </div>
            <button className="mac-btn mt-4" onClick={() => os.notify('system', 'Up to date', 'BrowserMac 26.0 is the latest version.')}>Check for Updates</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[17px] font-bold">{title}</h2>
      <div className="max-w-[560px]">{children}</div>
    </div>
  );
}
