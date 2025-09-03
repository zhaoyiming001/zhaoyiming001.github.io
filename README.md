<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="zhaoyiming001 的开发者个人网站 - 分享编程经验、项目和博客">
    <title>zhaoyiming001 - 开发者网站</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        /* 全局样式 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        /* 头部 */
        header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 1rem 0;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
            transition: background 0.3s;
        }
        header.scrolled {
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        nav ul {
            list-style: none;
            display: flex;
            justify-content: center;
        }
        nav li {
            margin: 0 1rem;
        }
        nav a {
            color: #333;
            text-decoration: none;
            font-weight: 400;
            transition: color 0.3s;
        }
        nav a:hover {
            color: #667eea;
        }
        /* 英雄部分 */
        .hero {
            text-align: center;
            padding: 150px 0 100px;
            color: white;
        }
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            animation: fadeInUp 1s ease;
        }
        .hero p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .btn {
            display: inline-block;
            background: #fff;
            color: #667eea;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 30px;
            transition: transform 0.3s, box-shadow 0.3s;
            font-weight: 700;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        /* 部分通用 */
        section {
            padding: 80px 0;
        }
        h2 {
            text-align: center;
            font-size: 2.5rem;
            margin-bottom: 3rem;
            color: white;
        }
        /* 关于部分 */
        .about {
            background: rgba(255, 255, 255, 0.1);
            color: white;
        }
        .about-content {
            text-align: center;
            max-width: 800px;
            margin: 0 auto;
        }
        /* 项目部分 */
        .projects {
            background: white;
            color: #333;
        }
        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        .project-card {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        .project-card:hover {
            transform: translateY(-5px);
        }
        .project-card h3 {
            color: #667eea;
            margin-bottom: 1rem;
        }
        /* 博客部分 */
        .blog {
            background: rgba(255, 255, 255, 0.1);
            color: white;
        }
        .blog-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
        }
        .blog-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 1.5rem;
            border-radius: 10px;
            transition: background 0.3s;
        }
        .blog-card:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        /* 联系部分 */
        .contact {
            text-align: center;
            background: white;
            color: #333;
        }
        .contact a {
            color: #667eea;
            margin: 0 1rem;
            text-decoration: none;
        }
        /* 页脚 */
        footer {
            background: #333;
            color: white;
            text-align: center;
            padding: 2rem 0;
        }
        /* 动画 */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        /* 响应式 */
        @media (max-width: 768px) {
            .hero h1 { font-size: 2rem; }
            nav ul { flex-direction: column; }
            .project-grid, .blog-grid { grid-template-columns: 1fr; }
        }
        /* 暗色模式支持（可选，通过 JS 切换） */
        @media (prefers-color-scheme: dark) {
            body { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); }
            .projects, .contact { background: #2c3e50; color: white; }
        }
    </style>
</head>
<body>
    <header>
        <nav>
            <ul>
                <li><a href="#home">首页</a></li>
                <li><a href="#about">关于</a></li>
                <li><a href="#projects">项目</a></li>
                <li><a href="#blog">博客</a></li>
                <li><a href="#contact">联系</a></li>
            </ul>
        </nav>
    </header>

    <section id="home" class="hero">
        <div class="container">
            <h1>欢迎来到 zhaoyiming001 的世界</h1>
            <p>我是赵一鸣，一名热情的软件开发者，专注于 Web 开发、AI 和开源项目。探索我的作品吧！</p>
            <a href="#projects" class="btn">查看项目</a>
        </div>
    </section>

    <section id="about" class="about">
        <div class="container">
            <h2>关于我</h2>
            <div class="about-content">
                <p>作为一名开发者，我有 5 年经验，精通 Python、JavaScript 和 React。毕业于 [您的大学]，目前在 [您的公司] 工作。我热爱开源，贡献于 GitHub 社区。兴趣包括机器学习和现代 Web 技术。</p>
                <p>技能：HTML/CSS/JS, Python, Git, Docker。</p>
            </div>
        </div>
    </section>

    <section id="projects" class="projects">
        <div class="container">
            <h2>我的项目</h2>
            <div class="project-grid">
                <div class="project-card">
                    <h3>项目 1: TSP 求解器</h3>
                    <p>一个使用遗传算法解决旅行商问题的 Python 库。高效且易用。</p>
                    <a href="https://github.com/zhaoyiming001/tsp" target="_blank">GitHub 链接</a>
                </div>
                <div class="project-card">
                    <h3>项目 2: Knowledge Distillation</h3>
                    <p>PyTorch 实现的知识蒸馏模型，用于模型压缩和加速。</p>
                    <a href="https://github.com/zhaoyiming001/knowledge-distillation" target="_blank">GitHub 链接</a>
                </div>
                <div class="project-card">
                    <h3>项目 3: 个人博客系统</h3>
                    <p>基于 Hexo 的静态博客，集成 Fluid 主题。支持 Markdown 写作。</p>
                    <a href="https://github.com/zhaoyiming001/blog" target="_blank">GitHub 链接</a>
                </div>
            </div>
        </div>
    </section>

    <section id="blog" class="blog">
        <div class="container">
            <h2>最新博客</h2>
            <div class="blog-grid">
                <div class="blog-card">
                    <h3>2025 年 AI 发展趋势</h3>
                    <p>探讨大型语言模型在开发中的应用。发布时间：2025-09-01</p>
                    <a href="/posts/ai-trends-2025">阅读更多</a>
                </div>
                <div class="blog-card">
                    <h3>GitHub Pages 部署指南</h3>
                    <p>一步步教你如何搭建个人网站。发布时间：2025-08-15</p>
                    <a href="/posts/github-pages-guide">阅读更多</a>
                </div>
                <div class="blog-card">
                    <h3>Python 最佳实践</h3>
                    <p>分享代码优化技巧。发布时间：2025-07-20</p>
                    <a href="/posts/python-best-practices">阅读更多</a>
                </div>
            </div>
        </div>
    </section>

    <section id="contact" class="contact">
        <div class="container">
            <h2>联系我</h2>
            <p>有问题或合作？随时联系！</p>
            <p>
                <a href="mailto:zhaoyiming001@example.com">Email: zhaoyiming001@example.com</a> |
                <a href="https://github.com/zhaoyiming001" target="_blank">GitHub</a> |
                <a href="https://twitter.com/zhaoyiming001" target="_blank">Twitter</a> |
                <a href="https://linkedin.com/in/zhaoyiming001" target="_blank">LinkedIn</a>
            </p>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 zhaoyiming001. All rights reserved. | Powered by GitHub Pages</p>
        </div>
    </footer>

    <script>
        // 平滑滚动
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
        // 头部滚动效果
        window.addEventListener('scroll', () => {
            document.querySelector('header').classList.toggle('scrolled', window.scrollY > 50);
        });
    </script>
</body>
</html>
