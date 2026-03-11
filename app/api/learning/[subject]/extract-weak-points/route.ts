import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openai = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL,
  apiKey: process.env.DASHSCOPE_API_KEY,
})

interface WeakPoint {
  point: string
  severity: number
  reason: string
  priority: number
  sourceReports: string[]
}

/**
 * 提取薄弱知识点
 * POST /api/learning/[subject]/extract-weak-points
 *
 * 使用 AI 解读选定的深入分析报告，提取薄弱知识点
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    const body = await request.json()
    const { reportIds } = body as { reportIds: string[] }

    if (!reportIds || reportIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "请选择至少一份报告" },
        { status: 400 }
      )
    }

    // Directly access deep research reports without importing from storage
    const deepResearchDir = path.join(process.cwd(), 'data', subject, 'deep-research')

    let allReports: any[] = []
    try {
      const files = await fs.readdir(deepResearchDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(deepResearchDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const report = JSON.parse(content)
          allReports.push(report)
        }
      }
    } catch {
      // Directory doesn't exist
    }

    const selectedReports = allReports.filter(r => reportIds.includes(r.id || ''))

    if (selectedReports.length === 0) {
      return NextResponse.json(
        { success: false, error: "未找到选定的报告" },
        { status: 404 }
      )
    }

    // 组合所有报告内容
    const combinedContent = selectedReports.map((report, index) => `
## 报告 ${index + 1}
生成时间：${report.generatedAt}

分析摘要：
${report.summary}

建议：
${(report.recommendations || []).join('\n')}

详细分析：
${JSON.stringify(report.detailedAnalysis || {}, null, 2)}
`).join('\n\n---\n\n')

    console.log(`[Extract Weak Points] Analyzing ${selectedReports.length} reports for ${subject}...`)

    // 使用 AI 提取薄弱知识点
    const prompt = `你是一位资深的教育分析师。请分析以下${subject}学科的深入分析报告，提取学生的薄弱知识点。

分析报告内容：
"""
${combinedContent}
"""

请按照以下JSON格式返回，不要包含任何其他文字：
{
  "weakPoints": [
    {
      "point": "知识点名称",
      "severity": 5,
      "reason": "薄弱原因分析（30字以内）",
      "priority": 1
    }
  ]
}

要求：
- 从报告中提取 3-5 个最薄弱的知识点
- 优先考虑那些：多次被提及、基础性强的知识点
- severity 范围 1-5，5 为最严重
- priority 范围 1-10，1 为最高优先级
- 去除重复或高度相似的知识点
- 只返回JSON格式，不要有其他文字`

    const result = await generateText({
      model: openai("qwen-max"),
      prompt,
    })

    // 解析 JSON 响应
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("AI 响应中未找到有效 JSON")
    }

    const extracted = JSON.parse(jsonMatch[0])

    // 添加来源报告信息
    const weakPointsWithSource: WeakPoint[] = (extracted.weakPoints || []).map((wp: any) => ({
      ...wp,
      sourceReports: reportIds
    }))

    console.log(`[Extract Weak Points] Extracted ${weakPointsWithSource.length} weak points`)

    return NextResponse.json({
      success: true,
      weakPoints: weakPointsWithSource
    })

  } catch (error: any) {
    console.error("[Extract Weak Points] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "提取薄弱知识点失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}
