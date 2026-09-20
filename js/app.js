'use strict';

const App={
  project:null,
  route(r){
    const root=document.getElementById('app');
    root.innerHTML='';
    if(r.name==='home'){ Screens.home(root,r.params); return; }
    if(r.name==='view'){
      const p=this.loadShared(r.params.s);
      if(!p){Router.go('home');return;}
      Screens.view(root,p); return;
    }
    const pid=r.params.pid;
    const p=Store.get(pid);
    if(!p){ toast('方案不存在或已删除'); Router.go('home'); return; }
    this.project=p;
    Screens[r.name]?Screens[r.name](root,p):Screens.floorplan(root,p);
  },
  loadShared(code){
    if(!code) return null;
    try{ return Store.decodeShare(code); }catch(e){ console.warn(e); return null; }
  },
  save(){
    Store.put(this.project);
    toast('已保存');
  }
};

/* 编辑器统一外壳：左步骤导航 + 顶栏 + 左库/舞台/右属性 */
function shell(root, p, active, title, crumb){
  const idx=SCREENS.findIndex(s=>s.id===active);
  root.innerHTML=`
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">🏠</div>
        <div><b>智居布线</b><small>全屋智能 · 像搭积木一样布线</small></div>
      </div>
      <nav class="nav" id="nav">
        ${SCREENS.map((s,i)=>s.id==='home'?'':`
          <a href="#/${s.id}?pid=${p.id}" class="${s.id===active?'active':''} ${i<idx?'done':''}">
            <span class="n">${s.id===active?'●':i<idx?'✓':i}</span>${s.name}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div style="margin-bottom:6px">📁 ${U.esc(p.name)}</div>
        <div>${p.devices.length} 个点位 · v${p.versions.length}</div>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div><h1>${title}</h1><div class="crumb">${crumb||''}</div></div>
        <div class="spacer"></div>
        <button class="btn ghost" id="btnHome">返回首页</button>
        <button class="btn primary" id="btnSave">💾 保存方案</button>
      </div>
      <div class="content" id="screenBody"></div>
    </main>
  </div>`;
  document.getElementById('btnHome').onclick=()=>Router.go('home');
  document.getElementById('btnSave').onclick=()=>App.save();
  return document.getElementById('screenBody');
}

function wizardBar(active){
  const steps=['上传户型','划分区域','设备点位','智能场景','线管布线','回路·清单·交底'];
  const idx=['floorplan','zones','devices','scenes','wiring','panel','stats','docs'];
  const cur=idx.indexOf(active);
  return `<div class="wizard-steps">${steps.map((s,i)=>
    `<div class="s ${i===cur?'act':i<cur?'done':''}">${i<cur?'✓ ':''}${s}</div>`).join('')}</div>`;
}

function stageToolbar(buttons){
  return `<div class="canvas-toolbar">${buttons}</div>`;
}

document.addEventListener('DOMContentLoaded',()=>{
  // 分享链接直达
  Router.start();
});
