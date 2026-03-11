/**
 * API 路由适配器
 *
 * 这个模块将核心解析能力适配为 Next.js API Route
 * 用于服务器部署
 */

import { NextRequest, NextResponse } from "next/server"
import { parseExamImage, type ParseExamInput } from "./core"

// ============================================
// API 路由处理函数
// ============================================

/**
 * 处理 POST 请求
 *
 * 使用示例：
 * ```typescript
 * import { handleParseExamPost } from "@/lib/skills/parse-exam/api-adapter"
 *
 * export async function POST(request: NextRequest) {
 *   return handleParseExamPost(request)
 * }
 * ```
 */
export async function handleParseExamPost(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. 解析表单数据
    const formData = await request.formData()
    const file = formData.get("file") as File
    const subject = formData.get("subject") as string | null
    const customPrompt = formData.get("customPrompt") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "请上传图片文件" },
        { status: 400 }
      )
    }

    // 2. 转换为标准输入格式
    const input = await convertFormDataToInput(file, subject, customPrompt)

    // 3. 调用核心解析函数
    const result = await parseExamImage(input)

    // 4. 返回响应
    if (result.success) {
      return NextResponse.json({
        success: true,
        examId: result.examId,
        title: result.examData?.title || "试卷",
        questionCount: result.questions?.length || 0,
        questions: result.questions || [],
        rawText: result.examData?.rawText || "",
        examData: result.examData,
        metadata: result.metadata
      })
    } else {
      return NextResponse.json(
        {
          error: result.error || "解析失败",
          details: result.error
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[handleParseExamPost] Error:", error)
    return NextResponse.json(
      {
        error: "服务器错误",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * 处理批量解析请求
 */
export async function handleBatchParse(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "请上传至少一张图片" },
        { status: 400 }
      )
    }

    const results: any[] = []
    const errors: any[] = []

    // 并发处理多个文件（限制并发数）
    const CONCURRENCY = 3
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map(async (file) => {
          const input = await convertFormDataToInput(file)
          return await parseExamImage(input)
        })
      )

      batchResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.success) {
          results.push({
            fileName: files[i + idx].name,
            ...result.value
          })
        } else {
          errors.push({
            fileName: files[i + idx].name,
            error: result.status === "rejected" ? result.reason?.message : result.value?.error
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      total: files.length,
      parsed: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error: any) {
    console.error("[handleBatchParse] Error:", error)
    return NextResponse.json(
      { error: "批量解析失败", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 处理多图合并解析请求
 * 将多张试卷图片解析结果合并为同一份试卷
 */
export async function handleMergeParse(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const subject = formData.get("subject") as string | null
    const customPrompt = formData.get("customPrompt") as string | null

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "请上传至少一张图片" },
        { status: 400 }
      )
    }

    console.log(`[handleMergeParse] Processing ${files.length} images...`)

    // 转换所有文件为 base64（用于保存第一张图片）
    const filePromises = files.map(async (file) => {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      return {
        file,
        base64: `data:${file.type};base64,${buffer.toString("base64")}`
      }
    })

    const fileDataList = await Promise.all(filePromises)

    // 并发处理所有图片（不保存单个图片的数据）
    const CONCURRENCY = 3
    const parseResults: Array<{ success: boolean; data?: any; error?: string; pageIndex: number }> = []

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map(async (file, batchIdx) => {
          const input = await convertFormDataToInput(file, subject, customPrompt)
          // 重要：设置 saveData: false，防止每个图片单独保存
          input.saveData = false
          return await parseExamImage(input)
        })
      )

      batchResults.forEach((result, idx) => {
        parseResults.push({
          pageIndex: i + idx,
          success: result.status === "fulfilled" && result.value.success,
          data: result.status === "fulfilled" ? result.value : undefined,
          error: result.status === "rejected" ? result.reason?.message : (result.value?.error || "Unknown error")
        })
      })
    }

    // 过滤出成功的结果
    const successfulResults = parseResults.filter(r => r.success)
    const failedResults = parseResults.filter(r => !r.success)

    if (successfulResults.length === 0) {
      return NextResponse.json(
        { error: "所有图片解析失败", details: failedResults.map(f => f.error).filter(Boolean) },
        { status: 500 }
      )
    }

    // 合并结果
    const mergedResult = mergeParseResults(successfulResults.map(r => r.data!))

    console.log(`[handleMergeParse] Merged ${successfulResults.length} pages, ${mergedResult.questions.length} questions total`)

    // 保存合并后的数据
    const { saveExamData, saveExamImages } = await import("@/lib/storage")

    // 保存数据
    await saveExamData(mergedResult.examId, mergedResult.examData)

    // 保存所有图片
    try {
      // 只保存成功解析的图片数量对应的图片
      const successfulImageCount = successfulResults.length
      const imagesToSave = fileDataList.slice(0, successfulImageCount).map(f => f.base64)
      await saveExamImages(mergedResult.examId, imagesToSave)
      console.log(`[handleMergeParse] All ${imagesToSave.length} images saved`)
    } catch (error) {
      console.error("[handleMergeParse] Failed to save images:", error)
      // 图片保存失败不影响整体流程
    }

    return NextResponse.json({
      success: true,
      examId: mergedResult.examId,
      title: mergedResult.title,
      questionCount: mergedResult.questions.length,
      pageCount: successfulResults.length,
      failedCount: failedResults.length,
      questions: mergedResult.questions,
      examData: mergedResult.examDataForClient,
    })
  } catch (error: any) {
    console.error("[handleMergeParse] Error:", error)
    return NextResponse.json(
      { error: "合并解析失败", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 合并多个解析结果为一个试卷
 */
function mergeParseResults(results: Array<{
  examId: string
  examData: any
  questions: any[]
}>) {
  // 使用第一个结果作为基础
  const firstResult = results[0]
  const baseQuestions = firstResult.questions || []
  const baseExamData = firstResult.examData

  // 合并所有题目，重新编号
  const allQuestions: any[] = []
  let globalQuestionNumber = 1

  results.forEach((result, pageIndex) => {
    const questions = result.questions || []
    questions.forEach(q => {
      allQuestions.push({
        ...q,
        number: String(globalQuestionNumber++),
        // 添加页码信息
        pageIndex,
        originalNumber: q.number, // 保留原始题号
      })
    })
  })

  // 合并知识点汇总
  const allKnowledgePoints = new Set<string>()
  results.forEach(result => {
    (result.examData?.metadata?.knowledgePointsSummary || []).forEach((kp: string) => {
      allKnowledgePoints.add(kp)
    })
  })

  // 合并题目类型统计
  const mergedQuestionTypeStats: Record<string, number> = {}
  results.forEach(result => {
    const stats = result.examData?.metadata?.questionTypeStats || {}
    Object.entries(stats).forEach(([type, count]) => {
      mergedQuestionTypeStats[type] = (mergedQuestionTypeStats[type] || 0) + count
    })
  })

  // 计算整体平均难度
  const totalDifficulty = results.reduce((sum, result) => {
    const questions = result.questions || []
    const avgDiff = questions.length > 0
      ? questions.reduce((s: number, q: any) => s + (q.difficulty || 3), 0) / questions.length
      : 3
    return sum + avgDiff
  }, 0)
  const overallDifficulty = Math.round(totalDifficulty / results.length)

  // 生成新的试卷 ID
  const examId = `exam-${Date.now()}`

  // 获取中国时区时间
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

  // 构建合并后的考试数据
  const examData = {
    id: examId,
    userId: firstResult.examData?.userId || "user-1",
    subject: firstResult.examData?.subject || "unknown",
    subjectName: firstResult.examData?.subjectName || "未知",
    examType: firstResult.examData?.examType || "daily_homework",
    rawText: results.map((r, i) => `=== 第${i + 1}页 ===\n${r.examData?.rawText || ""}`).join('\n\n'),
    questions: allQuestions,
    pageCount: results.length,
    createdAt: chinaTime,
    metadata: {
      detectedSubject: firstResult.examData?.metadata?.detectedSubject,
      overallDifficulty,
      estimatedTime: allQuestions.length * 5,
      knowledgePointsSummary: Array.from(allKnowledgePoints),
      questionTypeStats: mergedQuestionTypeStats,
      isEssay: firstResult.examData?.metadata?.isEssay || false,
      essayType: firstResult.examData?.metadata?.essayType || null,
    },
  }

  // 返回给客户端的数据
  const examDataForClient = {
    id: examId,
    userId: firstResult.examData?.userId || "user-1",
    subject: firstResult.examData?.subject || "unknown",
    subjectName: firstResult.examData?.subjectName || "未知",
    examType: firstResult.examData?.examType || "daily_homework",
    imageUrl: `/api/exam/${examId}/image`,
    rawText: results.map((r, i) => `=== 第${i + 1}页 ===\n${r.examData?.rawText || ""}`).join('\n\n'),
    questions: allQuestions,
    pageCount: results.length,
    createdAt: new Date().toISOString(),
  }

  return {
    examId,
    title: `${firstResult.examData?.subjectName || "试卷"}（${results.length}页）`,
    questions: allQuestions,
    examData,
    examDataForClient,
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 将 FormData 转换为标准输入格式
 */
async function convertFormDataToInput(
  file: File,
  subject?: string | null,
  customPrompt?: string | null
): Promise<ParseExamInput> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  return {
    image: {
      data: `data:${file.type};base64,${buffer.toString("base64")}`,
      mimeType: file.type,
      size: file.size
    },
    subject: subject || undefined,
    customPrompt: customPrompt || undefined,
    userId: "user-1"
  }
}

/**
 * 创建解析进度回调
 * @deprecated Server-Sent Events 需要 Web API Response，而非 NextResponse
 * 此功能暂不实现，未来可通过 Web API Response 的 ReadableStream 实现
 */
export function createProgressCallback(_response: NextResponse) {
  return (_progress: {
    current: number
    total: number
    message: string
  }) => {
    // No-op for now
    console.log("[Progress]", _progress)
  }
}

/**
 * 导出类型
 */
export type { ParseExamInput, ParseExamResult } from "./core"
