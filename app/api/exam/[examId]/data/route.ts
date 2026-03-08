import { NextRequest, NextResponse } from "next/server"
import { getExamData } from "@/lib/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params

  console.log(`[API] GET /api/exam/${examId}/data`)

  // 从文件系统读取数据
  const examData = await getExamData(examId)

  if (examData) {
    console.log(`[API] Found exam data for ${examId}`)
    return NextResponse.json({
      ...examData,
      imageUrl: `/api/exam/${examId}/image`,
    })
  }

  console.log(`[API] Exam data NOT found for ${examId}`)
  return NextResponse.json(
    { error: "试卷数据不存在或已过期" },
    { status: 404 }
  )
}
