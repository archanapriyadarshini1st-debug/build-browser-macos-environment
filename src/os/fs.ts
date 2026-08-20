'use client';

// The single shared filesystem. Desktop, Finder, Terminal, Spotlight, Quick Look,
// Photos, Music and Trash all read/write through this module. Metadata lives in the
// zustand store (persisted to localStorage); file contents live in IndexedDB.

import { useOS } from './store';
import { delBlob, getBlob, putBlob } from './idb';
import { extOf, isTextMime, uid, uniqueName, fmtBytes } from './utils';
import type { FSNode, NodeKind } from './types';
import JSZip from 'jszip';
import { downloadBlob } from './utils';

export const ROOT = 'root';
export const DESKTOP = 'desktop';
export const DOCUMENTS = 'documents';
export const DOWNLOADS = 'downloads';
export const PICTURES = 'pictures';
export const MUSICDIR = 'music';

const S = () => useOS.getState();

// ---------- history ----------
type Hist = { label: string; before: Record<string, FSNode | undefined>; after: Record<string, FSNode | undefined> };
const undoStack: Hist[] = [];
const redoStack: Hist[] = [];

function pushHistory(label: string, before: Record<string, FSNode>, after: Record<string, FSNode>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const b: Hist['before'] = {};
  const a: Hist['after'] = {};
  let changed = false;
  keys.forEach((k) => {
    if (before[k] !== after[k]) {
      changed = true;
      b[k] = before[k];
      a[k] = after[k];
    }
  });
  if (!changed) return;
  undoStack.push({ label, before: b, after: a });
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  S().historyTick(undoStack.length, redoStack.length);
}

function applyHist(h: Hist, target: Hist['before']) {
  const nodes = { ...S().nodes };
  for (const k of Object.keys(target)) {
    const v = target[k];
    if (v) nodes[k] = v;
    else delete nodes[k];
  }
  useOS.setState({ nodes });
}

export function fsUndo() {
  const h = undoStack.pop();
  if (!h) return;
  applyHist(h, h.before);
  redoStack.push(h);
  S().historyTick(undoStack.length, redoStack.length);
}

export function fsRedo() {
  const h = redoStack.pop();
  if (!h) return;
  applyHist(h, h.after);
  undoStack.push(h);
  S().historyTick(undoStack.length, redoStack.length);
}

export function lastOpLabel(): string {
  return undoStack[undoStack.length - 1]?.label ?? '';
}

// ---------- core mutation ----------
function commit(label: string, fn: (draft: Record<string, FSNode>) => void, opts?: { silent?: boolean }) {
  const before = S().nodes;
  const next = { ...before };
  fn(next);
  useOS.setState({ nodes: next });
  if (!opts?.silent) pushHistory(label, before, next);
}

function put(draft: Record<string, FSNode>, n: FSNode) {
  draft[n.id] = n;
}

function mkNode(partial: Omit<FSNode, 'createdAt' | 'modifiedAt'> & Partial<FSNode>): FSNode {
  const t = Date.now();
  return { createdAt: t, modifiedAt: t, ...partial } as FSNode;
}

// ---------- queries ----------
export const get = (id: string): FSNode | undefined => S().nodes[id];

export function childrenOf(parent: string): FSNode[] {
  return Object.values(S().nodes).filter((n) => n.parent === parent && !n.trashed);
}

export function trashedItems(): FSNode[] {
  return Object.values(S().nodes).filter((n) => n.trashed);
}

