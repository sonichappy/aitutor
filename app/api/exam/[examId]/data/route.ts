import { NextRequest, NextResponse } from "next/server"
import { getExamData } from "@/lib/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params

  // 从文件系统读取数据
  const examData = await getExamData(examId)

  if (examData) {
    return NextResponse.json({
      ...examData,
      imageUrl: `/api/exam/${examId}/image`,
    })
  }

  return NextResponse.json(
    { error: "试卷数据不存在或已过期" },
    { status: 404 }
  )
}
