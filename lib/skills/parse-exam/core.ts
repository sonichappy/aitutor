/**
 * 试卷解析核心模块
 *
 * 这个模块不依赖 Claude Code 或 Next.js，可以：
 * 1. 在 Claude Code Skills 中调用
 * 2. 在 Next.js API Routes 中调用
 * 3. 在 Node.js CLI 脚本中调用
 * 4. 未来独立部署为微服务
 */

import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { cleanParsedQuestions } from "@/lib/image-utils"
import { matchSubjectToIntelligent } from "@/lib/subject-utils"
import { saveExamData, saveExamImage } from "@/lib/storage"

// ============================================
// 类型定义
// ============================================

export interface ParseExamInput {
  // 图片数据（base64 格式）
  image: {
    data: string        // data:image/jpeg;base64,...
    mimeType: string
    size: number
  }
  // 可选参数
  subject?: string
  customPrompt?: string
  userId?: string
}

export interface ParseExamResult {
  success: boolean
  examId?: string
  examData?: any
  questions?: any[]
  error?: string
  metadata?: {
    provider: string
    model: string
    parseTime: number
  }
}

// ============================================
// 核心解析函数
// ============================================

/**
 * 解析试卷图片
 *
 * @param input 输入参数
 * @returns 解析结果
 */
export async function parseExamImage(input: ParseExamInput): Promise<ParseExamResult> {
  const startTime = Date.now()

  try {
    // 1. 验证输入
    if (!input.image?.data) {
      return {
        success: false,
        error: "图片数据不能为空"
      }
    }

    const base64Image = input.image.data
    const userId = input.userId || "user-1"
    const customPrompt = input.customPrompt

    // 2. 调用 AI 进行 OCR 和解析
    const parseResult = await callAIForParsing(base64Image, customPrompt)

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error
      }
    }

    // 3. 处理解析结果
    const processedResult = await processParsedData(
      parseResult.data!,
      input.subject,
      userId,
      customPrompt
    )

    // 4. 保存数据
    await saveProcessedData(processedResult)

    const parseTime = Date.now() - startTime

    return {
      success: true,
      examId: processedResult.examId,
      examData: processedResult.examDataForClient,
      questions: processedResult.questions,
      metadata: {
        provider: parseResult.metadata?.provider || "unknown",
        model: parseResult.metadata?.model || "unknown",
        parseTime
      }
    }
  } catch (error: any) {
    console.error("[parseExamImage] Error:", error)
    return {
      success: false,
      error: error.message || "解析失败"
    }
  }
}

// ============================================
// 内部函数
// ============================================

/**
 * 调用 AI 进行 OCR 和解析
 */
async function callAIForParsing(
  base64Image: string,
  customPrompt?: string
): Promise<{
  success: boolean
  data?: any
  error?: string
  metadata?: { provider: string; model: string }
}> {
  try {
    // 检查 AI 提供商是否支持图片
    const provider = process.env.AI_PROVIDER || "deepseek"
    const visionProviders = ["dashscope", "openai", "anthropic", "gemini"]

    if (!visionProviders.includes(provider)) {
      return {
        success: false,
        error: `当前 ${provider} 不支持图片解析`
      }
    }

    // 准备提示词
    const defaultPrompt = getDefaultPrompt()
    const finalPrompt = customPrompt?.trim() || defaultPrompt

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: getSystemPrompt()
      },
      {
        role: "user",
        content: finalPrompt,
        images: [base64Image],
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.1,
      maxTokens: 8000,
    })

    // 解析 AI 返回的 JSON
    const parsed = parseAIResponse(response)

    return {
      success: true,
      data: parsed,
      metadata: {
        provider: getProviderName(),
        model: getModelName()
      }
    }
  } catch (error: any) {
    console.error("[callAIForParsing] Error:", error)
    return {
      success: false,
      error: error.message || "AI 调用失败"
    }
  }
}

/**
 * 处理解析后的数据
 */
async function processParsedData(
  parsed: any,
  preferredSubject: string | undefined,
  userId: string,
  customPrompt?: string
) {
  // 清理和验证题目
  let questions = parsed.questions || []
  questions = normalizeQuestions(questions)
  const cleanedQuestions = cleanParsedQuestions(questions)

  // 计算统计数据
  const avgDifficulty = calculateAvgDifficulty(cleanedQuestions)
  const questionTypeStats = calculateQuestionTypeStats(cleanedQuestions)

  // 生成试卷 ID
  const examId = `exam-${Date.now()}`

  // 获取时间
  const chinaTime = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-')

  // 智能匹配学科
  let detectedSubject = parsed.detectedSubject

  if (!detectedSubject) {
    detectedSubject = inferSubjectFromContent(parsed)
  }

  const questionContext = parsed.rawText || JSON.stringify(cleanedQuestions.slice(0, 3) || [])
  const { folderName, matchedSubject } = await matchSubjectToIntelligent(detectedSubject, questionContext)

  // 构建考试数据
  const examData = {
    id: examId,
    userId,
    subject: folderName,
    subjectName: matchedSubject?.name || detectedSubject,
    rawText: parsed.rawText || "",
    questions: cleanedQuestions,
    createdAt: chinaTime,
    metadata: {
      detectedSubject: parsed.detectedSubject,
      overallDifficulty: parsed.overallDifficulty || Math.round(avgDifficulty),
      estimatedTime: parsed.estimatedTime || cleanedQuestions.length * 5,
      knowledgePointsSummary: parsed.knowledgePointsSummary || [],
      questionTypeStats,
      isEssay: parsed.isEssay || false,
      essayType: parsed.essayType || null,
      customPrompt: customPrompt?.trim() || undefined,
    },
  }

  // 返回给客户端的数据（不包含大图片）
  const examDataForClient = {
    id: examId,
    userId,
    subject: folderName,
    subjectName: matchedSubject?.name || detectedSubject,
    imageUrl: `/api/exam/${examId}/image`,
    rawText: parsed.rawText || "",
    questions: parsed.questions || [],
    createdAt: new Date().toISOString(),
  }

  return {
    examId,
    examData,
    examDataForClient,
    questions: cleanedQuestions,
    base64Image: parsed.base64Image // 需要保留以便保存
  }
}

