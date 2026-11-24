/**
 * Shared helpers of the dissolve web components, from dissolve (dissolve-ui). This file is yours.
 * Curves, springs, a disposal scope, theme tokens, and small DOM and canvas helpers. Nothing here
 * touches the DOM at import, so it is safe during server rendering.
 */

/* ---------- environment ---------- */

/** prefers-reduced-motion, read live. False outside the browser. */
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A haptic where the browser has one (Android Chrome). Silent elsewhere and before the first tap. */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !navigator.userActivation?.hasBeenActive) return;
  navigator.vibrate?.(pattern);
}

/**
 * Adds a stylesheet once per document, keyed by id. Components ship their base CSS this way, with
 * :where() selectors so any class of yours wins over it.
 */
export function injectStyle(id: string, css: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

/** A dissolve theme token (--dissolve-<name>, see theme.css) as resolved on node, or the fallback. */
export function token(node: Element, name: string, fallback: string) {
  return getComputedStyle(node).getPropertyValue(`--dissolve-${name}`).trim() || fallback;
}

/** The font family node renders with, for text drawn on a canvas. */
export const fontOf = (node: Element) => getComputedStyle(node).fontFamily || 'system-ui, sans-serif';

/**
 * Calls fn when the theme may have changed: the system color scheme, or a class, data-theme or
 * style change on <html> (how theme switchers flip it). Stops with the scope.
 */
export function onThemeChange(sc: Scope, fn: () => void) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', fn);
  sc.onDispose(() => { mo.disconnect(); mq.removeEventListener('change', fn); });
}

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS color (hex, rgb(), hsl(), oklch()...) as [r, g, b, a], 0..255 and 0..1. */
export function rgbOf(color: string): [number, number, number, number] {
  probe ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/* ---------- props ---------- */

/** Props once their defaults are applied: every defaulted key is set. */
export type Resolved<P, D> = Omit<P, keyof D> & { [K in keyof D & keyof P]-?: Exclude<P[K], undefined> };

/**
 * The props of a component instance over its defaults. update() takes a partial set, where an
 * undefined value puts the default back, and returns the names whose value changed.
 */
export function propsOf<P extends object, D extends Partial<P>>(defaults: D, initial: P) {
  let raw: Partial<P> = { ...initial };
  const resolve = () => {
    const out: Record<string, unknown> = { ...defaults };
    for (const [k, v] of Object.entries(raw)) if (v !== undefined) out[k] = v;
    return out as Resolved<P, D>;
  };
  const box = {
    current: resolve(),
    update(next: Partial<P>) {
      raw = { ...raw, ...next };
      const prev = box.current as Record<string, unknown>;
      box.current = resolve();
      const cur = box.current as Record<string, unknown>;
      return new Set([...Object.keys(prev), ...Object.keys(cur)].filter((k) => prev[k] !== cur[k])) as Set<keyof P>;
    },
  };
  return box;
}

/* ---------- curves ---------- */

export type Ease = (t: number) => number;

export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) {
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return Y(t);
  };
}

/** iOS sheet curve, the dissolve default. */
export const CALM = bezier(0.32, 0.72, 0, 1);
/** SplitButton SOFT. */
export const SPLIT = bezier(0.45, 0, 0.2, 1);
/** Reanimated withTiming default. */
export const QUAD: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const IN_OUT_CUBIC: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const OUT_CUBIC: Ease = (t) => 1 - (1 - t) ** 3;

/* ---------- numbers and colors ---------- */

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

/** Stable pseudo random 0..1 from two integers (the native motion.ts hash). */
export const hash = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** '#RRGGBB' to [r, g, b], 0..255. */
export const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

/** Blend of two '#RRGGBB' colors, as an rgb() string. */
export const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };

/* ---------- lifetime ---------- */

/** Anything with a done promise that can be cut short (an engine burst). */
type Cancelable = { done: Promise<unknown>; cancel: () => void };

