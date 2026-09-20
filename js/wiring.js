'use strict';
/* 自动布线：A* 绕开梁柱/承重墙；开关回路连线；强弱电间距检测 */

const ROUTE_STEP=0.1;       // 10cm 栅格
const INFLATE=2;            // 障碍物外扩 20cm
const STRONG_WEAK_GAP=0.3;  // 规范最小间距 30cm

function routeGrid(p){
  const cols=Math.round(p.wallW/ROUTE_STEP)+1;
  const rows=Math.round(p.wallH/ROUTE_STEP)+1;
  const blocked=Array.from({length:rows},()=>new Uint8Array(cols));
  const pen=Array.from({length:rows},()=>new Float32Array(cols));
  const mark=(x,y,w,h)=>{
    const x0=Math.max(0,Math.floor((x- INFLATE*ROUTE_STEP)/ROUTE_STEP));
    const y0=Math.max(0,Math.floor((y- INFLATE*ROUTE_STEP)/ROUTE_STEP));
    const x1=Math.min(cols-1,Math.ceil((x+w+ INFLATE*ROUTE_STEP)/ROUTE_STEP));
    const y1=Math.min(rows-1,Math.ceil((y+h+ INFLATE*ROUTE_STEP)/ROUTE_STEP));
    for(let r=y0;r<=y1;r++) for(let c=x0;c<=x1;c++) blocked[r][c]=1;
  };
  p.obstacles.forEach(o=>mark(o.x,o.y,o.w,o.h));
  // 承重墙同样禁穿（从两侧绕行）
  for(const wl of p.walls){
    if(wl.type!=='bearing') continue;
    const horizontal=Math.abs(wl.y2-wl.y1)<0.01;
    if(horizontal){
      mark(Math.min(wl.x1,wl.x2), Math.min(wl.y1,wl.y2)-0.06, Math.abs(wl.x2-wl.x1), .12);
    }else{
      mark(Math.min(wl.x1,wl.x2)-0.06, Math.min(wl.y1,wl.y2), .12, Math.abs(wl.y2-wl.y1));
    }
  }
  // 非承重墙穿越加惩罚（鼓励绕墙边走）
  for(const wl of p.walls){
    if(wl.type==='bearing')continue;
    const horizontal=Math.abs(wl.y2-wl.y1)<0.01;
    const steps=Math.ceil(U.dist(wl.x1,wl.y1,wl.x2,wl.y2)/ROUTE_STEP);
    for(let i=0;i<=steps;i++){
      const t=i/steps, x=wl.x1+(wl.x2-wl.x1)*t, y=wl.y1+(wl.y2-wl.y1)*t;
      const c=Math.round(x/ROUTE_STEP), r=Math.round(y/ROUTE_STEP);
      if(r>=0&&r<rows&&c>=0&&c<cols&&!blocked[r][c]) pen[r][c]=horizontal?6:6;
    }
  }
  return {cols,rows,blocked,pen};
}

