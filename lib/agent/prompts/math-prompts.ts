/**
 * 数学学科深入分析提示词模板
 */

// ============================================
// System Prompt - 数学学习分析专家
// ============================================

export const MATH_AGENT_SYSTEM_PROMPT = `你是一位专业的数学学习分析专家，具有 Deep Research 能力。你擅长：

1. **代数分析**: 识别运算错误、方程求解问题、函数理解障碍
2. **几何分析**: 分析图形认知、证明逻辑、空间想象能力
3. **函数分析**: 评估函数概念理解、图像分析能力、应用题解决能力
4. **统计概率**: 分析数据处理、概率计算、统计图表理解
5. **数学思维**: 逻辑推理、抽象思维、模型构建能力评估

## 核心能力

你具备以下核心能力：

1. **自主规划**: 能够将分析任务分解为可执行的研究步骤
2. **多步推理**: 进行链式思考，逐步深入分析问题
3. **知识关联**: 利用数学知识图谱分析知识点之间的关联
4. **模式识别**: 识别学习中的错误模式和能力瓶颈
5. **自我验证**: 检查结论的可靠性，标注置信度

## 分析方法

当分析数学学习状况时，你应该：

1. **整体评估**: 从代数、几何、函数、统计等多维度评估
2. **趋势分析**: 分析学习进步趋势和稳定性
3. **错误诊断**: 深入分析错误类型和根本原因
4. **知识关联**: 利用知识图谱分析前置知识和后续影响
5. **个性化建议**: 提供具体可操作的改进建议

## 数学学科特点

数学学习的特点：
- 知识体系严密，前后关联性强
- 需要较强的逻辑推理能力
- 抽象程度递增
- 数形结合是重要方法
- 计算能力是基础

## 输出格式

你的分析应该包括：

1. **研究概述**: 分析目标和范围
2. **能力评估**: 各项能力的水平和问题
3. **错误分析**: 具体错误类型和原因
4. **知识关联**: 薄弱知识点对其他学习的影响
5. **趋势判断**: 学习进步情况和稳定性
6. **改进建议**: 具体可操作的练习计划
7. **局限性**: 分析的限制和注意事项

记住：你的目标是提供可靠、有洞察力、可操作的数学学习分析。`;

// ============================================
// 代数分析提示词
// ============================================

export const MATH_ALGEBRA_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的代数学习状况。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

请按照以下步骤进行链式推理：

### 步骤 1: 代数错误分类
将错题按知识点分类：
- **实数与运算**: 有理数、无理数、绝对值
- **整式与分式**: 整式运算、因式分解、分式运算
- **方程与不等式**: 一次方程、方程组、不等式、二次方程、分式方程

统计各类型错误数量和比例。

### 步骤 2: 错误原因分析
对每类错误，分析：
- 是概念理解错误还是计算错误？
- 是粗心还是方法不当？
- 是否受前序知识影响？

### 步骤 3: 知识关联分析
利用代数知识图谱，分析：
- 薄弱知识点的前置知识是否掌握？
- 当前薄弱会影响哪些后续学习？
- 哪些知识点是核心突破口？

### 步骤 4: 代数能力评估
基于以上分析，评估学生的：
- 运算能力（准确率、速度）
- 方程求解能力
- 代数变形能力
- 抽象思维能力

### 步骤 5: 改进建议
提供具体可操作的代数提升方案。

## 输出格式

请按以下JSON格式输出：

\`\`\`json
{
  "algebraAnalysis": {
    "overallLevel": 评分(1-10),
    "errorDistribution": {
      "实数与运算": { count: 数量, percentage: 百分比 },
      "整式与分式": { count: 数量, percentage: 百分比 },
      "方程与不等式": { count: 数量, percentage: 百分比 },
      "其他": { count: 数量, percentage: 百分比 }
    },
    "topErrors": [
      {
        "point": "具体知识点",
        "errorCount": 数量,
        "errorType": "错误类型",
        "rootCause": "根本原因",
        "examples": ["错题示例"],
        "impact": "对学习的影响"
      }
    ],
    "knowledgeGaps": [
      {
        "point": "薄弱知识点",
        "prerequisites": ["前置知识"],
        "affectedPoints": ["受影响的后续知识"]
      }
    ],
    "abilityAssessment": {
      "level": "整体水平描述",
      "calculation": "计算能力评估",
      "equation": "方程求解能力",
      "abstraction": "抽象思维能力",
      "strengths": ["优势"],
      "weaknesses": ["薄弱点"]
    },
    "recommendations": [
      {
        "priority": "优先级",
        "focus": "重点",
        "action": "具体行动",
        "timeframe": "时间安排",
        "resources": ["推荐资源"]
      }
    ]
  }
}
\`\`\``;

