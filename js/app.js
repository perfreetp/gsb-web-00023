// 应用外壳：导航 / 哈希路由 / 顶部操作 / 分享只读预览
import { $, $$, h, toast, modal } from './util.js';
import { store, progressOf } from './state.js';
import * as HomeView from './views/home.js';
import * as FloorView from './views/floor.js';
import * as ZonesView from './views/zones.js';
import * as LayoutView from './views/layout.js';
import * as ScenesView from './views/scenes.js';
import * as WiringView from './views/wiring.js';
import * as PanelView from './views/panel.js';
import * as BudgetView from './views/budget.js';
import * as BriefingView from './views/briefing.js';
import * as VersionsView from './views/versions.js';

export const STEPS = [
  { route: 'home', name: '方案首页', icon: '🏠' },
  { route: 'floor', name: '户型结构', icon: '🏢' },
  { route: 'zones', name: '区域划分', icon: '🪧' },
  { route: 'layout', name: '点位布局', icon: '🎯' },
  { route: 'scenes', name: '场景联动', icon: '🎬' },
  { route: 'wiring', name: '布线设计', icon: '🧵' },
  { route: 'panel', name: '配电箱回路', icon: '🔋' },
  { route: 'budget', name: '清单预算', icon: '🧾' },
  { route: 'briefing', name: '施工交底', icon: '📋' },
  { route: 'versions', name: '版本分享', icon: '🔗' },
];

const viewMap = {
  home: HomeView, floor: FloorView, zones: ZonesView, layout: LayoutView,
  scenes: ScenesView, wiring: WiringView, panel: PanelView, budget: BudgetView,
  briefing: BriefingView, versions: VersionsView,
};

let currentCleanup = null;

function renderNav(active) {
  const nav = $('#nav');
  nav.innerHTML = '';
  STEPS.forEach((step, i) => {
    if (step.route === 'home') return;
    const p = store.project;
    const done = p && p.progress && p.progress[step.route];
    const btn = h('button', {
      class: 'nav-item' + (active === step.route ? ' active' : ''),
      onclick: () => { location.hash = '#/' + step.route; },
    }, [
      h('span', { class: 'ni-ico' }, step.icon),
      h('span', {}, (i) + '. ' + step.name),
      done ? h('small', {}, '✓') : null,
    ]);
    nav.appendChild(btn);
  });
}

export function refreshChrome(route) {
  renderNav(route);
  const p = store.project;
  const step = STEPS.find(s => s.route === route);
  $('#crumb').innerHTML = '';
  $('#crumb').append(
    h('span', {}, p ? p.name : '智居布线'),
    h('b', {}, step ? ' / ' + step.name : '')
  );
  const ta = $('#top-actions');
  ta.innerHTML = '';
  if (p && route !== 'home') {
    const pct = Math.round(progressOf(p) * 100);
    ta.appendChild(h('span', { class: 'muted', style: 'font-size:12px' }, '完成度 ' + pct + '%'));
    ta.appendChild(h('button', { class: 'btn small', onclick: () => store.saveVersion(prompt('版本备注（可留空）') || '') }, '💾 存版本'));
    ta.appendChild(h('button', { class: 'btn small', onclick: () => { store.exportJSON(); toast('已导出方案备份', 'ok'); } }, '⬇ 导出'));
  }
  if (route === 'home') {
    ta.appendChild(h('button', { class: 'btn small', onclick: importJSONDialog }, '⬆ 导入方案'));
  }
}

function importJSONDialog() {
  const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  inp.addEventListener('change', async () => {
    if (inp.files[0]) {
      const d = await store.importJSON(inp.files[0]);
      if (d) { toast('方案已导入', 'ok'); location.hash = '#/floor'; }
    }
  });
  document.body.appendChild(inp); inp.click(); inp.remove();
}

async function renderRoute() {
  if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
  const hash = location.hash || '#/home';
  // 分享只读预览
  if (hash.startsWith('#/share')) {
    renderShare(hash);
    return;
  }
  const route = (hash.match(/^#\/([\w]+)/) || [])[1] || 'home';
  if (route !== 'home' && !store.project) { location.hash = '#/home'; return; }
  const view = viewMap[route] || HomeView;
  const host = $('#view');
  host.innerHTML = '';
  refreshChrome(route);
  try {
    const ret = view.mount(host);
    if (ret && typeof ret.then === 'function') ret.then(c => { currentCleanup = typeof c === 'function' ? c : null; }, err => showViewError(host, err));
    else currentCleanup = typeof ret === 'function' ? ret : null;
  } catch (err) { showViewError(host, err); }
}

async function renderShare(hash) {
  $('#nav').querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('#crumb').innerHTML = '<b>分享预览（只读）</b>';
  $('#top-actions').innerHTML = '';
  const host = $('#view');
  host.innerHTML = '<div class="empty"><div class="big">⏳</div>正在加载分享方案…</div>';
  try {
    const qs = new URLSearchParams((hash.split('?')[1] || '').replace(/^\//,''));
    const code = qs.get('d') || hash.slice(hash.indexOf('d=') + 2);
    const proj = await store.loadShare(code);
    store.pid = null;
    const { mountShared } = await import('./views/shared.js');
    host.innerHTML = '';
    mountShared(host, proj);
    $('#top-actions').appendChild(h('button', {
      class: 'btn primary small',
      onclick: async () => {
        proj.id = 'p_' + Math.random().toString(36).slice(2, 8);
        proj.versions = [];
        store.projects.unshift(proj);
        store.pid = proj.id;
        store.persist();
        toast('已复制为我的方案，可继续编辑', 'ok');
        location.hash = '#/home';
      },
    }, '📥 复制为我的方案'));
  } catch (e) {
    console.error(e);
    host.innerHTML = '<div class="empty"><div class="big">❌</div>分享链接无效或数据已损坏<br><br><a class="btn primary" href="#/home">返回首页</a></div>';
  }
}

$('#btn-help').addEventListener('click', showHelp);
function showHelp() {
  const steps = [
    ['🏠', '新建方案', '首页点"新建方案"，填写户型名称与建筑面积。'],
    ['🏢', '上传户型图', '上传户型图/手绘照片，或直接画墙体；标出梁、柱、承重墙作为绕行障碍；校准比例尺。'],
    ['🪧', '划分区域', '拖出客厅、卧室、厨房等矩形/多边形区域并命名，设备拖入后自动归属。'],
    ['🎯', '拖拽点位', '从左侧设备库拖入灯、开关、插座、传感器等；自动吸附网格、红色辅助线对齐，可标尺寸。'],
    ['🎬', '场景模板', '一键启用回家、离家、观影、睡眠等场景，系统按房间自动匹配设备动作。'],
    ['🧵', '自动布线', '自动生成开关回路、A* 绕梁柱承重墙布管，检查强弱电 300mm 间距。'],
    ['🔋', '分配回路', '把强电点位分配到照明/插座/空调等回路，超载与功率自动提醒。'],
    ['🧾', '清单预算', '自动统计点位、弱电线长，输出材料清单 CSV 与预算估算。'],
    ['📋', '施工交底', '生成给电工看的交底说明，可打印；版本可保存并生成链接分享。'],
  ];
  modal({
    title: '使用指引：9 步搭出全屋布线',
    wide: true,
    body: h('div', { class: 'help-grid' }, steps.map(([icon, t, d]) =>
      h('div', { class: 'card hc' }, [h('div', { class: 'he' }, icon), h('strong', {}, t), h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:12.5px;line-height:1.6' }, d)])
    )),
  });
}

window.addEventListener('hashchange', renderRoute);
store.init();
renderRoute();