function astar(p, sx, sy, tx, ty, occ){
  const g=routeGrid(p);
  const near=(x,y)=>{
    let c=Math.round(U.clamp(x,0,p.wallW)/ROUTE_STEP), r=Math.round(U.clamp(y,0,p.wallH)/ROUTE_STEP);
    if(!g.blocked[r][c]) return {c,r};
    for(let rad=1;rad<INFLATE+4;rad++){
      for(let dr=-rad;dr<=rad;dr++)for(let dc=-rad;dc<=rad;dc++){
        const rr=r+dr,cc=c+dc;
        if(rr<0||cc<0||rr>=g.rows||cc>=g.cols||g.blocked[rr][cc])continue;
        if(Math.abs(dr)+Math.abs(dc)<=rad+1) return {c:cc,r:rr};
      }
    }
    return {c,r};
  };
  const s=near(sx,sy), t=near(tx,ty);
  const key=(c,r)=>r*g.cols+c;
  const came=new Map(), gscore=new Map([[key(s.c,s.r),0]]);
  const heap=new MinHeap();
  heap.push({c:s.c,r:s.r,f:Math.abs(s.c-t.c)+Math.abs(s.r-t.r)});
  const nbrs=[[1,0],[-1,0],[0,1],[0,-1]];
  let guard=0;
  while(heap.size()&&guard++<60000){
    const cur=heap.pop();
    if(cur.c===t.c&&cur.r===t.r){
      const path=[{c:cur.c,r:cur.r}];
      let k=key(cur.c,cur.r);
      while(came.has(k)){const [pc,pr]=came.get(k);path.push({c:pc,r:pr});k=key(pc,pr);}
      path.reverse();
      const pts=path.map(q=>({x:q.c*ROUTE_STEP,y:q.r*ROUTE_STEP}));
      return smoothRect(p,pts,g);
    }
    for(const [dc,dr] of nbrs){
      const cc=cur.c+dc, rr=cur.r+dr;
      if(cc<0||rr<0||cc>=g.cols||rr>=g.rows||g.blocked[rr][cc]) continue;
      let occCost=0;
      if(occ){ occCost+=(occ.opp&&occ.opp[rr][cc]?occ.opp[rr][cc]*900:0)+(occ.same&&occ.same[rr][cc]?occ.same[rr][cc]*2.5:0); }
      const nk=key(cc,rr), ng=gscore.get(key(cur.c,cur.r))+1+g.pen[rr][cc]+occCost;
      if(ng<(gscore.get(nk)??Infinity)){
        came.set(nk,[cur.c,cur.r]); gscore.set(nk,ng);
        const turnPen = (came.has(key(cur.c,cur.r)))?0:0;
        heap.push({c:cc,r:rr,f:ng+Math.abs(cc-t.c)+Math.abs(rr-t.r)+turnPen});
      }
    }
  }
  return simplify([{x:sx,y:sy},{x:tx,y:ty}]);
  // unreachable fallback below (kept simple)
}

/* 合并共线点 */
function simplify(pts){
  if(pts.length<=2)return pts;
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const a=out[out.length-1],b=pts[i],c=pts[i+1];
    const col=Math.abs((b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y))<1e-9;
    if(!col) out.push(b);
  }
  out.push(pts[pts.length-1]);
  return out;
}

/* 直角路径平滑（保持全程水平/垂直）：消除相邻 10cm 锯齿 */
function segBlocked(p,a,b,g){
  const dist=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
  const steps=Math.max(1,Math.ceil(dist/ROUTE_STEP));
  for(let i=0;i<=steps;i++){
    const t=i/steps, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t;
    const c=Math.round(U.clamp(x,0,p.wallW)/ROUTE_STEP), r=Math.round(U.clamp(y,0,p.wallH)/ROUTE_STEP);
    if(g.blocked[r][c]) return true;
  }
  return false;
}
function smoothRect(p,pts,g){
  if(pts.length<=3)return pts;
  let cur=pts;
  // 反复消除“台阶抖动”：a->b->c->d 中 b、c 构成小折返时用 a->c'->d 替代
  for(let pass=0;pass<4;pass++){
    let changed=false;
    const out=[cur[0]];
    for(let i=1;i<cur.length-2;i++){
      const a=out[out.length-1], b=cur[i], c=cur[i+1], d=cur[i+2];
      const abV=Math.abs(a.x-b.x)<1e-6, abH=Math.abs(a.y-b.y)<1e-6;
      const bcV=Math.abs(b.x-c.x)<1e-6, bcH=Math.abs(b.y-c.y)<1e-6;
      const cdV=Math.abs(c.x-d.x)<1e-6, cdH=Math.abs(c.y-d.y)<1e-6;
      if(abH&&bcV&&cdH&&Math.abs(a.y-c.y)<1e-6){
        // a——b（水平）  b| c（垂直）  c——d（水平），且 a、c 同高：去掉 b，让 a 直连 c（水平）
        if(!segBlocked(p,a,c,g)){changed=true;continue;}
      }
      if(abV&&bcH&&cdV&&Math.abs(a.x-c.x)<1e-6){
        if(!segBlocked(p,a,c,g)){changed=true;continue;}
      }
      out.push(b);
    }
    out.push(cur[cur.length-2],cur[cur.length-1]);
    cur=simplify(out);
    if(!changed)break;
  }
  return cur;
}

