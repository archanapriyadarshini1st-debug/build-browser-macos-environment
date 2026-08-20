'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { FSNode, Win } from '@/os/types';
import * as fs from '@/os/fs';
import { getBlob } from '@/os/idb';
import { cn, fmtBytes } from '@/os/utils';

export function MusicApp({ win }: { win: Win }) {
  const nodes = useOS((s) => s.nodes);
  const music = useOS((s) => s.music);
  const prefs = useOS((s) => s.prefs);
  const os = useOS.getState();
  const tracks = fs.mediaFiles('audio');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [cur, setCur] = useState<string | null>((win.props?.fileId as string) ?? music.current);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let revoke: string | null = null;
    setUrl(null);
    if (!cur) return;
    getBlob(cur).then((b) => {
      if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); }
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [cur]);

  useEffect(() => { os.musicPatch({ current: cur, playing: !!music.playing && !!cur }); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = (id: string) => {
    setCur(id);
    setTimeout(() => audioRef.current?.play().catch(() => undefined), 60);
  };

  const step = (d: number) => {
    const i = tracks.findIndex((t) => t.id === cur);
    const next = tracks[(i + d + tracks.length) % Math.max(1, tracks.length)];
    if (next) play(next.id);
  };

  const current: FSNode | undefined = tracks.find((t) => t.id === cur) ?? (cur ? nodes[cur] : undefined);

  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <input ref={fileInput} type="file" accept="audio/*" multiple hidden onChange={(e) => { if (e.target.files) fs.importFiles(e.target.files, fs.MUSICDIR); e.target.value = ''; }} />
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
        <div className="text-[15px] font-bold">Music</div>
        <span className="text-[12px] opacity-50">{tracks.length} tracks · local library</span>
        <button className="mac-btn ml-auto" onClick={() => fileInput.current?.click()}>Import Audio</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => play(t.id)}
            className={cn('flex w-full items-center gap-3 border-b border-black/5 px-3 py-2 text-left dark:border-white/5', cur === t.id ? 'bg-[var(--accent)]/15' : 'hover:bg-black/4 dark:hover:bg-white/6')}
          >
            <div className={cn('flex h-[34px] w-[34px] items-center justify-center rounded-md text-[15px]', cur === t.id ? 'bg-[var(--accent)] text-white' : 'bg-gradient-to-b from-[#ff6d84] to-[#f5395f] text-white')}>{cur === t.id && music.playing ? '♫' : '▶'}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{t.name}</div>
              <div className="text-[11px] opacity-50">{fmtBytes(t.size)}</div>
            </div>
            {cur === t.id && music.playing && <Eq />}
          </button>
        ))}
        {!tracks.length && (
          <div className="mt-16 px-8 text-center text-[13px] opacity-45">
            Your library is empty. Import MP3/WAV/OGG files from your device — they stay in local browser storage.
          </div>
        )}
      </div>
      {/* player bar */}
      <div className="flex h-[64px] shrink-0 items-center gap-3 border-t border-black/10 px-3 dark:border-white/10">
        <div className="flex items-center gap-1">
          <button className="mac-btn" onClick={() => step(-1)} aria-label="Previous">⏮</button>
          <button className="mac-btn w-[38px] text-[15px]" onClick={() => {
            const a = audioRef.current;
            if (!a || !url) return;
            if (a.paused) { a.play(); os.musicPatch({ playing: true }); } else { a.pause(); os.musicPatch({ playing: false }); }
          }} aria-label="Play or pause">{music.playing ? '⏸' : '▶'}</button>
          <button className="mac-btn" onClick={() => step(1)} aria-label="Next">⏭</button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold">{current?.name ?? 'Not playing'}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-[34px] text-[10px] opacity-50">{t(progress)}</span>
            <input type="range" min={0} max={duration || 1} value={progress} onChange={(e) => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = v; setProgress(v); }} className="mac-slider flex-1" aria-label="Seek" />
            <span className="w-[34px] text-[10px] opacity-50">{t(duration)}</span>
          </div>
        </div>
        <div className="flex w-[110px] items-center gap-1.5">
          <span className="text-[11px] opacity-60">🔊</span>
          <input type="range" min={0} max={100} value={prefs.volume} onChange={(e) => os.setPrefs({ volume: Number(e.target.value) })} className="mac-slider flex-1" aria-label="Volume" />
        </div>
        {url && (
          <audio
            ref={audioRef}
            src={url}
            autoPlay
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => step(1)}
            onPlay={() => os.musicPatch({ playing: true })}
            onPause={() => os.musicPatch({ playing: false })}
          />
        )}
      </div>
    </div>
  );
}

function t(s: number) {
  if (!Number.isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function Eq() {
  return (
    <div className="flex h-[14px] items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="eq-bar w-[3px] rounded-sm bg-[var(--accent)]" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}
