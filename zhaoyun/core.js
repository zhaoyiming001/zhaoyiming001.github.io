/* 赵云与阿斗 · 核心逻辑（不依赖 DOM，浏览器与 Node 均可运行） */
(function (root) {
  'use strict';

  var COLS = 7, ROWS = 10;
  // 山路：自顶部入口蜿蜒而下，终点 (3,9) 为阿斗
  var PATH = [
    [1, 0], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3],
    [1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [5, 6], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
    [1, 8], [2, 8], [3, 8], [3, 9]
  ];
  var ADOU = [3, 9];
  var START_OPEN = [[2, 4], [3, 4], [4, 4], [2, 6], [3, 6], [4, 6]];
  var TIER_MULT = [1, 2.2, 4.8, 10, 22];

  var UNITS = {
    dao: { ch: '刀', name: '刀兵', range: 1.25, dmg: 14, cd: 0.7, desc: '近身猛砍，单体伤害最高' },
    qiang: { ch: '枪', name: '枪兵', range: 2, dmg: 10, cd: 0.9, pierce: 2, desc: '长枪突刺，贯穿一线敌人' },
    qi: { ch: '骑', name: '骑兵', range: 1.5, dmg: 9, cd: 1.0, splash: 0.9, desc: '冲阵践踏，范围溅射' },
    gong: { ch: '弓', name: '弓手', range: 3.2, dmg: 7, cd: 0.6, arrow: true, desc: '远程射击，射程最远' }
  };
  var KINDS = ['dao', 'qiang', 'qi', 'gong'];

  var GENERALS = {
    zhaoyun: { name: '赵云', skill: '七进七出', dmg: 40, cd: 0.35, range: 2, skillCd: 8, aura: 'qi', chars: ['赵', '云'], atk: 'thrust',
      desc: '攻速极快；每 8 秒冲阵，重创 7 名敌人' },
    zhangfei: { name: '张飞', skill: '当阳怒吼', dmg: 60, cd: 1.0, range: 1.6, skillCd: 10, aura: 'qiang', chars: ['张', '飞'], atk: 'thrust',
      desc: '每 10 秒怒吼，震晕 2.5 格内敌人 1.5 秒' },
    guanyu: { name: '关羽', skill: '青龙偃月', dmg: 90, cd: 1.2, range: 1.5, splash: 1.2, skillCd: 9, aura: 'dao', chars: ['关', '羽'], atk: 'slash',
      desc: '攻击溅射；每 9 秒巨型月牙斩横扫周身' },
    huangzhong: { name: '黄忠', skill: '百步穿杨', dmg: 120, cd: 1.4, range: 5, skillCd: 7, aura: 'gong', chars: ['黄', '忠'], atk: 'arrow',
      desc: '射程极远；每 7 秒狙杀血量最高之敌（6 倍伤害）' },
    liubei: { name: '刘备', skill: '仁德', dmg: 30, cd: 1.0, range: 2.5, skillCd: 15, aura: 'all', chars: ['刘', '备'], atk: 'slash',
      desc: '每 15 秒为阿斗回复 1 心（满血时改赏馒头）' }
  };
  var GEN_KEYS = ['zhaoyun', 'zhangfei', 'guanyu', 'huangzhong', 'liubei'];
  var AURA_NAME = { qi: '骑', qiang: '枪', dao: '刀', gong: '弓', all: '全军' };

  // 字牌：十个武将名字，两字凑成一位武将
  var DROP_PIECES = ['赵', '云', '张', '飞', '关', '羽', '黄', '忠', '刘', '备'];
  var PARTNER = {};
  GEN_KEYS.forEach(function (gk) {
    var c = GENERALS[gk].chars;
    PARTNER[c[0]] = { ch: c[1], gk: gk };
    PARTNER[c[1]] = { ch: c[0], gk: gk };
  });

  var ENEMIES = {
    bing: { ch: '兵', name: '步兵', hp: 40, spd: 1.0, reward: 2, r: 0.3 },
    qi: { ch: '骑', name: '骑兵', hp: 30, spd: 1.8, reward: 2, r: 0.29 },
    dun: { ch: '盾', name: '盾兵', hp: 90, spd: 0.75, reward: 3, arrowRes: 0.4, r: 0.33 }
  };
  var BOSSES = {
    5: { name: '夏侯惇', ch: '惇', hpMul: 16, spd: 0.6 },
    10: { name: '张郃', ch: '郃', hpMul: 20, spd: 0.72 },
    15: { name: '许褚', ch: '褚', hpMul: 30, spd: 0.55 },
    20: { name: '曹操', ch: '曹', hpMul: 32, spd: 0.55, summon: 7 }
  };
  // 特殊波次的副标题与兵种倾向
  var WAVE_TAGS = {
    3: { tag: '轻骑突袭', qi: 0.55 }, 7: { tag: '虎豹骑', qi: 0.6 }, 9: { tag: '铁盾方阵', dun: 0.5 },
    12: { tag: '轻骑突袭', qi: 0.6 }, 14: { tag: '铁盾方阵', dun: 0.55 }, 17: { tag: '虎豹骑', qi: 0.65 },
    18: { tag: '重甲压境', dun: 0.6 }
  };

  var DIFFS = {
    easy: { name: '简单', hp: 0.8, start: 80 },
    normal: { name: '普通', hp: 1.0, start: 60 },
    hard: { name: '困难', hp: 1.35, start: 50 }
  };

  var CFG = {
    waves: 20, maxHp: 10,
    costBase: 10, costStep: 2, costCap: 80,
    hpGrowth: 1.215, rewardGrowth: 0.13, waveBonus: 10, waveBonusGrowth: 2,
    breakTime: 6, prepTime: 30, earlyBonusPerSec: 2,
    genGrowth: 0.14,
    weights: { dao: 24, qiang: 20, qi: 18, gong: 22, shovel: 6, piece: 10 },
    piecePity: 9, pieceFocus: 0.75,
    recycleBase: 6, recyclePiece: 5, recycleShovel: 5,
    auraBonus: 0.35, auraAll: 0.15, auraRange: 1.5,
    arrowSpeed: 13
  };

  // ---------- 小工具 ----------
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

  // 路径折线（单位：格），起点在棋盘上方
  var PTS = [[PATH[0][0] + 0.5, -0.7]];
  PATH.forEach(function (p) { PTS.push([p[0] + 0.5, p[1] + 0.5]); });
  var SEG = [];
  var PATH_LEN = 0;
  for (var si = 0; si < PTS.length - 1; si++) {
    var a = PTS[si], b = PTS[si + 1];
    var len = dist(a[0], a[1], b[0], b[1]);
    SEG.push({ x: a[0], y: a[1], dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, len: len, start: PATH_LEN });
    PATH_LEN += len;
  }
  function posAt(d, off, out) {
    out = out || {};
    if (d < 0) d = 0;
    var s = SEG[SEG.length - 1];
    for (var i = 0; i < SEG.length; i++) { if (d < SEG[i].start + SEG[i].len) { s = SEG[i]; break; } }
    var t = Math.min(d - s.start, s.len);
    out.x = s.x + s.dx * t - s.dy * off;
    out.y = s.y + s.dy * t + s.dx * off;
    out.dir = s.dx > 0.5 ? 'r' : s.dx < -0.5 ? 'l' : 'd';
    return out;
  }

  var PATH_SET = {};
  PATH.forEach(function (p) { PATH_SET[p[0] + ',' + p[1]] = 1; });

  // 某格以某射程覆盖的路径长度（供摆放建议 / 机器人使用）
  function coverage(c, r, range) {
    var cx = c + 0.5, cy = r + 0.5, tot = 0, step = 0.1, p = {};
    for (var d = 0; d < PATH_LEN; d += step) {
      posAt(d, 0, p);
      if (dist(cx, cy, p.x, p.y) <= range) tot += step;
    }
    return tot;
  }

  function sameRecipe(list, a, b) {
    return (list[0] === a && list[1] === b) || (list[0] === b && list[1] === a);
  }
  // 两张字牌能否凑成武将：返回武将物品或 null
  function combineResult(A, B) {
    if (!A || !B || A.t !== 'p' || B.t !== 'p') return null;
    var p = PARTNER[A.ch];
    return p && p.ch === B.ch ? { t: 'g', k: p.gk } : null;
  }
  function mergeable(A, B) {
    return A && B && A.t === 'u' && B.t === 'u' && A.k === B.k && A.lv === B.lv && A.lv < 5;
  }
  function itemValue(it) {
    if (!it) return 0;
    if (it.t === 'u') return CFG.recycleBase * Math.pow(2, it.lv - 1);
    if (it.t === 'p') return CFG.recyclePiece;
    if (it.t === 's') return CFG.recycleShovel;
    return 0;
  }

  function createGame(opts) {
    opts = opts || {};
    var diffKey = DIFFS[opts.diff] ? opts.diff : 'normal';
    var diff = DIFFS[diffKey];
    var seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    var rng = mulberry32(seed);
    var G = {
      diff: diffKey, seed: seed, quiet: !!opts.quiet,
      phase: 'prep', wave: 0, hp: CFG.maxHp, mantou: diff.start,
      summons: 0, piecesSince: 0, timer: CFG.prepTime, holdTimer: !!opts.holdTimer,
      bench: [null, null, null, null, null],
      cells: [], enemies: [], projs: [], queue: [], spawnT: 0, waveTag: '',
      time: 0, eid: 1, ev: [], auraDirty: true,
      stats: { kills: 0, leaks: 0, summons: 0, merges: 0, generals: [], maxTier: 1, earned: 0 }
    };
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        G.cells.push({ c: c, r: r, path: !!PATH_SET[c + ',' + r], lock: true, item: null });
      }
    }
    START_OPEN.forEach(function (p) { cellAt(p[0], p[1]).lock = false; });

    function rand() { return rng(); }
    function emit(e) {
      if (G.quiet) return;
      G.ev.push(e);
      if (G.ev.length > 3000) G.ev.splice(0, 1000);
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
        var ce = cellAt(loc.c, loc.r);
        ce.item = it || null;
        if (it) { it.cdLeft = Math.max(it.cdLeft || 0, 0.25); }
      }
      if (loc.z === 't' || (it && it.t === 'g')) G.auraDirty = true;
    }
    function locXY(loc) {
      if (loc.z === 't') return { x: loc.c + 0.5, y: loc.r + 0.5 };
      return null;
    }

    G.cellAt = cellAt;
    G.getItem = getItem;
    G.cost = function () { return Math.min(CFG.costCap, CFG.costBase + CFG.costStep * G.summons); };
    G.benchFree = function () { for (var i = 0; i < 5; i++) if (!G.bench[i]) return i; return -1; };
    G.freeTiles = function () {
      var n = 0;
      G.cells.forEach(function (ce) { if (!ce.path && !ce.lock && !ce.item) n++; });
      return n;
    };
    G.lockedCount = function () {
      var n = 0;
      G.cells.forEach(function (ce) { if (!ce.path && ce.lock) n++; });
      return n;
    };
    G.canSummon = function () {
      return G.phase !== 'won' && G.phase !== 'lost' && G.benchFree() >= 0 && G.mantou >= G.cost();
    };
    G.waveMult = function (n) { return Math.pow(CFG.hpGrowth, (n || G.wave) - 1) * diff.hp; };
    G.genMult = function () { return 1 + CFG.genGrowth * Math.max(0, G.wave - 1); };
    G.reward = function (base) { return Math.round(base * (1 + CFG.rewardGrowth * Math.max(0, G.wave - 1))); };

    // 当前持有的字件（备战栏 + 棋盘）
    function holdings() {
      var h = {};
      function add(it) { if (it && it.t === 'p') h[it.ch] = (h[it.ch] || 0) + 1; }
      G.bench.forEach(add);
      G.cells.forEach(function (ce) { add(ce.item); });
      return h;
    }
    function ownedGenerals() {
      var o = {};
      function add(it) { if (it && it.t === 'g') o[it.k] = (o[it.k] || 0) + 1; }
      G.bench.forEach(add);
      G.cells.forEach(function (ce) { add(ce.item); });
      return o;
    }
    // 字牌掉落：手里有半个名字时，偏向掉落另一半（保底）；否则偏向尚未拥有的武将
    function rollPiece() {
      var hold = holdings(), owned = ownedGenerals();
      var want = [];
      Object.keys(hold).forEach(function (ch) {
        var p = PARTNER[ch];
        if (p && !hold[p.ch]) want.push(p.ch);
      });
      if (want.length && rand() < CFG.pieceFocus) return { t: 'p', ch: want[(rand() * want.length) | 0] };
      var pool = [];
      DROP_PIECES.forEach(function (ch) {
        pool.push(ch);
        if (!owned[PARTNER[ch].gk]) pool.push(ch, ch);
      });
      return { t: 'p', ch: pool[(rand() * pool.length) | 0] };
    }
    function rollItem() {
      G.piecesSince++;
      if (G.piecesSince >= CFG.piecePity) { G.piecesSince = 0; return rollPiece(); }
      var w = CFG.weights;
      var locked = G.lockedCount();
      var sw = locked ? w.shovel : 0;
      if (locked && G.freeTiles() <= 1) sw *= 2.5;
      var total = w.dao + w.qiang + w.qi + w.gong + sw + w.piece;
      var x = rand() * total;
      if ((x -= w.dao) < 0) return { t: 'u', k: 'dao', lv: 1 };
      if ((x -= w.qiang) < 0) return { t: 'u', k: 'qiang', lv: 1 };
      if ((x -= w.qi) < 0) return { t: 'u', k: 'qi', lv: 1 };
      if ((x -= w.gong) < 0) return { t: 'u', k: 'gong', lv: 1 };
      if ((x -= sw) < 0) return { t: 's' };
      G.piecesSince = 0;
      return rollPiece();
    }

    G.summon = function () {
      if (!G.canSummon()) return null;
      var slot = G.benchFree();
      var cost = G.cost();
      G.mantou -= cost;
      G.summons++;
      G.stats.summons++;
      var it = rollItem();
      G.bench[slot] = it;
      emit({ type: 'summon', slot: slot, item: it, cost: cost });
      return it;
    };

    // 判断一次拖放会发生什么（不修改状态）
    G.plan = function (from, to) {
      var A = getItem(from);
      if (!A || !to) return null;
      if (to.z === 'x') {
        if (A.t === 'g') return { act: 'norecycle' };
        return { act: 'recycle', value: itemValue(A) };
      }
      if (from.z === to.z && from.i === to.i && from.c === to.c && from.r === to.r) return null;
      var B;
      if (to.z === 't') {
        var ce = cellAt(to.c, to.r);
        if (!ce || ce.path) return null;
        if (ce.lock) return A.t === 's' ? { act: 'dig' } : null;
        if (A.t === 's') return null;
        B = ce.item;
        if (!B) return { act: from.z === 't' ? 'move' : 'place' };
        if (mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
        var res = combineResult(A, B);
        if (res) return { act: 'general', result: res };
        if (from.z === 'b' && B.t === 's') return null;
        return { act: 'swap' };
      }
      if (to.z === 'b') {
        if (to.i < 0 || to.i > 4) return null;
        B = G.bench[to.i];
        if (!B) return { act: 'move' };
        if (mergeable(A, B)) return { act: 'merge', lv: A.lv + 1 };
        var res2 = combineResult(A, B);
        if (res2) return { act: 'general', result: res2 };
        if (from.z === 't' && B.t === 's') return null;
        return { act: 'swap' };
      }
      return null;
    };

    G.apply = function (from, to) {
      var p = G.plan(from, to);
      if (!p || p.act === 'norecycle') return p;
      var A = getItem(from), B = getItem(to);
      var xy = locXY(to);
      switch (p.act) {
        case 'recycle':
          setItem(from, null);
          G.mantou += p.value;
          emit({ type: 'recycle', value: p.value, from: from, item: A });
          break;
        case 'dig':
          setItem(from, null);
          cellAt(to.c, to.r).lock = false;
          emit({ type: 'dig', c: to.c, r: to.r });
          break;
        case 'place': case 'move':
          setItem(from, null);
          setItem(to, A);
          emit({ type: 'place', to: to, item: A });
          break;
        case 'swap':
          setItem(from, B);
          setItem(to, A);
          emit({ type: 'swap', from: from, to: to });
          break;
        case 'merge':
          setItem(from, null);
          B.lv = p.lv;
          B.cdLeft = 0.2;
          if (to.z === 't') G.auraDirty = true;
          G.stats.merges++;
          if (p.lv > G.stats.maxTier) G.stats.maxTier = p.lv;
          emit({ type: 'merge', to: to, lv: p.lv, kind: B.k, x: xy && xy.x, y: xy && xy.y });
          break;
        case 'general':
          setItem(from, null);
          var gi = { t: 'g', k: p.result.k, cdLeft: 0.3, skLeft: 2 };
          setItem(to, gi);
          if (G.stats.generals.indexOf(gi.k) < 0) G.stats.generals.push(gi.k);
          emit({ type: 'general', to: to, k: gi.k, x: xy && xy.x, y: xy && xy.y });
          break;
      }
      return p;
    };

    // ---------- 波次 ----------
    function buildWave(n) {
      var count = Math.min(40, 6 + 2 * n);
      var tagDef = WAVE_TAGS[n] || {};
      var pQi = tagDef.qi || (n < 3 ? 0 : Math.min(0.32, 0.08 + 0.02 * (n - 3)));
      var pDun = tagDef.dun || (n < 4 ? 0 : Math.min(0.3, 0.06 + 0.02 * (n - 4)));
      if (tagDef.qi) pDun = Math.min(pDun, 0.15);
      if (tagDef.dun) pQi = Math.min(pQi, 0.15);
      var list = [];
      for (var i = 0; i < count; i++) {
        var x = rand();
        list.push(x < pQi ? 'qi' : x < pQi + pDun ? 'dun' : 'bing');
      }
      // 前两只总是步兵，节奏更柔和
      if (list.length > 2) { list[0] = 'bing'; list[1] = 'bing'; }
      if (BOSSES[n]) list.splice(Math.floor(count * 0.45), 0, 'boss');
      G.waveTag = tagDef.tag || '';
      return list;
    }
    function spawn(type, d) {
      var mult = G.waveMult();
      var e = { id: G.eid++, type: type, d: d || 0, stun: 0, flash: 0, off: (rand() - 0.5) * 0.36, x: 0, y: 0, dead: false };
      if (type === 'boss') {
        var bd = BOSSES[G.wave] || BOSSES[5];
        e.boss = true; e.name = bd.name; e.ch = bd.ch; e.spd = bd.spd; e.r = 0.44; e.off = 0;
        e.maxHp = ENEMIES.bing.hp * mult * bd.hpMul; e.reward = 25 + 5 * Math.floor(G.wave / 5);
        if (bd.summon) e.sumT = bd.summon;
        emit({ type: 'boss', name: bd.name });
      } else {
        var def = ENEMIES[type];
        e.ch = def.ch; e.spd = def.spd; e.r = def.r; e.maxHp = def.hp * mult; e.reward = G.reward(def.reward);
      }
      e.hp = e.maxHp;
      posAt(e.d, e.off, e);
      G.enemies.push(e);
      return e;
    }
    G.startWave = function () {
      if (G.phase !== 'prep' && G.phase !== 'break') return;
      G.wave++;
      G.queue = buildWave(G.wave);
      G.spawnT = 0.3;
      G.phase = 'wave';
      G.auraDirty = true;
      emit({ type: 'wave', n: G.wave, boss: BOSSES[G.wave] ? BOSSES[G.wave].name : '', tag: G.waveTag });
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
      if (G.wave >= CFG.waves) {
        G.phase = 'won';
        emit({ type: 'win' });
      } else {
        G.phase = 'break';
        G.timer = CFG.breakTime;
        emit({ type: 'break', n: G.wave });
      }
    }

    // ---------- 战斗 ----------
    function hurt(e, dmg, arrow) {
      if (e.dead) return;
      if (arrow && e.type === 'dun') dmg *= (1 - ENEMIES.dun.arrowRes);
      e.hp -= dmg;
      e.flash = 0.09;
      emit({ type: 'dmg', x: e.x, y: e.y - e.r, v: dmg, frac: dmg / e.maxHp, big: dmg >= e.maxHp * 0.5 });
      if (e.hp <= 0) kill(e);
    }
    function kill(e) {
      e.dead = true;
      G.mantou += e.reward;
      G.stats.kills++;
      G.stats.earned += e.reward;
      emit({ type: 'kill', x: e.x, y: e.y, reward: e.reward, boss: !!e.boss, etype: e.type });
      if (e.boss) {
        var slot = G.benchFree();
        if (slot >= 0) {
          var pc = rollPiece();
          G.bench[slot] = pc;
          emit({ type: 'drop', slot: slot, item: pc, name: e.name });
        }
      }
    }
    function updateAura() {
      G.auraDirty = false;
      var gens = [];
      G.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'g') gens.push({ k: ce.item.k, x: ce.c + 0.5, y: ce.r + 0.5 }); });
      var hasLiu = gens.some(function (g) { return g.k === 'liubei'; });
      G.cells.forEach(function (ce) {
        var it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) return;
        var m = 1;
        if (hasLiu) m += CFG.auraAll;
        if (it.t === 'u') {
          var used = {};
          gens.forEach(function (g) {
            var a = GENERALS[g.k].aura;
            if (a === it.k && !used[g.k] && dist(g.x, g.y, ce.c + 0.5, ce.r + 0.5) <= CFG.auraRange + 1e-6) {
              used[g.k] = 1; m += CFG.auraBonus;
            }
          });
        }
        it.aura = m;
      });
    }
    G.updateAura = updateAura;

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
        if (!e.dead && dist(x, y, e.x, e.y) <= rad) fn(e);
      }
    }
    function pierce(x, y, tx, ty, len, dmg) {
      var dx = tx - x, dy = ty - y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;
      var hits = [];
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (e.dead) continue;
        var px = e.x - x, py = e.y - y;
        var t = px * dx + py * dy;
        if (t < 0 || t > len + 0.2) continue;
        var perp = Math.abs(px * dy - py * dx);
        if (perp <= 0.32 + e.r * 0.5) hits.push(e);
      }
      hits.forEach(function (e) { hurt(e, dmg); });
      return { x2: x + dx * len, y2: y + dy * len };
    }
    function attack(it, ce, tgt) {
      var x = ce.c + 0.5, y = ce.r + 0.5;
      var def, dmg;
      if (it.t === 'u') { def = UNITS[it.k]; dmg = def.dmg * TIER_MULT[it.lv - 1] * (it.aura || 1); }
      else { def = GENERALS[it.k]; dmg = def.dmg * G.genMult() * (it.aura || 1); }
      it.lunge = 0.16; it.lx = tgt.x - x; it.ly = tgt.y - y;
      var kind = it.t === 'u' ? it.k : def.atk;
      if (def.arrow) {
        G.projs.push({ x: x, y: y, tgt: tgt, dmg: dmg, gold: it.t === 'g', ang: Math.atan2(tgt.y - y, tgt.x - x) });
        emit({ type: 'shoot', gold: it.t === 'g' });
        return;
      }
      if (def.pierce || kind === 'thrust') {
        var end = pierce(x, y, tgt.x, tgt.y, def.pierce || def.range, dmg);
        emit({ type: 'atk', kind: 'qiang', x: x, y: y, x2: end.x2, y2: end.y2, gold: it.t === 'g', lv: it.lv || 5 });
        return;
      }
      if (def.splash) {
        inRadius(tgt.x, tgt.y, def.splash, function (e) { hurt(e, dmg); });
        emit({ type: 'atk', kind: it.t === 'g' ? 'slash' : 'qi', x: x, y: y, x2: tgt.x, y2: tgt.y, rad: def.splash, gold: it.t === 'g', lv: it.lv || 5 });
        return;
      }
      hurt(tgt, dmg);
      emit({ type: 'atk', kind: 'dao', x: x, y: y, x2: tgt.x, y2: tgt.y, gold: it.t === 'g', lv: it.lv || 5 });
    }
    function castSkill(it, ce) {
      var x = ce.c + 0.5, y = ce.r + 0.5;
      var def = GENERALS[it.k];
      var base = def.dmg * G.genMult() * (it.aura || 1);
      var live = G.enemies.filter(function (e) { return !e.dead && e.d > 0.05; });
      if (it.k === 'liubei') {
        if (G.phase !== 'wave') return false;
        if (G.hp < CFG.maxHp) { G.hp++; emit({ type: 'skill', k: it.k, x: x, y: y, heal: 1 }); }
        else { var g = 6 + G.wave; G.mantou += g; emit({ type: 'skill', k: it.k, x: x, y: y, gold: g }); }
        return true;
      }
      if (!live.length) return false;
      if (it.k === 'zhaoyun') {
        var near = live.filter(function (e) { return dist(x, y, e.x, e.y) <= 3.6; });
        if (!near.length) return false;
        near.sort(function (a, b) { return b.d - a.d; });
        near = near.slice(0, 7);
        var pts = near.map(function (e) { return [e.x, e.y]; });
        near.forEach(function (e) { hurt(e, base * 6); });
        emit({ type: 'skill', k: it.k, x: x, y: y, pts: pts });
        return true;
      }
      if (it.k === 'zhangfei') {
        var any = false;
        inRadius(x, y, 2.5, function (e) { any = true; });
        if (!any) return false;
        inRadius(x, y, 2.5, function (e) { e.stun = Math.max(e.stun, e.boss ? 0.8 : 1.5); hurt(e, base * 1.5); });
        emit({ type: 'skill', k: it.k, x: x, y: y, rad: 2.5 });
        return true;
      }
      if (it.k === 'guanyu') {
        var hit = 0;
        inRadius(x, y, 2.1, function () { hit++; });
        if (!hit) return false;
        var tg = findTarget(x, y, 2.1);
        inRadius(x, y, 2.1, function (e) { hurt(e, base * 4); });
        emit({ type: 'skill', k: it.k, x: x, y: y, rad: 2.1, ang: tg ? Math.atan2(tg.y - y, tg.x - x) : 0 });
        return true;
      }
      if (it.k === 'huangzhong') {
        var top = live[0];
        live.forEach(function (e) { if (e.hp > top.hp) top = e; });
        var tx = top.x, ty = top.y;
        hurt(top, base * 6, true);
        emit({ type: 'skill', k: it.k, x: x, y: y, x2: tx, y2: ty });
        return true;
      }
      return false;
    }

    G.step = function (dt) {
      if (G.phase === 'won' || G.phase === 'lost' || G.paused) return;
      G.time += dt;
      if (G.phase === 'prep' || G.phase === 'break') {
        if (!G.holdTimer) G.timer -= dt;
        if (G.timer <= 0) G.startWave();
      }
      if (G.phase === 'wave') {
        G.spawnT -= dt;
        if (G.queue.length && G.spawnT <= 0) {
          spawn(G.queue.shift());
          G.spawnT += 0.8 - 0.35 * (G.wave - 1) / (CFG.waves - 1);
        }
      }
      if (G.auraDirty) updateAura();

      // 敌军移动
      var i, e;
      for (i = 0; i < G.enemies.length; i++) {
        e = G.enemies[i];
        if (e.dead) continue;
        if (e.flash > 0) e.flash -= dt;
        if (e.stun > 0) { e.stun -= dt; }
        else e.d += e.spd * dt;
        if (e.sumT != null) {
          e.sumT -= dt;
          if (e.sumT <= 0 && e.d > 1) {
            e.sumT = BOSSES[20].summon;
            spawn('bing', e.d - 0.4); spawn('bing', e.d - 0.8);
            emit({ type: 'summonEnemy', x: e.x, y: e.y, name: e.name });
          }
        }
        if (e.d >= PATH_LEN) {
          e.dead = true;
          var loss = e.boss ? 3 : 1;
          G.hp = Math.max(0, G.hp - loss);
          G.stats.leaks++;
          emit({ type: 'leak', loss: loss, boss: !!e.boss });
          if (G.hp <= 0) {
            G.phase = 'lost';
            emit({ type: 'lose' });
            return;
          }
          continue;
        }
        posAt(e.d, e.off, e);
      }

      // 我军攻击
      for (i = 0; i < G.cells.length; i++) {
        var ce = G.cells[i], it = ce.item;
        if (!it || (it.t !== 'u' && it.t !== 'g')) continue;
        if (it.lunge > 0) it.lunge -= dt;
        if (it.t === 'g') {
          it.skLeft = (it.skLeft == null ? 2 : it.skLeft) - dt;
          if (it.skLeft <= 0 && G.phase === 'wave') {
            if (castSkill(it, ce)) it.skLeft = GENERALS[it.k].skillCd;
            else it.skLeft = 0;
          }
        }
        it.cdLeft = (it.cdLeft || 0) - dt;
        if (it.cdLeft > 0) continue;
        var range = it.t === 'u' ? UNITS[it.k].range : GENERALS[it.k].range;
        var tgt = findTarget(ce.c + 0.5, ce.r + 0.5, range);
        if (!tgt) { it.cdLeft = 0; continue; }
        attack(it, ce, tgt);
        it.cdLeft += it.t === 'u' ? UNITS[it.k].cd : GENERALS[it.k].cd;
      }

      // 箭矢
      for (i = 0; i < G.projs.length; i++) {
        var p = G.projs[i];
        var t = p.tgt;
        if (t.dead) { p.done = true; continue; }
        var dx = t.x - p.x, dy = t.y - p.y, l = Math.sqrt(dx * dx + dy * dy);
        var mv = CFG.arrowSpeed * dt;
        p.ang = Math.atan2(dy, dx);
        if (l <= mv + 0.12) { p.done = true; hurt(t, p.dmg, true); emit({ type: 'arrowHit', x: t.x, y: t.y, gold: p.gold }); }
        else { p.x += dx / l * mv; p.y += dy / l * mv; }
      }
      if (G.projs.length) G.projs = G.projs.filter(function (q) { return !q.done; });
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
        v: 1, diff: G.diff, wave: G.wave, hp: G.hp, mantou: G.mantou, summons: G.summons, piecesSince: G.piecesSince,
        bench: G.bench.map(bare),
        cells: G.cells.map(function (ce) { return ce.path ? 0 : [ce.lock ? 1 : 0, bare(ce.item)]; }),
        stats: clone(G.stats), time: G.time, seed: (rand() * 1e9) | 0
      };
    };
    if (opts.save) {
      var s = opts.save;
      G.wave = s.wave; G.hp = s.hp; G.mantou = s.mantou; G.summons = s.summons; G.piecesSince = s.piecesSince || 0;
      G.bench = s.bench.map(function (it) { return it ? clone(it) : null; });
      s.cells.forEach(function (v, idx) {
        if (!v || !G.cells[idx] || G.cells[idx].path) return;
        G.cells[idx].lock = !!v[0];
        G.cells[idx].item = v[1] ? clone(v[1]) : null;
      });
      G.stats = clone(s.stats) || G.stats;
      G.time = s.time || 0;
      G.phase = G.wave > 0 ? 'break' : 'prep';
      G.timer = G.wave > 0 ? CFG.breakTime + 4 : CFG.prepTime;
      if (s.seed != null) rng = mulberry32(s.seed);
    }
    return G;
  }

  var API = {
    COLS: COLS, ROWS: ROWS, PATH: PATH, PTS: PTS, PATH_LEN: PATH_LEN, ADOU: ADOU, START_OPEN: START_OPEN,
    TIER_MULT: TIER_MULT, UNITS: UNITS, KINDS: KINDS, GENERALS: GENERALS, GEN_KEYS: GEN_KEYS, AURA_NAME: AURA_NAME,
    PARTNER: PARTNER, DROP_PIECES: DROP_PIECES, ENEMIES: ENEMIES, BOSSES: BOSSES, DIFFS: DIFFS, CFG: CFG,
    WAVE_TAGS: WAVE_TAGS, posAt: posAt, coverage: coverage, combineResult: combineResult, mergeable: mergeable,
    itemValue: itemValue, createGame: createGame
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ZYCore = API;
})(this);
