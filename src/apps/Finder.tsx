'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { FSNode, Win } from '@/os/types';
import * as fs from '@/os/fs';
import { cn, fmtBytes, fmtDate, fmtDateTime } from '@/os/utils';
import { AppIcon, FileGlyph, FolderGlyph, AliasBadge } from '@/components/icons';
import { openMenu, Toggle } from '@/components/ui';
import { openApp, openFileById, quickLook } from './registry';

type ViewMode = 'icons' | 'list' | 'columns' | 'gallery';

export function FinderApp({ win }: { win: Win }) {
  const nodes = useOS((s) => s.nodes);
  const tags = useOS((s) => s.tags);
  const prefs = useOS((s) => s.prefs);
  const clipboard = useOS((s) => s.clipboard);
  const renameId = useOS((s) => s.ui.renameId);
  const path = (win.props?.path as string) ?? fs.DOCUMENTS;
  const view = (win.props?.view as ViewMode) ?? prefs.finderView;
  const back = (win.props?.back as string[]) ?? [];
  const fwd = (win.props?.fwd as string[]) ?? [];
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const props = (p: Record<string, unknown>) => useOS.getState().setWinProps(win.id, p);

  useEffect(() => { setSel([]); setQ(''); }, [path]);
  useEffect(() => {
    const t = win.title;
    const cur = path === 'trash' ? 'Trash' : path === 'recents' ? 'Recents' : path.startsWith('tag:') ? `Tags` : (fs.get(path)?.name ?? 'Finder');
    if (t !== cur) props({ titleHint: cur });
    useOS.getState().setWin(win.id, { title: cur });
  }, [path, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (to: string) => {
    if (to === path) return;
    props({ path: to, back: [...back, path], fwd: [] });
  };

  const list: FSNode[] = useMemo(() => {
    if (q.trim()) return fs.searchFiles(q);
    if (path === 'recents') return fs.recents();
    if (path === 'trash') return fs.sortNodes(fs.trashedItems(), 'date');
    if (path === 'favorites') return Object.values(nodes).filter((n) => n.favorite && !n.trashed);
    if (path.startsWith('tag:')) {
      const tid = path.slice(4);
      return fs.sortNodes(Object.values(nodes).filter((n) => !n.trashed && (n.tags ?? []).includes(tid)));
    }
    return fs.sortNodes(fs.childrenOf(path));
  }, [q, path, nodes]);

  const title = path === 'trash' ? 'Trash' : path === 'recents' ? 'Recents' : path.startsWith('tag:') ? tags.find((t) => t.id === path.slice(4))?.name ?? 'Tag' : path === 'favorites' ? 'Favorites' : fs.get(path)?.name ?? 'Finder';
  const isTrash = path === 'trash';
  const favFolders = Object.values(nodes).filter((n) => n.favorite && n.kind === 'folder' && !n.trashed);

  // keyboard inside finder
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const os = useOS.getState();
      if (os.ui.renameId) return;
      if (!sel.length) return;
      if (e.key === 'Enter') { openFileById(sel[0]); }
      else if (e.key === ' ') { e.preventDefault(); quickLook(sel, 0); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isTrash) return;
        fs.trash(sel); setSel([]);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') os.setClipboard({ mode: 'copy', ids: sel });
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') os.setClipboard({ mode: 'cut', ids: sel });
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') fs.paste(path);
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); os.uiPatch({ getInfo: sel[0] }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, path, isTrash]);

  const itemMenu = (e: React.MouseEvent, n: FSNode) => {
    const os = useOS.getState();
    const ids = sel.includes(n.id) && sel.length > 1 ? sel : [n.id];
    if (isTrash) {
      openMenu(e, [
        { label: 'Put Back', onSelect: () => { fs.restore(ids); setSel([]); } },
        { label: 'Delete Immediately', danger: true, onSelect: () => { fs.deleteForever(ids); setSel([]); } },
        { sep: true },
        { label: 'Get Info', onSelect: () => os.uiPatch({ getInfo: n.id }) },
      ]);
      return;
    }
    openMenu(e, [
      { label: 'Open', onSelect: () => openFileById(n.id) },
      { label: 'Quick Look', kbd: '␣', onSelect: () => quickLook(ids, ids.indexOf(n.id)) },
      { sep: true },
      { label: 'Rename…', onSelect: () => os.uiPatch({ renameId: n.id }) },
      { label: 'Duplicate', onSelect: () => fs.duplicate(ids) },
      { label: 'Make Alias', onSelect: () => ids.forEach((id) => fs.makeAlias(id, path.startsWith('tag') || path === 'recents' ? fs.DESKTOP : path)) },
      { sep: true },
      { label: 'Copy', kbd: '⌘C', onSelect: () => os.setClipboard({ mode: 'copy', ids }) },
      { label: 'Cut', onSelect: () => os.setClipboard({ mode: 'cut', ids }) },
      { head: 'Tags' },
      ...os.tags.map((t) => ({ label: t.name, checked: (n.tags ?? []).includes(t.id), onSelect: () => ids.forEach((id) => fs.toggleTag(id, t.id)) })),
      { sep: true },
      { label: n.favorite ? 'Remove from Favorites' : 'Add to Favorites', onSelect: () => ids.forEach((id) => fs.setFavorite(id, !n.favorite)) },
      { label: 'Download', onSelect: () => ids.forEach((id) => fs.exportNode(id)) },
      { label: 'Get Info', kbd: '⌘I', onSelect: () => os.uiPatch({ getInfo: n.id }) },
      { label: 'Move to Trash', danger: true, onSelect: () => { fs.trash(ids); setSel([]); } },
    ]);
  };

  const bgMenu = (e: React.MouseEvent) => {
    const os = useOS.getState();
    openMenu(e, [
      ...(path !== 'trash' && path !== 'recents' && !path.startsWith('tag:') ? [
        { label: 'New Folder', kbd: '⇧⌘N', onSelect: () => { const id = fs.createFolder(path); os.uiPatch({ renameId: id }); } },
        { label: 'New Text Document', onSelect: () => fs.createTextFile(path) },
        { sep: true } as const,
      ] : []),
      { label: 'Import Files…', onSelect: () => fileInput.current?.click() },
      { label: 'Paste', kbd: '⌥⌘V', disabled: !clipboard, onSelect: () => fs.paste(path) },
      { sep: true },
      { label: 'Show View Options', onSelect: () => openApp('settings', { section: 'desktop' }) },
    ]);
  };

  const onDropItems = (e: React.DragEvent, dest: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = e.dataTransfer.getData('application/x-bm-items');
      if (data) {
        const ids = JSON.parse(data) as string[];
        if (dest === 'trash') fs.trash(ids);
        else fs.requestTransfer('move', ids, dest);
      } else if (e.dataTransfer.files?.length) {
        fs.importFiles(e.dataTransfer.files, dest);
      }
    } catch { /* ignore */ }
  };

  const dragItems = (e: React.DragEvent, n: FSNode) => {
    const ids = sel.includes(n.id) ? sel : [n.id];
    if (!sel.includes(n.id)) setSel(ids);
    e.dataTransfer.setData('application/x-bm-items', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const crumbs = path.startsWith('tag') || path === 'recents' || path === 'trash' || path === 'favorites' ? [] : fs.pathOf(path);

  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) fs.importFiles(e.target.files, path === 'trash' || path === 'recents' || path.startsWith('tag') ? fs.DOWNLOADS : path); e.target.value = ''; }} />
      {/* toolbar */}
      <div className="flex h-[44px] shrink-0 items-center gap-1.5 border-b border-black/10 px-2 dark:border-white/10">
        <TBtn label="Back" disabled={!back.length} onClick={() => props({ path: back[back.length - 1], back: back.slice(0, -1), fwd: [path, ...fwd] })}>‹</TBtn>
        <TBtn label="Forward" disabled={!fwd.length} onClick={() => props({ path: fwd[0], fwd: fwd.slice(1), back: [...back, path] })}>›</TBtn>
        <div className="ml-1 min-w-0 text-[13px] font-bold">{title}</div>
        <div className="mx-2 flex overflow-hidden rounded-md bg-black/6 dark:bg-white/8">
          {(['icons', 'list', 'columns', 'gallery'] as ViewMode[]).map((v) => (
            <button key={v} title={`${v} view`} aria-label={`${v} view`} onClick={() => props({ view: v })} className={cn('px-2 py-[3px] text-[13px]', view === v ? 'bg-white shadow-sm dark:bg-white/20' : 'opacity-60 hover:opacity-100')}>
              {v === 'icons' ? '⊞' : v === 'list' ? '☰' : v === 'columns' ? '▥' : '▤'}
            </button>
          ))}
        </div>
        <select aria-label="Sort" className="mac-select text-[12px]" value={prefs.sortBy} onChange={(e) => useOS.getState().setPrefs({ sortBy: e.target.value as 'name' })}>
          <option value="name">Sort: Name</option><option value="kind">Sort: Kind</option><option value="date">Sort: Date</option><option value="size">Sort: Size</option>
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          {isTrash ? (
            <button className="mac-btn" onClick={() => fs.emptyTrash()}>Empty Trash</button>
          ) : (
            <>
              <TBtn label="New folder" onClick={() => { const id = fs.createFolder(path === 'recents' || path.startsWith('tag') ? fs.DESKTOP : path); useOS.getState().uiPatch({ renameId: id }); }}>＋🗀</TBtn>
              <TBtn label="Import files" onClick={() => fileInput.current?.click()}>⇩</TBtn>
            </>
          )}
          <TBtn label="Quick Look" disabled={!sel.length} onClick={() => quickLook(sel, 0)}>◉</TBtn>
          <TBtn label="Get Info" disabled={!sel.length} onClick={() => useOS.getState().uiPatch({ getInfo: sel[0] })}>ⓘ</TBtn>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search files"
              className="w-[130px] rounded-md bg-black/8 py-[3px] pl-6 pr-2 text-[12px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10"
            />
            <span className="pointer-events-none absolute left-1.5 top-[5px] text-[11px] opacity-50">⌕</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <div className="finder-sidebar w-[190px] shrink-0 overflow-y-auto px-2 py-2 text-[13px]" onContextMenu={(e) => e.stopPropagation()}>
          <SideHead>Favorites</SideHead>
          {[
            { id: 'recents', label: 'Recents', icon: '🕘' },
            { id: 'applications', label: 'Applications', icon: '⊞' },
            { id: fs.DESKTOP, label: 'Desktop', icon: '🖥' },
            { id: fs.DOCUMENTS, label: 'Documents', icon: '🗎' },
            { id: fs.DOWNLOADS, label: 'Downloads', icon: '⇩' },
            { id: fs.PICTURES, label: 'Pictures', icon: '🖼' },
          ].map((f) => (
            <SideRow key={f.id} active={path === f.id} onClick={() => f.id === 'applications' ? useOS.getState().uiPatch({ launchpad: true }) : navigate(f.id)} onDrop={f.id === 'applications' ? undefined : (e) => onDropItems(e, f.id)}>
              <span className="w-4 text-center text-[12px] opacity-70">{f.icon}</span>{f.label}
            </SideRow>
          ))}
          {favFolders.map((f) => (
            <SideRow key={f.id} active={path === f.id} onClick={() => navigate(f.id)} onDrop={(e) => onDropItems(e, f.id)}>
              <span className="w-4 text-center text-[12px] opacity-70">★</span><span className="truncate">{f.name}</span>
            </SideRow>
          ))}
          <SideHead>Tags</SideHead>
          {tags.map((t) => (
            <SideRow key={t.id} active={path === `tag:${t.id}`} onClick={() => navigate(`tag:${t.id}`)}
              onMenu={(e) => openMenu(e, [
                { label: 'Rename Tag', onSelect: () => { const name = window.prompt('Tag name', t.name); if (name) useOS.setState((s) => ({ tags: s.tags.map((x) => x.id === t.id ? { ...x, name } : x) })); } },
                { label: 'Delete Tag', danger: true, onSelect: () => fs.deleteTag(t.id) },
              ])}>
              <span className="mx-1 h-[9px] w-[9px] rounded-full" style={{ background: t.color }} />{t.name}
            </SideRow>
          ))}
          <SideHead>Locations</SideHead>
          <SideRow active={path === fs.ROOT} onClick={() => navigate(fs.ROOT)} onDrop={(e) => onDropItems(e, fs.ROOT)}>
            <span className="w-4 text-center text-[12px] opacity-70">💽</span>Macintosh HD
          </SideRow>
          <SideRow active={path === 'trash'} onClick={() => navigate('trash')} onDrop={(e) => onDropItems(e, 'trash')}>
            <span className="w-4 text-center text-[12px] opacity-70">🗑</span>Trash
            <TrashBadge />
          </SideRow>
        </div>

        {/* content */}
        <div className="relative flex min-w-0 flex-1 flex-col" onContextMenu={bgMenu}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-bm-items') || e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => { if (!isTrash && !path.startsWith('tag') && path !== 'recents') onDropItems(e, path); }}>
          <div className="min-h-0 flex-1 overflow-auto" onClick={() => setSel([])}>
            {q.trim() ? (
              <ListPane list={list} sel={sel} setSel={setSel} onOpen={openFileById} onMenu={itemMenu} onDrag={dragItems} renameId={renameId} showPath />
            ) : view === 'icons' ? (
              <IconPane list={list} sel={sel} setSel={setSel} onOpen={openFileById} onMenu={itemMenu} onDrag={dragItems} renameId={renameId} />
            ) : view === 'list' ? (
              <ListPane list={list} sel={sel} setSel={setSel} onOpen={openFileById} onMenu={itemMenu} onDrag={dragItems} renameId={renameId} />
            ) : view === 'columns' ? (
              <ColumnsPane current={path} navigate={navigate} sel={sel} setSel={setSel} onOpen={openFileById} />
            ) : (
              <GalleryPane list={list} sel={sel} setSel={setSel} onOpen={openFileById} />
            )}
            {list.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] opacity-40">
                {isTrash ? 'Trash is empty' : q ? 'No results' : 'This folder is empty'}
              </div>
            )}
          </div>
          {/* path bar + status */}
          <div className="flex h-[24px] shrink-0 items-center gap-2 border-t border-black/10 px-3 text-[11px] opacity-70 dark:border-white/10">
            <div className="flex items-center gap-1">
              {crumbs.map((c, i) => (
                <button key={c.id} className="hover:underline" onClick={() => navigate(c.id)}>{i > 0 && <span className="mx-0.5 opacity-50">▸</span>}{c.name}</button>
              ))}
            </div>
            <span className="ml-auto">{list.length} items · {fmtBytes(list.reduce((a, n) => a + (n.size ?? 0), 0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashBadge() {
  const count = useOS((s) => Object.values(s.nodes).filter((n) => n.trashed).length);
  if (!count) return null;
  return <span className="ml-auto rounded-full bg-black/15 px-1.5 text-[10px] dark:bg-white/15">{count}</span>;
}

function TBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn('rounded-md px-2 py-[3px] text-[13px] hover:bg-black/8 dark:hover:bg-white/10', disabled && 'pointer-events-none opacity-30')}>
      {children}
    </button>
  );
}

