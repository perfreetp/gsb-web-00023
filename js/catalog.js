// 设备库：power = strong 强电 / weak 弱电 / passive 无源
export const DEVICE_CATALOG = [
  {
    group: '照明灯具', icon: '💡', color: '#f59e0b',
    items: [
      { type: 'light_main', name: '主灯/吸顶灯', power: 'strong', kw: 0.04, qty: 1 },
      { type: 'light_down', name: '筒灯/射灯', power: 'strong', kw: 0.01, qty: 1 },
      { type: 'light_strip', name: '灯带', power: 'weak', kw: 0.02, qty: 1 },
      { type: 'light_wall', name: '壁灯/床头灯', power: 'strong', kw: 0.01, qty: 1 },
    ],
  },
  {
    group: '开关面板', icon: '🎚️', color: '#64748b',
    items: [
      { type: 'switch_smart', name: '智能开关', power: 'strong', kw: 0, qty: 1, gang: 1 },
      { type: 'switch_scene', name: '情景面板', power: 'weak', kw: 0, qty: 1 },
      { type: 'switch_dimmer', name: '调光面板', power: 'weak', kw: 0, qty: 1 },
      { type: 'switch_dumb', name: '普通机械开关', power: 'strong', kw: 0, qty: 1, gang: 1 },
    ],
  },
  {
    group: '插座', icon: '🔌', color: '#f97316',
    items: [
      { type: 'outlet_10a', name: '五孔插座 10A', power: 'strong', kw: 0, qty: 1 },
      { type: 'outlet_16a', name: '空调/热水器插座 16A', power: 'strong', kw: 0, qty: 1 },
      { type: 'outlet_smart', name: '智能/计量插座', power: 'weak', kw: 0, qty: 1 },
      { type: 'outlet_ground', name: '地插', power: 'strong', kw: 0, qty: 1 },
    ],
  },
  {
    group: '传感器', icon: '📡', color: '#06b6d4',
    items: [
      { type: 'sensor_motion', name: '人体存在传感器', power: 'weak', kw: 0, qty: 1 },
      { type: 'sensor_door', name: '门窗磁传感器', power: 'weak', kw: 0, qty: 1 },
      { type: 'sensor_temp', name: '温湿度传感器', power: 'weak', kw: 0, qty: 1 },
      { type: 'sensor_leak', name: '水浸/燃气传感器', power: 'weak', kw: 0, qty: 1 },
      { type: 'sensor_light', name: '光照传感器', power: 'weak', kw: 0, qty: 1 },
    ],
  },
  {
    group: '安防摄像', icon: '📷', color: '#8b5cf6',
    items: [
      { type: 'cam_indoor', name: '室内摄像头', power: 'weak', kw: 0.01, qty: 1 },
      { type: 'cam_doorbell', name: '可视门铃', power: 'weak', kw: 0.01, qty: 1 },
      { type: 'cam_lock', name: '智能门锁', power: 'weak', kw: 0.01, qty: 1 },
      { type: 'alarm_siren', name: '声光报警器', power: 'weak', kw: 0.02, qty: 1 },
    ],
  },
  {
    group: '窗帘遮阳', icon: '🪟', color: '#0ea5e9',
    items: [
      { type: 'curtain_motor', name: '窗帘电机', power: 'strong', kw: 0.06, qty: 1 },
      { type: 'curtain_track', name: '梦幻帘/百叶电机', power: 'strong', kw: 0.05, qty: 1 },
    ],
  },
  {
    group: '智能中枢', icon: '🧠', color: '#2f6bff',
    items: [
      { type: 'hub_gateway', name: '智能网关/中控屏', power: 'weak', kw: 0.01, qty: 1 },
      { type: 'ap_wifi', name: '无线AP/路由节点', power: 'weak', kw: 0.01, qty: 1 },
      { type: 'rack_panel', name: '弱电箱/配线架', power: 'weak', kw: 0, qty: 1 },
    ],
  },
  {
    group: '环境电器', icon: '❄️', color: '#10b981',
    items: [
      { type: 'ac_unit', name: '空调内机', power: 'strong', kw: 1.5, qty: 1 },
      { type: 'fresh_air', name: '新风面板', power: 'weak', kw: 0.02, qty: 1 },
      { type: 'thermostat', name: '地暖温控面板', power: 'weak', kw: 0, qty: 1 },
    ],
  },
];

