// 统计 / 校验 / 预算 / 交底说明
import { DEVICE_MAP, ROOM_MAP, DEFAULT_PRICES } from './catalog.js';
import { pointSegDist, round } from './util.js';

const GAP_LIMIT = 150;   // 强弱电最小净距(px)，按 1px≈2cm 约 300mm
const BRIDGE_SNAP = 120; // 距桥架吸附距离(px)

function M(p, px) { return px * (p.scale || 0.02); }
function polyLen(r) {
  let n = 0;
  for (let i = 0; i < r.length - 1; i++) n += Math.hypot(r[i + 1].x - r[i].x, r[i + 1].y - r[i].y);
  return n;
}
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function zoneName(p, id) { const z = p.zones.find(z => z.id === id); return z ? z.name : '未分区'; }
function circName(p, id) { const c = p.circuits.find(c => c.id === id); return c ? c.name : '未分配'; }
export function priceOf(p, key) { return p.prices[key] ?? DEFAULT_PRICES[key] ?? 0; }

// 返回点到折线最近点信息 {x,y,along(从起点沿线长度)}
function nearestOnPoly(route, pt) {
  let best = { x: route[0].x, y: route[0].y, along: 0, dist: Infinity };
  let acc = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let t = ((pt.x - a.x) * (b.x - a.x) + (pt.y - a.y) * (b.y - a.y)) / (l * l);
    t = Math.max(0, Math.min(1, t));
    const x = a.x + t * (b.x - a.x), y = a.y + t * (b.y - a.y);
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < best.dist) best = { x, y, along: acc + t * l, dist: d };
    acc += l;
  }
  return best;
}

// 单点到目标的走线长度(米)：两端贴近同一桥架则"引线+沿桥架"，否则曼哈顿估算；含每端0.3m施工余量
export function runLengthM(p, from, to, kind) {
  let bestPx = null;
  for (const c of p.conduits) {
    if (c.kind !== 'bridge') continue;
    const a = nearestOnPoly(c.route, from), b = nearestOnPoly(c.route, to);
    if (a.dist <= BRIDGE_SNAP && b.dist <= BRIDGE_SNAP) {
      const px = a.dist + b.dist + Math.abs(b.along - a.along);
      if (bestPx == null || px < bestPx) bestPx = px;
    }
  }
  if (bestPx == null) bestPx = manhattan(from, to);
  return M(p, bestPx) + 0.6;
}

