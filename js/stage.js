// 共享 SVG 画布：底图 / 区域 / 结构 / 线槽 / 连线 / 尺寸 / 设备（含拖拽吸附、框选）
import { s, clamp } from './util.js';
import { DEVICE_MAP, ROOM_MAP, POWER_LABEL } from './catalog.js';
import { normRect } from './state.js';

export const GRID = 20;
export const POWER_FILL = { strong: '#fff4e0', weak: '#e8f1ff', passive: '#f1f5f9' };
export const POWER_STROKE = { strong: '#f59e0b', weak: '#3b82f6', passive: '#94a3b8' };

export class Stage {
  constructor(container, p, opts = {}) {
    this.p = p; this.opts = opts;
    this.zoom = 1; this.pan = { x: 0, y: 0 };
    this.selected = new Set(opts.selectedIds || []);
    this.selection = null;
    this.dragging = null;
    this.mode = opts.mode || 'select';      // select | 视图自管理交互
    this.showDims = opts.layers?.dims !== false;
    this.onSelect = opts.onSelect || (() => {});
    this.onMove = opts.onMove || (() => {});
    this.onCanvasDown = opts.onCanvasDown || (() => {});
    this.onDropDevice = opts.onDropDevice || (() => {});
    this.onDoubleClick = opts.onDoubleClick || (() => {});
    this.hoverId = null;

    container.innerHTML = '';
    this.wrap = container;
    this.svg = s('svg', { id: 'stage', xmlns: 'http://www.w3.org/2000/svg' });
    this.root = s('g', { class: 'world' });
    this.bgLayer = s('g'); this.zoneLayer = s('g'); this.structLayer = s('g');
    this.conduitLayer = s('g'); this.linkLayer = s('g'); this.dimLayer = s('g');
    this.devLayer = s('g', { class: 'devices' }); this.fxLayer = s('g');
    this.root.append(this.bgLayer, this.zoneLayer, this.structLayer, this.conduitLayer, this.linkLayer, this.dimLayer, this.devLayer, this.fxLayer);
    this.svg.appendChild(this.root);
    container.appendChild(this.svg);

    this._bind();
    this.resize();
    this.render();
  }
  setLayers(v) { this.opts.layers = { ...this.opts.layers, ...v }; this.render(); }
  setMode(m) { this.mode = m; }
  resize() {
    const r = this.wrap.getBoundingClientRect();
    this.vw = r.width; this.vh = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  }
  toWorld(evt) {
    const r = this.svg.getBoundingClientRect();
    const x = (evt.clientX - r.left) / r.width * this.vw;
    const y = (evt.clientY - r.top) / r.height * this.vh;
    return { x: (x - this.pan.x) / this.zoom, y: (y - this.pan.y) / this.zoom, clientX: evt.clientX, clientY: evt.clientY };
  }
  zoomAt(z, pt) {
    const nz = clamp(z, 0.3, 2.5);
    const wx = (pt.x - this.pan.x) / this.zoom, wy = (pt.y - this.pan.y) / this.zoom;
    this.zoom = nz;
    this.pan.x = pt.x - wx * nz; this.pan.y = pt.y - wy * nz;
    this.apply();
  }
  apply() { this.root.setAttribute('transform', `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`); }
  fit() {
    const pad = 40;
    const z = Math.min((this.vw - pad * 2) / this.p.width, (this.vh - pad * 2) / this.p.height, 1);
    this.zoom = z;
    this.pan.x = (this.vw - this.p.width * z) / 2;
    this.pan.y = (this.vh - this.p.height * z) / 2;
    this.apply();
  }

  _bind() {
    const svg = this.svg;
    this._hDown = e => this._down(e);
    this._hMove = e => this._move(e);
    this._hUp = e => this._up(e);
    this._hWheel = e => { e.preventDefault(); const pt = this.toWorld(e); this.zoomAt(this.zoom * (e.deltaY < 0 ? 1.12 : 0.89), pt); };
    this._hDbl = e => { const w = this.toWorld(e); this.onDoubleClick(w, e); };
    svg.addEventListener('pointerdown', this._hDown);
    svg.addEventListener('pointermove', this._hMove);
    window.addEventListener('pointerup', this._hUp);
    svg.addEventListener('wheel', this._hWheel, { passive: false });
    svg.addEventListener('dblclick', this._hDbl);
    const ro = new ResizeObserver(() => { this.resize(); this.apply(); });
    ro.observe(this.wrap);
    this._ro = ro;
  }
  destroy() {
    this._ro.disconnect();
    this.svg.removeEventListener('pointerdown', this._hDown);
    this.svg.removeEventListener('pointermove', this._hMove);
    window.removeEventListener('pointerup', this._hUp);
    this.svg.removeEventListener('wheel', this._hWheel);
    this.svg.removeEventListener('dblclick', this._hDbl);
  }

