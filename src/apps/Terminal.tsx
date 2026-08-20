'use client';

import { useEffect, useRef, useState } from 'react';
import type { Win } from '@/os/types';
import * as fs from '@/os/fs';
import { useOS } from '@/os/store';
import { fmtBytes, fmtDateTime } from '@/os/utils';
import { openFileById } from './registry';

interface Line { text: string; kind?: 'in' | 'out' | 'err' }

const HELP = `browser-mac zsh — available commands:
  ls [-la] [path]     list items          cd <path>        change directory
  pwd                 print path          cat <file>       show text content
  mkdir <name>        create folder       touch <name>     create empty file
  rm [-r] <name>      move to trash       open <name>      open item
  mv <a> <b>          move/rename         cp <a> <b>       copy
  echo <text> > file  write text          tree             show folder tree
  tags                list tags           tag <f> <tag>    add tag
  date / whoami / uname / df              system info
  clear / help`;

export function TerminalApp({ win }: { win: Win }) {
  const [lines, setLines] = useState<Line[]>([{ text: 'Last login: ' + new Date().toDateString() + ' on ttys000' }, { text: 'Type “help” for available commands.' }]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState(fs.DESKTOP);
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lines]);

  const pathStr = (id: string) => {
    const parts = fs.pathOf(id).map((n) => n.name);
    return '/' + parts.slice(1).join('/');
  };

  const resolve = (p: string): string | null => {
    if (!p) return cwd;
    let parts: string[];
    if (p.startsWith('/') || p === '~') parts = p.replace(/^~?\/?/, '').split('/').filter(Boolean);
    else parts = [...fs.pathOf(cwd).map((n) => n.name).slice(1), ...p.split('/').filter(Boolean)];
    let cur: string = fs.ROOT;
    if (parts.length === 0) return fs.ROOT;
    for (const seg of parts) {
      if (seg === '.') continue;
      if (seg === '..') {
        const node = fs.get(cur);
        cur = node?.parent ?? fs.ROOT;
        continue;
      }
      const match = fs.childrenOf(cur).find((n) => n.name === seg || n.name.toLowerCase() === seg.toLowerCase());
      if (!match) return null;
      cur = match.id;
    }
    return cur;
  };

  const run = (raw: string) => {
    const cmdLine = raw.trim();
    const echo: Line[] = [{ text: `guest@browser-mac ${pathStr(cwd)} % ${raw}`, kind: 'in' }];
    const out = (t: string, kind?: Line['kind']) => echo.push({ text: t, kind: kind ?? 'out' });
    if (cmdLine) setHist((h) => [cmdLine, ...h].slice(0, 60));

    if (!cmdLine) { setLines((l) => [...l, ...echo]); return; }

    // echo > redirect
    const redir = cmdLine.match(/^echo\s+(.*)\s*>\s*(.+)$/);
    if (redir) {
      const target = resolve(redir[2].trim());
      if (target && fs.get(target)?.kind === 'file') {
        fs.writeText(target, redir[1]);
      } else {
        fs.createTextFile(cwd, redir[2].trim().split('/').pop() ?? 'file.txt', redir[1]);
      }
      setLines((l) => [...l, ...echo]);
      return;
    }

    const [cmd, ...args] = cmdLine.split(/\s+/);
    const arg = args[0];
    switch (cmd) {
      case 'help': out(HELP); break;
      case 'clear': setLines([]); setInput(''); return;
      case 'pwd': out(pathStr(cwd)); break;
      case 'whoami': out('guest'); break;
      case 'date': out(new Date().toString()); break;
      case 'uname': out('BrowserMac Darwin 26.0 arm64 (simulated kernel)'); break;
      case 'df': {
        out('Filesystem      Size   Used  Avail  Mounted on');
        out(`browserfs       8.0G   ${fmtBytes(0).padStart(5)}  8.0G   /  (browser storage — see System Settings › About)`);
        break;
      }
      case 'ls': {
        const target = args.find((a) => !a.startsWith('-')) ? resolve(args.find((a) => !a.startsWith('-'))!) : cwd;
        if (!target) { out(`ls: ${arg}: No such file or directory`, 'err'); break; }
        const node = fs.get(target);
        if (node?.kind === 'file') { out(node.name); break; }
        const la = args.includes('-la') || args.includes('-l');
        const kids = fs.sortNodes(fs.childrenOf(target));
        if (la) {
          for (const k of kids) out(`${k.kind === 'folder' ? 'd' : '-'}rw-r--r--  guest  staff  ${String(k.size ?? 4096).padStart(8)}  ${fmtDateTime(k.modifiedAt)}  ${k.name}${k.kind === 'folder' ? '/' : ''}`);
        } else {
          out(kids.map((k) => k.name + (k.kind === 'folder' ? '/' : '')).join('   ') || '(empty)');
        }
        break;
      }
      case 'cd': {
        if (!arg) { setCwd(fs.DESKTOP); break; }
        const t = resolve(arg);
        if (!t) out(`cd: no such file or directory: ${arg}`, 'err');
        else if (fs.get(t)?.kind !== 'folder') out(`cd: not a directory: ${arg}`, 'err');
        else setCwd(t);
        break;
      }
      case 'cat': {
        const t = arg ? resolve(arg) : null;
        const n = t ? fs.get(t) : null;
        if (!n || n.kind !== 'file') { out(`cat: ${arg}: No such file`, 'err'); break; }
        if (n.text != null) n.text.split('\n').forEach((x) => out(x));
        else out(`(binary or large file — ${fmtBytes(n.size)}, use Quick Look)`, 'err');
        break;
      }
      case 'mkdir': {
        if (!arg) { out('usage: mkdir <name>', 'err'); break; }
        fs.createFolder(cwd, arg);
        break;
      }
      case 'touch': {
        if (!arg) { out('usage: touch <name>', 'err'); break; }
        fs.createTextFile(cwd, arg, '');
        break;
      }
      case 'rm': {
        const recursive = args.includes('-r') || args.includes('-rf');
        const name = args.find((a) => !a.startsWith('-'));
        const t = name ? resolve(name) : null;
        const n = t ? fs.get(t) : null;
        if (!n) { out(`rm: ${name}: No such file or directory`, 'err'); break; }
        if (n.kind === 'folder' && !recursive) { out(`rm: ${name}: is a directory (use -r)`, 'err'); break; }
        fs.trash([n.id]);
        out(`moved to Trash: ${n.name}`);
        break;
      }
      case 'open': {
        const t = arg ? resolve(arg) : null;
        if (!t) { out(`open: ${arg}: not found`, 'err'); break; }
        openFileById(t);
        break;
      }
      case 'mv': {
        const src = args[0] ? resolve(args[0]) : null;
        if (!src) { out(`mv: ${args[0]}: not found`, 'err'); break; }
        const destName = args[1];
        const destDir = destName?.includes('/') ? resolve(destName.split('/').slice(0, -1).join('/') || '/') : cwd;
        if (destDir && fs.get(destDir)?.kind === 'folder') {
          fs.requestTransfer('move', [src], destDir);
          if (destName && !destName.includes('/')) fs.rename(src, destName);
        } else out('mv: invalid destination', 'err');
        break;
      }
      case 'cp': {
        const src = args[0] ? resolve(args[0]) : null;
        if (!src) { out(`cp: ${args[0]}: not found`, 'err'); break; }
        fs.requestTransfer('copy', [src], cwd);
        break;
      }
      case 'tree': {
        const walk = (id: string, prefix: string) => {
          const kids = fs.sortNodes(fs.childrenOf(id));
          kids.forEach((k, i) => {
            const last = i === kids.length - 1;
            out(`${prefix}${last ? '└── ' : '├── '}${k.name}${k.kind === 'folder' ? '/' : ''}`);
            if (k.kind === 'folder') walk(k.id, prefix + (last ? '    ' : '│   '));
          });
        };
        out(fs.get(cwd)?.name ?? '/');
        walk(cwd, '');
        break;
      }
      case 'tags': out(useOS.getState().tags.map((t) => `${t.name} (${t.color})`).join('\n')); break;
      case 'tag': {
        const t = args[0] ? resolve(args[0]) : null;
        const tag = useOS.getState().tags.find((x) => x.name.toLowerCase() === (args[1] ?? '').toLowerCase());
        if (!t || !tag) { out('usage: tag <file> <tagname>', 'err'); break; }
        fs.toggleTag(t, tag.id);
        break;
      }
      case 'history': hist.slice(0, 15).forEach((h, i) => out(`${i + 1}  ${h}`)); break;
      default: out(`zsh: command not found: ${cmd}`, 'err');
    }
    setLines((l) => [...l, ...echo]);
  };

  return (
    <div className="terminal flex h-full flex-col font-mono text-[12.5px] leading-[1.5]" onClick={() => inRef.current?.focus()}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.map((l, i) => (
          <div key={i} className={l.kind === 'in' ? 'text-[#8be98b]' : l.kind === 'err' ? 'text-[#ff7a6e]' : 'text-[#d8dee6]'} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {l.text}
          </div>
        ))}
        <div className="flex items-center gap-2 text-[#8be98b]">
          <span className="shrink-0">guest@browser-mac {pathStr(cwd)} %</span>
          <input
            ref={inRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { run(input); setInput(''); setHi(-1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(hi + 1, hist.length - 1); if (hist[n] != null) { setHi(n); setInput(hist[n]); } }
              else if (e.key === 'ArrowDown') { e.preventDefault(); const n = hi - 1; setHi(Math.max(-1, n)); setInput(n >= 0 ? hist[n] : ''); }
            }}
            className="flex-1 bg-transparent text-[#e8eef4] caret-[#8be98b] outline-none"
            aria-label="Terminal input"
            spellCheck={false}
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}