function SideHead({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 px-2 text-[11px] font-semibold uppercase tracking-wide opacity-45 first:mt-0">{children}</div>;
}

function SideRow({ children, active, onClick, onDrop, onMenu }: { children: React.ReactNode; active?: boolean; onClick?: () => void; onDrop?: (e: React.DragEvent) => void; onMenu?: (e: React.MouseEvent) => void }) {
  const [over, setOver] = useState(false);
  return (
    <button
      onClick={onClick}
      onContextMenu={onMenu}
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop ? (e) => { setOver(false); onDrop(e); } : undefined}
      className={cn('flex w-full items-center gap-1.5 rounded-md px-2 py-[4px] text-left', active ? 'bg-[var(--accent)]/20 text-[var(--accent-deep)]' : 'hover:bg-black/6 dark:hover:bg-white/8', over && 'ring-2 ring-[var(--accent)]')}
    >
      {children}
    </button>
  );
}

interface PaneProps {
  list: FSNode[]; sel: string[]; setSel: (ids: string[]) => void;
  onOpen: (id: string) => void; onMenu?: (e: React.MouseEvent, n: FSNode) => void;
  onDrag?: (e: React.DragEvent, n: FSNode) => void; renameId?: string | null; showPath?: boolean;
}

function selectLogic(e: React.MouseEvent, n: FSNode, sel: string[], setSel: (ids: string[]) => void) {
  e.stopPropagation();
  if (e.metaKey || e.ctrlKey) setSel(sel.includes(n.id) ? sel.filter((x) => x !== n.id) : [...sel, n.id]);
  else if (e.shiftKey) setSel([...new Set([...sel, n.id])]);
  else setSel([n.id]);
}

