# 日有所思 · 每日思考博客

日常使用请看 [自动发布指南](自动发布.md)：把 Markdown、TXT 或 DOCX 放入 `C:\work\Blog\文章`，后台程序自动同步发布。

博客：https://bipreacher.github.io/ 。以下保留手动写作与维护方式，日常投稿无需手动 Git 操作。

Astro 静态博客：本地写 Markdown → 推送 GitHub → Actions 构建 → Pages 发布。

## 1. 本地开始

安装 Node.js 24 LTS 和 pnpm 11（已安装 npm 时执行 `npm install -g pnpm@11`）。

```bash
pnpm install
pnpm dev
```

打开终端显示的地址，通常为 http://localhost:4321 。本地开发会显示草稿。

## 2. 每天写一篇

```bash
pnpm new "今天，我学会了把事情做小" small-steps
```

第二个参数为可选短链接，建议用英文。命令按北京时间生成日期，创建 `src/content/blog/日期-small-steps.md`，不会覆盖已有文件。

1. 打开生成的文件，写正文，修改简介和标签。
2. 用 `pnpm dev` 预览。
3. 写好后把 `draft: true` 改成 `draft: false`。
4. 执行以下命令发布：

```bash
git add src/content/blog public/images public/audio
git commit -m "发布今日思考"
git push
```

首次接入 GitHub 后，每次推送 main 都自动发布。也可以在 GitHub 网页中直接编辑 Markdown 并提交 main。

```markdown
---
title: "今天的一点思考"
description: "用一句话介绍这篇文章"
pubDate: 2026-09-10
tags: ["日常思考", "工作"]
draft: false
---

今天发生了什么？

我怎么看这件事？

明天想做的一点改变。
```

`pubDate` 用于显示和排序，不是定时发布开关。缺省 `draft` 视为草稿。生产构建排除草稿，但公开仓库仍会公开草稿源文件。不要把私人日记或密钥提交到公开仓库。

## 3. 首次接入 GitHub Pages

1. 在 GitHub 创建一个空仓库（不要勾选初始化 README）。可以命名为 `你的用户名.github.io`，也可以用 `daily-blog` 等普通名称。
2. 在项目目录执行（把 URL 换成自己的）：

```bash
git init -b main
git add .
git commit -m "初始化每日思考博客"
git remote add origin https://github.com/你的用户名/你的仓库名.git
```

3. 在仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 执行 `git push -u origin main`。如果此时 GitHub 还没有显示 Pages 设置，先推送，再完成步骤 3，并在 Actions → Deploy Blog → Run workflow 手动重跑。
5. 在 Actions 查看构建和发布结果，完成后从 Settings → Pages 打开站点。

部署从 GitHub Pages 设置读取域名和仓库路径，不用手动修改 Astro 配置。无需额外的发布 Token。首次 Git 操作可能需要登录 GitHub，提交前需在本机配置自己的 Git 用户名和邮箱。

## 4. 改成自己的博客

- `src/site.ts`：站点名称和介绍。
- `src/pages/index.astro`：首页介绍文字。
- `src/pages/about.astro`：关于页面。
- `src/content/blog/`：文章。可删除初始示例文章。
- `src/styles/global.css`：颜色与排版。

首页支持全文关键词和标签组合筛选；文章支持 Markdown、代码块、图片、音频；提供 RSS 订阅和适合手机的阅读布局。

## 5. 图片和音频

将文件放到 `public/images/` 和 `public/audio/`。推荐通过 frontmatter 添加封面和播放器，系统会自动适配 GitHub 仓库子路径：

```yaml
image: "/images/morning.jpg"
audio: "/audio/today.mp3"
```

也可以填完整的 `https://...` 外部地址。大量音频建议使用对象存储。

正文内的图片可以使用完整外部地址。若引用 public 中的本地文件，由于文章 URL 固定为 `/blog/文章名/`，可使用下面的相对路径，同时兼容普通仓库和个人域名：

```markdown
![晨间散步](../../images/morning.jpg)
```

```html
<audio controls preload="metadata" src="../../audio/today.mp3"></audio>
```

不要在正文里直接写 `/images/...`，它会跳过普通仓库的路径前缀。

## 6. 个人域名

在 Settings → Pages → Custom domain 设置域名，并在域名服务商处添加 GitHub 要求的 DNS 记录。配置生效后启用 Enforce HTTPS，然后手动运行一次 Deploy Blog，更新站点 canonical 和 RSS 域名。构建自动读取 Pages 的域名设置。

## 7. 发布前检查

```bash
pnpm build
pnpm preview
```

构建包含 Astro / TypeScript 检查。preview 显示生产版本，草稿不应出现。部署失败时在 Actions 中查看失败步骤，修复后重新推送即可。

官方参考：[Astro Pages 部署](https://docs.astro.build/en/guides/deploy/github/) · [GitHub 自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
