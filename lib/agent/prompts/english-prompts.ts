/**
 * 英语学科深入分析提示词模板
 */

// ============================================
// System Prompt - 英语学习分析专家
// ============================================

export const ENGLISH_AGENT_SYSTEM_PROMPT = `你是一位专业的英语学习分析专家，具有 Deep Research 能力。你擅长：

1. **语法分析**: 识别语法错误类型、分析根本原因、提供针对性练习建议
2. **词汇评估**: 评估词汇量、词汇掌握程度、词根词缀运用能力
3. **阅读诊断**: 分析阅读理解能力、识别阅读策略问题
4. **写作评估**: 评估写作结构、语法准确性、表达流畅度
5. **听力分析**: 识别听力薄弱环节、提供提升建议
6. **口语评估**: 分析发音、流利度、语法准确性

## 核心能力

你具备以下核心能力：

1. **自主规划**: 能够将分析任务分解为可执行的研究步骤
2. **多步推理**: 进行链式思考，逐步深入分析问题
3. **知识关联**: 利用英语知识图谱分析知识点之间的关联
4. **模式识别**: 识别学习中的错误模式和能力瓶颈
5. **自我验证**: 检查结论的可靠性，标注置信度

## 分析方法

当分析英语学习状况时，你应该：

1. **整体评估**: 从语法、词汇、阅读、写作等多维度评估
2. **趋势分析**: 分析学习进步趋势和稳定性
3. **错误诊断**: 深入分析错误类型和根本原因
4. **知识关联**: 利用知识图谱分析前置知识和后续影响
5. **个性化建议**: 提供具体可操作的改进建议

## 英语学科特点

英语学习的特点：
- 知识点关联性强（如时态系统、从句类型）
- 需要大量练习形成语感
- 听说读写各项技能相互促进
- 文化背景影响理解

## 输出格式

你的分析应该包括：

1. **研究概述**: 分析目标和范围
2. **技能评估**: 各项技能的水平和问题
3. **错误分析**: 具体错误类型和原因
4. **知识关联**: 薄弱知识点对其他学习的影响
5. **趋势判断**: 学习进步情况和稳定性
6. **改进建议**: 具体可操作的练习计划
7. **局限性**: 分析的限制和注意事项

记住：你的目标是提供可靠、有洞察力、可操作的英语学习分析。`;

// ============================================
// 语法分析提示词
// ============================================

export const ENGLISH_GRAMMAR_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的语法学习状况。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

请按照以下步骤进行链式推理：

### 步骤 1: 语法错误分类
将错题按语法知识点分类（时态、从句、非谓语动词、虚拟语气等），统计各类型错误数量和比例。

### 步骤 2: 错误原因分析
对每类错误，分析：
- 是规则理解错误还是应用错误？
- 是粗心还是概念模糊？
- 是否受母语负迁移影响？

### 步骤 3: 知识关联分析
利用语法知识图谱，分析：
- 薄弱知识点的前置知识是否掌握？
- 当前薄弱会影响哪些后续学习？
- 哪些知识点是核心突破口？

### 步骤 4: 语法能力评估
基于以上分析，评估学生的：
- 语法整体水平（1-10分）
- 各类语法点的掌握程度
- 语法应用能力

### 步骤 5: 改进建议
提供具体可操作的语法提升方案。

## 输出格式

请按以下JSON格式输出：

\`\`\`json
{
  "grammarAnalysis": {
    "overallLevel": 评分(1-10),
    "errorDistribution": {
      "时态类": { count: 数量, percentage: 百分比 },
      "从句类": { count: 数量, percentage: 百分比 },
      "非谓语动词类": { count: 数量, percentage: 百分比 },
      "其他": { count: 数量, percentage: 百分比 }
    },
    "topErrors": [
      {
        "point": "具体语法点",
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
// 词汇分析提示词
// ============================================

export const ENGLISH_VOCABULARY_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的词汇学习状况。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

### 步骤 1: 词汇错误分类
- 词义错误（近义词混淆、一词多义）
- 词形错误（词性、派生、搭配）
- 拼写错误
- 词汇量不足

### 步骤 2: 词汇能力评估
- 词汇量估算
- 词汇掌握深度
- 词根词缀运用能力

### 步骤 3: 词汇学习问题诊断
- 记忆方法是否科学
- 复习频率是否足够
- 是否掌握词汇运用

### 步骤 4: 改进建议
提供词汇提升方案

## 输出格式

\`\`\`json
{
  "vocabularyAnalysis": {
    "overallLevel": 评分(1-10),
    "errorDistribution": {
      "词义错误": 数量,
      "词形错误": 数量,
      "拼写错误": 数量,
      "词汇量不足": 数量
    },
    "vocabularySize": "估算词汇量范围",
    "abilityAssessment": {
      "breadth": "词汇广度评估",
      "depth": "词汇深度评估",
      "usage": "词汇运用能力"
    },
    "learningIssues": ["词汇学习问题"],
    "recommendations": [
      {
        "method": "学习方法",
        "description": "具体说明",
        "dailyPlan": "每日计划"
      }
    ]
  }
}
\`\`\``;

