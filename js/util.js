'use strict';

const U = {
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  money:v=>'¥'+Math.round(v).toLocaleString('zh-CN'),
  len:v=>(v<10? v.toFixed(2): v.toFixed(1))+' m',
  ptInRect:(x,y,r)=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h,
  dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
  esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
};

function zoneAt(p, x, y){
  for(let i=p.zones.length-1;i>=0;i--){ if(U.ptInRect(x,y,p.zones[i])) return p.zones[i]; }
  return null;
}

/* 点到线段距离 */
function distPointSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const l2=dx*dx+dy*dy;
  if(l2===0) return U.dist(px,py,x1,y1);
  let t=((px-x1)*dx+(py-y1)*dy)/l2;
  t=U.clamp(t,0,1);
  return U.dist(px,py,x1+t*dx, y1+t*dy);
}

/* 两线段最近距离（含相交检测） */
function segSegInfo(a,b,c,d){
  function cross(ax,ay,bx,by){return ax*by-ay*bx;}
  const r1=cross(b.x-a.x,b.y-a.y,d.x-c.x,d.y-c.y);
  const t=cross(c.x-a.x,c.y-a.y,d.x-c.x,d.y-c.y);
  const s=cross(c.x-a.x,c.y-a.y,b.x-a.x,b.y-a.y);
  if(r1!==0){
    const tt=t/r1, ss=s/r1;
    if(tt>=0&&tt<=1&&ss>=0&&ss<=1) return {hit:true, dist:0};
  }
  const ds=[distPointSeg(c.x,c.y,a.x,a.y,b.x,b.y), distPointSeg(d.x,d.y,a.x,a.y,b.x,b.y),
            distPointSeg(a.x,a.y,c.x,c.y,d.x,d.y), distPointSeg(b.x,b.y,c.x,c.y,d.x,d.y)];
  return {hit:false, dist:Math.min(...ds)};
}

/* Unicode 安全 base64（分享链接） */
const B64 = {
  enc(str){
    const bytes=new TextEncoder().encode(str);
    let bin='';
    bytes.forEach(b=>bin+=String.fromCharCode(b));
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  },
  decode(str){
    str=str.replace(/-/g,'+').replace(/_/g,'/');
    while(str.length%4) str+='=';
    const bin=atob(str);
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
};

let toastTimer=null;
function toast(msg){
  let el=document.querySelector('.toast');
  if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el);}
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
}

function modal({title, body, okText='确定', cancelText='取消', danger}){
  return new Promise(resolve=>{
    const mask=document.createElement('div');
    mask.className='modal-mask';
    mask.innerHTML=`<div class="modal">
      <h3>${U.esc(title)}</h3>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">
        <button class="btn" data-a="0">${U.esc(cancelText)}</button>
        <button class="btn ${danger?'danger':'primary'}" data-a="1">${U.esc(okText)}</button>
      </div></div>`;
    mask.addEventListener('click',e=>{
      if(e.target===mask){mask.remove();resolve(null);}
      const b=e.target.closest('button[data-a]');
      if(!b) return;
      mask.remove();
      resolve(b.dataset.a==='1'?mask:null);
    });
    document.body.appendChild(mask);
  });
}

function download(filename, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