// ---------- 汇总统计 ----------
export function summarize(p) {
  const dm = new Map(p.devices.map(d => [d.id, d]));
  const counts = {};
  let strongN = 0, weakN = 0, outletN = 0, lightN = 0, unzoned = 0, uncircuited = 0;
  for (const d of p.devices) {
    const def = DEVICE_MAP[d.type] || {};
    counts[d.type] = (counts[d.type] || 0) + (d.qty || 1);
    if (def.power === 'strong') strongN += d.qty || 1; else if (def.power === 'weak') weakN += d.qty || 1;
    if (d.type.startsWith('outlet_')) outletN += d.qty || 1;
    if (d.type.startsWith('light_')) lightN += d.qty || 1;
    if (!d.zoneId) unzoned++;
    if (def.power === 'strong' && !d.circuitId) uncircuited++;
  }

  // 弱电线缆：每个弱电位 → 最近网关/弱电箱
  const hubs = p.devices.filter(d => ['hub_gateway', 'rack_panel', 'ap_wifi'].includes(d.type));
  const weakTarget = hubs.sort((a, b) => 0)[0] || p.panel;
  let weakCat6 = 0, weakPower = 0;
  const weakRuns = [];
  for (const d of p.devices) {
    const def = DEVICE_MAP[d.type];
    if (!def || def.power !== 'weak' || ['hub_gateway', 'rack_panel', 'ap_wifi'].includes(d.type)) continue;
    const target = hubs.length ? hubs.reduce((a, b) => Math.hypot(a.x - d.x, a.y - d.y) < Math.hypot(b.x - d.x, b.y - d.y) ? a : b) : p.panel;
    const len = runLengthM(p, d, target, 'weak');
    weakCat6 += len;
    if (d.type.startsWith('cam_') || d.type.startsWith('ac') || d.type === 'fresh_air' || d.type === 'ap_wifi') weakPower += len;
    weakRuns.push({ id: d.id, name: d.name, to: target.name || '弱电箱', len: round(len, 1) });
  }
  // AP 互联回弱电箱
  for (const d of p.devices.filter(x => x.type === 'ap_wifi')) {
    weakCat6 += runLengthM(p, d, p.panel, 'weak');
  }

  // 强电：开关→灯 控制线 + 每个强电位→配电箱 BV 线
  let strong25 = 0, strong4 = 0, ctrlLine = 0;
  for (const l of p.links) {
    const a = dm.get(l.from), b = dm.get(l.to);
    if (a && b && l.kind === 'switch') ctrlLine += runLengthM(p, a, b, 'strong');
  }
  for (const d of p.devices) {
    const def = DEVICE_MAP[d.type];
    if (!def || def.power !== 'strong') continue;
    const len = runLengthM(p, d, p.panel, 'strong');
    if (def.kw >= 1.2 || d.type === 'outlet_16a' || d.type.startsWith('curtain_') === false && (d.type === 'ac_unit')) strong4 += len;
    else strong25 += len;
  }

  let conduitPx = 0, bridgePx = 0;
  p.conduits.forEach(c => {
    const l = polyLen(c.route);
    if (c.kind === 'bridge') bridgePx += l; else conduitPx += l;
  });
  const conduitM = M(p, conduitPx), bridgeM = M(p, bridgePx);

  return {
    totalPoints: p.devices.reduce((s, d) => s + (d.qty || 1), 0),
    deviceKinds: Object.keys(counts).length,
    strongN, weakN, outletN, lightN, unzoned, uncircuited,
    weakCat6: round(weakCat6, 1), weakPower: round(weakPower, 1),
    strong25: round(strong25, 1), strong4: round(strong4, 1), ctrlLine: round(ctrlLine, 1),
    conduitM: round(conduitM, 1), bridgeM: round(bridgeM, 1),
    counts, weakRuns,
  };
}