/** Timers, frames and bursts of one mounted component. dispose() stops all of it. */
export type Scope = {
  alive: boolean;
  /** Resolves after ms, never once the scope is disposed. */
  wait: (ms: number) => Promise<void>;
  track: <T extends Cancelable>(h: T) => T;
  onDispose: (fn: () => void) => void;
  dispose: () => void;
};

export function scope(): Scope {
  const timers = new Set<ReturnType<typeof setTimeout>>(), handles = new Set<Cancelable>(), fns: (() => void)[] = [];
  const sc: Scope = {
    alive: true,
    wait: (ms) => new Promise((res) => {
      const t = setTimeout(() => { timers.delete(t); if (sc.alive) res(); }, ms);
      timers.add(t);
    }),
    track(h) { handles.add(h); h.done.then(() => handles.delete(h)); return h; },
    onDispose(fn) { fns.push(fn); },
    dispose() {
      if (!sc.alive) return;
      sc.alive = false;
      timers.forEach(clearTimeout);
      handles.forEach((h) => h.cancel());
      fns.forEach((f) => f());
    },
  };
  return sc;
}

export type Spring = { stiffness?: number; damping?: number; mass?: number; eps?: number };

export type Value = {
  v: number;
  vel: number;
  set: (x: number) => void;
  /** A timed curve. Resolves true at the end, false when a newer animation took over. */
  to: (to: number, ms: number, ease?: Ease, delay?: number) => Promise<boolean>;
  /** A damped spring (semi implicit Euler, small fixed steps). */
  spring: (to: number, cfg?: Spring) => Promise<boolean>;
};

/** An animated number. A newer animation supersedes the running one. onChange runs every frame. */
export function value(sc: Scope, v0: number, onChange: () => void): Value {
  let id = 0;
  const a: Value = {
    v: v0, vel: 0,
    set(x) { id++; a.v = x; a.vel = 0; onChange(); },
    to(to, ms, ease = CALM, delay = 0) {
      const my = ++id, from = a.v;
      return new Promise((res) => {
        const t0 = performance.now() + delay;
        let lastT = t0;
        const f = (now: number) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          if (now < t0) return void requestAnimationFrame(f);
          const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
          const prev = a.v;
          a.v = from + (to - from) * ease(k);
          const dt = (now - lastT) / 1000;
          a.vel = dt > 0 ? (a.v - prev) / dt : 0;
          lastT = now;
          onChange();
          if (k < 1) requestAnimationFrame(f);
          else { a.vel = 0; res(true); }
        };
        requestAnimationFrame(f);
      });
    },
    spring(to, { stiffness = 260, damping = 31, mass = 1, eps = 0.02 } = {}) {
      const my = ++id;
      return new Promise((res) => {
        let last = performance.now();
        const f = (now: number) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          let dt = Math.min(0.064, (now - last) / 1000);
          last = now;
          while (dt > 0) {
            const h = Math.min(1 / 480, dt);
            a.vel += ((-stiffness * (a.v - to) - damping * a.vel) / mass) * h;
            a.v += a.vel * h;
            dt -= h;
          }
          if (Math.abs(a.v - to) < eps && Math.abs(a.vel) < eps * 10) { a.v = to; a.vel = 0; onChange(); return res(true); }
          onChange();
          requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      });
    },
  };
  return a;
}

/* ---------- DOM ---------- */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/**
 * A type="button" with no look of its own, set inline: page resets and Tailwind preflight beat any
 * :where() rule on form controls, so the component's stylesheet styles what is inside it.
 */
export function plainButton(cls = '', html = '') {
  const b = el('button', cls, html);
  b.type = 'button';
  Object.assign(b.style, { background: 'none', border: '0', padding: '0', margin: '0', color: 'inherit', font: 'inherit', cursor: 'pointer' });
  return b;
}

