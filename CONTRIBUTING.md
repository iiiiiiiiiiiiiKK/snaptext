# CONTRIBUTING

Thanks for your interest in contributing to SnapText!

## 开发方式

### Prerequisites

- Node.js 18.x 或更高版本
- pnpm (推荐) 或 npm

### Setup

```bash
# 1. 克隆仓库
git clone https://github.com/iiiiiiiiiiiiiKK/snaptext.git
cd snaptext

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```

## Development

```bash
# 单元测试
pnpm test

# 端到端测试
pnpm test:e2e

# 生产构建
pnpm build

# Lint
pnpm lint
```

## Pull Request 流程

1. Fork 本仓库
2. 创建特性分支 `git checkout -b feature/your-feature`
3. 提交 PR 并填写清晰的描述
4. 确保 CI 通过

## 编码规范

- 遵循 TypeScript 类型约束
- 使用 ESLint 格式化代码
- 新增功能请附上测试
- 提交前运行 `pnpm lint` 和 `pnpm test`

## 本机运行

```bash
# 本地预览
pnpm preview

# 模拟 GitHub Pages 部署 (4173 端口)
pnpm preview --port 4173
```