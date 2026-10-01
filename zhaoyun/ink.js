/* 赵云与阿斗 v3 · 水墨渲染库：笔画字形、麻将字牌、宣纸、远山、墨点 */
(function () {
  'use strict';
  var D = window.ZYStrokes;
  var dpr = 1;
  // 加粗：每笔描边（字框单位），小字号下也清晰
  var BOLD = 40;
  function setBold(v) { if (v !== BOLD) { BOLD = v; sprites = {}; } }
  function boldStroke(ctx, path, w) {
    if (!w) return;
    ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke(path);
  }
  function setDpr(v) { if (v !== dpr) { dpr = v; sprites = {}; } }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rng(seed) {
    var a = seed | 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- 字形：每笔一个 Path2D（1024 字框，y 向下） ----------
  var glyphs = {};
  function glyph(ch) {
    var g = glyphs[ch];
    if (g) return g;
    var d = D[ch];
    if (!d) return null;
    g = { ch: ch, n: d.s.length, p: [], med: [], mp: [], ml: [], cx: [], cy: [], bx: [], ang: [], len: [], rad: d.r || [] };
    var X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    for (var i = 0; i < g.n; i++) {
      g.p.push(new Path2D(d.s[i]));
      var nums = d.s[i].match(/-?\d+/g).map(Number), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var k = 0; k + 1 < nums.length; k += 2) {
        if (nums[k] < x0) x0 = nums[k]; if (nums[k] > x1) x1 = nums[k];
        if (nums[k + 1] < y0) y0 = nums[k + 1]; if (nums[k + 1] > y1) y1 = nums[k + 1];
      }
      g.bx.push([x0, y0, x1, y1]);
      g.cx.push((x0 + x1) / 2); g.cy.push((y0 + y1) / 2);
      X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1);
      var m = d.m[i], mp = new Path2D(), L = 0;
      mp.moveTo(m[0], m[1]);
      for (var j = 2; j < m.length; j += 2) { mp.lineTo(m[j], m[j + 1]); L += Math.hypot(m[j] - m[j - 2], m[j + 1] - m[j - 1]); }
      g.med.push(m); g.mp.push(mp); g.ml.push(L + 1);
      var ex = m[m.length - 2] - m[0], ey = m[m.length - 1] - m[1];
      g.ang.push(Math.atan2(ey, ex)); g.len.push(Math.max(40, Math.hypot(ex, ey)));
    }
    g.box = [X0, Y0, X1, Y1];
    g.gx = (X0 + X1) / 2; g.gy = (Y0 + Y1) / 2;
    glyphs[ch] = g;
    return g;
  }
  // 若干笔画的包围盒中心
  function groupCenter(g, list) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(function (i) { var b = g.bx[i]; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  // 进入字框坐标：字中心落在 (x, y)，字框边长 size 像素
  function enter(ctx, x, y, size) { var k = size / 1024; ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-512, -512); }
  // 笔画多的字加粗要收着，免得糊成一团
  function boldFor(g) { return BOLD * (g.n >= 13 ? 0.4 : g.n >= 10 ? 0.6 : g.n >= 8 ? 0.8 : 1); }
  function fillAll(ctx, g, skip, bold) {
    var w = bold == null ? boldFor(g) : bold;
    for (var i = 0; i < g.n; i++) if (!skip || !skip[i]) { ctx.fill(g.p[i]); boldStroke(ctx, g.p[i], w); }
  }
  function draw(ctx, g, x, y, size, color, skip, bold) {
    ctx.save();
    enter(ctx, x, y, size);
    ctx.fillStyle = color;
    fillAll(ctx, g, skip, bold);
    ctx.restore();
  }
  // 单笔在世界坐标中绘制：笔画枢轴 (px,py)（字框坐标）落在 (wx,wy)，绕之旋转 rot，沿笔画方向拉伸 along / 垂直方向 across
  // align: 若给定，先把笔画主轴转到 x 轴再拉伸，最后转到 align 方向
  function strokeAt(ctx, g, i, wx, wy, size, o) {
    var k = size / 1024;
    ctx.save();
    ctx.translate(wx, wy);
    if (o.align != null) {
      ctx.rotate(o.align);
      ctx.scale(k * (o.along || 1), k * (o.across || 1));
      ctx.rotate(-g.ang[i]);
    } else {
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale(k * (o.sx || 1), k * (o.sy || 1));
    }
    ctx.translate(-(o.px != null ? o.px : g.cx[i]), -(o.py != null ? o.py : g.cy[i]));
    if (o.color) ctx.fillStyle = o.color;
    if (o.halo) { ctx.shadowColor = o.halo; ctx.shadowBlur = (o.hb || 5) * dpr; }
    ctx.fill(g.p[i]);
    boldStroke(ctx, g.p[i], o.bold == null ? boldFor(g) : o.bold);
    ctx.restore();
  }
  // 笔顺书写：progress 0..1（全字），返回是否写完
  function drawWriting(ctx, g, x, y, size, color, progress, skip) {
    ctx.save();
    enter(ctx, x, y, size);
    ctx.fillStyle = color; ctx.strokeStyle = color;
    var total = 0, i;
    for (i = 0; i < g.n; i++) if (!skip || !skip[i]) total += g.ml[i] + 120;
    var done = progress * total;
    for (i = 0; i < g.n; i++) {
      if (skip && skip[i]) continue;
      var need = g.ml[i] + 120;
      if (done >= need) { ctx.fill(g.p[i]); boldStroke(ctx, g.p[i], boldFor(g)); done -= need; continue; }
      if (done <= 0) break;
      ctx.save();
      ctx.clip(g.p[i]);
      ctx.lineWidth = 150; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([done / need * (g.ml[i] + 60), 4000]);
      ctx.stroke(g.mp[i]);
      ctx.restore();
      done = 0;
      break;
    }
    ctx.restore();
  }

  // ---------- 精灵缓存 ----------
  var sprites = {};
  function sprite(key, w, h, fn) {
    var s = sprites[key];
    if (s) return s;
    var pw = Math.ceil(w * dpr), ph = Math.ceil(h * dpr);
    var c = canvas(pw, ph), x = c.getContext('2d');
    x.scale(dpr, dpr);
    fn(x, w, h);
    s = { c: c, w: w, h: h };
    sprites[key] = s;
    return s;
  }
  function blit(ctx, s, x, y, sc, alpha) {
    sc = sc || 1;
    var w = s.w * sc, h = s.h * sc;
    if (alpha != null && alpha < 1) { var a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(s.c, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = a; }
    else ctx.drawImage(s.c, x - w / 2, y - h / 2, w, h);
  }
  // 字形精灵（带轻微墨晕）
  function glyphSprite(ch, size, color, opt) {
    opt = opt || {};
    var skipKey = opt.skip ? Object.keys(opt.skip).join('.') : '';
    var key = 'g|' + ch + '|' + size + '|' + color + '|' + skipKey + '|' + (opt.halo || '') + '|' + (opt.bleed || 0) + '|' + BOLD + '|' + (opt.outline || '');
    var pad = size * 0.25;
    return sprite(key, size + pad * 2, size + pad * 2, function (x, w, h) {
      var g = glyph(ch);
      if (!g) return;
      if (opt.halo) {
        x.save(); x.shadowColor = opt.halo; x.shadowBlur = size * 0.22 * dpr;
        draw(x, g, w / 2, h / 2, size, opt.halo, opt.skip);
        x.restore();
      }
      if (opt.outline) {
        // 描一圈浅色外框，压在深底上也看得清
        draw(x, g, w / 2, h / 2, size, opt.outline, opt.skip, boldFor(g) + 70);
      }
      if (opt.bleed) {
        x.save(); x.globalAlpha = 0.16; x.shadowColor = color; x.shadowBlur = size * 0.035 * dpr;
        draw(x, g, w / 2, h / 2, size, color, opt.skip);
        x.restore();
      }
      draw(x, g, w / 2, h / 2, size, color, opt.skip);
    });
  }

  // ---------- 麻将字牌 ----------
  var TIER = [
    { edge: '#9d8f74', back: ['#d9cdb3', '#a8977a'], ink: '#14110d', pip: '#7d6f56' },
    { edge: '#1f8a4c', back: ['#3fa56a', '#1d6a3f'], ink: '#0f4a2a', pip: '#1f8a4c' },
    { edge: '#1f5fc4', back: ['#4a82dc', '#1d4a96'], ink: '#0e2f6e', pip: '#1f5fc4' },
    { edge: '#8a35c8', back: ['#a466da', '#5d2394'], ink: '#4f1a80', pip: '#8a35c8' },
    { edge: '#e06a0a', back: ['#f59a3a', '#b2500c'], ink: '#b8420a', pip: '#e06a0a' }
  ];
  var GOLD = { edge: '#b8861e', back: ['#f0c75a', '#9a6a14'], ink: '#1b1712', pip: '#b8861e' };
  function rr(x, X, Y, W, H, r) {
    x.beginPath();
    x.moveTo(X + r, Y); x.lineTo(X + W - r, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + r);
    x.lineTo(X + W, Y + H - r); x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H);
    x.lineTo(X + r, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - r);
    x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y);
    x.closePath();
  }
  // 牌面尺寸：w 宽，h 牌面高，t 牌身厚度
  function tileDims(cell) { var w = Math.round(cell * 0.9), h = Math.round(cell * 0.86), t = Math.max(3, Math.round(cell * 0.09)); return { w: w, h: h, t: t }; }
  // kind: u 兵 / g 武将 / c 名字 / s 铲；tier 1..5
  function tileSprite(kind, tier, cell, lift) {
    var key = 't|' + kind + '|' + tier + '|' + cell + '|' + (lift ? 1 : 0);
    var d = tileDims(cell), pad = Math.ceil(cell * 0.18);
    return sprite(key, d.w + pad * 2, d.h + d.t + pad * 2, function (x, W, H) {
      var X = pad, Y = pad, w = d.w, h = d.h, t = d.t, r = w * 0.13;
      var T = kind === 'g' ? GOLD : kind === 'c' ? { edge: TIER[(tier || 1) - 1].edge, back: GOLD.back, pip: TIER[(tier || 1) - 1].pip } : TIER[(tier || 1) - 1];
      // 投影
      x.save();
      x.shadowColor = 'rgba(70,48,24,' + (lift ? 0.42 : 0.3) + ')';
      x.shadowBlur = (lift ? cell * 0.16 : cell * 0.07) * dpr;
      x.shadowOffsetY = (lift ? cell * 0.09 : cell * 0.03) * dpr;
      rr(x, X, Y, w, h + t, r);
      x.fillStyle = T.back[1];
      x.fill();
      x.restore();
      // 牌身（彩色牌背）
      var gb = x.createLinearGradient(0, Y + h - r, 0, Y + h + t);
      gb.addColorStop(0, T.back[0]); gb.addColorStop(1, T.back[1]);
      rr(x, X, Y, w, h + t, r); x.fillStyle = gb; x.fill();
      // 象牙牌面
      var gf = x.createLinearGradient(X, Y, X + w * 0.4, Y + h);
      if (kind === 'g' || kind === 'c') { gf.addColorStop(0, '#fffbef'); gf.addColorStop(1, '#f6e4b4'); }
      else { gf.addColorStop(0, '#fffcf3'); gf.addColorStop(1, '#efe5cf'); }
      rr(x, X, Y, w, h, r); x.fillStyle = gf; x.fill();
      // 细微象牙纹
      var R = rng(tier * 97 + kind.charCodeAt(0));
      x.save(); rr(x, X, Y, w, h, r); x.clip();
      x.strokeStyle = 'rgba(160,130,90,.07)'; x.lineWidth = 0.6;
      for (var i = 0; i < 7; i++) { var yy = Y + R() * h; x.beginPath(); x.moveTo(X, yy); x.bezierCurveTo(X + w * 0.3, yy + (R() - 0.5) * 6, X + w * 0.7, yy + (R() - 0.5) * 6, X + w, yy + (R() - 0.5) * 4); x.stroke(); }
      // 高光 / 暗边
      var gh = x.createLinearGradient(0, Y, 0, Y + h);
      gh.addColorStop(0, 'rgba(255,255,255,.75)'); gh.addColorStop(0.18, 'rgba(255,255,255,0)'); gh.addColorStop(0.85, 'rgba(120,90,50,0)'); gh.addColorStop(1, 'rgba(120,90,50,.16)');
      x.fillStyle = gh; x.fillRect(X, Y, w, h);
      x.restore();
      rr(x, X + 0.5, Y + 0.5, w - 1, h - 1, r); x.strokeStyle = 'rgba(70,50,25,.55)'; x.lineWidth = 1; x.stroke();
      // 彩边
      var ins = Math.max(2, w * 0.06);
      if (kind === 'c') {
        // 金色名字残片：彩边示阶，四角金钉
        rr(x, X + ins, Y + ins, w - ins * 2, h - ins * 2, r * 0.6); x.strokeStyle = T.edge; x.lineWidth = tier > 1 ? 2 : 1.4; x.stroke();
        x.fillStyle = '#c9962e';
        [[X + ins + 2, Y + ins + 2], [X + w - ins - 2, Y + ins + 2], [X + ins + 2, Y + h - ins - 2], [X + w - ins - 2, Y + h - ins - 2]].forEach(function (q) { x.beginPath(); x.arc(q[0], q[1], Math.max(1.2, w * 0.03), 0, 7); x.fill(); });
      } else if (kind === 's') {
        rr(x, X + ins, Y + ins, w - ins * 2, h - ins * 2, r * 0.6); x.strokeStyle = 'rgba(120,84,40,.55)'; x.lineWidth = 1; x.stroke();
      } else {
        rr(x, X + ins, Y + ins, w - ins * 2, h - ins * 2, r * 0.6); x.strokeStyle = T.edge; x.globalAlpha = tier > 1 || kind === 'g' ? 1 : 0.7; x.lineWidth = tier > 1 || kind === 'g' ? 2.2 : 1.3; x.stroke();
        if (kind === 'g') { rr(x, X + ins + 2.5, Y + ins + 2.5, w - ins * 2 - 5, h - ins * 2 - 5, r * 0.5); x.lineWidth = 0.7; x.stroke(); }
        x.globalAlpha = 1;
      }
      // 等级点
      if ((kind === 'u' || kind === 'c') && tier > 1) {
        var pr = Math.max(1.6, w * 0.042), gap = pr * 2.7, x0 = X + w / 2 - (tier - 1) * gap / 2;
        x.fillStyle = T.pip;
        for (var p = 0; p < tier; p++) { x.beginPath(); x.arc(x0 + p * gap, Y + h - ins - pr * 1.6, pr, 0, 7); x.fill(); }
      }
    });
  }
  function tierInk(tier) { return TIER[(tier || 1) - 1].ink; }
  function tierEdge(tier) { return TIER[(tier || 1) - 1].edge; }

  // 敌军墨牌（深色小牌，纸色字）
  function enemyTileSprite(size, edge, boss) {
    var key = 'e|' + size + '|' + edge + '|' + (boss ? 1 : 0);
    var pad = Math.ceil(size * 0.25);
    return sprite(key, size + pad * 2, size + pad * 2, function (x, W, H) {
      var X = pad, Y = pad, w = size, r = size * (boss ? 0.16 : 0.22);
      x.save();
      x.shadowColor = 'rgba(40,25,10,.35)'; x.shadowBlur = size * 0.12 * dpr; x.shadowOffsetY = size * 0.05 * dpr;
      rr(x, X, Y, w, w, r); x.fillStyle = '#1c1916'; x.fill();
      x.restore();
      var g = x.createLinearGradient(X, Y, X, Y + w);
      g.addColorStop(0, '#2e2925'); g.addColorStop(1, '#0e0c0a');
      rr(x, X, Y, w, w, r); x.fillStyle = g; x.fill();
      // 干笔刷痕
      var R = rng(size * 7 + (boss ? 3 : 1));
      x.save(); rr(x, X, Y, w, w, r); x.clip();
      x.strokeStyle = 'rgba(255,240,220,.05)'; x.lineWidth = 0.8;
      for (var i = 0; i < 9; i++) { var yy = Y + R() * w; x.beginPath(); x.moveTo(X, yy); x.lineTo(X + w, yy + (R() - 0.5) * w * 0.3); x.stroke(); }
      x.restore();
      rr(x, X + 1, Y + 1, w - 2, w - 2, r * 0.8); x.strokeStyle = edge; x.lineWidth = boss ? 2.6 : 1.8; x.globalAlpha = 1; x.stroke();
      if (boss) {
        x.fillStyle = '#c9962e';
        [[X, Y], [X + w, Y], [X, Y + w], [X + w, Y + w]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], size * 0.07, 0, 7); x.fill(); });
      }
    });
  }

  // ---------- 墨点 / 光晕 ----------
  function blotSprite(i, color, size) {
    var key = 'b|' + i + '|' + color + '|' + size;
    return sprite(key, size * 2, size * 2, function (x, W, H) {
      var R = rng(i * 131 + 17);
      x.fillStyle = color;
      x.translate(W / 2, H / 2);
      var n = 14, rad = size * 0.55;
      x.beginPath();
      for (var k = 0; k <= n; k++) {
        var a = k / n * Math.PI * 2, rr2 = rad * (0.75 + R() * 0.45);
        var px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
        if (k === 0) x.moveTo(px, py); else x.quadraticCurveTo(Math.cos(a - 0.2) * rr2 * 1.1, Math.sin(a - 0.2) * rr2 * 1.1, px, py);
      }
      x.fill();
      for (var s = 0; s < 4; s++) { var a2 = R() * 7, d2 = rad * (1 + R() * 0.5); x.beginPath(); x.arc(Math.cos(a2) * d2, Math.sin(a2) * d2, rad * (0.08 + R() * 0.12), 0, 7); x.fill(); }
    });
  }
  function glowSprite(color, size) {
    var key = 'gl|' + color + '|' + size;
    return sprite(key, size * 2, size * 2, function (x, W, H) {
      var g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, size);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
  }

  // ---------- 宣纸 ----------
  function paper(w, h, seed, tint) {
    var c = canvas(w * dpr, h * dpr), x = c.getContext('2d');
    x.scale(dpr, dpr);
    var R = rng(seed || 7);
    x.fillStyle = tint || '#f6f0e1';
    x.fillRect(0, 0, w, h);
    // 大块晕染
    for (var i = 0; i < 18; i++) {
      var cx = R() * w, cy = R() * h, r = (0.15 + R() * 0.35) * Math.max(w, h);
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      var warm = R() < 0.5;
      g.addColorStop(0, warm ? 'rgba(214,190,150,.05)' : 'rgba(255,253,245,.2)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    // 纤维
    var n = Math.min(3200, (w * h) / 90);
    for (var j = 0; j < n; j++) {
      var px = R() * w, py = R() * h, l = 2 + R() * 9, a = R() * Math.PI;
      x.strokeStyle = R() < 0.5 ? 'rgba(150,120,80,' + (0.04 + R() * 0.07) + ')' : 'rgba(255,255,250,' + (0.1 + R() * 0.15) + ')';
      x.lineWidth = 0.4 + R() * 0.5;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (R() - 0.5) * 2, py + Math.sin(a) * l * 0.5 + (R() - 0.5) * 2, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    // 细小纸屑
    for (var k = 0; k < n / 6; k++) { x.fillStyle = 'rgba(120,95,60,' + (0.05 + R() * 0.08) + ')'; x.fillRect(R() * w, R() * h, 0.8, 0.8); }
    // 四边暗角
    var v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(140,105,60,.07)');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
    return c;
  }

  // ---------- 远山（水墨层叠） ----------
  // 在 (x0..x0+w) 范围画山，基线 base，峰高 hgt；dir=-1 山向上（正常），+1 倒影向下
  function mountains(x, x0, w, base, hgt, opt) {
    opt = opt || {};
    var R = rng(opt.seed || 3), layers = opt.layers || 3, dir = opt.dir || -1;
    var col = opt.color || '40,38,36';
    var step = 3, n = Math.ceil(w / step) + 1;
    for (var L = 0; L < layers; L++) {
      var far = 1 - L / Math.max(1, layers - 1 || 1);
      var H = hgt * (0.5 + 0.5 * (L + 1) / layers) * (opt.scale || 1);
      var alpha = (opt.alpha || 0.22) * (0.35 + 0.65 * (L + 1) / layers);
      // 起伏：几层正弦 + 若干高斯峰
      var ph = [R() * 6, R() * 6, R() * 6], fr = [1 + R() * 1.5, 3 + R() * 3, 8 + R() * 6];
      var peaks = [], np = 2 + ((R() * 3) | 0);
      for (var k = 0; k < np; k++) peaks.push([R(), 0.06 + R() * 0.12, 0.5 + R() * 0.6]);
      var ys = new Array(n);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), v = 0.35;
        v += 0.18 * Math.sin(t * fr[0] * Math.PI * 2 + ph[0]) + 0.08 * Math.sin(t * fr[1] * Math.PI * 2 + ph[1]) + 0.025 * Math.sin(t * fr[2] * Math.PI * 2 + ph[2]);
        for (var q = 0; q < peaks.length; q++) { var d = (t - peaks[q][0]) / peaks[q][1]; v += peaks[q][2] * Math.exp(-d * d) * 0.6; }
        ys[i] = base + dir * H * Math.max(0.05, Math.min(1.1, v));
      }
      var g = x.createLinearGradient(0, base + dir * H, 0, base);
      g.addColorStop(0, 'rgba(' + col + ',' + alpha + ')');
      g.addColorStop(0.45, 'rgba(' + col + ',' + alpha * 0.5 + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(x0, base);
      for (var j = 0; j < n; j++) x.lineTo(x0 + j * step, ys[j]);
      x.lineTo(x0 + w, base); x.closePath(); x.fill();
      // 山脊墨线：只给最近一层，淡淡一笔
      if (L === layers - 1) {
        x.lineJoin = 'round';
        x.strokeStyle = 'rgba(' + col + ',' + alpha * 0.55 + ')';
        x.lineWidth = 1;
        x.beginPath();
        for (var m = 0; m < n; m++) { if (m) x.lineTo(x0 + m * step, ys[m]); else x.moveTo(x0, ys[0]); }
        x.stroke();
      }
      void far;
      // 皴笔：山脊下的短竖笔
      x.lineWidth = 0.8;
      for (var c = 0; c < n; c += 2 + ((R() * 5) | 0)) {
        if (R() < 0.5) continue;
        var len = H * (0.08 + R() * 0.18);
        x.strokeStyle = 'rgba(' + col + ',' + alpha * (0.15 + R() * 0.25) + ')';
        x.beginPath(); x.moveTo(x0 + c * step, ys[c] - dir * 2); x.lineTo(x0 + c * step + (R() - 0.5) * 4, ys[c] - dir * len); x.stroke();
      }
    }
  }
  // 干笔飞白：沿折线画一条墨痕
  function dryBrush(x, pts, width, color, seed, alpha) {
    var R = rng(seed || 11);
    var hairs = Math.max(6, Math.round(width / 1.6));
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (var hI = 0; hI < hairs; hI++) {
      var off = (hI / (hairs - 1) - 0.5) * width;
      x.strokeStyle = color;
      x.globalAlpha = (alpha || 0.5) * (0.3 + R() * 0.7);
      x.lineWidth = 0.8 + R() * width / hairs * 1.6;
      x.beginPath();
      var gap = R() < 0.4;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
        var dx = q[0] - pr[0], dy = q[1] - pr[1], l = Math.hypot(dx, dy) || 1;
        var nx = -dy / l, ny = dx / l, j = (R() - 0.5) * 1.2;
        var px = p[0] + nx * (off + j), py = p[1] + ny * (off + j);
        if (i === 0 || (gap && R() < 0.06)) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  // 草、石、树：墨笔小品
  function grass(x, cx, cy, s, seed, alpha) {
    var R = rng(seed);
    x.strokeStyle = 'rgba(40,46,34,' + (alpha || 0.45) + ')';
    x.lineCap = 'round';
    var n = 3 + ((R() * 4) | 0);
    for (var i = 0; i < n; i++) {
      var bx = cx + (R() - 0.5) * s * 0.8, a = -Math.PI / 2 + (R() - 0.5) * 1.3, l = s * (0.25 + R() * 0.35);
      x.lineWidth = 0.6 + R() * 1.1;
      x.beginPath(); x.moveTo(bx, cy); x.quadraticCurveTo(bx + Math.cos(a) * l * 0.5 + (R() - 0.5) * s * 0.2, cy + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke();
    }
  }
  function rock(x, cx, cy, s, seed) {
    var R = rng(seed);
    x.save();
    x.translate(cx, cy);
    var pts = [], n = 7;
    for (var i = 0; i < n; i++) { var a = Math.PI + i / (n - 1) * Math.PI, r = s * (0.35 + R() * 0.2); pts.push([Math.cos(a) * r * 1.2, Math.sin(a) * r]); }
    var g = x.createLinearGradient(0, -s * 0.5, 0, 0);
    g.addColorStop(0, 'rgba(50,48,44,.55)'); g.addColorStop(1, 'rgba(50,48,44,.12)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(-s * 0.45, 0);
    pts.forEach(function (p) { x.lineTo(p[0], p[1]); });
    x.lineTo(s * 0.45, 0); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(30,28,26,.6)'; x.lineWidth = 1.2; x.stroke();
    x.lineWidth = 0.8; x.beginPath(); x.moveTo(-s * 0.1, -s * 0.3); x.lineTo(s * 0.05, -s * 0.08); x.moveTo(s * 0.15, -s * 0.25); x.lineTo(s * 0.22, -s * 0.05); x.stroke();
    x.restore();
  }
  function pine(x, cx, cy, s, seed) {
    var R = rng(seed);
    x.save(); x.translate(cx, cy);
    x.strokeStyle = 'rgba(40,34,28,.6)'; x.lineWidth = s * 0.06; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(s * 0.08, -s * 0.4, -s * 0.02, -s * 0.85); x.stroke();
    for (var i = 0; i < 4; i++) {
      var y = -s * (0.3 + i * 0.16), w = s * (0.45 - i * 0.08);
      x.fillStyle = 'rgba(38,52,40,' + (0.32 + R() * 0.15) + ')';
      x.beginPath(); x.ellipse((R() - 0.5) * s * 0.1, y, w, s * 0.08, (R() - 0.5) * 0.2, 0, 7); x.fill();
    }
    x.restore();
  }
  // 红色印章（方印，阴文）
  function seal(x, cx, cy, s, chars, color) {
    x.save();
    x.translate(cx, cy);
    x.fillStyle = color || '#b3261e';
    rr(x, -s / 2, -s / 2, s, s, s * 0.08); x.fill();
    var R = rng(chars.charCodeAt(0));
    x.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 10; i++) { x.beginPath(); x.arc((R() - 0.5) * s, (R() - 0.5) * s, s * 0.02 * R(), 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#f7ecd8';
    var n = chars.length;
    if (n === 1) { var g = glyph(chars); if (g) draw(x, g, 0, 0, s * 0.86, '#f7ecd8'); }
    else if (n === 2) { chars.split('').forEach(function (c, i) { var g2 = glyph(c); if (g2) draw(x, g2, 0, (i - 0.5) * s * 0.44, s * 0.5, '#f7ecd8'); }); }
    else {
      chars.split('').forEach(function (c, i) { var g3 = glyph(c); if (g3) draw(x, g3, (i < 2 ? 1 : -1) * s * 0.22, (i % 2 ? 1 : -1) * s * 0.22, s * 0.46, '#f7ecd8'); });
    }
    x.restore();
  }
  // 锥形墨带（拖尾）：pts=[x,y,...]，宽度从 w0 渐到 w1
  var tl = [], tr = [];
  function ribbon(x, pts, n, w0, w1) {
    if (n < 2) return;
    tl.length = 0; tr.length = 0;
    for (var i = 0; i < n; i++) {
      var ax = pts[i * 2], ay = pts[i * 2 + 1];
      var j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      var dx = pts[j1 * 2] - pts[j0 * 2], dy = pts[j1 * 2 + 1] - pts[j0 * 2 + 1], l = Math.hypot(dx, dy) || 1;
      var w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
      tl.push(ax - dy / l * w, ay + dx / l * w);
      tr.push(ax + dy / l * w, ay - dx / l * w);
    }
    x.beginPath();
    x.moveTo(tl[0], tl[1]);
    for (var k = 1; k < n; k++) x.lineTo(tl[k * 2], tl[k * 2 + 1]);
    for (var m = n - 1; m >= 0; m--) x.lineTo(tr[m * 2], tr[m * 2 + 1]);
    x.closePath();
    x.fill();
  }
  // 月牙斩痕
  function crescent(x, cx, cy, r, a0, a1, thick) {
    x.beginPath();
    x.arc(cx, cy, r, a0, a1, a1 < a0);
    var mid = (a0 + a1) / 2;
    var ix = cx + Math.cos(mid) * thick, iy = cy + Math.sin(mid) * thick;
    x.arc(ix, iy, r - thick * 0.2, a1, a0, a1 >= a0);
    x.closePath();
    x.fill();
  }

  window.ZYInk = {
    setDpr: setDpr, setBold: setBold, boldStroke: boldStroke, canvas: canvas, rng: rng, glyph: glyph, groupCenter: groupCenter, enter: enter, fillAll: fillAll, draw: draw, strokeAt: strokeAt,
    drawWriting: drawWriting, sprite: sprite, blit: blit, glyphSprite: glyphSprite, tileSprite: tileSprite, tileDims: tileDims, tierInk: tierInk, tierEdge: tierEdge,
    enemyTileSprite: enemyTileSprite, blotSprite: blotSprite, glowSprite: glowSprite, paper: paper, mountains: mountains, dryBrush: dryBrush,
    grass: grass, rock: rock, pine: pine, seal: seal, ribbon: ribbon, crescent: crescent, rr: rr, TIER: TIER, GOLD: GOLD,
    clear: function () { sprites = {}; }
  };
})();
