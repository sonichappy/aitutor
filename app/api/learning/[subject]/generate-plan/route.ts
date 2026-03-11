import { NextRequest, NextResponse } from "next/server"
import { getSubjectReports, getDeepResearchReports, type SubjectReport } from "@/lib/storage"
import { saveLearningPlan, saveExerciseMaterial, type LearningPlan, type ExerciseQuestion } from "@/lib/storage"
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
 * 分析学科报告中的薄弱知识点，按严重程度排序，
 * 搜索学习资料和习题，保存到 /data/exercises/学科/
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    // 1. 获取学科的普通报告
    const reports = await getSubjectReports(subject)

    // 2. 获取学科的深入分析报告
    const deepReports = await getDeepResearchReports(subject)

    // 3. 分析薄弱知识点
    const weakPointsMap = new Map<string, { severity: number; errorCount: number; descriptions: string[] }>()

    // 从普通报告中提取薄弱知识点
    for (const report of reports) {
      const stats = report.stats as any
      if (stats?.wrongQuestions && Array.isArray(stats.wrongQuestions)) {
        for (const q of stats.wrongQuestions) {
          if (q.knowledgePoints && Array.isArray(q.knowledgePoints)) {
            for (const point of q.knowledgePoints) {
              const key = point.trim()
              if (!key) continue

              const existing = weakPointsMap.get(key) || { severity: 0, errorCount: 0, descriptions: [] }
              existing.errorCount += 1
              existing.severity = Math.max(existing.severity, q.difficulty || 3)
              existing.descriptions.push(`${q.content?.substring(0, 50)}...`)
              weakPointsMap.set(key, existing)
            }
          }
        }
      }
    }

    // 从深入分析报告中提取薄弱知识点
    for (const report of deepReports) {
      // DeepResearchReport 有 summary 和 recommendations 属性
      const content = [
        report.summary || "",
        ...(report.recommendations || []),
        JSON.stringify(report.detailedAnalysis || {})
      ].join("\n")

      // 提取薄弱知识点相关内容
      const weakPatterns = [
        /薄弱知识点[：:]\s*([^\n]+)/gi,
        /知识缺口[：:]\s*([^\n]+)/gi,
        /主要问题[：:]\s*([^\n]+)/gi,
      ]

      for (const pattern of weakPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const pointText = match[1]
          // 分割多个知识点
          const points = pointText
            .split(/[、,，;；]/)
            .map(p => p.trim())
            .filter(p => p.length > 0)

          for (const point of points) {
            const key = point.replace(/^[●▪■\-\*]\s*/, "").trim()
            if (!key) continue

            const existing = weakPointsMap.get(key) || { severity: 0, errorCount: 0, descriptions: [] }
            existing.severity = Math.max(existing.severity, 5) // 深入分析报告中的问题严重度较高
            existing.errorCount += 2
            weakPointsMap.set(key, existing)
          }
        }
      }
    }

    // 转换为数组并按严重程度排序
    const weakPoints = Array.from(weakPointsMap.entries())
      .map(([point, data]) => ({
        point,
        severity: data.severity,
        errorCount: data.errorCount
      }))
      .sort((a, b) => {
        // 先按严重程度排序，再按错误数量排序
        if (b.severity !== a.severity) {
          return b.severity - a.severity
        }
        return b.errorCount - a.errorCount
      })
      .slice(0, 10) // 取前10个最薄弱的知识点

    if (weakPoints.length === 0) {
      return NextResponse.json({
        success: false,
        error: "未找到薄弱知识点，请先完成一些试卷练习"
      })
    }

    console.log(`[Learning Plan] Found ${weakPoints.length} weak points for ${subject}`)

    // 4. 为每个薄弱知识点生成学习资料和练习题
    const planId = `plan-${Date.now()}`
    const materials = []

    for (const weakPoint of weakPoints) {
      console.log(`[Learning Plan] Generating material for: ${weakPoint.point}`)

      try {
        // 使用 AI 生成学习资料和练习题
        const material = await generateMaterialForKnowledgePoint(subject, weakPoint.point, weakPoint.severity)
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
      } catch (error) {
        console.error(`[Learning Plan] Failed to generate material for ${weakPoint.point}:`, error)
      }
    }

    // 5. 保存学习计划
    const plan: LearningPlan = {
      subject,
      subjectFolder: subject,
      weakPoints,
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
  severity: number
): Promise<{
  content: string
  questions: ExerciseQuestion[]
  sources: string[]
}> {
  const prompt = `你是一位资深的${subject}教师。请为"${knowledgePoint}"这个知识点生成以下内容：

1. **学习资料**：详细的讲解内容，包括概念、公式、定理、解题方法等
2. **练习题**：生成3-5道练习题，包括题目、选项、正确答案和详细解析

请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "content": "学习资料内容（使用markdown格式）",
  "questions": [
    {
      "id": "q1",
      "type": "选择题",
      "content": "题目内容",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "correctAnswer": "A",
      "explanation": "详细解析",
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
      questions: (parsed.questions || []) as ExerciseQuestion[],
      sources: []
    }
  } catch (error) {
    console.error("[AI] Failed to generate material:", error)
    throw error
  }
}
