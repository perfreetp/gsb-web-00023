// 全局状态：多项目、版本快照、本地持久化、自动回路/区域归属
import { uid, gzipEncode, gzipDecode, clamp, download, toast } from './util.js';
import { DEFAULT_CIRCUITS, DEVICE_MAP, SCENE_TEMPLATES } from './catalog.js';

const LS_KEY = 'zhiju_projects_v1';
const listeners = new Set();

function blankProject(name) {
  const now = Date.now();
  return {
    id: uid('p'),
    name: name || '我的新家',
    createdAt: now, updated: now,
    width: 1400, height: 900,
    scale: 0.02,          // 米/像素（1px = 2cm），可在户型页校准
    area: 90,             // 建筑面积 m²（预算估算兜底）
    bgImage: null,
    zones: [],
    structures: [],       // {id,kind:wall|bearing|beam|column,x,y,w,h}
    devices: [],
    conduits: [],         // {id,kind:strong|weak|bridge,name,route:[{x,y}]}
    links: [],            // {id,kind:switch|signal,from,to}
    dims: [],             // {id,a:{x,y},b:{x,y}}
    panel: { x: 120, y: 120 },
    circuits: DEFAULT_CIRCUITS.map(c => ({ ...c, id: uid('c') })),
    scenes: [],
    prices: {},           // 价格覆盖
    versions: [],
    progress: {},         // 各步骤完成状态
  };
}

export const store = {
  projects: [],
  pid: null,

  init() {
    try { this.projects = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { this.projects = []; }
    // 恢复上次打开的项目
    try { this.pid = localStorage.getItem(LS_KEY + '_pid'); } catch {}
    if (this.pid && !this.projects.some(p => p.id === this.pid)) this.pid = null;
    if (!this.pid && this.projects.length) this.pid = this.projects[0].id;
  },
  persist() {
    if (!this.project) return;
    this.project.updated = Date.now();
    try { localStorage.setItem(LS_KEY + '_pid', this.pid); } catch {}
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.projects));
    } catch (e) {
      toast('本地存储空间不足，建议导出方案备份后压缩底图', 'warn', 4000);
    }
    listeners.forEach(fn => fn());
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  get project() { return this.projects.find(p => p.id === this.pid) || null; },
  open(id) {
    if (id && this.projects.some(p => p.id === id)) { this.pid = id; return true; }
    this.pid = null; return false;
  },
  create(name) {
    const p = blankProject(name);
    this.projects.unshift(p); this.pid = p.id;
    this.persist();
    return p;
  },
  remove(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    if (this.pid === id) this.pid = null;
    localStorage.setItem(LS_KEY, JSON.stringify(this.projects));
    listeners.forEach(fn => fn());
  },
  duplicate(id) {
    const src = this.projects.find(p => p.id === id);
    if (!src) return;
    const cp = JSON.parse(JSON.stringify(src));
    cp.id = uid('p'); cp.name = src.name + ' 副本';
    cp.createdAt = cp.updated = Date.now();
    cp.versions = [];
    this.projects.unshift(cp);
    this.persist();
    return cp;
  },
  rename(id, name) {
    const p = this.projects.find(x => x.id === id);
    if (p) { p.name = name; this.persist(); }
  },
  mutate(fn) {
    if (!this.project) return;
    fn(this.project);
    this.persist();
  },

  // ---------- 版本 ----------
  saveVersion(label) {
    const p = this.project; if (!p) return;
    const snap = JSON.parse(JSON.stringify({ ...p, versions: undefined }));
    p.versions.unshift({ id: uid('v'), label: label || '版本 ' + (p.versions.length + 1), time: Date.now(), snap });
    if (p.versions.length > 20) p.versions.length = 20;
    this.persist();
  },
  restoreVersion(vid) {
    const p = this.project; if (!p) return;
    const v = p.versions.find(x => x.id === vid);
    if (!v) return;
    const snap = JSON.parse(JSON.stringify(v.snap));
    const keep = p.versions;
    Object.keys(p).forEach(k => delete p[k]);
    Object.assign(p, snap, { versions: keep });
    this.persist();
  },
  deleteVersion(vid) {
    const p = this.project; if (!p) return;
    p.versions = p.versions.filter(v => v.id !== vid);
    this.persist();
  },

  // ---------- 导入导出 / 分享 ----------
  exportJSON() {
    const p = this.project;
    download(`${p.name}-布线方案.json`, JSON.stringify({ app: 'zhiju-buxian', v: 1, ...p }, null, 2), 'application/json');
  },
  async importJSON(file) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data.devices || !data.id) throw new Error('bad');
      data.id = uid('p'); data.versions = []; data.updated = Date.now();
      this.projects.unshift(data); this.pid = data.id;
      this.persist();
      return data;
    } catch { toast('文件格式不正确', 'err'); return null; }
  },
  async sharePayload() {
    const p = this.project;
    const pub = JSON.parse(JSON.stringify({ ...p, versions: undefined }));
    const code = await gzipEncode(pub);
    return location.origin + location.pathname + '#/share?d=' + code;
  },
  async loadShare(code) { return gzipDecode(code); },

  // ---------- 设备 ----------
  addDevice(type, x, y) {
    const p = this.project; if (!p) return null;
    const def = DEVICE_MAP[type]; if (!def) return null;
    const count = p.devices.filter(d => d.type === type).length + 1;
    const dev = {
      id: uid('d'), type, x, y, rotation: 0,
      name: def.name + '-' + String(count).padStart(2, '0'),
      zoneId: zoneAt(p, x, y),
      circuitId: suggestCircuit(p, def),
      qty: def.qty || 1, gang: def.gang || 1,
    };
    p.devices.push(dev);
    this.persist();
    return dev;
  },
  removeDevice(id) {
    const p = this.project;
    p.devices = p.devices.filter(d => d.id !== id);
    p.links = p.links.filter(l => l.from !== id && l.to !== id);
    this.persist();
  },
  rezoneDevices() {
    const p = this.project;
    p.devices.forEach(d => { d.zoneId = zoneAt(p, d.x, d.y); });
    this.persist();
  },

  // ---------- 开关回路自动连线 ----------
  autoLinkSwitches() {
    const p = this.project;
    const switches = p.devices.filter(d => /^switch_(smart|dumb|dimmer)/.test(d.type));
    const lights = p.devices.filter(d => d.type.startsWith('light_'));
    const linkedLights = new Set(p.links.filter(l => l.kind === 'switch').map(l => l.to));
    let added = 0;
    for (const sw of switches) {
      const candidates = lights
        .filter(l => !linkedLights.has(l.id) && (l.zoneId === sw.zoneId || !l.zoneId))
        .sort((a, b) => Math.hypot(a.x - sw.x, a.y - sw.y) - Math.hypot(b.x - sw.x, b.y - sw.y));
      const gang = sw.gang || 1;
      const have = p.links.filter(l => l.kind === 'switch' && l.from === sw.id).length;
      for (const l of candidates.slice(0, Math.max(0, gang - have))) {
        p.links.push({ id: uid('l'), kind: 'switch', from: sw.id, to: l.id });
        linkedLights.add(l.id); added++;
      }
    }
    this.persist();
    return added;
  },

  // ---------- 场景 ----------
  ensureScenes() {
    const p = this.project;
    SCENE_TEMPLATES.forEach(t => {
      if (!p.scenes.find(s => s.tpl === t.id)) {
        p.scenes.push({ id: uid('s'), tpl: t.id, name: t.name, icon: t.icon, desc: t.desc, enabled: true, acts: t.acts.map(a => ({ ...a })) });
      }
    });
    this.persist();
  },
  markStep(step, done) {
    const p = this.project; if (!p) return;
    p.progress[step] = !!done;
    this.persist();
  },
};

