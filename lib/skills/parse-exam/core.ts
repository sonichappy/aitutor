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
  saveData?: boolean  // 是否保存数据到文件系统（默认 true）
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
    const shouldSaveData = input.saveData !== false  // 默认为 true

    // 2. 调用 AI 进行 OCR 和解析
    const parseResult = await callAIForParsing(base64Image, customPrompt)

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error
      }
    }

    // 3. 处理解析结果（传入原始图片）
    const processedResult = await processParsedData(
      parseResult.data!,
      input.subject,
      userId,
      base64Image,  // 传入原始图片用于保存
      customPrompt
    )

    // 4. 保存数据（仅在需要时）
    if (shouldSaveData) {
      await saveProcessedData(processedResult)
    }

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
    const parseResult = parseAIResponse(response)
    console.log("[parseAIResponse] Result:", JSON.stringify(parseResult).substring(0, 500))

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error
      }
    }

    return {
      success: true,
      data: parseResult.data,
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
  base64Image: string,  // 添加 base64Image 参数
  customPrompt?: string
) {
  // 打印调试信息
  console.log("[processParsedData] Raw parsed data keys:", Object.keys(parsed || {}))
  console.log("[processParsedData] Questions count:", parsed.questions?.length || 0)
  if (parsed.questions && parsed.questions.length > 0) {
    console.log("[processParsedData] First question sample:", JSON.stringify(parsed.questions[0]).substring(0, 200))
  }

  // 清理和验证题目
  let questions = parsed.questions || []
  questions = normalizeQuestions(questions)
  const cleanedQuestions = cleanParsedQuestions(questions)

  console.log("[processParsedData] After normalizeQuestions:", questions.length)
  console.log("[processParsedData] After cleanParsedQuestions:", cleanedQuestions.length)

  // 计算统计数据
  const avgDifficulty = calculateAvgDifficulty(cleanedQuestions)
  const questionTypeStats = calculateQuestionTypeStats(cleanedQuestions)
  const knowledgePointsSummary = extractKnowledgePointsSummary(cleanedQuestions)

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
    examType: parsed.examType || "daily_homework", // 默认为日常作业（顶层字段）
    rawText: parsed.rawText || "",
    questions: cleanedQuestions,
    createdAt: chinaTime,
    metadata: {
      detectedSubject: parsed.detectedSubject,
      overallDifficulty: parsed.overallDifficulty || Math.round(avgDifficulty),
      estimatedTime: parsed.estimatedTime || cleanedQuestions.length * 5,
      knowledgePointsSummary, // 使用从题目中提取的知识点汇总
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
    examType: parsed.examType || "daily_homework", // 默认为日常作业
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
    base64Image  // 返回传入的 base64Image 用于保存
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
  // 1. 先保存数据（创建目录）
  await saveExamData(result.examId, result.examData)
  console.log(`[saveProcessedData] Exam data saved: ${result.examId}`)

  // 2. 如果有图片，单独保存（失败不影响数据保存）
  if (result.base64Image) {
    try {
      await saveExamImage(result.examId, result.base64Image)
      console.log(`[saveProcessedData] Exam image saved: ${result.examId}`)
    } catch (error) {
      console.error(`[saveProcessedData] Failed to save image for ${result.examId}:`, error)
      // 图片保存失败不影响整体流程，继续执行
    }
  } else {
    console.log(`[saveProcessedData] No image to save for ${result.examId}`)
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

/**
 * 从所有题目中提取知识点汇总
 */
function extractKnowledgePointsSummary(questions: any[]): string[] {
  const allKnowledgePoints: string[] = []

  questions.forEach(q => {
    if (q.knowledgePoints && Array.isArray(q.knowledgePoints)) {
      allKnowledgePoints.push(...q.knowledgePoints)
    }
  })

  // 去重并返回
  return Array.from(new Set(allKnowledgePoints))
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
  return `请仔细分析这张试卷图片，提取所有题目信息。

**重要要求：**
1. 必须提取图片中的所有题目，一道都不要遗漏
2. 题号要准确（如 1、2、3 或 一、二、三）
3. 题目内容要完整，包括题干、问题等
4. 如果有选项（A、B、C、D），必须提取所有选项
5. 每道题都要有完整的 content 字段

**JSON 格式：**
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称（如：数学、语文、英语、物理、化学等）",
  "examType": "试卷类型ID（daily_homework=日常作业, unit_test=单元测试, midterm_exam=期中考试, final_exam=期末考试, mock_exam=模拟考试, tutoring=课外辅导, competition=竞赛练习, special_practice=专项练习, composition=作文）",
  "overallDifficulty": 整体难度(1-5的整数),
  "estimatedTime": 预估完成时间(分钟),
  "rawText": "OCR识别的完整文本内容（所有文字）",
  "isEssay": false,
  "questions": [
    {
      "number": "题号（字符串类型）",
      "type": "题型（choice=选择题, fill=填空题, answer=解答题/问答题）",
      "content": "完整的题目内容（包括题干和问题，不能为空）",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "score": 1,
      "difficulty": 1,
      "knowledgePoints": ["知识点1", "知识点2"],
      "userAnswer": ""
    }
  ]
}

**试卷类型识别规则：**
- daily_homework（日常作业）：课后练习、作业本、练习册、周末作业等
- unit_test（单元测试）：单元测验、章节测试、小测验等
- midterm_exam（期中考试）：期中考试、期中测试、期中阶段性考试
- final_exam（期末考试）：期末考试、期末测试、期末总结性考试
- mock_exam（模拟考试）：模拟考试、真题演练、仿真考试
- tutoring（课外辅导）：课外辅导练习、补习作业
- competition（竞赛练习）：学科竞赛练习、竞赛题
- special_practice（专项练习）：针对性专项训练
- composition（作文）：语文/英语作文

**注意事项：**
- questions 数组必须包含所有题目，不能为空
- 每道题的 content 字段必须有实际内容
- 只返回JSON，不要有其他内容
- 题目类型：选择题用 choice，填空题用 fill，解答题/计算题/证明题用 answer`
}

function getSystemPrompt(): string {
  return `你是专业的试卷OCR和解析助手。

**任务：**
1. 识别图片中的所有文字内容
2. 提取所有题目信息，一道都不要遗漏
3. 判断试卷的学科类型
4. 判断试卷类型（日常作业、单元测试、期中考试、期末考试、模拟考试等）
5. 严格按照JSON格式返回

**提取题目的规则：**
- 找出所有带编号的题目（1. 2. 3. 或 一、二、三、等）
- 每道题的题干和问题必须完整提取到 content 字段
- 选择题的选项必须全部提取到 options 数组
- 如果题目有小问（如(1)(2)(3)），每个小问作为独立题目

**试卷类型识别规则：**
- daily_homework（日常作业）：课后练习、作业本、练习册、周末作业等
- unit_test（单元测试）：单元测验、章节测试、小测验等
- midterm_exam（期中考试）：期中考试、期中测试
- final_exam（期末考试）：期末考试、期末测试
- mock_exam（模拟考试）：模拟考试、真题演练
- tutoring（课外辅导）：课外辅导练习
- competition（竞赛练习）：学科竞赛练习
- special_practice（专项练习）：针对性专项训练
- composition（作文）：语文/英语作文
- 如果无法确定类型，默认使用 daily_homework

**JSON输出要求：**
- 必须是有效的JSON格式
- questions 数组不能为空
- 每个题目必须有完整的 content 内容
- examType 必须是有效的类型值（daily_homework/unit_test/midterm_exam/final_exam/mock_exam/tutoring/competition/special_practice/composition）
- 不要在JSON外添加任何其他文字说明`
}
