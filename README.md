# SnapText — 本地图片 OCR 文字提取器

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/iiiiiiiiiiiiiKK/snaptext/ci.yml?branch=main)](https://github.com/iiiiiiiiiiiiiKK/snaptext/actions)

---

**SnapText** 让图片里的文字，重新变得可编辑。它是一个**纯前端浏览器本地 OCR 工具**，支持中文、英文以及中英文混合识别，图像处理、区域选取、批量识别、历史记录、文本编辑与导出等完整功能。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 图片上传 | 支持 JPG、PNG、WEBP、BMP、GIF；拖拽、粘贴或点击选择 |
| 区域识别 | 鼠标拖拽选取局部区域，支持移动端触控 |
| 多语言 OCR | 简体中文、繁体中文、英文、中英混合 |
| 图像预处理 | 旋转、缩放、亮度/对比度调节、灰度化 |
| 批量识别 | 多图并行识别（可调并发数），独立进度条 |
| 结果编辑 | 支持编辑、查找、全选、复制、清空 |
| 导出功能 | TXT、Markdown、JSON 三种格式 |
| 历史记录 | 本地 IndexedDB 保存最近识别结果，支持查看、删除、恢复 |
| 隐私安全 | 所有图片和文字**仅在浏览器本地处理**，不上传服务器 |

---

## 在线演示

<https://snaptext.iiiiiiiiiiiiiKK.pages.dev/>

> 演示站点托管在 Cloudflare Pages，使用 GitHub Actions 自动构建部署。

---

## 技术架构

```
SnapText
├── 前端框架       React 18 + TypeScript
├── 构建工具       Vite 5
├── 样式方案       Tailwind CSS (官方组件未使用)
├── OCR 引擎       Tesseract.js 7.x
│   ├── 语言模型    来自 @tesseract.js-data 官方 CDN
│   │   └── 支持   chi_sim (简), chi_tra (繁), eng 英文
├── 工作线程       Web Worker (不阻塞主线程)
├── 本地存储       IndexedDB (历史记录/缩略图)
├── 单元/集成测试  Vitest + Jsdom
└── 端到端测试     Playwright (Chromium/Mobile)
```

### 依赖许可证

| 依赖 | 版本 | 许可证 |
|------|------|--------|
| react | 18.x | MIT |
| vitet.js | 7.x | Apache-2.0 |
| @tesseract.js-data/* | 1.x | Apache-2.0 |
| tailwindcss | 3.x | MIT |

---

## 本地开发

### 环境准备

- [Node.js 18+](https://nodejs.org/) (推荐使用 LTS 版本)
- [pnpm](https://pnpm.io/) (或 npm/yarn)

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

### 开发模式

```bash
# 启动开发服务器
pnpm dev

# 打开浏览器访问 http://localhost:5173
```

### 测试

```bash
# 单元测试
pnpm test

# 端到端测试
pnpm test:e2e

# 仅运行桌面 Chrome 测试
pnpm test:e2e -- --project=desktop-chromium
```

### 构建

```bash
# 生产构建
pnpm build

# 输出在 dist/ 目录
```

---

## 配置文件

### `.env.example`

```bash
# 当前版本为纯前端应用，无后端 API 需配置
# 如有需要，可在此添加自定义配置变量
BASE_PATH=/snaptext/        # 部署至 GitHub Pages 时使用
```

---

## 部署指南

### 1. GitHub Actions 自动部署

本项目已配置 GitHub Actions 自动构建和部署：

- **构建脚本** `npm run build`
- **输出目录** `dist/`
- **部署方式** Cloudflare Pages

### 2. 手动部署到 GitHub Pages

```bash
# 在仓库 Settings -> Pages 中配置
# 部署源：GitHub Actions
# 自定义根路径：/snaptext/ （如有）
```

### 3. 手动部署到 Cloudflare Pages

1. 将代码推送到 GitHub 仓库
2. 在 Cloudflare Pages 创建新项目
3. 连接 GitHub 仓库 `iiiiiiiiiiiiiKK/snaptext`
4. 配置：
   - Build command: `npm run build`
   - Build directory: `dist`
   - Root path (如需子目录): `/snaptext`

### 4. 预览模式

```bash
# 本地预览（用于测试 GitHub Pages 部署配置）
pnpm preview --port 4173
```

---

## 项目结构

```
snaptext/
├── src/
│   ├── App.tsx           # 主应用入口
│   ├── main.tsx          # React 客户端挂载
│   ├── i18n/             # 国际化配置 (中英文)
│   ├── lib/              # 工具函数
│   │   ├── export.ts     # 导出功能
│   │   ├── fileValidation.ts  # 文件校验
│   │   ├── geometry.ts   # 坐标换算
│   │   ├── history.ts    # 历史记录 store
│   │   ├── ocrEngine.ts  # Tesseract 封装
│   │   └── text.ts       # 文本统计
│   ├── components/       # 业务组件
│   │   ├── TopBar.tsx
│   │   ├── UploadPanel.tsx
│   │   ├── ImageWorkspace.tsx
│   │   ├── ResultEditor.tsx
│   │   ├── TaskList.tsx
│   │   ├── HistoryPanel.tsx
│   │   └── Dialogs.tsx   # 设置/隐私对话框
│   ├── state/            # Redux 风格 state 管理
│   └── test/             # Vitest 单元测试
├── e2e/                  # Playwright 集成测试
├── public/               # 静态资源
├── scripts/              # 工具脚本
│   └── make-fixtures.mjs # 生成测试图片
├── dist/                 # 构建输出 (gitignore)
└── .github/
    └── workflows/        # CI/CD 工作流
```

---

## 隐私说明

**SnapText 严格遵循隐私原则：**

- ✅ 所有图片在浏览器本地解码和识别，不上传服务器
- ✅ 不接入广告网络、分析 SDK 或埋点脚本
- ✅ 不在控制台输出用户图片内容
- ✅ 识别结果和缩略图仅保存在本浏览器的 IndexedDB 中
- ✅ 首次使用时会从公共 CDN 下载 Tesseract 语言模型（此请求不包含你的图片）

---

## 已知限制

1. **模型加载**：首次使用 OCR 功能需要下载语言模型 (~10-20 MB)，首次识别会稍慢
2. **移动端**：iOS Safari 支持 Web Worker 和 WebAssembly，功能完整；部分旧版浏览器可能不支持
3. **内存限制**：单张大图片 (>30 MB) 会被拒绝，建议提前压缩；大量大图时请留意内存
4. **TIFF 格式**：现代浏览器不支持在浏览器中解码 TIFF，已自动过滤

---

## 与作者联系

- **Twitter/X**: [https://x.com/0xkillcoin](https://x.com/0xkillcoin) — 关注我获取最新动态
- **GitHub**: [iiiiiiiiiiiiiKK](https://github.com/iiiiiiiiiiiiiKK)

---

## 许可证

MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), ...
```

---

## 贡献指南

欢迎通过 GitHub Issues 报告 bug 或提出想法。若想贡献代码：

1. Fork 项目
2. 创建特性分支 `git checkout -b feature/your-feature`
3. 提交 PR 并填写描述

---

## 更新日志

见 [GitHub Releases](https://github.com/iiiiiiiiiiiiiKK/snaptext/releases) 获取最新版本说明。