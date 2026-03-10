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
