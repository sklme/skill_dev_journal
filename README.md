# @iskl/dev-journal

> 写完代码 → 一键生成结构化的开发日志（Dev Journal）到 `<project>/.journal/`。

[![npm version](https://img.shields.io/npm/v/@iskl/dev-journal.svg)](https://npmjs.com/package/@iskl/dev-journal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Agent Skills](https://img.shields.io/badge/agentskills.io-compatible-blueviolet)](https://agentskills.io/)

一个跨平台的 [Agent Skill](https://agentskills.io/)：当你完成一段编码后，让 AI 自动把"这次到底改了什么、为什么这么改、对协作方有什么影响、还有哪些坑"沉淀成一份给后人看的 markdown。

兼容 **Claude Code · Cursor · Gemini CLI · Codex CLI · OpenCode · GitHub Copilot**。

---

## ✨ 它是什么

不是工具，是 **Skill**。安装后，你的 AI 编程助手会多一项能力：

> 你：「把这次的修改 journal 一下」
> AI（自动按 dev-journal 流程执行）：
> 1. 收集工作区改动、对话上下文、与主分支的独有提交
> 2. 不确定的部分主动跟你确认
> 3. 按 **四段式** 模板生成 journal
> 4. 写到 `<project>/.journal/2026-05-12-修复登录态过期边界.md`

四段式 = **修改总结** · **给后人快速理解** · **给协作方（接口/数据契约）** · **Review（潜在问题与优化）**。

## 📦 安装

本 skill 同时兼容**三套**主流安装方式，任选其一：

### 方式 1：内置 CLI（来自 npm）

```bash
# 一次性
npx @iskl/dev-journal install

# 或全局安装后显式指定
npm install -g @iskl/dev-journal
dev-journal install --agent cursor --scope project
dev-journal install --agent claude --scope user
dev-journal install --agent all --scope user
```

交互模式会自动检测已存在的 Agent 目录。

### 方式 2：[`vercel-labs/skills`](https://github.com/vercel-labs/skills)（生态最大，18k stars）

```bash
# 直接从 GitHub 仓库拉取（无需 npm 包）
npx skills add iskl/skill_dev_journal

# 装到全局
npx skills add iskl/skill_dev_journal -g

# 装到指定 Agent
npx skills add iskl/skill_dev_journal -a cursor -a claude-code

# 列出仓库内的可用 skill
npx skills add iskl/skill_dev_journal --list
```

vercel-labs CLI 支持 50+ 个 Agent，项目级默认装到统一的 `.agents/skills/` 目录。

### 方式 3：[`agent-skill-porter`](https://www.npmjs.com/package/agent-skill-porter)（`sk add`）

```bash
pnpm add -g agent-skill-porter
sk add https://github.com/iskl/skill_dev_journal
```

支持跨 Agent 格式转换 + `--min-age` 版本钉选。

### 本地开发 / 联调

```bash
# 用 symlink 而不是复制，便于实时改 SKILL.md 调试
dev-journal install --agent cursor --link
```

## 🚀 使用

安装完之后，**直接在 AI 编程工具里对话**：

- 「写 journal」
- 「总结这次修改并生成日志」
- 「journal 这次改动」
- 「记录本次变更」
- 「合并前帮我整理一份开发日志」

skill 会自动按 4 步流程跑：收集信息 → 确认不确定项 → 生成 → 写文件。

### 输出位置

`<project_root>/.journal/{YYYY-MM-DD}-{summary}.md`

例如：

```
.journal/
├── 2026-05-10-引入新的状态管理.md
├── 2026-05-11-1430-修复时区显示错乱.md
└── 2026-05-12-修复登录态过期边界.md
```

> 💡 同一天多次写入会自动追加时分（`-HHmm`）避免冲突。

### 信息源

skill 会按优先级合并以下来源：

| 来源 | 是否自动 | 说明 |
|------|----------|------|
| 工作区改动 | ✅ | `git status` / `git diff` |
| 当前会话上下文 | ✅ | 利用对话中讨论过的设计、权衡、bug 复现 |
| 与主分支独有的提交 | ✅ | 自动检测 `main`/`master`/`develop`/`trunk` 作为 base |
| 用户提供的 commits | 按需 | 你显式给出 hash 列表则优先采用 |

> **何时会问你**：检测不到 base 分支 / 工作区干净又没给 commits / 出现破坏性变更但无法判断是否对外 / summary 候选 2-3 个之间难以决断 时，会主动询问。

## 📖 完整输出示例

```markdown
# 修复登录态过期后接口 401 重试死循环

**日期**：2026-05-12
**作者**：iskl
**分支**：fix/login-loop → main
**涉及提交**：a1b2c3d, e4f5g6h
**涉及文件数**：5（+0 / ~5 / -0）

---

## 一、本次修改总结

- **背景**：用户反馈登录态过期后部分接口无限重试导致前端卡死。
- **根因**：`request.ts` 的 401 拦截器在刷新 token 失败后没清空重试队列。
- **修改**：
  - `src/utils/request.ts`：刷新失败时立刻 reject 等待队列
  - `src/utils/auth.ts`：抽出 `clearTokenAndRedirect` 公共方法

## 二、给后人快速理解

- 拦截器核心是 **"刷新中-排队-完成后统一放行"** 模型
- 关键概念：`pendingQueue`、`isRefreshing` 互斥锁
- 已知限制：refresh 接口本身 401 时会再重试 1 次（处理时钟漂移）

## 三、给协作方

| 接口 | 方法 | 变更类型 | 兼容性 |
|------|------|----------|--------|
| `/auth/refresh` | POST | 行为变更（错误码 401→403） | 破坏性 |

**调用示例**

…（省略）

## 四、Review

- **潜在问题**
  - [x] 边界：`pendingQueue` 在页面卸载时未清理（已修复）
  - [ ] 并发：多个 tab 同时刷新仍可能产生竞争（待统一 BroadcastChannel）
- **测试盲区**：缺少 "refresh 接口超时" 的 e2e 用例
- **短期优化**：把 token 刷新迁移到 Service Worker
```

## 🧩 兼容性矩阵

| Agent | 项目级目录 | 用户级目录 |
|-------|-----------|-----------|
| Claude Code | `.claude/skills/dev-journal/` | `~/.claude/skills/dev-journal/` |
| Cursor | `.cursor/skills/dev-journal/` | `~/.cursor/skills/dev-journal/` |
| Gemini CLI | `.gemini/skills/dev-journal/` | `~/.gemini/skills/dev-journal/` |
| Codex CLI | `.codex/skills/dev-journal/` | `~/.codex/skills/dev-journal/` |
| OpenCode | `.config/opencode/skills/dev-journal/` | `~/.config/opencode/skills/dev-journal/` |
| GitHub Copilot | `.copilot/skills/dev-journal/` | `~/.copilot/skills/dev-journal/` |

> 本 skill 仅使用通用字段 `name` / `description`，不依赖任何 Agent 专属字段，所以可以**无损地**跨平台部署。

## 🛠️ CLI 参考

```text
dev-journal <command> [options]

Commands
  install              将 skill 复制到目标 Agent 目录（默认）
  uninstall            从目标 Agent 目录移除 skill
  list                 列出当前已安装本 skill 的位置
  print                打印 SKILL.md 到 stdout

Options
  --agent <name>       claude | cursor | gemini | codex | opencode | copilot | all
  --scope <name>       project | user            (default: project)
  --link               创建 symlink 代替复制
  --force, -f          目标已存在时直接覆盖
  --dry-run, -n        预览操作但不写入
  --yes, -y            非交互模式（所有 prompt 默认 yes）
  --help, -h
  --version, -v
```

## 🤝 与其他工具的协作

- **`vercel-labs/skills`** / **`agent-skill-porter`**：本 skill 仓库**已经**兼容它们的发现约定（`skills/<name>/SKILL.md` + 合法 frontmatter），用户可以选用任意一个 CLI 安装。
- **`conventional commits` / CHANGELOG**：journal 关注"为什么 + 给谁看"，CHANGELOG 关注"发了什么"，互补不替代。

## ❓ FAQ

**Q：跟 git commit message 有什么不同？**
A：commit message 颗粒度细、面向版本控制；journal 颗粒度粗、面向**理解和协作**。一个 journal 通常覆盖一个完整的特性 / 修复。

**Q：可以让它自动 `git commit` 吗？**
A：不会。dev-journal 只写 `.journal/` 下的文件，绝不动你的代码或 git 状态。

**Q：`.journal/` 要不要 commit 到仓库？**
A：建议 commit。journal 是给团队和后人看的文档，跟代码一起演进。

**Q：能改模板吗？**
A：可以。编辑 `<安装目录>/templates/journal-template.md`，或者 fork 本仓库改 `skills/dev-journal/`。

## 🧪 本地开发

```bash
git clone https://github.com/iskl/skill_dev_journal.git
cd skill_dev_journal

# 用本地版本试装
node ./bin/install.mjs install --agent cursor --scope project --dry-run

# 发布前打包预览
npm pack
```

## 🚀 发布到 npm

仓库内置 [`.github/workflows/release.yml`](./.github/workflows/release.yml)，**push 形如 `v*` 的 tag 即自动发布**：

```bash
# 1. bump 版本（package.json 必须改成对应版本）
npm version 0.2.0           # 或 patch / minor / major

# 2. push 代码 + tag
git push && git push --tags

# 3. 去 GitHub Actions 看进度，发布成功后 npm 站点会同步可见
```

workflow 会自动：
- 校验 tag 版本 与 `package.json` 一致
- 校验该版本未发布过
- 跑 CLI smoke test（install + uninstall round-trip）
- 跑 `npm publish --provenance`（带来源证书）
- 预发布版本（含 `-alpha` / `-beta` / `-rc`）自动发到 `next` dist-tag，正式版发到 `latest`

### 鉴权配置（二选一，或两个都配）

workflow 支持 **OIDC Trusted Publishing**（推荐） 和 **NPM_TOKEN** 双方案，**只要任一可用就能发**。

#### 方案 A：OIDC Trusted Publishing（推荐，零 secret）

> 前置：包必须已存在于 npm（即至少手动发布过 1 次）

1. 在本地手动发首个版本：
   ```bash
   npm login
   npm publish --access public --provenance
   ```
2. 打开 [npmjs.com](https://www.npmjs.com/package/@iskl/dev-journal) → 你的包 → **Settings** → **Publishing access**
3. 点 **Add trusted publisher**，填：
   - Publisher: **GitHub Actions**
   - Organization or user: `iskl`
   - Repository: `skill_dev_journal`
   - Workflow filename: `release.yml`
   - Environment name: （留空即可，可选）
4. 保存。**不需要在 GitHub 配任何 secret**
5. 之后 push tag → workflow 自动用 OIDC 发布，npm 页面会显示 ✅ "Built and signed on GitHub Actions"

#### 方案 B：NPM_TOKEN（简单直接，首发也走 CI）

1. 打开 [npmjs.com](https://www.npmjs.com/) → 头像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**
   - Token name: `dev-journal-ci`
   - Expiration: 1 year（到期前记得轮换）
   - Permissions: **Read and write**
   - Packages and scopes: 选 `@iskl/dev-journal`（或整个 `@iskl/*`）
2. 复制 token（只显示一次）
3. 打开 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `NPM_TOKEN`
   - Secret: 粘贴 token
4. 完成。之后 push tag → workflow 用 token 发布

#### 两个都配？

workflow 会优先用 `NPM_TOKEN`（若已配置 secret），删掉 secret 后自动回退到 OIDC。

> 建议长期跑 OIDC：删 `NPM_TOKEN` secret，干净、零维护、自带 provenance 徽章。

### 发预发布版本

```bash
npm version 0.2.0-beta.1
git push && git push --tags
# → 自动发到 npm dist-tag=next
# 用户安装：npx @iskl/dev-journal@next install
```

## 📝 License

[MIT](./LICENSE)
