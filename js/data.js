/* 全局数据：设备库 / 场景模板 / 线材与价格 / 演示户型 */
'use strict';

const DEVICE_TYPES = {
  light_ceiling:{name:'吸顶灯', cat:'light', power:'strong', icon:'💡', price:120, cable:{strong:'BV 2.5mm²'}, desc:'基础照明'},
  light_down:{name:'筒灯/射灯', cat:'light', power:'strong', icon:'🔦', price:45, cable:{strong:'BV 1.5mm²'}, desc:'辅助照明'},
  light_strip:{name:'灯带', cat:'light', power:'strong', icon:'🟰', price:35, cable:{strong:'BV 1.5mm²'}, desc:'氛围照明'},
  switch_mech:{name:'机械开关', cat:'switch', power:'strong', icon:'🔲', price:18, cable:{strong:'BV 2.5mm²'}, desc:'传统翘板'},
  switch_smart:{name:'智能开关', cat:'switch', power:'strong', icon:'🎛️', price:160, cable:{strong:'BV 2.5mm²', weak:'网线 CAT6'}, desc:'零火版·接入网关'},
  socket_5:{name:'五孔插座', cat:'socket', power:'strong', icon:'🔌', price:22, cable:{strong:'BV 2.5mm²'}, desc:'10A 常规'},
  socket_16:{name:'16A空调插座', cat:'socket', power:'strong', icon:'❄️', price:38, cable:{strong:'BV 4mm²'}, desc:'空调/热水器'},
  socket_usb:{name:'USB轨道插座', cat:'socket', power:'strong', icon:'🆙', price:120, cable:{strong:'BV 2.5mm²'}, desc:'带快充'},
  sensor_body:{name:'人体传感器', cat:'sensor', power:'weak', icon:'📡', price:89, cable:{weak:'网线 CAT6'}, desc:'毫米波/Zigbee'},
  sensor_door:{name:'门窗传感器', cat:'sensor', power:'weak', icon:'🚪', price:69, cable:{weak:'网线 CAT6'}, desc:'开合检测'},
  sensor_temp:{name:'温湿度传感器', cat:'sensor', power:'weak', icon:'🌡️', price:59, cable:{weak:'网线 CAT6'}, desc:'环境联动'},
  sensor_leak:{name:'水浸传感器', cat:'sensor', power:'weak', icon:'💧', price:55, cable:{weak:'网线 CAT6'}, desc:'厨卫防漏'},
  camera:{name:'摄像头', cat:'camera', power:'weak', icon:'📷', price:260, cable:{weak:'网线 CAT6 + 电源线'}, desc:'POE 供电'},
  doorbell:{name:'可视门铃', cat:'camera', power:'weak', icon:'🔔', price:399, cable:{weak:'网线 CAT6'}, desc:'门口机'},
  curtain:{name:'窗帘电机', cat:'curtain', power:'strong', icon:'🪟', price:480, cable:{strong:'BV 2.5mm²', weak:'网线 CAT6'}, desc:'开合帘电机'},
  panel:{name:'智能中控屏', cat:'panel', power:'weak', icon:'🖥️', price:899, cable:{weak:'网线 CAT6'}, desc:'墙面中枢'},
  gateway:{name:'网关', cat:'network', power:'weak', icon:'🌐', price:299, cable:{weak:'网线 CAT6'}, desc:'协议中枢'},
  ap:{name:'AP面板', cat:'network', power:'weak', icon:'📶', price:230, cable:{weak:'网线 CAT6'}, desc:'全屋WiFi'},
  tv_port:{name:'电视点位', cat:'media', power:'weak', icon:'📺', price:45, cable:{weak:'HDMI + 网线'}, desc:'背景墙'},
  projector:{name:'投影仪点位', cat:'media', power:'strong', icon:'🎬', price:120, cable:{strong:'BV 2.5mm²', weak:'HDMI + 网线'}, desc:'吊装'},
};

const CATEGORIES = [
  {id:'light', name:'灯具', icon:'💡'},
  {id:'switch', name:'开关', icon:'🎛️'},
  {id:'socket', name:'插座', icon:'🔌'},
  {id:'sensor', name:'传感器', icon:'📡'},
  {id:'camera', name:'摄像头', icon:'📷'},
  {id:'curtain', name:'窗帘电机', icon:'🪟'},
  {id:'network', name:'网络设备', icon:'🌐'},
  {id:'media', name:'影音点位', icon:'🎬'},
];