  _hitDevice(w) {
    let best = null, bd = 22 * 22 / (this.zoom * this.zoom);
    for (const d of this.p.devices) {
      const dd = (d.x - w.x) ** 2 + (d.y - w.y) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }
  _down(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this._panning = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y };
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    const w = this.toWorld(e);
    const hit = this._hitDevice(w);
    if (hit && this.mode === 'select' && !this.opts.readonly) {
      if (!this.selected.has(hit.id)) {
        if (e.shiftKey) this.selected.add(hit.id);
        else { this.selected.clear(); this.selected.add(hit.id); }
      }
      this.dragging = {
        start: w,
        orig: [...this.p.devices].filter(d => this.selected.has(d.id)).map(d => ({ d, x: d.x, y: d.y })),
        moved: false, guides: null,
      };
      this.onSelect([...this.selected]);
      this.svg.setPointerCapture(e.pointerId);
      this.render();
    } else {
      if (!e.shiftKey && this.mode === 'select') { this.selected.clear(); this.onSelect([]); this.render(); }
      this.onCanvasDown(w, e, this);
    }
  }
  _move(e) {
    if (this._panning) {
      const k = this.vw / this.svg.getBoundingClientRect().width;
      this.pan.x = this._panning.px + (e.clientX - this._panning.x) * k;
      this.pan.y = this._panning.py + (e.clientY - this._panning.y) * k;
      this.apply();
      return;
    }
    const w = this.toWorld(e);
    if (this.dragging) {
      let dx = w.x - this.dragging.start.x, dy = w.y - this.dragging.start.y;
      this.dragging.moved = true;
      const guides = computeGuides(this.p, this.dragging.orig.map(o => o.d), dx, dy);
      if (guides.x) dx += guides.x.adjust;
      if (guides.y) dy += guides.y.adjust;
      // 网格吸附（Shift 临时关闭）
      if (!e.shiftKey) {
        const first = this.dragging.orig[0];
        const nx = first.x + dx, ny = first.y + dy;
        const gx = Math.round(nx / GRID) * GRID - first.x;
        const gy = Math.round(ny / GRID) * GRID - first.y;
        dx = gx; dy = gy;
      }
      this.dragging.guides = guides;
      for (const { d, x, y } of this.dragging.orig) { d.x = Math.round(x + dx); d.y = Math.round(y + dy); }
      this.onMove([...this.selected]);
      this.render();
      this._drawGuides(guides);
    }
  }
  _up(e) {
    if (this._panning) { this._panning = null; return; }
    if (this.dragging) {
      if (this.dragging.moved) this.onMove([...this.selected], true);
      this.dragging = null;
      this.render();
    }
  }
  _drawGuides(guides) {
    const g = this.fxLayer; g.innerHTML = '';
    if (guides.x) g.appendChild(s('line', { x1: guides.x.coord, y1: 0, x2: guides.x.coord, y2: this.p.height, stroke: '#ef4444', 'stroke-dasharray': '6 6', 'stroke-width': 1.5 / this.zoom }));
    if (guides.y) g.appendChild(s('line', { x1: 0, y1: guides.y.coord, x2: this.p.width, y2: guides.y.coord, stroke: '#ef4444', 'stroke-dasharray': '6 6', 'stroke-width': 1.5 / this.zoom }));
  }
  clearFx() { this.fxLayer.innerHTML = ''; }

