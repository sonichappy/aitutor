import { NextRequest, NextResponse } from "next/server"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"
const DEFAULT_GRADE = 9 // 初三

// 模拟推荐数据
const MOCK_RECOMMENDATIONS = {
  数学: [
    {
      id: "m1",
      type: "question",
      subject: "数学",
      content: "已知二次函数 f(x) = x² - 4x + 3，求该函数的顶点坐标...",
      knowledgePoints: ["二次函数"],
      difficulty: 3,
      reason: "针对你的薄弱点：二次函数",
    },
    {
      id: "m2",
      type: "question",
      subject: "数学",
      content: "计算 sin(30°) + cos(60°) 的值...",
      knowledgePoints: ["三角函数"],
      difficulty: 2,
      reason: "针对你的薄弱点：三角函数",
    },
    {
      id: "m3",
      type: "question",
      subject: "数学",
      content: "解方程 x² - 5x + 6 = 0...",
      knowledgePoints: ["方程求解"],
      difficulty: 2,
      reason: "巩固已掌握知识点",
    },
  ],
  物理: [
    {
      id: "p1",
      type: "question",
      subject: "物理",
      content: "一个物体从静止开始做匀加速运动，2秒后速度达到10m/s...",
      knowledgePoints: ["运动学"],
      difficulty: 2,
      reason: "巩固基础概念",
    },
    {
      id: "p2",
      type: "question",
      subject: "物理",
      content: "质量为2kg的物体受到10N的水平推力...",
      knowledgePoints: ["力学综合"],
      difficulty: 3,
      reason: "针对你的薄弱点：力学综合",
    },
  ],
  化学: [
    {
      id: "c1",
      type: "question",
      subject: "化学",
      content: "配平化学方程式：Fe + O₂ → Fe₂O₃...",
      knowledgePoints: ["氧化还原反应"],
      difficulty: 2,
      reason: "针对你的薄弱点：氧化还原反应",
    },
  ],
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const subject = searchParams.get("subject") || "数学"
    const limit = parseInt(searchParams.get("limit") || "5")

    // TODO: 从数据库获取真实数据
    // 当前返回模拟数据
    const recommendations = MOCK_RECOMMENDATIONS[subject as keyof typeof MOCK_RECOMMENDATIONS] ||
      MOCK_RECOMMENDATIONS["数学"]

    const weakKnowledgePoints = [
      { name: "二次函数", masteryLevel: 55 },
      { name: "三角函数", masteryLevel: 60 },
      { name: "力学综合", masteryLevel: 50 },
    ].filter((kp) => {
      if (subject === "数学") return ["二次函数", "三角函数"].includes(kp.name)
      if (subject === "物理") return kp.name === "力学综合"
      return true
    })

    return NextResponse.json({
      recommendations: recommendations.slice(0, limit),
      weakKnowledgePoints,
    })
  } catch (error) {
    console.error("Recommendations API error:", error)
    return NextResponse.json(
      { error: "获取推荐失败" },
      { status: 500 }
    )
  }
}
