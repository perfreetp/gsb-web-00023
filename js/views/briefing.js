import { h, toast, download, copyText } from '../util.js';
import { store } from '../state.js';
import { briefing, validate } from '../stats.js';

export function mount(root) {
  const p = store.project;
  const text = briefing(p);
  const warns = validate(p);

  root.appendChild(h('div', { class: 'page-head' }, [
    h('div', {}, [
      h('h2', {}, '施工交底说明'),
      h('p', {}, '按电工视角汇总回路、线管、强弱电规范与必须整改项，可直接打印或复制发给电工。'),
    ]),
    h('div', { style: 'display:flex;gap:8px' }, [
      h('button', { class: 'btn', onclick: () => copyText(text) }, '📋 复制全文'),
      h('button', { class: 'btn', onclick: () => { download(`${p.name}-施工交底.txt`, text); toast('已下载交底说明', 'ok'); } }, '⬇ 下载TXT'),
      h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 打印 / 存PDF'),
    ]),
  ]));

  const warnCard = h('div', { class: 'card', style: 'margin-bottom:16px' }, [
    h('div', { class: 'card-h' }, h('h3', {}, '交底前风险检查')),
    h('div', { class: 'card-b' }, warns.map(w => h('div', { class: 'warn-item ' + w.level }, [
      h('span', {}, w.level === 'ok' ? '✅' : w.level === 'danger' ? '⛔' : '⚠️'),
      h('div', {}, [h('strong', {}, w.title), h('div', { class: 'muted', style: 'margin-top:2px' }, w.msg)]),
    ]))),
  ]);
  root.appendChild(warnCard);

  root.appendChild(h('div', { class: 'card' }, [
    h('div', { class: 'card-h' }, [
      h('h3', {}, '交底书预览'),
      h('span', { class: 'muted', style: 'font-size:12px' }, '等宽排版，打印效果即所得'),
    ]),
    h('div', { class: 'card-b' }, h('pre', { class: 'brief-box' }, text)),
  ]));

  root.appendChild(h('div', { style: 'margin-top:16px' }, h('button', {
    class: 'btn primary', onclick: () => location.hash = '#/versions',
  }, '下一步：保存版本并分享 →')));
}