const SCENE_TEMPLATES = [
  {id:'home', name:'回家模式', icon:'🏠', color:'#16a34a',
   desc:'开门亮灯、窗帘打开、空调调到舒适温度、撤防摄像头。',
   actions:[['sensor_door','门口传感器触发'],['light_ceiling','客厅灯光 80%'],['curtain','客厅窗帘打开'],['ap','网络保持在线']]},
  {id:'away', name:'离家模式', icon:'🚪', color:'#f59e0b',
   desc:'全屋关灯断电、窗帘关闭、摄像头布防、门窗异常报警。',
   actions:[['switch_smart:'+'all','关闭所有灯光回路'],['curtain','关闭全部窗帘'],['camera','摄像头布防'],['sensor_door','门窗监测开启']]},
  {id:'movie', name:'观影模式', icon:'🎬', color:'#7c3aed',
   desc:'主灯关闭、灯带调暗、窗帘合上、投影与音响上电。',
   actions:[['light_ceiling','关闭客厅主灯'],['light_strip','灯带调至 20%'],['curtain:'+'客厅','关闭客厅窗帘'],['projector','投影仪上电']]},
  {id:'sleep', name:'睡眠模式', icon:'🌙', color:'#2563eb',
   desc:'卧室灯渐灭、走廊夜灯微亮、空调26℃、安防夜间布防。',
   actions:[['light_ceiling:'+'卧室','卧室灯渐灭'],['light_down:'+'走廊','夜灯 10%'],['camera:'+'门口','夜间布防'],['socket_16','空调26℃']]},
];

/* 线材单价（元/米），弱电含线管敷设人工辅材 */
const CABLE_PRICE = {
  'BV 1.5mm²':3.2, 'BV 2.5mm²':4.5, 'BV 4mm²':6.8,
  '网线 CAT6':4.2, '网线 CAT6 + 电源线':5.8, 'HDMI + 网线':12,
};
const CONDUIT_PRICE = {strong:3.5, weak:3.8, bridge:22}; // PVC/镀锌桥架 元/米
const CONSTRUCTION_RATE = 0.35; // 施工人工按设备+线材成本 35% 估算

const ZONE_COLORS = ['#3b6ef5','#16a34a','#f59e0b','#ec4899','#7c3aed','#0ea5e9','#ef4444','#14b8a6','#a855f7','#f97316'];

const DEFAULT_CIRCUITS = [
  {id:'c1', name:'照明回路1', type:'strong', breaker:'C16', cable:'BV 2.5mm²', limit:2200},
  {id:'c2', name:'照明回路2', type:'strong', breaker:'C16', cable:'BV 2.5mm²', limit:2200},
  {id:'c3', name:'普通插座回路', type:'strong', breaker:'C20', cable:'BV 2.5mm²', limit:3500},
  {id:'c4', name:'厨房插座回路', type:'strong', breaker:'C25', cable:'BV 4mm²', limit:5000},
  {id:'c5', name:'卫生间回路', type:'strong', breaker:'C20', cable:'BV 4mm²', limit:4000},
  {id:'c6', name:'空调回路1', type:'strong', breaker:'C20', cable:'BV 4mm²', limit:4000},
  {id:'c7', name:'空调回路2', type:'strong', breaker:'C20', cable:'BV 4mm²', limit:4000},
  {id:'nw1', name:'弱电网络回路', type:'weak', breaker:'—', cable:'网线 CAT6', limit:0},
];

const POWER_BY_CAT = {light:40, switch:5, socket:2000, sensor:3, camera:12, curtain:60, panel:15, network:10, media:100};

function uid(prefix){return prefix + Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-3);}