  // ---------------- 渲染 ----------------
  render() {
    const L = this.opts.layers || {};
    this.bgLayer.innerHTML = ''; this.zoneLayer.innerHTML = ''; this.structLayer.innerHTML = '';
    this.conduitLayer.innerHTML = ''; this.linkLayer.innerHTML = ''; this.dimLayer.innerHTML = '';
    this.devLayer.innerHTML = '';
    const p = this.p;

    this.bgLayer.appendChild(s('rect', { x: 0, y: 0, width: p.width, height: p.height, fill: '#fff', stroke: '#cbd5e1', 'stroke-width': 2 }));
    if (p.bgImage && L.bg !== false) {
      const img = s('image', { href: p.bgImage, x: 0, y: 0, width: p.width, height: p.height, opacity: 0.85, preserveAspectRatio: 'none' });
      this.bgLayer.appendChild(img);
    } else if (L.grid !== false) {
      for (let x = GRID; x < p.width; x += GRID) this.bgLayer.appendChild(s('line', { x1: x, y1: 0, x2: x, y2: p.height, stroke: '#eef2f7', 'stroke-width': 1 }));
      for (let y = GRID; y < p.height; y += GRID) this.bgLayer.appendChild(s('line', { x1: 0, y1: y, x2: p.width, y2: y, stroke: '#eef2f7', 'stroke-width': 1 }));
    }

    if (L.zones !== false) p.zones.forEach(z => this.zoneLayer.appendChild(zoneShape(z)));
    if (L.structures !== false) p.structures.forEach(st => this.structLayer.appendChild(structShape(st)));
    if (L.conduits !== false) p.conduits.forEach(c => this.conduitLayer.appendChild(conduitShape(c)));

    // 配电箱
    if (L.panel !== false) this.conduitLayer.appendChild(panelShape(p));

    if (L.links !== false) {
      const dm = new Map(p.devices.map(d => [d.id, d]));
      p.links.forEach(lk => {
        const a = dm.get(lk.from), b = dm.get(lk.to);
        if (!a || !b) return;
        const color = lk.kind === 'switch' ? '#f59e0b' : '#3b82f6';
        const g = s('g', {});
        g.appendChild(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-width': 2, 'stroke-dasharray': lk.kind === 'switch' ? 'none' : '5 4', opacity: 0.75 }));
        g.appendChild(s('circle', { cx: b.x, cy: b.y, r: 3.5, fill: color }));
        this.linkLayer.appendChild(g);
      });
    }

    if (L.dims !== false) p.dims.forEach(d => this.dimLayer.appendChild(dimShape(d, p.scale)));

    if (L.devices !== false) p.devices.forEach(d => this.devLayer.appendChild(deviceShape(d, {
      selected: this.selected.has(d.id),
      labels: L.labels !== false,
      highlightZones: this.opts.highlightZones,
      linkTarget: this.opts.linkTarget,
    })));

    this.apply();
  }
  setSelected(ids) {
    this.selected = new Set(ids);
    this.render();
  }
}

function zoneShape(z) {
  const g = s('g', { class: 'zone' });
  if (z.rect) {
    const r = normRect(z.rect);
    g.appendChild(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, fill: z.color, 'fill-opacity': 0.18, stroke: z.color, 'stroke-width': 2.5, 'stroke-dasharray': '10 6' }));
    g.appendChild(s('rect', { x: r.x, y: r.y, width: 54, height: 22, rx: 6, fill: z.color, opacity: 0.9 }));
    g.appendChild(labelAt(r.x + 8, r.y + 15, (ROOM_MAP[z.roomType]?.icon || '') + ' ' + z.name, '#fff'));
  } else if (z.poly) {
    const pts = z.poly.map(q => q.join(',')).join(' ');
    g.appendChild(s('polygon', { points: pts, fill: z.color, 'fill-opacity': 0.18, stroke: z.color, 'stroke-width': 2.5, 'stroke-dasharray': '10 6' }));
    const cx = z.poly.reduce((a, q) => a + q[0], 0) / z.poly.length;
    const cy = z.poly.reduce((a, q) => a + q[1], 0) / z.poly.length;
    const t = s('text', { x: cx, y: cy, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: z.color }, (ROOM_MAP[z.roomType]?.icon || '') + ' ' + z.name);
    g.appendChild(t);
  }
  return g;
}
function labelAt(x, y, text, fill) {
  return s('text', { x, y, 'font-size': 13, 'font-weight': 700, fill }, text);
}

function structShape(st) {
  const g = s('g');
  const r = normRect(st);
  const styles = {
    wall: { fill: '#e2e8f0', stroke: '#94a3b8', name: '墙体' },
    bearing: { fill: '#94a3b8', stroke: '#475569', name: '承重墙' },
    beam: { fill: '#fde68a', stroke: '#d97706', name: '梁' },
    column: { fill: '#64748b', stroke: '#1e293b', name: '结构柱' },
  };
  const c = styles[st.kind] || styles.wall;
  g.appendChild(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 2, fill: c.fill, stroke: c.stroke, 'stroke-width': 1.5 }));
  if (st.kind === 'bearing') {
    g.appendChild(s('line', { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, stroke: c.stroke, 'stroke-width': 1, opacity: .5 }));
    g.appendChild(s('line', { x1: r.x + r.w, y1: r.y, x2: r.x, y2: r.y + r.h, stroke: c.stroke, 'stroke-width': 1, opacity: .5 }));
  }
  const t = s('text', { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: c.stroke, 'font-weight': 700, pointerevents: 'none' }, c.name);
  g.appendChild(t);
  return g;
}

