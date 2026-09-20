import { h, s, $, $$, uid, toast, modal } from '../util.js';
import { store } from '../state.js';
import { Stage } from '../stage.js';
import { autoRoute, buildGrid } from '../router.js';
import { summarize, validate } from '../stats.js';
import { DEVICE_MAP } from '../catalog.js';

export function mount(root) {
  const p = store.project;
  let mode = 'select';      // select | strong | weak | bridge | link
  let drawing = null;       // 手工布管 {route:[]}
  let linkFirst = null;
  let grid = null;
  const layers = { zones: true, structures: true, conduits: true, links: true, dims: false, panel: true, labels: true };

  const canvasBox = h('div', { class: 'canvas-wrap', style: 'height:100%' });
  const warnBox = h('div', {});
  const listBox = h('div', {});

  const modeBtns = [
    { k: 'select', icon: '🖱️', name: '选择' },
    { k: 'strong', icon: '🟧', name: '强电线管' },
    { k: 'weak', icon: '🟦', name: '弱电线管' },
    { k: 'bridge', icon: '🟪', name: '桥架/线槽' },
    { k: 'link', icon: '🔗', name: '开关→灯 连线' },
  ];

  const editor = h('div', { class: 'editor' }, [
    h('div', { class: 'panel' }, [
      h('div', { class: 'panel-h' }, '布线工具'),
      h('div', { class: 'panel-b' }, [
        h('div', { class: 'lib-group' }, modeBtns.map(b =>
          h('div', { class: 'lib-item mode-item' + (b.k === 'select' ? ' on' : ''), 'data-k': b.k, onclick: () => setMode(b.k) }, [
            h('span', { class: 'li-ico', style: 'background:#f1f5f9' }, b.icon), h('span', {}, b.name),
          ])
        )),
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:10px 0' }),
        h('button', { class: 'btn primary small', style: 'width:100%;margin-bottom:8px', onclick: autoLink }, '⚡ 一键生成开关回路'),
        h('button', { class: 'btn small', style: 'width:100%;margin-bottom:8px', onclick: autoConduits }, '🤖 自动布弱电线管(绕梁柱)'),
        h('button', { class: 'btn small', style: 'width:100%;margin-bottom:8px', onclick: genTrunk }, '🛣️ 生成主干桥架'),
        h('button', { class: 'btn small ghost danger', style: 'width:100%', onclick: clearConduits }, '清空所有线管'),
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:10px 0' }),
        h('div', { class: 'legend' }, [
          h('span', {}, [h('i', { style: 'background:#f59e0b' }), '强电管']),
          h('span', {}, [h('i', { style: 'background:#3b82f6' }), '弱电管']),
          h('span', {}, [h('i', { style: 'background:#7c3aed' }), '桥架']),
        ]),
        h('p', { class: 'muted', style: 'font-size:11px;line-height:1.6;margin-top:10px' }, '手工布管：选中线管类型后，依次点击添加拐点，双击结束；自动布管会用 A* 绕开承重墙、梁、柱。'),
      ]),
    ]),
    canvasBox,
    h('div', { class: 'panel props-col' }, [
      h('div', { class: 'panel-h' }, '校验与统计'),
      h('div', { class: 'panel-b' }, [
        warnBox,
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:10px 0' }),
        listBox,
      ]),
    ]),
  ]);
  root.appendChild(editor);

  const toolbar = h('div', { class: 'canvas-toolbar' }, [
    h('button', { class: 'toolbtn', title: '放大', onclick: () => stage.zoomAt(stage.zoom * 1.2, center()) }, '➕'),
    h('button', { class: 'toolbtn', title: '缩小', onclick: () => stage.zoomAt(stage.zoom / 1.2, center()) }, '➖'),
    h('button', { class: 'toolbtn', title: '适配', onclick: () => stage.fit() }, '⛶'),
  ]);
  canvasBox.appendChild(toolbar);

  const viewToggle = h('div', { class: 'layer-toggles', style: 'right:10px;top:auto;bottom:10px;flex-direction:row' }, [
    h('button', { class: 'btn small on', id: 'v-wiring', onclick: () => switchView('wiring') }, '🧵 布线图'),
    h('button', { class: 'btn small', id: 'v-points', onclick: () => switchView('points') }, '🎯 点位图'),
  ]);
  canvasBox.appendChild(viewToggle);

  const hint = h('div', { class: 'canvas-hint' }, '选择左侧线管类型，在画布上点击走线拐点，双击结束；也可先一键自动布线再手工微调');
  canvasBox.appendChild(hint);

  const stage = new Stage(canvasBox, p, {
    layers,
    readonly: true,
    onCanvasDown: (w, e) => {
      e.stopPropagation();
      if (mode === 'select') return;
      if (mode === 'link') {
        const d = hitDev(w);
        if (!d) return toast('请点击一个开关', 'warn');
        if (!linkFirst) {
          if (!/^switch_/.test(d.type)) return toast('连线起点请选择开关', 'warn');
          linkFirst = d;
          stage.fxLayer.appendChild(s('circle', { cx: d.x, cy: d.y, r: 18, fill: 'none', stroke: '#f59e0b', 'stroke-width': 3 }));
          hint.textContent = '再点击要控制的灯具（再点一次开关可取消）';
        } else {
          if (d.id === linkFirst.id) { linkFirst = null; stage.clearFx(); return; }
          if (!d.type.startsWith('light_')) return toast('终点请选择灯具', 'warn');
          if (!p.links.some(l => l.from === linkFirst.id && l.to === d.id)) {
            store.mutate(pp => pp.links.push({ id: uid('l'), kind: 'switch', from: linkFirst.id, to: d.id }));
          }
          linkFirst = null; stage.clearFx(); stage.render(); renderSide();
        }
        return;
      }
      // 线管：逐点点击
      if (!drawing) drawing = { kind: mode, route: [{ x: Math.round(w.x), y: Math.round(w.y) }] };
      else drawing.route.push({ x: Math.round(w.x), y: Math.round(w.y) });
      redrawGhost(w);
      hint.textContent = `继续点击添加拐点（${drawing.route.length} 个点），双击结束本段`;
    },
  });
  stage.setMode('custom');

  canvasBox.addEventListener('pointermove', e => { if (drawing) redrawGhost(stage.toWorld(e)); });

  function redrawGhost(w) {
    stage.clearFx();
    const r = drawing.route;
    const color = { strong: '#f59e0b', weak: '#3b82f6', bridge: '#7c3aed' }[drawing.kind];
    const pts = [...r, { x: w.x, y: w.y }];
    stage.fxLayer.appendChild(s('polyline', { points: pts.map(q => q.x + ',' + q.y).join(' '), fill: 'none', stroke: color, 'stroke-width': drawing.kind === 'bridge' ? 8 : 4, 'stroke-dasharray': '8 5', opacity: .8 }));
    r.forEach(q => stage.fxLayer.appendChild(s('circle', { cx: q.x, cy: q.y, r: 4, fill: color })));
  }

  function hitDev(w) {
    let best = null, bd = 25 * 25;
    p.devices.forEach(d => { const dd = (d.x - w.x) ** 2 + (d.y - w.y) ** 2; if (dd < bd) { bd = dd; best = d; } });
    return best;
  }
  function conduitName(kind) {
    const n = p.conduits.filter(c => c.kind === kind).length + 1;
    return { strong: '强电管', weak: '弱电线管', bridge: '桥架' }[kind] + n;
  }
  function setMode(m) {
    mode = m; drawing = null; linkFirst = null; stage.clearFx();
    $$('.mode-item', editor).forEach(el => el.classList.toggle('on', el.dataset.k === m));
    const hints = {
      select: '选择模式：可拖动画面（Alt+拖）/缩放；双击线管可删除',
      strong: '强电线管：点击添加拐点，双击结束',
      weak: '弱电线管：点击添加拐点，双击结束',
      bridge: '桥架/线槽：点击添加拐点，双击结束',
      link: '开关回路：先点开关，再点它控制的灯',
    };
    hint.textContent = hints[m];
  }

  function autoLink() {
    const n = store.autoLinkSwitches();
    stage.render(); renderSide();
    toast(n ? `已自动生成 ${n} 条开关→灯回路连线` : '没有可新增的连线：请检查开关与灯具是否在同一区域', n ? 'ok' : 'warn', 3200);
  }

  function ensureGrid() {
    grid = buildGrid(p);
    return grid;
  }

  function autoConduits() {
    const weak = p.devices.filter(d => (DEVICE_MAP[d.type] || {}).power === 'weak' && !['rack_panel'].includes(d.type));
    const hubs = p.devices.filter(d => ['hub_gateway', 'rack_panel', 'ap_wifi'].includes(d.type));
    const target = hubs[0] || { x: p.panel.x, y: p.panel.y };
    if (!weak.length) return toast('还没有弱电点位，先去点位布局放置设备', 'warn');
    const g = ensureGrid();
    let ok = 0, fail = 0;
    store.mutate(pp => {
      weak.forEach(d => {
        const route = autoRoute(pp, { x: d.x, y: d.y }, { x: target.x, y: target.y }, { grid: g });
        if (route && route.length > 1) {
          pp.conduits.push({ id: uid('c'), kind: 'weak', name: '弱电-' + d.name, route });
          ok++;
        } else fail++;
      });
    });
    stage.render(); renderSide();
    toast(`已自动生成 ${ok} 条弱电线管` + (fail ? `，${fail} 条被完全封死请手工绘制` : ''), fail ? 'warn' : 'ok', 3200);
  }

  function genTrunk() {
    const g = ensureGrid();
    const start = { x: p.panel.x + 30, y: p.panel.y + 30 };
    // 主干终点：最远的弱电位方向，沿主要区域中心延伸
    const weak = p.devices.filter(d => (DEVICE_MAP[d.type] || {}).power === 'weak');
    if (!weak.length) return toast('先放置弱电设备再生成桥架', 'warn');
    const far = weak.reduce((a, b) => (Math.hypot(a.x - p.panel.x, a.y - p.panel.y) > Math.hypot(b.x - p.panel.x, b.y - p.panel.y) ? a : b));
    const end = { x: Math.max(60, Math.min(p.width - 60, far.x)), y: Math.max(60, Math.min(p.height - 60, far.y)) };
    const route = autoRoute(p, start, end, { grid: g });
    if (!route) return toast('桥架路径计算失败，请手工绘制', 'err');
    store.mutate(pp => pp.conduits.push({ id: uid('c'), kind: 'bridge', name: '主干桥架', route }));
    stage.render(); renderSide();
    toast('主干桥架已生成，弱电线可沿桥架敷设', 'ok');
  }

  function clearConduits() {
    if (!p.conduits.length) return;
    if (!confirm('清空所有线管/桥架？开关回路连线保留。')) return;
    store.mutate(pp => pp.conduits = []);
    stage.render(); renderSide();
  }

  // 双击：绘制中结束本段；选择模式下双击线管删除
  canvasBox.addEventListener('dblclick', e => {
    if (drawing && drawing.route.length >= 2) {
      e.stopPropagation();
      const c = { id: uid('c'), kind: drawing.kind, name: conduitName(drawing.kind), route: drawing.route };
      store.mutate(pp => pp.conduits.push(c));
      drawing = null; stage.clearFx(); stage.render(); renderSide();
      hint.textContent = '继续点击绘制下一段，或切换到"选择"模式';
      return;
    }
    if (mode !== 'select') return;
    const w = stage.toWorld(e);
    const hit = [...p.conduits].reverse().find(c => {
      for (let i = 0; i < c.route.length - 1; i++) {
        const a = c.route[i], b = c.route[i + 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let t = ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / (l * l);
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(w.x - (a.x + t * (b.x - a.x)), w.y - (a.y + t * (b.y - a.y))) < 12) return true;
      }
      return false;
    });
    if (hit && confirm(`删除「${hit.name}」？`)) {
      store.mutate(pp => { pp.conduits = pp.conduits.filter(c => c.id !== hit.id); });
      stage.render(); renderSide();
    }
  }, true);

  function switchView(v) {
    if (v === 'points') {
      stage.setLayers({ conduits: false, links: false, panel: false });
      $('#v-points').classList.add('on'); $('#v-wiring').classList.remove('on');
      hint.textContent = '当前为【点位图】：只看设备点位与区域';
    } else {
      stage.setLayers({ conduits: true, links: true, panel: true });
      $('#v-wiring').classList.add('on'); $('#v-points').classList.remove('on');
      hint.textContent = '当前为【布线图】：显示线管、桥架与回路连线';
    }
  }

  function renderSide() {
    renderWarns(); renderList();
  }
  function renderWarns() {
    warnBox.innerHTML = '';
    const warns = validate(p);
    warns.forEach(w => warnBox.appendChild(h('div', { class: 'warn-item ' + w.level }, [
      h('span', {}, w.level === 'ok' ? '✅' : w.level === 'danger' ? '⛔' : '⚠️'),
      h('div', {}, [
        h('div', { style: 'font-weight:600' }, w.title),
        h('div', { class: 'muted', style: 'margin-top:2px' }, w.msg),
        w.fix ? h('button', {
          class: 'btn small ghost', style: 'margin-top:6px;padding:2px 8px',
          onclick: () => location.hash = '#/' + w.fix,
        }, '去处理 →') : null,
      ]),
    ])));
  }
  function renderList() {
    const S = summarize(p);
    listBox.innerHTML = '';
    listBox.appendChild(h('div', { class: 'mini-stat', style: 'margin-bottom:10px' }, [
      ms(S.totalPoints, '总点位'),
      ms(p.conduits.length, '线管段'),
      ms(S.weakCat6 + 'm', '网线估算'),
      ms(S.strong25 + S.strong4 + 'm', '强电线估算'),
    ]));
    listBox.appendChild(h('h5', { style: 'margin:0 0 6px;font-size:12px;color:var(--muted)' }, `线管/桥架（${p.conduits.length}，双击可删除）`));
    const wrap = h('div', { class: 'wire-list' });
    if (!p.conduits.length) wrap.appendChild(h('div', { class: 'muted', style: 'font-size:12px;padding:6px' }, '暂无，点击左侧"自动布弱电线管"试试'));
    p.conduits.forEach(c => {
      let len = 0;
      for (let i = 0; i < c.route.length - 1; i++) len += Math.hypot(c.route[i + 1].x - c.route[i].x, c.route[i + 1].y - c.route[i].y);
      const tagCls = c.kind === 'strong' ? 'strong' : c.kind === 'weak' ? 'weak' : 'purple';
      wrap.appendChild(h('div', { class: 'wi' }, [
        h('span', { class: 'tag ' + tagCls }, c.kind === 'strong' ? '强' : c.kind === 'weak' ? '弱' : '桥'),
        h('span', { style: 'flex:1' }, c.name),
        h('span', { class: 'muted' }, (len * p.scale).toFixed(1) + 'm'),
        h('button', { class: 'btn small ghost danger', onclick: () => store.mutate(pp => { pp.conduits = pp.conduits.filter(x => x.id !== c.id); stage.render(); renderSide(); }) }, '✕'),
      ]));
    });
    listBox.appendChild(wrap);
    listBox.appendChild(h('button', { class: 'btn primary', style: 'width:100%;margin-top:12px', onclick: () => location.hash = '#/panel' }, '下一步：分配配电箱回路 →'));
  }
  function ms(v, l) { return h('div', { class: 'ms' }, [h('b', {}, String(v)), h('span', {}, l)]); }
  function center() { const r = canvasBox.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; }

  store.markStep('wiring', p.links.length > 0 || p.conduits.length > 0);
  renderSide();
  setTimeout(() => stage.fit(), 30);
  return () => stage.destroy();
}
