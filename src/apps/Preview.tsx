'use client';

import { useEffect, useState } from 'react';
import { useOS } from '@/os/store';
import type { FSNode, Win } from '@/os/types';
import * as fs from '@/os/fs';
import { getBlob } from '@/os/idb';
import { fileCategory, fmtBytes } from '@/os/utils';
import { cn } from '@/os/utils';
import { openApp } from './registry';

export function PreviewApp({ win }: { win: Win }) {
  const fileId = (win.props?.fileId as string) ?? '';
  const nodes = useOS((s) => s.nodes);
  const node = nodes[fileId];
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const os = useOS.getState();

  useEffect(() => {
    let revoke: string | null = null;
    setUrl(null);
    if (!fileId) return;
    getBlob(fileId).then((b) => {
      if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); }
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [fileId]);

  useEffect(() => {
    useOS.getState().setWin(win.id, { title: node?.name ?? 'Preview' });
  }, [node?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return <div className="flex h-full items-center justify-center opacity-45">File no longer exists</div>;
  const cat = fileCategory(node);
  const siblings = fs.sortNodes(fs.childrenOf(node.parent ?? '')).filter((n) => fileCategory(n) === cat);
  const idx = siblings.findIndex((n) => n.id === node.id);

  const go = (d: number) => {
    const next = siblings[idx + d];
    if (next) os.setWinProps(win.id, { fileId: next.id });
  };

  return (
    <div className="flex h-full flex-col bg-[#1c1e22] text-white">
      <div className="flex h-[42px] shrink-0 items-center gap-1.5 border-b border-white/10 px-2">
        <button className="mac-btn dark" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous">‹</button>
        <button className="mac-btn dark" disabled={idx >= siblings.length - 1} onClick={() => go(1)} aria-label="Next">›</button>
        <span className="ml-1 truncate text-[12.5px] opacity-80">{node.name}</span>
        <span className="text-[11px] opacity-45">{fmtBytes(node.size)}{idx >= 0 ? ` · ${idx + 1}/${siblings.length}` : ''}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {cat === 'image' && (
            <>
              <button className="mac-btn dark" onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))} aria-label="Zoom out">−</button>
              <span className="w-[42px] text-center text-[11px] opacity-60">{Math.round(zoom * 100)}%</span>
              <button className="mac-btn dark" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in">＋</button>
              <button className="mac-btn dark" onClick={() => setRot((r) => (r + 90) % 360)} aria-label="Rotate">⟳</button>
            </>
          )}
          <button className="mac-btn dark" onClick={() => openApp('textedit', { fileId: node.id })} title="Open with TextEdit">✎</button>
          <button className="mac-btn dark" onClick={() => fs.exportNode(node.id)} title="Download">⇩</button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto" style={{ background: 'repeating-conic-gradient(#22252a 0% 25%, #1c1e22 0% 50%) 50% / 24px 24px' }}>
        {cat === 'image' && url && (
          <div className="flex min-h-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={node.name} className="max-w-full rounded shadow-2xl transition-transform duration-200" style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, maxHeight: '80vh' }} />
          </div>
        )}
        {cat === 'video' && url && (
          <div className="flex min-h-full items-center justify-center p-4">
            <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded shadow-2xl" style={{ width: 'min(860px, 100%)' }} />
          </div>
        )}
        {cat === 'audio' && url && (
          <div className="flex min-h-full flex-col items-center justify-center gap-4">
            <div className="flex h-[110px] w-[110px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff6d84] to-[#f5395f] text-[42px] shadow-xl">♫</div>
            <div className="text-[14px] font-semibold">{node.name}</div>
            <audio src={url} controls autoPlay className="w-[340px] max-w-[80%]" />
          </div>
        )}
        {cat === 'pdf' && url && <iframe src={url} title={node.name} className="h-full w-full border-0 bg-white" />}
        {(cat === 'text' || cat === 'code') && (
          <pre className="min-h-full whitespace-pre-wrap p-6 font-mono text-[12.5px] leading-relaxed text-[#d8dee6]">{node.text ?? 'Loading… (large file — use Download)'}</pre>
        )}
        {cat === 'archive' && (
          <div className="flex min-h-full flex-col items-center justify-center gap-3 opacity-70">
            <div className="text-[54px]">🗜</div>
            <div className="text-[13px]">Archive · {fmtBytes(node.size)}</div>
            <button className="mac-btn dark" onClick={() => fs.exportNode(node.id)}>Download to extract on your device</button>
          </div>
        )}
        {cat === 'other' && !url && (
          <div className="flex min-h-full flex-col items-center justify-center gap-2 opacity-60">
            <div className="text-[54px]">🗎</div>
            <div className="text-[13px]">{node.mime ?? 'Unknown type'} · {fmtBytes(node.size)}</div>
            <button className="mac-btn dark" onClick={() => fs.exportNode(node.id)}>Download</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ZoomBadge({ z }: { z: number }) {
  return <span className={cn('text-[11px]', z > 1 && 'text-[var(--accent)]')}>{Math.round(z * 100)}%</span>;
}
