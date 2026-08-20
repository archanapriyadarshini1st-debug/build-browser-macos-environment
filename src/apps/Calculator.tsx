'use client';

import { useEffect, useState } from 'react';
import type { Win } from '@/os/types';
import { cn } from '@/os/utils';

export function CalculatorApp(_: { win: Win }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [hist, setHist] = useState<string[]>([]);

  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return 'Error';
    const s = Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toExponential(6) : String(Math.round(n * 1e10) / 1e10);
    return s.length > 12 ? n.toPrecision(9) : s;
  };

  const input = (d: string) => {
    if (fresh) { setDisplay(d === '.' ? '0.' : d); setFresh(false); return; }
    if (d === '.' && display.includes('.')) return;
    if (display.replace('-', '').length >= 12) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };

  const calc = (a: number, b: number, o: string) => {
    switch (o) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const doOp = (next: string) => {
    const cur = parseFloat(display);
    if (acc != null && op && !fresh) {
      const r = calc(acc, cur, op);
      setAcc(r);
      setDisplay(fmt(r));
      setHist((h) => [`${fmt(acc)} ${op} ${fmt(cur)} = ${fmt(r)}`, ...h].slice(0, 8));
    } else {
      setAcc(cur);
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => {
    if (acc == null || !op) return;
    const cur = parseFloat(display);
    const r = calc(acc, cur, op);
    setHist((h) => [`${fmt(acc)} ${op} ${fmt(cur)} = ${fmt(r)}`, ...h].slice(0, 8));
    setDisplay(fmt(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  const clear = () => { setDisplay('0'); setAcc(null); setOp(null); setFresh(true); };
  const neg = () => setDisplay(display.startsWith('-') ? display.slice(1) : display === '0' ? '0' : '-' + display);
  const pct = () => setDisplay(fmt(parseFloat(display) / 100));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') input(e.key);
      else if (e.key === '.') input('.');
      else if (e.key === '+') doOp('+');
      else if (e.key === '-') doOp('−');
      else if (e.key === '*') doOp('×');
      else if (e.key === '/') { e.preventDefault(); doOp('÷'); }
      else if (e.key === 'Enter' || e.key === '=') equals();
      else if (e.key === 'Escape') clear();
      else if (e.key === '%') pct();
      else if (e.key === 'Backspace') setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const B = ({ label, onClick, kind = 'num', span }: { label: string; onClick: () => void; kind?: 'num' | 'fn' | 'op'; span?: boolean }) => (
    <button
      onClick={onClick}
      className={cn(
        'h-[52px] rounded-full text-[19px] font-medium transition-all active:brightness-125',
        kind === 'num' && 'bg-[#5a5e66] text-white hover:bg-[#6a6e76]',
        kind === 'fn' && 'bg-[#3f434a] text-white hover:bg-[#4d515a]',
        kind === 'op' && 'bg-[#ff9f0a] text-white hover:bg-[#ffb340]',
        span && 'col-span-2',
        op === label && kind === 'op' && 'ring-2 ring-white/70',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-[#2a2c30] p-3">
      <div className="mb-1 flex-1 overflow-y-auto text-right font-mono text-[11px] leading-4 text-white/35">
        {hist.map((h, i) => <div key={i}>{h}</div>)}
      </div>
      <div className="mb-2 truncate text-right text-[44px] font-light text-white" aria-live="polite">{display}</div>
      <div className="grid grid-cols-4 gap-2">
        <B label={display === '0' && acc == null ? 'AC' : 'C'} kind="fn" onClick={clear} />
        <B label="±" kind="fn" onClick={neg} />
        <B label="%" kind="fn" onClick={pct} />
        <B label="÷" kind="op" onClick={() => doOp('÷')} />
        <B label="7" onClick={() => input('7')} /><B label="8" onClick={() => input('8')} /><B label="9" onClick={() => input('9')} />
        <B label="×" kind="op" onClick={() => doOp('×')} />
        <B label="4" onClick={() => input('4')} /><B label="5" onClick={() => input('5')} /><B label="6" onClick={() => input('6')} />
        <B label="−" kind="op" onClick={() => doOp('−')} />
        <B label="1" onClick={() => input('1')} /><B label="2" onClick={() => input('2')} /><B label="3" onClick={() => input('3')} />
        <B label="+" kind="op" onClick={() => doOp('+')} />
        <B label="0" span onClick={() => input('0')} /><B label="." onClick={() => input('.')} />
        <B label="=" kind="op" onClick={equals} />
      </div>
    </div>
  );
}
