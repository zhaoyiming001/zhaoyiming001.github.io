/* 赵云与阿斗 · 画面、操作与界面 */
(function () {
  'use strict';
  var Z = window.ZYCore;
  var CFG = Z.CFG;
  var STEP = 1 / 60;
  var COLS = Z.COLS, ROWS = Z.ROWS;
  var FONT_CAL = '"Ma Shan Zheng","ZCOOL XiaoWei","STKaiti","KaiTi","Kaiti SC","AR PL UKai CN","Noto Serif SC","WenQuanYi Zen Hei",serif';
  var FONT_UI = 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans SC","WenQuanYi Zen Hei",sans-serif';
  var TIER_COL = ['#f4efe4', '#7cc36b', '#5aa7e0', '#a477d6', '#f29a3a'];
  var INK = '#2b2420', RED = '#c8322d', GOLD = '#d9a441', GOLD_L = '#f3d27a', PAPER = '#fbf5e6';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 本地存储（全部 try/catch） ----------
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('zyad.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('zyad.' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
    del: function (k) { try { localStorage.removeItem('zyad.' + k); } catch (e) { /* 忽略 */ } }
  };

  // ---------- 音效（Web Audio 合成） ----------
  // 链路：音色 → 高通 140Hz → 压缩 → 增益 → tanh 软限幅；音色集中在 500Hz~3kHz，手机外放清楚
  var soundOn = store.get('sound', true) !== false;
  var actx = null, bus = null, noiseBuf = null;
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
  function drumHit(at, big) {
    osc({ type: 'sine', f: big ? 260 : 320, f2: big ? 90 : 120, d: big ? 0.38 : 0.22, v: 0.95, at: at });
    osc({ type: 'triangle', f: 640, f2: 300, d: 0.06, v: 0.4, at: at });
    noise({ ft: 'lowpass', f: big ? 1400 : 1900, f2: 250, d: big ? 0.3 : 0.16, v: 0.7, at: at });
  }
  var SFX = {
    click: function () { osc({ type: 'triangle', f: 1100, f2: 1500, d: 0.05, v: 0.5 }); noise({ f: 4200, q: 2, d: 0.02, v: 0.25 }); },
    pick: function () { osc({ type: 'sine', f: 880, f2: 1320, d: 0.05, v: 0.35 }); },
    summon: function () {
      drumHit(0);
      osc({ type: 'triangle', f: 1568, d: 0.28, v: 0.32, at: 0.08 });
      osc({ type: 'square', f: 1568, d: 0.08, v: 0.06, at: 0.08 });
      osc({ type: 'sine', f: 2093, d: 0.34, v: 0.24, at: 0.13 });
    },
    place: function () {
      osc({ type: 'triangle', f: 860, f2: 430, d: 0.075, v: 0.7 });
      osc({ type: 'sine', f: 1720, f2: 900, d: 0.035, v: 0.35 });
      noise({ f: 2600, q: 2.2, d: 0.035, v: 0.5 });
    },
    merge: function (lv) {
      var f = 480 * Math.pow(1.26, (lv || 2) - 2);
      osc({ type: 'square', f: f, f2: f * 1.9, d: 0.1, v: 0.3 });
      osc({ type: 'triangle', f: f * 2, f2: f * 3, d: 0.09, v: 0.45 });
      noise({ f: 3000, q: 1.5, d: 0.025, v: 0.25 });
      osc({ type: 'sine', f: f * 3, d: 0.18, v: 0.22, at: 0.07 });
      if (lv >= 4) { note(f * 2, 0.12, 0.14, 0.3); note(f * 2.5, 0.2, 0.22, 0.3); }
    },
    general: function () {
      // 锣 + 号角
      [520, 770, 1105, 1390].forEach(function (f, i) { osc({ type: 'sine', f: f, f2: f * 0.985, d: 1.3 - i * 0.2, v: 0.36 - i * 0.06, a: 0.006 }); });
      noise({ f: 1800, f2: 700, q: 0.8, d: 0.35, v: 0.45 });
      [784, 988, 1175, 1568].forEach(function (f, i) { note(f, 0.18 + i * 0.11, i === 3 ? 0.5 : 0.16, 0.36, 0.35); });
    },
    sword: function () { noise({ f: 2800, f2: 1300, q: 1.3, d: 0.06, v: 0.3 }); osc({ type: 'triangle', f: 1500, f2: 950, d: 0.04, v: 0.1 }); },
    spear: function () { noise({ f: 1200, f2: 3200, q: 1.6, d: 0.07, v: 0.28 }); osc({ type: 'triangle', f: 760, f2: 1050, d: 0.05, v: 0.1 }); },
    hoof: function () { osc({ type: 'sine', f: 560, f2: 280, d: 0.06, v: 0.3 }); noise({ ft: 'lowpass', f: 1600, d: 0.05, v: 0.28 }); },
    arrow: function () { osc({ type: 'triangle', f: 1900, f2: 1100, d: 0.05, v: 0.15 }); noise({ f: 3600, q: 3, d: 0.03, v: 0.12 }); },
    puff: function () { noise({ f: 1400, f2: 600, q: 0.9, d: 0.09, v: 0.3 }); osc({ type: 'sine', f: 950, f2: 520, d: 0.06, v: 0.12 }); },
    bossdown: function () {
      noise({ ft: 'lowpass', f: 4200, f2: 300, d: 0.7, v: 0.9 });
      osc({ type: 'sawtooth', f: 440, f2: 140, d: 0.6, v: 0.4 });
      note(1047, 0.25, 0.14, 0.35); note(1319, 0.35, 0.14, 0.35); note(1568, 0.45, 0.3, 0.38);
    },
    hurt: function () {
      osc({ type: 'triangle', f: 1180, f2: 860, d: 0.22, v: 0.55 }); osc({ type: 'square', f: 1180, f2: 860, d: 0.18, v: 0.08 });
      osc({ type: 'triangle', f: 1260, f2: 800, d: 0.32, v: 0.55, at: 0.24 }); osc({ type: 'square', f: 1260, f2: 800, d: 0.26, v: 0.08, at: 0.24 });
      noise({ ft: 'lowpass', f: 1200, f2: 300, d: 0.12, v: 0.5 });
    },
    drum: function () { drumHit(0); drumHit(0.2); drumHit(0.4); drumHit(0.62, true); },
    boss: function () {
      drumHit(0, true); drumHit(0.32, true); drumHit(0.64, true);
      osc({ type: 'sawtooth', f: 233, d: 0.9, v: 0.32, at: 0.1, hold: 0.4 });
      osc({ type: 'sawtooth', f: 466, f2: 440, d: 0.9, v: 0.18, at: 0.1, hold: 0.4 });
    },
    dig: function () {
      noise({ ft: 'lowpass', f: 2200, f2: 500, d: 0.16, v: 0.7 });
      osc({ type: 'triangle', f: 640, f2: 320, d: 0.08, v: 0.4 });
      noise({ f: 900, q: 1, d: 0.14, v: 0.45, at: 0.11 });
    },
    recycle: function () { note(1319, 0, 0.08, 0.35); note(1760, 0.07, 0.14, 0.35); },
    clear: function () { note(1047, 0, 0.12, 0.38); note(1319, 0.07, 0.12, 0.38); note(1568, 0.14, 0.22, 0.42); },
    early: function () { note(1568, 0, 0.08, 0.3); note(2093, 0.06, 0.12, 0.3); },
    error: function () { osc({ type: 'sawtooth', f: 330, f2: 300, d: 0.09, v: 0.3 }); osc({ type: 'sawtooth', f: 250, f2: 220, d: 0.14, v: 0.3, at: 0.1 }); },
    skill: function (k) {
      noise({ f: 600, f2: 3000, q: 1, d: 0.25, v: 0.5 });
      if (k === 'zhaoyun') [988, 1175, 1397, 1760].forEach(function (f, i) { note(f, 0.04 + i * 0.05, 0.1, 0.32); });
      else if (k === 'zhangfei') { osc({ type: 'sawtooth', f: 330, f2: 220, d: 0.5, v: 0.45 }); osc({ type: 'square', f: 660, f2: 440, d: 0.45, v: 0.15 }); drumHit(0, true); }
      else if (k === 'guanyu') { noise({ f: 900, f2: 2600, q: 0.8, d: 0.35, v: 0.6 }); osc({ type: 'triangle', f: 1800, f2: 1200, d: 0.3, v: 0.25, at: 0.1 }); }
      else if (k === 'huangzhong') { osc({ type: 'triangle', f: 2200, f2: 900, d: 0.12, v: 0.4 }); osc({ type: 'sine', f: 2637, d: 0.3, v: 0.25, at: 0.12 }); }
      else { [1047, 1319, 1568].forEach(function (f) { osc({ type: 'sine', f: f, d: 0.6, v: 0.25, a: 0.02 }); }); }
    },
    win: function () {
      [784, 1047, 1319, 1568].forEach(function (f, i) { note(f, i * 0.11, 0.17, 0.42, 0.4); });
      [1047, 1319, 1568, 2093].forEach(function (f) {
        osc({ type: 'triangle', f: f, d: 0.75, v: 0.24, at: 0.46, hold: 0.25 });
        osc({ type: 'square', f: f, d: 0.6, v: 0.06, at: 0.46 });
      });
    },
    lose: function () {
      note(659, 0, 0.2, 0.42, 0.3); note(587, 0.2, 0.2, 0.42, 0.3); note(523, 0.4, 0.2, 0.42, 0.3);
      osc({ type: 'triangle', f: 466, f2: 349, d: 0.6, v: 0.45, at: 0.6, hold: 0.15 });
      osc({ type: 'square', f: 466, f2: 349, d: 0.5, v: 0.12, at: 0.6 });
    }
  };
  // 高频音效限流，避免一大群敌人时刷屏
  var RATE = { sword: 0.09, spear: 0.09, hoof: 0.1, arrow: 0.08, puff: 0.07, hurt: 0.25 };
  var lastSfx = {};
  function sfx(name, arg) {
    if (!soundOn || quick) return;
    var now = performance.now() / 1000;
    if (RATE[name] && now - (lastSfx[name] || 0) < RATE[name]) return;
    lastSfx[name] = now;
    if (!audio()) return;
    try { SFX[name](arg); } catch (e) { /* 忽略 */ }
  }

  // ---------- 绘制：字牌与令牌 ----------
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function text(c, s, x, y, size, color, font, weight) {
    c.font = (weight || '') + ' ' + Math.round(size) + 'px ' + (font || FONT_CAL);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  function shadowEllipse(c, y, rx, ry) {
    c.fillStyle = 'rgba(43,36,32,.24)';
    c.beginPath(); c.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  function drawUnit(c, k, lv, S) {
    var R = S * 0.4, col = TIER_COL[lv - 1];
    shadowEllipse(c, R * 0.92, R * 0.85, R * 0.24);
    if (lv >= 4) {
      c.strokeStyle = lv === 5 ? 'rgba(242,154,58,.6)' : 'rgba(164,119,214,.55)';
      c.lineWidth = R * 0.14; circ(c, 0, 0, R * 1.1); c.stroke();
    }
    var g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, shade(col, 0.5)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, -0.2));
    c.fillStyle = g; circ(c, 0, 0, R); c.fill();
    c.lineWidth = R * 0.14; c.strokeStyle = INK; circ(c, 0, 0, R * 0.93); c.stroke();
    c.lineWidth = Math.max(1, R * 0.045); c.strokeStyle = 'rgba(43,36,32,.42)'; circ(c, 0, 0, R * 0.72); c.stroke();
    text(c, Z.UNITS[k].ch, 0, R * 0.04, R * 1.05, INK);
    for (var i = 0; i < lv; i++) {
      var a = Math.PI / 2 + (i - (lv - 1) / 2) * 0.36;
      c.beginPath(); c.arc(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93, R * 0.115, 0, 7);
      c.fillStyle = lv === 5 ? '#fff1b8' : GOLD_L; c.fill();
      c.lineWidth = Math.max(1, R * 0.045); c.strokeStyle = INK; c.stroke();
    }
  }
  function drawGeneral(c, k, S) {
    var R = S * 0.42, def = Z.GENERALS[k];
    // 红穗
    c.save();
    c.translate(R * 0.66, R * 0.66); c.rotate(-0.5);
    c.strokeStyle = RED; c.lineWidth = R * 0.07;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, R * 0.32); c.stroke();
    c.fillStyle = RED;
    c.beginPath(); c.moveTo(-R * 0.1, R * 0.3); c.lineTo(R * 0.1, R * 0.3); c.lineTo(R * 0.16, R * 0.66); c.lineTo(-R * 0.16, R * 0.66); c.closePath(); c.fill();
    c.fillStyle = GOLD; c.fillRect(-R * 0.11, R * 0.27, R * 0.22, R * 0.08);
    c.restore();
    shadowEllipse(c, R * 0.95, R * 0.85, R * 0.24);
    var g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#fff2bf'); g.addColorStop(0.55, '#ecc15e'); g.addColorStop(1, '#b8862a');
    c.fillStyle = g; circ(c, 0, 0, R); c.fill();
    c.lineWidth = R * 0.12; c.strokeStyle = INK; circ(c, 0, 0, R * 0.94); c.stroke();
    c.lineWidth = R * 0.07; c.strokeStyle = RED; circ(c, 0, 0, R * 0.78); c.stroke();
    c.lineWidth = Math.max(1, R * 0.03); c.strokeStyle = 'rgba(43,36,32,.5)'; circ(c, 0, 0, R * 0.7); c.stroke();
    var fs = R * 0.6;
    text(c, def.chars[0], 0, -R * 0.29, fs, RED);
    text(c, def.chars[1], 0, R * 0.33, fs, RED);
  }
  function drawSlip(c, ch, S, shovel) {
    var W = S * 0.66;
    c.save();
    c.rotate(shovel ? 0.05 : -0.06);
    c.fillStyle = 'rgba(43,36,32,.25)';
    rrect(c, -W / 2 + W * 0.05, -W / 2 + W * 0.08, W, W, W * 0.1); c.fill();
    var g = c.createLinearGradient(0, -W / 2, 0, W / 2);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#efe2c2');
    c.fillStyle = g; rrect(c, -W / 2, -W / 2, W, W, W * 0.1); c.fill();
    c.lineWidth = Math.max(1.5, S * 0.035); c.strokeStyle = INK; c.stroke();
    c.lineWidth = Math.max(1, S * 0.015); c.strokeStyle = 'rgba(200,50,45,.55)';
    rrect(c, -W / 2 + W * 0.09, -W / 2 + W * 0.09, W * 0.82, W * 0.82, W * 0.05); c.stroke();
    if (shovel) {
      c.save();
      c.rotate(0.75);
      c.strokeStyle = '#8a5a2b'; c.lineWidth = W * 0.09; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -W * 0.36); c.lineTo(0, W * 0.05); c.stroke();
      c.lineWidth = W * 0.06; c.beginPath(); c.moveTo(-W * 0.09, -W * 0.36); c.lineTo(W * 0.09, -W * 0.36); c.stroke();
      c.fillStyle = '#a9b2b6'; c.strokeStyle = INK; c.lineWidth = Math.max(1, W * 0.04);
      c.beginPath(); c.moveTo(-W * 0.14, W * 0.04); c.lineTo(W * 0.14, W * 0.04); c.lineTo(W * 0.13, W * 0.24);
      c.quadraticCurveTo(0, W * 0.38, -W * 0.13, W * 0.24); c.closePath(); c.fill(); c.stroke();
      c.restore();
      text(c, '铲', -W * 0.22, -W * 0.2, W * 0.28, RED, FONT_UI, '800');
    } else {
      text(c, ch, 0, W * 0.03, W * 0.66, INK);
      c.fillStyle = RED; c.fillRect(W * 0.22, W * 0.22, W * 0.16, W * 0.16);
    }
    c.restore();
  }
  function drawItem(c, it, S) {
    if (!it) return;
    if (it.t === 'u') drawUnit(c, it.k, it.lv, S);
    else if (it.t === 'g') drawGeneral(c, it.k, S);
    else if (it.t === 'p') drawSlip(c, it.ch, S);
    else if (it.t === 's') drawSlip(c, '', S, true);
  }
  var ENEMY_COL = { bing: ['#4a5f86', '#2a3a58', '#18223a'], qi: ['#5d4f80', '#3a3052', '#221a36'], dun: ['#5f6f86', '#37475d', '#212c3b'], boss: ['#46597e', '#22304a', '#121a2c'] };
  function drawEnemy(c, type, ch, r, S) {
    var R = S * r, col = ENEMY_COL[type] || ENEMY_COL.bing;
    shadowEllipse(c, R * 0.9, R * 0.85, R * 0.24);
    if (type === 'qi') {
      // 马鬃
      c.fillStyle = '#221a36';
      c.beginPath(); c.moveTo(-R * 0.9, -R * 0.3); c.lineTo(-R * 1.35, -R * 0.5); c.lineTo(-R * 0.95, R * 0.05); c.fill();
      c.beginPath(); c.moveTo(R * 0.9, -R * 0.3); c.lineTo(R * 1.35, -R * 0.5); c.lineTo(R * 0.95, R * 0.05); c.fill();
    }
    var g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, col[0]); g.addColorStop(0.65, col[1]); g.addColorStop(1, col[2]);
    c.fillStyle = g; circ(c, 0, 0, R); c.fill();
    c.lineWidth = R * 0.12; c.strokeStyle = '#0f1420'; circ(c, 0, 0, R * 0.94); c.stroke();
    if (type === 'dun') { c.lineWidth = R * 0.16; c.strokeStyle = '#a9b6c6'; circ(c, 0, 0, R * 0.8); c.stroke(); }
    if (type === 'boss') {
      c.lineWidth = R * 0.1; c.strokeStyle = GOLD; circ(c, 0, 0, R * 0.82); c.stroke();
      c.lineWidth = Math.max(1, R * 0.035); c.strokeStyle = GOLD_L; circ(c, 0, 0, R * 0.68); c.stroke();
    } else {
      c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = 'rgba(255,255,255,.35)'; circ(c, 0, 0, R * (type === 'dun' ? 0.64 : 0.72)); c.stroke();
    }
    text(c, ch, 0, R * 0.05, R * (type === 'boss' ? 1.0 : 1.05), '#fff');
  }
  // 阿斗：襁褓中的小宝宝。mood: 0 睡 1 哭 2 笑
  function drawAdou(c, x, y, S, mood, t) {
    c.save();
    c.translate(x, y);
    // 草席
    c.fillStyle = '#e3c27a'; c.strokeStyle = '#9b7a3a'; c.lineWidth = Math.max(1, S * 0.025);
    c.beginPath(); c.ellipse(0, S * 0.26, S * 0.46, S * 0.17, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(155,122,58,.55)';
    for (var i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * S * 0.11, S * 0.13); c.lineTo(i * S * 0.11 + S * 0.03, S * 0.39); c.stroke(); }
    var br = 1 + Math.sin(t * 2.2) * 0.025;
    c.scale(br, br);
    // 襁褓
    var g = c.createLinearGradient(0, -S * 0.2, 0, S * 0.35);
    g.addColorStop(0, '#e0544a'); g.addColorStop(1, '#a8241f');
    c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = Math.max(1.2, S * 0.035);
    c.beginPath(); c.ellipse(0, S * 0.06, S * 0.27, S * 0.3, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = GOLD; c.lineWidth = S * 0.045;
    c.beginPath(); c.moveTo(-S * 0.25, S * 0.05); c.quadraticCurveTo(0, S * 0.15, S * 0.25, S * 0.05); c.stroke();
    c.beginPath(); c.moveTo(-S * 0.22, S * 0.2); c.quadraticCurveTo(0, S * 0.29, S * 0.22, S * 0.2); c.stroke();
    c.fillStyle = GOLD_L; circ(c, 0, S * 0.12, S * 0.035); c.fill();
    // 脸
    var fy = -S * 0.1;
    c.fillStyle = '#f8dcc0'; c.strokeStyle = INK; c.lineWidth = Math.max(1.2, S * 0.03);
    circ(c, 0, fy, S * 0.165); c.fill(); c.stroke();
    // 头巾
    c.strokeStyle = '#c8322d'; c.lineWidth = S * 0.07;
    c.beginPath(); c.arc(0, fy, S * 0.19, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.strokeStyle = INK; c.lineWidth = Math.max(1, S * 0.025);
    c.beginPath(); c.moveTo(0, fy - S * 0.2); c.quadraticCurveTo(S * 0.06, fy - S * 0.27, S * 0.03, fy - S * 0.3); c.stroke();
    // 脸蛋
    c.fillStyle = 'rgba(232,110,100,.45)';
    circ(c, -S * 0.095, fy + S * 0.04, S * 0.035); c.fill();
    circ(c, S * 0.095, fy + S * 0.04, S * 0.035); c.fill();
    c.strokeStyle = INK; c.lineWidth = Math.max(1, S * 0.022); c.lineCap = 'round';
    var ex = S * 0.06, ey = fy - S * 0.015;
    if (mood === 1) {
      c.beginPath(); c.moveTo(-ex - S * 0.03, ey - S * 0.025); c.lineTo(-ex + S * 0.02, ey); c.lineTo(-ex - S * 0.03, ey + S * 0.025); c.stroke();
      c.beginPath(); c.moveTo(ex + S * 0.03, ey - S * 0.025); c.lineTo(ex - S * 0.02, ey); c.lineTo(ex + S * 0.03, ey + S * 0.025); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(0, fy + S * 0.075, S * 0.035, S * 0.03, 0, 0, 7); c.fill();
      c.fillStyle = '#6fb7e8';
      var ty = (t * 1.6 % 1) * S * 0.12;
      circ(c, -ex - S * 0.02, ey + S * 0.05 + ty, S * 0.022); c.fill();
      circ(c, ex + S * 0.02, ey + S * 0.05 + ty, S * 0.022); c.fill();
    } else if (mood === 2) {
      c.beginPath(); c.arc(-ex, ey + S * 0.01, S * 0.025, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(ex, ey + S * 0.01, S * 0.025, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(0, fy + S * 0.05, S * 0.04, 0.2, Math.PI - 0.2); c.stroke();
    } else {
      c.beginPath(); c.arc(-ex, ey - S * 0.01, S * 0.025, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.arc(ex, ey - S * 0.01, S * 0.025, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.arc(0, fy + S * 0.06, S * 0.018, 0, Math.PI); c.stroke();
    }
    c.restore();
  }

  // ---------- 画布与缓存 ----------
  var cv = $('cv'), ctx = cv.getContext('2d');
  var cell = 48, dpr = 1, BW = 0, BH = 0;
  var bg = null, bgSig = '';
  var sprites = {};
  function sprite(key, S, fn) {
    var sp = sprites[key];
    if (sp && sp.S === S) return sp.cv;
    var pad = 1.5;
    var c = document.createElement('canvas');
    var px = Math.ceil(S * pad * dpr);
    c.width = c.height = px;
    var x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.translate(S * pad / 2, S * pad / 2);
    fn(x, S);
    sprites[key] = { S: S, cv: c };
    return c;
  }
  function itemSprite(it) {
    var key = it.t + (it.k || '') + (it.lv || '') + (it.ch || '');
    return sprite(key, cell, function (x, S) { drawItem(x, it, S); });
  }
  function blitItem(it, x, y, scale, alpha) {
    var sp = itemSprite(it), s = cell * 1.5 * (scale || 1);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
    if (alpha != null) ctx.globalAlpha = 1;
  }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function buildBg() {
    var sig = G ? G.cells.map(function (c) { return c.lock ? 1 : 0; }).join('') : '';
    sig += '|' + cell + '|' + dpr;
    if (bg && sig === bgSig) return;
    bgSig = sig;
    bg = bg || document.createElement('canvas');
    bg.width = Math.round(BW * dpr); bg.height = Math.round(BH * dpr);
    var c = bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var S = cell;
    c.fillStyle = '#86ab70'; c.fillRect(0, 0, BW, BH);
    var cells = G ? G.cells : [];
    cells.forEach(function (ce) {
      var x = ce.c * S, y = ce.r * S;
      if (ce.path) return;
      var h = hash(ce.c + 3, ce.r + 7);
      if (ce.lock) {
        c.fillStyle = h < 0.33 ? '#7fa36b' : h < 0.66 ? '#83a86f' : '#7b9f67';
        c.fillRect(x, y, S, S);
        c.strokeStyle = 'rgba(50,80,40,.18)'; c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
        // 草丛 / 石头 / 灌木
        var h2 = hash(ce.c + 11, ce.r + 5);
        c.strokeStyle = 'rgba(60,95,50,.6)'; c.lineWidth = Math.max(1, S * 0.03); c.lineCap = 'round';
        for (var k = 0; k < 3; k++) {
          var gx = x + S * (0.18 + hash(ce.c + k, ce.r * 3 + k) * 0.64), gy = y + S * (0.2 + hash(ce.c * 5 + k, ce.r + k) * 0.6);
          c.beginPath(); c.moveTo(gx - S * 0.04, gy); c.lineTo(gx - S * 0.06, gy - S * 0.07);
          c.moveTo(gx, gy); c.lineTo(gx, gy - S * 0.09); c.moveTo(gx + S * 0.04, gy); c.lineTo(gx + S * 0.07, gy - S * 0.06); c.stroke();
        }
        if (h2 < 0.45) {
          var bx = x + S * 0.5, by = y + S * 0.56;
          c.fillStyle = '#5f8a52'; c.strokeStyle = 'rgba(35,55,30,.7)'; c.lineWidth = Math.max(1, S * 0.025);
          [[-0.14, 0.04, 0.15], [0.12, 0.05, 0.14], [0, -0.07, 0.17]].forEach(function (b) {
            circ(c, bx + b[0] * S, by + b[1] * S, b[2] * S); c.fill(); c.stroke();
          });
          c.fillStyle = 'rgba(255,255,255,.22)'; circ(c, bx - S * 0.04, by - S * 0.12, S * 0.05); c.fill();
          if (h2 < 0.15) { c.fillStyle = RED; circ(c, bx + S * 0.08, by - S * 0.02, S * 0.025); c.fill(); circ(c, bx - S * 0.1, by + S * 0.06, S * 0.025); c.fill(); }
        } else if (h2 < 0.8) {
          var sx = x + S * (0.42 + h * 0.16), sy = y + S * 0.6;
          c.fillStyle = '#b9b2a2'; c.strokeStyle = 'rgba(43,36,32,.6)'; c.lineWidth = Math.max(1, S * 0.025);
          c.beginPath(); c.ellipse(sx, sy, S * 0.17, S * 0.11, -0.2, 0, 7); c.fill(); c.stroke();
          c.fillStyle = '#d6d0c2'; c.beginPath(); c.ellipse(sx - S * 0.04, sy - S * 0.03, S * 0.07, S * 0.04, -0.2, 0, 7); c.fill();
          if (h2 > 0.65) { c.fillStyle = '#a49d8c'; c.beginPath(); c.ellipse(sx + S * 0.19, sy + S * 0.06, S * 0.07, S * 0.05, 0, 0, 7); c.fill(); c.stroke(); }
        }
      } else {
        c.fillStyle = '#7da068'; c.fillRect(x, y, S, S);
        var m = S * 0.06;
        c.fillStyle = '#eadfbf';
        rrect(c, x + m, y + m, S - 2 * m, S - 2 * m, S * 0.14); c.fill();
        c.strokeStyle = 'rgba(120,90,50,.5)'; c.lineWidth = Math.max(1, S * 0.03); c.stroke();
        c.strokeStyle = 'rgba(120,90,50,.22)'; c.setLineDash([S * 0.06, S * 0.06]); c.lineWidth = 1;
        rrect(c, x + m * 2.4, y + m * 2.4, S - 4.8 * m, S - 4.8 * m, S * 0.1); c.stroke();
        c.setLineDash([]);
      }
    });
    // 山路
    var P = Z.PTS;
    c.lineJoin = 'round'; c.lineCap = 'round';
    function pathStroke(w, col) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); c.moveTo(P[0][0] * S, P[0][1] * S);
      for (var i = 1; i < P.length; i++) c.lineTo(P[i][0] * S, P[i][1] * S);
      c.stroke();
    }
    pathStroke(S * 0.98, '#a98c5c');
    pathStroke(S * 0.86, '#d8c49a');
    pathStroke(S * 0.5, 'rgba(229,214,176,.6)');
    // 车辙与石子
    var p = {};
    c.fillStyle = 'rgba(150,120,75,.45)';
    for (var d = 0; d < Z.PATH_LEN; d += 0.23) {
      var hh = hash(Math.round(d * 100), 3);
      Z.posAt(d, (hh - 0.5) * 0.7, p);
      circ(c, p.x * S, p.y * S, S * (0.012 + hh * 0.022)); c.fill();
    }
    c.strokeStyle = 'rgba(150,115,65,.4)'; c.lineWidth = Math.max(1, S * 0.03);
    [-0.2, 0.2].forEach(function (off) {
      c.beginPath();
      for (var dd = 0; dd < Z.PATH_LEN - 0.4; dd += 0.1) { Z.posAt(dd, off, p); if (dd === 0) c.moveTo(p.x * S, p.y * S); else c.lineTo(p.x * S, p.y * S); }
      c.stroke();
    });
    // 方向箭头
    c.strokeStyle = 'rgba(140,100,50,.55)'; c.lineWidth = Math.max(1.5, S * 0.05);
    for (var a = 1.6; a < Z.PATH_LEN - 1.5; a += 3.2) {
      Z.posAt(a, 0, p);
      var q = Z.posAt(a + 0.05, 0, {});
      var ang = Math.atan2(q.y - p.y, q.x - p.x);
      c.save(); c.translate(p.x * S, p.y * S); c.rotate(ang);
      c.beginPath(); c.moveTo(-S * 0.08, -S * 0.11); c.lineTo(S * 0.05, 0); c.lineTo(-S * 0.08, S * 0.11); c.stroke();
      c.restore();
    }
    // 入口：曹营旗
    var ex = Z.PTS[0][0] * S;
    var gr = c.createLinearGradient(0, 0, 0, S * 0.7);
    gr.addColorStop(0, 'rgba(36,50,74,.5)'); gr.addColorStop(1, 'rgba(36,50,74,0)');
    c.fillStyle = gr; c.fillRect(ex - S * 0.5, 0, S, S * 0.7);
    // 阿斗所在
    var ax = (Z.ADOU[0] + 0.5) * S, ay = (Z.ADOU[1] + 0.5) * S;
    var rg = c.createRadialGradient(ax, ay, S * 0.1, ax, ay, S * 0.75);
    rg.addColorStop(0, 'rgba(255,240,200,.75)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = rg; c.fillRect(ax - S, ay - S, S * 2, S * 2);
  }

  // ---------- 游戏状态 ----------
  var G = null, running = false, paused = false, speed = store.get('speed', 1) === 2 ? 2 : 1;
  var acc = 0, last = 0, quick = false;
  var fx = [], anims = {}, selected = null, drag = null;
  var adouHurt = 0, gameOver = false, evCount = {};
  var tutStep = store.get('tut', 0);

  function cellIdx(c, r) { return r * COLS + c; }

  // ---------- 布局 ----------
  var field = $('field'), wrap = $('boardWrap');
  function layout() {
    var fw = field.clientWidth - 16 - 6, fh = field.clientHeight - 10 - 6;
    var c = Math.floor(Math.min(fw / COLS, fh / ROWS));
    cell = Math.max(20, c);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    BW = cell * COLS; BH = cell * ROWS;
    cv.style.width = BW + 'px'; cv.style.height = BH + 'px';
    cv.width = Math.round(BW * dpr); cv.height = Math.round(BH * dpr);
    sprites = {};
    bg = null;
    buildBg();
    benchSig = '';
    renderBench();
  }
  window.addEventListener('resize', function () { layout(); });

  // ---------- 特效 ----------
  function addFx(o) {
    if (quick || fx.length > 280) return;
    o.t = 0; fx.push(o);
  }
  function floatText(x, y, s, color, size, life) {
    var half = s.length * (size || 0.36) * 0.55;
    x = Math.max(half + 0.05, Math.min(COLS - half - 0.05, x));
    addFx({ k: 'text', x: x, y: Math.max(0.4, y), s: s, color: color || '#fff', size: size || 0.36, life: life || 1.0 });
  }
  function numCount() { var n = 0; for (var i = 0; i < fx.length; i++) if (fx[i].k === 'num') n++; return n; }
  function updateFx(dt) {
    for (var i = 0; i < fx.length; i++) fx[i].t += dt;
    fx = fx.filter(function (f) { return f.t < f.life; });
    for (var k in anims) { anims[k].t += dt; if (anims[k].t > anims[k].life) delete anims[k]; }
    if (adouHurt > 0) adouHurt -= dt;
  }
  function fmtNum(v) {
    if (v >= 10000) return (v / 1000).toFixed(0) + 'k';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return String(Math.max(1, Math.round(v)));
  }
  function drawFx() {
    var S = cell;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i], p = f.t / f.life, q = 1 - p;
      var x = f.x * S, y = f.y * S;
      ctx.save();
      switch (f.k) {
        case 'slash': {
          var a0 = f.a - 1.1 + p * 0.9;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(43,36,32,' + (0.5 * q) + ')'; ctx.lineWidth = S * 0.13 * q + 1;
          ctx.beginPath(); ctx.arc(x, y, S * 0.34, a0, a0 + 1.7); ctx.stroke();
          ctx.strokeStyle = f.gold ? 'rgba(255,224,130,' + q + ')' : 'rgba(255,255,255,' + q + ')'; ctx.lineWidth = S * 0.08 * q + 0.5;
          ctx.beginPath(); ctx.arc(x, y, S * 0.34, a0, a0 + 1.7); ctx.stroke();
          break;
        }
        case 'thrust': {
          var k = Math.min(1, p * 3);
          var sx = x + (f.x2 - f.x) * S * 0.15, sy = y + (f.y2 - f.y) * S * 0.15;
          var ex2 = x + (f.x2 - f.x) * S * k, ey2 = y + (f.y2 - f.y) * S * k;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(43,36,32,' + (0.55 * q) + ')'; ctx.lineWidth = S * 0.1 * q + 1;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex2, ey2); ctx.stroke();
          ctx.strokeStyle = f.gold ? 'rgba(255,214,110,' + q + ')' : 'rgba(255,255,255,' + q + ')'; ctx.lineWidth = S * 0.05 * q + 0.5;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex2, ey2); ctx.stroke();
          break;
        }
        case 'dust': {
          ctx.strokeStyle = 'rgba(150,110,60,' + (0.8 * q) + ')'; ctx.lineWidth = S * 0.1 * q + 0.5;
          circ(ctx, x, y, f.r * S * (0.3 + 0.7 * p)); ctx.stroke();
          ctx.fillStyle = 'rgba(190,160,110,' + (0.6 * q) + ')';
          for (var j = 0; j < 6; j++) { var aa = j * 1.047 + f.r; circ(ctx, x + Math.cos(aa) * f.r * S * p, y + Math.sin(aa) * f.r * S * p * 0.7, S * 0.05 * q); ctx.fill(); }
          break;
        }
        case 'crescent': {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(70,140,90,' + (0.85 * q) + ')'; ctx.lineWidth = S * 0.22 * q + 1;
          var r0 = f.r * S * (0.5 + 0.5 * p);
          ctx.beginPath(); ctx.arc(x, y, r0, f.a - 1.2 + p * 1.6, f.a + 0.9 + p * 1.6); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,240,180,' + q + ')'; ctx.lineWidth = S * 0.07 * q + 0.5;
          ctx.beginPath(); ctx.arc(x, y, r0, f.a - 1.2 + p * 1.6, f.a + 0.9 + p * 1.6); ctx.stroke();
          break;
        }
        case 'hit': {
          ctx.strokeStyle = f.gold ? 'rgba(255,214,110,' + q + ')' : 'rgba(255,255,255,' + q + ')'; ctx.lineWidth = 2;
          for (var h = 0; h < 4; h++) {
            var ha = h * 1.57 + 0.6, r1 = S * 0.06, r2 = S * (0.1 + 0.16 * p);
            ctx.beginPath(); ctx.moveTo(x + Math.cos(ha) * r1, y + Math.sin(ha) * r1); ctx.lineTo(x + Math.cos(ha) * r2, y + Math.sin(ha) * r2); ctx.stroke();
          }
          break;
        }
        case 'puff': {
          for (var m = 0; m < 7; m++) {
            var pa = m * 0.9 + f.seed, pr = S * (0.1 + 0.35 * p) * (f.big ? 2 : 1);
            ctx.fillStyle = 'rgba(' + (m % 2 ? '230,220,200' : '120,110,100') + ',' + (0.75 * q) + ')';
            circ(ctx, x + Math.cos(pa) * pr, y + Math.sin(pa) * pr * 0.8 - p * S * 0.15, S * (0.09 * q + 0.02) * (f.big ? 1.6 : 1)); ctx.fill();
          }
          break;
        }
        case 'num': {
          var sc = p < 0.15 ? 0.7 + p * 3 : 1.15 - Math.min(0.15, p);
          ctx.globalAlpha = p < 0.6 ? 1 : (1 - p) / 0.4;
          ctx.font = '800 ' + Math.round(S * (f.big ? 0.32 : 0.22) * sc) + 'px ' + FONT_UI;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.s, x, y - p * S * 0.5);
          ctx.fillStyle = f.big ? GOLD_L : '#fff'; ctx.fillText(f.s, x, y - p * S * 0.5);
          break;
        }
        case 'text': {
          var sc2 = p < 0.12 ? 0.6 + p / 0.12 * 0.5 : 1.1 - Math.min(0.1, (p - 0.12));
          ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
          ctx.font = '800 ' + Math.round(S * f.size * sc2) + 'px ' + (f.cal ? FONT_CAL : FONT_UI);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var ty = y - p * S * 0.6;
          ctx.lineWidth = Math.max(3, S * 0.08); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(f.s, x, ty);
          ctx.fillStyle = f.color; ctx.fillText(f.s, x, ty);
          break;
        }
        case 'ring': {
          ctx.strokeStyle = f.color; ctx.globalAlpha = q; ctx.lineWidth = S * 0.09 * q + 1;
          circ(ctx, x, y, S * (f.r0 + (f.r1 - f.r0) * p)); ctx.stroke();
          break;
        }
        case 'burst': {
          ctx.translate(x, y); ctx.rotate(p * 1.2);
          ctx.globalAlpha = q;
          for (var b = 0; b < 12; b++) {
            ctx.rotate(Math.PI / 6);
            ctx.fillStyle = b % 2 ? GOLD_L : '#fff4c8';
            ctx.beginPath(); ctx.moveTo(0, -S * 0.25); ctx.lineTo(S * 0.07, -S * (0.5 + 1.2 * p)); ctx.lineTo(-S * 0.07, -S * (0.5 + 1.2 * p)); ctx.fill();
          }
          ctx.strokeStyle = GOLD; ctx.lineWidth = S * 0.1 * q; circ(ctx, 0, 0, S * (0.4 + 1.3 * p)); ctx.stroke();
          break;
        }
        case 'dash': {
          var n = f.pts.length, k2 = Math.min(1, p * 2.2) * n;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.globalAlpha = p < 0.6 ? 1 : (1 - p) / 0.4;
          ctx.strokeStyle = 'rgba(43,36,32,.6)'; ctx.lineWidth = S * 0.16;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (var d = 0; d < k2 && d < n; d++) ctx.lineTo(f.pts[d][0] * S, f.pts[d][1] * S);
          ctx.stroke();
          ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = S * 0.08;
          ctx.stroke();
          for (var d2 = 0; d2 < k2 && d2 < n; d2++) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            var px = f.pts[d2][0] * S, py = f.pts[d2][1] * S;
            ctx.beginPath(); ctx.moveTo(px - S * 0.2, py - S * 0.2); ctx.lineTo(px + S * 0.2, py + S * 0.2); ctx.stroke();
          }
          break;
        }
        case 'roar': {
          for (var rr = 0; rr < 3; rr++) {
            var pp = Math.min(1, Math.max(0, p * 1.4 - rr * 0.18));
            ctx.strokeStyle = 'rgba(200,50,45,' + (1 - pp) * 0.9 + ')'; ctx.lineWidth = S * 0.12 * (1 - pp) + 0.5;
            circ(ctx, x, y, f.r * S * pp); ctx.stroke();
          }
          ctx.globalAlpha = q * 0.2; ctx.fillStyle = RED; circ(ctx, x, y, f.r * S * Math.min(1, p * 1.4)); ctx.fill();
          break;
        }
        case 'beam': {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,214,110,' + q + ')'; ctx.lineWidth = S * 0.14 * q + 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(f.x2 * S, f.y2 * S); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + q + ')'; ctx.lineWidth = S * 0.05 * q + 0.5; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,214,110,' + q + ')'; ctx.lineWidth = 3;
          circ(ctx, f.x2 * S, f.y2 * S, S * (0.2 + 0.5 * p)); ctx.stroke();
          break;
        }
        case 'heart': {
          var hx = x + (f.x2 - f.x) * S * p, hy = y + (f.y2 - f.y) * S * p - Math.sin(p * Math.PI) * S * 1.2;
          ctx.translate(hx, hy); ctx.scale(S / 48, S / 48);
          ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
          ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-16, -2, -9, -14, 0, -6); ctx.bezierCurveTo(9, -14, 16, -2, 0, 9); ctx.fill(); ctx.stroke();
          break;
        }
        case 'dirt': {
          for (var dd2 = 0; dd2 < 9; dd2++) {
            var da = dd2 * 0.7 + f.seed, dv = 0.6 + (dd2 % 3) * 0.3;
            var dx = Math.cos(da) * dv * p * S * 0.6, dy = -Math.abs(Math.sin(da)) * dv * S * 0.9 * p + p * p * S * 0.9;
            ctx.fillStyle = dd2 % 2 ? 'rgba(140,100,50,' + q + ')' : 'rgba(95,138,82,' + q + ')';
            circ(ctx, x + dx, y + dy, S * 0.06); ctx.fill();
          }
          break;
        }
      }
      ctx.restore();
    }
  }

  // ---------- 渲染 ----------
  var HL = {
    place: ['rgba(255,255,255,.55)', '#fff'], move: ['rgba(255,255,255,.55)', '#fff'],
    merge: ['rgba(243,210,122,.7)', GOLD], general: ['rgba(243,210,122,.75)', GOLD],
    swap: ['rgba(111,159,208,.45)', '#6f9fd0'], dig: ['rgba(140,95,40,.35)', '#7a5426']
  };
  function render(now) {
    var t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!G) { ctx.fillStyle = '#86ab70'; ctx.fillRect(0, 0, BW, BH); return; }
    buildBg();
    ctx.drawImage(bg, 0, 0, BW, BH);
    var S = cell;
    // 拖拽高亮
    if (drag && drag.active && drag.plans) {
      for (var key in drag.plans) {
        var pl = drag.plans[key], col = HL[pl.act];
        if (!col) continue;
        var cc = key.split(','), x = +cc[0] * S, y = +cc[1] * S;
        var hov = drag.over && drag.over.z === 't' && drag.over.c === +cc[0] && drag.over.r === +cc[1];
        ctx.fillStyle = col[0];
        rrect(ctx, x + 3, y + 3, S - 6, S - 6, S * 0.16); ctx.fill();
        ctx.lineWidth = hov ? 3.5 : 2; ctx.strokeStyle = hov ? INK : col[1];
        if (pl.act === 'dig') ctx.setLineDash([5, 4]);
        ctx.stroke(); ctx.setLineDash([]);
        if (pl.act === 'merge' || pl.act === 'general') {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          rrect(ctx, x + 6, y + 6, S - 12, S - 12, S * 0.12); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    // 射程圈
    var ring = null;
    if (drag && drag.active && drag.over && drag.over.z === 't' && drag.item && (drag.item.t === 'u' || drag.item.t === 'g')) {
      var op = drag.plans && drag.plans[drag.over.c + ',' + drag.over.r];
      if (op && op.act !== 'dig') ring = { c: drag.over.c, r: drag.over.r, it: drag.item, lv: op.lv };
    } else if (selected) {
      var si = G.getItem(selected);
      if (si && (si.t === 'u' || si.t === 'g')) ring = { c: selected.c, r: selected.r, it: si };
      else selected = null;
    }
    if (ring) {
      var rg = ring.it.t === 'u' ? Z.UNITS[ring.it.k].range : Z.GENERALS[ring.it.k].range;
      var rx = (ring.c + 0.5) * S, ry = (ring.r + 0.5) * S;
      ctx.fillStyle = 'rgba(200,50,45,.1)'; circ(ctx, rx, ry, rg * S); ctx.fill();
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,50,45,.8)'; ctx.stroke();
      if (ring.it.t === 'g' && Z.GENERALS[ring.it.k].aura !== 'all') {
        ctx.strokeStyle = 'rgba(217,164,65,.95)'; circ(ctx, rx, ry, CFG.auraRange * S); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (selected && !drag) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; rrect(ctx, ring.c * S + 3, ring.r * S + 3, S - 6, S - 6, S * 0.16); ctx.stroke(); }
    }
    // 阿斗
    var mood = adouHurt > 0 ? 1 : (G.phase === 'won' ? 2 : 0);
    drawAdou(ctx, (Z.ADOU[0] + 0.5) * S, (Z.ADOU[1] + 0.5) * S - S * 0.04, S * 1.02, mood, t);
    // 我军
    for (var i = 0; i < G.cells.length; i++) {
      var ce = G.cells[i], it = ce.item;
      if (!it) continue;
      var ux = (ce.c + 0.5) * S, uy = (ce.r + 0.5) * S;
      var sc = 1, an = anims[i];
      if (an) { var ap = an.t / an.life; sc = 1 + Math.sin(ap * Math.PI) * (an.amp || 0.3); }
      if (it.lunge > 0) {
        var lk = Math.sin((1 - it.lunge / 0.16) * Math.PI), ll = Math.sqrt(it.lx * it.lx + it.ly * it.ly) || 1;
        ux += it.lx / ll * lk * S * 0.12; uy += it.ly / ll * lk * S * 0.12;
      }
      var isSrc = drag && drag.active && drag.from.z === 't' && drag.from.c === ce.c && drag.from.r === ce.r;
      if (it.t === 'g') {
        var gp = Z.GENERALS[it.k];
        var glow = 0.35 + 0.15 * Math.sin(t * 3 + i);
        ctx.fillStyle = 'rgba(255,220,120,' + glow + ')'; circ(ctx, ux, uy, S * 0.5); ctx.fill();
        blitItem(it, ux, uy, sc, isSrc ? 0.3 : null);
        if (G.phase === 'wave' && it.skLeft != null) {
          var frac = 1 - Math.max(0, it.skLeft) / gp.skillCd;
          ctx.lineWidth = Math.max(2, S * 0.06); ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(43,36,32,.35)'; circ(ctx, ux, uy, S * 0.47); ctx.stroke();
          ctx.strokeStyle = frac >= 1 ? '#fff4c8' : GOLD_L;
          ctx.beginPath(); ctx.arc(ux, uy, S * 0.47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); ctx.stroke();
        }
      } else {
        blitItem(it, ux, uy, sc, isSrc ? 0.3 : null);
        if (it.t === 'u' && it.aura > 1.001) {
          ctx.fillStyle = GOLD_L; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
          var bx = ux + S * 0.3, by = uy - S * 0.3;
          ctx.beginPath(); ctx.moveTo(bx, by - S * 0.1); ctx.lineTo(bx + S * 0.08, by + S * 0.03); ctx.lineTo(bx - S * 0.08, by + S * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }
    // 敌军
    var es = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
    for (var e = 0; e < es.length; e++) {
      var en = es[e];
      var ex = en.x * S, ey = en.y * S + Math.sin(t * 11 + en.id) * S * 0.025;
      var key2 = en.boss ? 'eb' + en.ch : 'e' + en.type;
      var spr = sprite(key2, S, (function (en2) { return function (x2, S2) { drawEnemy(x2, en2.boss ? 'boss' : en2.type, en2.ch, en2.r, S2); }; })(en));
      var s2 = S * 1.5;
      ctx.drawImage(spr, ex - s2 / 2, ey - s2 / 2, s2, s2);
      if (en.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, en.flash * 10) + ')';
        circ(ctx, ex, ey, en.r * S); ctx.fill();
      }
      if (en.stun > 0) {
        for (var st = 0; st < 3; st++) {
          var sa = t * 5 + st * 2.1;
          ctx.fillStyle = GOLD_L; ctx.strokeStyle = INK; ctx.lineWidth = 1;
          circ(ctx, ex + Math.cos(sa) * en.r * S * 0.9, ey - en.r * S * 1.05 + Math.sin(sa) * S * 0.05, S * 0.045); ctx.fill(); ctx.stroke();
        }
      }
      if (en.hp < en.maxHp || en.boss) {
        var bw = S * (en.boss ? 0.95 : 0.6), bh = Math.max(3, S * (en.boss ? 0.09 : 0.07));
        var bx2 = ex - bw / 2, by2 = ey - en.r * S - bh - 3;
        ctx.fillStyle = 'rgba(20,20,30,.75)'; ctx.fillRect(bx2 - 1, by2 - 1, bw + 2, bh + 2);
        var hpf = Math.max(0, en.hp / en.maxHp);
        ctx.fillStyle = en.boss ? '#f0b13c' : hpf > 0.5 ? '#e0574d' : '#c8322d';
        ctx.fillRect(bx2, by2, bw * hpf, bh);
        if (en.boss) {
          ctx.font = '800 ' + Math.round(S * 0.26) + 'px ' + FONT_UI;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(en.name, ex, by2 - 2);
          ctx.fillStyle = GOLD_L; ctx.fillText(en.name, ex, by2 - 2);
        }
      }
    }
    // 箭矢
    for (var pj = 0; pj < G.projs.length; pj++) {
      var pr = G.projs[pj];
      ctx.save();
      ctx.translate(pr.x * S, pr.y * S); ctx.rotate(pr.ang);
      ctx.strokeStyle = pr.gold ? '#b8862a' : '#5a4030'; ctx.lineWidth = pr.gold ? 3 : 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-S * 0.22, 0); ctx.lineTo(S * 0.12, 0); ctx.stroke();
      ctx.fillStyle = pr.gold ? GOLD_L : INK;
      ctx.beginPath(); ctx.moveTo(S * 0.2, 0); ctx.lineTo(S * 0.08, -S * 0.06); ctx.lineTo(S * 0.08, S * 0.06); ctx.fill();
      ctx.strokeStyle = pr.gold ? RED : '#e9dcc0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-S * 0.22, 0); ctx.lineTo(-S * 0.28, -S * 0.05); ctx.moveTo(-S * 0.22, 0); ctx.lineTo(-S * 0.28, S * 0.05); ctx.stroke();
      ctx.restore();
    }
    drawFx();
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
      var c = el.querySelector('canvas');
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
      var x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      var it = G.bench[i];
      el.classList.toggle('empty', !it);
      el.classList.toggle('dragsrc', !!(drag && drag.active && drag.from.z === 'b' && drag.from.i === i));
      if (it) { x.translate(w / 2, h / 2 - 1); drawItem(x, it, Math.min(w, h * 1.12)); }
    });
  }
  function slotPop(i) {
    var el = slots[i];
    if (!el) return;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }

  // ---------- 顶栏 ----------
  var hud = {};
  function setTxt(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
  function updateHud() {
    if (!G) return;
    setTxt('hpV', String(G.hp));
    setTxt('waveV', String(Math.max(G.wave, 1)));
    setTxt('bunV', String(Math.floor(G.mantou)));
    setTxt('costV', String(G.cost()));
    var btn = $('btnSummon');
    var why = '';
    if (G.benchFree() < 0) why = '备战栏已满';
    else if (G.mantou < G.cost()) why = '馒头不足';
    if (G.phase === 'won' || G.phase === 'lost') why = ' ';
    btn.classList.toggle('off', !!why);
    btn.classList.toggle('ready', !why && tutStep === 0);
    setTxt('summonWhy', why.trim());
    var nx = $('btnNext');
    var showNext = G.phase === 'prep' || G.phase === 'break';
    nx.classList.toggle('hidden', !showNext);
    if (showNext) {
      $('btnNext').querySelector('.nx-t').textContent = G.phase === 'prep' ? '开战' : '下一波';
      setTxt('nextCount', G.holdTimer ? '' : String(Math.max(0, Math.ceil(G.timer))));
      setTxt('nextBonus', G.phase === 'break' && G.timer > 0.5 ? '+' + Math.ceil(G.timer) * CFG.earlyBonusPerSec : '');
    }
    var sp = $('btnSpeed');
    if (hud.speed !== speed) { hud.speed = speed; sp.textContent = '×' + speed; sp.classList.toggle('fast', speed === 2); }
  }
  function syncSound() {
    var b = $('btnSound');
    b.classList.toggle('muted', !soundOn);
    b.querySelector('use').setAttribute('href', soundOn ? '#i-sound' : '#i-mute');
    b.setAttribute('aria-label', soundOn ? '关闭声音' : '打开声音');
  }

  // ---------- 横幅 ----------
  var bannerQ = [], bannerBusy = false, bannerTimer = 0;
  function banner(main, sub, cls) {
    if (quick) return;
    bannerQ.push([main, sub, cls]);
    if (!bannerBusy) nextBanner();
  }
  function nextBanner() {
    var b = bannerQ.shift();
    var el = $('banner');
    if (!b) { bannerBusy = false; return; }
    bannerBusy = true;
    el.className = 'banner ' + (b[2] || '');
    el.querySelector('.b-main').textContent = b[0];
    el.querySelector('.b-sub').textContent = b[1] || '';
    void el.offsetWidth;
    el.classList.add('show');
    bannerTimer = setTimeout(nextBanner, bannerQ.length ? 1300 : 1900);
  }
  function skillStrip(k) {
    if (quick) return;
    var box = $('skillStrip');
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    var d = document.createElement('div');
    d.className = 'sk';
    d.innerHTML = Z.GENERALS[k].name + '<b>' + Z.GENERALS[k].skill + '</b>';
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1500);
  }

  // ---------- 馒头飞向顶栏 ----------
  var flying = 0;
  function flyBun(x, y) {
    if (quick || flying >= 10 || !document.body.animate) return;
    var r = cv.getBoundingClientRect(), tr = $('bunBox').querySelector('.ico').getBoundingClientRect();
    var sx = r.left + x * cell, sy = r.top + y * cell, tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'fly');
    el.innerHTML = '<use href="#i-bun"/>';
    $('flyLayer').appendChild(el);
    flying++;
    var mx = (sx + tx) / 2 + (Math.random() - 0.5) * 60, my = Math.min(sy, ty) - 30;
    var an = el.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.6)', opacity: 0.9 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.3)', opacity: 1, offset: 0.4 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.8)', opacity: 1 }
    ], { duration: 650, easing: 'cubic-bezier(.45,0,.75,.5)' });
    an.onfinish = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      flying--;
      var b = $('bunBox');
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    };
  }
  function domFloat(el, s, color) {
    if (quick) return;
    var r = el.getBoundingClientRect();
    var d = document.createElement('div');
    d.textContent = s;
    d.style.cssText = 'position:absolute;left:' + (r.left + r.width / 2) + 'px;top:' + r.top + 'px;transform:translate(-50%,-50%);font:800 16px ' + FONT_UI +
      ';color:' + (color || '#fff') + ';-webkit-text-stroke:3px #2b2420;paint-order:stroke;white-space:nowrap;';
    $('flyLayer').appendChild(d);
    if (d.animate) {
      d.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-180%)', opacity: 0 }], { duration: 1100, easing: 'ease-out' })
        .onfinish = function () { if (d.parentNode) d.parentNode.removeChild(d); };
    } else setTimeout(function () { d.parentNode && d.parentNode.removeChild(d); }, 1000);
  }

  // ---------- 事件 → 声音与特效 ----------
  function cellCenter(loc) { return { x: loc.c + 0.5, y: loc.r + 0.5 }; }
  function popAt(loc, amp) {
    if (loc.z === 't') anims[cellIdx(loc.c, loc.r)] = { t: 0, life: 0.28, amp: amp || 0.28 };
    else if (loc.z === 'b') slotPop(loc.i);
  }
  function handleEvents(evs) {
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      evCount[e.type] = (evCount[e.type] || 0) + 1;
      if (e.type === 'skill') evCount['skill:' + e.k] = (evCount['skill:' + e.k] || 0) + 1;
      switch (e.type) {
        case 'summon':
          sfx('summon'); slotPop(e.slot);
          if (tutStep === 0) setTut(1);
          if (e.item.t === 'p') pieceHint(e.slot);
          break;
        case 'place':
          sfx('place'); popAt(e.to, 0.22);
          if (e.to.z === 't') {
            if (tutStep === 1) setTut(2);
            if (G.holdTimer) { G.holdTimer = false; G.timer = Math.min(G.timer, 20); }
          }
          break;
        case 'swap': sfx('place'); popAt(e.to, 0.18); popAt(e.from, 0.18); break;
        case 'merge':
          sfx('merge', e.lv); popAt(e.to, 0.4);
          if (e.to.z === 't') {
            addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: 0.85, color: TIER_COL[e.lv - 1], life: 0.5 });
            addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.2, r1: 0.6, color: '#fff', life: 0.35 });
            floatText(e.x, e.y - 0.3, e.lv + ' 级', e.lv >= 4 ? GOLD_L : '#fff', 0.34, 0.9);
          }
          if (tutStep === 2) setTut(3);
          break;
        case 'general': {
          var gd = Z.GENERALS[e.k];
          sfx('general'); popAt(e.to, 0.5);
          if (e.to.z === 't') { addFx({ k: 'burst', x: e.x, y: e.y, life: 0.9 }); addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.3, r1: 1.8, color: GOLD, life: 0.7 }); }
          banner(gd.name, '武将登场 · 「' + gd.skill + '」', 'gold');
          discover(e.k);
          hidePieceHint();
          break;
        }
        case 'dig':
          sfx('dig'); addFx({ k: 'dirt', x: e.c + 0.5, y: e.r + 0.5, life: 0.6, seed: Math.random() * 6 });
          anims[cellIdx(e.c, e.r)] = { t: 0, life: 0.3, amp: 0.2 };
          break;
        case 'recycle': sfx('recycle'); domFloat($('recycle'), '+' + e.value, GOLD_L); break;
        case 'atk':
          if (e.kind === 'dao') { addFx({ k: 'slash', x: e.x2, y: e.y2, a: Math.atan2(e.y2 - e.y, e.x2 - e.x), gold: e.gold, life: 0.18 }); sfx('sword'); }
          else if (e.kind === 'qiang') { addFx({ k: 'thrust', x: e.x, y: e.y, x2: e.x2, y2: e.y2, gold: e.gold, life: 0.2 }); sfx('spear'); }
          else if (e.kind === 'qi') { addFx({ k: 'dust', x: e.x2, y: e.y2, r: e.rad, life: 0.32 }); sfx('hoof'); }
          else if (e.kind === 'slash') { addFx({ k: 'crescent', x: e.x2, y: e.y2, r: e.rad * 0.7, a: Math.atan2(e.y2 - e.y, e.x2 - e.x), life: 0.3 }); sfx('sword'); }
          break;
        case 'shoot': sfx('arrow'); break;
        case 'arrowHit': addFx({ k: 'hit', x: e.x, y: e.y, gold: e.gold, life: 0.14 }); break;
        case 'dmg':
          // 小伤害不显示数字，同屏数字限量，避免大波次时满屏数字
          if ((e.big || e.frac >= 0.08) && numCount() < (e.big ? 26 : 16)) addFx({ k: 'num', x: e.x + (Math.random() - 0.5) * 0.25, y: e.y, s: fmtNum(e.v), big: e.big, life: e.big ? 0.75 : 0.55 });
          break;
        case 'kill':
          addFx({ k: 'puff', x: e.x, y: e.y, life: e.boss ? 0.8 : 0.42, seed: Math.random() * 6, big: e.boss });
          flyBun(e.x, e.y);
          if (e.boss) { sfx('bossdown'); floatText(e.x, e.y - 0.4, '击破！+' + e.reward, GOLD_L, 0.5, 1.4); }
          else sfx('puff');
          break;
        case 'drop':
          slotPop(e.slot);
          domFloat(slots[e.slot], e.name + '遗落「' + e.item.ch + '」', GOLD_L);
          if (e.item.t === 'p') pieceHint(e.slot);
          break;
        case 'boss': banner(e.name, '敌将来袭！', 'boss'); sfx('boss'); break;
        case 'wave':
          banner('第 ' + e.n + ' 波', e.tag || (e.boss ? '敌将 ' + e.boss + ' 将至' : '曹军来袭'));
          sfx('drum');
          selected = null;
          break;
        case 'clear':
          sfx('clear');
          domFloat($('bunBox'), '守住！+' + e.bonus, GOLD_L);
          break;
        case 'early': sfx('early'); domFloat($('bunBox'), '抢攻 +' + e.bonus, GOLD_L); break;
        case 'break': saveGame(); break;
        case 'leak':
          sfx('hurt'); adouHurt = 1.0;
          if (!quick) {
            var fl = $('flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
            wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
            var hs = document.querySelector('.stat-hp'); hs.classList.remove('hit'); void hs.offsetWidth; hs.classList.add('hit');
            floatText(Z.ADOU[0] + 0.5, Z.ADOU[1] - 0.1, '-' + e.loss, '#ff8a80', 0.5, 1);
          }
          break;
        case 'skill': {
          var sd = Z.GENERALS[e.k];
          sfx('skill', e.k); skillStrip(e.k);
          floatText(e.x, e.y - 0.55, sd.skill, GOLD_L, 0.36, 1.1);
          if (e.k === 'zhaoyun') addFx({ k: 'dash', x: e.x, y: e.y, pts: e.pts, life: 0.55 });
          else if (e.k === 'zhangfei') addFx({ k: 'roar', x: e.x, y: e.y, r: e.rad, life: 0.7 });
          else if (e.k === 'guanyu') { addFx({ k: 'crescent', x: e.x, y: e.y, r: e.rad, a: e.ang, life: 0.45 }); addFx({ k: 'ring', x: e.x, y: e.y, r0: 0.4, r1: e.rad, color: 'rgba(70,140,90,.9)', life: 0.45 }); }
          else if (e.k === 'huangzhong') addFx({ k: 'beam', x: e.x, y: e.y, x2: e.x2, y2: e.y2, life: 0.4 });
          else if (e.k === 'liubei') {
            if (e.heal) addFx({ k: 'heart', x: e.x, y: e.y, x2: Z.ADOU[0] + 0.5, y2: Z.ADOU[1] + 0.5, life: 0.9 });
            else { floatText(e.x, e.y - 0.2, '+' + e.gold, GOLD_L, 0.34, 1); flyBun(e.x, e.y); }
          }
          break;
        }
        case 'summonEnemy': floatText(e.x, e.y - 0.6, '传令！', '#ff8a80', 0.34, 1); break;
        case 'lose': sfx('lose'); endGame(false); break;
        case 'win': sfx('win'); endGame(true); break;
      }
    }
  }

  // ---------- 主循环 ----------
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (G && running && !paused) {
      acc += dt * speed;
      var n = 0;
      while (acc >= STEP && n < 16) { G.step(STEP); acc -= STEP; n++; }
      if (n >= 16) acc = 0;
      handleEvents(G.drain());
      updateFx(dt * speed);
    }
    if (G && running) {
      render(now);
      renderBench();
      updateHud();
      tutTick();
    }
  }

  // ---------- 拖拽 ----------
  var ghost = $('ghost'), ghostCv = ghost.querySelector('canvas');
  var recycleEl = $('recycle');
  function inRect(r, x, y, pad) { pad = pad || 0; return x >= r.left - pad && x < r.right + pad && y >= r.top - pad && y < r.bottom + pad; }
  function locAt(x, y) {
    var r = cv.getBoundingClientRect();
    if (inRect(r, x, y)) {
      return { z: 't', c: Math.min(COLS - 1, Math.floor((x - r.left) / cell)), r: Math.min(ROWS - 1, Math.floor((y - r.top) / cell)) };
    }
    for (var i = 0; i < slots.length; i++) if (inRect(slots[i].getBoundingClientRect(), x, y, 3)) return { z: 'b', i: i };
    if (inRect(recycleEl.getBoundingClientRect(), x, y, 8)) return { z: 'x' };
    return null;
  }
  function sameLoc(a, b) { return a && b && a.z === b.z && a.i === b.i && a.c === b.c && a.r === b.r; }
  function onDown(e) {
    if (!G || !running || paused || gameOver) return;
    if (e.button > 0) return;
    if (e.target.closest && e.target.closest('button')) return;
    var loc = locAt(e.clientX, e.clientY);
    if (!loc || loc.z === 'x') return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, from: loc, item: G.getItem(loc), active: false, touch: e.pointerType === 'touch' };
    audio();
    e.preventDefault();
  }
  function computePlans() {
    var plans = {};
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var p = G.plan(drag.from, { z: 't', c: c, r: r });
      if (p) plans[c + ',' + r] = p;
    }
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
    drag.active = true;
    selected = null; hideTip();
    var size = Math.round(cell * 1.25);
    var px = Math.round(size * 1.5);
    ghostCv.width = Math.round(px * dpr); ghostCv.height = Math.round(px * dpr);
    ghostCv.style.width = px + 'px'; ghostCv.style.height = px + 'px';
    var g = ghostCv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, px, px);
    g.translate(px / 2, px / 2);
    drawItem(g, drag.item, size);
    drag.gs = px;
    drag.dockTop = $('dock').getBoundingClientRect().top;
    ghost.classList.add('show');
    computePlans();
    benchSig = '';
    sfx('pick');
  }
  function dragPoint(x, y) {
    // 触屏时字牌浮在手指上方（以字牌中心为落点）；靠近底部备战栏时逐渐回到手指下
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
    drag = null;
    benchSig = '';
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.active) {
      var p = dragPoint(e.clientX, e.clientY);
      var to = locAt(p.x, p.y);
      var from = drag.from;
      endDrag();
      if (!to || sameLoc(to, from) || !G || gameOver) return;
      var res = G.apply(from, to);
      if (!res) {
        sfx('error');
        if (to.z === 't') {
          var ce = G.cellAt(to.c, to.r), it = G.getItem(from);
          if (ce.path) showTipAt(to, '山路上不能布阵');
          else if (ce.lock) showTipAt(to, '荒草地：拖<b>「铲」</b>来开垦');
          else if (it && it.t === 's') showTipAt(to, '「铲」要拖到<b>草地</b>上');
        }
      } else if (res.act === 'norecycle') {
        sfx('error');
        showTipEl(recycleEl, '武将不可遣散');
      }
      handleEvents(G.drain());
    } else {
      var loc = drag.from;
      drag = null;
      onTap(loc);
    }
  }
  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', function (e) { if (drag && e.pointerId === drag.id) endDrag(); });

  // ---------- 点按说明 ----------
  var tipEl = $('tip'), tipTimer = 0;
  function fmt1(v) { return v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString(); }
  function itemInfo(it) {
    if (it.t === 'u') {
      var d = Z.UNITS[it.k], dmg = d.dmg * Z.TIER_MULT[it.lv - 1] * (it.aura || 1);
      var extra = d.pierce ? '贯穿' : d.splash ? '溅射' : d.arrow ? '远射' : '近战';
      var s = '<span class="tn">' + d.name + ' · ' + it.lv + ' 级</span><br>伤害 <b>' + fmt1(dmg) + '</b> · 射程 ' + d.range + ' · ' + extra + '<br>' + d.desc;
      if (it.aura > 1.001) s += '<br>武将加持 <b>+' + Math.round((it.aura - 1) * 100) + '%</b>';
      if (it.lv < 5) s += '<br>再拖一个 ' + it.lv + ' 级「' + d.ch + '」上来 → ' + (it.lv + 1) + ' 级';
      else s += '<br>已达最高级';
      return s;
    }
    if (it.t === 'g') {
      var g = Z.GENERALS[it.k];
      var mult = G ? G.genMult() * (it.aura || 1) : 1;
      return '<span class="tn">' + g.name + ' 「' + g.skill + '」</span><br>' + g.desc + '<br>伤害 <b>' + fmt1(g.dmg * mult) + '</b> · 射程 ' + g.range +
        '<br>光环：' + (g.aura === 'all' ? '全军伤害 <b>+15%</b>' : '1.5 格内「' + Z.AURA_NAME[g.aura] + '」伤害 <b>+35%</b>') + '<br><small>武将随波次成长</small>';
    }
    if (it.t === 'p') {
      var pt = Z.PARTNER[it.ch];
      return '<span class="tn">字牌「' + it.ch + '」</span><br>与「<b>' + pt.ch + '</b>」凑成武将 <b>' + Z.GENERALS[pt.gk].name + '</b><br>把一个字拖到另一个字上';
    }
    if (it.t === 's') return '<span class="tn">铲</span><br>拖到<b>草地</b>上，开垦一块新空地';
    return '';
  }
  function placeTip(rect) {
    var ar = $('app').getBoundingClientRect();
    tipEl.classList.add('show');
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = rect.left + rect.width / 2 - ar.left - tw / 2;
    x = Math.max(8, Math.min(ar.width - tw - 8, x));
    var y = rect.top - ar.top - th - 8;
    if (y < 50) y = rect.bottom - ar.top + 8;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 3200);
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
    if (loc.z === 'b') {
      selected = null;
      if (it) { showTipEl(slots[loc.i], itemInfo(it)); sfx('click'); } else hideTip();
      return;
    }
    var ce = G.cellAt(loc.c, loc.r);
    if (it) {
      if (selected && sameLoc(selected, loc)) { selected = null; hideTip(); return; }
      selected = (it.t === 'u' || it.t === 'g') ? loc : null;
      showTipAt(loc, itemInfo(it));
      sfx('click');
    } else {
      selected = null;
      if (ce.path) { hideTip(); return; }
      if (ce.lock) showTipAt(loc, '荒草地：拖<b>「铲」</b>到这里开垦');
      else showTipAt(loc, '空地：把备战栏的字牌拖到这里布阵');
    }
  }

  // ---------- 新手引导 ----------
  var tutEl = $('tut'), pieceHintUntil = 0, pieceHintSlot = -1;
  function setTut(n) { if (n > tutStep) { tutStep = n; store.set('tut', n); } }
  function showTut(textS, rect, below) {
    var ar = $('app').getBoundingClientRect();
    $('tutText').textContent = textS;
    tutEl.classList.add('show');
    tutEl.classList.toggle('up', !!below); tutEl.classList.toggle('down', !below);
    var tw = tutEl.offsetWidth, th = tutEl.offsetHeight;
    var cx = rect.left + rect.width / 2 - ar.left;
    var x = Math.max(8, Math.min(ar.width - tw - 8, cx - tw / 2));
    var y = below ? rect.bottom - ar.top + 12 : rect.top - ar.top - th - 12;
    tutEl.style.left = x + 'px'; tutEl.style.top = y + 'px';
    tutEl.style.setProperty('--ax', (cx - x) + 'px');
  }
  function hideTut() { tutEl.classList.remove('show'); }
  function pieceHint(slot) {
    if (store.get('tutPiece', 0)) return;
    store.set('tutPiece', 1);
    pieceHintSlot = slot;
    pieceHintUntil = performance.now() + 7000;
  }
  function hidePieceHint() { pieceHintUntil = 0; }
  function tutTick() {
    if (tutStep < 3 && G.wave >= 3) setTut(3);
    if (drag && drag.active) { hideTut(); return; }
    if (gameOver || paused) { hideTut(); return; }
    if (pieceHintUntil > performance.now() && pieceHintSlot >= 0) {
      showTut('两个字凑成武将，例如 赵 + 云', slots[pieceHintSlot].getBoundingClientRect());
      return;
    }
    if (tutStep === 0) { showTut('点「征兵」招募士兵', $('btnSummon').getBoundingClientRect()); return; }
    if (tutStep === 1) {
      var bi = -1;
      G.bench.forEach(function (it, i) { if (bi < 0 && it && it.t === 'u') bi = i; });
      if (bi >= 0) showTut('把字牌拖到路边空地上', slots[bi].getBoundingClientRect());
      else if (G.canSummon()) showTut('点「征兵」招募士兵', $('btnSummon').getBoundingClientRect());
      else hideTut();
      return;
    }
    if (tutStep === 2) {
      // 有两个可合并的字牌时才提示
      var all = [];
      G.bench.forEach(function (it, i) { if (it && it.t === 'u') all.push({ it: it, el: slots[i].getBoundingClientRect() }); });
      var r = cv.getBoundingClientRect();
      G.cells.forEach(function (ce) {
        if (ce.item && ce.item.t === 'u') all.push({ it: ce.item, el: { left: r.left + ce.c * cell, top: r.top + ce.r * cell, width: cell, height: cell, bottom: r.top + (ce.r + 1) * cell } });
      });
      for (var a = 0; a < all.length; a++) for (var b = a + 1; b < all.length; b++) {
        if (Z.mergeable(all[a].it, all[b].it)) { showTut('相同字牌拖到一起，合并升级！', all[a].el); return; }
      }
      hideTut();
      return;
    }
    hideTut();
  }

  // ---------- 存档与记录 ----------
  function saveGame() { if (G && !gameOver) store.set('save', G.serialize()); }
  function discover(k) {
    var cx = store.get('codex', []);
    if (cx.indexOf(k) < 0) { cx.push(k); store.set('codex', cx); }
  }
  function better(a, b) {
    if (!b) return true;
    if (a.win !== b.win) return a.win;
    if (a.win) return a.hp > b.hp || (a.hp === b.hp && a.time < b.time);
    return a.wave > b.wave;
  }
  function fmtTime(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function endGame(win) {
    if (gameOver) return;
    gameOver = true;
    store.del('save');
    var rec = { win: win, wave: win ? 20 : G.wave, hp: G.hp, time: Math.round(G.time) };
    var best = store.get('best', {}) || {};
    var isNew = better(rec, best[G.diff]);
    if (isNew) { best[G.diff] = rec; store.set('best', best); }
    hideTut(); hideTip(); selected = null;
    if (drag) endDrag();
    var show = function () { showResult(win, rec, isNew); };
    if (quick) show(); else setTimeout(show, 1300);
  }
  function showResult(win, rec, isNew) {
    var el = $('result');
    el.classList.toggle('lose', !win);
    $('rTitle').textContent = win ? '救主成功' : '阿斗被抓走了…';
    $('rSub').innerHTML = (Z.DIFFS[G.diff].name) + ' · ' + (win ? '长坂坡二十波尽数击退' : '坚守至第 ' + G.wave + ' 波') + (isNew ? '<span class="r-new">新纪录</span>' : '');
    var stats = win
      ? [['剩余 ❤', G.hp], ['用时', fmtTime(G.time)], ['武将', G.stats.generals.length]]
      : [['到达波次', G.wave + '/20'], ['击败曹军', G.stats.kills], ['武将', G.stats.generals.length]];
    $('rStats').innerHTML = stats.map(function (s) { return '<div class="rs"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>'; }).join('');
    var gw = $('rGens');
    gw.innerHTML = '';
    G.stats.generals.forEach(function (k) { gw.appendChild(itemCanvas({ t: 'g', k: k }, 50)); });
    drawResultArt(win);
    el.classList.add('show');
    running = false;
  }

  // ---------- 小画布（图鉴、标题、结算） ----------
  function itemCanvas(it, size, gray) {
    var c = document.createElement('canvas');
    var d = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * d);
    c.style.width = c.style.height = size + 'px';
    var x = c.getContext('2d');
    x.scale(d, d); x.translate(size / 2, size / 2);
    if (gray) x.filter = 'grayscale(1) opacity(.5)';
    if (it.t === 'e') drawEnemy(x, it.type, it.ch, it.r, size);
    else drawItem(x, it, size);
    return c;
  }
  function prepCanvas(c, w, h) {
    var d = Math.min(3, window.devicePixelRatio || 1);
    c.width = w * d; c.height = h * d;
    var x = c.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, w, h);
    return x;
  }
  function drawHero() {
    var x = prepCanvas($('heroCv'), 300, 130);
    // 地面墨痕
    x.fillStyle = 'rgba(43,36,32,.12)';
    x.beginPath(); x.ellipse(150, 112, 140, 12, 0, 0, 7); x.fill();
    x.save(); x.translate(64, 64); drawGeneral(x, 'zhaoyun', 108); x.restore();
    x.save(); x.translate(150, 74); drawAdou(x, 0, 0, 82, 0, 0); x.restore();
    [['bing', '兵', 0.3, 226, 82], ['qi', '骑', 0.29, 262, 58], ['boss', '曹', 0.44, 262, 100]].forEach(function (e, i) {
      x.save(); x.globalAlpha = 0.95 - i * 0.1; x.translate(e[3], e[4]); drawEnemy(x, e[0], e[1], e[2], 62); x.restore();
    });
  }
  function drawResultArt(win) {
    var x = prepCanvas($('rCv'), 320, 120);
    x.fillStyle = 'rgba(43,36,32,.12)';
    x.beginPath(); x.ellipse(160, 104, 130, 11, 0, 0, 7); x.fill();
    if (win) {
      x.save(); x.translate(100, 60); drawGeneral(x, 'zhaoyun', 96); x.restore();
      x.save(); x.translate(205, 64); drawAdou(x, 0, 0, 92, 2, 0); x.restore();
      x.fillStyle = GOLD;
      [[150, 20], [262, 28], [40, 34], [282, 80]].forEach(function (p) {
        x.save(); x.translate(p[0], p[1]); x.rotate(0.4);
        x.fillRect(-2, -8, 4, 16); x.fillRect(-8, -2, 16, 4); x.restore();
      });
    } else {
      x.save(); x.translate(110, 62); drawAdou(x, 0, 0, 90, 1, 0.3); x.restore();
      x.save(); x.translate(210, 58); drawEnemy(x, 'boss', '曹', 0.44, 100); x.restore();
    }
  }
  function buildCodex() {
    var cx = store.get('codex', []) || [];
    var gEl = $('codexGen');
    gEl.innerHTML = '';
    $('codexCount').textContent = '已招募 ' + cx.filter(function (k) { return Z.GENERALS[k]; }).length + '/5';
    Z.GEN_KEYS.forEach(function (k) {
      var g = Z.GENERALS[k], known = cx.indexOf(k) >= 0;
      var card = document.createElement('div');
      card.className = 'card' + (known ? '' : ' locked');
      card.appendChild(itemCanvas({ t: 'g', k: k }, 52, !known));
      var info = document.createElement('div');
      info.innerHTML = known
        ? '<div class="ct">' + g.name + '<em>「' + g.skill + '」</em></div><div class="cr">' + g.desc + '<br>光环：' +
          (g.aura === 'all' ? '全军 +15%' : '身边「' + Z.AURA_NAME[g.aura] + '」+35%') + '</div>' +
          '<div class="recipe"><i>' + g.chars[0] + '</i>+<i>' + g.chars[1] + '</i>→ ' + g.name + '</div>'
        : '<div class="ct">' + g.name + '<em>「？？？」</em></div><div class="cr">尚未招募。征兵时可能得到名字字牌</div>' +
          '<div class="recipe"><i>' + g.chars[0] + '</i>+<i>' + g.chars[1] + '</i>→ ？</div>';
      card.appendChild(info);
      gEl.appendChild(card);
    });
    var uEl = $('codexUnit');
    uEl.innerHTML = '';
    Z.KINDS.forEach(function (k) {
      var d = Z.UNITS[k];
      var card = document.createElement('div');
      card.className = 'card';
      card.appendChild(itemCanvas({ t: 'u', k: k, lv: 3 }, 52));
      var info = document.createElement('div');
      info.innerHTML = '<div class="ct">' + d.name + '</div><div class="cr">' + d.desc + '<br>伤害 <b>' + d.dmg + '</b> · 射程 <b>' + d.range + '</b> · 每 ' + d.cd + ' 秒一击<br>等级 1→5 伤害 ×1 / 2.2 / 4.8 / 10 / 22</div>';
      card.appendChild(info);
      uEl.appendChild(card);
    });
    var fEl = $('codexFoe');
    fEl.innerHTML = '';
    [['bing', '兵', 0.3, '步兵', '最常见，速度一般'], ['qi', '骑', 0.29, '骑兵', '血少，跑得飞快'], ['dun', '盾', 0.33, '盾兵', '血厚走得慢，弓箭伤害 -40%'],
      ['boss', '曹', 0.44, '敌将', '夏侯惇 / 张郃 / 许褚 / 曹操，冲到阿斗身边扣 3 心']].forEach(function (f) {
      var card = document.createElement('div');
      card.className = 'card';
      card.appendChild(itemCanvas({ t: 'e', type: f[0], ch: f[1], r: f[2] }, 52));
      var info = document.createElement('div');
      info.innerHTML = '<div class="ct">' + f[3] + '</div><div class="cr">' + f[4] + '</div>';
      card.appendChild(info);
      fEl.appendChild(card);
    });
  }

  // ---------- 界面流程 ----------
  function openSheet(id) { $(id).classList.add('show'); }
  function closeSheet(id) { $(id).classList.remove('show'); }
  function bestLine() {
    var best = store.get('best', {}) || {};
    var html = '';
    ['easy', 'normal', 'hard'].forEach(function (k) {
      var b = best[k];
      if (!b) return;
      html += '<span class="chip' + (b.win ? ' win' : '') + '">' + Z.DIFFS[k].name + ' ' + (b.win ? '救主成功 · 剩 ' + b.hp + ' 心' : '最远第 ' + b.wave + ' 波') + '</span>';
    });
    $('bestLine').innerHTML = html;
    document.querySelectorAll('[data-best]').forEach(function (el) {
      var b = best[el.getAttribute('data-best')];
      el.textContent = b ? (b.win ? '最佳：救主成功，剩 ' + b.hp + ' 心 · ' + fmtTime(b.time) : '最佳：第 ' + b.wave + ' 波') : '';
    });
  }
  function showTitle() {
    running = false; paused = false;
    clearOverlays();
    $('title').classList.add('show');
    $('result').classList.remove('show');
    ['sheetDiff', 'sheetHelp', 'sheetPause'].forEach(closeSheet);
    hideTut(); hideTip();
    bestLine();
    drawHero();
  }
  function openDiff() {
    var sv = store.get('save', null);
    var cb = $('btnContinue');
    if (sv && sv.wave > 0 && Z.DIFFS[sv.diff]) {
      cb.classList.remove('hidden');
      cb.innerHTML = '继续上局 · ' + Z.DIFFS[sv.diff].name + ' 第 ' + sv.wave + ' 波后<small>阿斗 ' + sv.hp + ' 心 · 馒头 ' + Math.floor(sv.mantou) + '</small>';
    } else cb.classList.add('hidden');
    bestLine();
    openSheet('sheetDiff');
  }
  function newGame(diff, save, opts) {
    opts = opts || {};
    var tutOn = tutStep < 2 && !save;
    if (!save) store.del('save');
    G = Z.createGame({ diff: diff, save: save || null, holdTimer: tutOn && !opts.noTut, seed: opts.seed });
    window.__zyG = G;
    running = true; paused = false; gameOver = false; acc = 0;
    fx = []; anims = {}; selected = null; drag = null; adouHurt = 0; evCount = {}; hud = {};
    bannerQ = [];
    clearOverlays();
    $('title').classList.remove('show');
    $('result').classList.remove('show');
    ['sheetDiff', 'sheetHelp', 'sheetPause'].forEach(closeSheet);
    layout();
    if (save) banner('第 ' + (G.wave + 1) + ' 波', '继续坚守长坂坡');
    else banner('长坂坡', '布阵迎敌，守护阿斗');
  }
  function clearOverlays() {
    var bn = $('banner'); bn.className = 'banner';
    clearTimeout(bannerTimer); bannerBusy = false; bannerQ = [];
    $('skillStrip').innerHTML = '';
    $('flyLayer').innerHTML = ''; flying = 0;
    hideTip(); hideTut(); hidePieceHint();
  }
  function pauseGame() {
    if (!G || !running || gameOver) return;
    paused = true;
    if (drag) endDrag();
    $('pauseInfo').textContent = Z.DIFFS[G.diff].name + ' · 第 ' + Math.max(1, G.wave) + '/20 波 · 阿斗 ' + G.hp + ' 心';
    openSheet('sheetPause');
  }
  function resumeGame() {
    closeSheet('sheetPause');
    paused = false;
    last = performance.now();
  }
  var helpPaused = false;
  function openHelp() {
    buildCodex();
    if (G && running && !paused && !gameOver) { paused = true; helpPaused = true; } else helpPaused = false;
    openSheet('sheetHelp');
  }
  function closeHelp() {
    closeSheet('sheetHelp');
    if (helpPaused) { helpPaused = false; paused = false; last = performance.now(); }
  }

  function bind(id, fn) {
    $(id).addEventListener('click', function (e) { audio(); fn(e); });
  }
  bind('btnStart', function () { sfx('click'); openDiff(); });
  bind('btnRules', function () { sfx('click'); openHelp(); });
  document.querySelectorAll('.diff').forEach(function (b) {
    b.addEventListener('click', function () { audio(); sfx('click'); newGame(b.getAttribute('data-diff')); });
  });
  bind('btnContinue', function () {
    var sv = store.get('save', null);
    sfx('click');
    if (sv) newGame(sv.diff, sv);
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      var w = b.closest('.sheet-wrap');
      if (w.id === 'sheetHelp') closeHelp(); else closeSheet(w.id);
    });
  });
  document.querySelectorAll('.sheet-wrap').forEach(function (w) {
    w.addEventListener('click', function (e) {
      if (e.target !== w) return;
      if (w.id === 'sheetHelp') closeHelp();
      else if (w.id === 'sheetPause') resumeGame();
      else closeSheet(w.id);
    });
  });
  bind('btnSummon', function () {
    if (!G || !running || paused || gameOver) return;
    if (!G.summon()) {
      sfx('error');
      showTipEl($('btnSummon'), G.benchFree() < 0 ? '备战栏满了：先把字牌布阵、合并或回收' : '馒头不够：击败曹军可获得馒头');
    }
    handleEvents(G.drain());
  });
  bind('btnNext', function () { if (G && running && !paused) { sfx('click'); G.holdTimer = false; G.callNext(); handleEvents(G.drain()); } });
  bind('btnPause', function () { sfx('click'); pauseGame(); });
  bind('btnResume', function () { sfx('click'); resumeGame(); });
  bind('btnPauseHelp', function () { sfx('click'); buildCodex(); helpPaused = false; openSheet('sheetHelp'); });
  bind('btnRestart', function () { sfx('click'); if (G) newGame(G.diff); });
  bind('btnHome', function () { sfx('click'); saveIfBreak(); showTitle(); });
  bind('btnAgain', function () { sfx('click'); newGame(G ? G.diff : 'normal'); });
  bind('btnResHome', function () { sfx('click'); showTitle(); });
  bind('btnHelp', function () { sfx('click'); openHelp(); });
  bind('btnSpeed', function () { speed = speed === 1 ? 2 : 1; store.set('speed', speed); sfx('click'); });
  bind('btnSound', function () { soundOn = !soundOn; store.set('sound', soundOn); syncSound(); sfx('click'); });
  function saveIfBreak() { if (G && (G.phase === 'break') && !gameOver) saveGame(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (G && running && !paused && !gameOver) pauseGame(); saveIfBreak(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'p') { if (paused) resumeGame(); else pauseGame(); }
    if (e.key === ' ' && G && running && !paused) { e.preventDefault(); $('btnSummon').click(); }
  });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest('#app')) e.preventDefault(); });

  // 字体加载后重绘文字
  function fontsReady() { sprites = {}; benchSig = ''; drawHero(); }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fontsReady);
    // 画布用到的字不一定出现在页面文字里，主动加载这些字形
    if (document.fonts.load) {
      var glyphs = '刀枪骑弓兵盾惇郃褚曹铲阿斗' + Z.DROP_PIECES.join('');
      Promise.all([document.fonts.load('40px "Ma Shan Zheng"', glyphs), document.fonts.load('40px "ZCOOL XiaoWei"', glyphs)])
        .then(fontsReady, function () { /* 字体被拦截时使用后备字体 */ });
    }
  }

  // ---------- 测试钩子 ----------
  function bare(it) { return it ? { t: it.t, k: it.k, lv: it.lv, ch: it.ch } : null; }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  window.__zy = {
    get G() { return G; },
    Z: Z,
    state: function () {
      if (!G) return null;
      return {
        phase: G.phase, wave: G.wave, hp: G.hp, mantou: G.mantou, cost: G.cost(), timer: G.timer, enemies: G.enemies.length,
        bench: G.bench.map(bare), board: G.cells.filter(function (c) { return c.item; }).map(function (c) { return { c: c.c, r: c.r, it: bare(c.item) }; }),
        unlocked: G.cells.filter(function (c) { return !c.path && !c.lock; }).length, paused: paused, running: running, speed: speed,
        gameOver: gameOver, stats: G.stats, cell: cell, fx: fx.length, holdTimer: G.holdTimer
      };
    },
    give: function (it, loc) {
      if (!loc) { var i = G.benchFree(); if (i < 0) return false; G.bench[i] = it; }
      else if (loc.z === 'b') G.bench[loc.i] = it;
      else { var ce = G.cellAt(loc.c, loc.r); ce.lock = false; ce.item = it; it.cdLeft = 0; G.auraDirty = true; }
      benchSig = '';
      return true;
    },
    clearBoard: function () { G.cells.forEach(function (c) { c.item = null; }); G.bench = [null, null, null, null, null]; G.auraDirty = true; benchSig = ''; },
    set: function (o) { for (var k in o) G[k] = o[k]; },
    setWave: function (n) { G.wave = n - 1; G.phase = 'break'; G.timer = 0.3; G.queue = []; G.enemies = []; G.holdTimer = false; },
    ff: function (sec, opt) {
      opt = opt || {};
      quick = !opt.visual;
      var n = Math.round(sec / STEP);
      for (var i = 0; i < n; i++) {
        G.step(STEP);
        if (i % 30 === 0) handleEvents(G.drain());
        if (G.phase === 'won' || G.phase === 'lost') break;
      }
      handleEvents(G.drain());
      quick = false;
      return this.state();
    },
    events: function () { return evCount; },
    sounds: Object.keys(SFX),
    // 离线渲染一个音效，返回峰值与响度，供测试检查
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
    resetEvents: function () { evCount = {}; },
    tile: function (c, r) { var b = cv.getBoundingClientRect(); return { x: b.left + (c + 0.5) * cell, y: b.top + (r + 0.5) * cell }; },
    slot: function (i) { return center(slots[i].getBoundingClientRect()); },
    recycle: function () { return center(recycleEl.getBoundingClientRect()); },
    summonBtn: function () { return center($('btnSummon').getBoundingClientRect()); },
    newGame: function (diff, opts) { newGame(diff || 'normal', null, opts || {}); return this.state(); },
    pause: pauseGame, resume: resumeGame,
    isPaused: function () { return paused; },
    setSpeed: function (s) { speed = s; }
  };

  // ---------- 启动 ----------
  syncSound();
  layout();
  showTitle();
  requestAnimationFrame(frame);
})();
