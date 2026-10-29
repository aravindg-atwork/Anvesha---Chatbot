"use client";

import { useEffect, useId, useRef } from 'react';
import './frost-cloud.css';

export type FrostCloudProps = {
  background?: boolean;
  color?: 'blue' | 'orange' | 'brand';
  followPointer?: boolean;
  className?: string;
  label?: string;
  interactive?: boolean;
  compact?: boolean;
};
const PUFFS = [{ cx: 115, cy: 93, r: 43 }, { cx: 163, cy: 111, r: 39 }, { cx: 156, cy: 155, r: 31 }, { cx: 107, cy: 155, r: 35 }, { cx: 72, cy: 126, r: 34 }];
const CORE = { x: 80, y: 100, width: 80, height: 65 };
const EYES = { y: 106, w: 18, h: 31, left: 96.5, right: 127.5 };
const GLANCES = [{ x: 0, y: 0 }, { x: -1, y: .05 }, { x: 1, y: -.05 }, { x: .65, y: -.55 }, { x: -.7, y: .35 }];
const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

/** Supplied Frost Cloud illustration, adapted for React 18 and the Anvesha palette. */
export function FrostCloud({ background = true, color = 'orange', followPointer = true, className, label = 'Frost cloud. Press to make the cloud wink.', interactive = true, compact = false }: FrostCloudProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `fc${uid}-${name}`;
  const root = useRef<HTMLElement | null>(null);
  const floatRef = useRef<SVGGElement>(null);
  const turnRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const leftEye = useRef<SVGGElement>(null);
  const rightEye = useRef<SVGGElement>(null);
  const shineRef = useRef<SVGEllipseElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let still = motion.matches;
    let visible = false;
    const look = { x: 0, y: 0, vx: 0, vy: 0 };
    const target = { x: 0, y: 0 };
    const squish = { p: 0, v: 0 };
    let pointer = false, nextGlance = 1.2, nextBlink = 1.8, blinkAt = -1, winkAt = -1;
    let blinkTwice = false, frame = 0, last = 0, time = 0;
    const blinkScale = (since: number, length = .16) => since < 0 || since > length ? 1 : 1 - .9 * Math.sin(since / length * Math.PI);
    const draw = () => {
      const float = still ? 0 : Math.sin(time * 1.1) * 5;
      const breathe = still ? 0 : Math.sin(time * 1.1 + Math.PI / 2) * .012;
      floatRef.current?.setAttribute('transform', `translate(0 ${float.toFixed(2)}) ${about(120, 180, `scale(${1 - breathe + squish.p * .1} ${1 + breathe - squish.p * .12})`)}`);
      turnRef.current?.setAttribute('transform', `translate(${look.x * 4} ${look.y * 2}) ${about(120, 120, `rotate(${look.x * 2.5}) scale(${1 - Math.abs(look.x) * .025} 1)`)}`);
      eyesRef.current?.setAttribute('transform', `translate(${look.x * 12} ${look.y * 7})`);
      shineRef.current?.setAttribute('transform', `translate(${-look.x * 7} ${-look.y * 3})`);
      const both = still || blinkAt < 0 ? 1 : Math.min(blinkScale(time - blinkAt), blinkTwice ? blinkScale(time - blinkAt - .26) : 1);
      const wink = still || winkAt < 0 ? 1 : blinkScale(time - winkAt, .34);
      leftEye.current?.setAttribute('transform', about(EYES.left + 9, EYES.y + EYES.h / 2, `scale(1 ${both})`));
      rightEye.current?.setAttribute('transform', about(EYES.right + 9, EYES.y + EYES.h / 2, `scale(1 ${Math.min(both, wink)})`));
      const lift = (float + 5) / 10;
      shadowRef.current?.setAttribute('transform', about(120, 210, `scale(${1 - lift * .12} 1)`));
      shadowRef.current?.setAttribute('opacity', `${.34 - lift * .1}`);
    };
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - (last || now)) / 1000);
      last = now; time += dt;
      if (!pointer && time > nextGlance) {
        Object.assign(target, GLANCES[Math.floor(Math.random() * GLANCES.length)]);
        nextGlance = time + 1.4 + Math.random() * 2.2;
      }
      if (time > nextBlink) { blinkAt = time; blinkTwice = Math.random() < .25; nextBlink = time + 2.4 + Math.random() * 3; }
      look.vx += ((target.x - look.x) * 70 - look.vx * 13) * dt;
      look.vy += ((target.y - look.y) * 70 - look.vy * 13) * dt;
      look.x += look.vx * dt; look.y += look.vy * dt;
      squish.v += (-squish.p * 220 - squish.v * 9) * dt; squish.p += squish.v * dt;
      draw(); frame = requestAnimationFrame(tick);
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const start = () => { if (!frame && visible && !document.hidden && !still) { last = 0; frame = requestAnimationFrame(tick); } };
    const update = () => { stop(); still = motion.matches; if (still) { Object.assign(look, { x: 0, y: 0, vx: 0, vy: 0 }); squish.p = 0; draw(); } start(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); });
    io.observe(el);
    const onMove = (e: PointerEvent) => {
      if (!followPointer || still || e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect(); pointer = true;
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2.4));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2.4));
    };
    const onLeave = () => { pointer = false; target.x = 0; target.y = 0; nextGlance = time + 1.2; };
    // Native button click supports pointer, Enter and Space without duplicate bounces.
    const onClick = () => { if (still || !interactive) return; squish.p = .9; squish.v = 0; winkAt = time + .12; start(); };
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave); el.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', update); motion.addEventListener('change', update); draw();
    return () => {
      stop(); io.disconnect(); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); el.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update);
    };
  }, [followPointer, interactive]);

  const puffs = PUFFS.map((p, i) => <circle key={i} {...p} />);
  const eye = (x: number, ref: typeof leftEye, side: string) => {
    const pill = { x, y: EYES.y, width: EYES.w, height: EYES.h, rx: EYES.w / 2 };
    return <g ref={ref}><rect {...pill} x={x - 1.5} y={EYES.y - 1} width={EYES.w + 3} height={EYES.h + 3} rx={10.5} className="ui-fc__eye-drop" filter={`url(#${id('edge')})`} /><rect {...pill} fill={`url(#${id('hole')})`} /><clipPath id={id(`clip-${side}`)}><rect {...pill} /></clipPath><rect {...pill} y={EYES.y + 2.5} className="ui-fc__eye-shade" fill="none" strokeWidth="5" filter={`url(#${id('edge')})`} clipPath={`url(#${id(`clip-${side}`)})`} /></g>;
  };
  const Root = interactive ? 'button' : 'span';
  return <Root type={interactive ? 'button' : undefined} ref={element => { root.current = element; }} className={['ui-fc', className].filter(Boolean).join(' ')} data-bg={background || undefined} data-color={color} data-decorative={!interactive || undefined} aria-label={interactive ? label : undefined}>
    <svg viewBox={compact ? '25 30 190 185' : '0 0 240 240'} aria-hidden="true">
      <defs>
        <filter id={id('goo')} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3.5" /><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12" /></filter>
        {[['soft', 12], ['halo', 9], ['edge', 1.6], ['shade', 5]].map(([name, blur]) => <filter key={name} id={id(String(name))} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation={blur} /></filter>)}
        <g id={id('shape')} filter={`url(#${id('goo')})`}>{puffs}<rect {...CORE} /></g>
        <mask id={id('mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240"><use href={`#${id('shape')}`} fill="#fff" /></mask>
        <linearGradient id={id('frost')} x1="0" y1="50" x2="0" y2="192" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="var(--ui-fc-white)" /><stop offset="1" stopColor="var(--ui-fc-frost)" stopOpacity=".97" /></linearGradient>
        <linearGradient id={id('hole')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--ui-fc-hole-1)" /><stop offset="1" stopColor="var(--ui-fc-hole-2)" /></linearGradient>
      </defs>
      <ellipse ref={shadowRef} className="ui-fc__shadow" cx="120" cy="210" rx="54" ry="7" filter={`url(#${id('shade')})`} />
      <g ref={floatRef}><g ref={turnRef}>
        <use href={`#${id('shape')}`} className="ui-fc__halo" filter={`url(#${id('halo')})`} /><use href={`#${id('shape')}`} className="ui-fc__edge" filter={`url(#${id('edge')})`} />
        <g mask={`url(#${id('mask')})`}><rect width="240" height="240" fill={`url(#${id('frost')})`} /><g filter={`url(#${id('soft')})`} className="ui-fc__tint" transform={`translate(-6 18) ${about(120, 120, 'scale(0.84 0.78)')}`}>{puffs}<rect {...CORE} /></g><ellipse ref={shineRef} cx="108" cy="78" rx="34" ry="14" fill="#fff" opacity=".75" filter={`url(#${id('shade')})`} /></g>
        <g ref={eyesRef}>{eye(EYES.left, leftEye, 'l')}{eye(EYES.right, rightEye, 'r')}</g>
      </g></g>
    </svg>
  </Root>;
}
