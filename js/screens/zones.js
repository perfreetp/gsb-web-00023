'use strict';

Screens.zones=function(root,p){
  const body=shell(root,p,'zones','② 划分区域并命名','框出客厅、卧室、厨房…设备放进去会自动归属并参与场景联动');
  body.innerHTML=`${wizardBar('zones')}
  <div class="editor">
    <div class="card panel">
      <div class="sec-title">区域 <span class="pill-count">${p.zones.length}</span></div>
      <div id="zoneList"></div>
      <button class="btn ghost" style="width:100%;margin-top:6px" id="addZone">＋ 在画布上框选新区域</button>
      <div class="hint" style="margin-top:10px">在画布上拖拽框出房间范围，松手即可；区域可重叠微调，后画的区域在上层。</div>
      <div class="sec-title" style="margin-top:18px">快捷模板</div>
      <button class="btn ghost" style="width:100%;margin-bottom:6px" id="tpl2">两室一厅分区</button>
      <button class="btn ghost" style="width:100%" id="tplClear">清空重画</button>
    </div>
    <div class="stage card" id="stage">
      ${stageToolbar(`
        <button class="btn sm on" data-m="draw-zone">▭ 框选区域</button>
        <button class="btn sm" data-m="select">🖱️ 选择</button>
        <button class="btn sm" id="fit">适应</button>`)}
      <div class="canvas-hint">按住拖拽框出房间范围 → 松手后在左侧重命名</div>
    </div>
    <div class="card panel" id="prop"></div>
  </div>`;

  const stage=document.getElementById('stage');
  const cv=new PlanCanvas(stage,p,{
    mode:'draw-zone', showPanel:false, showConduits:false, showLinks:false, showDevices:false,
    onChange(){renderList();renderProp();Store.put(p);},
    onSelect(){renderProp();}
  });
  window._cv=cv;
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
    cv.setMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  });
  document.getElementById('fit').onclick=()=>{cv.fit();cv.render();};
  document.getElementById('addZone').onclick=()=>{
    cv.setMode('draw-zone');
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m==='draw-zone'));
  };
  document.getElementById('tplClear').onclick=async()=>{
    const ok=await modal({title:'清空区域',body:'将删除全部区域，不影响墙体和设备。继续？',okText:'清空',danger:true});
    if(ok){p.zones=[];Store.put(p);renderList();cv.render();renderProp();}
  };
  document.getElementById('tpl2').onclick=()=>{
    p.zones=[
      {id:uid('z_'),name:'客厅',x:0,y:p.wallH*0.38,w:p.wallW*0.62,h:p.wallH*0.62,color:ZONE_COLORS[0]},
      {id:uid('z_'),name:'厨房',x:0,y:0,w:p.wallW*0.28,h:p.wallH*0.38,color:ZONE_COLORS[1]},
      {id:uid('z_'),name:'餐厅玄关',x:p.wallW*0.28,y:0,w:p.wallW*0.34,h:p.wallH*0.38,color:ZONE_COLORS[2]},
      {id:uid('z_'),name:'主卧',x:p.wallW*0.62,y:0,w:p.wallW*0.38,h:p.wallH*0.55,color:ZONE_COLORS[3]},
      {id:uid('z_'),name:'次卧',x:p.wallW*0.62,y:p.wallH*0.55,w:p.wallW*0.38,h:p.wallH*0.45,color:ZONE_COLORS[4]},
    ];
    Store.put(p);renderList();cv.render();
  };

  function renderList(){
    const el1=document.getElementById('zoneList');
    el1.innerHTML=p.zones.map(z=>`
      <div class="zone-row">
        <span class="zone-dot" style="background:${z.color}"></span>
        <input value="${U.esc(z.name)}" data-id="${z.id}" class="zname">
        <span class="area">${(z.w*z.h).toFixed(1)}㎡</span>
        <button class="btn sm ghost" data-del="${z.id}">✕</button>
      </div>`).join('')||'<div class="hint">还没有区域，在画布上框一个吧。</div>';
    el1.querySelectorAll('.zname').forEach(inp=>inp.oninput=e=>{
      const z=p.zones.find(x=>x.id===e.target.dataset.id);z.name=e.target.value;cv.render();Store.put(p);
    });
    el1.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      p.zones=p.zones.filter(z=>z.id!==b.dataset.del);
      p.devices.forEach(d=>{if(d.zone===b.dataset.del)d.zone=null;});
      Store.put(p);renderList();cv.render();renderProp();
    });
    document.querySelector('.pill-count').textContent=p.zones.length;
  }
  function renderProp(){
    const box=document.getElementById('prop');
    const sel=cv.selected;
    if(!sel||sel.kind!=='obs'){
      box.innerHTML=`<div class="prop-empty"><span class="big">🧩</span>
        框好区域、命好名<br>就可以往家里「搭积木」放设备啦<br><br>
        <button class="btn primary" onclick="Router.go('devices',{pid:'${p.id}'})">下一步：拖入设备 →</button></div>`;
      return;
    }
    box.innerHTML='<div class="hint">梁柱在①户型图中编辑。</div>';
  }
  renderList();renderProp();
};
