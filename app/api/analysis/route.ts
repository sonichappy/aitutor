import { NextRequest, NextResponse } from "next/server"
import { callLLM, createAnalysisSystemPrompt, type ChatMessage } from "@/lib/ai/llm"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

// 模拟数据（在没有数据库时使用）
const MOCK_DATA = {
  summary: {
    totalQuestions: 128,
    correctRate: 82,
    knowledgePointsCount: 24,
  },
  weakPoints: ["二次函数", "三角函数", "力学综合", "氧化还原反应"],
  strongPoints: ["代数运算", "函数基础", "方程求解", "运动学"],
  knowledgePoints: [
    { name: "二次函数", masteryLevel: 55, practiceCount: 15, correctRate: 55 },
    { name: "三角函数", masteryLevel: 60, practiceCount: 12, correctRate: 60 },
    { name: "立体几何", masteryLevel: 65, practiceCount: 8, correctRate: 65 },
    { name: "代数运算", masteryLevel: 90, practiceCount: 20, correctRate: 90 },
    { name: "函数基础", masteryLevel: 85, practiceCount: 18, correctRate: 85 },
    { name: "方程求解", masteryLevel: 88, practiceCount: 16, correctRate: 88 },
    { name: "力学综合", masteryLevel: 50, practiceCount: 10, correctRate: 50 },
    { name: "运动学", masteryLevel: 80, practiceCount: 14, correctRate: 80 },
  ],
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const subject = searchParams.get("subject")

    // TODO: 从数据库获取真实数据
    // const questions = await prisma.question.findMany({...})
    // const knowledgePoints = await prisma.knowledgePoint.findMany({...})

    // 当前返回模拟数据
    let filteredData = { ...MOCK_DATA }

    if (subject) {
      // 根据科目过滤数据
      filteredData.knowledgePoints = MOCK_DATA.knowledgePoints.filter(
        (kp) => {
          if (subject === "数学") return ["二次函数", "三角函数", "立体几何", "代数运算", "函数基础", "方程求解"].includes(kp.name)
          if (subject === "物理") return ["力学综合", "运动学"].includes(kp.name)
          return true
        }
      )
    }

    return NextResponse.json(filteredData)
  } catch (error) {
    console.error("Analysis API error:", error)
    return NextResponse.json(
      { error: "获取分析数据失败" },
      { status: 500 }
    )
  }
}

// 使用 AI 生成深度分析报告
export async function POST(request: NextRequest) {
  try {
    const { subject } = await request.json()

    // 获取数据
    const baseUrl = new URL(request.url)
    const analysisUrl = new URL(
      `/api/analysis${subject ? `?subject=${subject}` : ""}`,
      baseUrl.origin
    )
    const analysisResponse = await fetch(analysisUrl.toString())
    const analysisData = await analysisResponse.json()

    // 构建 AI 分析提示
    const prompt = `请根据以下学生学习数据，生成一份详细的学习分析报告：

数据摘要：
- 总练习题数：${analysisData.summary.totalQuestions}
- 正确率：${analysisData.summary.correctRate}%
- 知识点数量：${analysisData.summary.knowledgePointsCount}

薄弱知识点：
${analysisData.weakPoints.map((p: string) => `- ${p}`).join("\n")}

优势知识点：
${analysisData.strongPoints.map((p: string) => `- ${p}`).join("\n")}

请生成：
1. 学习状况总体评估
2. 针对薄弱点的具体改进建议
3. 推荐的学习顺序和重点
4. 鼓励性的总结`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: createAnalysisSystemPrompt(),
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    const aiResponse = await callLLM(messages, {
      temperature: 0.5,
      maxTokens: 2000,
    })

    return NextResponse.json({
      ...analysisData,
      aiReport: aiResponse.content,
    })
  } catch (error) {
    console.error("Analysis AI API error:", error)
    return NextResponse.json(
      { error: "生成AI分析报告失败" },
      { status: 500 }
    )
  }
}
