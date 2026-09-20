'use strict';

const CMD_OPTIONS=['打开/点亮 100%','点亮 80%','调暗 20%','夜灯 10%','关闭','渐灭','窗帘打开','窗帘关闭',
  '布防','撤防','夜间布防','联动触发','空调 26℃','投影仪上电'];

function normSceneAction(pair){
  const [sel,label]=pair;
  const [head,arg]=sel.split(':');
  const isType=DEVICE_TYPES[head];
  const cmd=label.includes('关闭')&&head.startsWith('curtain')?'窗帘关闭'
    :head==='curtain'?'窗帘打开'
    :/80%/.test(label)?'点亮 80%':/20%/.test(label)?'调暗 20%':/10%/.test(label)?'夜灯 10%'
    :/渐灭/.test(label)?'渐灭':/布防/.test(label)?(label.includes('夜间')?'夜间布防':'布防')
    :/撤防/.test(label)?'撤防':/26℃/.test(label)?'空调 26℃':/上电/.test(label)?'投影仪上电'
    :/触发/.test(label)?'联动触发':/关闭/.test(label)?'关闭':'打开/点亮 100%';
  return {type:isType?head:null, cat:isType?null:head, zone:arg&&arg!=='all'?arg:null, cmd, label};
}
function matchActions(p,a){
  return p.devices.filter(d=>{
    const t=DEVICE_TYPES[d.type];if(!t)return false;
    if(a.type&&d.type!==a.type)return false;
    if(a.cat&&t.cat!==a.cat)return false;
    if(a.zone){const z=p.zones.find(z=>z.id===d.zone);if(!z||z.name!==a.zone)return false;}
    return true;
  });
}

