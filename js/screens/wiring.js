'use strict';

Screens.wiring=function(root,p){
  const body=shell(root,p,'wiring','⑤ 线管桥架走向','自动绕开梁柱与承重墙，实时提醒强弱电间距不足（≥30cm）');
  body.innerHTML=`${wizardBar('wiring')}
  <div class="editor">
    <div class="card panel">
      <div class="sec-title">自动布线</div>
      <button class="btn primary" style="width:100%;margin-bottom:8px" id="autoBtn">⚡ 一键生成全部线管</button>
      <button class="btn ghost" style="width:100%;margin-bottom:8px" id="linksBtn">🔗 重新生成开关回路</button>
      <div class="hint" style="margin-bottom:14px">从配电箱/弱电箱出发，自动用 10cm 栅格 A* 寻路，绕开承重柱、横梁与承重墙；穿普通隔墙会尽量绕边走。</div>
      <div class="sec-title">手动画法</div>
      <button class="btn ghost" data-m="select" style="width:100%;justify-content:flex-start;margin-bottom:6px">🖱️ 选择/删除管段</button>
      <button class="btn ghost" data-m="draw-strong" style="width:100%;justify-content:flex-start;margin-bottom:6px;color:#b91c1c">— 画强电线管(红)</button>
      <button class="btn ghost" data-m="draw-weak" style="width:100%;justify-content:flex-start;margin-bottom:6px;color:#1d4ed8">— 画弱电线管(蓝)</button>
      <button class="btn ghost" data-m="draw-bridge" style="width:100%;justify-content:flex-start;margin-bottom:6px;color:#6d28d9">▰ 画金属桥架(紫)</button>
      <button class="btn ghost" id="placePanel" style="width:100%;justify-content:flex-start;margin-bottom:6px">⚡ 移动配电箱</button>
      <button class="btn ghost" id="placeWeak" style="width:100%;justify-content:flex-start;margin-bottom:10px">🔌 移动弱电箱</button>
      <div class="sec-title">图例</div>
      <div class="hint">
        <div><i style="display:inline-block;width:20px;height:4px;background:#ef4444;vertical-align:middle;margin-right:6px"></i>强电 PVC 线管</div>
        <div style="margin-top:5px"><i style="display:inline-block;width:20px;height:4px;background:#2563eb;vertical-align:middle;margin-right:6px"></i>弱电 PVC 线管</div>
        <div style="margin-top:5px"><i style="display:inline-block;width:20px;height:5px;background:#7c3aed;vertical-align:middle;margin-right:6px"></i>镀锌金属桥架</div>
        <div style="margin-top:5px"><i style="display:inline-block;width:20px;border-top:2px dashed #f59e0b;vertical-align:middle;margin-right:6px"></i>开关回路控制线</div>
      </div>
    </div>
    <div class="stage card" id="stage">
      ${stageToolbar(`
        <button class="btn sm" id="fit">适应</button>
        <button class="btn sm" id="toggleDim">尺寸标注</button>
        <button class="btn sm danger" id="clearAuto">清除自动管路</button>`)}
      <div class="canvas-hint">红/蓝管距离 &lt;30cm 自动标⚠️；交叉按强条必须包锡箔纸处理</div>
    </div>
    <div class="card panel" id="side">
      <div id="warnBox"></div>
      <div id="lenBox" style="margin-top:14px"></div>
      <button class="btn primary" style="width:100%;margin-top:14px" onclick="Router.go('panel',{pid:'${p.id}'})">下一步：配电箱回路 →</button>
    </div>
  </div>`;

  const stage=document.getElementById('stage');
  const cv=new PlanCanvas(stage,p,{
    mode:'select', showConduits:true, showLinks:true, showPanel:true, showDims:false,
    onChange(){renderSide();Store.put(p);},
    onSelect(){renderSide();},
    onPlacePoint(w){
      if(cv._placeWhat==='panel') p.panel={x:w.x,y:w.y};
      else p.weakBox={x:w.x,y:w.y};
      cv.setMode('select');
      document.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m==='select'));
      Store.put(p);cv.render();renderSide();
      toast(cv._placeWhat==='panel'?'配电箱位置已更新':'弱电箱位置已更新');
    }
  });
  window._cv=cv;
  document.getElementById('fit').onclick=()=>{cv.fit();cv.render();};
  document.getElementById('toggleDim').onclick=e=>{cv.setOpt('showDims',!cv.opts.showDims);e.target.classList.toggle('on',cv.opts.showDims);};
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
    cv.setMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  });
  document.getElementById('placePanel').onclick=()=>{cv._placeWhat='panel';cv.setMode('place-point');toast('在画布上点击配电箱新位置');};
  document.getElementById('placeWeak').onclick=()=>{cv._placeWhat='weak';cv.setMode('place-point');toast('在画布上点击弱电箱新位置');};

  document.getElementById('autoBtn').onclick=()=>{
    if(!p.devices.length){toast('请先在③中拖入设备');return;}
    generateConduits(p);
    if(!p.links.length) generateSwitchLinks(p);
    Store.put(p);cv.render();renderSide();
    toast(`已生成 ${p.conduits.filter(c=>c.auto).length} 条自动管路并完成间距检测`);
  };
  document.getElementById('linksBtn').onclick=()=>{generateSwitchLinks(p);Store.put(p);cv.render();toast('开关回路已更新');};
  document.getElementById('clearAuto').onclick=async()=>{
    const ok=await modal({title:'清除自动管路',body:'仅删除系统自动生成的线管，你手动画的管路会保留。',okText:'清除',danger:true});
    if(ok){p.conduits=p.conduits.filter(c=>c.manual);Store.put(p);cv.render();renderSide();}
  };

  function renderSide(){
    const issues=[...warnings(p),...spacingCheck(p)];
    const box=document.getElementById('warnBox');
    box.innerHTML=`<div class="sec-title">合规检查 <span class="pill-count ${issues.length?'':''}">${issues.length}</span></div>`+
      (issues.length?issues.map(i=>`<div class="warn-item ${i.level}">${i.level==='danger'?'⛔':'⚠️'} ${i.text}</div>`).join('')
        :'<div class="warn-item ok">✅ 未发现强/弱电间距与回路问题</div>');
    const lens=conduitLengths(p);
    document.getElementById('lenBox').innerHTML=`
      <div class="sec-title">管路长度统计（含15%弯耗+预留）</div>
      <div class="kv"><span style="color:#ef4444">强电线管</span><b>${lens.strong.toFixed(1)} m</b></div>
      <div class="kv"><span style="color:#2563eb">弱电线管</span><b>${lens.weak.toFixed(1)} m</b></div>
      <div class="kv"><span style="color:#7c3aed">金属桥架</span><b>${(lens.bridge||0).toFixed(1)} m</b></div>
      <div class="kv"><span>管路总数</span><b>${p.conduits.length} 条</b></div>`;
  }
  renderSide();
};
