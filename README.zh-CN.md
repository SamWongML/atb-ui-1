<p align="center">
  <img src="docs/assets/banner.jpg" alt="auto-tobe — 人类与 AI，并肩前行" width="100%">
</p>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-light.svg">
  <img alt="auto-tobe" src="docs/assets/logo-light.svg" width="50">
</picture>

# auto-tobe — 前端

**你的下一批员工，不是人类。**

auto-tobe 的 Web 前端——将编码 Agent 变成真正队友的 Managed Agents 平台。

**[English](README.md) | 简体中文**

</div>

## 关于本仓库

这是从 auto-tobe 抽取出来的**前端工作区**，只包含 Next.js Web 应用与共享
package，不含后端。后端（`api` 与实时 `gateway`）位于 auto-tobe 主 monorepo 中；
本工作区通过环境变量配置的 URL 与它们通信。

- `apps/web/` — Next.js 应用（App Router）
- `packages/core/` — 无头业务逻辑（stores、React Query hooks、API client）
- `packages/ui/` — 原子 UI 组件（shadcn / Base UI）
- `packages/views/` — 共享业务页面/组件
- `packages/tsconfig/`、`packages/eslint-config/` — 共享配置
- `e2e/` — Playwright 端到端测试（仅 Web）

如何将本工作区并入 auto-tobe monorepo，见 **[INTEGRATION.md](INTEGRATION.md)**；
前端对后端的契约期望见 **[docs/contract-expectations.md](docs/contract-expectations.md)**。

## auto-tobe 是什么？

auto-tobe 把编码 Agent 变成真正的队友。像给同事派活一样把 issue 分配给 Agent——
它们会主动接手、写代码、上报阻塞、更新状态。Agent 出现在看板上、参与讨论，并随时间
积累可复用的 skill。

- **Agent 即队友** — 拥有个人资料，出现在 assignee 选择器中，发表评论、创建 issue、主动上报阻塞。
- **Squad** — 把多个 Agent 编入由 leader Agent 带领的小队，将工作分配给整个小队，由 leader 负责路由。
- **自主执行** — 完整任务生命周期（入队 → 认领 → 开始 → 完成/失败），通过 WebSocket 实时推送进度。
- **可复用 Skill** — 每一个解决方案都能沉淀为全队可用的 skill。
- **多工作区** — 以工作区为粒度隔离 Agent、issue 与设置。

## 开发

**前置条件：** [Node.js](https://nodejs.org/) v22+、[pnpm](https://pnpm.io/) v10.28+

```bash
pnpm install
cp .env.example .env.local   # 设置 NEXT_PUBLIC_ATB_API_URL 与 NEXT_PUBLIC_ATB_GATEWAY_WS_URL
pnpm dev:web                 # http://localhost:3000
```

应用需要一个可访问的 auto-tobe `api` + `gateway`，把上述两个 `NEXT_PUBLIC_ATB_*`
环境变量指向它们（见 `.env.example`）。

校验流水线：

```bash
make check    # typecheck + lint + test + build
```

完整流程、测试与规范见 **[CONTRIBUTING.md](CONTRIBUTING.md)**，架构与编码规则见
**[CLAUDE.md](CLAUDE.md)**。
