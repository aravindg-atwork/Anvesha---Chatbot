"use client";

import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Loader2, RotateCcw, Wrench, X } from 'lucide-react';

export type ToolCallStatus = 'running' | 'success' | 'error';
export type ToolCallCardProps = {
  name: string; summary?: ReactNode; icon?: ReactNode; status: ToolCallStatus; args?: unknown; result?: unknown;
  error?: string; startedAt?: number; duration?: number; defaultOpen?: boolean; open?: boolean;
  onOpenChange?: (open: boolean) => void; openOnError?: boolean; onRetry?: () => void; maxCodeHeight?: number; className?: string;
};
export type ToolCallGroupProps = {
  children: ReactNode; label?: string; runningLabel?: string; duration?: number; defaultOpen?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; className?: string;
};

function useStyles() {
  useEffect(() => {
    if (document.getElementById('ui-tool-call-clean')) return;
    const style = document.createElement('style');
    style.id = 'ui-tool-call-clean'; style.textContent = css; document.head.appendChild(style);
  }, []);
}

export function ToolCallCard({ name, summary, icon, status, args, result, error, startedAt, duration, defaultOpen = false,
  open: controlled, onOpenChange, openOnError = true, onRetry, maxCodeHeight = 220, className }: ToolCallCardProps) {
  useStyles();
  const id = useId();
  const [internal, setInternal] = useState(defaultOpen || (openOnError && status === 'error'));
  const open = controlled ?? internal;
  const previous = useRef(status);
  const autoOpened = useRef(openOnError && status === 'error');
  const setOpen = (value: boolean) => { if (controlled === undefined) setInternal(value); onOpenChange?.(value); };
  useEffect(() => {
    if (previous.current !== status && controlled === undefined && openOnError) {
      if (status === 'error') { setInternal(true); autoOpened.current = true; }
      else if (previous.current === 'error' && autoOpened.current) { setInternal(false); autoOpened.current = false; }
    }
    previous.current = status;
  }, [status, controlled, openOnError]);
  const measured = useStopwatch(status === 'running', startedAt, false);
  const ms = status === 'running' ? measured ?? 0 : duration ?? measured;
  return <div className={['ui-tcc', className].filter(Boolean).join(' ')} data-status={status} data-open={open || undefined}>
    <span className="ui-tcc-sr" role="status" aria-live="polite">{name} {status === 'running' ? 'running' : status === 'success' ? 'finished' : `failed${error ? `: ${error}` : ''}`}</span>
    <button type="button" className="ui-tcc__head" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => { autoOpened.current = false; setOpen(!open); }}>
      <span className="ui-tcc__icon" aria-hidden>{icon || <Wrench size={16} />}</span><span className="ui-tcc__main"><code className="ui-tcc__name" title={name}>{name}</code>{summary != null && <span className="ui-tcc__summary" dir="auto" title={typeof summary === 'string' ? summary : undefined}>{summary}</span>}</span>
      <span className="ui-tcc__status" key={status}>{status === 'running' ? <Loader2 className="ui-tcc__spinner" size={14} /> : status === 'success' ? <span className="ui-tcc__ok"><Check size={10} /></span> : <span className="ui-tcc__err"><X size={10} /></span>}<span className="ui-tcc__time">{status === 'error' ? 'Failed' : ms != null ? formatMs(ms, status === 'running') : null}</span></span><ChevronDown className="ui-tcc__chevron" size={12} />
    </button>
    <div className="ui-tcc__body" id={`${id}-body`} aria-hidden={!open} ref={(node) => { if (node) node.inert = !open; }}><div className="ui-tcc__clip"><div className="ui-tcc__sections">
      {status === 'error' && <div className="ui-tcc__error"><span className="ui-tcc__err"><X size={10} /></span><p className="ui-tcc__error-text" dir="auto">{error || 'The tool call failed.'}</p>{onRetry && <button type="button" className="ui-tcc__retry" onClick={onRetry}><RotateCcw size={14} />Retry</button>}</div>}
      {args !== undefined && <CodeSection label="Arguments" value={args} cap={maxCodeHeight} />}
      {result !== undefined ? <CodeSection label="Result" value={result} cap={maxCodeHeight} /> : status === 'running' ? <div className="ui-tcc__section"><span className="ui-tcc__label">Result</span><p className="ui-tcc__pending">Waiting for result…</p></div> : args === undefined ? <p className="ui-tcc__pending">No arguments or result.</p> : null}
    </div></div></div>
  </div>;
}

