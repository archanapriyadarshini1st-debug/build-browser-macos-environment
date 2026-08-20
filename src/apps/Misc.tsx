'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS } from '@/os/store';
import type { Win } from '@/os/types';
import { cn, uid, fmtClock } from '@/os/utils';

function useLocalJSON<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : init; } catch { return init; }
  });
  const set = (nv: T | ((p: T) => T)) => {
    setV((prev) => {
      const next = typeof nv === 'function' ? (nv as (p: T) => T)(prev) : nv;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };
  return [v, set];
}

// ---------- Activity Monitor ----------
export function ActivityApp(_: { win: Win }) {
  const windows = useOS((s) => s.windows);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1600); return () => clearInterval(t); }, []);
  const procs = useMemo(() => {
    const base = [
      { name: 'kernel_task (sim)', cpu: 4 + (tick % 3), mem: '412 MB' },
      { name: 'WindowServer', cpu: 6 + ((tick * 2) % 5), mem: '288 MB' },
      { name: 'spotlightd', cpu: 1, mem: '64 MB' },
      { name: 'dock', cpu: 2, mem: '92 MB' },
    ];
    const winProcs = Object.values(windows).map((w) => ({ name: `${w.appId} (${w.title.slice(0, 18)})`, cpu: 3 + ((tick + w.id.length) % 9), mem: `${120 + (w.id.charCodeAt(0) % 200)} MB` }));
    return [...base, ...winProcs];
  }, [windows, tick]);
  const total = procs.reduce((a, p) => a + p.cpu, 0);
  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <div className="text-[13px] font-bold">CPU Usage — {total}%</div>
        <div className="mt-2 flex h-[36px] items-end gap-[3px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="w-[7px] rounded-sm bg-[var(--accent)]/70" style={{ height: `${18 + ((tick * 7 + i * 13) % 70)}%` }} />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto text-[12.5px]">
        <table className="w-full">
          <thead><tr className="sticky top-0 bg-[var(--win-bg)] text-left opacity-60"><th className="px-3 py-1 font-medium">Process</th><th className="px-2 py-1 font-medium">CPU %</th><th className="px-2 py-1 font-medium">Memory</th></tr></thead>
          <tbody>
            {procs.map((p, i) => (
              <tr key={i} className="border-b border-black/4 dark:border-white/5">
                <td className="px-3 py-[4px]">{p.name}</td>
                <td className="px-2 py-[4px]">{p.cpu}</td>
                <td className="px-2 py-[4px] opacity-70">{p.mem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Clock ----------
export function ClockApp(_: { win: Win }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const cities: Array<[string, number]> = [['Local', 0], ['New York', -5], ['London', 0], ['Tokyo', 9], ['Sydney', 10]];
  const off = -now.getTimezoneOffset() / 60;
  return (
    <div className="flex h-full flex-col items-center bg-[var(--win-bg)] p-4">
      <AnalogClock date={now} size={130} />
      <div className="mt-1 text-[18px] font-bold tabular-nums">{now.toLocaleTimeString()}</div>
      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        {cities.map(([c, d]) => {
          const t = new Date(now.getTime() + (d - off) * 3600_000);
          return (
            <div key={c} className="rounded-xl bg-black/4 p-3 dark:bg-white/6">
              <div className="text-[12px] opacity-60">{c}</div>
              <div className="text-[17px] font-bold tabular-nums">{t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalogClock({ date, size }: { date: Date; size: number }) {
  const s = date.getSeconds() * 6;
  const m = date.getMinutes() * 6 + date.getSeconds() * 0.1;
  const h = (date.getHours() % 12) * 30 + date.getMinutes() * 0.5;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <circle cx="50" cy="50" r="48" fill="#111" stroke="#444" strokeWidth="2" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1="50" y1="6" x2="50" y2="11" stroke="#ddd" strokeWidth={i % 3 === 0 ? 2.4 : 1.2} transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="26" stroke="#fff" strokeWidth="4" strokeLinecap="round" transform={`rotate(${h} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${m} 50 50)`} />
      <line x1="50" y1="55" x2="50" y2="12" stroke="#ff9500" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${s} 50 50)`} />
      <circle cx="50" cy="50" r="2.6" fill="#ff9500" />
    </svg>
  );
}

// ---------- Weather ----------
export function WeatherApp(_: { win: Win }) {
  const days = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({ d, hi: 21 + ((i * 5) % 7) - 3, lo: 12 + ((i * 3) % 5), icon: ['☀️', '⛅', '🌧', '⛅', '☀️', '🌤', '🌧'][i] })), []);
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#2d7dd2] to-[#134a86] p-5 text-white">
      <div className="text-center">
        <div className="text-[13px] opacity-80">Cupertino — simulated data</div>
        <div className="text-[54px] font-thin leading-tight">19°</div>
        <div className="text-[13px]">Partly Cloudy · H:23° L:13°</div>
      </div>
      <div className="mt-5 rounded-xl bg-white/12 p-3 backdrop-blur">
        <div className="mb-2 text-[11px] uppercase tracking-wide opacity-70">Hourly forecast</div>
        <div className="flex justify-between">
          {['Now', '1PM', '2PM', '3PM', '4PM', '5PM'].map((h, i) => (
            <div key={h} className="flex flex-col items-center gap-1 text-[12px]">
              <span className="opacity-75">{h}</span><span>{['⛅', '☀️', '☀️', '🌤', '⛅', '🌧'][i]}</span><span className="font-semibold">{19 - i + (i % 2)}°</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex-1 rounded-xl bg-white/12 p-3 backdrop-blur">
        <div className="mb-1 text-[11px] uppercase tracking-wide opacity-70">7-day forecast</div>
        {days.map((d) => (
          <div key={d.d} className="flex items-center justify-between border-b border-white/10 py-[5px] text-[13px] last:border-0">
            <span className="w-[42px]">{d.d}</span><span>{d.icon}</span>
            <div className="flex w-[120px] items-center gap-2">
              <span className="opacity-60">{d.lo}°</span>
              <div className="h-[4px] flex-1 rounded-full bg-white/20"><div className="h-full rounded-full bg-gradient-to-r from-[#7ec8ff] to-[#ffd60a]" style={{ width: `${(d.hi - d.lo) * 9}%` }} /></div>
              <span>{d.hi}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Maps ----------
export function MapsApp(_: { win: Win }) {
  const [q, setQ] = useState('');
  const [bbox, setBbox] = useState('-0.16,51.49,-0.07,51.53');
  const [place, setPlace] = useState('London');
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = (await res.json()) as Array<{ boundingbox: [string, string, string, string]; display_name: string }>;
      if (data[0]) {
        const [s, n, w, east] = data[0].boundingbox;
        setBbox(`${w},${s},${east},${n}`);
        setPlace(data[0].display_name.split(',')[0]);
      }
    } catch { /* offline */ }
  };
  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <form onSubmit={search} className="flex items-center gap-2 border-b border-black/10 p-2 dark:border-white/10">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place (OpenStreetMap)" aria-label="Search place" className="flex-1 rounded-lg bg-black/6 px-3 py-[5px] text-[12.5px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10" />
        <button className="mac-btn-primary" type="submit">Search</button>
      </form>
      <div className="relative min-h-0 flex-1">
        <iframe title="Map" className="h-full w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`} />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">📍 {place}</div>
      </div>
    </div>
  );
}

// ---------- Messages (simulation) ----------
interface Msg { id: string; from: 'me' | 'them'; text: string; time: number }
export function MessagesApp(_: { win: Win }) {
  const contacts = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'];
  const [threads, setThreads] = useLocalJSON<Record<string, Msg[]>>('bm-messages', {
    'Ada Lovelace': [{ id: '1', from: 'them', text: 'The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers.', time: Date.now() - 3600_000 }],
    'Alan Turing': [],
    'Grace Hopper': [{ id: '2', from: 'them', text: 'It\u2019s easier to ask forgiveness than permission. 😄', time: Date.now() - 7200_000 }],
  });
  const [active, setActive] = useState(contacts[0]);
  const [draft, setDraft] = useState('');
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = draft.trim();
    setThreads((t) => ({ ...t, [active]: [...(t[active] ?? []), { id: uid(), from: 'me', text, time: Date.now() }] }));
    setDraft('');
    setTimeout(() => {
      setThreads((t) => ({ ...t, [active]: [...(t[active] ?? []), { id: uid(), from: 'them', text: ['Fascinating — tell me more.', 'Noted!', 'That would make a fine theorem.', '👍'][Math.floor(Math.random() * 4)], time: Date.now() }] }));
    }, 1400);
  };
  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <div className="w-[190px] shrink-0 border-r border-black/10 p-2 dark:border-white/10">
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide opacity-45">Simulation</div>
        {contacts.map((c) => (
          <button key={c} onClick={() => setActive(c)} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left text-[13px]', active === c ? 'bg-[var(--accent)]/20 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/8')}>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-b from-[#8e9aa8] to-[#5c6672] text-[11px] text-white">{c[0]}</span>
            <span className="truncate">{c}</span>
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {(threads[active] ?? []).map((m) => (
            <div key={m.id} className={cn('max-w-[70%] rounded-2xl px-3 py-1.5 text-[13px]', m.from === 'me' ? 'ml-auto bg-[var(--accent)] text-white' : 'bg-black/8 dark:bg-white/12')}>
              {m.text}
              <div className={cn('mt-0.5 text-[9.5px]', m.from === 'me' ? 'text-white/60' : 'opacity-40')}>{fmtClock(m.time)}</div>
            </div>
          ))}
          {!threads[active]?.length && <div className="mt-10 text-center text-[12px] opacity-40">Say hello — replies are simulated locally.</div>}
        </div>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-black/10 p-2 dark:border-white/10">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="iMessage (local simulation)" aria-label="Message" className="flex-1 rounded-full bg-black/6 px-3 py-[6px] text-[13px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10" />
          <button className="mac-btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

// ---------- Mail (simulation) ----------
export function MailApp(_: { win: Win }) {
  const mails = [
    { id: 1, from: 'BrowserMac Team', subject: 'Welcome to your new Mac', body: 'This entire desktop runs in your browser.\n\nEverything you create is stored locally — files in IndexedDB, settings in localStorage. Reload anytime; your world persists.\n\n— The BrowserMac Team', time: Date.now() - 3600_000 },
    { id: 2, from: 'Spotlight', subject: 'Tip: press ⌘Space', body: 'Spotlight finds apps, files, notes and settings instantly.\n\nTry searching for "Welcome" — it reads file contents, not just names.', time: Date.now() - 7200_000 },
    { id: 3, from: 'Spaces', subject: 'You can have more than one desktop', body: 'Open Mission Control (F3), then press the + in the top-right to add a Space.\n\nDrag window cards between Spaces, or use ⌃← and ⌃→.', time: Date.now() - 86_400_000 },
  ];
  const [sel, setSel] = useState(mails[0].id);
  const m = mails.find((x) => x.id === sel)!;
  return (
    <div className="flex h-full bg-[var(--win-bg)]">
      <div className="w-[150px] shrink-0 border-r border-black/10 p-2 text-[13px] dark:border-white/10">
        {['Inbox', 'Sent', 'Drafts', 'Archive'].map((f, i) => (
          <div key={f} className={cn('mb-0.5 rounded-md px-2 py-[5px]', i === 0 ? 'bg-[var(--accent)]/20 font-semibold' : 'opacity-60')}>{f}{i === 0 && <span className="float-right">{mails.length}</span>}</div>
        ))}
        <div className="mt-4 px-2 text-[10.5px] leading-relaxed opacity-40">Local mailbox — no real mail is sent or received.</div>
      </div>
      <div className="w-[250px] shrink-0 overflow-y-auto border-r border-black/10 dark:border-white/10">
        {mails.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} className={cn('block w-full border-b border-black/5 px-3 py-2 text-left dark:border-white/5', sel === x.id ? 'bg-[var(--accent)]/20' : 'hover:bg-black/4 dark:hover:bg-white/6')}>
            <div className="text-[12.5px] font-semibold">{x.from}</div>
            <div className="truncate text-[12px]">{x.subject}</div>
            <div className="truncate text-[11px] opacity-50">{x.body.slice(0, 48)}</div>
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        <div className="text-[16px] font-bold">{m.subject}</div>
        <div className="mb-3 text-[12px] opacity-55">From {m.from} · {fmtClock(m.time)}</div>
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{m.body}</pre>
      </div>
    </div>
  );
}

// ---------- Calendar ----------
export function CalendarApp(_: { win: Win }) {
  const [events, setEvents] = useLocalJSON<Record<string, string[]>>('bm-calendar', {});
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selDay, setSelDay] = useState<string | null>(null);
  const first = new Date(cur.y, cur.m, 1);
  const days = Array.from({ length: new Date(cur.y, cur.m + 1, 0).getDate() }).map((_, i) => new Date(cur.y, cur.m, i + 1));
  const today = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)]">
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
        <button className="mac-btn" onClick={() => setCur((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))} aria-label="Previous month">‹</button>
        <div className="text-[15px] font-bold">{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
        <button className="mac-btn" onClick={() => setCur((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-black/8 text-center text-[11px] font-semibold opacity-50 dark:border-white/8">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-[repeat(auto-fill,minmax(0,1fr))]">
        {Array.from({ length: first.getDay() }).map((_, i) => <div key={`b${i}`} className="border-b border-r border-black/5 dark:border-white/5" />)}
        {days.map((d) => {
          const k = key(d);
          const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
          return (
            <button key={k} onClick={() => setSelDay(k)} className={cn('relative flex flex-col items-start border-b border-r border-black/5 p-1.5 text-left hover:bg-black/4 dark:border-white/5 dark:hover:bg-white/5', selDay === k && 'bg-[var(--accent)]/10')}>
              <span className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px]', isToday && 'bg-[#ff453a] font-bold text-white')}>{d.getDate()}</span>
              {(events[k] ?? []).slice(0, 2).map((ev, i) => <span key={i} className="mt-0.5 w-full truncate rounded bg-[var(--accent)]/25 px-1 text-[10px]">{ev}</span>)}
            </button>
          );
        })}
      </div>
      {selDay && (
        <div className="border-t border-black/10 p-2 text-[12.5px] dark:border-white/10">
          <div className="mb-1 font-semibold">Events on {selDay}</div>
          {(events[selDay] ?? []).map((ev, i) => (
            <div key={i} className="flex items-center gap-2">• {ev}<button className="text-[10px] opacity-50 hover:opacity-100" onClick={() => setEvents((e) => ({ ...e, [selDay]: (e[selDay] ?? []).filter((_, j) => j !== i) }))}>✕</button></div>
          ))}
          <button className="mac-btn mt-1" onClick={() => { const t = window.prompt('New event:'); if (t) setEvents((e) => ({ ...e, [selDay]: [...(e[selDay] ?? []), t] })); }}>+ Add Event</button>
        </div>
      )}
    </div>
  );
}

// ---------- Reminders ----------
export function RemindersApp(_: { win: Win }) {
  const [items, setItems] = useLocalJSON<Array<{ id: string; text: string; done: boolean }>>('bm-reminders', [
    { id: '1', text: 'Import a file onto the Desktop', done: false },
    { id: '2', text: 'Create a second Space', done: false },
  ]);
  const [draft, setDraft] = useState('');
  return (
    <div className="flex h-full flex-col bg-[var(--win-bg)] p-4">
      <div className="mb-3 text-[17px] font-bold text-[#ff9f0a]">Reminders</div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <label key={it.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-[6px] hover:bg-black/4 dark:hover:bg-white/6">
            <input type="checkbox" checked={it.done} onChange={() => setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, done: !x.done } : x))} className="h-[16px] w-[16px] accent-[var(--accent)]" />
            <span className={cn('text-[13.5px]', it.done && 'line-through opacity-45')}>{it.text}</span>
            <button className="ml-auto text-[11px] opacity-0 hover:opacity-60" onClick={(e) => { e.preventDefault(); setItems((arr) => arr.filter((x) => x.id !== it.id)); }}>✕</button>
          </label>
        ))}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setItems((arr) => [...arr, { id: uid(), text: draft.trim(), done: false }]); setDraft(''); } }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New reminder" aria-label="New reminder" className="flex-1 rounded-lg bg-black/6 px-3 py-[6px] text-[13px] outline-none ring-[var(--accent)] focus:ring-2 dark:bg-white/10" />
        <button className="mac-btn-primary" type="submit">Add</button>
      </form>
    </div>
  );
}

// ---------- Stickies ----------
export function StickiesApp({ win }: { win: Win }) {
  const [text, setText] = useLocalJSON<string>(`bm-sticky-${win.id}`, '');
  return (
    <div className="flex h-full flex-col bg-[#fff8c9] text-[#4a4200]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Sticky note…"
        aria-label="Sticky note"
        className="min-h-0 flex-1 resize-none bg-transparent p-4 text-[14px] leading-relaxed outline-none"
      />
      <div className="px-4 pb-2 text-[10px] opacity-40">Saved automatically · per window</div>
    </div>
  );
}
