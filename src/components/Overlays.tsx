'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOS } from '@/os/store';
import * as fs from '@/os/fs';
import type { FSNode } from '@/os/types';
import { cn, fmtBytes, fmtDateTime, relTime, TAG_COLORS } from '@/os/utils';
import { AppIcon, FileGlyph, FolderGlyph, AliasBadge } from './icons';
import { allApps, getApp, openApp, openFileById } from '@/apps/registry';
import { getBlob } from '@/os/idb';
import { Slider } from './ui';

// ================= SPOTLIGHT =================
export function Spotlight() {
  const open = useOS((s) => s.ui.spotlight);
  const nodes = useOS((s) => s.nodes);
  const notes = useOS((s) => s.notes);
  const installed = useOS((s) => s.installed);
  const tags = useOS((s) => s.tags);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const out: Array<{ kind: 'app' | 'file' | 'note' | 'action' | 'tag'; id: string; title: string; sub: string; run: () => void }> = [];
    const os = useOS.getState();
    for (const a of allApps().filter((a) => installed.includes(a.id))) {
      if (a.name.toLowerCase().includes(q.toLowerCase())) out.push({ kind: 'app', id: a.id, title: a.name, sub: 'Application', run: () => openApp(a.id) });
    }
    for (const n of fs.searchFiles(q)) {
      out.push({ kind: 'file', id: n.id, title: n.name, sub: fs.pathString(n.parent ?? ''), run: () => openFileById(n.id) });
    }
    for (const n of notes.filter((n) => (n.title + n.body).toLowerCase().includes(q.toLowerCase())).slice(0, 5)) {
      out.push({ kind: 'note', id: n.id, title: n.title || 'New Note', sub: 'Notes', run: () => openApp('notes') });
    }
    for (const t of tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))) {
      out.push({ kind: 'tag', id: t.id, title: `Tag: ${t.name}`, sub: 'Show tagged items', run: () => openApp('finder', { path: `tag:${t.id}` }) });
    }
    const actions: Array<[string, string, () => void]> = [
      ['Empty Trash', 'System', () => fs.emptyTrash()],
      ['Toggle Dark Mode', 'System', () => os.setPrefs({ appearance: os.prefs.appearance === 'dark' ? 'light' : 'dark' })],
      ['New Space', 'System', () => os.addSpace()],
      ['Toggle Stage Manager', 'System', () => os.setPrefs({ stageManager: !os.prefs.stageManager })],
      ['System Settings', 'System', () => openApp('settings')],
      ['Sleep', 'System', () => os.set({ locked: true })],
    ];
    for (const [title, sub, run] of actions) {
      if (title.toLowerCase().includes(q.toLowerCase())) out.push({ kind: 'action', id: title, title, sub, run });
    }
    return out.slice(0, 12);
  }, [q, nodes, notes, installed, tags]);

  if (!open) return null;
  void nodes;
  return (
    <div className="fixed inset-0 z-[9700] flex items-start justify-center pt-[18vh]" onPointerDown={() => useOS.getState().uiPatch({ spotlight: false })}>
      <div className="spotlight-pop w-[560px] max-w-[92vw] overflow-hidden rounded-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-[16px] opacity-50">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && results[idx]) { results[idx].run(); useOS.getState().uiPatch({ spotlight: false }); }
              else if (e.key === 'Escape') useOS.getState().uiPatch({ spotlight: false });
            }}
            placeholder="Spotlight Search"
            aria-label="Spotlight search"
            className="flex-1 bg-transparent text-[19px] font-medium outline-none"
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-[340px] overflow-y-auto border-t border-black/10 py-1 dark:border-white/10">
            {results.map((r, i) => (
              <button
                key={r.kind + r.id}
                onClick={() => { r.run(); useOS.getState().uiPatch({ spotlight: false }); }}
                onMouseEnter={() => setIdx(i)}
                className={cn('flex w-full items-center gap-3 px-4 py-[7px] text-left', i === idx && 'bg-[var(--accent)] text-white')}
              >
                {r.kind === 'app' ? <AppIcon appId={r.id} size={26} /> : r.kind === 'file' ? (fs.get(r.id)?.kind === 'folder' ? <FolderGlyph size={26} /> : <FileGlyph node={fs.get(r.id)!} size={26} />) : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-black/8 text-[13px] dark:bg-white/10">{r.kind === 'note' ? '🗒' : r.kind === 'tag' ? '#' : '⚙'}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{r.title}</span>
                  <span className={cn('block truncate text-[11px]', i === idx ? 'text-white/70' : 'opacity-45')}>{r.sub}</span>
                </span>
                <span className="text-[10px] uppercase opacity-40">{r.kind}</span>
              </button>
            ))}
          </div>
        )}
        {q && !results.length && <div className="border-t border-black/10 px-4 py-3 text-[13px] opacity-50 dark:border-white/10">No results for “{q}”</div>}
      </div>
    </div>
  );
}