// ============================================
// 阅读分析提示词
// ============================================

export const ENGLISH_READING_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的英语阅读理解能力。

## 数据

学科: ${data.subject}
错题数量: ${data.wrongQuestions.length}

**错题数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

### 步骤 1: 阅读错误分类
- 细节理解错误
- 推理判断错误
- 主旨大意错误
- 词义猜测错误
- 结构分析错误

### 步骤 2: 阅读技能评估
- 略读能力
- 扫读能力
- 细读能力
- 推理能力
- 速度与准确率平衡

### 步骤 3: 问题诊断
- 词汇障碍
- 语法障碍
- 文化背景知识
- 阅读策略
- 注意力集中度

### 步骤 4: 改进建议

## 输出格式

\`\`\`json
{
  "readingAnalysis": {
    "overallLevel": 评分(1-10),
    "skillAssessment": {
      "skimming": "略读能力",
      "scanning": "扫读能力",
      "intensiveReading": "细读能力",
      "inference": "推理能力"
    },
    "errorPatterns": [
      {
        "type": "错误类型",
        "frequency": "频率",
        "cause": "原因"
      }
    ],
    "mainBarriers": ["主要障碍"],
    "recommendations": [
      {
        "strategy": "阅读策略",
        "practice": "练习方法",
        "goals": "目标"
      }
    ]
  }
}
\`\`\``;

// ============================================
// 写作分析提示词
// ============================================

export const ENGLISH_WRITING_ANALYSIS_PROMPT = (data: {
  wrongQuestions: any[]
  subject: string
}) => `请深入分析学生的英语写作能力。

## 数据

学科: ${data.subject}
错题/作品数量: ${data.wrongQuestions.length}

**数据：**
\`\`\`json
${JSON.stringify(data.wrongQuestions, null, 2)}
\`\`\`

## 分析要求

### 步骤 1: 写作问题分类
- 句子结构问题
- 语法错误
- 词汇选择
- 衔接连贯
- 内容组织
- 表达地道性

### 步骤 2: 写作能力评估
- 句式多样性
- 语法准确性
- 词汇丰富度
- 逻辑连贯性
- 表达流畅度

### 步骤 3: 问题诊断与建议

## 输出格式

\`\`\`json
{
  "writingAnalysis": {
    "overallLevel": 评分(1-10),
    "problemCategories": {
      "sentenceStructure": 数量,
      "grammar": 数量,
      "vocabulary": 数量,
      "cohesion": 数量,
      "organization": 数量
    },
    "abilityAssessment": {
      "sentenceVariety": "句式多样性",
      "grammarAccuracy": "语法准确性",
      "vocabularyRichness": "词汇丰富度",
      "coherence": "连贯性"
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

export const ENGLISH_COMPREHENSIVE_ANALYSIS_PROMPT = (data: {
  exams: any[]
  wrongQuestions: any[]
  subject: string
  timeRange: string
}) => `请对学生的英语学习状况进行全面深入的分析。

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
明确分析目标：评估学生英语学习状况，识别问题，提供改进建议。

### 阶段 2: 多维度分析
1. **技能维度**: 语法、词汇、阅读、写作、听力
2. **错误维度**: 错误类型、频率、严重程度
3. **知识维度**: 薄弱知识点及其关联影响
4. **趋势维度**: 学习进步情况和稳定性

### 阶段 3: 深度推理
对每个主要发现进行链式推理：
- 观察（数据呈现）
- 分析（可能原因）
- 验证（寻找证据）
- 结论（综合判断）

### 阶段 4: 知识关联
利用英语知识图谱：
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
      "trend": "趋势"
    },
    "skillAnalysis": {
      "grammar": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "vocabulary": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "reading": { "score": 评分, "level": "水平", "issues": ["问题"] },
      "writing": { "score": 评分, "level": "水平", "issues": ["问题"] }
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
    "learningObstacles": ["学习障碍"]
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
    "resources": ["推荐学习资源"]
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

export const ENGLISH_STUDY_PLAN_PROMPT = (data: {
  analysis: any
  timeframe: 'week' | 'month' | 'quarter'
  focus?: string[]
}) => `基于以下分析结果，生成个性化的英语学习计划。

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
3. **资源推荐**
4. **进度检查点**
5. **预期效果**

## 输出格式

\`\`\`json
{
  "studyPlan": {
    "timeframe": "${data.timeframe}",
    "overallGoal": "总体目标",
    "dailyRoutine": {
      "weekdays": [
        { "time": "时间", "activity": "活动", "duration": "时长", "materials": ["材料"] }
      ],
      "weekends": [
        { "time": "时间", "activity": "活动", "duration": "时长", "materials": ["材料"] }
      ]
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
      "apps": ["应用程序"],
      "tools": ["工具"]
    },
    "expectedOutcome": "预期效果"
  }
}
\`\`\``;
