/* 赵云与阿斗 v3 · 合成音效（Web Audio）
 * 链路：音色 → 高通 140Hz → 压缩 → 增益 → tanh 软限幅；音色集中在 500Hz~3kHz，手机外放也响亮 */
(function () {
  'use strict';
  var on = true, actx = null, bus = null, noiseBuf = null, mute = false;
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
  function clack(at, v) {
    // 麻将牌相碰：两声清脆的「嗒」
    osc({ type: 'triangle', f: 2300, f2: 1700, d: 0.035, v: v || 0.55, at: at });
    noise({ ft: 'highpass', f: 3800, q: 0.7, d: 0.03, v: (v || 0.55) * 0.8, at: at });
    osc({ type: 'sine', f: 1150, f2: 900, d: 0.05, v: (v || 0.55) * 0.45, at: at });
  }
  var SFX = {
    click: function () { clack(0, 0.45); },
    pick: function () { clack(0, 0.35); },
    place: function () { clack(0, 0.6); clack(0.045, 0.35); },
    summon: function () { drumHit(0, false, 0.7); for (var i = 0; i < 5; i++) clack(0.08 + i * 0.06, 0.35); },
    discard: function () { noise({ f: 900, f2: 2600, q: 0.6, d: 0.25, v: 0.3 }); },
    merge: function (lv) {
      var f = 480 * Math.pow(1.26, (lv || 2) - 2);
      clack(0, 0.6);
      osc({ type: 'square', f: f, f2: f * 1.9, d: 0.1, v: 0.28 });
      osc({ type: 'triangle', f: f * 2, f2: f * 3, d: 0.09, v: 0.42 });
      osc({ type: 'sine', f: f * 3, d: 0.22, v: 0.22, at: 0.07 });
      if (lv >= 4) { note(f * 2, 0.12, 0.14, 0.3); note(f * 2.5, 0.2, 0.24, 0.3); gong(0.1, 0.22); }
    },
    general: function () { gong(0); [784, 988, 1175, 1568].forEach(function (f, i) { note(f, 0.18 + i * 0.11, i === 3 ? 0.5 : 0.16, 0.36, 0.35); }); },
    synergy: function () { gong(0, 0.4); drumHit(0.05, true); [659, 784, 988, 1319, 1568].forEach(function (f, i) { note(f, 0.15 + i * 0.09, i === 4 ? 0.6 : 0.14, 0.34, 0.4); }); },
    blade: function () { noise({ f: 3200, f2: 1400, q: 1.4, d: 0.05, v: 0.4 }); noise({ f: 3600, f2: 1500, q: 1.4, d: 0.05, v: 0.32, at: 0.07 }); osc({ type: 'triangle', f: 1700, f2: 1100, d: 0.04, v: 0.12 }); },
    spear: function () { noise({ f: 1200, f2: 3600, q: 1.6, d: 0.08, v: 0.32 }); osc({ type: 'triangle', f: 760, f2: 1150, d: 0.06, v: 0.12 }); },
    bow: function () { osc({ type: 'triangle', f: 520, f2: 380, d: 0.12, v: 0.22 }); osc({ type: 'triangle', f: 1900, f2: 1100, d: 0.05, v: 0.14 }); noise({ f: 3600, q: 3, d: 0.03, v: 0.12 }); },
    hoof: function () { [0, 0.07, 0.14].forEach(function (a) { osc({ type: 'sine', f: 560, f2: 260, d: 0.06, v: 0.28, at: a }); noise({ ft: 'lowpass', f: 1600, d: 0.05, v: 0.24, at: a }); }); },
    shield: function () { osc({ type: 'sine', f: 380, f2: 220, d: 0.16, v: 0.4 }); noise({ ft: 'lowpass', f: 1200, f2: 400, d: 0.12, v: 0.35 }); },
    fire: function () { noise({ f: 800, f2: 2400, q: 0.7, d: 0.18, v: 0.32 }); osc({ type: 'triangle', f: 620, f2: 900, d: 0.08, v: 0.08 }); },
    drum: function () { drumHit(0, false, 0.5); },
    bolt: function () { osc({ type: 'sawtooth', f: 900, f2: 480, d: 0.08, v: 0.16 }); noise({ f: 1800, f2: 3400, q: 2, d: 0.07, v: 0.24 }); },
    catapult: function () { osc({ type: 'triangle', f: 300, f2: 520, d: 0.12, v: 0.25 }); noise({ f: 700, f2: 1500, q: 0.8, d: 0.12, v: 0.25 }); },
    boom: function () { noise({ ft: 'lowpass', f: 3000, f2: 200, d: 0.5, v: 0.85 }); osc({ type: 'sine', f: 300, f2: 90, d: 0.35, v: 0.7 }); noise({ f: 900, q: 0.8, d: 0.25, v: 0.4, at: 0.05 }); },
    chain: function () { [1500, 1800, 1500, 2000].forEach(function (f, i) { osc({ type: 'square', f: f, d: 0.05, v: 0.15, at: i * 0.06 }); }); },
    hit: function () { noise({ f: 1800, f2: 900, q: 1.2, d: 0.05, v: 0.22 }); },
    kill: function () { noise({ f: 1400, f2: 500, q: 0.9, d: 0.09, v: 0.3 }); osc({ type: 'sine', f: 950, f2: 480, d: 0.06, v: 0.12 }); },
    bossdown: function () { noise({ ft: 'lowpass', f: 4200, f2: 300, d: 0.7, v: 0.9 }); osc({ type: 'sawtooth', f: 440, f2: 140, d: 0.6, v: 0.4 }); note(1047, 0.25, 0.14, 0.35); note(1319, 0.35, 0.14, 0.35); note(1568, 0.45, 0.3, 0.38); },
    hurt: function () { osc({ type: 'triangle', f: 1180, f2: 760, d: 0.25, v: 0.55 }); osc({ type: 'square', f: 1180, f2: 760, d: 0.2, v: 0.08 }); noise({ ft: 'lowpass', f: 1200, f2: 300, d: 0.12, v: 0.5 }); drumHit(0.02, true, 0.7); },
    foehurt: function () { note(1319, 0, 0.08, 0.28); note(1568, 0.07, 0.12, 0.28); },
    heal: function () { [1047, 1319, 1568, 2093].forEach(function (f, i) { osc({ type: 'sine', f: f, d: 0.4, v: 0.22, at: i * 0.06 }); }); },
    wave: function () { drumHit(0); drumHit(0.2); drumHit(0.4); drumHit(0.62, true); },
    boss: function () { drumHit(0, true); drumHit(0.32, true); drumHit(0.64, true); osc({ type: 'sawtooth', f: 233, d: 0.9, v: 0.32, at: 0.1, hold: 0.4 }); osc({ type: 'sawtooth', f: 466, f2: 440, d: 0.9, v: 0.18, at: 0.1, hold: 0.4 }); },
    dig: function () { noise({ ft: 'lowpass', f: 2200, f2: 500, d: 0.16, v: 0.7 }); osc({ type: 'triangle', f: 640, f2: 320, d: 0.08, v: 0.4 }); noise({ f: 900, q: 1, d: 0.14, v: 0.45, at: 0.11 }); },
    recycle: function () { note(1319, 0, 0.08, 0.35); note(1760, 0.07, 0.14, 0.35); },
    error: function () { osc({ type: 'sawtooth', f: 330, f2: 300, d: 0.09, v: 0.3 }); osc({ type: 'sawtooth', f: 250, f2: 220, d: 0.14, v: 0.3, at: 0.1 }); },
    flood: function () { noise({ ft: 'lowpass', f: 900, f2: 2600, d: 1.0, v: 0.6, q: 0.5 }); },
    star: function (i) { drumHit(0, true, 0.7); note(988 * Math.pow(1.26, i || 0), 0.03, 0.2, 0.35); },
    write: function () { noise({ f: 2400, f2: 1200, q: 0.8, d: 0.12, v: 0.12 }); },
    skill: function (k) {
      noise({ f: 600, f2: 3000, q: 1, d: 0.25, v: 0.5 });
      if (k === 'zhaoyun' || k === 'machao') { [988, 1175, 1397, 1760].forEach(function (f, i) { note(f, 0.04 + i * 0.05, 0.1, 0.32); }); drumHit(0, true, 0.6); }
      else if (k === 'zhangfei') { osc({ type: 'sawtooth', f: 330, f2: 200, d: 0.55, v: 0.5 }); osc({ type: 'square', f: 660, f2: 400, d: 0.5, v: 0.16 }); drumHit(0.25, true); }
      else if (k === 'guanyu') { noise({ f: 900, f2: 2600, q: 0.8, d: 0.4, v: 0.6, at: 0.25 }); osc({ type: 'triangle', f: 1800, f2: 1100, d: 0.3, v: 0.25, at: 0.3 }); gong(0, 0.25); }
      else if (k === 'huangzhong') { osc({ type: 'triangle', f: 2200, f2: 900, d: 0.12, v: 0.4, at: 0.4 }); osc({ type: 'sine', f: 2637, d: 0.3, v: 0.25, at: 0.65 }); }
      else if (k === 'kongming') { noise({ f: 400, f2: 1600, q: 0.6, d: 0.7, v: 0.5 }); noise({ f: 900, f2: 2600, q: 0.8, d: 0.6, v: 0.5, at: 0.4 }); }
      else if (k === 'pangtong') { gong(0, 0.2); }
      else if (k === 'weiyan') { noise({ f: 2400, f2: 700, q: 1, d: 0.3, v: 0.6, at: 0.25 }); drumHit(0.28, true); }
      else if (k === 'jiangwei') { drumHit(0.3); drumHit(0.38); noise({ f: 1500, f2: 3000, q: 1, d: 0.2, v: 0.4, at: 0.35 }); }
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
  var RATE = { blade: 0.08, spear: 0.08, hoof: 0.12, bow: 0.07, bolt: 0.1, fire: 0.1, hit: 0.06, kill: 0.05, drum: 0.25, shield: 0.2, catapult: 0.15, boom: 0.12, write: 0.08, place: 0.05, foehurt: 0.3 };
  var last = {};
  // 上半场（对手）的音效更轻
  function play(name, arg, quiet) {
    if (!on || mute) return;
    var now = performance.now() / 1000;
    if (RATE[name] && now - (last[name] || 0) < RATE[name] * (quiet ? 2 : 1)) return;
    last[name] = now;
    if (!audio()) return;
    try {
      if (quiet && bus) { var b = bus, g = actx.createGain(); g.gain.value = 0.35; g.connect(b); bus = g; SFX[name](arg); bus = b; }
      else SFX[name](arg);
    } catch (e) { /* 忽略 */ }
  }
  function render(name, arg) {
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
  }
  window.ZYSound = {
    play: play, unlock: audio, names: Object.keys(SFX), render: render,
    set: function (v) { on = !!v; }, get: function () { return on; }, setMute: function (v) { mute = !!v; }
  };
})();
