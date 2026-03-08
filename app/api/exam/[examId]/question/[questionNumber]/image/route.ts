import { NextRequest, NextResponse } from "next/server"
import { getExamData } from "@/lib/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string; questionNumber: string }> }
) {
  const { examId, questionNumber } = await params
  const qNum = parseInt(questionNumber)

  try {
    // 从文件系统读取数据
    const examData = await getExamData(examId)

    if (!examData) {
      return NextResponse.json({ error: "试卷数据不存在" }, { status: 404 })
    }

    // 找到对应题目
    const question = examData.questions?.find((q: any) => q.number === qNum)
    if (!question) {
      return NextResponse.json({ error: "题目不存在" }, { status: 404 })
    }

    // 返回题目的 bbox 信息和原图 URL
    return NextResponse.json({
      bbox: question.bbox || null,
      hasBbox: !!question.bbox,
      imageUrl: `/api/exam/${examId}/image`,
    })
  } catch (error) {
    console.error("Get question image info error:", error)
    return NextResponse.json({ error: "获取题目图片信息失败" }, { status: 500 })
  }
}