// ---------- 校验 ----------
export function validate(p) {
  const warns = [];
  const dm = new Map(p.devices.map(d => [d.id, d]));
  const S = summarize(p);

  if (!p.zones.length) warns.push({ level: 'warn', title: '尚未划分房间区域', fix: 'zones', msg: '先在第 2 步画出客厅、卧室等区域，设备才能自动归属房间。' });
  if (S.unzoned) warns.push({ level: 'warn', title: `${S.unzoned} 个点位不在任何区域内`, fix: 'zones', msg: '调整区域边界覆盖这些点位，或在右侧属性面板手动归属。' });
  if (!p.devices.some(d => /^switch_/.test(d.type)) && S.lightN) warns.push({ level: 'warn', title: '有灯具但没有开关', fix: 'layout', msg: '请在灯位附近放置智能开关，并在布线页一键生成回路。' });
  if (S.uncircuited) warns.push({ level: 'danger', title: `${S.uncircuited} 个强电位未分配配电箱回路`, fix: 'panel', msg: '进入配电箱页，把强电点位分配到对应空开回路。' });

  // 强弱电点位间距
  const strong = p.devices.filter(d => (DEVICE_MAP[d.type] || {}).power === 'strong');
  const weak = p.devices.filter(d => (DEVICE_MAP[d.type] || {}).power === 'weak');
  let near = 0;
  for (const w of weak) for (const st of strong) {
    if (Math.hypot(w.x - st.x, w.y - st.y) < GAP_LIMIT &&
        !(w.type.startsWith('switch_') || st.type.startsWith('switch_'))) { near++; break; }
  }
  if (near) warns.push({ level: 'warn', title: `${near} 处强弱电位距离过近`, fix: 'layout', msg: '强电插座与弱电面板/传感器建议保持 300mm 以上净距，避免干扰。' });

  // 强弱电线槽平行间距
  const cStrong = p.conduits.filter(c => c.kind === 'strong');
  const cWeak = p.conduits.filter(c => c.kind === 'weak');
  let gapBad = 0; const badNames = [];
  for (const ws of cWeak) for (const ss of cStrong) {
    for (let i = 0; i < ws.route.length - 1; i++) {
      for (let j = 0; j < ss.route.length - 1; j++) {
        if (polySegGap(ws.route[i], ws.route[i + 1], ss.route[j], ss.route[j + 1]) < GAP_LIMIT) {
          // 仅统计近似平行段
          if (segParallel(ws.route[i], ws.route[i + 1], ss.route[j], ss.route[j + 1])) {
            gapBad++; if (badNames.length < 3) badNames.push(`${ss.name || '强电管'}↔${ws.name || '弱电管'}`);
          }
        }
      }
    }
  }
  if (gapBad) warns.push({ level: 'danger', title: `${gapBad} 段强弱电线管平行间距不足 300mm`, fix: 'wiring', msg: '请调整走向或加屏蔽隔板：' + [...new Set(badNames)].join('、') });

  // 线管穿过承重结构
  for (const c of p.conduits) {
    for (const o of p.structures.filter(s => s.kind === 'bearing' || s.kind === 'column')) {
      const r = typeof o.x === 'number' ? o : null;
      if (!r) continue;
      for (let i = 0; i < c.route.length - 1; i++) {
        if (segRectHit(c.route[i], c.route[i + 1], o)) {
          warns.push({ level: 'danger', title: `${c.name || '线管'}穿越${o.kind === 'bearing' ? '承重墙' : '结构柱'}`, fix: 'wiring', msg: '承重墙/柱禁止横向开槽走管，请重新规划走向绕开。' });
          break;
        }
      }
    }
  }

  // 回路超载
  for (const c of p.circuits) {
    const members = p.devices.filter(d => d.circuitId === c.id);
    const load = members.reduce((s, d) => s + ((DEVICE_MAP[d.type] || {}).kw || 0) * (d.qty || 1), 0);
    const n = members.reduce((s, d) => s + (d.qty || 1), 0);
    if (c.kind !== 'main' && n > c.max) warns.push({ level: 'danger', title: `「${c.name}」回路点位 ${n} 个，超过建议 ${c.max} 个`, fix: 'panel', msg: '请拆分到其他回路，避免空开频繁跳闸。' });
    const amp = parseInt((c.breaker.match(/(\d+)A/) || [])[1] || '0', 10);
    if (amp && load * 1000 / 220 > amp * 0.8) warns.push({ level: 'warn', title: `「${c.name}」负载约 ${round(load, 1)}kW，接近空开容量`, fix: 'panel', msg: '建议核算功率后升级线径或空开。' });
  }

  // 未连接灯具
  const linked = new Set(p.links.filter(l => l.kind === 'switch').map(l => l.to));
  const orphanLights = p.devices.filter(d => d.type.startsWith('light_') && !linked.has(d.id)).length;
  if (orphanLights && p.devices.some(d => /^switch_/.test(d.type)))
    warns.push({ level: 'warn', title: `${orphanLights} 个灯具未接入任何开关回路`, fix: 'wiring', msg: '在布线页点击"自动生成开关回路"。' });

  if (!warns.length) warns.push({ level: 'ok', title: '未发现明显问题', msg: '仍建议由持证电工现场复核走向、管径与回路容量。' });
  return warns;
}

