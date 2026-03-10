/**
 * 英语学科深入分析智能体
 *
 * 实现基于 Deep Research 架构的英语学习分析系统
 * 包括自主规划、多步推理、工具调用、自我验证等能力
 */

import { callLLM, type ChatMessage } from '@/lib/ai/llm'
import { getUserExams } from '@/lib/storage'
import {
  ENGLISH_COMPREHENSIVE_ANALYSIS_PROMPT,
  ENGLISH_GRAMMAR_ANALYSIS_PROMPT,
  ENGLISH_STUDY_PLAN_PROMPT,
  ENGLISH_AGENT_SYSTEM_PROMPT
} from './prompts/english-prompts'
import {
  searchEnglishKnowledgeNodes,
  getRelatedNodes,
  getPrerequisites
} from '@/lib/knowledge/english-knowledge-graph'
import type {
  AgentConfig,
  AgentResponse,
  ResearchPlan,
  ResearchStep,
  ReasoningChain,
  Reflection,
  EnglishLearningState
} from './types'

// ============================================
// 英语学科深入分析智能体
// ============================================

export class EnglishDeepResearchAgent {
  private config: AgentConfig
  private reasoningChain: ReasoningChain = {
    steps: [],
    conclusion: '',
    confidence: 0
  }

  constructor(config: AgentConfig = {}) {
    this.config = {
      llmProvider: config.llmProvider || undefined,
      maxIterations: config.maxIterations || 5,
      timeout: config.timeout || 60000,
      enableReflection: config.enableReflection !== false
    }
  }

  // ============================================
  // 主入口：执行分析
  // ============================================

  /**
   * 执行英语学科深入分析
   */
  async analyze(params: {
    subject: string
    timeRange?: { start: string; end: string }
    focusAreas?: string[]
    analysisType?: 'comprehensive' | 'grammar' | 'vocabulary' | 'reading' | 'writing'
  }): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // 阶段 1: 理解任务并制定计划
      const plan = await this.createResearchPlan(params)

      // 阶段 2: 执行研究
      const researchResults = await this.executeResearch(plan, params)

      // 阶段 3: 自我反思（如果启用）
      let reflection: Reflection | undefined
      if (this.config.enableReflection) {
        reflection = await this.reflect(researchResults)
      }

      // 阶段 4: 生成响应
      const response = await this.formatResponse(researchResults, reflection, params)