export function ToolCallGroup({ children, label, runningLabel = 'Using tools…', duration, defaultOpen = false, open: controlled, onOpenChange, className }: ToolCallGroupProps) {
  useStyles();
  const id = useId();
  const [internal, setInternal] = useState(defaultOpen);
  const open = controlled ?? internal;
  const calls = Children.toArray(children).filter(isValidElement).map((c) => (c as ReactElement<Partial<ToolCallCardProps>>).props);
  const running = calls.some((c) => c.status === 'running');
  const failed = calls.filter((c) => c.status === 'error').length;
  const since = calls.reduce<number | undefined>((min, c) => c.status === 'running' && c.startedAt != null && (min == null || c.startedAt < min) ? c.startedAt : min, undefined);
  const measured = useStopwatch(running, since, true);
  const sum = calls.length && calls.every((c) => c.duration != null) ? calls.reduce((n, c) => n + (c.duration || 0), 0) : null;
  const ms = running ? measured : duration ?? sum ?? measured;
  const count = `Used ${calls.length} ${calls.length === 1 ? 'tool' : 'tools'}`;
  const title = running ? runningLabel : label || count;
  return <div className={['ui-tcc-group', className].filter(Boolean).join(' ')} data-open={open || undefined} data-running={running || undefined}>
    <span className="ui-tcc-sr" role="status" aria-live="polite">{running ? runningLabel : `${count}${failed ? `, ${failed} failed` : ''}`}</span>
    <button type="button" className="ui-tcc-group__head" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => { if (controlled === undefined) setInternal(!open); onOpenChange?.(!open); }}><span className="ui-tcc-group__stack" aria-hidden>{calls.slice(-3).map((c, i) => <span className="ui-tcc__icon" key={i}>{c.icon || <Wrench size={13} />}</span>)}</span><span className="ui-tcc-group__title"><span className={running ? 'ui-tcc-group__label ui-tcc__shine' : 'ui-tcc-group__label'} data-text={title}>{title}</span>{!running && failed > 0 && <span className="ui-tcc-group__failed">· {failed} failed</span>}{ms != null && <span className="ui-tcc-group__time">· {formatMs(ms, running)}</span>}</span><ChevronDown size={12} className="ui-tcc__chevron" /></button>
    <div className="ui-tcc__body" id={`${id}-list`} aria-hidden={!open} ref={(node) => { if (node) node.inert = !open; }}><div className="ui-tcc__clip"><div className="ui-tcc-group__list">{children}</div></div></div>
  </div>;
}

function CodeSection({ label, value, cap }: { label: string; value: unknown; cap: number }) {
  const { text, json } = toText(value);
  const pre = useRef<HTMLPreElement>(null);
  const [full, setFull] = useState(false);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = pre.current, inner = el?.firstElementChild;
    if (!el || !inner) return;
    const measure = () => setHeight(inner.scrollHeight + 20);
    measure(); const observer = new ResizeObserver(measure); observer.observe(inner);
    return () => observer.disconnect();
  }, [text]);
  const capped = height > cap + 24;
  return <div className="ui-tcc__section"><div className="ui-tcc__section-head"><span className="ui-tcc__label">{label}</span><CopyButton text={text} label={label.toLowerCase()} /></div><pre ref={pre} className="ui-tcc__code" data-capped={capped && !full || undefined} data-scroll={capped && full && height > 640 || undefined} style={capped ? { maxHeight: full ? Math.min(height, 640) : cap } : undefined}><code>{json ? highlight(text) : text}</code></pre>{capped && <button type="button" className="ui-tcc__more" aria-expanded={full} onClick={() => setFull(!full)}>{full ? 'Show less' : 'Show all'}</button>}</div>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (!copied && !failed) return; const timer = setTimeout(() => { setCopied(false); setFailed(false); }, 1400); return () => clearTimeout(timer); }, [copied, failed]);
  return <button type="button" className="ui-tcc__copy" data-copied={copied || undefined} aria-label={copied ? 'Copied' : failed ? 'Copy failed. Try again.' : `Copy ${label}`} title={copied ? 'Copied' : failed ? 'Copy failed' : `Copy ${label}`} onClick={async () => { const ok = await copyText(text); setCopied(ok); setFailed(!ok); }}>{copied ? <Check size={15} /> : <Copy size={14} />}</button>;
}

