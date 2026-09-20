'use strict';
/* 统计、材料清单、预算估算、施工交底文案 */

function deviceCounts(p){
  const m=new Map();
  for(const d of p.devices){ m.set(d.type,(m.get(d.type)||0)+1); }
  return [...m.entries()].map(([type,qty])=>({type,qty,t:DEVICE_TYPES[type]}));
}

function bom(p){
  const items=[];
  const total={devices:0,cable:0,conduit:0};
  for(const {type,qty,t} of deviceCounts(p)){
    const sub=qty*t.price;
    total.devices+=sub;
    items.push({cat:'设备',name:t.name,spec:t.desc,qty,unit:'个',price:t.price,subtotal:sub});
  }
  const lens=conduitLengths(p);
  const cableAgg={};
  for(const d of p.devices){
    const t=DEVICE_TYPES[d.type]; if(!t) continue;
    if(t.cable?.strong) cableAgg[t.cable.strong]=(cableAgg[t.cable.strong]||0)+1;
    if(t.cable?.weak) cableAgg[t.cable.weak]=(cableAgg[t.cable.weak]||0)+1;
  }
  for(const [name,n] of Object.entries(cableAgg)){
    // 线缆平均长度按对应线管均摊 + 两端预留
    const kind=name.startsWith('BV')?'strong':'weak';
    const avg=lens[kind]/Math.max(1,n);
    const qty=+(Math.ceil(lens[kind])+n*2);
    const price=CABLE_PRICE[name]||4;
    const sub=qty*price; total.cable+=sub;
    items.push({cat:'线材',name,spec:`${n} 个点位 · 含两端预留 2m`,qty,unit:'m',price,subtotal:sub});
  }
  const cond=[['strong','PVC强电线管 Φ20'],['weak','PVC弱电线管 Φ20'],['bridge','镀锌金属桥架 100×50']];
  for(const [k,name] of cond){
    if(lens[k]>0.2){
      const qty=Math.ceil(lens[k]);
      const price=CONDUIT_PRICE[k], sub=qty*price;
      total.conduit+=sub;
      items.push({cat:'管材/桥架',name,spec:'墙地面暗敷',qty,unit:'m',price,subtotal:sub});
    }
  }
  // 弱电辅料
  const weakN=p.devices.filter(d=>DEVICE_TYPES[d.type]?.power==='weak'||DEVICE_TYPES[d.type]?.cable?.weak).length;
  if(weakN){
    const aux=[['网络水晶头',weakN*2,'个',1.2],['86型底盒',p.devices.length,'个',3],
      ['标签管/号码管',p.devices.length,'套',1],['锡箔纸（强弱电交叉处理）',Math.max(1,weakN),'卷',12]];
    aux.forEach(([name,qty,unit,price])=>{const sub=qty*price;total.conduit+=sub;
      items.push({cat:'辅材',name,spec:'',qty,unit,price,subtotal:sub});});
  }
  return {items,total,lens};
}

function budget(p){
  const {total}=bom(p);
  const material=total.devices+total.cable+total.conduit;
  const labor=Math.round(material*CONSTRUCTION_RATE);
  const design=Math.round(material*0.06);
  const reserve=Math.round(material*0.08);
  const sum=material+labor+design+reserve;
  return {device:total.devices,cable:total.cable+total.conduit,labor,design,reserve,sum};
}

function circuitLoads(p){
  return p.circuits.map(c=>{
    const ds=p.devices.filter(d=>d.circuitId===c.id);
    const load=ds.reduce((s,d)=>s+(POWER_BY_TYPE[d.type]??POWER_BY_CAT[DEVICE_TYPES[d.type]?.cat]??0),0);
    return {...c,count:ds.length,load,overload:c.limit>0&&load>c.limit};
  });
}

