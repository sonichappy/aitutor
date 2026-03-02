// 用户相关类型
export interface User {
  id: string
  name: string | null
  email: string | null
  grade: number
  createdAt: Date
}

// 会话相关类型
export interface Session {
  id: string
  userId: string
  subject: string
  startTime: Date
  endTime: Date | null
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

// 题目相关类型
export interface Question {
  id: string
  userId: string
  subject: string
  content: string
  userAnswer: string | null
  isCorrect: boolean | null
  knowledgePoints: string[]
  difficulty: number | null
  createdAt: Date
}

// 知识点相关类型
export interface KnowledgePoint {
  id: string
  userId: string
  name: string
  subject: string
  masteryLevel: number
  practiceCount: number
  correctCount: number
  correctRate: number
  lastPracticed: Date | null
}

// 学习分析报告类型
export interface LearningReport {
  userId: string
  subject: string
  overallMastery: number
  weakPoints: string[]
  strongPoints: string[]
  recommendations: string[]
  generatedAt: Date
}

// AI 聊天响应类型
export interface ChatResponse {
  content: string
  relatedKnowledgePoints?: string[]
  suggestedQuestions?: string[]
}