Screens.scenes=function(root,p){
  const body=shell(root,p,'scenes','④ 一键智能场景','选择模板并微调，系统按设备所在区域自动匹配真实点位');
  p.scenes.forEach(s=>{ s.enabled=s.enabled!==false;
    s.actions=s.actions.map(a=>Array.isArray(a)?normSceneAction(a):a); });
  let active=p.scenes[0].id;

  body.innerHTML=`${wizardBar('scenes')}
  <div class="grid" style="grid-template-columns:300px 1fr;gap:16px">
    <div class="card panel" style="max-height:none">
      <div class="sec-title">场景模板</div>
      <div id="cards" class="grid" style="gap:10px"></div>
      <div class="hint" style="margin-top:12px">勾选启用后，这些场景会写入智能中控屏与施工交底说明。</div>
    </div>
    <div class="card panel" style="max-height:none" id="detail"></div>
  </div>`;

  function renderCards(){
    document.getElementById('cards').innerHTML=p.scenes.map(s=>`
      <div class="card scene-card ${s.id===active?'on':''}" data-id="${s.id}" style="padding:13px">
        <div class="row" style="justify-content:space-between">
          <span class="em">${s.icon}</span>
          <input type="checkbox" ${s.enabled?'checked':''} data-en="${s.id}" style="width:16px;height:16px">
        </div>
        <h4 style="color:${s.color}">${s.name}</h4>
        <p>${s.desc}</p>
        <div class="hint">匹配 ${matchActions(p,s.actions[0]||{}).length>=0?s.actions.reduce((n,a)=>n+matchActions(p,a).length,0):0} 个点位动作</div>
      </div>`).join('');
    document.querySelectorAll('.scene-card').forEach(c=>c.onclick=e=>{
      if(e.target.dataset.en)return;
      active=c.dataset.id;renderCards();renderDetail();
    });
    document.querySelectorAll('[data-en]').forEach(c=>c.onchange=e=>{
      p.scenes.find(s=>s.id===e.target.dataset.en).enabled=e.target.checked;
      Store.put(p);renderCards();
    });
  }

  function actionRowHTML(s,a,idx){
    const devs=matchActions(p,a);
    const what=a.type?DEVICE_TYPES[a.type].name:(CATEGORIES.find(c=>c.id===a.cat)?.name||a.cat);
    return `<div class="action-row">
      <span style="flex:0 0 8px;height:26px;border-radius:4px;background:${s.color}"></span>
      <b style="flex:1.4">${what}</b>
      <span class="tag" style="flex:.9">${a.zone||(a.cat==='switch'&&s.id==='away'?'全屋':'全部区域')}</span>
      <select class="input sm" data-cmd="${idx}" style="flex:1.5;padding:5px 8px">
        ${CMD_OPTIONS.map(c=>`<option ${a.cmd===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <span class="tag ok" style="flex:.6">×${devs.length}</span>
      <button class="btn sm ghost" data-rm="${idx}">✕</button>
    </div>
    ${devs.length===0?'<div class="hint" style="margin:-4px 0 8px 18px;color:#b45309">当前户型中没有匹配点位，可先去③添加设备。</div>':''}`;
  }

  function renderDetail(){
    const s=p.scenes.find(x=>x.id===active);
    const box=document.getElementById('detail');
    box.innerHTML=`
      <div class="sec-title">${s.icon} ${s.name}
        <input class="input" style="width:150px;margin-left:8px" value="${U.esc(s.name)}" data-sname></div>
      <textarea class="input" rows="2" data-sdesc style="margin-bottom:14px">${U.esc(s.desc)}</textarea>
      <div class="sec-title">动作列表 <span class="pill-count">${s.actions.length}</span></div>
      ${s.actions.map((a,i)=>actionRowHTML(s,a,i)).join('')}
      <div class="card" style="padding:12px;margin-top:8px;background:#f7f9fc">
        <div class="hint" style="margin-bottom:8px">＋ 手动添加动作</div>
        <div class="row">
          <select class="input" id="addCat">
            <optgroup label="按设备类型">
              ${Object.entries(DEVICE_TYPES).map(([id,t])=>`<option value="t:${id}">${t.icon} ${t.name}</option>`).join('')}
            </optgroup>
            <optgroup label="按类别">
              ${CATEGORIES.map(c=>`<option value="c:${c.id}">${c.icon} 全部${c.name}</option>`).join('')}
            </optgroup>
          </select>
          <select class="input" id="addZone">
            <option value="">全部区域</option>
            ${p.zones.map(z=>`<option>${U.esc(z.name)}</option>`).join('')}
          </select>
          <button class="btn primary sm" id="addAct">添加</button>
        </div>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:18px">
        <button class="btn ghost" id="resetTpl">↺ 恢复模板默认</button>
        <button class="btn primary" onclick="Router.go('wiring',{pid:'${p.id}'})">下一步：线管布线 →</button>
      </div>`;
    box.querySelectorAll('[data-cmd]').forEach(sel=>sel.onchange=e=>{
      s.actions[+e.target.dataset.cmd].cmd=e.target.value;Store.put(p);
    });
    box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{
      s.actions.splice(+b.dataset.rm,1);Store.put(p);renderDetail();renderCards();
    });
    box.querySelector('[data-sname]').oninput=e=>{s.name=e.target.value;renderCards();};
    box.querySelector('[data-sname]').onchange=()=>Store.put(p);
    box.querySelector('[data-sdesc]').onchange=e=>{s.desc=e.target.value;Store.put(p);};
    box.querySelector('#addAct').onclick=()=>{
      const [kind,val]=box.querySelector('#addCat').value.split(':');
      const zone=box.querySelector('#addZone').value||null;
      s.actions.push({type:kind==='t'?val:null,cat:kind==='c'?val:null,
        zone,cmd:'打开/点亮 100%',label:'自定义动作'});
      Store.put(p);renderDetail();renderCards();
    };
    box.querySelector('#resetTpl').onclick=()=>{
      const tpl=SCENE_TEMPLATES.find(t=>t.id===s.id);
      s.name=tpl.name;s.icon=tpl.icon;s.color=tpl.color;s.desc=tpl.desc;
      s.actions=tpl.actions.map(normSceneAction);
      Store.put(p);renderDetail();renderCards();
    };
  }
  renderCards();renderDetail();
};
