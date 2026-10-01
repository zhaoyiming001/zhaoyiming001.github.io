# 游戏来了 · 经典益智小游戏合集

在线地址：<https://zhaoyiming001.github.io/>

纯静态网站（HTML + CSS + 原生 JS），无需构建，直接由 GitHub Pages 托管。音效用 Web Audio 实时合成，没有音频文件。

## 游戏

| 游戏 | 目录 |
| --- | --- |
| 2048 | `games/2048/` |
| 数独 | `games/sudoku/` |
| 扫雷 | `games/minesweeper/` |
| 俄罗斯方块 | `games/tetris/` |
| 贪吃蛇 | `games/snake/` |
| 华容道 | `games/klotski/` |
| 五子棋 | `games/gomoku/` |
| 记忆翻牌 | `games/memory/` |

## 目录结构

```
index.html          首页：游戏大厅
assets/site.css     全站公共样式（浅色 / 深色主题、游戏页框架、弹窗等）
assets/site.js      全站公共脚本（主题、本地存储、弹窗、音效）
games/<游戏>/       每个游戏一个独立的 index.html
```

## 新增一个游戏

1. 参照 `games/2048/index.html` 新建 `games/<游戏名>/index.html`，沿用顶栏 `.gbar`、数据条 `.stats`、玩法弹窗 `dialog#help` 等结构。
2. 本地存储统一用 `window.Site.store`，key 以 `gzly.<游戏名>.` 开头。
3. 加载时调用 `Site.played('<游戏名>')`，有成绩时调用 `Site.setHomeStat('<游戏名>', '最高 123')`，首页卡片会自动显示。
4. 音效：`Site.sound('click' | 'move' | 'merge' | 'place' | 'flip' | 'match' | 'error' | 'reveal' | 'flag' | 'boom' | 'rotate' | 'drop' | 'line' | 'eat' | 'win' | 'lose' | 'start' …)`。
5. 在首页 `index.html` 的 `#games` 里加一张卡片。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```
