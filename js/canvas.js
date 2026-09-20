'use strict';
/* 通用 SVG 户型画布：世界坐标（米），支持缩放/平移、拖放设备、墙体/梁柱/区域/线管绘制、尺寸标注 */

const SVGNS='http://www.w3.org/2000/svg';
function el(tag, attrs, parent){
  const n=document.createElementNS(SVGNS,tag);
  for(const k in attrs){
    if(k==='text') n.textContent=attrs[k];
    else n.setAttribute(k,attrs[k]);
  }
  if(parent) parent.appendChild(n);
  return n;
}

class PlanCanvas{
  constructor(mount, p, opts){
    this.mount=mount; this.p=p;
    this.opts=Object.assign({
      mode:'select', showGrid:true, showZones:true, showDevices:true, showWalls:true,
      showObstacles:true, showLinks:false, showConduits:false, showDims:true, showPanel:true,
      snap:true, interactive:true, onChange(){}, onSelect(){}, onPick(){},
    }, opts||{});
    this.scale=60; this.offx=40; this.offy=30;
    this.selected=null; this.dragType=null; this.drawing=null;
    this.guides=[]; this.dims=[];
    this._build();
    this.fit();
    this._bind();
    this.render();
  }
  _build(){
    this.mount.querySelectorAll('.pc-svg').forEach(n=>n.remove());
    this.svg=el('svg',{class:'pc-svg'},this.mount);
    this.bg=el('g',{class:'pc-bg'},this.svg);
    this.gGrid=el('g',{},this.svg);
    this.gImage=el('g',{},this.svg);
    this.gZones=el('g',{},this.svg);
    this.gWalls=el('g',{},this.svg);
    this.gObs=el('g',{},this.svg);
    this.gConduit=el('g',{},this.svg);
    this.gLinks=el('g',{},this.svg);
    this.gPanel=el('g',{},this.svg);
    this.gDevices=el('g',{},this.svg);
    this.gDim=el('g',{},this.svg);
    this.gGuide=el('g',{},this.svg);
    this.gDraw=el('g',{},this.svg);
  }
  X(x){return x*this.scale+this.offx;}
  Y(y){return y*this.scale+this.offy;}
  inv(px,py){return {x:(px-this.offx)/this.scale, y:(py-this.offy)/this.scale};}
  fit(){
    const w=this.mount.clientWidth||700, h=this.mount.clientHeight||520;
    this.scale=Math.min((w-90)/this.p.wallW,(h-100)/this.p.wallH);
    this.scale=U.clamp(this.scale,28,110);
    this.offx=(w-this.p.wallW*this.scale)/2;
    this.offy=(h-this.p.wallH*this.scale)/2;
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    this.svg.setAttribute('width',w); this.svg.setAttribute('height',h);
    this._vw=w; this._vh=h;
  }
  setMode(m){this.opts.mode=m; this.selected=null; this.drawing=null; this.render();}
  setOpt(k,v){this.opts[k]=v; this.render();}
  refresh(){this.p.devices; this.render();}