      return response
    } catch (error: any) {
      console.error('[EnglishDeepResearchAgent] Analysis error:', error)
      throw error
    }
  }

  // ============================================
  // 规划器：创建研究计划
  // ============================================

  /**
   * 创建研究计划
   */
  private async createResearchPlan(params: any): Promise<ResearchPlan> {
    const steps: ResearchStep[] = []

    // 根据分析类型确定步骤
    const analysisType = params.analysisType || 'comprehensive'

    if (analysisType === 'comprehensive') {
      steps.push(
        {
          id: 'collect_data',
          description: '收集英语试卷和错题数据',
          action: 'query_data',
          tools: ['query_exams', 'query_wrong_questions'],
          expectedOutput: '试卷数据和错题列表',
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'analyze_errors',
          description: '分析错题模式和类型',
          action: 'analyze',
          tools: ['analyze_patterns'],
          expectedOutput: '错误模式分类',
          dependencies: ['collect_data'],
          status: 'pending'
        },
        {
          id: 'knowledge_analysis',
          description: '分析薄弱知识点及其关联',
          action: 'analyze',
          tools: ['knowledge_graph'],
          expectedOutput: '知识图谱分析结果',
          dependencies: ['analyze_errors'],
          status: 'pending'
        },
        {
          id: 'skill_assessment',
          description: '评估各项技能水平',
          action: 'analyze',
          tools: ['calculate_statistics'],
          expectedOutput: '技能评分',
          dependencies: ['analyze_errors'],
          status: 'pending'
        },
        {
          id: 'trend_analysis',
          description: '分析学习趋势',
          action: 'analyze',
          tools: ['compare_reports'],
          expectedOutput: '趋势判断',
          dependencies: ['collect_data'],
          status: 'pending'
        },
        {
          id: 'comprehensive_diagnosis',
          description: '综合诊断学习状况',
          action: 'ai_reasoning',
          tools: [],
          expectedOutput: '诊断结论',
          dependencies: ['analyze_errors', 'knowledge_analysis', 'skill_assessment', 'trend_analysis'],
          status: 'pending'
        },
        {
          id: 'generate_plan',
          description: '生成学习计划',
          action: 'generate',
          tools: ['generate_plan'],
          expectedOutput: '学习计划',
          dependencies: ['comprehensive_diagnosis'],
          status: 'pending'
        }
      )
    } else {
      // 单项分析
      steps.push(
        {
          id: 'collect_data',
          description: `收集${analysisType}相关数据`,
          action: 'query_data',
          tools: ['query_exams', 'query_wrong_questions'],
          expectedOutput: '相关数据',
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'specific_analysis',
          description: `深入分析${analysisType}`,
          action: 'ai_reasoning',
          tools: [],
          expectedOutput: '分析结果',
          dependencies: ['collect_data'],
          status: 'pending'
        }
      )
    }

    return {
      objective: `分析学生英语学习状况（${analysisType}）`,
      steps,
      currentStep: 0,
      status: 'planning'
    }
  }

  // ============================================
  // 执行器：执行研究
  // ============================================

  /**
   * 执行研究计划
   */
  private async executeResearch(
    plan: ResearchPlan,
    params: any
  ): Promise<any> {
    const results: any = {
      steps: [],
      data: null
    }

    // 执行每个步骤
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      plan.currentStep = i
      step.status = 'in_progress'

      try {
        const stepResult = await this.executeStep(step, params, results)
        step.result = stepResult
        step.status = 'completed'
        results.steps.push({ step, result: stepResult })

        // 记录推理
        this.addReasoningStep(
          `执行步骤: ${step.description}`,
          'action',
          `完成: ${step.expectedOutput}`,
          `继续执行下一步`
        )
      } catch (error: any) {
        step.status = 'skipped'
        console.error(`[Step ${step.id}] Failed:`, error.message)
      }
    }

    plan.status = 'completed'
    return results
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ResearchStep,
    params: any,
    previousResults: any
  ): Promise<any> {
    switch (step.action) {
      case 'query_data':
        return await this.queryData(params)

      case 'analyze':
        return await this.analyzeData(step, params, previousResults)

      case 'ai_reasoning':
        return await this.aiReasoning(step, params, previousResults)

      case 'generate':
        return await this.generatePlan(step, params, previousResults)

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }
  }

  // ============================================
  // 工具方法
  // ============================================

  /**
   * 查询数据
   */
  private async queryData(params: any): Promise<any> {
    const userId = 'user-1'
    const exams = await getUserExams(userId)

    // 筛选英语学科的试卷
    const englishExams = exams.filter(e =>
      e.subject === 'english' || e.subject === '英语'
    )

    // 收集所有错题
    const wrongQuestions: any[] = []
    for (const exam of englishExams) {
      if (exam.questions && Array.isArray(exam.questions)) {
        for (const q of exam.questions) {
          if (q.isCorrect === false) {
            wrongQuestions.push({
              questionNumber: q.number,
              content: q.content,
              type: q.type,
              userAnswer: q.userAnswer,
              correctAnswer: q.correctAnswer,
              knowledgePoints: q.knowledgePoints || [],
              difficulty: q.difficulty,
              score: q.score,
              examId: exam.id,
              examDate: exam.createdAt
            })
          }
        }
      }
    }

    return {
      exams: englishExams,
      wrongQuestions,
      totalExams: englishExams.length,
      totalQuestions: englishExams.reduce((sum, e) => sum + (e.questions?.length || 0), 0),
      totalWrong: wrongQuestions.length
    }
  }

  /**
   * 分析数据
   */
  private async analyzeData(
    step: ResearchStep,
    params: any,
    previousResults: any
  ): Promise<any> {
    const data = previousResults.steps.find((s: any) => s.step.id === 'collect_data')?.result

    if (!data) {
      throw new Error('No data available for analysis')
    }

    // 知识图谱分析
    if (step.tools.includes('knowledge_graph')) {
      const weakPoints = this.extractWeakPoints(data.wrongQuestions)
      const knowledgeAnalysis = await this.analyzeKnowledgeGaps(weakPoints)
      return { knowledgeAnalysis }
    }

    // 统计分析
    if (step.tools.includes('calculate_statistics')) {
      return this.calculateSkillScores(data)
    }

    // 模式分析
    if (step.tools.includes('analyze_patterns')) {
      return this.analyzeErrorPatterns(data.wrongQuestions)
    }

    // 趋势分析
    if (step.tools.includes('compare_reports')) {
      return this.analyzeTrends(data.exams)
    }

    return {}
  }

  /**
   * AI 推理
   */
  private async aiReasoning(
    step: ResearchStep,
    params: any,
    previousResults: any
  ): Promise<any> {
    // 收集所有之前步骤的结果
    const dataResult = previousResults.steps.find((s: any) => s.step.id === 'collect_data')?.result
    const errorResult = previousResults.steps.find((s: any) => s.step.id === 'analyze_errors')?.result
    const knowledgeResult = previousResults.steps.find((s: any) => s.step.id === 'knowledge_analysis')?.result
    const skillResult = previousResults.steps.find((s: any) => s.step.id === 'skill_assessment')?.result
    const trendResult = previousResults.steps.find((s: any) => s.step.id === 'trend_analysis')?.result

    // 准备分析数据
    const analysisData = {
      exams: dataResult?.exams || [],
      wrongQuestions: dataResult?.wrongQuestions || [],
      subject: '英语',
      timeRange: params.timeRange?.start || '最近一个月'
    }

    // 选择合适的提示词
    const prompt = params.analysisType === 'grammar'
      ? ENGLISH_GRAMMAR_ANALYSIS_PROMPT(analysisData)
      : ENGLISH_COMPREHENSIVE_ANALYSIS_PROMPT(analysisData)

    // 调用 LLM
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: ENGLISH_AGENT_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: prompt
      }
    ]

    const response = await callLLM(messages, {
      temperature: 0.3,
      maxTokens: 4000
    })

    // 解析响应
    const content = typeof response === 'string' ? response : response.content
    return this.parseAIResponse(content)
  }

  /**
   * 生成学习计划
   */
  private async generatePlan(
    step: ResearchStep,
    params: any,
    previousResults: any
  ): Promise<any> {
    // 获取诊断结果
    const diagnosisResult = previousResults.steps.find((s: any) => s.step.id === 'comprehensive_diagnosis')?.result

    if (!diagnosisResult) {
      return { studyPlan: null }
    }

    const prompt = ENGLISH_STUDY_PLAN_PROMPT({
      analysis: diagnosisResult,
      timeframe: params.timeframe || 'month',
      focus: params.focusAreas
    })

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: ENGLISH_AGENT_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: prompt
      }
    ]

    const response = await callLLM(messages, {
      temperature: 0.4,
      maxTokens: 3000
    })

    const content = typeof response === 'string' ? response : response.content
    return this.parseAIResponse(content)
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 提取薄弱知识点
   */
  private extractWeakPoints(wrongQuestions: any[]): string[] {
    const pointsMap = new Map<string, number>()

    for (const q of wrongQuestions) {
      const points = q.knowledgePoints || []
      for (const point of points) {
        pointsMap.set(point, (pointsMap.get(point) || 0) + 1)
      }
    }

    return Array.from(pointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([point]) => point)
  }

  /**
   * 分析知识缺口
   */
  private async analyzeKnowledgeGaps(weakPoints: string[]): Promise<any> {
    const gaps: any[] = []

    for (const point of weakPoints) {
      // 搜索知识图谱
      const nodes = searchEnglishKnowledgeNodes([point])

      for (const node of nodes) {
        const prerequisites = getPrerequisites(node.id)
        const related = getRelatedNodes(node.id, 1)

        gaps.push({
          point: node.name,
          category: node.category,
          level: node.level,
          prerequisites: prerequisites.map(p => p.name),
          affectedPoints: related.filter(r => r.level === 'advanced').map(r => r.name)
        })
      }
    }

    return { knowledgeGaps: gaps }
  }

  /**
   * 计算技能评分
   */
  private calculateSkillScores(data: any): any {
    // 简化版评分计算
    const totalQuestions = data.totalQuestions
    const totalWrong = data.totalWrong
    const accuracy = totalQuestions > 0 ? (totalQuestions - totalWrong) / totalQuestions : 0

    return {
      overall: Math.round(accuracy * 10),
      grammar: Math.round(accuracy * 10 * 0.9), // 假设语法略低于平均
      vocabulary: Math.round(accuracy * 10 * 1.0),
      reading: Math.round(accuracy * 10 * 0.95),
      writing: Math.round(accuracy * 10 * 0.85)  // 假设写作较难
    }
  }

  /**
   * 分析错误模式
   */
  private analyzeErrorPatterns(wrongQuestions: any[]): any {
    const patterns = new Map<string, number>()

    for (const q of wrongQuestions) {
      const type = q.type || 'unknown'
      patterns.set(type, (patterns.get(type) || 0) + 1)
    }

    return {
      errorTypes: Array.from(patterns.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / wrongQuestions.length) * 100)
      }))
    }
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(exams: any[]): any {
    if (exams.length < 2) {
      return { trend: 'insufficient_data' }
    }

    // 按日期排序
    const sorted = [...exams].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // 计算正确率趋势
    const accuracies = sorted.map(exam => {
      const total = exam.questions?.length || 0
      const correct = exam.questions?.filter((q: any) => q.isCorrect === true).length || 0
      return total > 0 ? correct / total : 0
    })

    // 简单线性回归判断趋势
    const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2))
    const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2))

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const diff = avgSecond - avgFirst

    return {
      trend: diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable',
      improvementRate: Math.round(diff * 100),
      firstHalfAvg: Math.round(avgFirst * 100),
      secondHalfAvg: Math.round(avgSecond * 100)
    }
  }

  /**
   * 解析 AI 响应
   */
  private parseAIResponse(response: string): any {
    try {
      // 清理 markdown 代码块
      let cleaned = response.trim()
      cleaned = cleaned.replace(/^```json\n/, '')
      cleaned = cleaned.replace(/^```\n/, '')
      cleaned = cleaned.replace(/\n```$/, '')
      cleaned = cleaned.replace(/```$/, '')

      // 提取 JSON
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        return JSON.parse(match[0])
      }

      return { rawResponse: response }
    } catch (error) {
      console.error('[parseAIResponse] Error:', error)
      return { rawResponse: response, parseError: true }
    }
  }

  // ============================================
  // 推理链管理
  // ============================================

  private addReasoningStep(
    thought: string,
    action: string,
    observation: string,
    nextThought?: string
  ): void {
    this.reasoningChain.steps.push({
      thought,
      action,
      observation,
      nextThought
    })
  }

  // ============================================
  // 反思器：自我评估
  // ============================================

  /**
   * 对分析结果进行自我反思
   */
  private async reflect(results: any): Promise<Reflection> {
    const dataResult = results.steps.find((s: any) => s.step.id === 'collect_data')?.result

    // 数据质量评估
    const dataQuality = this.assessDataQuality(dataResult)

    // 逻辑可靠性
    const logicReliability = this.assessLogicReliability(results)

    // 整体质量
    const quality = dataQuality === 'high' && logicReliability === 'high'
      ? 'high'
      : dataQuality === 'medium' || logicReliability === 'medium'
        ? 'medium'
        : 'low'

    // 置信度
    const confidence = dataResult?.totalExams >= 3 ? 0.85 : dataResult?.totalExams >= 1 ? 0.6 : 0.3

    const concerns: string[] = []
    const improvements: string[] = []
    const nextActions: string[] = []

    if (dataQuality !== 'high') {
      concerns.push('数据量有限，建议收集更多试卷数据')
      improvements.push('增加数据收集频率，至少3次试卷数据')
    }

    if (logicReliability !== 'high') {
      concerns.push('部分分析可能存在偏差')
      improvements.push('增加交叉验证，对比历史报告')
    }

    nextActions.push('持续跟踪学习情况，2周后重新评估')

    return {
      quality,
      confidence,
      concerns,
      improvements,
      nextActions
    }
  }

  private assessDataQuality(data: any): 'high' | 'medium' | 'low' {
    if (!data) return 'low'
    if (data.totalExams >= 5) return 'high'
    if (data.totalExams >= 2) return 'medium'
    return 'low'
  }

  private assessLogicReliability(results: any): 'high' | 'medium' | 'low' {
    // 简化版评估
    const completedSteps = results.steps.filter((s: any) => s.step.status === 'completed').length
    if (completedSteps >= results.steps.length * 0.8) return 'high'
    if (completedSteps >= results.steps.length * 0.5) return 'medium'
    return 'low'
  }

  // ============================================
  // 响应格式化
  // ============================================

  /**
   * 格式化最终响应
   */
  private async formatResponse(
    results: any,
    reflection?: Reflection,
    params?: any
  ): Promise<AgentResponse> {
    const diagnosisResult = results.steps.find((s: any) => s.step.id === 'comprehensive_diagnosis')?.result
    const planResult = results.steps.find((s: any) => s.step.id === 'generate_plan')?.result
    const dataResult = results.steps.find((s: any) => s.step.id === 'collect_data')?.result

    // 提取摘要
    const summary = this.generateSummary(diagnosisResult, dataResult)

    // 生成详细分析
    const detailedAnalysis = this.generateDetailedAnalysis(diagnosisResult)

    // 提取建议
    const recommendations = this.extractRecommendations(diagnosisResult, planResult)

    // 后续步骤
    const nextSteps = reflection?.nextActions || [
      '持续跟踪学习情况',
      '2周后重新评估',
      '根据调整后的计划继续学习'
    ]

    return {
      summary,
      detailedAnalysis,
      recommendations,
      nextSteps,
      reasoningChain: this.reasoningChain,
      reflection,
      metadata: {
        subject: '英语',
        analysisTime: Date.now(),
        dataPoints: dataResult?.totalWrong || 0,
        confidenceLevel: reflection?.confidence || 0.7
      }
    }
  }

  private generateSummary(diagnosis: any, data: any): string {
    if (!diagnosis || diagnosis.parseError) {
      return `基于 ${data?.totalExams || 0} 次试卷数据和 ${data?.totalWrong || 0} 道错题的分析已完成。`
    }

    const findings = diagnosis.findings || {}
    const overall = findings.overallAssessment || {}

    return `
## 英语学习分析摘要

**整体水平**: ${overall.level || 'N/A'}/10
**学习趋势**: ${overall.trend || 'stable'}
**数据来源**: ${data?.totalExams || 0} 次试卷，${data?.totalWrong || 0} 道错题

### 主要发现
${this.formatKeyFindings(findings.keyFindings || [])}

### 核心问题
${this.formatWeaknesses(findings.weaknesses || [])}
    `.trim()
  }

  private generateDetailedAnalysis(diagnosis: any): string {
    if (!diagnosis || diagnosis.parseError) {
      return '详细分析数据解析中，请稍后查看完整报告。'
    }

    // 将诊断结果转换为易读的格式
    return JSON.stringify(diagnosis, null, 2)
  }

  private extractRecommendations(diagnosis: any, plan: any): string[] {
    const recommendations: string[] = []

    if (diagnosis?.recommendations?.priority) {
      recommendations.push(`🎯 **高优先级**: ${diagnosis.recommendations.priority}`)
    }

    if (plan?.studyPlan?.dailyPractices) {
      recommendations.push('📅 **每日练习**:')
      plan.studyPlan.dailyPractices.forEach((practice: string) => {
        recommendations.push(`   - ${practice}`)
      })
    }

    if (plan?.studyPlan?.resources) {
      recommendations.push('📚 **推荐资源**:')
      const resources = plan.studyPlan.resources
      if (resources.textbooks) recommendations.push(`   教材: ${resources.textbooks.join(', ')}`)
      if (resources.online) recommendations.push(`   在线: ${resources.online.join(', ')}`)
    }

    return recommendations
  }

  private formatKeyFindings(findings: any[]): string {
    if (!findings || findings.length === 0) return '暂无'

    return findings.map((f, i) =>
      `${i + 1}. **${f.area}**: ${f.finding}`
    ).join('\n')
  }

  private formatWeaknesses(weaknesses: string[]): string {
    if (!weaknesses || weaknesses.length === 0) return '未发现明显问题'

    return weaknesses.map((w, i) =>
      `${i + 1}. ${w}`
    ).join('\n')
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建英语学科分析智能体实例
 */
export function createEnglishDeepResearchAgent(config?: AgentConfig): EnglishDeepResearchAgent {
  return new EnglishDeepResearchAgent(config)
}