// ============================================
// 几何分析提示词
// ============================================

export const MATH_GEOMETRY_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的几何学习状况。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

### 步骤 1: 几何错误分类
- **线与角**: 平行线、相交线、角的关系
- **三角形**: 全等、等腰、直角、相似、勾股定理
- **四边形**: 平行四边形、矩形、菱形、正方形、梯形
- **圆**: 圆的性质、切线、圆心角与圆周角
- **图形变换**: 轴对称、旋转、平移

### 步骤 2: 空间想象与逻辑推理评估
- 空间想象能力
- 逻辑推理能力
- 图形识别能力
- 证明书写能力

### 步骤 3: 问题诊断
- 概念理解不清
- 定理记忆模糊
- 辅助线不会添加
- 证明逻辑混乱
- 数形结合能力弱

### 步骤 4: 改进建议

## 输出格式

\`\`\`json
{
  "geometryAnalysis": {
    "overallLevel": 评分(1-10),
    "errorDistribution": {
      "线与角": 数量,
      "三角形": 数量,
      "四边形": 数量,
      "圆": 数量,
      "图形变换": 数量
    },
    "abilityAssessment": {
      "spatial": "空间想象能力",
      "logic": "逻辑推理能力",
      "recognition": "图形识别能力",
      "proof": "证明书写能力"
    },
    "mainIssues": ["主要问题"],
    "recommendations": [
      {
        "focus": "重点",
        "method": "方法",
        "practice": "练习建议"
      }
    ]
  }
}
\`\`\``;

// ============================================
// 函数分析提示词
// ============================================

export const MATH_FUNCTION_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的函数学习状况。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

### 步骤 1: 函数错误分类
- **函数基础**: 函数概念、定义域、值域
- **一次函数**: 图像、性质、应用
- **反比例函数**: 图像、性质
- **二次函数**: 图像、性质、表达式、应用
- **三角函数**: 锐角三角函数、特殊角、解直角三角形

### 步骤 2: 函数能力评估
- 函数概念理解
- 图像分析能力
- 数形结合能力
- 应用题解决能力

### 步骤 3: 问题诊断与建议

## 输出格式

\`\`\`json
{
  "functionAnalysis": {
    "overallLevel": 评分(1-10),
    "errorDistribution": {
      "函数基础": 数量,
      "一次函数": 数量,
      "反比例函数": 数量,
      "二次函数": 数量,
      "三角函数": 数量
    },
    "abilityAssessment": {
      "concept": "概念理解",
      "graph": "图像分析",
      "combination": "数形结合",
      "application": "应用能力"
    },
    "mainIssues": ["主要问题"],
    "recommendations": [
      {
        "focus": "重点",
        "method": "方法",
        "practice": "练习建议"
      }
    ]
  }
}
\`\`\``;

// ============================================
// 综合分析提示词
// ============================================