function warnings(p){
  const out=[];
  const load=circuitLoads(p);
  load.forEach(c=>{if(c.overload)out.push({level:'danger',text:`${c.name} 估算负载 ${c.load}W 超过 ${c.limit}W，需拆分回路或更换断路器。`});});
  const uncircuited=p.devices.filter(d=>!d.circuitId);
  if(uncircuited.length) out.push({level:'warn',text:`${uncircuited.length} 个点位尚未分配配电箱回路。`});
  if(!p.panel) out.push({level:'warn',text:'尚未设置配电箱位置，无法生成强电管路。'});
  if(!p.weakBox) out.push({level:'warn',text:'尚未设置弱电箱位置，无法生成弱电管路。'});
  const noZone=p.devices.filter(d=>!d.zone);
  if(noZone.length) out.push({level:'warn',text:`${noZone.length} 个点位落在区域之外，无法参与场景与回路自动划分。`});
  return out;
}

function constructionText(p){
  const loads=circuitLoads(p);
  const lens=conduitLengths(p);
  const lines=[];
  lines.push(`一、工程概况：${p.name}，户型净尺寸约 ${p.wallW}m × ${p.wallH}m，共 ${p.zones.length} 个功能区域、${p.devices.length} 个点位。`);
  lines.push('二、强电要求：');
  lines.push(`1. 配电箱位于图中红色⚡位置，共 ${loads.filter(c=>c.type==='strong').length} 个强电回路，按下表配置断路器：`);
  loads.filter(c=>c.type==='strong').forEach(c=>lines.push(`   · ${c.name}：${c.breaker}，${c.cable}，带漏电保护${c.overload?'（⚠ 超载需调整）':''}`));
  lines.push('2. 照明与插座分回路，厨房、卫生间、空调单独成回路；插座回路必须使用带漏电保护断路器（30mA）。');
  lines.push('3. 同一室内开关控制本区域灯具，开关底盒高度 1.3m，普通插座 0.3m，厨房台面插座 1.1m，空调插座 1.8~2.2m。');
  lines.push('三、弱电要求：');
  lines.push(`1. 弱电箱位于图中蓝色位置，全部弱电线汇聚至弱电箱，预留电源插座与散热空间。`);
  lines.push(`2. 每个智能开关、传感器、摄像头、AP面板、窗帘电机处均单放一根 CAT6 网线；电视点位放 HDMI + 网线。`);
  lines.push('3. 弱电线管与强电线管平行间距不小于 30cm，交叉处须 90° 垂直交叉并包裹锡箔纸；强弱电严禁同管。');
  lines.push(`四、管路敷设：强电线管约 ${lens.strong.toFixed(1)}m，弱电线管约 ${lens.weak.toFixed(1)}m，桥架约 ${(lens.bridge||0).toFixed(1)}m。`);
  lines.push('线管沿墙、沿顶边角敷设，自动绕开图中深色梁柱与承重墙区域；开槽横平竖直，承重结构严禁横向开槽。');
  lines.push('五、智能调试：完成后按"回家/离家/观影/睡眠"四个场景进行联动测试，网关置于客厅居中高处，AP 漫游切换正常。');
  lines.push('六、验收：所有点位拍照留底，每根网线用测线仪测试，回路逐一送电并贴好回路标签。');
  return lines;
}

function bomCSV(p){
  const {items}=bom(p);
  const rows=[['类别','名称','规格','数量','单位','单价(元)','小计(元)']];
  items.forEach(i=>rows.push([i.cat,i.name,i.spec,i.qty,i.unit,i.price,i.subtotal]));
  const b=budget(p);
  rows.push([]);rows.push(['设备合计',Math.round(b.device)]);rows.push(['线材管材合计',Math.round(b.cable)]);
  rows.push(['施工人工(35%)',b.labor]);rows.push(['设计调试费(6%)',b.design]);
  rows.push(['不可预见费(8%)',b.reserve]);rows.push(['预算总计',Math.round(b.sum)]);
  return '\ufeff'+rows.map(r=>r.join(',')).join('\n');
}