export function descOf(id: string): FSNode[] {
  const out: FSNode[] = [];
  const walk = (pid: string) => {
    for (const n of Object.values(S().nodes)) {
      if (n.parent === pid) {
        out.push(n);
        if (n.kind === 'folder') walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

export function pathOf(id: string): FSNode[] {
  const out: FSNode[] = [];
  let cur = S().nodes[id];
  let guard = 0;
  while (cur && guard++ < 40) {
    out.unshift(cur);
    cur = cur.parent ? S().nodes[cur.parent] : (undefined as unknown as FSNode);
  }
  return out;
}

export function pathString(id: string): string {
  return pathOf(id).map((n) => n.name).join(' ▸ ');
}

export function sortNodes(nodes: FSNode[], by?: string): FSNode[] {
  const sortBy = by ?? S().prefs.sortBy;
  return [...nodes].sort((a, b) => {
    if (a.kind === 'folder' && b.kind !== 'folder') return -1;
    if (b.kind === 'folder' && a.kind !== 'folder') return 1;
    if (sortBy === 'date') return b.modifiedAt - a.modifiedAt;
    if (sortBy === 'size') return (b.size ?? 0) - (a.size ?? 0);
    if (sortBy === 'kind') return (a.ext ?? '').localeCompare(b.ext ?? '') || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function resolveAlias(n: FSNode): FSNode | undefined {
  if (n.kind !== 'alias' || !n.aliasTarget) return n;
  const t = S().nodes[n.aliasTarget];
  return t && !t.trashed ? t : undefined;
}

export function folderSize(id: string): number {
  return descOf(id).reduce((acc, n) => acc + (n.kind === 'file' ? n.size ?? 0 : 0), 0);
}

export function recents(limit = 60): FSNode[] {
  return Object.values(S().nodes)
    .filter((n) => n.kind === 'file' && !n.trashed && n.parent !== PICTURES)
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, limit);
}

export function mediaFiles(kind: 'image' | 'audio' | 'video'): FSNode[] {
  const pre = { image: 'image/', audio: 'audio/', video: 'video/' }[kind];
  return Object.values(S().nodes)
    .filter((n) => n.kind === 'file' && !n.trashed && (n.mime ?? '').startsWith(pre))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export function searchFiles(q: string): FSNode[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const tagNames = new Map(S().tags.map((t) => [t.id, t.name.toLowerCase()]));
  return Object.values(S().nodes)
    .filter((n) => !n.trashed)
    .filter((n) => {
      if (n.name.toLowerCase().includes(needle)) return true;
      if ((n.text ?? '').toLowerCase().includes(needle)) return true;
      return (n.tags ?? []).some((t) => (tagNames.get(t) ?? '').includes(needle));
    })
    .slice(0, 30);
}

// ---------- creation ----------
export function createFolder(parent: string, name = 'untitled folder', pos?: { x: number; y: number }): string {
  const taken = new Set(childrenOf(parent).map((n) => n.name));
  const id = uid();
  commit('New Folder', (d) => {
    put(d, mkNode({ id, name: uniqueName(name, taken), kind: 'folder', parent, pos }));
  });
  return id;
}

export function createTextFile(parent: string, name = 'untitled.txt', text = '', pos?: { x: number; y: number }): string {
  const taken = new Set(childrenOf(parent).map((n) => n.name));
  const id = uid();
  const finalName = uniqueName(name, taken);
  commit('New Document', (d) => {
    put(d, mkNode({
      id, name: finalName, kind: 'file', parent, pos,
      mime: 'text/plain', ext: extOf(finalName) || 'txt',
      size: new Blob([text]).size, text,
    }));
  });
  void putBlob(id, new Blob([text], { type: 'text/plain' }));
  return id;
}

export async function importFiles(files: File[] | FileList, parent: string, pos?: { x: number; y: number }): Promise<number> {
  const arr = Array.from(files);
  let ok = 0;
  const taken = new Set(childrenOf(S().nodes[parent]?.id ?? parent).map((n) => n.name));
  for (const f of arr) {
    try {
      const id = uid();
      const name = uniqueName(f.name || 'imported file', taken);
      taken.add(name);
      let text: string | undefined;
      if (isTextMime(f.type, extOf(name)) && f.size < 400_000) {
        try { text = await f.text(); } catch { /* keep blob only */ }
      }
      commit(`Import “${name}”`, (d) => {
        put(d, mkNode({
          id, name, kind: 'file', parent, pos,
          mime: f.type || 'application/octet-stream', ext: extOf(name),
          size: f.size, text: text?.slice(0, 2000),
          meta: { imported: true, lastModified: f.lastModified },
        }));
      });
      await putBlob(id, f);
      ok++;
    } catch (e) {
      console.error('import failed', e);
      S().notify('system', 'Import failed', `Could not import “${f.name}”.`);
    }
  }
  if (ok > 0) S().notify('system', 'Import complete', `${ok} item${ok > 1 ? 's' : ''} imported — stored locally on this device.`);
  return ok;
}

// ---------- mutations ----------
export function rename(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  commit('Rename', (d) => {
    const n = d[id];
    if (n) d[id] = { ...n, name: clean, ext: n.kind === 'file' ? extOf(clean) || n.ext : undefined, modifiedAt: Date.now() };
  });
}

export function writeText(id: string, text: string) {
  commit('Edit', (d) => {
    const n = d[id];
    if (!n) return;
    d[id] = { ...n, text: text.slice(0, 2000), size: new Blob([text]).size, modifiedAt: Date.now() };
  });
  void putBlob(id, new Blob([text], { type: 'text/plain' }));
}

export function setNodeTags(id: string, tagIds: string[]) {
  commit('Tag', (d) => {
    const n = d[id];
    if (n) d[id] = { ...n, tags: tagIds };
  });
}

export function toggleTag(id: string, tagId: string) {
  commit('Tag', (d) => {
    const n = d[id];
    if (!n) return;
    const tags = n.tags ?? [];
    d[id] = { ...n, tags: tags.includes(tagId) ? tags.filter((t) => t !== tagId) : [...tags, tagId] };
  });
}

export function createTag(name: string, color: string): string {
  const id = uid();
  useOS.setState((s) => ({ tags: [...s.tags, { id, name, color }] }));
  return id;
}

export function deleteTag(id: string) {
  useOS.setState((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  const nodes = { ...S().nodes };
  for (const k of Object.keys(nodes)) {
    const n = nodes[k];
    if (n.tags?.includes(id)) nodes[k] = { ...n, tags: n.tags.filter((t) => t !== id) };
  }
  useOS.setState({ nodes });
}

export function setFavorite(id: string, fav: boolean) {
  useOS.setState((s) => {
    const n = s.nodes[id];
    if (!n) return s;
    return { nodes: { ...s.nodes, [id]: { ...n, favorite: fav } } };
  });
}

export function makeAlias(id: string, destParent: string): string {
  const target = get(id);
  if (!target) return '';
  const aid = uid();
  const taken = new Set(childrenOf(destParent).map((n) => n.name));
  commit('Make Alias', (d) => {
    put(d, mkNode({
      id: aid, name: uniqueName(`${target.name} alias`, taken), kind: 'alias',
      parent: destParent, aliasTarget: id, size: 0,
    }));
  });
  return aid;
}

// ---------- trash ----------
export function trash(ids: string[]) {
  commit('Move to Trash', (d) => {
    for (const id of ids) trashDeep(id, d);
  });
}

export function trashDeep(id: string, d: Record<string, FSNode>) {
  const n = d[id];
  if (!n || n.trashed) return;
  d[id] = { ...n, trashed: true, trashFrom: n.parent, pos: undefined };
  for (const c of Object.values(d)) if (c.parent === id) trashDeep(c.id, d);
}

function restoreDeep(id: string, dest: string, d: Record<string, FSNode>) {
  const n = d[id];
  if (!n || !n.trashed) return;
  d[id] = { ...n, trashed: false, parent: dest, trashFrom: undefined };
  for (const c of Object.values(d)) if (c.parent === id) restoreDeep(c.id, id, d);
}

export function restore(ids: string[]) {
  commit('Restore', (d) => {
    for (const id of ids) {
      const n = d[id];
      if (!n) continue;
      let dest = n.trashFrom ?? DOCUMENTS;
      if (!d[dest] || d[dest].trashed) dest = DOCUMENTS;
      restoreDeep(id, dest, d);
    }
  });
}

export function deleteForever(ids: string[]) {
  commit('Delete', (d) => {
    const doomed = new Set<string>(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of Object.values(d)) {
        if (n.parent && doomed.has(n.parent) && !doomed.has(n.id)) {
          doomed.add(n.id);
          grew = true;
        }
      }
    }
    doomed.forEach((id) => {
      delete d[id];
      void delBlob(id);
    });
  });
}

export function emptyTrash() {
  const items = trashedItems();
  if (!items.length) return;
  deleteForever(items.map((n) => n.id));
  S().notify('system', 'Trash emptied', `${items.length} item${items.length > 1 ? 's' : ''} permanently deleted.`);
}

// ---------- copy / move / paste ----------
export function conflictsFor(ids: string[], dest: string): string[] {
  const names = new Set(childrenOf(dest).map((n) => n.name));
  return ids.map((id) => get(id)).filter((n): n is FSNode => !!n && names.has(n!.name)).map((n) => n!.name);
}

export function requestTransfer(op: 'copy' | 'move', ids: string[], dest: string) {
  const conflicts = conflictsFor(ids, dest);
  if (conflicts.length) {
    useOS.setState((s) => ({ ui: { ...s.ui, conflict: { ids, dest, op, names: conflicts } } }));
    return;
  }
  void applyTransfer(op, ids, dest, 'auto');
}

export async function applyTransfer(op: 'copy' | 'move', ids: string[], dest: string, mode: 'auto' | 'replace' | 'keepboth') {
  useOS.setState((s) => ({ ui: { ...s.ui, conflict: null } }));
  if (mode === 'replace') {
    const names = new Set(ids.map((id) => get(id)?.name).filter(Boolean));
    const victims = childrenOf(dest).filter((n) => names.has(n.name)).map((n) => n.id);
    if (victims.length) deleteForever(victims);
  }
  if (op === 'move') {
    commit('Move', (d) => {
      const taken = new Set(childrenOf(dest).filter((n) => !ids.includes(n.id)).map((n) => n.name));
      for (const id of ids) {
        const n = d[id];
        if (!n || id === dest) continue;
        d[id] = { ...n, parent: dest, name: mode === 'keepboth' ? uniqueName(n.name, taken) : n.name, modifiedAt: Date.now(), pos: undefined };
        taken.add(d[id].name);
      }
    });
  } else {
    const mapping = new Map<string, string>();
    commit('Copy', (d) => {
      const collect = (id: string) => {
        const n = S().nodes[id];
        if (!n) return;
        mapping.set(id, uid());
        for (const c of Object.values(S().nodes)) if (c.parent === id) collect(c.id);
      };
      ids.forEach(collect);
      const taken = new Set(childrenOf(dest).map((n) => n.name));
      for (const id of ids) {
        const n = S().nodes[id];
        if (!n) continue;
        let name = n.name;
        if (mode !== 'replace' && taken.has(name)) name = uniqueName(name, taken);
        taken.add(name);
        cloneInto(d, id, dest, name, mapping);
      }
    });
    for (const [oldId, newId] of mapping) {
      const blob = await getBlob(oldId);
      if (blob) await putBlob(newId, blob);
    }
  }
}

function cloneInto(d: Record<string, FSNode>, srcId: string, dest: string, name: string, mapping: Map<string, string>) {
  const src = S().nodes[srcId];
  if (!src) return;
  const nid = mapping.get(srcId) ?? uid();
  const copy: FSNode = { ...src, id: nid, parent: dest, name, createdAt: Date.now(), modifiedAt: Date.now(), pos: undefined };
  if (src.kind === 'alias') copy.aliasTarget = src.aliasTarget;
  put(d, copy);
  for (const c of Object.values(S().nodes)) {
    if (c.parent === srcId) cloneInto(d, c.id, nid, c.name, mapping);
  }
}

export function paste(dest: string) {
  const clip = S().clipboard;
  if (!clip || !clip.ids.length) return;
  const live = clip.ids.filter((id) => get(id) && !get(id)!.trashed);
  if (!live.length) return;
  if (clip.mode === 'cut') {
    requestTransfer('move', live, dest);
    useOS.setState({ clipboard: null });
  } else {
    requestTransfer('copy', live, dest);
  }
}

export function duplicate(ids: string[]) {
  for (const id of ids) {
    const n = get(id);
    if (!n || !n.parent) continue;
    void applyTransfer('copy', [id], n.parent, 'keepboth');
  }
}

// ---------- export ----------
export async function exportNode(id: string) {
  const n = get(id);
  if (!n) return;
  if (n.kind === 'folder') {
    await exportZip([id], `${n.name}.zip`);
    return;
  }
  const blob = await getBlob(id);
  if (n.kind === 'file' && blob) {
    downloadBlob(blob, n.name);
  } else if (n.text != null) {
    downloadBlob(new Blob([n.text], { type: 'text/plain' }), n.name);
  } else {
    S().notify('system', 'Nothing to export', `“${n.name}” has no stored content.`);
  }
}

export async function exportZip(ids: string[], name: string) {
  const zip = new JSZip();
  const addNode = async (id: string, dir: JSZip) => {
    const n = get(id);
    if (!n) return;
    if (n.kind === 'folder') {
      const sub = dir.folder(n.name)!;
      for (const c of childrenOf(id)) await addNode(c.id, sub);
    } else {
      const blob = (await getBlob(id)) ?? new Blob([n.text ?? ''], { type: 'text/plain' });
      dir.file(n.name, blob);
    }
  };
  for (const id of ids) await addNode(id, zip);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, name);
  S().notify('system', 'Export ready', `Downloaded ${name} (${fmtBytes(blob.size)}).`);
}

// ---------- seeding ----------
let seeded = false;
export async function seed() {
  if (seeded) return;
  seeded = true;
  const s = S();
  if (s.nodes[ROOT]) {
    // ensure defaults survive version bumps
    if (s.notes.length === 0) seedNotes();
    return;
  }
  const t = Date.now();
  const base = (id: string, name: string, kind: NodeKind, parent: string | null): FSNode => ({
    id, name, kind, parent, createdAt: t, modifiedAt: t,
  });
  const nodes: Record<string, FSNode> = {
    [ROOT]: base(ROOT, 'Macintosh HD', 'folder', null),
    [DESKTOP]: base(DESKTOP, 'Desktop', 'folder', ROOT),
    [DOCUMENTS]: base(DOCUMENTS, 'Documents', 'folder', ROOT),
    [DOWNLOADS]: base(DOWNLOADS, 'Downloads', 'folder', ROOT),
    [PICTURES]: base(PICTURES, 'Pictures', 'folder', ROOT),
    [MUSICDIR]: base(MUSICDIR, 'Music', 'folder', ROOT),
  };
  useOS.setState({ nodes });

  const welcome = [
    '# Welcome to your browser Mac\n\nThis is a full desktop environment running in your browser.\n\n• Right-click the desktop to create folders, import files, or change the wallpaper\n• Press ⌘Space for Spotlight, ⌘Tab to switch apps\n• Press F3 for Mission Control — create more Spaces up top\n• Files you import stay on this device (IndexedDB) — nothing is uploaded\n\nDouble-click this file to edit it in TextEdit.',
    '# Getting Started\n\nEverything here is persistent. Reload the page — your windows, files and settings come back.\n\nTry:\n1. Import a file onto the Desktop\n2. Press Space on it for Quick Look\n3. Right-click → Tags\n4. Search for it in Spotlight',
  ];
  createTextFile(DESKTOP, 'Welcome.md', welcome[0], { x: 40, y: 30 });
  createTextFile(DOCUMENTS, 'Getting Started.md', welcome[1]);
  const proj = createFolder(DOCUMENTS, 'Projects');
  createTextFile(proj, 'todo.md', '# Project TODO\n\n- [x] Boot the desktop\n- [ ] Import a file\n- [ ] Make a second Space\n- [ ] Tile two windows side by side\n');
  createTextFile(proj, 'app.ts', `// A tiny example file\nexport function greet(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`, { x: 40, y: 150 });

  // sample pictures from bundled wallpapers
  try {
    for (const src of ['/wallpapers/flow-dark.jpg', '/wallpapers/sonoma.jpg']) {
      const res = await fetch(src);
      const blob = await res.blob();
      const id = uid();
      const name = src.split('/').pop()!;
      commit('Sample pictures', (d) => {
        put(d, mkNode({ id, name, kind: 'file', parent: PICTURES, mime: 'image/jpeg', ext: 'jpg', size: blob.size }));
      }, { silent: true });
      await putBlob(id, blob);
    }
  } catch { /* offline seed is fine */ }

  seedNotes();
  undoStack.length = 0;
  redoStack.length = 0;
  S().historyTick(0, 0);
}

function seedNotes() {
  const t = Date.now();
  useOS.setState({
    notes: [
      { id: uid(), folder: 'nf-main', title: 'Welcome', body: 'Notes live here. They sync with Spotlight search and persist on this device.', createdAt: t, modifiedAt: t, pinned: true },
      { id: uid(), folder: 'nf-main', title: 'Shopping list', body: '- [ ] Coffee beans\n- [ ] Oat milk\n- [ ] Keyboard keycaps', createdAt: t, modifiedAt: t },
    ],
  });
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}
