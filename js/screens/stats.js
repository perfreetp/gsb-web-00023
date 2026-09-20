'use strict';

Screens.stats=function(root,p){
  const body=shell(root,p,'stats','⑦ 材料清单与预算估算','自动统计设备/点位/线材长度，按市价给出装修小白也看得懂的预算');
  const b=bom(p), bg=budget(p), lens=conduitLengths(p);
  const strongN=p.devices.filter(d=>DEVICE_TYPES[d.type]?.power==='strong'||DEVICE_TYPES[d.type]?.cable?.weak&&DEVICE_TYPES[d.type]?.cable?.strong).length;
  const weakN=p.devices.filter(d=>DEVICE_TYPES[d.type]?.power==='weak'||DEVICE_TYPES[d.type]?.cable?.weak).length;
  body.innerHTML=`${wizardBar('stats')}
  <div class="grid stat-cards" style="margin-bottom:16px">
    <div class="card stat-card"><div class="v">${p.devices.length}</div><div class="l">📍 点位总数</div></div>
    <div class="card stat-card"><div class="v" style="color:#ef4444">${strongN} <span style="color:#2563eb">/ ${weakN}</span></div><div class="l">强电 / 弱电点位</div></div>
    <div class="card stat-card"><div class="v">${Math.round(lens.strong+lens.weak+(lens.bridge||0))}<span class="e">m</span></div><div class="l">🧵 线管总长（含弯耗）</div></div>
    <div class="card stat-card"><div class="v">${U.money(bg.sum)}</div><div class="l">💰 预算估算（含人工）</div></div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 320px;gap:16px;align-items:start">
    <div class="card panel" style="max-height:none">
      <div class="sec-title">材料清单 BOM
        <span style="flex:1"></span>
        <button class="btn sm ghost" id="csvBtn">⬇ 导出CSV</button>
        <button class="btn sm ghost" id="printBtn">🖨️ 打印</button>
      </div>
      <div style="overflow-x:auto"><table class="table">
        <thead><tr><th>类别</th><th>名称</th><th>规格</th><th>数量</th><th>单价</th><th>小计</th></tr></thead>
        <tbody>
          ${b.items.map(i=>`<tr><td><span class="tag">${i.cat}</span></td><td>${U.esc(i.name)}</td>
            <td class="muted">${U.esc(i.spec)}</td><td>${i.qty} ${i.unit}</td><td>¥${i.price}</td><td><b>¥${i.subtotal}</b></td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div>
      <div class="card panel" style="max-height:none;margin-bottom:16px">
        <div class="sec-title">预算构成</div>
        ${[['设备费用',bg.device,'#3b6ef5'],['线材管材',bg.cable,'#0ea5e9'],
           ['施工人工 35%',bg.labor,'#16a34a'],['设计调试 6%',bg.design,'#f59e0b'],['不可预见 8%',bg.reserve,'#94a3b8']].map(([n,v,c])=>`
          <div class="kv"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${c};margin-right:6px"></i>${n}</span><b>${U.money(v)}</b></div>`).join('')}
        <div class="kv" style="border-top:2px solid var(--line);margin-top:6px;padding-top:10px"><span style="font-weight:700">预算总计</span><b style="font-size:18px;color:var(--brand)">${U.money(bg.sum)}</b></div>
        <div class="hint" style="margin-top:8px">价格为 2025 年市场参考价（二线城市），实际以电工报价与品牌选型为准。</div>
      </div>
      <div class="card panel" style="max-height:none">
        <div class="sec-title">分区设备数量</div>
        ${p.zones.map(z=>{const n=p.devices.filter(d=>d.zone===z.id).length;return `
          <div class="kv"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${z.color};margin-right:6px"></i>${U.esc(z.name)}</span><b>${n} 个 · ${(z.w*z.h).toFixed(1)}㎡</b></div>`;}).join('')}
        <button class="btn primary" style="width:100%;margin-top:14px" onclick="Router.go('docs',{pid:'${p.id}'})">下一步：交底·分享 →</button>
      </div>
    </div>
  </div>`;

  document.getElementById('csvBtn').onclick=()=>download(`${p.name}-材料清单.csv`,bomCSV(p),'text/csv;charset=utf-8');
  document.getElementById('printBtn').onclick=()=>window.print();
};
