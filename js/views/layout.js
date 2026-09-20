import { h, s, $, $$, uid, toast, modal } from '../util.js';
import { store } from '../state.js';
import { Stage } from '../stage.js';
import { DEVICE_CATALOG, DEVICE_MAP, POWER_LABEL, ROOM_MAP } from '../catalog.js';
import { summarize } from '../stats.js';

export function mount(root) {
  const p = store.project;
  const layers = { zones: true, structures: true, conduits: false, links: true, dims: true, panel: true, labels: true };
  let measure = null; // {a}
  let history = [], future = [];
  const snapshot = () => JSON.stringify({ devices: p.devices, links: p.links, dims: p.dims });
  const pushHist = () => { history.push(snapshot()); if (history.length > 40) history.shift(); future = []; };
  const undo = () => {
    if (!history.length) return toast('没有可撤销的操作', 'warn');
    future.push(snapshot());
    const s = history.pop();
    store.mutate(pp => Object.assign(pp, JSON.parse(s)));
    stage.render(); renderProps([]); renderStats();
  };
  const redo = () => {
    if (!future.length) return;
    history.push(snapshot());
    const s = future.pop();
    store.mutate(pp => Object.assign(pp, JSON.parse(s)));
    stage.render(); renderProps([]); renderStats();
  };

  const canvasBox = h('div', { class: 'canvas-wrap', style: 'height:100%' });
  const propsBox = h('div', { class: 'panel-b' });
  const statsBox = h('div', {});

  const editor = h('div', { class: 'editor' }, [
    h('div', { class: 'panel' }, [
      h('div', { class: 'panel-h' }, [h('span', {}, '设备库'), h('input', { placeholder: '搜索…', style: 'width:90px;padding:4px 8px', oninput: filterLib })]),
      h('div', { class: 'panel-b', id: 'lib-box' }, buildLib()),
    ]),
    canvasBox,
    h('div', { class: 'panel props-col' }, [
      h('div', { class: 'panel-h' }, '属性 / 信息'),
      propsBox,
      h('div', { style: 'padding:0 12px 12px' }, [
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:0 0 10px' }),
        statsBox,
      ]),
    ]),
  ]);
  root.appendChild(editor);

  function filterLib(e) {
    const q = e.target.value.trim();
    $$('.lib-group', $('#lib-box')).forEach(g => {
      const items = $$('.lib-item', g);
      let any = false;
      items.forEach(it => { const show = !q || it.textContent.includes(q); it.style.display = show ? '' : 'none'; if (show) any = true; });
      g.style.display = any ? '' : 'none';
    });
  }
  function buildLib() {
    const frag = document.createDocumentFragment();
    DEVICE_CATALOG.forEach(g => {
      frag.appendChild(h('div', { class: 'lib-group' }, [
        h('h5', {}, `${g.icon} ${g.group}`),
        ...g.items.map(it => h('div', {
          class: 'lib-item', draggable: true, title: POWER_LABEL[it.power] + '设备',
          ondragstart: e => { e.dataTransfer.setData('text/dev', it.type); e.dataTransfer.effectAllowed = 'copy'; },
        }, [
          h('span', { class: 'li-ico', style: `background:${g.color}22` }, g.icon),
          h('span', { style: 'flex:1' }, it.name),
          h('span', { class: 'tag ' + it.power }, POWER_LABEL[it.power]),
        ])),
      ]));
    });
    return frag;
  }

  const toolbar = h('div', { class: 'canvas-toolbar' }, [
    tb('➕', '放大', () => stage.zoomAt(stage.zoom * 1.2, center())),
    tb('➖', '缩小', () => stage.zoomAt(stage.zoom / 1.2, center())),
    tb('⛶', '适配', () => stage.fit()),
    tb('↩', '撤销', undo),
    tb('↪', '重做', redo),
    tb('📏', '尺寸标注', () => { measure = { active: true }; toast('点击标注的起点和终点', 'ok'); hint.textContent = '尺寸标注：依次点击两个点（会自动吸附到最近设备）'; }, true),
    tb('🗑️', '清除标注', () => { if (confirm('清除所有尺寸标注？')) { pushHist(); store.mutate(pp => pp.dims = []); stage.render(); } }),
  ]);
  canvasBox.appendChild(toolbar);
  const layerBox = h('div', { class: 'layer-toggles' }, [
    layerToggle('区域', 'zones', true),
    layerToggle('结构', 'structures', true),
    layerToggle('连线', 'links', true),
    layerToggle('尺寸', 'dims', true),
    layerToggle('名称', 'labels', true),
  ]);
  canvasBox.appendChild(layerBox);
  const hint = h('div', { class: 'canvas-hint' }, '从左侧设备库拖到画布；拖动设备自动吸附网格，出现红色辅助线时可对齐；Shift 拖动关闭吸附');
  canvasBox.appendChild(hint);

  const stage = new Stage(canvasBox, p, {
    layers,
    onSelect: ids => renderProps(ids),
    onMove: (ids, done) => {
      if (done) {
        store.mutate(pp => { pp.devices.forEach(d => { if (ids.includes(d.id)) d.zoneId = zoneAtLocal(pp, d.x, d.y); }); });
        renderProps(ids); renderStats();
      }
    },
    onCanvasDown: (w) => {
      if (measure?.active) {
        const snap = nearestDev(w) || w;
        if (!measure.a) { measure.a = snap; stage.fxLayer.appendChild(s('circle', { cx: snap.x, cy: snap.y, r: 6, fill: '#0ea5e9' })); }
        else {
          const a = measure.a, b = snap;
          pushHist();
          store.mutate(pp => pp.dims.push({ id: uid('dm'), a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } }));
          measure = null; stage.clearFx(); stage.render();
          hint.textContent = '从左侧设备库拖到画布；拖动设备自动吸附网格，出现红色辅助线时可对齐；Shift 拖动关闭吸附';
        }
      }
    },
  });

  canvasBox.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  canvasBox.addEventListener('drop', e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/dev');
    if (!type || !DEVICE_MAP[type]) return;
    const w = stage.toWorld(e);
    pushHist();
    const dev = store.addDevice(type, Math.round(w.x / 20) * 20, Math.round(w.y / 20) * 20);
    stage.setSelected([dev.id]);
    renderProps([dev.id]); renderStats();
    toast(`已放置 ${dev.name}（${POWER_LABEL[DEVICE_MAP[type].power]}）`, 'ok');
  });

  function nearestDev(w) {
    let best = null, bd = 30 * 30;
    p.devices.forEach(d => { const dd = (d.x - w.x) ** 2 + (d.y - w.y) ** 2; if (dd < bd) { bd = dd; best = d; } });
    return best;
  }

  function layerToggle(label, key, on) {
    const ck = h('input', { type: 'checkbox' });
    ck.checked = on;
    ck.onchange = () => { layers[key] = ck.checked; stage.setLayers({ [key]: ck.checked }); };
    return h('label', {}, [ck, label]);
  }
  function tb(icon, title, fn, toggle) {
    const b = h('button', { class: 'toolbtn', title, onclick: () => { fn(); if (toggle) b.classList.toggle('on'); } }, icon);
    return b;
  }

  function renderProps(ids) {
    propsBox.innerHTML = '';
    const sel = p.devices.filter(d => ids.includes(d.id));
    if (!sel.length) {
      propsBox.appendChild(h('div', { class: 'muted', style: 'padding:10px;font-size:12.5px;line-height:1.7' }, [
        h('div', {}, '未选中设备。'),
        h('div', { style: 'margin-top:6px' }, '点击点位查看/编辑名称、所属区域和配电箱回路；框选前请单选。'),
        h('div', { class: 'legend', style: 'margin-top:10px' }, [
          h('span', {}, [h('i', { style: 'background:#f59e0b' }), '强电']),
          h('span', {}, [h('i', { style: 'background:#3b82f6' }), '弱电']),
        ]),
      ]));
      return;
    }
    if (sel.length > 1) {
      propsBox.appendChild(h('div', { style: 'padding:10px' }, [
        h('strong', { style: 'font-size:13px' }, `已选 ${sel.length} 个点位`),
        h('p', { class: 'muted', style: 'font-size:12px' }, '可整体拖动对齐；单选可编辑详细属性。'),
      ]));
      return;
    }
    const d = sel[0], def = DEVICE_MAP[d.type];
    const nameInp = h('input', { value: d.name });
    nameInp.onchange = () => store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); if (x) x.name = nameInp.value; stage.render(); });
    const zoneSel = h('select', {}, [
      h('option', { value: '' }, '未分区'),
      ...p.zones.map(z => h('option', { value: z.id, selected: z.id === d.zoneId || false }, `${(ROOM_MAP[z.roomType] || {}).icon || ''} ${z.name}`)),
    ]);
    zoneSel.onchange = () => store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); if (x) x.zoneId = zoneSel.value || null; });
    const circSel = h('select', {}, [
      h('option', { value: '' }, '未分配'),
      ...p.circuits.filter(c => c.kind !== 'main').map(c => h('option', { value: c.id, selected: c.id === d.circuitId || false }, c.name)),
    ]);
    circSel.disabled = def.power !== 'strong';
    circSel.onchange = () => store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); if (x) x.circuitId = circSel.value || null; });
    propsBox.appendChild(h('div', { style: 'padding:10px' }, [
      h('div', { class: 'prop-row' }, [
        h('label', {}, '设备类型'),
        h('div', { class: 'val' }, `${def.icon} ${def.name}　`),
        h('span', { class: 'tag ' + def.power }, POWER_LABEL[def.power]),
      ]),
      h('label', { class: 'fld' }, ['点位名称', nameInp]),
      h('label', { class: 'fld' }, ['所属区域（自动识别，可手改）', zoneSel]),
      h('label', { class: 'fld' }, ['配电箱回路' + (def.power !== 'strong' ? '（弱电无需分配）' : ''), circSel]),
      h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [
        h('button', { class: 'btn small', style: 'flex:1', onclick: () => rotate(d, 90) }, '⟳ 旋转90°'),
        h('button', { class: 'btn small danger', style: 'flex:1', onclick: () => remove(d) }, '🗑 删除点位'),
      ]),
    ]));
  }
  function rotate(d, deg) {
    pushHist();
    store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); if (x) x.rotation = ((x.rotation || 0) + deg) % 360; });
    stage.render();
  }
  function remove(d) {
    pushHist();
    store.removeDevice(d.id);
    stage.setSelected([]); renderProps([]); renderStats();
  }

  function renderStats() {
    const S = summarize(p);
    statsBox.innerHTML = '';
    statsBox.appendChild(h('div', { class: 'mini-stat' }, [
      ms(S.totalPoints, '点位总数'),
      ms(S.deviceKinds, '设备种类'),
      ms(S.strongN, '强电', 'strong'),
      ms(S.weakN, '弱电', 'weak'),
    ]));
    if (S.unzoned) statsBox.appendChild(h('p', { style: 'font-size:11.5px;color:var(--warn);margin:10px 0 0' }, `⚠ ${S.unzoned} 个点位未分区`));
  }
  function ms(v, l, cls) { return h('div', { class: 'ms' }, [h('b', { class: cls || '' }, String(v)), h('span', {}, l)]); }

  function center() { const r = canvasBox.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; }
  function zoneAtLocal(pp, x, y) {
    for (const z of pp.zones) {
      if (z.rect) {
        const r = { x: Math.min(z.rect.x, z.rect.x + z.rect.w), y: Math.min(z.rect.y, z.rect.y + z.rect.h), w: Math.abs(z.rect.w), h: Math.abs(z.rect.h) };
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return z.id;
      }
    }
    return null;
  }

  store.markStep('layout', p.devices.length > 0);
  renderProps([]); renderStats();
  setTimeout(() => stage.fit(), 30);
  return () => stage.destroy();
}
