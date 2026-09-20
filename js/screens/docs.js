'use strict';

Screens.docs=function(root,p){
  const body=shell(root,p,'docs','⑧ 施工交底 · 版本 · 分享','生成给电工看的说明书，随时回退历史版本，一键链接发给家人/设计师/电工');
  body.innerHTML=`${wizardBar('docs')}
  <div id="tabs" class="row" style="margin-bottom:16px">
    <button class="btn on primary" data-tab="doc">📄 施工交底说明</button>
    <button class="btn ghost" data-tab="ver">🕐 方案版本 (${p.versions.length})</button>
    <button class="btn ghost" data-tab="share">🔗 分享与导出</button>
  </div>
  <div id="tabBody"></div>`;
  const tabs=body.querySelectorAll('[data-tab]');
  tabs.forEach(t=>t.onclick=()=>{
    tabs.forEach(x=>{x.classList.remove('primary','on');x.classList.add('ghost');});
    t.classList.add('primary','on');t.classList.remove('ghost');
    render(t.dataset.tab);
  });
  render('doc');

  function render(tab){
    const box=document.getElementById('tabBody');
    if(tab==='doc') renderDoc(box);
    else if(tab==='ver') renderVer(box);
    else renderShare(box);
  }

  function docHTML(){
    const lines=constructionText(p);
    const loads=circuitLoads(p);
    const b=bom(p),bg=budget(p);
    const enabled=p.scenes.filter(s=>s.enabled);
    const snapshot=document.querySelector('.stage')?null:null;
    return `
    <div class="doc-page" id="docPage">
      <h2>全屋智能点位与弱电布线 · 施工交底说明</h2>
      <div class="sub">项目：${U.esc(p.name)}　｜　户型：${p.wallW}m × ${p.wallH}m　｜　点位：${p.devices.length} 个　｜　生成日期：${new Date().toLocaleDateString('zh-CN')}</div>
      ${lines.slice(0,1).map(x=>`<div class="doc-block">${x}</div>`).join('')}
      <h3>一、配电箱回路表</h3>
      <table class="table"><thead><tr><th>回路</th><th>断路器</th><th>线材</th><th>点位数</th><th>估算负载</th><th>备注</th></tr></thead><tbody>
      ${loads.map(c=>`<tr><td>${U.esc(c.name)}</td><td>${c.breaker}</td><td>${c.cable}</td><td>${c.count}</td>
        <td>${c.load}W${c.limit?` / ${c.limit}W`:''}</td><td>${c.overload?'<span class="tag strong">需调整</span>':''}</td></tr>`).join('')}
      </tbody></table>
      <h3>二、施工规范要点</h3>
      <ul>${lines.slice(2,9).map(x=>`<li>${U.esc(x.replace(/^\d+\.\s*/,''))}</li>`).join('')}</ul>
      <h3>三、点位明细表</h3>
      <table class="table"><thead><tr><th>区域</th><th>设备</th><th>电气</th><th>坐标(m)</th><th>回路</th></tr></thead><tbody>
      ${p.devices.map(d=>{const t=DEVICE_TYPES[d.type];const z=p.zones.find(zn=>zn.id===d.zone);
        const c=p.circuits.find(c=>c.id===d.circuitId);
        return `<tr><td>${z?U.esc(z.name):'—'}</td><td>${t.icon} ${U.esc(d.label||t.name)}</td>
        <td>${t.cable?.strong&&t.cable?.weak?'强+弱':t.power}</td><td>(${d.x.toFixed(2)}, ${d.y.toFixed(2)})</td><td>${c?U.esc(c.name):'—'}</td></tr>`;}).join('')}
      </tbody></table>
      <h3>四、智能场景调试清单</h3>
      <ul>${enabled.map(s=>{
        const acts=s.actions.map(a=>{
          const n=matchActions(p,a).length;
          const what=a.type?DEVICE_TYPES[a.type].name:(CATEGORIES.find(c=>c.id===a.cat)?.name||'');
          return `${what}（${a.zone||'全屋'}）${a.cmd} ×${n}`;
        }).join('；');
        return `<li><b>${s.icon} ${U.esc(s.name)}</b>：${U.esc(s.desc)}<br><span class="muted">动作：${U.esc(acts)}</span></li>`;}).join('')}
      </ul>
      <h3>五、材料与预算</h3>
      <div class="doc-block">设备 ¥${Math.round(bg.device)} ＋ 线材管材 ¥${Math.round(bg.cable)} ＋ 人工 ¥${bg.labor} ＋ 设计调试 ¥${bg.design} ＋ 预留 ¥${bg.reserve}
        ＝ <b>预算合计 ${U.money(bg.sum)}</b>（详细品牌数量见随附《材料清单 CSV》）</div>
      <div class="sign-row"><span>业主签字：____________</span><span>电工签字：____________</span><span>日期：____________</span></div>
    </div>`;
  }

  function renderDoc(box){
    box.innerHTML=`
    <div class="row" style="margin-bottom:12px;justify-content:flex-end">
      <button class="btn ghost" id="noteEdit">✏️ 编辑补充说明</button>
      <button class="btn ghost" id="exportHtml">⬇ 导出交底HTML</button>
      <button class="btn primary" id="printDoc">🖨️ 打印 / 存PDF</button>
    </div>
    ${docHTML()}
    <div id="noteWrap" style="max-width:860px;margin:14px auto 0"></div>`;
    document.getElementById('printDoc').onclick=()=>window.print();
    document.getElementById('exportHtml').onclick=()=>{
      const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${U.esc(p.name)}-施工交底</title>
      <style>body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:860px;margin:30px auto;padding:0 20px;color:#1f2a37}
      table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#f2f5fa}h2{text-align:center}h3{border-left:4px solid #3b6ef5;padding-left:10px;margin-top:24px}</style></head>
      <body>${docHTML()}</body></html>`;
      download(`${p.name}-施工交底.html`,html,'text/html;charset=utf-8');
    };
    document.getElementById('noteEdit').onclick=()=>{
      const wrap=document.getElementById('noteWrap');
      wrap.innerHTML=`<div class="card panel" style="max-height:none">
        <div class="sec-title">补充说明（写给电工的话）</div>
        <textarea class="input" rows="4" id="noteArea" placeholder="例如：客厅预留投影仪吊架电源，卧室双控…">${U.esc(p.notes)}</textarea>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="noteSave">保存</button></div></div>`;
      document.getElementById('noteSave').onclick=()=>{p.notes=document.getElementById('noteArea').value;Store.put(p);toast('已保存补充说明');};
    };
  }

  function renderVer(box){
    box.innerHTML=`
    <div class="card panel" style="max-width:720px;margin:0 auto">
      <div class="sec-title">保存当前为新版本</div>
      <div class="row" style="margin-bottom:18px">
        <input class="input" id="vName" placeholder="版本名，如：水电交底前版本">
        <button class="btn primary" id="vSave">📸 存版本</button>
      </div>
      <div class="hint" style="margin-bottom:10px">每个版本会冻结当时的点位、管路、回路与场景，随时可一键回退（不影响户型墙体）。</div>
      ${p.versions.slice().reverse().map((v,i)=>`
      <div class="ver-row ${i===0?'cur':''}">
        <span style="font-size:20px">${i===0?'📍':'🕐'}</span>
        <div style="flex:1"><b>${U.esc(v.name)}</b>${i===0?' <span class="tag ok">当前</span>':''}
          <div class="muted" style="font-size:12px">${new Date(v.at).toLocaleString('zh-CN')}</div></div>
        <button class="btn sm ghost" data-restore="${v.id}" ${i===0?'disabled':''}>↩ 回退到此版</button>
      </div>`).join('')}
    </div>`;
    document.getElementById('vSave').onclick=()=>{
      const name=document.getElementById('vName').value.trim();
      Store.saveVersion(p,name||('版本'+(p.versions.length+1)));
      toast('版本已保存');render('ver');
    };
    box.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{
      const ok=await modal({title:'回退版本',body:'当前未保存的点位/管路会被覆盖，建议先另存一个版本。确定回退？',okText:'回退',danger:true});
      if(ok){Store.restoreVersion(p,b.dataset.restore);toast('已回退');render('ver');window._cv&&window._cv.render();}
    });
  }

  function renderShare(box){
    const code=Store.encodeShare(p);
    const url=location.origin+location.pathname+'#/view?s='+code;
    const size=Math.round(new Blob([url]).size/1024);
    box.innerHTML=`
    <div class="grid two-col" style="align-items:start">
      <div class="card panel" style="max-height:none">
        <div class="sec-title">🔗 生成分享链接</div>
        <div class="hint" style="margin-bottom:10px">方案编码后完整放在链接里（无需服务器），发给家人、设计师或电工，对方打开即可只读查看并另存副本。</div>
        <div class="share-box">
          <input class="input" id="shareUrl" readonly value="${U.esc(url)}">
          <button class="btn primary" id="copyUrl">复制</button>
        </div>
        <div class="hint" style="margin-top:8px">链接长度约 ${size} KB${size>1500?'（含底图较大，建议另用文件导出）':''}</div>
        <div class="row" style="margin-top:14px">
          <button class="btn ghost" id="qrBtn">📱 二维码</button>
          <button class="btn ghost" id="noImgShare">生成不含底图的精简链接</button>
        </div>
        <div id="qr" style="text-align:center;margin-top:12px"></div>
      </div>
      <div class="card panel" style="max-height:none">
        <div class="sec-title">📦 文件导出</div>
        <button class="btn ghost" style="width:100%;justify-content:flex-start;margin-bottom:8px" id="exJson">💾 导出方案文件 (.json) — 备份/换电脑</button>
        <button class="btn ghost" style="width:100%;justify-content:flex-start;margin-bottom:8px" id="exCsv">📊 导出材料清单 (.csv)</button>
        <button class="btn ghost" style="width:100%;justify-content:flex-start;margin-bottom:8px" id="exSvg">🖼️ 导出现有画布 SVG（需先在③/⑤查看）</button>
        <div class="hint" style="margin-top:12px">打印版《施工交底说明》在左侧“施工交底”标签页，可直接另存为 PDF 发给电工。</div>
      </div>
    </div>`;
    document.getElementById('copyUrl').onclick=()=>{
      navigator.clipboard?.writeText(url).then(()=>toast('链接已复制'),()=>{
        document.getElementById('shareUrl').select();document.execCommand('copy');toast('链接已复制');});
    };
    document.getElementById('noImgShare').onclick=()=>{
      const slim={...p,image:null};
      const u2=location.origin+location.pathname+'#/view?s='+Store.encodeShare(slim);
      document.getElementById('shareUrl').value=u2;
      toast('已生成精简链接，点“复制”即可');
    };
    document.getElementById('qrBtn').onclick=()=>{
      const qr='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(url);
      document.getElementById('qr').innerHTML=`<img src="${qr}" width="220" height="220" alt="二维码"><div class="hint">手机扫码查看（需要联网访问二维码服务）</div>`;
    };
    document.getElementById('exJson').onclick=()=>download(`${p.name}-方案备份.json`,JSON.stringify(p,null,2),'application/json');
    document.getElementById('exCsv').onclick=()=>download(`${p.name}-材料清单.csv`,bomCSV(p),'text/csv;charset=utf-8');
    document.getElementById('exSvg').onclick=()=>{
      if(window._cv) download(`${p.name}-图纸.svg`,window._cv.exportSVG(),'image/svg+xml');
      else toast('请先在③设备点位或⑤布线页打开画布');
    };
  }
};
