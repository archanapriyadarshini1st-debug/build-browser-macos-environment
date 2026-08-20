export type NodeKind = 'file' | 'folder' | 'alias';

export interface FSNode {
  id: string;
  name: string;
  kind: NodeKind;
  parent: string | null; // null => volume root
  trashed?: boolean;
  trashFrom?: string | null;
  mime?: string;
  ext?: string;
  size?: number;
  createdAt: number;
  modifiedAt: number;
  tags?: string[];
  favorite?: boolean;
  aliasTarget?: string;
  text?: string; // inline text for small text files (search + fast preview)
  pos?: { x: number; y: number }; // desktop position
  meta?: Record<string, unknown>;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface NoteFolder {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  folder: string;
  title: string;
  body: string;
  createdAt: number;
  modifiedAt: number;
  pinned?: boolean;
}

export interface Win {
  id: string;
  appId: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  fullscreen: boolean;
  space: string;
  props?: Record<string, unknown>;
  prevRect?: { x: number; y: number; w: number; h: number };
}

export interface Space {
  id: string;
  name: string;
}

export interface Notif {
  id: string;
  app: string;
  title: string;
  body: string;
  time: number;
  read?: boolean;
}

export type FocusMode = 'off' | 'personal' | 'work' | 'study' | 'sleep';

export interface Prefs {
  appearance: 'light' | 'dark' | 'auto';
  accent: string;
  wallpaper: string;
  reducedMotion: boolean;
  highContrast: boolean;
  transparency: boolean;
  textScale: number;
  dockSize: number;
  dockMagnify: boolean;
  dockAutoHide: boolean;
  dockPosition: 'bottom' | 'left' | 'right';
  desktopIconSize: number;
  stacks: boolean;
  showDesktopIcons: boolean;
  stageManager: boolean;
  focus: FocusMode;
  wifi: boolean;
  bluetooth: boolean;
  airdrop: boolean;
  volume: number;
  brightness: number;
  nightShift: boolean;
  notifEnabled: Record<string, boolean>;
  sortBy: 'name' | 'kind' | 'date' | 'size';
  finderView: 'icons' | 'list' | 'columns' | 'gallery';
}

export interface SafariLink {
  id: string;
  url: string;
  title: string;
}

export interface SafariHistoryEntry extends SafariLink {
  time: number;
}

export interface SafariState {
  bookmarks: SafariLink[];
  readingList: SafariLink[];
  history: SafariHistoryEntry[];
}

export type MenuItem = {
  label?: string;
  kbd?: string;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  sep?: boolean;
  head?: string;
  onSelect?: () => void;
};

export interface Conflict {
  ids: string[];
  dest: string;
  op: 'copy' | 'move';
  names: string[];
}

export interface UIState {
  spotlight: boolean;
  mission: boolean;
  control: boolean;
  notifCenter: boolean;
  launchpad: boolean;
  switcher: { ids: string[]; index: number } | null;
  quicklook: { ids: string[]; index: number } | null;
  getInfo: string | null;
  conflict: Conflict | null;
  renameId: string | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
}

export interface WallpaperDef {
  id: string;
  name: string;
  css?: string; // css background value
  src?: string; // image url
}
