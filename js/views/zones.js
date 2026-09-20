import { h, s, $, $$, uid, toast, modal } from '../util.js';
import { store } from '../state.js';
import { Stage } from '../stage.js';
import { ROOM_TYPES, ROOM_MAP } from '../catalog.js';

export function mount(root) {
  const p = store.project;
  let mode = 'rect'; // rect | poly
  let pending = null; // {roomType, rect:{x,y,w,h}} 或 {roomType, pts:[x,y]}
  let ghost = null;

  const canvasBox = h('div', { class: 'canvas-wrap', style: 'height:100%' });

  const zoneList = h('div', { class: 'zone-list' });
  const editor = h('div', { class: 'editor' }, [
    h('div', { class: 'panel' }, [
      h('div', { class: 'panel-h' }, '区域类型'),
      h('div', { class: 'panel-b' }, [
        h('div', { class: 'tabs' }, [
          h('button', { class: 'on', id: 'tab-rect', onclick: () => { mode = 'rect'; $('#tab-rect').classList.add('on'); $('#tab-poly').classList.remove('on'); } }, '矩形框选'),
          h('button', { id: 'tab-poly', onclick: () => { mode = 'poly'; $('#tab-poly').classList.add('on'); $('#tab-rect').classList.remove('on'); } }, '多边形'),
        ]),
        h('div', { class: 'lib-group' }, ROOM_TYPES.map(r =>
          h('div', {
            class: 'lib-item room-item', 'data-type': r.type,
            draggable: false,
            onclick: () => {
              $$('.room-item', editor).forEach(el => el.classList.toggle('on', el.dataset.type === r.type));
              pending = { roomType: r.type };
              hint.textContent = mode === 'rect'
                ? `已选「${r.name}」：在画布上按住拖出矩形区域`
                : `已选「${r.name}」：依次点击描绘多边形顶点，双击闭合`;
            },
          }, [h('span', { class: 'li-ico', style: `background:${r.color}33` }, r.icon), h('span', {}, r.name)])
        )),
      ]),
    ]),
    canvasBox,
    h('div', { class: 'panel props-col' }, [
      h('div', { class: 'panel-h' }, '区域列表'),
      h('div', { class: 'panel-b' }, [
        zoneList,
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:12px 0' }),
        h('button', { class: 'btn primary', style: 'width:100%', onclick: () => { store.markStep('zones', true); store.rezoneDevices(); location.hash = '#/layout'; } }, '下一步：拖入设备 →'),
        h('p', { class: 'muted', style: 'font-size:11.5px;line-height:1.6;margin-top:10px' }, '设备拖入区域会自动归属；双击区域可重命名或删除。'),
      ]),
    ]),
  ]);
  root.appendChild(editor);

  const hint = h('div', { class: 'canvas-hint' }, '先在左侧选择房间类型，再在画布上框选区域；多边形模式依次点顶点、双击闭合');
  canvasBox.appendChild(hint);
  const toolbar = h('div', { class: 'canvas-toolbar' }, [
    h('button', { class: 'toolbtn', title: '放大', onclick: () => stage.zoomAt(stage.zoom * 1.2, center()) }, '➕'),
    h('button', { class: 'toolbtn', title: '缩小', onclick: () => stage.zoomAt(stage.zoom / 1.2, center()) }, '➖'),
    h('button', { class: 'toolbtn', title: '适配', onclick: () => stage.fit() }, '⛶'),
    h('button', { class: 'toolbtn', title: '撤销当前绘制', onclick: () => { pending = null; stage.clearFx(); ghost = null; } }, '↩'),
  ]);
  canvasBox.appendChild(toolbar);

  const stage = new Stage(canvasBox, p, {
    layers: { devices: false, links: false, dims: false, panel: false, conduits: false, structures: true },
    onCanvasDown: (w, e) => {
      if (!pending) { toast('请先在左侧选择区域类型', 'warn'); return; }
      e.stopPropagation();
      if (mode === 'rect') {
        pending.start = { x: w.x, y: w.y };
      } else {
        pending.pts = pending.pts || [];
        pending.pts.push({ x: w.x, y: w.y });
        redrawPoly();
      }
    },
  });
  stage.setMode('custom');

  canvasBox.addEventListener('pointermove', e => {
    if (!pending || mode !== 'rect' || !pending.start) return;
    const w = stage.toWorld(e);
    if (ghost) ghost.remove();
    const tpl = ROOM_MAP[pending.roomType];
    ghost = stage.fxLayer.appendChild(s('rect', {
      x: Math.min(pending.start.x, w.x), y: Math.min(pending.start.y, w.y),
      width: Math.abs(w.x - pending.start.x), height: Math.abs(w.y - pending.start.y),
      fill: tpl.color, 'fill-opacity': .25, stroke: tpl.color, 'stroke-width': 2, 'stroke-dasharray': '8 5',
    }));
  });
  window.addEventListener('pointerup', onUp);
  function onUp(e) {
    if (!pending || mode !== 'rect' || !pending.start) return;
    const w = stage.toWorld(e);
    const rect = { x: Math.round(pending.start.x), y: Math.round(pending.start.y), w: Math.round(w.x - pending.start.x), h: Math.round(w.y - pending.start.y) };
    pending.start = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (Math.abs(rect.w) < 30 || Math.abs(rect.h) < 30) { stage.clearFx(); return; }
    commit({ rect });
  }
  canvasBox.addEventListener('dblclick', e => {
    if (mode !== 'poly' || !pending || !pending.pts || pending.pts.length < 3) return;
    e.stopPropagation();
    const pts = pending.pts;
    pending = null; stage.clearFx();
    commit({ poly: pts.map(q => [q.x, q.y]) });
  });

  function redrawPoly() {
    stage.clearFx();
    if (!pending.pts || !pending.pts.length) return;
    const tpl = ROOM_MAP[pending.roomType];
    const pts = pending.pts.map(q => q.x + ',' + q.y).join(' ');
    stage.fxLayer.appendChild(s('polygon', { points: pts, fill: tpl.color, 'fill-opacity': .25, stroke: tpl.color, 'stroke-width': 2, 'stroke-dasharray': '8 5' }));
    pending.pts.forEach(q => stage.fxLayer.appendChild(s('circle', { cx: q.x, cy: q.y, r: 4, fill: tpl.color })));
  }

  function commit(shape) {
    const tpl = ROOM_MAP[pending.roomType];
    const n = p.zones.filter(z => z.roomType === pending.roomType).length + 1;
    const zone = {
      id: uid('z'), roomType: pending.roomType, name: tpl.name + (n > 1 ? n : ''),
      color: tpl.color, ...shape,
    };
    store.mutate(pp => { pp.zones.push(zone); pp.devices.forEach(d => { if (!d.zoneId) d.zoneId = zoneAtOf(zone, d.x, d.y) || d.zoneId; }); });
    stage.clearFx();
    renderList();
    stage.render();
    toast('已添加「' + zone.name + '」', 'ok');
  }
  function zoneAtOf(z, x, y) {
    if (z.rect) {
      const r = { x: Math.min(z.rect.x, z.rect.x + z.rect.w), y: Math.min(z.rect.y, z.rect.y + z.rect.h), w: Math.abs(z.rect.w), h: Math.abs(z.rect.h) };
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? z.id : null;
    }
    return null;
  }

  function renderList() {
    zoneList.innerHTML = '';
    if (!p.zones.length) { zoneList.appendChild(h('div', { class: 'muted', style: 'font-size:12px;padding:8px' }, '还没有区域')); return; }
    p.zones.forEach(z => {
      const tpl = ROOM_MAP[z.roomType] || { icon: '⬚' };
      const n = p.devices.filter(d => d.zoneId === z.id).length;
      zoneList.appendChild(h('div', { class: 'zi' }, [
        h('span', { class: 'swatch', style: 'background:' + z.color }),
        h('span', { style: 'flex:1' }, [h('strong', { style: 'font-size:13px' }, `${tpl.icon} ${z.name}`), h('div', { class: 'muted', style: 'font-size:11px' }, n + ' 个点位')]),
        h('button', { class: 'btn small ghost', title: '重命名', onclick: () => renameZone(z) }, '✏️'),
        h('button', { class: 'btn small ghost danger', title: '删除', onclick: () => delZone(z) }, '🗑'),
      ]));
    });
  }
  function renameZone(z) {
    const inp = h('input', { value: z.name });
    modal({
      title: '重命名区域',
      body: h('label', { class: 'fld' }, ['区域名称', inp]),
      footer: [
        h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
        h('button', { class: 'btn primary', onclick: () => {
          store.mutate(pp => { const zz = pp.zones.find(x => x.id === z.id); if (zz) zz.name = inp.value || zz.name; });
          renderList(); stage.render(); $('#modal-host').classList.remove('show');
        } }, '保存'),
      ],
    });
  }
  function delZone(z) {
    if (!confirm(`删除区域「${z.name}」？区域内设备将变为未分区。`)) return;
    store.mutate(pp => { pp.zones = pp.zones.filter(x => x.id !== z.id); pp.devices.forEach(d => { if (d.zoneId === z.id) d.zoneId = null; }); });
    renderList(); stage.render();
  }

  canvasBox.addEventListener('dblclick', e => {
    if (mode === 'poly') return;
    const w = stage.toWorld(e);
    const z = [...p.zones].reverse().find(zz => {
      if (zz.rect) return zoneAtOf(zz, w.x, w.y) === zz.id;
      return false;
    });
    if (z) {
      if (confirm(`对「${z.name}」操作：确定=删除，取消=不做处理`)) delZone(z);
    }
  }, true);

  renderList();
  setTimeout(() => stage.fit(), 30);
  function center() { const r = canvasBox.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; }
  return () => { window.removeEventListener('pointerup', onUp); stage.destroy(); };
}
