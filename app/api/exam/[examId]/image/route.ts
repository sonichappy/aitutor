import { NextRequest, NextResponse } from "next/server"
import { getExamImage } from "@/lib/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params

  // 从文件系统读取图片
  const imageData = await getExamImage(examId)

  if (imageData) {
    return new NextResponse(new Uint8Array(imageData.data), {
      headers: {
        "Content-Type": imageData.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  }

  return NextResponse.json(
    { error: "图片不存在或已过期" },
    { status: 404 }
  )
}
