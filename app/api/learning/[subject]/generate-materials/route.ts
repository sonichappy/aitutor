import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openai = createOpenAI({
  baseURL: process.env.DASHSCOPE_BASE_URL,
  apiKey: process.env.DASHSCOPE_API_KEY,
})

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
}

// Direct file system operations to avoid import issues
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

async function saveLearningPlan(plan: LearningPlan) {
  const plansDir = path.join(process.cwd(), 'data', plan.subjectFolder, 'learning-plans')
  await fs.mkdir(plansDir, { recursive: true })

  const filePath = path.join(plansDir, `${plan.planId}.json`)
  await fs.writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8')
}

/**
 * 生成选定的学习内容
 * POST /api/learning/[subject]/generate-materials
 *
 * 为用户选定的薄弱知识点生成学习资料和/或练习题
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    const body = await request.json()
    const { weakPoints, generateContent, generateQuestions } = body as {
      weakPoints: Array<{ point: string; severity?: number; reason?: string; priority?: number }>
      generateContent: boolean
      generateQuestions: boolean
    }

    if (!weakPoints || weakPoints.length === 0) {
      return NextResponse.json(
        { success: false, error: "请选择至少一个知识点" },
        { status: 400 }
      )
    }

    if (!generateContent && !generateQuestions) {
      return NextResponse.json(
        { success: false, error: "请至少选择生成内容类型" },
        { status: 400 }
      )
    }

    console.log(`[Generate Materials] Generating for ${weakPoints.length} points in ${subject}...`)

    const materials = []
    const planId = `plan-${Date.now()}`

    // 为每个知识点生成内容
    for (let i = 0; i < weakPoints.length; i++) {
      const weakPoint = weakPoints[i]
      console.log(`[Generate Materials] [${i + 1}/${weakPoints.length}] Generating for: ${weakPoint.point}`)

      try {
        const material = await generateMaterialForKnowledgePoint(
          subject,
          weakPoint.point,
          generateContent,
          generateQuestions
        )
        materials.push(material)

        // 保存到文件系统
        await saveExerciseMaterial(
          subject,
          weakPoint.point,
          material.severity || 3,
          material.content,
          material.questions,
          material.sources
        )

        console.log(`[Generate Materials] ✓ Generated for ${weakPoint.point}`)
      } catch (error) {
        console.error(`[Generate Materials] ✗ Failed for ${weakPoint.point}:`, error)
      }
    }

    // 保存学习计划
    const plan: LearningPlan = {
      subject,
      subjectFolder: subject,
      weakPoints: weakPoints.map((wp: any) => ({
        point: wp.point,
        severity: wp.severity || 3,
        errorCount: wp.priority || 1
      })),
      materials: materials.map((m, i) => ({
        id: `material-${i}`,
        knowledgePoint: weakPoints[i].point,
        severity: m.severity || 3,
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
      materialCount: materials.length
    })

  } catch (error: any) {
    console.error("[Generate Materials] Error:", error)
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
 * 为单个知识点生成学习资料和/或练习题
 */
async function generateMaterialForKnowledgePoint(
  subject: string,
  knowledgePoint: string,
  includeContent: boolean,
  includeQuestions: boolean
): Promise<{
  content: string
  questions: any[]
  sources: string[]
  severity: number
}> {
  // 构建提示词
  let prompt = `你是一位资深的${subject}教师。请为"${knowledgePoint}"知识点生成以下学习内容：\n\n`

  if (includeContent && includeQuestions) {
    prompt += `## 第一部分：学习资料
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
- 每道题都要有解题思路说明`
  } else if (includeContent) {
    prompt += `请生成详细的学习资料，包括：
1. 概念定义和基本原理
2. 重要公式、定理或法则
3. 解题方法和步骤
4. 常见易错点提醒
5. 记忆技巧或理解方法

使用 Markdown 格式，层次清晰，易于理解。`
  } else {
    prompt += `请生成 3-5 道练习题，要求：
- 难度递进，从简单到复杂
- 题目类型：选择题
- 包含详细的答案解析
- 每道题都要有解题思路说明`
  }

  prompt += `\n\n请严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "content": "学习资料（markdown格式，如果没有则返回空字符串）",
  "questions": [
    {
      "id": "q1",
      "type": "选择题",
      "content": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "correctAnswer": "A",
      "explanation": "解析：\\n\\n解题思路：\\n...",
      "difficulty": 3,
      "knowledgePoint": "${knowledgePoint}"
    }
  ]
}

要求：
- 内容要系统、全面、易懂
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
      sources: [],
      severity: 3
    }
  } catch (error) {
    console.error("[AI] Failed to generate material:", error)
    throw error
  }
}
