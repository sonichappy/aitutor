# Deep Research 学科分析智能体设计文档

## 文档信息

- **版本**: v1.0
- **创建日期**: 2026-03-10
- **作者**: AI 导师项目组
- **智能体类型**: Deep Research Agent

---

## 目录

1. [概述](#1-概述)
2. [智能体架构](#2-智能体架构)
3. [核心能力](#3-核心能力)
4. [思维链设计](#4-思维链设计)
5. [工具系统](#5-工具系统)
6. [工作流引擎](#6-工作流引擎)
7. [记忆系统](#7-记忆系统)
8. [提示词工程](#8-提示词工程)
9. [实施计划](#9-实施计划)

---

## 1. 概述

### 1.1 什么是 Deep Research 智能体

Deep Research 智能体是一种能够**自主规划、多步推理、动态调整**的 AI 系统。与传统基于规则的分析系统不同，它：

```
传统系统                      Deep Research 智能体
┌─────────────┐              ┌───────────────────────────┐
│  输入数据   │              │  🧠 大语言模型核心         │
└──────┬──────┘              │  ┌─────────────────────┐  │
       │                      │  │  思维规划器         │  │
       v                      │  │  - 任务分解          │  │
┌─────────────┐              │  │  - 策略选择          │  │
│  固定算法   │              │  │  - 自我反思          │  │
└──────┬──────┘              │  └─────────────────────┘  │
       │                      │              │            │
       v                      │              v            │
┌─────────────┐              │  ┌─────────────────────┐  │
│  输出结果   │              │  │  工具调用层          │  │
└─────────────┘              │  │  - 数据查询          │  │
                              │  │  - 分析计算          │  │
                              │  │  - 知识检索          │  │
                              │  └─────────────────────┘  │
                              │              │            │
                              │              v            │
                              │  ┌─────────────────────┐  │
                              │  │  记忆系统            │  │
                              │  │  - 短期记忆          │  │
                              │  │  - 长期记忆          │  │
                              │  │  - 知识库            │  │
                              │  └─────────────────────┘  │
                              └───────────────────────────┘
```

### 1.2 核心特征

| 特征 | 描述 | 示例 |
|------|------|------|
| **自主规划** | 能够制定研究计划并动态调整 | "先分析错题模式，再对比历史，最后生成计划" |
| **多步推理** | 进行链式思考，逐步深入 | "错误率高 → 查看错题 → 发现定理问题 → 推荐记忆策略" |
| **工具调用** | 自主选择和使用工具 | 决定何时需要查询教学大纲、知识图谱 |
| **自我验证** | 检查自身结论的可靠性 | "我的分析有足够数据支撑吗？让我验证一下" |
| **迭代优化** | 根据反馈不断改进 | "之前的建议太笼统，让我更具体一些" |

### 1.3 应用场景

```
┌─────────────────────────────────────────────────────────────────┐
│                     学科分析 Deep Research Agent                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 学习诊断            💡 问题溯源              🎯 方案设计      │
│  - 整体水平评估         - 为什么会错？          - 如何改进？      │
│  - 优势劣势识别         - 根本原因是什么？      - 具体怎么做？    │
│  - 进退步判断           - 是知识问题还是       - 优先级排序      │
│                        - 能力问题？            - 时间安排        │
│                                                                  │
│  🔍 深度分析            📚 知识检索              📈 趋势预测      │
│  - 知识点关联分析       - 教学大纲查询          - 学习曲线预测    │
│  - 错误模式挖掘         - 知识图谱探索          - 潜在风险预警    │
│  - 认知瓶颈识别         - 典型错题参考          - 目标设定建议    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 智能体架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Deep Research 智能体系统                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        用户交互层                                  │ │
│  │  • 自然语言对话                                                    │ │
│  │  • 结构化查询                                                      │ │
│  │  • 可视化展示                                                      │ │
│  └────────────────────────────────┬──────────────────────────────────┘ │
│                                   │                                     │
│  ┌────────────────────────────────▼──────────────────────────────────┐ │
│  │                      Agent Orchestrator                            │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                     思维规划器 (Planner)                      │  │ │
│  │  │  • 任务理解与分解    • 策略制定     • 动态调整               │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                     推理引擎 (Reasoner)                       │  │ │
│  │  │  • 多步链式推理       • 逻辑验证     • 结论评估              │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                     反思器 (Reflector)                       │  │ │
│  │  │  • 自我检查           • 质量评估     • 改进建议              │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────┬──────────────────────────────────┘ │
│                                   │                                     │
│  ┌────────────────────────────────▼──────────────────────────────────┐ │
│  │                        工具层 (Tools)                              │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │ │
│  │  │数据查询工具│ │分析计算工具│ │知识检索工具│ │计划生成工具│          │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                   │                                     │
│  ┌────────────────────────────────▼──────────────────────────────────┐ │
│  │                        记忆系统 (Memory)                            │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │ │
│  │  │短期记忆    │ │长期记忆    │ │知识图谱    │ │案例库      │          │ │
│  │  │(当前会话) │ │(历史数据) │ │(学科知识) │ │(典型问题) │          │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户请求
    │
    v
┌───────────────┐
│  任务理解      │  ← 解析用户意图，识别分析目标
└───────┬───────┘
        │
        v
┌───────────────┐
│  初始规划      │  ← 制定研究计划，分解任务
└───────┬───────┘
        │
        v
┌───────────────────────────────────────┐
│  执行-反思循环 (Execute-Reflect)      │
│  ┌─────────┐    ┌─────────┐           │
│  │ 执行步骤 │ -> │ 自我反思 │           │
│  └────┬────┘    └────┬────┘           │
│       │              │                 │
│       v              v                 │
│  ┌─────────┐    ┌─────────┐           │
│  │ 工具调用 │    │ 质量检查 │           │
│  └────┬────┘    └────┬────┘           │
│       │              │                 │
│       └───────┬──────┘                 │
│               │                        │
│         ┌─────▼─────┐                  │
│         │ 需要调整？ │ ───No──→ ┌──────┴──────┐
│         └───────────┘            │ 生成最终报告 │
│               │Yes                └─────────────┘
│               v
│         ┌───────────┐
│         │ 重新规划   │
│         └───────────┘
└───────────────────────────────────────┘
```

### 2.3 核心组件

#### 2.3.1 Planner (思维规划器)

负责将复杂任务分解为可执行的步骤：

```typescript
interface ResearchPlan {
  objective: string              // 研究目标
  steps: ResearchStep[]         // 研究步骤
  currentStep: number           // 当前步骤
  status: 'planning' | 'executing' | 'reviewing' | 'completed'
}

interface ResearchStep {
  id: string
  description: string           // 步骤描述
  action: string                // 动作类型
  tools: string[]               // 需要的工具
  expectedOutput: string        // 预期输出
  dependencies: string[]        // 依赖的步骤
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
}
```

#### 2.3.2 Reasoner (推理引擎)

执行多步推理，生成思维链：

```typescript
interface ReasoningChain {
  steps: ReasoningStep[]
  conclusion: string
  confidence: number
}

interface ReasoningStep {
  thought: string               // 思考内容
  action: string                // 采取的行动
  observation: string           // 观察到的结果
  nextThought?: string          // 下一步思考
}
```

#### 2.3.3 Reflector (反思器)

对推理过程和结论进行自我评估：

```typescript
interface Reflection {
  quality: 'high' | 'medium' | 'low'
  confidence: number
  concerns: string[]            // 关注点/疑虑
  improvements: string[]        // 改进建议
  nextActions: string[]         // 下一步行动
}
```

---

## 3. 核心能力

### 3.1 自主研究能力

#### 3.1.1 研究路径规划

智能体能够自主制定研究计划：

```
用户: "帮我分析一下我的几何学习情况"

智能体内部规划:
┌─────────────────────────────────────────────────────────────┐
│ Step 1: 理解任务                                           │
│   - 用户想要分析几何学科的学习状况                          │
│   - 需要全面评估：当前水平、问题、建议                       │
│                                                             │
│ Step 2: 规划研究路径                                       │
│   2.1 收集数据: 获取所有几何试卷和错题数据                  │
│   2.2 初步分析: 计算基础统计（正确率、趋势）                │
│   2.3 深度分析:                                            │
│       - 识别错题模式                                       │
│       - 分析知识关联                                       │
│       - 对比历史报告                                       │
│   2.4 知识检索: 查询几何教学大纲和知识图谱                  │
│   2.5 问题诊断: 分析错误根因                               │
│   2.6 方案设计: 生成针对性改进计划                          │
│   2.7 自我验证: 检查结论可靠性                             │
│                                                             │
│ Step 3: 执行研究 (动态调整)                                │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.2 动态调整策略

智能体能够根据研究发现调整研究方向：

```typescript
// 示例：发现新的研究重点
if (发现某知识点错误率异常高) {
  添加研究步骤: "深入分析该知识点的具体错误类型";
  查询知识库: "该知识点的常见错误和教学重点";
  调整建议: "优先解决该知识点问题";
}

if (数据量不足) {
  标记限制: "数据不足，结论可靠性有限";
  降低置信度: "建议收集更多数据后再分析";
  调整输出: "基于有限数据的初步分析";
}
```

### 3.2 多步推理能力

#### 3.2.1 链式推理示例

```
问题: 为什么学生"圆的性质"错误率高？

推理链:
┌─────────────────────────────────────────────────────────────┐
│ Thought 1: 学生在"圆的性质"上错误率75%，需要深入分析      │
│                                                             │
│ Action 1: 查询该知识点的具体错题                           │
│                                                             │
│ Observation 1: 发现10道错题中，有7道涉及"圆心角和圆周角"   │
│                                                             │
│ Thought 2: 错误集中在"圆心角和圆周角"关系上               │
│                                                             │
│ Action 2: 分析这些错题的学生答案                           │
│                                                             │
│ Observation 2: 学生经常混淆"同弧所对圆心角是圆周角的两倍"  │
│                                                             │
│ Thought 3: 这可能是定理记忆问题，而不是理解问题            │
│                                                             │
│ Action 3: 查询该知识点在教学大纲中的要求和常见错误         │
│                                                             │
│ Observation 3: 教学大纲显示这是八年级重点，常见错误就是    │
│              定理记忆不准确                                 │
│                                                             │
│ Thought 4: 确认根因 - 定理记忆问题，需要针对性记忆策略     │
│                                                             │
│ Conclusion: 建议"圆心角和圆周角"专项记忆训练              │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.2 推理模板

```typescript
// 标准推理模板
const reasoningTemplate = {
  initial: "我观察到 {observation}，这表明 {implication}",
  explore: "让我深入分析 {topic}，看看 {what_to_look_for}",
  verify: "我需要验证这个假设 {hypothesis}",
  conclude: "基于以上分析，我的结论是 {conclusion}",
  reflect: "让我检查一下这个结论是否可靠 {check_points}"
}
```

### 3.3 工具调用能力

#### 3.3.1 工具定义

```typescript
interface Tool {
  name: string                   // 工具名称
  description: string            // 工具描述
  parameters: any                // 参数schema
  handler: Function              // 执行函数
}

// 可用工具列表
const tools: Tool[] = [
  {
    name: "query_exams",
    description: "查询学生的试卷数据",
    parameters: { subject: string, dateRange?: [string, string] }
  },
  {
    name: "analyze_wrong_questions",
    description: "深入分析错题的模式和特点",
    parameters: { questions: Question[], analysisType: string }
  },
  {
    name: "search_knowledge_graph",
    description: "在知识图谱中搜索相关知识点",
    parameters: { subject: string, keywords: string[] }
  },
  {
    name: "query_syllabus",
    description: "查询学科教学大纲",
    parameters: { subject: string, grade?: number }
  },
  {
    name: "calculate_statistics",
    description: "计算统计指标",
    parameters: { data: any[], metrics: string[] }
  },
  {
    name: "compare_reports",
    description: "对比历史报告",
    parameters: { current: any, historical: any[] }
  }
]
```

#### 3.3.2 自主工具选择

智能体根据任务需求自主选择工具：

```typescript
// 示例：工具选择逻辑
function selectTools(task: string): string[] {
  const taskKeywords = extractKeywords(task);

  if (taskKeywords.includes("错误率") || taskKeywords.includes("错题")) {
    return ["query_exams", "analyze_wrong_questions"];
  }

  if (taskKeywords.includes("知识点") || taskKeywords.includes("大纲")) {
    return ["search_knowledge_graph", "query_syllabus"];
  }

  if (taskKeywords.includes("趋势") || taskKeywords.includes("进步")) {
    return ["query_exams", "calculate_statistics", "compare_reports"];
  }

  // 默认综合分析工具集
  return ["query_exams", "analyze_wrong_questions", "calculate_statistics"];
}
```

### 3.4 自我验证能力

#### 3.4.1 验证检查点

```typescript
interface ValidationCheck {
  check: string                  // 检查项
  result: 'pass' | 'fail' | 'warning'
  reason: string                 // 原因说明
  suggestion?: string            // 改进建议
}

// 验证清单
const validationChecks: ValidationCheck[] = [
  {
    check: "数据充分性",
    result: checkDataSufficiency(),
    reason: "需要至少3次考试数据才能进行可靠分析",
    suggestion: "建议收集更多数据"
  },
  {
    check: "结论逻辑性",
    result: validateLogic(),
    reason: "推理链是否完整连贯"
  },
  {
    check: "建议可行性",
    result: checkFeasibility(),
    reason: "学习计划是否实际可行"
  },
  {
    check: "证据支撑",
    result: verifyEvidence(),
    reason: "每个结论是否有数据支撑"
  }
];
```

#### 3.4.2 自我反思流程

```
┌─────────────────────────────────────────────────────────────┐
│  自我反思流程                                                │
│                                                             │
│  1. 回顾研究过程                                            │
│     - 我的目标是什么？                                      │
│     - 我采取了哪些步骤？                                    │
│     - 每个步骤的输出是什么？                                │
│                                                             │
│  2. 评估推理质量                                            │
│     - 推理链是否完整？                                      │
│     - 逻辑跳跃是否合理？                                    │
│     - 有无遗漏的可能性？                                    │
│                                                             │
│  3. 验证结论可靠度                                          │
│     - 结论是否有足够证据支撑？                              │
│     - 是否存在反例？                                        │
│     - 置信度是否合理？                                      │
│                                                             │
│  4. 识别改进空间                                            │
│     - 哪些方面可以更深入？                                  │
│     - 哪些工具可以补充使用？                                │
│     - 是否需要额外的数据？                                  │
│                                                             │
│  5. 生成改进建议                                            │
│     - 需要重新执行的步骤                                    │
│     - 需要补充的分析                                        │
│     - 最终输出调整                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 思维链设计

### 4.1 标准思维链结构

```typescript
interface ChainOfThought {
  // 阶段1: 理解与规划
  understanding: {
    userIntent: string          // 用户意图
    taskDecomposition: string[] // 任务分解
    researchPlan: ResearchPlan  // 研究计划
  }

  // 阶段2: 信息收集
  informationGathering: {
    dataSources: string[]       // 数据源
    collectedData: any[]        // 收集的数据
    dataQuality: string         // 数据质量评估
  }

  // 阶段3: 分析推理
  analysis: {
    reasoningSteps: ReasoningStep[]  // 推理步骤
    intermediateFindings: any[]      // 中间发现
    patterns: Pattern[]              // 识别的模式
  }

  // 阶段4: 综合判断
  synthesis: {
    mainFindings: string[]      // 主要发现
    conclusions: string[]       // 结论
    confidenceLevel: number     // 置信度
  }

  // 阶段5: 自我反思
  reflection: {
    qualityAssessment: string   // 质量评估
    limitations: string[]       // 局限性
    improvements: string[]      // 改进方向
  }

  // 阶段6: 输出生成
  output: {
    summary: string             // 总结
    detailedAnalysis: string    // 详细分析
    recommendations: string[]   // 建议
    nextSteps: string[]         // 后续步骤
  }
}
```

### 4.2 思维链示例

```
╔══════════════════════════════════════════════════════════════════════╗
║                    Deep Research 思维链示例                          ║
║                    任务: 分析几何学习状况                            ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段1: 理解与规划                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 🤔 用户意图: 学生想了解几何学科的学习情况，需要全面分析             │
│                                                                     │
│ 📋 任务分解:                                                        │
│   1. 收集所有几何试卷和错题数据                                     │
│   2. 计算基础统计指标（正确率、趋势等）                             │
│   3. 深入分析错题模式和知识关联                                     │
│   4. 对比历史报告，评估进步情况                                     │
│   5. 查询几何知识图谱，识别重点难点                                 │
│   6. 诊断问题根因                                                   │
│   7. 生成针对性改进计划                                             │
│                                                                     │
│ 🗺️ 研究计划:                                                       │
│   Step 1: 数据收集 (query_exams)                                    │
│   Step 2: 初步统计 (calculate_statistics)                          │
│   Step 3: 错题分析 (analyze_wrong_questions)                       │
│   Step 4: 知识图谱查询 (search_knowledge_graph)                    │
│   Step 5: 对比分析 (compare_reports)                               │
│   Step 6: 综合诊断 (内部推理)                                      │
│   Step 7: 生成计划 (generate_plan)                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段2: 信息收集                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 📊 收集到的数据:                                                    │
│   - 试卷数量: 5份                                                   │
│   - 时间跨度: 2026-02-01 至 2026-03-10                              │
│   - 总题目数: 85题                                                  │
│   - 已标记题数: 72题                                                │
│   - 错题数: 18题                                                    │
│                                                                     │
│ ✅ 数据质量: 良好 - 有足够的历史数据进行可靠分析                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段3: 分析推理                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 🔍 推理步骤:                                                        │
│                                                                     │
│ Step 1: 计算基础统计                                                │
│   → 平均正确率: 78%                                                 │
│   → 最新正确率: 82%                                                 │
│   → 初始正确率: 65%                                                 │
│   → 趋势: 上升 (+17%)                                               │
│                                                                     │
│ Step 2: 分析错题分布                                                │
│   → "圆的性质": 7题 (39%)                                           │
│   → "图形的旋转": 4题 (22%)                                         │
│   → "相似三角形": 3题 (17%)                                         │
│   → 其他: 4题 (22%)                                                 │
│                                                                     │
│ Step 3: 深入分析"圆的性质"错题                                      │
│   → 查询具体错题...                                                 │
│   → 观察: 7题中有5题涉及"圆心角和圆周角"关系                        │
│   → 分析: 学生经常混淆定理内容                                      │
│   → 查询知识图谱: "圆心角和圆周角"是八年级重点                      │
│   → 查询典型错误: 定理记忆不准确是常见错误                          │
│                                                                     │
│ Step 4: 分析进步情况                                                │
│   → 对比首次和最新考试                                              │
│   → "四边形性质": 正确率从60%提升到90% (大幅进步)                    │
│   → "圆的性质": 正确率基本不变 (持续薄弱)                           │
│   → "图形的旋转": 正确率略有提升但仍较低                             │
│                                                                     │
│ Step 5: 识别模式                                                    │
│   → 模式1: 学生在基础图形性质上进步明显                              │
│   → 模式2: 圆相关内容持续薄弱                                      │
│   → 模式3: 需要图形想象的内容掌握较慢                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段4: 综合判断                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 📌 主要发现:                                                        │
│   1. 整体水平: 中级 (78/100)                                       │
│   2. 学习趋势: 明显进步 (+17%)                                     │
│   3. 优势领域: 四边形性质、相似三角形                              │
│   4. 薄弱领域: 圆的性质、图形的旋转                                │
│   5. 核心问题: 定理记忆不准确                                      │
│                                                                     │
│ 🎯 结论:                                                            │
│   学生几何学习整体进步明显，基础图形性质掌握良好。                 │
│   圆相关内容是主要薄弱点，根本原因是定理记忆问题。                 │
│   需要针对性的记忆训练和图形想象练习。                             │
│                                                                     │
│ 📊 置信度: 85% (基于5次考试数据和详细分析)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段5: 自我反思                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ✅ 质量评估: 良好                                                  │
│   - 数据充分: 有5次考试数据                                        │
│   - 分析深入: 进行了多层次的推理                                   │
│   - 逻辑连贯: 推理链完整                                           │
│                                                                     │
│ ⚠️  局限性:                                                        │
│   - 样本量: 5次考试可能不完全反映长期趋势                           │
│   - 题型覆盖: 如果某些题型未出现，可能遗漏问题                     │
│   - 主观因素: 学生的考试状态可能影响结果                           │
│                                                                     │
│ 💡 改进方向:                                                       │
│   - 建议持续跟踪后续学习情况                                       │
│   - 可以补充分析作业数据                                           │
│   - 考虑结合课堂表现综合评估                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 阶段6: 输出生成                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 📝 总结: (见最终报告)                                              │
│ 📊 详细分析: (见最终报告)                                           │
│ 💡 建议: (见最终报告)                                              │
│ ➡️  后续步骤: 持续跟踪，2周后重新评估                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 ReAct 模式 (Reasoning + Acting)

```
循环: Thought → Action → Observation → Thought → ...

示例:
┌─────────────────────────────────────────────────────────────────────┐
│ Thought: 我需要分析"圆的性质"错题，先查询具体错题数据            │
│                                                                     │
│ Action: [analyze_wrong_questions]                                   │
│   filter: { knowledgePoint: "圆的性质" }                            │
│                                                                     │
│ Observation: 找到7道错题，其中5道涉及"圆心角和圆周角"              │
│                                                                     │
│ Thought: 错误集中，让我分析具体错误类型                             │
│                                                                     │
│ Action: [analyze_error_patterns]                                    │
│   questions: [那5道题]                                              │
│                                                                     │
│ Observation: 学生经常混淆"同弧所对圆心角是圆周角的两倍"            │
│                                                                     │
│ Thought: 这是定理记忆问题，让我查询教学大纲和常见错误              │
│                                                                     │
│ Action: [search_knowledge_graph] + [query_common_errors]           │
│                                                                     │
│ Observation: 确认这是八年级常见错误，需要记忆策略                   │
│                                                                     │
│ Thought: 结论明确，可以生成针对性建议                               │
│                                                                     │
│ Action: [generate_recommendation]                                   │
│   focus: "圆心角和圆周角记忆训练"                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 工具系统

### 5.1 工具分类

#### 5.1.1 数据查询工具

```typescript
// 查询试卷数据
{
  name: "query_exams",
  description: "查询学生的试卷数据，支持按学科、时间范围筛选",
  parameters: {
    subject: string,           // 学科
    startDate?: string,        // 开始日期
    endDate?: string,          // 结束日期
    limit?: number             // 数量限制
  },
  output: ExamData[]
}

// 查询错题数据
{
  name: "query_wrong_questions",
  description: "查询学生的错题数据",
  parameters: {
    subject: string,           // 学科
    knowledgePoint?: string,   // 知识点筛选
    errorRate?: number         // 错误率筛选
  },
  output: WrongQuestion[]
}

// 查询历史报告
{
  name: "query_reports",
  description: "查询学生历史分析报告",
  parameters: {
    subject: string,
    count?: number            // 返回最近N份报告
  },
  output: SubjectReport[]
}
```

#### 5.1.2 分析工具

```typescript
// 深度分析错题
{
  name: "analyze_wrong_questions",
  description: "深入分析错题的模式、特点和根因",
  parameters: {
    questions: Question[],
    analysisType: 'pattern' | 'root_cause' | 'knowledge_gaps'
  },
  output: {
    patterns: Pattern[],
    rootCauses: RootCause[],
    knowledgeGaps: KnowledgeGap[]
  }
}

// 计算统计指标
{
  name: "calculate_statistics",
  description: "计算各种统计指标",
  parameters: {
    data: any[],
    metrics: ('mean' | 'median' | 'stddev' | 'trend' | 'correlation')[]
  },
  output: StatisticsResults
}

// 对比分析
{
  name: "compare_data",
  description: "对比两组数据的差异",
  parameters: {
    data1: any[],
    data2: any[],
    compareBy: string[]
  },
  output: ComparisonResults
}
```

#### 5.1.3 知识检索工具

```typescript
// 搜索知识图谱
{
  name: "search_knowledge_graph",
  description: "在学科知识图谱中搜索相关知识点",
  parameters: {
    subject: string,
    keywords: string[],
    depth?: number           // 搜索深度
  },
  output: {
    nodes: KnowledgeNode[],
    relationships: Relationship[],
    path: string[]           // 知识路径
  }
}

// 查询教学大纲
{
  name: "query_syllabus",
  description: "查询学科教学大纲要求",
  parameters: {
    subject: string,
    grade?: number,
    topic?: string
  },
  output: SyllabusInfo
}

// 查询典型错误
{
  name: "query_common_errors",
  description: "查询某知识点的典型错误和解决方法",
  parameters: {
    subject: string,
    knowledgePoint: string
  },
  output: {
    commonErrors: CommonError[],
    solutions: Solution[]
  }
}
```

#### 5.1.4 计划生成工具

```typescript
// 生成学习计划
{
  name: "generate_study_plan",
  description: "基于分析结果生成个性化学习计划",
  parameters: {
    analysis: AnalysisResults,
    timeframe: 'week' | 'month' | 'quarter',
    focus?: string[]
  },
  output: StudyPlan
}

// 生成练习推荐
{
  name: "recommend_practice",
  description: "推荐针对性练习题",
  parameters: {
    weakPoints: string[],
    difficulty: number,
    count: number
  },
  output: PracticeRecommendation[]
}
```

### 5.2 工具调用示例

```typescript
// 示例：智能体自主调用工具序列
async function analyzeLearningState(subject: string) {
  const tools = new ToolSet();

  // Step 1: 收集数据
  const exams = await tools.call('query_exams', {
    subject,
    limit: 20
  });

  // Step 2: 初步统计
  const stats = await tools.call('calculate_statistics', {
    data: exams,
    metrics: ['mean', 'trend']
  });

  // Step 3: 获取错题
  const wrongQuestions = await tools.call('query_wrong_questions', {
    subject
  });

  // Step 4: 深度分析错题
  const analysis = await tools.call('analyze_wrong_questions', {
    questions: wrongQuestions,
    analysisType: 'pattern'
  });

  // Step 5: 查询知识图谱
  const knowledgeGraph = await tools.call('search_knowledge_graph', {
    subject,
    keywords: analysis.patterns.map(p => p.knowledgePoint),
    depth: 2
  });

  // Step 6: 查询典型错误
  const commonErrors = await tools.call('query_common_errors', {
    subject,
    knowledgePoint: analysis.topWeakPoint
  });

  // Step 7: 生成计划
  const plan = await tools.call('generate_study_plan', {
    analysis: {
      stats,
      wrongQuestions: analysis,
      knowledgeGraph,
      commonErrors
    },
    timeframe: 'month'
  });

  return plan;
}
```

---

## 6. 工作流引擎

### 6.1 工作流定义

```typescript
interface Workflow {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  fallbackStrategy?: string
}

interface WorkflowStep {
  id: string
  name: string
  action: string
  tools?: string[]
  inputMapping?: any
  outputMapping?: any
  condition?: string           // 执行条件
  onError?: 'skip' | 'retry' | 'fallback' | 'fail'
  maxRetries?: number
}
```

### 6.2 预定义工作流

#### 6.2.1 综合分析工作流

```typescript
const comprehensiveAnalysisWorkflow: Workflow = {
  id: 'comprehensive_analysis',
  name: '综合学科分析',
  description: '对学科学习状况进行全面分析',
  trigger: {
    type: 'manual',
    params: { subject: string }
  },
  steps: [
    {
      id: 'collect_data',
      name: '数据收集',
      action: 'parallel',
      tools: [
        { name: 'query_exams', params: { subject: '${subject}' } },
        { name: 'query_wrong_questions', params: { subject: '${subject}' } },
        { name: 'query_reports', params: { subject: '${subject}', count: 3 } }
      ],
      onError: 'retry',
      maxRetries: 3
    },
    {
      id: 'initial_stats',
      name: '初步统计',
      action: 'calculate_statistics',
      inputMapping: { data: '${collect_data.exams}' },
      condition: '${collect_data.exams.length} >= 2',
      onError: 'fail'
    },
    {
      id: 'deep_analysis',
      name: '深度分析',
      action: 'analyze_wrong_questions',
      inputMapping: {
        questions: '${collect_data.wrongQuestions}',
        analysisType: 'pattern'
      }
    },
    {
      id: 'knowledge_context',
      name: '知识背景查询',
      action: 'parallel',
      tools: [
        { name: 'search_knowledge_graph', params: { subject: '${subject}', keywords: '${deep_analysis.topWeakPoints}' } },
        { name: 'query_common_errors', params: { subject: '${subject}', knowledgePoint: '${deep_analysis.topWeakPoint}' } }
      ],
      onError: 'skip'
    },
    {
      id: 'historical_comparison',
      name: '历史对比',
      action: 'compare_reports',
      inputMapping: {
        current: '${initial_stats}',
        historical: '${collect_data.reports}'
      },
      condition: '${collect_data.reports.length} > 0',
      onError: 'skip'
    },
    {
      id: 'synthesize',
      name: '综合诊断',
      action: 'ai_reasoning',
      inputMapping: {
        context: {
          stats: '${initial_stats}',
          analysis: '${deep_analysis}',
          knowledge: '${knowledge_context}',
          history: '${historical_comparison}'
        },
        task: '综合诊断学习状况，识别主要问题和改进方向'
      }
    },
    {
      id: 'generate_plan',
      name: '生成计划',
      action: 'generate_study_plan',
      inputMapping: {
        analysis: '${synthesize}',
        timeframe: 'month'
      }
    },
    {
      id: 'validate',
      name: '验证结论',
      action: 'self_reflection',
      inputMapping: {
        analysis: '${synthesize}',
        plan: '${generate_plan}'
      }
    },
    {
      id: 'finalize',
      name: '最终输出',
      action: 'format_output',
      inputMapping: {
        stats: '${initial_stats}',
        analysis: '${deep_analysis}',
        diagnosis: '${synthesize}',
        plan: '${generate_plan}',
        validation: '${validate}'
      }
    }
  ]
}
```

#### 6.2.2 问题诊断工作流

```typescript
const problemDiagnosisWorkflow: Workflow = {
  id: 'problem_diagnosis',
  name: '问题诊断',
  description: '深入诊断特定学习问题',
  trigger: {
    type: 'manual',
    params: { subject: string, problem: string }
  },
  steps: [
    {
      id: 'understand_problem',
      name: '理解问题',
      action: 'ai_reasoning',
      inputMapping: {
        task: '理解用户描述的问题，明确诊断方向',
        problem: '${problem}'
      }
    },
    {
      id: 'gather_evidence',
      name: '收集证据',
      action: 'parallel',
      tools: [
        { name: 'query_wrong_questions', params: { subject: '${subject}', knowledgePoint: '${understand_problem.relatedPoints}' } },
        { name: 'search_knowledge_graph', params: { subject: '${subject}', keywords: '${understand_problem.keywords}' } }
      ]
    },
    {
      id: 'analyze_patterns',
      name: '分析模式',
      action: 'analyze_wrong_questions',
      inputMapping: {
        questions: '${gather_evidence.wrongQuestions}',
        analysisType: 'root_cause'
      }
    },
    {
      id: 'consult_knowledge',
      name: '咨询知识库',
      action: 'query_common_errors',
      inputMapping: {
        subject: '${subject}',
        knowledgePoint: '${analyze_patterns.rootCause}'
      }
    },
    {
      id: 'diagnose',
      name: '诊断结论',
      action: 'ai_reasoning',
      inputMapping: {
        task: '基于证据分析，诊断问题根因',
        evidence: {
          patterns: '${analyze_patterns}',
          knowledge: '${consult_knowledge}'
        }
      }
    },
    {
      id: 'recommend_solution',
      name: '推荐解决方案',
      action: 'generate_study_plan',
      inputMapping: {
        focus: '${diagnose.rootCause}',
        timeframe: 'week'
      }
    }
  ]
}
```

### 6.3 动态工作流调整

```typescript
// 智能体可以根据执行情况动态调整工作流
class AdaptiveWorkflow {
  async execute(workflow: Workflow, context: any) {
    for (const step of workflow.steps) {
      // 检查执行条件
      if (step.condition && !this.evaluateCondition(step.condition, context)) {
        continue;
      }

      // 执行步骤
      try {
        const result = await this.executeStep(step, context);
        context[step.id] = result;

        // 动态调整后续步骤
        const adjustments = await this.considerAdjustments(result, context);
        if (adjustments.length > 0) {
          workflow = this.applyAdjustments(workflow, adjustments);
        }

      } catch (error) {
        if (step.onError === 'retry') {
          await this.retry(step, context);
        } else if (step.onError === 'fallback') {
          await this.executeFallback(step, context);
        }
      }
    }
    return context;
  }

  // 根据结果考虑是否需要调整工作流
  async considerAdjustments(result: any, context: any): Promise<string[]> {
    const adjustments: string[] = [];

    // 示例：如果发现新的重要问题，添加分析步骤
    if (result.criticalIssue && !context.analyzedIssues.includes(result.criticalIssue)) {
      adjustments.push(`add_step: analyze_${result.criticalIssue}`);
    }

    // 示例：如果数据不足，降低分析深度
    if (result.dataQuality === 'low') {
      adjustments.push('set_mode: conservative');
    }

    return adjustments;
  }
}
```

---

## 7. 记忆系统

### 7.1 记忆层次

```
┌─────────────────────────────────────────────────────────────────┐
│                        记忆系统架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  工作记忆 (Working Memory)                                 │ │
│  │  • 当前任务的上下文信息                                    │ │
│  │  • 正在处理的数据                                          │ │
│  │  • 中间推理结果                                            │ │
│  │  • 容量: 有限 (~10-20 items)                               │ │
│  │  • 持续时间: 任务期间                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  短期记忆 (Short-term Memory)                               │ │
│  │  • 当前会话的历史记录                                      │ │
│  │  • 最近几次分析的结论                                      │ │
│  │  • 用户偏好和反馈                                          │ │
│  │  • 容量: 中等 (~100 items)                                 │ │
│  │  • 持续时间: 数小时到数天                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  长期记忆 (Long-term Memory)                                │ │
│  │  • 历史分析数据                                            │ │
│  │  • 学生学习档案                                            │ │
│  │  • 知识图谱                                                │ │
│  │  • 案例库                                                  │ │
│  │  • 容量: 大量                                              │ │
│  │  • 持续时间: 永久                                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 记忆结构

```typescript
interface WorkingMemory {
  taskId: string
  startTime: Date
  currentStep: string
  context: {
    userQuery: string
    parameters: any
    intermediateResults: Map<string, any>
  }
  reasoningChain: ReasoningStep[]
}

interface ShortTermMemory {
  sessionId: string
  startTime: Date
  conversations: Conversation[]
  recentAnalyses: AnalysisSummary[]
  userFeedback: Feedback[]
}

interface LongTermMemory {
  studentProfile: StudentProfile
  learningHistory: LearningHistory[]
  knowledgeGraph: KnowledgeGraph
  caseLibrary: Case[]
}

interface StudentProfile {
  userId: string
  subjects: SubjectProfile[]
  learningStyle?: string
  strengths: string[]
  weaknesses: string[]
  goals: string[]
  preferences: any
}

interface SubjectProfile {
  subject: string
  level: number
  trend: TrendData
  keyPoints: {
    mastered: string[]
    learning: string[]
    notStarted: string[]
  }
  commonErrors: string[]
  lastAnalysis: Date
}
```

### 7.3 记忆检索

```typescript
// 语义搜索记忆
class MemoryRetriever {
  // 检索相关历史分析
  async retrieveRelevantAnalyses(
    subject: string,
    context: string
  ): Promise<AnalysisSummary[]> {
    // 1. 关键词匹配
    const keywords = this.extractKeywords(context);

    // 2. 语义搜索
    const semanticResults = await this.semanticSearch({
      subject,
      query: context,
      limit: 5
    });

    // 3. 时间权重 (越近越重要)
    const timeWeighted = this.applyTimeWeight(semanticResults);

    // 4. 相关性排序
    return this.sortByRelevance(timeWeighted, keywords);
  }

  // 检索相似案例
  async retrieveSimilarCases(
    currentSituation: Situation
  ): Promise<Case[]> {
    const caseLibrary = await this.loadCaseLibrary();

    // 计算相似度
    const similarities = caseLibrary.map(c => ({
      case: c,
      similarity: this.calculateSimilarity(currentSituation, c.situation)
    }));

    // 返回最相似的案例
    return similarities
      .filter(s => s.similarity > 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.case);
  }

  // 计算场景相似度
  calculateSimilarity(s1: Situation, s2: Situation): number {
    // 多维度相似度计算
    const subjectMatch = s1.subject === s2.subject ? 1 : 0;
    const levelSimilarity = 1 - Math.abs(s1.level - s2.level) / 100;
    const patternSimilarity = this.compareErrorPatterns(s1.errors, s2.errors);
    const trendSimilarity = this.compareTrends(s1.trend, s2.trend);

    // 加权平均
    return (
      subjectMatch * 0.3 +
      levelSimilarity * 0.2 +
      patternSimilarity * 0.3 +
      trendSimilarity * 0.2
    );
  }
}
```

### 7.4 记忆更新

```typescript
// 智能更新记忆
class MemoryUpdater {
  // 更新学生档案
  async updateProfile(
    userId: string,
    analysis: AnalysisResult
  ): Promise<void> {
    const profile = await this.loadProfile(userId);

    // 更新学科档案
    const subjectProfile = profile.subjects.find(
      s => s.subject === analysis.subject
    );

    if (subjectProfile) {
      // 更新已有档案
      subjectProfile.level = analysis.stateAssessment.overallScore;
      subjectProfile.trend = analysis.trend;
      subjectProfile.keyPoints = this.categorizeKnowledgePoints(
        analysis.keyDifficultPoints
      );
      subjectProfile.lastAnalysis = new Date();
    } else {
      // 创建新档案
      profile.subjects.push({
        subject: analysis.subject,
        level: analysis.stateAssessment.overallScore,
        trend: analysis.trend,
        keyPoints: this.categorizeKnowledgePoints(
          analysis.keyDifficultPoints
        ),
        commonErrors: analysis.keyDifficultPoints.difficultPoints.map(
          p => p.name
        ),
        lastAnalysis: new Date()
      });
    }

    await this.saveProfile(userId, profile);
  }

  // 存储案例
  async storeCase(
    analysis: AnalysisResult,
    outcome?: string
  ): Promise<void> {
    const caseRecord: Case = {
      id: generateId(),
      situation: {
        subject: analysis.subject,
        level: analysis.stateAssessment.overallScore,
        errors: analysis.keyDifficultPoints.difficultPoints,
        trend: analysis.trend.analysis.overallTrend
      },
      analysis: analysis,
      recommendations: analysis.studyPlan,
      outcome: outcome,
      timestamp: new Date()
    };

    await this.caseLibrary.add(caseRecord);
  }
}
```

---

## 8. 提示词工程

### 8.1 System Prompt 设计

```typescript
const DEEP_RESEARCH_SYSTEM_PROMPT = `你是一个专业的学习分析研究专家，具有 Deep Research 能力。

## 核心能力

你具备以下核心能力：

1. **自主规划**: 能够将复杂任务分解为可执行的研究步骤
2. **多步推理**: 进行链式思考，逐步深入分析问题
3. **工具调用**: 自主选择和使用合适的工具收集信息
4. **自我验证**: 检查结论的可靠性，识别局限性
5. **动态调整**: 根据研究发现调整研究方向

## 工作模式

当接到分析任务时，你应该：

1. **理解任务**: 明确用户需求和期望输出
2. **制定计划**: 分解任务，规划研究步骤
3. **执行研究**: 调用工具，收集数据，进行分析
4. **推理诊断**: 基于证据进行多步推理
5. **自我反思**: 检查结论可靠性和局限性
6. **生成输出**: 提供清晰、有洞察力的分析报告

## 思考方式

- 逐步思考，展示你的推理过程
- 基于证据得出结论，不要凭空臆测
- 考虑多种可能性，寻找最佳解释
- 承认不确定性，标注置信度
- 发现异常时深入调查

## 输出格式

你的分析应该包括：

1. **研究概述**: 你做了什么，为什么这样做
2. **发现**: 基于数据的具体发现
3. **分析**: 对发现的深入解读
4. **结论**: 综合判断和置信度
5. **建议**: 可执行的改进建议
6. **局限性**: 分析的限制和注意事项

记住：你的目标是提供可靠、有洞察力、可操作的学习分析。`;
```

### 8.2 任务分解提示词

```typescript
const TASK_DECOMPOSITION_PROMPT = `我需要分析学生的学科学习状况。请帮我制定研究计划。

## 任务信息

学科: {subject}
可用数据: {dataAvailability}
用户关注点: {userFocus}

## 请制定研究计划

请按照以下格式输出研究计划：

\`\`\`
## 研究目标
(一句话概括研究目标)

## 研究步骤
1. [步骤名称]
   - 目的: (这一步要达成什么)
   - 方法: (使用什么工具/方法)
   - 预期输出: (预期得到什么)

2. [步骤名称]
   ...

## 可能的挑战
(可能遇到的问题和应对方案)

## 成功标准
(如何判断研究成功)
\`\`\`
`;
```

### 8.3 推理提示词

```typescript
const REASONING_PROMPT = `请基于以下数据进行深入分析和推理。

## 数据

{data}

## 分析要求

请进行链式推理，按照以下格式：

\`\`\`
## 推理过程

### 观察
(我观察到了什么)

### 初步分析
(这些观察说明什么)

### 深入探究
(需要进一步了解什么)
- [调查1] → (发现)
- [调查2] → (发现)

### 综合判断
(基于所有证据的结论)

### 置信度评估
- 证据充分性: (评分)
- 逻辑可靠性: (评分)
- 整体置信度: (评分)

### 局限性
(分析可能存在的局限)
\`\`\`
`;
```

### 8.4 自我反思提示词

```typescript
const REFLECTION_PROMPT = `请对以下分析结果进行自我评估。

## 分析结果

{analysisResult}

## 评估维度

请从以下维度评估：

\`\`\`
## 评估

### 1. 数据充分性
- 有足够的数据支撑结论吗？
- 数据质量如何？
- 是否存在数据偏差？

### 2. 推理逻辑
- 推理链是否完整？
- 是否存在逻辑跳跃？
- 结论是否自然推导得出？

### 3. 可靠性
- 结论的可信度如何？
- 有没有被忽略的因素？
- 是否存在其他可能的解释？

### 4. 实用性
- 建议是否具体可行？
- 是否考虑了实际情况？
- 优先级是否合理？

### 5. 改进建议
(如何可以让分析更好？)

## 总体评价
(质量评分: 1-10)
\`\`\`
`;
```

### 8.5 工具选择提示词

```typescript
const TOOL_SELECTION_PROMPT = `你是一个智能工具选择器。请根据任务需求选择合适的工具。

## 可用工具

{toolsDescription}

## 当前任务

任务: {task}
上下文: {context}
已完成步骤: {completedSteps}

## 请选择工具

请按照以下格式输出：

\`\`\`
## 工具选择

1. [工具名称]
   - 理由: (为什么选择这个工具)
   - 参数: (具体参数)
   - 预期: (期望得到什么)

2. [工具名称]
   ...

## 执行顺序
(工具的调用顺序和依赖关系)
\`\`\`
`;
```

---

## 9. 实施计划

### 9.1 技术栈

| 组件 | 技术选型 |
|------|---------|
| **LLM** | Qwen3.5-Plus (支持长上下文、工具调用) |
| **框架** | LangChain / LangGraph |
| **数据存储** | 本地文件系统 (JSON/MD) - 见补充文档 |
| **索引** | 内存索引 + JSON 索引文件 |
| **缓存** | 文件系统缓存 |
| **后端** | Next.js API Routes |
| **前端** | React + TypeScript + Tailwind |
| **记忆存储** | 文件系统 (JSON) |

> **说明**: 本项目使用本地文件系统存储和读取所有数据（试卷、报告、知识库等），无需向量数据库。详见《DeepResearch智能体-本地文件系统实现.md》补充文档。

### 9.2 文件结构

```
lib/
├── agent/                              # Agent 核心系统
│   ├── DeepResearchAgent.ts           # 主 Agent 类
│   ├── orchestrator/
│   │   ├── Planner.ts                 # 规划器
│   │   ├── Reasoner.ts                # 推理引擎
│   │   ├── Reflector.ts               # 反思器
│   │   └── Executor.ts                # 执行器
│   ├── tools/                          # 工具集
│   │   ├── data/
│   │   │   ├── queryExams.ts           # 查询试卷 (本地文件)
│   │   │   ├── queryWrongQuestions.ts   # 查询错题 (本地文件)
│   │   │   └── queryReports.ts         # 查询报告 (本地文件)
│   │   ├── analysis/
│   │   │   ├── analyzeWrongQuestions.ts
│   │   │   ├── calculateStatistics.ts
│   │   │   └── compareData.ts
│   │   ├── knowledge/
│   │   │   ├── searchKnowledgeGraph.ts # 搜索知识图谱 (本地 JSON)
│   │   │   ├── querySyllabus.ts        # 查询教学大纲 (本地 MD)
│   │   │   └── queryCommonErrors.ts    # 查询常见错误 (本地 MD)
│   │   └── planning/
│   │       ├── generateStudyPlan.ts
│   │       └── recommendPractice.ts
│   ├── memory/                          # 记忆系统
│   │   ├── WorkingMemory.ts
│   │   ├── ShortTermMemory.ts
│   │   ├── LongTermMemory.ts
│   │   └── MemoryRetriever.ts
│   ├── workflow/                        # 工作流引擎
│   │   ├── WorkflowEngine.ts
│   │   ├── workflows.ts                 # 预定义工作流
│   │   └── AdaptiveWorkflow.ts
│   ├── index/                           # 文件索引
│   │   ├── buildExamIndex.ts            # 构建试卷索引
│   │   ├── buildReportIndex.ts          # 构建报告索引
│   │   └── queryWithIndex.ts            # 使用索引查询
│   ├── cache/                           # 缓存系统
│   │   ├── statisticsCache.ts
│   │   ├── patternsCache.ts
│   │   └── cacheManager.ts
│   └── prompts/                         # 提示词模板
│       ├── system.ts
│       ├── decomposition.ts
│       ├── reasoning.ts
│       ├── reflection.ts
│       └── toolSelection.ts
│
├── knowledge/                           # 知识库 (本地文件)
│   ├── graphs/                          # 知识图谱 (JSON)
│   │   ├── geometry.json
│   │   ├── algebra.json
│   │   └── ...
│   ├── syllabus/                        # 教学大纲 (MD)
│   │   ├── math/
│   │   ├── chinese/
│   │   └── ...
│   └── common-errors/                   # 常见错误库 (MD)
│       ├── geometry.md
│       └── ...
│
└── types/
    └── agent.ts                         # Agent 相关类型定义
```

### 9.3 开发阶段

#### Phase 1: 基础架构 (3-4天)

- [ ] 搭建 Agent 核心框架
- [ ] 实现 Planner (规划器)
- [ ] 实现 Reasoner (推理引擎)
- [ ] 实现 Reflector (反思器)
- [ ] 实现 Executor (执行器)

#### Phase 2: 工具系统 (2-3天)

- [ ] 实现数据查询工具
- [ ] 实现分析计算工具
- [ ] 实现知识检索工具
- [ ] 实现计划生成工具
- [ ] 实现工具注册和调用机制

#### Phase 3: 记忆系统 (2天)

- [ ] 实现工作记忆
- [ ] 实现短期记忆
- [ ] 实现长期记忆
- [ ] 实现记忆检索机制
- [ ] 实现记忆更新机制

#### Phase 4: 工作流引擎 (2天)

- [ ] 实现工作流执行引擎
- [ ] 定义预定义工作流
- [ ] 实现动态调整机制
- [ ] 实现错误处理和重试

#### Phase 5: 提示词工程 (1-2天)

- [ ] 设计 System Prompt
- [ ] 设计任务分解提示词
- [ ] 设计推理提示词
- [ ] 设计反思提示词
- [ ] 设计工具选择提示词

#### Phase 6: 知识库建设 (2-3天)

- [ ] 构建学科知识图谱
- [ ] 整理教学大纲
- [ ] 收集常见错误
- [ ] 建立案例库

#### Phase 7: API 集成 (2天)

- [ ] 创建 Agent API 端点
- [ ] 实现对话接口
- [ ] 实现流式输出
- [ ] 实现进度反馈

#### Phase 8: 前端开发 (3-4天)

- [ ] 创建 Agent 对话界面
- [ ] 实现思维链可视化
- [ ] 实现工具调用展示
- [ ] 实现记忆管理界面

#### Phase 9: 测试优化 (2-3天)

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 用户体验优化

### 9.4 核心代码示例

#### 9.4.1 Agent 主类

```typescript
// lib/agent/DeepResearchAgent.ts
export class DeepResearchAgent {
  private planner: Planner;
  private reasoner: Reasoner;
  private reflector: Reflector;
  private executor: Executor;
  private memory: MemorySystem;
  private tools: ToolSet;

  constructor(config: AgentConfig) {
    this.planner = new Planner(config);
    this.reasoner = new Reasoner(config);
    this.reflector = new Reflector(config);
    this.executor = new Executor(config);
    this.memory = new MemorySystem(config);
    this.tools = new ToolSet(config);
  }

  async analyze(userQuery: string): Promise<AgentResponse> {
    // 1. 理解任务
    const task = await this.understandTask(userQuery);

    // 2. 制定计划
    const plan = await this.planner.createPlan(task);

    // 3. 执行研究 (支持流式输出)
    const results = await this.executeResearch(plan);

    // 4. 自我反思
    const reflection = await this.reflector.evaluate(results);

    // 5. 生成最终输出
    const response = this.formatOutput(results, reflection);

    // 6. 更新记忆
    await this.memory.store(task, results, response);

    return response;
  }

  private async executeResearch(
    plan: ResearchPlan
  ): Promise<ResearchResults> {
    const results: ResearchResults = {
      steps: [],
      reasoningChain: [],
      findings: []
    };

    for (const step of plan.steps) {
      // 执行步骤
      const stepResult = await this.executor.execute(step, this.tools);

      // 记录推理
      const reasoning = await this.reasoner.reason(
        step,
        stepResult,
        results
      );
      results.reasoningChain.push(reasoning);

      // 存储发现
      if (reasoning.findings) {
        results.findings.push(...reasoning.findings);
      }

      results.steps.push({
        step,
        result: stepResult,
        reasoning
      });

      // 动态调整
      const adjustments = await this.considerAdjustments(
        stepResult,
        results
      );
      if (adjustments.length > 0) {
        plan = this.adjustPlan(plan, adjustments);
      }
    }

    return results;
  }
}
```

#### 9.4.2 工具实现示例

```typescript
// lib/agent/tools/knowledge/searchKnowledgeGraph.ts
export const searchKnowledgeGraphTool: Tool = {
  name: 'search_knowledge_graph',
  description: '在学科知识图谱中搜索相关知识点和关系',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      keywords: { type: 'array', items: { type: 'string' } },
      depth: { type: 'number', default: 2 }
    },
    required: ['subject', 'keywords']
  },

  async handler(params) {
    const { subject, keywords, depth = 2 } = params;

    // 1. 加载知识图谱
    const graph = await loadKnowledgeGraph(subject);

    // 2. 搜索匹配节点
    const matchedNodes = graph.searchNodes(keywords);

    // 3. 扩展搜索（根据深度）
    const expandedNodes = new Set<string>();
    for (const node of matchedNodes) {
      const neighbors = graph.getNeighbors(node.id, depth);
      neighbors.forEach(n => expandedNodes.add(n.id));
    }

    // 4. 构建子图
    const subgraph = graph.extractSubgraph([
      ...matchedNodes.map(n => n.id),
      ...Array.from(expandedNodes)
    ]);

    // 5. 计算知识路径
    const paths = graph.findPaths(
      matchedNodes.map(n => n.id),
      depth
    );

    return {
      nodes: subgraph.nodes,
      relationships: subgraph.relationships,
      paths,
      summary: this.summarizeResults(subgraph, matchedNodes)
    };
  }
};
```

---

## 附录

### A. 与传统分析系统对比

| 特性 | 传统分析系统 | Deep Research 智能体 |
|------|-------------|---------------------|
| **任务处理** | 固定流程 | 自主规划 |
| **分析深度** | 表面统计 | 深度推理 |
| **问题发现** | 预设规则 | 主动探索 |
| **结论验证** | 无 | 自我验证 |
| **适应性** | 低 | 高 |
| **可解释性** | 弱 | 强（思维链可见） |
| **学习能力** | 无 | 持续积累 |

### B. LangGraph 集成示例

```typescript
// 使用 LangGraph 构建 Agent
import { StateGraph } from "@langchain/langgraph";

// 定义状态
interface AgentState {
  task: string;
  plan: ResearchPlan;
  currentStep: number;
  findings: any[];
  reasoningChain: ReasoningStep[];
  reflection?: Reflection;
}

// 定义图
const researchGraph = new StateGraph<AgentState>({
  channels: {
    task: { value: null, default: () => ({}) },
    plan: { value: null, default: () => ({}) },
    // ...
  }
})
.addNode("planner", plannerNode)
.addNode("executor", executorNode)
.addNode("reasoner", reasonerNode)
.addNode("reflector", reflectorNode)
.addEdge("planner", "executor")
.addEdge("executor", "reasoner")
.addEdge("reasoner", "reflector")
.addConditionalEdges(
  "reflector",
  shouldContinue,
  {
    continue: "executor",
    end: END
  }
);

const compiledGraph = researchGraph.compile();
```

### C. 评估指标

| 指标 | 说明 |
|------|------|
| **分析准确性** | 结论与实际情况的符合度 |
| **推理质量** | 推理链的完整性和逻辑性 |
| **建议实用性** | 学习计划的可操作性 |
| **响应时间** | 完成分析所需时间 |
| **工具使用效率** | 工具选择的合理性 |
| **自我纠错率** | 发现并修正错误的比例 |

---

**文档结束**
