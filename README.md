# 格子乐园 · 经典益智小游戏合集

在线地址：<https://zhaoyiming001.github.io/>

纯静态网站（HTML + CSS + 原生 JS），无需构建，直接由 GitHub Pages 托管。

## 目录结构

```
index.html          首页：游戏大厅
assets/site.css     全站公共样式（含浅色 / 深色主题）
assets/site.js      全站公共脚本（主题切换、本地存储）
games/2048/         2048
```

## 游戏列表

| 游戏 | 状态 |
| --- | --- |
| 2048 | ✅ 已上线 |
| 数独 | 计划中 |
| 扫雷 | 计划中 |
| 俄罗斯方块 | 计划中 |
| 贪吃蛇 | 计划中 |
| 华容道 | 计划中 |
| 五子棋 | 计划中 |
| 记忆翻牌 | 计划中 |

## 新增一个游戏

1. 新建 `games/<游戏名>/index.html`，引用 `../../assets/site.css` 和 `../../assets/site.js`。
2. 本地存储的 key 统一用 `gzly.<游戏名>.xxx` 前缀，通过 `window.Site.store` 读写。
3. 在首页 `index.html` 中把对应卡片从 `<div class="card soon">` 改成指向游戏的 `<a class="card">`。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```
