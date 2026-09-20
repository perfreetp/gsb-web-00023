'use strict';

const LS_KEY='smartwiring.projects.v1';
const Store = {
  list(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY))||[]; }catch(e){ return []; }
  },
  saveAll(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); },
  get(id){ return this.list().find(p=>p.id===id)||null; },
  put(p){
    p.updatedAt=Date.now();
    const arr=this.list();
    const i=arr.findIndex(x=>x.id===p.id);
    if(i>=0) arr[i]=p; else arr.push(p);
    this.saveAll(arr);
  },
  remove(id){ this.saveAll(this.list().filter(p=>p.id!==id)); },
  import(p){ this.put(p); return p; },

  /* 版本：保存当前状态为快照，可恢复 */
  saveVersion(p, name){
    p.versions.push(makeVersion(p, name||('版本'+(p.versions.length+1))));
    this.put(p);
  },
  restoreVersion(p, vid){
    const v=p.versions.find(x=>x.id===vid);
    if(!v) return;
    const snap=JSON.parse(v.snapshot);
    Object.assign(p, snap);
    this.put(p);
  },

  encodeShare(p){
    const slim={id:p.id,name:p.name,wallW:p.wallW,wallH:p.wallH,image:p.image,
      walls:p.walls,obstacles:p.obstacles,zones:p.zones,devices:p.devices,
      conduits:p.conduits,links:p.links,circuits:p.circuits,panel:p.panel,weakBox:p.weakBox,
      scenes:p.scenes,notes:p.notes};
    return B64.enc(JSON.stringify(slim));
  },
  decodeShare(code){
    return JSON.parse(B64.decode(code));
  },
};

/* 根据设备类别/房间自动分配配电箱回路（已手动指定过的保留） */
function autoAssignCircuits(p){
  for(const d of p.devices){
    if(d.circuitId && p.circuits.some(c=>c.id===d.circuitId)) continue;
    const t=DEVICE_TYPES[d.type]; if(!t) continue;
    const zone=p.zones.find(zn=>zn.id===d.zone);
    const zname=zone?zone.name:'';
    let cid=null;
    if(t.power==='weak'){
      cid='nw1';
    }else if(zname==='厨房'){
      cid='c4';
    }else if(zname==='卫生间'){
      cid='c5';
    }else if(d.type==='socket_16'){
      // 空调/热水器专线：在 c6、c7 之间按数量均摊
      const n6=p.devices.filter(x=>x!==d&&x.circuitId==='c6').length;
      const n7=p.devices.filter(x=>x!==d&&x.circuitId==='c7').length;
      cid=n7<n6?'c7':'c6';
    }else if(t.cat==='light'||t.cat==='switch'){
      cid=(zname==='主卧'||zname==='次卧')?'c2':'c1';
    }else{
      cid='c3';
    }
    if(!p.circuits.find(c=>c.id===cid)) cid=(p.circuits.find(c=>c.type===(t.power==='weak'?'weak':'strong'))||{}).id||null;
    d.circuitId=cid;
  }
}