function ItemThumb({ node, size }: { node: FSNode; size: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    if ((node.mime ?? '').startsWith('image/')) {
      import('@/os/idb').then(async ({ getBlob }) => {
        const b = await getBlob(node.id);
        if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); }
      });
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [node.id, node.mime]);
  if (url) return <img src={url} alt="" width={size} height={size} className="rounded object-cover" style={{ width: size, height: size }} />;
  if (node.kind === 'folder') return <FolderGlyph size={size} />;
  if (node.kind === 'alias') return <div className="relative"><FolderGlyph size={size} /><AliasBadge /></div>;
  return <FileGlyph node={node} size={size} />;
}

function IconPane({ list, sel, setSel, onOpen, onMenu, onDrag, renameId }: PaneProps) {
  const os = useOS.getState();
  return (
    <div className="flex flex-wrap content-start gap-1 p-3">
      {list.map((n) => (
        <div
          key={n.id}
          draggable
          onDragStart={(e) => onDrag?.(e, n)}
          onClick={(e) => selectLogic(e, n, sel, setSel)}
          onDoubleClick={() => onOpen(n.id)}
          onContextMenu={(e) => { if (!sel.includes(n.id)) setSel([n.id]); onMenu?.(e, n); }}
          className={cn('flex w-[96px] cursor-default flex-col items-center rounded-lg p-2', sel.includes(n.id) && 'bg-[var(--accent)]/25 ring-1 ring-[var(--accent)]/40')}
        >
          <ItemThumb node={n} size={52} />
          <div className="mt-1 flex w-full items-center justify-center gap-1">
            {n.kind === 'alias' && <span className="text-[9px] opacity-60">↪</span>}
            {renameId === n.id ? (
              <input
                autoFocus
                defaultValue={n.name}
                className="w-[86px] rounded bg-black/70 text-center text-[12px] text-white outline-none ring-2 ring-[var(--accent)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { fs.rename(n.id, (e.target as HTMLInputElement).value); os.uiPatch({ renameId: null }); }
                  if (e.key === 'Escape') os.uiPatch({ renameId: null });
                  e.stopPropagation();
                }}
                onBlur={(e) => { fs.rename(n.id, e.target.value || n.name); os.uiPatch({ renameId: null }); }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Rename"
              />
            ) : (
              <span className="max-w-[84px] truncate text-center text-[12px]">{n.name}</span>
            )}
          </div>
          <TagDots node={n} />
        </div>
      ))}
    </div>
  );
}

