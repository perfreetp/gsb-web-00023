'use strict';

Screens.panel=function(root,p){
  const body=shell(root,p,'panel','⑥ 配电箱回路分配','每个回路实时统计点位数量与估算功率，超载红色预警');
  body.innerHTML=`${wizardBar('panel')}
  <div class="grid" style="grid-template-columns:340px 1fr;gap:16px;align-items:start">
    <div class="card panel" style="max-height:none">
      <div class="sec-title">回路概览</div>
      <div id="circList"></div>
      <button class="btn ghost" style="width:100%;margin-top:8px" id="addCircuit">＋ 新增回路</button>
      <button class="btn" style="width:100%;margin-top:8px" id="reAuto">🔁 全部恢复自动分配</button>
      <div class="hint" style="margin-top:10px">新增大功率电器（蒸烤箱、电热水器）时建议单独成回路。</div>
    </div>
    <div class="card panel" style="max-height:none">
      <div class="sec-title">点位 → 回路明细表</div>
      <div style="overflow-x:auto"><table class="table" id="tbl">
        <thead><tr><th>设备</th><th>区域</th><th>电气</th><th>估算功率</th><th style="width:220px">分配回路</th></tr></thead>
        <tbody></tbody></table></div>
      <div class="row" style="justify-content:flex-end;margin-top:16px">
        <button class="btn primary" onclick="Router.go('stats',{pid:'${p.id}'})">下一步：清单预算 →</button>
      </div>
    </div>
  </div>`;

  function render(){
    const loads=circuitLoads(p);
    document.getElementById('circList').innerHTML=loads.map(c=>`
      <div class="ver-row ${c.overload?'':''}" style="flex-wrap:wrap">
        <span class="tag ${c.type==='strong'?'strong':'weak'}">${c.type==='strong'?'强电':'弱电'}</span>
        <b style="flex:1;min-width:90px">${U.esc(c.name)}</b>
        <span class="muted">${c.breaker} · ${c.cable}</span>
      </div>
      <div style="margin:-6px 0 12px 12px">
        <div class="kv" style="border:none;padding:2px 0"><span>点位 ${c.count} 个</span>
          <b style="color:${c.overload?'var(--danger)':'inherit'}">${c.load} W${c.limit?` / ${c.limit} W`:''}</b></div>
        <div class="budget-bar"><i style="width:${c.limit?U.clamp(c.load/c.limit*100,4,100):30}%;
          background:${c.overload?'var(--danger)':''}"></i></div>
        ${c.overload?'<div class="warn-item danger" style="margin-top:4px">⛔ 超载，请把部分插座挪到其他回路</div>':''}
      </div>`).join('');

    const tb=document.querySelector('#tbl tbody');
    tb.innerHTML=p.devices.map((d,i)=>{
      const t=DEVICE_TYPES[d.type];
      const z=p.zones.find(zn=>zn.id===d.zone);
      const pw=POWER_BY_TYPE[d.type]??POWER_BY_CAT[t.cat]??0;
      return `<tr>
        <td>${t.icon} ${U.esc(d.label||t.name)}</td>
        <td>${z?U.esc(z.name):'<span class="muted">—</span>'}</td>
        <td><span class="tag ${t.power==='strong'?'strong':'weak'}">${t.cable?.strong&&t.cable?.weak?'强+弱':(t.power==='strong'?'强电':'弱电')}</span></td>
        <td>${pw} W</td>
        <td><select data-i="${i}" class="input">
          ${p.circuits.map(c=>`<option value="${c.id}" ${d.circuitId===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select></td></tr>`;
    }).join('')||'<tr><td colspan="5" class="muted">还没有点位，先去③拖入设备。</td></tr>';
    tb.querySelectorAll('select').forEach(sel=>sel.onchange=e=>{
      p.devices[+e.target.dataset.i].circuitId=e.target.value;Store.put(p);render();
    });
  }
  document.getElementById('addCircuit').onclick=()=>{
    p.circuits.push({id:uid('c_'),name:'新回路'+(p.circuits.length+1),type:'strong',
      breaker:'C20',cable:'BV 2.5mm²',limit:3000});
    Store.put(p);render();
  };
  document.getElementById('reAuto').onclick=()=>{autoAssignCircuits(p);Store.put(p);render();toast('已按区域与设备类型重新分配');};
  render();
};
