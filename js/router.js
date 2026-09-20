'use strict';

const SCREENS=[
  {id:'home', name:'我的方案', icon:'🏠'},
  {id:'floorplan', name:'① 上传户型', icon:'🗺️'},
  {id:'zones', name:'② 划分区域', icon:'🧩'},
  {id:'devices', name:'③ 设备点位', icon:'💡'},
  {id:'scenes', name:'④ 智能场景', icon:'✨'},
  {id:'wiring', name:'⑤ 线管布线', icon:'🧵'},
  {id:'panel', name:'⑥ 配电箱回路', icon:'⚡'},
  {id:'stats', name:'⑦ 清单预算', icon:'📊'},
  {id:'docs', name:'⑧ 交底·版本·分享', icon:'📄'},
];

const Router={
  current:{},
  parse(){
    const h=(location.hash||'#/home').slice(2);
    const [name,qs]=h.split('?');
    const params={};
    (qs||'').split('&').filter(Boolean).forEach(kv=>{
      const [k,v]=kv.split('=');params[k]=decodeURIComponent(v||'');
    });
    return {name:name||'home',params};
  },
  go(name,params){
    let q=Object.entries(params||{}).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
    location.hash='#/'+name+(q?'?'+q:'');
  },
  start(){
    const onHash=()=>{const r=this.parse();this.current=r;App.route(r);};
    window.addEventListener('hashchange',onHash);
    onHash();
  }
};
