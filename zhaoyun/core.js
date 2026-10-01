/* 赵云与阿斗 v3 · 核心规则（不依赖 DOM，浏览器与 Node 均可运行）
 * 双方对垒：下半场是玩家，上半场是 AI 对手；同一批敌军同时进攻两边，各守各的阿斗（3 颗心）。 */
(function (root) {
  'use strict';

  var COLS = 8, ROWS = 5, HEARTS = 3, BENCH = 5;
  var TIER_MULT = [1, 2.2, 4.8, 10, 22];

  // ---------- 兵种：字即是兵 ----------
  // mode: melee 单体 / thrust 直线穿刺 / arrow 箭 / fire 火球 / gallop 冲阵溅射 / pulse 涟漪 / bolt 弩矢穿透 / lob 抛石 / drum 战鼓
  // hit: 动画中兵器命中（或出手）的时刻（秒），核心按此延迟结算，使画面与伤害同步
  var UNITS = {
    dao: { ch: '刀', name: '刀', mode: 'melee', range: 1.35, dmg: 17, cd: 0.75, hit: 0.17, dtype: 'phys', desc: '「丿」脱鞘飞斩，单体伤害最高' },
    qiang: { ch: '枪', name: '枪', mode: 'thrust', range: 2.1, dmg: 12, cd: 0.95, hit: 0.14, len: 2.4, dtype: 'phys', desc: '「木」化长枪，一刺穿透一线' },
    gong: { ch: '弓', name: '弓', mode: 'arrow', range: 3.1, dmg: 8, cd: 0.6, hit: 0.14, dtype: 'arrow', desc: '「弓」字拉满，「一」作箭连射' },
    qi: { ch: '骑', name: '骑', mode: 'gallop', range: 1.75, dmg: 11, cd: 1.05, hit: 0.26, splash: 0.9, dtype: 'phys', desc: '「马」奔出践踏，范围伤害' },
    dun: { ch: '盾', name: '盾', mode: 'pulse', range: 1.45, dmg: 5, cd: 1.2, hit: 0.12, slow: 0.3, dtype: 'phys', desc: '「盾」震出涟漪：减速并小伤周围敌人' },
    huo: { ch: '火', name: '火', mode: 'fire', range: 3.0, dmg: 8, cd: 0.7, hit: 0.16, burn: 0.6, dtype: 'fire', desc: '「火」苗化作火球，点燃敌军' },
    gu: { ch: '鼓', name: '鼓', mode: 'drum', range: 1.5, dmg: 0, cd: 1.6, haste: 0.2, desc: '「支」击「壴」：身边友军攻速 +20%（每级 +5%）' },
    nu: { ch: '弩', name: '弩', mode: 'bolt', range: 3.0, dmg: 21, cd: 1.5, hit: 0.2, len: 3.6, shred: 0.15, dtype: 'arrow', desc: '「弓」部张弩，重矢贯穿直线并破甲' },
    tou: { ch: '石', name: '石', mode: 'lob', range: 4.2, dmg: 46, cd: 2.6, hit: 0.22, splash: 1.1, dtype: 'siege', desc: '「口」化巨石抛出，落地「轰」然一片' }
  };
  var KINDS = ['dao', 'qiang', 'gong', 'qi', 'dun', 'huo', 'gu', 'nu', 'tou'];

  // ---------- 武将：两字成名 ----------
  var GENERALS = {
    liubei: { name: '刘备', chars: ['刘', '备'], skill: '仁德', mode: 'arrow', dmg: 30, cd: 1.0, range: 2.6, hit: 0.15, skillCd: 30, aura: 'all',
      desc: '「备」放光：阿斗回复 1 心（满心改赏馒头）；全军伤害 +10%' },
    guanyu: { name: '关羽', chars: ['关', '羽'], skill: '青龙偃月', mode: 'gallop', dmg: 90, cd: 1.2, range: 1.6, hit: 0.2, splash: 1.0, skillCd: 9, aura: ['dao'],
      desc: '「羽」化作青龙偃月刀，月牙横扫周身；身边刀兵 +35%' },
    zhangfei: { name: '张飞', chars: ['张', '飞'], skill: '当阳怒喝', mode: 'thrust', dmg: 60, cd: 1.0, range: 1.8, hit: 0.14, len: 2.0, skillCd: 10, aura: ['qiang'],
      desc: '「飞」字展翅一声怒喝，震晕周围敌人；身边枪兵 +35%' },
    zhaoyun: { name: '赵云', chars: ['赵', '云'], skill: '七进七出', mode: 'thrust', dmg: 40, cd: 0.4, range: 2.1, hit: 0.12, len: 2.2, skillCd: 8, aura: ['qi'],
      desc: '「云」化游龙沿路冲阵，连破七敌；身边骑兵 +35%' },
    machao: { name: '马超', chars: ['马', '超'], skill: '西凉铁骑', mode: 'gallop', dmg: 55, cd: 0.8, range: 1.8, hit: 0.24, splash: 0.8, skillCd: 9, aura: ['qi'],
      desc: '万「马」奔腾，铁骑贯穿一整条战线；身边骑兵 +35%' },
    huangzhong: { name: '黄忠', chars: ['黄', '忠'], skill: '百步穿杨', mode: 'arrow', dmg: 120, cd: 1.4, range: 5, hit: 0.15, dtype: 'arrow', skillCd: 7, aura: ['gong', 'huo'],
      desc: '「忠」中之「中」化作箭靶，一箭狙杀血量最高之敌；身边弓兵 +35%' },
    kongming: { name: '孔明', chars: ['孔', '明'], skill: '借东风', mode: 'fire', dmg: 50, cd: 1.1, range: 3, hit: 0.15, dtype: 'fire', skillCd: 12, aura: ['nu'],
      desc: '「明」分日月：「日」降天火，「月」借东风，烧尽周围敌军；身边弩兵 +35%' },
    pangtong: { name: '庞统', chars: ['庞', '统'], skill: '连环计', mode: 'arrow', dmg: 45, cd: 1.0, range: 2.6, hit: 0.15, skillCd: 12, aura: ['tou'],
      desc: '「纟」丝化铁索连环六敌，伤害互相传导；身边投石 +35%' },
    weiyan: { name: '魏延', chars: ['魏', '延'], skill: '破阵', mode: 'gallop', dmg: 70, cd: 0.9, range: 1.6, hit: 0.2, splash: 0.8, skillCd: 10, aura: ['dun', 'gu'],
      desc: '「延」笔画炸裂破阵：周围敌人受伤 +40%；身边盾、鼓 +35%' },
    jiangwei: { name: '姜维', chars: ['姜', '维'], skill: '伏兵四起', mode: 'thrust', dmg: 60, cd: 0.8, range: 2.1, hit: 0.14, len: 2.2, skillCd: 9, aura: ['qiang'],
      desc: '笔画如伏兵破土而出，重创敌群并定身；身边枪兵 +35%' },
    guanping: { name: '关平', chars: ['关', '平'], skill: '驰援', mode: 'melee', dmg: 50, cd: 0.9, range: 1.5, hit: 0.17, skillCd: 10, aura: ['dao'],
      desc: '「平」字化旗驰援：身边友军攻速 +60%（4 秒）；身边刀兵 +35%' }
  };
  var GEN_KEYS = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong', 'kongming', 'pangtong', 'weiyan', 'jiangwei', 'guanping'];
  var NAME_RECIPES = GEN_KEYS.map(function (k) { return [GENERALS[k].chars[0], GENERALS[k].chars[1], k]; });
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
    zu: { ch: '卒', name: '步卒', hp: 40, spd: 1.0, reward: 2, r: 0.3 },
    qi: { ch: '骑', name: '骑兵', hp: 30, spd: 1.75, reward: 2, r: 0.3 },
    dun: { ch: '盾', name: '盾卒', hp: 90, spd: 0.75, reward: 3, r: 0.32, res: { arrow: 0.4 } },
    nu: { ch: '弩', name: '弩手', hp: 50, spd: 1.1, reward: 2, r: 0.3 },
    jia: { ch: '甲', name: '重甲', hp: 130, spd: 0.7, reward: 4, r: 0.34, res: { phys: 0.3, arrow: 0.2 } },
    teng: { ch: '藤', name: '藤甲兵', hp: 80, spd: 0.9, reward: 3, r: 0.32, res: { phys: 0.5, arrow: 0.5, siege: 0.3, fire: -1.5 } },
    xiang: { ch: '象', name: '象兵', hp: 320, spd: 0.5, reward: 8, r: 0.4, leak: 2, stunRes: 0.7 },
    chuan: { ch: '船', name: '战船', hp: 70, spd: 0.9, reward: 3, r: 0.34, res: { fire: -0.5 } }
  };
  var FACTIONS = {
    huangjin: { name: '黄巾军', badge: '贼', zu: '贼', color: '#b08428' },
    dong: { name: '董卓军', badge: '董', color: '#8a2222' },
    wei: { name: '曹魏', badge: '魏', color: '#3a5578' },
    wu: { name: '东吴', badge: '吴', color: '#a83a24', res: { fire: 0.5 } },
    man: { name: '南蛮', badge: '蛮', color: '#2f7a5a' }
  };

  // ---------- 战役 ----------
  // path: [起始列, 走向]，第 0 行紧贴中间山脊（敌军从山脊杀出），终点格坐着阿斗
  // rival: 对手主将（上半场）；ai: 0~1 对手强度
  var LEVELS = [
    { name: '黄巾之乱', era: '中平元年 · 涿郡', blurb: '黄巾蜂起，天下大乱。刘关张桃园结义，与曹孟德各守一方，看谁先破贼。', faction: 'huangjin', scene: 'plain',
      rival: '曹操', rivalTitle: '骑都尉', path: [0, 'D1 R7 D2 L7 D1'], waves: 10, hp: 1.5, start: 40, ai: 0.0,
      mix: { zu: [1, 1], qi: [0, 0.3, 4] },
      lieut: { name: '张宝', ch: '宝', hpMul: 9, spd: 0.6 },
      boss: { name: '张角', ch: '角', hpMul: 15, spd: 0.5, summon: { every: 6, n: 2 } },
      twist: '张角作法，不断召唤黄巾援兵', unlock: { units: ['dao', 'qiang', 'gong'], gens: ['liubei', 'guanyu', 'zhangfei'] } },
    { name: '虎牢关', era: '初平元年 · 汜水', blurb: '十八路诸侯讨董。吕布独守虎牢，江东猛虎孙坚与你争功。', faction: 'dong', scene: 'pass',
      rival: '孙坚', rivalTitle: '长沙太守', path: [0, 'R6 D2 L5 D2 R6'], blocked: [[7, 1], [0, 3]], waves: 10, hp: 1.7, start: 40, ai: 0.12,
      mix: { zu: [1, 0.7], qi: [0.15, 0.35], dun: [0, 0.25, 3] },
      lieut: { name: '华雄', ch: '华', hpMul: 9, spd: 0.6 },
      boss: { name: '吕布', ch: '布', hpMul: 15, spd: 0.55, charge: { every: 7, mult: 3, dur: 1.2 } },
      twist: '吕布每隔数秒策赤兔冲锋', unlock: { units: ['qi', 'dun'], gens: [] } },
    { name: '博望坡', era: '建安七年 · 新野', blurb: '孔明初出茅庐，火烧博望。刘表坐镇荆州，亦遣兵拒曹。', faction: 'wei', scene: 'fire',
      rival: '刘表', rivalTitle: '荆州牧', path: [1, 'D2 R2 U2 R2 D4 R2'], waves: 10, hp: 1.8, start: 40, ai: 0.24, fireMul: 1.5,
      mix: { zu: [1, 0.6], qi: [0.1, 0.25], dun: [0.1, 0.3, 3] },
      lieut: { name: '于禁', ch: '于', hpMul: 9, spd: 0.6 },
      boss: { name: '夏侯惇', ch: '夏', hpMul: 15, spd: 0.6, rage: true },
      twist: '林深草密，火攻伤害 +50%', unlock: { units: ['huo', 'gu'], gens: [] } },
    { name: '长坂坡', era: '建安十三年 · 当阳', blurb: '曹军虎豹骑追至。赵云单骑救主，鲁肃奉命前来观阵。', faction: 'wei', scene: 'river',
      rival: '鲁肃', rivalTitle: '东吴使者', path: [6, 'D1 L5 D3 R6'], blocked: [[0, 3], [3, 2]], waves: 11, hp: 0.85, start: 45, ai: 0.36,
      mix: { zu: [1, 0.5], qi: [0.3, 0.6], dun: [0.05, 0.2, 4] },
      lieut: { name: '曹纯', ch: '纯', hpMul: 9, spd: 0.85 },
      boss: { name: '张郃', ch: '合', hpMul: 15, spd: 0.7, swarm: { every: 5, n: 3 } },
      twist: '虎豹骑轻骑成群冲锋', unlock: { units: ['nu'], gens: ['zhaoyun'] } },
    { name: '赤壁', era: '建安十三年 · 江夏', blurb: '孙刘联军，借东风、施连环。周郎羽扇纶巾，与你各领一路。', faction: 'wei', scene: 'river',
      rival: '周瑜', rivalTitle: '大都督', path: [7, 'L6 D2 R5 D2 L6'], waves: 11, hp: 1.8, start: 45, ai: 0.48, fireMul: 2,
      mix: { chuan: [1, 1], zu: [0.2, 0.1], dun: [0.1, 0.3, 4] },
      lieut: { name: '蔡瑁', ch: '蔡', hpMul: 8, spd: 0.6 },
      boss: { name: '曹操', ch: '操', hpMul: 13, spd: 0.5, summon: { every: 9, n: 2, type: 'chuan' } },
      twist: '曹军乘战船顺江而下；火攻伤害 ×2', unlock: { units: [], gens: ['kongming', 'pangtong'] } },
    { name: '定军山', era: '建安二十四年 · 汉中', blurb: '黄忠老当益壮，据山居高临下。法正举旗为号，与你比谁斩将更快。', faction: 'wei', scene: 'mountain',
      rival: '法正', rivalTitle: '军师', path: [0, 'D1 R7 D2 L7 D1'], blocked: [[3, 0], [4, 4]], waves: 11, hp: 1.45, start: 45, ai: 0.58, highGround: 1,
      mix: { zu: [1, 0.5], qi: [0.2, 0.3], dun: [0.15, 0.3], jia: [0, 0.25, 6] },
      lieut: { name: '张郃', ch: '合', hpMul: 9, spd: 0.7 },
      boss: { name: '夏侯渊', ch: '渊', hpMul: 15, spd: 0.85 },
      twist: '第一行为高地，射程 +0.5；夏侯渊来去如风', unlock: { units: ['tou'], gens: ['huangzhong'] } },
    { name: '樊城', era: '建安二十四年 · 襄樊', blurb: '秋雨连绵，汉水暴涨，关羽水淹七军。吕蒙白衣渡江，虎视眈眈。', faction: 'wei', scene: 'flood',
      rival: '吕蒙', rivalTitle: '东吴大将', path: [3, 'D1 L3 D2 R7 D1'], waves: 12, hp: 1.8, start: 50, ai: 0.68, fireMul: 0.6, flood: { every: 16, dur: 3.5, slow: 0.55 },
      mix: { zu: [1, 0.5], dun: [0.2, 0.35], jia: [0.1, 0.35], qi: [0.1, 0.2] },
      lieut: { name: '于禁', ch: '于', hpMul: 9, spd: 0.6 },
      boss: { name: '庞德', ch: '德', hpMul: 15, spd: 0.55, dmgRes: 0.3 },
      twist: '大雨：火攻 −40%；每隔一阵洪水漫过，敌军减速', unlock: { units: [], gens: ['machao', 'guanping'] } },
    { name: '夷陵', era: '章武二年 · 夷陵', blurb: '先主伐吴，连营七百里。吴主孙权亲自督战。', faction: 'wu', scene: 'fire',
      rival: '孙权', rivalTitle: '吴王', path: [0, 'R6 D2 L5 D2 R6'], waves: 12, hp: 2.05, start: 50, ai: 0.78,
      mix: { zu: [1, 0.5], nu: [0.2, 0.4], dun: [0.1, 0.3], qi: [0.1, 0.25] },
      lieut: { name: '朱然', ch: '然', hpMul: 9, spd: 0.65 },
      boss: { name: '陆逊', ch: '逊', hpMul: 15, spd: 0.55, burnUnits: { every: 8, range: 2.2, dur: 3 } },
      twist: '吴军不惧火攻（火伤 −50%）；陆逊放火，烧得身边守军攻速减半', unlock: { units: [], gens: ['weiyan'] } },
    { name: '南中', era: '建兴三年 · 泸水', blurb: '丞相南征，五月渡泸，七擒孟获。马岱另领一军，并驾齐驱。', faction: 'man', scene: 'jungle',
      rival: '马岱', rivalTitle: '平北将军', path: [1, 'D2 R2 U2 R2 D4 R2'], waves: 12, hp: 0.84, start: 50, ai: 1.0,
      mix: { zu: [1, 0.4], teng: [0.3, 0.6], xiang: [0, 0.15, 4], qi: [0.1, 0.2] },
      lieut: { name: '兀突骨', ch: '骨', hpMul: 10, spd: 0.5 },
      boss: { name: '孟获', ch: '获', hpMul: 15, spd: 0.55, revive: 0.6 },
      twist: '藤甲刀枪不入却怕火；象兵皮糙肉厚；孟获被擒仍不服', unlock: { units: [], gens: ['jiangwei'] } },
    { name: '五丈原', era: '建兴十二年 · 渭南', blurb: '六出祁山，星落秋风五丈原。长史杨仪与你分守两营。', faction: 'wei', scene: 'plateau',
      rival: '杨仪', rivalTitle: '长史', path: [7, 'L6 D2 R5 D2 L6'], waves: 12, hp: 2.1, start: 50, ai: 1.35,
      mix: { zu: [1, 0.4], qi: [0.15, 0.3], dun: [0.15, 0.3], jia: [0.05, 0.35], nu: [0.1, 0.2] },
      lieut: { name: '郭淮', ch: '淮', hpMul: 10, spd: 0.65 },
      boss: { name: '司马懿', ch: '懿', hpMul: 15, spd: 0.5, shield: { every: 9, frac: 0.12 } },
      twist: '司马懿坚守：周期性张开护盾', unlock: { units: [], gens: [] } }
  ];

  var CFG = {
    hearts: HEARTS,
    costBase: 15, costStep: 5, costCap: 90,
    rewardGrowth: 0.12, waveBonus: 8, waveBonusGrowth: 1,
    breakTime: 6, prepTime: 20, overlap: 10,
    genGrowth: 2.4, hpGrowth: 1.3,
    weights: { name: 9, shovel: 6 },
    namePity: 8, pieceFocus: 0.65,
    auraBonus: 0.35, auraAll: 0.1, auraRange: 1.5,
    arrowSpeed: 10, boltSpeed: 13, startTiles: 7,
    recycle: { u: 3, c: 3, s: 2 }
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
    var pts = [[cells[0][0] + 0.5, -0.9]];
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
  // AI 强度参数：反应间隔、失误率、合并疏漏、运气
  function aiParams(level) {
    var a = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level | 0))].ai;
    var m = Math.min(1, a);
    return { tick: 2.4 - 1.9 * m, mistake: 0.45 - 0.42 * m, mergeSkip: 0.4 - 0.38 * m, waste: 0.4 - 0.4 * m, luck: 0.3 * a, jitter: 0.6, smart: m };
  }

  function isUnit(it) { return it && it.t === 'u'; }
  function mergeable(A, B) { return isUnit(A) && isUnit(B) && A.k === B.k && A.lv === B.lv && A.lv < 5; }
  function combineResult(A, B, content) {
    if (!A || !B || A.t !== 'c' || B.t !== 'c') return null;
    var gens = content ? content.gens : GEN_KEYS;
    for (var i = 0; i < NAME_RECIPES.length; i++) {
      var nr = NAME_RECIPES[i];
      if (((nr[0] === A.ch && nr[1] === B.ch) || (nr[0] === B.ch && nr[1] === A.ch)) && gens.indexOf(nr[2]) >= 0) return { t: 'g', k: nr[2] };
    }
    return null;
  }
  var UNITS_W = { dao: 24, qiang: 20, gong: 22, qi: 18, dun: 12, huo: 12, gu: 8, nu: 12, tou: 8 };

  // =====================================================================
  function createGame(opts) {
    opts = opts || {};
    var li = Math.max(0, Math.min(LEVELS.length - 1, opts.level | 0));
    var L = LEVELS[li], P = PATHS[li], content = levelContent(li);
    var FAC = FACTIONS[L.faction];
    var seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    var wrng = mulberry32(seed);
    var G = {
      level: li, L: L, P: P, content: content, seed: seed, quiet: !!opts.quiet,
      phase: 'prep', wave: 0, waves: L.waves, timer: opts.prepTime != null ? opts.prepTime : CFG.prepTime, holdTimer: !!opts.holdTimer,
      queue: [], spawnT: 0, waveTag: '', idleT: 0, time: 0, eid: 1, ev: [], floodT: 0, floodOn: 0, result: null,
      sides: []
    };
    var blocked = {};
    (L.blocked || []).forEach(function (b) { blocked[b[0] + ',' + b[1]] = 1; });

    function makeSide(id) {
      var S = {
        id: id, hearts: HEARTS, mantou: L.start, summons: 0, nameSince: 0,
        bench: [null, null, null, null, null], cells: [], enemies: [], projs: [], pend: [],
        auraDirty: true, syn: {}, synSeen: {}, mods: {}, rng: mulberry32(seed * 31 + 7 + id * 101), luck: 0,
        stats: { kills: 0, leaks: 0, summons: 0, merges: 0, generals: [], maxTier: 1, discards: 0, dmg: 0 }
      };
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var k = c + ',' + r;
          S.cells.push({ c: c, r: r, path: !!P.set[k], block: !!blocked[k], lock: true, item: null, high: !!(L.highGround && r < L.highGround) });
        }
      }
      var cand = S.cells.filter(function (ce) { return !ce.path && !ce.block; });
      cand.forEach(function (ce) { ce.score = coverage(P, ce.c, ce.r, 1.6) + coverage(P, ce.c, ce.r, 3) * 0.2; });
      cand.sort(function (a, b) { return b.score - a.score || a.r - b.r || a.c - b.c; });
      cand.slice(0, CFG.startTiles).forEach(function (ce) { ce.lock = false; });
      return S;
    }
    G.sides.push(makeSide(0), makeSide(1));
    G.sides[1].luck = opts.aiLuck != null ? opts.aiLuck : aiParams(li).luck;

    function emit(e) {
      if (G.quiet) return;
      G.ev.push(e);
      if (G.ev.length > 5000) G.ev.splice(0, 2000);
    }
    function side(s) { return typeof s === 'number' ? G.sides[s] : s; }
    function cellAt(S, c, r) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
      return S.cells[r * COLS + c];
    }
    function getItem(S, loc) {
      if (!loc) return null;
      if (loc.z === 'b') return S.bench[loc.i] || null;
      if (loc.z === 't') { var ce = cellAt(S, loc.c, loc.r); return ce ? ce.item : null; }
      return null;
    }
    function setItem(S, loc, it) {
      if (loc.z === 'b') S.bench[loc.i] = it || null;
      else if (loc.z === 't') {
        cellAt(S, loc.c, loc.r).item = it || null;
        if (it) it.cdLeft = Math.max(it.cdLeft || 0, 0.3);
      }
      S.auraDirty = true;
    }
    G.side = side;
    G.cellAt = function (s, c, r) { return cellAt(side(s), c, r); };
    G.getItem = function (s, loc) { return getItem(side(s), loc); };
    G.cost = function (s) { var S = side(s || 0); return Math.min(CFG.costCap, CFG.costBase + CFG.costStep * S.summons); };
    G.freeTiles = function (s) { var n = 0; side(s).cells.forEach(function (ce) { if (!ce.path && !ce.block && !ce.lock && !ce.item) n++; }); return n; };
    G.lockedCount = function (s) { var n = 0; side(s).cells.forEach(function (ce) { if (!ce.path && !ce.block && ce.lock) n++; }); return n; };
    G.over = function () { return G.phase === 'won' || G.phase === 'lost'; };
    G.canSummon = function (s) { return !G.over() && side(s).mantou >= G.cost(s); };
    G.waveMult = function (n) { return L.hp * Math.pow(CFG.hpGrowth, (n || G.wave) - 1); };
    G.genMult = function () { return 1 + CFG.genGrowth * Math.max(0, G.wave - 1) / Math.max(1, L.waves - 1); };
    G.reward = function (base) { return Math.round(base * (1 + CFG.rewardGrowth * Math.max(0, G.wave - 1))); };
    G.combine = function (A, B) { return combineResult(A, B, content); };

    // ---------- 征兵：一次五张，替换备战席 ----------
    function holdings(S) {
      var h = {};
      function add(it) { if (it && it.t === 'c') h[it.ch] = (h[it.ch] || 0) + 1; }
      S.bench.forEach(add);
      S.cells.forEach(function (ce) { add(ce.item); });
      return h;
    }
    function ownedGenerals(S) {
      var o = {};
      S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'g') o[ce.item.k] = 1; });
      S.bench.forEach(function (it) { if (it && it.t === 'g') o[it.k] = 1; });
      return o;
    }
    function rollName(S, extra) {
      var hold = holdings(S), owned = ownedGenerals(S), want = [];
      (extra || []).forEach(function (it) { if (it && it.t === 'c') hold[it.ch] = (hold[it.ch] || 0) + 1; });
      NAME_RECIPES.forEach(function (nr) {
        if (content.gens.indexOf(nr[2]) < 0 || owned[nr[2]]) return;
        if (hold[nr[0]] && !hold[nr[1]]) want.push(nr[1]);
        if (hold[nr[1]] && !hold[nr[0]]) want.push(nr[0]);
      });
      if (want.length && S.rng() < CFG.pieceFocus) return { t: 'c', ch: want[(S.rng() * want.length) | 0] };
      var pool = [];
      content.gens.forEach(function (gk) {
        var w = owned[gk] ? 1 : 3;
        GENERALS[gk].chars.forEach(function (ch) { for (var i = 0; i < w; i++) pool.push(ch); });
      });
      return { t: 'c', ch: pool[(S.rng() * pool.length) | 0] };
    }
    function rollItem(S, batch) {
      var w = CFG.weights, hasNames = content.gens.length > 0;
      S.nameSince++;
      if (hasNames && S.nameSince >= CFG.namePity) { S.nameSince = 0; return rollName(S, batch); }
      var locked = G.lockedCount(S), shovelsIn = 0;
      batch.forEach(function (it) { if (it.t === 's') shovelsIn++; });
      var sw = locked > shovelsIn ? w.shovel : 0;
      if (sw && G.freeTiles(S) <= 1) sw *= 2.2;
      var nw = hasNames ? w.name : 0;
      var uw = content.units.map(function (k) { return UNITS_W[k] || 10; });
      var ut = uw.reduce(function (a, b) { return a + b; }, 0);
      var x = S.rng() * (ut + nw + sw);
      for (var i = 0; i < uw.length; i++) { if ((x -= uw[i]) < 0) return { t: 'u', k: content.units[i], lv: 1 }; }
      if ((x -= nw) < 0) { S.nameSince = 0; return rollName(S, batch); }
      return { t: 's' };
    }
    // 运气：把一张兵牌换成场上已有的同字（更易合并）
    function luckify(S, it) {
      if (!S.luck || it.t !== 'u' || S.rng() >= S.luck) return it;
      var ks = [];
      S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u' && ce.item.lv === 1) ks.push(ce.item.k); });
      return ks.length ? { t: 'u', k: ks[(S.rng() * ks.length) | 0], lv: 1 } : it;
    }
    G.summon = function (s) {
      var S = side(s);
      if (!G.canSummon(S)) return null;
      var cost = G.cost(S);
      S.mantou -= cost;
      S.summons++;
      S.stats.summons++;
      var lost = S.bench.filter(function (it) { return it; });
      S.stats.discards += lost.length;
      var batch = [];
      for (var i = 0; i < BENCH; i++) batch.push(luckify(S, rollItem(S, batch)));
      S.bench = batch;
      S.auraDirty = true;
      emit({ type: 'summon', s: S.id, items: batch.slice(), lost: lost, cost: cost });
      return batch;
    };

    // ---------- 拖放 ----------
    function value(it) {
      if (!it) return 0;
      if (it.t === 'u') return CFG.recycle.u * Math.pow(2, it.lv - 1);
      if (it.t === 'c') return CFG.recycle.c;
      if (it.t === 's') return CFG.recycle.s;
      return 0;
    }
    G.value = value;
    G.plan = function (s, from, to) {
      var S = side(s), A = getItem(S, from);
      if (!A || !to) return null;
      if (to.z === 'x') return A.t === 'g' ? { act: 'norecycle' } : { act: 'recycle', value: value(A) };
      if (from.z === to.z && from.i === to.i && from.c === to.c && from.r === to.r) return null;
      var B;
      if (to.z === 't') {
        var ce = cellAt(S, to.c, to.r);
        if (!ce || ce.path || ce.block) return null;
        if (ce.lock) return A.t === 's' ? { act: 'dig' } : null;
        if (A.t === 's') return null;
        B = ce.item;
        if (!B) return { act: from.z === 't' ? 'move' : 'place' };
      } else if (to.z === 'b') {
        if (to.i < 0 || to.i >= BENCH) return null;
        B = S.bench[to.i];
        if (!B) return { act: 'move' };
      } else return null;
      if (mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
      var res = combineResult(A, B, content);
      if (res) return { act: 'general', result: res };
      if (B.t === 's' && from.z === 't') return null;
      return { act: 'swap' };
    };
    G.apply = function (s, from, to) {
      var S = side(s);
      var p = G.plan(S, from, to);
      if (!p || p.act === 'norecycle') return p;
      var A = getItem(S, from), B = getItem(S, to);
      switch (p.act) {
        case 'recycle':
          setItem(S, from, null);
          S.mantou += p.value;
          emit({ type: 'recycle', s: S.id, from: from, value: p.value, item: A });
          break;
        case 'dig':
          setItem(S, from, null);
          cellAt(S, to.c, to.r).lock = false;
          emit({ type: 'dig', s: S.id, c: to.c, r: to.r, from: from });
          break;
        case 'place': case 'move':
          setItem(S, from, null); setItem(S, to, A);
          emit({ type: 'place', s: S.id, from: from, to: to, item: A });
          break;
        case 'swap':
          setItem(S, from, B); setItem(S, to, A);
          emit({ type: 'swap', s: S.id, from: from, to: to });
          break;
        case 'merge':
          setItem(S, from, null);
          B.lv = p.lv; B.cdLeft = 0.35;
          S.auraDirty = true;
          S.stats.merges++;
          if (p.lv > S.stats.maxTier) S.stats.maxTier = p.lv;
          emit({ type: 'merge', s: S.id, from: from, to: to, lv: p.lv, kind: B.k });
          break;
        case 'general':
          setItem(S, from, null);
          var it = { t: 'g', k: p.result.k, skLeft: 3, cdLeft: 0.4 };
          setItem(S, to, it);
          if (S.stats.generals.indexOf(it.k) < 0) S.stats.generals.push(it.k);
          emit({ type: 'general', s: S.id, from: from, to: to, k: it.k });
          break;
      }
      return p;
    };

    // ---------- 羁绊与光环 ----------
    function updateAura(S) {
      S.auraDirty = false;
      var gens = [], on = {};
      S.cells.forEach(function (ce) {
        if (ce.item && ce.item.t === 'g') { gens.push({ k: ce.item.k, x: ce.c + 0.5, y: ce.r + 0.5 }); on[ce.item.k] = 1; }
      });
      var syn = {};
      SYN_KEYS.forEach(function (sk) {
        var Y = SYNERGIES[sk], n = 0;
        Y.gens.forEach(function (g) { if (on[g]) n++; });
        if (n >= Y.need) syn[sk] = n;
      });
      SYN_KEYS.forEach(function (sk) {
        if (syn[sk] && (!S.syn[sk] || (sk === 'wuhu' && syn[sk] === 5 && S.syn[sk] < 5))) {
          emit({ type: 'synergy', s: S.id, k: sk, n: syn[sk], first: !S.synSeen[sk] });
          S.synSeen[sk] = 1;
        }
      });
      S.syn = syn;
      S.mods = {
        dmgAll: (on.liubei ? CFG.auraAll : 0) + (syn.taoyuan ? 0.2 : 0),
        skillCd: syn.wuhu ? (syn.wuhu >= 5 ? 0.6 : 0.8) : 1,
        skillDmg: syn.wolong ? 1.5 : 1,
        enemySlow: syn.beifa ? 0.12 : 0,
        genDmg: syn.beifa ? 0.25 : 0,
        daoDmg: syn.fuzi ? 0.3 : 0
      };
      var drums = [];
      S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u' && ce.item.k === 'gu') drums.push({ x: ce.c + 0.5, y: ce.r + 0.5, h: UNITS.gu.haste + 0.05 * (ce.item.lv - 1), rg: UNITS.gu.range }); });
      S.cells.forEach(function (ce) {
        var it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) return;
        var x = ce.c + 0.5, y = ce.r + 0.5, m = 1 + S.mods.dmgAll, buffs = 0;
        if (it.t === 'u') {
          var used = {};
          gens.forEach(function (g) {
            var a = GENERALS[g.k].aura;
            if (a !== 'all' && a.indexOf(it.k) >= 0 && !used[g.k] && dist(g.x, g.y, x, y) <= CFG.auraRange + 1e-6) { used[g.k] = 1; m += CFG.auraBonus; buffs++; }
          });
          if (it.k === 'dao') m += S.mods.daoDmg;
        } else m += S.mods.genDmg;
        it.aura = m;
        it.buffed = buffs;
        var h = 0;
        drums.forEach(function (d) { if (dist(d.x, d.y, x, y) <= d.rg + 1e-6 && !(d.x === x && d.y === y)) h = Math.max(h, d.h); });
        it.haste = h;
        it.rangeBonus = ce.high ? 0.5 : 0;
      });
    }
    G.updateAura = function (s) { if (s == null) G.sides.forEach(updateAura); else updateAura(side(s)); };

    // ---------- 波次（两边同一批敌军） ----------
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
    G.isBossWave = function (n) { return n === L.waves ? 'boss' : (n % 5 === 0 ? 'lieut' : ''); };
    function buildWave(n) {
      var count = Math.min(34, 8 + 2 * n);
      var mx = mixAt(n), list = [], tag = '';
      var special = (n % 4 === 3 && mx.list.some(function (x) { return x[0] === 'qi'; })) ? 'qi' : '';
      for (var i = 0; i < count; i++) {
        var t;
        if (special && wrng() < 0.55) t = special;
        else {
          var x = wrng() * mx.tot;
          t = mx.list[0][0];
          for (var j = 0; j < mx.list.length; j++) { x -= mx.list[j][1]; if (x < 0) { t = mx.list[j][0]; break; } }
        }
        list.push({ t: t, off: (wrng() - 0.5) * 0.3 });
      }
      if (special) tag = '轻骑突袭';
      var bw = G.isBossWave(n);
      if (bw === 'lieut') { list.splice(Math.floor(count * 0.5), 0, { t: 'lieut', off: 0 }); tag = '敌将 ' + L.lieut.name; }
      if (bw === 'boss') { list.splice(Math.floor(count * 0.45), 0, { t: 'boss', off: 0 }); tag = '决战 · ' + L.boss.name; }
      G.waveTag = tag;
      return list;
    }
    function spawn(S, type, d, off) {
      var mult = G.waveMult();
      var e = { id: G.eid++, type: type, d: d || 0, stun: 0, flash: 0, off: off || 0, x: 0, y: 0, dead: false,
        slowT: 0, burnT: 0, burn: 0, shredT: 0, shred: 0, vulnT: 0, linkT: 0, shield: 0, born: G.time };
      if (type === 'boss' || type === 'lieut') {
        var bd = type === 'boss' ? L.boss : L.lieut;
        e.boss = true; e.lieut = type === 'lieut'; e.name = bd.name; e.ch = bd.ch; e.spd = bd.spd; e.r = type === 'boss' ? 0.46 : 0.4;
        e.maxHp = ENEMIES.zu.hp * mult * bd.hpMul; e.reward = type === 'boss' ? 40 : 20; e.leak = type === 'boss' ? 2 : 1;
        e.res = FAC.res ? JSON.parse(JSON.stringify(FAC.res)) : null;
        e.def = bd; e.abT = 3;
        if (bd.dmgRes) e.dmgRes = bd.dmgRes;
        if (bd.revive) e.revive = bd.revive;
        e.stunRes = 0.5;
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
      S.enemies.push(e);
      return e;
    }
    G.spawn = function (s, type, d, off) { return spawn(side(s), type, d, off); };
    G.startWave = function () {
      if (G.phase !== 'prep' && G.phase !== 'break') return;
      G.wave++;
      G.queue = buildWave(G.wave);
      G.spawnT = 0.2;
      G.idleT = 0;
      G.phase = 'wave';
      emit({ type: 'wave', n: G.wave, tag: G.waveTag, last: G.wave === L.waves, boss: G.isBossWave(G.wave) });
    };
    G.callNext = function () { if (G.phase === 'prep' || G.phase === 'break') { G.holdTimer = false; G.startWave(); return true; } return false; };

    // ---------- 伤害 ----------
    var linking = false;
    function hurt(S, e, dmg, dtype) {
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
      e.flash = 0.1;
      S.stats.dmg += dmg;
      if (e.linkT > 0 && !linking && dmg > 0) {
        linking = true;
        for (var i = 0; i < S.enemies.length; i++) {
          var o = S.enemies[i];
          if (o !== e && !o.dead && o.linkT > 0) hurt(S, o, dmg * 0.4, 'phys');
        }
        linking = false;
      }
      if (e.hp <= 0) kill(S, e);
      return dmg;
    }
    function kill(S, e) {
      if (e.revive) {
        e.hp = e.maxHp * e.revive; e.revive = 0; e.stun = 1.2;
        emit({ type: 'revive', s: S.id, x: e.x, y: e.y, name: e.name, eid: e.id });
        return;
      }
      e.dead = true;
      S.mantou += e.reward;
      S.stats.kills++;
      emit({ type: 'kill', s: S.id, x: e.x, y: e.y, reward: e.reward, boss: !!e.boss, lieut: !!e.lieut, name: e.name, etype: e.type, ch: e.ch, r: e.r, eid: e.id });
    }
    G.hurt = function (s, e, dmg, dtype) { return hurt(side(s), e, dmg, dtype); };

    function findTarget(S, x, y, range) {
      var best = null;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.dead || e.d < 0.4) continue;
        if (dist(x, y, e.x, e.y) <= range && (!best || e.d > best.d)) best = e;
      }
      return best;
    }
    function inRadius(S, x, y, rad, fn) {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (!e.dead && dist(x, y, e.x, e.y) <= rad + e.r * 0.3) fn(e);
      }
    }
    function lineHits(S, x, y, dx, dy, len, width, fn) {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.dead) continue;
        var px = e.x - x, py = e.y - y, t = px * dx + py * dy;
        if (t < -0.1 || t > len + 0.2) continue;
        if (Math.abs(px * dy - py * dx) <= width + e.r * 0.4) fn(e);
      }
    }
    function liveEnemies(S) { return S.enemies.filter(function (e) { return !e.dead && e.d > 0.4; }); }

    // 延迟结算：o.e 单体 / o.area 范围 / o.line 直线
    function pend(S, t, o) { o.t = t; S.pend.push(o); }
    function applyHit(S, e, o) {
      hurt(S, e, o.dmg, o.dtype);
      if (e.dead) return;
      if (o.stun) e.stun = Math.max(e.stun, o.stun * (1 - (e.stunRes || 0)));
      if (o.burn) { e.burnT = 3; e.burn = Math.max(e.burn, o.burn); }
      if (o.shred) { e.shredT = 3; e.shred = Math.max(e.shred, o.shred); }
      if (o.vuln) e.vulnT = Math.max(e.vulnT, o.vuln);
      if (o.link) e.linkT = Math.max(e.linkT, o.link);
    }
    function resolve(S, o) {
      if (o.e) {
        if (!o.e.dead) applyHit(S, o.e, o);
        if (o.area) { var cx = o.e.dead ? o.area[0] : o.e.x, cy = o.e.dead ? o.area[1] : o.e.y; inRadius(S, cx, cy, o.area[2], function (en) { if (en !== o.e) applyHit(S, en, o); }); }
      } else if (o.area) {
        inRadius(S, o.area[0], o.area[1], o.area[2], function (en) { applyHit(S, en, o); });
      } else if (o.line) {
        var l = o.line;
        lineHits(S, l[0], l[1], l[2], l[3], l[4], l[5], function (en) { applyHit(S, en, o); });
      } else if (o.fn) o.fn();
    }

    // ---------- 出手 ----------
    function unitDmg(S, it) {
      if (it.t === 'u') return UNITS[it.k].dmg * TIER_MULT[it.lv - 1] * (it.aura || 1);
      return GENERALS[it.k].dmg * G.genMult() * (it.aura || 1);
    }
    function attack(S, it, ce, tgt) {
      var x = ce.c + 0.5, y = ce.r + 0.5;
      var def = it.t === 'u' ? UNITS[it.k] : GENERALS[it.k];
      var dmg = unitDmg(S, it), dtype = def.dtype || 'phys';
      var dx = tgt.x - x, dy = tgt.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      var ev = { type: 'atk', s: S.id, c: ce.c, r: ce.r, mode: def.mode, kind: it.t === 'u' ? it.k : null, gk: it.t === 'g' ? it.k : null, lv: it.lv || 0,
        tx: tgt.x, ty: tgt.y, eid: tgt.id, hit: def.hit || 0 };
      var hit = def.hit || 0;
      switch (def.mode) {
        case 'melee':
          pend(S, hit, { e: tgt, dmg: dmg, dtype: dtype });
          break;
        case 'thrust':
          var len = (def.len || 2) + (it.rangeBonus || 0);
          pend(S, hit, { line: [x, y, dx, dy, len, 0.32], dmg: dmg, dtype: dtype });
          ev.len = len;
          break;
        case 'gallop':
          pend(S, hit, { e: tgt, area: [tgt.x, tgt.y, def.splash || 0.8], dmg: dmg, dtype: dtype });
          ev.rad = def.splash;
          break;
        case 'arrow': case 'fire':
          S.projs.push({ kind: ev.kind || ev.gk, gen: !!ev.gk, mode: def.mode, x: x, y: y, sx: x, sy: y, tgt: tgt, dmg: dmg, dtype: dtype,
            burn: def.burn ? dmg * def.burn : 0, delay: hit, ang: Math.atan2(dy, dx), t: 0, id: G.eid++ });
          break;
        case 'bolt':
          var bl = (def.len || 3) + (it.rangeBonus || 0);
          S.projs.push({ kind: ev.kind, mode: 'bolt', x: x, y: y, sx: x, sy: y, dx: dx, dy: dy, len: bl, trav: 0, dmg: dmg, dtype: dtype, shred: def.shred, hit: {}, delay: hit, t: 0, id: G.eid++ });
          break;
        case 'lob':
          var lead = Math.min(1.2, tgt.spd * 1.0);
          var land = posAt(P, tgt.d + lead, tgt.off, {});
          S.projs.push({ kind: ev.kind, mode: 'lob', x: x, y: y, sx: x, sy: y, tx: land.x, ty: land.y, t: 0, T: 0.85, h: 0, dmg: dmg, dtype: dtype, splash: def.splash, delay: hit, id: G.eid++ });
          ev.tx = land.x; ev.ty = land.y;
          break;
      }
      emit(ev);
    }

    // ---------- 武将技能 ----------
    function castSkill(S, it, ce) {
      var x = ce.c + 0.5, y = ce.r + 0.5, k = it.k, def = GENERALS[k];
      var base = def.dmg * G.genMult() * (it.aura || 1) * S.mods.skillDmg;
      var live = liveEnemies(S);
      var ev = { type: 'skill', s: S.id, k: k, c: ce.c, r: ce.r, x: x, y: y };
      if (k === 'liubei') {
        if (S.hearts < HEARTS) { pend(S, 0.9, { fn: function () { if (!G.over() && S.hearts < HEARTS) { S.hearts++; emit({ type: 'heal', s: S.id }); } } }); ev.heal = 1; }
        else { ev.gold = 8 + G.wave * 2; S.mantou += ev.gold; }
        emit(ev);
        return true;
      }
      if (k === 'guanping') {
        if (!live.length) return false;
        var allies = [];
        S.cells.forEach(function (c2) {
          if (c2 !== ce && c2.item && (c2.item.t === 'u' || c2.item.t === 'g') && dist(c2.c + 0.5, c2.r + 0.5, x, y) <= 1.6) { c2.item.rushT = 4.4; allies.push([c2.c + 0.5, c2.r + 0.5]); }
        });
        var tp = findTarget(S, x, y, 2.4);
        if (tp) pend(S, 0.45, { e: tp, dmg: base * 3, dtype: 'phys' });
        ev.pts = allies; ev.rad = 1.6;
        if (tp) { ev.x2 = tp.x; ev.y2 = tp.y; }
        emit(ev);
        return true;
      }
      if (!live.length) return false;
      if (k === 'zhaoyun') {
        var near = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.6; });
        if (!near.length) return false;
        near.sort(function (a, b) { return a.d - b.d; });
        near = near.slice(-7);
        ev.pts = near.map(function (e) { return [e.x, e.y]; });
        near.forEach(function (e, i) { pend(S, 0.35 + i * 0.09, { e: e, dmg: base * 6, dtype: 'phys' }); });
      } else if (k === 'zhangfei') {
        var any = false;
        inRadius(S, x, y, 2.5, function () { any = true; });
        if (!any) return false;
        pend(S, 0.45, { area: [x, y, 2.5], dmg: base * 1.5, dtype: 'phys', stun: 1.6 });
        ev.rad = 2.5;
      } else if (k === 'guanyu') {
        var tg = findTarget(S, x, y, 2.1);
        if (!tg) return false;
        pend(S, 0.5, { area: [x, y, 2.1], dmg: base * 4, dtype: 'phys' });
        ev.rad = 2.1; ev.ang = Math.atan2(tg.y - y, tg.x - x);
      } else if (k === 'machao') {
        var t2 = findTarget(S, x, y, 3);
        if (!t2) return false;
        var dx = t2.x - x, dy = t2.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= l; dy /= l;
        pend(S, 0.45, { line: [x, y, dx, dy, 4.5, 0.5], dmg: base * 5, dtype: 'phys' });
        ev.x2 = x + dx * 4.5; ev.y2 = y + dy * 4.5; ev.ang = Math.atan2(dy, dx);
      } else if (k === 'huangzhong') {
        var top = live[0];
        live.forEach(function (e) { if (e.hp > top.hp) top = e; });
        ev.x2 = top.x; ev.y2 = top.y; ev.eid = top.id;
        pend(S, 0.7, { e: top, dmg: base * 6, dtype: 'arrow' });
      } else if (k === 'kongming') {
        var hit = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.5; });
        if (!hit.length) return false;
        hit.forEach(function (e) { pend(S, 0.55 + Math.min(0.5, dist(x, y, e.x, e.y) * 0.1), { e: e, dmg: base * 3, dtype: 'fire', burn: base * 0.5 }); });
        var pts = [], p = {};
        for (var d = 0; d < P.len; d += 0.5) { posAt(P, d, 0, p); if (dist(x, y, p.x, p.y) <= 3.5) pts.push([p.x, p.y]); }
        ev.pts = pts; ev.rad = 3.5;
      } else if (k === 'pangtong') {
        var c0 = findTarget(S, x, y, 3.2);
        if (!c0) return false;
        var grp = live.filter(function (e) { return dist(c0.x, c0.y, e.x, e.y) <= 2.2; });
        grp.sort(function (a, b) { return dist(c0.x, c0.y, a.x, a.y) - dist(c0.x, c0.y, b.x, b.y); });
        grp = grp.slice(0, 6);
        grp.forEach(function (e) { pend(S, 0.5, { e: e, dmg: base * 1.2, dtype: 'phys', link: 6 }); });
        ev.pts = grp.map(function (e) { return [e.x, e.y]; }); ev.eids = grp.map(function (e) { return e.id; });
      } else if (k === 'weiyan') {
        var hit2 = 0;
        inRadius(S, x, y, 2.5, function () { hit2++; });
        if (!hit2) return false;
        pend(S, 0.4, { area: [x, y, 2.5], dmg: base * 2, dtype: 'phys', vuln: 5 });
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
        pend(S, 0.45, { area: [best.x, best.y, 1.3], dmg: base * 4, dtype: 'phys', stun: 0.7 });
        ev.x2 = best.x; ev.y2 = best.y; ev.rad = 1.3;
      }
      emit(ev);
      return true;
    }

    // ---------- 敌将 ----------
    function bossAbility(S, e, dt) {
      var bd = e.def;
      e.abT -= dt;
      if (bd.summon && e.abT <= 0 && e.d > 1) {
        e.abT = bd.summon.every;
        for (var i = 0; i < bd.summon.n; i++) spawn(S, bd.summon.type || 'zu', Math.max(0, e.d - 0.4 - i * 0.4), (i - 0.5) * 0.2);
        emit({ type: 'bossAct', s: S.id, act: 'summon', x: e.x, y: e.y, name: e.name });
      }
      if (bd.swarm && e.abT <= 0 && e.d > 1) {
        e.abT = bd.swarm.every;
        for (var j = 0; j < bd.swarm.n; j++) spawn(S, 'qi', Math.max(0, e.d - 0.5 - j * 0.35), 0);
        emit({ type: 'bossAct', s: S.id, act: 'swarm', x: e.x, y: e.y, name: e.name });
      }
      if (bd.charge) {
        if (e.chargeT > 0) e.chargeT -= dt;
        if (e.abT <= 0) { e.abT = bd.charge.every; e.chargeT = bd.charge.dur; emit({ type: 'bossAct', s: S.id, act: 'charge', x: e.x, y: e.y, name: e.name }); }
      }
      if (bd.rage && !e.raged && e.hp < e.maxHp * 0.5) { e.raged = true; e.spd *= 1.6; emit({ type: 'bossAct', s: S.id, act: 'rage', x: e.x, y: e.y, name: e.name }); }
      if (bd.shield && e.abT <= 0) { e.abT = bd.shield.every; e.shield = e.maxHp * bd.shield.frac; emit({ type: 'bossAct', s: S.id, act: 'shield', x: e.x, y: e.y, name: e.name }); }
      if (bd.burnUnits && e.abT <= 0 && e.d > 1) {
        e.abT = bd.burnUnits.every;
        var hitU = [];
        S.cells.forEach(function (ce) {
          if (ce.item && (ce.item.t === 'u' || ce.item.t === 'g') && dist(ce.c + 0.5, ce.r + 0.5, e.x, e.y) <= bd.burnUnits.range) { ce.item.burnT = bd.burnUnits.dur; hitU.push([ce.c + 0.5, ce.r + 0.5]); }
        });
        emit({ type: 'bossAct', s: S.id, act: 'burn', x: e.x, y: e.y, name: e.name, pts: hitU, rad: bd.burnUnits.range });
      }
    }

    // ---------- 结局 ----------
    function finish(winner, reason) {
      if (G.over()) return;
      G.phase = winner === 0 ? 'won' : 'lost';
      var me = G.sides[0];
      G.stars = winner === 0 ? Math.max(1, me.hearts) : 0;
      G.result = { winner: winner, reason: reason, hearts: [G.sides[0].hearts, G.sides[1].hearts], stars: G.stars };
      emit({ type: winner === 0 ? 'win' : 'lose', reason: reason, stars: G.stars });
    }
    G.finish = finish;

    // ---------- 单边推进 ----------
    var shields = [];
    function stepSide(S, dt) {
      if (S.auraDirty) updateAura(S);
      var i, e;
      // 延迟结算
      if (S.pend.length) {
        var list = S.pend;
        S.pend = [];
        for (i = 0; i < list.length; i++) {
          var o = list[i];
          o.t -= dt;
          if (o.t <= 0) resolve(S, o); else S.pend.push(o);
        }
      }
      shields.length = 0;
      for (i = 0; i < S.cells.length; i++) {
        var cs = S.cells[i];
        if (cs.item && cs.item.t === 'u' && cs.item.k === 'dun') shields.push(cs.c + 0.5, cs.r + 0.5, UNITS.dun.slow + 0.05 * (cs.item.lv - 1));
      }
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i];
        if (e.dead) continue;
        if (e.flash > 0) e.flash -= dt;
        if (e.shredT > 0) e.shredT -= dt;
        if (e.vulnT > 0) e.vulnT -= dt;
        if (e.linkT > 0) e.linkT -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnAcc = (e.burnAcc || 0) + dt;
          if (e.burnAcc >= 0.5) { e.burnAcc = 0; hurt(S, e, e.burn * 0.5, 'fire'); if (e.dead) continue; }
        }
        if (e.boss) bossAbility(S, e, dt);
        var slow = 0;
        for (var s = 0; s < shields.length; s += 3) if (dist(shields[s], shields[s + 1], e.x, e.y) <= UNITS.dun.range) slow = Math.max(slow, shields[s + 2]);
        if (G.floodOn > 0) slow = Math.max(slow, L.flood.slow);
        e.slowed = slow;
        var spd = e.spd * (1 - slow) * (1 - (S.mods.enemySlow || 0)) * (e.chargeT > 0 ? e.def.charge.mult : 1);
        if (e.stun > 0) e.stun -= dt;
        else e.d += spd * dt;
        if (e.d >= P.len) {
          e.dead = true; e.leaked = true;
          var loss = e.leak || 1;
          S.hearts = Math.max(0, S.hearts - loss);
          S.stats.leaks++;
          emit({ type: 'leak', s: S.id, loss: loss, boss: !!e.boss, ch: e.ch, eid: e.id });
          if (S.hearts <= 0) { finish(1 - S.id, 'hearts'); return; }
          continue;
        }
        posAt(P, e.d, e.off, e);
      }

      for (i = 0; i < S.cells.length; i++) {
        var ce = S.cells[i], it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) continue;
        if (it.burnT > 0) it.burnT -= dt;
        if (it.rushT > 0) it.rushT -= dt;
        var spdMul = (1 + (it.haste || 0) + (it.rushT > 0 ? 0.6 : 0)) * (it.burnT > 0 ? 0.5 : 1);
        if (it.t === 'g') {
          it.skLeft = (it.skLeft == null ? 3 : it.skLeft) - dt;
          if (it.skLeft <= 0 && G.phase === 'wave') {
            if (castSkill(S, it, ce)) { it.skLeft = GENERALS[it.k].skillCd * S.mods.skillCd; it.cdLeft = Math.max(it.cdLeft || 0, 1.1); continue; }
            it.skLeft = 0;
          }
        }
        it.cdLeft = (it.cdLeft || 0) - dt * spdMul;
        if (it.cdLeft > 0) continue;
        var def = it.t === 'u' ? UNITS[it.k] : GENERALS[it.k];
        if (def.mode === 'drum') {
          if (G.phase === 'wave' && liveEnemies(S).length) { it.cdLeft = def.cd; emit({ type: 'drum', s: S.id, c: ce.c, r: ce.r, rad: def.range }); }
          else it.cdLeft = 0;
          continue;
        }
        var range = def.range + (it.rangeBonus || 0);
        if (def.mode === 'pulse') {
          var any = false;
          inRadius(S, ce.c + 0.5, ce.r + 0.5, range, function () { any = true; });
          if (any) {
            pend(S, def.hit, { area: [ce.c + 0.5, ce.r + 0.5, range], dmg: unitDmg(S, it), dtype: 'phys' });
            it.cdLeft += def.cd;
            emit({ type: 'atk', s: S.id, c: ce.c, r: ce.r, mode: 'pulse', kind: it.k, lv: it.lv, rad: range, hit: def.hit });
          } else it.cdLeft = 0;
          continue;
        }
        var tgt = findTarget(S, ce.c + 0.5, ce.r + 0.5, range);
        if (!tgt) { it.cdLeft = 0; continue; }
        attack(S, it, ce, tgt);
        it.cdLeft += def.cd;
      }

      // 投射物
      for (i = 0; i < S.projs.length; i++) {
        var p = S.projs[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.t += dt;
        if (p.mode === 'lob') {
          var k = p.t / p.T;
          p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.h = Math.sin(Math.min(1, k) * Math.PI);
          if (k >= 1) {
            p.done = true;
            inRadius(S, p.tx, p.ty, p.splash, function (en) { hurt(S, en, p.dmg, p.dtype); });
            emit({ type: 'boom', s: S.id, x: p.tx, y: p.ty, rad: p.splash });
          }
          continue;
        }
        if (p.mode === 'bolt') {
          var mvl = CFG.boltSpeed * dt;
          p.trav += mvl;
          p.x += p.dx * mvl; p.y += p.dy * mvl;
          lineHits(S, p.x - p.dx * mvl, p.y - p.dy * mvl, p.dx, p.dy, mvl, 0.3, function (en) {
            if (p.hit[en.id]) return;
            p.hit[en.id] = 1;
            applyHit(S, en, p);
            emit({ type: 'pierce', s: S.id, x: en.x, y: en.y, kind: p.kind });
          });
          if (p.trav >= p.len) p.done = true;
          continue;
        }
        var t = p.tgt;
        if (t.dead) { p.done = true; emit({ type: 'fizzle', s: S.id, x: p.x, y: p.y, mode: p.mode }); continue; }
        var dx = t.x - p.x, dy = t.y - p.y, l = Math.sqrt(dx * dx + dy * dy);
        var mv = CFG.arrowSpeed * dt * (p.mode === 'fire' ? 0.8 : 1);
        p.ang = Math.atan2(dy, dx);
        if (l <= mv + 0.12) {
          p.done = true;
          applyHit(S, t, p);
          emit({ type: 'hit', s: S.id, x: t.x, y: t.y, mode: p.mode, kind: p.kind, gen: p.gen });
        } else {
          p.x += (dx / l) * mv; p.y += (dy / l) * mv;
        }
      }
      if (S.projs.length) {
        var keep = [];
        for (i = 0; i < S.projs.length; i++) if (!S.projs[i].done) keep.push(S.projs[i]);
        S.projs = keep;
      }
      if (S.enemies.length) {
        var alive = [];
        for (i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead) alive.push(S.enemies[i]);
        S.enemies = alive;
      }
    }

    // ---------- 主循环 ----------
    G.step = function (dt) {
      if (G.over()) return;
      G.time += dt;
      if (G.phase === 'prep' || G.phase === 'break') {
        if (!G.holdTimer) G.timer -= dt;
        if (G.timer <= 0) G.startWave();
      }
      if (G.phase === 'wave') {
        G.spawnT -= dt;
        if (G.queue.length && G.spawnT <= 0) {
          var q = G.queue.shift();
          G.sides.forEach(function (S) { spawn(S, q.t, 0, q.off); });
          if (q.t === 'boss' || q.t === 'lieut') emit({ type: 'boss', name: (q.t === 'boss' ? L.boss : L.lieut).name, lieut: q.t === 'lieut' });
          G.spawnT += 1.3 - 0.55 * (G.wave - 1) / Math.max(1, L.waves - 1);
        }
        if (L.flood) {
          G.floodT += dt;
          if (G.floodT >= L.flood.every) { G.floodT = 0; G.floodOn = L.flood.dur; emit({ type: 'flood' }); }
        }
      }
      if (G.floodOn > 0) G.floodOn -= dt;
      for (var i = 0; i < 2; i++) { stepSide(G.sides[i], dt); if (G.over()) return; }
      if (G.phase === 'wave' && !G.queue.length) {
        var left = G.sides[0].enemies.length + G.sides[1].enemies.length;
        G.idleT += dt;
        var lastWave = G.wave >= L.waves;
        if (lastWave) {
          if (!left) {
            var h0 = G.sides[0].hearts, h1 = G.sides[1].hearts;
            finish(h0 >= h1 ? 0 : 1, h0 > h1 ? 'hearts-more' : h0 === h1 ? 'tie' : 'hearts-less');
          }
        } else if (!left || G.idleT >= CFG.overlap) {
          G.sides.forEach(function (S) { var b = CFG.waveBonus + CFG.waveBonusGrowth * (G.wave - 1); S.mantou += b; });
          emit({ type: 'clear', n: G.wave, bonus: CFG.waveBonus + CFG.waveBonusGrowth * (G.wave - 1) });
          G.phase = 'break';
          G.timer = CFG.breakTime;
        }
      }
    };
    G.drain = function () { var e = G.ev; G.ev = []; return e; };
    G.updateAura();
    return G;
  }

  // =====================================================================
  // AI / 机器人：同一套规则与经济。p: {tick, mistake, mergeSkip, jitter, smart}
  function createBot(G, sid, p, seed) {
    p = p || {};
    var S = G.sides[sid], P = G.P;
    var s0 = (seed == null ? G.seed * 13 + sid * 977 + 5 : seed) | 0;
    var rng = mulberry32(s0);
    var cc = {};
    var cov = function (c, r, R) { var k = c + ',' + r + ',' + R; if (cc[k] == null) cc[k] = coverage(P, c, r, R); return cc[k]; };
    var T = function (c, r) { return { z: 't', c: c, r: r }; }, B = function (i) { return { z: 'b', i: i }; };
    var tiles = function () { return S.cells.filter(function (ce) { return !ce.path && !ce.block; }); };
    var rangeOf = function (it) { return it.t === 'u' ? UNITS[it.k].range : GENERALS[it.k] ? GENERALS[it.k].range : 2; };
    var val = function (it) { return it.t === 'g' ? 1000 : it.t === 'u' ? Math.pow(2, it.lv) * (it.k === 'gu' ? 0.8 : 1) : it.t === 'c' ? 1.5 : 0; };
    var mistake = p.mistake || 0, mergeSkip = p.mergeSkip || 0, ignored = [];
    var skip = function (it) { return ignored.indexOf(it) >= 0; };
    function tileScore(ce, it) {
      if (it.t === 'c') return -cov(ce.c, ce.r, 1.6); // 名字残片放在不重要的位置
      if (it.t === 'u' && it.k === 'gu') {
        var n = 0;
        tiles().forEach(function (o) { if (o !== ce && o.item && (o.item.t === 'u' || o.item.t === 'g') && Math.hypot(o.c - ce.c, o.r - ce.r) <= 1.5) n += o.item.t === 'g' ? 3 : o.item.lv; });
        return n;
      }
      return cov(ce.c, ce.r, rangeOf(it) + (ce.high ? 0.5 : 0));
    }
    function bestFree(it) {
      var fr = tiles().filter(function (ce) { return !ce.lock && !ce.item; });
      if (!fr.length) return null;
      if (rng() < mistake) return fr[(rng() * fr.length) | 0];
      var best = null, bs = -1e9;
      fr.forEach(function (ce) { var v = tileScore(ce, it); if (v > bs) { bs = v; best = ce; } });
      return best;
    }
    function partnerOnBoard(it) {
      // 名字牌能凑成武将的另一半位置
      var locs = [];
      S.bench.forEach(function (o, i) { if (o && o !== it && G.combine(it, o)) locs.push(B(i)); });
      S.cells.forEach(function (ce) { if (ce.item && G.combine(it, ce.item)) locs.push(T(ce.c, ce.r)); });
      return locs;
    }
    function one() {
      var i, it, f;
      // 1) 名字合成武将
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i]; if (it && skip(it)) continue;
        if (it && it.t === 'c') {
          var ps = partnerOnBoard(it);
          if (ps.length) {
            var tl = ps.filter(function (l) { return l.z === 't'; });
            if (tl.length) { G.apply(sid, B(i), tl[0]); return true; }
            // 两张都在备战席：先把一张放上场，再合
            f = bestFree({ t: 'g', k: 'x' });
            if (f) { G.apply(sid, ps[0], T(f.c, f.r)); return true; }
          }
        }
      }
      // 2) 铲子挖地
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i]; if (it && skip(it)) continue;
        if (it && it.t === 's') {
          var best = null, bs = -1;
          tiles().forEach(function (ce) { if (ce.lock) { var v = rng() < mistake ? rng() : cov(ce.c, ce.r, 1.6) + cov(ce.c, ce.r, 3.2) * 0.3; if (v > bs) { bs = v; best = ce; } } });
          if (best) { G.apply(sid, B(i), T(best.c, best.r)); return true; }
        }
      }
      // 3) 兵牌：合并 > 空位 > 替换弱兵
      var order = [0, 1, 2, 3, 4].sort(function (a, b) { return (S.bench[b] ? val(S.bench[b]) : -1) - (S.bench[a] ? val(S.bench[a]) : -1); });
      for (var oi = 0; oi < BENCH; oi++) {
        i = order[oi]; it = S.bench[i]; if (it && skip(it)) continue;
        if (!it || it.t !== 'u') continue;
        if (rng() >= mergeSkip) {
          var m = tiles().filter(function (ce) { return ce.item && mergeable(it, ce.item); });
          if (m.length) { m.sort(function (a, b) { return tileScore(b, it) - tileScore(a, it); }); G.apply(sid, B(i), T(m[0].c, m[0].r)); return true; }
          for (var j = 0; j < BENCH; j++) if (j !== i && S.bench[j] && mergeable(it, S.bench[j])) { G.apply(sid, B(i), B(j)); return true; }
        }
        f = bestFree(it);
        if (f) { G.apply(sid, B(i), T(f.c, f.r)); return true; }
      }
      // 4) 场上同字合并
      var us = tiles().filter(function (ce) { return ce.item && ce.item.t === 'u'; });
      if (rng() >= mergeSkip) {
        for (var a = 0; a < us.length; a++) for (var b2 = a + 1; b2 < us.length; b2++) {
          if (mergeable(us[a].item, us[b2].item)) {
            var x = us[a], y = us[b2];
            if (tileScore(x, x.item) > tileScore(y, y.item)) { var tmp = x; x = y; y = tmp; }
            G.apply(sid, T(x.c, x.r), T(y.c, y.r));
            return true;
          }
        }
      }
      // 5) 名字残片：有空位且将来可能凑齐就先放着
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i]; if (it && skip(it)) continue;
        if (it && it.t === 'c' && G.freeTiles(sid) > 1 && rng() > mistake) {
          var own = false;
          S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'c' && ce.item.ch === it.ch) own = true; });
          if (!own) { f = bestFree(it); if (f) { G.apply(sid, B(i), T(f.c, f.r)); return true; } }
        }
      }
      // 6) 板满：用备战席里更强的兵替换最弱的（被换下的回到备战席）
      if (G.freeTiles(sid) === 0 && rng() > mistake) {
        for (i = 0; i < BENCH; i++) {
          it = S.bench[i]; if (it && skip(it)) continue;
          if (!it || it.t !== 'u') continue;
          var w = null;
          us.forEach(function (ce) { if (val(ce.item) < val(it) && (!w || val(ce.item) < val(w.item))) w = ce; });
          if (w) { G.apply(sid, B(i), T(w.c, w.r)); return true; }
        }
      }
      return false;
    }
    function act() {
      for (var guard = 0; guard < 25; guard++) if (!one()) break;
      // 收尾：回收备战席剩余（反正下次征兵会被替换），再征兵
      if (G.canSummon(sid)) {
        if (p.smart == null || rng() < 0.4 + p.smart) {
          for (var i = 0; i < BENCH; i++) { var it = S.bench[i]; if (it && it.t !== 'g') G.apply(sid, B(i), { z: 'x' }); }
        }
        if (G.canSummon(sid)) {
          var got = G.summon(sid) || [];
          ignored = got.filter(function () { return rng() < (p.waste || 0); });
          for (var g2 = 0; g2 < 25; g2++) if (!one()) break;
        }
      }
    }
    var t = (p.tick || 1) * rng();
    return {
      act: act,
      update: function (dt) {
        if (G.over()) return;
        t -= dt;
        if (t <= 0) { t = (p.tick || 1) * (1 + (p.jitter || 0) * (rng() - 0.5)); act(); }
      }
    };
  }

  var API = {
    COLS: COLS, ROWS: ROWS, HEARTS: HEARTS, BENCH: BENCH, TIER_MULT: TIER_MULT, UNITS: UNITS, KINDS: KINDS,
    GENERALS: GENERALS, GEN_KEYS: GEN_KEYS, NAME_RECIPES: NAME_RECIPES, SYNERGIES: SYNERGIES, SYN_KEYS: SYN_KEYS,
    ENEMIES: ENEMIES, FACTIONS: FACTIONS, LEVELS: LEVELS, PATHS: PATHS, CFG: CFG, UNITS_W: UNITS_W,
    posAt: posAt, coverage: coverage, levelContent: levelContent, combineResult: combineResult, mergeable: mergeable,
    buildPath: buildPath, createGame: createGame, createBot: createBot, aiParams: aiParams, mulberry32: mulberry32
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ZYCore = API;
})(this);
