/**
 * 试卷解析 Skill 模块
 *
 * 双接口架构设计：
 * 1. 核心逻辑层 (core.ts) - 不依赖任何框架，可独立运行
 * 2. Claude Code Skill 适配器 (skill-adapter.ts) - 本地开发环境
 * 3. API 路由适配器 (api-adapter.ts) - 服务器部署
 *
 * @module lib/skills/parse-exam
 */

// 导出核心功能
export { parseExamImage } from "./core"
export type { ParseExamInput, ParseExamResult } from "./core"

// 导出 API 适配器
export { handleParseExamPost, handleBatchParse } from "./api-adapter"

// 导出 Skill 定义
export { skill as parseExamSkill } from "./skill-adapter"

// 文档
export const README = `
# 试卷解析 Skill 模块

## 架构设计

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     试卷解析 Skill 模块                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Claude Code  │    │ Next.js API   │    │   核心       │   │
│  │   Skill      │    │   Route       │    │   逻辑       │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │             │
│         └───────────────────┴───────────────────┘             │
│                               │                             │
│                         ┌───────┴────────┐                │
│                         │   AI 服务        │                │
│                         │ (通义千问等)     │                │
│                         └──────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## 使用方式

### 方式 1：Claude Code Skill（本地开发）

\`\`\`bash
# 通过命令行调用
/parse-exam --file "./试卷.jpg"

# 通过右键菜单
右键点击图片 → Claude Code → 解析试卷
\`\`\`

### 方式 2：Next.js API Route（服务器部署）

\`\`\`typescript
// app/api/exam/parse/route.ts
import { handleParseExamPost } from "@/lib/skills/parse-exam/api-adapter"

export async function POST(request: NextRequest) {
  return handleParseExamPost(request)
}
\`\`\`

### 方式 3：直接调用核心逻辑（代码复用）

\`\`\`typescript
import { parseExamImage } from "@/lib/skills/parse-exam"

const result = await parseExamImage({
  image: { data: "data:image/jpeg;base64,...", ... },
  subject: "数学",
  userId: "user-1"
})
\`\`\`

## 部署说明

### 当前架构（推荐）
\`\`\`
┌─────────────────────┐
│  Next.js 服务器      │
│  ├─ API Routes      │  ← 使用 api-adapter
│  ├─ 静态页面         │
│  └─ AI 调用         │
└─────────────────────┘
\`\`\`

- Skill 仅用于本地开发调试
- 服务器使用 API 路由
- 核心逻辑在 core.ts 中共享

### 未来架构（可选）
\`\`\`
┌──────────────┐      ┌──────────────┐
│  前端应用     │      │  解析服务     │
│  (Next.js)    │ ───→  │  (独立部署)   │
│              │ HTTP  │              │
└──────────────┘      └──────────────┘
\`\`\`

- 将解析能力拆分为独立微服务
- 通过 HTTP API 调用
- 支持水平扩展

## 文件结构

\`\`\`
lib/skills/parse-exam/
├── index.ts          # 模块导出
├── core.ts           # 核心解析逻辑 ⭐
├── api-adapter.ts    # API 路由适配器
├── skill-adapter.ts  # Claude Code Skill 适配器
├── prompts.ts        # 提示词管理（TODO）
└── README.md         # 文档
\`\`\`

## 依赖关系

\`\`\`
core.ts
  ├─ @/lib/ai/llm           # AI 调用
  ├─ @/lib/image-utils     # 图像处理
  ├─ @/lib/subject-utils    # 学科匹配
  └─ @/lib/storage         # 数据存储

api-adapter.ts
  └─ core.ts

skill-adapter.ts
  └─ core.ts
\`\`\`

## 优势

1. **模块化** - 核心逻辑独立，易于维护和测试
2. **双接口** - 同时支持本地和服务器环境
3. **可复用** - 可以在任何地方调用核心解析能力
4. **可扩展** - 未来可以轻松添加新的调用方式
5. **易部署** - 与应用一起打包，无需额外配置
`