export const rectOf = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
/** rectOf with the canvas itself as the source: what play() takes for a canvas already on screen. */
export const boxOf = (node: HTMLCanvasElement) => ({ source: node, ...rectOf(node) });
export const frame = () => new Promise<number>(requestAnimationFrame);

/** Tracks whether node is on screen. on: the current state; shown() resolves once it is. */
export function onScreen(sc: Scope, node: Element, onChange?: (on: boolean) => void) {
  let waiting: (() => void)[] = [];
  const st = {
    on: true,
    shown: () => (st.on ? Promise.resolve() : new Promise<void>((res) => waiting.push(res))),
  };
  const io = new IntersectionObserver(([e]) => {
    st.on = e.isIntersecting;
    if (st.on) { waiting.forEach((res) => res()); waiting = []; }
    onChange?.(st.on);
  });
  io.observe(node);
  sc.onDispose(() => io.disconnect());
  return st;
}

/**
 * Calls fn once the node's width has settled at least `min` px away from the width it had at the
 * last call (or at the start). A hidden node (width 0) is ignored. Stops with the scope or the
 * returned function.
 */
export function onWidth(sc: Scope | null, node: Element, fn: () => void, { min = 40, delay = 250 } = {}) {
  let w = node.clientWidth, t: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      const now = node.clientWidth;
      if (!now || Math.abs(now - w) < min) return;
      w = now;
      fn();
    }, delay);
  });
  ro.observe(node);
  const off = () => { ro.disconnect(); clearTimeout(t); };
  sc?.onDispose(off);
  return off;
}

/** rAF loop that sleeps while the node is off screen or while active() is false. kick() wakes it. */
export function loop(sc: Scope, node: Element, fn: (now: number) => void, active = () => true) {
  let raf = 0;
  const tick = (now: number) => {
    raf = 0;
    if (!sc.alive) return;
    fn(now);
    if (seen.on && active()) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && sc.alive) raf = requestAnimationFrame(tick); };
  const seen = onScreen(sc, node, (on) => on && kick());
  kick();
  sc.onDispose(() => cancelAnimationFrame(raf));
  return { kick };
}

/**
 * Touch on a `touch-action: pan-y` surface: a vertical swipe scrolls the page unless
 * want(dx, dy) claims it on its first move. A claimed touch keeps the page still to its end.
 * Returns () => whether the touch in progress is claimed. Aborting signal removes the listeners.
 */
export function claimTouch(node: Element, want: (dx: number, dy: number) => boolean, signal?: AbortSignal) {
  let t: { x: number; y: number; on: boolean | null } | null = null;
  node.addEventListener('touchstart', (e) => {
    const { touches } = e as TouchEvent;
    t = touches.length === 1 ? { x: touches[0].clientX, y: touches[0].clientY, on: null } : null;
  }, { passive: true, signal });
  node.addEventListener('touchmove', (e) => {
    if (!t) return;
    if (t.on === null) {
      const p = (e as TouchEvent).touches[0], dx = p.clientX - t.x, dy = p.clientY - t.y;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      t.on = Math.abs(dy) >= Math.abs(dx) && !!want(dx, dy);
    }
    if (t.on && e.cancelable) e.preventDefault();
  }, { passive: false, signal });
  const off = () => { t = null; };
  node.addEventListener('touchend', off, { signal });
  node.addEventListener('touchcancel', off, { signal });
  return () => !!t?.on;
}

/* ---------- canvas ---------- */

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/** Words of text broken into lines no wider than maxW, in the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' '), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** str, cut with an ellipsis to fit maxW in the context's current font. */
export function fit(ctx: CanvasRenderingContext2D, str: string, maxW: number) {
  if (ctx.measureText(str).width <= maxW) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

/* ---------- DOM capture ---------- */

const radiusOf = (v: string, w: number, h: number, s: number) => {
  const n = parseFloat(v) || 0;
  return Math.min(v.endsWith('%') ? (n / 100) * Math.min(w, h) : n * s, w / 2, h / 2);
};
const painted = (c: string) => c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c);