// ================= QUICK LOOK =================
export function QuickLook() {
  const ql = useOS((s) => s.ui.quicklook);
  const nodes = useOS((s) => s.nodes);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const node = ql ? (nodes[ql.ids[ql.index]] as FSNode | undefined) : undefined;

  useEffect(() => {
    setZoom(1); setRot(0);
    let revoke: string | null = null;
    setUrl(null);
    if (!node || node.kind !== 'file') return;
    getBlob(node.id).then((b) => { if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); } });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [node?.id]);

  useEffect(() => {
    if (!ql) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (e.key === 'ArrowRight') os.uiPatch({ quicklook: { ...ql, index: Math.min(ql.index + 1, ql.ids.length - 1) } });
      if (e.key === 'ArrowLeft') os.uiPatch({ quicklook: { ...ql, index: Math.max(ql.index - 1, 0) } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ql]);

  if (!ql || !node) return null;
  const cat = node.mime?.startsWith('image/') ? 'image' : node.mime?.startsWith('video/') ? 'video' : node.mime?.startsWith('audio/') ? 'audio' : node.ext === 'pdf' ? 'pdf' : 'text';
  const close = () => useOS.getState().uiPatch({ quicklook: null });
  const step = (d: number) => {
    const ni = ql.index + d;
    if (ni >= 0 && ni < ql.ids.length) useOS.getState().uiPatch({ quicklook: { ...ql, index: ni } });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9750] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onPointerDown={close}>
      <div className="ql-pop flex max-h-[86vh] w-[min(880px,92vw)] flex-col overflow-hidden rounded-xl bg-[#181a1e] text-white shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex h-[44px] shrink-0 items-center gap-2 px-3">
          <button className="mac-btn dark" disabled={ql.index <= 0} onClick={() => step(-1)} aria-label="Previous">‹</button>
          <button className="mac-btn dark" disabled={ql.index >= ql.ids.length - 1} onClick={() => step(1)} aria-label="Next">›</button>
          <div className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold">{node.name}</div>
          <span className="text-[11px] opacity-45">{fmtBytes(node.size)} · {ql.index + 1}/{ql.ids.length}</span>
          {cat === 'image' && (
            <>
              <button className="mac-btn dark" onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))} aria-label="Zoom out">−</button>
              <button className="mac-btn dark" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in">＋</button>
              <button className="mac-btn dark" onClick={() => setRot((r) => (r + 90) % 360)} aria-label="Rotate">⟳</button>
            </>
          )}
          <button className="mac-btn dark" onClick={() => { openFileById(node.id); close(); }} title="Open with…">⧉</button>
          <button className="mac-btn dark" onClick={() => fs.exportNode(node.id)} title="Download">⇩</button>
          <button className="mac-btn dark" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="min-h-[280px] flex-1 overflow-auto" style={{ background: 'repeating-conic-gradient(#202329 0% 25%, #181a1e 0% 50%) 50% / 24px 24px' }}>
          {cat === 'image' && url && (
            <div className="flex min-h-[300px] items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={node.name} className="max-h-[70vh] max-w-full rounded shadow-2xl transition-transform duration-200" style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }} />
            </div>
          )}
          {cat === 'video' && url && <video src={url} controls autoPlay className="mx-auto my-4 max-h-[70vh] w-[min(800px,90%)] rounded" />}
          {cat === 'audio' && url && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-[96px] w-[96px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff6d84] to-[#f5395f] text-[38px]">♫</div>
              <audio src={url} controls autoPlay className="w-[min(420px,80%)]" />
            </div>
          )}
          {cat === 'pdf' && url && <iframe src={url} title={node.name} className="h-[70vh] w-full bg-white" />}
          {cat === 'text' && (
            <pre className="whitespace-pre-wrap p-6 font-mono text-[12.5px] leading-relaxed text-[#d8dee6]">{node.text ?? (url ? 'Loading…' : 'No preview available — download to view.')}</pre>
          )}
          {node.kind === 'folder' && (
            <div className="flex flex-col items-center gap-2 py-14 opacity-70">
              <FolderGlyph size={80} />
              <div>{fs.childrenOf(node.id).length} items</div>
              <button className="mac-btn dark" onClick={() => { openApp('finder', { path: node.id }); close(); }}>Open in Finder</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ================= MISSION CONTROL =================
export function MissionControl() {
  const open = useOS((s) => s.ui.mission);
  const windows = useOS((s) => s.windows);
  const spaces = useOS((s) => s.spaces);
  const activeSpace = useOS((s) => s.activeSpace);
  const os = useOS.getState();

  if (!open) return null;
  const visible = Object.values(windows).filter((w) => w.space === activeSpace);

  return (
    <div className="mc-bg fixed inset-0 z-[9600] flex flex-col" onPointerDown={() => os.uiPatch({ mission: false })}>
      {/* spaces bar */}
      <div className="flex items-center gap-2 px-6 pb-2 pt-4" onPointerDown={(e) => e.stopPropagation()}>
        {spaces.map((sp) => {
          const count = Object.values(windows).filter((w) => w.space === sp.id).length;
          return (
            <button
              key={sp.id}
              onClick={() => { os.setActiveSpace(sp.id); }}
              onDoubleClick={() => { const name = window.prompt('Rename Space', sp.name); if (name) os.renameSpace(sp.id, name); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('application/x-bm-win'); if (id) os.moveWinToSpace(id, sp.id); }}
              className={cn('mc-thumb group relative h-[74px] w-[124px] overflow-hidden rounded-lg border transition-all', sp.id === activeSpace ? 'border-white/80 ring-2 ring-[var(--accent)]' : 'border-white/20 hover:border-white/50')}
            >
              <div className="absolute inset-0 opacity-80" style={{ background: 'linear-gradient(150deg,#2b3549,#141a26)' }} />
              <div className="absolute bottom-1 left-2 text-[11px] font-semibold text-white">{sp.name}</div>
              <div className="absolute right-1.5 top-1 rounded bg-black/40 px-1 text-[9px] text-white/80">{count}</div>
              {spaces.length > 1 && (
                <button className="absolute left-1 top-1 hidden rounded bg-black/50 px-1 text-[10px] text-white group-hover:block" onClick={(e) => { e.stopPropagation(); os.removeSpace(sp.id); }} aria-label={`Remove ${sp.name}`}>✕</button>
              )}
            </button>
          );
        })}
        <button onClick={() => os.addSpace()} className="flex h-[74px] w-[54px] items-center justify-center rounded-lg border border-dashed border-white/30 text-[22px] text-white/70 hover:border-white/60 hover:text-white" aria-label="Add Space">＋</button>
        <div className="ml-auto text-[11.5px] text-white/50">⌃← ⌃→ to switch · drag windows between Spaces · double-click a Space to rename</div>
      </div>

      {/* windows of current space */}
      <div className="flex flex-1 flex-wrap content-start items-start gap-5 overflow-y-auto px-10 pt-4" onPointerDown={(e) => e.stopPropagation()}>
        {visible.map((w) => {
          const app = getApp(w.appId);
          return (
            <div
              key={w.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-bm-win', w.id)}
              onClick={() => { os.focusWin(w.id); os.setActiveSpace(w.space); os.uiPatch({ mission: false }); }}
              className="mc-win group relative cursor-pointer overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15 transition-transform hover:scale-[1.02]"
              style={{ width: Math.min(340, w.w / 2.4), height: Math.min(220, w.h / 2.4) }}
            >
              <div className="flex h-[24px] items-center gap-1 bg-black/45 px-2">
                <span className="h-[7px] w-[7px] rounded-full bg-[#ff5f57]" /><span className="h-[7px] w-[7px] rounded-full bg-[#febc2e]" /><span className="h-[7px] w-[7px] rounded-full bg-[#28c840]" />
                <span className="ml-2 truncate text-[10px] text-white/80">{w.title}</span>
                {w.minimized && <span className="ml-auto text-[9px] text-white/50">minimized</span>}
              </div>
              <div className="flex h-[calc(100%-24px)] items-center justify-center" style={{ background: 'linear-gradient(160deg,#262c38,#171b23)' }}>
                <AppIcon appId={w.appId} size={44} />
              </div>
              <button
                className="absolute right-1.5 top-[30px] hidden rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
                onClick={(e) => { e.stopPropagation(); os.closeWin(w.id); }}
                aria-label="Close window"
              >✕</button>
              <div className="absolute bottom-1 left-2 text-[9.5px] text-white/50">{app?.name}</div>
            </div>
          );
        })}
        {!visible.length && (
          <div className="mt-[16vh] w-full text-center text-[14px] text-white/50">
            No windows on this Space. Open an app from the Dock, or press ＋ to add another Space.
          </div>
        )}
      </div>
    </div>
  );
}

// ================= APP SWITCHER =================
export function AppSwitcher() {
  const sw = useOS((s) => s.ui.switcher);
  if (!sw) return null;
  const sel = sw.ids[sw.index];
  const app = getApp(sel);
  return (
    <div className="fixed inset-0 z-[9650] flex items-center justify-center bg-black/30 backdrop-blur-[3px]">
      <div className="flex items-end gap-4 rounded-2xl bg-black/45 px-6 py-4 backdrop-blur-xl">
        {sw.ids.map((id, i) => (
          <div key={id} className="flex flex-col items-center gap-1">
            <div className={cn('transition-all duration-100', i === sw.index ? 'scale-110' : 'opacity-70')}>
              <AppIcon appId={id} size={i === sw.index ? 62 : 48} />
            </div>
            {i === sw.index && <div className="max-w-[110px] truncate rounded bg-black/50 px-2 text-[11px] text-white">{app?.name ?? id}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= LAUNCHPAD =================
export function Launchpad() {
  const open = useOS((s) => s.ui.launchpad);
  const installed = useOS((s) => s.installed);
  const [q, setQ] = useState('');
  if (!open) return null;
  const apps = allApps().filter((a) => installed.includes(a.id) && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const builtinIds = new Set(['finder', 'safari', 'notes', 'textedit', 'preview', 'photos', 'music', 'calculator', 'terminal', 'settings', 'appstore', 'activity']);
  return (
    <div className="fixed inset-0 z-[9550] flex flex-col items-center pt-[8vh] backdrop-blur-2xl" style={{ background: 'rgba(20,22,28,.55)' }} onPointerDown={() => useOS.getState().uiPatch({ launchpad: false })}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') useOS.getState().uiPatch({ launchpad: false }); if (e.key === 'Enter' && apps[0]) { openApp(apps[0].id); } }}
        placeholder="Search apps"
        aria-label="Search applications"
        className="mb-8 w-[280px] rounded-lg bg-white/15 px-3 py-[6px] text-center text-[14px] text-white outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="grid max-w-[860px] grid-cols-[repeat(auto-fill,96px)] justify-center gap-x-4 gap-y-6 px-8" onPointerDown={(e) => e.stopPropagation()}>
        {apps.map((a) => (
          <button
            key={a.id}
            className="flex flex-col items-center gap-1.5"
            onClick={() => openApp(a.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!builtinIds.has(a.id)) {
                if (window.confirm(`Delete “${a.name}”? You can reinstall it from the App Store.`)) useOS.getState().uninstallApp(a.id);
              }
            }}
          >
            <div className="transition-transform hover:scale-105"><AppIcon appId={a.id} size={64} /></div>
            <span className="text-[12px] text-white drop-shadow">{a.name}</span>
          </button>
        ))}
      </div>
      {!apps.length && <div className="mt-8 text-white/60">No apps match “{q}”</div>}
    </div>
  );
}

// ================= CONTROL CENTER =================
export function ControlCenter() {
  const open = useOS((s) => s.ui.control);
  const prefs = useOS((s) => s.prefs);
  const music = useOS((s) => s.music);
  const nodes = useOS((s) => s.nodes);
  if (!open) return null;
  const os = useOS.getState();
  const track = music.current ? nodes[music.current] : null;
  return (
    <div className="fixed inset-0 z-[9500]" onPointerDown={() => os.uiPatch({ control: false })}>
      <div className="cc-pop absolute right-2 top-[34px] w-[320px] rounded-2xl p-3" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div className="cc-tile">
            <CCRow icon="📶" label="Wi-Fi" value={prefs.wifi ? 'BrowserNet' : 'Off'} on={prefs.wifi} onToggle={() => os.setPrefs({ wifi: !prefs.wifi })} />
            <CCRow icon="🔵" label="Bluetooth" value={prefs.bluetooth ? 'On' : 'Off'} on={prefs.bluetooth} onToggle={() => os.setPrefs({ bluetooth: !prefs.bluetooth })} />
            <CCRow icon="📡" label="AirDrop" value={prefs.airdrop ? 'Everyone' : 'Off'} on={prefs.airdrop} onToggle={() => os.setPrefs({ airdrop: !prefs.airdrop })} />
            <div className="px-1 pt-1 text-[9px] leading-tight opacity-40">Radio controls are simulated — browsers can&apos;t reach hardware.</div>
          </div>
          <div className="flex flex-col gap-2">
            <button className={cn('cc-tile flex-1 text-left', prefs.focus !== 'off' && 'ring-1 ring-[var(--accent)]')} onClick={() => os.setPrefs({ focus: prefs.focus === 'off' ? 'personal' : 'off' })}>
              <div className="text-[15px]">🌙</div>
              <div className="text-[12px] font-semibold">Focus</div>
              <div className="text-[10.5px] opacity-55">{prefs.focus === 'off' ? 'Off' : prefs.focus[0].toUpperCase() + prefs.focus.slice(1)}</div>
            </button>
            <button className="cc-tile flex-1 text-left" onClick={() => os.setPrefs({ stageManager: !prefs.stageManager })}>
              <div className="text-[15px]">🗂</div>
              <div className="text-[12px] font-semibold">Stage Manager</div>
              <div className="text-[10.5px] opacity-55">{prefs.stageManager ? 'On' : 'Off'}</div>
            </button>
          </div>
        </div>

        <div className="cc-tile mb-2">
          <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
            <span>Display</span>
            <button className="rounded-md bg-black/8 px-2 py-[2px] text-[10.5px] font-medium dark:bg-white/12" onClick={() => os.setPrefs({ appearance: prefs.appearance === 'dark' ? 'light' : 'dark' })}>
              {prefs.appearance === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
          <div className="flex items-center gap-2"><span className="text-[11px] opacity-60">☀</span><Slider value={prefs.brightness} min={35} max={100} onChange={(v) => os.setPrefs({ brightness: v })} label="Brightness" /></div>
        </div>

        <div className="cc-tile mb-2">
          <div className="mb-1 text-[12px] font-semibold">Sound</div>
          <div className="flex items-center gap-2"><span className="text-[11px] opacity-60">🔊</span><Slider value={prefs.volume} min={0} max={100} onChange={(v) => os.setPrefs({ volume: v })} label="Volume" /></div>
        </div>

        {track && (
          <div className="cc-tile flex items-center gap-2">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-gradient-to-b from-[#ff6d84] to-[#f5395f] text-white">♫</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold">{track.name}</div>
              <div className="text-[10.5px] opacity-50">Now Playing</div>
            </div>
            <button className="mac-btn" onClick={() => openApp('music')} aria-label="Open Music">⏯</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CCRow({ icon, label, value, on, onToggle }: { icon: string; label: string; value: string; on: boolean; onToggle: () => void }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-lg px-1 py-[5px] text-left hover:bg-black/5 dark:hover:bg-white/8" onClick={onToggle}>
      <span className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px]', on ? 'bg-[var(--accent)]' : 'bg-black/15 dark:bg-white/15')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold leading-tight">{label}</span>
        <span className="block text-[10.5px] opacity-55">{value}</span>
      </span>
    </button>
  );
}

// ================= NOTIFICATION CENTER =================
export function NotificationCenter() {
  const open = useOS((s) => s.ui.notifCenter);
  const notifs = useOS((s) => s.notifications);
  const prefs = useOS((s) => s.prefs);
  if (!open) return null;
  const os = useOS.getState();
  return (
    <div className="fixed inset-0 z-[9500]" onPointerDown={() => os.uiPatch({ notifCenter: false })}>
      <div className="nc-pop absolute bottom-2 right-2 top-[34px] flex w-[340px] flex-col gap-2 overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
        <div className="cc-tile">
          <div className="text-[22px] font-bold">{new Date().toLocaleDateString([], { weekday: 'long' })}</div>
          <div className="text-[12px] opacity-60">{new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })} · Focus: {prefs.focus === 'off' ? 'Off' : prefs.focus}</div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold opacity-70">Notifications</span>
          {notifs.length > 0 && <button className="text-[11.5px] text-[var(--accent)]" onClick={() => os.clearNotifs()}>Clear All</button>}
        </div>
        {notifs.length === 0 && <div className="cc-tile py-8 text-center text-[12.5px] opacity-50">No Notifications</div>}
        {notifs.map((n) => (
          <div key={n.id} className="cc-tile group relative">
            <div className="flex items-start gap-2.5">
              <AppIcon appId={['finder', 'safari', 'notes', 'appstore', 'music', 'photos'].includes(n.app) ? n.app : 'settings'} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-bold">{n.title}</span>
                  <span className="text-[10px] opacity-40">{relTime(n.time)}</span>
                </div>
                <div className="text-[12px] opacity-75">{n.body}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-35">{n.app}</div>
              </div>
            </div>
            <button className="absolute right-1.5 top-1.5 hidden rounded-full bg-black/15 px-1.5 text-[10px] group-hover:block dark:bg-white/15" onClick={() => os.dismissNotif(n.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= GET INFO =================
export function GetInfoPanel() {
  const id = useOS((s) => s.ui.getInfo);
  const nodes = useOS((s) => s.nodes);
  const tags = useOS((s) => s.tags);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const node = id ? nodes[id] : undefined;

  useEffect(() => {
    setDims(null);
    if (!node || !(node.mime ?? '').startsWith('image/')) return;
    let revoke = '';
    getBlob(node.id).then((b) => {
      if (!b) return;
      revoke = URL.createObjectURL(b);
      const img = new Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = revoke;
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [node?.id]);

  if (!node) return null;
  const os = useOS.getState();
  const close = () => os.uiPatch({ getInfo: null });
  return createPortal(
    <div className="fixed inset-0 z-[9400]" onPointerDown={close}>
      <div className="info-pop absolute left-1/2 top-[12vh] w-[300px] -translate-x-1/2 rounded-xl p-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          {node.kind === 'folder' ? <FolderGlyph size={52} /> : node.kind === 'alias' ? <div className="relative"><FolderGlyph size={52} /><AliasBadge /></div> : <FileGlyph node={node} size={52} />}
          <div className="min-w-0 flex-1">
            <input
              defaultValue={node.name}
              onBlur={(e) => fs.rename(node.id, e.target.value || node.name)}
              onKeyDown={(e) => { if (e.key === 'Enter') { fs.rename(node.id, (e.target as HTMLInputElement).value); close(); } }}
              className="w-full rounded bg-transparent text-[14px] font-bold outline-none ring-[var(--accent)] focus:bg-black/5 focus:px-1 focus:ring-2 dark:focus:bg-white/10"
              aria-label="Item name"
            />
            <div className="text-[11px] opacity-50">{node.kind === 'folder' ? 'Folder' : node.kind === 'alias' ? 'Alias' : (node.ext?.toUpperCase() || 'File')}</div>
          </div>
          <button onClick={close} className="self-start opacity-50 hover:opacity-100" aria-label="Close">✕</button>
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            <InfoRow k="Kind" v={node.kind === 'folder' ? 'Folder' : (node.mime || 'Unknown')} />
            <InfoRow k="Size" v={node.kind === 'folder' ? `${fs.childrenOf(node.id).length} items (${fmtBytes(fs.folderSize(node.id))})` : fmtBytes(node.size)} />
            {dims && <InfoRow k="Dimensions" v={`${dims.w} × ${dims.h}px`} />}
            <InfoRow k="Where" v={fs.pathString(node.parent ?? '')} />
            <InfoRow k="Created" v={fmtDateTime(node.createdAt)} />
            <InfoRow k="Modified" v={fmtDateTime(node.modifiedAt)} />
            {node.aliasTarget && <InfoRow k="Original" v={fs.get(node.aliasTarget)?.name ?? 'Missing'} />}
            <InfoRow k="Sharing" v="Read & Write (you · staff) — simulated" />
          </tbody>
        </table>
        <div className="mt-3 border-t border-black/10 pt-2 dark:border-white/10">
          <div className="mb-1.5 text-[11px] font-semibold opacity-60">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = (node.tags ?? []).includes(t.id);
              return (
                <button key={t.id} onClick={() => fs.toggleTag(node.id, t.id)} className={cn('flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px]', on ? 'text-white' : 'bg-black/8 dark:bg-white/10')} style={on ? { background: t.color } : {}}>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? '#fff' : t.color }} />{t.name}
                </button>
              );
            })}
          </div>
          <button className="mt-2 text-[11px] text-[var(--accent)]" onClick={() => { const name = window.prompt('New tag name'); if (name) { const tid = fs.createTag(name, TAG_COLORS[tags.length % TAG_COLORS.length]); fs.toggleTag(node.id, tid); } }}>+ New Tag</button>
        </div>
        <div className="mt-3 flex justify-between border-t border-black/10 pt-2.5 dark:border-white/10">
          <button className="mac-btn" onClick={() => fs.setFavorite(node.id, !node.favorite)}>{node.favorite ? '★ Favorited' : '☆ Add to Favorites'}</button>
          <button className="mac-btn" onClick={() => fs.exportNode(node.id)}>⇩ Download</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/5">
      <td className="w-[84px] py-[4px] pr-2 align-top opacity-50">{k}</td>
      <td className="break-words py-[4px]">{v}</td>
    </tr>
  );
}

// ================= CONFLICT DIALOG =================
export function ConflictDialog() {
  const conflict = useOS((s) => s.ui.conflict);
  if (!conflict) return null;
  const os = useOS.getState();
  const cancel = () => os.uiPatch({ conflict: null });
  return createPortal(
    <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black/30">
      <div className="dialog w-[400px] rounded-xl p-5">
        <h2 className="text-[14px] font-bold">“{conflict.names[0]}” already exists{conflict.names.length > 1 ? ` (+${conflict.names.length - 1} more)` : ''}</h2>
        <p className="mt-1.5 text-[12.5px] opacity-65">The destination already contains an item with this name. Do you want to replace it, or keep both?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="mac-btn" onClick={cancel}>Cancel</button>
          <button className="mac-btn" onClick={() => fs.applyTransfer(conflict.op, conflict.ids, conflict.dest, 'keepboth')}>Keep Both</button>
          <button className="mac-btn-primary" onClick={() => fs.applyTransfer(conflict.op, conflict.ids, conflict.dest, 'replace')}>Replace</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ================= STAGE MANAGER STRIP =================
export function StageStrip() {
  const on = useOS((s) => s.prefs.stageManager);
  const windows = useOS((s) => s.windows);
  const activeSpace = useOS((s) => s.activeSpace);
  const focusedWin = useOS((s) => s.focusedWin);
  if (!on) return null;
  const os = useOS.getState();
  const visible = Object.values(windows).filter((w) => w.space === activeSpace);
  const groups = new Map<string, number>();
  for (const w of visible) groups.set(w.appId, (groups.get(w.appId) ?? 0) + 1);
  const activeApp = focusedWin ? windows[focusedWin]?.appId : null;
  return (
    <div className="fixed left-2 top-1/2 z-[9200] flex -translate-y-1/2 flex-col gap-2 rounded-2xl bg-black/25 p-2 backdrop-blur-xl dark:bg-white/10">
      {Array.from(groups.entries()).map(([appId, count]) => (
        <button
          key={appId}
          onClick={() => { const w = visible.filter((x) => x.appId === appId).sort((a, b) => b.z - a.z)[0]; if (w) os.focusWin(w.id); }}
          className={cn('relative rounded-xl p-1 transition-all', appId === activeApp ? 'bg-white/25 ring-1 ring-white/40' : 'opacity-70 hover:opacity-100')}
          aria-label={`Switch to ${getApp(appId)?.name}`}
          title={getApp(appId)?.name}
        >
          <AppIcon appId={appId} size={36} />
          {count > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-[var(--accent)] px-1 text-[9px] text-white">{count}</span>}
        </button>
      ))}
      {!groups.size && <div className="px-1 text-[9.5px] text-white/60">No windows</div>}
    </div>
  );
}

// ================= TOASTS =================
export function Toasts() {
  const notifs = useOS((s) => s.notifications);
  const [toasts, setToasts] = useState<typeof notifs>([]);
  const seen = useRef(0);
  useEffect(() => {
    if (notifs.length > seen.current) {
      const fresh = notifs.slice(0, notifs.length - seen.current);
      setToasts((t) => [...fresh, ...t].slice(0, 3));
      fresh.forEach((n) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 4600));
    }
    seen.current = notifs.length;
  }, [notifs]);
  return (
    <div className="pointer-events-none fixed right-2 top-[36px] z-[9950] flex w-[320px] flex-col gap-2">
      {toasts.map((n) => (
        <button key={n.id} className="toast-in cc-tile pointer-events-auto text-left" onClick={() => { useOS.getState().uiPatch({ notifCenter: true }); setToasts((t) => t.filter((x) => x.id !== n.id)); }}>
          <div className="flex items-start gap-2.5">
            <AppIcon appId={['finder', 'safari', 'notes', 'appstore', 'music'].includes(n.app) ? n.app : 'settings'} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2"><span className="text-[12.5px] font-bold">{n.title}</span><span className="text-[9.5px] opacity-40">now</span></div>
              <div className="line-clamp-2 text-[12px] opacity-75">{n.body}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