  /* ---------- 交互 ---------- */
  _mouse(e){
    const r=this.svg.getBoundingClientRect();
    return {cx:e.clientX-r.left, cy:e.clientY-r.top};
  }
  _bind(){
    this.svg.addEventListener('pointerdown',e=>this._down(e));
    this.svg.addEventListener('pointermove',e=>this._move(e));
    window.addEventListener('pointerup',e=>this._up(e));
    this.svg.addEventListener('wheel',e=>{
      e.preventDefault();
      const f=e.deltaY<0?1.1:0.9;
      const {cx,cy}=this._mouse(e);
      const w=this.inv(cx,cy);
      this.scale=U.clamp(this.scale*f,20,200);
      this.offx=cx-w.x*this.scale; this.offy=cy-w.y*this.scale;
      this.render();
    },{passive:false});
    this.svg.addEventListener('dragover',e=>e.preventDefault());
    this.svg.addEventListener('drop',e=>this._drop(e));
  }
  panBy(dx,dy){this.offx+=dx;this.offy+=dy;this.render();}
  zoomBy(f,cx,cy){
    cx=cx??this._vw/2; cy=cy??this._vh/2;
    const w=this.inv(cx,cy);
    this.scale=U.clamp(this.scale*f,20,200);
    this.offx=cx-w.x*this.scale; this.offy=cy-w.y*this.scale;
    this.render();
  }
  _drop(e){
    e.preventDefault();
    const type=e.dataTransfer.getData('text/device');
    if(!type) return;
    const {cx,cy}=this._mouse(e);
    const w=this._snapWorld(...Object.values(this.inv(cx,cy)));
    const zone=zoneAt(this.p,w.x,w.y);
    const d={id:uid('d_'),type,zone:zone?zone.id:null,x:U.clamp(w.x,0,this.p.wallW),y:U.clamp(w.y,0,this.p.wallH),
      rot:0,dims:null,circuitId:null};
    this.p.devices.push(d);
    autoAssignCircuits(this.p);
    this.selected={kind:'device',id:d.id};
    this.opts.onChange();
    this.render();
  }
  _down(e){
    if(e.button===1||e.button===2||this._panKey(e)){ this._panning={x:e.clientX,y:e.clientY}; e.preventDefault(); return;}
    const {cx,cy}=this._mouse(e);
    const w=this.inv(cx,cy);
    const m=this.opts.mode;
    if(m==='select'){
      const hit=this._hit(w.x,w.y);
      if(hit){
        this.selected=hit;
        this.opts.onSelect(hit);
        this._dragStart={...w,hit};
      }else{
        this.selected=null; this.opts.onSelect(null);
      }
      this.render();
    }else if(m==='place-point'){
      this.opts.onPlacePoint&&this.opts.onPlacePoint(w);
      this.drawing=null;
    }else if(m==='dim'){
      if(!this.drawing){this.drawing={x1:w.x,y1:w.y};}
      else{
        const dx=w.x-this.drawing.x1, dy=w.y-this.drawing.y1;
        this.dims.push({x1:this.drawing.x1,y1:this.drawing.y1,x2:w.x,y2:w.y});
        this.drawing=null;
        this.opts.onChange();
      }
      this.render();
    }else if(m.startsWith('draw-')){
      if(!this.drawing) this.drawing={x1:w.x,y1:w.y,points:null};
    }
  }
  _panKey(e){return e.button===1;}
  _move(e){
    if(this._panning){this.panBy(e.clientX-this._panning.x,e.clientY-this._panning.y);this._panning={x:e.clientX,y:e.clientY};return;}
    const {cx,cy}=this._mouse(e);
    const w=this.inv(cx,cy);
    const m=this.opts.mode;
    if(this._dragStart&&this.selected&&this.selected.kind==='device'){
      const d=this.p.devices.find(x=>x.id===this.selected.id);
      if(d){
        const s=this._snapWorld(w.x,w.y,d.id);
        d.x=U.clamp(s.x,0,this.p.wallW); d.y=U.clamp(s.y,0,this.p.wallH);
        d.zone=(zoneAt(this.p,d.x,d.y)||{}).id||null;
        autoAssignCircuits(this.p);
        this.opts.onChange();
      }
      this.render(); return;
    }
    if(m.startsWith('draw-')&&this.drawing){
      this.drawing.cur=w;
      this.render();
    }
    if(m==='dim'&&this.drawing){this.drawing.cur=w;this.render();}
  }
  _up(e){
    this._panning=null;
    if(this._dragStart){this._dragStart=null;this.guides=[];this.render();return;}
    const m=this.opts.mode;
    if(m.startsWith('draw-')&&this.drawing&&this.drawing.cur){
      this._commitDraw(this.drawing);
      this.drawing=null; this.opts.onChange(); this.render();
    }
  }
  _snapWorld(x,y,ignoreId){
    this.guides=[];
    if(!this.opts.snap){return {x,y};}
    const T=.12;
    const pts=[];
    for(const z of this.p.zones){pts.push(z.x,z.x+z.w,z.y,z.y+z.h);}
    this.p.devices.forEach(d=>{ if(d.id!==ignoreId){pts.push(d.x,d.y);} });
    let sx=null,sy=null;
    for(const v of pts){
      if(Math.abs(x-v)<T){sx=v;this.guides.push({dir:'v',v});}
      if(Math.abs(y-v)<T){sy=v;this.guides.push({dir:'h',v});}
    }
    const r=Math.round(x*2)/2, c=Math.round(y*2)/2;
    if(sx===null&&Math.abs(x-r)<T) sx=r;
    if(sy===null&&Math.abs(y-c)<T) sy=c;
    return {x:sx??x, y:sy??y};
  }
  _hit(x,y){
    const T=.22;
    for(let i=this.p.devices.length-1;i>=0;i--){
      const d=this.p.devices[i];
      if(U.dist(x,y,d.x,d.y)<T) return {kind:'device',id:d.id};
    }
    if(this.opts.showConduits){
      for(let i=this.p.conduits.length-1;i>=0;i--){
        const c=this.p.conduits[i].path;
        for(let j=0;j<c.length-1;j++){
          if(distPointSeg(x,y,c[j].x,c[j].y,c[j+1].x,c[j+1].y)<.1) return {kind:'conduit',id:this.p.conduits[i].id};
        }
      }
    }
    for(const o of this.p.obstacles){
      if(U.ptInRect(x,y,{x:o.x-.15,y:o.y-.15,w:o.w+.3,h:o.h+.3})) return {kind:'obs',id:o.id};
    }
    return null;
  }
  deleteSelected(){
    if(!this.selected) return;
    const k=this.selected;
    if(k.kind==='device'){
      this.p.devices=this.p.devices.filter(d=>d.id!==k.id);
      this.p.conduits=this.p.conduits.filter(c=>c.from!==k.id&&c.to!==k.id);
      this.p.links=this.p.links.filter(l=>l.from!==k.id&&l.to!==k.id);
    }else if(k.kind==='obs'){
      this.p.obstacles=this.p.obstacles.filter(o=>o.id!==k.id);
    }else if(k.kind==='conduit'){
      this.p.conduits=this.p.conduits.filter(c=>c.id!==k.id);
    }
    this.selected=null;this.opts.onSelect(null);this.opts.onChange();this.render();
  }

