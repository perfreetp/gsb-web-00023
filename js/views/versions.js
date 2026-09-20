import { h, $, toast, modal, copyText } from '../util.js';
import { store } from '../state.js';

export function mount(root) {
  const p = store.project;

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, '版本管理与链接分享'),
      h('p', {}, '每个版本是当前方案的完整快照；分享链接采用 gzip 压缩编码，无需登录即可只读查看。'),
    ]),
    h('button', { class: 'btn primary', onclick: saveV }, '💾 立即保存当前版本'),
  ]));

  const two = h('div', { class: 'two-col' });
  root.appendChild(two);

  // 分享卡片
  const shareCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, h('h3', {}, '分享给家人 / 设计师 / 电工')),
    h('div', { class: 'card-b' }, [
      h('p', { class: 'muted', style: 'font-size:12.5px;line-height:1.7' }, '生成链接后，对方打开即可看到完整的点位图、布线、清单与交底书（只读）；对方也可一键"复制为我的方案"继续修改，不影响你的原方案。'),
      h('div', { style: 'display:flex;gap:8px;margin:10px 0' }, [
        h('button', { class: 'btn primary', style: 'flex:1', onclick: e => genLink(e.target) }, '🔗 生成分享链接'),
        h('button', { class: 'btn', onclick: () => { store.exportJSON(); } }, '⬇ 导出JSON备份'),
      ]),
      h('input', { class: 'share-link', id: 'share-link', readonly: true, placeholder: '点击"生成分享链接"…' }),
      h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
        h('button', { class: 'btn small', onclick: () => { const el = $('#share-link'); if (el.value) copyText(el.value); else toast('请先生成链接', 'warn'); } }, '📋 复制链接'),
        h('button', { class: 'btn small', onclick: () => { const el = $('#share-link'); if (el.value) window.open(el.value, '_blank'); else toast('请先生成链接', 'warn'); } }, '👁 新窗口预览'),
      ]),
      h('hr', { style: 'border:none;border-top:1px solid var(--line);margin:16px 0' }),
      h('h5', { style: 'margin:0 0 8px;font-size:13px' }, '分享内容包含'),
      h('div', { class: 'check-list' }, [
        ck('户型底图与结构（承重墙/梁/柱）'),
        ck('房间区域、全部点位与尺寸标注'),
        ck('线管/桥架走向、开关回路、配电箱分配'),
        ck('场景联动、材料清单、预算与施工交底书'),
      ]),
      h('p', { class: 'muted', style: 'font-size:11.5px;margin-top:10px;line-height:1.6' }, '链接数据量较大时建议用 Chrome/Edge 打开；也可以直接发送导出的 JSON 文件。'),
    ]),
  ]);

  // 版本列表
  const listCard = h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('h3', {}, `历史版本（${p.versions.length}）`),
      h('span', { class: 'muted', style: 'font-size:12px' }, '最多保留 20 个'),
    ]),
    h('div', { class: 'card-b version-item', id: 'vlist' }),
  ]);
  two.append(shareCard, listCard);

  function render() {
    const box = $('#vlist');
    box.innerHTML = '';
    if (!p.versions.length) {
      box.appendChild(h('div', { class: 'empty' }, [h('div', { class: 'big' }, '📚'), h('div', {}, '还没有版本快照'), h('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, '大改前点"立即保存当前版本"，随时可回退')]));
      return;
    }
    p.versions.forEach((v, i) => {
      const snap = v.snap;
      box.appendChild(h('div', { style: 'padding:12px 0;border-bottom:1px solid var(--line)' }, [
        h('div', { class: 'vi-top' }, [
          h('div', {}, [
            h('strong', {}, v.label),
            i === 0 ? h('span', { class: 'pill', style: 'margin-left:8px' }, '最新') : null,
            h('div', { class: 'muted', style: 'font-size:11.5px;margin-top:3px' }, new Date(v.time).toLocaleString('zh-CN')),
          ]),
          h('div', { style: 'display:flex;gap:6px' }, [
            h('button', { class: 'btn small', onclick: () => restore(v) }, '↩ 恢复'),
            h('button', { class: 'btn small ghost danger', onclick: () => del(v) }, '🗑'),
          ]),
        ]),
        h('div', { class: 'muted', style: 'font-size:12px;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap' }, [
          h('span', {}, `🎯 ${snap.devices.length} 点位`),
          h('span', {}, `🪧 ${snap.zones.length} 区域`),
          h('span', {}, `🧵 ${snap.conduits.length} 线管`),
          h('span', {}, `📐 ${snap.width}×${snap.height}`),
        ]),
      ]));
    });
  }
  render();

  function saveV() {
    const inp = h('input', { placeholder: '例如：初版给电工审核' });
    modal({
      title: '保存版本快照',
      body: h('label', { class: 'fld' }, ['版本备注（可留空）', inp]),
      footer: [
        h('button', { class: 'btn', onclick: () => $('#modal-host').classList.remove('show') }, '取消'),
        h('button', { class: 'btn primary', onclick: () => { store.saveVersion(inp.value.trim()); $('#modal-host').classList.remove('show'); render(); toast('版本已保存', 'ok'); } }, '保存'),
      ],
    });
    setTimeout(() => inp.focus(), 50);
  }
  function restore(v) {
    if (!confirm(`恢复到「${v.label}」？当前编辑内容会被覆盖（当前状态不会自动存版本，建议先保存）。`)) return;
    store.restoreVersion(v.id);
    render(); toast('已恢复到该版本', 'ok');
  }
  function del(v) {
    if (!confirm('删除版本「' + v.label + '」？')) return;
    store.deleteVersion(v.id); render();
  }
  async function genLink(btn) {
    btn.disabled = true; btn.textContent = '生成中…';
    try {
      const url = await store.sharePayload();
      $('#share-link').value = url;
      toast('链接已生成，可复制发送', 'ok', 3200);
    } catch (e) {
      console.error(e);
      toast('生成失败：方案数据过大，建议导出 JSON 发送', 'err', 4000);
    } finally {
      btn.disabled = false; btn.textContent = '🔗 生成分享链接';
    }
  }
  function ck(t) { return h('div', { class: 'ci' }, [h('input', { type: 'checkbox', checked: true, disabled: true }), h('span', {}, t)]); }
}