// ---------- 几何 / 归属 ----------
export function zoneAt(p, x, y) {
  for (const z of p.zones) {
    if (z.rect) {
      const r = normRect(z.rect);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return z.id;
    } else if (z.poly && pointInPoly(x, y, z.poly)) return z.id;
  }
  return null;
}
export function normRect(r) {
  return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) };
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function suggestCircuit(p, def) {
  if (def.power !== 'strong') return null;
  const byKind = {
    light_: 'light', switch_smart: 'light', switch_dumb: 'light',
    outlet_16a: 'ac', ac_: 'ac',
  };
  let want = 'outlet';
  if (def.type.startsWith('light_') || /switch_(smart|dumb)/.test(def.type)) want = 'light';
  if (def.type === 'outlet_16a' || def.type.startsWith('ac_') || def.type.startsWith('curtain_')) want = def.type.startsWith('curtain_') ? 'outlet' : 'ac';
  const c = p.circuits.find(c => c.kind === want) || p.circuits.find(c => c.kind === 'outlet');
  return c ? c.id : null;
}

export function progressOf(p) {
  if (!p) return 0;
  const steps = ['floor', 'zones', 'layout', 'wiring', 'panel'];
  const done = steps.filter(s => p.progress[s]).length;
  const base = done / steps.length * 0.9;
  const extra = (p.devices.length ? 0.05 : 0) + (p.versions.length ? 0.05 : 0);
  return clamp(base + extra, 0, 1);
}