  _commitDraw(d){
    const m=this.opts.mode;
    const a={x:d.x1,y:d.y1}, b=d.cur;
    if(U.dist(a.x,a.y,b.x,b.y)<.15) return;
    if(m==='draw-wall'){
      this.p.walls.push({id:uid('w_'),x1:a.x,y1:a.y,x2:b.x,y2:b.y,type:'wall'});
    }else if(m==='draw-bearing'){
      this.p.walls.push({id:uid('w_'),x1:a.x,y1:a.y,x2:b.x,y2:b.y,type:'bearing'});
    }else if(m==='draw-beam'){
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
      this.p.obstacles.push({id:uid('o_'),type:'beam',x,y,w:Math.abs(b.x-a.x)||.3,h:.2,label:'横梁'});
    }else if(m==='draw-column'){
      const s=.32;
      this.p.obstacles.push({id:uid('o_'),type:'column',x:b.x-s/2,y:b.y-s/2,w:s,h:s,label:'承重柱'});
    }else if(m==='draw-zone'){
      const zn={id:uid('z_'),name:'区域'+(this.p.zones.length+1),
        x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y),
        color:ZONE_COLORS[this.p.zones.length%ZONE_COLORS.length]};
      this.p.zones.push(zn);
    }else if(m==='draw-strong'||m==='draw-weak'||m==='draw-bridge'){
      const kind=m==='draw-strong'?'strong':m==='draw-weak'?'weak':'bridge';
      this.p.conduits.push({id:uid('cd_'),kind,manual:true,
        path:[{x:a.x,y:a.y},{x:b.x,y:b.y}]});
    }
  }

  /* ---------- 渲染 ---------- */
  render(){
    [this.gGrid,this.gImage,this.gZones,this.gWalls,this.gObs,this.gConduit,this.gLinks,this.gPanel,this.gDevices,this.gDim,this.gGuide,this.gDraw]
      .forEach(g=>g.innerHTML='');
    this._grid();
    if(this.p.image) this._image();
    if(this.opts.showZones) this._zones();
    if(this.opts.showWalls) this._walls();
    if(this.opts.showObstacles) this._obstacles();
    if(this.opts.showLinks) this._links();
    if(this.opts.showConduits) this._conduits();
    if(this.opts.showPanel) this._panel();
    if(this.opts.showDevices) this._devices();
    if(this.opts.showDims) this._dims();
    this._guides();
    this._draft();
  }
  _grid(){
    if(!this.opts.showGrid)return;
    const s=this.scale;
    for(let x=0;x<=this.p.wallW+.001;x+=0.5){
      el('line',{x1:this.X(x),y1:this.Y(0),x2:this.X(x),y2:this.Y(this.p.wallH),
        stroke:x%1===0?'#e6ebf4':'#f0f3f9','stroke-width':1},this.gGrid);
    }
    for(let y=0;y<=this.p.wallH+.001;y+=0.5){
      el('line',{x1:this.X(0),y1:this.Y(y),x2:this.X(this.p.wallW),y2:this.Y(y),
        stroke:y%1===0?'#e6ebf4':'#f0f3f9','stroke-width':1},this.gGrid);
    }
    el('rect',{x:this.X(0),y:this.Y(0),width:this.p.wallW*s,height:this.p.wallH*s,fill:'#fff',opacity:0},this.gGrid);
  }
  _image(){
    el('image',{href:this.p.image,x:this.X(0),y:this.Y(0),
      width:this.p.wallW*this.scale,height:this.p.wallH*this.scale,opacity:.9},this.gImage);
  }
  _zones(){
    for(const z of this.p.zones){
      el('rect',{x:this.X(z.x),y:this.Y(z.y),width:z.w*this.scale,height:z.h*this.scale,
        rx:10,fill:z.color,'fill-opacity':.07,stroke:z.color,'stroke-width':1.6,'stroke-dasharray':'7 5'},this.gZones);
      const t=el('text',{x:this.X(z.x)+10,y:this.Y(z.y)+22,'font-size':14,'font-weight':600,fill:z.color,text:z.name},this.gZones);
    }
  }
  _walls(){
    for(const w of this.p.walls){
      const bearing=w.type==='bearing';
      el('line',{x1:this.X(w.x1),y1:this.Y(w.y1),x2:this.X(w.x2),y2:this.Y(w.y2),
        stroke:bearing?'#334155':'#8a97ab','stroke-width':bearing?7:4,'stroke-linecap':'round'},this.gWalls);
      if(bearing){
        el('line',{x1:this.X(w.x1),y1:this.Y(w.y1),x2:this.X(w.x2),y2:this.Y(w.y2),
          stroke:'#52607a','stroke-width':1.5,'stroke-dasharray':'4 4'},this.gWalls);
      }
    }
  }
  _obstacles(){
    for(const o of this.p.obstacles){
      const col=o.type==='column';
      el('rect',{x:this.X(o.x),y:this.Y(o.y),width:o.w*this.scale,height:o.h*this.scale,rx:col?4:2,
        fill:'#475569',stroke:'#1e293b','stroke-width':1.5},this.gObs);
      if(o.label){
        el('text',{x:this.X(o.x)+o.w*this.scale/2,y:this.Y(o.y)-5,'font-size':11,fill:'#475569',
          'text-anchor':'middle',text:o.label},this.gObs);
      }
    }
  }
  _conduits(){
    const colors={strong:'#ef4444',weak:'#2563eb',bridge:'#7c3aed'};
    for(const c of this.p.conduits){
      const pts=c.path.map(pt=>`${this.X(pt.x)},${this.Y(pt.y)}`).join(' ');
      el('polyline',{points:pts,fill:'none',stroke:colors[c.kind]||'#888','stroke-width':c.kind==='bridge'?5:2.4,
        'stroke-linejoin':'round','stroke-linecap':'round',opacity:.85,
        'stroke-dasharray':c.auto?'':'6 3'},this.gConduit);
      c.path.forEach(pt=>{
        el('circle',{cx:this.X(pt.x),cy:this.Y(pt.y),r:2.6,fill:colors[c.kind]||'#888'},this.gConduit);
      });
      if(c.warnAt){
        el('circle',{cx:this.X(c.warnAt.x),cy:this.Y(c.warnAt.y),r:9,fill:'#fff',stroke:'#f59e0b','stroke-width':2},this.gConduit);
        el('text',{x:this.X(c.warnAt.x),y:this.Y(c.warnAt.y)+4.5,'font-size':11,'font-weight':700,fill:'#b45309','text-anchor':'middle',text:'!'},this.gConduit);
      }
    }
  }
  _links(){
    for(const lk of this.p.links){
      const a=this.p.devices.find(d=>d.id===lk.from), b=this.p.devices.find(d=>d.id===lk.to);
      if(!a||!b)continue;
      const mx=(a.x+b.x)/2, my=(a.y+b.y)/2-.18;
      el('path',{d:`M${this.X(a.x)} ${this.Y(a.y)} Q ${this.X(mx)} ${this.Y(my)} ${this.X(b.x)} ${this.Y(b.y)}`,
        fill:'none',stroke:'#f59e0b','stroke-width':1.8,'stroke-dasharray':'4 3'},this.gLinks);
      el('text',{x:this.X(mx),y:this.Y(my)-3,'font-size':10,fill:'#b45309','text-anchor':'middle',text:lk.label||'回路'},this.gLinks);
    }
  }
  _panel(){
    const mk=(pt,label,color)=>{
      el('rect',{x:this.X(pt.x)-13,y:this.Y(pt.y)-13,width:26,height:26,rx:5,fill:color,stroke:'#fff','stroke-width':2},this.gPanel);
      el('text',{x:this.X(pt.x),y:this.Y(pt.y)+4,'font-size':13,'text-anchor':'middle',text:label==='强电箱'?'⚡':'弱电'},this.gPanel);
      el('text',{x:this.X(pt.x),y:this.Y(pt.y)+26,'font-size':10,'text-anchor':'middle',fill:color,text:label},this.gPanel);
    };
    if(this.p.panel) mk(this.p.panel,'配电箱','#ef4444');
    if(this.p.weakBox) mk(this.p.weakBox,'弱电箱','#2563eb');
  }
  _devices(){
    for(const d of this.p.devices){
      const t=DEVICE_TYPES[d.type]; if(!t) continue;
      const x=this.X(d.x),y=this.Y(d.y), sel=this.selected&&this.selected.id===d.id;
      const cls=t.power==='strong'?'pc-d strong':'pc-d weak';
      if(t.cable&&t.cable.strong&&t.cable.weak){
        el('circle',{cx:x,cy:y,r:13,fill:'#fff',stroke:sel?'#111':'#94a3b8','stroke-width':sel?2.5:1.2},this.gDevices);
        el('path',{d:`M ${x-13} ${y} A 13 13 0 0 1 ${x+13} ${y}`,fill:'none',stroke:'#2563eb','stroke-width':3},this.gDevices);
        el('path',{d:`M ${x-13} ${y} A 13 13 0 0 0 ${x+13} ${y}`,fill:'none',stroke:'#ef4444','stroke-width':3},this.gDevices);
      }else{
        el('circle',{cx:x,cy:y,r:13,fill:t.power==='strong'?'#fdecec':'#e8f0fe',
          stroke:sel?'#111':(t.power==='strong'?'#ef4444':'#2563eb'),'stroke-width':sel?2.5:1.4},this.gDevices);
      }
      el('text',{x,y:y+5,'font-size':14,'text-anchor':'middle',text:t.icon},this.gDevices);
      if(sel){
        el('circle',{cx:x,cy:y,r:17,fill:'none',stroke:'#3b6ef5','stroke-width':1.4,'stroke-dasharray':'3 3'},this.gDevices);
      }
      const label=d.label||t.name;
      el('text',{x,y:y-18,'font-size':10.5,'text-anchor':'middle',fill:'#334155',text:label},this.gDevices);
    }
  }
  _dims(){
    const all=this.dims.slice();
    this.p.devices.forEach(d=>{ if(d.dims) all.push(d.dims); });
    for(const dm of all){
      const x1=this.X(dm.x1),y1=this.Y(dm.y1),x2=this.X(dm.x2),y2=this.Y(dm.y2);
      el('line',{x1,y1,x2,y2,stroke:'#0ea5e9','stroke-width':1.3},this.gDim);
      el('circle',{cx:x1,cy:y1,r:3,fill:'#0ea5e9'},this.gDim);
      el('circle',{cx:x2,cy:y2,r:3,fill:'#0ea5e9'},this.gDim);
      const mx=(x1+x2)/2,my=(y1+y2)/2;
      el('rect',{x:mx-24,y:my-19,width:48,height:15,rx:4,fill:'#e0f2fe'},this.gDim);
      el('text',{x:mx,y:my-8,'font-size':10.5,'text-anchor':'middle',fill:'#0369a1',text:U.dist(dm.x1,dm.y1,dm.x2,dm.y2).toFixed(2)+' m'},this.gDim);
    }
  }
  _guides(){
    for(const g of this.guides){
      if(g.dir==='v') el('line',{x1:this.X(g.v),y1:0,x2:this.X(g.v),y2:this._vh,stroke:'#3b6ef5','stroke-width':1,'stroke-dasharray':'4 4',opacity:.6},this.gGuide);
      else el('line',{x1:0,y1:this.Y(g.v),x2:this._vw,y2:this.Y(g.v),stroke:'#3b6ef5','stroke-width':1,'stroke-dasharray':'4 4',opacity:.6},this.gGuide);
    }
  }
  _draft(){
    if(!this.drawing||!this.drawing.cur)return;
    const a=this.drawing, b=this.drawing.cur;
    const m=this.opts.mode;
    let col='#3b6ef5',sw=3,fill='none';
    if(m==='draw-bearing')col='#334155';
    if(m==='draw-beam'||m==='draw-column')col='#475569';
    if(m==='draw-zone'){col=ZONE_COLORS[this.p.zones.length%ZONE_COLORS.length];fill=col;}
    if(m==='draw-strong')col='#ef4444';
    if(m==='draw-weak')col='#2563eb';
    if(m==='draw-bridge')col='#7c3aed';
    if(m==='draw-zone'||m==='draw-beam'){
      el('rect',{x:this.X(Math.min(a.x1,b.x)),y:this.Y(Math.min(a.y1,b.y)),
        width:Math.abs(b.x-a.x1)*this.scale,height:Math.abs(b.y-a.y1)*this.scale,
        fill, 'fill-opacity':.1,stroke:col,'stroke-width':2,'stroke-dasharray':'6 3'},this.gDraw);
    }else{
      el('line',{x1:this.X(a.x1),y1:this.Y(a.y1),x2:this.X(b.x),y2:this.Y(b.y),
        stroke:col,'stroke-width':sw,'stroke-dasharray':'6 3'},this.gDraw);
    }
  }

  exportSVG(){
    const clone=this.svg.cloneNode(true);
    clone.setAttribute('xmlns',SVGNS);
    return new XMLSerializer().serializeToString(clone);
  }
}
