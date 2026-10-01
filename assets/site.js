/* 格子乐园 · 全站公共脚本
 * - 主题切换（.theme-toggle）
 * - 安全的本地存储 Site.store
 * - 弹窗：[data-open="id"] 打开 <dialog id="id">，[data-close] 或点击遮罩关闭
 * - 首页数据：Site.played(slug) 记录最近玩过，Site.setHomeStat(slug, text) 设置首页卡片上的成绩
 */
(function () {
  var THEME_KEY = 'gzly.theme';

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { /* 隐私模式等情况下忽略 */ }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  var saved = store.get(THEME_KEY, null);
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function openDialog(id) {
    var d = document.getElementById(id);
    if (!d) return;
    if (typeof d.showModal === 'function') {
      if (!d.open) {
        d.showModal();
        // 让焦点落在弹窗本身，避免关闭按钮在触屏上出现焦点框
        d.setAttribute('tabindex', '-1');
        d.focus();
      }
    } else {
      d.setAttribute('open', '');
    }
  }

  function closeDialog(d) {
    if (!d) return;
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;

    var themeBtn = t.closest('.theme-toggle');
    if (themeBtn) {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set(THEME_KEY, next);
      document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
      return;
    }

    var opener = t.closest('[data-open]');
    if (opener) {
      openDialog(opener.getAttribute('data-open'));
      return;
    }

    var closer = t.closest('[data-close]');
    if (closer) {
      closeDialog(closer.closest('dialog'));
      return;
    }

    // 点击遮罩（dialog 自身而非内容）关闭
    if (t.tagName === 'DIALOG' && t.open) {
      var r = t.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialog(t);
    }
  });

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  // ---------- 音效（Web Audio 实时合成，无需音频文件） ----------
  // 信号链：各音色 → 总线 → 高通(去掉手机喇叭放不出的低频) → 压缩 → 增益 → 软限幅 → 输出
  // 频率尽量放在 500Hz~3kHz，手机外放听得清；压缩 + 软限幅让声音更响又不破音
  var SOUND_KEY = 'gzly.sound';
  var soundOn = store.get(SOUND_KEY, true) !== false;
  var liveCtx = null;
  var liveBus = null;
  var ctx = null;   // 当前渲染目标（实时或离线测试）
  var bus = null;
  var noiseBufs = typeof WeakMap === 'function' ? new WeakMap() : null;

  function softClipCurve() {
    var n = 2048;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    return curve;
  }

  function buildChain(c) {
    var input = c.createGain();
    input.gain.value = 1;
    var hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 140;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 8;
    comp.ratio.value = 10;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    var makeup = c.createGain();
    makeup.gain.value = 2.6;
    var clip = c.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = '2x';
    input.connect(hp);
    hp.connect(comp);
    comp.connect(makeup);
    makeup.connect(clip);
    clip.connect(c.destination);
    return input;
  }

  function audio() {
    if (!liveCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        liveCtx = new AC();
        liveBus = buildChain(liveCtx);
      } catch (e) {
        liveCtx = null;
        return false;
      }
    }
    if (liveCtx.state === 'suspended') liveCtx.resume();
    ctx = liveCtx;
    bus = liveBus;
    return true;
  }

  // 振荡器：type 波形，f→f2 频率滑动，d 时长，v 音量，at 延迟，a 起音时间
  function osc(o) {
    var t0 = ctx.currentTime + (o.at || 0);
    var d = o.d || 0.1;
    var node = ctx.createOscillator();
    var g = ctx.createGain();
    node.type = o.type || 'triangle';
    node.frequency.setValueAtTime(o.f, t0);
    if (o.f2) node.frequency.exponentialRampToValueAtTime(o.f2, t0 + d * (o.slide || 1));
    var a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.4, t0 + a);
    if (o.hold) g.gain.setValueAtTime(o.v || 0.4, t0 + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    node.connect(g);
    g.connect(bus);
    node.start(t0);
    node.stop(t0 + d + 0.03);
  }

  // 噪声：ft 滤波类型，f→f2 滤波频率，q，d 时长，v 音量
  function noise(o) {
    var buf = noiseBufs && noiseBufs.get(ctx);
    if (!buf) {
      buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      if (noiseBufs) noiseBufs.set(ctx, buf);
    }
    var t0 = ctx.currentTime + (o.at || 0);
    var d = o.d || 0.2;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = o.ft || 'bandpass';
    filter.Q.value = o.q || 1;
    filter.frequency.setValueAtTime(o.f || 1500, t0);
    if (o.f2) filter.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.5, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + d + 0.03);
  }

  // 两层音色（三角波打底 + 方波增加亮度）的音符
  function note(f, at, d, v, bright) {
    osc({ type: 'triangle', f: f, d: d, v: v, at: at });
    osc({ type: 'square', f: f, d: d * 0.8, v: v * (bright || 0.28), at: at });
  }

  var SOUNDS = {
    // 界面按钮：清脆的“哒”
    click: function () {
      osc({ type: 'triangle', f: 1100, f2: 1500, d: 0.05, v: 0.6 });
      noise({ f: 4200, q: 2, d: 0.02, v: 0.3 });
    },
    // 选中格子：轻快“叮”
    select: function () {
      osc({ type: 'sine', f: 1320, f2: 1600, d: 0.06, v: 0.55 });
      osc({ type: 'triangle', f: 2640, d: 0.035, v: 0.18 });
    },
    // 滑动：短促“嗖”
    move: function () {
      noise({ f: 900, f2: 2600, q: 1.4, d: 0.09, v: 0.7 });
      osc({ type: 'triangle', f: 560, f2: 440, d: 0.06, v: 0.25 });
    },
    // 合并：气泡“啵”，数字越大音越高
    merge: function (n) {
      var k = Math.max(1, Math.min(n || 1, 16));
      var f = 420 * Math.pow(2, (k - 1) / 9);
      osc({ type: 'square', f: f, f2: f * 1.9, d: 0.09, v: 0.3 });
      osc({ type: 'triangle', f: f * 2, f2: f * 3, d: 0.08, v: 0.45 });
      noise({ f: 3000, q: 1.5, d: 0.025, v: 0.25 });
      if (k >= 7) osc({ type: 'sine', f: f * 4, d: 0.12, v: 0.25, at: 0.05 });
    },
    // 落子 / 填数：木头“哒”
    place: function () {
      osc({ type: 'triangle', f: 860, f2: 430, d: 0.075, v: 0.7 });
      osc({ type: 'sine', f: 1720, f2: 900, d: 0.035, v: 0.35 });
      noise({ f: 2600, q: 2.2, d: 0.035, v: 0.5 });
    },
    // 翻牌：纸牌“唰”
    flip: function () {
      noise({ f: 1800, f2: 5200, q: 0.9, d: 0.075, v: 0.65 });
      osc({ type: 'triangle', f: 700, f2: 1150, d: 0.055, v: 0.3 });
    },
    // 配对 / 完成一行：欢快三连音
    match: function () {
      note(1047, 0, 0.13, 0.42);
      note(1319, 0.07, 0.13, 0.42);
      note(1568, 0.14, 0.2, 0.45);
      osc({ type: 'sine', f: 2093, d: 0.18, v: 0.25, at: 0.2 });
    },
    // 出错：两声“嘟嘟”
    error: function () {
      osc({ type: 'sawtooth', f: 330, f2: 300, d: 0.09, v: 0.32 });
      osc({ type: 'sawtooth', f: 250, f2: 220, d: 0.15, v: 0.32, at: 0.1 });
    },
    // 扫雷翻开：轻“噗”
    reveal: function () {
      osc({ type: 'sine', f: 950, f2: 1450, d: 0.05, v: 0.5 });
      noise({ f: 2200, q: 1.5, d: 0.03, v: 0.3 });
    },
    // 插旗：上扬“叮”
    flag: function () {
      osc({ type: 'triangle', f: 880, f2: 1760, d: 0.09, v: 0.55, slide: 0.5 });
      osc({ type: 'square', f: 1760, d: 0.06, v: 0.12, at: 0.05 });
    },
    // 爆炸：轰隆 + 碎响
    boom: function () {
      noise({ ft: 'lowpass', f: 5000, f2: 140, q: 0.7, d: 0.9, v: 1 });
      osc({ type: 'sawtooth', f: 220, f2: 50, d: 0.6, v: 0.55 });
      noise({ f: 900, q: 0.8, d: 0.45, v: 0.5, at: 0.06 });
      osc({ type: 'square', f: 110, f2: 60, d: 0.35, v: 0.25, at: 0.02 });
    },
    // 旋转：“咻”
    rotate: function () {
      osc({ type: 'triangle', f: 620, f2: 1150, d: 0.06, v: 0.5 });
      noise({ f: 3200, q: 2, d: 0.03, v: 0.22 });
    },
    // 落地：沉闷“咚”
    drop: function () {
      osc({ type: 'sine', f: 480, f2: 120, d: 0.14, v: 0.85 });
      osc({ type: 'triangle', f: 300, f2: 100, d: 0.12, v: 0.45 });
      noise({ ft: 'lowpass', f: 2400, f2: 300, d: 0.1, v: 0.65 });
    },
    // 消行：上行琶音，消得越多越长越亮
    line: function (n) {
      var notes = [784, 988, 1175, 1568, 1976];
      var count = Math.min(notes.length, 2 + Math.max(1, n || 1));
      for (var i = 0; i < count; i++) note(notes[i], i * 0.055, 0.14, 0.38, 0.35);
      if ((n || 1) >= 4) {
        [1568, 1976, 2349].forEach(function (f) { osc({ type: 'triangle', f: f, d: 0.4, v: 0.22, at: count * 0.055 }); });
      }
    },
    // 吃到食物：“啊呜”
    eat: function () {
      osc({ type: 'square', f: 520, f2: 1040, d: 0.07, v: 0.3 });
      osc({ type: 'triangle', f: 1040, f2: 1560, d: 0.07, v: 0.4, at: 0.03 });
    },
    // 计时滴答
    tick: function () {
      osc({ type: 'sine', f: 1800, d: 0.03, v: 0.35 });
    },
    // 胜利：小号角 + 和弦
    win: function () {
      var lead = [784, 1047, 1319, 1568];
      lead.forEach(function (f, i) { note(f, i * 0.11, 0.17, 0.42, 0.4); });
      [1047, 1319, 1568, 2093].forEach(function (f) {
        osc({ type: 'triangle', f: f, d: 0.75, v: 0.24, at: 0.46, hold: 0.25 });
        osc({ type: 'square', f: f, d: 0.6, v: 0.06, at: 0.46 });
      });
    },
    // 失败：下行“哇哇哇”
    lose: function () {
      note(659, 0, 0.2, 0.42, 0.3);
      note(587, 0.2, 0.2, 0.42, 0.3);
      note(523, 0.4, 0.2, 0.42, 0.3);
      osc({ type: 'triangle', f: 466, f2: 349, d: 0.6, v: 0.45, at: 0.6, hold: 0.15 });
      osc({ type: 'square', f: 466, f2: 349, d: 0.5, v: 0.12, at: 0.6 });
    },
    // 开局：“预备—开始”
    start: function () {
      note(659, 0, 0.1, 0.42);
      note(880, 0.08, 0.1, 0.42);
      note(1319, 0.16, 0.18, 0.45);
    }
  };

  function play(name, arg) {
    if (!soundOn) return;
    var fn = SOUNDS[name];
    if (!fn || !audio()) return;
    try { fn(arg); } catch (e) { /* ignore */ }
  }

  // 测试用：离线渲染一个音效，返回峰值与响度（RMS）
  function renderSound(name, arg, raw) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new OAC(1, 44100 * 2, 44100);
    var prevCtx = ctx;
    var prevBus = bus;
    ctx = off;
    bus = buildChain(off);
    SOUNDS[name](arg);
    ctx = prevCtx;
    bus = prevBus;
    return off.startRendering().then(function (buf) {
      var d = buf.getChannelData(0);
      var peak = 0;
      var sum = 0;
      var n = 0;
      for (var i = 0; i < d.length; i++) {
        var a = Math.abs(d[i]);
        if (a > peak) peak = a;
        if (a > 0.001) { sum += d[i] * d[i]; n++; }
      }
      return { peak: peak, rms: n ? Math.sqrt(sum / n) : 0, ms: Math.round(n / 44.1), data: raw ? Array.from(d) : undefined };
    });
  }

  function syncSoundButtons() {
    var btns = document.querySelectorAll('.sound-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('muted', !soundOn);
      btns[i].setAttribute('aria-label', soundOn ? '关闭声音' : '打开声音');
      btns[i].setAttribute('title', soundOn ? '关闭声音' : '打开声音');
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.sound-toggle');
    if (!btn) return;
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn);
    syncSoundButtons();
    if (soundOn) play('click');
  });

  // 结果层统一卡片化：.overlay 里没有 .overlay-card 时自动包一层
  function wrapOverlays() {
    var list = document.querySelectorAll('.overlay');
    for (var i = 0; i < list.length; i++) {
      var ov = list[i];
      if (ov.querySelector(':scope > .overlay-card')) continue;
      var card = document.createElement('div');
      card.className = 'overlay-card';
      while (ov.firstChild) card.appendChild(ov.firstChild);
      ov.appendChild(card);
    }
  }

  function onReady() {
    syncSoundButtons();
    wrapOverlays();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();

  window.Site = {
    store: store,
    /** 播放音效：Site.sound('merge', 档位)。可用：click move merge place select flip match error reveal flag boom rotate drop line eat tick win lose start */
    sound: play,
    _renderSound: renderSound,
    vibrate: function (ms) {
      if (soundOn && navigator.vibrate) { try { navigator.vibrate(ms || 15); } catch (e) { /* ignore */ } }
    },
    openDialog: openDialog,
    closeDialog: function (id) { closeDialog(document.getElementById(id)); },
    theme: currentTheme,
    /** 秒数格式化为 mm:ss（超过一小时为 h:mm:ss） */
    formatTime: function (sec) {
      sec = Math.max(0, Math.floor(sec));
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      return h ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
    },
    /** 记录最近玩过的游戏，首页用来显示“继续玩” */
    played: function (slug) { store.set('gzly.last', slug); },
    /** 首页卡片上显示的成绩，例如 “最高 2048”、“最快 03:12” */
    setHomeStat: function (slug, text) { store.set('gzly.' + slug + '.homeStat', text); }
  };
})();