/* 二叉堆 */
class MinHeap{
  constructor(){this.a=[];}
  size(){return this.a.length;}
  push(n){const a=this.a;a.push(n);let i=a.length-1;
    while(i>0){const p=(i-1)>>1;if(a[p].f<=a[i].f)break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
  pop(){const a=this.a,top=a[0],last=a.pop();
    if(a.length){a[0]=last;let i=0;
      for(;;){const l=2*i+1,r=l+1;let m=i;
        if(l<a.length&&a[l].f<a[m].f)m=l;if(r<a.length&&a[r].f<a[m].f)m=r;
        if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}
    return top;}
}

function makeOcc(p){
  const cols=Math.round(p.wallW/ROUTE_STEP)+1, rows=Math.round(p.wallH/ROUTE_STEP)+1;
  return {cols,rows,strong:Array.from({length:rows},()=>new Float32Array(cols)),
    weak:Array.from({length:rows},()=>new Float32Array(cols))};
}
function stampPath(occ, kind, path){
  const grid=occ[kind];
  const R=3; // 30cm 占用带
  const set=(c,r,v)=>{ if(r>=0&&r<occ.rows&&c>=0&&c<occ.cols&&grid[r][c]<v) grid[r][c]=v; };
  path.forEach(pt=>{
    const c=Math.round(pt.x/ROUTE_STEP), r=Math.round(pt.y/ROUTE_STEP);
    for(let dr=-R;dr<=R;dr++)for(let dc=-R;dc<=R;dc++){
      const man=Math.abs(dr)+Math.abs(dc);
      if(man<=R){
        // 占用强度：核心带高，外沿仍保留明显惩罚，鼓励保持 30cm
        const v=man===0?3:man===1?2.4:man===2?1.6:0.8;
        set(c+dc,r+dr,v);
      }
    }
  });
}

/* 自动生成全部线管（配电箱/弱电箱 -> 各设备） */
function generateConduits(p){
  p.conduits=p.conduits.filter(c=>c.manual);
  const occ=makeOcc(p);
  // 已有的手动画管路也计入占用
  p.conduits.forEach(c=>stampPath(occ,c.kind,c.path));
  const targets=[];
  for(const d of p.devices){
    const t=DEVICE_TYPES[d.type]; if(!t||!t.cable) continue;
    if(t.cable.strong&&p.panel) targets.push({d,kind:'strong',to:{...p.panel}});
    if(t.cable.weak&&p.weakBox) targets.push({d,kind:'weak',to:{...p.weakBox}});
  }
  // 强电先走线，弱电随后避开
  targets.sort((a,b)=>(a.kind==='strong'?0:1)-(b.kind==='strong'?0:1));
  for(const {d,kind,to} of targets){
    const path=astar(p,d.x,d.y,to.x,to.y,
      {opp:occ[kind==='strong'?'weak':'strong'], same:occ[kind]});
    const rounded=path.map(q=>({x:Math.round(q.x*100)/100,y:Math.round(q.y*100)/100}));
    stampPath(occ,kind,rounded);
    p.conduits.push({id:uid('cd_'),kind,auto:true,from:d.id,path:rounded});
  }
  spacingCheck(p);
}

/* 开关 -> 同区域灯具 回路连线 */
function generateSwitchLinks(p){
  p.links=[];
  const zones=[...new Set(p.devices.map(d=>d.zone).filter(Boolean))];
  for(const zid of zones){
    const switches=p.devices.filter(d=>d.zone===zid&&DEVICE_TYPES[d.type]?.cat==='switch');
    const lights=p.devices.filter(d=>d.zone===zid&&DEVICE_TYPES[d.type]?.cat==='light');
    const unassigned=new Set(lights.map(l=>l.id));
    switches.forEach((sw,idx)=>{
      const mine=lights.filter(l=>unassigned.has(l.id))
        .sort((a,b)=>U.dist(sw.x,sw.y,a.x,a.y)-U.dist(sw.x,sw.y,b.x,b.y)).slice(0,3);
      mine.forEach((lm,i)=>{
        unassigned.delete(lm.id);
        p.links.push({id:uid('lk_'),from:sw.id,to:lm.id,label:`L${idx+1}-${i+1}`});
      });
    });
  }
}

/* 强弱电间距检测：返回问题列表 */
function nearEndpoints(c, x, y){
  const ends=[c.path[0],c.path[c.path.length-1]];
  return ends.some(pt=>U.dist(pt.x,pt.y,x,y)<0.45);
}
function nearBoxes(p,x,y){
  const bs=[p.panel,p.weakBox].filter(Boolean);
  return bs.some(b=>U.dist(b.x,b.y,x,y)<0.5);
}
function segClosestPoint(a1,a2,b1,b2){
  // 返回两线段间最近点（a 段上）近似坐标
  let best={d:Infinity,x:0,y:0};
  const samples=6;
  for(let i=0;i<=samples;i++){
    const t=i/samples, px=a1.x+(a2.x-a1.x)*t, py=a1.y+(a2.y-a1.y)*t;
    const d=distPointSeg(px,py,b1.x,b1.y,b2.x,b2.y);
    if(d<best.d)best={d,x:px,y:py};
  }
  return best;
}
function spacingCheck(p){
  const issues=[];
  p.conduits.forEach(c=>{c.warn=false;c.warnAt=null;});
  const strong=p.conduits.filter(c=>c.kind==='strong');
  const weak=p.conduits.filter(c=>c.kind==='weak');
  const seen=new Set();
  const marked=new Set();
  for(const sg of strong)for(const wk of weak){
    let min=Infinity, at=null;
    for(let i=0;i<sg.path.length-1;i++){
      for(let j=0;j<wk.path.length-1;j++){
        const a1=sg.path[i],a2=sg.path[i+1],b1=wk.path[j],b2=wk.path[j+1];
        const info=segSegInfo(a1,a2,b1,b2);
        const cx=(a1.x+a2.x+b1.x+b2.x)/4, cy=(a1.y+a2.y+b1.y+b2.y)/4;
        if(info.hit){
          if(nearEndpoints(sg,cx,cy)||nearEndpoints(wk,cx,cy)||nearBoxes(p,cx,cy)) continue;
          min=0; at={x:cx,y:cy}; break;
        }
        if(info.dist<min){
          if(nearEndpoints(sg,cx,cy)||nearEndpoints(wk,cx,cy)||nearBoxes(p,cx,cy)) continue;
          min=info.dist;
          at=segClosestPoint(a1,a2,b1,b2);
        }
      }
      if(min===0)break;
    }
    if(min<STRONG_WEAK_GAP&&at){
      sg.warn=true; wk.warn=true;
      const key=[sg.id,wk.id].sort().join('|');
      // 同一位置只打一个⚠️
      const mk=`${at.x.toFixed(1)}_${at.y.toFixed(1)}`;
      if(!marked.has(mk)){marked.add(mk);sg.warnAt=at;}
      if(seen.has(key))continue; seen.add(key);
      if(issues.length<10) issues.push({level:min===0?'danger':'warn',
        text:min===0?'检测到强电线管与弱电线管交叉，必须 90° 垂直交叉并包锡箔纸或改用金属管分隔。'
          :`强/弱电线管最近间距仅 ${(min*100).toFixed(0)}cm，规范要求 ≥30cm，请调整走向。`,
        ids:[sg.id,wk.id]});
    }
  }
  if(issues.length===10){
    const n=[...seen].length;
    if(n>10) issues.push({level:'warn',text:`另有 ${n-10} 处间距问题未展开，请放大图纸按⚠️逐一调整。`});
  }
  return issues;
}

/* 线管长度（按路径），桥架单独统计 */
function conduitLengths(p){
  const res={strong:0,weak:0,bridge:0};
  for(const c of p.conduits){
    let L=0;
    for(let i=0;i<c.path.length-1;i++) L+=U.dist(c.path[i].x,c.path[i].y,c.path[i+1].x,c.path[i+1].y);
    res[c.kind]=(res[c.kind]||0)+L*1.15+0.6;
  }
  return res;
}