/**
 * 保存处理后的数据
 */
async function saveProcessedData(result: {
  examId: string
  examData: any
  base64Image?: string
}) {
  if (result.base64Image) {
    // 先保存数据（创建目录）
    await saveExamData(result.examId, result.examData)
    // 再保存图片
    await saveExamImage(result.examId, result.base64Image)
  }
}

// ============================================
// 工具函数
// ============================================

function getProviderName(): string {
  const provider = process.env.AI_PROVIDER || "deepseek"
  const names: Record<string, string> = {
    deepseek: "DeepSeek",
    dashscope: "通义千问",
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Google Gemini"
  }
  return names[provider] || provider
}

function getModelName(): string {
  const provider = process.env.AI_PROVIDER || "deepseek"
  const models: Record<string, string> = {
    deepseek: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    dashscope: process.env.DASHSCOPE_MODEL || "qwen-plus",
    openai: process.env.OPENAI_MODEL || "gpt-4o",
    anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-4",
    gemini: process.env.GEMINI_MODEL || "gemini-1.5-flash"
  }
  return models[provider] || "unknown"
}

function inferSubjectFromContent(parsed: any): string {
  // 简化版学科推断
  const rawText = (parsed.rawText || "").toLowerCase()

  // 检查是否是英语
  const englishMatches = rawText.match(/[a-zA-Z]{3,}/g)
  if (englishMatches && englishMatches.length > 10) {
    return "英语"
  }

  // 检查其他学科
  if (rawText.includes("作文") || rawText.includes("阅读")) return "语文"
  if (rawText.includes("几何") || rawText.includes("三角形")) return "数学"

  return "数学"
}

function normalizeQuestions(questions: any[]) {
  return questions.map((q: any) => ({
    number: String(q.number || ''),
    type: q.type || 'answer',
    content: q.content || q.question || '',
    options: q.options || [],
    score: q.score || 1,
    difficulty: q.difficulty || 1,
    knowledgePoints: q.knowledgePoints || [],
    userAnswer: q.userAnswer || q.student_answer || '',
    correctAnswer: q.correctAnswer || q.answer || '',
    bbox: q.bbox || undefined,
  }))
}

function calculateAvgDifficulty(questions: any[]) {
  if (questions.length === 0) return 3
  return questions.reduce((sum, q) => sum + (q.difficulty || 3), 0) / questions.length
}

function calculateQuestionTypeStats(questions: any[]) {
  const stats: Record<string, number> = {}
  questions.forEach(q => {
    const type = q.type || 'unknown'
    stats[type] = (stats[type] || 0) + 1
  })
  return stats
}

function parseAIResponse(response: any) {
  const content = typeof response === 'string' ? response : response.content
  const jsonStr = content?.trim() || ''

  // 清理 markdown 代码块
  let cleaned = jsonStr
    .replace(/^```json\n/, "")
    .replace(/^```\n/, "")
    .replace(/\n```$/, "")
    .replace(/```$/, "")

  // 简单的 JSON 解析
  try {
    return { success: true, data: JSON.parse(cleaned) }
  } catch (error) {
    // 尝试提取 JSON
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return { success: true, data: JSON.parse(match[0]) }
      } catch {
        return { success: false, error: "JSON 解析失败" }
      }
    }
    return { success: false, error: "无法提取有效 JSON" }
  }
}

function getDefaultPrompt(): string {
  // 导入默认提示词或返回硬编码版本
  return `请仔细分析这张试卷图片，完成以下任务：

1. **试卷类型判断**：首先判断试卷类型
2. **科目识别**：根据试卷内容识别科目
3. **题目提取**：提取所有题目的信息

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称",
  "overallDifficulty": 整体难度(1-5),
  "estimatedTime": 预估完成时间(分钟),
  "rawText": "OCR识别的完整文本内容",
  "isEssay": false,
  "questions": [
    {
      "number": "题号",
      "type": "题型",
      "content": "题目内容",
      "options": [],
      "score": 1,
      "difficulty": 1,
      "knowledgePoints": [],
      "userAnswer": ""
    }
  ]
}

只返回JSON，不要有其他内容。`
}

function getSystemPrompt(): string {
  return `你是专业的试卷OCR和解析系统。你的任务是准确识别试卷图片中的所有文字内容，提取并结构化所有题目信息，按照指定的JSON格式返回结果。你必须只返回有效的JSON格式，不要包含任何其他说明文字。`
}
