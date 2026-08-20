export function uid(): string {
  return crypto.randomUUID();
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtBytes(n?: number): string {
  if (n == null || Number.isNaN(n)) return '0 KB';
  if (n < 1024) return `${n} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(ts);
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const base = baseName(name);
  const ext = extOf(name);
  const suffix = ext ? `.${ext}` : '';
  let i = 2;
  while (taken.has(`${base} ${i}${suffix}`)) i++;
  return `${base} ${i}${suffix}`;
}

export const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm',
  'xml', 'yml', 'yaml', 'csv', 'log', 'sh', 'py', 'rb', 'go', 'rs', 'c', 'h',
  'cpp', 'java', 'sql', 'env', 'ini', 'toml', 'svg',
]);

export function isTextMime(mime?: string, ext?: string): boolean {
  if (mime?.startsWith('text/')) return true;
  if (mime === 'application/json' || mime === 'application/xml') return true;
  return !!ext && TEXT_EXTS.has(ext);
}

export function fileCategory(node: { mime?: string; ext?: string; kind: string }): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'archive' | 'other' {
  const m = node.mime ?? '';
  const e = node.ext ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || e === 'pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'java', 'html', 'css', 'json', 'sql', 'sh', 'svg', 'xml'].includes(e)) return 'code';
  if (isTextMime(m, e)) return 'text';
  return 'other';
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export const ACCENTS: Array<{ id: string; name: string; color: string }> = [
  { id: 'blue', name: 'Blue', color: '#0a84ff' },
  { id: 'purple', name: 'Purple', color: '#bf5af2' },
  { id: 'pink', name: 'Pink', color: '#ff375f' },
  { id: 'red', name: 'Red', color: '#ff453a' },
  { id: 'orange', name: 'Orange', color: '#ff9f0a' },
  { id: 'yellow', name: 'Yellow', color: '#ffd60a' },
  { id: 'green', name: 'Green', color: '#30d158' },
  { id: 'graphite', name: 'Graphite', color: '#8e8e93' },
];

export const TAG_COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#8e8e93'];

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, name: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: mime }), name);
}

import type { CSSProperties } from 'react';

export interface WallpaperDef { id: string; name: string; src?: string; css?: string }

export const WALLPAPERS: WallpaperDef[] = [
  { id: 'flow-dark', name: 'Flow (Dark)', src: '/wallpapers/flow-dark.jpg' },
  { id: 'flow-light', name: 'Flow (Light)', src: '/wallpapers/flow-light.jpg' },
  { id: 'sonoma', name: 'Sonoma Coast', src: '/wallpapers/sonoma.jpg' },
  { id: 'graphite', name: 'Graphite', css: 'linear-gradient(160deg,#2b2f36 0%,#14161a 55%,#0a0b0d 100%)' },
  { id: 'dawn', name: 'Dawn', css: 'linear-gradient(150deg,#ffd8c2 0%,#ffb199 30%,#a18cd1 100%)' },
  { id: 'deep', name: 'Deep Ocean', css: 'linear-gradient(160deg,#0f2027 0%,#203a43 50%,#2c5364 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(160deg,#134e5e 0%,#276b4f 60%,#71b280 100%)' },
] as const;

export function wallpaperStyle(id: string): CSSProperties {
  const w = WALLPAPERS.find((x) => x.id === id) ?? WALLPAPERS[0];
  if (w.src) return { backgroundImage: `url(${w.src})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return { background: w.css };
}