export const MATH_COMPREHENSIVE_ANALYSIS_PROMPT = (data: {
  exams: any[]
  wrongQuestions: any[]
  subject: string
  timeRange: string
}) => `请对学生的数学学习状况进行全面深入的分析。

## 数据概述

学科: ${data.subject}
分析时间范围: ${data.timeRange}
试卷数量: ${data.exams.length}
总题目数: ${data.exams.reduce((sum, e) => sum + (e.questions?.length || 0), 0)}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions.slice(0, 30), null, 2)}
\`\`\`

## 分析要求

作为 Deep Research Agent，请按照以下思维链进行深入分析：

### 阶段 1: 理解与规划
明确分析目标：评估学生数学学习状况，识别问题，提供改进建议。

### 阶段 2: 多维度分析
1. **知识维度**: 代数、几何、函数、统计与概率
2. **能力维度**: 运算能力、逻辑推理、空间想象、抽象思维
3. **错误维度**: 错误类型、频率、严重程度
4. **知识维度**: 薄弱知识点及其关联影响
5. **趋势维度**: 学习进步情况和稳定性

### 阶段 3: 深度推理
对每个主要发现进行链式推理：
- 观察（数据呈现）
- 分析（可能原因）
- 验证（寻找证据）
- 结论（综合判断）

### 阶段 4: 知识关联
利用数学知识图谱：
- 识别薄弱知识点
- 分析前置知识是否掌握
- 评估对后续学习的影响

### 阶段 5: 综合诊断
- 整体水平评估
- 主要优势
- 核心问题
- 学习潜力

### 阶段 6: 改进方案
提供个性化、分阶段、可操作的学习计划

## 输出格式

\`\`\`json
{
  "researchSummary": "分析过程概述",
  "findings": {
    "overallAssessment": {
      "level": "整体水平(1-10)",
      "rank": "排名/等级",
      "trend": "趋势",
      "mathThinking": "数学思维能力评估"
    },
    "knowledgeAnalysis": {
      "algebra": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "geometry": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "function": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "statistics": { "score": 评分, "level": "水平", "issues": ["问题"] }
    },
    "abilityAnalysis": {
      "calculation": { "score": 评分, "description": "描述" },
      "logic": { "score": 评分, "description": "描述" },
      "spatial": { "score": 评分, "description": "描述" },
      "abstraction": { "score": 评分, "description": "描述" }
    },
    "keyFindings": [
      {
        "area": "领域",
        "finding": "发现",
        "evidence": "证据",
        "significance": "重要性"
      }
    ],
    "errorPatterns": [
      {
        "pattern": "错误模式",
        "frequency": "频率",
        "rootCause": "根本原因",
        "impact": "影响"
      }
    ],
    "knowledgeGaps": [
      {
        "point": "薄弱知识点",
        "prerequisites": ["前置知识"],
        "affectedAreas": ["受影响领域"]
      }
    ]
  },
  "diagnosis": {
    "mainConclusion": "主要结论",
    "strengths": ["优势"],
    "weaknesses": ["薄弱点"],
    "learningObstacles": ["学习障碍"],
    "mathThinkingIssues": ["数学思维问题"]
  },
  "recommendations": {
    "priority": "高优先级建议",
    "studyPlan": [
      {
        "phase": "阶段",
        "duration": "时长",
        "goals": ["目标"],
        "actions": ["行动"],
        "resources": ["资源"]
      }
    ],
    "dailyPractices": ["每日练习建议"],
    "resources": ["推荐学习资源"],
    "methods": ["学习方法建议"]
  },
  "reflection": {
    "dataQuality": "数据质量评估",
    "confidence": "结论置信度",
    "limitations": ["分析局限性"],
    "nextSteps": ["后续建议"]
  }
}
\`\`\``;

// ============================================
// 学习计划生成提示词
// ============================================

export const MATH_STUDY_PLAN_PROMPT = (data: {
  analysis: any
  timeframe: 'week' | 'month' | 'quarter'
  focus?: string[]
}) => `基于以下分析结果，生成个性化的数学学习计划。

## 分析结果

\`\`\`json
${JSON.stringify(data.analysis, null, 2)}
\`\`\`

## 计划要求

时间范围: ${data.timeframe}
重点领域: ${data.focus?.join(', ') || '全面'}

请生成具体、可操作的学习计划，包括：

1. **每日练习计划**
2. **专项突破计划**
3. **计算能力训练**
4. **错题整理计划**
5. **资源推荐**

## 输出格式

\`\`\`json
{
  "studyPlan": {
    "timeframe": "${data.timeframe}",
    "overallGoal": "总体目标",
    "dailyRoutine": {
      "calculation": "计算训练安排",
      "concept": "概念学习安排",
      "practice": "练习安排",
      "review": "复习安排"
    },
    "focusAreas": [
      {
        "area": "领域",
        "currentLevel": "当前水平",
        "targetLevel": "目标水平",
        "methods": ["方法"],
        "resources": ["资源"],
        "practiceTasks": ["练习任务"],
        "milestones": ["里程碑"]
      }
    ],
    "weeklyGoals": ["每周目标"],
    "checkpoints": [
      { "date": "日期", "check": "检查内容", "criteria": "达标标准" }
    ],
    "resources": {
      "textbooks": ["教材"],
      "online": ["在线资源"],
      "tools": ["工具"]
    },
    "expectedOutcome": "预期效果"
  }
}
\`\`\``;
