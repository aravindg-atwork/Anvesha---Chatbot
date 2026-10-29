"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, FileText, Image, MessageSquareText, Search, Sparkles } from 'lucide-react';
import './integration-beam.css';
import { FrostCloud } from './frost-cloud';

export type BeamTool = { name: string; logo: ReactNode };
export type BeamCenter = { name: string; logo?: ReactNode };
export type IntegrationBeamProps = { left?: BeamTool[]; right?: BeamTool[]; center?: BeamCenter; className?: string; label?: string };
const TRAVEL = 1500, STAGGER = 280, REST = 1500, MORPH = 460;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
type Point = { x: number; y: number };
type Curve = number[];
const DEFAULT_LEFT: BeamTool[] = [{ name: 'Documents', logo: <FileText /> }, { name: 'Images and scans', logo: <Image /> }, { name: 'Questions and answers', logo: <MessageSquareText /> }];
const DEFAULT_RIGHT: BeamTool[] = [{ name: 'Prepared passages', logo: <BookOpen /> }, { name: 'Searchable knowledge', logo: <Search /> }, { name: 'Cited answers', logo: <Sparkles /> }];
const DEFAULT_CENTER: BeamCenter = { name: 'Anvesha', logo: <FrostCloud background={false} color="brand" interactive={false} compact followPointer={false} /> };

