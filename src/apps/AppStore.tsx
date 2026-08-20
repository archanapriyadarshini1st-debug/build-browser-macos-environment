'use client';

import { useState } from 'react';
import { useOS, STORE_APPS } from '@/os/store';
import type { Win } from '@/os/types';
import { AppIcon } from '@/components/icons';
import { cn } from '@/os/utils';

export function AppStoreApp({ win }: { win: Win }) {
  const installed = useOS((s) => s.installed);
  const os = useOS.getState();
  const [tab, setTab] = useState<string>((win.props?.q as string) ? 'search' : 'discover');
  const [q, setQ] = useState((win.props?.q as string) ?? '');

  const list = STORE_APPS.filter((a) => tab === 'installed' ? installed.includes(a.id) : tab === 'search' ? a.name.toLowerCase().includes(q.toLowerCase()) || a.category.toLowerCase().includes(q.toLowerCase()) : true);
  const featured = STORE_APPS.find((a) => a.id === 'maps') ?? STORE_APPS[0];

  const install = (id: string, name: string) => {
    os.installApp(id);
    os.notify('appstore', 'Installed', `${name} was added to Launchpad and Spotlight.`);
  };

  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <div className="w-[180px] shrink-0 border-r border-black/10 p-2 text-[13px] dark:border-white/10">
        {[['discover', 'Discover'], ['search', 'Search'], ['installed', 'Installed']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left', tab === id ? 'bg-[var(--accent)]/20 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/8')}>
            {label}{id === 'installed' && <span className="ml-auto rounded-full bg-black/10 px-1.5 text-[10px] dark:bg-white/15">{installed.filter((i) => STORE_APPS.some((a) => a.id === i)).length}</span>}
          </button>
        ))}
        <div className="mt-4 px-2 text-[11px] leading-relaxed opacity-50">Installing here really adds the app to Launchpad, Spotlight and the Dock menu.</div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        {tab === 'discover' && (
          <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1f6feb] to-[#0b3d91] p-6 text-white">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">Featured</div>
            <div className="mt-1 text-[22px] font-extrabold">{featured.name}</div>
            <div className="mb-4 max-w-[380px] text-[13px] opacity-80">{featured.desc}</div>
            <InstallBtn id={featured.id} name={featured.name} installed={installed.includes(featured.id)} onInstall={install} />
          </div>
        )}
        {tab === 'search' && (
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps and categories" aria-label="Search App Store" className="mb-4 w-full max-w-[420px] rounded-lg bg-black/6 px-3 py-2 text-[13px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10" />
        )}
        <h3 className="mb-3 text-[15px] font-bold">{tab === 'installed' ? 'Your Apps' : tab === 'search' ? `Results for “${q}”` : 'Essential Picks'}</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-black/4 p-3 dark:bg-white/6">
              <AppIcon appId={a.id} size={46} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{a.name}</div>
                <div className="text-[11px] opacity-55">{a.category} · {a.desc}</div>
              </div>
              <InstallBtn id={a.id} name={a.name} installed={installed.includes(a.id)} onInstall={install} />
            </div>
          ))}
          {!list.length && <div className="opacity-45">Nothing found.</div>}
        </div>
      </div>
    </div>
  );
}

function InstallBtn({ id, name, installed, onInstall }: { id: string; name: string; installed: boolean; onInstall: (id: string, name: string) => void }) {
  const os = useOS.getState();
  const [confirming, setConfirming] = useState(false);
  if (!installed) {
    return <button className="mac-btn-primary shrink-0" onClick={() => onInstall(id, name)}>Get</button>;
  }
  return confirming ? (
    <div className="flex shrink-0 gap-1">
      <button className="mac-btn text-[#ff453a]" onClick={() => { os.uninstallApp(id); os.notify('appstore', 'Removed', `${name} was uninstalled.`); setConfirming(false); }}>Remove</button>
      <button className="mac-btn" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  ) : (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-[11.5px] font-semibold text-[var(--accent)]">Installed ✓</span>
      <button className="mac-btn text-[11px]" onClick={() => setConfirming(true)}>…</button>
    </div>
  );
}
