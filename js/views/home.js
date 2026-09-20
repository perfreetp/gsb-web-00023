import { h, $, modal, toast } from '../util.js';
import { store, progressOf } from '../state.js';
import { STEPS } from '../app.js';

export function mount(root) {
  const wrap = h('div', { class: 'home-wrap' });

  wrap.appendChild(h('div', { class: 'hero' }, [
    h('div', {}, [
      h('h1', {}, '全屋智能点位图 × 弱电布线，像搭积木一样简单'),
      h('p', {}, '上传户型图 → 划分房间 → 拖入设备 → 自动生成开关回路与线管走向，强弱电间距自动校验，一键输出材料清单、预算和电工施工交底。'),
    ]),
    h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
      h('button', { class: 'btn', onclick: newProjectDialog }, '＋ 新建方案'),
      h('button', { class: 'btn ghost', style: 'background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)', onclick: () => location.hash = '#/versions' }, '我的版本'),
    ]),
  ]));

  const flow = h('div', { class: 'flow' });
  STEPS.slice(1).forEach((s, i) => {
    const p = store.project;
    const done = p && p.progress[s.route];
    flow.appendChild(h('div', {
      class: 'step' + (done ? ' active' : ''),
      onclick: () => { if (store.project) location.hash = '#/' + s.route; else toast('请先新建方案', 'warn'); },
    }, [h('div', { class: 'n' }, done ? '✓' : i + 1), h('div', {}, s.name)]));
  });
  wrap.appendChild(flow);

  const head = h('div', { class: 'page-head' }, [
    h('div', {}, [h('h2', {}, '我的方案'), h('p', {}, '数据保存在本机浏览器，可随时导出备份或生成链接分享。')]),
    h('button', { class: 'btn primary', onclick: newProjectDialog }, '＋ 新建方案'),
  ]);
  wrap.appendChild(head);

  const grid = h('div', { class: 'proj-grid' });
  wrap.appendChild(grid);
  renderCards(grid);

  root.appendChild(wrap);
}

function renderCards(grid) {
  grid.innerHTML = '';
  if (!store.projects.length) {
    grid.appendChild(h('div', { class: 'card empty', style: 'grid-column:1/-1' }, [
      h('div', { class: 'big' }, '🏡'),
      h('div', {}, '还没有方案，从一张户型图开始吧'),
      h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary', onclick: newProjectDialog }, '＋ 新建第一个方案')),
    ]));
    return;
  }
  store.projects.forEach(p => {
    const pct = Math.round(progressOf(p) * 100);
    const card = h('div', { class: 'card proj-card', onclick: () => { store.open(p.id); location.hash = '#/floor'; } }, [
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        h('h4', {}, p.name),
        h('button', { class: 'x-close', title: '删除', onclick: (e) => { e.stopPropagation(); confirmDelete(p); } }, '🗑'),
      ]),
      h('div', { class: 'muted', style: 'font-size:12px' }, `${p.area}㎡ · 更新于 ${new Date(p.updated).toLocaleDateString('zh-CN')}`),
      h('div', { class: 'proj-meta' }, [
        h('span', {}, `🎯 ${p.devices.length} 点位`),
        h('span', {}, `🪧 ${p.zones.length} 区域`),
        h('span', {}, `🔗 ${p.versions.length} 版本`),
      ]),
      h('div', { class: 'proj-bar' }, h('i', { style: `width:${pct}%` })),
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:8px' }, [
        h('span', { class: 'muted', style: 'font-size:11.5px' }, '完成度 ' + pct + '%'),
        h('span', { style: 'font-size:12px;color:var(--brand)' }, '继续编辑 →'),
      ]),
    ]);
    grid.appendChild(card);
  });
}

function confirmDelete(p) {
  modal({
    title: '删除方案',
    body: h('p', {}, `确定删除「${p.name}」？此操作不可恢复。`),
    footer: [
      h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
      h('button', { class: 'btn danger', onclick: () => { store.remove(p.id); toast('已删除', 'ok'); const g = $('.proj-grid'); if (g) renderCards(g); $('#modal-host').classList.remove('show'); } }, '删除'),
    ],
  });
}

export function newProjectDialog() {
  const nameInp = h('input', { placeholder: '例如：张先生的三室两厅', value: '我的新家' });
  const areaInp = h('input', { type: 'number', value: '90', min: '20', max: '1000' });
  modal({
    title: '新建布线方案',
    body: h('div', {}, [
      h('label', { class: 'fld' }, ['方案名称', nameInp]),
      h('label', { class: 'fld' }, ['建筑面积（㎡，用于预算估算）', areaInp]),
      h('p', { class: 'muted', style: 'font-size:12px;line-height:1.6' }, '提示：可以先创建空白方案，下一步上传户型图或手绘照片作为底图。'),
    ]),
    footer: [
      h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
      h('button', { class: 'btn primary', onclick: () => {
        const p = store.create(nameInp.value.trim() || '未命名方案');
        p.area = Math.max(20, Number(areaInp.value) || 90);
        store.persist();
        $('#modal-host').classList.remove('show');
        location.hash = '#/floor';
      } }, '创建并上传户型'),
    ],
  });
  setTimeout(() => nameInp.focus(), 50);
}
