'use client';

import { useEffect, useState } from 'react';
import { useOS } from '@/os/store';
import type { Note, Win } from '@/os/types';
import { cn, fmtDate, uid } from '@/os/utils';

export function NotesApp({ win }: { win: Win }) {
  const notes = useOS((s) => s.notes);
  const folders = useOS((s) => s.noteFolders);
  const [folder, setFolder] = useState<string>('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const os = useOS.getState();

  useEffect(() => {
    const h = () => newNote();
    window.addEventListener('notes-new', h);
    return () => window.removeEventListener('notes-new', h);
  }, [folder]); // eslint-disable-line react-hooks/exhaustive-deps

  const newNote = () => {
    const f = folder === 'all' ? folders[0]?.id ?? 'nf-main' : folder;
    const n: Note = { id: uid(), folder: f, title: '', body: '', createdAt: Date.now(), modifiedAt: Date.now() };
    os.addNote(n);
    setSelId(n.id);
  };

  const list = notes
    .filter((n) => folder === 'all' || n.folder === folder)
    .filter((n) => !q || (n.title + n.body).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.modifiedAt - a.modifiedAt);

  const cur = notes.find((n) => n.id === selId) ?? list[0] ?? null;

  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <div className="flex w-[180px] shrink-0 flex-col border-r border-black/10 p-2 dark:border-white/10">
        <button className="mac-btn mb-2 self-start" onClick={() => { const name = window.prompt('Folder name'); if (name) os.addNoteFolder(name); }}>+ Folder</button>
        <SideBtn active={folder === 'all'} onClick={() => setFolder('all')} label={`All Notes · ${notes.length}`} />
        {folders.map((f) => (
          <SideBtn key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)} label={`${f.name} · ${notes.filter((n) => n.folder === f.id).length}`} />
        ))}
      </div>
      <div className="flex w-[220px] shrink-0 flex-col border-r border-black/10 dark:border-white/10">
        <div className="flex items-center gap-1 p-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search notes" className="w-full rounded-md bg-black/6 px-2 py-1 text-[12px] outline-none dark:bg-white/10" />
          <button className="mac-btn shrink-0" onClick={newNote} aria-label="New note">＋</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelId(n.id)}
              onContextMenu={(e) => {
                e.preventDefault();
              }}
              className={cn('block w-full border-b border-black/5 px-3 py-2 text-left dark:border-white/5', cur?.id === n.id ? 'bg-[var(--accent)]/20' : 'hover:bg-black/4 dark:hover:bg-white/6')}
            >
              <div className="flex items-center gap-1 text-[12.5px] font-semibold">
                {n.pinned && <span className="text-[10px]">📌</span>}
                <span className="truncate">{n.title || 'New Note'}</span>
              </div>
              <div className="truncate text-[11px] opacity-55">{fmtDate(n.modifiedAt)} · {n.body.slice(0, 40) || 'No content'}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {cur ? (
          <>
            <div className="flex items-center gap-1 border-b border-black/10 px-3 py-1.5 dark:border-white/10">
              <button className="mac-btn" title={cur.pinned ? 'Unpin' : 'Pin'} onClick={() => os.updateNote(cur.id, { pinned: !cur.pinned })}>{cur.pinned ? '📌' : '📍'}</button>
              <button className="mac-btn" title="Add checklist item" onClick={() => os.updateNote(cur.id, { body: cur.body + '\n- [ ] ' })}>☑︎</button>
              <button className="mac-btn" title="Add heading" onClick={() => os.updateNote(cur.id, { body: cur.body + '\n# ' })}>H</button>
              <span className="ml-auto text-[11px] opacity-45">{fmtDate(cur.modifiedAt)}</span>
              <button className="mac-btn text-[#ff453a]" title="Delete note" onClick={() => { os.deleteNote(cur.id); setSelId(null); }}>🗑</button>
            </div>
            <input
              value={cur.title}
              onChange={(e) => os.updateNote(cur.id, { title: e.target.value })}
              placeholder="Title"
              aria-label="Note title"
              className="border-none bg-transparent px-4 pt-3 text-[17px] font-bold outline-none"
            />
            <textarea
              value={cur.body}
              onChange={(e) => os.updateNote(cur.id, { body: e.target.value })}
              placeholder="Start writing… use - [ ] for checklists"
              aria-label="Note body"
              className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-3 pt-1 text-[13.5px] leading-relaxed outline-none"
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center opacity-40">Select or create a note</div>
        )}
      </div>
    </div>
  );
}

function SideBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cn('mb-0.5 rounded-md px-2 py-[5px] text-left text-[12.5px]', active ? 'bg-[var(--accent)]/20 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/8')}>
      {label}
    </button>
  );
}
