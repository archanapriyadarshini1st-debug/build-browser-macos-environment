'use client';

import type { ComponentType } from 'react';
import { useOS } from '@/os/store';
import type { Win } from '@/os/types';
import { fileCategory } from '@/os/utils';
import * as fs from '@/os/fs';
import { FinderApp } from './Finder';
import { SafariApp } from './Safari';
import { NotesApp } from './Notes';
import { TextEditApp } from './TextEdit';
import { PreviewApp } from './Preview';
import { PhotosApp } from './Photos';
import { MusicApp } from './Music';
import { CalculatorApp } from './Calculator';
import { TerminalApp } from './Terminal';
import { SettingsApp } from './SettingsApp';
import { AppStoreApp } from './AppStore';
import { ActivityApp, ClockApp, WeatherApp, MapsApp, MessagesApp, MailApp, CalendarApp, RemindersApp, StickiesApp } from './Misc';

export interface AppDef {
  id: string;
  name: string;
  component: ComponentType<{ win: Win }>;
  w: number;
  h: number;
  builtin?: boolean;
}

const R: Record<string, AppDef> = {
  finder: { id: 'finder', name: 'Finder', component: FinderApp, w: 860, h: 540, builtin: true },
  safari: { id: 'safari', name: 'Safari', component: SafariApp, w: 980, h: 640, builtin: true },
  notes: { id: 'notes', name: 'Notes', component: NotesApp, w: 860, h: 560, builtin: true },
  textedit: { id: 'textedit', name: 'TextEdit', component: TextEditApp, w: 680, h: 520, builtin: true },
  preview: { id: 'preview', name: 'Preview', component: PreviewApp, w: 760, h: 580, builtin: true },
  photos: { id: 'photos', name: 'Photos', component: PhotosApp, w: 920, h: 600, builtin: true },
  music: { id: 'music', name: 'Music', component: MusicApp, w: 900, h: 580, builtin: true },
  calculator: { id: 'calculator', name: 'Calculator', component: CalculatorApp, w: 260, h: 400, builtin: true },
  terminal: { id: 'terminal', name: 'Terminal', component: TerminalApp, w: 680, h: 440, builtin: true },
  settings: { id: 'settings', name: 'System Settings', component: SettingsApp, w: 840, h: 580, builtin: true },
  appstore: { id: 'appstore', name: 'App Store', component: AppStoreApp, w: 900, h: 600, builtin: true },
  activity: { id: 'activity', name: 'Activity Monitor', component: ActivityApp, w: 760, h: 520, builtin: true },
  clock: { id: 'clock', name: 'Clock', component: ClockApp, w: 520, h: 420 },
  weather: { id: 'weather', name: 'Weather', component: WeatherApp, w: 560, h: 460 },
  maps: { id: 'maps', name: 'Maps', component: MapsApp, w: 900, h: 600 },
  messages: { id: 'messages', name: 'Messages', component: MessagesApp, w: 760, h: 520 },
  mail: { id: 'mail', name: 'Mail', component: MailApp, w: 860, h: 560 },
  calendar: { id: 'calendar', name: 'Calendar', component: CalendarApp, w: 860, h: 580 },
  reminders: { id: 'reminders', name: 'Reminders', component: RemindersApp, w: 720, h: 520 },
  stickies: { id: 'stickies', name: 'Stickies', component: StickiesApp, w: 320, h: 340 },
};

export function getApp(id: string): AppDef | undefined {
  return R[id];
}

export function allApps(): AppDef[] {
  return Object.values(R);
}

let cascade = 0;

export function openApp(appId: string, props?: Record<string, unknown>) {
  const def = R[appId];
  const os = useOS.getState();
  if (!def) {
    os.notify('system', 'Not installed', `“${appId}” is available in the App Store.`);
    return;
  }
  if (!os.installed.includes(appId)) {
    os.notify('system', 'Not installed', `Install “${def.name}” from the App Store to use it.`);
    openApp('appstore', { q: def.name });
    return;
  }
  // single-instance apps focus existing window unless props request a new one
  const existing = Object.values(os.windows).filter((w) => w.appId === appId && !props);
  if (existing.length && !props) {
    const top = existing.sort((a, b) => b.z - a.z)[0];
    os.focusWin(top.id);
    if (top.space !== os.activeSpace) os.setActiveSpace(top.space);
    return;
  }
  // reopen a minimized instance
  const min = existing.find((w) => w.minimized);
  if (min && !props) {
    os.focusWin(min.id);
    return;
  }
  const id = crypto.randomUUID();
  const z = os.zTop + 1;
  cascade = (cascade + 1) % 8;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const w = Math.min(def.w, W - 40);
  const h = Math.min(def.h, H - 80);
  const win: Win = {
    id, appId, title: def.name,
    x: Math.max(12, Math.floor((W - w) / 2) - 120 + cascade * 28),
    y: Math.max(38, Math.floor((H - h) / 2) - 40 + cascade * 22),
    w, h, z, minimized: false, maximized: false, fullscreen: false,
    space: os.activeSpace, props,
  };
  os.addWin(win);
  useOS.setState((s) => ({ ui: { ...s.ui, launchpad: false, mission: false, spotlight: false, switcher: null } }));
}

export function openFileById(id: string) {
  const node = fs.get(id);
  if (!node) return;
  const target = node.kind === 'alias' ? fs.resolveAlias(node) : node;
  if (!target) {
    useOS.getState().notify('system', 'Broken alias', 'The original item has been deleted.');
    return;
  }
  if (target.kind === 'folder') {
    openApp('finder', { path: target.id });
    return;
  }
  const cat = fileCategory(target);
  if (cat === 'text' || cat === 'code') openApp('textedit', { fileId: target.id });
  else if (cat === 'image' || cat === 'pdf' || cat === 'video') openApp('preview', { fileId: target.id });
  else if (cat === 'audio') openApp('music', { fileId: target.id });
  else quickLook([target.id], 0);
}

export function quickLook(ids: string[], index: number) {
  useOS.getState().uiPatch({ quicklook: { ids, index } });
}
