'use strict';
const Screens={};

Screens.home=function(root){
  const projects=Store.list().sort((a,b)=>b.updatedAt-a.updatedAt);
  root.innerHTML=`
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="logo">🏠</div><div><b>智居布线</b><small>全屋智能 · 像搭积木一样布线</small></div></div>
      <nav class="nav">
        <a class="active"><span class="n">●</span>我的方案</a>
        <a id="navDemo"><span class="n">✨</span>载入演示户型</a>
        <a id="navImport"><span class="n">📥</span>导入方案文件</a>
        <a id="navShareOpen"><span class="n">🔗</span>打开分享链接</a>
      </nav>
      <div class="side-foot">本地浏览器保存 · 数据不上传服务器</div>
    </aside>
    <main class="main">
      <div class="content">
        <div class="home-hero">
          <h2>把复杂布线，变成搭积木 🧱</h2>
          <p>上传户型图，拖入灯、开关、插座、传感器和摄像头，系统自动识别强电弱电、生成开关回路、
             规划线管走向、统计线材与预算，一键导出给电工看的施工交底。</p>
          <span class="art">🏡</span>
          <div style="margin-top:16px"><button class="btn" id="heroNew" style="background:#fff;color:#2854c8;font-weight:600">＋ 新建我的方案</button></div>
        </div>
        <div class="sec-title">我的方案 <span class="pill-count">${projects.length}</span></div>
        <div class="grid proj-grid">
          <div class="card proj-card new" id="newCard"><div class="plus">＋</div><div style="margin-top:8px;font-weight:600">新建空白方案</div>
            <div class="meta">从一张户型图或手绘草图开始</div></div>
          ${projects.map(p=>`
          <div class="card proj-card" data-open="${p.id}">
            <button class="proj-del" data-del="${p.id}" title="删除">✕</button>
            <h3>${U.esc(p.name)}</h3>
            <div class="meta">
              📐 ${p.wallW}×${p.wallH}m · 🧩 ${p.zones.length} 区域<br>
              💡 ${p.devices.length} 点位 · 🧵 ${p.conduits.length} 条管路<br>
              更新于 ${new Date(p.updatedAt).toLocaleString('zh-CN')}
            </div>
          </div>`).join('')}
        </div>
      </div>
    </main>
  </div>`;

  const create=()=>{
    const name=prompt('给你的方案起个名字（如：幸福里2-1801）','我的新家');
    if(name===null)return;
    const p=blankProject(name.trim()||'未命名方案');
    Store.put(p); Router.go('floorplan',{pid:p.id});
  };
  document.getElementById('newCard').onclick=create;
  document.getElementById('heroNew').onclick=create;
  document.getElementById('navDemo').onclick=()=>{
    const p=createDemoProject(); Store.put(p);
    toast('已载入约90㎡两室一厅演示户型');
    Router.go('devices',{pid:p.id});
  };
  document.getElementById('navImport').onclick=()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='.json';
    inp.onchange=()=>{const f=inp.files[0];const rd=new FileReader();
      rd.onload=()=>{try{const p=JSON.parse(rd.result);p.id=uid('pj_');Store.import(p);
        toast('导入成功');Router.go('floorplan',{pid:p.id});}catch(e){toast('文件格式有误');}};
      rd.readAsText(f);};
    inp.click();
  };
  document.getElementById('navShareOpen').onclick=()=>{
    const code=prompt('粘贴家人/设计师分享的链接或分享码：');
    if(!code)return;
    const m=code.match(/[#&]s=([A-Za-z0-9_\-]+)/);
    const raw=m?m[1]:code.trim();
    const p=App.loadShared(raw);
    if(!p){toast('分享码无效');return;}
    p.id=uid('pj_');p.name+='（分享副本）';Store.import(p);
    Router.go('devices',{pid:p.id});
  };
  root.querySelectorAll('[data-open]').forEach(c=>c.onclick=()=>Router.go('floorplan',{pid:c.dataset.open}));
  root.querySelectorAll('[data-del]').forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    const ok=await modal({title:'删除方案',body:'删除后无法恢复，确定删除这个方案吗？',okText:'删除',danger:true});
    if(ok){Store.remove(b.dataset.del);Screens.home(root);}
  });
};

/* 只读分享查看页 */
Screens.view=function(root,p){
  root.innerHTML=`<div class="shell">
    <aside class="sidebar"><div class="brand"><div class="logo">🔗</div><div><b>分享方案</b><small>${U.esc(p.name)}</small></div></div>
    <div class="side-foot" style="margin-top:auto">这是他人分享的只读方案，可另存为自己的副本继续编辑。</div></aside>
    <main class="main"><div class="topbar"><h1>🔗 ${U.esc(p.name)}</h1><div class="spacer"></div>
      <button class="btn primary" id="copyBtn">📋 复制为我的方案</button>
      <button class="btn ghost" onclick="location.hash='#/home'">返回</button></div>
    <div class="content"><div class="stage card" id="stage" style="height:calc(100vh - 140px)"></div></div></main></div>`;
  const stage=document.getElementById('stage');
  const cv=new PlanCanvas(stage,p,{interactive:false,showLinks:p.links.length>0,showConduits:true,showDims:true});
  document.getElementById('copyBtn').onclick=()=>{
    p.id=uid('pj_');Store.import(p);Router.go('devices',{pid:p.id});
  };
};
