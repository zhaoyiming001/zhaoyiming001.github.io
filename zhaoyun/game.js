/* 赵云与阿斗 v3 · 界面、布局、渲染循环、操作、战役 */
(function () {
  'use strict';
  var Z = window.ZYCore, I = window.ZYInk, A = window.ZYAnim, SND = window.ZYSound;
  var COLS = Z.COLS, ROWS = Z.ROWS, STEP = 1 / 60, TAU = Math.PI * 2;
  var INK = A.INK, VERM = A.VERM;
  var $ = function (id) { return document.getElementById(id); };
  var NUMCN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

  // ---------- 存储 ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('zyad.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('zyad.' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
    del: function (k) { try { localStorage.removeItem('zyad.' + k); } catch (e) { /* 忽略 */ } }
  };
  function campaign() {
    var c = store.get('campaign', null);
    if (!c || typeof c !== 'object') c = {};
    if (!Array.isArray(c.stars)) c.stars = [];
    c.unlocked = Math.max(1, Math.min(Z.LEVELS.length, c.unlocked | 0));
    c.stars = c.stars.slice(0, Z.LEVELS.length).map(function (v) { return Math.max(0, Math.min(3, v | 0)); });
    return c;
  }
  store.del('save'); // v2 的局内存档：v3 双方对战不再保存局内进度
  SND.set(store.get('sound', true) !== false);
  function sfx(n, a, quiet) { if (!quickMode) SND.play(n, a, quiet); }

  // ---------- 画布与布局 ----------
  var cv = $('cv'), ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, cell = 40, LX = 0, Y0 = 0, Y1 = 0, RY0 = 0, RY1 = 0, DOCKY = 0, BS = 48, TB = 44;
  var slots = [], recycleR = null, summonR = null;
  function layout() {
    var app = $('app');
    W = app.clientWidth; H = app.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    I.setDpr(dpr); A.clearCaches();
    TB = 44;
    var dockMin = 132;
    var cw = (Math.min(W, 640) - 16) / COLS;
    var ch = (H - TB - dockMin - 6) / 10.9;
    cell = Math.max(24, Math.floor(Math.min(cw, ch, 78)));
    var R = Math.round(cell * 0.9);
    var fieldH = cell * 10 + R;
    var spare = H - TB - dockMin - fieldH;
    var topPad = Math.max(2, Math.min(spare * 0.25, 30));
    LX = Math.round((W - cell * COLS) / 2);
    Y0 = Math.round(TB + topPad);
    RY0 = Y0 + cell * ROWS; RY1 = RY0 + R;
    Y1 = RY1;
    DOCKY = Y1 + cell * ROWS + Math.max(4, Math.min(14, spare * 0.15));
    var dockH = H - DOCKY;
    BS = Math.round(Math.min(cell * 1.18, (Math.min(W, 560) - 40) / 5.4, dockH * 0.48));
    var gap = Math.round(BS * 0.16), bw = BS * 5 + gap * 4, bx = Math.round((W - bw) / 2);
    var by = DOCKY + Math.round(Math.max(4, (dockH - BS - 60) * 0.3));
    slots = [];
    for (var i = 0; i < 5; i++) slots.push({ x: bx + i * (BS + gap), y: by, w: BS, h: BS });
    var cy = by + BS + Math.max(8, (dockH - (by - DOCKY) - BS - 52) / 2);
    var sw = Math.min(200, W * 0.42);
    summonR = { x: Math.round(W / 2 - sw / 2), y: Math.round(cy), w: Math.round(sw), h: 50 };
    recycleR = { x: Math.max(8, bx - 4), y: Math.round(cy - 2), w: Math.round(Math.min(96, (W - sw) / 2 - 18)), h: 54 };
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var sb = $('btnSummon');
    sb.style.left = summonR.x + 'px'; sb.style.top = summonR.y + 'px'; sb.style.width = summonR.w + 'px'; sb.style.height = summonR.h + 'px';
    var bun = $('bunBox');
    bun.style.left = (summonR.x + summonR.w + 12) + 'px'; bun.style.top = (summonR.y + 6) + 'px';
    var rg = $('ridge');
    rg.style.top = RY0 + 'px'; rg.style.height = R + 'px';
    var tb = $('topbar'), tw = Math.min(W, Math.max(cell * COLS + 24, 360));
    tb.style.height = TB + 'px'; tb.style.left = Math.round((W - tw) / 2) + 'px'; tb.style.right = 'auto'; tb.style.width = tw + 'px';
    rg.style.left = LX + 'px'; rg.style.right = 'auto'; rg.style.width = cell * COLS + 'px'; rg.style.padding = '0 4px';
    bg = null; bgSig = '';
    if (G) buildBg();
  }
  window.addEventListener('resize', function () { layout(); sizeTitle(); });

  // 局部坐标 -> 屏幕坐标：下半场 y 向下，上半场镜像（第 0 行贴着中间山脊）
  var _p = { x: 0, y: 0 };
  function sp(s, lx, ly, out) {
    out = out || _p;
    out.x = LX + lx * cell;
    out.y = s === 0 ? Y1 + ly * cell : RY0 - ly * cell;
    return out;
  }
  function cellCenter(s, c, r, out) { return sp(s, c + 0.5, r + 0.5, out); }

  // ---------- 场景背景（缓存） ----------
  var bg = null, bgSig = '';
  var SCENES = {
    plain: { tint: '#f3ead6', hill: '60,58,52', amb: 'seed' },
    pass: { tint: '#f1e8d4', hill: '45,42,40', amb: 'dust', rocks: 1 },
    fire: { tint: '#f4e5d1', hill: '110,50,30', amb: 'ember' },
    river: { tint: '#eeede3', hill: '50,64,74', amb: 'mist', river: 1 },
    mountain: { tint: '#f0e9d8', hill: '40,44,40', amb: 'seed', pines: 1 },
    flood: { tint: '#e9ebe4', hill: '50,64,74', amb: 'rain', river: 1 },
    jungle: { tint: '#ecebd8', hill: '40,62,44', amb: 'mist', pines: 1 },
    plateau: { tint: '#f2e8d2', hill: '80,64,44', amb: 'leaf' }
  };
  function scene() { return SCENES[G ? G.L.scene : 'plain'] || SCENES.plain; }
  function smooth(pts, it) {
    for (var k = 0; k < it; k++) {
      var o = [pts[0]];
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      o.push(pts[pts.length - 1]);
      pts = o;
    }
    return pts;
  }
  function roadPts(s) {
    var P = G.P, pts = [];
    var first = P.pts[0];
    var q = sp(s, first[0], -0.55, {}); pts.push([q.x, q.y]);
    for (var i = 1; i < P.pts.length; i++) { var r = sp(s, P.pts[i][0], P.pts[i][1], {}); pts.push([r.x, r.y]); }
    return smooth(pts, 3);
  }
  function buildBg() {
    if (!G) return;
    var sig = G.level + '|' + W + 'x' + H + '|' + cell + '|' + dpr + '|' + G.sides.map(function (S) { return S.cells.map(function (c) { return c.lock ? 1 : 0; }).join(''); }).join('/');
    if (bg && sig === bgSig) return;
    bgSig = sig;
    var SC = scene();
    var c = I.canvas(W * dpr, H * dpr), x = c.getContext('2d');
    x.drawImage(I.paper(W, H, 11 + G.level * 7, SC.tint), 0, 0);
    x.scale(dpr, dpr);
    // 两侧留白处：大字题款
    var margin = LX;
    if (margin > 90) {
      x.save();
      x.globalAlpha = 0.07;
      var nm = G.L.name, fs = Math.min(margin * 0.75, H / (nm.length + 1));
      x.font = fs + 'px "ZY Brush", serif'; x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (var i = 0; i < nm.length; i++) x.fillText(nm[i], margin / 2, H / 2 + (i - (nm.length - 1) / 2) * fs * 1.05);
      x.globalAlpha = 0.9;
      I.seal(x, margin / 2, H / 2 + (nm.length / 2 + 0.7) * fs, Math.min(48, fs * 0.5), G.L.rival[0]);
      x.restore();
      x.save(); x.globalAlpha = 0.06;
      var era = G.L.era.replace(' · ', '');
      var fs2 = Math.min(margin * 0.45, H / (era.length + 2));
      x.font = fs2 + 'px "ZY Brush", serif'; x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (var j = 0; j < era.length; j++) x.fillText(era[j], W - margin / 2, H / 2 + (j - (era.length - 1) / 2) * fs2 * 1.1);
      x.restore();
    }
    // 远山：上下两端
    I.mountains(x, -20, W + 40, Y0 + cell * 0.6, cell * 1.6, { seed: 5 + G.level, layers: 3, alpha: 0.13, color: SC.hill });
    sceneWash(x, G.L.scene);
    drawRidge(x, SC);
    drawField(x, 1, SC);
    drawField(x, 0, SC);
    bg = c;
  }
  // 各战役的水墨氛围
  function sceneWash(x, k) {
    var R = I.rng(41 + G.level);
    function wash(cx, cy, r, col) { var g2 = x.createRadialGradient(cx, cy, 0, cx, cy, r); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    if (k === 'fire') {
      wash(0, H, H * 0.55, 'rgba(200,70,30,.16)'); wash(W, 0, H * 0.5, 'rgba(200,70,30,.12)'); wash(W * 0.5, RY0, W * 0.6, 'rgba(220,120,60,.06)');
    } else if (k === 'river' || k === 'flood') {
      wash(W * 0.5, (RY0 + RY1) / 2, W * 0.8, 'rgba(90,120,140,.12)');
      if (k === 'flood') { x.fillStyle = 'rgba(90,115,130,.07)'; x.fillRect(0, 0, W, H); }
      // 芦苇
      for (var i = 0; i < 14; i++) { var rx = R() * W, ry = R() < 0.5 ? RY0 - 2 : RY1 + cell * 0.2; I.grass(x, rx, ry, cell * 0.7, i * 13 + 5, 0.3); }
    } else if (k === 'mountain' || k === 'pass') {
      I.mountains(x, -10, W + 20, RY0 + 4, cell * 1.3, { seed: 61 + G.level, layers: 2, alpha: k === 'pass' ? 0.26 : 0.2, color: '40,40,38' });
      I.mountains(x, -10, W + 20, RY1 - 4, cell * 1.1, { seed: 71 + G.level, layers: 2, alpha: 0.16, color: '40,40,38', dir: 1 });
    } else if (k === 'jungle') {
      wash(0, Y0, H * 0.5, 'rgba(60,110,70,.12)'); wash(W, H, H * 0.5, 'rgba(60,110,70,.12)');
    } else if (k === 'plateau') {
      wash(W * 0.85, Y0 * 0.6 + 10, cell * 1.6, 'rgba(240,200,120,.25)');
      x.strokeStyle = 'rgba(179,38,30,.35)'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(W * 0.15, 6); x.quadraticCurveTo(W * 0.3, 18, W * 0.4, Y0 * 0.9 + 6); x.stroke();
    }
  }
  function drawRidge(x, SC) {
    var R = RY1 - RY0, cy = (RY0 + RY1) / 2;
    if (SC.river) {
      var g = x.createLinearGradient(0, RY0, 0, RY1);
      g.addColorStop(0, 'rgba(90,120,140,0)'); g.addColorStop(0.3, 'rgba(90,120,140,.22)'); g.addColorStop(0.7, 'rgba(90,120,140,.22)'); g.addColorStop(1, 'rgba(90,120,140,0)');
      x.fillStyle = g; x.fillRect(0, RY0 - 4, W, R + 8);
      x.strokeStyle = 'rgba(60,85,100,.35)'; x.lineWidth = 1;
      var Rr = I.rng(3);
      for (var i = 0; i < 18; i++) {
        var wx = Rr() * W, wy = RY0 + R * (0.25 + Rr() * 0.5), wl = 14 + Rr() * 30;
        x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + wl / 2, wy - 3, wx + wl, wy); x.stroke();
      }
    } else {
      I.mountains(x, -10, W + 20, RY1 - R * 0.15, R * 1.05, { seed: 21 + G.level, layers: 3, alpha: 0.2, color: SC.hill });
    }
    // 中线：一笔浓墨飞白
    var pts = [], n = 24;
    for (var k = 0; k <= n; k++) pts.push([W * 0.02 + k / n * W * 0.96, cy + Math.sin(k * 0.7) * 1.2]);
    I.dryBrush(x, pts, Math.max(5, R * 0.16), '#1b1712', 9 + G.level, 0.55);
    // 敌军出口：山门
    var gxp = LX + (G.P.pts[0][0]) * cell;
    var gw = cell * 0.72;
    x.fillStyle = 'rgba(244,236,219,.9)';
    x.fillRect(gxp - gw / 2, cy - R * 0.32, gw, R * 0.64);
    x.strokeStyle = 'rgba(27,23,18,.7)'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(gxp - gw / 2, cy - R * 0.38); x.lineTo(gxp - gw / 2, cy + R * 0.38); x.moveTo(gxp + gw / 2, cy - R * 0.38); x.lineTo(gxp + gw / 2, cy + R * 0.38); x.stroke();
    x.lineWidth = 2.4; x.beginPath(); x.moveTo(gxp - gw * 0.65, cy - R * 0.4); x.quadraticCurveTo(gxp, cy - R * 0.5, gxp + gw * 0.65, cy - R * 0.4); x.stroke();
    x.beginPath(); x.moveTo(gxp - gw * 0.65, cy + R * 0.4); x.quadraticCurveTo(gxp, cy + R * 0.5, gxp + gw * 0.65, cy + R * 0.4); x.stroke();
    var fb = I.glyph(Z.FACTIONS[G.L.faction].badge);
    if (fb) I.draw(x, fb, gxp, cy, R * 0.5, 'rgba(27,23,18,.75)');
  }
  function drawField(x, s, SC) {
    var S = G.sides[s], C = cell;
    var top = s === 0 ? Y1 : Y0;
    // 淡赭底
    var g = x.createLinearGradient(0, top, 0, top + C * ROWS);
    g.addColorStop(0, 'rgba(190,160,110,.06)'); g.addColorStop(0.5, 'rgba(190,160,110,.1)'); g.addColorStop(1, 'rgba(190,160,110,.06)');
    x.fillStyle = g; x.fillRect(LX - 6, top, C * COLS + 12, C * ROWS);
    // 路
    var pts = roadPts(s);
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(176,142,92,.26)'; x.lineWidth = C * 0.8;
    x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.stroke();
    x.strokeStyle = 'rgba(150,115,70,.16)'; x.lineWidth = C * 0.56;
    x.stroke();
    I.dryBrush(x, pts, C * 0.82, '#4a3826', 31 + s * 7 + G.level, 0.13);
    // 车辙
    [-0.17, 0.17].forEach(function (off) {
      x.strokeStyle = 'rgba(90,68,42,.22)'; x.lineWidth = 1;
      x.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        var px = pts[i][0] - dy / l * off * C, py = pts[i][1] + dx / l * off * C;
        if (i) x.lineTo(px, py); else x.moveTo(px, py);
      }
      x.stroke();
    });
    // 格子
    var R = I.rng(77 + s * 13 + G.level);
    S.cells.forEach(function (ce) {
      if (ce.path) return;
      var q = cellCenter(s, ce.c, ce.r, {});
      var cx = q.x, cy = q.y;
      if (ce.block) {
        if (SC.pines || SC.river ? R() < 0.5 : R() < 0.3) I.pine(x, cx, cy + C * 0.35, C * 0.9, ce.c * 7 + ce.r);
        else I.rock(x, cx, cy + C * 0.25, C * 0.75, ce.c * 5 + ce.r * 3);
        return;
      }
      if (ce.lock) {
        // 荒地：淡墨草丛 + 枯笔斜皴
        x.fillStyle = 'rgba(120,110,80,.06)';
        I.rr(x, cx - C * 0.42, cy - C * 0.42, C * 0.84, C * 0.84, C * 0.12); x.fill();
        x.strokeStyle = 'rgba(80,70,50,.1)'; x.lineWidth = 0.8;
        for (var h = 0; h < 4; h++) { var hx = cx - C * 0.3 + h * C * 0.18; x.beginPath(); x.moveTo(hx, cy + C * 0.3); x.lineTo(hx + C * 0.14, cy - C * 0.3); x.stroke(); }
        I.grass(x, cx - C * 0.12 + (R() - 0.5) * C * 0.2, cy + C * 0.28, C * 0.5, ce.c * 31 + ce.r * 7 + s, 0.4);
        if (R() < 0.6) I.grass(x, cx + C * 0.2, cy + C * 0.1, C * 0.35, ce.c * 17 + ce.r * 3 + s, 0.3);
        return;
      }
      // 可布阵的空位：浅浅的牌位
      x.fillStyle = 'rgba(255,252,240,.45)';
      I.rr(x, cx - C * 0.43, cy - C * 0.43, C * 0.86, C * 0.86, C * 0.12); x.fill();
      x.strokeStyle = 'rgba(120,90,50,.2)'; x.lineWidth = 1; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(cx - C * 0.38, cy + C * 0.42); x.lineTo(cx + C * 0.42, cy + C * 0.42); x.lineTo(cx + C * 0.42, cy - C * 0.38); x.stroke();
      if (ce.high) { x.fillStyle = 'rgba(80,100,60,.09)'; x.fillRect(cx - C * 0.43, cy - C * 0.43, C * 0.86, C * 0.86); }
    });
    // 阿斗：终点红印
    var e = G.P.end, ap = cellCenter(s, e[0], e[1], {});
    x.fillStyle = 'rgba(179,38,30,.08)';
    x.beginPath(); x.arc(ap.x, ap.y, C * 0.55, 0, TAU); x.fill();
    I.seal(x, ap.x, ap.y - C * 0.06, C * 0.56, '阿斗');
  }
  function aduPos(s) { var e = G.P.end; return cellCenter(s, e[0], e[1], {}); }

  // ---------- 动画环境 ----------
  var animNow = 0, shakeAmt = 0, quickMode = false;
  var ENV = {
    get ctx() { return ctx; }, get cell() { return cell; }, get now() { return animNow; }, get W() { return W; },
    sfx: function (n, a) { sfx(n, a, curSide === 1); },
    shake: function (v) { if (curSide === 0 || v > 3) shakeAmt = Math.max(shakeAmt, v * (curSide === 1 ? 0.5 : 1)); },
    enemiesNear: function (s, X, Y, R, fn) { if (!G) return; G.sides[s].enemies.forEach(function (e) { var q = sp(s, e.x, e.y, {}); if (Math.hypot(q.x - X, q.y - Y) <= R + cell * 0.2) fn(q.x, q.y); }); },
    enemiesLine: function (s, X, Y, ang, L, w, fn) {
      if (!G) return;
      G.sides[s].enemies.forEach(function (e) { var q = sp(s, e.x, e.y, {}); var px = q.x - X, py = q.y - Y, t = px * Math.cos(ang) + py * Math.sin(ang); if (t > -cell * 0.2 && t < L + cell * 0.3 && Math.abs(-px * Math.sin(ang) + py * Math.cos(ang)) < w + cell * 0.2) fn(q.x, q.y); });
    },
    enemyPos: function (s, id) { if (!G) return null; var l = G.sides[s].enemies; for (var i = 0; i < l.length; i++) if (l[i].id === id) return sp(s, l[i].x, l[i].y, {}); return null; },
    aduPos: function (s) { return aduPos(s); }
  };
  var curSide = 0;
  A.init(ENV);

  // ---------- 状态 ----------
  var G = null, bot = null, autoBot = null, running = false, paused = false, gameOver = false, speed = store.get('speed', 1) === 2 ? 2 : 1;
  var acc = 0, last = 0, tanim = [{}, {}], benchAnim = [null, null, null, null, null], drag = null, pend = null, tipLoc = null, tipUntil = 0;
  var manual = false, endT = 0, flood = 0, heartFx = [[0, 0, 0], [0, 0, 0]], aduShake = [0, 0], sideFlash = [0, 0];
  var tutStep = store.get('tut', 0) | 0;

  // ---------- 事件 -> 画面 ----------
  function tileKey(c, r) { return r * COLS + c; }
  function setAnim(s, c, r, a) { a.t = 0; a.f = {}; a.s = s; a.c = c; a.r = r; tanim[s][tileKey(c, r)] = a; return a; }
  function handleEvents(evs) {
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], s = e.s;
      curSide = s == null ? 0 : s;
      var quiet = s === 1;
      switch (e.type) {
        case 'atk': {
          var q = sp(s, e.tx != null ? e.tx : e.c + 0.5, e.ty != null ? e.ty : e.r + 0.5, {});
          var a = { type: 'atk', kind: e.kind, gk: e.gk, mode: e.mode, lv: e.lv || 1, TX: q.x, TY: q.y, len: e.len, rad: e.rad,
            dur: e.gk ? (e.mode === 'gallop' && e.gk === 'machao' ? 0.6 : e.mode === 'thrust' ? 0.5 : 0.48) : (A.DUR[e.kind] || 0.45), gold: !!e.gk };
          if (e.mode === 'thrust') {
            // 预先算出枪尖穿过的敌人（画面溅墨用）
            var hits = [], S = G.sides[s], ox = e.c + 0.5, oy = e.r + 0.5, dx = e.tx - ox, dy = e.ty - oy, l = Math.hypot(dx, dy) || 1;
            dx /= l; dy /= l;
            S.enemies.forEach(function (en) { var px = en.x - ox, py = en.y - oy, t = px * dx + py * dy; if (t > -0.1 && t < (e.len || 2) + 0.2 && Math.abs(px * dy - py * dx) < 0.45) { var w = sp(s, en.x, en.y, {}); hits.push([w.x, w.y]); } });
            a.hits = hits;
          }
          setAnim(s, e.c, e.r, a);
          break;
        }
        case 'drum': setAnim(s, e.c, e.r, { type: 'atk', kind: 'gu', mode: 'drum', lv: (G.sides[s].cells[tileKey(e.c, e.r)].item || {}).lv || 1, rad: e.rad, dur: A.DUR.gu, TX: 0, TY: 0 }); break;
        case 'hit': {
          var h = sp(s, e.x, e.y, {});
          if (e.mode === 'fire') { A.embers(h.x, h.y, 5, cell * 0.5); A.drops(h.x, h.y, 3, cell * 1.2, cell * 0.07, '#8a2a12'); }
          else { A.drops(h.x, h.y, e.gen ? 5 : 3, cell * 1.3, cell * 0.07); if (e.gen) A.sparks(h.x, h.y, 6, cell * 1.6); }
          sfx('hit', null, quiet);
          break;
        }
        case 'pierce': { var pq = sp(s, e.x, e.y, {}); A.drops(pq.x, pq.y, 4, cell * 1.5, cell * 0.08, '#1c2433'); break; }
        case 'boom': {
          var b = sp(s, e.x, e.y, {});
          A.addFx({ k: 'boom', x: b.x, y: b.y, r: (e.rad || 1) * cell, v: (Math.random() * 6) | 0, life: 0.6 });
          A.ring(b.x, b.y, cell * 0.3, (e.rad || 1) * cell * 1.1, '27,23,18', 0.45, 5);
          A.drops(b.x, b.y, 10, cell * 2.2, cell * 0.11);
          A.dust(b.x, b.y, 6, cell * 0.5);
          A.word(b.x + cell * 0.2, b.y - cell * 0.6, '轰', cell * 0.5, INK, 0.55, -0.15);
          ENV.shake(2.5); sfx('boom', null, quiet);
          break;
        }
        case 'kill': {
          var k = sp(s, e.x, e.y, {});
          A.deathFx(e.ch, k.x, k.y, Math.round(e.r * 2 * cell * 1.08), e.boss);
          if (e.boss) { sfx('bossdown', null, quiet); ENV.shake(5); if (s === 0) banner('斩 ' + e.name, e.lieut ? '敌将授首' : '大将授首', 'red'); }
          else sfx('kill', null, quiet);
          if (s === 0 && A.fx().length < 200) A.word(k.x + cell * 0.25, k.y - cell * 0.3, '+' + e.reward, Math.round(cell * 0.26), '#8a5a0c', 0.6);
          break;
        }
        case 'leak': {
          heartFx[s][Math.max(0, G.sides[s].hearts)] = 1;
          aduShake[s] = 0.6; sideFlash[s] = 0.5;
          var ap = aduPos(s);
          A.drops(ap.x, ap.y, 10, cell * 2, cell * 0.12, VERM);
          if (s === 0) { sfx('hurt'); shakeAmt = Math.max(shakeAmt, 7); flashScreen('hurt'); }
          else sfx('foehurt');
          updateHearts(true);
          break;
        }
        case 'heal': updateHearts(true); heartFx[s][G.sides[s].hearts - 1] = -1; break;
        case 'skill': {
          var cc = cellCenter(s, e.c, e.r, {}), d = I.tileDims(cell);
          var f = { gk: e.k, s: s, c: e.c, r: e.r, X: cc.x, Y: cc.y, FY: cc.y - d.t / 2, ev: e, pts: (e.pts || []).map(function (pp) { var w = sp(s, pp[0], pp[1], {}); return [w.x, w.y]; }) };
          if (e.x2 != null) { var w2 = sp(s, e.x2, e.y2, {}); f.x2 = w2.x; f.y2 = w2.y; }
          if (s === 1 && e.ang != null) e = Object.assign({}, e, { ang: -e.ang });
          f.ev = e;
          A.startSkill(f);
          delete tanim[s][tileKey(e.c, e.r)];
          break;
        }
        case 'summon':
          if (s === 0) {
            e.lost.forEach(function (it, j) { if (it) A.addFx({ k: 'lostcard', it: it, x: slots[j].x + BS / 2, y: slots[j].y + BS / 2, life: 0.5 }); });
            for (var j = 0; j < 5; j++) benchAnim[j] = { t: -j * 0.07, dur: 0.5 };
            sfx('summon');
            if (e.lost.length) sfx('discard');
            tutNote('summon');
          }
          break;
        case 'place': case 'move': case 'swap':
          if (e.to && e.to.z === 't') {
            var it2 = G.sides[s].cells[tileKey(e.to.c, e.to.r)].item;
            setAnim(s, e.to.c, e.to.r, { type: it2 && it2.t === 'g' ? 'general' : 'write', dur: it2 && it2.t === 'g' ? 0.6 : 0.28 });
            var pc = cellCenter(s, e.to.c, e.to.r, {});
            A.drops(pc.x, pc.y + cell * 0.3, 2, cell * 0.6, cell * 0.05);
          }
          if (e.from && e.from.z === 't' && e.type !== 'swap') delete tanim[s][tileKey(e.from.c, e.from.r)];
          if (e.type === 'swap' && e.from.z === 't') setAnim(s, e.from.c, e.from.r, { type: 'write', dur: 0.28 });
          if (s === 0) { sfx('place'); tutNote('place'); } else sfx('place', null, true);
          break;
        case 'merge': {
          setAnim(s, e.to.c != null ? e.to.c : 0, e.to.r != null ? e.to.r : 0, { type: 'merge', dur: 0.45 });
          if (e.to.z === 't') {
            var m = cellCenter(s, e.to.c, e.to.r, {});
            A.ring(m.x, m.y, cell * 0.3, cell * 0.9, hexRgb(I.tierEdge(e.lv)), 0.45, 4);
            A.addFx({ k: 'flash', x: m.x, y: m.y, r: cell * 0.8, c: 'rgba(255,245,220,.9)', life: 0.3, a: 0.8 });
            A.sparks(m.x, m.y, 8, cell * 1.4, I.tierEdge(e.lv));
          } else if (e.to.z === 'b' && s === 0) benchAnim[e.to.i] = { t: 0, dur: 0.4, merge: 1 };
          if (e.from && e.from.z === 't') delete tanim[s][tileKey(e.from.c, e.from.r)];
          sfx('merge', e.lv, quiet);
          if (s === 0) tutNote('merge');
          break;
        }
        case 'general': {
          if (e.to.z === 't') {
            setAnim(s, e.to.c, e.to.r, { type: 'general', dur: 0.8 });
            var gp = cellCenter(s, e.to.c, e.to.r, {});
            A.addFx({ k: 'flash', x: gp.x, y: gp.y, r: cell * 1.6, c: 'rgba(255,215,120,.95)', life: 0.6, a: 0.9 });
            A.ring(gp.x, gp.y, cell * 0.3, cell * 1.6, '201,150,46', 0.6, 5);
            A.sparks(gp.x, gp.y, 18, cell * 2.2);
          } else if (s === 0) benchAnim[e.to.i] = { t: 0, dur: 0.6, merge: 1 };
          if (e.from && e.from.z === 't') delete tanim[s][tileKey(e.from.c, e.from.r)];
          var GG = Z.GENERALS[e.k];
          if (s === 0) { banner(GG.name, '「' + GG.skill + '」 · ' + GG.desc.split('；')[0], 'gold'); sfx('general'); }
          else { var gq = cellCenter(1, e.to.c || 0, e.to.r || 0, {}); A.word(gq.x, gq.y - cell * 0.7, GG.name, Math.round(cell * 0.36), '#8a5a0c', 1.2); sfx('general', null, true); }
          break;
        }
        case 'dig': {
          var dg = cellCenter(s, e.c, e.r, {});
          A.addFx({ k: 'dig', x: dg.x, y: dg.y, s: cell, life: 0.5 });
          A.drops(dg.x, dg.y, 8, cell * 1.8, cell * 0.09, '#5a4630');
          A.dust(dg.x, dg.y, 5, cell * 0.4);
          bgSig = '';
          sfx('dig', null, quiet);
          break;
        }
        case 'recycle':
          if (s === 0) {
            A.addFx({ k: 'lostcard', it: e.item, x: recycleR.x + recycleR.w / 2, y: recycleR.y + recycleR.h / 2 - 6, life: 0.4, sink: 1 });
            A.word(recycleR.x + recycleR.w / 2, recycleR.y - 4, '+' + e.value, Math.round(cell * 0.32), '#8a5a0c', 0.7);
            sfx('recycle');
          }
          break;
        case 'synergy': {
          var SY = Z.SYNERGIES[e.k];
          if (s === 0) { banner(SY.name, SY.desc, 'gold'); sfx('synergy'); }
          break;
        }
        case 'wave':
          banner('第' + NUMCN[e.n - 1] + '波', e.tag || (e.last ? '最后一波' : '敌军来袭'), e.boss ? 'red' : '');
          sfx(e.boss ? 'boss' : 'wave');
          break;
        case 'boss':
          sfx('boss');
          break;
        case 'bossAct': {
          var bp = sp(s, e.x, e.y, {});
          var BW = { summon: '召', swarm: '骑', charge: '冲', rage: '怒', shield: '守', burn: '火' }[e.act] || '！';
          A.word(bp.x, bp.y - cell * 0.8, BW, Math.round(cell * 0.5), VERM, 0.8);
          if (e.act === 'burn') (e.pts || []).forEach(function (pp) { var w = sp(s, pp[0], pp[1], {}); A.embers(w.x, w.y, 6, cell * 0.6); });
          if (e.act === 'shield') A.ring(bp.x, bp.y, cell * 0.3, cell * 0.9, '70,110,170', 0.5, 3);
          sfx('bossAct', null, quiet);
          break;
        }
        case 'revive': { var rv = sp(s, e.x, e.y, {}); A.word(rv.x, rv.y - cell * 0.8, '不服', Math.round(cell * 0.42), VERM, 1); break; }
        case 'flood': flood = 3.5; sfx('flood'); break;
        case 'clear': break;
        case 'win': case 'lose': onEnd(e); break;
      }
    }
    curSide = 0;
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }

  // ---------- 渲染 ----------
  var hud = {};
  function render(dt) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!G) { c.clearRect(0, 0, W, H); return; }
    buildBg();
    var sx = 0, sy = 0;
    if (shakeAmt > 0.05) { sx = (Math.random() - 0.5) * shakeAmt; sy = (Math.random() - 0.5) * shakeAmt; }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(bg, Math.round(sx * dpr), Math.round(sy * dpr));
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save();
    c.translate(sx, sy);
    drawAmbient(c, dt);
    for (var s = 1; s >= 0; s--) drawSide(c, s, dt);
    A.drawFx(c, dt);
    A.drawParts(c);
    if (flood > 0) {
      c.fillStyle = 'rgba(80,110,130,' + Math.min(0.18, flood * 0.08) + ')';
      c.fillRect(LX, Y0, cell * COLS, cell * ROWS); c.fillRect(LX, Y1, cell * COLS, cell * ROWS);
    }
    c.restore();
    drawDock(c, dt);
    if (drag && drag.on) drawDrag(c);
  }
  var sortBuf = [];
  function drawSide(c, s, dt) {
    var S = G.sides[s], C = cell, now = animNow, d = I.tileDims(C);
    curSide = s;
    // 受伤红晕
    if (sideFlash[s] > 0) {
      var top = s === 0 ? Y1 : Y0;
      c.fillStyle = 'rgba(179,38,30,' + sideFlash[s] * 0.25 + ')';
      c.fillRect(LX - 6, top, C * COLS + 12, C * ROWS);
    }
    // 阿斗与心
    var ap = aduPos(s), shk = aduShake[s] > 0 ? Math.sin(now * 60) * aduShake[s] * C * 0.1 : 0;
    for (var h = 0; h < 3; h++) {
      var hx = ap.x - C * 0.24 + h * C * 0.24 + shk, hy = ap.y + (s === 0 ? C * 0.38 : -C * 0.5);
      drawHeart(c, hx, hy, C * 0.11, h < S.hearts);
    }
    // 选中 / 拖动时显示射程
    if (s === 0 && tipLoc && tipLoc.z === 't' && performance.now() < tipUntil) {
      var it0 = S.cells[tileKey(tipLoc.c, tipLoc.r)].item;
      if (it0 && (it0.t === 'u' || it0.t === 'g')) {
        var rg = (it0.t === 'u' ? Z.UNITS[it0.k].range : Z.GENERALS[it0.k].range) * C;
        var q0 = cellCenter(0, tipLoc.c, tipLoc.r, {});
        c.fillStyle = 'rgba(179,38,30,.06)'; c.strokeStyle = 'rgba(179,38,30,.4)'; c.lineWidth = 1.2; c.setLineDash([4, 4]);
        c.beginPath(); c.arc(q0.x, q0.y, rg, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
      }
    }
    if (s === 0 && drag && drag.on) drawTargets(c);
    // 静止字牌
    var anims = tanim[s], q = {};
    for (var i = 0; i < S.cells.length; i++) {
      var ce = S.cells[i], it = ce.item;
      if (!it) continue;
      if (s === 0 && drag && drag.on && drag.from.z === 't' && drag.from.c === ce.c && drag.from.r === ce.r) {
        cellCenter(s, ce.c, ce.r, q);
        A.drawTile(c, it, q.x, q.y, { alpha: 0.25, t: now });
        continue;
      }
      var a = anims[i];
      if (a && a.type === 'atk') continue;
      cellCenter(s, ce.c, ce.r, q);
      var sk = it.t === 'g' ? A.activeSkill(s, ce.c, ce.r) : null;
      var burn = it.burnT > 0;
      A.drawTile(c, it, q.x, q.y, { anim: a, t: now, hide: sk ? A.skillHide(sk) : null });
      if (burn) { if (Math.random() < 0.2) A.embers(q.x, q.y, 1, C * 0.5); }
      if (it.rushT > 0) { c.strokeStyle = 'rgba(201,150,46,' + (0.4 + 0.3 * Math.sin(now * 12)) + ')'; c.lineWidth = 1.5; I.rr(c, q.x - d.w / 2 - 2, q.y - d.h / 2 - d.t / 2 - 2, d.w + 4, d.h + d.t + 4, d.w * 0.15); c.stroke(); }
    }
    // 敌军
    var fac = Z.FACTIONS[G.L.faction].color;
    for (var j = 0; j < S.enemies.length; j++) {
      var e = S.enemies[j];
      sp(s, e.x, e.y, q);
      var al = e.d < 0.7 ? Math.max(0, e.d / 0.7) : 1;
      if (al < 1) c.globalAlpha = al;
      A.drawEnemy(c, e, q.x, q.y, fac, now);
      c.globalAlpha = 1;
    }
    A.drawLinks(c, S.enemies, function (e) { return sp(s, e.x, e.y, {}); });
    // 出手中的字牌（兵器会越过敌军）
    for (var k in anims) {
      var an = anims[k];
      if (an.type !== 'atk') continue;
      var cc = S.cells[k], it3 = cc && cc.item;
      if (!it3 || (it3.t !== 'u' && it3.t !== 'g')) { delete anims[k]; continue; }
      cellCenter(s, cc.c, cc.r, q);
      A.drawTile(c, it3, q.x, q.y, { anim: an, t: now });
    }
    // 投射物
    for (var p = 0; p < S.projs.length; p++) {
      var pr = S.projs[p];
      if (pr.delay > 0) continue;
      sp(s, pr.x, pr.y, q);
      var ang = pr.mode === 'bolt' ? Math.atan2(pr.dy, pr.dx) : pr.ang;
      if (s === 1) ang = -ang;
      A.drawProj(c, pr, q.x, q.y, ang, s);
    }
    curSide = 0;
  }
  function drawHeart(c, x, y, r, full) {
    c.save(); c.translate(x, y);
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.4);
    c.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.9);
    if (full) { c.fillStyle = VERM; c.fill(); }
    else { c.strokeStyle = 'rgba(120,40,30,.5)'; c.lineWidth = 1; c.stroke(); }
    c.restore();
  }
  // 拖动时：可放置位置提示
  function drawTargets(c) {
    var C = cell, q = {}, S = G.sides[0];
    for (var i = 0; i < S.cells.length; i++) {
      var ce = S.cells[i], pl = drag.plans[i];
      if (!pl) continue;
      cellCenter(0, ce.c, ce.r, q);
      var hov = drag.hover && drag.hover.z === 't' && drag.hover.c === ce.c && drag.hover.r === ce.r;
      var pulse = 0.5 + 0.5 * Math.sin(animNow * 8);
      var col = pl.act === 'merge' ? I.tierEdge(pl.lv) : pl.act === 'general' ? '#c9962e' : pl.act === 'dig' ? '#7a5a30' : pl.act === 'swap' ? 'rgba(120,90,50,.5)' : 'rgba(120,90,50,.55)';
      c.strokeStyle = col; c.lineWidth = hov ? 3 : (pl.act === 'merge' || pl.act === 'general' ? 2.2 : 1.2);
      c.globalAlpha = hov ? 1 : (pl.act === 'merge' || pl.act === 'general' ? 0.6 + 0.4 * pulse : 0.55);
      I.rr(c, q.x - C * 0.46, q.y - C * 0.46, C * 0.92, C * 0.92, C * 0.14); c.stroke();
      if (pl.act === 'merge' || pl.act === 'general') {
        I.blit(c, I.glowSprite(pl.act === 'general' ? 'rgba(255,210,110,.6)' : 'rgba(255,240,200,.5)', Math.round(C * 0.6)), q.x, q.y, 1, 0.5 + 0.4 * pulse);
        c.font = Math.round(C * 0.26) + 'px "ZY Brush", serif'; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(pl.act === 'general' ? '将' : '合', q.x + C * 0.34, q.y - C * 0.36);
      }
      c.globalAlpha = 1;
    }
  }

  // ---------- 备战席与回收 ----------
  function drawDock(c, dt) {
    var S = G.sides[0];
    // 席位
    for (var i = 0; i < 5; i++) {
      var r = slots[i];
      c.fillStyle = 'rgba(120,90,50,.07)';
      I.rr(c, r.x, r.y, r.w, r.h, r.w * 0.14); c.fill();
      c.strokeStyle = 'rgba(120,90,50,.25)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    }
    var sc = BS / (cell * 0.98);
    for (var j = 0; j < 5; j++) {
      var it = S.bench[j], sl = slots[j];
      if (!it) continue;
      var ba = benchAnim[j];
      if (drag && drag.on && drag.from.z === 'b' && drag.from.i === j) { A.drawTile(c, it, sl.x + BS / 2, sl.y + BS / 2, { scale: sc, alpha: 0.25, t: animNow }); continue; }
      if (ba) {
        ba.t += dt;
        if (ba.t < 0) continue;
        if (ba.t >= ba.dur) { benchAnim[j] = null; ba = null; }
      }
      var X = sl.x + BS / 2, Y = sl.y + BS / 2;
      if (ba && !ba.merge) {
        // 发牌：从征兵按钮飞来，翻面后笔顺书写
        var p = Math.min(1, ba.t / 0.22);
        var fx0 = summonR.x + summonR.w / 2, fy0 = summonR.y + summonR.h / 2;
        var e = A.eo(p);
        var x = A.lerp(fx0, X, e), y = A.lerp(fy0, Y, e) - Math.sin(p * Math.PI) * BS * 0.5;
        if (p < 1) {
          c.save(); c.translate(x, y); c.scale(Math.max(0.05, Math.abs(Math.cos(p * Math.PI))) * sc, sc);
          if (p < 0.5) { I.blit(c, I.tileSprite('u', 1, cell), 0, 0); c.fillStyle = 'rgba(70,110,80,.85)'; I.rr(c, -cell * 0.38, -cell * 0.42, cell * 0.76, cell * 0.8, cell * 0.1); c.fill(); }
          else I.blit(c, I.tileSprite(it.t === 'u' ? 'u' : it.t, it.lv || 1, cell), 0, 0);
          c.restore();
          continue;
        }
        A.drawTile(c, it, X, Y, { scale: sc, t: animNow, anim: { type: 'write', t: ba.t - 0.22, dur: ba.dur - 0.22 } });
        continue;
      }
      if (ba && ba.merge) {
        var pm = ba.t / ba.dur;
        A.drawTile(c, it, X, Y, { scale: sc * (1 + 0.15 * Math.sin(pm * Math.PI)), t: animNow });
        continue;
      }
      A.drawTile(c, it, X, Y, { scale: sc, t: animNow });
    }
    // 回收：墨色笔洗
    var R = recycleR, hov = drag && drag.on && drag.hover && drag.hover.z === 'x';
    var cx = R.x + R.w / 2, cy = R.y + R.h * 0.45;
    c.save();
    c.fillStyle = hov ? 'rgba(179,38,30,.12)' : 'rgba(120,90,50,.06)';
    c.beginPath(); c.ellipse(cx, cy + 6, R.w * 0.42, R.h * 0.34, 0, 0, TAU); c.fill();
    c.strokeStyle = hov ? VERM : 'rgba(60,45,30,.55)'; c.lineWidth = hov ? 2.2 : 1.4;
    c.beginPath(); c.ellipse(cx, cy, R.w * 0.36, R.h * 0.12, 0, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(cx - R.w * 0.36, cy); c.quadraticCurveTo(cx - R.w * 0.3, cy + R.h * 0.42, cx, cy + R.h * 0.42); c.quadraticCurveTo(cx + R.w * 0.3, cy + R.h * 0.42, cx + R.w * 0.36, cy); c.stroke();
    c.font = Math.round(Math.min(18, R.h * 0.32)) + 'px "ZY Brush", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = hov ? VERM : 'rgba(40,30,20,.7)';
    c.fillText(drag && drag.on && drag.plans.x && drag.plans.x.act === 'recycle' ? '回收 +' + drag.plans.x.value : '回收', cx, cy + R.h * 0.2);
    c.restore();
  }

  // ---------- 拖放 ----------
  function locAt(x, y) {
    for (var i = 0; i < 5; i++) { var r = slots[i]; if (x >= r.x - 4 && x < r.x + r.w + 4 && y >= r.y - 6 && y < r.y + r.h + 6) return { z: 'b', i: i }; }
    var R = recycleR; if (x >= R.x - 6 && x < R.x + R.w + 6 && y >= R.y - 8 && y < R.y + R.h + 8) return { z: 'x' };
    var c = Math.floor((x - LX) / cell), r2 = Math.floor((y - Y1) / cell);
    if (c >= 0 && c < COLS && r2 >= 0 && r2 < ROWS) return { z: 't', c: c, r: r2 };
    return null;
  }
  function itemAt(loc) { return loc && loc.z !== 'x' ? G.getItem(0, loc) : null; }
  function canvasXY(ev) { var b = cv.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; }
  cv.addEventListener('pointerdown', function (ev) {
    if (!G || !running || paused || gameOver) return;
    SND.unlock();
    var p = canvasXY(ev), loc = locAt(p.x, p.y);
    if (!loc || loc.z === 'x') return;
    var it = itemAt(loc);
    if (!it) { hideTip(); return; }
    pend = { from: loc, x0: p.x, y0: p.y, id: ev.pointerId, touch: ev.pointerType === 'touch', t0: performance.now() };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
    ev.preventDefault();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!pend && !(drag && drag.on)) return;
    var p = canvasXY(ev);
    if (pend && !drag) {
      if (Math.hypot(p.x - pend.x0, p.y - pend.y0) < 6) return;
      startDrag(pend);
    }
    if (drag && drag.on) {
      drag.x = p.x; drag.y = p.y;
      var hv = locAt(p.x, p.y - (drag.touch ? cell * 0.35 : 0));
      if (hv && hv.z === 'b' && drag.from.z === 'b' && hv.i === drag.from.i) hv = null;
      drag.hover = hv;
    }
  });
  function startDrag(p) {
    var it = itemAt(p.from);
    if (!it) { pend = null; return; }
    var plans = {};
    G.sides[0].cells.forEach(function (ce, i) { plans[i] = G.plan(0, p.from, { z: 't', c: ce.c, r: ce.r }); });
    plans.x = G.plan(0, p.from, { z: 'x' });
    drag = { on: true, from: p.from, item: it, x: p.x0, y: p.y0, touch: p.touch, plans: plans, hover: null };
    hideTip();
    sfx('pick');
  }
  function endDrag(ev) {
    var p = ev ? canvasXY(ev) : null;
    if (drag && drag.on) {
      var to = p ? locAt(p.x, p.y - (drag.touch ? cell * 0.35 : 0)) : null;
      var res = to ? G.apply(0, drag.from, to) : null;
      if (!res || res.act === 'norecycle') {
        if (res && res.act === 'norecycle') showTip('武将不可回收', p.x, p.y);
        else if (to && !(to.z === drag.from.z && to.i === drag.from.i && to.c === drag.from.c && to.r === drag.from.r)) sfx('error');
      }
      handleEvents(G.drain());
      drag = null; pend = null;
      return;
    }
    if (pend && p) onTap(pend.from, p);
    pend = null;
  }
  cv.addEventListener('pointerup', function (ev) { endDrag(ev); });
  cv.addEventListener('pointercancel', function () { drag = null; pend = null; });
  function drawDrag(c) {
    var it = drag.item, y = drag.y - (drag.touch ? cell * 0.35 : 0);
    var sc = drag.from.z === 'b' && !(drag.hover && drag.hover.z === 't') ? BS / (cell * 0.98) * 1.08 : 1.1;
    A.drawTile(c, it, drag.x, y, { lift: 1, scale: sc, t: animNow });
  }

  // ---------- 提示 ----------
  var tipEl = $('tip');
  var TIERN = ['一阶', '二阶', '三阶', '四阶', '五阶'];
  function fmt1(v) { return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10); }
  function itemInfo(it) {
    if (it.t === 'u') {
      var U = Z.UNITS[it.k], dmg = U.dmg * Z.TIER_MULT[it.lv - 1];
      return '<b>' + U.ch + '</b> · ' + TIERN[it.lv - 1] + (U.dmg ? ' · 伤害 ' + fmt1(dmg) : '') + ' · 射程 ' + U.range + '<br>' + U.desc + (it.lv < 5 ? '<br><i>同字同阶相叠 → ' + TIERN[it.lv] + '</i>' : '');
    }
    if (it.t === 'g') { var GG = Z.GENERALS[it.k]; return '<b>' + GG.name + '</b> · 技能「' + GG.skill + '」<br>' + GG.desc; }
    if (it.t === 'c') {
      var outs = Z.NAME_RECIPES.filter(function (r) { return (r[0] === it.ch || r[1] === it.ch) && G.content.gens.indexOf(r[2]) >= 0; }).map(function (r) { return '「' + (r[0] === it.ch ? r[1] : r[0]) + '」→ ' + Z.GENERALS[r[2]].name; });
      return '<b>' + it.ch + '</b> · 名字残片（不能作战）<br>' + (outs.length ? '凑上 ' + outs.join('、') : '本关凑不成武将，可回收');
    }
    if (it.t === 's') return '<b>铲</b><br>拖到荒地上，开垦出一块可布阵的地';
    return '';
  }
  function onTap(loc, p) {
    var it = itemAt(loc);
    if (!it) return;
    tipLoc = loc; tipUntil = performance.now() + 2600;
    showTip(itemInfo(it), p.x, p.y);
  }
  var tipTimer = 0;
  function showTip(html, x, y) {
    tipEl.innerHTML = html;
    tipEl.classList.add('show');
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var left = Math.max(8, Math.min(W - w - 8, x - w / 2)), top = y - h - 26;
    if (top < TB + 4) top = y + 30;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 2600);
  }
  function hideTip() { tipEl.classList.remove('show'); tipLoc = null; }

  // ---------- 教学（第一关） ----------
  var tutEl = $('tut');
  function tutShow(txt, x, y, below) {
    tutEl.textContent = txt;
    tutEl.classList.add('show');
    tutEl.classList.toggle('below', !!below);
    var w = tutEl.offsetWidth, h = tutEl.offsetHeight;
    tutEl.style.left = Math.max(8, Math.min(W - w - 8, x - w / 2)) + 'px';
    tutEl.style.top = (below ? y + 12 : y - h - 14) + 'px';
  }
  function tutHide() { tutEl.classList.remove('show'); }
  function tutNote(what) {
    if (!G || G.level !== 0) return;
    if (what === 'summon' && tutStep < 1) { tutStep = 1; store.set('tut', 1); }
    if (what === 'place' && tutStep === 1) { tutStep = 2; store.set('tut', 2); }
    if (what === 'merge' && tutStep >= 2 && tutStep < 3) { tutStep = 3; store.set('tut', 3); }
  }
  function tutTick() {
    if (!G || G.level !== 0 || gameOver || tutStep >= 3) { tutHide(); return; }
    var S = G.sides[0];
    if (tutStep === 0) tutShow('点「征兵」：一次发五张字牌', summonR.x + summonR.w / 2, summonR.y);
    else if (tutStep === 1) tutShow('把字牌拖上棋盘空位 · 没用上的牌，下次征兵就作废', slots[2].x + BS / 2, slots[0].y);
    else if (tutStep === 2) {
      var pair = false, seen = {};
      S.cells.concat(S.bench.map(function (it) { return { item: it }; })).forEach(function (ce) { var it = ce.item; if (it && it.t === 'u') { var k = it.k + it.lv; if (seen[k]) pair = true; seen[k] = 1; } });
      if (pair) tutShow('同字同阶的两张牌叠在一起 → 升一阶', slots[2].x + BS / 2, slots[0].y);
      else tutHide();
    }
  }

  // ---------- 横幅与 HUD ----------
  var bannerQ = [], bannerBusy = false, bannerTimer = 0;
  function banner(main, sub, cls) { if (quickMode) return; bannerQ.push([main, sub, cls]); if (!bannerBusy) nextBanner(); }
  function nextBanner() {
    var b = bannerQ.shift(), el = $('banner');
    if (!b) { bannerBusy = false; return; }
    bannerBusy = true;
    el.querySelector('.b-main').textContent = b[0];
    el.querySelector('.b-sub').textContent = b[1] || '';
    el.className = 'banner ' + (b[2] || '');
    void el.offsetWidth;
    el.classList.add('show');
    bannerTimer = setTimeout(function () { el.classList.remove('show'); bannerTimer = setTimeout(nextBanner, 260); }, bannerQ.length ? 1100 : 1500);
  }
  function flashScreen(kind) { var f = $('flash'); f.className = ''; void f.offsetWidth; f.className = kind; }
  function heartsHTML(n, lost) {
    var h = '';
    for (var i = 0; i < 3; i++) h += '<i class="hrt' + (i < n ? '' : ' lost') + (lost && i === n ? ' crack' : '') + '"></i>';
    return h;
  }
  var lastHearts = [-1, -1];
  function updateHearts(force) {
    if (!G) return;
    for (var s = 0; s < 2; s++) {
      var n = G.sides[s].hearts;
      if (n !== lastHearts[s] || force) { $(s ? 'foeHearts' : 'meHearts').innerHTML = heartsHTML(n, n < lastHearts[s]); lastHearts[s] = n; }
    }
  }
  function setTxt(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
  function updateHud() {
    if (!G) return;
    var S = G.sides[0];
    setTxt('bunV', String(S.mantou));
    setTxt('costV', String(G.cost(0)));
    var left = S.bench.filter(function (it) { return it; }).length;
    setTxt('smHint', left ? ' · 弃' + left + '张' : '');
    var can = G.canSummon(0);
    if (hud.can !== can) { hud.can = can; $('btnSummon').classList.toggle('off', !can); }
    updateHearts(false);
    var wl = G.phase === 'prep' ? '整军备战' : '第' + NUMCN[Math.max(0, G.wave - 1)] + '波';
    setTxt('waveLbl', wl);
    setTxt('waveOf', G.phase === 'prep' ? Math.ceil(Math.max(0, G.timer)) + '' : G.wave + '/' + G.waves);
    var showGo = G.phase === 'prep' && !gameOver;
    if (hud.go !== showGo) { hud.go = showGo; $('btnGo').classList.toggle('hidden', !showGo); }
    setTxt('speedBtn', speed === 2 ? '×2' : '×1');
  }

  // ---------- 环境粒子 ----------
  var amb = [];
  function initAmbient() {
    amb = [];
    var k = scene().amb, n = k === 'rain' ? 60 : k === 'mist' ? 6 : 22;
    for (var i = 0; i < n; i++) amb.push(newAmb(k, true));
  }
  function newAmb(k, scatter) {
    var p = { k: k, x: Math.random() * W, y: scatter ? Math.random() * H : (k === 'ember' ? H + 5 : -10), s: Math.random(), t: 0 };
    if (k === 'ember') { p.vx = (Math.random() - 0.5) * 10; p.vy = -14 - Math.random() * 20; p.life = 4 + Math.random() * 3; }
    else if (k === 'rain') { p.vx = -50; p.vy = 380 + Math.random() * 120; }
    else if (k === 'mist') { p.vx = 5 + Math.random() * 6; p.vy = 0; p.r = cell * (1.5 + Math.random() * 2); }
    else if (k === 'leaf') { p.vx = 10 + Math.random() * 14; p.vy = 12 + Math.random() * 10; }
    else { p.vx = 6 + Math.random() * 10; p.vy = (Math.random() - 0.5) * 4; }
    return p;
  }
  function drawAmbient(c, dt) {
    for (var i = 0; i < amb.length; i++) {
      var p = amb[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'ember') {
        p.x += Math.sin(p.t * 3 + p.s * 9) * 0.3;
        if (p.y < -10 || p.t > p.life) { amb[i] = newAmb('ember'); continue; }
        c.fillStyle = 'rgba(200,80,30,' + 0.5 * Math.min(1, p.life - p.t) + ')';
        c.fillRect(p.x, p.y, 1.8, 1.8);
      } else if (p.k === 'rain') {
        if (p.y > H) { amb[i] = newAmb('rain'); amb[i].x = Math.random() * (W + 60); continue; }
        c.strokeStyle = 'rgba(70,90,110,.22)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2.5, p.y + 11); c.stroke();
      } else if (p.k === 'mist') {
        if (p.x - p.r > W) { amb[i] = newAmb('mist', true); amb[i].x = -amb[i].r; continue; }
        I.blit(c, I.glowSprite('rgba(255,255,250,.35)', Math.round(p.r)), p.x, p.y, 1, 0.8);
      } else if (p.k === 'leaf') {
        if (p.y > H + 5 || p.x > W + 5) { amb[i] = newAmb('leaf'); amb[i].x = Math.random() * W - 40; continue; }
        c.save(); c.translate(p.x, p.y); c.rotate(p.t * 2 + p.s * 6);
        c.fillStyle = 'rgba(170,90,40,.45)'; c.beginPath(); c.ellipse(0, 0, 3.2, 1.4, 0, 0, TAU); c.fill(); c.restore();
      } else {
        if (p.x > W + 5) { amb[i] = newAmb(p.k, true); amb[i].x = -5; continue; }
        c.fillStyle = 'rgba(90,80,60,' + (0.12 + p.s * 0.15) + ')';
        c.fillRect(p.x, p.y + Math.sin(p.t + p.s * 6) * 3, 1.3, 1.3);
      }
    }
  }

  // ---------- 主循环 ----------
  function stepGame(dt) {
    acc += dt * speed;
    var n = 0;
    while (acc >= STEP && n < 8) {
      G.step(STEP);
      if (bot) bot.update(STEP);
      if (autoBot) autoBot.update(STEP);
      acc -= STEP; n++;
      handleEvents(G.drain());
      if (G.over()) break;
    }
    if (n >= 8) acc = 0;
  }
  function tickAnims(dt) {
    for (var s = 0; s < 2; s++) {
      var an = tanim[s];
      for (var k in an) { var a = an[k]; a.t += dt; if (a.t >= a.dur) delete an[k]; }
      if (aduShake[s] > 0) aduShake[s] -= dt;
      if (sideFlash[s] > 0) sideFlash[s] -= dt;
    }
    if (shakeAmt > 0) shakeAmt *= Math.pow(0.0015, dt);
    if (flood > 0) flood -= dt;
    A.updParts(dt);
  }
  function frame(ms) {
    var dt = Math.min(0.05, Math.max(0, (ms - (last || ms)) / 1000));
    last = ms;
    if (!manual) advance(dt);
    requestAnimationFrame(frame);
  }
  function advance(dt) {
    if (titleOn) titleTick(dt);
    if (!G) return;
    var gdt = running && !paused ? dt : 0;
    if (running && !paused && !gameOver) stepGame(dt);
    if (gameOver && endT > 0) { endT -= dt; if (endT <= 0) showResult(); }
    var adt = gdt * speed;
    animNow += adt;
    tickAnims(adt);
    if (screenOn('battle')) { render(adt); updateHud(); tutTick(); }
  }

  // ---------- 流程 ----------
  function screenOn(id) { return $(id).classList.contains('show'); }
  function showScreen(id) {
    ['title', 'map', 'battle', 'result'].forEach(function (s) { $(s).classList.toggle('show', s === id); });
    titleOn = id === 'title';
    if (titleOn) sizeTitle();
  }
  function closeSheets() { ['intro', 'sheetPause'].forEach(function (id) { $(id).classList.remove('show'); }); }
  function newGame(level, opts) {
    opts = opts || {};
    closeSheets();
    G = Z.createGame({ level: level, seed: opts.seed, holdTimer: !!opts.hold || (level === 0 && tutStep < 1 && !opts.noTut) });
    bot = opts.noAI ? null : Z.createBot(G, 1, Z.aiParams(level));
    autoBot = opts.auto ? Z.createBot(G, 0, { tick: 0.6, mistake: 0.05, mergeSkip: 0.05, waste: 0.05, smart: 0.8 }) : null;
    running = true; paused = false; gameOver = false; acc = 0; endT = 0; flood = 0;
    tanim = [{}, {}]; benchAnim = [null, null, null, null, null]; drag = null; pend = null; hud = {}; lastHearts = [-1, -1];
    A.reset();
    clearTimeout(bannerTimer); bannerQ = []; bannerBusy = false; $('banner').className = 'banner';
    hideTip(); tutHide();
    showScreen('battle');
    layout();
    $('ridge').classList.toggle('gate-right', G.P.pts[0][0] >= 4);
    initAmbient();
    G.drain();
    $('foeName').textContent = G.L.rival;
    $('foeTitle').textContent = G.L.rivalTitle;
    $('foeSeal').textContent = G.L.rival[0];
    $('lvName').textContent = G.L.name;
    updateHearts(true);
    banner(G.L.name, '对手 · ' + G.L.rivalTitle + G.L.rival + ' · 同守阿斗，先失三心者败');
    return G;
  }
  function pauseGame() {
    if (!G || !running || gameOver || paused) return;
    paused = true;
    drag = null; pend = null;
    $('pauseInfo').textContent = G.L.name + ' · 第 ' + Math.max(1, G.wave) + '/' + G.L.waves + ' 波 · 阿斗 ' + G.sides[0].hearts + ' 心 · 对手 ' + G.sides[1].hearts + ' 心';
    $('btnSound2').textContent = '声音：' + (SND.get() ? '开' : '关');
    $('sheetPause').classList.add('show');
  }
  function resumeGame() { $('sheetPause').classList.remove('show'); paused = false; last = performance.now(); }
  function onEnd(e) {
    gameOver = true;
    endT = 1.8;
    var win = e.type === 'win';
    var c = campaign();
    var li = G.level;
    if (win) {
      c.stars[li] = Math.max(c.stars[li] || 0, e.stars || 1);
      if (li + 1 < Z.LEVELS.length) c.unlocked = Math.max(c.unlocked, li + 2);
      store.set('campaign', c);
    }
    G.newUnlock = win && li + 1 < Z.LEVELS.length;
    banner(win ? '大捷' : '兵败', win ? reasonText(e.reason, true) : reasonText(e.reason, false), win ? 'gold' : 'red');
    sfx(win ? 'win' : 'lose');
  }
  function reasonText(r, win) {
    if (win) return r === 'hearts' ? '对手的阿斗先失三心' : r === 'tie' ? '与对手同心坚守到底' : '坚守到底，心数更多';
    return r === 'hearts' ? '阿斗失了三心' : '对手坚守得更好';
  }
  function showResult() {
    var win = G.phase === 'won', R = G.result || {};
    showScreen('result');
    drawResultBg(win);
    $('rTitle').textContent = win ? '大捷' : '兵败';
    $('rTitle').className = 'r-title ' + (win ? 'win' : 'lose');
    $('rSub').textContent = G.L.name + ' · ' + reasonText(R.reason, win);
    var st = '';
    for (var i = 0; i < 3; i++) st += '<span class="rs' + (win && i < (G.stars || 0) ? ' on' : '') + '" style="animation-delay:' + (0.3 + i * 0.25) + 's">' + (win && i < (G.stars || 0) ? '★' : '☆') + '</span>';
    $('rStars').innerHTML = st;
    var me = G.sides[0], foe = G.sides[1];
    var m = Math.floor(G.time / 60), s = Math.round(G.time % 60);
    $('rStats').innerHTML = '<div><b>' + me.hearts + ' : ' + foe.hearts + '</b><span>阿斗之心（我 : ' + G.L.rival + '）</span></div>' +
      '<div><b>' + me.stats.kills + '</b><span>斩敌</span></div><div><b>' + me.stats.generals.length + '</b><span>武将</span></div><div><b>' + m + ':' + (s < 10 ? '0' : '') + s + '</b><span>用时</span></div>';
    $('rUnlock').textContent = G.newUnlock ? '解锁新战役：' + Z.LEVELS[G.level + 1].name : (win && G.level === Z.LEVELS.length - 1 ? '天下归心 · 全部战役已平定' : '');
    $('btnNextLv').classList.toggle('hidden', !(win && G.level + 1 < Z.LEVELS.length));
    if (win) for (var k = 0; k < (G.stars || 0); k++) setTimeout(function (kk) { return function () { sfx('star', kk); }; }(k), 300 + k * 250);
  }
  function drawResultBg(win) {
    var c = $('resultCv'), w = $('app').clientWidth, h = $('app').clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px';
    var x = c.getContext('2d');
    x.drawImage(I.paper(w, h, win ? 31 : 37), 0, 0);
    x.scale(d, d);
    I.mountains(x, -20, w + 40, h * 0.78, h * 0.3, { seed: win ? 8 : 9, layers: 4, alpha: 0.2 });
    I.mountains(x, -20, w + 40, h, h * 0.18, { seed: 3, layers: 2, alpha: 0.12 });
  }

  // ---------- 标题 ----------
  var titleOn = false, tT = 0, tcv = $('titleCv'), tctx = tcv.getContext('2d'), tBg = null, tW = 0, tH = 0, tDemo = null;
  function sizeTitle() {
    tW = $('app').clientWidth; tH = $('app').clientHeight;
    var d = Math.min(2.5, window.devicePixelRatio || 1);
    tcv.width = tW * d; tcv.height = tH * d; tcv.style.width = tW + 'px'; tcv.style.height = tH + 'px';
    tBg = I.canvas(tW * d, tH * d);
    var x = tBg.getContext('2d');
    x.drawImage(I.paper(tW, tH, 3, '#f3ead6'), 0, 0);
    x.scale(d, d);
    I.mountains(x, -30, tW + 60, tH * 0.62, tH * 0.2, { seed: 12, layers: 4, alpha: 0.2 });
    I.mountains(x, -30, tW + 60, tH * 1.0, tH * 0.16, { seed: 5, layers: 3, alpha: 0.16 });
    // 远处一行飞鸟
    x.strokeStyle = 'rgba(27,23,18,.45)'; x.lineWidth = 1.2;
    [[0.72, 0.2], [0.76, 0.22], [0.8, 0.19], [0.69, 0.24]].forEach(function (b) { var bx = b[0] * tW, by = b[1] * tH; x.beginPath(); x.moveTo(bx - 5, by); x.quadraticCurveTo(bx - 2, by - 3, bx, by); x.quadraticCurveTo(bx + 2, by - 3, bx + 5, by); x.stroke(); });
  }
  function titleTick(dt) {
    tT += dt;
    var d = tcv.width / tW, x = tctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(tBg, 0, 0);
    x.setTransform(d, 0, 0, d, 0, 0);
    var chars = ['赵', '云', '与', '阿', '斗'];
    var S = Math.min(tW * 0.3, tH * 0.16), cx = tW / 2, top = tH * 0.13;
    // 竖排两列：赵云 / 与 / 阿斗 → 采用横排三组
    var pos = [[cx - S * 1.05, top + S * 0.55, S], [cx - S * 1.05, top + S * 1.6, S], [cx, top + S * 1.1, S * 0.45], [cx + S * 1.05, top + S * 0.55, S], [cx + S * 1.05, top + S * 1.6, S]];
    for (var i = 0; i < 5; i++) {
      var p = Math.max(0, Math.min(1, (tT - 0.2 - i * 0.45) / 0.55));
      if (p <= 0) continue;
      var g = I.glyph(chars[i]);
      I.drawWriting(x, g, pos[i][0], pos[i][1], pos[i][2], i === 2 ? VERM : INK, p);
    }
    if (tT > 2.6) { x.globalAlpha = Math.min(1, (tT - 2.6) * 4); I.seal(x, cx, top + S * 1.7, S * 0.36, '单骑救主'); x.globalAlpha = 1; }
    // 演示：刀枪弓骑四牌轮流出手
    var C = Math.round(Math.min(64, tW / 7)), saved = cell;
    cell = C;
    var rowY = tH * 0.585;
    if (!tDemo) tDemo = { i: 0, t: 0, a: null, ex: -0.5 };
    var kinds = ['dao', 'qiang', 'gong', 'qi'];
    tDemo.t += dt;
    tDemo.ex += dt * 0.35;
    if (tDemo.ex > 1.5) tDemo.ex = -0.5;
    var foeX = tW / 2 + Math.sin(tT * 0.8) * C * 1.5, foeY = rowY - C * 1.25;
    if (tDemo.t > 1.0) {
      tDemo.t = 0;
      var k = kinds[tDemo.i % 4];
      tDemo.a = { type: 'atk', kind: k, lv: 1 + (tDemo.i >> 2) % 3, t: 0, f: {}, dur: A.DUR[k], TX: foeX, TY: foeY, len: 2.2, rad: 0.9 };
      tDemo.who = tDemo.i % 4;
      tDemo.i++;
    }
    var en = { r: 0.31, d: tT * 0.7, stun: 0, flash: tDemo.a && tDemo.a.t > 0.15 && tDemo.a.t < 0.3 ? 0.08 : 0, hp: 1, maxHp: 1, ch: '贼' };
    var oldSide = curSide; curSide = 0;
    ctx = x;
    A.drawEnemy(x, en, foeX, foeY, '#b08428', tT);
    for (var j = 0; j < 4; j++) {
      var it = { t: 'u', k: kinds[j], lv: 1 + j % 3 };
      var X = tW / 2 + (j - 1.5) * C * 1.15, Y = rowY;
      var an = tDemo.a && tDemo.who === j && tDemo.a.t < tDemo.a.dur ? tDemo.a : null;
      if (an) { an.TX = foeX; an.TY = foeY; an.lv = it.lv; }
      A.drawTile(x, it, X, Y, { anim: an, t: tT });
    }
    if (tDemo.a) tDemo.a.t += dt;
    A.drawFx(x, dt); A.updParts(dt); A.drawParts(x);
    ctx = cv.getContext('2d');
    curSide = oldSide;
    cell = saved;
  }
  void tctx;

  // ---------- 战役图 ----------
  var introLevel = 0;
  function openMap() {
    showScreen('map');
    var c = campaign(), list = $('mapList'), html = '';
    var tot = c.stars.reduce(function (a, b) { return a + (b || 0); }, 0);
    $('mapStars').textContent = tot + '/' + Z.LEVELS.length * 3;
    Z.LEVELS.forEach(function (L, i) {
      var locked = i + 1 > c.unlocked, st = c.stars[i] || 0;
      var stars = '';
      for (var k = 0; k < 3; k++) stars += '<i class="' + (k < st ? 'on' : '') + '"></i>';
      html += '<button class="lv' + (locked ? ' locked' : '') + (i + 1 === c.unlocked && !st ? ' cur' : '') + '" data-lv="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        '<canvas class="lv-th" data-th="' + i + '"></canvas>' +
        '<span class="lv-no">' + NUMCN[i] + '</span>' +
        '<span class="lv-main"><span class="lv-name">' + L.name + '</span><span class="lv-era">' + L.era + '</span><span class="lv-foe">对手 · ' + L.rival + '</span></span>' +
        '<span class="lv-stars">' + stars + '</span></button>';
    });
    list.innerHTML = html;
    list.querySelectorAll('canvas[data-th]').forEach(function (cvs) { thumb(cvs, +cvs.getAttribute('data-th')); });
    list.querySelectorAll('button.lv').forEach(function (b) { b.addEventListener('click', function () { SND.unlock(); sfx('click'); openIntro(+b.getAttribute('data-lv')); }); });
    var cur = list.querySelector('.cur');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
  }
  function thumb(c, li) {
    var w = 84, h = 56, d = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px';
    var x = c.getContext('2d'), L = Z.LEVELS[li], P = Z.PATHS[li], SC = SCENES[L.scene] || SCENES.plain;
    x.drawImage(I.paper(w, h, li + 2, SC.tint), 0, 0);
    x.scale(d, d);
    I.mountains(x, -4, w + 8, h * 0.45, h * 0.35, { seed: li + 4, layers: 2, alpha: 0.25, color: SC.hill });
    var cs = (w - 8) / COLS * 0.9, ox = (w - cs * COLS) / 2, oy = h * 0.3;
    x.strokeStyle = 'rgba(90,68,42,.6)'; x.lineWidth = 2.2; x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath();
    P.pts.forEach(function (p, i) { var px = ox + p[0] * cs, py = oy + Math.max(-0.5, p[1]) * cs * 0.8; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
    x.stroke();
    if (SC.river) { x.fillStyle = 'rgba(90,120,140,.25)'; x.fillRect(0, h * 0.18, w, 5); }
    if (L.scene === 'fire') { x.fillStyle = 'rgba(200,80,30,.15)'; x.fillRect(0, 0, w, h); }
    var e = P.end; I.seal(x, ox + (e[0] + 0.5) * cs, oy + (e[1] + 0.5) * cs * 0.8, 9, '斗');
  }
  function openIntro(li) {
    introLevel = li;
    var L = Z.LEVELS[li];
    $('inKicker').textContent = '第' + NUMCN[li] + '战 · ' + L.era;
    $('inTitle').textContent = L.name;
    $('inBlurb').textContent = L.blurb;
    $('inRows').innerHTML = '<div><b>对手</b>' + L.rivalTitle + ' ' + L.rival + '（与你同守阿斗）</div><div><b>敌军</b>' + Z.FACTIONS[L.faction].name + ' · ' + L.waves + ' 波 · 敌将 ' + L.lieut.name + '、' + L.boss.name + '</div><div><b>战况</b>' + L.twist + '</div>';
    var nw = $('inNew');
    nw.innerHTML = '';
    var u = L.unlock, items = [];
    (u.units || []).forEach(function (k) { items.push({ it: { t: 'u', k: k, lv: 1 }, name: Z.UNITS[k].ch + ' · ' + Z.UNITS[k].desc }); });
    (u.gens || []).forEach(function (k) { items.push({ it: { t: 'g', k: k }, name: Z.GENERALS[k].name + ' · ' + Z.GENERALS[k].skill }); });
    if (items.length) {
      var hd = document.createElement('div'); hd.className = 'in-new-h'; hd.textContent = li === 0 ? '初始兵将' : '新增兵将'; nw.appendChild(hd);
      items.forEach(function (o) {
        var row = document.createElement('div'); row.className = 'in-item';
        row.appendChild(itemCanvas(o.it, 44));
        var sp2 = document.createElement('span'); sp2.textContent = o.name; row.appendChild(sp2);
        nw.appendChild(row);
      });
    }
    $('intro').classList.add('show');
  }
  function itemCanvas(it, size) {
    var c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * d; c.height = size * d; c.style.width = size + 'px'; c.style.height = size + 'px';
    var x = c.getContext('2d'); x.scale(d, d);
    var saved = cell, savedCtx = ctx; cell = Math.round(size * 0.95);
    var oldDpr = dpr; I.setDpr(d);
    A.drawTile(x, it, size / 2, size / 2, { t: 0 });
    cell = saved; ctx = savedCtx; I.setDpr(oldDpr);
    return c;
  }

  // ---------- 按钮 ----------
  function bind(id, fn) { $(id).addEventListener('click', function (e) { SND.unlock(); fn(e); }); }
  bind('btnStart', function () { sfx('click'); openMap(); });
  bind('btnTitleSound', function () { SND.set(!SND.get()); store.set('sound', SND.get()); syncSound(); sfx('click'); });
  bind('btnMapBack', function () { sfx('click'); showScreen('title'); });
  bind('btnGoLv', function () { sfx('click'); newGame(introLevel); });
  bind('btnIntroClose', function () { $('intro').classList.remove('show'); });
  bind('btnSummon', function () {
    if (!G || !running || paused || gameOver) return;
    if (!G.summon(0)) { sfx('error'); var r = summonR; showTip('馒头不够：斩敌可得馒头', r.x + r.w / 2, r.y); }
    handleEvents(G.drain());
  });
  bind('btnGo', function () { if (G && running && !paused) { sfx('click'); G.callNext(); handleEvents(G.drain()); } });
  bind('btnPause', function () { sfx('click'); pauseGame(); });
  bind('speedBtn', function () { speed = speed === 1 ? 2 : 1; store.set('speed', speed); sfx('click'); });
  bind('btnResume', function () { sfx('click'); resumeGame(); });
  bind('btnRestart', function () { sfx('click'); if (G) newGame(G.level); });
  bind('btnToMap', function () { sfx('click'); closeSheets(); running = false; openMap(); });
  bind('btnSound2', function () { SND.set(!SND.get()); store.set('sound', SND.get()); syncSound(); $('btnSound2').textContent = '声音：' + (SND.get() ? '开' : '关'); sfx('click'); });
  bind('btnNextLv', function () { sfx('click'); if (G && G.level + 1 < Z.LEVELS.length) { openMap(); openIntro(G.level + 1); } });
  bind('btnRetry', function () { sfx('click'); if (G) newGame(G.level); });
  bind('btnResMap', function () { sfx('click'); openMap(); });
  $('intro').addEventListener('click', function (e) { if (e.target === $('intro')) $('intro').classList.remove('show'); });
  $('sheetPause').addEventListener('click', function (e) { if (e.target === $('sheetPause')) resumeGame(); });
  function syncSound() { $('btnTitleSound').textContent = '声音：' + (SND.get() ? '开' : '关'); }
  document.addEventListener('visibilitychange', function () { if (document.hidden && G && running && !paused && !gameOver) pauseGame(); });
  document.addEventListener('keydown', function (e) {
    if (!G || !running || !screenOn('battle')) return;
    if (e.key === 'Escape' || e.key === 'p') { if (paused) resumeGame(); else pauseGame(); }
    if (e.key === ' ' && !paused) { e.preventDefault(); $('btnSummon').click(); }
  });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest('#app')) e.preventDefault(); });

  // ---------- 测试钩子 ----------
  function bare(it) { return it ? { t: it.t, k: it.k, lv: it.lv, ch: it.ch } : null; }
  window.__zy = {
    get G() { return G; }, Z: Z, I: I, A: A,
    state: function () {
      if (!G) return null;
      var S = G.sides[0], F = G.sides[1];
      return {
        level: G.level, phase: G.phase, wave: G.wave, waves: G.waves, timer: G.timer, hearts: S.hearts, foeHearts: F.hearts, mantou: S.mantou, cost: G.cost(0),
        enemies: S.enemies.length, foeEnemies: F.enemies.length, bench: S.bench.map(bare),
        board: S.cells.filter(function (c) { return c.item; }).map(function (c) { return { c: c.c, r: c.r, it: bare(c.item) }; }),
        foeBoard: F.cells.filter(function (c) { return c.item; }).map(function (c) { return { c: c.c, r: c.r, it: bare(c.item) }; }),
        unlocked: S.cells.filter(function (c) { return !c.path && !c.block && !c.lock; }).length,
        paused: paused, running: running, gameOver: gameOver, result: G.result, stars: G.stars, stats: S.stats, foeStats: F.stats, cell: cell, speed: speed,
        fx: A.fx().length, parts: A.parts().length, time: G.time
      };
    },
    newGame: function (level, opts) { newGame(level || 0, opts || {}); return this.state(); },
    give: function (it, loc, side) {
      var S = G.sides[side || 0];
      if (!loc) { for (var i = 0; i < 5; i++) if (!S.bench[i]) { S.bench[i] = it; return true; } return false; }
      if (loc.z === 'b') S.bench[loc.i] = it;
      else { var ce = S.cells[loc.r * COLS + loc.c]; if (!ce || ce.path || ce.block) return false; ce.lock = false; ce.item = it; it.cdLeft = 0; bgSig = ''; }
      S.auraDirty = true;
      return true;
    },
    clear: function (side) { var S = G.sides[side || 0]; S.cells.forEach(function (c) { c.item = null; }); S.bench = [null, null, null, null, null]; S.auraDirty = true; },
    openTiles: function (side) { return G.sides[side || 0].cells.filter(function (c) { return !c.path && !c.block && !c.lock && !c.item; }).map(function (c) { return { c: c.c, r: c.r }; }); },
    lockedTiles: function (side) { return G.sides[side || 0].cells.filter(function (c) { return !c.path && !c.block && c.lock; }).map(function (c) { return { c: c.c, r: c.r }; }); },
    buildTiles: function () { return G.sides[0].cells.filter(function (c) { return !c.path && !c.block; }).map(function (c) { return { c: c.c, r: c.r, s: Z.coverage(G.P, c.c, c.r, 2) }; }).sort(function (a, b) { return b.s - a.s; }); },
    tile: function (c, r, side) { var b = cv.getBoundingClientRect(), q = cellCenter(side || 0, c, r, {}); return { x: b.left + q.x, y: b.top + q.y }; },
    toScreen: function (side, lx, ly) { var b = cv.getBoundingClientRect(), q = sp(side, lx, ly, {}); return { x: b.left + q.x, y: b.top + q.y }; },
    slot: function (i) { var b = cv.getBoundingClientRect(), r = slots[i]; return { x: b.left + r.x + r.w / 2, y: b.top + r.y + r.h / 2 }; },
    recycle: function () { var b = cv.getBoundingClientRect(); return { x: b.left + recycleR.x + recycleR.w / 2, y: b.top + recycleR.y + recycleR.h / 2 }; },
    summonBtn: function () { var r = $('btnSummon').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    // 手动推进：用于截取逐帧序列
    setManual: function (v) { manual = !!v; last = 0; },
    advance: function (sec, fps) { fps = fps || 60; var n = Math.round(sec * fps); for (var i = 0; i < n; i++) advance(1 / fps); },
    ff: function (sec) { quickMode = true; var n = Math.round(sec / STEP); for (var i = 0; i < n && !G.over(); i++) { G.step(STEP); if (bot) bot.update(STEP); if (autoBot) autoBot.update(STEP); handleEvents(G.drain()); } quickMode = false; A.reset(); tanim = [{}, {}]; return this.state(); },
    setBot: function (on) { bot = on ? Z.createBot(G, 1, Z.aiParams(G.level)) : null; },
    setAuto: function (on) { autoBot = on ? Z.createBot(G, 0, { tick: 0.6, mistake: 0.05, mergeSkip: 0.05, waste: 0.05, smart: 0.8 }) : null; },
    spawn: function (side, type, d, off) { return G.spawn(side, type, d, off); },
    events: handleEvents,
    pause: pauseGame, resume: resumeGame, isPaused: function () { return paused; },
    openMap: openMap, openIntro: openIntro, showTitle: function () { showScreen('title'); },
    campaign: campaign, setSpeed: function (s) { speed = s; },
    sounds: SND.names, renderSound: SND.render,
    fontsOk: function () { return document.fonts && document.fonts.check ? { brush: document.fonts.check('20px "ZY Brush"', '赵'), serif: document.fonts.check('600 20px "ZY Serif"', '9') } : null; }
  };


  // ---------- 启动 ----------
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var ps = [document.fonts.load('40px "ZY Brush"', '赵云'), document.fonts.load('600 20px "ZY Serif"', '0123')];
    return Promise.race([Promise.all(ps), new Promise(function (r) { setTimeout(r, 2500); })]);
  }
  syncSound();
  layout();
  fontsReady().then(function () {
    document.body.classList.add('ready');
    showScreen('title');
    window.__zyReady = true;
  });
  requestAnimationFrame(frame);
})();
