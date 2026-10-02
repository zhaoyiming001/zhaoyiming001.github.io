/* 赵云与阿斗 v5 · 核心规则（不依赖 DOM，浏览器与 Node 均可运行）
 * 双方对垒：下半场是玩家，上半场是 AI 对手；同一批敌军同时进攻两边，各守各的阿斗（3 颗心）。
 * 武将占两格：名字字牌按阅读顺序左右相邻即成将（如 赵 在左、云 在右），等级取两字中较低者。
 * 数值对齐原作：刀 射程 1 攻 3、骑 1.5/2 范围、枪 2/2 穿刺、弓 3/2 单体；每升一阶攻击与攻速各 ×1.346（五阶 ×3.28）；
 * 开局 20 馒头，征兵 10 起每次 +2、补满空候补格；杀敌 +1，阿斗失一心补 10。
 * 段位：军士 → 皇帝 共 11 段，每段若干小级，每级 5 星；段位决定可选战场、波数与敌军强度，AI 对手随段位变强。 */
(function (root) {
  'use strict';

  var COLS = 8, ROWS = 5, HEARTS = 3, BENCH = 5;
  // 每升一阶：攻击 ×1.346、攻速 ×1.346（五阶各为 ×3.28）
  var TIER_ATK = [1, 1.346, 1.811, 2.438, 3.28];
  var TIER_SPD = [1, 1.346, 1.811, 2.438, 3.28];
  var TIER_MULT = TIER_ATK.map(function (v, i) { return v * TIER_SPD[i]; }); // 理论输出倍率（攻 × 速）
  var GEN_TIER = [1, 1.811, 3.28, 5.94, 10.76];
  var RANGE_PAD = 0.18; // 敌人身形：射程判定多给一点

  // ---------- 兵种：字即是兵 ----------
  // mode: melee 单体 / thrust 直线穿刺 / arrow 箭 / fire 火球 / gallop 冲阵溅射 / pulse 涟漪 / bolt 弩矢穿透 / lob 抛石 / drum 战鼓
  // hit: 动画中兵器命中（或出手）的时刻（秒），核心按此延迟结算，使画面与伤害同步
  // 原作四兵：理论输出 攻 × 频率 × 射程 × 目标数，骑 / 枪 / 弓 五阶相同（80.4），刀为一半（40.2）但单体最痛
  // cd：一阶出手间隔（频率 1.245 次/秒）；hit：动画中兵器命中的时刻（秒）
  var UNITS = {
    dao: { ch: '刀', name: '刀', mode: 'melee', range: 1, dmg: 3, cd: 0.8, hit: 0.17, targets: 1, dtype: 'phys', desc: '近战单体 · 射程 1 · 攻 3：「丿」飞斩，贴路摆最狠' },
    qiang: { ch: '枪', name: '枪', mode: 'thrust', range: 2, dmg: 2, cd: 0.8, hit: 0.14, len: 2, targets: 1.5, dtype: 'phys', desc: '中程穿刺 · 射程 2 · 攻 2：「木」化长枪，一刺穿透一线' },
    gong: { ch: '弓', name: '弓', mode: 'arrow', range: 3, dmg: 2, cd: 0.8, hit: 0.14, targets: 1, dtype: 'arrow', desc: '远程单体 · 射程 3 · 攻 2：「弓」字拉满放箭' },
    qi: { ch: '骑', name: '骑', mode: 'gallop', range: 1.5, dmg: 2, cd: 0.8, hit: 0.26, splash: 0.75, targets: 2, dtype: 'phys', desc: '近战范围 · 射程 1.5 · 攻 2：「马」奔出践踏一片' },
    nong: { ch: '农', name: '农民', mode: 'farm', range: 0, dmg: 0, cd: 6, yield: 1, desc: '不打仗，种地：开战后每 6 秒产 1 馒头（升阶更快更多）' },
    // 以下为旧版兵种（原作没有，战场不再发放，仅保留定义以兼容）
    dun: { ch: '盾', name: '盾', mode: 'pulse', range: 1.45, dmg: 1, cd: 1.2, hit: 0.12, slow: 0.3, dtype: 'phys', desc: '「盾」震出涟漪：减速并小伤周围敌人' },
    huo: { ch: '火', name: '火', mode: 'fire', range: 3.0, dmg: 1.5, cd: 0.7, hit: 0.16, burn: 0.6, dtype: 'fire', desc: '「火」苗化作火球，点燃敌军' },
    gu: { ch: '鼓', name: '鼓', mode: 'drum', range: 1.5, dmg: 0, cd: 1.6, haste: 0.2, desc: '「支」击「壴」：身边友军攻速 +20%（每级 +5%）' },
    nu: { ch: '弩', name: '弩', mode: 'bolt', range: 3.0, dmg: 3.5, cd: 1.5, hit: 0.2, len: 3.6, shred: 0.15, dtype: 'arrow', desc: '「弓」部张弩，重矢贯穿直线并破甲' },
    tou: { ch: '石', name: '石', mode: 'lob', range: 4.2, dmg: 8, cd: 2.6, hit: 0.22, splash: 1.1, dtype: 'siege', desc: '「口」化巨石抛出，落地「轰」然一片' }
  };
  var KINDS = ['dao', 'qiang', 'gong', 'qi', 'nong', 'dun', 'huo', 'gu', 'nu', 'tou'];

  // ---------- 武将：两字成名，占两格 ----------
  // 原作十二将（枪 / 刀 / 剑 / 弓 四系）+ 孔明 庞统 魏延 姜维（扩展）；q: 金将 gold / 紫将 purple
  var GENERALS = {
    zhaoyun: { name: '赵云', chars: ['赵', '云'], q: 'gold', fam: '枪', skill: '七进七出', mode: 'thrust', dmg: 7, cd: 0.4, range: 2.2, hit: 0.12, len: 2.3, skillCd: 8, aura: ['qiang', 'qi'],
      desc: '「云」化游龙，七进七出，往返穿刺七敌；身边枪、骑 +35%' },
    liubei: { name: '刘备', chars: ['刘', '备'], q: 'gold', fam: '剑', skill: '圣剑', mode: 'melee', dmg: 5.6, cd: 0.8, range: 1.8, hit: 0.17, skillCd: 11, aura: 'all',
      desc: '「备」聚成一柄圣剑从天而降，重创敌群并击倒；全军伤害 +10%' },
    guanyu: { name: '关羽', chars: ['关', '羽'], q: 'gold', fam: '刀', skill: '跳斩', mode: 'gallop', dmg: 13, cd: 1.1, range: 1.8, hit: 0.2, splash: 1.0, skillCd: 9, aura: ['dao'],
      desc: '青龙偃月刀连环跳斩三次，溅射半伤并击退；身边刀兵 +35%' },
    zhangfei: { name: '张飞', chars: ['张', '飞'], q: 'gold', fam: '刀', skill: '大喝', mode: 'thrust', dmg: 9.6, cd: 1.0, range: 1.8, hit: 0.14, len: 2.0, skillCd: 10, aura: ['dao', 'qi'],
      desc: '「飞」字展翅一声大喝，震晕周围敌人 2 秒；身边刀、骑 +35%' },
    machao: { name: '马超', chars: ['马', '超'], q: 'gold', fam: '枪', skill: '西凉铁骑', mode: 'gallop', dmg: 6.5, cd: 0.8, range: 1.8, hit: 0.24, splash: 0.8, skillCd: 10, aura: ['qi'],
      desc: '万「马」奔腾，铁骑贯穿一整条战线；身边骑兵 +35%' },
    huangzhong: { name: '黄忠', chars: ['黄', '忠'], q: 'gold', fam: '弓', skill: '火箭烈', mode: 'arrow', dmg: 16.5, cd: 1.3, range: 5, hit: 0.15, dtype: 'arrow', skillCd: 12, aura: ['gong'],
      desc: '漫天火箭覆盖全场，灼烧并击退所有敌人；身边弓兵 +35%' },
    guanping: { name: '关平', chars: ['关', '平'], q: 'purple', fam: '刀', skill: '震地', mode: 'melee', dmg: 7.9, cd: 0.9, range: 1.5, hit: 0.17, skillCd: 9, aura: ['dao'],
      desc: '「平」字砸地，震晕身边敌人；身边刀兵 +35%' },
    guanxing: { name: '关兴', chars: ['关', '兴'], q: 'purple', fam: '刀', skill: '青龙斩', mode: 'melee', dmg: 9.9, cd: 0.9, range: 1.6, hit: 0.17, skillCd: 8, aura: ['dao'],
      desc: '「兴」字聚成巨刃，对单个强敌一刀重斩；身边刀兵 +35%' },
    zhangbao: { name: '张苞', chars: ['张', '苞'], q: 'purple', fam: '枪', skill: '蛇矛突', mode: 'thrust', dmg: 9.1, cd: 0.8, range: 2.1, hit: 0.14, len: 2.2, skillCd: 8, aura: ['qiang'],
      desc: '「苞」化丈八蛇矛，贯穿血量最高之敌；身边枪兵 +35%' },
    zhangyi: { name: '张翼', chars: ['张', '翼'], q: 'purple', fam: '枪', skill: '拒马阵', mode: 'thrust', dmg: 7.3, cd: 0.9, range: 2.1, hit: 0.14, len: 2.0, skillCd: 10, aura: ['qiang'],
      desc: '「翼」展开拒马，将一片敌人钉在原地；身边枪兵 +35%' },
    huanggai: { name: '黄盖', chars: ['黄', '盖'], q: 'purple', fam: '剑', skill: '火船', mode: 'fire', dmg: 6.9, cd: 1.0, range: 2.8, hit: 0.15, dtype: 'fire', skillCd: 11, aura: ['dao', 'qi'],
      desc: '「盖」化火船沿路冲撞，点燃并迟滞敌军；身边刀、骑 +35%' },
    huangzu: { name: '黄祖', chars: ['黄', '祖'], q: 'purple', fam: '弓', skill: '连珠箭', mode: 'arrow', dmg: 6.6, cd: 0.9, range: 3.4, hit: 0.15, dtype: 'arrow', skillCd: 8, aura: ['gong'],
      desc: '「祖」之笔画化作五支连珠箭，射向五敌并减速；身边弓兵 +35%' },
    kongming: { name: '孔明', chars: ['孔', '明'], q: 'purple', fam: '扇', skill: '借东风', mode: 'fire', dmg: 7.9, cd: 1.1, range: 3, hit: 0.15, dtype: 'fire', skillCd: 12, aura: ['gong'],
      desc: '「明」分日月：「日」降天火，「月」借东风，烧尽周围敌军；身边弓兵 +35%' },
    pangtong: { name: '庞统', chars: ['庞', '统'], q: 'purple', fam: '书', skill: '连环计', mode: 'arrow', dmg: 6.9, cd: 1.0, range: 2.6, hit: 0.15, skillCd: 12, aura: ['qiang'],
      desc: '「纟」丝化铁索连环六敌，伤害互相传导；身边枪兵 +35%' },
    weiyan: { name: '魏延', chars: ['魏', '延'], q: 'purple', fam: '刀', skill: '破阵', mode: 'gallop', dmg: 10.9, cd: 0.9, range: 1.6, hit: 0.2, splash: 0.8, skillCd: 10, aura: ['dao'],
      desc: '「延」笔画炸裂破阵：周围敌人受伤 +40%；身边刀兵 +35%' },
    jiangwei: { name: '姜维', chars: ['姜', '维'], q: 'purple', fam: '枪', skill: '伏兵四起', mode: 'thrust', dmg: 9.2, cd: 0.8, range: 2.1, hit: 0.14, len: 2.2, skillCd: 9, aura: ['qiang'],
      desc: '笔画如伏兵破土而出，重创敌群并定身；身边枪兵 +35%' }
  };
  var QUALITY = { gold: { name: '金将', mult: 1, weight: 1 }, purple: { name: '紫将', mult: 0.8, weight: 1.6 } };
  var CORE_GENS = ['zhaoyun', 'guanyu', 'zhangfei', 'liubei', 'huangzhong', 'machao', 'guanping', 'guanxing', 'zhangbao', 'zhangyi', 'huangzu', 'huanggai'];
  var GEN_KEYS = ['zhaoyun', 'liubei', 'guanyu', 'zhangfei', 'machao', 'huangzhong', 'guanping', 'guanxing', 'zhangbao', 'zhangyi', 'huanggai', 'huangzu', 'kongming', 'pangtong', 'weiyan', 'jiangwei'];
  var NAME_RECIPES = GEN_KEYS.map(function (k) { return [GENERALS[k].chars[0], GENERALS[k].chars[1], k]; });
  var SYNERGIES = {
    taoyuan: { name: '桃园结义', gens: ['liubei', 'guanyu', 'zhangfei'], need: 3, desc: '刘备 关羽 张飞 同在：全军伤害 +20%' },
    wuhu: { name: '五虎上将', gens: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'], need: 3, desc: '五虎任意 3 人：武将技能冷却 −20%；5 人齐聚 −40%' },
    erxiao: { name: '虎子', gens: ['guanxing', 'zhangbao', 'guanping'], need: 2, desc: '关兴 张苞 关平 任意 2 人：武将伤害 +25%' },
    wolong: { name: '卧龙凤雏', gens: ['kongming', 'pangtong'], need: 2, desc: '孔明 庞统：武将技能伤害 ×1.5' },
    jiangdong: { name: '江夏水军', gens: ['huanggai', 'huangzu'], need: 2, desc: '黄盖 黄祖：敌军移速 −12%' }
  };
  var SYN_KEYS = ['taoyuan', 'wuhu', 'erxiao', 'wolong', 'jiangdong'];

  // ---------- 敌军 ----------
  // 血量为一波的基准值（再乘波次、战场、段位倍率）；杀一敌 +1 馒头
  var ENEMIES = {
    zu: { ch: '卒', name: '步卒', hp: 13, spd: 1.0, reward: 1, r: 0.3 },
    qi: { ch: '骑', name: '骑兵', hp: 10, spd: 1.75, reward: 1, r: 0.3 },
    dun: { ch: '盾', name: '盾卒', hp: 29, spd: 0.75, reward: 1, r: 0.32, res: { arrow: 0.4 } },
    nu: { ch: '弩', name: '弩手', hp: 15, spd: 1.1, reward: 1, r: 0.3 },
    jia: { ch: '甲', name: '重甲', hp: 42, spd: 0.7, reward: 1, r: 0.34, res: { phys: 0.3, arrow: 0.2 } },
    teng: { ch: '藤', name: '藤甲兵', hp: 26, spd: 0.9, reward: 1, r: 0.32, res: { phys: 0.5, arrow: 0.5, siege: 0.3, fire: -1.5 } },
    xiang: { ch: '象', name: '象兵', hp: 100, spd: 0.5, reward: 3, r: 0.4, leak: 2, stunRes: 0.7 },
    chuan: { ch: '船', name: '战船', hp: 22, spd: 0.9, reward: 1, r: 0.34, res: { fire: -0.5 } }
  };
  var FACTIONS = {
    huangjin: { name: '黄巾军', badge: '贼', zu: '贼', color: '#b08428' },
    dong: { name: '董卓军', badge: '董', color: '#8a2222' },
    wei: { name: '曹魏', badge: '魏', color: '#3a5578' },
    wu: { name: '东吴', badge: '吴', color: '#a83a24', res: { fire: 0.5 } },
    man: { name: '南蛮', badge: '蛮', color: '#2f7a5a' },
    yuan: { name: '袁绍军', badge: '袁', color: '#7a6a28' }
  };

  // ---------- 经典战场 ----------
  // path: [起始列, 走向]，第 0 行紧贴中间山脊（敌军从山脊杀出），终点格坐着「斗」
  // tiles: 开局可布阵的格数；units / gens: 本战场的兵种与武将；rival: 对手主将（上半场）
  var LEVELS = [
    { key: 'julu', unlock: 0, name: '巨鹿之战', short: '巨鹿', era: '中平元年 · 巨鹿', blurb: '张角起于巨鹿，黄巾蔽野。刘关张初出桃园，与骑都尉曹操各守一营。', faction: 'huangjin', scene: 'plain',
      rival: '曹操', rivalTitle: '骑都尉', path: [0, 'D1 R7 D2 L7 D1'], tiles: 8, hp: 1.0,
      mix: { zu: [1, 1], qi: [0, 0.35, 4], dun: [0, 0.2, 7] },
      lieut: { name: '张宝', ch: '宝', hpMul: 9, spd: 0.6 },
      boss: { name: '张角', ch: '角', hpMul: 15, spd: 0.5, summon: { every: 6, n: 2 } },
      twist: '张角作法，不断召唤黄巾援兵',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'guanping', 'zhangbao'] },
    { key: 'hulao', unlock: 3, name: '虎牢关', short: '虎牢', era: '初平元年 · 汜水', blurb: '十八路诸侯讨董。吕布独守虎牢，江东猛虎孙坚与你各守一营。', faction: 'dong', scene: 'pass',
      rival: '孙坚', rivalTitle: '长沙太守', path: [0, 'R6 D2 L5 D2 R6'], blocked: [[7, 1], [0, 3]], tiles: 7, hp: 1.0,
      mix: { zu: [1, 0.6], qi: [0.15, 0.4], dun: [0, 0.3, 3] },
      lieut: { name: '华雄', ch: '华', hpMul: 9, spd: 0.6 },
      boss: { name: '吕布', ch: '布', hpMul: 15, spd: 0.55, charge: { every: 7, mult: 3, dur: 1.2 } },
      twist: '关隘狭窄；吕布每隔数秒策赤兔冲锋',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['guanyu', 'zhangfei', 'liubei', 'machao', 'guanxing', 'huanggai'] },
    { key: 'changban', unlock: 9, name: '长坂坡突围', short: '长坂', era: '建安十三年 · 当阳', blurb: '曹军虎豹骑追至。赵云单骑救主，张飞据水断桥；鲁肃奉命前来观阵。', faction: 'wei', scene: 'river',
      rival: '鲁肃', rivalTitle: '东吴使者', path: [6, 'D1 L5 D3 R6'], blocked: [[0, 3], [3, 2]], tiles: 7, hp: 0.8,
      mix: { zu: [1, 0.5], qi: [0.3, 0.6], dun: [0.05, 0.2, 4] },
      lieut: { name: '曹纯', ch: '纯', hpMul: 9, spd: 0.85 },
      boss: { name: '张郃', ch: '合', hpMul: 15, spd: 0.7, swarm: { every: 5, n: 3 } },
      twist: '路短骑多：虎豹骑轻骑成群冲锋',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['zhaoyun', 'zhangfei', 'liubei', 'guanyu', 'zhangbao', 'zhangyi'] },
    { key: 'yunmeng', unlock: 6, name: '云梦泽伏击', short: '云梦', era: '建安十三年 · 云梦泽', blurb: '赤壁火起，曹军败走云梦大泽。孙刘联军分道设伏，周瑜与你各截一路。', faction: 'wei', scene: 'marsh',
      rival: '周瑜', rivalTitle: '大都督', path: [7, 'L6 D2 R5 D2 L6'], blocked: [[7, 2], [0, 4]], tiles: 6, hp: 1.0, fireMul: 2,
      mix: { chuan: [1, 1], zu: [0.25, 0.15], dun: [0.1, 0.3, 4] },
      lieut: { name: '蔡瑁', ch: '蔡', hpMul: 8, spd: 0.6 },
      boss: { name: '曹操', ch: '操', hpMul: 13, spd: 0.5, summon: { every: 9, n: 2, type: 'chuan' } },
      twist: '泽中战船顺水而来；火攻伤害 ×2',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['huangzhong', 'huanggai', 'zhaoyun', 'huangzu', 'zhangyi', 'guanping'] },
    { key: 'hanzhong', unlock: 13, name: '汉中对峙', short: '汉中', era: '建安二十四年 · 定军山', blurb: '刘备争汉中，黄忠据定军山居高临下。法正举旗为号，与你比谁斩将更快。', faction: 'wei', scene: 'mountain',
      rival: '法正', rivalTitle: '军师', path: [0, 'D1 R7 D2 L7 D1'], blocked: [[3, 0], [4, 4], [6, 2]], tiles: 8, hp: 1.0, highGround: 1,
      mix: { zu: [1, 0.5], qi: [0.2, 0.3], dun: [0.15, 0.3], jia: [0, 0.25, 6] },
      lieut: { name: '张郃', ch: '合', hpMul: 9, spd: 0.7 },
      boss: { name: '夏侯渊', ch: '渊', hpMul: 15, spd: 0.85 },
      twist: '第一行为高地，射程 +0.5；夏侯渊来去如风',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['huangzhong', 'zhaoyun', 'machao', 'weiyan', 'zhangyi', 'guanxing'] },
    { key: 'yiling', unlock: 17, name: '夷陵之战', short: '夷陵', era: '章武二年 · 夷陵', blurb: '先主伐吴，连营七百里。关兴张苞随军复仇，黄权另领一军。', faction: 'wu', scene: 'fire',
      rival: '黄权', rivalTitle: '镇北将军', path: [1, 'D2 R2 U2 R2 D4 R2'], tiles: 9, hp: 1.0,
      mix: { zu: [1, 0.5], nu: [0.2, 0.4], dun: [0.1, 0.3], qi: [0.1, 0.25] },
      lieut: { name: '朱然', ch: '然', hpMul: 9, spd: 0.65 },
      boss: { name: '陆逊', ch: '逊', hpMul: 15, spd: 0.55, burnUnits: { every: 8, range: 2.2, dur: 3 } },
      twist: '吴军不惧火攻；陆逊放火，烧得身边守军攻速减半',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['guanxing', 'zhangbao', 'huangzhong', 'zhaoyun', 'jiangwei', 'guanping'] },
    { key: 'chibi', unlock: 21, name: '赤壁之战', short: '赤壁', era: '建安十三年 · 赤壁', blurb: '曹军八十万顺江而下。孙刘联军火烧连营，典韦护驾冲阵——最难的一仗。', faction: 'wei', scene: 'fire',
      rival: '周瑜', rivalTitle: '大都督', path: [3, 'D1 L3 D2 R7 D1'], blocked: [[6, 1], [2, 4]], tiles: 7, hp: 1.15, fireMul: 1.5,
      mix: { zu: [1, 0.5], dun: [0.15, 0.35], jia: [0, 0.3, 3], chuan: [0.2, 0.4] },
      lieut: { name: '许褚', ch: '许', hpMul: 10, spd: 0.6 },
      boss: { name: '典韦', ch: '典', hpMul: 17, spd: 0.5, flatten: { every: 5, range: 1.7, maxLv: 2, dur: 3 } },
      twist: '典韦踏地，把身边二阶及以下的兵压扁（三秒不能出手）——兵要升阶',
      units: ['dao', 'qiang', 'gong', 'qi', 'nong'], gens: ['zhaoyun', 'huangzhong', 'huanggai', 'huangzu', 'kongming', 'pangtong'] }
  ];
  // ---------- 段位：11 段，每段若干小级，每级 5 星 ----------
  var RANK_GROUPS = [['军士', 3], ['校尉', 3], ['少将', 3], ['中将', 4], ['上将', 4], ['大将', 4], ['元帅', 5], ['诸侯', 5], ['霸主', 5], ['君主', 5], ['皇帝', 1]];
  var RANKS = [], RANK_GROUP = [], CN = ['一', '二', '三', '四', '五'];
  RANK_GROUPS.forEach(function (gr, gi) { for (var i = 0; i < gr[1]; i++) { RANKS.push(gr[1] > 1 ? gr[0] + '·' + CN[i] : gr[0]); RANK_GROUP.push(gi); } });
  var RANK_STARS = 5;
  function clampRank(r) { return Math.max(0, Math.min(RANKS.length - 1, r | 0)); }
  // 段位 -> 敌军血量倍率 / AI 水平 / 波数 / 可选战场
  function rankHp(rank) { return 1 + 0.006 * clampRank(rank); }
  // AI 水平 0..1：军士·一 0.22（常犯错、发呆），到中将左右 0.8 封顶（与熟练玩家相当，约五五开）
  function rankAI(rank) { return Math.min(0.8, 0.22 + 0.048 * clampRank(rank)); }
  function wavesFor(rank) { return 5 + RANK_GROUP[clampRank(rank)]; }
  function fieldsFor(rank) { var r = clampRank(rank), out = []; LEVELS.forEach(function (L, i) { if (r >= (L.unlock || 0)) out.push(i); }); return out; }
  function rankGroup(rank) { return RANK_GROUPS[RANK_GROUP[clampRank(rank)]][0]; }
  // 胜 +1 星；5 星再胜晋级（新级 0 星）；败 −1 星，0 星再败降一小级（4 星）；军士·一 不再降
  function rankAfter(st, won) {
    var r = clampRank(st.r), s = Math.max(0, Math.min(RANK_STARS, st.s | 0)), out = { r: r, s: s, delta: 0, promoted: false, demoted: false };
    if (won) {
      out.delta = 1;
      if (s >= RANK_STARS && r < RANKS.length - 1) { r++; s = 0; out.promoted = true; }
      else s = Math.min(RANK_STARS, s + 1);
    } else {
      out.delta = -1;
      if (s > 0) s--;
      else if (r > 0) { r--; s = RANK_STARS - 1; out.demoted = true; }
      else out.delta = 0;
    }
    out.r = r; out.s = s;
    return out;
  }

  var CFG = {
    hearts: HEARTS, start: 20,
    costBase: 10, costStep: 2, costCap: 40,          // 征兵：10 起，每次 +2
    rewardGrowth: 0, waveBonus: 0, waveBonusGrowth: 0, // 杀敌 +1，波次无额外奖励
    breakTime: 6, prepTime: 20, overlap: 10,
    genStep: 0.4, hpGrowth: 1.28,
    count0: 12, countStep: 3, countCap: 40, gap0: 1.35, gapDrop: 0.12, gapMin: 0.75, // 每波敌数 12+3n；出怪间隔 1.35 秒起每波 −0.12（最快 0.75）
    weights: { name: 9, shovel: 6 },
    namePity: 8, pieceFocus: 0.65,
    auraBonus: 0.35, auraAll: 0.1, auraRange: 1.5,
    arrowSpeed: 10, boltSpeed: 13, startTiles: 7,
    recycle: { u: 1, c: 1, s: 1 }, heartComp: 10
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
    var L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, li | 0))];
    var units = L.units.slice(), gens = L.gens.slice(), names = [];
    gens.forEach(function (g) { GENERALS[g].chars.forEach(function (ch) { if (names.indexOf(ch) < 0) names.push(ch); }); });
    return { units: units, gens: gens, names: names };
  }
  // AI 强度参数（按段位）：反应间隔、失误率、合并疏漏、浪费、运气
  function aiParams(rank) {
    var a = rankAI(rank), m = Math.min(1, a);
    return { tick: 2.4 - 1.9 * m, mistake: 0.45 - 0.42 * m, mergeSkip: 0.4 - 0.38 * m, waste: 0.4 - 0.4 * m, luck: 0.3 * a, jitter: 0.6, smart: m };
  }

  function isUnit(it) { return it && it.t === 'u'; }
  // 同字同阶相叠 → 升一阶（兵牌与名字牌皆可）
  function mergeable(A, B) {
    if (!A || !B || A.lv !== B.lv || (A.lv || 1) >= 5) return false;
    if (A.t === 'u' && B.t === 'u') return A.k === B.k;
    if (A.t === 'c' && B.t === 'c') return A.ch === B.ch;
    return false;
  }
  // 名字按阅读顺序：左字 + 右字 → 武将
  function pairKey(lch, rch, content) {
    var gens = content ? content.gens : GEN_KEYS;
    for (var i = 0; i < NAME_RECIPES.length; i++) {
      var nr = NAME_RECIPES[i];
      if (nr[0] === lch && nr[1] === rch && gens.indexOf(nr[2]) >= 0) return nr[2];
    }
    return null;
  }
  // 两张名字牌能否成将；返回 { k, side }：side = 'L' 表示 A 应在左
  function combineResult(A, B, content) {
    if (!A || !B || A.t !== 'c' || B.t !== 'c') return null;
    var k = pairKey(A.ch, B.ch, content);
    if (k) return { k: k, side: 'L' };
    k = pairKey(B.ch, A.ch, content);
    if (k) return { k: k, side: 'R' };
    return null;
  }
  var UNITS_W = { dao: 24, qiang: 22, gong: 22, qi: 20, nong: 7, dun: 12, huo: 12, gu: 8, nu: 12, tou: 8 };

  // =====================================================================
  function createGame(opts) {
    opts = opts || {};
    var li = Math.max(0, Math.min(LEVELS.length - 1, opts.level | 0));
    var L = LEVELS[li], P = PATHS[li], content = levelContent(li);
    var FAC = FACTIONS[L.faction];
    var seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    var wrng = mulberry32(seed);
    var rank = Math.max(0, Math.min(RANKS.length - 1, opts.rank | 0));
    var G = {
      level: li, rank: rank, L: L, P: P, content: content, seed: seed, quiet: !!opts.quiet,
      phase: 'prep', wave: 0, waves: opts.waves || wavesFor(rank), timer: opts.prepTime != null ? opts.prepTime : CFG.prepTime, holdTimer: !!opts.holdTimer,
      queue: [], spawnT: 0, waveTag: '', idleT: 0, time: 0, eid: 1, ev: [], floodT: 0, floodOn: 0, result: null,
      sides: []
    };
    var blocked = {};
    (L.blocked || []).forEach(function (b) { blocked[b[0] + ',' + b[1]] = 1; });

    function makeSide(id) {
      var S = {
        id: id, hearts: HEARTS, mantou: L.start || CFG.start, summons: 0, nameSince: 0, clearSum: 0, clearT: null, killProg: 0,
        bench: [null, null, null, null, null], cells: [], enemies: [], projs: [], pend: [],
        auraDirty: true, pairsDirty: true, pairs: [], syn: {}, synSeen: {}, mods: {}, rng: mulberry32(seed * 31 + 7 + id * 101), luck: 0,
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
      cand.slice(0, L.tiles || CFG.startTiles).forEach(function (ce) { ce.lock = false; });
      return S;
    }
    G.sides.push(makeSide(0), makeSide(1));
    G.sides[1].luck = opts.aiLuck || 0; // 不作弊：AI 与玩家同一套规则，没有隐藏加成

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
        S.pairsDirty = true;
      }
      if (it && loc.z === 'b') { delete it.gen; delete it.genR; }
      S.auraDirty = true;
    }
    G.side = side;
    G.cellAt = function (s, c, r) { return cellAt(side(s), c, r); };
    G.getItem = function (s, loc) { return getItem(side(s), loc); };
    G.cost = function (s) { var S = side(s || 0); return Math.min(CFG.costCap, CFG.costBase + CFG.costStep * S.summons); };
    G.freeTiles = function (s) { var n = 0; side(s).cells.forEach(function (ce) { if (!ce.path && !ce.block && !ce.lock && !ce.item) n++; }); return n; };
    G.lockedCount = function (s) { var n = 0; side(s).cells.forEach(function (ce) { if (!ce.path && !ce.block && ce.lock) n++; }); return n; };
    G.over = function () { return G.phase === 'won' || G.phase === 'lost'; };
    G.canSummon = function (s) { var S = side(s); return !G.over() && S.mantou >= G.cost(S) && S.bench.some(function (it) { return !it; }); };
    // 段位加成从第 2 波起逐步生效（前几波留给双方布阵）
    G.waveMult = function (n) { n = n || G.wave; return L.hp * (1 + (rankHp(rank) - 1) * Math.min(1, (n - 1) / 4)) * Math.pow(CFG.hpGrowth, n - 1); };
    G.genMult = function () { return 1 + CFG.genStep * Math.max(0, G.wave - 1); }; // 武将随波次成长（按第几波，不按比例）
    G.reward = function (base) { return base; };
    G.combine = function (A, B) { return combineResult(A, B, content); };
    G.pairKey = function (l, r) { return pairKey(l, r, content); };

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
      S.pairs.forEach(function (g) { o[g.k] = 1; });
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
      if (want.length && S.rng() < CFG.pieceFocus) return { t: 'c', ch: want[(S.rng() * want.length) | 0], lv: 1 };
      var pool = [];
      content.gens.forEach(function (gk) {
        var w = owned[gk] ? 1 : 3;
        GENERALS[gk].chars.forEach(function (ch) { for (var i = 0; i < w; i++) pool.push(ch); });
      });
      return { t: 'c', ch: pool[(S.rng() * pool.length) | 0], lv: 1 };
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
    // 征兵：一次补满空着的候补格（最多五名），已有候补不动；价格 10 起每次 +2
    G.emptySlots = function (s) { var n = 0; side(s).bench.forEach(function (it) { if (!it) n++; }); return n; };
    G.summon = function (s) {
      var S = side(s);
      if (!G.canSummon(S)) return null;
      var cost = G.cost(S);
      S.mantou -= cost;
      S.summons++;
      S.stats.summons++;
      var batch = [], slots = [];
      for (var i = 0; i < BENCH; i++) {
        if (S.bench[i]) continue;
        var it = luckify(S, rollItem(S, batch.concat(S.bench.filter(Boolean))));
        S.bench[i] = it; batch.push(it); slots.push(i);
      }
      S.auraDirty = true;
      emit({ type: 'summon', s: S.id, items: batch.slice(), slots: slots, lost: [], cost: cost });
      return batch;
    };

    // ---------- 拖放 ----------
    function value(it) {
      if (!it) return 0;
      if (it.t === 'u') return CFG.recycle.u * Math.pow(2, it.lv - 1);
      if (it.t === 'c') return CFG.recycle.c * Math.pow(2, (it.lv || 1) - 1);
      if (it.t === 's') return CFG.recycle.s;
      return 0;
    }
    G.value = value;
    function placeable(S, c, r) { var ce = cellAt(S, c, r); return ce && !ce.path && !ce.block && !ce.lock ? ce : null; }
    // 名字牌的「吸附」：落在搭档本身或其邻格时，自动放到搭档正确的一侧（若空）
    function snapFor(S, A, to, from) {
      if (!A || A.t !== 'c' || to.z !== 't') return null;
      var cands = [[to.c, to.r], [to.c - 1, to.r], [to.c + 1, to.r], [to.c, to.r - 1], [to.c, to.r + 1]];
      var best = null;
      for (var i = 0; i < cands.length; i++) {
        var P2 = cellAt(S, cands[i][0], cands[i][1]);
        if (!P2 || !P2.item || P2.item === A || P2.item.t !== 'c') continue;
        if (P2.item.gen || P2.item.genR) continue;
        var cr = combineResult(A, P2.item, content);
        if (!cr) continue;
        var qc = cr.side === 'L' ? P2.c - 1 : P2.c + 1;
        var Q = placeable(S, qc, P2.r);
        if (!Q) continue;
        var srcHere = from && from.z === 't' && from.c === Q.c && from.r === Q.r;
        if (Q.item && !srcHere) continue;
        var d = Math.abs(Q.c - to.c) + Math.abs(Q.r - to.r);
        if (!best || d < best.d) best = { c: Q.c, r: Q.r, d: d, k: cr.k };
      }
      return best;
    }
    G.snapFor = function (s, A, to, from) { return snapFor(side(s), A, to, from); };
    G.plan = function (s, from, to) {
      var S = side(s), A = getItem(S, from);
      if (!A || !to) return null;
      if (to.z === 'x') return { act: 'recycle', value: value(A) };
      if (from.z === to.z && from.i === to.i && from.c === to.c && from.r === to.r) return null;
      var B;
      if (to.z === 't') {
        var ce = cellAt(S, to.c, to.r);
        if (!ce || ce.path || ce.block) return null;
        if (ce.lock) return A.t === 's' ? { act: 'dig' } : null;
        if (A.t === 's') return null;
        B = ce.item;
        if (B && mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
        if (A.t === 'c') {
          var sn = snapFor(S, A, to, from);
          if (sn && !(sn.c === to.c && sn.r === to.r && B)) {
            if (!(sn.c === to.c && sn.r === to.r)) return { act: from.z === 't' ? 'move' : 'place', dest: { z: 't', c: sn.c, r: sn.r }, pair: sn.k };
            return { act: from.z === 't' ? 'move' : 'place', pair: sn.k };
          }
        }
        if (!B) return { act: from.z === 't' ? 'move' : 'place' };
      } else if (to.z === 'b') {
        if (to.i < 0 || to.i >= BENCH) return null;
        B = S.bench[to.i];
        if (!B) return { act: 'move' };
        if (mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
      } else return null;
      if (B.t === 's' && from.z === 't') return null;
      return { act: 'swap' };
    };
    G.apply = function (s, from, to) {
      var S = side(s);
      var p = G.plan(S, from, to);
      if (!p) return p;
      if (p.dest) to = p.dest;
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
          emit({ type: 'place', s: S.id, from: from, to: to, item: A, snapped: !!p.dest });
          break;
        case 'swap':
          setItem(S, from, B); setItem(S, to, A);
          emit({ type: 'swap', s: S.id, from: from, to: to });
          break;
        case 'merge':
          setItem(S, from, null);
          B.lv = p.lv; B.cdLeft = 0.35;
          S.auraDirty = true; S.pairsDirty = true;
          S.stats.merges++;
          if (B.t === 'u' && p.lv > S.stats.maxTier) S.stats.maxTier = p.lv;
          emit({ type: 'merge', s: S.id, from: from, to: to, lv: p.lv, kind: B.k, ch: B.ch });
          break;
      }
      updatePairs(S);
      return p;
    };

    // ---------- 武将：名字牌按顺序左右相邻即成将 ----------
    function updatePairs(S) {
      S.pairsDirty = false;
      var used = {}, pairs = [], keep = [];
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS - 1; c++) {
          var a = cellAt(S, c, r), b = cellAt(S, c + 1, r);
          var L1 = a.item, R1 = b.item;
          if (!L1 || !R1 || L1.t !== 'c' || R1.t !== 'c' || used[c + ',' + r] || used[(c + 1) + ',' + r]) continue;
          var k = pairKey(L1.ch, R1.ch, content);
          if (!k) continue;
          used[c + ',' + r] = used[(c + 1) + ',' + r] = 1;
          var g = L1.gen && L1.gen.k === k && L1.gen.R === R1 ? L1.gen : null;
          var fresh = !g;
          if (!g) g = { t: 'g', k: k, skLeft: 3, cdLeft: 0.5 };
          g.L = L1; g.R = R1; g.c = c; g.r = r; g.x = c + 1; g.y = r + 0.5;
          var lv = Math.min(L1.lv || 1, R1.lv || 1);
          if (!fresh && lv > g.lv) emit({ type: 'genup', s: S.id, k: k, c: c, r: r, lv: lv });
          g.lv = lv;
          L1.gen = g; R1.genR = g;
          pairs.push(g); keep.push(g);
          if (fresh) {
            if (S.stats.generals.indexOf(k) < 0) S.stats.generals.push(k);
            emit({ type: 'general', s: S.id, k: k, c: c, r: r, lv: lv });
          }
        }
      }
      // 拆散的武将
      S.pairs.forEach(function (g) { if (keep.indexOf(g) < 0) emit({ type: 'unpair', s: S.id, k: g.k, c: g.c, r: g.r }); });
      S.cells.forEach(function (ce) {
        var it = ce.item;
        if (!it || it.t !== 'c') return;
        if (it.gen && keep.indexOf(it.gen) < 0) delete it.gen;
        if (it.genR && keep.indexOf(it.genR) < 0) delete it.genR;
        if (it.gen && it.gen.L !== it) delete it.gen;
        if (it.genR && it.genR.R !== it) delete it.genR;
      });
      S.pairs = pairs;
      S.auraDirty = true;
    }
    G.updatePairs = function (s) { updatePairs(side(s)); };

    // ---------- 羁绊与光环 ----------
    function updateAura(S) {
      if (S.pairsDirty) updatePairs(S);
      S.auraDirty = false;
      var on = {};
      S.pairs.forEach(function (g) { on[g.k] = 1; });
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
        enemySlow: syn.jiangdong ? 0.12 : 0,
        genDmg: syn.erxiao ? 0.25 : 0
      };
      var drums = [];
      S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u' && ce.item.k === 'gu') drums.push({ x: ce.c + 0.5, y: ce.r + 0.5, h: UNITS.gu.haste + 0.05 * (ce.item.lv - 1), rg: UNITS.gu.range }); });
      function buff(it, x, y, high) {
        var m = 1 + S.mods.dmgAll, buffs = 0;
        if (it.t === 'u') {
          var used = {};
          S.pairs.forEach(function (g) {
            var a = GENERALS[g.k].aura;
            if (a !== 'all' && a.indexOf(it.k) >= 0 && !used[g.k] && dist(g.x, g.y, x, y) <= CFG.auraRange + 0.5 + 1e-6) { used[g.k] = 1; m += CFG.auraBonus; buffs++; }
          });
        } else m += S.mods.genDmg;
        it.aura = m;
        it.buffed = buffs;
        var h = 0;
        drums.forEach(function (d) { if (dist(d.x, d.y, x, y) <= d.rg + 0.5 + 1e-6 && !(d.x === x && d.y === y)) h = Math.max(h, d.h); });
        it.haste = h;
        it.rangeBonus = high ? 0.5 : 0;
      }
      S.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u') buff(ce.item, ce.c + 0.5, ce.r + 0.5, ce.high); });
      S.pairs.forEach(function (g) { buff(g, g.x, g.y, cellAt(S, g.c, g.r).high); });
    }
    G.updateAura = function (s) { if (s == null) G.sides.forEach(updateAura); else updateAura(side(s)); };

    // ---------- 波次（两边同一批敌军） ----------
    function mixAt(n) {
      var out = [], tot = 0;
      for (var t in L.mix) {
        var m = L.mix[t], from = m[2] || 1;
        if (n < from) continue;
        var k = G.waves > from ? (n - from) / (G.waves - from) : 1;
        var w = m[0] + (m[1] - m[0]) * k;
        if (w > 0) { out.push([t, w]); tot += w; }
      }
      return { list: out, tot: tot };
    }
    G.isBossWave = function (n) { return n === G.waves ? 'boss' : (n % 5 === 0 ? 'lieut' : ''); };
    function buildWave(n) {
      var count = Math.min(CFG.countCap, Math.round(CFG.count0 + CFG.countStep * n));
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
        e.maxHp = ENEMIES.zu.hp * mult * bd.hpMul; e.reward = type === 'boss' ? 10 : 5; e.leak = type === 'boss' ? 2 : 1;
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
    function depth(S) { return S.killProg / Math.max(1, S.stats.kills); }
    function addClear() { G.sides.forEach(function (S) { S.clearSum += (S.clearT != null ? S.clearT : G.time) - G.waveT0; S.clearT = null; }); }
    G.startWave = function () {
      if (G.phase !== 'prep' && G.phase !== 'break') return;
      G.waveT0 = G.time; G.sides.forEach(function (S) { S.clearT = null; });
      G.wave++;
      G.queue = buildWave(G.wave);
      G.spawnT = 0.2;
      G.idleT = 0;
      G.phase = 'wave';
      emit({ type: 'wave', n: G.wave, tag: G.waveTag, last: G.wave === G.waves, boss: G.isBossWave(G.wave) });
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
      if (dmg >= 1) emit({ type: 'dmg', s: S.id, x: e.x, y: e.y, v: dmg, eid: e.id, big: dmg >= e.maxHp * 0.3, dtype: dtype });
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
      S.killProg += Math.min(1, e.d / P.len);
      emit({ type: 'kill', s: S.id, x: e.x, y: e.y, reward: e.reward, boss: !!e.boss, lieut: !!e.lieut, name: e.name, etype: e.type, ch: e.ch, r: e.r, eid: e.id });
    }
    G.hurt = function (s, e, dmg, dtype) { return hurt(side(s), e, dmg, dtype); };

    function findTarget(S, x, y, range) {
      var best = null;
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.dead || e.d < 0.4) continue;
        if (dist(x, y, e.x, e.y) <= range + RANGE_PAD && (!best || e.d > best.d)) best = e;
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
      if (o.slow) e.slowT = Math.max(e.slowT || 0, o.slow);
      if (o.kb && !e.boss) e.d = Math.max(0.5, e.d - o.kb);
      else if (o.kb) e.d = Math.max(0.5, e.d - o.kb * 0.3);
    }
    function resolve(S, o) {
      if (o.e) {
        if (!o.e.dead) applyHit(S, o.e, o);
        if (o.area) {
          var cx = o.e.dead ? o.area[0] : o.e.x, cy = o.e.dead ? o.area[1] : o.e.y, o2 = o;
          if (o.splashMul) { o2 = {}; for (var kk in o) o2[kk] = o[kk]; o2.dmg = o.dmg * o.splashMul; }
          inRadius(S, cx, cy, o.area[2], function (en) { if (en !== o.e) applyHit(S, en, o2); });
        }
      } else if (o.area) {
        inRadius(S, o.area[0], o.area[1], o.area[2], function (en) { applyHit(S, en, o); });
      } else if (o.line) {
        var l = o.line;
        lineHits(S, l[0], l[1], l[2], l[3], l[4], l[5], function (en) { applyHit(S, en, o); });
      } else if (o.fn) o.fn();
    }

    // ---------- 出手 ----------
    function unitDmg(S, it) {
      if (it.t === 'u') return UNITS[it.k].dmg * TIER_ATK[it.lv - 1] * (it.aura || 1);
      var GD = GENERALS[it.k];
      return GD.dmg * QUALITY[GD.q || 'purple'].mult * G.genMult() * GEN_TIER[(it.lv || 1) - 1] * (it.aura || 1);
    }
    // it: 兵牌或武将（武将位于两格正中 x=c+1）
    function attack(S, it, x, y, c, r, tgt) {
      var def = it.t === 'u' ? UNITS[it.k] : GENERALS[it.k];
      var dmg = unitDmg(S, it), dtype = def.dtype || 'phys';
      var dx = tgt.x - x, dy = tgt.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      var ev = { type: 'atk', s: S.id, c: c, r: r, mode: def.mode, kind: it.t === 'u' ? it.k : null, gk: it.t === 'g' ? it.k : null, lv: it.lv || 1,
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
    function densest(list, rad) {
      var best = list[0], bn = -1;
      list.forEach(function (e) {
        var n2 = 0;
        list.forEach(function (o) { if (dist(e.x, e.y, o.x, o.y) <= rad) n2++; });
        if (n2 > bn) { bn = n2; best = e; }
      });
      return best;
    }
    function toughest(list) { var top = list[0]; list.forEach(function (e) { if (e.hp > top.hp) top = e; }); return top; }
    function castSkill(S, g) {
      var x = g.x, y = g.y, k = g.k, def = GENERALS[k];
      var base = def.dmg * QUALITY[def.q || 'purple'].mult * G.genMult() * GEN_TIER[(g.lv || 1) - 1] * (g.aura || 1) * S.mods.skillDmg;
      var live = liveEnemies(S);
      var ev = { type: 'skill', s: S.id, k: k, c: g.c, r: g.r, x: x, y: y, lv: g.lv };
      if (!live.length) return false;
      var near = function (R) { return live.filter(function (e) { return dist(x, y, e.x, e.y) <= R; }); };
      var cand, tg, i;
      if (k === 'zhaoyun') {
        cand = near(3.8);
        if (!cand.length) return false;
        cand.sort(function (a, b) { return a.d - b.d; });
        cand = cand.slice(-7);
        // 七进七出：不足七敌时往返重复穿刺
        var seq = [];
        for (i = 0; i < 7; i++) seq.push(cand[i % cand.length]);
        ev.pts = seq.map(function (e) { return [e.x, e.y]; });
        seq.forEach(function (e, j) { pend(S, 0.35 + j * 0.09, { e: e, dmg: base * 3.2, dtype: 'phys' }); });
      } else if (k === 'zhangfei') {
        if (!near(2.5).length) return false;
        pend(S, 0.45, { area: [x, y, 2.5], dmg: base * 1.5, dtype: 'phys', stun: 2.0 });
        ev.rad = 2.5;
      } else if (k === 'guanyu') {
        cand = near(3.2);
        if (!cand.length) return false;
        cand.sort(function (a, b) { return b.d - a.d; });
        ev.pts = [];
        for (i = 0; i < 3; i++) {
          var t3 = cand[i % cand.length];
          ev.pts.push([t3.x, t3.y]);
          pend(S, 0.35 + i * 0.35, { e: t3, area: [t3.x, t3.y, 1.0], splashMul: 0.5, dmg: base * 3, dtype: 'phys', kb: 0.3 });
        }
      } else if (k === 'machao') {
        tg = findTarget(S, x, y, 3);
        if (!tg) return false;
        var dx = tg.x - x, dy = tg.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= l; dy /= l;
        pend(S, 0.45, { line: [x, y, dx, dy, 4.5, 0.5], dmg: base * 4, dtype: 'phys' });
        ev.x2 = x + dx * 4.5; ev.y2 = y + dy * 4.5; ev.ang = Math.atan2(dy, dx);
      } else if (k === 'huangzhong') {
        // 火箭烈：全场火箭
        ev.pts = live.map(function (e) { return [e.x, e.y]; });
        live.forEach(function (e, j) { pend(S, 0.6 + (j % 6) * 0.06, { e: e, dmg: base * 1.6, dtype: 'fire', burn: base * 0.3, kb: 0.35, stun: 0.4 }); });
      } else if (k === 'liubei') {
        cand = near(3.6);
        if (!cand.length) return false;
        tg = densest(cand, 1.5);
        pend(S, 0.7, { area: [tg.x, tg.y, 1.5], dmg: base * 4, dtype: 'phys', stun: 1.2 });
        ev.x2 = tg.x; ev.y2 = tg.y; ev.rad = 1.5;
      } else if (k === 'guanping') {
        if (!near(1.8).length) return false;
        pend(S, 0.4, { area: [x, y, 1.8], dmg: base * 2, dtype: 'phys', stun: 1.0 });
        ev.rad = 1.8;
      } else if (k === 'guanxing') {
        cand = near(3.2);
        if (!cand.length) return false;
        tg = toughest(cand);
        pend(S, 0.55, { e: tg, area: [tg.x, tg.y, 0.7], splashMul: 0.3, dmg: base * 8, dtype: 'phys' });
        ev.x2 = tg.x; ev.y2 = tg.y; ev.eid = tg.id;
      } else if (k === 'zhangbao') {
        cand = near(3.6);
        if (!cand.length) return false;
        tg = toughest(cand);
        var bx = tg.x - x, by = tg.y - y, bl2 = Math.sqrt(bx * bx + by * by) || 1;
        pend(S, 0.45, { e: tg, dmg: base * 6, dtype: 'phys' });
        pend(S, 0.45, { line: [x, y, bx / bl2, by / bl2, 4.2, 0.4], dmg: base * 1.5, dtype: 'phys' });
        ev.x2 = tg.x; ev.y2 = tg.y; ev.eid = tg.id; ev.ang = Math.atan2(by, bx);
      } else if (k === 'zhangyi') {
        cand = near(3.6);
        if (!cand.length) return false;
        tg = densest(cand, 1.4);
        pend(S, 0.45, { area: [tg.x, tg.y, 1.4], dmg: base * 1.3, dtype: 'phys', stun: 2.2 });
        ev.x2 = tg.x; ev.y2 = tg.y; ev.rad = 1.4;
      } else if (k === 'huanggai') {
        cand = near(3.8);
        if (!cand.length) return false;
        cand.forEach(function (e) { pend(S, 0.5 + Math.min(0.6, dist(x, y, e.x, e.y) * 0.12), { e: e, dmg: base * 1.8, dtype: 'fire', burn: base * 0.6, slow: 3 }); });
        var pts = [], pp = {};
        for (var d = 0; d < P.len; d += 0.5) { posAt(P, d, 0, pp); if (dist(x, y, pp.x, pp.y) <= 3.8) pts.push([pp.x, pp.y]); }
        ev.pts = pts; ev.rad = 3.8;
      } else if (k === 'huangzu') {
        cand = near(3.8);
        if (!cand.length) return false;
        cand.sort(function (a, b) { return b.d - a.d; });
        cand = cand.slice(0, 5);
        ev.pts = cand.map(function (e) { return [e.x, e.y]; });
        cand.forEach(function (e, j) { pend(S, 0.4 + j * 0.08, { e: e, dmg: base * 2.4, dtype: 'arrow', slow: 2.5 }); });
      } else if (k === 'kongming') {
        cand = near(3.5);
        if (!cand.length) return false;
        cand.forEach(function (e) { pend(S, 0.55 + Math.min(0.5, dist(x, y, e.x, e.y) * 0.1), { e: e, dmg: base * 3, dtype: 'fire', burn: base * 0.5 }); });
        var pts2 = [], p2 = {};
        for (var d2 = 0; d2 < P.len; d2 += 0.5) { posAt(P, d2, 0, p2); if (dist(x, y, p2.x, p2.y) <= 3.5) pts2.push([p2.x, p2.y]); }
        ev.pts = pts2; ev.rad = 3.5;
      } else if (k === 'pangtong') {
        var c0 = findTarget(S, x, y, 3.2);
        if (!c0) return false;
        var grp = live.filter(function (e) { return dist(c0.x, c0.y, e.x, e.y) <= 2.2; });
        grp.sort(function (a, b) { return dist(c0.x, c0.y, a.x, a.y) - dist(c0.x, c0.y, b.x, b.y); });
        grp = grp.slice(0, 6);
        grp.forEach(function (e) { pend(S, 0.5, { e: e, dmg: base * 1.2, dtype: 'phys', link: 6 }); });
        ev.pts = grp.map(function (e) { return [e.x, e.y]; }); ev.eids = grp.map(function (e) { return e.id; });
      } else if (k === 'weiyan') {
        if (!near(2.5).length) return false;
        pend(S, 0.4, { area: [x, y, 2.5], dmg: base * 2, dtype: 'phys', vuln: 5 });
        ev.rad = 2.5;
      } else if (k === 'jiangwei') {
        cand = near(3.6);
        if (!cand.length) return false;
        tg = densest(cand, 1.3);
        pend(S, 0.45, { area: [tg.x, tg.y, 1.3], dmg: base * 4, dtype: 'phys', stun: 0.7 });
        ev.x2 = tg.x; ev.y2 = tg.y; ev.rad = 1.3;
      } else return false;
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
      if (bd.flatten && e.abT <= 0 && e.d > 1) {
        // 典韦踏地：身边低阶兵被压扁
        e.abT = bd.flatten.every;
        var flat = [];
        S.cells.forEach(function (ce) {
          var it = ce.item;
          if (it && it.t === 'u' && (it.lv || 1) <= bd.flatten.maxLv && dist(ce.c + 0.5, ce.r + 0.5, e.x, e.y) <= bd.flatten.range) { it.flatT = bd.flatten.dur; flat.push([ce.c + 0.5, ce.r + 0.5]); }
        });
        emit({ type: 'bossAct', s: S.id, act: 'flatten', x: e.x, y: e.y, name: e.name, pts: flat, rad: bd.flatten.range });
      }
      if (bd.burnUnits && e.abT <= 0 && e.d > 1) {
        e.abT = bd.burnUnits.every;
        var hitU = [];
        S.cells.forEach(function (ce) {
          if (ce.item && (ce.item.t === 'u' || ce.item.gen || ce.item.genR) && dist(ce.c + 0.5, ce.r + 0.5, e.x, e.y) <= bd.burnUnits.range) {
            (ce.item.t === 'u' ? ce.item : (ce.item.gen || ce.item.genR)).burnT = bd.burnUnits.dur; hitU.push([ce.c + 0.5, ce.r + 0.5]);
          }
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
        if (e.slowT > 0) e.slowT -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnAcc = (e.burnAcc || 0) + dt;
          if (e.burnAcc >= 0.5) { e.burnAcc = 0; hurt(S, e, e.burn * 0.5, 'fire'); if (e.dead) continue; }
        }
        if (e.boss) bossAbility(S, e, dt);
        var slow = 0;
        for (var s = 0; s < shields.length; s += 3) if (dist(shields[s], shields[s + 1], e.x, e.y) <= UNITS.dun.range) slow = Math.max(slow, shields[s + 2]);
        if (G.floodOn > 0) slow = Math.max(slow, L.flood.slow);
        if (e.slowT > 0) slow = Math.max(slow, 0.45);
        e.slowed = slow;
        var spd = e.spd * (1 - slow) * (1 - (S.mods.enemySlow || 0)) * (e.chargeT > 0 ? e.def.charge.mult : 1);
        if (e.stun > 0) e.stun -= dt;
        else e.d += spd * dt;
        if (e.d >= P.len) {
          e.dead = true; e.leaked = true;
          var loss = e.leak || 1;
          S.hearts = Math.max(0, S.hearts - loss);
          S.stats.leaks++;
          S.mantou += CFG.heartComp * loss; // 失一心补偿馒头
          emit({ type: 'leak', s: S.id, loss: loss, boss: !!e.boss, ch: e.ch, eid: e.id, comp: CFG.heartComp * loss });
          if (S.hearts <= 0) { finish(1 - S.id, 'hearts'); return; }
          continue;
        }
        posAt(P, e.d, e.off, e);
      }

      function fight(it, x, y, c, r) {
        if (it.burnT > 0) it.burnT -= dt;
        if (it.rushT > 0) it.rushT -= dt;
        var spdMul = (1 + (it.haste || 0) + (it.rushT > 0 ? 0.6 : 0)) * (it.burnT > 0 ? 0.5 : 1);
        if (it.t === 'g') {
          it.skLeft = (it.skLeft == null ? 3 : it.skLeft) - dt;
          if (it.skLeft <= 0 && G.phase === 'wave') {
            if (castSkill(S, it)) { it.skLeft = GENERALS[it.k].skillCd * S.mods.skillCd * (1 - 0.06 * ((it.lv || 1) - 1)); it.cdLeft = Math.max(it.cdLeft || 0, 1.1); return; }
            it.skLeft = 0;
          }
        }
        if (it.flatT > 0) { it.flatT -= dt; return; } // 被典韦压扁：不能出手
        var def = it.t === 'u' ? UNITS[it.k] : GENERALS[it.k];
        // 升阶攻速：每阶 ×1.346（武将的等级已算进伤害倍率）
        if (it.t === 'u') spdMul *= TIER_SPD[(it.lv || 1) - 1];
        if (def.mode === 'farm') {
          // 农民：开战后定时产馒头
          if (G.phase !== 'wave') return;
          it.farmT = (it.farmT || 0) + dt * spdMul;
          if (it.farmT >= def.cd) { it.farmT -= def.cd; var y0 = def.yield * (it.lv >= 4 ? 2 : 1); S.mantou += y0; S.stats.farmed = (S.stats.farmed || 0) + y0; emit({ type: 'farm', s: S.id, c: c, r: r, v: y0 }); }
          return;
        }
        it.cdLeft = (it.cdLeft || 0) - dt * spdMul;
        if (it.cdLeft > 0) return;
        if (def.mode === 'drum') {
          if (G.phase === 'wave' && liveEnemies(S).length) { it.cdLeft = def.cd; emit({ type: 'drum', s: S.id, c: c, r: r, rad: def.range }); }
          else it.cdLeft = 0;
          return;
        }
        var range = def.range + (it.rangeBonus || 0) + (it.t === 'g' ? 0.5 : 0);
        if (def.mode === 'pulse') {
          var any = false;
          inRadius(S, x, y, range, function () { any = true; });
          if (any) {
            pend(S, def.hit, { area: [x, y, range], dmg: unitDmg(S, it), dtype: 'phys' });
            it.cdLeft += def.cd;
            emit({ type: 'atk', s: S.id, c: c, r: r, mode: 'pulse', kind: it.k, lv: it.lv, rad: range, hit: def.hit });
          } else it.cdLeft = 0;
          return;
        }
        var tgt = findTarget(S, x, y, range);
        if (!tgt) { it.cdLeft = 0; return; }
        attack(S, it, x, y, c, r, tgt);
        it.cdLeft += def.cd;
      }
      if (S.pairsDirty) updatePairs(S);
      for (i = 0; i < S.cells.length; i++) {
        var ce = S.cells[i], it = ce.item;
        if (it && it.t === 'u') fight(it, ce.c + 0.5, ce.r + 0.5, ce.c, ce.r);
      }
      for (i = 0; i < S.pairs.length; i++) { var g = S.pairs[i]; fight(g, g.x, g.y, g.c, g.r); }

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
          G.spawnT += Math.max(CFG.gapMin, CFG.gap0 - CFG.gapDrop * (G.wave - 1));
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
        // 清场用时：本波出完后，哪边先清干净
        G.sides.forEach(function (S) { if (S.clearT == null && !S.enemies.length) S.clearT = G.time; });
        var lastWave = G.wave >= G.waves;
        if (lastWave) {
          if (!left) {
            addClear();
            // 比心数 → 比「御敌于外」（敌人平均走到路的几成被斩，越早越好）→ 比清场用时 → 仍相同算玩家守住
            var A0 = G.sides[0], A1 = G.sides[1], h0 = A0.hearts, h1 = A1.hearts, w;
            if (h0 !== h1) w = h0 > h1 ? 0 : 1;
            else if (Math.abs(depth(A0) - depth(A1)) > 1e-4) w = depth(A0) < depth(A1) ? 0 : 1;
            else if (Math.abs(A0.clearSum - A1.clearSum) > 0.05) w = A0.clearSum < A1.clearSum ? 0 : 1;
            else w = 0;
            finish(w, h0 > h1 ? 'hearts-more' : h0 < h1 ? 'hearts-less' : w === 0 ? 'better' : 'worse');
          }
        } else if (!left || G.idleT >= CFG.overlap) {
          addClear();
          G.sides.forEach(function (S) { var b = CFG.waveBonus + CFG.waveBonusGrowth * (G.wave - 1); S.mantou += b; });
          emit({ type: 'clear', n: G.wave, bonus: CFG.waveBonus + CFG.waveBonusGrowth * (G.wave - 1) });
          G.phase = 'break';
          G.timer = CFG.breakTime;
        }
      }
    };
    G.drain = function () { var e = G.ev; G.ev = []; return e; };
    G.note = function (e) { emit(e); };
    G.updateAura();
    return G;
  }

  // =====================================================================
  // AI / 机器人：与玩家完全同一套规则、经济与信息（不作弊、无隐藏加成），只是「手」和「脑」有快慢好坏。
  // 像真人一样一次做一件事：想一想（反应间隔）→ 拖一张牌（拖动耗时）→ 落下；低段位常发呆、放错位、忘了合成。
  // p: { tick 反应间隔, jitter, idle 发呆概率, idleT 发呆时长, drag 拖动耗时, mistake 放错位, mergeSkip 忘合成,
  //      waste 新兵晾着不用, smart 精打细算（攒钱征兵、凑武将、留位置）, genFocus 凑武将 }
  function aiParams(rank) {
    var m = rankAI(rank);
    return {
      skill: m, tick: lerp(2.3, 0.75, m), jitter: 0.7, idle: lerp(0.22, 0.03, m), idleT: lerp(4.5, 1.5, m), drag: lerp(0.65, 0.32, m),
      mistake: lerp(0.38, 0.05, m), mergeSkip: lerp(0.45, 0.04, m), waste: lerp(0.3, 0.02, m), smart: lerp(0.15, 0.95, m), genFocus: lerp(0.25, 0.95, m)
    };
  }
  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  // 一个熟练玩家（测试 / 托管用）
  var PLAYER_BOT = { skill: 0.85, tick: 0.9, jitter: 0.6, idle: 0.04, idleT: 1.5, drag: 0.35, mistake: 0.07, mergeSkip: 0.05, waste: 0.03, smart: 0.85, genFocus: 0.85 };

  function createBot(G, sid, p, seed) {
    p = p || {};
    var S = G.sides[sid], P = G.P;
    var s0 = (seed == null ? G.seed * 13 + sid * 977 + 5 : seed) | 0;
    var rng = mulberry32(s0);
    var cc = {};
    var cov = function (c, r, R) { var k = c + ',' + r + ',' + R; if (cc[k] == null) cc[k] = coverage(P, c, r, R); return cc[k]; };
    var covAt = function (x, y, R) { var k = 'p' + x + ',' + y + ',' + R; if (cc[k] == null) cc[k] = coverage(P, x - 0.5, y - 0.5, R); return cc[k]; };
    var T = function (c, r) { return { z: 't', c: c, r: r }; }, B = function (i) { return { z: 'b', i: i }; };
    var cellAt = function (c, r) { return c < 0 || r < 0 || c >= COLS || r >= ROWS ? null : S.cells[r * COLS + c]; };
    var open = function (ce) { return ce && !ce.path && !ce.block && !ce.lock; };
    var tiles = function () { return S.cells.filter(function (ce) { return !ce.path && !ce.block; }); };
    var val = function (it) { return it.gen || it.genR ? 1000 : it.t === 'u' ? Math.pow(2, it.lv) * (it.k === 'nong' ? 0.7 : 1) : it.t === 'c' ? 3 * it.lv : 0; };
    var mistake = p.mistake || 0, mergeSkip = p.mergeSkip || 0, ignored = [];
    var skip = function (it) { return ignored.indexOf(it) >= 0; };
    var queue = [];
    function mv(from, to) { queue.push({ from: from, to: to }); return true; }
    // 未成将的名字牌 → 搭档应放的格子（保留给搭档）
    function reserved() {
      var res = {};
      if (rng() > (p.genFocus == null ? 1 : p.genFocus)) return res;
      S.cells.forEach(function (ce) {
        var it = ce.item;
        if (!it || it.t !== 'c' || it.gen || it.genR) return;
        G.content.gens.forEach(function (k) {
          var ch = GENERALS[k].chars;
          if (ch[0] === it.ch) res[(ce.c + 1) + ',' + ce.r] = ch[1];
          if (ch[1] === it.ch) res[(ce.c - 1) + ',' + ce.r] = ch[0];
        });
      });
      return res;
    }
    // 落位评分：近战贴路、弓兵占弯道（射程内路越长越好）；农民放在没用的角落
    function tileScore(ce, it) {
      if (it.t === 'u' && it.k === 'nong') return -cov(ce.c, ce.r, 2);
      if (it.t === 'u' && it.k === 'gu') {
        var n = 0;
        tiles().forEach(function (o) { if (o !== ce && o.item && (o.item.t === 'u' || o.item.t === 'c') && Math.hypot(o.c - ce.c, o.r - ce.r) <= 1.5) n += o.item.t === 'c' ? 2 : o.item.lv; });
        return n;
      }
      var R = (it.t === 'u' ? UNITS[it.k].range + RANGE_PAD : 2) + (ce.high ? 0.5 : 0);
      return cov(ce.c, ce.r, R) * (it.t === 'u' ? (UNITS[it.k].targets || 1) : 1);
    }
    function bestFree(it, avoidRes) {
      var res = avoidRes ? reserved() : {};
      var fr = tiles().filter(function (ce) { return !ce.lock && !ce.item && !res[ce.c + ',' + ce.r]; });
      if (!fr.length) fr = tiles().filter(function (ce) { return !ce.lock && !ce.item; });
      if (!fr.length) return null;
      if (rng() < mistake) return fr[(rng() * fr.length) | 0];
      var best = null, bs = -1e9;
      fr.forEach(function (ce) { var v = tileScore(ce, it); if (v > bs) { bs = v; best = ce; } });
      return best;
    }
    function bestPairSpot() {
      var best = null, bs = -1;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS - 1; c++) {
        var a = cellAt(c, r), b = cellAt(c + 1, r);
        if (!open(a) || !open(b) || a.item || b.item) continue;
        var v = rng() < mistake ? rng() : covAt(c + 1, r + 0.5, 2.2);
        if (v > bs) { bs = v; best = a; }
      }
      return best;
    }
    function boardHas(ch, unpairedOnly) {
      return S.cells.filter(function (ce) { return ce.item && ce.item.t === 'c' && ce.item.ch === ch && (!unpairedOnly || !(ce.item.gen || ce.item.genR)); });
    }
    function partnersOf(ch) {
      var out = [];
      G.content.gens.forEach(function (k) { var c2 = GENERALS[k].chars; if (c2[0] === ch) out.push({ k: k, ch: c2[1], left: true }); if (c2[1] === ch) out.push({ k: k, ch: c2[0], left: false }); });
      return out;
    }
    function tryMerge(i, it) {
      if (rng() < mergeSkip) return false;
      var m = tiles().filter(function (ce) { return ce.item && mergeable(it, ce.item); });
      if (m.length) {
        m.sort(function (a, b) { return (b.item.gen || b.item.genR ? 100 : 0) + tileScore(b, it) - (a.item.gen || a.item.genR ? 100 : 0) - tileScore(a, it); });
        return mv(B(i), T(m[0].c, m[0].r));
      }
      for (var j = 0; j < BENCH; j++) if (j !== i && S.bench[j] && mergeable(it, S.bench[j])) return mv(B(i), B(j));
      return false;
    }
    function placeName(i, it) {
      if (rng() > (p.genFocus == null ? 1 : p.genFocus) + 0.15) return false; // 低段位常常没想起来凑武将
      var pts = partnersOf(it.ch);
      for (var q = 0; q < pts.length; q++) {
        var ps = boardHas(pts[q].ch, true);
        for (var w = 0; w < ps.length; w++) {
          var pc = ps[w], qc = pts[q].left ? pc.c - 1 : pc.c + 1, Q = cellAt(qc, pc.r);
          if (open(Q) && !Q.item) return mv(B(i), T(Q.c, Q.r));
          if (open(Q) && Q.item && Q.item.t === 'u' && rng() > mistake) {
            var f = bestFree(Q.item, true);
            if (f && f !== Q) { mv(T(Q.c, Q.r), T(f.c, f.r)); return mv(B(i), T(Q.c, Q.r)); }
          }
        }
      }
      for (var q2 = 0; q2 < pts.length; q2++) {
        for (var j = 0; j < BENCH; j++) {
          var o = S.bench[j];
          if (j === i || !o || o.t !== 'c' || o.ch !== pts[q2].ch) continue;
          var spot = bestPairSpot();
          if (!spot) break;
          var meL = pts[q2].left;
          mv(B(i), T(meL ? spot.c : spot.c + 1, spot.r));
          return mv(B(j), T(meL ? spot.c + 1 : spot.c, spot.r));
        }
      }
      if (boardHas(it.ch, true).length) return false;
      if (G.freeTiles(sid) < 3 || rng() < mistake) return false;
      var spot2 = bestPairSpot();
      if (!spot2) return false;
      var left = pts.length && pts[0].left;
      return mv(B(i), T(left ? spot2.c : spot2.c + 1, spot2.r));
    }
    // 决定下一步（只排队，不立即执行）
    function one() {
      var i, it, f;
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i];
        if (!it || skip(it) || it.t === 's') continue;
        if (tryMerge(i, it)) return true;
      }
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i];
        if (it && !skip(it) && it.t === 'c' && placeName(i, it)) return true;
      }
      for (i = 0; i < BENCH; i++) {
        it = S.bench[i];
        if (it && !skip(it) && it.t === 's') {
          var best = null, bs = -1;
          tiles().forEach(function (ce) { if (ce.lock) { var v = rng() < mistake ? rng() : cov(ce.c, ce.r, 1.6) + cov(ce.c, ce.r, 3.2) * 0.3; if (v > bs) { bs = v; best = ce; } } });
          if (best) return mv(B(i), T(best.c, best.r));
        }
      }
      var order = [0, 1, 2, 3, 4].sort(function (a, b) { return (S.bench[b] ? val(S.bench[b]) : -1) - (S.bench[a] ? val(S.bench[a]) : -1); });
      for (var oi = 0; oi < BENCH; oi++) {
        i = order[oi]; it = S.bench[i];
        if (!it || skip(it) || it.t !== 'u') continue;
        if (it.k === 'nong' && G.freeTiles(sid) < 2) continue;
        f = bestFree(it, true);
        if (f) return mv(B(i), T(f.c, f.r));
      }
      var us = tiles().filter(function (ce) { return ce.item && ce.item.t === 'u'; });
      if (rng() >= mergeSkip) {
        for (var a = 0; a < us.length; a++) for (var b2 = a + 1; b2 < us.length; b2++) {
          if (mergeable(us[a].item, us[b2].item)) {
            var x = us[a], y = us[b2];
            if (tileScore(x, x.item) > tileScore(y, y.item)) { var tmp = x; x = y; y = tmp; }
            return mv(T(x.c, x.r), T(y.c, y.r));
          }
        }
        var cs = tiles().filter(function (ce) { return ce.item && ce.item.t === 'c'; });
        for (var a2 = 0; a2 < cs.length; a2++) for (var b3 = 0; b3 < cs.length; b3++) {
          if (a2 === b3 || !mergeable(cs[a2].item, cs[b3].item)) continue;
          var src = cs[a2], dst = cs[b3];
          if (src.item.gen || src.item.genR) continue;
          return mv(T(src.c, src.r), T(dst.c, dst.r));
        }
      }
      // 板满：用备战席里更强的兵替换最弱的兵（被换下的回到候补）
      if (G.freeTiles(sid) === 0 && rng() > mistake) {
        for (i = 0; i < BENCH; i++) {
          it = S.bench[i];
          if (!it || skip(it) || it.t !== 'u') continue;
          var wk = null;
          us.forEach(function (ce) { if (val(ce.item) < val(it) && (!wk || val(ce.item) < val(wk.item))) wk = ce; });
          if (wk) return mv(B(i), T(wk.c, wk.r));
        }
      }
      return false;
    }
    // 征兵与遣散：高段位攒钱等空位多了再一次补满；低段位有钱就点
    function economy() {
      var need = G.cost(sid), empt = G.emptySlots(sid), smart = p.smart == null ? 1 : p.smart;
      if (empt <= 1 && S.mantou >= need && rng() < 0.3 + smart * 0.7) {
        var worst = -1, wv = 1e9;
        for (var i = 0; i < BENCH; i++) {
          var it = S.bench[i];
          if (!it) continue;
          var v = it.t === 's' ? (G.lockedCount(sid) ? 5 : 0) : it.t === 'c' ? 6 * (it.lv || 1) * (partnersOf(it.ch).length ? 1 : 0.2) : val(it);
          if (v < wv) { wv = v; worst = i; }
        }
        if (worst >= 0 && wv < 8 && (G.freeTiles(sid) === 0 || empt === 0)) return mv(B(worst), { z: 'x' });
      }
      if (G.canSummon(sid)) {
        var go = rng() < smart ? (empt >= 3 || S.mantou >= need * 2 || empt === BENCH || G.phase !== 'wave' && empt >= 2) : true;
        if (go) { queue.push({ summon: true }); return true; }
      }
      return false;
    }
    function exec(q) {
      if (q.summon) {
        var got = G.summon(sid) || [];
        ignored = got.filter(function () { return rng() < (p.waste || 0); });
        return;
      }
      if (G.plan(sid, q.from, q.to)) G.apply(sid, q.from, q.to);
    }
    var cur = null, think = (p.tick || 1) * rng();
    function startNext() {
      var q = queue.shift();
      if (!q) return;
      var dur = q.summon ? 0.25 + (p.drag || 0.4) * 0.5 : (p.drag || 0.4) * (0.8 + 0.5 * rng());
      if (!q.summon && G.note) G.note({ type: 'aidrag', s: sid, from: q.from, to: q.to, dur: dur });
      cur = { q: q, t: dur };
    }
    function act() {
      // 测试用：立刻把能做的都做完
      for (var g = 0; g < 30; g++) {
        if (!queue.length && !one() && !economy()) break;
        while (queue.length) exec(queue.shift());
      }
    }
    return {
      act: act, params: p,
      update: function (dt) {
        if (G.over()) return;
        if (cur) {
          cur.t -= dt;
          if (cur.t > 0) return;
          exec(cur.q); cur = null;
          if (queue.length) { startNext(); return; }
          think = (p.tick || 1) * 0.35 * (0.6 + 0.8 * rng());
          return;
        }
        think -= dt;
        if (think > 0) return;
        if (one() || economy()) startNext();
        think = (p.tick || 1) * (1 + (p.jitter || 0) * (rng() - 0.5));
        if (rng() < (p.idle || 0)) think += (p.idleT || 2) * (0.5 + rng());
      }
    };
  }

  var API = {
    COLS: COLS, ROWS: ROWS, HEARTS: HEARTS, BENCH: BENCH, TIER_MULT: TIER_MULT, UNITS: UNITS, KINDS: KINDS,
    GENERALS: GENERALS, GEN_KEYS: GEN_KEYS, NAME_RECIPES: NAME_RECIPES, SYNERGIES: SYNERGIES, SYN_KEYS: SYN_KEYS,
    ENEMIES: ENEMIES, FACTIONS: FACTIONS, LEVELS: LEVELS, PATHS: PATHS, CFG: CFG, UNITS_W: UNITS_W,
    GEN_TIER: GEN_TIER, TIER_ATK: TIER_ATK, TIER_SPD: TIER_SPD, QUALITY: QUALITY, CORE_GENS: CORE_GENS, RANGE_PAD: RANGE_PAD,
    RANKS: RANKS, RANK_GROUPS: RANK_GROUPS, RANK_GROUP: RANK_GROUP, RANK_STARS: RANK_STARS, rankAfter: rankAfter, rankHp: rankHp, rankAI: rankAI, wavesFor: wavesFor, fieldsFor: fieldsFor, rankGroup: rankGroup,
    posAt: posAt, coverage: coverage, levelContent: levelContent, combineResult: combineResult, pairKey: pairKey, mergeable: mergeable,
    buildPath: buildPath, createGame: createGame, createBot: createBot, aiParams: aiParams, PLAYER_BOT: PLAYER_BOT, mulberry32: mulberry32
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ZYCore = API;
})(this);
