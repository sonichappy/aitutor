import { NextRequest, NextResponse } from "next/server"
import { getDeepResearchReports } from "@/lib/storage"
import { saveLearningPlan, saveExerciseMaterial, type LearningPlan } from "@/lib/storage"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openai = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL,
  apiKey: process.env.DASHSCOPE_API_KEY,
})

/**
 * 生成个性化学习计划
 * POST /api/learning/[subject]/generate-plan
 *
 * 使用 AI 解读深入分析报告，提取薄弱知识点，
 * 按优先级排序，逐个生成学习内容和练习题
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    // 1. 获取学科的深入分析报告
    const deepReports = await getDeepResearchReports(subject)

    if (deepReports.length === 0) {
      return NextResponse.json({
        success: false,
        error: `未找到${subject}的深入分析报告，请先生成深入分析报告`
      })
    }

    // 获取最新的深入分析报告
    const latestReport = deepReports.sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )[0]

    // 2. 使用 AI 解读深入分析报告，提取薄弱知识点
    const analysisContent = `
分析摘要：
${latestReport.summary}

建议：
${latestReport.recommendations?.join('\n') || ''}

详细分析：
${JSON.stringify(latestReport.detailedAnalysis || {}, null, 2)}
`.trim()

    console.log(`[Learning Plan] Analyzing deep research report for ${subject}...`)

    // 使用 AI 提取和排序薄弱知识点
    const weakPointsPrompt = `你是一位资深的教育分析师。请分析以下${subject}学科的深入分析报告，提取学生的薄弱知识点。

分析报告内容：
"""
${analysisContent}
"""

请按照以下JSON格式返回，不要包含任何其他文字：
{
  "weakPoints": [
    {
      "point": "知识点名称",
      "severity": 5,
      "reason": "薄弱原因分析（50字以内）",
      "priority": 1
    }
  ]
}

要求：
- 从报告中提取 3-5 个最薄弱的知识点
- severity 范围 1-5，5 为最严重
- priority 范围 1-10，1 为最高优先级
- 优先考虑那些：错误率高、基础性强的知识点
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
      return NextResponse.json({
        success: false,
        error: "未能从分析报告中提取到薄弱知识点，请确保已生成深入分析报告"
      })
    }

    console.log(`[Learning Plan] Extracted ${weakPoints.length} weak points for ${subject}`)

    // 3. 为每个薄弱知识点生成学习资料和练习题
    const planId = `plan-${Date.now()}`
    const materials = []

    for (let i = 0; i < weakPoints.length; i++) {
      const weakPoint = weakPoints[i]
      console.log(`[Learning Plan] [${i + 1}/${weakPoints.length}] Generating material for: ${weakPoint.point}`)

      try {
        // 使用 AI 生成学习资料和练习题
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

        console.log(`[Learning Plan] ✓ Generated ${material.questions.length} questions for ${weakPoint.point}`)
      } catch (error) {
        console.error(`[Learning Plan] ✗ Failed to generate material for ${weakPoint.point}:`, error)
      }
    }

    // 4. 保存学习计划
    const plan: LearningPlan = {
      subject,
      subjectFolder: subject,
      weakPoints: weakPoints.map((wp: any) => ({
        point: wp.point,
        severity: wp.severity,
        errorCount: wp.priority
      })),
      materials: materials.map((m, i) => ({
        id: `material-${i}`,
        knowledgePoint: weakPoints[i].point,
        severity: weakPoints[i].severity,
        learningContent: m.content,
        questions: m.questions,
        sources: m.sources,
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString(),
      planId
    }

    await saveLearningPlan(plan)

    return NextResponse.json({
      success: true,
      plan,
      message: `已为 ${subject} 生成个性化学习计划，包含 ${materials.length} 个薄弱知识点的学习资料`
    })

  } catch (error: any) {
    console.error("[Learning Plan] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "生成学习计划失败",
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
      sources: [] // 可以添加网络搜索的相关资源链接
    }
  } catch (error) {
    console.error("[AI] Failed to generate material:", error)
    throw error
  }
}