/* 演示户型：约 90㎡ 两室一厅，坐标单位米，原点左上角 */
function createDemoProject(){
  const p = {
    id: uid('pj_'), name:'阳光里 3栋 502', createdAt:Date.now(), updatedAt:Date.now(),
    wallW:8, wallH:6, image:null,
    walls:[
      {id:'w1', x1:0,y1:0,x2:8,y2:0, type:'bearing'},
      {id:'w2', x1:8,y1:0,x2:8,y2:6, type:'bearing'},
      {id:'w3', x1:8,y1:6,x2:0,y2:6, type:'bearing'},
      {id:'w4', x1:0,y1:6,x2:0,y2:0, type:'bearing'},
      {id:'w5', x1:5,y1:0,x2:5,y2:6, type:'wall'},
      {id:'w6', x1:0,y1:2.2,x2:5,y2:2.2, type:'wall'},
      {id:'w7', x1:2.2,y1:0,x2:2.2,y2:2.2, type:'wall'},
      {id:'w8', x1:5,y1:3.2,x2:8,y2:3.2, type:'wall'},
    ],
    obstacles:[
      {id:'o1', type:'column', x:4.75,y:2.05,w:.3,h:.3, label:'承重柱'},
      {id:'o2', type:'beam', x:5,y:1.42,w:3,h:.16, label:'横梁 200mm'},
    ],
    zones:[
      {id:'z1', name:'客厅', x:0,y:2.2,w:5,h:3.8, color:ZONE_COLORS[0]},
      {id:'z2', name:'厨房', x:0,y:0,w:2.2,h:2.2, color:ZONE_COLORS[1]},
      {id:'z3', name:'餐厅玄关', x:2.2,y:0,w:2.8,h:2.2, color:ZONE_COLORS[2]},
      {id:'z4', name:'主卧', x:5,y:0,w:3,h:3.2, color:ZONE_COLORS[3]},
      {id:'z5', name:'次卧', x:5,y:3.2,w:3,h:2.8, color:ZONE_COLORS[4]},
    ],
    devices:[], conduits:[], links:[],
    circuits: JSON.parse(JSON.stringify(DEFAULT_CIRCUITS)),
    panel:{x:2.62,y:2.05}, weakBox:{x:1.95,y:2.05},
    scenes: JSON.parse(JSON.stringify(SCENE_TEMPLATES)),
    notes:'', versions:[],
  };
  const zid=Object.fromEntries(p.zones.map(z=>[z.name,z.id]));
  const D = (type, zoneName, x,y, extra)=>{
    const d = {id:uid('d_'), type, zone:zid[zoneName]||null, x, y, rot:0, dims:null, circuitId:null, ...(extra||{})};
    p.devices.push(d); return d;
  };
  D('light_ceiling','客厅',2.5,4.1);
  D('light_down','客厅',1.4,3.1); D('light_down','客厅',3.6,3.1);
  D('light_strip','客厅',2.5,5.75);
  D('switch_smart','客厅',2.55,2.38,{label:'客厅主控'});
  D('socket_5','客厅',.35,5.6); D('socket_5','客厅',4.4,5.6);
  D('tv_port','客厅',.35,3.2); D('projector','客厅',3.6,5.7,{label:'投影吊装位'});
  D('panel','客厅',2.95,2.38); D('ap','客厅',2.5,3.05); D('gateway','客厅',2.2,2.38);
  D('sensor_body','客厅',4.55,2.6); D('curtain','客厅',2.5,5.78,{label:'客厅窗帘'});
  D('light_ceiling','厨房',1.1,1.1); D('socket_16','厨房',.25,.35,{label:'厨电专线'});
  D('sensor_leak','厨房',1.0,2.05);
  D('light_ceiling','餐厅玄关',3.6,1.1); D('socket_5','餐厅玄关',4.65,.35);
  D('camera','餐厅玄关',3.1,.2); D('doorbell','餐厅玄关',2.35,.12);
  D('light_ceiling','主卧',6.5,1.5); D('switch_smart','主卧',5.18,.35);
  D('socket_16','主卧',7.7,.35,{label:'空调专线'}); D('socket_5','主卧',7.7,2.9);
  D('sensor_door','主卧',5.05,3.05); D('sensor_temp','主卧',7.6,2.85); D('curtain','主卧',6.5,3.05);
  D('light_ceiling','次卧',6.5,4.7); D('switch_mech','次卧',5.18,3.45);
  D('socket_5','次卧',7.7,5.65); D('light_down','次卧',6.5,3.4);
  autoAssignCircuits(p);
  p.versions.push(makeVersion(p, '初始方案'));
  return p;
}

function makeVersion(p, name){
  return {id:uid('v_'), name, at:Date.now(),
    snapshot:JSON.stringify({devices:p.devices, conduits:p.conduits, links:p.links, zones:p.zones,
      circuits:p.circuits, panel:p.panel, weakBox:p.weakBox, scenes:p.scenes, notes:p.notes})};
}

function blankProject(name){
  const p = {
    id:uid('pj_'), name:name||'未命名方案', createdAt:Date.now(), updatedAt:Date.now(),
    wallW:8, wallH:6, image:null, walls:[], obstacles:[], zones:[], devices:[], conduits:[], links:[],
    circuits:JSON.parse(JSON.stringify(DEFAULT_CIRCUITS)),
    panel:{x:.6,y:.6}, weakBox:{x:.9,y:.6},
    scenes:JSON.parse(JSON.stringify(SCENE_TEMPLATES)), notes:'', versions:[],
  };
  p.versions.push(makeVersion(p,'空白方案'));
  return p;
}

/* 估算同时使用功率（W）：优先按设备型号，其次按类别 */
const POWER_BY_TYPE={
  light_ceiling:40, light_down:8, light_strip:15,
  switch_mech:2, switch_smart:5,
  socket_5:300, socket_16:3000, socket_usb:100,
  sensor_body:2, sensor_door:1, sensor_temp:1, sensor_leak:1,
  camera:12, doorbell:8, curtain:60, panel:15, gateway:10, ap:12,
  tv_port:80, projector:300,
};
