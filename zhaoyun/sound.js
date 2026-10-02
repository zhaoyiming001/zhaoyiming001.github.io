/* 赵云与阿斗 v5 · 声音（全部 Web Audio 实时合成，无音频文件）
 * 音效链：音色 → 高通 140Hz → 压缩 → 增益 → 汇总；音乐另走一条总线（音量单独可调），最后共用 tanh 软限幅。
 * 配乐：自作国风小曲——五声音阶（宫商角徵羽），古筝 / 琵琶用 Karplus-Strong 拨弦，笛子用带颤音和气声的正弦，
 * 大鼓、堂鼓、梆子、小锣、钹。大厅一曲、战斗一曲、首领波叠加一层鼓与低音，胜负各一段短曲。 */
(function () {
  'use strict';
  var sfxOn = true, musicOn = true, actx = null, nodes = null, noiseBufs = {}, mute = false;
  var vol = { m: 0.5, s: 1 };
  function softClip() {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
    return c;
  }
  // 两条总线：sfx（压缩、提响）与 music（温和），汇总后软限幅
  function buildChain(c) {
    var sum = c.createGain();
    var clip = c.createWaveShaper(); clip.curve = softClip(); clip.oversample = '2x';
    var out = c.createGain(); out.gain.value = 0.9;
    sum.connect(clip); clip.connect(out); out.connect(c.destination);
    var sfxIn = c.createGain(); sfxIn.gain.value = vol.s;
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 8; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.12;
    var mk = c.createGain(); mk.gain.value = 2.6;
    sfxIn.connect(hp); hp.connect(comp); comp.connect(mk); mk.connect(sum);
    var musIn = c.createGain(); musIn.gain.value = vol.m * 0.9;
    var mcomp = c.createDynamicsCompressor();
    mcomp.threshold.value = -18; mcomp.knee.value = 12; mcomp.ratio.value = 3; mcomp.attack.value = 0.01; mcomp.release.value = 0.25;
    var mhp = c.createBiquadFilter(); mhp.type = 'highpass'; mhp.frequency.value = 45;
    musIn.connect(mhp); mhp.connect(mcomp); mcomp.connect(sum);
    // 每首曲子各一个推子，交叉淡入淡出
    var tracks = {};
    ['lobby', 'battle', 'boss', 'sting'].forEach(function (k) { var g = c.createGain(); g.gain.value = 0; g.connect(musIn); tracks[k] = g; });
    tracks.sting.gain.value = 1;
    return { sfx: sfxIn, music: musIn, tracks: tracks, ctx: c };
  }
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { actx = new AC(); nodes = buildChain(actx); } catch (e) { actx = null; return false; }
    }
    if (actx.state === 'suspended' && !mute) actx.resume();
    return true;
  }
  // ---------- 基础音色（ctx / 目标节点可替换，便于离线渲染） ----------
  var C = null, OUT = null; // 当前上下文与目标
  function T(at) { return C.currentTime + (at || 0); }
  function osc(o) {
    var t0 = o.t0 != null ? o.t0 : T(o.at), d = o.d || 0.1;
    var n = C.createOscillator(), g = C.createGain();
    n.type = o.type || 'triangle';
    n.frequency.setValueAtTime(o.f, t0);
    if (o.f2) n.frequency.exponentialRampToValueAtTime(o.f2, t0 + d * (o.slide || 1));
    if (o.det) n.detune.value = o.det;
    var a = o.a || 0.004, v = o.v || 0.4;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    if (o.hold) g.gain.setValueAtTime(v, t0 + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    n.connect(g); g.connect(o.out || OUT);
    n.start(t0); n.stop(t0 + d + 0.03);
  }
  function noiseBuf() {
    var k = C.sampleRate;
    if (!noiseBufs[k] || noiseBufs[k].ctx !== C) {
      var b = C.createBuffer(1, C.sampleRate, C.sampleRate), dd = b.getChannelData(0);
      for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      noiseBufs[k] = { ctx: C, b: b };
    }
    return noiseBufs[k].b;
  }
  function noise(o) {
    var t0 = o.t0 != null ? o.t0 : T(o.at), d = o.d || 0.2;
    var s = C.createBufferSource(); s.buffer = noiseBuf();
    var f = C.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1500, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    var g = C.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.5, t0 + (o.a || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(o.out || OUT);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.03);
  }
  // ---------- 乐器 ----------
  // Karplus-Strong 拨弦：预先算好波形缓存（古筝亮而长、琵琶脆而短）
  var ksCache = {};
  function ksBuffer(freq, kind) {
    var sr = C.sampleRate, key = sr + '|' + kind + '|' + Math.round(freq * 10);
    var hit = ksCache[key];
    if (hit && hit.ctx === C) return hit.b;
    var dur = kind === 'zheng' ? 2.2 : kind === 'bass' ? 1.6 : 0.9;
    var n = Math.floor(sr * dur), b = C.createBuffer(1, n, sr), y = b.getChannelData(0);
    var N = Math.max(2, Math.round(sr / freq)), buf = new Float32Array(N);
    var R = mul(Math.round(freq * 7) + kind.length);
    // 拨弦起振：带一点低通的噪声 + 拨点（去掉部分谐波，像指甲拨在弦的一端）
    var lp = 0;
    for (var i = 0; i < N; i++) { lp = lp * 0.4 + (R() * 2 - 1) * 0.6; buf[i] = lp; }
    var pluckPos = kind === 'pipa' ? 0.12 : 0.2, pp = Math.max(1, Math.round(N * pluckPos));
    for (var j = N - 1; j >= pp; j--) buf[j] -= buf[j - pp] * 0.8;
    var decay = kind === 'zheng' ? 0.9965 : kind === 'bass' ? 0.996 : 0.991;
    var bright = kind === 'pipa' ? 0.62 : 0.5;
    var idx = 0;
    for (var k = 0; k < n; k++) {
      var cur = buf[idx], nxt = buf[(idx + 1) % N];
      var v = (cur * bright + nxt * (1 - bright)) * decay;
      buf[idx] = v; y[k] = cur; idx = (idx + 1) % N;
    }
    // 起音包络 + 归一
    var pk = 0; for (var q = 0; q < n; q++) pk = Math.max(pk, Math.abs(y[q]));
    for (var q2 = 0; q2 < n; q2++) y[q2] = y[q2] / (pk || 1) * Math.min(1, q2 / (sr * 0.002));
    ksCache[key] = { ctx: C, b: b };
    return b;
  }
  function pluck(f, t0, v, kind, out, bend) {
    var s = C.createBufferSource(); s.buffer = ksBuffer(f, kind || 'zheng');
    var g = C.createGain(); g.gain.value = v;
    var fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = kind === 'pipa' ? 5200 : 3600;
    if (bend) { s.playbackRate.setValueAtTime(1, t0 + 0.08); s.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t0 + 0.28); }
    s.connect(fl); fl.connect(g); g.connect(out || OUT);
    s.start(t0); s.stop(t0 + (kind === 'zheng' ? 2.2 : 1.0));
  }
  // 笛子：正弦 + 少量三角波，颤音、起音前的气声和滑音
  function flute(f, t0, d, v, out) {
    var o1 = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), lfo = C.createOscillator(), lg = C.createGain();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(f * 0.97, t0); o1.frequency.exponentialRampToValueAtTime(f, t0 + 0.06);
    o2.frequency.setValueAtTime(f * 0.97, t0); o2.frequency.exponentialRampToValueAtTime(f, t0 + 0.06);
    lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.012, t0 + Math.min(0.35, d * 0.6));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    var g2 = C.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.05);
    g.gain.setValueAtTime(v * 0.85, t0 + Math.max(0.06, d - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.12);
    g.connect(out || OUT);
    [o1, o2, lfo].forEach(function (o) { o.start(t0); o.stop(t0 + d + 0.15); });
    noise({ t0: t0, d: Math.min(0.14, d), f: f * 2.2, q: 2.5, v: v * 0.35, a: 0.02, out: out });
  }
  function bigDrum(t0, v, out) { osc({ t0: t0, type: 'sine', f: 95, f2: 46, d: 0.55, v: v, out: out }); osc({ t0: t0, type: 'sine', f: 190, f2: 80, d: 0.12, v: v * 0.5, out: out }); noise({ t0: t0, ft: 'lowpass', f: 900, f2: 120, d: 0.22, v: v * 0.55, out: out }); }
  function tangDrum(t0, v, out) { osc({ t0: t0, type: 'sine', f: 210, f2: 120, d: 0.2, v: v, out: out }); noise({ t0: t0, ft: 'bandpass', f: 1200, q: 0.8, d: 0.06, v: v * 0.5, out: out }); }
  function clapper(t0, v, out) { osc({ t0: t0, type: 'sine', f: 1850, f2: 1700, d: 0.05, v: v, out: out }); osc({ t0: t0, type: 'triangle', f: 920, d: 0.04, v: v * 0.4, out: out }); }
  function smallGong(t0, v, out) {
    // 小锣「匡」：音高下滑的非谐泛音
    [880, 1330, 1810, 2470].forEach(function (f, i) { osc({ t0: t0, type: 'sine', f: f, f2: f * 0.94, slide: 0.6, d: 0.9 - i * 0.12, v: v * (1 - i * 0.2), a: 0.003, out: out }); });
    noise({ t0: t0, f: 3000, f2: 1500, q: 0.7, d: 0.3, v: v * 0.5, out: out });
  }
  function bigGong(t0, v, out) {
    [180, 263, 340, 425, 560, 742].forEach(function (f, i) { osc({ t0: t0, type: 'sine', f: f, f2: f * (i < 2 ? 1.02 : 0.99), d: 2.6 - i * 0.25, v: v * (1 - i * 0.12), a: 0.01 + i * 0.01, out: out }); });
    noise({ t0: t0, ft: 'lowpass', f: 2200, f2: 300, d: 1.2, v: v * 0.35, out: out });
  }
  function cymbal(t0, v, out) { noise({ t0: t0, ft: 'highpass', f: 6000, q: 0.6, d: 0.55, v: v, out: out }); noise({ t0: t0, f: 4200, q: 1.5, d: 0.25, v: v * 0.6, out: out }); }
  function lowDrone(t0, f, d, v, out) {
    var o = C.createOscillator(), fl = C.createBiquadFilter(), g = C.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 420; fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.15); g.gain.setValueAtTime(v, t0 + d - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(fl); fl.connect(g); g.connect(out || OUT); o.start(t0); o.stop(t0 + d + 0.05);
  }

  // ---------- 作曲：五声音阶小曲（种子固定，可重现） ----------
  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var PENTA = [0, 2, 4, 7, 9];
  function deg(root, d) { var o = Math.floor(d / 5), k = ((d % 5) + 5) % 5; return root * Math.pow(2, (PENTA[k] + 12 * o) / 12); }
  // 一段旋律：起承转合，落在宫音；返回 [拍, 音级, 时值]
  function melody(R, bars, beatsPerBar, base) {
    var out = [], d = base, RH = [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2], [3, 1]];
    for (var b = 0; b < bars; b++) {
      var rh = RH[(R() * RH.length) | 0], beat = b * beatsPerBar;
      if (b % 4 === 3) rh = [2, 2];
      for (var i = 0; i < rh.length; i++) {
        var step = R() < 0.55 ? (R() < 0.5 ? 1 : -1) : R() < 0.5 ? (R() < 0.5 ? 2 : -2) : 0;
        d = Math.max(base - 3, Math.min(base + 6, d + step));
        if (b % 4 === 3 && i === rh.length - 1) d = b === bars - 1 ? base : base + 2; // 句尾落宫 / 徵
        out.push([beat, d, rh[i]]);
        beat += rh[i];
      }
    }
    return out;
  }
  var SONGS = {
    // 大厅：96 拍，古筝分解和弦 + 笛子长音，堂鼓轻点
    lobby: { bpm: 92, bars: 16, root: 293.66, seed: 11, build: function (R, s) {
      var ev = [], mel = melody(R, s.bars, 4, 5);
      mel.forEach(function (n) { ev.push({ b: n[0], k: 'flute', d: n[1], len: n[2], v: 0.16 }); });
      var prog = [0, 0, 3, 3, 4, 4, 2, 0];
      for (var b = 0; b < s.bars; b++) {
        var r = prog[b % prog.length];
        [0, 2, 4, 2, 5, 4, 2, 4].forEach(function (o, i) { ev.push({ b: b * 4 + i * 0.5, k: 'zheng', d: r + o - 5, v: i === 0 ? 0.3 : 0.18 }); });
        ev.push({ b: b * 4, k: 'bass', d: r - 10, v: 0.22 });
        if (b % 2 === 0) ev.push({ b: b * 4, k: 'tang', v: 0.12 });
        if (b % 8 === 7) ev.push({ b: b * 4 + 2, k: 'sgong', v: 0.07 });
      }
      return ev;
    } },
    // 战斗：116 拍，大鼓定音、堂鼓八分、琵琶快弹、笛子主旋律
    battle: { bpm: 116, bars: 16, root: 293.66, seed: 23, build: function (R, s) {
      var ev = [], mel = melody(R, s.bars, 4, 5);
      mel.forEach(function (n) { ev.push({ b: n[0], k: 'flute', d: n[1] + 5, len: n[2] * 0.95, v: 0.13 }); });
      var prog = [0, 0, 4, 3, 0, 0, 2, 4];
      for (var b = 0; b < s.bars; b++) {
        var r = prog[b % prog.length], t = b * 4;
        ev.push({ b: t, k: 'drum', v: 0.5 }, { b: t + 1.5, k: 'drum', v: 0.32 }, { b: t + 2, k: 'drum', v: 0.45 });
        for (var i = 0; i < 8; i++) ev.push({ b: t + i * 0.5, k: 'tang', v: i % 2 ? 0.07 : 0.12 });
        ev.push({ b: t + 1, k: 'clap', v: 0.08 }, { b: t + 3, k: 'clap', v: 0.08 });
        [0, 0, 2, 0, 4, 2, 0, 2].forEach(function (o, i) { ev.push({ b: t + i * 0.5, k: 'pipa', d: r + o, v: i % 4 === 0 ? 0.22 : 0.13 }); });
        ev.push({ b: t, k: 'bass', d: r - 10, v: 0.3 }, { b: t + 2, k: 'bass', d: r - 5 - 5, v: 0.22 });
        if (b % 4 === 0) ev.push({ b: t, k: 'cym', v: 0.08 });
        if (b % 4 === 3) ev.push({ b: t + 3, k: 'sgong', v: 0.09 }, { b: t + 3.5, k: 'tang', v: 0.14 }, { b: t + 3.75, k: 'tang', v: 0.16 });
      }
      return ev;
    } },
    // 首领波叠加：鼓滚 + 低音持续 + 钹
    boss: { bpm: 116, bars: 8, root: 293.66, seed: 31, build: function (R, s) {
      var ev = [];
      for (var b = 0; b < s.bars; b++) {
        var t = b * 4;
        for (var i = 0; i < 16; i++) ev.push({ b: t + i * 0.25, k: 'tang', v: i % 4 === 0 ? 0.16 : 0.07 });
        ev.push({ b: t, k: 'drum', v: 0.6 }, { b: t + 2, k: 'drum', v: 0.5 }, { b: t + 3, k: 'drum', v: 0.4 }, { b: t + 3.5, k: 'drum', v: 0.45 });
        ev.push({ b: t, k: 'drone', d: b % 2 ? -12 : -10, len: 4, v: 0.08 });
        if (b % 2 === 0) ev.push({ b: t, k: 'cym', v: 0.11 });
      }
      return ev;
    } }
  };
  var built = {};
  function song(name) {
    if (!built[name]) { var s = SONGS[name]; built[name] = { ev: s.build(mul(s.seed), s), spb: 60 / s.bpm, len: s.bars * 4 * 60 / s.bpm, root: s.root }; built[name].ev.sort(function (a, b) { return a.b - b.b; }); }
    return built[name];
  }
  function playEv(e, t0, S, out) {
    var f = e.d != null ? deg(S.root, e.d) : 0;
    switch (e.k) {
      case 'flute': flute(f, t0, e.len * S.spb, e.v, out); break;
      case 'zheng': pluck(f, t0, e.v, 'zheng', out); break;
      case 'pipa': pluck(f, t0, e.v, 'pipa', out); break;
      case 'bass': pluck(f, t0, e.v, 'bass', out); break;
      case 'drum': bigDrum(t0, e.v, out); break;
      case 'tang': tangDrum(t0, e.v, out); break;
      case 'clap': clapper(t0, e.v, out); break;
      case 'sgong': smallGong(t0, e.v, out); break;
      case 'cym': cymbal(t0, e.v, out); break;
      case 'drone': lowDrone(t0, f, e.len * S.spb, e.v, out); break;
    }
  }
  // 把一首曲子在 [from, to) 内的音符排进时间线（loopStart 为循环起点）
  function schedule(name, loopStart, from, to, out) {
    var S = song(name), L = S.len;
    var k0 = Math.floor((from - loopStart) / L);
    for (var k = Math.max(0, k0); loopStart + k * L < to; k++) {
      var base = loopStart + k * L;
      for (var i = 0; i < S.ev.length; i++) {
        var t = base + S.ev[i].b * S.spb;
        if (t >= from && t < to) playEv(S.ev[i], t, S, out);
      }
    }
  }
  // ---------- 实时播放：前瞻调度 ----------
  var cur = { name: null, start: 0, done: 0 }, boss = { on: false, start: 0, done: 0 }, timer = null, paused = false;
  function withCtx(fn) { var pc = C, po = OUT; C = actx; try { fn(); } finally { C = pc; OUT = po; } }
  function tick() {
    if (!actx || paused || !musicOn || mute) return;
    var now = actx.currentTime, ahead = now + 0.35;
    withCtx(function () {
      if (cur.name) { schedule(cur.name, cur.start, Math.max(cur.done, now), ahead, nodes.tracks[cur.name]); cur.done = ahead; }
      if (boss.on) { schedule('boss', boss.start, Math.max(boss.done, now), ahead, nodes.tracks.boss); boss.done = ahead; }
    });
  }
  function fade(g, to, sec) { var t = actx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(to, t + sec); }
  function music(name) {
    if (!audio()) return;
    if (cur.name === name) return;
    if (cur.name) fade(nodes.tracks[cur.name], 0, 1.2);
    if (name !== 'battle') setBoss(false);
    cur = { name: name, start: actx.currentTime + 0.1, done: actx.currentTime + 0.1 };
    if (name) fade(nodes.tracks[name], 1, 1.2);
    if (!timer) timer = setInterval(tick, 90);
    tick();
  }
  function setBoss(on) {
    if (!actx || boss.on === !!on) return;
    boss.on = !!on;
    if (on) {
      // 与战斗曲对齐到小节
      var S = song('battle'), bar = S.spb * 4, t = actx.currentTime, k = Math.ceil((t - cur.start) / bar);
      boss.start = cur.start + k * bar; boss.done = boss.start;
      fade(nodes.tracks.boss, 1, 1.5);
    } else fade(nodes.tracks.boss, 0, 1.5);
  }
  function sting(win) {
    if (!audio() || !musicOn) return;
    if (cur.name) fade(nodes.tracks[cur.name], 0.15, 0.4);
    setBoss(false);
    withCtx(function () { OUT = nodes.tracks.sting; STINGS[win ? 'win' : 'lose'](actx.currentTime + 0.05); });
  }
  var STINGS = {
    win: function (t0) {
      bigGong(t0, 0.25); bigDrum(t0, 0.5); bigDrum(t0 + 0.3, 0.4); bigDrum(t0 + 0.45, 0.45);
      [0, 2, 4, 5, 7].forEach(function (d, i) { flute(deg(293.66, d + 5), t0 + 0.2 + i * 0.16, i === 4 ? 1.2 : 0.18, 0.2); pluck(deg(293.66, d), t0 + 0.2 + i * 0.16, 0.3, 'pipa'); });
      [0, 2, 4].forEach(function (d) { pluck(deg(293.66, d), t0 + 1.0, 0.3, 'zheng'); });
      cymbal(t0 + 1.0, 0.12);
    },
    lose: function (t0) {
      bigDrum(t0, 0.5); bigDrum(t0 + 0.6, 0.35);
      [4, 3, 2, 0].forEach(function (d, i) { flute(deg(293.66, d + 2), t0 + 0.15 + i * 0.35, i === 3 ? 1.3 : 0.32, 0.17); });
      pluck(deg(293.66, -5), t0 + 1.2, 0.35, 'bass'); smallGong(t0 + 1.25, 0.08);
    }
  };

  // ---------- 音效 ----------
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
    osc({ type: 'triangle', f: 2300, f2: 1700, d: 0.035, v: v || 0.55, at: at });
    noise({ ft: 'highpass', f: 3800, q: 0.7, d: 0.03, v: (v || 0.55) * 0.8, at: at });
    osc({ type: 'sine', f: 1150, f2: 900, d: 0.05, v: (v || 0.55) * 0.45, at: at });
  }
  function whoosh(at, v, f0, f1, d) { noise({ f: f0 || 700, f2: f1 || 2600, q: 0.9, d: d || 0.16, v: v || 0.35, a: 0.05, at: at }); }
  function shout(at, v) {
    // 「哈！」：带共振峰的短促人声感（锯齿波 → 两个带通）
    var t0 = T(at), o = C.createOscillator(), f1 = C.createBiquadFilter(), f2 = C.createBiquadFilter(), g = C.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(150, t0 + 0.3);
    f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.8, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(OUT); o.start(t0); o.stop(t0 + 0.35);
    noise({ f: 1400, q: 1.2, d: 0.08, v: (v || 0.8) * 0.4, at: at });
  }
  var SFX = {
    click: function () { clack(0, 0.45); },
    pick: function () { clack(0, 0.35); },
    // 落子（soldier_set）：木牌落地「笃」+ 轻嗒
    place: function () { osc({ type: 'sine', f: 420, f2: 210, d: 0.09, v: 0.5 }); clack(0.01, 0.45); },
    // 征兵（soldier_create）：一声鼓 + 号角短音 + 发牌声
    summon: function () { drumHit(0, false, 0.65); osc({ type: 'sawtooth', f: 392, f2: 440, d: 0.22, v: 0.12, a: 0.03 }); osc({ type: 'triangle', f: 784, f2: 880, d: 0.22, v: 0.2, a: 0.03 }); for (var i = 0; i < 4; i++) clack(0.12 + i * 0.06, 0.3); },
    discard: function () { noise({ f: 900, f2: 2600, q: 0.6, d: 0.25, v: 0.3 }); },
    // 合成升阶：音高随阶升高
    merge: function (lv) {
      var f = 440 * Math.pow(1.26, (lv || 2) - 2);
      clack(0, 0.55);
      osc({ type: 'square', f: f, f2: f * 1.9, d: 0.1, v: 0.26 });
      osc({ type: 'triangle', f: f * 2, f2: f * 3, d: 0.09, v: 0.4 });
      osc({ type: 'sine', f: f * 3, d: 0.25, v: 0.22, at: 0.07 });
      if (lv >= 3) note(f * 2, 0.12, 0.16, 0.28);
      if (lv >= 4) { note(f * 2.5, 0.2, 0.26, 0.3); gong(0.1, 0.22); }
    },
    // 成将：大锣 + 合唱般的长音 + 一声「哈」
    general: function () {
      gong(0, 0.4);
      [392, 494, 587, 784].forEach(function (f, i) { osc({ type: 'sawtooth', f: f, d: 1.1, v: 0.05, a: 0.18, hold: 0.4, at: 0.05 }); osc({ type: 'sine', f: f, d: 1.2, v: 0.12, a: 0.15, hold: 0.45, at: 0.05 + i * 0.02 }); });
      shout(0.32, 0.75); drumHit(0.32, true, 0.6);
    },
    synergy: function () { gong(0, 0.4); drumHit(0.05, true); [659, 784, 988, 1319, 1568].forEach(function (f, i) { note(f, 0.15 + i * 0.09, i === 4 ? 0.6 : 0.14, 0.34, 0.4); }); },
    // 刀：破风 + 金属「锵」
    blade: function () { whoosh(0, 0.42, 600, 3200, 0.12); [2800, 4100, 5300].forEach(function (f, i) { osc({ type: 'sine', f: f, f2: f * 0.98, d: 0.22 - i * 0.04, v: 0.16 - i * 0.03, at: 0.09 }); }); noise({ ft: 'highpass', f: 5000, d: 0.05, v: 0.25, at: 0.09 }); },
    // 枪：短促一刺
    spear: function () { noise({ f: 1400, f2: 4200, q: 1.8, d: 0.06, v: 0.4 }); osc({ type: 'triangle', f: 900, f2: 1500, d: 0.05, v: 0.2 }); osc({ type: 'sine', f: 220, f2: 140, d: 0.06, v: 0.25, at: 0.04 }); },
    // 弓：弦响「嘣」+ 箭啸
    bow: function () { osc({ type: 'triangle', f: 196, f2: 180, d: 0.18, v: 0.45 }); osc({ type: 'sawtooth', f: 392, f2: 360, d: 0.1, v: 0.08 }); noise({ f: 3800, f2: 2200, q: 6, d: 0.22, v: 0.16, a: 0.02, at: 0.03 }); },
    // 骑：马蹄三连 + 一声兵刃相交
    hoof: function () { [0, 0.07, 0.14].forEach(function (a) { osc({ type: 'sine', f: 520, f2: 240, d: 0.06, v: 0.3, at: a }); noise({ ft: 'lowpass', f: 1600, d: 0.05, v: 0.26, at: a }); }); [2400, 3500].forEach(function (f) { osc({ type: 'square', f: f, f2: f * 0.97, d: 0.12, v: 0.05, at: 0.2 }); }); noise({ ft: 'highpass', f: 3000, d: 0.06, v: 0.25, at: 0.2 }); },
    shield: function () { osc({ type: 'sine', f: 380, f2: 220, d: 0.16, v: 0.4 }); noise({ ft: 'lowpass', f: 1200, f2: 400, d: 0.12, v: 0.35 }); },
    fire: function () { noise({ f: 800, f2: 2400, q: 0.7, d: 0.18, v: 0.32 }); osc({ type: 'triangle', f: 620, f2: 900, d: 0.08, v: 0.08 }); },
    drum: function () { drumHit(0, false, 0.5); },
    bolt: function () { osc({ type: 'sawtooth', f: 900, f2: 480, d: 0.08, v: 0.16 }); noise({ f: 1800, f2: 3400, q: 2, d: 0.07, v: 0.24 }); },
    catapult: function () { osc({ type: 'triangle', f: 300, f2: 520, d: 0.12, v: 0.25 }); noise({ f: 700, f2: 1500, q: 0.8, d: 0.12, v: 0.25 }); },
    boom: function () { noise({ ft: 'lowpass', f: 3000, f2: 200, d: 0.5, v: 0.85 }); osc({ type: 'sine', f: 300, f2: 90, d: 0.35, v: 0.7 }); noise({ f: 900, q: 0.8, d: 0.25, v: 0.4, at: 0.05 }); },
    chain: function () { [1500, 1800, 1500, 2000].forEach(function (f, i) { osc({ type: 'square', f: f, d: 0.05, v: 0.15, at: i * 0.06 }); }); },
    // 敌人中招：「啪」
    hit: function () { noise({ f: 1600, f2: 700, q: 1.1, d: 0.05, v: 0.26 }); osc({ type: 'sine', f: 300, f2: 160, d: 0.04, v: 0.18 }); },
    // 敌人阵亡：「噗」一团烟
    kill: function () { noise({ ft: 'lowpass', f: 1800, f2: 300, d: 0.16, v: 0.36, a: 0.01 }); osc({ type: 'sine', f: 520, f2: 180, d: 0.1, v: 0.16 }); },
    bossdown: function () { noise({ ft: 'lowpass', f: 4200, f2: 300, d: 0.7, v: 0.9 }); osc({ type: 'sawtooth', f: 440, f2: 140, d: 0.6, v: 0.4 }); note(1047, 0.25, 0.14, 0.35); note(1319, 0.35, 0.14, 0.35); note(1568, 0.45, 0.3, 0.38); },
    // 阿斗挨打：滑稽的「哎哟」两声下滑
    hurt: function () { osc({ type: 'square', f: 880, f2: 520, d: 0.16, v: 0.22 }); osc({ type: 'triangle', f: 880, f2: 520, d: 0.18, v: 0.45 }); osc({ type: 'square', f: 700, f2: 330, d: 0.24, v: 0.2, at: 0.17 }); osc({ type: 'triangle', f: 700, f2: 330, d: 0.26, v: 0.42, at: 0.17 }); drumHit(0, true, 0.55); },
    foehurt: function () { note(1319, 0, 0.08, 0.28); note(1568, 0.07, 0.12, 0.28); },
    heal: function () { [1047, 1319, 1568, 2093].forEach(function (f, i) { osc({ type: 'sine', f: f, d: 0.4, v: 0.22, at: i * 0.06 }); }); },
    // 一波开始：鼓滚
    wave: function () { for (var i = 0; i < 10; i++) drumHit(i * 0.055, false, 0.25 + i * 0.05); drumHit(0.6, true, 0.95); },
    boss: function () { drumHit(0, true); drumHit(0.32, true); drumHit(0.64, true); osc({ type: 'sawtooth', f: 233, d: 0.9, v: 0.32, at: 0.1, hold: 0.4 }); osc({ type: 'sawtooth', f: 466, f2: 440, d: 0.9, v: 0.18, at: 0.1, hold: 0.4 }); },
    dig: function () { noise({ ft: 'lowpass', f: 2200, f2: 500, d: 0.16, v: 0.7 }); osc({ type: 'triangle', f: 640, f2: 320, d: 0.08, v: 0.4 }); noise({ f: 900, q: 1, d: 0.14, v: 0.45, at: 0.11 }); },
    recycle: function () { note(1319, 0, 0.08, 0.35); note(1760, 0.07, 0.14, 0.35); },
    // 农民产馒头：清脆的铜钱声
    farm: function () { osc({ type: 'sine', f: 2637, d: 0.12, v: 0.22 }); osc({ type: 'sine', f: 3520, d: 0.16, v: 0.16, at: 0.05 }); },
    error: function () { osc({ type: 'sawtooth', f: 330, f2: 300, d: 0.09, v: 0.3 }); osc({ type: 'sawtooth', f: 250, f2: 220, d: 0.14, v: 0.3, at: 0.1 }); },
    flood: function () { noise({ ft: 'lowpass', f: 900, f2: 2600, d: 1.0, v: 0.6, q: 0.5 }); },
    star: function (i) { drumHit(0, true, 0.7); note(988 * Math.pow(1.26, i || 0), 0.03, 0.2, 0.35); },
    write: function () { noise({ f: 2400, f2: 1200, q: 0.8, d: 0.12, v: 0.12 }); },
    skill: function (k) {
      noise({ f: 600, f2: 3000, q: 1, d: 0.25, v: 0.5 });
      shout(0.02, 0.55);
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
    // 首领出手：沉重一刀
    bossAct: function () { whoosh(0, 0.5, 300, 1600, 0.22); osc({ type: 'sawtooth', f: 160, f2: 70, d: 0.4, v: 0.4, at: 0.15 }); drumHit(0.15, true, 0.8); noise({ ft: 'highpass', f: 2500, d: 0.12, v: 0.3, at: 0.15 }); },
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
  // 同类音效最短间隔（秒）；默认 0.08
  var RATE = { blade: 0.08, spear: 0.08, hoof: 0.12, bow: 0.08, bolt: 0.1, fire: 0.1, hit: 0.09, kill: 0.07, drum: 0.25, shield: 0.2, catapult: 0.15, boom: 0.12, write: 0.08, place: 0.05, foehurt: 0.3, farm: 0.15, merge: 0.06 };
  var LOW = { hit: 1, kill: 1, blade: 1, spear: 1, bow: 1, hoof: 1, write: 1, foehurt: 1, farm: 1, fire: 1, bolt: 1 };
  var last = {}, voices = [];
  // 上半场（对手）的音效更轻；同时最多 10 个音效，多了先丢掉普通攻击声
  function play(name, arg, quiet) {
    if (!sfxOn || mute || !SFX[name]) return;
    var now = performance.now() / 1000;
    if (now - (last[name] || 0) < (RATE[name] || 0.08) * (quiet ? 2 : 1)) return;
    voices = voices.filter(function (t) { return t > now; });
    if (voices.length >= 10 && LOW[name]) return;
    last[name] = now; voices.push(now + 0.25);
    if (!audio()) return;
    var pc = C, po = OUT;
    C = actx; OUT = nodes.sfx;
    try {
      if (quiet) { var g = actx.createGain(); g.gain.value = 0.35; g.connect(nodes.sfx); OUT = g; }
      SFX[name](arg);
    } catch (e) { /* 忽略 */ } finally { C = pc; OUT = po; }
  }
  // ---------- 离线渲染（测试响度 / 导出演示 WAV） ----------
  function render(name, arg) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new OAC(1, 44100 * 2, 44100), ch = buildChain(off);
    var pc = C, po = OUT; C = off; OUT = ch.sfx;
    try { SFX[name](arg); } finally { C = pc; OUT = po; }
    return off.startRendering().then(function (buf) { return stats(buf.getChannelData(0)); });
  }
  function stats(d) {
    var peak = 0, sum = 0, n = 0;
    for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 0.001) { sum += d[i] * d[i]; n++; } }
    return { peak: peak, rms: n ? Math.sqrt(sum / n) : 0, ms: Math.round(n / 44.1) };
  }
  // 演示：大厅曲 → 战斗曲 → 首领层 → 胜 / 负短曲 → 逐个音效。返回 { buf: Float32Array, sr, marks }
  function renderDemo(o) {
    o = o || {};
    var sr = 44100, segs = o.segs || { lobby: 22, battle: 22, boss: 14 };
    var sfxList = o.sfx || ['click', 'summon', 'place', 'merge:2', 'merge:3', 'merge:4', 'merge:5', 'general', 'blade', 'bow', 'spear', 'hoof', 'hit', 'kill', 'hurt', 'bossAct', 'wave', 'boss', 'farm', 'dig', 'recycle', 'error', 'win', 'lose'];
    var total = segs.lobby + segs.battle + segs.boss + 5 + 5 + sfxList.length * 0.9 + 2;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new OAC(1, Math.ceil(sr * total), sr), ch = buildChain(off), marks = [];
    var pc = C, po = OUT; C = off;
    try {
      var t = 0.2;
      ch.tracks.lobby.gain.value = 1; marks.push(['大厅曲', t]); OUT = ch.tracks.lobby; schedule('lobby', t, t, t + segs.lobby, ch.tracks.lobby);
      ch.tracks.lobby.gain.setValueAtTime(1, t + segs.lobby - 1.5); ch.tracks.lobby.gain.linearRampToValueAtTime(0, t + segs.lobby);
      t += segs.lobby;
      ch.tracks.battle.gain.setValueAtTime(0, t - 1); ch.tracks.battle.gain.linearRampToValueAtTime(1, t); marks.push(['战斗曲', t]);
      schedule('battle', t, t, t + segs.battle + segs.boss, ch.tracks.battle);
      var bs = t + segs.battle; marks.push(['首领波（叠加鼓与低音）', bs]);
      ch.tracks.boss.gain.setValueAtTime(0, bs); ch.tracks.boss.gain.linearRampToValueAtTime(1, bs + 1);
      schedule('boss', bs, bs, bs + segs.boss, ch.tracks.boss);
      ch.tracks.battle.gain.setValueAtTime(1, bs + segs.boss - 1); ch.tracks.battle.gain.linearRampToValueAtTime(0, bs + segs.boss);
      ch.tracks.boss.gain.setValueAtTime(1, bs + segs.boss - 1); ch.tracks.boss.gain.linearRampToValueAtTime(0, bs + segs.boss);
      t = bs + segs.boss + 0.3;
      OUT = ch.tracks.sting; marks.push(['胜利短曲', t]); STINGS.win(t); t += 5;
      marks.push(['失败短曲', t]); STINGS.lose(t); t += 5;
      OUT = ch.sfx;
      sfxList.forEach(function (n) {
        var parts = n.split(':'), nm = parts[0], arg = parts[1] != null ? +parts[1] : null;
        marks.push(['音效 ' + n, t]);
        var save = C.currentTime; void save;
        // 把 SFX 的「at」相对时间平移到 t：临时包一层 T()
        var shift = t;
        var oldT = T; T = function (at) { return shift + (at || 0); };
        try { SFX[nm](arg); } finally { T = oldT; }
        t += 0.9;
      });
    } finally { C = pc; OUT = po; }
    return off.startRendering().then(function (buf) { var d = buf.getChannelData(0); return { buf: d, sr: sr, marks: marks, stats: stats(d), seconds: d.length / sr }; });
  }
  function wav(d, sr) {
    var n = d.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    function s(o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return b;
  }
  function applyVol() {
    if (!nodes) return;
    var t = actx.currentTime;
    nodes.sfx.gain.setTargetAtTime(sfxOn ? vol.s : 0, t, 0.05);
    nodes.music.gain.setTargetAtTime(musicOn && !paused ? vol.m * 0.9 : 0, t, 0.15);
  }
  window.ZYSound = {
    play: play, unlock: function () { var ok = audio(); if (ok && cur.name && !timer) timer = setInterval(tick, 90); return ok; }, names: Object.keys(SFX), render: render, renderDemo: renderDemo, wav: wav,
    music: music, boss: setBoss, sting: sting,
    pauseMusic: function (p) { paused = !!p; if (!actx) return; applyVol(); if (!p) { var now = actx.currentTime; if (cur.name) { var S = song(cur.name); cur.start += Math.ceil(Math.max(0, now - cur.done) / S.len) * S.len; cur.done = now; } boss.done = now; } },
    set: function (v) { sfxOn = !!v; applyVol(); }, get: function () { return sfxOn; },
    setMusic: function (v) { musicOn = !!v; applyVol(); if (musicOn && actx) { cur.done = actx.currentTime; boss.done = actx.currentTime; } }, getMusic: function () { return musicOn; },
    setVol: function (m, s) { if (m != null) vol.m = Math.max(0, Math.min(1, m)); if (s != null) vol.s = Math.max(0, Math.min(1, s)); applyVol(); }, getVol: function () { return { m: vol.m, s: vol.s }; },
    setMute: function (v) { mute = !!v; if (actx) { if (mute) actx.suspend(); else actx.resume(); } },
    state: function () { return { ctx: actx ? actx.state : 'none', song: cur.name, boss: boss.on, music: musicOn, sfx: sfxOn, vol: vol, paused: paused }; }
  };
})();
