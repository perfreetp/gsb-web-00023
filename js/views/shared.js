import { h, $ } from '../util.js';
import { Stage } from '../stage.js';
import { summarize, buildBOM, budget, briefing, validate } from '../stats.js';

export function mountShared(root, p) {
  let tab = 'wiring';
  const S = summarize(p), b = budget(p);

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, `📤 ${p.name}（分享只读）`),
      h('p', {}, `${p.area}㎡ · ${p.zones.length} 个区域 · ${S.totalPoints} 个点位 · ${new Date(p.updated).toLocaleDateString('zh-CN')}`),
    ]),
  ]));

  const tabs = h('div', { class: 'tabs' }, [
    h('button', { class: 'on', id: 't-wiring', onclick: () => setTab('wiring') }, '🧵 布线图'),
    h('button', { id: 't-points', onclick: () => setTab('points') }, '🎯 点位图'),
    h('button', { id: 't-bom', onclick: () => setTab('bom') }, '🧾 材料预算'),
    h('button', { id: 't-brief', onclick: () => setTab('brief') }, '📋 交底书'),
  ]);
  root.appendChild(tabs);

  const stageCard = h('div', { class: 'canvas-wrap', style: 'height:64vh' });
  root.appendChild(stageCard);

  const bomBox = h('div', { style: 'display:none' });
  const briefBox = h('div', { style: 'display:none' });
  root.appendChild(bomBox);
  root.appendChild(briefBox);

  const stage = new Stage(stageCard, p, {
    readonly: true,
    layers: { zones: true, structures: true, conduits: true, links: true, dims: true, panel: true, labels: true },
  });
  stageCard.appendChild(h('div', { class: 'canvas-toolbar' }, [
    h('button', { class: 'toolbtn', title: '放大', onclick: () => stage.zoomAt(stage.zoom * 1.2, center()) }, '➕'),
    h('button', { class: 'toolbtn', title: '缩小', onclick: () => stage.zoomAt(stage.zoom / 1.2, center()) }, '➖'),
    h('button', { class: 'toolbtn', title: '适配', onclick: () => stage.fit() }, '⛶'),
  ]));

  // 统计条
  root.appendChild(h('div', { class: 'stat-cards', style: 'margin-top:16px' }, [
    sc(S.totalPoints, '总点位'),
    sc(S.strongN, '强电', 'strong'),
    sc(S.weakN, '弱电', 'weak'),
    sc(S.weakCat6 + 'm', '网线'),
    sc((S.strong25 + S.strong4) + 'm', '强电线', 'strong'),
    sc('¥' + b.total, '预算估算'),
  ]));

  // BOM
  const { rows, subtotal } = buildBOM(p);
  bomBox.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [h('h3', {}, '材料清单'), h('span', {}, '合计 ¥' + subtotal + '，预算总计 ¥' + b.total)]),
    h('div', { style: 'max-height:60vh;overflow:auto' }, h('table', {}, [
      h('thead', {}, h('tr', {}, ['分类', '名称', '单位', '数量', '单价', '小计'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, [h('td', { class: 'muted' }, r.category), h('td', {}, r.name), h('td', {}, r.unit), h('td', {}, String(r.qty)), h('td', {}, '¥' + r.price), h('td', {}, '¥' + Math.round(r.total))]))),
    ])),
  ]));

  // 交底
  const warns = validate(p);
  briefBox.appendChild(h('div', { class: 'card', style: 'margin-bottom:14px' }, [
    h('div', { class: 'card-h' }, h('h3', {}, '风险检查')),
    h('div', { class: 'card-b' }, warns.map(w => h('div', { class: 'warn-item ' + w.level }, [
      h('span', {}, w.level === 'ok' ? '✅' : w.level === 'danger' ? '⛔' : '⚠️'),
      h('div', {}, [h('strong', {}, w.title), h('div', { class: 'muted' }, w.msg)]),
    ]))),
  ]));
  briefBox.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-b' }, h('pre', { class: 'brief-box' }, briefing(p)))));

  function setTab(t) {
    tab = t;
    ['wiring', 'points', 'bom', 'brief'].forEach(x => $('#t-' + x).classList.toggle('on', x === t));
    stageCard.style.display = t === 'bom' || t === 'brief' ? 'none' : '';
    bomBox.style.display = t === 'bom' ? '' : 'none';
    briefBox.style.display = t === 'brief' ? '' : 'none';
    if (t === 'wiring') stage.setLayers({ conduits: true, links: true, panel: true, dims: false });
    if (t === 'points') stage.setLayers({ conduits: false, links: false, panel: false, dims: true });
  }
  function center() { const r = stageCard.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; }
  setTimeout(() => stage.fit(), 60);
}
function sc(v, l, cls) { return h('div', { class: 'card stat-card ' + (cls || '') }, [h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l)]); }
