/* 赵云与阿斗 · 美术：程序化绘制（地形、令牌、军旗、字形缓存） */
(function () {
  'use strict';
  var Z = window.ZYCore;
  var BRUSH = '"ZY Brush","Ma Shan Zheng","ZY Serif","STKaiti","KaiTi",serif';
  var WILD = '"ZY Wild","ZY Brush","Ma Shan Zheng","ZY Serif","STKaiti",serif';
  // 书法字体缺的字（敌将名中的生僻字）整串改用宋体
  var BRUSH_MISSING = '惇郃';
  function needSerif(s) { for (var i = 0; i < s.length; i++) if (BRUSH_MISSING.indexOf(s[i]) >= 0) return true; return false; }
  var SERIF = '"ZY Serif","Noto Serif SC","Songti SC","SimSun",serif';
  var INK = '#15110d', GOLD = '#d4a64a', GOLD_L = '#f3d68a', CRIMSON = '#9e1b1b', PARCH = '#e8dcc0', BRONZE = '#b08d57';
  var DPR = 1;

  function setDpr(d) { DPR = d; glyphCache = {}; }
  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    var a = seed | 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
  function mix(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * k, g = (pa >> 8 & 255) + ((pb >> 8 & 255) - (pa >> 8 & 255)) * k, bl = (pa & 255) + ((pb & 255) - (pa & 255)) * k;
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
  }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  // ---------- 字形缓存：攻击文字、伤害数字都用 drawImage 绘制 ----------
  var glyphCache = {};
  var glyphCount = 0;
  // opt: { glow: 颜色, stroke: 描边色, sw: 描边宽(比例), font: 'brush'|'wild'|'serif', weight }
  function glyph(ch, px, fill, opt) {
    opt = opt || {};
    px = Math.max(6, Math.round(px));
    var key = ch + '|' + px + '|' + fill + '|' + (opt.glow || '') + '|' + (opt.stroke || '') + '|' + (opt.font || '') + '|' + (opt.sw || '');
    var g = glyphCache[key];
    if (g) return g;
    if (glyphCount > 1400) { glyphCache = {}; glyphCount = 0; }
    var pad = px * (opt.glow ? 0.55 : 0.25);
    var w = px * Math.max(1, ch.length * 1.05) + pad * 2, h = px * 1.25 + pad * 2;
    var c = canvas(w * DPR, h * DPR);
    var x = c.getContext('2d');
    x.scale(DPR, DPR);
    x.font = (opt.weight || '') + ' ' + px + 'px ' + (opt.font === 'wild' ? WILD : opt.font === 'serif' ? SERIF : BRUSH);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var cx = w / 2, cy = h / 2 + px * 0.04;
    if (opt.glow) {
      x.shadowColor = opt.glow; x.shadowBlur = px * 0.45;
      x.fillStyle = opt.glow; x.fillText(ch, cx, cy);
      x.shadowBlur = px * 0.2; x.fillText(ch, cx, cy);
      x.shadowBlur = 0;
    }
    if (opt.stroke) {
      x.lineJoin = 'round'; x.lineWidth = px * (opt.sw || 0.12); x.strokeStyle = opt.stroke;
      x.strokeText(ch, cx, cy);
    }
    x.fillStyle = fill;
    x.fillText(ch, cx, cy);
    g = { cv: c, w: w, h: h };
    glyphCache[key] = g;
    glyphCount++;
    return g;
  }
  function drawGlyph(c, g, x, y, scale, alpha, rot) {
    var w = g.w * (scale || 1), h = g.h * (scale || 1);
    if (alpha != null && alpha < 1) c.globalAlpha = Math.max(0, alpha);
    if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(g.cv, -w / 2, -h / 2, w, h); c.restore(); }
    else c.drawImage(g.cv, x - w / 2, y - h / 2, w, h);
    if (alpha != null && alpha < 1) c.globalAlpha = 1;
  }

  // ---------- 纹理 ----------
  var noise = null;
  function noiseTile() {
    if (noise) return noise;
    var n = 128;
    noise = canvas(n, n);
    var x = noise.getContext('2d'), img = x.createImageData(n, n), d = img.data, r = rng(7);
    for (var i = 0; i < d.length; i += 4) {
      var v = r();
      var k = v < 0.5 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = k;
      d[i + 3] = Math.floor(Math.pow(Math.abs(v - 0.5) * 2, 2.2) * 46);
    }
    x.putImageData(img, 0, 0);
    return noise;
  }
  function grain(c, w, h, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = c.createPattern(noiseTile(), 'repeat');
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  // ---------- 地形配色 ----------
  var TERRAIN = {
    plain: { g1: '#7d6340', g2: '#9c7d4e', g3: '#584329', road: '#b19361', road2: '#7a6140', grass: '#8a8644', mount: '#2c2117', fx: 'dust', tint: 'rgba(230,170,90,.10)' },
    pass: { g1: '#5e5850', g2: '#7a7264', g3: '#3e3933', road: '#9d8f76', road2: '#6c604e', grass: '#5e6a3e', mount: '#1f1c19', fx: 'dust', cliff: true, tint: 'rgba(170,90,60,.12)' },
    forest: { g1: '#46512f', g2: '#5d6b3c', g3: '#2a331d', road: '#8c7752', road2: '#5f4f35', grass: '#56702f', mount: '#141a10', fx: 'ember', trees: 0.55, tint: 'rgba(255,120,40,.10)' },
    bridge: { g1: '#6d5c3b', g2: '#8c7649', g3: '#4a3e27', road: '#ad9466', road2: '#7d6744', grass: '#6c7a3a', water: '#2a4450', mount: '#1e1912', fx: 'dust', tint: 'rgba(230,160,80,.10)' },
    river: { g1: '#5a4a31', g2: '#76603e', g3: '#3a2e1f', road: '#24414f', road2: '#132630', grass: '#5c6534', mount: '#140f0b', fx: 'ember', waterPath: true, tint: 'rgba(255,90,30,.16)' },
    mountain: { g1: '#6a6256', g2: '#877b69', g3: '#463f37', road: '#a39276', road2: '#73644e', grass: '#5f6a40', mount: '#1a1714', fx: 'dust', tint: 'rgba(200,150,110,.08)' },
    flood: { g1: '#4d4b42', g2: '#646154', g3: '#33322b', road: '#77705a', road2: '#4f4838', grass: '#4d5a36', water: '#30505c', mount: '#141619', fx: 'rain', tint: 'rgba(90,120,150,.16)' },
    camp: { g1: '#5e4930', g2: '#7a6040', g3: '#3e3021', road: '#977b54', road2: '#6a5538', grass: '#5d6633', mount: '#1a120c', fx: 'ember', tents: true, trees: 0.25, tint: 'rgba(255,100,40,.12)' },
    jungle: { g1: '#3a4c2b', g2: '#516a37', g3: '#22301a', road: '#7b6644', road2: '#54452c', grass: '#4f7a2c', mount: '#0f160b', fx: 'mist', trees: 0.6, tint: 'rgba(120,180,90,.08)' },
    plateau: { g1: '#8a7853', g2: '#a89263', g3: '#63553a', road: '#b8a172', road2: '#8a7550', grass: '#8b7f46', mount: '#2a2119', fx: 'dust', tint: 'rgba(240,170,90,.12)' }
  };

  // ---------- 地形 ----------
  function inkTree(c, x, y, s, col, r) {
    c.strokeStyle = col; c.lineCap = 'round';
    c.lineWidth = s * 0.07;
    c.beginPath(); c.moveTo(x, y + s * 0.42); c.quadraticCurveTo(x + s * 0.05, y + s * 0.1, x - s * 0.02, y - s * 0.05); c.stroke();
    c.lineWidth = s * 0.035;
    c.beginPath(); c.moveTo(x, y + s * 0.15); c.lineTo(x + s * 0.18, y - s * 0.02); c.stroke();
    for (var i = 0; i < 7; i++) {
      var a = r() * Math.PI * 2, d = r() * s * 0.22;
      c.globalAlpha = 0.55 + r() * 0.35;
      c.fillStyle = col;
      circ(c, x + Math.cos(a) * d, y - s * 0.12 + Math.sin(a) * d * 0.7, s * (0.12 + r() * 0.1)); c.fill();
    }
    c.globalAlpha = 1;
  }
  function rocks(c, x, y, s, r) {
    var n = 1 + (r() * 3 | 0);
    for (var i = 0; i < n; i++) {
      var rx = x + (r() - 0.5) * s * 0.5, ry = y + (r() - 0.5) * s * 0.4, rw = s * (0.1 + r() * 0.12);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.ellipse(rx + rw * 0.15, ry + rw * 0.35, rw, rw * 0.5, 0, 0, 7); c.fill();
      var g = c.createLinearGradient(rx - rw, ry - rw, rx + rw, ry + rw);
      g.addColorStop(0, '#8d877b'); g.addColorStop(1, '#4a463f');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(rx, ry, rw, rw * 0.68, r() - 0.5, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,245,220,.18)';
      c.beginPath(); c.ellipse(rx - rw * 0.3, ry - rw * 0.25, rw * 0.35, rw * 0.18, -0.3, 0, 7); c.fill();
    }
  }
  function scrub(c, x, y, s, col, r) {
    c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = Math.max(1, s * 0.025);
    for (var i = 0; i < 5; i++) {
      var gx = x + (r() - 0.5) * s * 0.75, gy = y + (r() - 0.5) * s * 0.7, h = s * (0.06 + r() * 0.08);
      c.globalAlpha = 0.5 + r() * 0.4;
      c.beginPath();
      c.moveTo(gx, gy); c.lineTo(gx - h * 0.5, gy - h);
      c.moveTo(gx, gy); c.lineTo(gx, gy - h * 1.2);
      c.moveTo(gx, gy); c.lineTo(gx + h * 0.6, gy - h * 0.9);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  function stakes(c, x, y, s, r) {
    c.strokeStyle = '#2a1d12'; c.lineWidth = Math.max(1.2, s * 0.045); c.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var sx = x - s * 0.33 + i * s * 0.22, h = s * (0.28 + r() * 0.1);
      c.beginPath(); c.moveTo(sx, y + s * 0.18); c.lineTo(sx + s * 0.06, y + s * 0.18 - h); c.stroke();
    }
    c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.moveTo(x - s * 0.4, y + s * 0.06); c.lineTo(x + s * 0.38, y + s * 0.02); c.stroke();
  }
  function tent(c, x, y, s) {
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(x + s * 0.05, y + s * 0.26, s * 0.36, s * 0.1, 0, 0, 7); c.fill();
    var g = c.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0);
    g.addColorStop(0, '#cdb88f'); g.addColorStop(0.5, '#a58c62'); g.addColorStop(1, '#6f5c3e');
    c.fillStyle = g; c.strokeStyle = '#2a1d12'; c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.moveTo(x - s * 0.34, y + s * 0.24); c.lineTo(x, y - s * 0.3); c.lineTo(x + s * 0.34, y + s * 0.24); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a1d12';
    c.beginPath(); c.moveTo(x - s * 0.07, y + s * 0.24); c.lineTo(x, y + s * 0.02); c.lineTo(x + s * 0.07, y + s * 0.24); c.fill();
  }
  function platform(c, x, y, S, high) {
    var m = S * 0.07, w = S - 2 * m, rr = S * 0.1;
    c.fillStyle = 'rgba(0,0,0,.42)';
    rrect(c, x + m + S * 0.03, y + m + S * 0.05, w, w, rr); c.fill();
    var g = c.createLinearGradient(x, y, x + S, y + S);
    if (high) { g.addColorStop(0, '#d2c6a8'); g.addColorStop(1, '#8a7e66'); }
    else { g.addColorStop(0, '#b9ae96'); g.addColorStop(1, '#756c5a'); }
    c.fillStyle = g;
    rrect(c, x + m, y + m, w, w, rr); c.fill();
    c.lineWidth = Math.max(1.5, S * 0.035);
    c.strokeStyle = '#1a120a'; c.stroke();
    rrect(c, x + m + 1.5, y + m + 1.5, w - 3, w - 3, rr * 0.8);
    c.lineWidth = Math.max(1, S * 0.022); c.strokeStyle = 'rgba(214,170,90,.85)'; c.stroke();
    // 斜面高光
    c.strokeStyle = 'rgba(255,240,210,.22)'; c.lineWidth = Math.max(1, S * 0.03);
    c.beginPath(); c.moveTo(x + m + rr, y + m + S * 0.04); c.lineTo(x + S - m - rr, y + m + S * 0.04); c.stroke();
    var im = S * 0.17;
    c.fillStyle = 'rgba(60,40,20,.12)';
    rrect(c, x + im, y + im, S - 2 * im, S - 2 * im, S * 0.06); c.fill();
    c.strokeStyle = 'rgba(40,28,16,.3)'; c.lineWidth = 1; c.stroke();
    // 裂纹
    var r = rng((x * 7 + y * 13) | 0);
    c.strokeStyle = 'rgba(25,18,12,.35)'; c.lineWidth = 1;
    c.beginPath();
    var cx0 = x + m + r() * w, cy0 = y + m + r() * w;
    c.moveTo(cx0, cy0); c.lineTo(cx0 + (r() - 0.5) * S * 0.3, cy0 + (r() - 0.5) * S * 0.3); c.lineTo(cx0 + (r() - 0.5) * S * 0.4, cy0 + (r() - 0.5) * S * 0.4);
    c.stroke();
    // 铜钉
    var st = [[x + m + S * 0.09, y + m + S * 0.09], [x + S - m - S * 0.09, y + m + S * 0.09], [x + m + S * 0.09, y + S - m - S * 0.09], [x + S - m - S * 0.09, y + S - m - S * 0.09]];
    st.forEach(function (p) {
      var sg = c.createRadialGradient(p[0] - S * 0.01, p[1] - S * 0.01, 0, p[0], p[1], S * 0.04);
      sg.addColorStop(0, '#f0d090'); sg.addColorStop(1, '#6a4a20');
      c.fillStyle = sg; circ(c, p[0], p[1], S * 0.032); c.fill();
    });
    if (high) {
      c.strokeStyle = 'rgba(255,240,200,.35)'; c.lineWidth = Math.max(1, S * 0.03);
      c.beginPath(); c.moveTo(x + S * 0.38, y + S * 0.56); c.lineTo(x + S * 0.5, y + S * 0.46); c.lineTo(x + S * 0.62, y + S * 0.56); c.stroke();
    }
  }
  function waterBand(c, x, y, w, h, col, r) {
    var g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, mix(col, '#000000', 0.25)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000000', 0.3));
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(200,230,240,.22)'; c.lineWidth = 1.2;
    for (var i = 0; i < w * h / 500; i++) {
      var wx = x + r() * w, wy = y + r() * h, ww = 6 + r() * 14;
      c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + ww / 2, wy - 3, wx + ww, wy); c.stroke();
    }
  }
  function cliff(c, x, y, S, r) {
    var g = c.createLinearGradient(x, y, x + S, y + S);
    g.addColorStop(0, '#5a544a'); g.addColorStop(1, '#25221e');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y + S);
    for (var i = 0; i <= 5; i++) c.lineTo(x + i * S / 5, y + S * (0.05 + r() * 0.25));
    c.lineTo(x + S, y + S); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,240,210,.18)'; c.lineWidth = 1.2;
    for (var j = 0; j < 4; j++) { var sx = x + r() * S; c.beginPath(); c.moveTo(sx, y + S * 0.3); c.lineTo(sx + (r() - 0.5) * S * 0.3, y + S * 0.9); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, y + S * 0.85, S, S * 0.15);
  }

  // 画整张战场的静态部分（背景缓存与关卡缩略图共用）
  function drawTerrain(c, li, cells, S, opt) {
    opt = opt || {};
    var L = Z.LEVELS[li], P = Z.PATHS[li], T = TERRAIN[L.terrain] || TERRAIN.plain;
    var W = S * Z.COLS, H = S * Z.ROWS, r = rng(li * 101 + 7);
    var thumb = !!opt.thumb;
    // 底色与大块明暗
    c.fillStyle = T.g1; c.fillRect(0, 0, W, H);
    for (var i = 0; i < (thumb ? 18 : 46); i++) {
      var bx = r() * W, by = r() * H, br = S * (0.6 + r() * 1.8);
      var bg = c.createRadialGradient(bx, by, 0, bx, by, br);
      var col = r() < 0.5 ? T.g2 : T.g3;
      bg.addColorStop(0, col); bg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.35 + r() * 0.3;
      c.fillStyle = bg; c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    c.globalAlpha = 1;
    if (!thumb) {
      // 细碎石子与草
      for (var k = 0; k < 160; k++) {
        c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.2)' : 'rgba(255,235,200,.12)';
        circ(c, r() * W, r() * H, S * (0.01 + r() * 0.025)); c.fill();
      }
      for (var gk = 0; gk < 60; gk++) scrub(c, r() * W, r() * H, S * 0.7, T.grass, r);
    }
    // 远山
    for (var m = 0; m < 3; m++) {
      c.fillStyle = T.mount;
      c.globalAlpha = [0.28, 0.42, 0.6][m];
      c.beginPath();
      var base = S * (0.35 + m * 0.18);
      c.moveTo(0, 0); c.lineTo(0, base);
      for (var xx = 0; xx <= W + 1; xx += S * 0.35) c.lineTo(xx, base - S * (0.12 + r() * 0.35) * (1 - m * 0.2));
      c.lineTo(W, 0); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
    var mist = c.createLinearGradient(0, 0, 0, S * 1.1);
    mist.addColorStop(0, 'rgba(10,8,6,.55)'); mist.addColorStop(0.6, 'rgba(10,8,6,.1)'); mist.addColorStop(1, 'rgba(10,8,6,0)');
    c.fillStyle = mist; c.fillRect(0, 0, W, S * 1.1);

    // 河流（长坂桥 / 樊城水域）
    if (T.water) {
      var rows = {};
      cells.forEach(function (ce) { if (ce.block) rows[ce.r] = (rows[ce.r] || 0) + 1; });
      cells.forEach(function (ce) {
        if (!ce.block) return;
        waterBand(c, ce.c * S - 1, ce.r * S, S + 2, S, T.water, r);
      });
      if (L.bridge) {
        var bx0 = L.bridge[0] * S, by0 = L.bridge[1] * S;
        waterBand(c, bx0, by0, S, S, T.water, r);
      }
    }
    // 道路
    var pts = P.pts;
    function poly(w, col, alpha) {
      c.globalAlpha = alpha == null ? 1 : alpha;
      c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[0][0] * S, pts[0][1] * S);
      for (var q = 1; q < pts.length; q++) c.lineTo(pts[q][0] * S, pts[q][1] * S);
      c.stroke(); c.globalAlpha = 1;
    }
    var pp = {};
    if (T.waterPath) {
      poly(S * 1.04, '#8a7550');
      poly(S * 0.9, '#5b4a32');
      poly(S * 0.82, T.road2);
      poly(S * 0.66, T.road);
      poly(S * 0.3, '#3b6a7c', 0.5);
      c.strokeStyle = 'rgba(190,225,235,.35)'; c.lineWidth = 1.2;
      for (var dw = 0.3; dw < P.len; dw += 0.32) {
        Z.posAt(P, dw, (r() - 0.5) * 0.5, pp);
        c.beginPath(); c.moveTo(pp.x * S - S * 0.08, pp.y * S); c.quadraticCurveTo(pp.x * S, pp.y * S - S * 0.05, pp.x * S + S * 0.08, pp.y * S); c.stroke();
      }
    } else {
      poly(S * 0.98, 'rgba(0,0,0,.35)');
      poly(S * 0.9, T.road2);
      poly(S * 0.76, T.road);
      poly(S * 0.4, 'rgba(255,240,210,.12)');
      if (!thumb) {
        // 车辙
        c.strokeStyle = 'rgba(40,28,16,.4)'; c.lineWidth = Math.max(1, S * 0.03);
        [-0.19, 0.19].forEach(function (off) {
          c.beginPath();
          for (var dd = 0; dd < P.len - 0.3; dd += 0.08) { Z.posAt(P, dd, off, pp); if (dd === 0) c.moveTo(pp.x * S, pp.y * S); else c.lineTo(pp.x * S, pp.y * S); }
          c.stroke();
        });
        // 脚印与马蹄印
        for (var f = 0.4; f < P.len - 0.5; f += 0.27) {
          var side = (Math.round(f / 0.27) % 2) ? 0.08 : -0.08;
          Z.posAt(P, f, side + (r() - 0.5) * 0.18, pp);
          c.save(); c.translate(pp.x * S, pp.y * S); c.rotate(Math.atan2(pp.dy, pp.dx));
          c.fillStyle = 'rgba(45,30,18,.32)';
          if (r() < 0.3) { c.lineWidth = Math.max(1, S * 0.02); c.strokeStyle = 'rgba(45,30,18,.35)'; c.beginPath(); c.arc(0, 0, S * 0.04, 0.5, Math.PI * 2 - 0.5); c.stroke(); }
          else { c.beginPath(); c.ellipse(0, 0, S * 0.045, S * 0.022, 0, 0, 7); c.fill(); }
          c.restore();
        }
        for (var st = 0; st < P.len; st += 0.6) {
          Z.posAt(P, st, (r() - 0.5) * 0.7, pp);
          c.fillStyle = 'rgba(30,22,14,.4)'; circ(c, pp.x * S, pp.y * S, S * (0.015 + r() * 0.02)); c.fill();
        }
      }
    }
    // 长坂桥
    if (L.bridge) {
      var bx = L.bridge[0] * S, by = L.bridge[1] * S;
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(bx + S * 0.04, by + S * 0.02, S * 0.96, S);
      for (var pl = 0; pl < 6; pl++) {
        c.fillStyle = pl % 2 ? '#6e4f2e' : '#7d5a35';
        c.fillRect(bx + S * 0.06, by + pl * S / 6, S * 0.88, S / 6 - 1);
      }
      c.fillStyle = '#3a2614'; c.fillRect(bx + S * 0.02, by - S * 0.05, S * 0.08, S * 1.1); c.fillRect(bx + S * 0.9, by - S * 0.05, S * 0.08, S * 1.1);
      if (!thumb) c.drawImage(glyph('长坂桥', S * 0.2, 'rgba(240,220,170,.7)').cv, bx - S * 0.9, by + S * 0.3, S * 0.9, S * 0.4);
    }
    // 格子
    cells.forEach(function (ce) {
      var x = ce.c * S, y = ce.r * S, tr = rng(li * 1000 + ce.c * 31 + ce.r * 7);
      if (ce.path || (ce.block && T.water)) return;
      if (ce.block) { cliff(c, x, y, S, tr); return; }
      if (!ce.lock) { platform(c, x, y, S, ce.high); return; }
      // 荒地：草、石、树、营帐
      scrub(c, x + S / 2, y + S / 2, S, T.grass, tr);
      var roll = tr();
      if (T.tents && roll < 0.22) tent(c, x + S / 2, y + S * 0.5, S * 0.8);
      else if (T.trees && roll < T.trees) inkTree(c, x + S * (0.35 + tr() * 0.3), y + S * 0.55, S * (0.75 + tr() * 0.3), T.mount, tr);
      else if (roll < 0.62) rocks(c, x + S / 2, y + S * 0.55, S, tr);
      else if (roll < 0.72 && !thumb) stakes(c, x + S / 2, y + S * 0.5, S, tr);
      if (!thumb) {
        c.strokeStyle = 'rgba(255,230,180,.13)'; c.setLineDash([S * 0.08, S * 0.07]); c.lineWidth = 1;
        rrect(c, x + S * 0.1, y + S * 0.1, S * 0.8, S * 0.8, S * 0.08); c.stroke();
        c.setLineDash([]);
      }
    });
    // 阿斗营地的光
    var e = P.end, ax = (e[0] + 0.5) * S, ay = (e[1] + 0.5) * S;
    var lg = c.createRadialGradient(ax, ay, 0, ax, ay, S * 1.3);
    lg.addColorStop(0, 'rgba(255,200,120,.32)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = lg; c.fillRect(ax - S * 1.3, ay - S * 1.3, S * 2.6, S * 2.6);
    // 入口阴影
    var ex = P.pts[0][0] * S;
    var eg = c.createLinearGradient(0, 0, 0, S * 0.9);
    eg.addColorStop(0, 'rgba(0,0,0,.6)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = eg; c.fillRect(ex - S * 0.6, 0, S * 1.2, S * 0.9);
    // 斜阳与色调
    var sun = c.createLinearGradient(0, 0, W, H);
    sun.addColorStop(0, 'rgba(255,210,150,.16)'); sun.addColorStop(0.6, 'rgba(255,210,150,0)'); sun.addColorStop(1, 'rgba(20,10,5,.18)');
    c.fillStyle = sun; c.fillRect(0, 0, W, H);
    c.fillStyle = T.tint; c.fillRect(0, 0, W, H);
    grain(c, W, H, thumb ? 0.6 : 1);
  }
  function vignette(w, h) {
    var c = canvas(w * DPR, h * DPR), x = c.getContext('2d');
    x.scale(DPR, DPR);
    var g = x.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    return c;
  }

  // ---------- 兵种令牌 ----------
  var METAL = [
    ['#3d4046', '#a7adb4', '#2a2c30'], // 铁
    ['#5a3a18', '#d9a861', '#3c240c'], // 铜
    ['#4c5d72', '#e3ecf6', '#2f3a48'], // 银
    ['#7a5618', '#ffe08a', '#553a0a'], // 金
    ['#7a1c0c', '#ffc27a', '#4a0c04']  // 赤金
  ];
  var CHAR_COL = ['#e6dcc6', '#f2cf95', '#eef4ff', '#ffe49a', '#ffd9a8'];
  function tabletPath(c, w, h) {
    var x0 = -w / 2, y0 = -h / 2, arch = w * 0.32;
    c.beginPath();
    c.moveTo(x0, y0 + arch);
    c.quadraticCurveTo(x0, y0, 0, y0);
    c.quadraticCurveTo(-x0, y0, -x0, y0 + arch);
    c.lineTo(-x0, h / 2 - w * 0.08);
    c.lineTo(-x0 - w * 0.08, h / 2);
    c.lineTo(x0 + w * 0.08, h / 2);
    c.lineTo(x0, h / 2 - w * 0.08);
    c.closePath();
  }
  function drawUnit(c, k, lv, S) {
    var w = S * 0.76, h = S * 0.88, mt = METAL[lv - 1];
    // 投影
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath(); c.ellipse(S * 0.04, h / 2 + S * 0.02, w * 0.55, S * 0.08, 0, 0, 7); c.fill();
    if (lv === 5) {
      var hg = c.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.95);
      hg.addColorStop(0, 'rgba(255,140,60,.55)'); hg.addColorStop(1, 'rgba(255,140,60,0)');
      c.fillStyle = hg; circ(c, 0, 0, w * 0.95); c.fill();
    }
    // 金属外框
    var g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, mt[1]); g.addColorStop(0.45, mt[0]); g.addColorStop(0.7, mt[1]); g.addColorStop(1, mt[2]);
    tabletPath(c, w, h); c.fillStyle = g; c.fill();
    c.lineWidth = Math.max(1, S * 0.02); c.strokeStyle = '#0d0906'; c.stroke();
    // 漆面
    var iw = w * 0.78, ih = h * 0.8;
    c.save(); c.translate(0, -h * 0.01);
    var lg = c.createLinearGradient(0, -ih / 2, 0, ih / 2);
    lg.addColorStop(0, '#33251a'); lg.addColorStop(1, '#140e09');
    tabletPath(c, iw, ih); c.fillStyle = lg; c.fill();
    c.lineWidth = Math.max(1, S * 0.012); c.strokeStyle = mix(mt[1], '#000000', 0.25); c.stroke();
    c.restore();
    // 光泽
    c.save();
    tabletPath(c, w, h); c.clip();
    var sh = c.createLinearGradient(0, -h / 2, 0, 0);
    sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh; c.fillRect(-w / 2, -h / 2, w, h / 2);
    c.restore();
    // 字
    var gl = glyph(Z.UNITS[k].ch, S * 0.54, CHAR_COL[lv - 1], { glow: lv >= 4 ? (lv === 5 ? 'rgba(255,120,40,.9)' : 'rgba(255,215,120,.6)') : null, stroke: '#0a0705', sw: 0.08 });
    drawGlyph(c, gl, 0, -h * 0.03, 1);
    // 等级钉
    for (var i = 0; i < lv; i++) {
      var px = (i - (lv - 1) / 2) * w * 0.15, py = h / 2 - h * 0.08;
      var pg = c.createRadialGradient(px - 1, py - 1, 0, px, py, S * 0.04);
      pg.addColorStop(0, '#fff3c8'); pg.addColorStop(1, lv === 5 ? '#c0461c' : '#8a6420');
      c.fillStyle = pg; circ(c, px, py, S * 0.033); c.fill();
      c.lineWidth = 0.8; c.strokeStyle = '#140e09'; c.stroke();
    }
  }
  function drawGeneral(c, k, S) {
    var def = Z.GENERALS[k], w = S * 0.84, h = S * 0.96;
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.beginPath(); c.ellipse(S * 0.04, h / 2 + S * 0.03, w * 0.58, S * 0.09, 0, 0, 7); c.fill();
    // 红穗
    c.save();
    c.translate(w * 0.36, h * 0.28);
    c.strokeStyle = '#7a1010'; c.lineWidth = S * 0.025;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(S * 0.06, S * 0.12, S * 0.03, S * 0.2); c.stroke();
    var tg = c.createLinearGradient(0, S * 0.18, 0, S * 0.42);
    tg.addColorStop(0, '#c42020'); tg.addColorStop(1, '#5a0808');
    c.fillStyle = tg;
    c.beginPath(); c.moveTo(-S * 0.02, S * 0.2); c.lineTo(S * 0.09, S * 0.2); c.lineTo(S * 0.12, S * 0.42); c.lineTo(-S * 0.05, S * 0.42); c.closePath(); c.fill();
    c.fillStyle = GOLD; c.fillRect(-S * 0.025, S * 0.18, S * 0.12, S * 0.035);
    c.restore();
    var g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#fff0b0'); g.addColorStop(0.35, '#b8862a'); g.addColorStop(0.65, '#ffe08a'); g.addColorStop(1, '#5e3e0c');
    tabletPath(c, w, h); c.fillStyle = g; c.fill();
    c.lineWidth = Math.max(1, S * 0.022); c.strokeStyle = '#0d0906'; c.stroke();
    var iw = w * 0.8, ih = h * 0.83;
    var lg = c.createLinearGradient(0, -ih / 2, 0, ih / 2);
    lg.addColorStop(0, '#7a1414'); lg.addColorStop(1, '#2e0505');
    tabletPath(c, iw, ih); c.fillStyle = lg; c.fill();
    c.lineWidth = Math.max(1, S * 0.015); c.strokeStyle = GOLD_L; c.stroke();
    tabletPath(c, iw * 0.88, ih * 0.9); c.lineWidth = 0.8; c.strokeStyle = 'rgba(243,214,138,.45)'; c.stroke();
    c.save();
    tabletPath(c, w, h); c.clip();
    var sh = c.createLinearGradient(0, -h / 2, 0, 0);
    sh.addColorStop(0, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh; c.fillRect(-w / 2, -h / 2, w, h / 2);
    c.restore();
    var fs = S * 0.37;
    drawGlyph(c, glyph(def.chars[0], fs, '#ffe6a0', { stroke: '#2a0505', sw: 0.1, glow: 'rgba(255,200,90,.35)' }), 0, -h * 0.17);
    drawGlyph(c, glyph(def.chars[1], fs, '#ffe6a0', { stroke: '#2a0505', sw: 0.1, glow: 'rgba(255,200,90,.35)' }), 0, h * 0.17);
  }
  // 名字字牌 / 铲：竹简纸牌
  function drawCard(c, ch, S, shovel) {
    var w = S * 0.66, h = S * 0.76;
    c.save();
    c.rotate(shovel ? 0.04 : -0.05);
    c.fillStyle = 'rgba(0,0,0,.45)';
    rrect(c, -w / 2 + S * 0.03, -h / 2 + S * 0.05, w, h, S * 0.05); c.fill();
    var g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#f1e4c3'); g.addColorStop(1, '#c9b083');
    c.fillStyle = g; rrect(c, -w / 2, -h / 2, w, h, S * 0.05); c.fill();
    c.lineWidth = Math.max(1, S * 0.02); c.strokeStyle = '#3a2614'; c.stroke();
    c.strokeStyle = shovel ? 'rgba(80,60,30,.5)' : 'rgba(158,27,27,.75)'; c.lineWidth = Math.max(1, S * 0.012);
    rrect(c, -w / 2 + S * 0.05, -h / 2 + S * 0.05, w - S * 0.1, h - S * 0.1, S * 0.03); c.stroke();
    // 纸纹
    c.strokeStyle = 'rgba(90,60,30,.12)'; c.lineWidth = 1;
    for (var i = 1; i < 5; i++) { c.beginPath(); c.moveTo(-w / 2 + 2, -h / 2 + i * h / 5); c.lineTo(w / 2 - 2, -h / 2 + i * h / 5 + 1); c.stroke(); }
    if (shovel) {
      c.save(); c.rotate(0.7);
      c.strokeStyle = '#5a3a1a'; c.lineWidth = S * 0.05; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -h * 0.34); c.lineTo(0, h * 0.04); c.stroke();
      c.fillStyle = '#7c8086'; c.strokeStyle = '#1c1612'; c.lineWidth = Math.max(1, S * 0.015);
      c.beginPath(); c.moveTo(-S * 0.09, h * 0.03); c.lineTo(S * 0.09, h * 0.03); c.lineTo(S * 0.085, h * 0.2); c.quadraticCurveTo(0, h * 0.32, -S * 0.085, h * 0.2); c.closePath(); c.fill(); c.stroke();
      c.restore();
      drawGlyph(c, glyph('铲', S * 0.2, '#9e1b1b'), -w * 0.24, -h * 0.28);
    } else {
      drawGlyph(c, glyph(ch, S * 0.46, '#1a120c'), 0, -h * 0.02);
      c.fillStyle = '#9e1b1b'; rrect(c, w * 0.12, h * 0.22, S * 0.13, S * 0.13, S * 0.02); c.fill();
      drawGlyph(c, glyph('将', S * 0.1, '#f3e3c0'), w * 0.12 + S * 0.065, h * 0.22 + S * 0.065);
    }
    c.restore();
  }
  function drawItem(c, it, S) {
    if (!it) return;
    if (it.t === 'u') drawUnit(c, it.k, it.lv, S);
    else if (it.t === 'g') drawGeneral(c, it.k, S);
    else if (it.t === 'c') drawCard(c, it.ch, S);
    else if (it.t === 's') drawCard(c, '', S, true);
  }

  // ---------- 敌军军旗 ----------
  function drawEnemy(c, e, S, fac) {
    var F = Z.FACTIONS[fac] || Z.FACTIONS.wei;
    var r = e.r * S, w = r * 2.15, h = r * 2.55;
    var big = e.boss;
    var body = e.type === 'xiang' ? '#4e4a44' : F.color;
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath(); c.ellipse(r * 0.1, h * 0.46, w * 0.55, r * 0.25, 0, 0, 7); c.fill();
    // 暗色光晕，让军旗在任何地面上都清楚
    var halo = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.7);
    halo.addColorStop(0, 'rgba(0,0,0,.45)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = halo; circ(c, 0, 0, r * 1.7); c.fill();
    if (e.type === 'chuan' || (big && fac === 'wei' && e.ch === '操')) {
      // 战船：船身在下，军旗为帆
      var bw = w * 1.35, bh = h * 0.26;
      var hg = c.createLinearGradient(0, h * 0.2, 0, h * 0.5);
      hg.addColorStop(0, '#6b4524'); hg.addColorStop(1, '#2a180a');
      c.fillStyle = hg; c.strokeStyle = '#0d0906'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-bw / 2, h * 0.22); c.lineTo(bw / 2, h * 0.22); c.lineTo(bw * 0.36, h * 0.22 + bh); c.lineTo(-bw * 0.36, h * 0.22 + bh); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#2a180a'; c.lineWidth = 1;
      for (var o = -2; o <= 2; o++) { c.beginPath(); c.moveTo(o * bw * 0.14, h * 0.3); c.lineTo(o * bw * 0.14 - 4, h * 0.3 + bh * 1.1); c.stroke(); }
      c.translate(0, -h * 0.12);
      h *= 0.82;
    }
    // 旗杆横梁
    c.strokeStyle = '#1a120a'; c.lineWidth = Math.max(1.5, r * 0.12); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-w * 0.6, -h / 2); c.lineTo(w * 0.6, -h / 2); c.stroke();
    c.fillStyle = big ? GOLD : BRONZE;
    circ(c, -w * 0.6, -h / 2, r * 0.09); c.fill(); circ(c, w * 0.6, -h / 2, r * 0.09); c.fill();
    // 旗面（燕尾）
    var g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, mix(body, '#ffffff', 0.12)); g.addColorStop(0.55, body); g.addColorStop(1, mix(body, '#000000', 0.5));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(0, h / 2 - h * 0.17); c.lineTo(-w / 2, h / 2); c.closePath();
    c.fill();
    c.lineWidth = Math.max(2, r * 0.14); c.strokeStyle = 'rgba(10,6,4,.85)'; c.stroke();
    c.lineWidth = Math.max(1, r * 0.05); c.strokeStyle = 'rgba(240,220,180,.55)'; c.stroke();
    c.lineWidth = Math.max(1, r * (big ? 0.09 : 0.05)); c.strokeStyle = big ? GOLD : 'rgba(214,176,110,.9)';
    c.beginPath();
    var m = r * 0.14;
    c.moveTo(-w / 2 + m, -h / 2 + m); c.lineTo(w / 2 - m, -h / 2 + m); c.lineTo(w / 2 - m, h / 2 - m * 1.4); c.lineTo(0, h / 2 - h * 0.17 - m); c.lineTo(-w / 2 + m, h / 2 - m * 1.4); c.closePath();
    c.stroke();
    if (big) {
      var name = e.name || '';
      if (name.length >= 2) {
        var two = name.length > 2 ? name.slice(-2) : name;
        var sf = needSerif(two) ? { stroke: '#120a05', sw: 0.1, font: 'serif', weight: '900' } : { stroke: '#120a05', sw: 0.1 };
        drawGlyph(c, glyph(two[0], r * (sf.font ? 0.7 : 0.82), '#ffe6a8', sf), 0, -h * 0.17);
        drawGlyph(c, glyph(two[1], r * (sf.font ? 0.7 : 0.82), '#ffe6a8', sf), 0, h * 0.16);
      }
      // 阵营印
      c.fillStyle = '#9e1b1b'; rrect(c, w / 2 - r * 0.42, -h / 2 + r * 0.18, r * 0.34, r * 0.34, 2); c.fill();
      drawGlyph(c, glyph(F.badge, r * 0.26, '#f3e3c0'), w / 2 - r * 0.25, -h / 2 + r * 0.35);
    } else {
      drawGlyph(c, glyph(e.ch, r * 1.08, '#f1e6cc', { stroke: '#0a0705', sw: 0.1 }), 0, -h * 0.04);
    }
    if (e.type === 'xiang') {
      c.strokeStyle = '#efe6d0'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-w * 0.35, h * 0.38); c.quadraticCurveTo(-w * 0.55, h * 0.6, -w * 0.3, h * 0.66); c.stroke();
      c.beginPath(); c.moveTo(w * 0.35, h * 0.38); c.quadraticCurveTo(w * 0.55, h * 0.6, w * 0.3, h * 0.66); c.stroke();
    }
  }

  // ---------- 旗帜（飘动，动态绘制） ----------
  function drawFlag(c, x, y, size, ch, col, t, phase, pole) {
    var ph = phase || 0, ph2 = pole == null ? size * 1.6 : pole;
    c.strokeStyle = '#1a120a'; c.lineWidth = Math.max(1.5, size * 0.07); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - ph2); c.stroke();
    c.fillStyle = GOLD; circ(c, x, y - ph2, size * 0.07); c.fill();
    var fw = size, fh = size * 0.78, top = y - ph2 + size * 0.06;
    c.beginPath();
    c.moveTo(x, top);
    var n = 6;
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      c.lineTo(x + fw * k, top + Math.sin(t * 5 + ph + k * 3) * size * 0.07 * k);
    }
    for (var j = n; j >= 0; j--) {
      var k2 = j / n;
      c.lineTo(x + fw * k2, top + fh + Math.sin(t * 5 + ph + k2 * 3 + 0.4) * size * 0.07 * k2 - (j === n ? fh * 0.25 : 0));
    }
    c.closePath();
    var g = c.createLinearGradient(x, top, x + fw, top + fh);
    g.addColorStop(0, mix(col, '#ffffff', 0.1)); g.addColorStop(1, mix(col, '#000000', 0.45));
    c.fillStyle = g; c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
    if (ch) drawGlyph(c, glyph(ch, size * (ch.length > 1 ? 0.36 : 0.55), '#f3e3c0', { stroke: 'rgba(0,0,0,.6)', sw: 0.08 }), x + fw * 0.48, top + fh * 0.45 + Math.sin(t * 5 + ph + 1.5) * size * 0.04);
  }

  // ---------- 阿斗：辎车、汉旗、赵云之枪 ----------
  function drawBase(c, x, y, S, t, hurt, heal) {
    c.save();
    c.translate(x, y);
    // 汉旗
    drawFlag(c, -S * 0.42, S * 0.35, S * 0.48, '汉', '#9e1b1b', t, 0.3, S * 0.95);
    // 枪
    c.strokeStyle = '#2a1a0c'; c.lineWidth = S * 0.04; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S * 0.36, S * 0.38); c.lineTo(S * 0.5, -S * 0.42); c.stroke();
    c.fillStyle = '#c9ccd2'; c.strokeStyle = '#1a1410'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(S * 0.5, -S * 0.42); c.lineTo(S * 0.47, -S * 0.5); c.lineTo(S * 0.535, -S * 0.62); c.lineTo(S * 0.545, -S * 0.48); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b01c1c'; circ(c, S * 0.493, -S * 0.4, S * 0.04); c.fill();
    // 车
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.beginPath(); c.ellipse(0, S * 0.36, S * 0.42, S * 0.09, 0, 0, 7); c.fill();
    c.strokeStyle = '#1c120a'; c.lineWidth = S * 0.035;
    circ(c, -S * 0.2, S * 0.27, S * 0.12); c.stroke(); circ(c, S * 0.2, S * 0.27, S * 0.12); c.stroke();
    c.lineWidth = 1.2;
    for (var sp = 0; sp < 4; sp++) {
      var a = sp * Math.PI / 4 + t * 0;
      [-0.2, 0.2].forEach(function (wx) { c.beginPath(); c.moveTo(wx * S - Math.cos(a) * S * 0.11, S * 0.27 - Math.sin(a) * S * 0.11); c.lineTo(wx * S + Math.cos(a) * S * 0.11, S * 0.27 + Math.sin(a) * S * 0.11); c.stroke(); });
    }
    var bg = c.createLinearGradient(0, -S * 0.05, 0, S * 0.22);
    bg.addColorStop(0, '#7a5230'); bg.addColorStop(1, '#3e2814');
    c.fillStyle = bg; c.strokeStyle = '#140c06'; c.lineWidth = 1.5;
    rrect(c, -S * 0.32, -S * 0.02, S * 0.64, S * 0.24, S * 0.03); c.fill(); c.stroke();
    // 车篷
    var cg = c.createLinearGradient(0, -S * 0.32, 0, 0);
    cg.addColorStop(0, '#b02424'); cg.addColorStop(1, '#5c0c0c');
    c.fillStyle = cg;
    c.beginPath(); c.moveTo(-S * 0.3, 0); c.quadraticCurveTo(-S * 0.3, -S * 0.34, 0, -S * 0.34); c.quadraticCurveTo(S * 0.3, -S * 0.34, S * 0.3, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = GOLD; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-S * 0.3, -S * 0.02); c.quadraticCurveTo(0, -S * 0.08, S * 0.3, -S * 0.02); c.stroke();
    // 篷内的襁褓
    c.fillStyle = '#1a0c06'; c.beginPath(); c.ellipse(0, -S * 0.08, S * 0.15, S * 0.12, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#e9cfa8'; circ(c, 0, -S * 0.1, S * 0.055); c.fill();
    c.fillStyle = '#c8a24a'; c.beginPath(); c.ellipse(0, -S * 0.03, S * 0.1, S * 0.045, 0, 0, 7); c.fill();
    if (hurt > 0) {
      c.fillStyle = 'rgba(255,40,30,' + Math.min(0.55, hurt * 0.7) + ')';
      circ(c, 0, 0, S * 0.6); c.fill();
    }
    if (heal > 0) {
      c.fillStyle = 'rgba(120,230,150,' + Math.min(0.45, heal * 0.5) + ')';
      circ(c, 0, -S * 0.05, S * 0.55); c.fill();
    }
    c.restore();
  }

  // ---------- 标题页水墨全景 ----------
  function drawTitleScene(c, w, h, seed, swash) {
    var r = rng(seed || 3);
    var sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1a0f0b'); sky.addColorStop(0.35, '#5a1c12'); sky.addColorStop(0.6, '#a3462a'); sky.addColorStop(0.75, '#3a1a10'); sky.addColorStop(1, '#0e0a08');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    // 残阳
    var sx = w * 0.72, sy = h * 0.5;
    var sg = c.createRadialGradient(sx, sy, 0, sx, sy, w * 0.55);
    sg.addColorStop(0, 'rgba(255,200,120,.75)'); sg.addColorStop(0.12, 'rgba(255,120,60,.55)'); sg.addColorStop(1, 'rgba(255,80,40,0)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8542a'; circ(c, sx, sy, w * 0.11); c.fill();
    if (swash) inkSwash(c, w * 0.02, h * 0.19, w * 0.96, h * 0.11, '#070202', 4);
    // 层叠山峦
    var layers = [['#3c1a12', 0.52, 0.12], ['#2a120c', 0.6, 0.1], ['#1a0c08', 0.7, 0.08], ['#0e0806', 0.8, 0.06]];
    layers.forEach(function (Ly, li) {
      c.fillStyle = Ly[0];
      c.beginPath(); c.moveTo(0, h);
      var base = h * Ly[1];
      for (var x = 0; x <= w + 10; x += w / 24) c.lineTo(x, base - Math.abs(Math.sin(x / w * (5 + li) + li)) * h * Ly[2] - r() * h * 0.02);
      c.lineTo(w, h); c.closePath(); c.fill();
      var mg = c.createLinearGradient(0, base - h * 0.05, 0, base + h * 0.08);
      mg.addColorStop(0, 'rgba(160,80,50,0)'); mg.addColorStop(0.5, 'rgba(160,80,50,.18)'); mg.addColorStop(1, 'rgba(160,80,50,0)');
      c.fillStyle = mg; c.fillRect(0, base - h * 0.05, w, h * 0.13);
    });
    // 山脊上的军阵：长枪林立、旌旗招展
    var ridge = h * 0.79;
    c.strokeStyle = '#070504'; c.fillStyle = '#070504';
    for (var i = 0; i < 70; i++) {
      var x = r() * w, yy = ridge - Math.abs(Math.sin(x / w * 9)) * h * 0.02;
      var hh = h * (0.03 + r() * 0.05);
      c.lineWidth = 1 + r();
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + r() * 3 - 1.5, yy - hh); c.stroke();
      if (r() < 0.25) {
        c.beginPath(); c.moveTo(x, yy - hh); c.lineTo(x + h * 0.03, yy - hh + h * 0.008); c.lineTo(x + h * 0.026, yy - hh + h * 0.03); c.lineTo(x, yy - hh + h * 0.024); c.closePath(); c.fill();
      }
    }
    c.fillRect(0, ridge, w, h - ridge);
    // 地面雾
    var fg = c.createLinearGradient(0, ridge - h * 0.05, 0, h);
    fg.addColorStop(0, 'rgba(120,60,40,.25)'); fg.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = fg; c.fillRect(0, ridge - h * 0.05, w, h);
    // 前景大旗剪影（汉、赵），逆光描边
    [[w * 0.07, h * 0.9, h * 0.34, '汉', -0.06, 1], [w * 0.95, h * 0.92, h * 0.3, '赵', 0.05, -1]].forEach(function (f) {
      var px = f[0], py = f[1], ph = f[2];
      c.save(); c.translate(px, py); c.rotate(f[4]); c.scale(f[5], 1);
      c.strokeStyle = '#050302'; c.lineWidth = Math.max(3, w * 0.012);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -ph); c.stroke();
      var fw = ph * 0.42, fh = ph * 0.5, top = -ph + ph * 0.03;
      c.beginPath(); c.moveTo(0, top);
      for (var i = 0; i <= 8; i++) c.lineTo(fw * i / 8, top + Math.sin(i / 8 * 3) * ph * 0.025 * i / 8);
      for (var j = 8; j >= 0; j--) c.lineTo(fw * j / 8, top + fh + Math.sin(j / 8 * 3 + 0.5) * ph * 0.025 * j / 8 - (j === 8 ? fh * 0.2 : 0));
      c.closePath();
      var bg = c.createLinearGradient(0, top, fw, top + fh);
      bg.addColorStop(0, '#3a0808'); bg.addColorStop(1, '#120303');
      c.fillStyle = bg; c.fill();
      c.strokeStyle = 'rgba(255,140,70,.45)'; c.lineWidth = 1.5; c.stroke();
      c.save(); c.translate(fw * 0.48, top + fh * 0.45); c.scale(f[5], 1);
      c.font = Math.round(fw * 0.62) + 'px ' + BRUSH; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,170,90,.55)'; c.fillText(f[3], 0, 0);
      c.restore();
      c.restore();
    });
    grain(c, w, h, 0.9);
  }
  // 书法飞白墨痕（标题衬底）
  function inkSwash(c, x, y, len, thick, col, seed) {
    var r = rng(seed || 9);
    c.save();
    c.fillStyle = col;
    // 由许多细笔丝组成的横向一笔，末端飞白
    for (var i = 0; i < 70; i++) {
      var off = (r() - 0.5) * thick, a = 0.08 + r() * 0.16;
      var x0 = x + r() * len * 0.08, x1 = x + len * (0.75 + r() * 0.25);
      c.globalAlpha = a;
      c.lineWidth = 1 + r() * thick * 0.12;
      c.strokeStyle = col; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x0, y + off * 0.6 + thick * 0.15);
      c.bezierCurveTo(x + len * 0.3, y + off - thick * 0.25, x + len * 0.65, y + off * 0.8 - thick * 0.1, x1, y + off * 0.5 - thick * 0.35);
      c.stroke();
    }
    c.restore();
  }

  window.ZYArt = {
    BRUSH: BRUSH, WILD: WILD, SERIF: SERIF, needSerif: needSerif, TERRAIN: TERRAIN, METAL: METAL,
    setDpr: setDpr, glyph: glyph, drawGlyph: drawGlyph, rrect: rrect, circ: circ, mix: mix, canvas: canvas, rng: rng, hash: hash,
    drawTerrain: drawTerrain, vignette: vignette, drawUnit: drawUnit, drawGeneral: drawGeneral, drawCard: drawCard, drawItem: drawItem,
    drawEnemy: drawEnemy, drawFlag: drawFlag, drawBase: drawBase, drawTitleScene: drawTitleScene, grain: grain,
    clearGlyphs: function () { glyphCache = {}; glyphCount = 0; }
  };
})();
