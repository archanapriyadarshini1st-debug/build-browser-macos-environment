'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import type { Win } from '@/os/types';
import { cn, uid } from '@/os/utils';

interface Tab {
  id: string;
  url: string; // '' = start page
  hist: string[];
  hi: number;
  priv?: boolean;
}

const START_LINKS = [
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html?bbox=-0.16,51.49,-0.07,51.53&layer=mapnik' },
  { title: 'Example Domain', url: 'https://example.com' },
  { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { title: 'Internet Archive', url: 'https://archive.org' },
];

export function SafariApp({ win }: { win: Win }) {
  const safari = useOS((s) => s.safari);
  const prefs = useOS((s) => s.prefs);
  const os = useOS.getState();
  const [tabs, setTabs] = useState<Tab[]>([{ id: uid(), url: '', hist: [''], hi: 0 }]);
  const [active, setActive] = useState(tabs[0].id);
  const [inputVal, setInputVal] = useState('');
  const [panel, setPanel] = useState<'none' | 'bookmarks' | 'history' | 'reading'>('none');
  const [timedOut, setTimedOut] = useState<Record<string, boolean>>({});
  const loadTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    setInputVal(tab.url);
    setTimedOut((m) => ({ ...m, [tab.id]: false }));
  }, [active, tab.url]);

  useEffect(() => {
    useOS.getState().setWin(win.id, { title: tab.url ? shortHost(tab.url) : 'Safari' });
  }, [tab.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchTab = (id: string, p: Partial<Tab>) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const navigate = (raw: string) => {
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = url.includes('.') && !url.includes(' ') ? `https://${url}` : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(url)}`;
    }
    const hist = [...tab.hist.slice(0, tab.hi + 1), url];
    patchTab(tab.id, { url, hist, hi: hist.length - 1 });
    if (!tab.priv) {
      os.safariPatch({ history: [{ id: uid(), url, title: shortHost(url), time: Date.now() }, ...safari.history].slice(0, 100) });
    }
    clearTimeout(loadTimer.current[tab.id]);
    loadTimer.current[tab.id] = setTimeout(() => setTimedOut((m) => ({ ...m, [tab.id]: true })), 9000);
  };

  const go = (dir: 1 | -1) => {
    const ni = tab.hi + dir;
    if (ni < 0 || ni >= tab.hist.length) return;
    patchTab(tab.id, { hi: ni, url: tab.hist[ni] });
  };

  const newTab = (url = '', priv = false) => {
    const t: Tab = { id: uid(), url, hist: [url], hi: 0, priv };
    setTabs((ts) => [...ts, t]);
    setActive(t.id);
    setPanel('none');
  };

  const closeTab = (id: string) => {
    setTabs((ts) => {
      const rest = ts.filter((t) => t.id !== id);
      if (!rest.length) {
        const t: Tab = { id: uid(), url: '', hist: [''], hi: 0 };
        setActive(t.id);
        return [t];
      }
      if (id === active) setActive(rest[rest.length - 1].id);
      return rest;
    });
  };

  const shortHost = (u: string) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u; } };

  const isBookmarked = safari.bookmarks.some((b) => b.url === tab.url);

  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      {/* tab strip */}
      <div className="flex items-end gap-1 border-b border-black/10 px-2 pt-1.5 dark:border-white/10">
        {tabs.map((t) => (
          <div key={t.id} className={cn('group flex min-w-0 max-w-[180px] flex-1 cursor-default items-center gap-1.5 rounded-t-lg px-2.5 py-[5px] text-[12px]', t.id === active ? 'bg-[var(--win-bg)] shadow-[0_-1px_2px_rgba(0,0,0,.08)]' : 'bg-black/5 hover:bg-black/8 dark:bg-white/5 dark:hover:bg-white/8')} onClick={() => setActive(t.id)}>
            {t.priv && <span title="Private tab">🕶</span>}
            <span className="truncate">{t.url ? shortHost(t.url) : 'Start Page'}</span>
            <button className="ml-auto rounded px-1 opacity-0 hover:bg-black/10 group-hover:opacity-60 dark:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }} aria-label="Close tab">✕</button>
          </div>
        ))}
        <button className="mb-1 rounded px-2 py-0.5 hover:bg-black/8 dark:hover:bg-white/10" onClick={() => newTab()} aria-label="New tab">＋</button>
        <button className="mb-1 rounded px-2 py-0.5 hover:bg-black/8 dark:hover:bg-white/10" onClick={() => newTab('', true)} aria-label="New private tab" title="New Private Tab">🕶</button>
      </div>

      {/* toolbar */}
      <div className="flex h-[42px] items-center gap-1.5 border-b border-black/10 px-2 dark:border-white/10">
        <button className="mac-btn" disabled={tab.hi <= 0} onClick={() => go(-1)} aria-label="Back">‹</button>
        <button className="mac-btn" disabled={tab.hi >= tab.hist.length - 1} onClick={() => go(1)} aria-label="Forward">›</button>
        <button className="mac-btn" onClick={() => { if (tab.url) navigate(tab.url); }} aria-label="Reload">↻</button>
        <form className="min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); navigate(inputVal); }}>
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Search or enter website name"
            aria-label="Address field"
            className="w-full rounded-lg bg-black/6 px-3 py-[5px] text-center text-[12.5px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10"
          />
        </form>
        <button className="mac-btn" title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'} onClick={() => {
          if (!tab.url) return;
          os.safariPatch({ bookmarks: isBookmarked ? safari.bookmarks.filter((b) => b.url !== tab.url) : [...safari.bookmarks, { id: uid(), url: tab.url, title: shortHost(tab.url) }] });
        }}>{isBookmarked ? '★' : '☆'}</button>
        <button className="mac-btn" title="Reading List" onClick={() => {
          if (!tab.url) { setPanel(panel === 'reading' ? 'none' : 'reading'); return; }
          if (!safari.readingList.some((r) => r.url === tab.url)) os.safariPatch({ readingList: [...safari.readingList, { id: uid(), url: tab.url, title: shortHost(tab.url) }] });
          os.notify('safari', 'Added to Reading List', shortHost(tab.url));
        }}>👓</button>
        <button className={cn('mac-btn', panel === 'bookmarks' && 'ring-1 ring-[var(--accent)]')} onClick={() => setPanel(panel === 'bookmarks' ? 'none' : 'bookmarks')} aria-label="Bookmarks">📑</button>
        <button className={cn('mac-btn', panel === 'history' && 'ring-1 ring-[var(--accent)]')} onClick={() => setPanel(panel === 'history' ? 'none' : 'history')} aria-label="History">🕘</button>
        <button className="mac-btn" onClick={() => { const id = fs2CreateShare(tab.url); void id; }} title="Share / Handoff" aria-label="Share">⇪</button>
      </div>

      {/* bookmarks bar */}
      {safari.bookmarks.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-black/8 px-2 py-1 text-[11.5px] dark:border-white/8">
          {safari.bookmarks.slice(0, 10).map((b) => (
            <button key={b.id} className="whitespace-nowrap rounded px-1.5 py-0.5 hover:bg-black/8 dark:hover:bg-white/10" onClick={() => navigate(b.url)} onContextMenu={(e) => { e.preventDefault(); os.safariPatch({ bookmarks: safari.bookmarks.filter((x) => x.id !== b.id) }); }}>
              {b.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {panel !== 'none' && (
          <div className="w-[260px] shrink-0 overflow-y-auto border-r border-black/10 p-2 text-[12.5px] dark:border-white/10">
            {panel === 'bookmarks' && (
              <>
                <SideTitle>Bookmarks</SideTitle>
                {safari.bookmarks.map((b) => (
                  <PanelRow key={b.id} onClick={() => navigate(b.url)} title={b.title} sub={shortHost(b.url)} />
                ))}
                {!safari.bookmarks.length && <Empty>No bookmarks yet — press ☆ while browsing.</Empty>}
              </>
            )}
            {panel === 'reading' && (
              <>
                <SideTitle>Reading List</SideTitle>
                {safari.readingList.map((b) => (
                  <PanelRow key={b.id} onClick={() => navigate(b.url)} title={b.title} sub={shortHost(b.url)} onClose={() => os.safariPatch({ readingList: safari.readingList.filter((x) => x.id !== b.id) })} />
                ))}
                {!safari.readingList.length && <Empty>Save pages to read later with 👓.</Empty>}
              </>
            )}
            {panel === 'history' && (
              <>
                <SideTitle>History {tab.priv && '(paused in private tabs)'}</SideTitle>
                {safari.history.map((h) => (
                  <PanelRow key={h.id} onClick={() => navigate(h.url)} title={h.title} sub={new Date(h.time).toLocaleTimeString()} />
                ))}
                <button className="mac-btn mt-2" onClick={() => os.safariPatch({ history: [] })}>Clear History</button>
              </>
            )}
          </div>
        )}

        {/* start page */}
        {!tab.url ? (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="mb-5 text-[20px] font-bold">Favorites</h2>
            <div className="mb-8 flex flex-wrap gap-4">
              {START_LINKS.map((l) => (
                <button key={l.url} onClick={() => navigate(l.url)} className="flex w-[92px] flex-col items-center gap-2 rounded-xl p-3 hover:bg-black/6 dark:hover:bg-white/8">
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-gradient-to-b from-[var(--accent)] to-[#0a5fd6] text-[20px] font-bold text-white">{l.title[0]}</div>
                  <span className="text-center text-[11.5px]">{l.title}</span>
                </button>
              ))}
              {safari.bookmarks.slice(0, 6).map((b) => (
                <button key={b.id} onClick={() => navigate(b.url)} className="flex w-[92px] flex-col items-center gap-2 rounded-xl p-3 hover:bg-black/6 dark:hover:bg-white/8">
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-black/10 text-[20px] font-bold dark:bg-white/10">{b.title[0]}</div>
                  <span className="max-w-full truncate text-[11.5px]">{b.title}</span>
                </button>
              ))}
            </div>
            <h3 className="mb-2 text-[15px] font-bold">Privacy Report</h3>
            <p className="max-w-[420px] text-[12.5px] opacity-60">Safari runs pages in a sandboxed frame. Some websites refuse to be embedded — when that happens you&apos;ll get a clear explanation and a button to open them in a real tab. Nothing leaves your device except the page requests themselves.</p>
          </div>
        ) : (
          <div className="relative min-w-0 flex-1 bg-white">
            <iframe
              key={tab.id + tab.url}
              src={tab.url}
              title="Web content"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              onLoad={() => clearTimeout(loadTimer.current[tab.id])}
            />
            {timedOut[tab.id] && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="dialog max-w-[380px] rounded-xl p-5 text-[13px]">
                  <div className="mb-2 text-[15px] font-bold">This site may block embedding</div>
                  <p className="mb-3 opacity-70">“{shortHost(tab.url)}” didn&apos;t finish loading in the frame. Many sites (news, banks, Google) refuse to run inside other apps for security reasons.</p>
                  <div className="flex gap-2">
                    <button className="mac-btn-primary" onClick={() => window.open(tab.url, '_blank', 'noopener')}>Open in New Tab</button>
                    <button className="mac-btn" onClick={() => setTimedOut((m) => ({ ...m, [tab.id]: false }))}>Keep Waiting</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex h-[22px] items-center justify-between border-t border-black/8 px-3 text-[10.5px] opacity-50 dark:border-white/8">
        <span>{prefs.wifi ? 'Online — BrowserNet (simulated Wi-Fi)' : 'Wi-Fi is off'}</span>
        <span>{tabs.length} tab{tabs.length > 1 ? 's' : ''}{tab.priv ? ' · Private' : ''}</span>
      </div>
    </div>
  );
}

function fs2CreateShare(url: string) {
  const os = useOS.getState();
  if (navigator.share) {
    navigator.share({ title: 'Safari Handoff', url }).catch(() => undefined);
  } else {
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    os.notify('safari', 'Handoff', 'Link copied to the universal clipboard.');
  }
  return 'shared';
}

function SideTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-wide opacity-50">{children}</div>;
}

function PanelRow({ title, sub, onClick, onClose }: { title: string; sub: string; onClick: () => void; onClose?: () => void }) {
  return (
    <div className="group flex items-center gap-1">
      <button className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-black/6 dark:hover:bg-white/8" onClick={onClick}>
        <div className="truncate text-[12.5px]">{title}</div>
        <div className="truncate text-[11px] opacity-50">{sub}</div>
      </button>
      {onClose && <button className="rounded px-1 opacity-0 hover:bg-black/10 group-hover:opacity-60 dark:hover:bg-white/10" onClick={onClose} aria-label="Remove">✕</button>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 text-[12px] opacity-45">{children}</div>;
}
