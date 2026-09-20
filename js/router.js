// 网格 A* 自动线管走线：绕开承重墙/梁/柱，曼哈顿启发式 + 转弯惩罚
import { normRect } from './state.js';

const STEP = 30;          // 网格 30px
const PAD = 28;           // 结构外扩安全距离

export function buildGrid(p) {
  const W = Math.ceil(p.width / STEP), H = Math.ceil(p.height / STEP);
  const blocked = new Uint8Array(W * H);
  const rects = p.structures
    .filter(s => (s.kind === 'bearing' || s.kind === 'beam' || s.kind === 'column') && s.w != null)
    .map(s => normRect(s));
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor((r.x - PAD) / STEP));
    const y0 = Math.max(0, Math.floor((r.y - PAD) / STEP));
    const x1 = Math.min(W - 1, Math.ceil((r.x + r.w + PAD) / STEP));
    const y1 = Math.min(H - 1, Math.ceil((r.y + r.h + PAD) / STEP));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[y * W + x] = 1;
  }
  return { W, H, blocked };
}

function key(x, y, dir) { return (y * 0) + ''; } // placeholder removed below

export function autoRoute(p, start, end, opts = {}) {
  const { W, H, blocked } = opts.grid || buildGrid(p);
  const sx = clampCell(Math.round(start.x / STEP), W), sy = clampCell(Math.round(start.y / STEP), H);
  const ex = clampCell(Math.round(end.x / STEP), W), ey = clampCell(Math.round(end.y / STEP), H);
  // 若起终点在障碍格内，寻找最近可行格
  const sFix = nearestFree(blocked, W, H, sx, sy);
  const eFix = nearestFree(blocked, W, H, ex, ey);
  const startNode = sFix || { x: sx, y: sy }, endNode = eFix || { x: ex, y: ey };

  const dirs = [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]];
  const TURN = 4;
  const open = new MinHeap();
  const came = new Map();
  const gScore = new Map();
  const startKey = startNode.y * W + startNode.x;
  gScore.set(startKey, 0);
  open.push({ f: heur(startNode, endNode), x: startNode.x, y: startNode.y, dir: -1 });

  let found = null;
  let guard = 0;
  while (open.size() && guard++ < 60000) {
    const cur = open.pop();
    const ck = cur.y * W + cur.x;
    if (cur.x === endNode.x && cur.y === endNode.y) { found = cur; break; }
    for (const [dx, dy, d] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx]) continue;
      const nk = ny * W + nx;
      const turn = cur.dir !== -1 && cur.dir !== d ? TURN : 0;
      const ng = (gScore.get(ck) ?? Infinity) + 1 + turn;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, { px: cur.x, py: cur.y, d });
        open.push({ f: ng + heur({ x: nx, y: ny }, endNode), x: nx, y: ny, dir: d });
      }
    }
  }
  if (!found) return null;
  const cells = [];
  let cx = endNode.x, cy = endNode.y;
  cells.push([cx, cy]);
  while (!(cx === startNode.x && cy === startNode.y)) {
    const pr = came.get(cy * W + cx);
    if (!pr) return null;
    cx = pr.px; cy = pr.py; cells.push([cx, cy]);
  }
  cells.reverse();
  // 起点/终点若在障碍内被吸附到最近自由格，则首尾使用自由格坐标，避免末段穿墙
  const startPt = startNode.x === sx && startNode.y === sy ? { x: start.x, y: start.y } : { x: startNode.x * STEP, y: startNode.y * STEP };
  const endPt = endNode.x === ex && endNode.y === ey ? { x: end.x, y: end.y } : { x: endNode.x * STEP, y: endNode.y * STEP };
  const pts = [startPt];
  let lastDir = null;
  for (let i = 0; i < cells.length; i++) {
    const pt = { x: cells[i][0] * STEP, y: cells[i][1] * STEP };
    if (i < cells.length - 1) {
      const dir = cells[i + 1][0] - cells[i][0] ? 'x' : 'y';
      if (dir !== lastDir) {
        if (pts.length && i > 0) pts.push(pt);
        lastDir = dir;
      }
    }
  }
  pts.push(endPt);
  // 简化为正交折线（移除中间共线）
  const route = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = route[route.length - 1], b = pts[i], c = pts[i + 1];
    if (!((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))) route.push(b);
  }
  route.push(pts[pts.length - 1]);
  return dedupe(route);
}

function dedupe(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = out[out.length - 1];
    if (Math.hypot(l.x - pts[i].x, l.y - pts[i].y) > 1) out.push(pts[i]);
  }
  return out;
}
function clampCell(v, max) { return Math.max(0, Math.min(v, max - 1)); }
function heur(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function nearestFree(blocked, W, H, x, y) {
  if (!blocked[y * W + x]) return null;
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!blocked[ny * W + nx] && Math.abs(dx) + Math.abs(dy) === r) return { x: nx, y: ny };
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}
