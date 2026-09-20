import { h, $, toast, modal } from '../util.js';
import { store } from '../state.js';
import { SCENE_TEMPLATES, DEVICE_MAP, ROOM_MAP } from '../catalog.js';

function matchDevices(p, rule) {
  // rule: "light_*" | "zone:living,light_*" | "outlet_smart"
  let pool = [...p.devices];
  const parts = rule.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.startsWith('zone:')) {
      const rt = part.slice(5);
      pool = pool.filter(d => {
        const z = p.zones.find(z => z.id === d.zoneId);
        return z && (z.roomType === rt || z.name.includes(rt));
      });
    } else if (part.includes('*')) {
      const prefix = part.replace('*', '');
      pool = pool.filter(d => d.type.startsWith(prefix));
    } else {
      pool = pool.filter(d => d.type === part);
    }
  }
  return pool;
}
export function matchedCount(p, acts) {
  const ids = new Set();
  acts.forEach(a => matchDevices(p, a.match).forEach(d => ids.add(d.id)));
  return ids.size;
}
export { matchDevices };

export function mount(root) {
  const p = store.project;
  store.ensureScenes();

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, '场景联动'),
      h('p', {}, '内置回家、离家、观影、睡眠等模板，按房间与设备类型自动匹配；匹配数会随点位布局实时更新。'),
    ]),
    h('button', { class: 'btn', onclick: () => resetTpl() }, '↺ 恢复模板默认'),
  ]));

  const grid = h('div', { class: 'scene-grid grid' });
  root.appendChild(grid);

  function render() {
    grid.innerHTML = '';
    p.scenes.forEach(sc => {
      const n = matchedCount(p, sc.acts);
      grid.appendChild(h('div', { class: 'card scene-card' }, [
        h('div', { class: 'card-b' }, [
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
            h('span', { class: 'emoji' }, sc.icon),
            h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer' }, [
              h('input', { type: 'checkbox', checked: sc.enabled || false, onchange: e => store.mutate(pp => { const s = pp.scenes.find(x => x.id === sc.id); s.enabled = e.target.checked; }) }),
              sc.enabled ? '启用' : '停用',
            ]),
          ]),
          h('h3', { style: 'margin:10px 0 4px;font-size:16px' }, sc.name),
          h('div', { class: 'muted', style: 'font-size:12.5px' }, sc.desc),
          h('div', { class: 'acts' }, sc.acts.map(a => actText(p, a)).slice(0, 3).join('；') + (sc.acts.length > 3 ? ` 等 ${sc.acts.length} 条` : '')),
          h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
            h('span', { class: 'tag ' + (n ? 'ok' : 'warn') }, `匹配 ${n} 个设备`),
            h('button', { class: 'btn small', onclick: () => editScene(sc) }, '编辑动作'),
          ]),
        ]),
      ]));
    });
  }
  render();

  root.appendChild(h('div', { style: 'margin-top:16px' }, h('button', {
    class: 'btn primary', onclick: () => { location.hash = '#/wiring'; },
  }, '下一步：自动布线 →')));

  function actText(pp, a) {
    const n = matchDevices(pp, a.match).length;
    const cmdMap = { on: '开启', off: '关闭', open: '打开', close: '关闭', cool: '制冷', arm: '布防', privacy: '隐私遮蔽', sleep: '睡眠' };
    const extra = a.level != null ? ` ${a.level}%` : a.temp != null ? ` ${a.temp}℃` : '';
    return `${matchLabel(a.match)} ${cmdMap[a.cmd] || a.cmd}${extra}（${n}）`;
  }
  function matchLabel(m) {
    const parts = m.split(',').map(x => x.trim());
    return parts.map(x => {
      if (x.startsWith('zone:')) return (ROOM_MAP[x.slice(5)] || { name: x.slice(5) }).name;
      const def = DEVICE_MAP[x.replace('*', 'main')] || DEVICE_MAP[x];
      if (x.includes('*')) {
        const pre = x.replace('*', '');
        const nameMap = { light_: '灯具', curtain_: '窗帘', cam_: '摄像', ac_: '空调', alarm_: '报警器' };
        return nameMap[pre] || x;
      }
      return def ? def.name : x;
    }).join('·');
  }

  function editScene(sc) {
    const list = h('div', {});
    const drawList = () => {
      list.innerHTML = '';
      sc.acts.forEach((a, i) => {
        list.appendChild(h('div', { class: 'wi wire-list' }, [
          h('span', { style: 'flex:1' }, actText(p, a)),
          h('button', { class: 'btn small ghost danger', onclick: () => store.mutate(pp => { pp.scenes.find(x => x.id === sc.id).acts.splice(i, 1); editScene(sc); }) }, '删'),
        ]));
      });
    };
    drawList();
    modal({
      title: `${sc.icon} ${sc.name} · 动作列表`,
      wide: true,
      body: h('div', {}, [
        h('p', { class: 'muted', style: 'font-size:12.5px' }, '规则支持：设备类型（如 light_main）、通配（light_*、curtain_*）、房间限定（zone:living,light_*）。'),
        list,
        h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:12px 0' }),
        h('div', { style: 'display:flex;gap:8px' }, [
          h('input', { style: 'flex:2', value: '', placeholder: '匹配规则，如 zone:living,light_strip' }),
          h('select', {}, ['on:开启', 'off:关闭', 'open:打开', 'close:关闭', 'cool:制冷', 'sleep:睡眠', 'arm:布防', 'privacy:遮蔽'].map(t => {
            const [v, l] = t.split(':'); return h('option', { value: v }, l);
          })),
          h('input', { type: 'number', style: 'width:90px', placeholder: '亮度%' }),
          h('button', { class: 'btn', onclick: (e) => {
            const row = e.target.closest('.modal-b');
            const ins = row.querySelectorAll('input');
            const sel = row.querySelector('select');
            const m = ins[0].value.trim(), level = ins[1].value;
            if (!m) return toast('请填写匹配规则', 'warn');
            store.mutate(pp => {
              const s = pp.scenes.find(x => x.id === sc.id);
              const act = { match: m, cmd: sel.value };
              if (level) act.level = Number(level);
              s.acts.push(act);
            });
            editScene(sc);
          } }, '＋ 添加'),
        ]),
      ]),
      footer: h('button', { class: 'btn primary', onclick: () => { $('#modal-host').classList.remove('show'); render(); } }, '完成'),
    });
  }

  function resetTpl() {
    if (!confirm('恢复所有场景为模板默认动作？自定义修改会丢失。')) return;
    store.mutate(pp => {
      pp.scenes = SCENE_TEMPLATES.map(t => ({ id: 's_' + Math.random().toString(36).slice(2, 7), tpl: t.id, name: t.name, icon: t.icon, desc: t.desc, enabled: true, acts: t.acts.map(a => ({ ...a })) }));
    });
    render();
    toast('已恢复默认场景', 'ok');
  }
}
