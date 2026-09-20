// 通用工具：DOM / SVG / 几何 / 编解码 / 交互反馈
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  }
  return el;
}

export const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  }
  return el;
}

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const round = (n, d = 0) => { const p = 10 ** d; return Math.round(n * p) / p; };

export function toast(msg, type = '', ms = 2200) {
  const t = h('div', { class: 'toast ' + type }, msg);
  $('#toast-host').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms);
}

export function modal({ title, body, footer, wide }) {
  const host = $('#modal-host');
  host.innerHTML = '';
  const close = () => { host.classList.remove('show'); host.innerHTML = ''; };
  const m = h('div', { class: 'modal' + (wide ? ' wide' : '') }, [
    h('div', { class: 'modal-h' }, [h('span', {}, title), h('button', { class: 'x-close', onclick: close }, '✕')]),
    h('div', { class: 'modal-b' }, [].concat(body)),
    footer ? h('div', { class: 'modal-f' }, [].concat(footer)) : null,
  ]);
  host.appendChild(m);
  host.classList.add('show');
  host.onclick = (e) => { if (e.target === host) close(); };
  return { close, modal: m };
}

export function download(name, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('已复制到剪贴板', 'ok'); }
  catch {
    const ta = h('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); toast('已复制到剪贴板', 'ok');
  }
}

// ---- 线段/矩形几何（点位间距、障碍检测）----
export function pointSegDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (!l2) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}
export function segIntersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (!d) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u, x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) } : null;
}
export function pointInRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}
// 折线顶点（points:[{x,y}]）与点的最短距离
export function polylinePointDist(poly, pt) {
  let m = Infinity;
  for (let i = 0; i < poly.length - 1; i++) m = Math.min(m, pointSegDist(pt.x, pt.y, poly[i], poly[i + 1]));
  return m;
}

// ---- 压缩分享（gzip + base64url）----
function b64ToUrl(b64) { return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function urlToB64(u) { u = u.replace(/-/g, '+').replace(/_/g, '/'); while (u.length % 4) u += '='; return u; }
function bytesToB64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
export async function gzipEncode(obj) {
  const json = JSON.stringify(obj);
  try {
    const stream = new CompressionStream('gzip');
    const blob = new Blob([json]).stream().pipeThrough(stream);
    const buf = await new Response(blob).arrayBuffer();
    return 'gz:' + b64ToUrl(bytesToB64(new Uint8Array(buf)));
  } catch { return 'raw:' + b64ToUrl(btoa(unescape(encodeURIComponent(json)))); }
}
export async function gzipDecode(str) {
  const payload = str.slice(str.indexOf(':') + 1);
  const bin = urlToB64(payload);
  const bytes = Uint8Array.from(atob(bin), c => c.charCodeAt(0));
  if (str.startsWith('gz:')) {
    const stream = new DecompressionStream('gzip');
    const blob = new Blob([bytes]).stream().pipeThrough(stream);
    return JSON.parse(await new Response(blob).text());
  }
  return JSON.parse(decodeURIComponent(escape(atob(bin))));
}

export function fmtMoney(n) { return '¥' + (Math.round(n) || 0).toLocaleString('zh-CN'); }
