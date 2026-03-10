/**
 * Deep Research Agent 类型定义
 */

// ============================================
// 核心类型
// ============================================

export interface AgentConfig {
  llmProvider?: string
  maxIterations?: number
  timeout?: number
  enableReflection?: boolean
}

export interface ResearchPlan {
  objective: string
  steps: ResearchStep[]
  currentStep: number
  status: 'planning' | 'executing' | 'reviewing' | 'completed'
}

export interface ResearchStep {
  id: string
  description: string
  action: string
  tools: string[]
  expectedOutput: string
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  result?: any
}

export interface ReasoningChain {
  steps: ReasoningStep[]
  conclusion: string
  confidence: number
}

export interface ReasoningStep {
  thought: string
  action: string
  observation: string
  nextThought?: string
}

export interface Reflection {
  quality: 'high' | 'medium' | 'low'
  confidence: number
  concerns: string[]
  improvements: string[]
  nextActions: string[]
}

export interface AgentResponse {
  summary: string
  detailedAnalysis: string
  recommendations: string[]
  nextSteps: string[]
  reasoningChain?: ReasoningChain
  reflection?: Reflection
  metadata: {
    subject: string
    analysisTime: number
    dataPoints: number
    confidenceLevel: number
  }
}

// ============================================
// 英语学科特定类型
// ============================================

export type EnglishSkillType =
  | 'grammar'        // 语法
  | 'vocabulary'     // 词汇
  | 'reading'        // 阅读
  | 'writing'        // 写作
  | 'listening'      // 听力
  | 'speaking'       // 口语
  | 'translation'    // 翻译

export type EnglishQuestionType =
  | 'multiple_choice'     // 选择题
  | 'fill_blank'          // 填空题
  | 'sentence_completion' // 完成句子
  | 'reading_comprehension' // 阅读理解
  | 'error_correction'    // 改错题
  | 'translation'         // 翻译题
  | 'writing_task'        // 写作任务
  | 'listening_task'      // 听力任务

export interface EnglishKnowledgePoint {
  id: string
  name: string
  category: EnglishSkillType
  subcategory?: string  // 例如：时态、从句、非谓语动词等
  level: 'basic' | 'intermediate' | 'advanced'
  description: string
  prerequisites: string[]  // 前置知识点
  relatedPoints: string[]  // 相关知识点
}

export interface EnglishWrongQuestionAnalysis {
  questionId: string
  questionType: EnglishQuestionType
  skillType: EnglishSkillType
  knowledgePoint: string
  errorType: EnglishErrorType
  userAnswer: string
  correctAnswer: string
  errorAnalysis: string
  suggestion: string
}

export type EnglishErrorType =
  | 'grammar_mistake'       // 语法错误
  | 'vocabulary_lack'       // 词汇缺乏
  | 'vocabulary_misuse'     // 词汇误用
  | 'comprehension_error'   // 理解错误
  | 'spelling_mistake'      // 拼写错误
  | 'sentence_structure'    // 句子结构
  | 'logic_error'          // 逻辑错误
  | 'cultural_difference'  // 文化差异
  | 'carelessness'         // 粗心
  | 'unknown'              // 未知

// ============================================
// 英语学科学习状态评估
// ============================================

export interface EnglishLearningState {
  userId: string
  subject: 'english'
  overallScore: number
  skillScores: {
    grammar: number
    vocabulary: number
    reading: number
    writing: number
    listening: number
    speaking: number
  }
  trends: {
    shortTerm: 'improving' | 'stable' | 'declining'
    longTerm: 'improving' | 'stable' | 'declining'
  }
  keyStrengths: EnglishStrength[]
  keyWeaknesses: EnglishWeakness[]
  learningPatterns: EnglishLearningPattern[]
  recommendations: EnglishRecommendation[]
}

export interface EnglishStrength {
  skillType: EnglishSkillType
  description: string
  evidence: string[]
  level: number
}

export interface EnglishWeakness {
  skillType: EnglishSkillType
  knowledgePoint?: string
  description: string
  rootCause: string
  severity: 'high' | 'medium' | 'low'
  remediation: string[]
}

export interface EnglishLearningPattern {
  pattern: string
  description: string
  examples: string[]
  implication: string
}

export interface EnglishRecommendation {
  category: 'study_method' | 'practice' | 'resource' | 'habit'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionableSteps: string[]
  timeframe: string
  expectedOutcome: string
}

// ============================================
// 工具相关类型
// ============================================

export interface Tool {
  name: string
  description: string
  parameters: any
  handler: Function
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
}

// ============================================
// 英语学科知识图谱节点
// ============================================

export interface EnglishKnowledgeGraphNode {
  id: string
  name: string
  category: EnglishSkillType
  level: string
  description: string
  dependencies: string[]
}

export interface EnglishKnowledgeGraphEdge {
  from: string
  to: string
  type: 'prerequisite' | 'related' | 'extends' | 'applies'
  weight: number
}

export interface EnglishKnowledgeGraph {
  nodes: EnglishKnowledgeGraphNode[]
  edges: EnglishKnowledgeGraphEdge[]
}
