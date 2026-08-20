'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { FSNode, Win } from '@/os/types';
import * as fs from '@/os/fs';
import { getBlob } from '@/os/idb';
import { cn, fmtDate } from '@/os/utils';
import { quickLook } from './registry';

export function PhotosApp(_: { win: Win }) {
  const nodes = useOS((s) => s.nodes);
  const tags = useOS((s) => s.tags);
  const [album, setAlbum] = useState<string>('all');
  const [q, setQ] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const photos = fs.mediaFiles('image').filter((n) => {
    if (album === 'favorites') return n.favorite;
    if (album.startsWith('tag:')) return (n.tags ?? []).includes(album.slice(4));
    return true;
  }).filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) fs.importFiles(e.target.files, fs.PICTURES); e.target.value = ''; }} />
      <div className="w-[180px] shrink-0 border-r border-black/10 p-2 text-[13px] dark:border-white/10">
        <button className="mac-btn mb-2 w-full" onClick={() => fileInput.current?.click()}>Import Photos</button>
        <SideBtn active={album === 'all'} onClick={() => setAlbum('all')} label={`Library · ${fs.mediaFiles('image').length}`} />
        <SideBtn active={album === 'favorites'} onClick={() => setAlbum('favorites')} label={`Favorites · ${fs.mediaFiles('image').filter((n) => n.favorite).length}`} />
        <div className="mt-3 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide opacity-45">Albums (Tags)</div>
        {tags.map((t) => (
          <SideBtn key={t.id} active={album === `tag:${t.id}`} onClick={() => setAlbum(`tag:${t.id}`)} label={t.name} dot={t.color} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
          <div className="text-[15px] font-bold">{album === 'all' ? 'Library' : album === 'favorites' ? 'Favorites' : tags.find((t) => `tag:${t.id}` === album)?.name}</div>
          <span className="text-[12px] opacity-50">{photos.length} photos · stored locally</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search photos" className="ml-auto w-[150px] rounded-md bg-black/6 px-2 py-1 text-[12px] outline-none dark:bg-white/10" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-[6px]">
            {photos.map((n, i) => <PhotoTile key={n.id} node={n} index={i} list={photos} />)}
          </div>
          {!photos.length && <div className="mt-16 text-center text-[13px] opacity-45">No photos here yet. Import some from your device.</div>}
        </div>
      </div>
    </div>
  );
}

function PhotoTile({ node, index, list }: { node: FSNode; index: number; list: FSNode[] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    getBlob(node.id).then((b) => { if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); } });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [node.id]);
  return (
    <button
      className="group relative aspect-square overflow-hidden rounded-md bg-black/10"
      onClick={() => quickLook(list.map((n) => n.id), index)}
      onContextMenu={(e) => { e.preventDefault(); useOS.getState().uiPatch({ getInfo: node.id }); }}
      aria-label={node.name}
    >
      {url && <img src={url} alt={node.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />}
      {node.favorite && <span className="absolute left-1 top-1 text-[11px] drop-shadow">❤️</span>}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-0.5 pt-3 text-left text-[10px] text-white opacity-0 group-hover:opacity-100">{node.name}</span>
    </button>
  );
}

function SideBtn({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button onClick={onClick} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12.5px]', active ? 'bg-[var(--accent)]/20 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/8')}>
      {dot && <span className="h-[9px] w-[9px] rounded-full" style={{ background: dot }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function fmtDay(ts: number) { return fmtDate(ts); }