/**
 * A canvas replica of node as it looks now, at its on screen size, for the grain engine:
 * backgrounds, borders, text, images, canvases and inline SVG (no shadows, gradients or pseudo
 * elements). The node's own opacity is ignored, so a node kept hidden for its entrance captures
 * as it will show. Returns what play() and morph() take: { source, x, y, w, h }.
 */
export async function capture(node: HTMLElement, dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)) {
  const r = node.getBoundingClientRect();
  const s = r.width / (node.offsetWidth || r.width) || 1;
  const source = document.createElement('canvas');
  source.width = Math.ceil(r.width * dpr);
  source.height = Math.ceil(r.height * dpr);
  const ctx = source.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Inline SVG only draws through an image, which loads async: load them all first, draw in order.
  const svgs = new Map<Element, HTMLImageElement>();
  await Promise.all([...node.querySelectorAll('svg')].map((svg) => {
    const b = svg.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', String(b.width));
    copy.setAttribute('height', String(b.height));
    copy.style.color = getComputedStyle(svg).color;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    svgs.set(svg, img);
    return img.decode().catch(() => svgs.delete(svg));
  }));

  const text = (t: Text, cs: CSSStyleDeclaration) => {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : `${parseFloat(cs.letterSpacing) * s}px`;
    ctx.textBaseline = 'alphabetic';
    const range = document.createRange();
    for (const m of t.data.matchAll(/\S+/g)) {
      range.setStart(t, m.index);
      range.setEnd(t, m.index + m[0].length);
      const b = range.getClientRects()[0];
      if (!b) continue;
      const ascent = ctx.measureText(m[0]).fontBoundingBoxAscent;
      ctx.fillText(m[0], b.left - r.left, b.top - r.top + (ascent ?? b.height * 0.78));
    }
  };

  const walk = (e: Element, alpha: number) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const a = e === node ? alpha : alpha * parseFloat(cs.opacity);
    if (a <= 0.003) return;
    const b = e.getBoundingClientRect();
    const x = b.left - r.left, y = b.top - r.top, w = b.width, h = b.height;
    const rad = radiusOf(cs.borderTopLeftRadius, w, h, s);
    ctx.globalAlpha = a;
    if (painted(cs.backgroundColor)) {
      rr(ctx, x, y, w, h, rad);
      ctx.fillStyle = cs.backgroundColor;
      ctx.fill();
    }
    const bw = parseFloat(cs.borderTopWidth) * s;
    if (bw > 0 && cs.borderTopStyle !== 'none' && painted(cs.borderTopColor)) {
      rr(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, rad - bw / 2));
      ctx.strokeStyle = cs.borderTopColor;
      ctx.lineWidth = bw;
      ctx.stroke();
    }
    const img = svgs.get(e) ?? (e instanceof HTMLImageElement && e.complete && e.naturalWidth ? e : e instanceof HTMLCanvasElement ? e : null);
    if (img) {
      ctx.save();
      rr(ctx, x, y, w, h, rad);
      ctx.clip();
      const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width, ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
      const fitMode = img === e && e instanceof HTMLImageElement ? cs.objectFit : 'fill';
      if ((fitMode === 'cover' || fitMode === 'contain') && iw && ih) {
        const k = (fitMode === 'cover' ? Math.max : Math.min)(w / iw, h / ih);
        ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
      } else ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      return;
    }
    const clip = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    if (clip) {
      ctx.save();
      rr(ctx, x, y, w, h, rad);
      ctx.clip();
    }
    for (const child of e.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element, a);
      else if (child.nodeType === Node.TEXT_NODE) { ctx.globalAlpha = a; text(child as Text, cs); }
    }
    if (clip) ctx.restore();
  };
  walk(node, 1);
  return { source, x: r.left, y: r.top, w: r.width, h: r.height };
}
