import { NextRequest, NextResponse } from "next/server"
import { getUserExams } from "@/lib/storage"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function GET(request: NextRequest) {
  console.log(`[API] GET /api/exam/list`)

  try {
    // 获取用户的所有试卷
    const exams = await getUserExams(DEFAULT_USER_ID)

    // 返回试卷信息（包含题目对象用于计算统计）
    const examList = exams.map(exam => ({
      id: exam.id,
      subject: exam.subject,
      examType: exam.examType,
      totalScore: exam.totalScore,
      questionCount: exam.questions?.length || 0,
      pageCount: (exam as any).pageCount || 1,  // 试卷页数，默认为 1
      imageUrl: exam.imageUrl,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      testDate: (exam as any).testDate,  // 测试日期
      metadata: exam.metadata,
      // 返回题目对象的标记字段用于计算统计
      questions: exam.questions?.map((q: any) => ({
        number: q.number,
        score: q.score,
        isCorrect: q.isCorrect,
        isSkipped: q.isSkipped,
      })),
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