/** Supplied Integration Beam: responsive measured paths, animated illustration only. */
export function IntegrationBeam({ left = DEFAULT_LEFT, right = DEFAULT_RIGHT, center = DEFAULT_CENTER, className, label }: IntegrationBeamProps) {
  const uid = 'ui-ib' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tools = [...left, ...right], n = tools.length, nLeft = left.length;
  const [off, setOff] = useState<ReadonlySet<number>>(() => new Set());
  const [focus, setFocus] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rootRef = useRef<HTMLDivElement>(null), sceneRef = useRef<HTMLDivElement>(null), centerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const centerRingRef = useRef<HTMLSpanElement>(null), chipRef = useRef<HTMLSpanElement>(null), chipInnerRef = useRef<HTMLSpanElement>(null);
  const toolRefs = useRef<(HTMLButtonElement | null)[]>([]), ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(SVGPathElement | null)[]>([]), pulseRefs = useRef<(SVGGElement | null)[]>([]), gradRefs = useRef<(SVGLinearGradientElement | null)[]>([]);
  const flashTimer = useRef(0), offRef = useRef(off);
  offRef.current = off;
  const connected = tools.filter((_, i) => !off.has(i)).length;
  const status = connected === 0 ? 'Animation paused' : syncing && !reduce ? 'Following the flow' : `${connected} paths illustrated`;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduce(media.matches);
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, []);

  useIsoLayoutEffect(() => {
    const root = rootRef.current, scene = sceneRef.current, svg = svgRef.current, hub = centerRef.current;
    if (!root || !scene || !svg || !hub) return;
    let shown: Curve[] = [], from: Curve[] = [], to: Curve[] = [], morphStart = 0;
    let lastPos: Point[] | null = null, lastStack: boolean | null = null;
    const lengths: number[] = [], pulseStart: (number | null)[] = Array(n).fill(null);
    let queue: { beam: number; at: number }[] = [], nextCycle = 0, syncFrom = 0, syncTo = 0;
    let wasSyncing = false, visible = false, raf = 0;
    const arrivals = new Set<Animation>();
    const centerOf = (el: HTMLElement): Point => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
    const curve = (a: Point, b: Point, stack: boolean): Curve => stack
      ? [a.x, a.y, a.x, (a.y + b.y) / 2, b.x, (a.y + b.y) / 2, b.x, b.y]
      : [a.x, a.y, (a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x, b.y];
    const draw = (curves: Curve[]) => {
      shown = curves;
      curves.forEach((c, i) => {
        const d = `M${c[0]} ${c[1]}C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}`;
        const line = lineRefs.current[i]; if (!line) return;
        line.setAttribute('d', d); pulseRefs.current[i]?.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
        lengths[i] = line.getTotalLength();
      });
    };
    const measure = () => {
      svg.setAttribute('viewBox', `0 0 ${root.clientWidth} ${root.clientHeight}`);
      const stack = getComputedStyle(scene).getPropertyValue('--ui-ib-stack').trim() === '1';
      const els = [...toolRefs.current.slice(0, n), hub]; if (els.some(el => !el)) return;
      const pos = els.map(el => centerOf(el!)), c = pos[n];
      const target = pos.slice(0, n).map((p, i) => i < nLeft ? curve(p, c, stack) : curve(c, p, stack));
      if (lastPos && lastStack !== null && stack !== lastStack && !reduce && visible && !document.hidden) {
        els.forEach((el, i) => {
          const dx = lastPos![i].x - pos[i].x, dy = lastPos![i].y - pos[i].y;
          if (dx || dy) track(el!.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: MORPH, easing: EASE }));
        });
        from = shown.length === n ? shown : target; to = target; morphStart = performance.now(); kick();
      } else if (morphStart) to = target;
      else draw(target);
      lastPos = pos; lastStack = stack;
    };
    const hide = (i: number) => { pulseStart[i] = null; if (pulseRefs.current[i]) pulseRefs.current[i]!.style.opacity = '0'; };
    const track = (animation: Animation) => {
      arrivals.add(animation); animation.onfinish = animation.oncancel = () => arrivals.delete(animation);
    };
    const ring = (el: HTMLElement | null | undefined) => {
      if (el) track(el.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 0, transform: 'scale(1.14)' }], { duration: 760, easing: 'ease-out' }));
    };
    const planCycle = (now: number) => {
      const ins = Array.from({ length: nLeft }, (_, i) => i).filter(i => !offRef.current.has(i));
      const outs = Array.from({ length: n - nLeft }, (_, i) => nLeft + i).filter(i => !offRef.current.has(i));
      if (!ins.length && !outs.length) { nextCycle = now + REST; return; }
      const tOut = ins.length ? now + TRAVEL : now;
      queue = [...ins.map((beam, k) => ({ beam, at: now + k * STAGGER })), ...outs.map((beam, k) => ({ beam, at: tOut + k * STAGGER }))];
      const end = Math.max(...queue.map(q => q.at)) + TRAVEL;
      syncFrom = tOut; syncTo = end; nextCycle = end + REST;
    };
    const paint = (i: number, t: number) => {
      const line = lineRefs.current[i], g = pulseRefs.current[i], grad = gradRefs.current[i]; if (!line || !g || !grad) return;
      const L = lengths[i] || 0, seg = Math.min(84, L * .42), head = -(Math.cos(Math.PI * t) - 1) / 2 * (L + seg);
      g.querySelectorAll('path').forEach(p => { p.style.strokeDasharray = `${seg} ${L + seg}`; p.style.strokeDashoffset = `${seg - head}`; });
      const a = line.getPointAtLength(Math.max(0, Math.min(L, head - seg))), b = line.getPointAtLength(Math.max(0, Math.min(L, head)));
      grad.setAttribute('x1', `${a.x}`); grad.setAttribute('y1', `${a.y}`); grad.setAttribute('x2', `${b.x + (b.x === a.x && b.y === a.y ? .01 : 0)}`); grad.setAttribute('y2', `${b.y}`); g.style.opacity = '1';
    };
    const frame = (now: number) => {
      raf = 0;
      if (morphStart) {
        const t = Math.min(1, (now - morphStart) / MORPH), e = 1 - (1 - t) ** 5;
        draw(to.map((c, i) => c.map((v, k) => (from[i]?.[k] ?? v) + (v - (from[i]?.[k] ?? v)) * e)));
        if (t >= 1) morphStart = 0;
      }
      if (visible && !document.hidden && !reduce) {
        if (now >= nextCycle) planCycle(now);
        queue = queue.filter(q => { if (q.at > now) return true; if (!offRef.current.has(q.beam) && pulseStart[q.beam] === null) pulseStart[q.beam] = q.at; return false; });
        for (let i = 0; i < n; i++) {
          const start = pulseStart[i]; if (start === null) continue;
          if (offRef.current.has(i)) { hide(i); continue; }
          const t = (now - start) / TRAVEL;
          if (t >= 1) { hide(i); ring(i < nLeft ? centerRingRef.current : ringRefs.current[i]); } else paint(i, t);
        }
        const isSyncing = now >= syncFrom && now < syncTo;
        if (isSyncing !== wasSyncing) { wasSyncing = isSyncing; setSyncing(isSyncing); }
      }
      if (morphStart || (visible && !document.hidden && !reduce)) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !reduce && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => {
      cancelAnimationFrame(raf); raf = 0; queue = []; syncTo = 0; morphStart = 0;
      for (let i = 0; i < n; i++) hide(i);
      arrivals.forEach(animation => animation.cancel()); arrivals.clear();
      wasSyncing = false; setSyncing(false);
    };
    const visibility = () => { if (visible && !document.hidden) { nextCycle = performance.now() + 400; measure(); kick(); } else stop(); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(root);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visibility(); }); io.observe(root);
    document.addEventListener('visibilitychange', visibility);
    return () => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', visibility); stop(); };
  }, [n, nLeft, reduce]);

  useIsoLayoutEffect(() => { if (chipRef.current && chipInnerRef.current) chipRef.current.style.width = `${chipInnerRef.current.offsetWidth}px`; }, [status]);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const toggle = (i: number) => {
    const pausing = !off.has(i), next = new Set(off);
    if (pausing) next.add(i); else next.delete(i); setOff(next);
    setAnnounce(`${tools[i].name} animation ${pausing ? 'paused' : 'resumed'}.`);
    setFlash(i); window.clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
  };
  const tile = (tool: BeamTool, i: number) => <button key={i} ref={el => { toolRefs.current[i] = el; }} type="button" className="ui-ib__tool" aria-pressed={!off.has(i)} aria-label={`${tool.name} animation, ${off.has(i) ? 'paused' : 'playing'}`} data-off={off.has(i) || undefined} data-tip={focus === i || flash === i || undefined} onClick={() => toggle(i)} onPointerEnter={e => { if (e.pointerType === 'mouse') setFocus(i); }} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}>
    <span className="ui-ib__ring" ref={el => { ringRefs.current[i] = el; }} /><span className="ui-ib__logo" aria-hidden="true">{tool.logo}</span><span className="ui-ib__tip" aria-hidden="true">{tool.name}{off.has(i) && ' · Paused'}</span>
  </button>;
  return <div ref={rootRef} className={['ui-ib', className].filter(Boolean).join(' ')} role="group" aria-label={label ?? `Illustration: ${center.name} connects ${tools.map(t => t.name).join(', ')}`} data-focus={focus !== null || undefined}>
    <svg ref={svgRef} className="ui-ib__beams" aria-hidden="true"><defs>
      <filter id={`${uid}-blur`} filterUnits="userSpaceOnUse" x="-100" y="-100" width="2000" height="2000"><feGaussianBlur stdDeviation="3" /></filter>
      {tools.map((_, i) => <linearGradient key={i} id={`${uid}-g${i}`} gradientUnits="userSpaceOnUse" ref={el => { gradRefs.current[i] = el; }}><stop offset="0" className="ui-ib__stop-tail" /><stop offset=".6" className="ui-ib__stop-mid" /><stop offset="1" className="ui-ib__stop-head" /></linearGradient>)}
    </defs>{tools.map((_, i) => <path key={i} className="ui-ib__line" data-off={off.has(i) || undefined} data-focus={focus === i || undefined} ref={el => { lineRefs.current[i] = el; }} />)}
    {tools.map((_, i) => <g key={i} className="ui-ib__pulse" data-focus={focus === i || undefined} ref={el => { pulseRefs.current[i] = el; }}><path className="ui-ib__glow" stroke={`url(#${uid}-g${i})`} filter={`url(#${uid}-blur)`} /><path className="ui-ib__core" stroke={`url(#${uid}-g${i})`} /></g>)}</svg>
    <div ref={sceneRef} className="ui-ib__scene"><div className="ui-ib__group ui-ib__group--in">{left.map(tile)}</div>
      <div ref={centerRef} className="ui-ib__center" data-syncing={(syncing && connected > 0) || undefined}><span className="ui-ib__ring" ref={centerRingRef} /><span className="ui-ib__mark" aria-hidden="true">{center.logo ?? <Sparkles />}</span><span ref={chipRef} className="ui-ib__chip"><span ref={chipInnerRef} className="ui-ib__chip-inner"><span className="ui-ib__dot" data-idle={connected === 0 || undefined} /><span>{status}</span></span></span></div>
      <div className="ui-ib__group ui-ib__group--out">{right.map((t, i) => tile(t, nLeft + i))}</div>
    </div><span className="ui-ib__sr" aria-live="polite">{announce}</span>
  </div>;
}