function TagDots({ node }: { node: FSNode }) {
  const tags = useOS((s) => s.tags).filter((t) => (node.tags ?? []).includes(t.id));
  if (!tags.length) return null;
  return <div className="mt-[2px] flex gap-[3px]">{tags.slice(0, 3).map((t) => <span key={t.id} className="h-[6px] w-[6px] rounded-full" style={{ background: t.color }} />)}</div>;
}

function ListPane({ list, sel, setSel, onOpen, onMenu, onDrag, renameId, showPath }: PaneProps) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="sticky top-0 bg-[var(--win-bg)] text-left opacity-60">
          <th className="px-3 py-1 font-medium">Name</th>
          {showPath && <th className="px-2 py-1 font-medium">Where</th>}
          <th className="px-2 py-1 font-medium">Date Modified</th>
          <th className="px-2 py-1 text-right font-medium">Size</th>
        </tr>
      </thead>
      <tbody>
        {list.map((n) => (
          <tr
            key={n.id}
            draggable
            onDragStart={(e) => onDrag?.(e, n)}
            onClick={(e) => selectLogic(e, n, sel, setSel)}
            onDoubleClick={() => onOpen(n.id)}
            onContextMenu={(e) => { if (!sel.includes(n.id)) setSel([n.id]); onMenu?.(e, n); }}
            className={cn('cursor-default border-b border-black/4 dark:border-white/5', sel.includes(n.id) ? 'bg-[var(--accent)]/25' : 'hover:bg-black/4 dark:hover:bg-white/5')}
          >
            <td className="flex items-center gap-2 px-3 py-[5px]">
              <ItemThumb node={n} size={20} />
              <span className="truncate">{n.name}</span>
              {n.kind === 'alias' && <span className="text-[10px] opacity-60">alias</span>}
              <TagDots node={n} />
            </td>
            {showPath && <td className="px-2 py-[5px] opacity-60">{fs.pathString(n.parent ?? '')}</td>}
            <td className="px-2 py-[5px] opacity-75">{fmtDateTime(n.modifiedAt)}</td>
            <td className="px-2 py-[5px] text-right opacity-75">{n.kind === 'folder' ? `${fs.childrenOf(n.id).length} items` : fmtBytes(n.size)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ColumnsPane({ current, navigate, sel, setSel, onOpen }: { current: string; navigate: (to: string) => void; sel: string[]; setSel: (ids: string[]) => void; onOpen: (id: string) => void }) {
  const nodes = useOS((s) => s.nodes);
  const chain = current === fs.ROOT ? [fs.ROOT] : fs.pathOf(current).map((n) => n.id);
  const cols: string[] = [fs.ROOT, ...chain.filter((id) => id !== fs.ROOT)];
  return (
    <div className="flex h-full">
      {cols.map((cid, i) => {
        const kids = fs.sortNodes(fs.childrenOf(cid));
        const next = cols[i + 1];
        return (
          <div key={cid + i} className="h-full w-[190px] shrink-0 overflow-y-auto border-r border-black/8 dark:border-white/8">
            {kids.map((n) => (
              <button
                key={n.id}
                onClick={(e) => { e.stopPropagation(); if (n.kind === 'folder') { navigate(n.id); setSel([n.id]); } else { setSel([n.id]); } }}
                onDoubleClick={() => onOpen(n.id)}
                className={cn('flex w-full items-center gap-2 px-2 py-[4px] text-left text-[12.5px]', next === n.id || sel.includes(n.id) ? 'bg-[var(--accent)]/25' : 'hover:bg-black/5 dark:hover:bg-white/6')}
              >
                {n.kind === 'folder' ? <FolderGlyph size={16} /> : <FileGlyph node={n} size={16} />}
                <span className="truncate">{n.name}</span>
                {n.kind === 'folder' && <span className="ml-auto opacity-40">›</span>}
              </button>
            ))}
            {kids.length === 0 && <div className="p-2 text-[11px] opacity-40">Empty</div>}
          </div>
        );
      })}
      <div className="min-w-0 flex-1 p-3">
        {sel.length === 1 && nodes[sel[0]] && (
          <div className="flex flex-col items-center gap-2 pt-6">
            <ItemThumb node={nodes[sel[0]]} size={110} />
            <div className="text-[13px] font-semibold">{nodes[sel[0]].name}</div>
            <div className="text-[11px] opacity-60">{fmtBytes(nodes[sel[0]].size)} · {fmtDate(nodes[sel[0]].modifiedAt)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryPane({ list, sel, setSel, onOpen }: PaneProps) {
  const current = sel.length ? list.find((n) => n.id === sel[0]) : list[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        {current ? (
          <div className="flex flex-col items-center gap-3" onDoubleClick={() => onOpen(current.id)}>
            <ItemThumb node={current} size={Math.min(280, 320)} />
            <div className="text-[14px] font-semibold">{current.name}</div>
          </div>
        ) : <div className="opacity-40">Nothing to preview</div>}
      </div>
      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-black/10 p-2 dark:border-white/10">
        {list.map((n) => (
          <button key={n.id} onClick={() => setSel([n.id])} className={cn('shrink-0 rounded-lg p-1', current?.id === n.id ? 'ring-2 ring-[var(--accent)]' : 'opacity-70 hover:opacity-100')}>
            <ItemThumb node={n} size={54} />
          </button>
        ))}
      </div>
    </div>
  );
}

export { ItemThumb };
export function FavToggle({ id }: { id: string }) {
  const fav = useOS((s) => s.nodes[id]?.favorite);
  return <Toggle on={!!fav} onChange={(v) => fs.setFavorite(id, v)} label="Favorite" />;
}
