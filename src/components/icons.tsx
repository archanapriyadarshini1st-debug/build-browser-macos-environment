'use client';

import type { ReactNode } from 'react';
import type { FSNode } from '@/os/types';
import { fileCategory } from '@/os/utils';

// CSS gradient tile + SVG glyph overlay keeps icons crisp at any DPI.
export function AppIcon({ appId, size = 48, className }: { appId: string; size?: number; className?: string }) {
  const def = APP_TILES[appId] ?? APP_TILES.generic;
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: size * 0.225,
        background: def.bg, position: 'relative', flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 1px rgba(0,0,0,.12)',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        {def.glyph}
      </svg>
    </div>
  );
}

const W = '#ffffff';

const APP_TILES: Record<string, { bg: string; glyph: ReactNode }> = {
  finder: {
    bg: 'linear-gradient(180deg,#1fb6ff 0%,#0d6fd6 100%)',
    glyph: (
      <g>
        <path d="M24 6 C14 10 9 20 9 27 c0 9 6 15 15 15 V6z" fill="#d9f0ff" opacity=".95" />
        <path d="M24 6 c10 4 15 14 15 21 0 9-6 15-15 15 V6z" fill="#0a5cb8" opacity=".9" />
        <path d="M24 6v36" stroke="#0b3f7a" strokeWidth="1.6" fill="none" />
        <path d="M16 19c0 2 .8 3.4 2 3.4s2-1.4 2-3.4-.8-3.4-2-3.4-2 1.4-2 3.4z" fill="#0b3f7a" />
        <path d="M28 19c0 2 .8 3.4 2 3.4s2-1.4 2-3.4-.8-3.4-2-3.4-2 1.4-2 3.4z" fill="#d9f0ff" />
        <path d="M15 30c3 4 6.5 6 9 6s6-2 9-6" stroke="#0b3f7a" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  safari: {
    bg: 'linear-gradient(180deg,#f7fbff 0%,#dbe9f5 100%)',
    glyph: (
      <g>
        <circle cx="24" cy="24" r="17" fill="url(#safg)" stroke="#9fb6c9" strokeWidth="1" />
        <defs>
          <linearGradient id="safg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3ec8f5" /><stop offset="1" stopColor="#1470d8" />
          </linearGradient>
        </defs>
        <g stroke="#eaf6ff" strokeWidth="1.2" opacity=".9">
          <path d="M24 8v3M24 37v3M8 24h3M37 24h3" />
        </g>
        <path d="M33 15 L21.5 21.5 15 33 26.5 26.5z" fill="#fff" />
        <path d="M33 15 L21.5 21.5 26.5 26.5z" fill="#ff453a" />
      </g>
    ),
  },
  notes: {
    bg: 'linear-gradient(180deg,#fffdf5 0%,#f4f0e4 100%)',
    glyph: (
      <g>
        <rect x="8" y="8" width="32" height="32" rx="4" fill="#fff" stroke="#d8d2c0" />
        <rect x="8" y="8" width="32" height="8" rx="4" fill="#f7c64b" />
        <g stroke="#c8c2ae" strokeWidth="1.6" strokeLinecap="round">
          <path d="M13 24h22M13 29h22M13 34h14" />
        </g>
      </g>
    ),
  },
  textedit: {
    bg: 'linear-gradient(180deg,#ffffff 0%,#e8ebef 100%)',
    glyph: (
      <g>
        <rect x="9" y="7" width="30" height="34" rx="3" fill="#fff" stroke="#c9ced6" />
        <rect x="9" y="7" width="30" height="6" fill="#aeb6c2" rx="3" />
        <g stroke="#8f98a6" strokeWidth="1.5" strokeLinecap="round">
          <path d="M13 19h22M13 24h22M13 29h22M13 34h13" />
        </g>
      </g>
    ),
  },
  preview: {
    bg: 'linear-gradient(180deg,#37c3ff 0%,#1668e3 100%)',
    glyph: (
      <g>
        <rect x="8" y="10" width="32" height="24" rx="3" fill="#fff" opacity=".95" />
        <circle cx="17" cy="18" r="3" fill="#ffb03a" />
        <path d="M10 32l8-8 5 5 7-7 8 8" stroke="#1668e3" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M36 38l-3.2-3.2a2 2 0 010-2.8l6-6a2 2 0 012.8 0l.4.4a2 2 0 010 2.8l-6 6a2 2 0 01-2.8 0z" fill="#ffd60a" stroke="#b98700" strokeWidth=".8" />
      </g>
    ),
  },
  photos: {
    bg: 'linear-gradient(180deg,#fdfdfd 0%,#eceff2 100%)',
    glyph: (
      <g opacity=".92">
        {[
          ['#f5a623', 0], ['#ff453a', 45], ['#ff375f', 90], ['#bf5af2', 135],
          ['#0a84ff', 180], ['#30d158', 225], ['#a3cc2e', 270], ['#ffd60a', 315],
        ].map(([c, r]) => (
          <ellipse key={String(r)} cx="24" cy="15.5" rx="4.6" ry="8" fill={String(c)} transform={`rotate(${r} 24 24)`} />
        ))}
      </g>
    ),
  },
  music: {
    bg: 'linear-gradient(180deg,#ff6d84 0%,#f5395f 100%)',
    glyph: (
      <g fill={W}>
        <path d="M31 10l-12 2.6v16.2a4.4 4.4 0 11-2-3.7V15.4l16-3.4v13.6a4.4 4.4 0 11-2-3.7z" />
      </g>
    ),
  },
  calculator: {
    bg: 'linear-gradient(180deg,#3b3f46 0%,#1f2126 100%)',
    glyph: (
      <g>
        <rect x="12" y="8" width="24" height="32" rx="4" fill="#15171b" />
        <rect x="15" y="11" width="18" height="7" rx="1.6" fill="#c9f7c0" opacity=".9" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <circle key={`${r}${c}`} cx={18 + c * 6} cy={23 + r * 6} r="2.2" fill={c === 2 ? '#ff9f0a' : '#6b7280'} />
          )),
        )}
      </g>
    ),
  },
  terminal: {
    bg: 'linear-gradient(180deg,#3a3f47 0%,#16181c 100%)',
    glyph: (
      <g>
        <rect x="9" y="10" width="30" height="28" rx="3" fill="#0c0e11" />
        <path d="M14 18l6 5-6 5" stroke="#e8eaed" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 28h10" stroke="#e8eaed" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    ),
  },
  settings: {
    bg: 'linear-gradient(180deg,#e3e5e8 0%,#b8bcc2 100%)',
    glyph: (
      <g>
        <circle cx="24" cy="24" r="14" fill="#7c828c" />
        <circle cx="24" cy="24" r="6.5" fill="#e3e5e8" />
        <g fill="#7c828c">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
            <rect key={r} x="22.4" y="6.5" width="3.2" height="6" rx="1.4" transform={`rotate(${r} 24 24)`} />
          ))}
        </g>
      </g>
    ),
  },
  appstore: {
    bg: 'linear-gradient(180deg,#31c1ff 0%,#0a6cf0 100%)',
    glyph: (
      <g stroke={W} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M17 32l7-13 7 13" />
        <path d="M13 27h22" />
        <path d="M21.6 14.8l-2.4-4M26.4 14.8l4.8 8.4" />
      </g>
    ),
  },
  activity: {
    bg: 'linear-gradient(180deg,#2c2f34 0%,#101215 100%)',
    glyph: (
      <g>
        <path d="M9 28h7l3-9 4 14 3-8h13" stroke="#30d158" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  clock: {
    bg: 'linear-gradient(180deg,#1b1d21 0%,#000000 100%)',
    glyph: (
      <g>
        <circle cx="24" cy="24" r="16" fill="#fff" />
        <g stroke="#111" strokeWidth="1.4">
          <path d="M24 10v3M24 35v3M10 24h3M35 24h3" />
        </g>
        <path d="M24 24V15" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 24l6.5 4" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 24l-4.5 6.5" stroke="#ff9500" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
  },
  weather: {
    bg: 'linear-gradient(180deg,#4aa8ff 0%,#1668dc 100%)',
    glyph: (
      <g>
        <circle cx="20" cy="20" r="7" fill="#ffd60a" />
        <path d="M16 32a7 7 0 017-7c3 0 5.4 1.8 6.4 4.4A5 5 0 0130 39H18a5 5 0 01-2-7z" fill="#fff" opacity=".96" />
      </g>
    ),
  },
  maps: {
    bg: 'linear-gradient(160deg,#d7f0c8 0%,#a8d8a0 40%,#8ec9e8 100%)',
    glyph: (
      <g>
        <path d="M6 40L20 8h10l12 32" stroke="#f7d154" strokeWidth="6" fill="none" />
        <path d="M6 40L20 8h10l12 32" stroke="#fff" strokeWidth="1.4" fill="none" strokeDasharray="3 3" />
        <circle cx="33" cy="20" r="5" fill="#ff453a" stroke="#fff" strokeWidth="1.4" />
      </g>
    ),
  },
  messages: {
    bg: 'linear-gradient(180deg,#6ee071 0%,#13bd2c 100%)',
    glyph: (
      <path d="M24 10c-9 0-16 5.8-16 13 0 4.2 2.4 7.9 6.2 10.2-.3 2.4-1.3 4.4-3 6 3-.2 5.6-1.2 7.4-2.6 1.7.4 3.5.6 5.4.6 9 0 16-5.8 16-13s-7-14.2-16-14.2z" fill={W} />
    ),
  },
  mail: {
    bg: 'linear-gradient(180deg,#4aa5ff 0%,#0f62d6 100%)',
    glyph: (
      <g>
        <rect x="8" y="13" width="32" height="22" rx="3" fill="#fff" />
        <path d="M8 15l16 12 16-12" stroke="#0f62d6" strokeWidth="2" fill="none" />
      </g>
    ),
  },
  calendar: {
    bg: 'linear-gradient(180deg,#ffffff 0%,#eceef1 100%)',
    glyph: (
      <g>
        <rect x="9" y="9" width="30" height="30" rx="5" fill="#fff" stroke="#d5d9de" />
        <rect x="9" y="9" width="30" height="8" rx="5" fill="#ff453a" />
        <text x="24" y="32" textAnchor="middle" fontSize="14" fontWeight="700" fill="#2a2d31" fontFamily="inherit">{new Date().getDate()}</text>
        <text x="24" y="15.5" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#fff" fontFamily="inherit">{new Date().toLocaleDateString([], { weekday: 'short' }).toUpperCase()}</text>
      </g>
    ),
  },
  reminders: {
    bg: 'linear-gradient(180deg,#ffffff 0%,#eef0f3 100%)',
    glyph: (
      <g>
        {[['#ff453a', 14], ['#ff9f0a', 24], ['#0a84ff', 34]].map(([c, y]) => (
          <g key={String(y)}>
            <circle cx="14" cy={Number(y)} r="3" fill="none" stroke={String(c)} strokeWidth="2" />
            <path d={`M20 ${y}h16`} stroke="#b9bec7" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ))}
      </g>
    ),
  },
  stickies: {
    bg: 'linear-gradient(180deg,#ffe873 0%,#ffc933 100%)',
    glyph: (
      <g>
        <path d="M12 12h24v17l-7 7H12z" fill="#fff8d6" stroke="#d9a917" strokeWidth="1" />
        <path d="M36 29l-7 7v-7z" fill="#f2d266" stroke="#d9a917" strokeWidth="1" />
      </g>
    ),
  },
  launchpad: {
    bg: 'linear-gradient(180deg,#4b5563 0%,#1f2937 100%)',
    glyph: (
      <g>
        {[14, 24, 34].flatMap((x) => [14, 24, 34].map((y) => <rect key={`${x}${y}`} x={x - 3} y={y - 3} width="6" height="6" rx="1.6" fill="#fff" opacity=".9" />))}
      </g>
    ),
  },
  facetime: {
    bg: 'linear-gradient(180deg,#6ee071 0%,#13bd2c 100%)',
    glyph: (
      <g fill={W}>
        <rect x="9" y="15" width="20" height="18" rx="4" />
        <path d="M31 21l8-5v16l-8-5z" />
      </g>
    ),
  },
  generic: {
    bg: 'linear-gradient(180deg,#8e9aa8 0%,#5c6672 100%)',
    glyph: (
      <g fill={W} opacity=".9">
        <rect x="14" y="10" width="20" height="28" rx="2.6" />
      </g>
    ),
  },
};

export function TrashIcon({ full, size = 48 }: { full: boolean; size?: number }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }} aria-hidden>
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path d="M13 14h22l-2.4 26a4 4 0 01-4 3.6H19.4a4 4 0 01-4-3.6z" fill="rgba(220,228,238,.42)" stroke="rgba(255,255,255,.65)" strokeWidth="1.2" />
        <path d="M13.6 14c0-3 4.6-5 10.4-5s10.4 2 10.4 5-4.6 5-10.4 5-10.4-2-10.4-5z" fill="rgba(235,240,246,.5)" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" />
        {[19, 24, 29].map((x) => (
          <path key={x} d={`M${x} 19v18`} stroke="rgba(255,255,255,.55)" strokeWidth="1.4" strokeLinecap="round" />
        ))}
        {full && (
          <g>
            <rect x="16" y="8" width="9" height="7" rx="1" fill="#fff" stroke="#b8c0ca" transform="rotate(-8 20 11)" />
            <rect x="23" y="7" width="9" height="7" rx="1" fill="#dce8f5" stroke="#9fb0c2" transform="rotate(9 27 10)" />
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------- file/folder glyphs ----------
export function FolderGlyph({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="foldg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd0ff" /><stop offset="1" stopColor="#4da3ef" />
        </linearGradient>
      </defs>
      <path d="M5 13a3 3 0 013-3h10l4 4h18a3 3 0 013 3v18a3 3 0 01-3 3H8a3 3 0 01-3-3z" fill="url(#foldg)" />
      <path d="M5 19h38v-3a3 3 0 00-3-3H22l-4-4H8a3 3 0 00-3 3z" fill="#b6e0ff" opacity=".55" />
    </svg>
  );
}

const CAT_COLORS: Record<string, string> = {
  image: '#30d158', video: '#ff375f', audio: '#ff9f0a', pdf: '#ff453a',
  text: '#8e9aa8', code: '#0a84ff', archive: '#bf5af2', other: '#98a1ad',
};

export function FileGlyph({ node, size = 48 }: { node: FSNode; size?: number }) {
  const cat = fileCategory(node);
  const color = CAT_COLORS[cat];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <path d="M11 5a3 3 0 013-3h14l10 10v28a3 3 0 01-3 3H14a3 3 0 01-3-3z" fill="#fdfdfd" stroke="#c8ced6" strokeWidth="1" />
      <path d="M28 2l10 10h-8a2 2 0 01-2-2z" fill="#e4e8ee" stroke="#c8ced6" strokeWidth="1" />
      <rect x="15" y="22" width="18" height="18" rx="3" fill={color} opacity=".16" />
      {cat === 'image' && (
        <g><circle cx="20" cy="28" r="2.4" fill={color} /><path d="M16 37l5-5 3 3 4-4 4 6" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" /></g>
      )}
      {cat === 'video' && <path d="M20 27l9 5-9 5z" fill={color} />}
      {cat === 'audio' && <path d="M27 26v9a3 3 0 11-2-2.8V28l-4 1v8a3 3 0 11-2-2.8V27z" fill={color} />}
      {cat === 'pdf' && <text x="24" y="35" textAnchor="middle" fontSize="8" fontWeight="800" fill={color} fontFamily="inherit">PDF</text>}
      {(cat === 'text' || cat === 'other' || cat === 'archive') && (
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round"><path d="M17 28h14M17 32h14M17 36h9" /></g>
      )}
      {cat === 'code' && <path d="M19 27l-4 4 4 4M29 27l4 4-4 4" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      <text x="24" y="18" textAnchor="middle" fontSize="6" fontWeight="700" fill="#68707c" fontFamily="inherit">{(node.ext ?? '').toUpperCase().slice(0, 4)}</text>
    </svg>
  );
}

export function AliasBadge({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden style={{ position: 'absolute', left: 1, bottom: 1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.3))' }}>
      <rect width="16" height="16" rx="4" fill="rgba(30,34,40,.85)" />
      <path d="M4 8h6M8 5l3 3-3 3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
