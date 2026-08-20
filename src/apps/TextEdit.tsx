'use client';

import { useEffect, useState } from 'react';
import { useOS } from '@/os/store';
import type { Win } from '@/os/types';
import * as fs from '@/os/fs';
import { getBlob } from '@/os/idb';
import { downloadText } from '@/os/utils';

export function TextEditApp({ win }: { win: Win }) {
  const fileId = (win.props?.fileId as string) ?? (win.props?.savedFileId as string) ?? null;
  const nodes = useOS((s) => s.nodes);
  const node = fileId ? nodes[fileId] : null;
  const [text, setText] = useState<string>(node?.text ?? '');
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  // load blob if no inline text
  useEffect(() => {
    if (!fileId) { setLoaded(true); return; }
    const n = fs.get(fileId);
    if (n?.text != null && n.text.length > 0) { setText(n.text); setLoaded(true); return; }
    let cancel = false;
    getBlob(fileId).then((b) => {
      if (cancel) return;
      if (b) b.text().then((t) => { if (!cancel) { setText(t.slice(0, 500_000)); setLoaded(true); } });
      else setLoaded(true);
    });
    return () => { cancel = true; };
  }, [fileId]);

  useEffect(() => {
    if (node) useOS.getState().setWin(win.id, { title: `${node.name}${dirty ? ' — Edited' : ''}` });
    else useOS.getState().setWin(win.id, { title: `Untitled${dirty ? ' — Edited' : ''}` });
  }, [node?.name, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const os = useOS.getState();
    if (fileId && fs.get(fileId)) {
      fs.writeText(fileId, text);
      setDirty(false);
      os.notify('system', 'Saved', `“${fs.get(fileId)?.name}” was saved.`);
    } else {
      const name = window.prompt('Save as (in Documents):', 'untitled.txt');
      if (!name) return;
      const id = fs.createTextFile(fs.DOCUMENTS, name, text);
      os.setWinProps(win.id, { fileId: id, savedFileId: id });
      setDirty(false);
    }
  };

  useEffect(() => {
    const h = () => save();
    window.addEventListener('textedit-save', h);
    return () => window.removeEventListener('textedit-save', h);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <div className="flex items-center gap-2 border-b border-black/10 px-2 py-1.5 dark:border-white/10">
        <button className="mac-btn" onClick={save}>Save ⌘S</button>
        <button className="mac-btn" onClick={() => downloadText(text, node?.name ?? 'untitled.txt')}>Export</button>
        <button className="mac-btn" onClick={() => { setText(''); setDirty(true); }}>Clear</button>
        <div className="ml-auto flex items-center gap-2 text-[12px] opacity-70">
          <label className="flex items-center gap-1">Aa
            <input type="range" min={11} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="mac-slider w-[70px]" aria-label="Font size" />
          </label>
          <span>{words} words · {text.length} chars</span>
        </div>
      </div>
      {loaded ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => { setText(e.target.value); setDirty(true); }}
          placeholder="Start typing…"
          aria-label="Document text"
          className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 leading-relaxed outline-none"
          style={{ fontSize, fontFamily: 'inherit' }}
          spellCheck
        />
      ) : (
        <div className="flex flex-1 items-center justify-center opacity-40">Loading…</div>
      )}
    </div>
  );
}