function segParallel(a, b, c, d) {
  const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: d.x - c.x, y: d.y - c.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
  if (!l1 || !l2) return false;
  return Math.abs(dot / (l1 * l2)) > 0.85;
}
function polySegGap(a, b, c, d) {
  return Math.min(pointSegDist(c.x, c.y, a, b), pointSegDist(d.x, d.y, a, b), pointSegDist(a.x, a.y, c, d), pointSegDist(b.x, b.y, c, d));
}
function segRectHit(a, b, r) {
  const x = Math.min(r.x, r.x + r.w), y = Math.min(r.y, r.y + r.h);
  const w = Math.abs(r.w), h = Math.abs(r.h);
  const corners = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  for (let i = 0; i < 4; i++) {
    if (segInt(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}
function segInt(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (!d) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ---------- 材料清单 ----------
export function buildBOM(p) {
  const S = summarize(p);
  const rows = [];
  for (const [type, n] of Object.entries(S.counts)) {
    const def = DEVICE_MAP[type] || { name: type };
    rows.push({ category: def.group || '设备', name: def.name, unit: '个', qty: n, price: priceOf(p, type), total: n * priceOf(p, type) });
  }
  const wireRows = [
    { name: '六类网线（弱电信号）', unit: '米', qty: S.weakCat6, key: 'wire_weak_cat6' },
    { name: 'RVV2×0.75 弱电设备电源线', unit: '米', qty: S.weakPower, key: 'wire_weak_power' },
    { name: 'BV 2.5mm² 铜芯线（照明/插座）', unit: '米', qty: S.strong25, key: 'wire_strong_25' },
    { name: 'BV 4mm² 铜芯线（大功率专线）', unit: '米', qty: S.strong4, key: 'wire_strong_4' },
    { name: 'PVC 阻燃线管', unit: '米', qty: Math.max(S.conduitM, round((S.strong25 + S.strong4 + S.weakCat6) / 3, 1)), key: 'conduit_pvc' },
    { name: '金属/弱电线槽桥架', unit: '米', qty: S.bridgeM, key: 'conduit_bridge' },
    { name: '暗盒/底盒', unit: '个', qty: S.totalPoints, key: 'junction_box' },
  ].filter(r => r.qty > 0);
  for (const r of wireRows) {
    const pr = priceOf(p, r.key);
    rows.push({ category: '线材辅材', name: r.name, unit: r.unit, qty: r.qty, price: pr, total: round(r.qty * pr, 1) });
  }
  // 人工
  const labor = S.totalPoints * priceOf(p, 'labor_point');
  rows.push({ category: '人工', name: '点位施工人工（开槽/布管/穿线/面板）', unit: '点位', qty: S.totalPoints, price: priceOf(p, 'labor_point'), total: labor });
  rows.sort((a, b) => a.category.localeCompare(b.category, 'zh') || b.total - a.total);
  const subtotal = round(rows.reduce((s, r) => s + r.total, 0), 1);
  return { rows, subtotal, S };
}

export function budget(p) {
  const { subtotal } = buildBOM(p);
  const design = round(subtotal * 0.05, 0);          // 设计调试费
  const contingency = round(subtotal * 0.08, 0);     // 不可预见
  const total = Math.round(subtotal + design + contingency);
  const area = p.area || 90;
  return { subtotal, design, contingency, total, perSqm: round(total / area, 0), area };
}

export function budgetCSV(p) {
  const { rows, subtotal } = buildBOM(p);
  const b = budget(p);
  const lines = [['分类', '名称', '单位', '数量', '单价(元)', '小计(元)'].join(',')];
  rows.forEach(r => lines.push([r.category, r.name, r.unit, r.qty, r.price, round(r.total, 1)].join(',')));
  lines.push(['', '设备及材料合计', '', '', '', subtotal].join(','));
  lines.push(['', '智能设计调试费(5%)', '', '', '', b.design].join(','));
  lines.push(['', '施工余量(8%)', '', '', '', b.contingency].join(','));
  lines.push(['', '预算总计', '', '', '', b.total].join(','));
  return '\ufeff' + lines.join('\n');
}

// ---------- 施工交底说明 ----------
export function briefing(p) {
  const S = summarize(p);
  const dm = new Map(p.devices.map(d => [d.id, d]));
  const L = [];
  L.push(`《${p.name}》全屋智能 · 电工施工交底说明`);
  L.push(`生成日期：${new Date().toLocaleDateString('zh-CN')}　建筑面积：约 ${p.area}㎡　比例：1px=${round((p.scale || 0.02) * 1000)}mm`);
  L.push('═'.repeat(38));
  L.push('一、工程概况');
  L.push(`· 房间区域：${p.zones.map(z => z.name).join('、') || '未划分'}`);
  L.push(`· 点位合计 ${S.totalPoints} 个（强电 ${S.strongN} / 弱电 ${S.weakN}），其中灯具 ${S.lightN}、插座 ${S.outletN}`);
  L.push(`· 配电箱 1 台（${p.circuits.length} 个回路），弱电箱/网关 ${p.devices.filter(d => d.type === 'hub_gateway' || d.type === 'rack_panel').length || 1} 处`);
  L.push('');
  L.push('二、配电箱回路分配');
  for (const c of p.circuits) {
    const members = p.devices.filter(d => d.circuitId === c.id);
    const load = round(members.reduce((s, d) => s + ((DEVICE_MAP[d.type] || {}).kw || 0), 0), 1);
    if (c.kind === 'main') { L.push(`· ${c.name}：${c.breaker}（进线总保护）`); continue; }
    const byZone = {};
    members.forEach(d => { const z = zoneName(p, d.zoneId); byZone[z] = (byZone[z] || 0) + 1; });
    const zt = Object.entries(byZone).map(([z, n]) => `${z}×${n}`).join('、') || '暂无点位';
    L.push(`· ${c.name}｜${c.breaker}｜点位 ${members.length}/${c.max}｜估算负载 ${load}kW｜${zt}`);
  }
  L.push('');
  L.push('三、开关控制回路');
  const swLinks = p.links.filter(l => l.kind === 'switch');
  if (!swLinks.length) L.push('· 暂无开关连线，请在布线页点击"自动生成开关回路"。');
  for (const lk of swLinks) {
    const sw = dm.get(lk.from), lt = dm.get(lk.to);
    if (sw && lt) L.push(`· ${sw.name}（${zoneName(p, sw.zoneId)}）→ 控制 ${lt.name}（${zoneName(p, lt.zoneId)}）`);
  }
  L.push('');
  L.push('四、弱电布线要求');
  L.push(`· 六类网线合计约 ${S.weakCat6} 米，弱电电源线约 ${S.weakPower} 米；单条网线长度 ${S.weakRuns.length ? '见明细，超长点建议就近增设 AP' : '—'}`);
  L.push('· 网线与强电线管平行净距≥300mm，交叉处≥100mm 并做 90°十字交叉，必要时包锡箔屏蔽。');
  L.push('· 所有弱电线汇聚至弱电箱，预留 300mm 检修余量；AP 点位采用 PoE/就近供电。');
  S.weakRuns.filter(r => r.len > 25).slice(0, 8).forEach(r => L.push(`  · 超长线路：${r.name} → ${r.to}，约 ${r.len}m`));
  L.push('');
  L.push('五、强电与线管');
  L.push(`· BV 2.5mm² 约 ${S.strong25} 米，BV 4mm² 约 ${S.strong4} 米，开关控制线约 ${S.ctrlLine} 米；PVC 线管约 ${S.conduitM} 米，桥架约 ${S.bridgeM} 米。`);
  L.push('· 开关控制线建议 BV1.5，插座/照明 2.5mm²，空调、厨房大功率专线 4mm² 及以上，具体以现场核算为准。');
  L.push('· 承重墙、梁、柱严禁横向切割开槽；线管遇结构绕梁底/门洞敷设，弯管半径≥6D。');
  L.push('· 同一回路火线、零线、地线同管敷设；强弱电严禁同管。');
  L.push('');
  L.push('六、智能场景预设');
  (p.scenes || []).filter(s => s.enabled).forEach(s => L.push(`· ${s.name}：${s.desc}`));
  L.push('');
  const warns = validate(p).filter(w => w.level !== 'ok');
  L.push('七、施工前需复核事项');
  if (!warns.length) L.push('· 系统校验未发现明显问题，仍需电工现场复核管径、回路容量与结构安全。');
  warns.forEach(w => L.push(`· [${w.level === 'danger' ? '必须整改' : '建议确认'}] ${w.title}`));
  L.push('');
  L.push('交底人签字：____________　电工签字：____________　日期：____________');
  return L.join('\n');
}
