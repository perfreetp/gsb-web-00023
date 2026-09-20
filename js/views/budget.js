import { h, $, toast, modal } from '../util.js';
import { store } from '../state.js';
import { summarize, buildBOM, budget, budgetCSV, priceOf } from '../stats.js';
import { DEFAULT_PRICES, DEVICE_MAP } from '../catalog.js';
import { download, fmtMoney } from '../util.js';

export function mount(root) {
  const p = store.project;

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, '材料清单与预算估算'),
      h('p', {}, '按点位、线管长度自动汇总；单价可直接修改（自动保存），支持导出 CSV 给供应商询价。'),
    ]),
    h('div', { style: 'display:flex;gap:8px' }, [
      h('button', { class: 'btn', onclick: editPrices }, '💱 批量改单价'),
      h('button', { class: 'btn', onclick: () => { download(`${p.name}-材料清单.csv`, budgetCSV(p), 'text/csv;charset=utf-8'); toast('CSV 已导出', 'ok'); } }, '⬇ 导出CSV'),
      h('button', { class: 'btn primary', onclick: () => location.hash = '#/briefing' }, '下一步：施工交底 →'),
    ]),
  ]));

  const S = summarize(p);
  root.appendChild(h('div', { class: 'stat-cards' }, [
    sc(S.totalPoints, '点位总数', ''),
    sc(S.strongN, '强电点位', 'strong'),
    sc(S.weakN, '弱电点位', 'weak'),
    sc(S.weakCat6 + 'm', '六类网线', 'weak'),
    sc(S.weakPower + 'm', '弱电电源线', 'weak'),
    sc((S.strong25 + S.strong4) + 'm', '强电 BV 线', 'strong'),
    sc(S.conduitM + 'm', 'PVC 线管', ''),
    sc(S.bridgeM + 'm', '桥架/线槽', ''),
  ]));

  const b = budget(p);
  const bcard = h('div', { class: 'card', style: 'margin-bottom:16px' }, h('div', { class: 'card-b', style: 'display:flex;gap:28px;flex-wrap:wrap;align-items:center' }, [
    sumItem('设备材料合计', fmtMoney(b.subtotal)),
    sumItem('设计调试费 5%', fmtMoney(b.design)),
    sumItem('施工余量 8%', fmtMoney(b.contingency)),
    h('div', {}, [h('div', { style: 'font-size:26px;font-weight:800;color:var(--brand)' }, fmtMoney(b.total)), h('div', { class: 'muted', style: 'font-size:12px' }, `预算总计 · 约 ¥${b.perSqm}/㎡（${b.area}㎡）`)]),
    h('div', { class: 'muted', style: 'font-size:11.5px;max-width:260px;line-height:1.6' }, '※ 预算为估算，实际以品牌选型、现场工程量和当地人工为准。'),
  ]));
  root.appendChild(bcard);

  const card = h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [h('h3', {}, '材料明细'), h('span', { class: 'muted', style: 'font-size:12px' }, '点击单价可修改')]),
    h('div', { class: 'card-b', style: 'padding:0;max-height:52vh;overflow:auto' }, table()),
  ]);
  root.appendChild(card);

  function table() {
    const { rows, subtotal } = buildBOM(p);
    return h('table', {}, [
      h('thead', {}, h('tr', {}, ['分类', '名称', '单位', '数量', '单价(元)', '小计(元)'].map((t, i) => h('th', { class: i >= 3 ? 'num' : '' }, t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, [
        h('td', { class: 'muted' }, r.category),
        h('td', {}, r.name),
        h('td', {}, r.unit),
        h('td', { class: 'num' }, r.qty),
        h('td', { class: 'num' }, h('a', {
          style: 'cursor:pointer;color:var(--brand)',
          onclick: () => editOnePrice(r),
        }, '¥' + r.price)),
        h('td', { class: 'num', style: 'font-weight:600' }, fmtMoney(r.total)),
      ]))),
      h('tfoot', {}, h('tr', {}, [
        h('td', { colspan: '5', style: 'text-align:right;font-weight:700' }, '合计'),
        h('td', { class: 'num', style: 'font-weight:800;color:var(--brand)' }, fmtMoney(subtotal)),
      ])),
    ]);
  }
  function editOnePrice(r) {
    // 找到对应价格 key
    const key = findKey(r.name);
    if (!key) return;
    const cur = priceOf(p, key);
    const inp = h('input', { type: 'number', value: cur, min: '0', step: '0.1' });
    modal({
      title: '修改单价：' + r.name,
      body: h('label', { class: 'fld' }, ['单价（元/' + r.unit + '）', inp]),
      footer: [
        h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
        h('button', { class: 'btn primary', onclick: () => {
          store.mutate(pp => { pp.prices[key] = Math.max(0, Number(inp.value) || 0); });
          $('#modal-host').classList.remove('show');
          mount_refresh();
        } }, '保存'),
      ],
    });
  }
  function mount_refresh() {
    root.innerHTML = '';
    mount(root);
  }
  function editPrices() {
    const { rows } = buildBOM(p);
    const keys = new Map();
    rows.forEach(r => { const k = findKey(r.name); if (k && !keys.has(k)) keys.set(k, r.name); });
    const inputs = {};
    const body = h('div', { style: 'max-height:50vh;overflow:auto' }, [...keys.entries()].map(([k, name]) => {
      const inp = h('input', { type: 'number', value: priceOf(p, k), min: '0', step: '0.1', style: 'width:110px' });
      inputs[k] = inp;
      return h('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--line)' }, [
        h('span', { style: 'font-size:12.5px' }, name), inp,
      ]);
    }));
    modal({
      title: '批量调整单价',
      wide: true,
      body,
      footer: [
        h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
        h('button', { class: 'btn', onclick: () => {
          store.mutate(pp => pp.prices = {});
          $('#modal-host').classList.remove('show'); mount_refresh(); toast('已恢复默认价格', 'ok');
        } }, '恢复默认'),
        h('button', { class: 'btn primary', onclick: () => {
          store.mutate(pp => Object.entries(inputs).forEach(([k, el]) => { pp.prices[k] = Math.max(0, Number(el.value) || 0); }));
          $('#modal-host').classList.remove('show'); mount_refresh(); toast('价格已更新', 'ok');
        } }, '保存'),
      ],
    });
  }
}

function findKey(name) {
  // 反查价格 key：通过 DEFAULT_PRICES 顺序与 buildBOM 名称匹配较复杂，这里维护映射
  const map = {
    '六类网线（弱电信号）': 'wire_weak_cat6',
    'RVV2×0.75 弱电设备电源线': 'wire_weak_power',
    'BV 2.5mm² 铜芯线（照明/插座）': 'wire_strong_25',
    'BV 4mm² 铜芯线（大功率专线）': 'wire_strong_4',
    'PVC 阻燃线管': 'conduit_pvc',
    '金属/弱电线槽桥架': 'conduit_bridge',
    '暗盒/底盒': 'junction_box',
  };
  if (map[name]) return map[name];
  for (const [k, def] of Object.entries(DEVICE_MAP)) if (def.name === name) return k;
  if (name.includes('点位施工人工')) return 'labor_point';
  return null;
}

function sc(v, l, cls) { return h('div', { class: 'card stat-card ' + cls }, [h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l)]); }
function sumItem(l, v) { return h('div', {}, [h('div', { style: 'font-size:18px;font-weight:700' }, v), h('div', { class: 'muted', style: 'font-size:12px' }, l)]); }
