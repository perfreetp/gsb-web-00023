import { h, s, $, $$, toast, modal } from '../util.js';
import { store, normRect } from '../state.js';
import { Stage } from '../stage.js';

const TOOLS = [
  { k: 'select', icon: '🖱️', name: '选择/移动视图' },
  { k: 'wall', icon: '⬜', name: '普通墙' },
  { k: 'bearing', icon: '🧱', name: '承重墙（禁走管）' },
  { k: 'beam', icon: '📏', name: '梁（绕开）' },
  { k: 'column', icon: '⬛', name: '结构柱（绕开）' },
];

export function mount(root) {
  const p = store.project;
  let tool = 'select';
  let draw = null;

  const canvasBox = h('div', { class: 'canvas-wrap', style: 'height:100%' });
  const editor = h('div', { class: 'editor' }, [
    h('div', { class: 'panel' }, [
      h('div', { class: 'panel-h' }, '结构工具'),
      h('div', { class: 'panel-b' }, [
        h('div', { class: 'lib-group' }, TOOLS.map(t =>
          h('div', {
            class: 'lib-item tool-item' + (t.k === 'select' ? ' on' : ''),
            'data-k': t.k,
            onclick: () => { tool = t.k; $$('.tool-item', editor).forEach(el => el.classList.toggle('on', el.dataset.k === tool)); },
          }, [h('span', { class: 'li-ico', style: 'background:#f1f5f9' }, t.icon), h('span', {}, t.name)])
        )),
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:12px 0' }),
        h('button', { class: 'btn small', style: 'width:100%;margin-bottom:8px', onclick: uploadImage }, '🖼️ 上传户型图/手绘'),
        h('button', { class: 'btn small', style: 'width:100%;margin-bottom:8px', onclick: calibrate }, '📐 校准比例尺'),
        h('button', { class: 'btn small ghost danger', style: 'width:100%', onclick: clearImage }, '移除底图'),
        h('div', { style: 'margin-top:14px', class: 'muted' }, [
          h('div', { style: 'font-size:11.5px;line-height:1.7' }, `当前比例：1px = ${Math.round((p.scale || 0.02) * 1000)}mm`),
          h('div', { style: 'font-size:11.5px;line-height:1.7' }, `画布：${p.width}×${p.height}px`),
        ]),
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:12px 0' }),
        h('div', { class: 'legend' }, [
          h('span', {}, [h('i', { style: 'background:#94a3b8' }), '承重']),
          h('span', {}, [h('i', { style: 'background:#fde68a' }), '梁']),
          h('span', {}, [h('i', { style: 'background:#64748b' }), '柱']),
        ]),
      ]),
    ]),
    canvasBox,
    h('div', { class: 'panel props-col' }, [
      h('div', { class: 'panel-h' }, '操作提示'),
      h('div', { class: 'panel-b' }, [
        h('div', { class: 'check-list' }, [
          tip('1️⃣', '上传户型图或手绘照片作为底图（也可直接用空白画布绘制）。'),
          tip('2️⃣', '沿图上的墙拖出普通墙；承重墙、梁、柱一定要标出来，布线会自动绕开。'),
          tip('3️⃣', '用"校准比例尺"在图上量一段已知长度（如 3m 墙），后续线长统计才准确。'),
          tip('🖱️', 'Alt+拖拽或鼠标中键平移，滚轮缩放。'),
        ]),
        h('button', { class: 'btn primary', style: 'width:100%;margin-top:8px', onclick: next }, '下一步：划分区域 →'),
      ]),
    ]),
  ]);
  root.appendChild(editor);

  const toolbar = h('div', { class: 'canvas-toolbar' }, [
    tbtn('➕', '放大', () => stage.zoomAt(stage.zoom * 1.2, center())),
    tbtn('➖', '缩小', () => stage.zoomAt(stage.zoom / 1.2, center())),
    tbtn('⛶', '适配窗口', () => stage.fit()),
  ]);
  canvasBox.appendChild(toolbar);
  canvasBox.appendChild(h('div', { class: 'canvas-hint' }, '选中工具后在画布上按住拖拽绘制结构；承重墙/梁柱是自动绕管的依据'));

  const stage = new Stage(canvasBox, p, {
    layers: { devices: false, zones: false, links: false, dims: false, panel: false, conduits: false, labels: false },
    onCanvasDown: (w, e) => {
      if (tool === 'select') { startPan(e); return; }
      if (['wall', 'bearing', 'beam', 'column'].includes(tool)) {
        draw = { kind: tool, x: w.x, y: w.y, ghost: null };
      }
      e.stopPropagation();
    },
  });
  stage.setMode('custom');

  canvasBox.addEventListener('pointermove', e => {
    if (!draw) return;
    const w = stage.toWorld(e);
    if (draw.ghost) draw.ghost.remove();
    draw.ghost = stage.structLayer.appendChild(s('rect', {
      x: Math.min(draw.x, w.x), y: Math.min(draw.y, w.y),
      width: Math.abs(w.x - draw.x), height: Math.abs(w.y - draw.y),
      fill: { wall: '#e2e8f0', bearing: '#94a3b8', beam: '#fde68a', column: '#64748b' }[draw.kind],
      opacity: .5, stroke: '#334155', 'stroke-dasharray': '6 4',
    }));
  });
  window.addEventListener('pointerup', onUp);
  function onUp(e) {
    if (!draw) return;
    const w = stage.toWorld(e);
    const kind = draw.kind;
    const r = { x: Math.round(draw.x), y: Math.round(draw.y), w: Math.round(w.x - draw.x), h: Math.round(w.y - draw.y) };
    if (draw.ghost) draw.ghost.remove();
    draw = null;
    if (Math.abs(r.w) < 12 || Math.abs(r.h) < 12) { stage.render(); return; }
    store.mutate(pp => pp.structures.push({ id: 'st_' + Math.random().toString(36).slice(2, 7), kind, ...r }));
    stage.render();
  }
  canvasBox.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('rect') && tool === 'select') {
      // 点击结构删除（select 模式下右键删除：这里双击删除）
    }
  });
  canvasBox.addEventListener('dblclick', e => {
    if (tool !== 'select') return;
    const w = stage.toWorld(e);
    const hit = [...p.structures].reverse().find(st => {
      const r = normRect(st);
      return w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h;
    });
    if (hit && confirm('删除该结构？')) { store.mutate(pp => { pp.structures = pp.structures.filter(s => s.id !== hit.id); }); stage.render(); }
  });

  setTimeout(() => stage.fit(), 30);

  function center() { const r = canvasBox.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; }
  let panSave = null;
  function startPan(e) {
    panSave = { x: e.clientX, y: e.clientY, px: stage.pan.x, py: stage.pan.y };
    const mv = ev => {
      const k = stage.vw / stage.svg.getBoundingClientRect().width;
      stage.pan.x = panSave.px + (ev.clientX - panSave.x) * k;
      stage.pan.y = panSave.py + (ev.clientY - panSave.y) * k;
      stage.apply();
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function next() { store.markStep('floor', true); location.hash = '#/zones'; }
  function uploadImage() {
    const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          // 大图压缩，避免 localStorage 超限
          const maxD = 1800;
          const scale = Math.min(1, maxD / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = img.width * scale; cv.height = img.height * scale;
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          store.mutate(pp => { pp.bgImage = cv.toDataURL('image/jpeg', 0.82); });
          stage.render();
          toast('底图已上传，可沿墙描绘结构', 'ok');
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    document.body.appendChild(inp); inp.click(); inp.remove();
  }
  function clearImage() {
    if (!p.bgImage || confirm('确定移除底图？')) { store.mutate(pp => pp.bgImage = null); stage.render(); }
  }
  function calibrate() {
    let a = null, line = null, hint = h('div', { class: 'canvas-hint', style: 'bottom:48px' }, '校准：在图上点击一段已知长度墙的两个端点（第 1/2 点）');
    canvasBox.appendChild(hint);
    const handler = (e) => {
      const w = stage.toWorld(e);
      if (!a) {
        a = w;
      } else {
        const px = Math.hypot(w.x - a.x, w.y - a.y);
        canvasBox.removeEventListener('pointerdown', handler, true);
        hint.remove(); if (line) line.remove();
        const inp = h('input', { type: 'number', value: '3', step: '0.1', min: '0.1' });
        modal({
          title: '输入这段距离的实际长度',
          body: h('div', {}, [
            h('p', { class: 'muted' }, `图上距离 ${Math.round(px)}px`),
            h('label', { class: 'fld' }, ['实际长度（米）', inp]),
          ]),
          footer: [
            h('button', { class: 'btn', onclick: () => { $('#modal-host').classList.remove('show'); stage.render(); } }, '取消'),
            h('button', { class: 'btn primary', onclick: () => {
              const m = Number(inp.value);
              if (m > 0) { store.mutate(pp => pp.scale = m / px); toast('比例尺已更新，线长统计将按此计算', 'ok'); }
              $('#modal-host').classList.remove('show'); stage.render();
            } }, '确定'),
          ],
        });
      }
      if (a && !line) {
        line = stage.fxLayer.appendChild(s('circle', { cx: a.x, cy: a.y, r: 6, fill: '#0ea5e9' }));
      } else if (a && line) {
        stage.fxLayer.appendChild(s('line', { x1: a.x, y1: a.y, x2: w.x, y2: w.y, stroke: '#0ea5e9', 'stroke-width': 2 }));
      }
    };
    canvasBox.addEventListener('pointerdown', handler, true);
  }

  return () => { window.removeEventListener('pointerup', onUp); stage.destroy(); };
}

function tbtn(icon, title, fn) { return h('button', { class: 'toolbtn', title, onclick: fn }, icon); }
function tip(icon, text) {
  return h('div', { class: 'ci' }, [h('span', {}, icon), h('span', { class: 'muted', style: 'font-size:12.5px;line-height:1.6' }, text)]);
}