const UNICODE_ICON = {
  light_main: '💡', light_down: '🔦', light_strip: '🌈', light_wall: '🪔',
  switch_smart: '🎚️', switch_scene: '🎛️', switch_dimmer: '🌗', switch_dumb: '🔘',
  outlet_10a: '🔌', outlet_16a: '🔌', outlet_smart: '🔋', outlet_ground: '⏺️',
  sensor_motion: '📡', sensor_door: '🚪', sensor_temp: '🌡️', sensor_leak: '💧', sensor_light: '☀️',
  cam_indoor: '📷', cam_doorbell: '🔔', cam_lock: '🔐', alarm_siren: '🚨',
  curtain_motor: '🪟', curtain_track: '🏳️',
  hub_gateway: '🧠', ap_wifi: '📶', rack_panel: '🗄️',
  ac_unit: '❄️', fresh_air: '🌬️', thermostat: '🔥',
};
export const DEVICE_MAP = Object.fromEntries(
  DEVICE_CATALOG.flatMap(g => g.items.map(i => [i.type, { ...i, icon: i.icon || UNICODE_ICON[i.type] || g.icon, group: g.group, groupIcon: g.icon, color: g.color }]))
);

export const POWER_LABEL = { strong: '强电', weak: '弱电', passive: '无源' };

// 房间/区域模板
export const ROOM_TYPES = [
  { type: 'living', name: '客厅', color: '#93c5fd', icon: '🛋️' },
  { type: 'bedroom', name: '卧室', color: '#c4b5fd', icon: '🛏️' },
  { type: 'kitchen', name: '厨房', color: '#fdba74', icon: '🍳' },
  { type: 'bathroom', name: '卫生间', color: '#67e8f9', icon: '🚿' },
  { type: 'balcony', name: '阳台', color: '#86efac', icon: '🌿' },
  { type: 'study', name: '书房', color: '#93c5fd', icon: '📚' },
  { type: 'dining', name: '餐厅', color: '#fcd34d', icon: '🍽️' },
  { type: 'corridor', name: '玄关/走廊', color: '#d1d5db', icon: '🚪' },
  { type: 'other', name: '其他', color: '#cbd5e1', icon: '⬚' },
];
export const ROOM_MAP = Object.fromEntries(ROOM_TYPES.map(r => [r.type, r]));