function conduitShape(c) {
  const g = s('g');
  const d = c.route.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join(' ');
  const color = c.kind === 'strong' ? '#f59e0b' : c.kind === 'weak' ? '#3b82f6' : '#7c3aed';
  g.appendChild(s('path', { d, fill: 'none', stroke: color, 'stroke-width': c.kind === 'bridge' ? 10 : 5, opacity: c.kind === 'bridge' ? 0.85 : 0.9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  g.appendChild(s('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 1.2, 'stroke-dasharray': '2 8', opacity: .8 }));
  if (c.name) {
    const mid = c.route[Math.floor(c.route.length / 2)];
    const t = s('text', { x: mid.x, y: mid.y - 8, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: color }, c.name);
    g.appendChild(t);
  }
  return g;
}

function panelShape(p) {
  const g = s('g');
  g.appendChild(s('rect', { x: p.panel.x - 18, y: p.panel.y - 14, width: 36, height: 28, rx: 5, fill: '#1e293b', stroke: '#0f172a', 'stroke-width': 2 }));
  g.appendChild(s('text', { x: p.panel.x, y: p.panel.y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fbbf24', 'font-weight': 700, pointerevents: 'none' }, '配电箱'));
  return g;
}

function dimShape(dm, scale) {
  const { a, b } = dm;
  const lenPx = Math.hypot(b.x - a.x, b.y - a.y);
  const lenM = (lenPx * scale).toFixed(2);
  const g = s('g');
  g.appendChild(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#0ea5e9', 'stroke-width': 1.5 }));
  g.appendChild(s('circle', { cx: a.x, cy: a.y, r: 3.5, fill: '#0ea5e9' }));
  g.appendChild(s('circle', { cx: b.x, cy: b.y, r: 3.5, fill: '#0ea5e9' }));
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const tw = 46;
  g.appendChild(s('rect', { x: mx - tw / 2, y: my - 20, width: tw, height: 16, rx: 4, fill: '#0ea5e9' }));
  g.appendChild(s('text', { x: mx, y: my - 8, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff', pointerevents: 'none' }, lenM + 'm'));
  return g;
}

export function deviceShape(d, o = {}) {
  const def = DEVICE_MAP[d.type] || { name: d.type, color: '#64748b', icon: '❓' };
  const g = s('g', { class: 'device', transform: `translate(${d.x} ${d.y}) rotate(${d.rotation || 0})`, 'data-id': d.id });
  if (o.selected) {
    g.appendChild(s('circle', { r: 20, fill: 'none', stroke: '#2f6bff', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
  }
  g.appendChild(s('circle', { r: 15, fill: POWER_FILL[def.power] || '#f1f5f9', stroke: POWER_STROKE[def.power] || '#94a3b8', 'stroke-width': 2.5 }));
  g.appendChild(s('text', { y: 5, 'text-anchor': 'middle', 'font-size': 15, pointerevents: 'none' }, def.icon || '●'));
  // 强弱电角标
  const badge = def.power === 'strong' ? { t: '强', c: '#f59e0b' } : def.power === 'weak' ? { t: '弱', c: '#3b82f6' } : null;
  if (badge) g.appendChild(s('text', { x: 11, y: -8, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 800, fill: badge.c, pointerevents: 'none' }, badge.t));
  if (o.labels !== false) {
    const label = d.name || def.name;
    const tw = label.length * 6.5 + 10;
    g.appendChild(s('rect', { x: -tw / 2, y: 20, width: tw, height: 17, rx: 4, fill: 'rgba(255,255,255,.92)', stroke: POWER_STROKE[def.power] || '#cbd5e1', 'stroke-width': .8, pointerevents: 'none' }));
    g.appendChild(s('text', { y: 32, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600, fill: '#334155', pointerevents: 'none' }, label));
  }
  return g;
}

function computeGuides(p, moving, dx, dy) {
  const res = { x: null, y: null };
  const TOL = 10;
  const anchors = [];
  p.devices.forEach(d => { if (!moving.some(m => m.id === d.id)) anchors.push({ x: d.x, y: d.y }); });
  anchors.push({ x: p.panel.x, y: p.panel.y });
  const a = moving[0];
  if (!a) return res;
  const px = a.x + dx, py = a.y + dy;
  for (const t of anchors) {
    if (!res.x && Math.abs(px - t.x) <= TOL) res.x = { coord: t.x, adjust: t.x - px };
    if (!res.y && Math.abs(py - t.y) <= TOL) res.y = { coord: t.y, adjust: t.y - py };
    if (res.x && res.y) break;
  }
  return res;
}
