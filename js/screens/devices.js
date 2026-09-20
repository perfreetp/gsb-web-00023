'use strict';

Screens.devices=function(root,p){
  const body=shell(root,p,'devices','③ 从设备库拖入点位','红点=强电 · 蓝点=弱电 · 半圆=强弱电一体；点位自动吸附对齐并可标尺寸');
  let view='point';
  body.innerHTML=`${wizardBar('devices')}
  <div class="editor">
    <div class="card panel">
      <input class="input lib-search" id="libSearch" placeholder="🔍 搜索设备，如“灯/插座”">
      <div id="library"></div>
    </div>
    <div class="stage card" id="stage">
      ${stageToolbar(`
        <button class="btn sm on" id="viewPoint">📍 点位图</button>
        <button class="btn sm" id="viewWire">🧵 布线图</button>
        <button class="btn sm" data-m="select">🖱️ 选择</button>
        <button class="btn sm" data-m="dim">📏 标尺寸</button>
        <button class="btn sm" id="genLinks">🔗 生成开关回路</button>
        <button class="btn sm" id="fit">适应</button>`)}
      <div class="canvas-hint">从左侧拖设备到画布；靠近墙线/其他设备会出现蓝色吸附参考线</div>
      <div class="canvas-scale legend" style="background:rgba(255,255,255,.92);box-shadow:var(--shadow);padding:6px 12px;border-radius:9px">
        <span><i style="background:#ef4444"></i>强电点位</span><span><i style="background:#2563eb"></i>弱电点位</span>
        <span><i style="background:#f59e0b"></i>开关回路</span><span><i style="background:#475569"></i>梁柱/承重墙</span>
      </div>
    </div>
    <div class="card panel" id="prop"></div>
  </div>`;

  const stage=document.getElementById('stage');
  const cv=new PlanCanvas(stage,p,{
    mode:'select', showLinks:p.links.length>0, showConduits:false, showPanel:false,
    onChange(){renderProp();Store.put(p);},
    onSelect(){renderProp();}
  });
  window._cv=cv;

  function setView(v){
    view=v;
    cv.setOpt('showLinks',v==='wire'||p.links.length>0);
    cv.setOpt('showConduits',v==='wire');
    cv.setOpt('showPanel',v==='wire');
    cv.setOpt('showWalls',true);
    document.getElementById('viewPoint').classList.toggle('on',v==='point');
    document.getElementById('viewWire').classList.toggle('on',v==='wire');
    if(v==='wire'&&p.conduits.length===0){toast('布线图为空，可在⑤线管布线中一键生成');}
  }
  document.getElementById('viewPoint').onclick=()=>setView('point');
  document.getElementById('viewWire').onclick=()=>setView('wire');
  document.getElementById('fit').onclick=()=>{cv.fit();cv.render();};
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
    cv.setMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  });
  document.getElementById('genLinks').onclick=()=>{
    generateSwitchLinks(p);
    cv.setOpt('showLinks',true);
    Store.put(p);cv.render();
    toast(`已按“同区域开关就近控制灯具”生成 ${p.links.length} 条回路连线`);
  };

  function renderLib(filter=''){
    const lib=document.getElementById('library');
    lib.innerHTML=CATEGORIES.map(cat=>{
      const items=Object.entries(DEVICE_TYPES).filter(([id,t])=>t.cat===cat.id)
        .filter(([id,t])=>!filter||t.name.includes(filter)||t.desc.includes(filter));
      if(!items.length)return '';
      const n=p.devices.filter(d=>DEVICE_TYPES[d.type]?.cat===cat.id).length;
      return `<div class="lib-group"><h4>${cat.icon} ${cat.name}<span>${n}</span></h4>
        ${items.map(([id,t])=>`
        <div class="lib-item" draggable="true" data-type="${id}">
          <div class="ic ${t.power==='strong'?'strong':(t.cable?.strong&&t.cable?.weak?'spec':'weak')}">${t.icon}</div>
          <div><div class="nm">${t.name}</div><div class="sub">
            <span class="tag ${t.power==='strong'?'strong':'weak'}">${t.power==='strong'?'强电':(t.cable?.strong&&t.cable?.weak?'强+弱':'弱电')}</span>
            ${t.desc}</div></div>
        </div>`).join('')}</div>`;
    }).join('');
    lib.querySelectorAll('.lib-item').forEach(it=>{
      it.addEventListener('dragstart',e=>{
        e.dataTransfer.setData('text/device',it.dataset.type);
        e.dataTransfer.effectAllowed='copy';
      });
    });
  }
  document.getElementById('libSearch').oninput=e=>renderLib(e.target.value.trim());
  renderLib();

  function rotate(d){d.rot=(d.rot+90)%360;Store.put(p);cv.render();}
  function addDim(d){
    cv.dims.push({x1:d.x,y1:d.y,x2:d.x,y2:d.y,devId:d.id});
    cv.setMode('dim');
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m==='dim'));
    toast('在画布上点击尺寸终点');
  }

  function renderProp(){
    const box=document.getElementById('prop');
    const sel=cv.selected;
    const d=sel&&sel.kind==='device'?p.devices.find(x=>x.id===sel.id):null;
    if(!d){
      const strong=p.devices.filter(x=>DEVICE_TYPES[x.type]?.power==='strong'
        ||(DEVICE_TYPES[x.type]?.cable?.strong&&DEVICE_TYPES[x.type]?.cable?.weak)).length;
      const weak=p.devices.filter(x=>DEVICE_TYPES[x.type]?.power==='weak').length;
      box.innerHTML=`<div class="sec-title">点位统计</div>
        <div class="kv"><span>总点位</span><b>${p.devices.length} 个</b></div>
        <div class="kv"><span>🔴 强电相关</span><b>${strong} 个</b></div>
        <div class="kv"><span>🔵 弱电相关</span><b>${weak} 个</b></div>
        <div class="kv"><span>开关回路</span><b>${p.links.length} 条</b></div>
        <div class="kv"><span>所属区域</span><b>${p.zones.length} 个</b></div>
        <div class="hint" style="margin-top:12px">点中任意点位可改名、旋转、标尺寸、改回路或删除。</div>
        <button class="btn primary" style="width:100%;margin-top:14px" onclick="Router.go('scenes',{pid:'${p.id}'})">下一步：智能场景 →</button>`;
      return;
    }
    const t=DEVICE_TYPES[d.type];
    const zone=p.zones.find(z=>z.id===d.zone);
    box.innerHTML=`
      <div class="sec-title">${t.icon} ${t.name}</div>
      <div class="field"><label>点位备注名（如：客厅主灯）</label>
        <input class="input" id="pName" value="${U.esc(d.label||'')}" placeholder="${t.name}"></div>
      <div class="kv"><span>类型</span><b>${t.name}</b></div>
      <div class="kv"><span>电气</span>
        <span class="tag ${t.power==='strong'?'strong':'weak'}">
        ${t.cable?.strong&&t.cable?.weak?'强电+弱电':t.power==='strong'?'强电':'弱电'}</span></div>
      <div class="kv"><span>所属区域</span><b>${zone?zone.name:'<span class="muted">区域外</span>'}</b></div>
      <div class="kv"><span>坐标</span><b>${d.x.toFixed(2)}, ${d.y.toFixed(2)} m</b></div>
      <div class="field" style="margin-top:10px"><label>手动指定回路（默认自动）</label>
        <select class="input" id="pCircuit">
          <option value="">自动分配</option>
          ${p.circuits.map(c=>`<option value="${c.id}" ${d.circuitId===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select></div>
      <div class="row" style="margin:12px 0">
        <button class="btn ghost sm" id="pRot">🔄 旋转</button>
        <button class="btn ghost sm" id="pDim">📏 标注到…</button>
      </div>
      <button class="btn danger" style="width:100%" id="pDel">删除该点位</button>`;
    document.getElementById('pName').oninput=e=>{d.label=e.target.value;cv.render();};
    document.getElementById('pName').onchange=()=>Store.put(p);
    document.getElementById('pCircuit').onchange=e=>{d.circuitId=e.target.value||null;Store.put(p);};
    document.getElementById('pRot').onclick=()=>rotate(d);
    document.getElementById('pDim').onclick=()=>addDim(d);
    document.getElementById('pDel').onclick=()=>{cv.deleteSelected();renderProp();Store.put(p);};
  }
  renderProp();
};
