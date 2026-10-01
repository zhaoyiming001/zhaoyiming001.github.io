/* 赵云与阿斗 · 核心规则（不依赖 DOM，浏览器与 Node 均可运行） */
(function (root) {
  'use strict';

  var COLS = 7, ROWS = 10;
  var TIER_MULT = [1, 2.2, 4.8, 10, 22];

  // ---------- 兵种（字牌即兵种：同字同级合并升级） ----------
  // dtype: phys 近战 / arrow 箭矢 / fire 火 / siege 攻城
  var UNITS = {
    dao: { ch: '刀', name: '刀兵', glyph: '斩', range: 1.25, dmg: 16, cd: 0.7, dtype: 'phys', desc: '近身劈「斩」，单体伤害最高' },
    qiang: { ch: '枪', name: '枪兵', glyph: '刺', range: 2, dmg: 11, cd: 0.9, line: 2.1, dtype: 'phys', desc: '「刺」字贯穿一线敌人' },
    gong: { ch: '弓', name: '弓兵', glyph: '矢', range: 3.2, dmg: 8, cd: 0.6, proj: 'arrow', dtype: 'arrow', desc: '「矢」雨远射，射程最远' },
    qi: { ch: '骑', name: '骑兵', glyph: '冲', range: 1.6, dmg: 10, cd: 1.0, splash: 0.9, dtype: 'phys', desc: '「冲」阵践踏，范围伤害' },
    dun: { ch: '盾', name: '盾兵', glyph: '守', range: 1.45, dmg: 5, cd: 1.2, slow: 0.3, dtype: 'phys', pulse: true, desc: '「守」字涟漪：减速周围敌军并造成少量伤害' },
    nu: { ch: '弩', name: '弩兵', glyph: '弩', range: 3, dmg: 20, cd: 1.5, line: 3.6, shred: 0.15, dtype: 'arrow', desc: '重「弩」贯穿直线，破甲（受伤 +15%）' },
    gu: { ch: '鼓', name: '鼓手', glyph: '咚', range: 1.5, dmg: 0, cd: 1.6, haste: 0.2, desc: '战鼓「咚」：身边友军攻速 +20%（每级 +5%）' },
    huo: { ch: '火', name: '火弓兵', glyph: '火', range: 3.2, dmg: 8, cd: 0.65, proj: 'arrow', burn: 0.6, dtype: 'fire', desc: '「火」矢点燃敌军，持续灼烧' },
    tou: { ch: '石', name: '投石车', glyph: '石', range: 4.2, dmg: 46, cd: 2.6, proj: 'lob', splash: 1.1, dtype: 'siege', desc: '抛射巨「石」，落地「轰」然一片' },
    lian: { ch: '连', name: '连弩兵', glyph: '箭', range: 3, dmg: 8, cd: 0.8, proj: 'arrow', multi: 3, shred: 0.1, dtype: 'arrow', desc: '诸葛连弩，一次三「箭」，破甲' }
  };
  var KINDS = ['dao', 'qiang', 'gong', 'qi', 'dun', 'nu', 'gu', 'huo', 'tou', 'lian'];

  // ---------- 武将 ----------
  var GENERALS = {
    liubei: { name: '刘备', chars: ['刘', '备'], flag: '刘', glyph: '仁', skill: '仁德', dmg: 30, cd: 1.0, range: 2.5, skillCd: 15, aura: 'all', atk: 'glyph',
      desc: '每 15 秒「仁」为阿斗回复 1 心（满血改赏馒头）；全军伤害 +10%' },
    guanyu: { name: '关羽', chars: ['关', '羽'], flag: '关', glyph: '斩', skill: '青龙偃月', dmg: 90, cd: 1.2, range: 1.5, splash: 1.2, skillCd: 9, aura: ['dao'], atk: 'slash',
      desc: '巨型月牙「斩」横扫周身；身边刀兵 +35%' },
    zhangfei: { name: '张飞', chars: ['张', '飞'], flag: '张', glyph: '喝', skill: '当阳怒喝', dmg: 60, cd: 1.0, range: 1.6, line: 1.8, skillCd: 10, aura: ['qiang'], atk: 'line',
      desc: '「喝」声震晕 2.5 格内敌人；身边枪兵 +35%' },
    zhaoyun: { name: '赵云', chars: ['赵', '云'], flag: '赵', glyph: '龙', skill: '七进七出', dmg: 40, cd: 0.35, range: 2, line: 2.1, skillCd: 8, aura: ['qi'], atk: 'line',
      desc: '「龙」沿路冲阵，重创七名敌人；身边骑兵 +35%' },
    machao: { name: '马超', chars: ['马', '超'], flag: '马', glyph: '冲', skill: '西凉铁骑', dmg: 55, cd: 0.8, range: 1.8, splash: 0.8, skillCd: 9, aura: ['qi'], atk: 'slash',
      desc: '「冲」字贯穿一整条战线；身边骑兵 +35%' },
    huangzhong: { name: '黄忠', chars: ['黄', '忠'], flag: '黄', glyph: '射', skill: '百步穿杨', dmg: 120, cd: 1.4, range: 5, proj: 'arrow', dtype: 'arrow', skillCd: 7, aura: ['gong', 'huo'], atk: 'proj',
      desc: '「射」狙杀血量最高之敌（6 倍）；身边弓兵 +35%' },
    kongming: { name: '孔明', chars: ['孔', '明'], flag: '孔', glyph: '火', skill: '借东风', dmg: 50, cd: 1.1, range: 3, proj: 'glyph', dtype: 'fire', skillCd: 12, aura: ['nu', 'lian'], atk: 'proj',
      desc: '「风」起「火」攻，烧尽 3.5 格内敌军；身边弩兵 +35%' },
    pangtong: { name: '庞统', chars: ['庞', '统'], flag: '庞', glyph: '连', skill: '连环计', dmg: 45, cd: 1.0, range: 2.5, proj: 'glyph', skillCd: 12, aura: ['tou'], atk: 'proj',
      desc: '「连」锁六敌，伤害互相传导；身边投石车 +35%' },
    weiyan: { name: '魏延', chars: ['魏', '延'], flag: '魏', glyph: '破', skill: '破阵', dmg: 70, cd: 0.9, range: 1.5, skillCd: 10, aura: ['dun', 'gu'], atk: 'slash',
      desc: '「破」甲：周围敌人受伤 +40%；身边盾兵 +35%' },
    jiangwei: { name: '姜维', chars: ['姜', '维'], flag: '姜', glyph: '伏', skill: '伏兵四起', dmg: 60, cd: 0.8, range: 2, line: 2.1, skillCd: 9, aura: ['qiang'], atk: 'line',
      desc: '「伏」兵突起，重创敌群并定身；身边枪兵 +35%' },
    guanping: { name: '关平', chars: ['关', '平'], flag: '关', glyph: '援', skill: '驰援', dmg: 50, cd: 0.9, range: 1.4, skillCd: 10, aura: ['dao'], atk: 'slash',
      desc: '「援」：身边友军攻速 +60%（4 秒）；身边刀兵 +35%' }
  };
  var GEN_KEYS = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong', 'kongming', 'pangtong', 'weiyan', 'jiangwei', 'guanping'];
  // 名字字牌配方（不分先后）
  var NAME_RECIPES = [
    ['刘', '备', 'liubei'], ['关', '羽', 'guanyu'], ['张', '飞', 'zhangfei'], ['赵', '云', 'zhaoyun'], ['马', '超', 'machao'],
    ['黄', '忠', 'huangzhong'], ['孔', '明', 'kongming'], ['魏', '延', 'weiyan'], ['姜', '维', 'jiangwei'], ['庞', '统', 'pangtong'], ['关', '平', 'guanping']
  ];
  var SYNERGIES = {
    taoyuan: { name: '桃园结义', gens: ['liubei', 'guanyu', 'zhangfei'], need: 3, desc: '刘备 关羽 张飞 同在：全军伤害 +20%' },
    wuhu: { name: '五虎上将', gens: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'], need: 3, desc: '五虎任意 3 人：武将技能冷却 −20%；5 人齐聚 −40%' },
    wolong: { name: '卧龙凤雏', gens: ['kongming', 'pangtong'], need: 2, desc: '孔明 庞统：武将技能伤害 ×1.5' },
    beifa: { name: '北伐先锋', gens: ['weiyan', 'jiangwei'], need: 2, desc: '魏延 姜维：敌军移速 −12%，武将伤害 +25%' },
    fuzi: { name: '虎父无犬子', gens: ['guanyu', 'guanping'], need: 2, desc: '关羽 关平：刀兵伤害 +30%' }
  };
  var SYN_KEYS = ['taoyuan', 'wuhu', 'wolong', 'beifa', 'fuzi'];

  // ---------- 敌军 ----------
  var ENEMIES = {
    zu: { ch: '卒', name: '步卒', hp: 40, spd: 1.0, reward: 2, r: 0.31 },
    qi: { ch: '骑', name: '骑兵', hp: 30, spd: 1.8, reward: 2, r: 0.31 },
    dun: { ch: '盾', name: '盾卒', hp: 90, spd: 0.75, reward: 3, r: 0.33, res: { arrow: 0.4 } },
    nu: { ch: '弩', name: '弩手', hp: 50, spd: 1.1, reward: 2, r: 0.31 },
    jia: { ch: '甲', name: '重甲', hp: 130, spd: 0.7, reward: 4, r: 0.35, res: { phys: 0.3, arrow: 0.2 } },
    teng: { ch: '藤', name: '藤甲兵', hp: 80, spd: 0.9, reward: 3, r: 0.33, res: { phys: 0.5, arrow: 0.5, siege: 0.3, fire: -1.5 } },
    xiang: { ch: '象', name: '象兵', hp: 320, spd: 0.5, reward: 8, r: 0.42, leak: 2, stunRes: 0.7 },
    chuan: { ch: '船', name: '战船', hp: 70, spd: 0.9, reward: 3, r: 0.36, res: { fire: -0.5 } }
  };
  var FACTIONS = {
    huangjin: { name: '黄巾军', badge: '贼', zu: '贼', color: '#b08428', dark: '#4a3410', light: '#e0b860' },
    dong: { name: '董卓军', badge: '董', color: '#8a2222', dark: '#360b0b', light: '#d98a7a' },
    wei: { name: '曹魏', badge: '魏', color: '#3a5578', dark: '#141c28', light: '#9fb3cc' },
    wu: { name: '东吴', badge: '吴', color: '#a83a24', dark: '#45130b', light: '#f0a080', res: { fire: 0.5 } },
    man: { name: '南蛮', badge: '蛮', color: '#2f8a6a', dark: '#1c2c12', light: '#a8c890' }
  };

  // ---------- 战役关卡 ----------
  // path: 起始列 + 走向（D 下 / L 左 / R 右 / U 上），终点为阿斗
  var LEVELS = [
    { name: '黄巾之乱', era: '中平元年 · 涿郡', blurb: '黄巾蜂起，天下大乱。刘关张桃园结义，初试锋芒。', faction: 'huangjin', terrain: 'plain',
      path: [1, 'D1 R4 D2 L4 D2 R4 D2 L4 D1 R2 D1'], waves: 10, hp: 1.2, growth: 1.22, start: 70,
      mix: { zu: [1, 1], qi: [0, 0.25, 4] },
      boss: { name: '张角', ch: '角', hpMul: 13.0, spd: 0.55, summon: { every: 6, n: 2 } },
      twist: '张角作法，不断召唤黄巾援兵', gift: [],
      unlock: { units: ['dao', 'qiang', 'gong'], gens: ['liubei', 'guanyu', 'zhangfei'] } },
    { name: '虎牢关', era: '初平元年 · 汜水', blurb: '十八路诸侯讨董，吕布独守虎牢，三英战吕布。', faction: 'dong', terrain: 'pass',
      path: [5, 'D1 L4 D3 R4 D3 L2 D2'], blocked: [[0, 2], [0, 3], [6, 5], [6, 6], [6, 0]], waves: 10, hp: 1.0, growth: 1.22, start: 80,
      mix: { zu: [1, 0.7], qi: [0.15, 0.35], dun: [0, 0.25, 3] },
      boss: { name: '吕布', ch: '布', hpMul: 13.4, spd: 0.55, charge: { every: 7, mult: 3, dur: 1.4 } },
      twist: '吕布每隔数秒策赤兔冲锋', gift: ['u:qi'],
      unlock: { units: ['qi', 'dun'], gens: [] } },
    { name: '博望坡', era: '建安七年 · 新野', blurb: '孔明初出茅庐，火烧博望，夏侯惇大败。', faction: 'wei', terrain: 'forest',
      path: [0, 'D3 R2 U2 R2 D4 R2 D2 L3 D2'], waves: 12, hp: 0.85, growth: 1.22, start: 80, fireMul: 1.5,
      mix: { zu: [1, 0.6], qi: [0.1, 0.25], dun: [0.1, 0.3, 3] },
      boss: { name: '夏侯惇', ch: '惇', hpMul: 13.8, spd: 0.6, rage: true },
      twist: '林深草密，火攻伤害 +50%', gift: ['u:huo'],
      unlock: { units: ['huo', 'gu'], gens: [] } },
    { name: '长坂坡', era: '建安十三年 · 当阳', blurb: '曹军虎豹骑追至，赵云单骑救主，张飞据水断桥。', faction: 'wei', terrain: 'bridge',
      path: [3, 'D1 L2 D2 R4 D2 L4 D2 R2 D2'], blocked: [[0, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]], bridge: [1, 6], waves: 12, hp: 1.7, growth: 1.22, start: 90,
      mix: { zu: [1, 0.5], qi: [0.3, 0.6], dun: [0.05, 0.2, 4] },
      mid: { wave: 6, name: '曹纯', ch: '纯', hpMul: 12, spd: 0.85 },
      boss: { name: '张郃', ch: '郃', hpMul: 14.2, spd: 0.7, swarm: { every: 5, n: 3 } },
      twist: '虎豹骑轻骑成群冲锋；长坂桥下河水阻隔', gift: ['赵', '云'],
      unlock: { units: ['nu'], gens: ['zhaoyun'] } },
    { name: '赤壁', era: '建安十三年 · 江夏', blurb: '孙刘联军，借东风、施连环，火烧曹军八十万战船。', faction: 'wei', terrain: 'river',
      path: [6, 'D2 L5 D3 R5 D3 L3 D1'], waves: 12, hp: 2.8, growth: 1.22, start: 100, fireMul: 2,
      mix: { chuan: [1, 1], zu: [0.2, 0.1], dun: [0.1, 0.3, 4] },
      boss: { name: '曹操', ch: '操', hpMul: 10, spd: 0.5, summon: { every: 9, n: 2, type: 'chuan' } },
      twist: '曹军乘战船顺江而下；火攻伤害 ×2', gift: ['孔', '明'],
      unlock: { units: ['lian'], gens: ['kongming', 'pangtong'] } },
    { name: '定军山', era: '建安二十四年 · 汉中', blurb: '黄忠老当益壮，据山居高临下，阵斩夏侯渊。', faction: 'wei', terrain: 'mountain',
      path: [0, 'D2 R6 D2 L6 D2 R6 D2 L3 D1'], waves: 14, hp: 2.5, growth: 1.22, start: 100, highGround: 2,
      mix: { zu: [1, 0.5], qi: [0.2, 0.3], dun: [0.15, 0.3], jia: [0, 0.25, 6] },
      mid: { wave: 7, name: '张郃', ch: '郃', hpMul: 14, spd: 0.7 },
      boss: { name: '夏侯渊', ch: '渊', hpMul: 15.0, spd: 0.85 },
      twist: '前两行为高地，射程 +0.5；敌将夏侯渊来去如风', gift: ['黄', '忠'],
      unlock: { units: ['tou'], gens: ['huangzhong'] } },
    { name: '樊城', era: '建安二十四年 · 襄樊', blurb: '秋雨连绵，汉水暴涨，关羽水淹七军，威震华夏。', faction: 'wei', terrain: 'flood',
      path: [2, 'D3 R3 D3 L4 D2 R2 D1'], blocked: [[0, 0], [0, 1], [6, 8], [6, 9], [6, 7]], waves: 12, hp: 2.2, growth: 1.22, start: 110, fireMul: 0.6, flood: { every: 16, dur: 3.5, slow: 0.55 },
      mix: { zu: [1, 0.5], dun: [0.2, 0.35], jia: [0.1, 0.35], qi: [0.1, 0.2] },
      boss: { name: '庞德', ch: '德', hpMul: 15.4, spd: 0.55, dmgRes: 0.3 },
      twist: '大雨：火攻 −40%；每隔一阵洪水漫过，敌军减速', gift: ['马', '超'],
      unlock: { gens: ['machao', 'guanping'] } },
    { name: '夷陵', era: '章武二年 · 夷陵', blurb: '先主伐吴，连营七百里，陆逊火烧连营。', faction: 'wu', terrain: 'camp',
      path: [4, 'D1 R2 D2 L5 D2 R5 D2 L3 D2'], waves: 14, hp: 2.85, growth: 1.22, start: 120,
      mix: { zu: [1, 0.5], nu: [0.2, 0.4], dun: [0.1, 0.3], qi: [0.1, 0.25] },
      mid: { wave: 7, name: '朱然', ch: '然', hpMul: 14, spd: 0.65 },
      boss: { name: '陆逊', ch: '逊', hpMul: 15.8, spd: 0.55, burnUnits: { every: 8, range: 2.2, dur: 3 } },
      twist: '吴军不惧火攻（火伤 −50%）；陆逊放火，烧得身边守军攻速减半', gift: ['魏', '延'],
      unlock: { gens: ['weiyan'] } },
    { name: '南中', era: '建兴三年 · 泸水', blurb: '丞相南征，五月渡泸，七擒孟获，攻心为上。', faction: 'man', terrain: 'jungle',
      path: [1, 'D4 R2 U2 R2 D5 L4 D1 R2 D1'], waves: 14, hp: 2.3, growth: 1.22, start: 120,
      mix: { zu: [1, 0.4], teng: [0.3, 0.6], xiang: [0, 0.15, 4], qi: [0.1, 0.2] },
      mid: { wave: 7, name: '兀突骨', ch: '骨', hpMul: 16, spd: 0.5 },
      boss: { name: '孟获', ch: '获', hpMul: 16.2, spd: 0.55, revive: 0.6 },
      twist: '藤甲刀枪不入却怕火；象兵皮糙肉厚；孟获被擒仍不服', gift: ['姜', '维'],
      unlock: { gens: ['jiangwei'] } },
    { name: '五丈原', era: '建兴十二年 · 渭南', blurb: '六出祁山，星落秋风五丈原。司马懿坚守不出。', faction: 'wei', terrain: 'plateau',
      path: [6, 'D1 L5 D2 R5 D2 L5 D2 R5 D1 L3 D1'], waves: 15, hp: 3.4, growth: 1.22, start: 130,
      mix: { zu: [1, 0.4], qi: [0.15, 0.3], dun: [0.15, 0.3], jia: [0.05, 0.35], nu: [0.1, 0.2] },
      mid: { wave: 8, name: '郭淮', ch: '淮', hpMul: 16, spd: 0.65 },
      boss: { name: '司马懿', ch: '懿', hpMul: 16.6, spd: 0.5, shield: { every: 9, frac: 0.12 } },
      twist: '司马懿坚守：周期性张开护盾', gift: ['刘', '备'],
      unlock: { gens: [] } }
  ];

  var CFG = {
    maxHp: 10,
    costBase: 10, costStep: 2, costCap: 80,
    rewardGrowth: 0.15, waveBonus: 10, waveBonusGrowth: 2,
    breakTime: 7, prepTime: 30, earlyBonusPerSec: 2,
    genGrowth: 2.4,
    weights: { name: 11, shovel: 6 },
    namePity: 10, pieceFocus: 0.7,
    auraBonus: 0.35, auraAll: 0.1, auraRange: 1.5,
    arrowSpeed: 10, lineSpeed: 11
  };

  // ---------- 工具 ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function clone(o) { return o ? JSON.parse(JSON.stringify(o)) : o; }

  // 解析路径
  function buildPath(spec) {
    var c = spec[0], r = 0, cells = [[c, r]];
    spec[1].split(' ').forEach(function (m) {
      var d = m[0], n = +m.slice(1);
      for (var i = 0; i < n; i++) {
        if (d === 'D') r++; else if (d === 'U') r--; else if (d === 'L') c--; else c++;
        cells.push([c, r]);
      }
    });
    var seen = {};
    cells.forEach(function (p) {
      var k = p[0] + ',' + p[1];
      if (seen[k] || p[0] < 0 || p[0] >= COLS || p[1] < 0 || p[1] >= ROWS) throw new Error('bad path ' + spec[1]);
      seen[k] = 1;
    });
    var pts = [[cells[0][0] + 0.5, -0.7]];
    cells.forEach(function (p) { pts.push([p[0] + 0.5, p[1] + 0.5]); });
    var seg = [], len = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], l = dist(a[0], a[1], b[0], b[1]);
      seg.push({ x: a[0], y: a[1], dx: (b[0] - a[0]) / l, dy: (b[1] - a[1]) / l, len: l, start: len });
      len += l;
    }
    return { cells: cells, set: seen, pts: pts, seg: seg, len: len, end: cells[cells.length - 1] };
  }
  function posAt(P, d, off, out) {
    out = out || {};
    if (d < 0) d = 0;
    var s = P.seg[P.seg.length - 1];
    for (var i = 0; i < P.seg.length; i++) { if (d < P.seg[i].start + P.seg[i].len) { s = P.seg[i]; break; } }
    var t = Math.min(d - s.start, s.len);
    out.x = s.x + s.dx * t - s.dy * off;
    out.y = s.y + s.dy * t + s.dx * off;
    out.dx = s.dx; out.dy = s.dy;
    return out;
  }
  function coverage(P, c, r, range) {
    var cx = c + 0.5, cy = r + 0.5, tot = 0, p = {};
    for (var d = 0; d < P.len; d += 0.1) { posAt(P, d, 0, p); if (dist(cx, cy, p.x, p.y) <= range) tot += 0.1; }
    return tot;
  }
  var PATHS = LEVELS.map(function (L) { return buildPath(L.path); });

  // 关卡可用内容（累计解锁）
  function levelContent(li) {
    var units = [], gens = [];
    for (var i = 0; i <= li; i++) {
      var u = LEVELS[i].unlock;
      (u.units || []).forEach(function (k) { if (units.indexOf(k) < 0) units.push(k); });
      (u.gens || []).forEach(function (g) { if (gens.indexOf(g) < 0) gens.push(g); });
    }
    var names = [];
    gens.forEach(function (g) { GENERALS[g].chars.forEach(function (ch) { if (names.indexOf(ch) < 0) names.push(ch); }); });
    return { units: units, gens: gens, names: names };
  }

  // ---------- 合成 ----------
  function isUnit(it) { return it && it.t === 'u'; }
  function mergeable(A, B) { return isUnit(A) && isUnit(B) && A.k === B.k && A.lv === B.lv && A.lv < 5; }
  // 两张名字字牌能否凑成武将（content 为关卡可用内容；省略则全部可用）
  function combineResult(A, B, content) {
    if (!A || !B || A.t !== 'c' || B.t !== 'c') return null;
    var gens = content ? content.gens : GEN_KEYS;
    for (var i = 0; i < NAME_RECIPES.length; i++) {
      var nr = NAME_RECIPES[i];
      if (((nr[0] === A.ch && nr[1] === B.ch) || (nr[0] === B.ch && nr[1] === A.ch)) && gens.indexOf(nr[2]) >= 0) return { t: 'g', k: nr[2] };
    }
    return null;
  }

  var UNITS_W = { dao: 24, qiang: 20, gong: 22, qi: 18, dun: 12, nu: 12, gu: 8, huo: 12, tou: 8, lian: 10 };

  function createGame(opts) {
    opts = opts || {};
    var li = Math.max(0, Math.min(LEVELS.length - 1, opts.level | 0));
    var L = LEVELS[li], P = PATHS[li], content = levelContent(li);
    var FAC = FACTIONS[L.faction];
    var seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    var rng = mulberry32(seed);
    var G = {
      level: li, L: L, P: P, content: content, seed: seed, quiet: !!opts.quiet,
      phase: 'prep', wave: 0, waves: L.waves, hp: CFG.maxHp, mantou: L.start,
      summons: 0, nameSince: 0, timer: CFG.prepTime, holdTimer: !!opts.holdTimer,
      bench: [null, null, null, null, null],
      cells: [], enemies: [], projs: [], queue: [], spawnT: 0, waveTag: '',
      time: 0, eid: 1, ev: [], auraDirty: true, syn: {}, synSeen: {}, mods: {}, floodT: 0, floodOn: 0,
      stats: { kills: 0, leaks: 0, summons: 0, merges: 0, generals: [], recipes: [], maxTier: 1, lost: 0 }
    };
    var blocked = {};
    (L.blocked || []).forEach(function (b) { blocked[b[0] + ',' + b[1]] = 1; });
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var k = c + ',' + r;
        G.cells.push({ c: c, r: r, path: !!P.set[k], block: !!blocked[k], lock: true, item: null, high: !!(L.highGround && r < L.highGround) });
      }
    }
    // 初始开放 6 块最有价值的空地
    var cand = G.cells.filter(function (ce) { return !ce.path && !ce.block; });
    cand.forEach(function (ce) { ce.score = coverage(P, ce.c, ce.r, 1.6) + coverage(P, ce.c, ce.r, 3) * 0.2 - Math.abs(ce.r - 5) * 0.05; });
    cand.sort(function (a, b) { return b.score - a.score; });
    cand.slice(0, 6).forEach(function (ce) { ce.lock = false; });
    (L.gift || []).forEach(function (g, i) { G.bench[i] = g.slice(0, 2) === 'u:' ? { t: 'u', k: g.slice(2), lv: 1 } : { t: 'c', ch: g }; });

    function rand() { return rng(); }
    function emit(e) {
      if (G.quiet) return;
      G.ev.push(e);
      if (G.ev.length > 4000) G.ev.splice(0, 1500);
    }
    function cellAt(c, r) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
      return G.cells[r * COLS + c];
    }
    function getItem(loc) {
      if (!loc) return null;
      if (loc.z === 'b') return G.bench[loc.i] || null;
      if (loc.z === 't') { var ce = cellAt(loc.c, loc.r); return ce ? ce.item : null; }
      return null;
    }
    function setItem(loc, it) {
      if (loc.z === 'b') G.bench[loc.i] = it || null;
      else if (loc.z === 't') {
        cellAt(loc.c, loc.r).item = it || null;
        if (it) it.cdLeft = Math.max(it.cdLeft || 0, 0.25);
      }
      G.auraDirty = true;
    }
    G.cellAt = cellAt;
    G.getItem = getItem;
    G.cost = function () { return Math.min(CFG.costCap, CFG.costBase + Math.floor(CFG.costStep * G.summons)); };
    G.benchFree = function () { for (var i = 0; i < 5; i++) if (!G.bench[i]) return i; return -1; };
    G.freeTiles = function () { var n = 0; G.cells.forEach(function (ce) { if (!ce.path && !ce.block && !ce.lock && !ce.item) n++; }); return n; };
    G.lockedCount = function () { var n = 0; G.cells.forEach(function (ce) { if (!ce.path && !ce.block && ce.lock) n++; }); return n; };
    G.canSummon = function () { return G.phase !== 'won' && G.phase !== 'lost' && G.benchFree() >= 0 && G.mantou >= G.cost(); };
    G.waveMult = function (n) { return L.hp * Math.pow(L.growth, (n || G.wave) - 1); };
    G.genMult = function () { return 1 + CFG.genGrowth * Math.max(0, G.wave - 1) / Math.max(1, L.waves - 1); };
    G.reward = function (base) { return Math.round(base * (1 + CFG.rewardGrowth * Math.max(0, G.wave - 1))); };
    G.combine = function (A, B) { return combineResult(A, B, content); };

    // ---------- 掉落 ----------
    function holdings() {
      var h = {};
      function add(it) { if (it && it.t === 'c') h[it.ch] = (h[it.ch] || 0) + 1; }
      G.bench.forEach(add);
      G.cells.forEach(function (ce) { add(ce.item); });
      return h;
    }
    function ownedGenerals() {
      var o = {};
      function add(it) { if (it && it.t === 'g') o[it.k] = 1; }
      G.bench.forEach(add);
      G.cells.forEach(function (ce) { add(ce.item); });
      return o;
    }
    // 名字字牌：手里有半个名字时偏向另一半；否则偏向尚未拥有的武将
    function rollName() {
      var hold = holdings(), owned = ownedGenerals(), want = [];
      NAME_RECIPES.forEach(function (nr) {
        if (content.gens.indexOf(nr[2]) < 0 || owned[nr[2]]) return;
        if (hold[nr[0]] && !hold[nr[1]]) want.push(nr[1]);
        if (hold[nr[1]] && !hold[nr[0]]) want.push(nr[0]);
      });
      if (want.length && rand() < CFG.pieceFocus) return { t: 'c', ch: want[(rand() * want.length) | 0] };
      var pool = [];
      content.gens.forEach(function (gk) {
        var w = owned[gk] ? 1 : 3;
        GENERALS[gk].chars.forEach(function (ch) { for (var i = 0; i < w; i++) pool.push(ch); });
      });
      return { t: 'c', ch: pool[(rand() * pool.length) | 0] };
    }
    function rollItem() {
      var w = CFG.weights;
      var hasNames = content.gens.length > 0;
      G.nameSince++;
      if (hasNames && G.nameSince >= CFG.namePity) { G.nameSince = 0; return rollName(); }
      var locked = G.lockedCount();
      var sw = locked ? w.shovel : 0;
      if (locked && G.freeTiles() <= 1) sw *= 2.5;
      var nw = hasNames ? w.name : 0;
      // 基础兵种权重高，后解锁的兵种权重略低
      var uw = content.units.map(function (k) { return UNITS_W[k] || 10; });
      var ut = uw.reduce(function (a, b) { return a + b; }, 0);
      var x = rand() * (ut + nw + sw);
      for (var i = 0; i < uw.length; i++) { if ((x -= uw[i]) < 0) return { t: 'u', k: content.units[i], lv: 1 }; }
      if ((x -= nw) < 0) { G.nameSince = 0; return rollName(); }
      return { t: 's' };
    }
    G.summon = function () {
      if (!G.canSummon()) return null;
      var slot = G.benchFree(), cost = G.cost();
      G.mantou -= cost;
      G.summons++;
      G.stats.summons++;
      var it = rollItem();
      G.bench[slot] = it;
      emit({ type: 'summon', slot: slot, item: it, cost: cost });
      return it;
    };

    // ---------- 拖放 ----------
    function value(it) {
      if (!it) return 0;
      if (it.t === 'u') return 6 * Math.pow(2, it.lv - 1);
      if (it.t === 'c') return 5;
      if (it.t === 's') return 4;
      return 0;
    }
    G.value = value;
    G.plan = function (from, to) {
      var A = getItem(from);
      if (!A || !to) return null;
      if (to.z === 'x') return A.t === 'g' ? { act: 'norecycle' } : { act: 'recycle', value: value(A) };
      if (from.z === to.z && from.i === to.i && from.c === to.c && from.r === to.r) return null;
      var B;
      if (to.z === 't') {
        var ce = cellAt(to.c, to.r);
        if (!ce || ce.path || ce.block) return null;
        if (ce.lock) return A.t === 's' ? { act: 'dig' } : null;
        if (A.t === 's') return null;
        B = ce.item;
        if (!B) return { act: from.z === 't' ? 'move' : 'place' };
      } else if (to.z === 'b') {
        if (to.i < 0 || to.i > 4) return null;
        B = G.bench[to.i];
        if (!B) return { act: 'move' };
      } else return null;
      if (mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
      var res = combineResult(A, B, content);
      if (res) return { act: 'general', result: res };
      if (B.t === 's' && from.z === 't') return null;
      return { act: 'swap' };
    };
    G.apply = function (from, to) {
      var p = G.plan(from, to);
      if (!p || p.act === 'norecycle') return p;
      var A = getItem(from), B = getItem(to);
      var xy = to.z === 't' ? { x: to.c + 0.5, y: to.r + 0.5 } : {};
      switch (p.act) {
        case 'recycle':
          setItem(from, null);
          G.mantou += p.value;
          emit({ type: 'recycle', value: p.value, item: A });
          break;
        case 'dig':
          setItem(from, null);
          cellAt(to.c, to.r).lock = false;
          emit({ type: 'dig', c: to.c, r: to.r });
          break;
        case 'place': case 'move':
          setItem(from, null); setItem(to, A);
          emit({ type: 'place', to: to, item: A });
          break;
        case 'swap':
          setItem(from, B); setItem(to, A);
          emit({ type: 'swap', from: from, to: to });
          break;
        case 'merge':
          setItem(from, null);
          B.lv = p.lv; B.cdLeft = 0.2;
          G.auraDirty = true;
          G.stats.merges++;
          if (p.lv > G.stats.maxTier) G.stats.maxTier = p.lv;
          emit({ type: 'merge', to: to, lv: p.lv, kind: B.k, x: xy.x, y: xy.y });
          break;
        case 'general':
          setItem(from, null);
          var it = { t: p.result.t };
          if (p.result.k) it.k = p.result.k;
          if (p.result.lv) it.lv = p.result.lv;
          if (p.result.ch) it.ch = p.result.ch;
          if (it.t === 'g') { it.skLeft = 2; it.cdLeft = 0.3; }
          setItem(to, it);
          if (p.act === 'general' && G.stats.generals.indexOf(it.k) < 0) G.stats.generals.push(it.k);
          emit({ type: p.act, to: to, k: it.k, ch: it.ch, lv: it.lv, recipe: p.result.recipe, x: xy.x, y: xy.y });
          break;
      }
      return p;
    };

    // ---------- 羁绊与光环 ----------
    function updateAura() {
      G.auraDirty = false;
      var gens = [], on = {};
      G.cells.forEach(function (ce) {
        if (ce.item && ce.item.t === 'g') { gens.push({ k: ce.item.k, x: ce.c + 0.5, y: ce.r + 0.5 }); on[ce.item.k] = 1; }
      });
      var syn = {};
      SYN_KEYS.forEach(function (sk) {
        var S = SYNERGIES[sk], n = 0;
        S.gens.forEach(function (g) { if (on[g]) n++; });
        if (n >= S.need) syn[sk] = n;
      });
      SYN_KEYS.forEach(function (sk) {
        if (syn[sk] && (!G.syn[sk] || (sk === 'wuhu' && syn[sk] === 5 && G.syn[sk] < 5))) {
          emit({ type: 'synergy', k: sk, n: syn[sk], first: !G.synSeen[sk] });
          G.synSeen[sk] = 1;
        }
      });
      G.syn = syn;
      G.mods = {
        dmgAll: (on.liubei ? CFG.auraAll : 0) + (syn.taoyuan ? 0.2 : 0),
        skillCd: syn.wuhu ? (syn.wuhu >= 5 ? 0.6 : 0.8) : 1,
        skillDmg: syn.wolong ? 1.5 : 1,
        enemySlow: syn.beifa ? 0.12 : 0,
        genDmg: syn.beifa ? 0.25 : 0,
        daoDmg: syn.fuzi ? 0.3 : 0
      };
      var drums = [];
      G.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u' && ce.item.k === 'gu') drums.push({ x: ce.c + 0.5, y: ce.r + 0.5, h: UNITS.gu.haste + 0.05 * (ce.item.lv - 1), rg: UNITS.gu.range }); });
      G.cells.forEach(function (ce) {
        var it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) return;
        var x = ce.c + 0.5, y = ce.r + 0.5;
        var m = 1 + G.mods.dmgAll;
        if (it.t === 'u') {
          var used = {};
          gens.forEach(function (g) {
            var a = GENERALS[g.k].aura;
            if (a !== 'all' && a.indexOf(it.k) >= 0 && !used[g.k] && dist(g.x, g.y, x, y) <= CFG.auraRange + 1e-6) { used[g.k] = 1; m += CFG.auraBonus; }
          });
          if (it.k === 'dao') m += G.mods.daoDmg;
        } else m += G.mods.genDmg;
        it.aura = m;
        var h = 0;
        drums.forEach(function (d) { if (dist(d.x, d.y, x, y) <= d.rg + 1e-6 && !(d.x === x && d.y === y)) h = Math.max(h, d.h); });
        it.haste = h;
        it.rangeBonus = ce.high ? 0.5 : 0;
      });
    }
    G.updateAura = updateAura;

    // ---------- 波次 ----------
    function mixAt(n) {
      var out = [], tot = 0;
      for (var t in L.mix) {
        var m = L.mix[t], from = m[2] || 1;
        if (n < from) continue;
        var k = L.waves > from ? (n - from) / (L.waves - from) : 1;
        var w = m[0] + (m[1] - m[0]) * k;
        if (w > 0) { out.push([t, w]); tot += w; }
      }
      return { list: out, tot: tot };
    }
    function buildWave(n) {
      var count = Math.min(34, 6 + 2 * n);
      var mx = mixAt(n), list = [], tag = '';
      // 特殊波：骑兵突袭 / 重甲压境
      var special = (n % 4 === 3) ? (mx.list.some(function (x) { return x[0] === 'qi'; }) ? 'qi' : '') : '';
      if (L.terrain === 'bridge' && n % 3 === 2) special = 'qi';
      for (var i = 0; i < count; i++) {
        var t;
        if (special && rand() < 0.55) t = special;
        else {
          var x = rand() * mx.tot;
          t = mx.list[0][0];
          for (var j = 0; j < mx.list.length; j++) { x -= mx.list[j][1]; if (x < 0) { t = mx.list[j][0]; break; } }
        }
        list.push(t);
      }
      if (special === 'qi') tag = L.terrain === 'bridge' ? '虎豹骑来袭' : '轻骑突袭';
      if (L.mid && L.mid.wave === n) { list.splice(Math.floor(count * 0.5), 0, 'mid'); tag = '敌将 ' + L.mid.name; }
      if (n === L.waves) { list.splice(Math.floor(count * 0.45), 0, 'boss'); tag = '决战 · ' + L.boss.name; }
      G.waveTag = tag;
      return list;
    }
    function spawn(type, d) {
      var mult = G.waveMult();
      var e = { id: G.eid++, type: type, d: d || 0, stun: 0, flash: 0, off: (rand() - 0.5) * 0.34, x: 0, y: 0, dead: false,
        slowT: 0, burnT: 0, burn: 0, shredT: 0, shred: 0, vulnT: 0, linkT: 0, shield: 0 };
      if (type === 'boss' || type === 'mid') {
        var bd = type === 'boss' ? L.boss : L.mid;
        e.boss = true; e.mid = type === 'mid'; e.name = bd.name; e.ch = bd.ch; e.spd = bd.spd; e.r = type === 'boss' ? 0.47 : 0.42; e.off = 0;
        e.maxHp = ENEMIES.zu.hp * mult * bd.hpMul; e.reward = type === 'boss' ? 40 : 25; e.leak = type === 'boss' ? 4 : 3;
        e.res = FAC.res ? clone(FAC.res) : null;
        e.def = bd; e.abT = 3;
        if (bd.dmgRes) e.dmgRes = bd.dmgRes;
        if (bd.revive) e.revive = bd.revive;
        e.stunRes = 0.5;
        emit({ type: 'boss', name: bd.name, mid: e.mid });
      } else {
        var def = ENEMIES[type];
        e.ch = type === 'zu' && FAC.zu ? FAC.zu : def.ch;
        e.spd = def.spd; e.r = def.r; e.maxHp = def.hp * mult; e.reward = G.reward(def.reward); e.leak = def.leak || 1;
        var res = {};
        if (def.res) for (var k in def.res) res[k] = def.res[k];
        if (FAC.res) for (var k2 in FAC.res) res[k2] = Math.max(res[k2] || 0, FAC.res[k2]);
        e.res = res;
        e.stunRes = def.stunRes || 0;
      }
      e.hp = e.maxHp;
      posAt(P, e.d, e.off, e);
      G.enemies.push(e);
      return e;
    }
    G.spawn = spawn;
    G.startWave = function () {
      if (G.phase !== 'prep' && G.phase !== 'break') return;
      G.wave++;
      G.queue = buildWave(G.wave);
      G.spawnT = 0.3;
      G.phase = 'wave';
      G.auraDirty = true;
      emit({ type: 'wave', n: G.wave, tag: G.waveTag, last: G.wave === L.waves });
    };
    G.callNext = function () {
      if (G.phase !== 'prep' && G.phase !== 'break') return 0;
      var bonus = G.phase === 'break' ? Math.ceil(Math.max(0, G.timer)) * CFG.earlyBonusPerSec : 0;
      G.mantou += bonus;
      if (bonus) emit({ type: 'early', bonus: bonus });
      G.startWave();
      return bonus;
    };
    function waveCleared() {
      var bonus = CFG.waveBonus + CFG.waveBonusGrowth * (G.wave - 1);
      G.mantou += bonus;
      emit({ type: 'clear', n: G.wave, bonus: bonus });
      if (G.wave >= L.waves) {
        G.phase = 'won';
        G.stars = G.stats.lost <= 1 ? 3 : G.stats.lost <= 4 ? 2 : 1;
        emit({ type: 'win', stars: G.stars });
      } else {
        G.phase = 'break';
        G.timer = CFG.breakTime;
        emit({ type: 'break', n: G.wave });
      }
    }

    // ---------- 伤害 ----------
    var linking = false;
    function hurt(e, dmg, dtype, src) {
      if (e.dead) return 0;
      var m = 1;
      var res = e.res && e.res[dtype || 'phys'];
      if (res) m *= 1 - res;
      if (dtype === 'fire') m *= (L.fireMul || 1);
      if (e.shredT > 0) m *= 1 + e.shred;
      if (e.vulnT > 0) m *= 1.4;
      if (e.dmgRes) m *= 1 - e.dmgRes;
      dmg *= m;
      if (e.shield > 0) { var ab = Math.min(e.shield, dmg); e.shield -= ab; dmg -= ab; }
      e.hp -= dmg;
      e.flash = 0.08;
      emit({ type: 'dmg', x: e.x, y: e.y - e.r, v: dmg, frac: dmg / e.maxHp, big: dmg >= e.maxHp * 0.45, dtype: dtype });
      if (e.linkT > 0 && !linking && dmg > 0) {
        linking = true;
        for (var i = 0; i < G.enemies.length; i++) {
          var o = G.enemies[i];
          if (o !== e && !o.dead && o.linkT > 0) hurt(o, dmg * 0.4, 'phys');
        }
        linking = false;
      }
      if (e.hp <= 0) kill(e);
      return dmg;
    }
    function kill(e) {
      if (e.revive) {
        e.hp = e.maxHp * e.revive; e.revive = 0; e.stun = 1.2;
        emit({ type: 'revive', x: e.x, y: e.y, name: e.name });
        return;
      }
      e.dead = true;
      G.mantou += e.reward;
      G.stats.kills++;
      emit({ type: 'kill', x: e.x, y: e.y, reward: e.reward, boss: !!e.boss, name: e.name, etype: e.type, ch: e.ch, r: e.r, eid: e.id });
      if (e.boss && !e.mid) return;
      if (e.boss) {
        var slot = G.benchFree();
        if (slot >= 0) { var pc = rollName(); G.bench[slot] = pc; emit({ type: 'drop', slot: slot, item: pc, name: e.name }); }
      }
    }
    G.hurt = hurt;

    function findTarget(x, y, range) {
      var best = null;
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (e.dead || e.d < 0.05) continue;
        if (dist(x, y, e.x, e.y) <= range && (!best || e.d > best.d)) best = e;
      }
      return best;
    }
    function inRadius(x, y, rad, fn) {
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (!e.dead && dist(x, y, e.x, e.y) <= rad + e.r * 0.3) fn(e);
      }
    }
    function lineHits(x, y, dx, dy, len, width, fn) {
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (e.dead) continue;
        var px = e.x - x, py = e.y - y, t = px * dx + py * dy;
        if (t < -0.1 || t > len + 0.2) continue;
        if (Math.abs(px * dy - py * dx) <= width + e.r * 0.4) fn(e);
      }
    }

    // ---------- 攻击 ----------
    function attack(it, ce, tgt) {
      var x = ce.c + 0.5, y = ce.r + 0.5, def, dmg, dtype;
      if (it.t === 'u') { def = UNITS[it.k]; dmg = def.dmg * TIER_MULT[it.lv - 1] * (it.aura || 1); dtype = def.dtype; }
      else { def = GENERALS[it.k]; dmg = def.dmg * G.genMult() * (it.aura || 1); dtype = def.dtype || 'phys'; }
      var dx = tgt.x - x, dy = tgt.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      it.lunge = 0.16; it.lx = dx; it.ly = dy;
      var kind = it.t === 'u' ? it.k : it.k;
      var gold = it.t === 'g';
      var glyph = def.glyph;
      if (def.proj === 'arrow' || def.proj === 'glyph') {
        var n = def.multi || 1, tg = [tgt];
        if (n > 1) {
          var others = G.enemies.filter(function (e) { return !e.dead && e !== tgt && dist(x, y, e.x, e.y) <= def.range + (it.rangeBonus || 0); });
          others.sort(function (a, b) { return b.d - a.d; });
          for (var i = 0; i < n - 1; i++) tg.push(others[i] || tgt);
        }
        tg.forEach(function (t, i) {
          G.projs.push({ kind: kind, glyph: glyph, x: x, y: y, tgt: t, dmg: dmg, dtype: dtype, gold: gold, burn: def.burn, shred: def.shred, delay: i * 0.07,
            ang: Math.atan2(t.y - y, t.x - x), sx: x, sy: y, arc: def.proj === 'arrow' && !gold ? (i - (n - 1) / 2) * 0.3 + 0.35 : 0, t: 0 });
        });
        emit({ type: 'shoot', kind: kind, gold: gold, x: x, y: y });
        return;
      }
      if (def.proj === 'lob') {
        var lead = Math.min(1.2, tgt.spd * 0.9);
        var land = posAt(P, tgt.d + lead, tgt.off, {});
        G.projs.push({ kind: kind, glyph: glyph, lob: true, x: x, y: y, sx: x, sy: y, tx: land.x, ty: land.y, t: 0, T: 0.85, dmg: dmg, dtype: dtype, splash: def.splash });
        emit({ type: 'shoot', kind: kind, x: x, y: y });
        return;
      }
      if (def.line) {
        G.projs.push({ kind: kind, glyph: glyph, line: true, x: x, y: y, sx: x, sy: y, dx: dx, dy: dy, len: def.line + (it.rangeBonus || 0), trav: 0,
          dmg: dmg, dtype: dtype, gold: gold, shred: def.shred, hit: {}, speed: CFG.lineSpeed * (def.line > 3 ? 1.3 : 1) });
        emit({ type: 'atk', kind: kind, gold: gold, x: x, y: y, x2: tgt.x, y2: tgt.y });
        return;
      }
      if (def.splash) {
        inRadius(tgt.x, tgt.y, def.splash, function (e) { hurt(e, dmg, dtype); });
        emit({ type: 'atk', kind: kind, gold: gold, x: x, y: y, x2: tgt.x, y2: tgt.y, rad: def.splash });
        return;
      }
      hurt(tgt, dmg, dtype);
      emit({ type: 'atk', kind: kind, gold: gold, x: x, y: y, x2: tgt.x, y2: tgt.y });
    }
    function liveEnemies() { return G.enemies.filter(function (e) { return !e.dead && e.d > 0.05; }); }
    function castSkill(it, ce) {
      var x = ce.c + 0.5, y = ce.r + 0.5, k = it.k, def = GENERALS[k];
      var base = def.dmg * G.genMult() * (it.aura || 1) * G.mods.skillDmg;
      var live = liveEnemies();
      var ev = { type: 'skill', k: k, x: x, y: y };
      if (k === 'liubei') {
        if (G.hp < CFG.maxHp) { G.hp++; ev.heal = 1; } else { ev.gold = 6 + G.wave; G.mantou += ev.gold; }
        emit(ev);
        return true;
      }
      if (k === 'guanping') {
        var n = 0;
        G.cells.forEach(function (c2) {
          if (c2.item && (c2.item.t === 'u' || c2.item.t === 'g') && dist(c2.c + 0.5, c2.r + 0.5, x, y) <= 1.6) { c2.item.rushT = 4; n++; }
        });
        if (!live.length) return false;
        ev.rad = 1.6; emit(ev);
        return true;
      }
      if (!live.length) return false;
      if (k === 'zhaoyun') {
        var near = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.6; });
        if (!near.length) return false;
        near.sort(function (a, b) { return b.d - a.d; });
        near = near.slice(0, 7);
        ev.pts = near.map(function (e) { return [e.x, e.y]; });
        near.forEach(function (e) { hurt(e, base * 6, 'phys'); });
      } else if (k === 'zhangfei') {
        var any = false;
        inRadius(x, y, 2.5, function () { any = true; });
        if (!any) return false;
        inRadius(x, y, 2.5, function (e) { e.stun = Math.max(e.stun, 1.5 * (1 - (e.stunRes || 0))); hurt(e, base * 1.5, 'phys'); });
        ev.rad = 2.5;
      } else if (k === 'guanyu') {
        var tg = findTarget(x, y, 2.1);
        if (!tg) return false;
        inRadius(x, y, 2.1, function (e) { hurt(e, base * 4, 'phys'); });
        ev.rad = 2.1; ev.ang = Math.atan2(tg.y - y, tg.x - x);
      } else if (k === 'machao') {
        var t2 = findTarget(x, y, 3);
        if (!t2) return false;
        var dx = t2.x - x, dy = t2.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= l; dy /= l;
        lineHits(x, y, dx, dy, 4.5, 0.45, function (e) { hurt(e, base * 5, 'phys'); });
        ev.x2 = x + dx * 4.5; ev.y2 = y + dy * 4.5;
      } else if (k === 'huangzhong') {
        var top = live[0];
        live.forEach(function (e) { if (e.hp > top.hp) top = e; });
        ev.x2 = top.x; ev.y2 = top.y;
        hurt(top, base * 6, 'arrow');
      } else if (k === 'kongming') {
        var hit = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.5; });
        if (!hit.length) return false;
        hit.forEach(function (e) { hurt(e, base * 3, 'fire'); if (!e.dead) { e.burnT = 3; e.burn = Math.max(e.burn, base * 0.5); } });
        var pts = [], p = {};
        for (var d = 0; d < P.len; d += 0.5) { posAt(P, d, 0, p); if (dist(x, y, p.x, p.y) <= 3.5) pts.push([p.x, p.y]); }
        ev.pts = pts;
      } else if (k === 'pangtong') {
        var c0 = findTarget(x, y, 3.2);
        if (!c0) return false;
        var grp = live.filter(function (e) { return dist(c0.x, c0.y, e.x, e.y) <= 2.2; });
        grp.sort(function (a, b) { return dist(c0.x, c0.y, a.x, a.y) - dist(c0.x, c0.y, b.x, b.y); });
        grp = grp.slice(0, 6);
        grp.forEach(function (e) { e.linkT = 6; });
        grp.forEach(function (e) { hurt(e, base * 1.2, 'phys'); });
        ev.pts = grp.map(function (e) { return [e.x, e.y]; });
      } else if (k === 'weiyan') {
        var hit2 = 0;
        inRadius(x, y, 2.5, function (e) { e.vulnT = 5; hit2++; });
        if (!hit2) return false;
        inRadius(x, y, 2.5, function (e) { hurt(e, base * 2, 'phys'); });
        ev.rad = 2.5;
      } else if (k === 'jiangwei') {
        var cand = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.6; });
        if (!cand.length) return false;
        var best = cand[0], bn = -1;
        cand.forEach(function (e) {
          var n2 = 0;
          cand.forEach(function (o) { if (dist(e.x, e.y, o.x, o.y) <= 1.3) n2++; });
          if (n2 > bn) { bn = n2; best = e; }
        });
        var bx = best.x, by = best.y;
        inRadius(bx, by, 1.3, function (e) { hurt(e, base * 4, 'phys'); if (!e.dead) e.stun = Math.max(e.stun, 0.6 * (1 - (e.stunRes || 0))); });
        ev.x2 = bx; ev.y2 = by; ev.rad = 1.3;
      }
      emit(ev);
      return true;
    }

    // ---------- 敌将技能 ----------
    function bossAbility(e, dt) {
      var bd = e.def;
      e.abT -= dt;
      if (bd.summon && e.abT <= 0 && e.d > 1) {
        e.abT = bd.summon.every;
        for (var i = 0; i < bd.summon.n; i++) spawn(bd.summon.type || 'zu', Math.max(0, e.d - 0.4 - i * 0.4));
        emit({ type: 'bossAct', act: 'summon', x: e.x, y: e.y, name: e.name });
      }
      if (bd.swarm && e.abT <= 0 && e.d > 1) {
        e.abT = bd.swarm.every;
        for (var j = 0; j < bd.swarm.n; j++) spawn('qi', Math.max(0, e.d - 0.5 - j * 0.35));
        emit({ type: 'bossAct', act: 'swarm', x: e.x, y: e.y, name: e.name });
      }
      if (bd.charge) {
        if (e.chargeT > 0) e.chargeT -= dt;
        if (e.abT <= 0) { e.abT = bd.charge.every; e.chargeT = bd.charge.dur; emit({ type: 'bossAct', act: 'charge', x: e.x, y: e.y, name: e.name }); }
      }
      if (bd.rage && !e.raged && e.hp < e.maxHp * 0.5) { e.raged = true; e.spd *= 1.6; emit({ type: 'bossAct', act: 'rage', x: e.x, y: e.y, name: e.name }); }
      if (bd.shield && e.abT <= 0) { e.abT = bd.shield.every; e.shield = e.maxHp * bd.shield.frac; emit({ type: 'bossAct', act: 'shield', x: e.x, y: e.y, name: e.name }); }
      if (bd.burnUnits && e.abT <= 0 && e.d > 1) {
        e.abT = bd.burnUnits.every;
        var hitU = [];
        G.cells.forEach(function (ce) {
          if (ce.item && (ce.item.t === 'u' || ce.item.t === 'g') && dist(ce.c + 0.5, ce.r + 0.5, e.x, e.y) <= bd.burnUnits.range) { ce.item.burnT = bd.burnUnits.dur; hitU.push([ce.c + 0.5, ce.r + 0.5]); }
        });
        emit({ type: 'bossAct', act: 'burn', x: e.x, y: e.y, name: e.name, pts: hitU, rad: bd.burnUnits.range });
      }
    }

    // ---------- 主循环 ----------
    G.step = function (dt) {
      if (G.phase === 'won' || G.phase === 'lost') return;
      G.time += dt;
      if (G.phase === 'prep' || G.phase === 'break') {
        if (!G.holdTimer) G.timer -= dt;
        if (G.timer <= 0) G.startWave();
      }
      if (G.phase === 'wave') {
        G.spawnT -= dt;
        if (G.queue.length && G.spawnT <= 0) {
          spawn(G.queue.shift());
          G.spawnT += 0.8 - 0.35 * (G.wave - 1) / Math.max(1, L.waves - 1);
        }
        if (L.flood) {
          G.floodT += dt;
          if (G.floodT >= L.flood.every) { G.floodT = 0; G.floodOn = L.flood.dur; emit({ type: 'flood' }); }
        }
      }
      if (G.floodOn > 0) G.floodOn -= dt;
      if (G.auraDirty) updateAura();

      var i, e;
      // 盾兵减速区
      var shields = [];
      for (i = 0; i < G.cells.length; i++) {
        var cs = G.cells[i];
        if (cs.item && cs.item.t === 'u' && cs.item.k === 'dun') shields.push({ x: cs.c + 0.5, y: cs.r + 0.5, s: UNITS.dun.slow + 0.05 * (cs.item.lv - 1), rg: UNITS.dun.range });
      }
      for (i = 0; i < G.enemies.length; i++) {
        e = G.enemies[i];
        if (e.dead) continue;
        if (e.flash > 0) e.flash -= dt;
        if (e.shredT > 0) e.shredT -= dt;
        if (e.vulnT > 0) e.vulnT -= dt;
        if (e.linkT > 0) e.linkT -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnAcc = (e.burnAcc || 0) + dt;
          if (e.burnAcc >= 0.5) { e.burnAcc = 0; hurt(e, e.burn * 0.5, 'fire'); if (e.dead) continue; }
        }
        if (e.boss) bossAbility(e, dt);
        var slow = 0;
        for (var s = 0; s < shields.length; s++) if (dist(shields[s].x, shields[s].y, e.x, e.y) <= shields[s].rg) slow = Math.max(slow, shields[s].s);
        if (G.floodOn > 0) slow = Math.max(slow, L.flood.slow);
        e.slowed = slow;
        var spd = e.spd * (1 - slow) * (1 - G.mods.enemySlow || 1) * (e.chargeT > 0 ? e.def.charge.mult : 1);
        if (e.stun > 0) e.stun -= dt;
        else e.d += spd * dt;
        if (e.d >= P.len) {
          e.dead = true;
          var loss = e.leak || 1;
          G.hp = Math.max(0, G.hp - loss);
          G.stats.leaks++;
          G.stats.lost += loss;
          emit({ type: 'leak', loss: loss, boss: !!e.boss });
          if (G.hp <= 0) { G.phase = 'lost'; emit({ type: 'lose' }); return; }
          continue;
        }
        posAt(P, e.d, e.off, e);
      }

      // 我军
      for (i = 0; i < G.cells.length; i++) {
        var ce = G.cells[i], it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) continue;
        if (it.lunge > 0) it.lunge -= dt;
        if (it.burnT > 0) it.burnT -= dt;
        if (it.rushT > 0) it.rushT -= dt;
        var spdMul = (1 + (it.haste || 0) + (it.rushT > 0 ? 0.6 : 0)) * (it.burnT > 0 ? 0.5 : 1);
        if (it.t === 'g') {
          it.skLeft = (it.skLeft == null ? 2 : it.skLeft) - dt;
          if (it.skLeft <= 0 && G.phase === 'wave') {
            if (castSkill(it, ce)) it.skLeft = GENERALS[it.k].skillCd * G.mods.skillCd;
            else it.skLeft = 0;
          }
        }
        it.cdLeft = (it.cdLeft || 0) - dt * spdMul;
        if (it.cdLeft > 0) continue;
        var def = it.t === 'u' ? UNITS[it.k] : GENERALS[it.k];
        if (it.t === 'u' && it.k === 'gu') {
          // 鼓手：只在战时敲鼓
          if (G.phase === 'wave' && G.enemies.length) { it.cdLeft = def.cd; emit({ type: 'drum', x: ce.c + 0.5, y: ce.r + 0.5, rad: def.range }); }
          else it.cdLeft = 0;
          continue;
        }
        var range = def.range + (it.rangeBonus || 0);
        if (it.t === 'u' && def.pulse) {
          var any = false, dmgP = def.dmg * TIER_MULT[it.lv - 1] * (it.aura || 1);
          inRadius(ce.c + 0.5, ce.r + 0.5, range, function (en) { any = true; hurt(en, dmgP, 'phys'); });
          if (any) { it.cdLeft += def.cd; emit({ type: 'pulse', x: ce.c + 0.5, y: ce.r + 0.5, rad: range }); }
          else it.cdLeft = 0;
          continue;
        }
        var tgt = findTarget(ce.c + 0.5, ce.r + 0.5, range);
        if (!tgt) { it.cdLeft = 0; continue; }
        attack(it, ce, tgt);
        it.cdLeft += def.cd;
      }

      // 投射物
      for (i = 0; i < G.projs.length; i++) {
        var p = G.projs[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.t += dt;
        if (p.lob) {
          var k = p.t / p.T;
          p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.h = Math.sin(Math.min(1, k) * Math.PI);
          if (k >= 1) {
            p.done = true;
            inRadius(p.tx, p.ty, p.splash, function (en) { hurt(en, p.dmg, p.dtype); });
            emit({ type: 'boom', x: p.tx, y: p.ty, rad: p.splash });
          }
          continue;
        }
        if (p.line) {
          var mvl = p.speed * dt;
          p.trav += mvl;
          p.x += p.dx * mvl; p.y += p.dy * mvl;
          lineHits(p.x - p.dx * mvl, p.y - p.dy * mvl, p.dx, p.dy, mvl, 0.32, function (en) {
            if (p.hit[en.id]) return;
            p.hit[en.id] = 1;
            hurt(en, p.dmg, p.dtype);
            if (p.shred && !en.dead) { en.shredT = 3; en.shred = Math.max(en.shred, p.shred); }
            emit({ type: 'pierce', x: en.x, y: en.y, kind: p.kind, gold: p.gold });
          });
          if (p.trav >= p.len) p.done = true;
          continue;
        }
        var t = p.tgt;
        if (t.dead) { p.done = true; continue; }
        var dx = t.x - p.x, dy = t.y - p.y, l = Math.sqrt(dx * dx + dy * dy);
        var mv = CFG.arrowSpeed * dt;
        p.ang = Math.atan2(dy, dx);
        if (l <= mv + 0.12) {
          p.done = true;
          hurt(t, p.dmg, p.dtype);
          if (!t.dead) {
            if (p.burn) { t.burnT = 3; t.burn = Math.max(t.burn, p.dmg * p.burn); }
            if (p.shred) { t.shredT = 3; t.shred = Math.max(t.shred, p.shred); }
          }
          emit({ type: 'hit', x: t.x, y: t.y, kind: p.kind, gold: p.gold });
        } else {
          // 弧线：随剩余距离衰减的侧向偏移
          var side = p.arc ? p.arc * Math.min(1, l / 3) : 0;
          p.x += (dx / l) * mv - (dy / l) * side * mv * 0.6;
          p.y += (dy / l) * mv + (dx / l) * side * mv * 0.6;
        }
      }
      if (G.projs.length) {
        var keep = [];
        for (i = 0; i < G.projs.length; i++) if (!G.projs[i].done) keep.push(G.projs[i]);
        G.projs = keep;
      }
      if (G.enemies.length) {
        var alive = [];
        for (i = 0; i < G.enemies.length; i++) if (!G.enemies[i].dead) alive.push(G.enemies[i]);
        G.enemies = alive;
      }
      if (G.phase === 'wave' && !G.queue.length && !G.enemies.length) waveCleared();
    };
    G.drain = function () { var e = G.ev; G.ev = []; return e; };

    // ---------- 存档 ----------
    function bare(it) {
      if (!it) return null;
      var o = { t: it.t };
      if (it.k) o.k = it.k;
      if (it.lv) o.lv = it.lv;
      if (it.ch) o.ch = it.ch;
      return o;
    }
    G.serialize = function () {
      return {
        v: 2, level: G.level, wave: G.wave, hp: G.hp, mantou: G.mantou, summons: G.summons, nameSince: G.nameSince,
        bench: G.bench.map(bare),
        cells: G.cells.map(function (ce) { return ce.path || ce.block ? 0 : [ce.lock ? 1 : 0, bare(ce.item)]; }),
        stats: clone(G.stats), time: G.time, synSeen: clone(G.synSeen), seed: (rand() * 1e9) | 0
      };
    };
    if (opts.save) {
      var sv = opts.save;
      G.wave = sv.wave; G.hp = sv.hp; G.mantou = sv.mantou; G.summons = sv.summons; G.nameSince = sv.nameSince || 0;
      G.bench = sv.bench.map(function (it) { return it ? clone(it) : null; });
      sv.cells.forEach(function (v, idx) {
        var ce = G.cells[idx];
        if (!v || !ce || ce.path || ce.block) return;
        ce.lock = !!v[0];
        ce.item = v[1] ? clone(v[1]) : null;
      });
      G.stats = clone(sv.stats) || G.stats;
      G.synSeen = sv.synSeen || {};
      G.time = sv.time || 0;
      G.phase = G.wave > 0 ? 'break' : 'prep';
      G.timer = G.wave > 0 ? CFG.breakTime + 4 : CFG.prepTime;
      if (sv.seed != null) rng = mulberry32(sv.seed);
      updateAura();
      G.ev = [];
    }
    return G;
  }

  var API = {
    COLS: COLS, ROWS: ROWS, TIER_MULT: TIER_MULT, UNITS: UNITS, KINDS: KINDS,
    GENERALS: GENERALS, GEN_KEYS: GEN_KEYS, NAME_RECIPES: NAME_RECIPES, SYNERGIES: SYNERGIES, SYN_KEYS: SYN_KEYS,
    ENEMIES: ENEMIES, FACTIONS: FACTIONS, LEVELS: LEVELS, PATHS: PATHS, CFG: CFG, UNITS_W: UNITS_W,
    posAt: posAt, coverage: coverage, levelContent: levelContent, combineResult: combineResult, mergeable: mergeable,
    buildPath: buildPath, createGame: createGame
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ZYCore = API;
})(this);
