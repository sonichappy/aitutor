/**
 * 英语学科深入分析 API
 *
 * 提供基于 Deep Research Agent 的英语学习深度分析
 */

import { NextRequest, NextResponse } from 'next/server'
import { createEnglishDeepResearchAgent } from '@/lib/agent/EnglishDeepResearchAgent'
import { saveDeepResearchReport } from '@/lib/storage'
import { getModelInfo } from '@/lib/ai/llm'
import { promises as fs } from 'fs'
import path from 'path'

// 数据目录
const DATA_DIR = path.join(process.cwd(), 'data')
const EXAMS_DIR = path.join(DATA_DIR, 'exams')

// 分析请求参数
interface AnalyzeRequest {
  analysisType?: 'comprehensive' | 'grammar' | 'vocabulary' | 'reading' | 'writing'
  timeRange?: {
    start: string  // ISO date string
    end: string    // ISO date string
  }
  focusAreas?: string[]
  timeframe?: 'week' | 'month' | 'quarter'
}

/**
 * 获取所有英语试卷数据
 */
async function getAllEnglishExams(): Promise<any[]> {
  try {
    const englishDir = path.join(EXAMS_DIR, '英语')
    const entries = await fs.readdir(englishDir, { withFileTypes: true })

    const exams: any[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const examDir = path.join(englishDir, entry.name)
      const jsonPath = path.join(examDir, 'exam.json')

      try {
        const content = await fs.readFile(jsonPath, 'utf-8')
        const exam = JSON.parse(content)
        exams.push(exam)
      } catch {
        // 跳过无法读取的试卷
      }
    }

    return exams
  } catch {
    return []
  }
}

/**
 * 从试卷数据中提取元数据
 */
async function extractReportMetadata() {
  try {
    // 获取 AI 模型信息
    const modelInfo = getModelInfo()
    const modelName = `${modelInfo.provider} ${modelInfo.model}`

    const exams = await getAllEnglishExams()
    if (!exams || exams.length === 0) {
      return {
        reportType: '学科状态深入分析报告',
        questionTypes: [] as string[],
        knowledgePoints: [] as string[],
        modelName,
        analysisDurationFormatted: ''
      }
    }

    // 获取题目类型集合
    const questionTypes = new Set<string>()
    // 获取知识点集合
    const knowledgePoints = new Set<string>()
    // 统计题目数量
    let totalQuestions = 0
    let wrongQuestionsCount = 0

    // 获取时间范围
    const dates = exams.map((e: any) => new Date(e.date).getTime()).filter((d: number) => !isNaN(d))
    const examTimeRange = dates.length > 0 ? {
      start: new Date(Math.min(...dates)).toISOString(),
      end: new Date(Math.max(...dates)).toISOString()
    } : undefined

    // 遍历所有试卷收集数据
    exams.forEach((exam: any) => {
      if (exam.questions) {
        exam.questions.forEach((q: any) => {
          totalQuestions++
          if (q.isWrong) wrongQuestionsCount++

          // 收集题目类型
          if (q.type) questionTypes.add(q.type)

          // 收集知识点
          if (q.knowledgePoints) {
            q.knowledgePoints.forEach((kp: string) => knowledgePoints.add(kp))
          }
          if (q.knowledgePoint) {
            knowledgePoints.add(q.knowledgePoint)
          }
        })
      }
    })

    return {
      reportType: '学科状态深入分析报告',
      examTimeRange,
      totalQuestions,
      wrongQuestionsCount,
      questionTypes: Array.from(questionTypes),
      knowledgePoints: Array.from(knowledgePoints),
      modelName,
      analysisDurationFormatted: '' // 会在保存时填充
    }
  } catch (error) {
    console.error('Failed to extract report metadata:', error)
    return null
  }
}

// POST - 执行英语学科深入分析
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const startTime = Date.now()

    // 创建智能体实例
    const agent = createEnglishDeepResearchAgent({
      enableReflection: true,
      maxIterations: 5
    })

    // 执行分析
    const result = await agent.analyze({
      subject: '英语',
      timeRange: body.timeRange,
      focusAreas: body.focusAreas,
      analysisType: body.analysisType || 'comprehensive'
    })

    const analysisTime = Date.now() - startTime

    // 提取元数据
    const reportMetadata = await extractReportMetadata()
    if (reportMetadata) {
      reportMetadata.analysisDurationFormatted = `${(analysisTime / 1000).toFixed(1)}秒`
    }

    // 保存深度分析报告
    const savedReport = await saveDeepResearchReport({
      userId: 'user-1',
      subject: '英语',
      subjectId: 'english',
      analysisType: body.analysisType || 'comprehensive',
      generatedAt: new Date().toISOString(),
      analysisTime,
      summary: result.summary,
      detailedAnalysis: result.detailedAnalysis,
      recommendations: result.recommendations,
      nextSteps: result.nextSteps,
      reasoningChain: result.reasoningChain,
      reflection: result.reflection,
      reportMetadata: reportMetadata || undefined,
      metadata: result.metadata
    })

    // 返回结果
    return NextResponse.json({
      success: true,
      result: {
        analysisType: body.analysisType || 'comprehensive',
        summary: result.summary,
        detailedAnalysis: result.detailedAnalysis,
        recommendations: result.recommendations,
        nextSteps: result.nextSteps,
        metadata: result.metadata,
        reportMetadata,
        reportId: savedReport.id,
        reportPath: `/data/reports/english/${savedReport.id}/report.md`
      }
    })

  } catch (error: any) {
    console.error('[English Agent API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '分析失败',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// GET - 获取分析选项
export async function GET() {
  return NextResponse.json({
    analysisTypes: [
      {
        value: 'comprehensive',
        label: '综合分析',
        description: '全面分析语法、词汇、阅读、写作等各项能力'
      },
      {
        value: 'grammar',
        label: '语法分析',
        description: '深入分析语法知识掌握情况'
      },
      {
        value: 'vocabulary',
        label: '词汇分析',
        description: '评估词汇量和词汇运用能力'
      },
      {
        value: 'reading',
        label: '阅读分析',
        description: '分析阅读理解能力和策略'
      },
      {
        value: 'writing',
        label: '写作分析',
        description: '评估写作能力和常见问题'
      }
    ],
    timeframes: [
      { value: 'week', label: '一周', description: '短期快速提升计划' },
      { value: 'month', label: '一个月', description: '中期系统提升计划' },
      { value: 'quarter', label: '三个月', description: '长期全面提高计划' }
    ],
    focusAreas: [
      '语法时态',
      '词汇记忆',
      '阅读理解',
      '写作表达',
      '听力训练',
      '口语练习'
    ]
  })
}
