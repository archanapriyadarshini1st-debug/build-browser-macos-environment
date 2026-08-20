'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { FSNode, MenuItem } from '@/os/types';
import * as fs from '@/os/fs';
import { cn, fileCategory, wallpaperStyle } from '@/os/utils';
import { AppIcon, FileGlyph, FolderGlyph, AliasBadge } from './icons';
import { openMenu } from './ui';
import { openApp, openFileById, quickLook } from '@/apps/registry';

const GRID_W = 96;
const GRID_H = 100;

export function Desktop() {
  const nodes = useOS((s) => s.nodes);
  const prefs = useOS((s) => s.prefs);
  const tags = useOS((s) => s.tags);
  const renameId = useOS((s) => s.ui.renameId);
  const [sel, setSel] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [openStack, setOpenStack] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; orig: Map<string, { x: number; y: number }>; moved: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const items = fs.sortNodes(Object.values(nodes).filter((n) => n.parent === fs.DESKTOP && !n.trashed));
  const iconSize = prefs.desktopIconSize;

  const autoPos = useCallback((i: number) => {
    const H = window.innerHeight - 60;
    const perCol = Math.max(1, Math.floor(H / GRID_H));
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    return { x: window.innerWidth - 110 - col * GRID_W, y: 20 + row * GRID_H };
  }, []);

  const posOf = (n: FSNode, i: number) => n.pos ?? autoPos(i);

  // global import event (menu bar / shortcuts)
  useEffect(() => {
    const h = () => fileInput.current?.click();
    window.addEventListener('os-import', h);
    return () => window.removeEventListener('os-import', h);
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const os = useOS.getState();
      if (os.ui.spotlight || os.ui.mission || os.ui.quicklook || os.ui.switcher) return;
      if (!sel.length) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        fs.trash(sel);
        os.notify('system', 'Moved to Trash', `${sel.length} item${sel.length > 1 ? 's' : ''}.`);
        setSel([]);
      } else if (e.key === 'Enter') {
        openFileById(sel[0]);
      } else if (e.key === ' ') {
        e.preventDefault();
        quickLook(sel, 0);
      } else if (e.key === 'Escape') {
        setSel([]);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        os.setClipboard({ mode: 'copy', ids: sel });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') {
        os.setClipboard({ mode: 'cut', ids: sel });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        os.uiPatch({ getInfo: sel[0] });
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const cur = fs.get(sel[sel.length - 1]);
        if (!cur) return;
        const p = posOf(cur, items.findIndex((x) => x.id === cur.id));
        let best: FSNode | null = null;
        let bd = Infinity;
        for (const it of items) {
          if (it.id === cur.id) continue;
          const q = posOf(it, items.findIndex((x) => x.id === it.id));
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const ok = e.key === 'ArrowLeft' ? dx < -10 : e.key === 'ArrowRight' ? dx > 10 : e.key === 'ArrowUp' ? dy < -10 : dy > 10;
          if (!ok) continue;
          const d = dx * dx + dy * dy * 2;
          if (d < bd) { bd = d; best = it; }
        }
        if (best) setSel([best.id]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- desktop background interactions -----
  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.dtop-item')) return;
    useOS.setState({ focusedWin: null });
    useOS.getState().uiPatch({ control: false, notifCenter: false });
    setSel([]);
    setOpenStack(null);
    const sx = e.clientX;
    const sy = e.clientY;
    setMarquee({ x: sx, y: sy, w: 0, h: 0 });
    const move = (ev: PointerEvent) => {
      const x = Math.min(sx, ev.clientX);
      const y = Math.min(sy, ev.clientY);
      const w = Math.abs(ev.clientX - sx);
      const h = Math.abs(ev.clientY - sy);
      setMarquee({ x, y, w, h });
      const hits = items.filter((n, i) => {
        const p = posOf(n, i);
        return p.x < x + w && p.x + iconSize + 24 > x && p.y < y + h && p.y + iconSize + 30 > y;
      }).map((n) => n.id);
      setSel(hits);
    };
    const up = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const bgMenu = (e: React.MouseEvent) => {
    const os = useOS.getState();
    openMenu(e, [
      { label: 'New Folder', kbd: '⇧⌘N', onSelect: () => { const id = fs.createFolder(fs.DESKTOP); os.uiPatch({ renameId: id }); setSel([id]); } },
      { label: 'New Text Document', onSelect: () => { const id = fs.createTextFile(fs.DESKTOP, 'untitled.txt'); setSel([id]); } },
      { sep: true },
      { label: 'Import Files…', onSelect: () => fileInput.current?.click() },
      { label: 'Import Folder…', onSelect: () => folderInput.current?.click() },
      { sep: true },
      { label: 'Use Stacks', checked: os.prefs.stacks, onSelect: () => os.setPrefs({ stacks: !os.prefs.stacks }) },
      { head: 'Sort By' },
      ...(['name', 'kind', 'date', 'size'] as const).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), checked: os.prefs.sortBy === s, onSelect: () => os.setPrefs({ sortBy: s }) })),
      { label: 'Clean Up', onSelect: cleanUp },
      { sep: true },
      { label: 'Change Wallpaper…', onSelect: () => openApp('settings', { section: 'wallpaper' }) },
      { label: 'View Options…', onSelect: () => openApp('settings', { section: 'desktop' }) },
      { label: 'Get Info', onSelect: () => os.uiPatch({ getInfo: fs.ROOT }) },
    ]);
  };

  const cleanUp = () => {
    const os = useOS.getState();
    const list = fs.sortNodes(Object.values(os.nodes).filter((n) => n.parent === fs.DESKTOP && !n.trashed));
    const nodes = { ...os.nodes };
    list.forEach((n, i) => {
      nodes[n.id] = { ...n, pos: autoPos(i) };
    });
    os.setNodes(nodes);
  };

  // ----- icon interactions -----
  const onIconDown = (e: React.PointerEvent, n: FSNode, idx: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    let nextSel: string[];
    if (e.metaKey || e.ctrlKey) {
      nextSel = sel.includes(n.id) ? sel.filter((x) => x !== n.id) : [...sel, n.id];
      setSel(nextSel);
      return;
    }
    if (e.shiftKey) {
      nextSel = sel.includes(n.id) ? sel : [...sel, n.id];
    } else {
      nextSel = sel.includes(n.id) ? sel : [n.id];
    }
    setSel(nextSel);
    const p = posOf(n, idx);
    const orig = new Map<string, { x: number; y: number }>();
    for (const id of nextSel) {
      const node = fs.get(id);
      if (node) {
        const i2 = items.findIndex((x) => x.id === id);
        orig.set(id, posOf(node, i2));
      }
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig, moved: false };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (!d.moved) return;
      for (const [id, op] of d.orig) {
        const el = document.querySelector(`[data-dtop="${id}"]`) as HTMLElement | null;
        if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const d = dragRef.current;
      dragRef.current = null;
      for (const [id] of orig) {
        const el = document.querySelector(`[data-dtop="${id}"]`) as HTMLElement | null;
        if (el) el.style.transform = '';
      }
      if (!d || !d.moved) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const os = useOS.getState();
      const nodes = { ...os.nodes };
      for (const [id, op] of d.orig) {
        const node = nodes[id];
        if (!node) continue;
        const nx = Math.round((op.x + dx) / 16) * 16;
        const ny = Math.round((op.y + dy) / 16) * 16;
        nodes[id] = { ...node, pos: { x: Math.max(4, Math.min(window.innerWidth - GRID_W, nx)), y: Math.max(4, Math.min(window.innerHeight - GRID_H - 60, ny)) } };
      }
      os.setNodes(nodes);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const iconMenu = (e: React.MouseEvent, n: FSNode) => {
    const os = useOS.getState();
    const ids = sel.includes(n.id) && sel.length > 1 ? sel : [n.id];
    const tagItems: MenuItem[] = os.tags.map((t) => ({
      label: t.name,
      checked: (n.tags ?? []).includes(t.id),
      onSelect: () => ids.forEach((id) => fs.toggleTag(id, t.id)),
    }));
    openMenu(e, [
      { label: 'Open', onSelect: () => openFileById(n.id) },
      { label: 'Open With', head: 'Open With' },
      { label: 'Quick Look', kbd: '␣', onSelect: () => quickLook(ids, ids.indexOf(n.id)) },
      ...(n.kind === 'file' ? [{ label: 'TextEdit', onSelect: () => openApp('textedit', { fileId: n.id }) }] : []),
      ...(n.kind === 'folder' ? [{ label: 'Finder', onSelect: () => openApp('finder', { path: n.id }) }] : []),
      { sep: true },
      { label: 'Rename…', onSelect: () => os.uiPatch({ renameId: n.id }) },
      { label: 'Duplicate', onSelect: () => fs.duplicate(ids) },
      { label: 'Make Alias', onSelect: () => ids.forEach((id) => fs.makeAlias(id, fs.DESKTOP)) },
      { sep: true },
      { label: 'Copy', kbd: '⌘C', onSelect: () => os.setClipboard({ mode: 'copy', ids }) },
      { label: 'Cut', onSelect: () => os.setClipboard({ mode: 'cut', ids }) },
      { label: 'Add to Favorites', onSelect: () => ids.forEach((id) => fs.setFavorite(id, true)) },
      { head: 'Tags' },
      ...tagItems,
      { label: 'New Tag…', onSelect: () => { const name = window.prompt('Tag name'); if (name) { const tid = fs.createTag(name, '#0a84ff'); ids.forEach((id) => fs.toggleTag(id, tid)); } } },
      { sep: true },
      { label: 'Download', onSelect: () => ids.forEach((id) => fs.exportNode(id)) },
      { label: 'Get Info', kbd: '⌘I', onSelect: () => os.uiPatch({ getInfo: n.id }) },
      { label: 'Move to Trash', danger: true, onSelect: () => { fs.trash(ids); setSel([]); } },
    ]);
  };

  const onDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files?.length) {
      await fs.importFiles(files, fs.DESKTOP, { x: e.clientX - 40, y: e.clientY - 40 });
    }
  };

  // ----- stacks -----
  const stackGroups = prefs.stacks
    ? (() => {
        const g = new Map<string, FSNode[]>();
        for (const [i, n] of items.entries()) {
          const key = n.kind === 'folder' ? 'Folders' : ({ image: 'Images', video: 'Media', audio: 'Media', pdf: 'Documents', text: 'Documents', code: 'Documents' } as Record<string, string>)[fileCategory(n)] ?? 'Other';
          const list = g.get(key) ?? [];
          list.push(n);
          g.set(key, list);
          void i;
        }
        return Array.from(g.entries());
      })()
    : [];

  return (
    <div
      className="absolute inset-0 select-none"
      style={wallpaperStyle(prefs.wallpaper)}
      onPointerDown={onBgDown}
      onContextMenu={bgMenu}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={onDropFiles}
      aria-label="Desktop"
    >
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) fs.importFiles(e.target.files, fs.DESKTOP); e.target.value = ''; }} />
      <input ref={folderInput} type="file" multiple hidden {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => { if (e.target.files) fs.importFiles(e.target.files, fs.DESKTOP); e.target.value = ''; }} />

      {prefs.showDesktopIcons && !prefs.stacks && items.map((n, i) => {
        const p = posOf(n, i);
        return (
          <DesktopItem
            key={n.id}
            node={n}
            x={p.x}
            y={p.y}
            size={iconSize}
            selected={sel.includes(n.id)}
            renaming={renameId === n.id}
            tags={tags.filter((t) => (n.tags ?? []).includes(t.id))}
            onDown={(e) => onIconDown(e, n, i)}
            onOpen={() => openFileById(n.id)}
            onMenu={(e) => iconMenu(e, n)}
          />
        );
      })}

      {prefs.stacks && (
        <div className="absolute right-3 top-5 flex flex-col gap-3">
          {stackGroups.map(([label, list], gi) => (
            <div key={label}>
              <button
                className="group relative flex h-[74px] w-[92px] items-end justify-center"
                onClick={() => setOpenStack(openStack === label ? null : label)}
                aria-label={`Stack ${label} (${list.length})`}
              >
                {list.slice(0, 3).map((n, i) => (
                  <div key={n.id} className="absolute bottom-2" style={{ transform: `translateY(${-i * 4}px) scale(${1 - i * 0.06})`, zIndex: 3 - i, opacity: 1 - i * 0.15 }}>
                    {n.kind === 'folder' ? <FolderGlyph size={56} /> : <FileGlyph node={n} size={56} />}
                  </div>
                ))}
                <span className="dock-tip absolute -bottom-5 text-[11px]">{label} · {list.length}</span>
              </button>
              {openStack === label && (
                <div className="stack-pop absolute right-[100px] grid grid-cols-4 gap-2 p-3" style={{ top: gi * 90 }}>
                  {list.map((n) => (
                    <button key={n.id} className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-white/15" onDoubleClick={() => openFileById(n.id)} onClick={() => openFileById(n.id)} onContextMenu={(e) => iconMenu(e, n)}>
                      {n.kind === 'folder' ? <FolderGlyph size={44} /> : <FileGlyph node={n} size={44} />}
                      <span className="max-w-[70px] truncate text-[11px] text-white drop-shadow">{n.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {marquee && (
        <div className="pointer-events-none fixed z-[50] rounded border border-[var(--accent)]/70 bg-[var(--accent)]/15" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
      )}
    </div>
  );
}

export function DesktopItem({ node, x, y, size, selected, renaming, tags, onDown, onOpen, onMenu }: {
  node: FSNode; x: number; y: number; size: number; selected: boolean; renaming: boolean;
  tags: Array<{ id: string; name: string; color: string }>;
  onDown: (e: React.PointerEvent) => void; onOpen: () => void; onMenu: (e: React.MouseEvent) => void;
}) {
  const os = useOS.getState();
  return (
    <div
      data-dtop={node.id}
      className={cn('dtop-item absolute flex cursor-default flex-col items-center', selected && 'dtop-selected')}
      style={{ left: x, top: y, width: size + 28 }}
      onPointerDown={onDown}
      onDoubleClick={onOpen}
      onContextMenu={onMenu}
    >
      <div className={cn('relative rounded-lg p-1', selected && 'bg-[var(--accent)]/35 ring-1 ring-[var(--accent)]/50')}>
        {node.kind === 'folder' ? <FolderGlyph size={size} /> : node.kind === 'alias' ? (
          <div className="relative"><FolderGlyph size={size} /><AliasBadge /></div>
        ) : <FileGlyph node={node} size={size} />}
      </div>
      {tags.length > 0 && (
        <div className="mt-[1px] flex gap-[3px]">
          {tags.slice(0, 4).map((t) => <span key={t.id} className="h-[7px] w-[7px] rounded-full" style={{ background: t.color }} />)}
        </div>
      )}
      {renaming ? (
        <InlineRename initial={node.name} onDone={(v) => { fs.rename(node.id, v); os.uiPatch({ renameId: null }); }} onCancel={() => os.uiPatch({ renameId: null })} />
      ) : (
        <span className="dtop-label mt-[2px] max-w-[92px] truncate px-1 text-center text-[12px] text-white">{node.name}</span>
      )}
    </div>
  );
}

export function InlineRename({ initial, onDone, onCancel, dark }: { initial: string; onDone: (v: string) => void; onCancel: () => void; dark?: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => {
        const dot = initial.lastIndexOf('.');
        e.target.setSelectionRange(0, dot > 0 ? dot : initial.length);
      }}
      onBlur={() => onDone(v || initial)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(v || initial);
        if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn('mt-[2px] w-[110px] rounded px-1 text-center text-[12px] outline-none ring-2 ring-[var(--accent)]', dark ? 'bg-black/70 text-white' : 'bg-black/55 text-white')}
      aria-label="Rename"
    />
  );
}
