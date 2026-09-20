'use strict';

Screens.floorplan=function(root,p){
  const body=shell(root,p,'floorplan','① 上传户型 / 手绘房间','先有一个底图，再画出墙体和不能打孔的梁柱、承重墙');
  body.innerHTML=`
  ${wizardBar('floorplan')}
  <div class="editor">
    <div class="card panel">
      <div class="sec-title">底图</div>
      <button class="btn ghost" style="width:100%;margin-bottom:8px" id="upImg">📷 上传户型图/手绘</button>
      <input type="file" id="fileImg" accept="image/*" hidden>
      <button class="btn ghost" style="width:100%" id="clearImg">移除底图（纯手绘）</button>
      <div class="hint" style="margin:8px 0 14px">没有图也没关系，直接在右边拖动画墙体就行。</div>
      <div class="sec-title">实际尺寸校准</div>
      <div class="row" style="margin-bottom:8px">
        <div style="flex:1"><label class="hint">净宽(米)</label><input class="input" id="wW" type="number" step="0.1" value="${p.wallW}"></div>
        <div style="flex:1"><label class="hint">净深(米)</label><input class="input" id="wH" type="number" step="0.1" value="${p.wallH}"></div>
      </div>
      <button class="btn sm ghost" id="applySize">应用尺寸</button>
      <div class="sec-title" style="margin-top:18px">绘图工具</div>
      <div id="tools">
        <button class="btn ghost" data-m="select" style="width:100%;justify-content:flex-start;margin-bottom:6px">🖱️ 选择/拖动</button>
        <button class="btn ghost" data-m="draw-wall" style="width:100%;justify-content:flex-start;margin-bottom:6px">▫️ 画普通隔墙</button>
        <button class="btn ghost" data-m="draw-bearing" style="width:100%;justify-content:flex-start;margin-bottom:6px">🧱 画承重墙（管线绕行）</button>
        <button class="btn ghost" data-m="draw-beam" style="width:100%;justify-content:flex-start;margin-bottom:6px">▬ 画横梁（拖拽框出）</button>
        <button class="btn ghost" data-m="draw-column" style="width:100%;justify-content:flex-start;margin-bottom:6px">⬛ 点放承重柱</button>
        <button class="btn ghost" data-m="dim" style="width:100%;justify-content:flex-start">📏 标注尺寸</button>
      </div>
      <div class="hint" style="margin-top:10px">提示：滚轮缩放，按住中键平移；点中梁柱/柱子后可在右侧删除。</div>
    </div>
    <div class="stage card" id="stage">
      ${stageToolbar(`
        <button class="btn sm" id="zoomIn">＋</button>
        <button class="btn sm" id="zoomOut">－</button>
        <button class="btn sm" id="fit">适应</button>
        <button class="btn sm" id="toggleGrid">网格</button>`)}
      <div class="canvas-hint" id="hint">在画布上按住拖动画墙；梁柱/承重墙会在布线时自动绕开</div>
      <div class="canvas-scale" id="scaleTag"></div>
    </div>
    <div class="card panel" id="prop"></div>
  </div>`;

  const stage=document.getElementById('stage');
  const cv=new PlanCanvas(stage,p,{
    mode:'select', showConduits:false, showLinks:false, showPanel:false, showDevices:false,
    onChange(){renderProp();Store.put(p);updateScale();},
    onSelect(){renderProp();}
  });
  window._cv=cv;
  function updateScale(){
    const pxPerM=cv.scale;
    document.getElementById('scaleTag').textContent=`比例尺 1m ≈ ${Math.round(pxPerM)}px`;
  }
  updateScale();

  document.getElementById('zoomIn').onclick=()=>cv.zoomBy(1.15);
  document.getElementById('zoomOut').onclick=()=>cv.zoomBy(0.87);
  document.getElementById('fit').onclick=()=>{cv.fit();cv.render();updateScale();};
  document.getElementById('toggleGrid').onclick=e=>{cv.setOpt('showGrid',!cv.opts.showGrid);e.target.classList.toggle('on',cv.opts.showGrid);};

  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
    cv.setMode(b.dataset.m);
    document.querySelectorAll('[data-m]').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    const map={select:'选择模式：点中构件可删除', 'draw-wall':'按住拖拽绘制普通隔墙',
      'draw-bearing':'按住拖拽绘制承重墙（线管将绕行）','draw-beam':'拖拽框出横梁范围',
      'draw-column':'在柱位处点击放置 32cm 承重柱','dim':'点击两点标注尺寸'};
    document.getElementById('hint').textContent=map[b.dataset.m];
  });
  document.getElementById('upImg').onclick=()=>document.getElementById('fileImg').click();
  document.getElementById('fileImg').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{p.image=rd.result;cv.render();Store.put(p);};
    rd.readAsDataURL(f);
  };
  document.getElementById('clearImg').onclick=()=>{p.image=null;cv.render();Store.put(p);};
  document.getElementById('applySize').onclick=()=>{
    p.wallW=Math.max(3,+document.getElementById('wW').value||8);
    p.wallH=Math.max(3,+document.getElementById('wH').value||6);
    cv.fit();cv.render();updateScale();Store.put(p);toast('尺寸已更新');
  };

  function renderProp(){
    const box=document.getElementById('prop');
    const sel=cv.selected;
    if(!sel||sel.kind==='device'){
      box.innerHTML=`<div class="prop-empty"><span class="big">🧱</span>
        画完户型轮廓后<br>进入「② 划分区域」给房间命名<br><br>
        <button class="btn primary" onclick="Router.go('zones',{pid:'${p.id}'})">下一步：划分区域 →</button></div>`;
      return;
    }
    if(sel.kind==='obs'){
      const o=p.obstacles.find(x=>x.id===sel.id);
      box.innerHTML=`<div class="sec-title">${o.type==='column'?'承重柱':'横梁'}</div>
        <div class="kv"><span>名称</span><input class="input" id="ol" value="${U.esc(o.label||'')}"></div>
        <div class="kv"><span>位置 X</span><b>${o.x.toFixed(2)} m</b></div>
        <div class="kv"><span>位置 Y</span><b>${o.y.toFixed(2)} m</b></div>
        <div class="kv"><span>${o.type==='column'?'尺寸':'跨度'}</span><b>${o.w.toFixed(2)} × ${o.h.toFixed(2)} m</b></div>
        <div style="margin-top:14px"><button class="btn danger" id="delSel">删除该构件</button></div>`;
      document.getElementById('ol').oninput=e=>{o.label=e.target.value;cv.render();};
      document.getElementById('delSel').onclick=()=>cv.deleteSelected();
    }
  }
  renderProp();
};
