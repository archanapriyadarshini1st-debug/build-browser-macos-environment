'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FSNode, Note, NoteFolder, Notif, Prefs, SafariState, Space, Tag, UIState, Win, FocusMode,
} from './types';
import { uid } from './utils';

export const CORE_APPS = [
  'finder', 'safari', 'notes', 'textedit', 'preview', 'photos', 'music',
  'calculator', 'terminal', 'settings', 'appstore', 'activity',
];

export const STORE_APPS: Array<{ id: string; name: string; category: string; desc: string }> = [
  { id: 'clock', name: 'Clock', category: 'Utilities', desc: 'World clocks and an analog face.' },
  { id: 'weather', name: 'Weather', category: 'Utilities', desc: 'A calm weather panel (simulated data).' },
  { id: 'maps', name: 'Maps', category: 'Productivity', desc: 'Real maps via OpenStreetMap.' },
  { id: 'messages', name: 'Messages', category: 'Communication', desc: 'Local chat threads (simulation).' },
  { id: 'mail', name: 'Mail', category: 'Communication', desc: 'A local mailbox (simulation).' },
  { id: 'calendar', name: 'Calendar', category: 'Productivity', desc: 'Month calendar with events.' },
  { id: 'reminders', name: 'Reminders', category: 'Productivity', desc: 'Checklists that persist.' },
  { id: 'stickies', name: 'Stickies', category: 'Utilities', desc: 'Sticky notes on your desktop.' },
];

interface OSState {
  booted: boolean;
  locked: boolean;
  off: boolean;
  nodes: Record<string, FSNode>;
  tags: Tag[];
  notes: Note[];
  noteFolders: NoteFolder[];
  prefs: Prefs;
  spaces: Space[];
  activeSpace: string;
  windows: Record<string, Win>;
  zTop: number;
  focusedWin: string | null;
  dock: string[];
  installed: string[];
  notifications: Notif[];
  clipboard: { mode: 'copy' | 'cut'; ids: string[] } | null;
  textClip: string | null;
  safari: SafariState;
  music: { current: string | null; playing: boolean };
  fsHistoryLen: number;
  fsRedoLen: number;
  ui: UIState;

