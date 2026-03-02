# AITutor - 智能学习分析与推进系统

面向中学生的基于AI的学习情况分析和推进系统。

## 功能特性

- **AI 辅导** - 智能对话式辅导，采用苏格拉底式教学法引导学生思考
- **学习诊断** - 基于练习数据生成个性化学习分析报告
- **个性化学习** - 根据学生水平推荐学习内容和练习题
- **多学科支持** - 数学、物理、化学、英语等中学主要科目

## 技术栈

- **前端**: Next.js 15, React 19, Tailwind CSS
- **后端**: Next.js API Routes, Prisma ORM
- **数据库**: PostgreSQL (可选，当前使用模拟数据)
- **AI模型**: 可配置 (支持 DeepSeek / 通义千问 / OpenAI / Claude)

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 AI 模型

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，选择并配置 AI 提供商：

```env
# 选择 AI 提供商: deepseek | dashscope | openai | anthropic
AI_PROVIDER=deepseek

# DeepSeek 配置（推荐，性价比高）
DEEPSEEK_API_KEY=sk-your-api-key-here

# 通义千问配置
# DASHSCOPE_API_KEY=sk-your-api-key-here

# OpenAI 配置
# OPENAI_API_KEY=sk-your-api-key-here

# Claude 配置
# ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

> **提示**: 系统会根据 `AI_PROVIDER` 环境变量自动选择对应的模型。可在运行时通过 `GET /api/config` 检查配置状态。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000，将直接进入 Dashboard。

### 5. （可选）配置数据库

如需使用完整的数据持久化功能：

```bash
# 1. 安装 PostgreSQL 14+

# 2. 配置数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/aitutor"

# 3. 初始化数据库
npx prisma generate
npx prisma db push
```

## AI 模型配置

### 支持的提供商

| 提供商 | 环境变量值 | 获取 API Key |
|--------|-----------|-------------|
| DeepSeek | `deepseek` | https://platform.deepseek.com/ |
| 通义千问 | `dashscope` | https://dashscope.aliyuncs.com/ |
| OpenAI | `openai` | https://platform.openai.com/ |
| Claude | `anthropic` | https://console.anthropic.com/ |

### 切换提供商

只需修改 `.env` 文件中的 `AI_PROVIDER` 和对应的 API Key：

```env
# 从 DeepSeek 切换到 OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
```

重启服务后即可生效。

### 检查配置状态

运行时访问 `/api/config` 查看当前配置：

```bash
curl http://localhost:3000/api/config
```

## 项目结构

```
AITutor/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # 主应用页面
│   │   ├── dashboard/     # 学习概览
│   │   ├── tutor/         # AI辅导
│   │   ├── analysis/      # 学习诊断
│   │   └── learning/      # 个性化学习
│   └── api/               # API路由
│       ├── chat/          # AI对话接口
│       ├── config/        # AI配置状态接口
│       ├── analysis/      # 学习分析接口
│       └── recommendations/ # 推荐接口
├── components/            # React组件
│   └── ui/               # UI组件
├── lib/                  # 工具库
│   └── ai/              # AI调用模块（支持多提供商）
├── prisma/              # 数据库模型
└── types/               # TypeScript类型
```

## API 接口

### POST /api/chat
AI 对话接口

```json
{
  "message": "如何解二次方程？",
  "subject": "数学",
  "history": [...]
}
```

### GET /api/config
检查 AI 配置状态

### GET /api/analysis
获取学习分析数据

参数：`subject` - 科目（可选）

### GET /api/recommendations
获取个性化推荐

参数：`subject` - 科目（可选），`limit` - 返回数量（默认5）

## 开发计划

- [x] 基础框架搭建
- [x] UI组件库集成
- [x] 数据库模型设计
- [x] AI对话功能
- [x] 学习分析模块
- [x] 个性化学习模块
- [x] 简化版本（无需登录）
- [x] 多 AI 提供商支持
- [ ] RAG 检索增强
- [ ] 向量数据库集成
- [ ] 题库数据导入
- [ ] 学习报告导出

## 许可证

MIT
