import { NextRequest, NextResponse } from "next/server"
import { getExamData, saveExamData, type ExamData } from "@/lib/storage"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params
    const body = await request.json()
    const { examType, questions } = body

    // 读取试卷数据
    const examData = await getExamData(examId)
    if (!examData) {
      return NextResponse.json(
        { error: "试卷不存在" },
        { status: 404 }
      )
    }

    // 更新试卷类型
    if (examType) {
      examData.examType = examType
    }

    // 更新题目列表
    if (questions && Array.isArray(questions)) {
      examData.questions = questions
    }

    // 保存更新后的数据
    await saveExamData(examId, examData)

    return NextResponse.json({
      success: true,
      examId,
      examType: examData.examType,
      questions: examData.questions
    })
  } catch (error: any) {
    console.error("Update exam error:", error)
    return NextResponse.json(
      { error: "更新试卷失败" },
      { status: 500 }
    )
  }
}
