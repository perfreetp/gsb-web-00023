import { h, $, uid, toast, modal } from '../util.js';
import { store } from '../state.js';
import { DEVICE_MAP, POWER_LABEL } from '../catalog.js';
import { summarize, validate } from '../stats.js';

export function mount(root) {
  const p = store.project;
  let filter = '';

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, '配电箱回路分配'),
      h('p', {}, '强电点位需接入空开回路；系统按类型自动给建议，超载、功率超限会实时提醒。'),
    ]),
    h('div', { style: 'display:flex;gap:8px' }, [
      h('button', { class: 'btn', onclick: autoAssign }, '🪄 一键智能分配'),
      h('button', { class: 'btn', onclick: addCircuitDialog }, '＋ 新增回路'),
    ]),
  ]));

  const S = summarize(p);
  root.appendChild(h('div', { class: 'stat-cards' }, [
    sc(S.totalPoints, '点位总数', ''),
    sc(S.strongN, '强电点位', 'strong'),
    sc(S.weakN, '弱电点位（不入强电箱）', 'weak'),
    sc(S.uncircuited, '未分配回路', S.uncircuited ? 'strong' : ''),
  ]));

  const two = h('div', { class: 'two-col' });
  root.appendChild(two);

  const circCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [h('div', {}, [h('h3', {}, '回路列表'), h('div', { class: 'sub' }, '点击回路查看/移除其中点位；负载按设备额定功率估算')])]),
    h('div', { class: 'card-b', id: 'circ-box' }),
  ]);
  const devCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('div', {}, [h('h3', {}, '强电点位分配'), h('div', { class: 'sub' }, '为每个点位选择所属回路')]),
      h('input', { placeholder: '搜索点位', oninput: e => { filter = e.target.value; renderDevs(); } }),
    ]),
    h('div', { class: 'card-b', id: 'dev-box', style: 'max-height:56vh;overflow:auto' }),
  ]);
  two.append(circCard, devCard);

  root.appendChild(h('div', { style: 'margin-top:16px' }, h('button', { class: 'btn primary', onclick: () => location.hash = '#/budget' }, '下一步：材料清单与预算 →')));

  function renderCircs() {
    const box = $('#circ-box');
    box.innerHTML = '';
    p.circuits.forEach(c => {
      const members = p.devices.filter(d => d.circuitId === c.id);
      const n = members.reduce((s, d) => s + (d.qty || 1), 0);
      const load = members.reduce((s, d) => s + (DEVICE_MAP[d.type]?.kw || 0) * (d.qty || 1), 0);
      const overN = c.kind !== 'main' && n > c.max;
      const amp = parseInt((c.breaker.match(/(\d+)A/) || [])[1] || '0', 10);
      const overLoad = amp && load * 1000 / 220 > amp * 0.8;
      box.appendChild(h('div', { class: 'wire-list', style: 'border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:10px' }, [
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;width:100%' }, [
          h('div', {}, [
            h('strong', { style: 'font-size:14px' }, c.name),
            h('div', { class: 'muted', style: 'font-size:11.5px;margin-top:2px' }, c.breaker),
          ]),
          h('div', { style: 'text-align:right' }, [
            h('div', {}, [
              h('span', { class: 'tag ' + (overN ? 'danger' : 'ok') }, `${n}${c.kind !== 'main' ? '/' + c.max : ''} 点位`),
              ' ',
              h('span', { class: 'tag ' + (overLoad ? 'warn' : 'passive') }, load.toFixed(1) + 'kW'),
            ]),
            c.kind !== 'main' ? h('button', {
              class: 'btn small ghost danger', style: 'margin-top:4px;padding:2px 8px',
              onclick: () => delCircuit(c),
            }, '删除回路') : null,
          ]),
        ]),
        members.length ? h('div', { style: 'width:100%;margin-top:8px;display:flex;flex-wrap:wrap;gap:5px' }, members.map(d =>
          h('span', { class: 'zone-chip' }, [
            (DEVICE_MAP[d.type]?.icon || '') + ' ' + d.name,
            h('a', {
              style: 'cursor:pointer;color:var(--muted);margin-left:3px',
              onclick: () => store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); x.circuitId = null; renderAll(); }),
            }, '✕'),
          ]))) : h('div', { class: 'muted', style: 'width:100%;font-size:12px;margin-top:6px' }, '暂无点位'),
      ]));
    });
  }

  function renderDevs() {
    const box = $('#dev-box');
    box.innerHTML = '';
    const strong = p.devices.filter(d => (DEVICE_MAP[d.type] || {}).power === 'strong');
    if (!strong.length) {
      box.appendChild(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '🔌'), h('div', {}, '还没有强电点位'), h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn primary', onclick: () => location.hash = '#/layout' }, '去放置设备'))]));
      return;
    }
    const table = h('table', {}, [
      h('thead', {}, h('tr', {}, [h('th', {}, '点位'), h('th', {}, '区域'), h('th', {}, '功率'), h('th', {}, '所属回路')])),
      h('tbody', {}, strong
        .filter(d => !filter || d.name.includes(filter) || (DEVICE_MAP[d.type]?.name || '').includes(filter))
        .map(d => {
          const def = DEVICE_MAP[d.type];
          const z = p.zones.find(z => z.id === d.zoneId);
          return h('tr', {}, [
            h('td', {}, `${def.icon} ${d.name}`),
            h('td', { class: 'muted' }, z ? z.name : '—'),
            h('td', {}, def.kw ? def.kw + 'kW' : '—'),
            h('td', {}, h('select', {
              onchange: e => store.mutate(pp => { const x = pp.devices.find(q => q.id === d.id); x.circuitId = e.target.value || null; renderCircs(); }),
            }, [
              h('option', { value: '', selected: !d.circuitId }, '未分配'),
              ...p.circuits.filter(c => c.kind !== 'main').map(c => h('option', { value: c.id, selected: c.id === d.circuitId || false }, c.name)),
            ])),
          ]);
        })),
    ]);
    box.appendChild(table);
  }

  function renderAll() { renderCircs(); renderDevs(); }

  function autoAssign() {
    store.mutate(pp => {
      pp.devices.forEach(d => {
        const def = DEVICE_MAP[d.type];
        if (def.power !== 'strong') return;
        if (d.circuitId) return;
        let want = 'outlet';
        if (d.type.startsWith('light_') || /switch_(smart|dumb)/.test(d.type)) want = 'light';
        if (d.type === 'outlet_16a' || d.type.startsWith('ac_')) want = 'ac';
        if (d.type.startsWith('curtain_')) want = 'outlet';
        const z = pp.zones.find(z => z.id === d.zoneId);
        if (z?.roomType === 'kitchen') want = 'kitchen';
        if (z?.roomType === 'bathroom') want = 'bath';
        let c = pp.circuits.find(c => c.kind === want);
        if (!c) c = pp.circuits.find(c => c.kind === 'outlet') || pp.circuits.find(c => c.kind !== 'main');
        if (c) d.circuitId = c.id;
      });
    });
    renderAll();
    toast('已按"照明/插座/厨卫/空调"规则分配', 'ok');
  }

  function addCircuitDialog() {
    const nameI = h('input', { placeholder: '如：阳台回路', value: '' });
    const brI = h('select', {}, ['1P 16A', '1P 20A', '1P+N 20A 漏保', '1P+N 25A 漏保', '2P 25A', '2P 32A'].map(x => h('option', {}, x)));
    const maxI = h('input', { type: 'number', value: '12', min: '1' });
    modal({
      title: '新增回路',
      body: h('div', {}, [
        h('label', { class: 'fld' }, ['回路名称', nameI]),
        h('label', { class: 'fld' }, ['空开规格', brI]),
        h('label', { class: 'fld' }, ['建议点位数上限', maxI]),
      ]),
      footer: [
        h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
        h('button', { class: 'btn primary', onclick: () => {
          if (!nameI.value.trim()) return toast('请填写名称', 'warn');
          store.mutate(pp => pp.circuits.push({ id: uid('c'), name: nameI.value.trim(), breaker: brI.value, max: Number(maxI.value) || 12, kind: 'custom' }));
          $('#modal-host').classList.remove('show'); renderAll(); toast('已新增回路', 'ok');
        } }, '添加'),
      ],
    });
  }
  function delCircuit(c) {
    if (!confirm(`删除回路「${c.name}」？其中点位会变为未分配。`)) return;
    store.mutate(pp => { pp.circuits = pp.circuits.filter(x => x.id !== c.id); pp.devices.forEach(d => { if (d.circuitId === c.id) d.circuitId = null; }); });
    renderAll();
  }

  function sc(v, l, cls) { return h('div', { class: 'card stat-card ' + cls }, [h('div', { class: 'v' }, String(v)), h('div', { class: 'l' }, l)]); }

  store.markStep('panel', p.devices.some(d => d.circuitId));
  renderAll();
}
