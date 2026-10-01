/* 赵云与阿斗 · 画面、操作、战役界面 */
(function () {
  'use strict';
  var Z = window.ZYCore, A = window.ZYArt;
  var CFG = Z.CFG, COLS = Z.COLS, ROWS = Z.ROWS, STEP = 1 / 60;
  var GOLD = '#d4a64a', GOLD_L = '#f3d68a', PARCH = '#e8dcc0', CRIMSON = '#9e1b1b';
  var $ = function (id) { return document.getElementById(id); };
  var NUMCN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  // ---------- 本地存储 ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('zyad.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('zyad.' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
    del: function (k) { try { localStorage.removeItem('zyad.' + k); } catch (e) { /* 忽略 */ } }
  };
  function campaign() {
    var c = store.get('campaign', null);
    if (!c || !c.stars) c = { unlocked: 1, stars: [] };
    c.unlocked = Math.max(1, Math.min(Z.LEVELS.length, c.unlocked | 0));
    return c;
  }
  function codex() {
    var c = store.get('codex', null);
    if (!c || typeof c !== 'object' || Array.isArray(c)) c = {};
    c.u = c.u || {}; c.g = c.g || {}; c.s = c.s || {}; c.e = c.e || {};
    return c;
  }
  function discover(kind, key) {
    var c = codex();
    if (c[kind][key]) return false;
    c[kind][key] = 1; store.set('codex', c);
    return true;
  }

  // ---------- 音效（Web Audio 合成） ----------
  // 链路：音色 → 高通 140Hz → 压缩 → 增益 → tanh 软限幅；音色集中在 500Hz~3kHz
  var soundOn = store.get('sound', true) !== false;
  var actx = null, bus = null, noiseBuf = null, quick = false;
  function softClip() {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    return c;
  }
  function buildChain(c) {
    var input = c.createGain();
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 8; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.12;
    var mk = c.createGain(); mk.gain.value = 2.6;
    var clip = c.createWaveShaper(); clip.curve = softClip(); clip.oversample = '2x';
    input.connect(hp); hp.connect(comp); comp.connect(mk); mk.connect(clip); clip.connect(c.destination);
    return input;
  }
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { actx = new AC(); bus = buildChain(actx); } catch (e) { actx = null; return false; }
    }
    if (actx.state === 'suspended') actx.resume();
    return true;
  }
  function osc(o) {
    var t0 = actx.currentTime + (o.at || 0), d = o.d || 0.1;
    var n = actx.createOscillator(), g = actx.createGain();
    n.type = o.type || 'triangle';
    n.frequency.setValueAtTime(o.f, t0);
    if (o.f2) n.frequency.exponentialRampToValueAtTime(o.f2, t0 + d * (o.slide || 1));
    var a = o.a || 0.004, v = o.v || 0.4;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    if (o.hold) g.gain.setValueAtTime(v, t0 + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    n.connect(g); g.connect(bus);
    n.start(t0); n.stop(t0 + d + 0.03);
  }
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      var dd = noiseBuf.getChannelData(0);
      for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    }
    var t0 = actx.currentTime + (o.at || 0), d = o.d || 0.2;
    var s = actx.createBufferSource(); s.buffer = noiseBuf;
    var f = actx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1500, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.5, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.03);
  }
  function note(f, at, d, v, br) {
    osc({ type: 'triangle', f: f, d: d, v: v, at: at });
    osc({ type: 'square', f: f, d: d * 0.8, v: v * (br || 0.28), at: at });
  }
  function drumHit(at, big, v) {
    osc({ type: 'sine', f: big ? 260 : 320, f2: big ? 90 : 120, d: big ? 0.38 : 0.22, v: v || 0.95, at: at });
    osc({ type: 'triangle', f: 640, f2: 300, d: 0.06, v: (v || 0.95) * 0.42, at: at });
    noise({ ft: 'lowpass', f: big ? 1400 : 1900, f2: 250, d: big ? 0.3 : 0.16, v: (v || 0.95) * 0.7, at: at });
  }
  function gong(at, v) {
    [520, 770, 1105, 1390].forEach(function (f, i) { osc({ type: 'sine', f: f, f2: f * 0.985, d: 1.3 - i * 0.2, v: (v || 0.36) - i * 0.06, a: 0.006, at: at }); });
    noise({ f: 1800, f2: 700, q: 0.8, d: 0.35, v: 0.45, at: at });
  }
  var SFX = {
    click: function () { osc({ type: 'triangle', f: 1100, f2: 1500, d: 0.05, v: 0.5 }); noise({ f: 4200, q: 2, d: 0.02, v: 0.25 }); },
    pick: function () { osc({ type: 'sine', f: 880, f2: 1320, d: 0.05, v: 0.35 }); noise({ f: 2600, q: 2, d: 0.03, v: 0.2 }); },
    summon: function () { drumHit(0); osc({ type: 'triangle', f: 1568, d: 0.28, v: 0.32, at: 0.08 }); osc({ type: 'sine', f: 2093, d: 0.34, v: 0.24, at: 0.13 }); },
    place: function () { osc({ type: 'triangle', f: 760, f2: 380, d: 0.08, v: 0.7 }); osc({ type: 'sine', f: 1520, f2: 800, d: 0.04, v: 0.3 }); noise({ f: 2200, q: 2, d: 0.04, v: 0.5 }); },
    merge: function (lv) {
      var f = 480 * Math.pow(1.26, (lv || 2) - 2);
      osc({ type: 'square', f: f, f2: f * 1.9, d: 0.1, v: 0.3 });
      osc({ type: 'triangle', f: f * 2, f2: f * 3, d: 0.09, v: 0.45 });
      noise({ f: 3000, q: 1.5, d: 0.025, v: 0.25 });
      osc({ type: 'sine', f: f * 3, d: 0.2, v: 0.22, at: 0.07 });
      if (lv >= 4) { note(f * 2, 0.12, 0.14, 0.3); note(f * 2.5, 0.2, 0.24, 0.3); gong(0.1, 0.22); }
    },
    general: function () { gong(0); [784, 988, 1175, 1568].forEach(function (f, i) { note(f, 0.18 + i * 0.11, i === 3 ? 0.5 : 0.16, 0.36, 0.35); }); },
    synergy: function () { gong(0, 0.4); drumHit(0.05, true); [659, 784, 988, 1319, 1568].forEach(function (f, i) { note(f, 0.15 + i * 0.09, i === 4 ? 0.6 : 0.14, 0.34, 0.4); }); },
    sword: function () { noise({ f: 2800, f2: 1300, q: 1.3, d: 0.06, v: 0.3 }); osc({ type: 'triangle', f: 1500, f2: 950, d: 0.04, v: 0.1 }); },
    spear: function () { noise({ f: 1200, f2: 3200, q: 1.6, d: 0.07, v: 0.28 }); osc({ type: 'triangle', f: 760, f2: 1050, d: 0.05, v: 0.1 }); },
    hoof: function () { osc({ type: 'sine', f: 560, f2: 280, d: 0.06, v: 0.3 }); noise({ ft: 'lowpass', f: 1600, d: 0.05, v: 0.28 }); },
    arrow: function () { osc({ type: 'triangle', f: 1900, f2: 1100, d: 0.05, v: 0.15 }); noise({ f: 3600, q: 3, d: 0.03, v: 0.12 }); },
    bolt: function () { osc({ type: 'sawtooth', f: 900, f2: 500, d: 0.07, v: 0.15 }); noise({ f: 1800, f2: 3400, q: 2, d: 0.06, v: 0.22 }); },
    fire: function () { noise({ f: 800, f2: 2400, q: 0.7, d: 0.16, v: 0.3 }); osc({ type: 'triangle', f: 620, f2: 900, d: 0.08, v: 0.08 }); },
    boom: function () { noise({ ft: 'lowpass', f: 3000, f2: 200, d: 0.5, v: 0.85 }); osc({ type: 'sine', f: 300, f2: 90, d: 0.35, v: 0.7 }); noise({ f: 900, q: 0.8, d: 0.25, v: 0.4, at: 0.05 }); },
    drum: function () { drumHit(0, false, 0.45); },
    pulse: function () { osc({ type: 'sine', f: 700, f2: 520, d: 0.12, v: 0.18 }); },
    puff: function () { noise({ f: 1400, f2: 600, q: 0.9, d: 0.09, v: 0.3 }); osc({ type: 'sine', f: 950, f2: 520, d: 0.06, v: 0.12 }); },
    crack: function () { noise({ f: 2400, f2: 900, q: 1.2, d: 0.08, v: 0.35 }); osc({ type: 'square', f: 1200, f2: 600, d: 0.05, v: 0.08 }); },
    bossdown: function () { noise({ ft: 'lowpass', f: 4200, f2: 300, d: 0.7, v: 0.9 }); osc({ type: 'sawtooth', f: 440, f2: 140, d: 0.6, v: 0.4 }); note(1047, 0.25, 0.14, 0.35); note(1319, 0.35, 0.14, 0.35); note(1568, 0.45, 0.3, 0.38); },
    hurt: function () { osc({ type: 'triangle', f: 1180, f2: 860, d: 0.22, v: 0.55 }); osc({ type: 'square', f: 1180, f2: 860, d: 0.18, v: 0.08 }); noise({ ft: 'lowpass', f: 1200, f2: 300, d: 0.12, v: 0.5 }); drumHit(0.02, true, 0.6); },
    wave: function () { drumHit(0); drumHit(0.2); drumHit(0.4); drumHit(0.62, true); },
    boss: function () { drumHit(0, true); drumHit(0.32, true); drumHit(0.64, true); osc({ type: 'sawtooth', f: 233, d: 0.9, v: 0.32, at: 0.1, hold: 0.4 }); osc({ type: 'sawtooth', f: 466, f2: 440, d: 0.9, v: 0.18, at: 0.1, hold: 0.4 }); },
    dig: function () { noise({ ft: 'lowpass', f: 2200, f2: 500, d: 0.16, v: 0.7 }); osc({ type: 'triangle', f: 640, f2: 320, d: 0.08, v: 0.4 }); noise({ f: 900, q: 1, d: 0.14, v: 0.45, at: 0.11 }); },
    recycle: function () { note(1319, 0, 0.08, 0.35); note(1760, 0.07, 0.14, 0.35); },
    clear: function () { note(1047, 0, 0.12, 0.38); note(1319, 0.07, 0.12, 0.38); note(1568, 0.14, 0.22, 0.42); },
    early: function () { note(1568, 0, 0.08, 0.3); note(2093, 0.06, 0.12, 0.3); },
    error: function () { osc({ type: 'sawtooth', f: 330, f2: 300, d: 0.09, v: 0.3 }); osc({ type: 'sawtooth', f: 250, f2: 220, d: 0.14, v: 0.3, at: 0.1 }); },
    flood: function () { noise({ ft: 'lowpass', f: 900, f2: 2600, d: 1.0, v: 0.6, q: 0.5 }); noise({ f: 600, f2: 300, d: 0.8, v: 0.3, at: 0.2 }); },
    star: function (i) { drumHit(0, true, 0.7); note(988 * Math.pow(1.26, i || 0), 0.03, 0.2, 0.35); },
    skill: function (k) {
      noise({ f: 600, f2: 3000, q: 1, d: 0.25, v: 0.5 });
      if (k === 'zhaoyun' || k === 'machao') { [988, 1175, 1397, 1760].forEach(function (f, i) { note(f, 0.04 + i * 0.05, 0.1, 0.32); }); drumHit(0, true, 0.6); }
      else if (k === 'zhangfei') { osc({ type: 'sawtooth', f: 330, f2: 220, d: 0.5, v: 0.45 }); osc({ type: 'square', f: 660, f2: 440, d: 0.45, v: 0.15 }); drumHit(0, true); }
      else if (k === 'guanyu') { noise({ f: 900, f2: 2600, q: 0.8, d: 0.35, v: 0.6 }); osc({ type: 'triangle', f: 1800, f2: 1200, d: 0.3, v: 0.25, at: 0.1 }); }
      else if (k === 'huangzhong') { osc({ type: 'triangle', f: 2200, f2: 900, d: 0.12, v: 0.4 }); osc({ type: 'sine', f: 2637, d: 0.3, v: 0.25, at: 0.12 }); }
      else if (k === 'kongming') { noise({ f: 400, f2: 1600, q: 0.6, d: 0.6, v: 0.5 }); noise({ f: 900, f2: 2600, q: 0.8, d: 0.5, v: 0.5, at: 0.35 }); }
      else if (k === 'pangtong') { [1500, 1800, 1500, 2000].forEach(function (f, i) { osc({ type: 'square', f: f, d: 0.05, v: 0.15, at: i * 0.06 }); }); }
      else if (k === 'weiyan') { noise({ f: 2400, f2: 700, q: 1, d: 0.3, v: 0.6 }); drumHit(0, true); }
      else if (k === 'jiangwei') { drumHit(0); drumHit(0.08); noise({ f: 1500, f2: 3000, q: 1, d: 0.2, v: 0.4, at: 0.05 }); }
      else { [1047, 1319, 1568].forEach(function (f) { osc({ type: 'sine', f: f, d: 0.6, v: 0.25, a: 0.02 }); }); }
    },
    bossAct: function () { osc({ type: 'sawtooth', f: 300, f2: 180, d: 0.4, v: 0.35 }); drumHit(0, true, 0.7); },
    win: function () {
      gong(0, 0.3);
      [784, 1047, 1319, 1568].forEach(function (f, i) { note(f, 0.1 + i * 0.11, 0.17, 0.42, 0.4); });
      [1047, 1319, 1568, 2093].forEach(function (f) { osc({ type: 'triangle', f: f, d: 0.8, v: 0.24, at: 0.56, hold: 0.25 }); osc({ type: 'square', f: f, d: 0.6, v: 0.06, at: 0.56 }); });
    },
    lose: function () {
      note(659, 0, 0.2, 0.42, 0.3); note(587, 0.2, 0.2, 0.42, 0.3); note(523, 0.4, 0.2, 0.42, 0.3);
      osc({ type: 'triangle', f: 466, f2: 349, d: 0.6, v: 0.45, at: 0.6, hold: 0.15 }); drumHit(0.6, true);
    }
  };
  var RATE = { sword: 0.09, spear: 0.09, hoof: 0.1, arrow: 0.08, bolt: 0.1, fire: 0.12, puff: 0.07, hurt: 0.25, drum: 0.3, pulse: 0.3, crack: 0.1, boom: 0.12 };
  var lastSfx = {};
  function sfx(name, arg) {
    if (!soundOn || quick) return;
    var now = performance.now() / 1000;
    if (RATE[name] && now - (lastSfx[name] || 0) < RATE[name]) return;
    lastSfx[name] = now;
    if (!audio()) return;
    try { SFX[name](arg); } catch (e) { /* 忽略 */ }
  }

  // ---------- 画布 ----------
  var cv = $('cv'), ctx = cv.getContext('2d');
  var field = $('field'), wrap = $('boardWrap');
  var cell = 48, dpr = 1, BW = 0, BH = 0;
  var bg = null, bgSig = '', vig = null;
  var sprites = {};
  function sprite(key, S, fn) {
    var sp = sprites[key];
    if (sp && sp.S === S) return sp.cv;
    var pad = 1.6, px = Math.ceil(S * pad * dpr);
    var c = A.canvas(px, px), x = c.getContext('2d');
    x.scale(dpr, dpr); x.translate(S * pad / 2, S * pad / 2);
    fn(x, S);
    sprites[key] = { S: S, cv: c };
    return c;
  }
  function itemSprite(it) {
    var key = it.t + (it.k || '') + (it.lv || '') + (it.ch || '');
    return sprite(key, cell, function (x, S) { A.drawItem(x, it, S); });
  }
  function enemySprite(e, fac) {
    var key = 'e' + fac + e.type + e.ch + (e.boss ? 'B' + e.name : '') + e.r;
    return sprite(key, cell, function (x, S) { A.drawEnemy(x, e, S, fac); });
  }
  function blit(sp, x, y, scale, alpha) {
    var s = cell * 1.6 * (scale || 1);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
    if (alpha != null) ctx.globalAlpha = 1;
  }
  function buildBg() {
    if (!G) return;
    var sig = G.level + '|' + G.cells.map(function (c) { return c.lock ? 1 : 0; }).join('') + '|' + cell + '|' + dpr;
    if (bg && sig === bgSig) return;
    bgSig = sig;
    bg = bg || document.createElement('canvas');
    bg.width = Math.round(BW * dpr); bg.height = Math.round(BH * dpr);
    var c = bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    A.drawTerrain(c, G.level, G.cells, cell);
  }
  function layout() {
    var fw = field.clientWidth - 16 - 6, fh = field.clientHeight - 6 - 6;
    cell = Math.max(20, Math.floor(Math.min(fw / COLS, fh / ROWS)));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    A.setDpr(dpr);
    BW = cell * COLS; BH = cell * ROWS;
    cv.style.width = BW + 'px'; cv.style.height = BH + 'px';
    cv.width = Math.round(BW * dpr); cv.height = Math.round(BH * dpr);
    sprites = {}; bg = null; bgSig = '';
    vig = A.vignette(BW, BH);
    buildBg();
    initAmbient();
    benchSig = '';
    renderBench();
  }
  window.addEventListener('resize', function () { if (G) layout(); sizeTitle(); });

  // ---------- 状态 ----------
  var G = null, running = false, paused = false, speed = store.get('speed', 1) === 2 ? 2 : 1;
  var acc = 0, last = 0, fx = [], anims = {}, selected = null, drag = null, gameOver = false, evCount = {};
  var baseHurt = 0, baseHeal = 0, tutStep = store.get('tut', 0), now = 0;

  // ---------- 环境粒子 ----------
  var amb = [];
  function initAmbient() {
    amb = [];
    if (!G) return;
    var T = A.TERRAIN[G.L.terrain], n = T.fx === 'rain' ? 70 : T.fx === 'mist' ? 10 : 34;
    for (var i = 0; i < n; i++) amb.push(newAmb(T.fx, true));
  }
  function newAmb(kind, scatter) {
    var p = { k: kind, x: Math.random() * BW, y: scatter ? Math.random() * BH : (kind === 'ember' ? BH + 5 : -10), s: Math.random() };
    if (kind === 'ember') { p.vx = (Math.random() - 0.5) * 12; p.vy = -18 - Math.random() * 26; p.life = 3 + Math.random() * 3; }
    else if (kind === 'rain') { p.vx = -60; p.vy = 420 + Math.random() * 120; }
    else if (kind === 'mist') { p.vx = 6 + Math.random() * 8; p.vy = 0; p.r = cell * (1.2 + Math.random() * 1.6); }
    else { p.vx = 8 + Math.random() * 14; p.vy = (Math.random() - 0.5) * 4; }
    p.t = 0;
    return p;
  }
  function drawAmbient(dt) {
    for (var i = 0; i < amb.length; i++) {
      var p = amb[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'ember') {
        p.x += Math.sin(p.t * 3 + p.s * 9) * 0.3;
        if (p.y < -10 || p.t > p.life) { amb[i] = newAmb('ember'); continue; }
        var fl = 0.5 + 0.5 * Math.sin(p.t * 12 + p.s * 20);
        ctx.fillStyle = 'rgba(255,' + (120 + (fl * 80 | 0)) + ',40,' + (0.5 + fl * 0.4) * Math.min(1, (p.life - p.t)) + ')';
        ctx.fillRect(p.x, p.y, 2, 2);
      } else if (p.k === 'rain') {
        if (p.y > BH) { amb[i] = newAmb('rain'); amb[i].x = Math.random() * (BW + 60); continue; }
        ctx.strokeStyle = 'rgba(190,210,230,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y + 12); ctx.stroke();
      } else if (p.k === 'mist') {
        if (p.x - p.r > BW) { amb[i] = newAmb('mist', true); amb[i].x = -amb[i].r; continue; }
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(200,220,190,.12)'); g.addColorStop(1, 'rgba(200,220,190,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        if (p.x > BW + 5) { amb[i] = newAmb('dust', true); amb[i].x = -5; continue; }
        ctx.fillStyle = 'rgba(230,200,150,' + (0.15 + p.s * 0.2) + ')';
        ctx.fillRect(p.x, p.y + Math.sin(p.t + p.s * 6) * 3, 1.5 + p.s, 1.5 + p.s);
      }
    }
  }

  // ---------- 特效 ----------
  function addFx(o) { if (quick || fx.length > 320) return null; o.t = 0; fx.push(o); return o; }
  function numCount() { var n = 0; for (var i = 0; i < fx.length; i++) if (fx[i].k === 'num') n++; return n; }
  function gl(ch, px, col, opt) { return A.glyph(ch, px, col, opt); }
  function drawNumber(str, x, y, px, col, alpha) {
    var w = px * 0.56, x0 = x - (str.length - 1) * w / 2;
    for (var i = 0; i < str.length; i++) A.drawGlyph(ctx, gl(str[i], px, col, { stroke: '#120a05', sw: 0.16 }), x0 + i * w, y, 1, alpha);
  }
  function fmtNum(v) {
    if (v >= 10000) return Math.round(v / 1000) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return String(Math.max(1, Math.round(v)));
  }
  var UCOL = {
    dao: ['#f6ecd6', 'rgba(255,240,200,.5)'], qiang: ['#f1e6cc', null], gong: ['#efe2c4', null], qi: ['#f3d9a8', null], dun: ['#cfe0f0', 'rgba(140,190,230,.6)'],
    nu: ['#d9e2ea', 'rgba(170,200,230,.45)'], gu: ['#ffcf8a', 'rgba(255,170,80,.6)'], huo: ['#ffb347', 'rgba(255,90,20,.9)'], tou: ['#d8cbb2', null], lian: ['#dce6ee', 'rgba(160,200,230,.5)']
  };
  function projStyle(p) {
    if (p.gold) {
      if (p.kind === 'kongming') return ['#ffcf6a', 'rgba(255,110,30,.95)'];
      if (p.kind === 'pangtong') return ['#bff0e0', 'rgba(60,200,170,.8)'];
      return ['#ffe28a', 'rgba(255,200,80,.85)'];
    }
    return UCOL[p.kind] || ['#efe2c4', null];
  }
  function updateFx(dt) {
    for (var i = 0; i < fx.length; i++) fx[i].t += dt;
    fx = fx.filter(function (f) { return f.t < f.life; });
    for (var k in anims) { anims[k].t += dt; if (anims[k].t > anims[k].life) delete anims[k]; }
    if (baseHurt > 0) baseHurt -= dt;
    if (baseHeal > 0) baseHeal -= dt;
  }
  function drawFx() {
    var S = cell;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i], p = f.t / f.life, q = 1 - p, x = f.x * S, y = f.y * S;
      ctx.save();
      switch (f.k) {
        case 'pop': {
          // 文字闪现：先放大再回落、淡出、可上浮
          var sc = p < 0.18 ? (f.from || 1.8) - ((f.from || 1.8) - 1) * (p / 0.18) : 1 + (p - 0.18) * (f.grow || 0.15);
          var al = p < 0.6 ? 1 : (1 - p) / 0.4;
          A.drawGlyph(ctx, f.g, x, y - p * S * (f.rise || 0), sc, al, f.rot || 0);
          break;
        }
        case 'arc': {
          var a0 = f.a - 1.2 + p * 1.0;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(10,6,4,' + 0.5 * q + ')'; ctx.lineWidth = S * f.w * q + 1;
          ctx.beginPath(); ctx.arc(x, y, S * f.r, a0, a0 + 1.9); ctx.stroke();
          ctx.strokeStyle = f.col.replace('A', q.toFixed(2)); ctx.lineWidth = S * f.w * 0.55 * q + 0.5;
          ctx.beginPath(); ctx.arc(x, y, S * f.r, a0, a0 + 1.9); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + 0.8 * q + ')'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, S * f.r * 1.03, a0 + 0.2, a0 + 1.6); ctx.stroke();
          break;
        }
        case 'dash': {
          // 「冲」：冲出再折返，带尘土
          var k = p < 0.5 ? p * 2 : (1 - p) * 2;
          var dx = x + (f.x2 - f.x) * S * k, dy = y + (f.y2 - f.y) * S * k;
          for (var tr = 3; tr >= 1; tr--) {
            var kk = Math.max(0, k - tr * 0.08 * (p < 0.5 ? 1 : -1));
            A.drawGlyph(ctx, f.g, x + (f.x2 - f.x) * S * kk, y + (f.y2 - f.y) * S * kk, 1, 0.18 * (4 - tr));
          }
          A.drawGlyph(ctx, f.g, dx, dy, 1, 1);
          break;
        }
        case 'travel': {
          // 文字沿折线飞行（龙、冲、火）
          var n = f.pts.length, pos = Math.min(1, p * (f.speed || 1.4)) * (n - 1);
          var idx = Math.floor(pos), fr = pos - idx;
          var a = f.pts[Math.min(idx, n - 1)], b = f.pts[Math.min(idx + 1, n - 1)];
          var tx = (a[0] + (b[0] - a[0]) * fr) * S, ty = (a[1] + (b[1] - a[1]) * fr) * S;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = f.trail; ctx.lineWidth = S * (f.tw || 0.18) * q + 1;
          if (f.glow) { ctx.shadowColor = f.glow; ctx.shadowBlur = S * 0.4; }
          ctx.beginPath(); ctx.moveTo(f.pts[0][0] * S, f.pts[0][1] * S);
          for (var j = 1; j <= idx && j < n; j++) ctx.lineTo(f.pts[j][0] * S, f.pts[j][1] * S);
          ctx.lineTo(tx, ty); ctx.globalAlpha = q; ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          A.drawGlyph(ctx, f.g, tx, ty, 1 + 0.1 * Math.sin(p * 20), p > 0.8 ? (1 - p) / 0.2 : 1);
          break;
        }
        case 'ring': {
          ctx.globalAlpha = q * (f.a || 1);
          ctx.strokeStyle = f.col; ctx.lineWidth = S * (f.w || 0.08) * q + 1;
          A.circ(ctx, x, y, S * (f.r0 + (f.r1 - f.r0) * p)); ctx.stroke();
          break;
        }
        case 'dust': {
          for (var d = 0; d < 7; d++) {
            var da = d * 0.9 + f.seed, dr = S * (0.15 + 0.5 * p) * (f.big || 1);
            ctx.fillStyle = 'rgba(' + (d % 2 ? '190,160,120' : '120,100,80') + ',' + 0.55 * q + ')';
            A.circ(ctx, x + Math.cos(da) * dr, y + Math.sin(da) * dr * 0.6 - p * S * 0.2, S * (0.1 * q + 0.03) * (f.big || 1)); ctx.fill();
          }
          break;
        }
        case 'spark': {
          ctx.strokeStyle = f.col || 'rgba(255,240,200,' + q + ')'; ctx.globalAlpha = q; ctx.lineWidth = 1.5;
          for (var s = 0; s < 5; s++) {
            var sa = s * 1.26 + f.seed, r1 = S * 0.05, r2 = S * (0.12 + 0.18 * p);
            ctx.beginPath(); ctx.moveTo(x + Math.cos(sa) * r1, y + Math.sin(sa) * r1); ctx.lineTo(x + Math.cos(sa) * r2, y + Math.sin(sa) * r2); ctx.stroke();
          }
          break;
        }
        case 'split': {
          // 敌军军旗被斩成两半，墨迹四溅
          var off = S * 0.35 * p, rot = 0.5 * p, sz = S * 1.6;
          ctx.globalAlpha = q;
          [1, -1].forEach(function (sd) {
            ctx.save();
            ctx.translate(x + sd * off * 0.7, y + sd * off * 0.4 + p * p * S * 0.4);
            ctx.rotate(sd * rot);
            ctx.beginPath();
            if (sd > 0) { ctx.moveTo(-sz, -sz * 0.3); ctx.lineTo(sz, sz * 0.3 - sz); ctx.lineTo(sz, sz); ctx.lineTo(-sz, sz); }
            else { ctx.moveTo(-sz, -sz * 0.3); ctx.lineTo(sz, sz * 0.3 - sz); ctx.lineTo(sz, -sz); ctx.lineTo(-sz, -sz); }
            ctx.closePath(); ctx.clip();
            ctx.drawImage(f.sp, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
          });
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,240,210,' + q + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - S * 0.5 * (1 - p * 0.5), y + S * 0.18); ctx.lineTo(x + S * 0.5 * (1 - p * 0.5), y - S * 0.18); ctx.stroke();
          break;
        }
        case 'ink': {
          for (var b2 = 0; b2 < f.blots.length; b2++) {
            var bl = f.blots[b2];
            ctx.fillStyle = 'rgba(12,8,6,' + 0.7 * q + ')';
            A.circ(ctx, x + bl[0] * S * (0.4 + p * 0.6), y + bl[1] * S * (0.4 + p * 0.6), bl[2] * S * (0.7 + p * 0.3)); ctx.fill();
          }
          break;
        }
        case 'num': {
          var sc2 = p < 0.15 ? 0.7 + p * 3 : 1.15 - Math.min(0.15, p);
          drawNumber(f.s, x, y - p * S * 0.5, S * (f.big ? 0.42 : 0.27) * sc2, f.big ? GOLD_L : (f.col || '#f5ead2'), p < 0.6 ? 1 : (1 - p) / 0.4);
          break;
        }
        case 'text': {
          var al2 = p < 0.75 ? 1 : (1 - p) / 0.25;
          A.drawGlyph(ctx, f.g, x, y - p * S * 0.6, p < 0.12 ? 0.6 + p / 0.12 * 0.4 : 1, al2);
          break;
        }
        case 'shock': {
          for (var rr = 0; rr < 3; rr++) {
            var pp = Math.min(1, Math.max(0, p * 1.4 - rr * 0.18));
            ctx.strokeStyle = 'rgba(255,' + (90 + rr * 50) + ',50,' + (1 - pp) * 0.85 + ')'; ctx.lineWidth = S * 0.14 * (1 - pp) + 0.5;
            A.circ(ctx, x, y, f.r * S * pp); ctx.stroke();
          }
          break;
        }
        case 'beam': {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,214,110,' + q + ')'; ctx.lineWidth = S * 0.16 * q + 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(f.x2 * S, f.y2 * S); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + q + ')'; ctx.lineWidth = S * 0.05 * q + 0.5; ctx.stroke();
          break;
        }
        case 'chain': {
          ctx.strokeStyle = 'rgba(120,220,190,' + 0.9 * q + ')'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
          ctx.beginPath();
          f.pts.forEach(function (pt, ii) { if (ii === 0) ctx.moveTo(pt[0] * S, pt[1] * S); else ctx.lineTo(pt[0] * S, pt[1] * S); });
          ctx.stroke(); ctx.setLineDash([]);
          f.pts.forEach(function (pt) { A.drawGlyph(ctx, f.g, pt[0] * S, pt[1] * S - S * 0.4, 1, q); });
          break;
        }
        case 'crack': {
          ctx.strokeStyle = 'rgba(255,200,120,' + q + ')'; ctx.lineWidth = 2;
          for (var c2 = 0; c2 < 8; c2++) {
            var ca = c2 * 0.785 + f.seed, cl = f.r * S * Math.min(1, p * 3);
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(ca) * cl * 0.5 + 4, y + Math.sin(ca) * cl * 0.5 - 3);
            ctx.lineTo(x + Math.cos(ca) * cl, y + Math.sin(ca) * cl); ctx.stroke();
          }
          break;
        }
        case 'fly': {
          // 文字从 x,y 飞向 x2,y2 的弧线（仁 → 阿斗）
          var fx2 = x + (f.x2 - f.x) * S * p, fy2 = y + (f.y2 - f.y) * S * p - Math.sin(p * Math.PI) * S * 1.2;
          A.drawGlyph(ctx, f.g, fx2, fy2, 1, p > 0.85 ? (1 - p) / 0.15 : 1);
          break;
        }
        case 'rays': {
          // 技能发动：金色光芒
          ctx.translate(x, y); ctx.rotate(p * 0.8);
          var rg2 = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 1.4);
          rg2.addColorStop(0, 'rgba(255,240,190,' + 0.7 * q + ')'); rg2.addColorStop(1, 'rgba(255,200,90,0)');
          ctx.fillStyle = rg2; A.circ(ctx, 0, 0, S * 1.4); ctx.fill();
          ctx.globalAlpha = q;
          for (var ry = 0; ry < 12; ry++) {
            ctx.rotate(Math.PI / 6);
            ctx.fillStyle = ry % 2 ? 'rgba(255,220,130,.8)' : 'rgba(255,250,220,.7)';
            ctx.beginPath(); ctx.moveTo(-S * 0.04, -S * 0.3); ctx.lineTo(S * 0.04, -S * 0.3); ctx.lineTo(0, -S * (0.9 + 0.8 * p)); ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'flood': {
          var fy = (-0.3 + p * 1.6) * BH;
          var gw = ctx.createLinearGradient(0, fy - BH * 0.3, 0, fy + BH * 0.1);
          gw.addColorStop(0, 'rgba(70,130,170,0)'); gw.addColorStop(0.8, 'rgba(70,130,170,' + 0.5 * q + ')'); gw.addColorStop(1, 'rgba(200,230,240,' + 0.6 * q + ')');
          ctx.fillStyle = gw; ctx.fillRect(0, fy - BH * 0.3, BW, BH * 0.4);
          break;
        }
      }
      ctx.restore();
    }
  }

  // ---------- 渲染 ----------
  var HL = {
    place: ['rgba(243,214,138,.18)', 'rgba(243,214,138,.9)'], move: ['rgba(243,214,138,.18)', 'rgba(243,214,138,.9)'],
    merge: ['rgba(255,200,80,.45)', '#ffe08a'], general: ['rgba(255,200,80,.5)', '#ffe08a'],
    swap: ['rgba(120,150,190,.35)', '#9fb3cc'], dig: ['rgba(160,110,50,.35)', '#d9a861']
  };
  function render(nowMs, dt) {
    var t = nowMs / 1000, S = cell;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!G) return;
    buildBg();
    ctx.drawImage(bg, 0, 0, BW, BH);
    var T = A.TERRAIN[G.L.terrain];
    if (T.fx === 'mist') drawAmbient(dt);
    // 路边军旗（敌方入口两侧）
    var p0 = G.P.pts[1];
    A.drawFlag(ctx, (p0[0] - 0.62) * S, 0.62 * S, S * 0.42, Z.FACTIONS[G.L.faction].badge, Z.FACTIONS[G.L.faction].color, t, 0, S * 0.55);
    // 拖拽高亮
    if (drag && drag.active && drag.plans) {
      for (var key in drag.plans) {
        var pl = drag.plans[key], col = HL[pl.act];
        if (!col) continue;
        var cc = key.split(','), hx = +cc[0] * S, hy = +cc[1] * S;
        var hov = drag.over && drag.over.z === 't' && drag.over.c === +cc[0] && drag.over.r === +cc[1];
        ctx.fillStyle = col[0];
        A.rrect(ctx, hx + 3, hy + 3, S - 6, S - 6, S * 0.1); ctx.fill();
        ctx.lineWidth = hov ? 3 : 1.5; ctx.strokeStyle = hov ? '#fff4d0' : col[1];
        if (pl.act === 'dig') ctx.setLineDash([5, 4]);
        ctx.stroke(); ctx.setLineDash([]);
        if (pl.act === 'merge' || pl.act === 'general') {
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 8);
          ctx.fillStyle = '#ffe08a'; A.rrect(ctx, hx + 3, hy + 3, S - 6, S - 6, S * 0.1); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    // 射程圈
    var ring = null;
    if (drag && drag.active && drag.over && drag.over.z === 't' && drag.item && (drag.item.t === 'u' || drag.item.t === 'g')) {
      var op = drag.plans && drag.plans[drag.over.c + ',' + drag.over.r];
      if (op && op.act !== 'dig') ring = { c: drag.over.c, r: drag.over.r, it: drag.item };
    } else if (selected) {
      var si = G.getItem(selected);
      if (si && (si.t === 'u' || si.t === 'g')) ring = { c: selected.c, r: selected.r, it: si };
      else selected = null;
    }
    if (ring) {
      var rce = G.cellAt(ring.c, ring.r);
      var rg = (ring.it.t === 'u' ? Z.UNITS[ring.it.k].range : Z.GENERALS[ring.it.k].range) + (rce && rce.high ? 0.5 : 0);
      var rx = (ring.c + 0.5) * S, ry = (ring.r + 0.5) * S;
      ctx.fillStyle = 'rgba(255,200,120,.1)'; A.circ(ctx, rx, ry, rg * S); ctx.fill();
      ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,214,140,.85)'; ctx.stroke();
      if (ring.it.t === 'g' && Z.GENERALS[ring.it.k].aura !== 'all') { ctx.strokeStyle = 'rgba(220,60,40,.8)'; A.circ(ctx, rx, ry, CFG.auraRange * S); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // 阿斗
    var end = G.P.end;
    A.drawBase(ctx, (end[0] + 0.5) * S, (end[1] + 0.5) * S - S * 0.05, S * 1.05, t, baseHurt, baseHeal);
    // 我军
    for (var i = 0; i < G.cells.length; i++) {
      var ce = G.cells[i], it = ce.item;
      if (!it) continue;
      var ux = (ce.c + 0.5) * S, uy = (ce.r + 0.5) * S;
      var sc = 1, an = anims[i];
      if (an) sc = 1 + Math.sin(an.t / an.life * Math.PI) * (an.amp || 0.3);
      if (it.lunge > 0) { var lk = Math.sin((1 - it.lunge / 0.16) * Math.PI); ux += it.lx * lk * S * 0.12; uy += it.ly * lk * S * 0.12; }
      var isSrc = drag && drag.active && drag.from.z === 't' && drag.from.c === ce.c && drag.from.r === ce.r;
      if (it.rushT > 0) { ctx.fillStyle = 'rgba(255,210,120,' + (0.25 + 0.15 * Math.sin(t * 10)) + ')'; A.circ(ctx, ux, uy, S * 0.52); ctx.fill(); }
      if (it.t === 'g') {
        var glow = 0.25 + 0.12 * Math.sin(t * 3 + i);
        var gg = ctx.createRadialGradient(ux, uy, S * 0.1, ux, uy, S * 0.62);
        gg.addColorStop(0, 'rgba(255,200,90,' + glow + ')'); gg.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = gg; A.circ(ctx, ux, uy, S * 0.62); ctx.fill();
        blit(itemSprite(it), ux, uy, sc, isSrc ? 0.3 : null);
        var gd = Z.GENERALS[it.k];
        if (!isSrc) A.drawFlag(ctx, ux + S * 0.26, uy - S * 0.3, S * 0.3, gd.flag, '#8a1414', t, i, S * 0.32);
        if (G.phase === 'wave' && it.skLeft != null) {
          var frac = 1 - Math.max(0, it.skLeft) / (gd.skillCd * (G.mods.skillCd || 1));
          ctx.lineWidth = Math.max(2, S * 0.05); ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(ux, uy + S * 0.47, S * 0.24, Math.PI, 0); ctx.stroke();
          ctx.strokeStyle = frac >= 1 ? '#fff4c8' : GOLD_L;
          ctx.beginPath(); ctx.arc(ux, uy + S * 0.47, S * 0.24, Math.PI, Math.PI + Math.PI * Math.min(1, frac)); ctx.stroke();
        }
      } else {
        if (it.t === 'u' && it.lv === 5) {
          var pulse = 0.3 + 0.2 * Math.sin(t * 4 + i);
          var hg = ctx.createRadialGradient(ux, uy, S * 0.2, ux, uy, S * 0.6);
          hg.addColorStop(0, 'rgba(255,120,40,' + pulse + ')'); hg.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = hg; A.circ(ctx, ux, uy, S * 0.6); ctx.fill();
        }
        blit(itemSprite(it), ux, uy, sc, isSrc ? 0.3 : null);
        if (it.t === 'u' && it.aura > 1.001) A.drawGlyph(ctx, gl('▲', S * 0.16, GOLD_L, { stroke: '#120a05', sw: 0.2, font: 'serif' }), ux + S * 0.31, uy - S * 0.36);
      }
      if (it.burnT > 0) A.drawGlyph(ctx, gl('火', S * 0.28, '#ff9a3a', { glow: 'rgba(255,60,0,.9)' }), ux - S * 0.28, uy - S * 0.34, 1 + 0.15 * Math.sin(t * 14), 0.9);
    }
    // 敌军
    var es = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
    var fac = G.L.faction, linked = [];
    for (var e = 0; e < es.length; e++) {
      var en = es[e];
      var ex = en.x * S, ey = en.y * S + Math.sin(t * 9 + en.id) * S * 0.02;
      if (en.boss) {
        var ag = ctx.createRadialGradient(ex, ey, S * 0.2, ex, ey, S * 0.85);
        ag.addColorStop(0, 'rgba(200,30,20,' + (0.35 + 0.15 * Math.sin(t * 4)) + ')'); ag.addColorStop(1, 'rgba(200,30,20,0)');
        ctx.fillStyle = ag; A.circ(ctx, ex, ey, S * 0.85); ctx.fill();
      }
      if (en.slowed > 0) { ctx.strokeStyle = 'rgba(140,190,230,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(ex, ey + en.r * S * 1.05, en.r * S * 1.05, en.r * S * 0.35, 0, 0, 7); ctx.stroke(); }
      if (en.chargeT > 0) {
        ctx.strokeStyle = 'rgba(255,60,40,.5)'; ctx.lineWidth = S * 0.12;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - (en.dx || 0) * S * 0.9, ey - (en.dy || 0) * S * 0.9); ctx.stroke();
      }
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(Math.sin(t * 4 + en.id) * 0.04);
      var sp = enemySprite(en, fac), s2 = S * 1.6;
      ctx.drawImage(sp, -s2 / 2, -s2 / 2, s2, s2);
      if (en.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(0.7, en.flash * 9); ctx.drawImage(sp, -s2 / 2, -s2 / 2, s2, s2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      ctx.restore();
      if (en.shield > 0) {
        ctx.strokeStyle = 'rgba(255,220,120,.8)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,220,120,.15)';
        A.circ(ctx, ex, ey, en.r * S * 1.45); ctx.fill(); ctx.stroke();
      }
      if (en.burnT > 0) A.drawGlyph(ctx, gl('火', S * 0.24, '#ffa040', { glow: 'rgba(255,60,0,.9)' }), ex + en.r * S * 0.8, ey - en.r * S * 0.6, 1 + 0.2 * Math.sin(t * 16 + en.id), 0.95);
      if (en.vulnT > 0) A.drawGlyph(ctx, gl('破', S * 0.22, '#ff7060', { stroke: '#200', sw: 0.15 }), ex - en.r * S * 0.85, ey - en.r * S * 0.6);
      if (en.linkT > 0) linked.push(en);
      if (en.stun > 0) {
        for (var st = 0; st < 3; st++) {
          var sa = t * 5 + st * 2.1;
          ctx.fillStyle = GOLD_L; A.circ(ctx, ex + Math.cos(sa) * en.r * S, ey - en.r * S * 1.2 + Math.sin(sa) * S * 0.05, S * 0.04); ctx.fill();
        }
      }
      if (en.hp < en.maxHp || en.boss) {
        var bw = S * (en.boss ? 1.0 : 0.62), bh = Math.max(2.5, S * (en.boss ? 0.075 : 0.055));
        var bx2 = ex - bw / 2, by2 = ey - en.r * S * 1.32 - bh - 2;
        ctx.fillStyle = 'rgba(8,5,3,.85)'; ctx.fillRect(bx2 - 1, by2 - 1, bw + 2, bh + 2);
        var hpf = Math.max(0, en.hp / en.maxHp);
        var hgr = ctx.createLinearGradient(0, by2, 0, by2 + bh);
        if (en.boss) { hgr.addColorStop(0, '#ffd27a'); hgr.addColorStop(1, '#a8661c'); } else { hgr.addColorStop(0, '#e8584a'); hgr.addColorStop(1, '#7a1414'); }
        ctx.fillStyle = hgr; ctx.fillRect(bx2, by2, bw * hpf, bh);
        if (en.shield > 0) { ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.fillRect(bx2, by2 - 2, bw * Math.min(1, en.shield / en.maxHp * 4), 1.5); }
        ctx.strokeStyle = 'rgba(176,141,87,.8)'; ctx.lineWidth = 1; ctx.strokeRect(bx2 - 0.5, by2 - 0.5, bw + 1, bh + 1);
      }
    }
    if (linked.length > 1) {
      ctx.strokeStyle = 'rgba(120,220,190,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      linked.forEach(function (en2, ii) { if (ii === 0) ctx.moveTo(en2.x * S, en2.y * S); else ctx.lineTo(en2.x * S, en2.y * S); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 投射物（全是字）
    for (var pj = 0; pj < G.projs.length; pj++) {
      var pr = G.projs[pj];
      if (pr.delay > 0) continue;
      var stl = projStyle(pr);
      var px = pr.x * S, py = pr.y * S;
      if (pr.lob) {
        var hh = (pr.h || 0) * S * 1.4;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px, py, S * 0.18, S * 0.07, 0, 0, 7); ctx.fill();
        A.drawGlyph(ctx, gl('石', S * 0.5, '#d8cbb2', { stroke: '#1a120a', sw: 0.12 }), px, py - hh, 1 + (pr.h || 0) * 0.5, 1, pr.t * 6);
        continue;
      }
      var tr = pr._tr || (pr._tr = []);
      tr.push(px, py);
      if (tr.length > 10) tr.splice(0, 2);
      if (pr.line) {
        var size = pr.gold ? S * 0.62 : pr.kind === 'nu' ? S * 0.5 : S * 0.44;
        var sx = (pr.sx + (pr.x - pr.sx) * 0.15) * S, sy = (pr.sy + (pr.y - pr.sy) * 0.15) * S;
        var lg = ctx.createLinearGradient(sx, sy, px, py);
        lg.addColorStop(0, 'rgba(255,240,200,0)'); lg.addColorStop(1, pr.gold ? 'rgba(255,214,110,.9)' : 'rgba(240,230,210,.8)');
        ctx.strokeStyle = lg; ctx.lineWidth = pr.kind === 'nu' ? S * 0.09 : S * 0.06; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
        var ang = Math.atan2(pr.dy, pr.dx), tilt = Math.max(-0.45, Math.min(0.45, Math.sin(ang) * Math.cos(ang) * 0.9));
        A.drawGlyph(ctx, gl(pr.glyph, size, stl[0], { glow: stl[1], stroke: '#120a05', sw: 0.1 }), px, py, 1, 1, tilt);
        continue;
      }
      var gsz = pr.gold ? S * 0.52 : pr.kind === 'lian' ? S * 0.3 : S * 0.36;
      var g1 = gl(pr.glyph, gsz, stl[0], { glow: stl[1], stroke: '#120a05', sw: 0.1 });
      for (var ti = 0; ti < tr.length - 2; ti += 2) A.drawGlyph(ctx, g1, tr[ti], tr[ti + 1], 0.6 + ti * 0.04, 0.08 + ti * 0.03);
      if (pr.kind === 'gong') {
        // 「矢」雨：三支一组
        var nx = -Math.sin(pr.ang) * S * 0.16, ny = Math.cos(pr.ang) * S * 0.16;
        A.drawGlyph(ctx, g1, px + nx, py + ny, 0.75, 0.85);
        A.drawGlyph(ctx, g1, px - nx, py - ny, 0.75, 0.85);
      }
      A.drawGlyph(ctx, g1, px, py, 1, 1);
    }
    drawFx();
    if (T.fx !== 'mist') drawAmbient(dt);
    ctx.drawImage(vig, 0, 0, BW, BH);
    if (G.floodOn > 0) { ctx.fillStyle = 'rgba(60,110,150,' + Math.min(0.22, G.floodOn * 0.1) + ')'; ctx.fillRect(0, 0, BW, BH); }
  }

  // ---------- 备战栏 ----------
  var slots = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var benchSig = '';
  function itemSig(it) { return it ? it.t + (it.k || '') + (it.lv || '') + (it.ch || '') : '-'; }
  function renderBench() {
    if (!G) return;
    var sig = G.bench.map(itemSig).join('|') + (drag && drag.active && drag.from.z === 'b' ? 'd' + drag.from.i : '');
    if (sig === benchSig) return;
    benchSig = sig;
    slots.forEach(function (el, i) {
      var c = el.querySelector('canvas'), w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
      var x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      var it = G.bench[i];
      el.classList.toggle('empty', !it);
      el.classList.toggle('dragsrc', !!(drag && drag.active && drag.from.z === 'b' && drag.from.i === i));
      if (it) { x.translate(w / 2, h / 2); A.drawItem(x, it, Math.min(w * 0.98, h * 1.05)); }
    });
  }
  function slotPop(i) { var el = slots[i]; if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  // ---------- 顶栏 ----------
  var hud = {};
  function setTxt(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
  function updateHud() {
    if (!G) return;
    setTxt('hpV', String(G.hp));
    setTxt('waveV', String(Math.max(G.wave, 1)));
    setTxt('wavesV', '/' + G.L.waves);
    setTxt('bunV', String(Math.floor(G.mantou)));
    setTxt('costV', String(G.cost()));
    var why = '';
    if (G.benchFree() < 0) why = '备战栏已满';
    else if (G.mantou < G.cost()) why = '馒头不足';
    if (G.phase === 'won' || G.phase === 'lost') why = ' ';
    var btn = $('btnSummon');
    btn.classList.toggle('off', !!why);
    btn.classList.toggle('ready', !why && tutStep === 0 && G.level === 0);
    setTxt('summonWhy', why.trim());
    var nx = $('btnNext'), showNext = G.phase === 'prep' || G.phase === 'break';
    nx.classList.toggle('hidden', !showNext);
    if (showNext) {
      setTxt('nxT', G.phase === 'prep' ? '开战' : '下一波');
      setTxt('nextCount', G.holdTimer ? '' : String(Math.max(0, Math.ceil(G.timer))));
      setTxt('nextBonus', G.phase === 'break' && G.timer > 0.5 ? '+' + Math.ceil(G.timer) * CFG.earlyBonusPerSec : '');
    }
    if (hud.speed !== speed) { hud.speed = speed; var sp = $('btnSpeed'); sp.textContent = '×' + speed; sp.classList.toggle('fast', speed === 2); }
    var synSig = Object.keys(G.syn).map(function (k) { return k + G.syn[k]; }).join(',');
    if (hud.syn !== synSig) {
      hud.syn = synSig;
      var row = $('synRow');
      row.innerHTML = '';
      Z.SYN_KEYS.forEach(function (k) {
        if (!G.syn[k]) return;
        var d = document.createElement('span');
        d.className = 'syn';
        var nm = Z.SYNERGIES[k].name;
        d.textContent = nm.length > 2 ? nm.slice(0, 2) + (k === 'wuhu' ? G.syn[k] : '') : nm;
        d.title = Z.SYNERGIES[k].desc;
        row.appendChild(d);
      });
    }
  }
  function syncSound() {
    var b = $('btnSound');
    b.classList.toggle('muted', !soundOn);
    b.querySelector('use').setAttribute('href', soundOn ? '#i-sound' : '#i-mute');
    $('btnTitleSound').textContent = '声音：' + (soundOn ? '开' : '关');
  }

  // ---------- 横幅 ----------
  var bannerQ = [], bannerBusy = false, bannerTimer = 0;
  function banner(main, sub, cls) { if (quick) return; bannerQ.push([main, sub, cls]); if (!bannerBusy) nextBanner(); }
  function nextBanner() {
    var b = bannerQ.shift(), el = $('banner');
    if (!b) { bannerBusy = false; return; }
    bannerBusy = true;
    el.className = 'banner ' + (b[2] || '');
    el.querySelector('.b-main').textContent = b[0];
    el.querySelector('.b-sub').textContent = b[1] || '';
    void el.offsetWidth; el.classList.add('show');
    bannerTimer = setTimeout(nextBanner, bannerQ.length ? 1100 : 1550);
  }
  function skillBanner(k) {
    if (quick) return;
    var box = $('skillBanner');
    Array.prototype.slice.call(box.children).forEach(function (ch) { if (ch.getAttribute('data-k') === k) box.removeChild(ch); });
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    var d = document.createElement('div');
    d.className = 'sk';
    d.setAttribute('data-k', k);
    d.innerHTML = '<i>' + Z.GENERALS[k].name + '</i><b>' + Z.GENERALS[k].skill + '</b>';
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1700);
  }
  var shakeAt = 0;
  function shake(big) {
    if (quick || now - shakeAt < 250) return;
    shakeAt = now;
    var c = big ? 'shake2' : 'shake';
    wrap.classList.remove('shake', 'shake2'); void wrap.offsetWidth; wrap.classList.add(c);
  }

  // ---------- 馒头飞入 ----------
  var flying = 0;
  function flyBun(x, y) {
    if (quick || flying >= 10 || !document.body.animate) return;
    var r = cv.getBoundingClientRect(), tr = $('bunBox').querySelector('.ico').getBoundingClientRect();
    var sx = r.left + x * cell, sy = r.top + y * cell, tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'fly'); el.innerHTML = '<use href="#i-bun"/>';
    $('flyLayer').appendChild(el); flying++;
    var mx = (sx + tx) / 2 + (Math.random() - 0.5) * 60, my = Math.min(sy, ty) - 30;
    var an = el.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.6)', opacity: 0.9 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.3)', opacity: 1, offset: 0.4 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.8)', opacity: 1 }
    ], { duration: 650, easing: 'cubic-bezier(.45,0,.75,.5)' });
    an.onfinish = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      flying--;
      var b = $('bunBox'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    };
  }
  function domFloat(el, s) {
    if (quick) return;
    var r = el.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'pop-text'; d.textContent = s;
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = r.top + 'px';
    $('flyLayer').appendChild(d);
    if (d.animate) d.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-190%)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = function () { if (d.parentNode) d.parentNode.removeChild(d); };
    else setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1000);
  }

  // ---------- 事件 → 特效与声音 ----------
  function popAt(loc, amp) {
    if (loc.z === 't') anims[loc.r * COLS + loc.c] = { t: 0, life: 0.28, amp: amp || 0.28 };
    else if (loc.z === 'b') slotPop(loc.i);
  }
  function txt(s, x, y, col, px, life, glow) {
    var half = Math.max(0.6, s.length * (px || 0.42) * 0.55);
    var hx = Math.max(half, Math.min(COLS - half, x));
    return addFx({ k: 'text', x: hx, y: Math.max(0.4, y), g: gl(s, cell * (px || 0.42), col || GOLD_L, { stroke: '#120a05', sw: 0.12, glow: glow }), life: life || 1 });
  }
  function bigGlyph(ch, x, y, px, col, glow, life, rise) {
    var half = Math.min(COLS / 2, px * ch.length * 0.5);
    x = Math.max(half, Math.min(COLS - half, x));
    y = Math.max(px * 0.5, Math.min(ROWS - px * 0.5, y));
    return addFx({ k: 'pop', x: x, y: y, g: gl(ch, cell * px, col, { glow: glow, stroke: '#2a1404', sw: 0.06, font: 'wild' }), life: life || 0.8, from: 2.2, rise: rise || 0.2 });
  }
  function handleEvents(evs) {
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      evCount[e.type] = (evCount[e.type] || 0) + 1;
      if (e.type === 'skill') evCount['skill:' + e.k] = (evCount['skill:' + e.k] || 0) + 1;
      if (e.type === 'atk' || e.type === 'shoot') evCount['atk:' + e.kind] = (evCount['atk:' + e.kind] || 0) + 1;
      if (e.type === 'synergy') evCount['syn:' + e.k] = (evCount['syn:' + e.k] || 0) + 1;
      if (e.type === 'bossAct') evCount['boss:' + e.act] = (evCount['boss:' + e.act] || 0) + 1;
      switch (e.type) {
        case 'summon':
          sfx('summon'); slotPop(e.slot);
          if (tutStep === 0) setTut(1);
          if (e.item.t === 'c') pieceHint(e.slot);
          break;
        case 'place':
          sfx('place'); popAt(e.to, 0.22);
          if (e.to.z === 't') {
            if (tutStep === 1) setTut(2);
            if (G.holdTimer) { G.holdTimer = false; G.timer = Math.min(G.timer, 20); }
            if (e.item.t === 'u' && discover('u', e.item.k)) { /* 新兵种 */ }
          }
          break;
        case 'swap': sfx('place'); popAt(e.to, 0.18); popAt(e.from, 0.18); break;
        case 'merge':
          sfx('merge', e.lv); popAt(e.to, 0.42);
          if (e.to.z === 't') {
            var mc = ['#a7adb4', '#d9a861', '#e3ecf6', '#ffe08a', '#ff8a3a'][e.lv - 1];
            addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: 0.95, col: mc, life: 0.5, w: 0.1 });
            addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.2, r1: 0.7, col: '#fff', life: 0.35 });
            txt(['', '', '铜', '银', '金', '赤金'][e.lv] + ' · ' + e.lv + '级', e.x, e.y - 0.45, mc, 0.32, 0.9);
          }
          if (tutStep === 2) setTut(3);
          break;
        case 'general': {
          var gd = Z.GENERALS[e.k];
          sfx('general'); popAt(e.to, 0.5);
          if (e.to.z === 't') {
            bigGlyph(gd.name, e.x, e.y - 0.2, 0.9, '#fff0b8', 'rgba(255,190,60,.95)', 1.1, 0.3);
            addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: 2, col: GOLD_L, life: 0.7, w: 0.12 });
          }
          banner(gd.name, '武将登场 · ' + gd.skill, 'gold');
          discover('g', e.k);
          hidePieceHint();
          break;
        }
        case 'synergy': {
          var S2 = Z.SYNERGIES[e.k];
          sfx('synergy');
          banner(S2.name, e.k === 'wuhu' ? (e.n >= 5 ? '五虎齐聚 · 技能冷却 −40%' : '五虎三将 · 技能冷却 −20%') : S2.desc.split('：')[1] || S2.desc, 'syn');
          G.cells.forEach(function (ce) {
            if (ce.item && ce.item.t === 'g' && S2.gens.indexOf(ce.item.k) >= 0) {
              addFx({ k: 'ring', x: ce.c + 0.5, y: ce.r + 0.5, r0: 0.3, r1: 1.4, col: '#ff8a5a', life: 0.8, w: 0.12 });
              bigGlyph(S2.name[0], ce.c + 0.5, ce.r - 0.35, 0.6, '#ffd0a0', 'rgba(255,80,40,.9)', 1.0, 0.5);
            }
          });
          discover('s', e.k);
          break;
        }
        case 'dig':
          sfx('dig');
          addFx({ k: 'dust', x: e.c + 0.5, y: e.r + 0.5, life: 0.6, seed: Math.random() * 6, big: 1.3 });
          bigGlyph('开', e.c + 0.5, e.r + 0.5, 0.5, PARCH, null, 0.6);
          anims[e.r * COLS + e.c] = { t: 0, life: 0.3, amp: 0.2 };
          break;
        case 'recycle': sfx('recycle'); domFloat($('recycle'), '+' + e.value); break;
        case 'atk': attackFx(e); break;
        case 'shoot':
          if (e.kind === 'tou') sfx('boom');
          else if (e.kind === 'huo' || e.kind === 'kongming') sfx('fire');
          else if (e.kind === 'lian') sfx('bolt');
          else sfx('arrow');
          break;
        case 'hit':
          addFx({ k: 'spark', x: e.x, y: e.y, life: 0.16, seed: Math.random() * 6, col: e.kind === 'huo' ? 'rgba(255,140,40,.9)' : null });
          break;
        case 'pierce': addFx({ k: 'spark', x: e.x, y: e.y, life: 0.14, seed: Math.random() * 6 }); break;
        case 'boom':
          addFx({ k: 'dust', x: e.x, y: e.y, life: 0.6, seed: Math.random() * 6, big: 1.8 });
          addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.2, r1: e.rad, col: '#e8c890', life: 0.4, w: 0.1 });
          bigGlyph('轰', e.x, e.y - 0.2, 0.75, '#ffd9a0', 'rgba(255,120,40,.85)', 0.55, 0.3);
          sfx('boom'); shake(false);
          break;
        case 'pulse':
          addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.25, r1: e.rad, col: 'rgba(150,200,240,.9)', life: 0.6, w: 0.06 });
          addFx({ k: 'pop', x: e.x, y: e.y - 0.35, g: gl('守', cell * 0.32, '#cfe0f0', { glow: 'rgba(120,180,230,.7)' }), life: 0.6, from: 1.3, rise: 0.3 });
          sfx('pulse');
          break;
        case 'drum':
          addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: e.rad, col: 'rgba(255,190,90,.9)', life: 0.55, w: 0.07 });
          addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.15, r1: e.rad * 0.7, col: 'rgba(255,190,90,.7)', life: 0.45, w: 0.05 });
          addFx({ k: 'pop', x: e.x + 0.18, y: e.y - 0.4, g: gl('咚', cell * 0.34, '#ffcf8a', { glow: 'rgba(255,150,60,.7)' }), life: 0.7, from: 1.5, rise: 0.5 });
          sfx('drum');
          break;
        case 'dmg':
          if ((e.big || e.frac >= 0.08) && numCount() < (e.big ? 24 : 14)) addFx({ k: 'num', x: e.x + (Math.random() - 0.5) * 0.25, y: e.y, s: fmtNum(e.v), big: e.big, col: e.dtype === 'fire' ? '#ffb070' : null, life: e.big ? 0.8 : 0.55 });
          break;
        case 'kill': {
          var en = { type: e.etype, ch: e.ch, r: e.r, boss: e.boss, name: e.boss ? lastBossName : '' };
          if (e.boss) en.name = e.name || lastBossName;
          var sp = enemySprite(en, G.L.faction);
          addFx({ k: 'split', x: e.x, y: e.y, sp: sp, life: e.boss ? 1.0 : 0.55 });
          var blots = [];
          for (var b = 0; b < (e.boss ? 10 : 5); b++) blots.push([(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.0, 0.04 + Math.random() * 0.07]);
          addFx({ k: 'ink', x: e.x, y: e.y, blots: blots, life: 0.7 });
          flyBun(e.x, e.y);
          if (e.boss) { sfx('bossdown'); txt('击破 +' + e.reward, e.x, e.y - 0.5, GOLD_L, 0.48, 1.4); shake(true); }
          else sfx('puff');
          break;
        }
        case 'drop':
          slotPop(e.slot);
          domFloat(slots[e.slot], e.name + ' 遗落「' + e.item.ch + '」');
          if (e.item.t === 'c') pieceHint(e.slot);
          break;
        case 'boss':
          lastBossName = e.name;
          banner(e.name, e.mid ? '敌将来袭' : '主帅出阵！', 'boss'); sfx('boss');
          discover('e', 'boss:' + e.name);
          break;
        case 'bossAct': bossActFx(e); break;
        case 'revive':
          bigGlyph('不服', e.x, e.y - 0.4, 0.8, '#ffb090', 'rgba(255,40,20,.9)', 1.1, 0.3);
          banner(e.name + ' 不服！', '七擒七纵 · 再战一回', 'boss'); sfx('bossAct');
          break;
        case 'wave':
          banner('第' + cnNum(e.n) + '波', e.tag || (e.last ? '最后一战' : Z.FACTIONS[G.L.faction].name + '来袭'));
          sfx('wave'); selected = null;
          break;
        case 'clear': sfx('clear'); domFloat($('bunBox'), '守住 +' + e.bonus); break;
        case 'early': sfx('early'); domFloat($('bunBox'), '抢攻 +' + e.bonus); break;
        case 'break': saveGame(); break;
        case 'flood':
          sfx('flood');
          addFx({ k: 'flood', x: 0, y: 0, life: 1.4 });
          bigGlyph('水', COLS / 2, ROWS * 0.45, 2.2, '#cfe8f4', 'rgba(80,150,200,.9)', 1.2, 0.2);
          break;
        case 'leak':
          sfx('hurt'); baseHurt = 1.0;
          if (!quick) {
            var fl = $('flash'); fl.className = ''; void fl.offsetWidth; fl.className = 'on';
            shake(e.boss);
            var hs = document.querySelector('.st-hp'); hs.classList.remove('hit'); void hs.offsetWidth; hs.classList.add('hit');
            txt('−' + e.loss, G.P.end[0] + 0.5, G.P.end[1] - 0.2, '#ff8070', 0.55, 1);
          }
          break;
        case 'skill': skillFx(e); break;
        case 'lose': sfx('lose'); endGame(false); break;
        case 'win': sfx('win'); endGame(true); break;
      }
    }
  }
  var lastBossName = '';
  function cnNum(n) { return n <= 10 ? NUMCN[n - 1] : n < 20 ? '十' + NUMCN[n - 11] : String(n); }
  function attackFx(e) {
    var ang = Math.atan2(e.y2 - e.y, e.x2 - e.x);
    switch (e.kind) {
      case 'dao':
        addFx({ k: 'arc', x: e.x2, y: e.y2, r: 0.36, a: ang, w: 0.13, col: 'rgba(255,240,210,A)', life: 0.2 });
        addFx({ k: 'pop', x: e.x2, y: e.y2 - 0.15, g: gl('斩', cell * 0.5, '#fff3dc', { glow: 'rgba(255,230,180,.7)', stroke: '#1a0a04', sw: 0.1 }), life: 0.42, from: 1.9, rise: 0.25 });
        sfx('sword');
        break;
      case 'qi':
        addFx({ k: 'dash', x: e.x, y: e.y, x2: e.x2, y2: e.y2, g: gl('冲', cell * 0.42, '#f3d9a8', { stroke: '#1a0a04', sw: 0.1 }), life: 0.32 });
        addFx({ k: 'dust', x: e.x2, y: e.y2, life: 0.45, seed: Math.random() * 6 });
        addFx({ k: 'ring', x: e.x2, y: e.y2, r0: 0.2, r1: e.rad || 0.9, col: 'rgba(200,170,120,.8)', life: 0.35, w: 0.06 });
        sfx('hoof');
        break;
      case 'qiang': case 'zhangfei': case 'zhaoyun': case 'jiangwei':
        sfx('spear');
        break;
      case 'nu': sfx('bolt'); break;
      case 'guanyu': case 'guanping': case 'weiyan': case 'machao': {
        var gk = e.kind, gd = Z.GENERALS[gk];
        addFx({ k: 'arc', x: e.x2, y: e.y2, r: (e.rad || 0.6) * 0.7, a: ang, w: 0.18, col: gk === 'guanyu' ? 'rgba(120,220,150,A)' : 'rgba(255,214,110,A)', life: 0.26 });
        addFx({ k: 'pop', x: e.x2, y: e.y2 - 0.1, g: gl(gd.glyph, cell * 0.5, '#ffe28a', { glow: 'rgba(255,190,60,.8)', stroke: '#2a1404', sw: 0.08 }), life: 0.36, from: 1.8 });
        sfx('sword');
        break;
      }
      case 'liubei':
        addFx({ k: 'pop', x: e.x2, y: e.y2 - 0.1, g: gl('仁', cell * 0.44, '#ffe28a', { glow: 'rgba(255,190,60,.8)', stroke: '#2a1404', sw: 0.08 }), life: 0.36, from: 1.8 });
        sfx('sword');
        break;
    }
  }
  function skillFx(e) {
    var k = e.k, gd = Z.GENERALS[k];
    sfx('skill', k); skillBanner(k);
    addFx({ k: 'rays', x: e.x, y: e.y, life: 0.7 });
    var gold = '#fff0b8', glow = 'rgba(255,180,50,.95)';
    switch (k) {
      case 'guanyu':
        addFx({ k: 'arc', x: e.x, y: e.y, r: e.rad * 0.9, a: e.ang, w: 0.32, col: 'rgba(90,220,140,A)', life: 0.5 });
        addFx({ k: 'arc', x: e.x, y: e.y, r: e.rad * 0.6, a: e.ang + 0.6, w: 0.22, col: 'rgba(255,230,150,A)', life: 0.45 });
        bigGlyph('斩', e.x, e.y, 1.8, '#e8ffe8', 'rgba(60,220,120,.95)', 0.85);
        shake(true);
        break;
      case 'zhangfei':
        addFx({ k: 'shock', x: e.x, y: e.y, r: e.rad, life: 0.75 });
        bigGlyph('喝', e.x, e.y, 2.0, '#ffe0d0', 'rgba(255,60,30,.95)', 0.9);
        shake(true);
        break;
      case 'zhaoyun':
        addFx({ k: 'travel', x: 0, y: 0, pts: [[e.x, e.y]].concat(e.pts || []).concat([[e.x, e.y]]), g: gl('龙', cell * 1.3, gold, { glow: 'rgba(120,200,255,.95)', font: 'wild' }), trail: 'rgba(170,220,255,.75)', tw: 0.34, glow: 'rgba(90,170,255,.9)', life: 1.0, speed: 1.15 });
        txt('七进七出', e.x, e.y - 0.6, GOLD_L, 0.42, 1.1, glow);
        break;
      case 'machao':
        addFx({ k: 'travel', x: 0, y: 0, pts: [[e.x, e.y], [e.x2, e.y2]], g: gl('冲', cell * 1.2, gold, { glow: glow, font: 'wild' }), trail: 'rgba(255,200,100,.75)', tw: 0.4, glow: 'rgba(255,160,40,.9)', life: 0.6, speed: 1.2 });
        shake(false);
        break;
      case 'huangzhong':
        addFx({ k: 'beam', x: e.x, y: e.y, x2: e.x2, y2: e.y2, life: 0.45 });
        addFx({ k: 'travel', x: 0, y: 0, pts: [[e.x, e.y], [e.x2, e.y2]], g: gl('射', cell * 0.8, gold, { glow: glow, font: 'wild' }), trail: 'rgba(255,214,110,.6)', life: 0.35, speed: 1.3 });
        bigGlyph('穿', e.x2, e.y2, 0.9, gold, glow, 0.6);
        break;
      case 'liubei':
        addFx({ k: 'fly', x: e.x, y: e.y, x2: G.P.end[0] + 0.5, y2: G.P.end[1] + 0.3, g: gl('仁', cell * 0.8, '#d8ffe4', { glow: 'rgba(80,220,140,.95)', font: 'wild' }), life: 1.0 });
        if (e.heal) { baseHeal = 1.4; setTimeout(function () { txt('+1 玉', G.P.end[0] + 0.5, G.P.end[1] - 0.3, '#b8f0c8', 0.42, 1); }, 700); }
        else { txt('+' + e.gold, e.x, e.y - 0.3, GOLD_L, 0.4, 1); flyBun(e.x, e.y); }
        break;
      case 'kongming':
        bigGlyph('风', e.x, e.y, 1.6, '#e0f4ff', 'rgba(140,200,255,.9)', 0.7);
        if (e.pts && e.pts.length) {
          var pts = e.pts;
          pts.forEach(function (pt, i2) {
            setTimeout(function () {
              if (!running) return;
              addFx({ k: 'pop', x: pt[0], y: pt[1], g: gl('火', cell * 0.75, '#ffd27a', { glow: 'rgba(255,80,10,.95)', font: 'wild' }), life: 0.7, from: 0.4, grow: 0.3, rise: 0.4 });
            }, 280 + i2 * 30);
          });
        }
        shake(false);
        break;
      case 'pangtong':
        if (e.pts && e.pts.length) addFx({ k: 'chain', x: 0, y: 0, pts: e.pts, g: gl('连', cell * 0.36, '#c8fff0', { glow: 'rgba(60,200,170,.9)' }), life: 1.2 });
        bigGlyph('连', e.x, e.y, 1.3, '#c8fff0', 'rgba(60,200,170,.95)', 0.8);
        break;
      case 'weiyan':
        addFx({ k: 'crack', x: e.x, y: e.y, r: e.rad, seed: Math.random() * 6, life: 0.7 });
        bigGlyph('破', e.x, e.y, 1.8, '#ffd8c8', 'rgba(255,80,40,.95)', 0.85);
        sfx('crack'); shake(true);
        break;
      case 'jiangwei':
        for (var j = 0; j < 5; j++) {
          var a = j * 1.256, rr = e.rad * 0.6;
          addFx({ k: 'pop', x: e.x2 + Math.cos(a) * rr, y: e.y2 + Math.sin(a) * rr * 0.7, g: gl('伏', cell * 0.6, gold, { glow: glow, font: 'wild' }), life: 0.7, from: 0.3, rise: 0.6 });
        }
        addFx({ k: 'ring', x: e.x2, y: e.y2, r0: 0.2, r1: e.rad, col: GOLD_L, life: 0.5, w: 0.12 });
        shake(false);
        break;
      case 'guanping':
        addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: e.rad, col: GOLD_L, life: 0.6, w: 0.1 });
        bigGlyph('援', e.x, e.y, 1.3, gold, glow, 0.8);
        break;
    }
    if (k !== 'zhaoyun' && k !== 'liubei') txt(gd.skill, e.x, e.y - 0.75, GOLD_L, 0.36, 1.0);
  }
  function bossActFx(e) {
    sfx('bossAct');
    if (e.act === 'summon') bigGlyph('召', e.x, e.y - 0.5, 0.9, '#ffb090', 'rgba(200,30,20,.9)', 0.8);
    else if (e.act === 'swarm') { bigGlyph('骑', e.x, e.y - 0.5, 0.9, '#ffb090', 'rgba(200,30,20,.9)', 0.8); txt('虎豹骑！', e.x, e.y - 0.9, '#ff9a80', 0.4, 1); }
    else if (e.act === 'charge') { bigGlyph('冲', e.x, e.y - 0.4, 1.1, '#ffb090', 'rgba(255,30,20,.95)', 0.7); txt(e.name + ' 冲锋', e.x, e.y - 0.9, '#ff9a80', 0.4, 1); }
    else if (e.act === 'rage') { bigGlyph('怒', e.x, e.y - 0.4, 1.2, '#ffb090', 'rgba(255,30,20,.95)', 0.9); }
    else if (e.act === 'shield') { bigGlyph('守', e.x, e.y - 0.4, 1.1, '#fff0c0', 'rgba(255,200,80,.9)', 0.8); txt('坚守不出', e.x, e.y - 0.95, GOLD_L, 0.4, 1); }
    else if (e.act === 'burn') {
      bigGlyph('火', e.x, e.y - 0.4, 1.3, '#ffd27a', 'rgba(255,60,0,.95)', 0.9);
      addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: e.rad, col: 'rgba(255,90,20,.9)', life: 0.6, w: 0.12 });
      (e.pts || []).forEach(function (pt) { addFx({ k: 'pop', x: pt[0], y: pt[1] - 0.2, g: gl('火', cell * 0.45, '#ffb347', { glow: 'rgba(255,60,0,.9)' }), life: 0.8, from: 0.5, rise: 0.5 }); });
      txt('火烧连营', e.x, e.y - 0.95, '#ffb090', 0.42, 1.1);
    }
  }

  // ---------- 主循环 ----------
  function frame(ms) {
    requestAnimationFrame(frame);
    now = ms;
    var dt = Math.min(0.1, (ms - (last || ms)) / 1000);
    last = ms;
    if (G && running && !paused) {
      acc += dt * speed;
      var n = 0;
      while (acc >= STEP && n < 16) { G.step(STEP); acc -= STEP; n++; }
      if (n >= 16) acc = 0;
      handleEvents(G.drain());
      updateFx(dt * speed);
    }
    if (G && running) {
      render(ms, paused ? 0 : dt);
      renderBench();
      updateHud();
      tutTick();
    }
    if ($('title').classList.contains('show')) titleTick(ms, dt);
  }

  // ---------- 拖拽 ----------
  var ghost = $('ghost'), ghostCv = ghost.querySelector('canvas'), recycleEl = $('recycle');
  function inRect(r, x, y, pad) { pad = pad || 0; return x >= r.left - pad && x < r.right + pad && y >= r.top - pad && y < r.bottom + pad; }
  function locAt(x, y) {
    var r = cv.getBoundingClientRect();
    if (inRect(r, x, y)) return { z: 't', c: Math.min(COLS - 1, Math.floor((x - r.left) / cell)), r: Math.min(ROWS - 1, Math.floor((y - r.top) / cell)) };
    for (var i = 0; i < slots.length; i++) if (inRect(slots[i].getBoundingClientRect(), x, y, 3)) return { z: 'b', i: i };
    if (inRect(recycleEl.getBoundingClientRect(), x, y, 8)) return { z: 'x' };
    return null;
  }
  function sameLoc(a, b) { return a && b && a.z === b.z && a.i === b.i && a.c === b.c && a.r === b.r; }
  function onDown(e) {
    if (!G || !running || paused || gameOver) return;
    if (e.button > 0) return;
    if (e.target.closest && e.target.closest('button, .screen.show, .sheet-wrap.show')) return;
    var loc = locAt(e.clientX, e.clientY);
    if (!loc || loc.z === 'x') return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, from: loc, item: G.getItem(loc), active: false, touch: e.pointerType === 'touch' };
    audio();
    e.preventDefault();
  }
  function computePlans() {
    var plans = {};
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var p = G.plan(drag.from, { z: 't', c: c, r: r }); if (p) plans[c + ',' + r] = p; }
    drag.plans = plans;
    slots.forEach(function (el, i) {
      var p = G.plan(drag.from, { z: 'b', i: i });
      el.classList.remove('hl-ok', 'hl-merge', 'hl-general', 'hl-swap', 'over');
      if (p) el.classList.add(p.act === 'merge' ? 'hl-merge' : p.act === 'general' ? 'hl-general' : p.act === 'swap' ? 'hl-swap' : 'hl-ok');
    });
    var rp = G.plan(drag.from, { z: 'x' });
    recycleEl.classList.toggle('hl-ok', !!(rp && rp.act === 'recycle'));
    recycleEl.classList.toggle('hl-no', !!(rp && rp.act === 'norecycle'));
  }
  function startDrag() {
    drag.active = true; selected = null; hideTip();
    var size = Math.round(cell * 1.25), px = Math.round(size * 1.5);
    ghostCv.width = Math.round(px * dpr); ghostCv.height = Math.round(px * dpr);
    ghostCv.style.width = px + 'px'; ghostCv.style.height = px + 'px';
    var g = ghostCv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, px, px); g.translate(px / 2, px / 2);
    A.drawItem(g, drag.item, size);
    drag.gs = px;
    drag.dockTop = $('dock').getBoundingClientRect().top;
    ghost.classList.add('show');
    computePlans();
    benchSig = '';
    sfx('pick');
  }
  function dragPoint(x, y) {
    // 触屏时字牌浮在手指上方；靠近备战栏时逐渐回到手指下
    if (!drag.touch) return { x: x, y: y };
    var k = Math.max(0, Math.min(1, (drag.dockTop - y) / cell));
    return { x: x, y: y - cell * 0.8 * k };
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (!drag.item) return;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 7) return;
      startDrag();
    }
    var p = dragPoint(e.clientX, e.clientY);
    ghost.style.transform = 'translate(' + (p.x - drag.gs / 2) + 'px,' + (p.y - drag.gs / 2) + 'px)';
    var over = locAt(p.x, p.y);
    if (!sameLoc(over, drag.over)) {
      drag.over = over;
      slots.forEach(function (el, i) { el.classList.toggle('over', !!(over && over.z === 'b' && over.i === i)); });
      recycleEl.classList.toggle('over', !!(over && over.z === 'x') && recycleEl.classList.contains('hl-ok'));
      var rv = over && over.z === 'x' ? G.plan(drag.from, over) : null;
      $('recycleV').textContent = rv && rv.act === 'recycle' ? '+' + rv.value : '';
    }
    e.preventDefault();
  }
  function endDrag() {
    ghost.classList.remove('show');
    slots.forEach(function (el) { el.classList.remove('hl-ok', 'hl-merge', 'hl-general', 'hl-swap', 'over'); });
    recycleEl.classList.remove('hl-ok', 'hl-no', 'over');
    $('recycleV').textContent = '';
    drag = null; benchSig = '';
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.active) {
      var p = dragPoint(e.clientX, e.clientY), to = locAt(p.x, p.y), from = drag.from;
      endDrag();
      if (!to || sameLoc(to, from) || !G || gameOver) return;
      var res = G.apply(from, to);
      if (!res) {
        sfx('error');
        if (to.z === 't') {
          var ce = G.cellAt(to.c, to.r), it = G.getItem(from);
          if (ce.path) showTipAt(to, '道路上不能布阵');
          else if (ce.block) showTipAt(to, '此处无法布阵');
          else if (ce.lock) showTipAt(to, '荒地：拖<b>「铲」</b>来开垦');
          else if (it && it.t === 's') showTipAt(to, '「铲」要拖到<b>荒地</b>上');
        }
      } else if (res.act === 'norecycle') { sfx('error'); showTipEl(recycleEl, '武将不可遣散'); }
      handleEvents(G.drain());
    } else {
      var loc = drag.from; drag = null; onTap(loc);
    }
  }
  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', function (e) { if (drag && e.pointerId === drag.id) endDrag(); });

  // ---------- 点按说明 ----------
  var tipEl = $('tip'), tipTimer = 0;
  function fmt1(v) { return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10); }
  var TIERN = ['铁', '铜', '银', '金', '赤金'];
  function itemInfo(it) {
    if (it.t === 'u') {
      var d = Z.UNITS[it.k], dmg = d.dmg * Z.TIER_MULT[it.lv - 1] * (it.aura || 1);
      var s = '<span class="tn">' + d.name + '</span> · ' + TIERN[it.lv - 1] + '令 ' + it.lv + '级<br>';
      s += d.dmg ? '伤害 <b>' + fmt1(dmg) + '</b> · 射程 ' + d.range + ' · 每 ' + d.cd + ' 秒<br>' : '射程 ' + d.range + '<br>';
      s += d.desc;
      if (it.aura > 1.001) s += '<br>加持 <b>+' + Math.round((it.aura - 1) * 100) + '%</b>';
      if (it.haste > 0) s += '<br>战鼓 攻速 <b>+' + Math.round(it.haste * 100) + '%</b>';
      s += it.lv < 5 ? '<br><span class="tl">相同字牌拖到一起升级</span>' : '<br>已达最高级';
      return s;
    }
    if (it.t === 'g') {
      var g = Z.GENERALS[it.k], mult = G ? G.genMult() * (it.aura || 1) : 1;
      return '<span class="tn">' + g.name + '「' + g.skill + '」</span><br>' + g.desc + '<br>伤害 <b>' + fmt1(g.dmg * mult) + '</b> · 射程 ' + g.range + '<br><span class="tl">武将随波次成长</span>';
    }
    if (it.t === 'c') {
      var partners = [];
      Z.NAME_RECIPES.forEach(function (nr) {
        if (G && G.content.gens.indexOf(nr[2]) < 0) return;
        if (nr[0] === it.ch) partners.push('「<b>' + nr[1] + '</b>」→ ' + Z.GENERALS[nr[2]].name);
        if (nr[1] === it.ch) partners.push('「<b>' + nr[0] + '</b>」→ ' + Z.GENERALS[nr[2]].name);
      });
      return '<span class="tn">名字字牌「' + it.ch + '」</span><br>两个字凑成武将：<br>' + partners.join('<br>');
    }
    if (it.t === 's') return '<span class="tn">铲</span><br>拖到<b>荒地</b>上，开垦一块新阵地';
    return '';
  }
  function placeTip(rect) {
    var ar = $('app').getBoundingClientRect();
    tipEl.classList.add('show');
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = Math.max(8, Math.min(ar.width - tw - 8, rect.left + rect.width / 2 - ar.left - tw / 2));
    var y = rect.top - ar.top - th - 8;
    if (y < 50) y = rect.bottom - ar.top + 8;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3400);
  }
  function showTipEl(el, html) { tipEl.innerHTML = html; placeTip(el.getBoundingClientRect()); }
  function showTipAt(loc, html) {
    var r = cv.getBoundingClientRect();
    tipEl.innerHTML = html;
    placeTip({ left: r.left + loc.c * cell, top: r.top + loc.r * cell, width: cell, height: cell, bottom: r.top + (loc.r + 1) * cell });
  }
  function hideTip() { tipEl.classList.remove('show'); }
  function onTap(loc) {
    var it = G.getItem(loc);
    if (loc.z === 'b') { selected = null; if (it) { showTipEl(slots[loc.i], itemInfo(it)); sfx('click'); } else hideTip(); return; }
    var ce = G.cellAt(loc.c, loc.r);
    if (it) {
      if (selected && sameLoc(selected, loc)) { selected = null; hideTip(); return; }
      selected = (it.t === 'u' || it.t === 'g') ? loc : null;
      showTipAt(loc, itemInfo(it)); sfx('click');
    } else {
      selected = null;
      if (ce.path || ce.block) { hideTip(); return; }
      if (ce.lock) showTipAt(loc, '荒地：拖<b>「铲」</b>到这里开垦');
      else showTipAt(loc, ce.high ? '高地阵位：射程 <b>+0.5</b>' : '阵地：把备战栏的字牌拖到这里布阵');
    }
  }

  // ---------- 新手引导（第一关） ----------
  var tutEl = $('tut'), pieceHintUntil = 0, pieceHintSlot = -1;
  function setTut(n) { if (n > tutStep) { tutStep = n; store.set('tut', n); } }
  function showTut(textS, rect, below) {
    var ar = $('app').getBoundingClientRect();
    $('tutText').textContent = textS;
    tutEl.classList.add('show');
    tutEl.classList.toggle('up', !!below); tutEl.classList.toggle('down', !below);
    var tw = tutEl.offsetWidth, th = tutEl.offsetHeight, cx = rect.left + rect.width / 2 - ar.left;
    var x = Math.max(8, Math.min(ar.width - tw - 8, cx - tw / 2));
    var y = below ? rect.bottom - ar.top + 12 : rect.top - ar.top - th - 12;
    tutEl.style.left = x + 'px'; tutEl.style.top = y + 'px';
    tutEl.style.setProperty('--ax', (cx - x) + 'px');
  }
  function hideTut() { tutEl.classList.remove('show'); }
  function pieceHint(slot) {
    if (store.get('tutPiece', 0)) return;
    // 第一关基础引导未完成时先不打断
    if (G && G.level === 0 && tutStep < 3) return;
    store.set('tutPiece', 1);
    pieceHintSlot = slot; pieceHintUntil = performance.now() + 7000;
  }
  function hidePieceHint() { pieceHintUntil = 0; }
  function tutTick() {
    if (tutStep < 3 && G.wave >= 3) setTut(3);
    if ((drag && drag.active) || gameOver || paused) { hideTut(); return; }
    if (pieceHintUntil > performance.now() && pieceHintSlot >= 0) { showTut('两个字凑成武将，例如 赵 + 云', slots[pieceHintSlot].getBoundingClientRect()); return; }
    if (G.level !== 0) { hideTut(); return; }
    if (tutStep === 0) { showTut('点「征兵」招募兵马', $('btnSummon').getBoundingClientRect()); return; }
    if (tutStep === 1) {
      var bi = -1;
      G.bench.forEach(function (it, i) { if (bi < 0 && it && it.t === 'u') bi = i; });
      if (bi >= 0) showTut('把字牌拖到路边阵地上', slots[bi].getBoundingClientRect());
      else if (G.canSummon()) showTut('点「征兵」招募兵马', $('btnSummon').getBoundingClientRect());
      else hideTut();
      return;
    }
    if (tutStep === 2) {
      var all = [], r = cv.getBoundingClientRect();
      G.bench.forEach(function (it, i) { if (it && it.t === 'u') all.push({ it: it, el: slots[i].getBoundingClientRect() }); });
      G.cells.forEach(function (ce) { if (ce.item && ce.item.t === 'u') all.push({ it: ce.item, el: { left: r.left + ce.c * cell, top: r.top + ce.r * cell, width: cell, height: cell, bottom: r.top + (ce.r + 1) * cell } }); });
      for (var a = 0; a < all.length; a++) for (var b = a + 1; b < all.length; b++) if (Z.mergeable(all[a].it, all[b].it)) { showTut('相同字牌拖到一起升级', all[a].el); return; }
      hideTut(); return;
    }
    hideTut();
  }

  // ---------- 存档 / 结算 ----------
  function saveGame() { if (G && !gameOver) store.set('save', G.serialize()); }
  function fmtTime(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function endGame(win) {
    if (gameOver) return;
    gameOver = true;
    store.del('save');
    hideTut(); hideTip(); selected = null;
    if (drag) endDrag();
    var unlockedNew = null;
    if (win) {
      var c = campaign();
      var prev = c.stars[G.level] || 0;
      c.stars[G.level] = Math.max(prev, G.stars);
      if (G.level + 1 < Z.LEVELS.length && c.unlocked < G.level + 2) { c.unlocked = G.level + 2; unlockedNew = G.level + 1; }
      store.set('campaign', c);
    }
    var show = function () { showResult(win, unlockedNew); };
    if (quick) show(); else setTimeout(show, 1400);
  }
  function showResult(win, unlockedNew) {
    var el = $('result');
    el.classList.toggle('lose', !win);
    $('rTitle').textContent = win ? '大捷' : '兵败';
    $('rSub').textContent = win ? G.L.name + ' · 阿斗无恙' : '阿斗被擒 · 坚守至第' + cnNum(Math.max(1, G.wave)) + '波';
    var st = $('rStars');
    st.innerHTML = '';
    if (win) {
      for (var i = 0; i < 3; i++) {
        var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('class', 'ico' + (i < G.stars ? ' on' : ''));
        s.innerHTML = '<use href="#i-star"/>';
        s.style.animationDelay = (0.35 + i * 0.3) + 's';
        st.appendChild(s);
        if (i < G.stars) (function (k) { setTimeout(function () { sfx('star', k); }, 350 + k * 300); })(i);
      }
    }
    var stats = win
      ? [['阿斗玉心', G.hp + '/10'], ['用时', fmtTime(G.time)], ['武将', G.stats.generals.length]]
      : [['波次', G.wave + '/' + G.L.waves], ['斩敌', G.stats.kills], ['武将', G.stats.generals.length]];
    $('rStats').innerHTML = stats.map(function (s2) { return '<div class="rs"><b>' + s2[1] + '</b><span>' + s2[0] + '</span></div>'; }).join('');
    var un = '';
    if (win && unlockedNew != null) {
      var nl = Z.LEVELS[unlockedNew], gens = (nl.unlock.gens || []).map(function (g) { return Z.GENERALS[g].name; });
      var units = (nl.unlock.units || []).map(function (k) { return Z.UNITS[k].name; });
      un = '解锁 第' + NUMCN[unlockedNew] + '关「' + nl.name + '」' + (gens.length ? ' · 武将 ' + gens.join(' ') : '') + (units.length ? ' · 兵种 ' + units.join(' ') : '');
    } else if (win && G.level === Z.LEVELS.length - 1) un = '星落五丈原 · 战役通关！';
    $('rUnlock').textContent = un;
    $('btnNextLv').classList.toggle('hidden', !win || G.level >= Z.LEVELS.length - 1);
    $('btnRetry').textContent = win ? '再战' : '重试';
    drawResultBg(win);
    el.classList.add('show');
    running = false;
  }
  function drawResultBg(win) {
    var c = $('resultCv'), w = c.clientWidth || 375, h = c.clientHeight || 667, d = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * d; c.height = h * d;
    var x = c.getContext('2d');
    x.scale(d, d);
    A.drawTitleScene(x, w, h, win ? 11 : 5);
    x.fillStyle = win ? 'rgba(20,10,4,.45)' : 'rgba(10,8,8,.7)'; x.fillRect(0, 0, w, h);
    if (!win) { x.fillStyle = 'rgba(80,0,0,.25)'; x.fillRect(0, 0, w, h); }
  }

  // ---------- 标题页 ----------
  var titleBg = null, titleEmbers = [];
  function sizeTitle() {
    var c = $('titleCv'), w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    var d = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * d; c.height = h * d;
    titleBg = A.canvas(w * d, h * d);
    var x = titleBg.getContext('2d'); x.scale(d, d);
    A.drawTitleScene(x, w, h, 3, true);
    titleEmbers = [];
    for (var i = 0; i < 40; i++) titleEmbers.push({ x: Math.random() * w, y: Math.random() * h, vy: -15 - Math.random() * 30, vx: (Math.random() - 0.5) * 10, s: Math.random() });
  }
  function titleTick(ms, dt) {
    var c = $('titleCv');
    if (!titleBg || titleBg.width !== c.width) sizeTitle();
    if (!titleBg) return;
    var x = c.getContext('2d'), d = c.width / (c.clientWidth || 1), w = c.clientWidth, h = c.clientHeight;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(titleBg, 0, 0);
    x.setTransform(d, 0, 0, d, 0, 0);
    titleEmbers.forEach(function (p) {
      p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(ms / 400 + p.s * 10) * 0.2;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      var fl = 0.5 + 0.5 * Math.sin(ms / 80 + p.s * 30);
      x.fillStyle = 'rgba(255,' + (130 + fl * 70 | 0) + ',50,' + (0.4 + fl * 0.5) + ')';
      x.fillRect(p.x, p.y, 2, 2);
    });
  }
  function titleProgress() {
    var c = campaign(), stars = 0, cleared = 0;
    c.stars.forEach(function (s) { stars += s || 0; if (s) cleared++; });
    $('titleProgress').textContent = cleared ? '已克 ' + cleared + '/10 关 · 战功 ' + stars + '/30 ★' : '';
  }

  // ---------- 战役地图 ----------
  var thumbs = {};
  function thumb(li) {
    if (thumbs[li]) return thumbs[li];
    var S = 10, c = A.canvas(70 * 2, 100 * 2), x = c.getContext('2d');
    x.scale(2, 2);
    var cells = [], P = Z.PATHS[li], L = Z.LEVELS[li];
    var blocked = {};
    (L.blocked || []).forEach(function (b) { blocked[b[0] + ',' + b[1]] = 1; });
    for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) cells.push({ c: cc, r: r, path: !!P.set[cc + ',' + r], block: !!blocked[cc + ',' + r], lock: true });
    A.drawTerrain(x, li, cells, S, { thumb: true });
    var e = P.end;
    x.fillStyle = '#b01c1c'; x.fillRect((e[0] + 0.3) * S, (e[1] + 0.2) * S, S * 0.4, S * 0.6);
    thumbs[li] = c;
    return c;
  }
  function openMap() {
    $('title').classList.remove('show');
    $('result').classList.remove('show');
    closeSheets();
    running = false; paused = false;
    var c = campaign(), list = $('mapList'), total = 0;
    list.innerHTML = '';
    Z.LEVELS.forEach(function (L, li) {
      var locked = li >= c.unlocked, stars = c.stars[li] || 0;
      total += stars;
      var b = document.createElement('button');
      b.className = 'lv-card' + (locked ? ' locked' : '') + (!locked && !stars ? ' next' : '');
      b.setAttribute('data-lv', li);
      var t = thumb(li), tc = document.createElement('canvas');
      tc.width = t.width; tc.height = t.height; tc.getContext('2d').drawImage(t, 0, 0);
      b.appendChild(tc);
      var info = document.createElement('div');
      info.className = 'lv-info';
      var starHtml = '';
      for (var i = 0; i < 3; i++) starHtml += '<svg class="ico' + (i < stars ? ' on' : '') + '"><use href="#i-star"/></svg>';
      info.innerHTML = '<span class="lv-no">第' + NUMCN[li] + '关 · ' + Z.FACTIONS[L.faction].name + '</span><span class="lv-name">' + L.name + '</span><span class="lv-era">' + L.era + '</span><span class="lv-stars">' + starHtml + '</span>';
      b.appendChild(info);
      var seal = document.createElement('span');
      seal.className = 'lv-seal';
      seal.textContent = locked ? '未' : stars ? '克' : '战';
      b.appendChild(seal);
      b.addEventListener('click', function () {
        audio(); sfx('click');
        if (locked) { showTipEl(b, '先攻克前一关'); return; }
        openIntro(li);
      });
      list.appendChild(b);
    });
    $('mapStars').textContent = total;
    $('map').classList.add('show');
    var nextCard = list.querySelector('.lv-card.next');
    if (nextCard) setTimeout(function () { nextCard.scrollIntoView({ block: 'center' }); }, 30);
  }
  var introLevel = 0;
  function openIntro(li) {
    introLevel = li;
    var L = Z.LEVELS[li];
    $('inKicker').textContent = '第' + NUMCN[li] + '关 · ' + L.era;
    $('inTitle').textContent = L.name;
    $('inBlurb').textContent = L.blurb;
    var rows = [['敌军', Z.FACTIONS[L.faction].name + ' · 主帅 ' + L.boss.name + (L.mid ? '，先锋 ' + L.mid.name : '')], ['战况', L.twist], ['兵力', L.waves + ' 波 · 初始馒头 ' + L.start]];
    $('inRows').innerHTML = rows.map(function (r) { return '<div class="in-row"><i>' + r[0] + '</i><span>' + r[1] + '</span></div>'; }).join('');
    var nw = $('inNew');
    nw.innerHTML = '';
    var u = L.unlock, items = [];
    (u.units || []).forEach(function (k) { items.push({ t: 'u', k: k, lv: 1 }); });
    (u.gens || []).forEach(function (g) { items.push({ t: 'g', k: g }); });
    if (items.length) {
      var lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = li === 0 ? '可用' : '新增'; nw.appendChild(lbl);
      items.forEach(function (it) { nw.appendChild(itemCanvas(it, 48)); });
    }
    var sv = store.get('save', null);
    var cont = $('btnContinue');
    if (sv && sv.level === li && sv.wave > 0) { cont.classList.remove('hidden'); cont.textContent = '继续 · 第' + cnNum(sv.wave + 1) + '波'; }
    else cont.classList.add('hidden');
    $('intro').classList.add('show');
  }
  function itemCanvas(it, size, gray) {
    var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * d);
    c.style.width = c.style.height = size + 'px';
    var x = c.getContext('2d');
    x.scale(d, d); x.translate(size / 2, size / 2);
    if (gray) x.filter = 'grayscale(1) brightness(.45)';
    if (it.t === 'e') A.drawEnemy(x, it, size, it.fac);
    else A.drawItem(x, it, size * 0.95);
    return c;
  }

  // ---------- 图鉴 ----------
  var codexTab = 'units';
  function buildCodex() {
    var cx = codex(), body = $('codexBody'), html = [];
    body.innerHTML = '';
    document.querySelectorAll('#codexTabs .tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === codexTab); });
    function card(canvasEl, inner, locked) {
      var d = document.createElement('div'); d.className = 'card' + (locked ? ' locked' : '');
      d.appendChild(canvasEl);
      var i = document.createElement('div'); i.innerHTML = inner; d.appendChild(i);
      body.appendChild(d);
    }
    var note = document.createElement('p'); note.className = 'cx-note';
    if (codexTab === 'units') {
      note.textContent = '征兵直接获得兵种字牌。相同字牌拖到一起升级：铁 → 铜 → 银 → 金 → 赤金，伤害 ×1 / 2.2 / 4.8 / 10 / 22。';
      body.appendChild(note);
      Z.KINDS.forEach(function (k) {
        var d = Z.UNITS[k], known = cx.u[k];
        var lv = 0; Z.LEVELS.some(function (L, li) { if ((L.unlock.units || []).indexOf(k) >= 0) { lv = li; return true; } return false; });
        card(itemCanvas({ t: 'u', k: k, lv: 3 }, 54, !known),
          known ? '<div class="ct">' + d.name + '<em>「' + d.glyph + '」</em></div><div class="cr">' + d.desc + '<br>' + (d.dmg ? '伤害 <b>' + d.dmg + '</b> · ' : '') + '射程 <b>' + d.range + '</b> · 每 ' + d.cd + ' 秒</div>'
            : '<div class="ct">？？</div><div class="cr">第' + NUMCN[lv] + '关解锁后，布阵即可收录</div>', !known);
      });
    } else if (codexTab === 'gens') {
      note.textContent = '每位武将都是两个字：把一个名字字牌拖到另一半上，例如 赵 + 云 → 赵云。'; body.appendChild(note);
      Z.GEN_KEYS.forEach(function (k) {
        var g = Z.GENERALS[k], known = cx.g[k];
        var rec = '<div class="recipe"><i>' + g.chars[0] + '</i>+<i>' + g.chars[1] + '</i>→ ' + (known ? g.name : '？') + '</div>';
        card(itemCanvas({ t: 'g', k: k }, 54, !known),
          known ? '<div class="ct">' + g.name + '<em>' + g.skill + '</em></div><div class="cr">' + g.desc + '</div>' + rec
            : '<div class="ct">？？</div><div class="cr">尚未招募</div>' + rec, !known);
      });
    } else if (codexTab === 'syn') {
      note.textContent = '羁绊：特定武将同时在阵上即可激活，顶部会显示已激活的羁绊。'; body.appendChild(note);
      Z.SYN_KEYS.forEach(function (k) {
        var s = Z.SYNERGIES[k], known = cx.s[k];
        var c = document.createElement('canvas'); c.width = c.height = 108; c.style.width = c.style.height = '54px';
        var x = c.getContext('2d'); x.scale(2, 2);
        x.fillStyle = known ? '#7a1010' : '#2a2018'; A.rrect(x, 6, 4, 42, 46, 3); x.fill();
        x.strokeStyle = known ? GOLD : '#5a4a38'; x.lineWidth = 1.5; x.stroke();
        A.drawGlyph(x, A.glyph(s.name[0], 26, known ? GOLD_L : '#6f6458'), 27, 26);
        var gens = s.gens.map(function (g) { return '<span class="' + (cx.g[g] ? 'on' : '') + '">' + Z.GENERALS[g].name + '</span>'; }).join('');
        card(c, '<div class="ct">' + s.name + '</div><div class="cr">' + s.desc + '</div><div class="syn-gens">' + gens + '</div>', !known);
      });
    } else {
      note.textContent = '敌军以军旗示人，旗上之字即兵种。'; body.appendChild(note);
      [['zu', '卒', '步卒', '最常见的步兵'], ['qi', '骑', '骑兵', '血少，跑得飞快'], ['dun', '盾', '盾卒', '弓矢伤害 −40%'], ['nu', '弩', '弩手', '中等血量'], ['jia', '甲', '重甲', '刀枪伤害 −30%，行动迟缓'],
        ['teng', '藤', '藤甲兵', '刀枪弓矢 −50%，却怕火（火伤 ×2.5）'], ['xiang', '象', '象兵', '皮糙肉厚，冲到阿斗扣 2 心'], ['chuan', '船', '战船', '赤壁顺江而下，怕火']].forEach(function (f) {
        var en = { t: 'e', type: f[0], ch: f[1], r: Z.ENEMIES[f[0]].r, fac: f[0] === 'teng' || f[0] === 'xiang' ? 'man' : 'wei' };
        card(itemCanvas(en, 54), '<div class="ct">' + f[2] + '</div><div class="cr">' + f[3] + '</div>');
      });
      var bosses = [];
      Z.LEVELS.forEach(function (L) { if (L.mid) bosses.push([L.mid.name, L.faction]); bosses.push([L.boss.name, L.faction]); });
      bosses.forEach(function (b) {
        var known = cx.e['boss:' + b[0]];
        card(itemCanvas({ t: 'e', type: 'zu', ch: '', r: 0.44, boss: true, name: b[0], fac: b[1] }, 54, !known),
          '<div class="ct">' + (known ? b[0] : '？？') + '</div><div class="cr">' + (known ? Z.FACTIONS[b[1]].name + '敌将' : '尚未交锋') + '</div>', !known);
      });
    }
  }

  // ---------- 流程 ----------
  function closeSheets() { ['intro', 'sheetCodex', 'sheetPause'].forEach(function (id) { $(id).classList.remove('show'); }); }
  function clearOverlays() {
    var bn = $('banner'); bn.className = 'banner';
    clearTimeout(bannerTimer); bannerBusy = false; bannerQ = [];
    $('skillBanner').innerHTML = '';
    $('flyLayer').innerHTML = ''; flying = 0;
    hideTip(); hideTut(); hidePieceHint();
  }
  function showTitle() {
    running = false; paused = false;
    clearOverlays(); closeSheets();
    $('map').classList.remove('show'); $('result').classList.remove('show');
    $('title').classList.add('show');
    titleProgress(); sizeTitle();
  }
  function newGame(level, save, opts) {
    opts = opts || {};
    var tutOn = level === 0 && tutStep < 2 && !save && !opts.noTut;
    if (!save) store.del('save');
    G = Z.createGame({ level: level, save: save || null, holdTimer: tutOn, seed: opts.seed });
    running = true; paused = false; gameOver = false; acc = 0;
    fx = []; anims = {}; selected = null; drag = null; baseHurt = 0; baseHeal = 0; evCount = {}; hud = {};
    clearOverlays(); closeSheets();
    $('title').classList.remove('show'); $('map').classList.remove('show'); $('result').classList.remove('show');
    $('lvLabel').textContent = '第' + NUMCN[level] + '关 · ' + G.L.name;
    layout();
    G.updateAura(); G.drain();
    if (save) banner('第' + cnNum(G.wave + 1) + '波', '继续坚守 · ' + G.L.name);
    else banner(G.L.name, G.L.era);
  }
  function pauseGame() {
    if (!G || !running || gameOver || paused) return;
    paused = true;
    if (drag) endDrag();
    $('pauseInfo').textContent = '第' + NUMCN[G.level] + '关 ' + G.L.name + ' · 第 ' + Math.max(1, G.wave) + '/' + G.L.waves + ' 波 · 玉心 ' + G.hp;
    $('sheetPause').classList.add('show');
  }
  function resumeGame() { $('sheetPause').classList.remove('show'); paused = false; last = performance.now(); }
  var codexPaused = false;
  function openCodex() {
    buildCodex();
    if (G && running && !paused && !gameOver) { paused = true; codexPaused = true; } else codexPaused = false;
    $('sheetCodex').classList.add('show');
  }
  function closeCodex() { $('sheetCodex').classList.remove('show'); if (codexPaused) { codexPaused = false; paused = false; last = performance.now(); } }

  function bind(id, fn) { $(id).addEventListener('click', function (e) { audio(); fn(e); }); }
  bind('btnStart', function () { sfx('click'); openMap(); });
  bind('btnTitleCodex', function () { sfx('click'); openCodex(); });
  bind('btnTitleSound', function () { soundOn = !soundOn; store.set('sound', soundOn); syncSound(); sfx('click'); });
  bind('btnMapBack', function () { sfx('click'); showTitle(); });
  bind('btnGo', function () { sfx('click'); newGame(introLevel); });
  bind('btnContinue', function () { var sv = store.get('save', null); sfx('click'); if (sv && sv.level === introLevel) newGame(introLevel, sv); });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { var w = b.closest('.sheet-wrap'); if (w.id === 'sheetCodex') closeCodex(); else w.classList.remove('show'); });
  });
  document.querySelectorAll('.sheet-wrap').forEach(function (w) {
    w.addEventListener('click', function (e) {
      if (e.target !== w) return;
      if (w.id === 'sheetCodex') closeCodex(); else if (w.id === 'sheetPause') resumeGame(); else w.classList.remove('show');
    });
  });
  document.querySelectorAll('#codexTabs .tab').forEach(function (t) { t.addEventListener('click', function () { codexTab = t.getAttribute('data-tab'); sfx('click'); buildCodex(); }); });
  bind('btnSummon', function () {
    if (!G || !running || paused || gameOver) return;
    if (!G.summon()) { sfx('error'); showTipEl($('btnSummon'), G.benchFree() < 0 ? '备战栏满了：先布阵、合并或回收' : '馒头不够：斩敌可得馒头'); }
    handleEvents(G.drain());
  });
  bind('btnNext', function () { if (G && running && !paused) { sfx('click'); G.holdTimer = false; G.callNext(); handleEvents(G.drain()); } });
  bind('btnPause', function () { sfx('click'); pauseGame(); });
  bind('btnResume', function () { sfx('click'); resumeGame(); });
  bind('btnPauseCodex', function () { sfx('click'); buildCodex(); codexPaused = false; $('sheetCodex').classList.add('show'); });
  bind('btnRestart', function () { sfx('click'); if (G) newGame(G.level); });
  bind('btnToMap', function () { sfx('click'); if (G && G.phase === 'break' && !gameOver) saveGame(); openMap(); });
  bind('btnNextLv', function () { sfx('click'); if (G && G.level + 1 < Z.LEVELS.length) openIntroFromResult(G.level + 1); });
  bind('btnRetry', function () { sfx('click'); if (G) newGame(G.level); });
  bind('btnResMap', function () { sfx('click'); openMap(); });
  bind('btnCodex', function () { sfx('click'); openCodex(); });
  bind('btnSpeed', function () { speed = speed === 1 ? 2 : 1; store.set('speed', speed); sfx('click'); });
  bind('btnSound', function () { soundOn = !soundOn; store.set('sound', soundOn); syncSound(); sfx('click'); });
  function openIntroFromResult(li) { $('result').classList.remove('show'); openMap(); openIntro(li); }
  // 「下一波」按钮内文字
  $('btnNext').querySelector('.nx-t').id = 'nxT';

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (G && running && !paused && !gameOver) pauseGame(); if (G && G.phase === 'break' && !gameOver) saveGame(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!G || !running) return;
    if (e.key === 'Escape' || e.key === 'p') { if (paused) resumeGame(); else pauseGame(); }
    if (e.key === ' ' && !paused) { e.preventDefault(); $('btnSummon').click(); }
  });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest('#app')) e.preventDefault(); });

  // ---------- 测试钩子 ----------
  function bare(it) { return it ? { t: it.t, k: it.k, lv: it.lv, ch: it.ch } : null; }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  window.__zy = {
    get G() { return G; },
    Z: Z, A: A,
    state: function () {
      if (!G) return null;
      return {
        level: G.level, phase: G.phase, wave: G.wave, waves: G.L.waves, hp: G.hp, mantou: G.mantou, cost: G.cost(), timer: G.timer, enemies: G.enemies.length, projs: G.projs.length,
        bench: G.bench.map(bare), board: G.cells.filter(function (c) { return c.item; }).map(function (c) { return { c: c.c, r: c.r, it: bare(c.item) }; }),
        unlocked: G.cells.filter(function (c) { return !c.path && !c.block && !c.lock; }).length, paused: paused, running: running, speed: speed,
        gameOver: gameOver, stats: G.stats, stars: G.stars, syn: G.syn, cell: cell, fx: fx.length, holdTimer: G.holdTimer
      };
    },
    give: function (it, loc) {
      if (!loc) { var i = G.benchFree(); if (i < 0) return false; G.bench[i] = it; }
      else if (loc.z === 'b') G.bench[loc.i] = it;
      else { var ce = G.cellAt(loc.c, loc.r); if (!ce || ce.path || ce.block) return false; ce.lock = false; ce.item = it; it.cdLeft = 0; }
      G.auraDirty = true; benchSig = '';
      return true;
    },
    // 按覆盖道路长度排序的可布阵格子（测试用）
    buildTiles: function () {
      var out = G.cells.filter(function (c) { return !c.path && !c.block; }).map(function (c) { return { c: c.c, r: c.r, s: Z.coverage(G.P, c.c, c.r, 1.8) }; });
      out.sort(function (a, b) { return b.s - a.s; });
      return out;
    },
    openTiles: function () { return G.cells.filter(function (c) { return !c.path && !c.block && !c.lock && !c.item; }).map(function (c) { return { c: c.c, r: c.r }; }); },
    lockedTiles: function () { return G.cells.filter(function (c) { return !c.path && !c.block && c.lock; }).map(function (c) { return { c: c.c, r: c.r }; }); },
    pathCells: function () { return G.P.cells.slice(); },
    campaign: function () { return campaign(); },
    clearBoard: function () { G.cells.forEach(function (c) { c.item = null; }); G.bench = [null, null, null, null, null]; G.auraDirty = true; benchSig = ''; },
    set: function (o) { for (var k in o) G[k] = o[k]; },
    setWave: function (n) { G.wave = n - 1; G.phase = 'break'; G.timer = 0.3; G.queue = []; G.enemies = []; G.holdTimer = false; },
    ff: function (sec, opt) {
      opt = opt || {};
      quick = !opt.visual;
      var n = Math.round(sec / STEP);
      for (var i = 0; i < n; i++) {
        G.step(STEP);
        if (i % 20 === 0) { handleEvents(G.drain()); if (opt.visual) updateFx(STEP * 20); }
        if (G.phase === 'won' || G.phase === 'lost') break;
      }
      handleEvents(G.drain());
      quick = false;
      return this.state();
    },
    events: function () { return evCount; },
    resetEvents: function () { evCount = {}; },
    tile: function (c, r) { var b = cv.getBoundingClientRect(); return { x: b.left + (c + 0.5) * cell, y: b.top + (r + 0.5) * cell }; },
    slot: function (i) { return center(slots[i].getBoundingClientRect()); },
    recycle: function () { return center(recycleEl.getBoundingClientRect()); },
    summonBtn: function () { return center($('btnSummon').getBoundingClientRect()); },
    newGame: function (level, opts) { newGame(level || 0, null, opts || {}); return this.state(); },
    openMap: openMap, openIntro: openIntro, openCodex: openCodex, showTitle: showTitle,
    pause: pauseGame, resume: resumeGame,
    isPaused: function () { return paused; },
    setSpeed: function (s) { speed = s; },
    sounds: Object.keys(SFX),
    renderSound: function (name, arg) {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var off = new OAC(1, 44100 * 2, 44100);
      var pc = actx, pb = bus, pn = noiseBuf;
      actx = off; bus = buildChain(off); noiseBuf = null;
      try { SFX[name](arg); } finally { actx = pc; bus = pb; noiseBuf = pn; }
      return off.startRendering().then(function (buf) {
        var d = buf.getChannelData(0), peak = 0, sum = 0, n = 0;
        for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 0.001) { sum += d[i] * d[i]; n++; } }
        return { peak: peak, rms: n ? Math.sqrt(sum / n) : 0, ms: Math.round(n / 44.1) };
      });
    },
    fontsOk: function () {
      if (!document.fonts || !document.fonts.check) return null;
      return { brush: document.fonts.check('20px "ZY Brush"', '赵'), wild: document.fonts.check('20px "ZY Wild"', '征'), serif: document.fonts.check('900 20px "ZY Serif"', '9') };
    }
  };

  // ---------- 启动：等字体就绪再画 ----------
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var ps = [document.fonts.load('40px "ZY Brush"', '赵云'), document.fonts.load('40px "ZY Wild"', '出征'), document.fonts.load('900 20px "ZY Serif"', '0123')];
    return Promise.race([Promise.all(ps), new Promise(function (r) { setTimeout(r, 2500); })]);
  }
  syncSound();
  fontsReady().then(function () {
    A.clearGlyphs(); sprites = {}; thumbs = {};
    document.body.classList.add('ready');
    showTitle();
    window.__zyReady = true;
  });
  requestAnimationFrame(frame);
})();
