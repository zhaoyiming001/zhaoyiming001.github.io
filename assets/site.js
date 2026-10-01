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
  var SOUND_KEY = 'gzly.sound';
  var soundOn = store.get(SOUND_KEY, true) !== false;
  var actx = null;
  var master = null;
  var noiseBuf = null;

  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = 0.5;
        master.connect(actx.destination);
      } catch (e) {
        actx = null;
        return null;
      }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // 单个音：type 波形，f 起始频率，f2 结束频率，d 时长(秒)，v 音量，at 延迟(秒)
  function tone(o) {
    var ctx = audio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (o.at || 0);
    var d = o.d || 0.1;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.3, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + d + 0.02);
  }

  // 噪声：用于爆炸、落地等
  function noise(o) {
    var ctx = audio();
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    var t0 = ctx.currentTime + (o.at || 0);
    var d = o.d || 0.2;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) filter.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.v || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + d + 0.02);
  }

  function arp(notes, opts) {
    opts = opts || {};
    notes.forEach(function (f, i) {
      tone({ type: opts.type || 'triangle', f: f, d: opts.d || 0.16, v: opts.v || 0.25, at: i * (opts.step || 0.09) });
    });
  }

  var SOUNDS = {
    click:  function () { tone({ type: 'triangle', f: 660, d: 0.05, v: 0.15 }); },
    move:   function () { tone({ type: 'sine', f: 300, f2: 200, d: 0.07, v: 0.18 }); },
    merge:  function (n) {
      var f = 330 * Math.pow(1.06, Math.min(n || 1, 16));
      tone({ type: 'triangle', f: f, f2: f * 1.5, d: 0.11, v: 0.25 });
    },
    place:  function () { tone({ type: 'sine', f: 520, f2: 300, d: 0.08, v: 0.3 }); noise({ f: 2500, f2: 400, d: 0.05, v: 0.15 }); },
    select: function () { tone({ type: 'sine', f: 880, d: 0.05, v: 0.12 }); },
    flip:   function () { noise({ f: 3000, f2: 800, d: 0.06, v: 0.2 }); tone({ type: 'sine', f: 500, f2: 700, d: 0.06, v: 0.1 }); },
    match:  function () { arp([660, 880], { step: 0.07, d: 0.14 }); },
    error:  function () { tone({ type: 'square', f: 180, f2: 140, d: 0.16, v: 0.12 }); },
    reveal: function () { tone({ type: 'sine', f: 740, d: 0.04, v: 0.12 }); },
    flag:   function () { tone({ type: 'triangle', f: 520, f2: 780, d: 0.08, v: 0.2 }); },
    boom:   function () { noise({ f: 1800, f2: 60, d: 0.7, v: 0.7 }); tone({ type: 'sine', f: 120, f2: 40, d: 0.5, v: 0.5 }); },
    rotate: function () { tone({ type: 'triangle', f: 440, f2: 560, d: 0.05, v: 0.12 }); },
    drop:   function () { noise({ f: 900, f2: 150, d: 0.12, v: 0.35 }); tone({ type: 'sine', f: 160, f2: 80, d: 0.1, v: 0.3 }); },
    line:   function (n) { arp([523, 659, 784, 1047].slice(0, Math.max(2, n || 1)), { step: 0.06, d: 0.15 }); },
    eat:    function () { tone({ type: 'square', f: 600, f2: 900, d: 0.07, v: 0.1 }); },
    tick:   function () { tone({ type: 'sine', f: 1200, d: 0.03, v: 0.08 }); },
    win:    function () { arp([523, 659, 784, 1047, 1319], { step: 0.1, d: 0.25, v: 0.25 }); },
    lose:   function () { arp([392, 330, 262, 196], { type: 'sine', step: 0.14, d: 0.28, v: 0.25 }); },
    start:  function () { arp([392, 523, 659], { step: 0.07, d: 0.12 }); }
  };

  function play(name, arg) {
    if (!soundOn) return;
    var fn = SOUNDS[name];
    if (!fn) return;
    try { fn(arg); } catch (e) { /* ignore */ }
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