function useStopwatch(running: boolean, startedAt: number | undefined, accumulate: boolean) {
  const start = useRef<number | null>(null), base = useRef(0);
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!running) { if (start.current !== null) { base.current += Math.max(0, Date.now() - start.current); start.current = null; setMs(base.current); } return; }
    if (!accumulate) base.current = 0;
    start.current = startedAt ?? Date.now();
    const tick = () => setMs(base.current + Math.max(0, Date.now() - (start.current ?? Date.now())));
    tick(); const timer = setInterval(tick, 100); return () => clearInterval(timer);
  }, [running, startedAt, accumulate]);
  return ms;
}
function formatMs(ms: number, live: boolean) {
  if (!live && ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  const seconds = Math.floor(ms / 1000); if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  const hours = Math.floor(seconds / 3600); return hours < 24 ? `${hours}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
function toText(value: unknown): { text: string; json: boolean } {
  if (typeof value === 'string') { const trimmed = value.trim(); if (/^[{\[]/.test(trimmed)) { try { return { text: JSON.stringify(JSON.parse(trimmed), null, 2), json: true }; } catch { /* plain text */ } } return { text: value, json: false }; }
  try { const text = JSON.stringify(value, null, 2); return { text: text === undefined ? String(value) : text, json: text !== undefined }; } catch { return { text: String(value), json: false }; }
}
const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = []; let last = 0;
  for (const match of text.matchAll(new RegExp(TOKEN.source, 'g'))) { const index = match.index!; if (index > last) out.push(text.slice(last, index)); if (match[1] && match[2]) out.push(<span key={index} className="ui-tcc__t-key">{match[1]}</span>, match[2]); else out.push(<span key={index} className={`ui-tcc__t-${match[1] ? 'str' : /^[tfn]/.test(match[0]) ? 'lit' : 'num'}`}>{match[0]}</span>); last = index + match[0].length; }
  if (last < text.length) out.push(text.slice(last)); return out;
}
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const area = document.createElement('textarea'); const active = document.activeElement; area.value = text; area.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(area); area.select();
    try { return document.execCommand('copy'); } catch { return false; } finally { area.remove(); if (active instanceof HTMLElement) active.focus(); }
  }
}

const css = `
.ui-tcc,.ui-tcc-group{--ui-tcc-card:#fff;--ui-tcc-strong:#172032;--ui-tcc-ink:#252d3c;--ui-tcc-text:#6d7380;--ui-tcc-muted:#858a94;--ui-tcc-faint:#a1a5ae;--ui-tcc-icon:#737b8a;--ui-tcc-line:#ebedf1;--ui-tcc-wash:#f4f5f7;--ui-tcc-code:#fafafa;--ui-tcc-accent:#2b66b4;--ui-tcc-red:#c74d3c;--ui-tcc-key:#303846;--ui-tcc-str:#23738e;--ui-tcc-num:#a46b24;--ui-tcc-lit:#665c9e;--ui-tcc-shadow:0 0 0 .5px #1b294c14,0 1px 2px #1b294c0a;--ui-tcc-ease:cubic-bezier(.22,1,.36,1);box-sizing:border-box;container-type:inline-size;min-width:0;color:var(--ui-tcc-ink);font-family:var(--font-body,system-ui);font-size:13px;line-height:20px;font-weight:400}
.ui-tcc *,.ui-tcc-group *{box-sizing:border-box}.ui-tcc{position:relative;border-radius:10px;background:var(--ui-tcc-card);box-shadow:var(--ui-tcc-shadow)}.ui-tcc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ui-tcc__head{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:0 15px;border-radius:10px;cursor:pointer;transition:background 160ms}.ui-tcc[data-open] .ui-tcc__head{border-radius:10px 10px 0 0}.ui-tcc__head:focus-visible,.ui-tcc-group__head:focus-visible,.ui-tcc__copy:focus-visible,.ui-tcc__more:focus-visible,.ui-tcc__retry:focus-visible{outline:2px solid #2b66b466;outline-offset:2px}
.ui-tcc__icon{display:grid;place-items:center;flex:none;width:16px;height:16px;color:var(--ui-tcc-icon)}.ui-tcc__icon>svg{width:16px;height:16px;stroke-width:1.4}.ui-tcc__main{display:flex;align-items:baseline;gap:9px;flex:1;min-width:0}.ui-tcc__name{flex:0 1 auto;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-tcc-strong);font-family:var(--font-mono,monospace);font-size:12px;font-weight:500}.ui-tcc__summary{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-tcc-text)}
.ui-tcc__status{display:inline-flex;align-items:center;gap:6px;flex:none;color:var(--ui-tcc-muted);font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}.ui-tcc[data-status=error] .ui-tcc__status{color:var(--ui-tcc-red)}.ui-tcc__spinner{color:var(--ui-tcc-accent);animation:ui-tcc-spin .8s linear infinite}.ui-tcc__ok,.ui-tcc__err{display:grid;place-items:center;width:14px;height:14px;border-radius:50%;background:var(--ui-tcc-accent);color:white;flex:none;animation:ui-tcc-pop .4s var(--ui-tcc-ease)}.ui-tcc__err{background:var(--ui-tcc-red)}.ui-tcc__chevron{flex:none;color:var(--ui-tcc-icon);transition:transform .3s var(--ui-tcc-ease)}.ui-tcc[data-open]>.ui-tcc__head .ui-tcc__chevron,.ui-tcc-group[data-open]>.ui-tcc-group__head .ui-tcc__chevron{transform:rotate(180deg)}
.ui-tcc__body{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .38s var(--ui-tcc-ease),opacity .24s}.ui-tcc[data-open]>.ui-tcc__body,.ui-tcc-group[data-open]>.ui-tcc__body{grid-template-rows:1fr;opacity:1}.ui-tcc__clip{min-height:0;overflow:hidden}.ui-tcc__sections{display:grid;gap:14px;padding:12px 15px 15px;border-top:.5px solid var(--ui-tcc-line)}.ui-tcc__section{display:grid;gap:6px;min-width:0}.ui-tcc__section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px}.ui-tcc__label{color:var(--ui-tcc-muted);font-size:10px;font-weight:500;letter-spacing:.5px;text-transform:uppercase}.ui-tcc__pending{margin:0;color:var(--ui-tcc-muted);font-size:12px}
.ui-tcc__copy{all:unset;display:grid;place-items:center;width:30px;height:30px;border-radius:6px;background:var(--ui-tcc-card);box-shadow:var(--ui-tcc-shadow);color:var(--ui-tcc-icon);cursor:pointer}.ui-tcc__copy[data-copied]{color:var(--ui-tcc-accent)}.ui-tcc__code{position:relative;margin:0;padding:10px 12px;overflow:hidden;border-radius:8px;background:var(--ui-tcc-code);box-shadow:inset 0 0 0 .5px var(--ui-tcc-line);color:var(--ui-tcc-muted);font-family:var(--font-mono,monospace);font-size:12px;line-height:20px;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;transition:max-height .42s var(--ui-tcc-ease)}.ui-tcc__code code{display:block;font:inherit}.ui-tcc__code::after{content:'';position:absolute;left:.5px;right:.5px;bottom:.5px;height:56px;background:linear-gradient(transparent,var(--ui-tcc-code));opacity:0;pointer-events:none}.ui-tcc__code[data-capped]::after{opacity:1}.ui-tcc__code[data-scroll]{overflow-y:auto;overscroll-behavior:contain}.ui-tcc__t-key{color:var(--ui-tcc-key)}.ui-tcc__t-str{color:var(--ui-tcc-str)}.ui-tcc__t-num{color:var(--ui-tcc-num)}.ui-tcc__t-lit{color:var(--ui-tcc-lit)}.ui-tcc__more{all:unset;justify-self:start;padding:4px;color:var(--ui-tcc-text);font-size:12px;cursor:pointer}
.ui-tcc__error{display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;background:#c74d3c09;box-shadow:inset 0 0 0 .5px #c74d3c22}.ui-tcc__error-text{flex:1;min-width:0;max-height:200px;overflow:auto;white-space:pre-line;color:var(--ui-tcc-red);font-size:13px;overflow-wrap:anywhere}.ui-tcc__retry{all:unset;display:inline-flex;align-items:center;gap:6px;flex:none;padding:5px 10px;border-radius:6px;background:var(--ui-tcc-card);box-shadow:var(--ui-tcc-shadow);cursor:pointer}
.ui-tcc-group{display:grid}.ui-tcc-group__head{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;justify-self:start;max-width:100%;min-height:36px;padding:4px 8px;border-radius:8px;cursor:pointer}.ui-tcc-group__stack{display:flex;flex:none}.ui-tcc-group__stack .ui-tcc__icon{width:24px;height:24px;border-radius:6px;background:var(--ui-tcc-card);box-shadow:var(--ui-tcc-shadow)}.ui-tcc-group__stack .ui-tcc__icon+.ui-tcc__icon{margin-left:-4px}.ui-tcc-group__stack .ui-tcc__icon>svg{width:13px;height:13px}.ui-tcc-group__title{display:flex;align-items:baseline;gap:6px;min-width:0;white-space:nowrap}.ui-tcc-group__label{position:relative;min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:500}.ui-tcc-group__failed{color:var(--ui-tcc-red);flex:none}.ui-tcc-group__time{color:var(--ui-tcc-faint);font-variant-numeric:tabular-nums;flex:none}.ui-tcc-group__list{display:grid;gap:10px;padding:8px 1px 3px}.ui-tcc__shine{color:var(--ui-tcc-muted)}.ui-tcc__shine::after{content:attr(data-text);position:absolute;inset:0;color:transparent;background:linear-gradient(90deg,transparent 38%,#fff 50%,transparent 62%) 100% 0/300% 100%;background-clip:text;animation:ui-tcc-sweep 1.8s linear infinite;pointer-events:none}
@media(hover:hover){.ui-tcc__head:hover,.ui-tcc-group__head:hover,.ui-tcc__copy:hover,.ui-tcc__retry:hover{background:var(--ui-tcc-wash)}}@keyframes ui-tcc-spin{to{transform:rotate(360deg)}}@keyframes ui-tcc-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}@keyframes ui-tcc-sweep{from{background-position:100% 0}to{background-position:0% 0}}@container(max-width:360px){.ui-tcc__head{gap:8px;padding:0 12px}.ui-tcc__summary{display:none}}@media(pointer:coarse){.ui-tcc__head{min-height:52px}.ui-tcc__copy,.ui-tcc__retry{min-width:38px;min-height:38px}}
@media(prefers-reduced-motion:reduce){.ui-tcc *,.ui-tcc-group *,.ui-tcc *::after,.ui-tcc-group *::after{animation:none!important;transition:none!important}.ui-tcc__shine::after{display:none}}
:where(.dark,[data-theme=dark]) .ui-tcc,:where(.dark,[data-theme=dark]) .ui-tcc-group{--ui-tcc-card:#1c1c1e;--ui-tcc-strong:#fff;--ui-tcc-ink:#ffffffeb;--ui-tcc-text:#ffffff9e;--ui-tcc-muted:#ffffff75;--ui-tcc-faint:#ffffff4d;--ui-tcc-icon:#ffffff80;--ui-tcc-line:#ffffff14;--ui-tcc-wash:#ffffff0a;--ui-tcc-code:#212123;--ui-tcc-accent:#7ba8f1;--ui-tcc-red:#ff7b72;--ui-tcc-key:#ffffffe6;--ui-tcc-str:#5fc8e8;--ui-tcc-num:#f2a65a;--ui-tcc-lit:#a5a5ff;--ui-tcc-shadow:0 0 0 .5px #ffffff1a,0 1px 2px #0006}
`;
