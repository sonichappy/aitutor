import { NextRequest, NextResponse } from "next/server"
import { getExamData, saveExamData, type ExamData, type ExamQuestion } from "@/lib/storage"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params
    const body = await request.json()
    const { examType, questions, testDate } = body

    console.log(`[Update API] ExamId: ${examId}, Received:`, JSON.stringify(body, null, 2))

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

    // 更新测试日期
    if (testDate !== undefined) {
      examData.testDate = testDate
    }

    // 更新题目列表（答题数据现在直接在题目对象中）
    if (questions && Array.isArray(questions)) {
      console.log(`[Update API] Updating questions, count: ${questions.length}`)

      // 打印第一个有答题数据的题目
      const firstAnswered = questions.find((q: any) => q.userAnswer !== undefined || q.isCorrect !== undefined)
      if (firstAnswered) {
        console.log(`[Update API] First answered question:`, JSON.stringify(firstAnswered, null, 2))
      }

      examData.questions = questions
    }

    // 移除旧的 answers 数组和 answerStats（不再需要）
    delete examData.answers
    delete examData.answerStats

    console.log(`[Update API] Saving exam data...`)

    // 保存更新后的数据
    await saveExamData(examId, examData)

    console.log(`[Update API] Exam data saved successfully`)

    return NextResponse.json({
      success: true,
      examId,
      questions: examData.questions,
    })
  } catch (error: any) {
    console.error("[Update API] Error:", error)
    return NextResponse.json(
      { error: "更新试卷失败" },
      { status: 500 }
    )
  }
}
