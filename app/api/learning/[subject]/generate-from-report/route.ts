import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

/**
 * 从深入分析报告提取薄弱知识点
 * POST /api/learning/[subject]/generate-from-report
 *
 * 读取指定的深入分析报告，使用 AI 提取薄弱知识点列表
 * 返回给前端让用户选择要学习的薄弱项
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    const body = await request.json()
    const { reportId } = body as { reportId: string }

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: "请提供报告ID" },
        { status: 400 }
      )
    }

    console.log(`[Extract Weak Points from Report] Loading report ${reportId} for ${subject}...`)

    // 获取学科的 folderName
    let subjectFolder = subject.toLowerCase()

    try {
      const subjectsPath = path.join(process.cwd(), 'data', 'subjects.json')
      const subjectsRaw = await fs.readFile(subjectsPath, 'utf-8')
      const subjectsData = JSON.parse(subjectsRaw)

      const matchedSubject = subjectsData.subjects?.find((s: any) => s.name === subject)
      if (matchedSubject?.folderName) {
        subjectFolder = matchedSubject.folderName
      }
    } catch (error) {
      console.log('[Extract Weak Points from Report] Could not get folderName, using default')
    }

    // 读取深入分析报告
    const reportDir = path.join(process.cwd(), 'data', 'reports', subjectFolder, reportId)

    let metaContent: any = null
    let reportMarkdown: string = ''

    try {
      const metaPath = path.join(reportDir, 'meta.json')
      const metaRaw = await fs.readFile(metaPath, 'utf-8')
      metaContent = JSON.parse(metaRaw)

      const reportPath = path.join(reportDir, 'report.md')
      reportMarkdown = await fs.readFile(reportPath, 'utf-8')
    } catch (error) {
      console.error('[Extract Weak Points from Report] Failed to read report:', error)
      return NextResponse.json(
        { success: false, error: "未找到指定的深入分析报告" },
        { status: 404 }
      )
    }

    // 构建分析内容
    const analysisContent = `
报告元数据：
分析类型: ${metaContent.analysisType}
生成时间: ${metaContent.generatedAt}

分析摘要（从 markdown 中提取）：
${reportMarkdown.substring(0, 3000)}...
`.trim()

    // 使用 DashScope API 提取薄弱知识点
    const weakPointsPrompt = `你是一位资深的教育分析师。请分析以下${subject}学科的深入分析报告，提取学生的薄弱知识点。

分析报告内容：
"""
${analysisContent}
"""

请按照以下JSON格式返回，不要包含任何其他文字：
{
  "weakPoints": [
    {
      "point": "知识点名称（简短）",
      "severity": 5,
      "reason": "薄弱原因分析（30字以内）",
      "priority": 1
    }
  ]
}

要求：
- 从报告中提取 3-8 个最薄弱的知识点
- 优先考虑那些：多次被提及、基础性强的知识点
- severity 范围 1-5，5 为最严重
- priority 范围 1-10，1 为最高优先级
- 去除重复或高度相似的知识点
- 只返回JSON格式，不要有其他文字`

    try {
      // 直接使用 fetch 调用 DashScope API
      const dashscopeResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: '你是一位资深的教育分析师，擅长分析学生学习情况并提取薄弱知识点。请严格按照要求返回JSON格式。'
            },
            {
              role: 'user',
              content: weakPointsPrompt
            }
          ],
          temperature: 0.3,
        }),
      })

      if (!dashscopeResponse.ok) {
        const errorText = await dashscopeResponse.text()
        console.error('[DashScope API] Error:', errorText)
        throw new Error(`DashScope API error: ${dashscopeResponse.status}`)
      }

      const dashscopeData = await dashscopeResponse.json()
      const content = dashscopeData.choices?.[0]?.message?.content || ''

      // 解析 JSON 响应
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("AI 响应中未找到有效 JSON")
      }

      const extracted = JSON.parse(jsonMatch[0])
      const weakPoints = extracted.weakPoints || []

      if (weakPoints.length === 0) {
        return NextResponse.json(
          { success: false, error: "未能从报告中提取到薄弱知识点" },
          { status: 400 }
        )
      }

      console.log(`[Extract Weak Points from Report] Extracted ${weakPoints.length} weak points`)

      return NextResponse.json({
        success: true,
        weakPoints,
        reportId,
        reportSummary: metaContent.id
      })

    } catch (error: any) {
      console.error('[Extract Weak Points from Report] AI API Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: "提取薄弱知识点失败",
          details: error.message
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error("[Extract Weak Points from Report] Error:", error)
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