// 场景模板（match 描述设备匹配规则，由 state.applyScene 解析）
export const SCENE_TEMPLATES = [
  {
    id: 'tpl_home', name: '回家模式', icon: '🏠',
    desc: '开门亮灯、窗帘打开、空调启动、撤防',
    acts: [
      { match: 'zone:corridor,light_*', cmd: 'on' },
      { match: 'zone:living,light_*', cmd: 'on', level: 80 },
      { match: 'curtain_*', cmd: 'open' },
      { match: 'ac_*', cmd: 'cool', temp: 26 },
      { match: 'cam_*', cmd: 'privacy' },
    ],
  },
  {
    id: 'tpl_away', name: '离家模式', icon: '🚪',
    desc: '全屋关灯断电、窗帘关闭、安防布防',
    acts: [
      { match: 'light_*', cmd: 'off' },
      { match: 'outlet_smart', cmd: 'off' },
      { match: 'curtain_*', cmd: 'close' },
      { match: 'ac_*', cmd: 'off' },
      { match: 'cam_*', cmd: 'arm' },
      { match: 'alarm_*', cmd: 'arm' },
    ],
  },
  {
    id: 'tpl_movie', name: '观影模式', icon: '🎬',
    desc: '客厅调暗、灯带氛围、窗帘合上',
    acts: [
      { match: 'zone:living,light_main', cmd: 'off' },
      { match: 'zone:living,light_strip', cmd: 'on', level: 20 },
      { match: 'zone:living,light_down', cmd: 'off' },
      { match: 'zone:living,curtain_*', cmd: 'close' },
      { match: 'zone:living,ac_*', cmd: 'cool', temp: 25 },
    ],
  },
  {
    id: 'tpl_sleep', name: '睡眠模式', icon: '🌙',
    desc: '卧室灯渐灭、全屋关灯、夜灯待命',
    acts: [
      { match: 'zone:bedroom,light_*', cmd: 'off' },
      { match: 'light_*', cmd: 'off' },
      { match: 'zone:bedroom,curtain_*', cmd: 'close' },
      { match: 'zone:bedroom,ac_*', cmd: 'sleep', temp: 27 },
      { match: 'alarm_*', cmd: 'arm' },
    ],
  },
  {
    id: 'tpl_getup', name: '起床模式', icon: '☀️',
    desc: '卧室渐亮、窗帘缓开、联动暖光',
    acts: [
      { match: 'zone:bedroom,light_*', cmd: 'on', level: 60 },
      { match: 'zone:bedroom,curtain_*', cmd: 'open' },
    ],
  },
  {
    id: 'tpl_dining', name: '用餐模式', icon: '🍽️',
    desc: '餐厅主灯高亮、客厅降到氛围亮度',
    acts: [
      { match: 'zone:dining,light_*', cmd: 'on', level: 100 },
      { match: 'zone:living,light_*', cmd: 'on', level: 30 },
    ],
  },
];

// 材料价格库（元），可在预算页编辑；wire 单位为米
export const DEFAULT_PRICES = {
  light_main: 260, light_down: 45, light_strip: 38, light_wall: 120,
  switch_smart: 180, switch_scene: 220, switch_dimmer: 260, switch_dumb: 25,
  outlet_10a: 28, outlet_16a: 42, outlet_smart: 95, outlet_ground: 88,
  sensor_motion: 160, sensor_door: 70, sensor_temp: 80, sensor_leak: 110, sensor_light: 90,
  cam_indoor: 260, cam_doorbell: 450, cam_lock: 1500, alarm_siren: 120,
  curtain_motor: 680, curtain_track: 900,
  hub_gateway: 800, ap_wifi: 350, rack_panel: 260,
  ac_unit: 0, fresh_air: 320, thermostat: 180,
  // 线材/辅材（按米/个）
  wire_weak_cat6: 3.2,      // 网线
  wire_weak_power: 2.4,     // 弱电设备 RVV 2×0.75
  wire_strong_25: 3.6,      // BV 2.5
  wire_strong_4: 5.4,       // BV 4
  conduit_pvc: 4.5,         // PVC 线管
  conduit_bridge: 28,       // 桥架（米）
  junction_box: 6,          // 底盒/暗盒
  labor_point: 45,          // 单点位人工
};

// 配电箱默认回路
export const DEFAULT_CIRCUITS = [
  { name: '总开', breaker: '2P 40A 漏保', max: 8, kind: 'main' },
  { name: '照明回路', breaker: '1P 16A', max: 25, kind: 'light' },
  { name: '普通插座', breaker: '1P+N 20A 漏保', max: 12, kind: 'outlet' },
  { name: '厨房插座', breaker: '1P+N 25A 漏保', max: 8, kind: 'kitchen' },
  { name: '卫生间回路', breaker: '1P+N 20A 漏保', max: 6, kind: 'bath' },
  { name: '空调专线', breaker: '2P 25A', max: 3, kind: 'ac' },
];
