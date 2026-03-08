import { NextRequest, NextResponse } from "next/server"
import { getUserExams } from "@/lib/storage"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function GET(request: NextRequest) {
  console.log(`[API] GET /api/exam/list`)

  try {
    // 获取用户的所有试卷
    const exams = await getUserExams(DEFAULT_USER_ID)

    // 返回精简的试卷信息用于列表展示
    const examList = exams.map(exam => ({
      id: exam.id,
      subject: exam.subject,
      examType: exam.examType,
      totalScore: exam.totalScore,
      questionCount: exam.questions?.length || 0,
      imageUrl: exam.imageUrl,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      metadata: exam.metadata,
      answerStats: exam.answerStats,
    }))

    console.log(`[API] Found ${examList.length} exams for user`)

    return NextResponse.json({
      exams: examList,
      total: examList.length,
    })
  } catch (error: any) {
    console.error("[API] Error getting exam list:", error)
    return NextResponse.json(
      { error: "获取试卷列表失败", details: error.message },
      { status: 500 }
    )
  }
}
