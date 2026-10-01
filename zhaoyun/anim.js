/* 赵云与阿斗 v3 · 笔画动画：字化兵器、投射物、敌军、阵亡、武将技能、粒子 */
(function () {
  'use strict';
  var I = window.ZYInk, Z = window.ZYCore;
  var PI = Math.PI, TAU = PI * 2;
  var INK = '#1b1712', VERM = '#b3261e', GOLD = '#c9962e', GOLDL = '#f0cf6e', PAPER = '#f2e9d6', HALO = 'rgba(255,248,230,.95)';
  var E = null; // 环境：ctx, cell, pos(), sfx(), shake(), now
  function init(env) { E = env; }

  // ---------- 缓动 ----------
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return cl((t - a) / (b - a)); }
  function eo(p) { return 1 - Math.pow(1 - p, 3); }
  function ei(p) { return p * p * p; }
  function eio(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function back(p) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function bez(a, c, b, p) { var q = 1 - p; return q * q * a + 2 * q * p * c + p * p * b; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function angLerp(a, b, p) { var d = ((b - a + PI * 3) % TAU) - PI; return a + d * p; }

  // ---------- 粒子 ----------
  var parts = [], MAXP = 360;
  function part(o) {
    if (parts.length >= MAXP) parts.shift();
    o.t = 0; parts.push(o); return o;
  }
  function drops(x, y, n, spd, size, color, up) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = spd * (0.3 + Math.random());
      part({ k: 'drop', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), g: spd * 2.2, life: rnd(0.35, 0.7), s: size * rnd(0.4, 1.1), c: color || INK, v: (Math.random() * 6) | 0 });
    }
  }
  function dust(x, y, n, size) {
    for (var i = 0; i < n; i++) part({ k: 'dust', x: x + rnd(-1, 1) * size * 0.3, y: y, vx: rnd(-1, 1) * size, vy: -rnd(0.2, 0.8) * size, g: 0, life: rnd(0.4, 0.8), s: size * rnd(0.35, 0.7) });
  }
  function sparks(x, y, n, spd, color) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = spd * rnd(0.4, 1.2); part({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: spd * 0.8, life: rnd(0.25, 0.55), s: rnd(1.2, 2.6), c: color || GOLDL }); }
  }
  function embers(x, y, n, size) {
    for (var i = 0; i < n; i++) part({ k: 'ember', x: x + rnd(-1, 1) * size * 0.4, y: y + rnd(-1, 1) * size * 0.2, vx: rnd(-1, 1) * size * 0.6, vy: -rnd(0.8, 2) * size, g: 0, life: rnd(0.4, 0.9), s: rnd(1.4, 3) });
  }
  function updParts(dt) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      if (p.k === 'dust') { p.vx *= 0.95; p.vy *= 0.95; }
    }
    var j = 0;
    for (var k = 0; k < parts.length; k++) if (parts[k].t < parts[k].life) parts[j++] = parts[k];
    parts.length = j;
  }
  function drawParts(ctx) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], q = p.t / p.life, a = 1 - q;
      if (p.k === 'drop') {
        var bs = I.blotSprite(p.v, p.c, Math.max(2, Math.round(p.s)));
        I.blit(ctx, bs, p.x, p.y, 1 - q * 0.4, a * 0.9);
      } else if (p.k === 'dust') {
        ctx.globalAlpha = a * 0.2;
        ctx.fillStyle = '#9a8a70';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.6 + q * 0.8), 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.k === 'spark') {
        ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        ctx.globalAlpha = 1;
      } else if (p.k === 'ember') {
        ctx.globalAlpha = a;
        ctx.fillStyle = q < 0.4 ? '#ffd27a' : q < 0.7 ? '#f07a2a' : '#9a2a14';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - q * 0.5), 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- 特效（世界层） ----------
  var fx = [];
  function addFx(o) { o.t = 0; fx.push(o); if (fx.length > 260) fx.shift(); return o; }
  function slash(x, y, ang, size, color, life) { return addFx({ k: 'slash', x: x, y: y, ang: ang, s: size, c: color || VERM, life: life || 0.28 }); }
  function ring(x, y, r0, r1, color, life, w) { return addFx({ k: 'ring', x: x, y: y, r0: r0, r1: r1, c: color || '27,23,18', life: life || 0.45, w: w || 3 }); }
  function word(x, y, txt, size, color, life, rot) { return addFx({ k: 'word', x: x, y: y, txt: txt, s: size, c: color || INK, life: life || 0.6, rot: rot || 0 }); }
  function drawFx(ctx, dt) {
    var keep = 0;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      f.t += dt;
      if (f.t >= f.life) continue;
      fx[keep++] = f;
      var p = f.t / f.life;
      FXD[f.k](ctx, f, p);
    }
    fx.length = keep;
  }
  var FXD = {
    slash: function (ctx, f, p) {
      // 一道月牙墨痕，快速划出后淡去
      var grow = eo(cl(p / 0.35)), a = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
      ctx.globalAlpha = a * 0.92; ctx.fillStyle = f.c;
      var r = f.s * 0.55, a0 = -1.25, a1 = a0 + 2.5 * grow;
      I.crescent(ctx, -r * 0.35, 0, r, a0, a1, r * 0.28);
      ctx.globalAlpha = a * 0.9;
      ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = 'rgba(255,246,228,.95)';
      ctx.beginPath(); ctx.arc(-r * 0.35 + r * 0.1, 0, r * 0.96, a0 + 0.35, a0 + 0.35 + 1.9 * grow); ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = 1; ctx.strokeStyle = f.c;
      ctx.beginPath(); ctx.arc(-r * 0.35, 0, r * 1.12, a0 + 0.2, a0 + 0.2 + 2.1 * grow); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    },
    ring: function (ctx, f, p) {
      var r = lerp(f.r0, f.r1, eo(p));
      ctx.strokeStyle = 'rgba(' + f.c + ',' + (0.75 * (1 - p)) + ')';
      ctx.lineWidth = f.w * (1 - p * 0.7);
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = Math.max(0.6, f.w * 0.35 * (1 - p));
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.86, 0.3, 2.6); ctx.arc(f.x, f.y, r * 0.86, 3.4, 5.6); ctx.stroke();
    },
    word: function (ctx, f, p) {
      var sc = p < 0.15 ? lerp(1.7, 1, eo(p / 0.15)) : 1 + (p - 0.15) * 0.1;
      var a = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
      ctx.save(); ctx.translate(f.x, f.y - p * f.s * 0.3); ctx.rotate(f.rot); ctx.scale(sc, sc);
      ctx.globalAlpha = a;
      ctx.font = f.s + 'px "ZY Brush", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = f.s * 0.12; ctx.strokeStyle = 'rgba(244,236,219,.85)'; ctx.strokeText(f.txt, 0, 0);
      ctx.fillStyle = f.c; ctx.fillText(f.txt, 0, 0);
      ctx.restore(); ctx.globalAlpha = 1;
    },
    death: function (ctx, f, p) {
      // 敌字崩散：每一笔向外飞散旋转，墨色渐淡；墨牌碎片落下
      var g = f.g, k = f.size / 1024, a = 1 - eo(p) * 0.95;
      ctx.save();
      ctx.globalAlpha = a;
      for (var i = 0; i < g.n; i++) {
        var d = f.dir[i];
        var dd = eo(p) * f.cell * (0.35 + d[2] * 0.4) * (f.boss ? 1.8 : 1);
        var wx = f.x + (g.cx[i] - 512) * k + d[0] * dd, wy = f.y + (g.cy[i] - 512) * k + d[1] * dd + p * p * f.cell * 0.4;
        I.strokeAt(ctx, g, i, wx, wy, f.size, { rot: d[3] * p * 2.4, sx: 1 - p * 0.3, sy: 1 - p * 0.3, color: INK });
      }
      // 碎牌
      ctx.fillStyle = '#26221e';
      for (var j = 0; j < 4; j++) {
        var sh = f.sh[j], sx = f.x + sh[0] * f.size * 0.3 + sh[0] * eo(p) * f.cell * 0.4, sy = f.y + sh[1] * f.size * 0.3 + sh[1] * eo(p) * f.cell * 0.3 + p * p * f.cell * 0.6;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(sh[2] * p * 4);
        ctx.beginPath(); ctx.moveTo(-f.size * 0.2, -f.size * 0.15); ctx.lineTo(f.size * 0.18, -f.size * 0.1); ctx.lineTo(0, f.size * 0.2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    },
    boom: function (ctx, f, p) {
      // 落石：墨晕炸开 + 冲击圈
      var r = f.r * eo(cl(p / 0.4));
      var a = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7;
      ctx.globalAlpha = a * 0.55;
      I.blit(ctx, I.blotSprite(f.v, INK, Math.round(f.r * 0.6)), f.x, f.y, (r / f.r) * 1.4);
      ctx.globalAlpha = a * 0.3;
      ctx.fillStyle = '#6b5a42';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, r * 1.1, r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    },
    pierce: function (ctx, f, p) {
      // 贯穿线：墨色速度线
      var a = 1 - p;
      ctx.strokeStyle = 'rgba(' + (f.c || '27,23,18') + ',' + (0.55 * a) + ')';
      for (var i = 0; i < 3; i++) {
        var off = (i - 1) * f.w * 0.35, nx = -Math.sin(f.ang) * off, ny = Math.cos(f.ang) * off;
        var st = eo(p) * 0.5;
        ctx.lineWidth = (i === 1 ? 2.2 : 1) * a;
        ctx.beginPath();
        ctx.moveTo(f.x + nx + Math.cos(f.ang) * f.len * st, f.y + ny + Math.sin(f.ang) * f.len * st);
        ctx.lineTo(f.x + nx + Math.cos(f.ang) * f.len, f.y + ny + Math.sin(f.ang) * f.len);
        ctx.stroke();
      }
    },
    write: function (ctx, f, p) {
      // 世界坐标中书写一个字（技能题字用）
      var g = I.glyph(f.ch); if (!g) return;
      var a = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      ctx.globalAlpha = a;
      if (f.seal) I.blit(ctx, I.glowSprite(f.glow || 'rgba(255,240,200,.8)', Math.round(f.s * 0.7)), f.x, f.y, 1, 0.8);
      I.drawWriting(ctx, g, f.x, f.y, f.s, f.c, cl(p / (f.wp || 0.45)));
      ctx.globalAlpha = 1;
    },
    flash: function (ctx, f, p) {
      ctx.globalAlpha = (1 - p) * (f.a || 0.6);
      I.blit(ctx, I.glowSprite(f.c, Math.round(f.r)), f.x, f.y, 0.6 + p * 0.6);
      ctx.globalAlpha = 1;
    },
    dig: function (ctx, f, p) {
      var a = 1 - p;
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#5a4630';
      ctx.beginPath(); ctx.ellipse(f.x, f.y + f.s * 0.2, f.s * 0.5 * eo(p), f.s * 0.2 * eo(p), 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    },
    hearts: function (ctx, f, p) {
      ctx.globalAlpha = 1 - p;
      I.blit(ctx, I.glowSprite('rgba(255,215,120,.9)', Math.round(f.r)), f.x, f.y, 0.5 + p);
      ctx.globalAlpha = 1;
    },
    skill: function (ctx, f, p) { SK[f.gk].draw(ctx, f, p); },
    noop: function () {},
    lostcard: function (ctx, f, p) {
      // 作废 / 回收的字牌：牌身淡去，字的笔画化作墨烟升起
      var C = E.cell, it = f.it, sc = f.sink ? 1 - p * 0.6 : 1;
      ctx.globalAlpha = (1 - p) * 0.8;
      I.blit(ctx, I.tileSprite(it.t === 'g' ? 'g' : it.t, it.lv || 1, C), f.x, f.y + (f.sink ? p * C * 0.4 : 0), sc * 0.95);
      var ch = it.t === 'u' ? Z.UNITS[it.k].ch : it.t === 'c' ? it.ch : it.t === 's' ? '铲' : null;
      var g = ch && I.glyph(ch);
      if (g) {
        var S = C * 0.6 * sc, k = S / 1024;
        for (var i = 0; i < g.n; i++) {
          var dx = (g.cx[i] - 512) * k, dy = (g.cy[i] - 512) * k;
          I.strokeAt(ctx, g, i, f.x + dx * (1 + p * 0.6) + Math.sin(i * 2.3 + p * 6) * C * 0.1 * p, f.y + dy - p * C * (0.6 + (i % 3) * 0.2) + (f.sink ? p * C * 0.5 : 0), S, { rot: (i % 2 ? 1 : -1) * p * 0.8, color: it.t === 'c' ? VERM : INK });
        }
      }
      ctx.globalAlpha = 1;
    },
    banner: function (ctx, f, p) {
      // 竖排书法题字 + 朱印
      var a = p < 0.12 ? p / 0.12 : p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      var sc = p < 0.12 ? lerp(1.4, 1, eo(p / 0.12)) : 1;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(sc, sc);
      ctx.globalAlpha = a;
      ctx.font = f.s + 'px "ZY Brush", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var n = f.txt.length, h = n * f.s * 1.02;
      // 淡墨底
      ctx.fillStyle = 'rgba(244,236,219,.72)';
      ctx.beginPath(); ctx.ellipse(0, 0, f.s * 0.9, h * 0.62, 0, 0, TAU); ctx.fill();
      for (var i = 0; i < n; i++) {
        var yy = -h / 2 + (i + 0.5) * f.s * 1.02;
        ctx.lineWidth = f.s * 0.1; ctx.strokeStyle = 'rgba(244,236,219,.9)'; ctx.strokeText(f.txt[i], 0, yy);
        ctx.fillStyle = f.c || INK; ctx.fillText(f.txt[i], 0, yy);
      }
      if (f.seal) I.seal(ctx, f.s * 0.62, h / 2 - f.s * 0.2, f.s * 0.5, f.seal);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  };
  function banner(x, y, txt, size, seal, color) { return addFx({ k: 'banner', x: x, y: y, txt: txt, s: size, seal: seal, c: color, life: 1.5 }); }

  // ---------- 字牌几何 ----------
  function tileFace(X, Y) { var d = I.tileDims(E.cell); return Y - d.t / 2; }
  function unitSize() { return Math.round(E.cell * 0.64); }
  function genSize() { return Math.round(E.cell * 0.42); }
  // 字框坐标 -> 世界坐标
  function gx(g, i, cx, size) { return cx + (g.cx[i] - 512) * size / 1024; }
  function gy(g, i, cy, size) { return cy + (g.cy[i] - 512) * size / 1024; }
  function drawGroup(ctx, g, list, size, wx, wy, o) {
    // 一组笔画整体变换：组中心(px,py)落在 (wx,wy)
    var k = size / 1024;
    ctx.save();
    ctx.translate(wx, wy);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(k * (o.sx || 1), k * (o.sy || 1));
    ctx.translate(-o.px, -o.py);
    ctx.fillStyle = o.color;
    if (o.halo) { ctx.shadowColor = o.halo; ctx.shadowBlur = (o.hb || 4) * (window.devicePixelRatio || 1); }
    for (var i = 0; i < list.length; i++) ctx.fill(g.p[list[i]]);
    ctx.restore();
  }
  function mask(list) { var m = {}; list.forEach(function (i) { m[i] = 1; }); return m; }
  // 最直的一笔：作枪杆 / 箭杆
  var straightCache = {};
  function straightest(ch) {
    if (straightCache[ch] != null) return straightCache[ch];
    var g = I.glyph(ch), best = 0, bv = -1;
    for (var i = 0; i < g.n; i++) { var v = g.len[i] * (g.len[i] / g.ml[i]); if (v > bv) { bv = v; best = i; } }
    straightCache[ch] = best;
    return best;
  }

  // ---------- 兵种动画 ----------
  // a: { kind|gk, s, c, r, t, dur, X, Y（牌中心）, TX, TY（目标屏幕坐标）, lv, len, rad, f:{} }
  var UA = {};
  var DUR = { dao: 0.46, qiang: 0.5, gong: 0.42, qi: 0.62, dun: 0.5, huo: 0.46, gu: 0.45, nu: 0.5, tou: 0.62 };

  // 通用：飞刃（刀、关平、魏延、关羽普攻）
  function bladePose(a, t, out) {
    var P0x = out.p0x, P0y = out.p0y, TX = a.TX, TY = a.TY, C = E.cell;
    var dx = TX - P0x, dy = TY - P0y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    var side = a.flip ? -1 : 1;
    var p1 = seg(t, 0, 0.06), p2 = seg(t, 0.06, 0.17), p3 = seg(t, 0.17, 0.27), p4 = seg(t, 0.27, 0.46);
    if (t < 0.06) {
      out.x = P0x - dx / L * C * 0.1 * eo(p1); out.y = P0y - dy / L * C * 0.1 * eo(p1); out.rot = -0.6 * eo(p1) * side; out.sc = 1;
    } else if (t < 0.17) {
      var q = eio(p2);
      out.x = bez(P0x, (P0x + TX) / 2 + nx * C * 0.7 * side, TX, q); out.y = bez(P0y, (P0y + TY) / 2 + ny * C * 0.7 * side, TY, q);
      out.rot = (-0.6 + q * TAU * 1.25) * side; out.sc = 1 + 1.1 * q;
    } else if (t < 0.27) {
      var sw = Math.atan2(dy, dx) - 1.6 * side + eo(p3) * 3.2 * side;
      out.x = TX + Math.cos(sw) * C * 0.22; out.y = TY + Math.sin(sw) * C * 0.22;
      out.rot = (TAU * 1.25 - 0.6) * side + eo(p3) * PI * side; out.sc = 2.1;
    } else {
      var r = eio(p4);
      out.x = bez(TX, (P0x + TX) / 2 - nx * C * 0.5 * side, P0x, r); out.y = bez(TY, (P0y + TY) / 2 - ny * C * 0.5 * side, P0y, r);
      var endRot = Math.round(((TAU * 1.25 - 0.6) + PI) / TAU) * TAU;
      out.rot = lerp((TAU * 1.25 - 0.6 + PI) * side, endRot * side, r); out.sc = lerp(2.1, 1, r);
    }
    return out;
  }
  var _pose = {}, _pose2 = {};
  function drawBlade(ctx, a, g, wi, cx, cy, size, color) {
    var t = a.t;
    _pose.p0x = gx(g, wi, cx, size); _pose.p0y = gy(g, wi, cy, size);
    _pose2.p0x = _pose.p0x; _pose2.p0y = _pose.p0y;
    if (a.f.dir == null) a.f.dir = 0;
    // 墨迹拖尾：沿刀路的锥形墨带 + 残影
    if (t > 0.06 && t < 0.4) {
      var n = 0, pts = a.f.trail || (a.f.trail = []);
      pts.length = 0;
      for (var j = 0; j < 12; j++) { var tt = t - j * 0.012; if (tt < 0.06) break; bladePose(a, tt, _pose2); pts.push(_pose2.x, _pose2.y); n++; }
      ctx.fillStyle = 'rgba(27,23,18,.38)';
      I.ribbon(ctx, pts, n, size * 0.3, 0);
      ctx.fillStyle = 'rgba(179,38,30,.35)';
      I.ribbon(ctx, pts, Math.min(n, 6), size * 0.12, 0);
      for (var k2 = 2; k2 >= 1; k2--) {
        bladePose(a, t - k2 * 0.016, _pose2);
        ctx.globalAlpha = 0.18 * (4 - k2) / 3;
        I.strokeAt(ctx, g, wi, _pose2.x, _pose2.y, size * _pose2.sc, { rot: _pose2.rot, color: color });
      }
      ctx.globalAlpha = 1;
    }
    bladePose(a, t, _pose);
    var fly = t > 0.05 && t < 0.42;
    I.strokeAt(ctx, g, wi, _pose.x, _pose.y, size * _pose.sc, { rot: _pose.rot, color: color, halo: fly ? HALO : null, hb: 4 });
    if (t >= 0.17 && !a.f.h1) {
      a.f.h1 = 1;
      var ang = Math.atan2(a.TY - _pose.p0y, a.TX - _pose.p0x);
      slash(a.TX, a.TY, ang + 0.6, E.cell * 0.9, a.gold ? '#7a5a12' : INK, 0.3);
      drops(a.TX, a.TY, 6, E.cell * 1.6, E.cell * 0.09);
      word(a.TX + E.cell * 0.35, a.TY - E.cell * 0.4, '咔', E.cell * 0.42, INK, 0.5, -0.2);
      E.sfx('blade');
    }
    if (t >= 0.23 && !a.f.h2) {
      a.f.h2 = 1;
      var ang2 = Math.atan2(a.TY - _pose.p0y, a.TX - _pose.p0x);
      slash(a.TX, a.TY, ang2 - 0.9 + PI, E.cell * 0.8, a.gold ? '#7a5a12' : INK, 0.3);
      word(a.TX + E.cell * 0.65, a.TY - E.cell * 0.1, '嚓', E.cell * 0.4, INK, 0.5, 0.15);
    }
  }
  UA.dao = function (ctx, a) {
    var g = I.glyph('刀'), S = unitSize(), cx = a.X, cy = a.FY, col = I.tierInk(a.lv);
    // 「𠃌」留在牌上，微微侧身
    var lean = Math.sin(seg(a.t, 0, 0.46) * PI) * 0.12 * (a.TX < cx ? -1 : 1);
    I.strokeAt(ctx, g, 0, cx + (g.cx[0] - 512) * S / 1024, cy + (g.cy[0] - 512) * S / 1024, S, { rot: lean, color: col });
    drawBlade(ctx, a, g, 1, cx, cy, S, col);
  };

  // 通用：长枪突刺——杆子取自一笔竖画，其余笔画聚到枪尖成叶形枪刃，系红缨
  function drawSpear(ctx, a, g, shaft, head, cross, cx, cy, size, color) {
    var t = a.t, C = E.cell, k = size / 1024;
    var th = Math.atan2(a.TY - cy, a.TX - cx);
    var gather = eo(seg(t, 0, 0.07)) * (1 - eo(seg(t, 0.4, 0.5)));
    var ext = eo(seg(t, 0.07, 0.14)) * (1 - eio(seg(t, 0.28, 0.4)));
    var reach = (a.len || 2.2) * C;
    var trem = t > 0.14 && t < 0.28 ? Math.sin(t * 170) * C * 0.02 : 0;
    var m = g.med[shaft], rest = g.ang[shaft];
    var flipS = Math.abs(((th - rest + PI * 3) % TAU) - PI) > PI / 2;
    var pvx = flipS ? m[m.length - 2] : m[0], pvy = flipS ? m[m.length - 1] : m[1];
    if (flipS) rest += PI;
    var sx0 = cx + (pvx - 512) * k, sy0 = cy + (pvy - 512) * k;
    var ang = angLerp(rest, th, gather);
    var baseX = lerp(sx0, cx - Math.cos(th) * C * 0.42, gather), baseY = lerp(sy0, cy - Math.sin(th) * C * 0.42, gather);
    var held = C * 0.95;
    var shaftLen = lerp(g.len[shaft] * k, held, gather) + reach * ext;
    var tx2 = baseX + Math.cos(ang) * shaftLen - Math.sin(ang) * trem, ty2 = baseY + Math.sin(ang) * shaftLen + Math.cos(ang) * trem;
    var halo = ext > 0.05 ? HALO : null;
    // 速度线
    if (ext > 0.4 && t < 0.3) {
      ctx.strokeStyle = 'rgba(27,23,18,' + 0.18 * ext + ')'; ctx.lineWidth = 1;
      for (var i = -1; i <= 1; i += 2) {
        var off = i * C * 0.16;
        ctx.beginPath();
        ctx.moveTo(baseX - Math.sin(th) * off + Math.cos(th) * shaftLen * 0.25, baseY + Math.cos(th) * off + Math.sin(th) * shaftLen * 0.25);
        ctx.lineTo(baseX - Math.sin(th) * off + Math.cos(th) * shaftLen * 0.7, baseY + Math.cos(th) * off + Math.sin(th) * shaftLen * 0.7);
        ctx.stroke();
      }
    }
    I.strokeAt(ctx, g, shaft, baseX, baseY, size, { align: flipS ? ang + PI : ang, along: shaftLen / (g.len[shaft] * k), across: lerp(1, 1.9, gather), px: pvx, py: pvy, color: color, halo: halo, hb: 3 });
    var bl = C * 0.4;
    if (gather > 0.02) {
      ctx.save(); ctx.translate(tx2, ty2); ctx.rotate(ang);
      ctx.globalAlpha = gather;
      if (halo) { ctx.shadowColor = HALO; ctx.shadowBlur = 4 * (window.devicePixelRatio || 1); }
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(bl * 0.62, 0); ctx.quadraticCurveTo(bl * 0.05, -C * 0.13, -bl * 0.3, -C * 0.03); ctx.lineTo(-bl * 0.3, C * 0.03); ctx.quadraticCurveTo(bl * 0.05, C * 0.13, bl * 0.62, 0); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,248,230,.55)';
      ctx.beginPath(); ctx.moveTo(bl * 0.5, 0); ctx.quadraticCurveTo(bl * 0.05, -C * 0.05, -bl * 0.15, 0); ctx.closePath(); ctx.fill();
      // 红缨
      ctx.strokeStyle = VERM; ctx.lineCap = 'round';
      for (var r2 = 0; r2 < 5; r2++) {
        var wv = Math.sin(t * 38 + r2 * 1.3) * C * 0.05 * (0.4 + ext);
        ctx.lineWidth = C * 0.035;
        ctx.beginPath(); ctx.moveTo(-bl * 0.3, 0); ctx.quadraticCurveTo(-bl * 0.55, wv + (r2 - 2) * C * 0.035, -bl * (0.8 + r2 * 0.05) - ext * C * 0.12, wv * 1.8 + (r2 - 2) * C * 0.06);
        ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // 其余笔画：飞向枪尖，贴成刃脊与枪缨箍
    head.forEach(function (hi, j) {
      var hx = gx(g, hi, cx, size), hy = gy(g, hi, cy, size);
      var side = j % 2 ? 1 : -1;
      var tgx = tx2 - Math.cos(ang) * bl * 0.05 - Math.sin(ang) * C * 0.04 * side, tgy = ty2 - Math.sin(ang) * bl * 0.05 + Math.cos(ang) * C * 0.04 * side;
      I.strokeAt(ctx, g, hi, lerp(hx, tgx, gather), lerp(hy, tgy, gather), size, { align: angLerp(g.ang[hi], ang + side * 0.15, gather), along: lerp(1, bl * 0.6 / (g.len[hi] * k), gather), across: lerp(1, 0.7, gather), color: color });
    });
    if (cross != null) {
      var nx2 = tx2 - Math.cos(ang) * bl * 0.3, ny2 = ty2 - Math.sin(ang) * bl * 0.3;
      var hx2 = gx(g, cross, cx, size), hy2 = gy(g, cross, cy, size);
      I.strokeAt(ctx, g, cross, lerp(hx2, nx2, gather), lerp(hy2, ny2, gather), size, { align: angLerp(g.ang[cross], ang + PI / 2, gather), along: lerp(1, C * 0.3 / (g.len[cross] * k), gather), across: lerp(1, 1.3, gather), color: color });
    }
    if (t >= 0.14 && !a.f.h) {
      a.f.h = 1;
      addFx({ k: 'pierce', x: cx, y: cy, ang: th, len: reach + C * 0.6, w: C * 0.4, life: 0.25 });
      var L = a.hits || [];
      for (var q = 0; q < L.length; q++) { drops(L[q][0], L[q][1], 5, C * 1.5, C * 0.09); slash(L[q][0], L[q][1], th + PI / 2, C * 0.7, VERM, 0.22); }
      E.sfx('spear');
    }
  }
  UA.qiang = function (ctx, a) {
    var g = I.glyph('枪'), S = unitSize(), col = I.tierInk(a.lv);
    // 「仓」不动（整张贴图）
    I.blit(ctx, I.glyphSprite('枪', S, col, { skip: { 0: 1, 1: 1, 2: 1, 3: 1 } }), a.X, a.FY);
    drawSpear(ctx, a, g, 1, [2, 3], 0, a.X, a.FY, S, col);
  };

  // 弓：整字弯成满弓（两端后弯、弓弦拉满），「一」作箭搭在弦上
  UA.gong = function (ctx, a) {
    var g = I.glyph('弓'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, k = S / 1024;
    var face = a.TX < a.X - 2 ? -1 : 1;
    var th = Math.atan2(a.TY - a.FY, (a.TX - a.X) * face);
    var tilt = Math.max(-1.2, Math.min(1.2, th));
    var aim = eo(seg(t, 0, 0.1)) * (1 - eio(seg(t, 0.28, 0.42)));
    var bend = t < 0.14 ? eo(seg(t, 0, 0.14)) : Math.exp(-(t - 0.14) * 14) * Math.cos((t - 0.14) * 60);
    var B = S * 0.2 * bend;
    var spr = I.glyphSprite('弓', S, col, { skip: { 1: 1 } });
    var sc = 1 + 0.12 * aim;
    ctx.save();
    ctx.translate(a.X, a.FY);
    ctx.scale(face * sc, sc);
    var N = 10, sw = spr.c.width, sh = spr.c.height, pad = (spr.h - S) / 2;
    var bt = pad + (g.box[1] / 1024) * S, bh = (g.box[3] - g.box[1]) / 1024 * S;
    for (var i = 0; i < N; i++) {
      var y0 = i / N * spr.h, y1 = (i + 1) / N * spr.h, ym = (y0 + y1) / 2;
      var u = Math.max(-1, Math.min(1, (ym - (bt + bh / 2)) / (bh / 2)));
      var dx = -B * u * u;
      ctx.drawImage(spr.c, 0, y0 / spr.h * sh, sw, (y1 - y0) / spr.h * sh + 0.5, -spr.w / 2 + dx, -spr.h / 2 + y0, spr.w, y1 - y0 + 0.4);
    }
    // 弓弦：两端随弓梢后弯
    var left = (g.box[0] - 512) * k, top = (g.box[1] - 512) * k, bot = (g.box[3] - 512) * k;
    var pull = t < 0.14 ? S * 0.32 * bend : Math.max(0, S * 0.32 * bend * 0.3);
    var nockX = left - B - pull;
    ctx.strokeStyle = 'rgba(27,23,18,.9)'; ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath(); ctx.moveTo(left - B * 0.9, top + S * 0.02); ctx.lineTo(nockX, 0); ctx.lineTo(left - B * 0.9, bot - S * 0.02); ctx.stroke();
    if (t < 0.14) {
      var al = S * 1.15, m = g.med[1];
      ctx.translate(nockX, 0); ctx.rotate(tilt * aim); ctx.translate(-nockX, 0);
      I.strokeAt(ctx, g, 1, nockX, 0, S, { align: 0, along: al / (g.len[1] * k), across: 0.9, px: m[0], py: m[1], color: col, halo: HALO, hb: 3 });
      ctx.fillStyle = col;
      var hx = nockX + al;
      ctx.beginPath(); ctx.moveTo(hx + S * 0.16, 0); ctx.lineTo(hx - S * 0.03, -S * 0.08); ctx.lineTo(hx + S * 0.01, 0); ctx.lineTo(hx - S * 0.03, S * 0.08); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nockX + S * 0.05, 0); ctx.lineTo(nockX - S * 0.04, -S * 0.08); ctx.moveTo(nockX + S * 0.05, 0); ctx.lineTo(nockX - S * 0.04, S * 0.08); ctx.stroke();
    }
    ctx.restore();
    if (t > 0.3) {
      var pw = seg(t, 0.3, 0.42);
      I.drawWriting(ctx, g, a.X, a.FY, S, col, eo(pw), { 0: 1, 2: 1 });
    }
    if (t >= 0.14 && !a.f.h) { a.f.h = 1; E.sfx('bow'); }
  };
  // 骑：「马」奔出践踏
  UA.qi = function (ctx, a) {
    var g = I.glyph('骑'), S = unitSize(), col = I.tierInk(a.lv);
    I.blit(ctx, I.glyphSprite('骑', S, col, { skip: { 0: 1, 1: 1, 2: 1 } }), a.X, a.FY);
    drawGallop(ctx, a, g, [0, 1, 2], a.X, a.FY, S, col, 0.26);
  };
  function drawGallop(ctx, a, g, list, cx, cy, size, col, hitT) {
    var t = a.t, C = E.cell, gc = a.f.gc || (a.f.gc = I.groupCenter(g, list));
    var k = size / 1024, hx = cx + (gc.x - 512) * k, hy = cy + (gc.y - 512) * k;
    var dur = a.dur;
    var out = t < hitT, p = out ? seg(t, 0, hitT) : seg(t, hitT + 0.06, dur);
    var fx0 = out ? hx : a.TX, fy0 = out ? hy : a.TY, fx1 = out ? a.TX : hx, fy1 = out ? a.TY : hy;
    var e = out ? eio(p) : eio(p);
    var hops = out ? 3 : 2;
    var hop = Math.abs(Math.sin(p * hops * PI)) * C * 0.2;
    var x = lerp(fx0, fx1, e), y = lerp(fy0, fy1, e) - hop;
    var stomp = t >= hitT && t < hitT + 0.06;
    if (stomp) { x = a.TX; y = a.TY; }
    var facing = (out ? a.TX - hx : hx - a.TX) < 0 ? -1 : 1;
    var sc = 1 + 0.75 * Math.sin(seg(t, 0, dur) * PI);
    var tilt = Math.sin(p * hops * TAU) * 0.18;
    var sx = sc * facing, sy = sc;
    if (stomp) { var q = seg(t, hitT, hitT + 0.06); sx *= 1 + 0.35 * Math.sin(q * PI); sy *= 1 - 0.3 * Math.sin(q * PI); }
    // 残影
    if (!stomp && t < dur - 0.05) {
      for (var j = 2; j >= 1; j--) {
        var pe = out ? eio(cl(p - j * 0.07)) : eio(cl(p - j * 0.07));
        ctx.globalAlpha = 0.16 * (3 - j);
        drawGroup(ctx, g, list, size, lerp(fx0, fx1, pe), lerp(fy0, fy1, pe), { rot: tilt, sx: sx, sy: sy, px: gc.x, py: gc.y, color: col });
      }
      ctx.globalAlpha = 1;
    }
    drawGroup(ctx, g, list, size, x, y, { rot: tilt, sx: sx, sy: sy, px: gc.x, py: gc.y, color: col, halo: t > 0.04 && t < dur - 0.06 ? HALO : null, hb: 4 });
    // 落蹄扬尘
    var hopN = Math.floor(p * hops);
    if (hopN !== a.f.lastHop && t > 0.08 && t < dur - 0.1) { a.f.lastHop = hopN; if (Math.hypot(x - cx, y - cy) > C * 0.7) dust(x, y + C * 0.18, 2, C * 0.22); }
    if (t >= hitT && !a.f.h) {
      a.f.h = 1;
      ring(a.TX, a.TY, C * 0.2, (a.rad || 0.9) * C, '27,23,18', 0.4, 4);
      drops(a.TX, a.TY, 7, C * 1.8, C * 0.09);
      dust(a.TX, a.TY + C * 0.1, 5, C * 0.45);
      word(a.TX, a.TY - C * 0.45, '踏', C * 0.34, INK, 0.45);
      E.sfx('hoof'); E.shake(1.5);
    }
  }

  // 盾：笔画向外撑开成盾，震出涟漪
  UA.dun = function (ctx, a) {
    var g = I.glyph('盾'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, C = E.cell;
    var p1 = seg(t, 0, 0.12);
    var push = t < 0.12 ? eo(p1) : Math.exp(-(t - 0.12) * 9) * Math.cos((t - 0.12) * 30);
    var k = S / 1024, sc = 1 + 0.18 * push;
    for (var i = 0; i < g.n; i++) {
      var dx = (g.cx[i] - g.gx), dy = (g.cy[i] - g.gy);
      I.strokeAt(ctx, g, i, a.X + (g.cx[i] - 512) * k * sc + dx * k * 0.45 * push, a.FY + (g.cy[i] - 512) * k * sc + dy * k * 0.45 * push, S * sc, { color: col });
    }
    if (t >= 0.12 && !a.f.h) {
      a.f.h = 1;
      var R = (a.rad || 1.45) * C;
      ring(a.X, a.Y, C * 0.3, R, '40,60,80', 0.5, 5);
      ring(a.X, a.Y, C * 0.2, R * 0.75, '27,23,18', 0.4, 2.5);
      E.sfx('shield');
    }
    if (t >= 0.2 && !a.f.h2) { a.f.h2 = 1; ring(a.X, a.Y, C * 0.2, (a.rad || 1.45) * C * 0.9, '40,60,80', 0.45, 3); }
  };

  // 火：字形升腾，「丶」化火球
  UA.huo = function (ctx, a) {
    var g = I.glyph('火'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, k = S / 1024;
    var p1 = seg(t, 0, 0.16), fl = t < 0.16 ? eo(p1) : Math.max(0, 1 - (t - 0.16) * 5);
    for (var i = 1; i < 4; i++) {
      var sway = Math.sin(t * 40 + i * 2) * 0.06 * fl;
      var by = a.FY + (g.box[3] - 512) * k;
      I.strokeAt(ctx, g, i, gx(g, i, a.X, S), by - (g.box[3] - g.cy[i]) * k * (1 + 0.25 * fl), S, { rot: sway, sy: 1 + 0.25 * fl, color: fl > 0.3 ? '#8a2a12' : col });
    }
    if (t < 0.16) {
      var x = gx(g, 0, a.X, S), y = gy(g, 0, a.FY, S) - S * 0.2 * eo(p1);
      I.blit(ctx, I.glowSprite('rgba(255,140,40,.8)', Math.round(S * 0.4)), x, y, 0.6 + p1 * 0.6, p1);
      I.strokeAt(ctx, g, 0, x, y, S * (1 + p1 * 0.4), { color: VERM });
    } else if (t > 0.34) {
      var pw = seg(t, 0.34, 0.46);
      ctx.globalAlpha = pw;
      I.strokeAt(ctx, g, 0, gx(g, 0, a.X, S), gy(g, 0, a.FY, S), S, { sx: pw, sy: pw, color: col });
      ctx.globalAlpha = 1;
    }
    if (t >= 0.16 && !a.f.h) { a.f.h = 1; E.sfx('fire'); }
  };

  // 鼓：「支」挥槌击「壴」
  UA.gu = function (ctx, a) {
    var g = I.glyph('鼓'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, C = E.cell, k = S / 1024;
    var stick = [9, 10, 11, 12], drum = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    var p1 = seg(t, 0, 0.1), p2 = seg(t, 0.1, 0.16), p3 = seg(t, 0.16, 0.45);
    var rot = t < 0.1 ? -0.5 * eo(p1) : t < 0.16 ? lerp(-0.5, 0.15, ei(p2)) : 0.15 * (1 - eo(p3));
    var hit = t >= 0.16 ? Math.exp(-(t - 0.16) * 12) : 0;
    var dsp = I.glyphSprite('鼓', S, col, { skip: { 9: 1, 10: 1, 11: 1, 12: 1 } });
    var dw = dsp.w * (1 + 0.12 * hit), dh = dsp.h * (1 - 0.12 * hit);
    ctx.drawImage(dsp.c, a.X - dw / 2, a.FY + dsp.h / 2 - dh - (dsp.h - S) / 2 * (1 - 0.12 * hit) + (dsp.h - S) / 2, dw, dh);
    void drum;
    var gcS = a.f.gs || (a.f.gs = I.groupCenter(g, stick));
    var pvx = gcS.x - gcS.w * 0.3, pvy = gcS.y + gcS.h * 0.45;
    drawGroup(ctx, g, stick, S, a.X + (pvx - 512) * k, a.FY + (pvy - 512) * k, { rot: rot, px: pvx, py: pvy, color: col });
    if (t >= 0.16 && !a.f.h) {
      a.f.h = 1;
      ring(a.X, a.Y, C * 0.3, (a.rad || 1.5) * C, '150,90,30', 0.55, 4);
      ring(a.X, a.Y, C * 0.2, (a.rad || 1.5) * C * 0.7, '150,90,30', 0.45, 2);
      word(a.X + C * 0.4, a.Y - C * 0.55, '咚', C * 0.36, '#8a4a12', 0.5, 0.1);
      E.sfx('drum');
    }
  };

  // 弩：下方「弓」转向瞄准，「一」作重矢
  UA.nu = function (ctx, a) {
    var g = I.glyph('弩'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, C = E.cell, k = S / 1024;
    I.blit(ctx, I.glyphSprite('弩', S, col, { skip: { 5: 1, 6: 1, 7: 1 } }), a.X, a.FY);
    var bow = [5, 7], gc = a.f.gc || (a.f.gc = I.groupCenter(g, [5, 6, 7]));
    var th = Math.atan2(a.TY - a.FY, a.TX - a.X);
    var p1 = seg(t, 0, 0.18), p3 = seg(t, 0.3, 0.5);
    var aim = eo(p1) * (1 - eio(p3));
    var flip = Math.cos(th) < 0, rot = (flip ? th - PI : th) * aim;
    var recoil = t >= 0.2 ? Math.exp(-(t - 0.2) * 14) * C * 0.12 : -C * 0.05 * eo(p1);
    var cx0 = a.X + (gc.x - 512) * k, cy0 = a.FY + (gc.y - 512) * k;
    var cx1 = cx0 - Math.cos(th) * recoil * aim, cy1 = cy0 - Math.sin(th) * recoil * aim;
    drawGroup(ctx, g, bow, S, cx1, cy1, { rot: rot, sx: (flip && aim > 0.5 ? -1 : 1) * (1 + 0.45 * aim), sy: 1 + 0.45 * aim, px: gc.x, py: gc.y, color: col, halo: aim > 0.3 ? HALO : null, hb: 3 });
    if (t < 0.2) {
      var m = g.med[6];
      var along = lerp(1, 2.6, aim);
      I.strokeAt(ctx, g, 6, lerp(gx(g, 6, a.X, S), cx1, aim), lerp(gy(g, 6, a.FY, S), cy1, aim), S, { align: angLerp(g.ang[6], th, aim), along: along, across: lerp(1, 1.7, aim), color: '#1c2433', halo: aim > 0.3 ? HALO : null, hb: 3 });
      void m;
    } else if (t > 0.38) {
      var pw = seg(t, 0.38, 0.5);
      ctx.globalAlpha = pw;
      I.strokeAt(ctx, g, 6, gx(g, 6, a.X, S), gy(g, 6, a.FY, S), S, { sx: pw, color: col });
      ctx.globalAlpha = 1;
    }
    if (t >= 0.2 && !a.f.h) { a.f.h = 1; E.sfx('bolt'); E.shake(0.8); }
  };

  // 石：「厂」作抛竿，「口」化巨石
  UA.tou = function (ctx, a) {
    var g = I.glyph('石'), S = unitSize(), col = I.tierInk(a.lv), t = a.t, k = S / 1024;
    var arm = [0, 1], rock = [2, 3, 4];
    var p1 = seg(t, 0, 0.22), p2 = seg(t, 0.22, 0.3), p3 = seg(t, 0.3, 0.5);
    var face = a.TX < a.X ? -1 : 1;
    var rot = t < 0.22 ? -0.95 * eo(p1) : t < 0.3 ? lerp(-0.95, 0.5, ei(p2)) : 0.5 * (1 - eo(p3));
    rot *= face;
    var m1 = g.med[1], pvx = m1[m1.length - 2], pvy = m1[m1.length - 1];
    drawGroup(ctx, g, arm, S, a.X + (pvx - 512) * k, a.FY + (pvy - 512) * k, { rot: rot, px: pvx, py: pvy, color: col });
    var gc = a.f.gc || (a.f.gc = I.groupCenter(g, rock));
    if (t < 0.22) {
      var lift = eo(p1);
      drawGroup(ctx, g, rock, S, a.X + (gc.x - 512) * k - face * S * 0.35 * lift, a.FY + (gc.y - 512) * k - S * 0.5 * lift, { rot: -lift * 0.9 * face, sx: 1 + 0.4 * lift, sy: 1 + 0.4 * lift, px: gc.x, py: gc.y, color: col, halo: HALO, hb: 3 });
    } else if (t > 0.45) {
      var pw = seg(t, 0.45, 0.62);
      ctx.globalAlpha = pw;
      drawGroup(ctx, g, rock, S, a.X + (gc.x - 512) * k, a.FY + (gc.y - 512) * k, { sx: pw, sy: pw, px: gc.x, py: gc.y, color: col });
      ctx.globalAlpha = 1;
    }
    if (t >= 0.22 && !a.f.h) { a.f.h = 1; E.sfx('catapult'); }
  };

  // ---------- 武将普攻 ----------
  // 两字并排；按出手方式复用兵器动画，兵器笔画取自名字
  var GW = {
    liubei: { ci: 1, w: 0 }, guanyu: { ci: 1, w: 0 }, zhangfei: { ci: 0, w: 'straight' }, zhaoyun: { ci: 0, w: 'straight' },
    machao: { ci: 0, w: 'all' }, huangzhong: { ci: 1, w: 3 }, kongming: { ci: 1, w: 0 }, pangtong: { ci: 1, w: 2 },
    weiyan: { ci: 1, w: 5 }, jiangwei: { ci: 1, w: 'straight' }, guanping: { ci: 1, w: 2 }
  };
  function genPos(a, ci) { var C = E.cell; return { x: a.X + (ci ? 1 : -1) * C * 0.205, y: a.FY }; }
  function genWeapon(gk) {
    var d = GW[gk], ch = Z.GENERALS[gk].chars[d.ci], g = I.glyph(ch);
    var w = d.w === 'straight' ? straightest(ch) : d.w === 'all' ? -1 : d.w;
    return { ch: ch, g: g, ci: d.ci, w: w };
  }
  function drawGenAtk(ctx, a) {
    var gw = a.f.gw || (a.f.gw = genWeapon(a.gk));
    var other = Z.GENERALS[a.gk].chars[1 - gw.ci];
    var S = genSize(), p = genPos(a, gw.ci), po = genPos(a, 1 - gw.ci);
    I.blit(ctx, I.glyphSprite(other, S, INK), po.x, po.y);
    var g = gw.g, mode = a.mode, col = '#2a1d08';
    if (mode === 'gallop' && gw.w === -1) { drawGallop(ctx, a, g, allStrokes(g), p.x, p.y, S, col, 0.24); return; }
    var skip = gw.w >= 0 ? mask([gw.w]) : null;
    if (mode === 'thrust') {
      I.blit(ctx, I.glyphSprite(gw.ch, S, INK, { skip: skip }), p.x, p.y);
      drawSpear(ctx, a, g, gw.w, [], null, p.x, p.y, S * 1.25, col);
      return;
    }
    if (mode === 'melee' || mode === 'gallop') {
      I.blit(ctx, I.glyphSprite(gw.ch, S, INK, { skip: skip }), p.x, p.y);
      drawBlade(ctx, a, g, gw.w, p.x, p.y, S * 1.5, col);
      return;
    }
    // arrow / fire：笔画发光后射出（投射物另画）
    var t = a.t, pr = seg(t, 0, 0.15), hide = t >= 0.15 && t < 0.4;
    I.blit(ctx, I.glyphSprite(gw.ch, S, INK, { skip: skip }), p.x, p.y);
    if (!hide) {
      var glow = t < 0.15 ? pr : 0;
      if (glow) I.blit(ctx, I.glowSprite(mode === 'fire' ? 'rgba(255,120,40,.85)' : 'rgba(255,214,120,.9)', Math.round(S * 0.5)), gx(g, gw.w, p.x, S), gy(g, gw.w, p.y, S), 0.5 + glow, glow);
      var pw = t >= 0.4 ? seg(t, 0.4, 0.5) : 1;
      ctx.globalAlpha = pw;
      I.strokeAt(ctx, g, gw.w, gx(g, gw.w, p.x, S), gy(g, gw.w, p.y, S), S * (1 + glow * 0.3), { color: glow > 0.3 ? '#8a5a10' : INK });
      ctx.globalAlpha = 1;
    }
    if (t >= 0.15 && !a.f.h) { a.f.h = 1; E.sfx(mode === 'fire' ? 'fire' : 'bow'); }
  }
  function allStrokes(g) { var l = []; for (var i = 0; i < g.n; i++) l.push(i); return l; }

  // ---------- 字牌 ----------
  // it: 牌；X,Y 牌中心；o: { lift, alpha, anim, t（全局时间）, hide }
  function drawTile(ctx, it, X, Y, o) {
    o = o || {};
    var C = E.cell, d = I.tileDims(C), FY = Y - d.t / 2;
    var kind = it.t, tier = it.lv || 1;
    var ts = I.tileSprite(kind, kind === 'u' ? tier : 1, C, o.lift);
    var sc = o.scale || 1;
    I.blit(ctx, ts, X, Y, sc, o.alpha);
    if (sc !== 1) { FY = Y - d.t / 2 * sc; }
    var a = o.anim;
    if (o.alpha != null && o.alpha < 1) ctx.globalAlpha = o.alpha;
    if (a && a.type === 'atk' && !o.lift) {
      a.X = X; a.Y = Y; a.FY = FY;
      if (it.t === 'g') drawGenAtk(ctx, a); else if (UA[it.k]) UA[it.k](ctx, a);
      ctx.globalAlpha = 1;
      return;
    }
    if (a && (a.type === 'write' || a.type === 'merge' || a.type === 'general')) { drawTileWrite(ctx, it, X, FY, a, sc); ctx.globalAlpha = 1; return; }
    // 呼吸：每块牌每隔几秒轻轻一「吸」；其余时间整块牌一次贴图（省绘制）
    var ph = ((o.t || 0) * 0.33 + ((X * 7.13 + Y * 3.71) % 1 + 1)) % 1;
    var breathe = ph < 0.14 ? 1 + Math.sin(ph / 0.14 * PI) * 0.045 : 1;
    if (breathe === 1 && sc === 1 && !o.lift && !o.hide && (o.alpha == null || o.alpha >= 1) && !(it.t === 'u' && it.k === 'huo')) {
      I.blit(ctx, fullSprite(it, C), X, Y);
      if (it.t === 'u') {
        if (it.buffed) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(X + d.w * 0.36, FY - d.h * 0.36, Math.max(1.6, C * 0.035), 0, TAU); ctx.fill(); }
        if (it.haste > 0) { ctx.fillStyle = '#c86a1e'; ctx.beginPath(); ctx.arc(X - d.w * 0.36, FY - d.h * 0.36, Math.max(1.4, C * 0.03), 0, TAU); ctx.fill(); }
        if (tier >= 4) I.blit(ctx, I.glowSprite(tier === 5 ? 'rgba(240,150,50,.3)' : 'rgba(150,90,210,.24)', Math.round(C * 0.4)), X, FY, 1 + Math.sin((o.t || 0) * 3) * 0.06);
      } else if (it.t === 'g' && it.skLeft != null && it.skLeft < 1.2) {
        I.blit(ctx, I.glowSprite('rgba(255,210,110,.5)', Math.round(C * 0.5)), X, FY, 1, 0.3 + (0.5 + 0.5 * Math.sin((o.t || 0) * 10)) * 0.4);
      }
      return;
    }
    if (it.t === 'u') {
      var S = Math.round(C * 0.64);
      if (tier >= 4) I.blit(ctx, I.glowSprite(tier === 5 ? 'rgba(240,150,50,.35)' : 'rgba(150,90,210,.28)', Math.round(S * 0.62)), X, FY, (1 + Math.sin((o.t || 0) * 3) * 0.06) * sc);
      if (it.k === 'huo' && !o.lift) {
        var g = I.glyph('火'), col = I.tierInk(tier), tt = o.t || 0;
        for (var i = 0; i < 4; i++) I.strokeAt(ctx, g, i, gx(g, i, X, S * sc), gy(g, i, FY, S * sc) - (i > 1 ? Math.sin(tt * 6 + i) * S * 0.012 : 0), S * sc, { rot: Math.sin(tt * 5 + i * 1.7) * 0.03, color: col });
      } else I.blit(ctx, I.glyphSprite(Z.UNITS[it.k].ch, S, I.tierInk(tier), { bleed: 1 }), X, FY, breathe * sc);
      if (it.buffed && !o.lift) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(X + d.w * 0.36 * sc, FY - d.h * 0.36 * sc, Math.max(1.6, C * 0.035), 0, TAU); ctx.fill(); }
      if (it.haste > 0 && !o.lift) { ctx.fillStyle = '#c86a1e'; ctx.beginPath(); ctx.arc(X - d.w * 0.36 * sc, FY - d.h * 0.36 * sc, Math.max(1.4, C * 0.03), 0, TAU); ctx.fill(); }
    } else if (it.t === 'g') {
      var G2 = Z.GENERALS[it.k], gs = genSize();
      var hide = o.hide || null;
      for (var c2 = 0; c2 < 2; c2++) {
        var px = X + (c2 ? 1 : -1) * C * 0.205 * sc;
        if (hide && hide.ci === c2) {
          if (hide.list === 'all') continue;
          I.blit(ctx, I.glyphSprite(G2.chars[c2], gs, INK, { skip: hide.mask }), px, FY, sc);
        } else I.blit(ctx, I.glyphSprite(G2.chars[c2], gs, INK, { bleed: 1 }), px, FY, breathe * sc);
      }
      if (it.skLeft != null && it.skLeft < 1.2 && !o.lift) {
        var pulse = 0.5 + 0.5 * Math.sin((o.t || 0) * 10);
        I.blit(ctx, I.glowSprite('rgba(255,210,110,.5)', Math.round(C * 0.5)), X, FY, 1, 0.3 + pulse * 0.4);
      }
    } else if (it.t === 'c') {
      var gc = I.glyphSprite(it.ch, Math.round(C * 0.6), VERM, { bleed: 1 });
      I.blit(ctx, gc, X, FY, breathe * sc);
      var part2 = partnerOf(it.ch);
      if (part2) { ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.28; I.blit(ctx, I.glyphSprite(part2, Math.round(C * 0.22), VERM), X + d.w * 0.3 * sc, FY + d.h * 0.3 * sc, sc); ctx.globalAlpha = 1; }
    } else if (it.t === 's') {
      I.blit(ctx, I.glyphSprite('铲', Math.round(C * 0.6), '#6b4a26', { bleed: 1 }), X, FY, breathe * sc);
    }
    ctx.globalAlpha = 1;
  }
  // 整块牌（牌身 + 字）合成一张贴图
  function fullSprite(it, C) {
    var key = 'F|' + it.t + (it.k || '') + (it.ch || '') + (it.lv || 1) + '|' + C;
    var ts = I.tileSprite(it.t, it.t === 'u' ? it.lv || 1 : 1, C), d = I.tileDims(C);
    return I.sprite(key, ts.w, ts.h, function (x, w, h) {
      x.drawImage(ts.c, 0, 0, w, h);
      var fy = h / 2 - d.t / 2;
      if (it.t === 'u') I.blit(x, I.glyphSprite(Z.UNITS[it.k].ch, Math.round(C * 0.64), I.tierInk(it.lv || 1), { bleed: 1 }), w / 2, fy);
      else if (it.t === 'g') { var G2 = Z.GENERALS[it.k]; for (var c2 = 0; c2 < 2; c2++) I.blit(x, I.glyphSprite(G2.chars[c2], genSize(), INK, { bleed: 1 }), w / 2 + (c2 ? 1 : -1) * C * 0.205, fy); }
      else if (it.t === 'c') {
        I.blit(x, I.glyphSprite(it.ch, Math.round(C * 0.6), VERM, { bleed: 1 }), w / 2, fy);
        var p2 = partnerOf(it.ch);
        if (p2) { x.globalAlpha = 0.28; I.blit(x, I.glyphSprite(p2, Math.round(C * 0.22), VERM), w / 2 + d.w * 0.3, fy + d.h * 0.3); x.globalAlpha = 1; }
      } else if (it.t === 's') I.blit(x, I.glyphSprite('铲', Math.round(C * 0.6), '#6b4a26', { bleed: 1 }), w / 2, fy);
    });
  }
  var partners = null;
  function partnerOf(ch) {
    if (!partners) { partners = {}; Z.NAME_RECIPES.forEach(function (r) { (partners[r[0]] = partners[r[0]] || []).push(r[1]); (partners[r[1]] = partners[r[1]] || []).push(r[0]); }); }
    var l = partners[ch];
    return l && l.length === 1 ? l[0] : null;
  }
  // 落子书写 / 合并重写 / 武将现身
  function drawTileWrite(ctx, it, X, FY, a, sc) {
    var C = E.cell, t = a.t;
    if (a.type === 'merge') {
      // 先炸开再按笔顺写成新阶
      var col = I.tierInk(it.lv || 1);
      if (t < 0.14) {
        var g = I.glyph(Z.UNITS[it.k].ch), S = Math.round(C * 0.64), k = S / 1024, p = eo(t / 0.14);
        for (var i = 0; i < g.n; i++) {
          var dx = (g.cx[i] - g.gx) * k * 0.9 * p, dy = (g.cy[i] - g.gy) * k * 0.9 * p;
          I.strokeAt(ctx, g, i, gx(g, i, X, S) + dx, gy(g, i, FY, S) + dy, S, { rot: (i % 2 ? 1 : -1) * p * 0.8, color: I.tierInk((it.lv || 2) - 1) });
        }
      } else {
        var pw = seg(t, 0.14, 0.42);
        I.drawWriting(ctx, I.glyph(Z.UNITS[it.k].ch), X, FY, Math.round(C * 0.64) * (1 + 0.15 * (1 - pw)), col, eo(pw));
      }
      return;
    }
    if (a.type === 'general') {
      var G2 = Z.GENERALS[it.k], gs = genSize(), pw2 = seg(t, 0.05, 0.75);
      for (var c2 = 0; c2 < 2; c2++) {
        var pp = cl(pw2 * 2 - c2);
        I.drawWriting(ctx, I.glyph(G2.chars[c2]), X + (c2 ? 1 : -1) * C * 0.205, FY, gs, INK, eo(pp));
      }
      return;
    }
    // write
    var ch = it.t === 'u' ? Z.UNITS[it.k].ch : it.t === 'c' ? it.ch : it.t === 's' ? '铲' : null;
    var colw = it.t === 'u' ? I.tierInk(it.lv || 1) : it.t === 'c' ? VERM : '#6b4a26';
    var size = it.t === 'u' ? Math.round(C * 0.64) : Math.round(C * 0.6);
    if (it.t === 'g') { a.type = 'general'; drawTileWrite(ctx, it, X, FY, a, sc); return; }
    if (ch) I.drawWriting(ctx, I.glyph(ch), X, FY, size * sc, colw, eo(seg(t, 0, a.dur * 0.95)));
  }

  // ---------- 投射物 ----------
  function drawProj(ctx, p, sx, sy, ang, s) {
    var C = E.cell, S = unitSize();
    if (p.mode === 'arrow') {
      var gen = p.gen, g = gen ? I.glyph(genWeapon(p.kind).ch) : I.glyph('弓'), wi = gen ? genWeapon(p.kind).w : 1;
      if (wi < 0) wi = 0;
      var len = gen ? C * 0.9 : C * 0.62, k = S / 1024;
      // 拖尾
      ctx.strokeStyle = gen ? 'rgba(210,160,60,.45)' : 'rgba(27,23,18,.22)'; ctx.lineWidth = gen ? 2.5 : 1.2;
      ctx.beginPath(); ctx.moveTo(sx - Math.cos(ang) * len * 0.4, sy - Math.sin(ang) * len * 0.4); ctx.lineTo(sx - Math.cos(ang) * len * 1.6, sy - Math.sin(ang) * len * 1.6); ctx.stroke();
      if (gen) I.blit(ctx, I.glowSprite('rgba(255,210,110,.7)', Math.round(C * 0.3)), sx, sy, 1, 0.8);
      I.strokeAt(ctx, g, wi, sx, sy, S, { align: ang, along: len / (g.len[wi] * k), across: gen ? 0.9 : 0.55, color: gen ? '#7a5210' : INK });
      // 箭头与尾羽
      var hx = sx + Math.cos(ang) * len * 0.5, hy = sy + Math.sin(ang) * len * 0.5;
      ctx.fillStyle = gen ? '#7a5210' : INK;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(C * 0.1, 0); ctx.lineTo(-C * 0.03, -C * 0.045); ctx.lineTo(-C * 0.01, 0); ctx.lineTo(-C * 0.03, C * 0.045); ctx.fill();
      ctx.translate(-len, 0);
      ctx.strokeStyle = gen ? '#7a5210' : 'rgba(27,23,18,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-C * 0.06, -C * 0.05); ctx.moveTo(C * 0.04, 0); ctx.lineTo(-C * 0.02, -C * 0.05); ctx.moveTo(0, 0); ctx.lineTo(-C * 0.06, C * 0.05); ctx.moveTo(C * 0.04, 0); ctx.lineTo(-C * 0.02, C * 0.05); ctx.stroke();
      ctx.restore();
    } else if (p.mode === 'fire') {
      var gf = I.glyph('火');
      I.blit(ctx, I.glowSprite('rgba(255,120,30,.8)', Math.round(C * 0.42)), sx, sy, 1 + Math.sin(E.now * 30) * 0.12);
      ctx.fillStyle = 'rgba(200,60,20,.45)';
      I.ribbon(ctx, [sx, sy, sx - Math.cos(ang) * C * 0.35, sy - Math.sin(ang) * C * 0.35, sx - Math.cos(ang) * C * 0.8, sy - Math.sin(ang) * C * 0.8], 3, C * 0.26, 0);
      I.strokeAt(ctx, gf, 0, sx, sy, S * 2.6, { rot: E.now * 12, color: p.gen ? '#a8240e' : VERM });
      I.strokeAt(ctx, gf, 0, sx, sy, S * 1.3, { rot: E.now * 12 + 2, color: '#ffcf6a' });
      if (Math.random() < 0.5) embers(sx, sy, 1, C * 0.3);
    } else if (p.mode === 'bolt') {
      var gb = I.glyph('弩'), kb = S / 1024;
      ctx.strokeStyle = 'rgba(40,50,70,.3)'; ctx.lineWidth = 1;
      for (var q = -1; q <= 1; q += 2) {
        var off = q * C * 0.08;
        ctx.beginPath(); ctx.moveTo(sx - Math.sin(ang) * off - Math.cos(ang) * C * 0.3, sy + Math.cos(ang) * off - Math.sin(ang) * C * 0.3); ctx.lineTo(sx - Math.sin(ang) * off - Math.cos(ang) * C * 1.2, sy + Math.cos(ang) * off - Math.sin(ang) * C * 1.2); ctx.stroke();
      }
      I.strokeAt(ctx, gb, 6, sx, sy, S, { align: ang, along: C * 0.85 / (gb.len[6] * kb), across: 1.5, color: '#1c2433' });
      ctx.fillStyle = '#1c2433';
      ctx.save(); ctx.translate(sx + Math.cos(ang) * C * 0.42, sy + Math.sin(ang) * C * 0.42); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(C * 0.13, 0); ctx.lineTo(-C * 0.02, -C * 0.06); ctx.lineTo(-C * 0.02, C * 0.06); ctx.fill(); ctx.restore();
    } else if (p.mode === 'lob') {
      var gr = I.glyph('石'), gc = I.groupCenter(gr, [2, 3, 4]), h = p.h || 0;
      ctx.fillStyle = 'rgba(40,30,20,' + (0.25 - h * 0.12) + ')';
      ctx.beginPath(); ctx.ellipse(sx, sy + C * 0.15, C * 0.2 * (1 - h * 0.3), C * 0.08 * (1 - h * 0.3), 0, 0, TAU); ctx.fill();
      drawGroup(ctx, gr, [2, 3, 4], S, sx, sy - h * C * 1.4, { rot: E.now * 9, sx: 1.6 + h * 0.8, sy: 1.6 + h * 0.8, px: gc.x, py: gc.y, color: INK, halo: HALO, hb: 3 });
    }
  }

  // ---------- 敌军 ----------
  var march = {};
  function marchSprite(ch, size, frame) {
    // 4 帧行军：每一笔各自微微错动
    var key = ch + '|' + size + '|' + frame;
    var s = march[key];
    if (s) return s;
    var g = I.glyph(ch);
    s = I.sprite('m|' + key, size * 1.5, size * 1.5, function (x, w, h) {
      if (!g) return;
      var R = I.rng(frame * 31 + ch.charCodeAt(0));
      for (var i = 0; i < g.n; i++) {
        var ph = frame / 4 * TAU + i * 1.3;
        I.strokeAt(x, g, i, w / 2 + (g.cx[i] - 512) * size / 1024 + Math.sin(ph) * size * 0.018, h / 2 + (g.cy[i] - 512) * size / 1024 + Math.cos(ph * 1.3) * size * 0.022,
          size, { rot: Math.sin(ph + R()) * 0.05, color: PAPER });
      }
    });
    march[key] = s;
    return s;
  }
  function enemySprite(ch, size, edge, boss, frame) {
    var ts = I.enemyTileSprite(size, edge, boss);
    return I.sprite('E|' + ch + '|' + size + '|' + edge + '|' + frame, ts.w, ts.h, function (x, w, h) {
      x.drawImage(ts.c, 0, 0, w, h);
      I.blit(x, marchSprite(ch, Math.round(size * 0.8), frame), w / 2, h / 2);
    });
  }
  function clearCaches() { march = {}; straightCache = {}; }
  function drawEnemy(ctx, e, X, Y, facColor, now) {
    var C = E.cell;
    var size = Math.round(e.r * 2 * C * (e.boss ? 1.05 : 1.08));
    var step = e.d * 2.2;
    var bob = e.stun > 0 ? 0 : -Math.abs(Math.sin(step * PI)) * C * 0.045;
    var tilt = e.stun > 0 ? Math.sin(now * 20) * 0.05 : Math.sin(step * PI) * 0.06;
    var hit = e.flash > 0 ? e.flash / 0.1 : 0;
    // 影子
    ctx.fillStyle = 'rgba(60,40,20,.18)';
    ctx.beginPath(); ctx.ellipse(X, Y + size * 0.45, size * 0.42, size * 0.12, 0, 0, TAU); ctx.fill();
    if (e.slowed > 0) { ctx.strokeStyle = 'rgba(60,90,120,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(X, Y + size * 0.45, size * 0.6, size * 0.18, 0, 0, TAU); ctx.stroke(); }
    ctx.save();
    ctx.translate(X + (hit ? (Math.random() - 0.5) * C * 0.06 : 0), Y + bob);
    ctx.rotate(tilt);
    var frame = e.stun > 0 ? 0 : (Math.floor(step * 2) % 4 + 4) % 4;
    I.blit(ctx, enemySprite(e.ch, size, e.boss ? VERM : facColor, !!e.boss, frame), 0, 0);
    if (hit) { ctx.globalAlpha = hit * 0.6; I.blit(ctx, I.glowSprite('rgba(255,250,235,.95)', Math.round(size * 0.6)), 0, 0); ctx.globalAlpha = 1; }
    ctx.restore();
    // 状态
    if (e.burnT > 0 && Math.random() < 0.3) embers(X, Y, 1, size * 0.5);
    if (e.vulnT > 0) {
      ctx.strokeStyle = 'rgba(179,38,30,.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X - size * 0.3, Y - size * 0.4); ctx.lineTo(X - size * 0.05, Y - size * 0.1); ctx.lineTo(X - size * 0.18, Y + size * 0.05); ctx.lineTo(X + size * 0.2, Y + size * 0.4); ctx.stroke();
    }
    if (e.stun > 0) {
      ctx.fillStyle = INK;
      for (var s = 0; s < 3; s++) { var a = now * 6 + s * TAU / 3; ctx.beginPath(); ctx.arc(X + Math.cos(a) * size * 0.45, Y - size * 0.62 + Math.sin(a) * size * 0.12, Math.max(1.2, C * 0.03), 0, TAU); ctx.fill(); }
    }
    if (e.shield > 0) { ctx.strokeStyle = 'rgba(70,110,170,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, size * 0.75, 0, TAU); ctx.stroke(); }
    // 血条
    if (e.hp < e.maxHp || e.boss) {
      var w = e.boss ? C * 0.95 : size * 0.9, y2 = Y - size * 0.62 + bob, f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(27,23,18,.35)'; ctx.fillRect(X - w / 2, y2, w, e.boss ? 3.5 : 2.5);
      ctx.fillStyle = e.boss ? VERM : '#8a2a1a'; ctx.fillRect(X - w / 2, y2, w * f, e.boss ? 3.5 : 2.5);
    }
    if (e.boss) {
      ctx.font = Math.round(C * 0.28) + 'px "ZY Brush", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(244,236,219,.9)'; ctx.strokeText(e.name, X, Y - size * 0.66 + bob);
      ctx.fillStyle = VERM; ctx.fillText(e.name, X, Y - size * 0.66 + bob);
    }
  }
  function deathFx(ch, X, Y, size, boss) {
    var g = I.glyph(ch); if (!g) return;
    var dir = [], sh = [];
    for (var i = 0; i < g.n; i++) {
      var dx = g.cx[i] - g.gx + rnd(-60, 60), dy = g.cy[i] - g.gy + rnd(-60, 60), l = Math.hypot(dx, dy) || 1;
      dir.push([dx / l, dy / l, Math.random(), rnd(-1, 1)]);
    }
    for (var j = 0; j < 4; j++) { var a = j / 4 * TAU + rnd(-0.4, 0.4); sh.push([Math.cos(a), Math.sin(a), rnd(-1, 1)]); }
    addFx({ k: 'death', g: g, x: X, y: Y, size: size * 0.8, cell: E.cell, dir: dir, sh: sh, boss: boss, life: boss ? 1.1 : 0.7 });
    drops(X, Y, boss ? 18 : 7, E.cell * (boss ? 2.6 : 1.7), E.cell * (boss ? 0.14 : 0.09));
    if (boss) { ring(X, Y, E.cell * 0.3, E.cell * 2, '27,23,18', 0.7, 6); }
  }

  // =====================================================================
  // ---------- 武将技能 ----------
  // f: { gk, s, X, Y, FY, ev, pts（屏幕）, x2,y2, t, life }
  var SK = {};
  function genGlyphPos(f, ci) { return { x: f.X + (ci ? 1 : -1) * E.cell * 0.205, y: f.FY }; }
  function homePos(g, i, base, size) { return { x: gx(g, i, base.x, size), y: gy(g, i, base.y, size) }; }
  function skillBanner(f, txt, sealCh) {
    var C = E.cell, up = f.s === 1;
    banner(E.W / 2 + (f.X < E.W / 2 ? 1 : -1) * C * 2.6, f.Y + (up ? 1 : -1) * C * 0.2, txt, Math.round(C * (up ? 0.5 : 0.62)), sealCh);
  }

  SK.guanyu = {
    life: 1.2, hide: { ci: 1, list: 'all' },
    start: function (f) { skillBanner(f, '青龙偃月', '关'); E.sfx('skill', 'guanyu'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('羽'), gs = genSize(), base = genGlyphPos(f, 1);
      var R = (f.ev.rad || 2.1) * C, a0 = (f.ev.ang || 0) - 2.2;
      var pA = seg(t, 0, 0.28), pB = seg(t, 0.28, 0.72), pC = seg(t, 0.75, 1.2);
      var sweep = a0 + eio(pB) * TAU * 0.95;
      var form = eo(pA) * (1 - eio(pC));
      var bigS = gs * 3.2;
      // 扫过的墨色月弧（拖尾）
      if (t > 0.28 && t < 0.95) {
        var fade = t < 0.72 ? 1 : 1 - seg(t, 0.72, 0.95);
        var span = 1.4 * Math.min(1, pB * 3);
        for (var i = 0; i < 14; i++) {
          var aa = sweep - span * (i / 14), ab = sweep - span * ((i + 1) / 14);
          ctx.fillStyle = 'rgba(22,58,46,' + (0.42 * (1 - i / 14) * fade) + ')';
          ctx.beginPath(); ctx.arc(f.X, f.Y, R * 1.02, ab, aa); ctx.arc(f.X, f.Y, R * (0.55 + 0.2 * i / 14), aa, ab, true); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(22,58,46,' + 0.6 * fade + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.X, f.Y, R * 1.04, sweep - span, sweep); ctx.stroke();
      }
      // 刀杆：关字的「丿」拉长成杆
      var gp = I.glyph('关'), pole = 4, kp = gs / 1024;
      var ang = t < 0.28 ? a0 : sweep;
      var poleL = R * 0.48 * form;
      if (form > 0.02) {
        I.strokeAt(ctx, gp, pole, f.X, f.Y, gs, { align: ang, along: Math.max(0.2, poleL / (gp.len[pole] * kp)), across: 2.6, px: gp.med[pole][0], py: gp.med[pole][1], color: '#1c2a24', halo: HALO, hb: 3 });
      }
      // 偃月刀刃：浓墨月牙，刃口由「羽」六笔排成
      var bx = f.X + Math.cos(ang) * poleL, by = f.Y + Math.sin(ang) * poleL, L = C * 1.5 * form;
      if (form > 0.05) {
        ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
        ctx.shadowColor = HALO; ctx.shadowBlur = 5 * (window.devicePixelRatio || 1);
        var gb = ctx.createLinearGradient(0, -L * 0.2, 0, L * 0.4);
        gb.addColorStop(0, '#0f2a20'); gb.addColorStop(1, '#2f6e5a');
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.moveTo(-L * 0.05, -L * 0.1); ctx.lineTo(-L * 0.05, L * 0.12);
        ctx.quadraticCurveTo(L * 0.45, L * 0.48, L * 1.0, L * 0.3);
        ctx.quadraticCurveTo(L * 0.86, L * 0.12, L * 0.92, -L * 0.04);
        ctx.quadraticCurveTo(L * 0.5, -L * 0.02, -L * 0.05, -L * 0.1);
        ctx.fill();
        ctx.shadowBlur = 0;
        // 刃口一线白光
        ctx.strokeStyle = 'rgba(240,250,240,.75)'; ctx.lineWidth = Math.max(1, L * 0.025);
        ctx.beginPath(); ctx.moveTo(L * 0.05, L * 0.15); ctx.quadraticCurveTo(L * 0.45, L * 0.42, L * 0.95, L * 0.28); ctx.stroke();
        // 红缨
        ctx.strokeStyle = VERM; ctx.lineWidth = L * 0.035; ctx.lineCap = 'round';
        for (var tq = 0; tq < 4; tq++) { ctx.beginPath(); ctx.moveTo(-L * 0.05, 0); ctx.quadraticCurveTo(-L * 0.2, -L * 0.15 - tq * L * 0.03, -L * (0.3 + tq * 0.04), -L * (0.05 + tq * 0.06) + Math.sin(t * 30 + tq) * L * 0.04); ctx.stroke(); }
        ctx.restore();
      }
      // 「羽」六笔：飞出，贴在刃脊上（青龙鳞）
      for (var j = 0; j < g.n; j++) {
        var home = homePos(g, j, base, gs);
        var u = 0.08 + j * 0.15;
        var lx = L * (u), ly = L * (0.1 + 0.32 * Math.sin(u * PI * 0.9)) - L * 0.12;
        var tx = bx + Math.cos(ang) * lx - Math.sin(ang) * ly, ty = by + Math.sin(ang) * lx + Math.cos(ang) * ly;
        var d = cl(form * 1.3 - j * 0.05);
        I.strokeAt(ctx, g, j, lerp(home.x, tx, d), lerp(home.y, ty, d), lerp(gs, gs * 2.1, d), { rot: lerp(0, ang + (j % 3 === 0 ? 0.6 : 0), d), color: d > 0.5 ? '#e9f1e4' : INK });
      }
      if (t >= 0.5 && !f.h) {
        f.h = 1;
        E.enemiesNear(f.s, f.X, f.Y, R, function (x, y) { slash(x, y, Math.atan2(y - f.Y, x - f.X) + PI / 2, C * 1.1, '#173f30', 0.35); drops(x, y, 5, C * 2, C * 0.1); });
        E.shake(4); E.sfx('blade');
      }
    }
  };

  SK.zhangfei = {
    life: 1.05, hide: { ci: 1, list: 'all' },
    start: function (f) { skillBanner(f, '当阳怒喝', '张'); E.sfx('skill', 'zhangfei'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('飞'), gs = genSize(), base = genGlyphPos(f, 1);
      var pA = seg(t, 0, 0.3), pC = seg(t, 0.6, 1.05);
      var grow = eo(pA) * (1 - eio(pC));
      var S = lerp(gs, C * 2.6, grow), cx = lerp(base.x, f.X, grow), cy = lerp(base.y, f.Y - C * 0.4, grow);
      var flare = grow * (0.7 + 0.3 * Math.sin(t * 30) * (t > 0.3 && t < 0.6 ? 1 : 0));
      ctx.globalAlpha = lerp(1, 0.85, grow);
      for (var i = 0; i < g.n; i++) {
        var dx = g.cx[i] - g.gx, dy = g.cy[i] - g.gy;
        var k = S / 1024;
        I.strokeAt(ctx, g, i, cx + (g.cx[i] - 512) * k + dx * k * 0.5 * flare, cy + (g.cy[i] - 512) * k + dy * k * 0.5 * flare, S, { rot: (dx > 0 ? 1 : -1) * 0.4 * flare, color: INK });
      }
      ctx.globalAlpha = 1;
      if (t > 0.3 && t < 0.95) {
        var pq = seg(t, 0.3, 0.42), fade = 1 - seg(t, 0.75, 0.95);
        var hs = lerp(C * 4.5, C * 1.5, eo(pq));
        ctx.globalAlpha = fade * eo(pq);
        I.draw(ctx, I.glyph('喝'), f.X, f.Y + C * 0.1, hs, VERM);
        ctx.globalAlpha = 1;
        // 放射速度线
        ctx.strokeStyle = 'rgba(27,23,18,' + 0.4 * fade + ')';
        for (var r = 0; r < 18; r++) {
          var a = r / 18 * TAU + 0.1, r0 = C * (0.9 + eo(pq) * 0.6), r1 = r0 + C * (0.5 + (r % 3) * 0.3);
          ctx.lineWidth = r % 2 ? 1 : 2;
          ctx.beginPath(); ctx.moveTo(f.X + Math.cos(a) * r0, f.Y + Math.sin(a) * r0); ctx.lineTo(f.X + Math.cos(a) * r1, f.Y + Math.sin(a) * r1); ctx.stroke();
        }
      }
      if (t >= 0.3 && !f.h) {
        f.h = 1;
        var R = (f.ev.rad || 2.5) * C;
        ring(f.X, f.Y, C * 0.5, R, '27,23,18', 0.55, 8);
        ring(f.X, f.Y, C * 0.3, R * 0.8, '179,38,30', 0.5, 4);
        E.shake(6);
      }
      if (t >= 0.42 && !f.h2) { f.h2 = 1; ring(f.X, f.Y, C * 0.3, (f.ev.rad || 2.5) * C * 1.05, '27,23,18', 0.5, 4); E.enemiesNear(f.s, f.X, f.Y, (f.ev.rad || 2.5) * C, function (x, y) { drops(x, y, 3, C, C * 0.07); }); }
    }
  };

  SK.zhaoyun = {
    life: 1.5, hide: { ci: 1, list: 'all' },
    start: function (f) {
      f.life = 0.35 + 0.09 * (Math.max(1, f.pts.length) + 1) + 0.3;
      skillBanner(f, '七进七出', '赵'); E.sfx('skill', 'zhaoyun');
    },
    // 龙头位置：按时间沿 牌 → 各敌 → 牌 行进
    head: function (f, t, out) {
      var pts = f.pts, n = pts.length, C = E.cell;
      if (t < 0.3) {
        var a = t / 0.3 * TAU * 1.5, r = C * 0.55 * eo(t / 0.3);
        out.x = f.X + Math.cos(a) * r; out.y = f.Y + Math.sin(a) * r * 0.7; return out;
      }
      var wp = [], i;
      wp.push([f.X + Math.cos(TAU * 1.5) * C * 0.55, f.Y]);
      for (i = 0; i < n; i++) wp.push(pts[i]);
      wp.push([f.X, f.Y]);
      var tt = (t - 0.3) / 0.09 + 0.55; // 第 i 个敌人在 0.35+0.09*i 时到达
      var idx = Math.floor(tt), fr = tt - idx;
      if (idx >= wp.length - 1) { out.x = f.X; out.y = f.Y; return out; }
      if (idx < 0) { idx = 0; fr = 0; }
      var A = wp[idx], B = wp[idx + 1], P0 = wp[Math.max(0, idx - 1)], P3 = wp[Math.min(wp.length - 1, idx + 2)];
      // Catmull-Rom
      var t2 = fr * fr, t3 = t2 * fr;
      out.x = 0.5 * ((2 * A[0]) + (-P0[0] + B[0]) * fr + (2 * P0[0] - 5 * A[0] + 4 * B[0] - P3[0]) * t2 + (-P0[0] + 3 * A[0] - 3 * B[0] + P3[0]) * t3);
      out.y = 0.5 * ((2 * A[1]) + (-P0[1] + B[1]) * fr + (2 * P0[1] - 5 * A[1] + 4 * B[1] - P3[1]) * t2 + (-P0[1] + 3 * A[1] - 3 * B[1] + P3[1]) * t3);
      return out;
    },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('云'), gs = genSize(), base = genGlyphPos(f, 1);
      var end = f.life - 0.25, back = seg(t, end, f.life);
      var H = SK.zhaoyun.head, o = {};
      // 墨龙身：沿龙头历史位置的锥形墨带
      var n = 0, pts = f.trail || (f.trail = []);
      pts.length = 0;
      for (var j = 0; j < 22; j++) { var tt = t - j * 0.014; if (tt < 0) break; H(f, Math.min(tt, end), o); pts.push(o.x, o.y); n++; }
      if (t < end + 0.1 && t > 0.05) {
        var fade = 1 - seg(t, end - 0.05, end + 0.1);
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(24,40,60,.2)'; I.ribbon(ctx, pts, n, C * 1.0, 0);
        ctx.fillStyle = 'rgba(16,30,50,.82)'; I.ribbon(ctx, pts, n, C * 0.42, 0);
        // 龙鳞
        ctx.strokeStyle = 'rgba(240,235,220,.7)'; ctx.lineWidth = Math.max(1, C * 0.03);
        for (var sI = 2; sI < n - 2; sI += 2) {
          var bx0 = pts[sI * 2], by0 = pts[sI * 2 + 1], ba = Math.atan2(pts[sI * 2 - 1] - by0, pts[sI * 2 - 2] - bx0);
          var wsc = C * 0.15 * (1 - sI / n);
          ctx.beginPath(); ctx.arc(bx0, by0, wsc, ba - 1.2, ba + 1.2); ctx.stroke();
        }
        // 龙须
        if (n > 3) {
          var hx0 = pts[0], hy0 = pts[1], ha = Math.atan2(hy0 - pts[3], hx0 - pts[2]);
          ctx.strokeStyle = VERM; ctx.lineWidth = Math.max(1, C * 0.025);
          for (var wq = -1; wq <= 1; wq += 2) {
            ctx.beginPath(); ctx.moveTo(hx0, hy0);
            ctx.quadraticCurveTo(hx0 - Math.cos(ha) * C * 0.4 + Math.sin(ha) * wq * C * 0.3, hy0 - Math.sin(ha) * C * 0.4 - Math.cos(ha) * wq * C * 0.3, hx0 - Math.cos(ha) * C * 0.8 + Math.sin(ha) * wq * C * (0.2 + Math.sin(t * 20) * 0.1), hy0 - Math.sin(ha) * C * 0.8 - Math.cos(ha) * wq * C * 0.2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      // 「云」四笔：龙首、龙身、龙尾
      for (var i = 0; i < g.n; i++) {
        var lag = [0.03, 0.06, 0, 0.09][i];
        H(f, Math.min(Math.max(0, t - lag), end), o);
        var hx = o.x, hy = o.y;
        H(f, Math.min(Math.max(0, t - lag - 0.01), end), o);
        var ang = Math.atan2(hy - o.y, hx - o.x);
        var home = homePos(g, i, base, gs);
        var big = 1 - back;
        var x = lerp(home.x, hx, big), y = lerp(home.y, hy, big);
        var sz = lerp(gs, gs * (i === 2 ? 3.4 : 2.4), Math.min(1, t / 0.2) * big);
        I.strokeAt(ctx, g, i, x, y, sz, { rot: lerp(0, ang - g.ang[i] * 0.3, big * 0.9), color: '#14243a', halo: big > 0.3 ? HALO : null, hb: 4 });
      }
      // 命中
      f.hi = f.hi || 0;
      while (f.hi < f.pts.length && t >= 0.35 + f.hi * 0.09) {
        var q = f.pts[f.hi];
        slash(q[0], q[1], rnd(0, TAU), C * 1.0, '#14243a', 0.3);
        drops(q[0], q[1], 5, C * 1.8, C * 0.09);
        if (f.hi % 2 === 0) E.sfx('blade');
        f.hi++;
      }
    }
  };

  SK.huangzhong = {
    life: 1.15, hide: { ci: 1, list: [0, 1, 2, 3] },
    start: function (f) { skillBanner(f, '百步穿杨', '黄'); E.sfx('skill', 'huangzhong'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('忠'), gs = genSize(), base = genGlyphPos(f, 1);
      var tgt = E.enemyPos(f.s, f.ev.eid);
      if (tgt) { f.x2 = tgt.x; f.y2 = tgt.y; }
      var pA = seg(t, 0, 0.3), pC = seg(t, 0.85, 1.15);
      var go = eo(pA);
      var mid = [0, 1, 2, 3];
      var S = lerp(gs, C * 1.5, go);
      var cx = f.x2, cy = f.y2;
      if (t < 0.72) {
        // 「中」飞到敌人头上，化作箭靶
        for (var i = 0; i < 4; i++) {
          var home = homePos(g, mid[i], base, gs);
          var tx = cx + (g.cx[mid[i]] - 512) * S / 1024, ty = cy + (g.cy[mid[i]] - 512) * S / 1024 + C * 0.05;
          I.strokeAt(ctx, g, mid[i], lerp(home.x, tx, go), lerp(home.y, ty, go), S, { color: go > 0.5 ? VERM : INK });
        }
        if (go > 0.3) {
          ctx.strokeStyle = 'rgba(179,38,30,' + go * 0.8 + ')'; ctx.lineWidth = 1.5;
          var rr = C * 0.75 * (1.3 - 0.3 * go) + Math.sin(t * 20) * 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, rr * 1.35, 0, TAU); ctx.stroke();
        }
      } else if (!f.burst) {
        f.burst = 1;
        deathFxColor(g, mid, cx, cy, S, VERM);
      }
      // 金箭：先在黄忠身前蓄势，再一线贯出
      if (t > 0.28 && t < 0.74) {
        var ang = Math.atan2(cy - f.Y, cx - f.X);
        var charge = seg(t, 0.28, 0.5), pa = ei(seg(t, 0.5, 0.7));
        var ax = lerp(f.X, cx, pa), ay = lerp(f.Y, cy, pa);
        var ga = I.glyph('黄'), wi = straightest('黄'), AL = C * 1.5;
        if (pa > 0) {
          ctx.fillStyle = 'rgba(214,160,50,.55)';
          I.ribbon(ctx, [ax, ay, lerp(f.X, cx, pa * 0.6), lerp(f.Y, cy, pa * 0.6), f.X, f.Y], 3, C * 0.16, 0);
        }
        I.blit(ctx, I.glowSprite('rgba(255,210,110,.85)', Math.round(C * (0.4 + 0.3 * charge))), ax, ay, 1, 0.5 + charge * 0.5);
        I.strokeAt(ctx, ga, wi, ax - Math.cos(ang) * AL * 0.5, ay - Math.sin(ang) * AL * 0.5, gs, { align: ang, along: AL / (ga.len[wi] * gs / 1024), across: 2.4, px: ga.med[wi][0], py: ga.med[wi][1], color: '#6a4408', halo: 'rgba(255,230,160,.95)', hb: 5 });
        ctx.save(); ctx.translate(ax + Math.cos(ang) * AL * 0.5, ay + Math.sin(ang) * AL * 0.5); ctx.rotate(ang);
        ctx.fillStyle = '#6a4408';
        ctx.beginPath(); ctx.moveTo(C * 0.24, 0); ctx.lineTo(-C * 0.04, -C * 0.1); ctx.lineTo(0, 0); ctx.lineTo(-C * 0.04, C * 0.1); ctx.fill();
        ctx.translate(-AL, 0); ctx.fillStyle = VERM;
        ctx.beginPath(); ctx.moveTo(C * 0.12, 0); ctx.lineTo(-C * 0.06, -C * 0.1); ctx.lineTo(0, 0); ctx.lineTo(-C * 0.06, C * 0.1); ctx.fill();
        ctx.restore();
      }
      if (t >= 0.7 && !f.h) {
        f.h = 1;
        sparks(cx, cy, 22, C * 3);
        drops(cx, cy, 10, C * 2.2, C * 0.12);
        ring(cx, cy, C * 0.3, C * 1.6, '200,150,50', 0.5, 5);
        word(cx + C * 0.6, cy - C * 0.7, '穿', C * 0.6, VERM, 0.8, -0.1);
        E.shake(3); E.sfx('bolt');
      }
      if (t > 0.85) {
        // 「中」写回
        for (var j = 0; j < 4; j++) { var hm = homePos(g, mid[j], base, gs); ctx.globalAlpha = pC; I.strokeAt(ctx, g, mid[j], hm.x, hm.y, gs, { color: INK }); }
        ctx.globalAlpha = 1;
      }
    }
  };
  function deathFxColor(g, list, X, Y, size, color) {
    // 笔画碎裂（技能用，带颜色）
    list.forEach(function (i) {
      var dx = g.cx[i] - g.gx, dy = g.cy[i] - g.gy, l = Math.hypot(dx, dy) || 1;
      var vx = dx / l * E.cell * 2.5, vy = dy / l * E.cell * 2.5 - E.cell;
      addFx({ k: 'shard', g: g, i: i, x: X + (g.cx[i] - 512) * size / 1024, y: Y + (g.cy[i] - 512) * size / 1024, vx: vx, vy: vy, size: size, c: color, life: 0.6, vr: rnd(-8, 8) });
    });
  }
  FXD.shard = function (ctx, f, p) {
    ctx.globalAlpha = 1 - p;
    I.strokeAt(ctx, f.g, f.i, f.x + f.vx * f.t, f.y + f.vy * f.t + E.cell * 3 * f.t * f.t, f.size, { rot: f.vr * f.t, color: f.c });
    ctx.globalAlpha = 1;
  };

  SK.liubei = {
    life: 1.35, hide: { ci: 1, list: 'all' },
    start: function (f) { skillBanner(f, '仁德', '刘'); E.sfx('skill', 'liubei'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('备'), gs = genSize(), base = genGlyphPos(f, 1);
      var pA = seg(t, 0, 0.5), pC = seg(t, 0.95, 1.35);
      var up = eo(pA) * (1 - eio(pC));
      var hx = f.X, hy = f.Y - C * 0.9 * (f.s === 1 ? -1 : 1);
      I.blit(ctx, I.glowSprite('rgba(255,214,120,.7)', Math.round(C * 1.3)), hx, hy, 0.6 + up * 0.7, up);
      // 金色光芒
      if (up > 0.05) {
        ctx.strokeStyle = 'rgba(220,170,60,' + 0.5 * up + ')'; ctx.lineWidth = 1.5;
        for (var ry = 0; ry < 16; ry++) { var ra = ry / 16 * TAU + t * 0.8, r0 = C * 0.95, r1 = C * (1.2 + (ry % 2) * 0.35) * up; ctx.beginPath(); ctx.moveTo(hx + Math.cos(ra) * r0, hy + Math.sin(ra) * r0); ctx.lineTo(hx + Math.cos(ra) * (r0 + r1 * 0.5), hy + Math.sin(ra) * (r0 + r1 * 0.5)); ctx.stroke(); }
      }
      for (var i = 0; i < g.n; i++) {
        var home = homePos(g, i, base, gs);
        var a = i / g.n * TAU + t * 2;
        var tx = hx + Math.cos(a) * C * 0.75, ty = hy + Math.sin(a) * C * 0.75;
        var d = cl(up * 1.4 - i * 0.05);
        I.strokeAt(ctx, g, i, lerp(home.x, tx, d), lerp(home.y, ty, d), lerp(gs, gs * 2.1, d), { rot: lerp(0, a + PI / 2, d), color: d > 0.4 ? '#9a6208' : INK, halo: d > 0.3 ? 'rgba(255,236,170,.95)' : null, hb: 5 });
      }
      if (up > 0.3 && t < 0.55) { ctx.globalAlpha = seg(t, 0.25, 0.45) * (1 - seg(t, 0.5, 0.55)); I.draw(ctx, I.glyph('仁'), hx, hy, C * 1.1, '#8a5a0c'); ctx.globalAlpha = 1; }
      if (t > 0.5 && t < 0.95) {
        var pq = eio(seg(t, 0.5, 0.92));
        var dst = f.ev.gold ? { x: f.X, y: f.Y - C } : E.aduPos(f.s);
        var x = lerp(hx, dst.x, pq), y = lerp(hy, dst.y, pq) - Math.sin(pq * PI) * C;
        I.blit(ctx, I.glowSprite('rgba(255,220,130,.9)', Math.round(C * 0.8)), x, y);
        I.draw(ctx, I.glyph('仁'), x, y, C * 1.1, '#8a5a0c');
      }
      if (t >= 0.92 && !f.h) {
        f.h = 1;
        var d2 = f.ev.gold ? { x: f.X, y: f.Y - C } : E.aduPos(f.s);
        sparks(d2.x, d2.y, 20, C * 2.5);
        addFx({ k: 'hearts', x: d2.x, y: d2.y, r: C * 0.9, life: 0.7 });
        if (f.ev.gold) word(d2.x, d2.y - C * 0.3, '+' + f.ev.gold, C * 0.45, '#8a5a0c', 0.9);
        E.sfx('heal');
      }
    }
  };

  SK.kongming = {
    life: 1.55, hide: { ci: 1, list: 'all' },
    start: function (f) {
      skillBanner(f, '借东风', '孔'); E.sfx('skill', 'kongming');
      f.pts.sort(function (a, b) { return Math.hypot(a[0] - f.X, a[1] - f.Y) - Math.hypot(b[0] - f.X, b[1] - f.Y); });
      f.wind = [];
      for (var i = 0; i < 6; i++) f.wind.push([rnd(-1, 1), rnd(0, 1), rnd(0.6, 1.2)]);
    },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('明'), gs = genSize(), base = genGlyphPos(f, 1);
      var pA = seg(t, 0, 0.35), pC = seg(t, 1.15, 1.55);
      var up = eo(pA) * (1 - eio(pC));
      var dirY = f.s === 1 ? 1 : -1;
      var sun = { x: f.X - C * 1.0, y: f.Y + dirY * C * 1.35 }, moon = { x: f.X + C * 1.0, y: f.Y + dirY * C * 1.35 };
      if (up > 0.05) {
        ctx.fillStyle = 'rgba(196,48,28,' + 0.88 * up + ')';
        ctx.beginPath(); ctx.arc(sun.x, sun.y, C * 0.62 * up, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(232,236,240,' + 0.92 * up + ')';
        ctx.beginPath(); ctx.arc(moon.x, moon.y, C * 0.6 * up, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(42,63,102,' + 0.25 * up + ')';
        ctx.beginPath(); ctx.arc(moon.x + C * 0.18 * up, moon.y - C * 0.1 * up, C * 0.5 * up, 0, TAU); ctx.fill();
      }
      // 日：天火
      I.blit(ctx, I.glowSprite('rgba(230,80,30,.6)', Math.round(C * 0.8)), sun.x, sun.y, 0.5 + up * 0.7, up);
      I.blit(ctx, I.glowSprite('rgba(110,140,190,.45)', Math.round(C * 0.7)), moon.x, moon.y, 0.5 + up * 0.6, up);
      var ri = [0, 1, 2, 3], yu = [4, 5, 6, 7];
      var gR = I.groupCenter(g, ri), gY = I.groupCenter(g, yu), k = gs / 1024;
      var S2 = lerp(gs, gs * 2.6, up);
      drawGroup(ctx, g, ri, S2, lerp(base.x + (gR.x - 512) * k, sun.x, up), lerp(base.y + (gR.y - 512) * k, sun.y, up), { rot: up * Math.sin(t * 3) * 0.2, px: gR.x, py: gR.y, color: up > 0.4 ? '#fbe9c8' : INK });
      drawGroup(ctx, g, yu, S2, lerp(base.x + (gY.x - 512) * k, moon.x, up), lerp(base.y + (gY.y - 512) * k, moon.y, up), { rot: -up * 0.2, px: gY.x, py: gY.y, color: up > 0.4 ? '#22355a' : INK });
      // 东风：横扫的长笔
      if (t > 0.3 && t < 1.25) {
        var pw = seg(t, 0.3, 1.25);
        for (var w = 0; w < f.wind.length; w++) {
          var wd = f.wind[w], y0 = f.Y + wd[0] * C * 2.2, ph = cl(pw * 1.6 - wd[1] * 0.5);
          if (ph <= 0 || ph >= 1) continue;
          var xa = f.X - C * 4 + ph * C * 8, n = 0, pts = [];
          for (var s = 0; s < 10; s++) { var xx = xa - s * C * 0.35 * wd[2]; pts.push(xx, y0 + Math.sin(xx / C * 1.3 + w) * C * 0.25); n++; }
          ctx.fillStyle = 'rgba(70,90,110,' + 0.35 * Math.sin(ph * PI) + ')';
          I.ribbon(ctx, pts, n, C * 0.12, 0);
        }
      }
      // 火：沿路依次燃起
      var L = f.pts;
      for (var i = 0; i < L.length; i++) {
        var q = L[i], d = Math.hypot(q[0] - f.X, q[1] - f.Y) / C;
        var t0 = 0.5 + d * 0.1, pf = seg(t, t0, t0 + 0.55);
        if (pf <= 0 || pf >= 1) continue;
        var hh = Math.sin(pf * PI);
        I.blit(ctx, I.glowSprite('rgba(255,110,30,.55)', Math.round(C * 0.45)), q[0], q[1] - C * 0.1, 0.7 + hh * 0.5, hh);
        var gf = I.glyph('火');
        I.strokeAt(ctx, gf, 2 + (i % 2), q[0], q[1] - C * 0.2 * hh, C * 0.7 * (0.6 + hh * 0.5), { rot: Math.sin(t * 30 + i) * 0.15, color: 'rgba(168,36,14,' + (0.4 + 0.5 * hh) + ')' });
        if (Math.random() < 0.12) embers(q[0], q[1], 1, C * 0.5);
      }
      if (t >= 0.55 && !f.h) { f.h = 1; E.sfx('fire'); E.shake(2); }
    }
  };

  SK.machao = {
    life: 1.05, hide: { ci: 0, list: 'all' },
    start: function (f) { skillBanner(f, '西凉铁骑', '马'); E.sfx('skill', 'machao'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('马'), gs = genSize(), base = genGlyphPos(f, 0);
      var ang = Math.atan2(f.y2 - f.Y, f.x2 - f.X), L = Math.hypot(f.x2 - f.X, f.y2 - f.Y);
      var nx = -Math.sin(ang), ny = Math.cos(ang);
      var face = Math.cos(ang) < 0 ? -1 : 1;
      // 五骑楔形冲阵
      for (var i = 0; i < 5; i++) {
        var row = [0, -1, 1, -2, 2][i], lag = Math.abs(row) * 0.05;
        var pa = seg(t, 0.15 + lag, 0.7 + lag);
        if (t < 0.15 + lag) {
          var pin = seg(t, lag * 0.5, 0.15 + lag);
          var sx = f.X - Math.cos(ang) * C * (0.4 + Math.abs(row) * 0.25) + nx * row * C * 0.4, sy = f.Y - Math.sin(ang) * C * (0.4 + Math.abs(row) * 0.25) + ny * row * C * 0.4;
          ctx.globalAlpha = pin;
          I.draw(ctx, g, lerp(base.x, sx, eo(pin)), lerp(base.y, sy, eo(pin)), lerp(gs, C * 0.75, pin), INK);
          ctx.globalAlpha = 1;
          continue;
        }
        if (pa >= 1) continue;
        var d = ei(pa) * (L + C * 0.6) - C * (0.4 + Math.abs(row) * 0.25);
        var x = f.X + Math.cos(ang) * d + nx * row * C * 0.4, y = f.Y + Math.sin(ang) * d + ny * row * C * 0.4 - Math.abs(Math.sin(pa * 8 * PI)) * C * 0.12;
        var al = pa > 0.8 ? 1 - (pa - 0.8) / 0.2 : 1;
        ctx.save(); ctx.globalAlpha = al;
        ctx.strokeStyle = 'rgba(27,23,18,.25)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * C * 0.4, y - Math.sin(ang) * C * 0.4); ctx.lineTo(x - Math.cos(ang) * C * 1.2, y - Math.sin(ang) * C * 1.2); ctx.stroke();
        ctx.translate(x, y); ctx.scale(face, 1); ctx.rotate(Math.sin(pa * 16 * PI) * 0.1);
        ctx.shadowColor = HALO; ctx.shadowBlur = 5 * (window.devicePixelRatio || 1);
        I.draw(ctx, g, 0, 0, C * 0.8, INK);
        ctx.restore();
        if (Math.random() < 0.3) dust(x, y + C * 0.3, 1, C * 0.3);
      }
      ctx.globalAlpha = 1;
      if (t > 0.75) { ctx.globalAlpha = seg(t, 0.75, 1.05); I.draw(ctx, g, base.x, base.y, gs, INK); ctx.globalAlpha = 1; }
      if (t >= 0.45 && !f.h) {
        f.h = 1;
        addFx({ k: 'pierce', x: f.X, y: f.Y, ang: ang, len: L, w: C * 0.9, life: 0.4 });
        E.enemiesLine(f.s, f.X, f.Y, ang, L, C * 0.5, function (x, y) { drops(x, y, 5, C * 1.8, C * 0.1); slash(x, y, ang + PI / 2, C * 0.8, INK, 0.25); });
        E.shake(3); E.sfx('hoof');
      }
    }
  };

  SK.pangtong = {
    life: 1.3, hide: { ci: 1, list: [0, 1, 2] },
    start: function (f) { skillBanner(f, '连环计', '庞'); E.sfx('skill', 'pangtong'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('统'), gs = genSize(), base = genGlyphPos(f, 1);
      var wp = [[f.X, f.Y]].concat(f.pts);
      var prog = seg(t, 0.08, 0.5) * (wp.length - 1);
      var fade = 1 - seg(t, 1.0, 1.3);
      ctx.globalAlpha = fade;
      for (var i = 0; i < wp.length - 1; i++) {
        var q = cl(prog - i);
        if (q <= 0) break;
        chain(ctx, wp[i][0], wp[i][1], lerp(wp[i][0], wp[i + 1][0], q), lerp(wp[i][1], wp[i + 1][1], q), C);
      }
      // 「纟」三笔：在链首盘旋
      var head = Math.min(wp.length - 1, Math.floor(prog)), fr = cl(prog - head);
      var hx = head < wp.length - 1 ? lerp(wp[head][0], wp[head + 1][0], fr) : wp[head][0], hy = head < wp.length - 1 ? lerp(wp[head][1], wp[head + 1][1], fr) : wp[head][1];
      var go = eo(seg(t, 0, 0.12)) * (1 - seg(t, 0.9, 1.2));
      for (var j = 0; j < 3; j++) {
        var home = homePos(g, j, base, gs), a = t * 10 + j * TAU / 3;
        I.strokeAt(ctx, g, j, lerp(home.x, hx + Math.cos(a) * C * 0.3, go), lerp(home.y, hy + Math.sin(a) * C * 0.3, go), lerp(gs, gs * 2.4, go), { rot: a * go, color: '#2a2f38', halo: go > 0.3 ? HALO : null, hb: 4 });
      }
      ctx.globalAlpha = 1;
      if (t >= 0.5 && !f.h) { f.h = 1; f.pts.forEach(function (q2, i2) { sparks(q2[0], q2[1], 5, C * 1.5, '#9aa4b4'); word(q2[0] + C * 0.3, q2[1] - C * 0.35, '连', C * 0.36, VERM, 0.8, (i2 % 2 ? 0.2 : -0.2)); }); E.sfx('chain'); }
    }
  };
  function chain(ctx, x0, y0, x1, y1, C) {
    var L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / (C * 0.16))), a = Math.atan2(y1 - y0, x1 - x0);
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#5d6878' : 'rgba(246,240,226,.9)';
      ctx.lineWidth = Math.max(1.2, C * 0.035) + (pass ? 0 : 2.2);
      for (var i = 0; i < n; i++) {
        var x = x0 + (x1 - x0) * (i + 0.5) / n, y = y0 + (y1 - y0) * (i + 0.5) / n;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); if (i % 2) ctx.ellipse(0, 0, C * 0.1, C * 0.025, 0, 0, TAU); else ctx.ellipse(0, 0, C * 0.1, C * 0.055, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  SK.weiyan = {
    life: 1.05, hide: { ci: 1, list: 'all' },
    start: function (f) {
      skillBanner(f, '破阵', '魏'); E.sfx('skill', 'weiyan');
      f.cracks = [];
      for (var i = 0; i < 9; i++) { var a = i / 9 * TAU + rnd(-0.2, 0.2), pts = [], r = 0; for (var j = 0; j < 6; j++) { r += rnd(0.25, 0.45); pts.push([Math.cos(a + rnd(-0.25, 0.25)) * r, Math.sin(a + rnd(-0.25, 0.25)) * r]); } f.cracks.push(pts); }
    },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('延'), gs = genSize(), base = genGlyphPos(f, 1);
      var pA = seg(t, 0, 0.3), pC = seg(t, 0.6, 1.05);
      var out = eo(pA) * (1 - eio(pC));
      // 地裂
      var pc = seg(t, 0.12, 0.42), fade = 1 - seg(t, 0.7, 1.05);
      ctx.strokeStyle = 'rgba(27,23,18,' + 0.7 * fade + ')';
      for (var i = 0; i < f.cracks.length; i++) {
        var cr = f.cracks[i], m = Math.ceil(cr.length * pc);
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(f.X, f.Y);
        for (var j = 0; j < m; j++) ctx.lineTo(f.X + cr[j][0] * C, f.Y + cr[j][1] * C);
        ctx.stroke();
      }
      for (var s = 0; s < g.n; s++) {
        var home = homePos(g, s, base, gs), a = s / g.n * TAU + 0.4;
        var R = C * (1.5 + (s % 2) * 0.5);
        I.strokeAt(ctx, g, s, lerp(home.x, f.X + Math.cos(a) * R, out), lerp(home.y, f.Y + Math.sin(a) * R, out), lerp(gs, gs * 3.4, out), { rot: out * (a + PI / 2 + t * 3), color: out > 0.5 ? '#7a1a12' : INK, halo: out > 0.3 ? HALO : null, hb: 4 });
      }
      if (t > 0.3 && t < 0.8) {
        var pq = seg(t, 0.3, 0.42), fd = 1 - seg(t, 0.6, 0.8);
        ctx.globalAlpha = fd;
        I.draw(ctx, I.glyph('破'), f.X, f.Y, lerp(C * 3, C * 1.6, eo(pq)), VERM);
        ctx.globalAlpha = 1;
      }
      if (t >= 0.3 && !f.h) { f.h = 1; ring(f.X, f.Y, C * 0.4, (f.ev.rad || 2.5) * C, '179,38,30', 0.5, 6); E.shake(4); E.enemiesNear(f.s, f.X, f.Y, (f.ev.rad || 2.5) * C, function (x, y) { drops(x, y, 4, C * 1.6, C * 0.09); }); }
    }
  };

  SK.jiangwei = {
    life: 1.15, hide: { ci: 1, list: 'all' },
    start: function (f) { skillBanner(f, '伏兵四起', '姜'); E.sfx('skill', 'jiangwei'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('维'), gs = genSize(), base = genGlyphPos(f, 1);
      var sink = seg(t, 0, 0.15), travel = seg(t, 0.15, 0.3), rise = seg(t, 0.3, 0.45), stay = seg(t, 0.75, 1.0), ret = seg(t, 1.0, 1.15);
      if (t < 0.15) {
        for (var i = 0; i < g.n; i++) { var h = homePos(g, i, base, gs); ctx.globalAlpha = 1 - sink; I.strokeAt(ctx, g, i, h.x, h.y + sink * C * 0.3, gs, { sy: 1 - sink, color: INK }); }
        ctx.globalAlpha = 1;
      }
      if (t >= 0.15 && t < 0.32) {
        // 地下潜行：一串墨点
        for (var d = 0; d < 8; d++) {
          var q = cl(travel * 1.2 - d * 0.08); if (q <= 0) continue;
          var x = lerp(f.X, f.x2, q), y = lerp(f.Y, f.y2, q);
          ctx.fillStyle = 'rgba(70,55,35,' + 0.5 * (1 - d / 8) + ')';
          ctx.beginPath(); ctx.ellipse(x, y + C * 0.2, C * 0.12, C * 0.05, 0, 0, TAU); ctx.fill();
        }
      }
      if (t >= 0.3 && t < 1.0) {
        var R = (f.ev.rad || 1.3) * C, kk = gs / 1024;
        var up = back(cl(rise * 1.1)) * (1 - eio(stay));
        for (var s = 0; s < g.n; s++) {
          var a = s / g.n * TAU + 0.3, rr = R * (0.55 + (s % 3) * 0.18);
          var gxp = f.x2 + Math.cos(a) * rr, gyp = f.y2 + Math.sin(a) * rr * 0.6 + C * 0.2;
          ctx.fillStyle = 'rgba(60,45,30,' + 0.45 * Math.min(1, up * 2) + ')';
          ctx.beginPath(); ctx.ellipse(gxp, gyp, C * 0.18, C * 0.06, 0, 0, TAU); ctx.fill();
          if (up <= 0.02) continue;
          var mm = g.med[s], ex = mm[mm.length - 2], ey = mm[mm.length - 1];
          var lenS = C * (0.75 + (s % 2) * 0.3) * up;
          I.strokeAt(ctx, g, s, gxp, gyp, gs, { align: -PI / 2 + Math.cos(a) * 0.35, along: -lenS / (g.len[s] * kk), across: 1.8, px: ex, py: ey, color: '#2a2418', halo: HALO, hb: 4 });
        }
      }
      if (t >= 1.0) {
        for (var k2 = 0; k2 < g.n; k2++) { var h2 = homePos(g, k2, base, gs); ctx.globalAlpha = ret; I.strokeAt(ctx, g, k2, h2.x, h2.y, gs, { color: INK }); }
        ctx.globalAlpha = 1;
      }
      if (t >= 0.42 && !f.h) {
        f.h = 1;
        dust(f.x2, f.y2, 10, C * 0.6);
        drops(f.x2, f.y2, 10, C * 2, C * 0.1);
        word(f.x2, f.y2 - C * 0.9, '伏', C * 0.7, VERM, 0.8);
        E.shake(3); E.sfx('boom');
      }
    }
  };

  SK.guanping = {
    life: 1.05, hide: { ci: 1, list: 'all' },
    start: function (f) { skillBanner(f, '驰援', '关'); E.sfx('skill', 'guanping'); },
    draw: function (ctx, f, p) {
      var t = f.t, C = E.cell, g = I.glyph('平'), gs = genSize(), base = genGlyphPos(f, 1), k = gs / 1024;
      var up = eo(seg(t, 0, 0.3)) * (1 - eio(seg(t, 0.75, 1.05)));
      var dirY = f.s === 1 ? 1 : -1;
      // 旗杆「丨」拉长，「一」化作红旗
      var poleX = lerp(base.x, f.X + C * 0.1, up), poleY = lerp(base.y + gs * 0.4, f.Y + C * 0.35, up);
      var poleH = lerp(g.len[4] * k, C * 1.7, up);
      void dirY;
      I.strokeAt(ctx, g, 4, poleX, poleY, gs, { align: -PI / 2, along: poleH / (g.len[4] * k), across: 1.6, px: g.med[4][0], py: g.med[4][1], color: '#3a2a14', halo: up > 0.3 ? HALO : null, hb: 3 });
      var topY = poleY - poleH;
      if (up > 0.05) {
        ctx.fillStyle = 'rgba(179,38,30,' + 0.9 * up + ')';
        ctx.beginPath(); ctx.moveTo(poleX, topY);
        var fw = C * 0.9 * up, fh = C * 0.6;
        for (var i = 0; i <= 8; i++) { var xx = poleX + fw * i / 8; ctx.lineTo(xx, topY + Math.sin(t * 14 - i * 0.8) * C * 0.06 * i / 8); }
        for (var j = 8; j >= 0; j--) { var x2 = poleX + fw * j / 8; ctx.lineTo(x2, topY + fh + Math.sin(t * 14 - j * 0.8) * C * 0.06 * j / 8); }
        ctx.closePath(); ctx.fill();
        I.draw(ctx, I.glyph('关'), poleX + fw * 0.5, topY + fh * 0.5 + Math.sin(t * 14 - 4) * C * 0.03, C * 0.45 * up, PAPER);
      }
      [0, 1, 2, 3].forEach(function (si) { var h = homePos(g, si, base, gs); ctx.globalAlpha = 1 - up; I.strokeAt(ctx, g, si, h.x, h.y, gs, { color: INK }); });
      ctx.globalAlpha = 1;
      // 金色援线
      if (t > 0.3 && t < 0.9) {
        var pr = eo(seg(t, 0.3, 0.6)), fd = 1 - seg(t, 0.7, 0.9);
        (f.pts || []).forEach(function (q) {
          ctx.strokeStyle = 'rgba(210,160,60,' + 0.8 * fd + ')'; ctx.lineWidth = 2;
          var mx = (poleX + q[0]) / 2, my = Math.min(topY, q[1]) - C * 0.4;
          ctx.beginPath(); ctx.moveTo(poleX, topY);
          var steps = 10;
          for (var s = 1; s <= steps * pr; s++) { var u = s / steps; ctx.lineTo(bez(poleX, mx, q[0], u), bez(topY, my, q[1], u)); }
          ctx.stroke();
        });
      }
      if (t >= 0.6 && !f.h) { f.h = 1; (f.pts || []).forEach(function (q) { sparks(q[0], q[1], 6, C * 1.5); }); if (f.x2 != null) { slash(f.x2, f.y2, 0.5, C, INK, 0.3); drops(f.x2, f.y2, 5, C * 1.5, C * 0.08); } E.sfx('drum'); }
    }
  };

  // 技能总入口
  function startSkill(f) {
    var S = SK[f.gk]; if (!S) return null;
    f.k = 'skill'; f.life = S.life; f.hideSpec = S.hide;
    addFx(f);
    S.start(f);
    return f;
  }
  function skillHide(f) {
    var h = f.hideSpec; if (!h) return null;
    var p = f.t / f.life;
    if (p > 0.92) return null;
    if (h.list === 'all') return { ci: h.ci, list: 'all' };
    return { ci: h.ci, mask: mask(h.list) };
  }
  function activeSkill(s, c, r) {
    for (var i = fx.length - 1; i >= 0; i--) { var f = fx[i]; if (f.k === 'skill' && f.s === s && f.c === c && f.r === r) return f; }
    return null;
  }
  function drawLinks(ctx, enemies, pos) {
    // 连环计：被锁的敌人之间画铁索
    var prev = null;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!(e.linkT > 0)) continue;
      var p = pos(e);
      if (prev) { ctx.globalAlpha = Math.min(1, e.linkT); chain(ctx, prev.x, prev.y, p.x, p.y, E.cell); ctx.globalAlpha = 1; }
      prev = { x: p.x, y: p.y };
    }
  }

  window.ZYAnim = {
    init: init, DUR: DUR, UA: UA, drawTile: drawTile, drawProj: drawProj, drawEnemy: drawEnemy, deathFx: deathFx,
    startSkill: startSkill, skillHide: skillHide, activeSkill: activeSkill, drawLinks: drawLinks,
    parts: function () { return parts; }, fx: function () { return fx; },
    updParts: updParts, drawParts: drawParts, drawFx: drawFx, addFx: addFx, slash: slash, ring: ring, word: word, banner: banner,
    drops: drops, dust: dust, sparks: sparks, embers: embers, clearCaches: clearCaches, reset: function () { parts.length = 0; fx.length = 0; },
    seg: seg, eo: eo, ei: ei, eio: eio, lerp: lerp, INK: INK, VERM: VERM, GOLD: GOLD, PAPER: PAPER
  };
})();