  set: (p: Partial<Pick<OSState, 'booted' | 'locked' | 'off'>>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  uiPatch: (p: Partial<UIState>) => void;
  setNodes: (nodes: Record<string, FSNode>) => void;
  setWin: (id: string, p: Partial<Win>) => void;
  setWinProps: (id: string, props: Record<string, unknown>) => void;
  addWin: (w: Win) => void;
  closeWin: (id: string) => void;
  focusWin: (id: string) => void;
  toggleMaximize: (id: string) => void;
  toggleFullscreen: (id: string) => void;
  addSpace: () => void;
  removeSpace: (id: string) => void;
  renameSpace: (id: string, name: string) => void;
  setActiveSpace: (id: string) => void;
  shiftSpace: (dir: 1 | -1) => void;
  moveWinToSpace: (winId: string, spaceId: string) => void;
  setDock: (ids: string[]) => void;
  installApp: (id: string) => void;
  uninstallApp: (id: string) => void;
  notify: (app: string, title: string, body: string) => void;
  dismissNotif: (id: string) => void;
  clearNotifs: () => void;
  setClipboard: (c: OSState['clipboard']) => void;
  addNote: (n: Note) => void;
  updateNote: (id: string, p: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addNoteFolder: (name: string) => string;
  safariPatch: (p: Partial<SafariState>) => void;
  musicPatch: (p: Partial<OSState['music']>) => void;
  historyTick: (undoLen: number, redoLen: number) => void;
}

const defaultUI: UIState = {
  spotlight: false, mission: false, control: false, notifCenter: false, launchpad: false,
  switcher: null, quicklook: null, getInfo: null, conflict: null, renameId: null, menu: null,
};

const defaultPrefs: Prefs = {
  appearance: 'dark', accent: '#0a84ff', wallpaper: 'flow-dark',
  reducedMotion: false, highContrast: false, transparency: true, textScale: 1,
  dockSize: 52, dockMagnify: true, dockAutoHide: false, dockPosition: 'bottom',
  desktopIconSize: 56, stacks: false, showDesktopIcons: true, stageManager: false,
  focus: 'off', wifi: true, bluetooth: true, airdrop: true,
  volume: 65, brightness: 100, nightShift: false,
  notifEnabled: {}, sortBy: 'name', finderView: 'icons',
};

export const useOS = create<OSState>()(
  persist(
    (set, get) => ({
      booted: false,
      locked: false,
      off: false,
      nodes: {},
      tags: [
        { id: 'tag-red', name: 'Important', color: '#ff453a' },
        { id: 'tag-orange', name: 'Work', color: '#ff9f0a' },
        { id: 'tag-green', name: 'Personal', color: '#30d158' },
        { id: 'tag-blue', name: 'Projects', color: '#0a84ff' },
      ],
      notes: [],
      noteFolders: [{ id: 'nf-main', name: 'Notes' }],
      prefs: defaultPrefs,
      spaces: [{ id: 'sp-1', name: 'Desktop 1' }],
      activeSpace: 'sp-1',
      windows: {},
      zTop: 10,
      focusedWin: null,
      dock: ['finder', 'safari', 'notes', 'messages', 'photos', 'music', 'appstore', 'settings', 'terminal'],
      installed: CORE_APPS,
      notifications: [],
      clipboard: null,
      textClip: null,
      safari: { bookmarks: [], readingList: [], history: [] },
      music: { current: null, playing: false },
      fsHistoryLen: 0,
      fsRedoLen: 0,
      ui: defaultUI,

      set: (p) => set(p),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      uiPatch: (p) => set((s) => ({ ui: { ...s.ui, ...p } })),
      setNodes: (nodes) => set({ nodes }),

      setWin: (id, p) =>
        set((s) => (s.windows[id] ? { windows: { ...s.windows, [id]: { ...s.windows[id], ...p } } } : s)),
      setWinProps: (id, props) =>
        set((s) => {
          const w = s.windows[id];
          if (!w) return s;
          return { windows: { ...s.windows, [id]: { ...w, props: { ...(w.props ?? {}), ...props } } } };
        }),
      addWin: (w) => set((s) => ({ windows: { ...s.windows, [w.id]: w }, zTop: w.z, focusedWin: w.id })),
      closeWin: (id) =>
        set((s) => {
          const windows = { ...s.windows };
          delete windows[id];
          const ids = Object.values(windows).filter((w) => !w.minimized).sort((a, b) => b.z - a.z);
          return { windows, focusedWin: ids[0]?.id ?? null };
        }),
      focusWin: (id) =>
        set((s) => {
          const w = s.windows[id];
          if (!w) return s;
          const z = s.zTop + 1;
          return { zTop: z, focusedWin: id, windows: { ...s.windows, [id]: { ...w, z, minimized: false } } };
        }),
      toggleMaximize: (id) =>
        set((s) => {
          const w = s.windows[id];
          if (!w) return s;
          if (w.maximized && w.prevRect) {
            return { windows: { ...s.windows, [id]: { ...w, maximized: false, ...w.prevRect, prevRect: undefined } } };
          }
          return {
            windows: {
              ...s.windows,
              [id]: { ...w, maximized: true, prevRect: { x: w.x, y: w.y, w: w.w, h: w.h }, x: 8, y: 38, w: window.innerWidth - 16, h: window.innerHeight - 46 },
            },
          };
        }),
      toggleFullscreen: (id) =>
        set((s) => {
          const w = s.windows[id];
          if (!w) return s;
          return { windows: { ...s.windows, [id]: { ...w, fullscreen: !w.fullscreen } } };
        }),

      addSpace: () =>
        set((s) => {
          const sp = { id: uid(), name: `Desktop ${s.spaces.length + 1}` };
          return { spaces: [...s.spaces, sp], activeSpace: sp.id };
        }),
      removeSpace: (id) =>
        set((s) => {
          if (s.spaces.length <= 1) return s;
          const target = s.spaces.find((x) => x.id !== id) ?? s.spaces[0];
          const windows = { ...s.windows };
          for (const k of Object.keys(windows)) if (windows[k].space === id) windows[k] = { ...windows[k], space: target.id };
          return { spaces: s.spaces.filter((x) => x.id !== id), windows, activeSpace: s.activeSpace === id ? target.id : s.activeSpace };
        }),
      renameSpace: (id, name) => set((s) => ({ spaces: s.spaces.map((x) => (x.id === id ? { ...x, name } : x)) })),
      setActiveSpace: (id) => set({ activeSpace: id }),
      shiftSpace: (dir) =>
        set((s) => {
          const i = s.spaces.findIndex((x) => x.id === s.activeSpace);
          const n = s.spaces[(i + dir + s.spaces.length) % s.spaces.length];
          return { activeSpace: n.id };
        }),
      moveWinToSpace: (winId, spaceId) =>
        set((s) => {
          const w = s.windows[winId];
          if (!w) return s;
          return { windows: { ...s.windows, [winId]: { ...w, space: spaceId } } };
        }),

      setDock: (ids) => set({ dock: ids }),
      installApp: (id) => set((s) => ({ installed: s.installed.includes(id) ? s.installed : [...s.installed, id] })),
      uninstallApp: (id) =>
        set((s) => {
          const windows = { ...s.windows };
          for (const k of Object.keys(windows)) if (windows[k].appId === id) delete windows[k];
          return { installed: s.installed.filter((x) => x !== id), dock: s.dock.filter((x) => x !== id), windows };
        }),

      notify: (app, title, body) =>
        set((s) => {
          if (s.prefs.notifEnabled[app] === false) return s;
          if (s.prefs.focus !== 'off' && app !== 'system') return s;
          const n: Notif = { id: uid(), app, title, body, time: Date.now() };
          return { notifications: [n, ...s.notifications].slice(0, 50) };
        }),
      dismissNotif: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      clearNotifs: () => set({ notifications: [] }),

      setClipboard: (c) => set({ clipboard: c }),

      addNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),
      updateNote: (id, p) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...p, modifiedAt: Date.now() } : n)) })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      addNoteFolder: (name) => {
        const id = uid();
        set((s) => ({ noteFolders: [...s.noteFolders, { id, name }] }));
        return id;
      },

      safariPatch: (p) => set((s) => ({ safari: { ...s.safari, ...p } })),
      musicPatch: (p) => set((s) => ({ music: { ...s.music, ...p } })),
      historyTick: (undoLen, redoLen) => set({ fsHistoryLen: undoLen, fsRedoLen: redoLen }),
    }),
    {
      name: 'browsermac-os',
      version: 2,
      partialize: (s) => ({
        nodes: s.nodes, tags: s.tags, notes: s.notes, noteFolders: s.noteFolders,
        prefs: s.prefs, spaces: s.spaces, activeSpace: s.activeSpace,
        windows: s.windows, zTop: s.zTop, dock: s.dock, installed: s.installed,
        notifications: s.notifications, safari: s.safari,
      }),
    },
  ),
);

export function focusModeName(f: FocusMode): string {
  return { off: 'Off', personal: 'Personal', work: 'Work', study: 'Study', sleep: 'Sleep' }[f];
}
