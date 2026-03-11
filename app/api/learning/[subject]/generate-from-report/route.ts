import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openai = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL,
  apiKey: process.env.DASHSCOPE_API_KEY,
})

/**
 * 从深入分析报告生成学习内容
 * POST /api/learning/[subject]/generate-from-report
 *
 * 读取指定的深入分析报告，提取薄弱知识点，生成学习内容和习题
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

    console.log(`[Generate from Report] Loading report ${reportId} for ${subject}...`)

    // 读取深入分析报告
    const reportPath = path.join(process.cwd(), 'data', subject, 'deep-research', `${reportId}.json`)

    let reportContent: any = null
    try {
      const content = await fs.readFile(reportPath, 'utf-8')
      reportContent = JSON.parse(content)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "未找到指定的深入分析报告" },
        { status: 404 }
      )
    }

    // 使用 AI 提取薄弱知识点
    const analysisData = {
      summary: reportContent.summary || '',
      recommendations: reportContent.recommendations || [],
      detailedAnalysis: reportContent.detailedAnalysis || {}
    }

    const combinedContent = `
分析摘要：
${analysisData.summary}

建议：
${(analysisData.recommendations || []).join('\n')}

详细分析：
${JSON.stringify(analysisData.detailedAnalysis, null, 2)}
`.trim()

    console.log(`[Generate from Report] Extracting weak points from report...`)

    // 使用 AI 提取薄弱知识点
    const weakPointsPrompt = `你是一位资深的教育分析师。请分析以下${subject}学科的深入分析报告，提取学生的薄弱知识点。

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

    const extractResult = await generateText({
      model: openai("qwen-max"),
      prompt: weakPointsPrompt,
    })

    // 解析 JSON 响应
    const jsonMatch = extractResult.text.match(/\{[\s\S]*\}/)
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

    console.log(`[Generate from Report] Extracted ${weakPoints.length} weak points`)

    // 为每个薄弱知识点生成学习资料和练习题
    const planId = `plan-from-report-${Date.now()}`
    const materials = []

    for (let i = 0; i < weakPoints.length; i++) {
      const weakPoint = weakPoints[i]
      console.log(`[Generate from Report] [${i + 1}/${weakPoints.length}] Generating for: ${weakPoint.point}`)

      try {
        const material = await generateMaterialForKnowledgePoint(
          subject,
          weakPoint.point,
          weakPoint.severity,
          weakPoint.reason
        )
        materials.push(material)

        // 保存到文件系统
        await saveExerciseMaterial(
          subject,
          weakPoint.point,
          weakPoint.severity,
          material.content,
          material.questions,
          material.sources
        )

        console.log(`[Generate from Report] ✓ Generated for ${weakPoint.point}`)
      } catch (error) {
        console.error(`[Generate from Report] ✗ Failed for ${weakPoint.point}:`, error)
      }
    }

    // 保存学习计划
    const plan: any = {
      subject,
      subjectFolder: subject,
      weakPoints: weakPoints.map((wp: any) => ({
        point: wp.point,
        severity: wp.severity,
        errorCount: wp.priority
      })),
      materials: materials.map((m: any, i: number) => ({
        id: `material-${i}`,
        knowledgePoint: weakPoints[i].point,
        severity: weakPoints[i].severity,
        learningContent: m.content,
        questions: m.questions,
        sources: m.sources,
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString(),
      planId,
      sourceReportId: reportId  // 记录来源报告
    }

    await saveLearningPlan(plan)

    return NextResponse.json({
      success: true,
      plan,
      message: `已从深入分析报告生成学习内容，包含 ${materials.length} 个薄弱知识点的学习资料`
    })

  } catch (error: any) {
    console.error("[Generate from Report] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "生成学习内容失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * 为单个知识点生成学习资料和练习题
 */
async function generateMaterialForKnowledgePoint(
  subject: string,
  knowledgePoint: string,
  severity: number,
  reason?: string
): Promise<{
  content: string
  questions: any[]
  sources: string[]
}> {
  const prompt = `你是一位资深的${subject}教师。请为"${knowledgePoint}"这个知识点生成以下学习内容：

知识点薄弱原因：${reason || "需要加强练习"}

请生成以下两部分内容：

## 第一部分：学习资料
详细的讲解内容，包括：
1. 概念定义和基本原理
2. 重要公式、定理或法则
3. 解题方法和步骤
4. 常见易错点提醒
5. 记忆技巧或理解方法

使用 Markdown 格式，层次清晰，易于理解。

## 第二部分：练习题
生成 3-5 道练习题，要求：
- 难度递进，从简单到复杂
- 题目类型：选择题
- 包含详细的答案解析
- 每道题都要有解题思路说明

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "content": "# ${knowledgePoint}\\n\\n## 概念\\n...（学习资料markdown内容）",
  "questions": [
    {
      "id": "q1",
      "type": "选择题",
      "content": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "correctAnswer": "A",
      "explanation": "解析：\\n\\n解题思路：\\n...",
      "difficulty": ${Math.min(severity, 5)},
      "knowledgePoint": "${knowledgePoint}"
    }
  ]
}

要求：
- 学习资料要系统、全面、易懂
- 练习题要由易到难，有针对性
- 解析要详细，包含解题思路和相关知识点
- 只返回JSON格式，不要有其他文字`

  try {
    const result = await generateText({
      model: openai("qwen-max"),
      prompt,
    })

    // 解析 JSON 响应
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("AI 响应中未找到有效 JSON")
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      content: parsed.content || "",
      questions: parsed.questions || [],
      sources: []
    }
  } catch (error) {
    console.error("[AI] Failed to generate material:", error)
    throw error
  }
}

// 直接文件系统操作
async function saveExerciseMaterial(
  subject: string,
  knowledgePoint: string,
  severity: number,
  content: string,
  questions: any[],
  sources: string[]
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const folderName = `${timestamp}-${knowledgePoint.replace(/[<>:"/\\|?*]/g, '_')}`

  const exercisesDir = path.join(process.cwd(), 'data', 'exercises', subject, folderName)

  await fs.mkdir(exercisesDir, { recursive: true })

  const material = {
    knowledgePoint,
    severity,
    learningContent: content,
    questions,
    sources,
    createdAt: new Date().toISOString()
  }

  await fs.writeFile(
    path.join(exercisesDir, 'material.json'),
    JSON.stringify(material, null, 2),
    'utf-8'
  )
}

interface LearningPlan {
  subject: string
  subjectFolder: string
  weakPoints: Array<{ point: string; severity: number; errorCount: number }>
  materials: Array<{
    id: string
    knowledgePoint: string
    severity: number
    learningContent: string
    questions: any[]
    sources: string[]
    createdAt: string
  }>
  createdAt: string
  planId: string
  sourceReportId?: string
}

async function saveLearningPlan(plan: LearningPlan) {
  const plansDir = path.join(process.cwd(), 'data', plan.subjectFolder, 'learning-plans')
  await fs.mkdir(plansDir, { recursive: true })

  const filePath = path.join(plansDir, `${plan.planId}.json`)
  await fs.writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8')
}
