import { NextRequest, NextResponse } from "next/server"
import { getExamImages } from "@/lib/storage"

/**
 * 获取试卷指定页的图片
 * GET /api/exam/[examId]/images/[pageIndex]
 *
 * pageIndex: 1-based page number (1, 2, 3, ...)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string; pageIndex: string }> }
) {
  const { examId, pageIndex } = await params
  const pageNum = parseInt(pageIndex, 10)

  if (isNaN(pageNum) || pageNum < 1) {
    return NextResponse.json(
      { error: "无效的页码" },
      { status: 400 }
    )
  }

  try {
    // 获取所有图片
    const allImages = await getExamImages(examId)

    // 找到对应页的图片
    const targetImage = allImages.find(img => img.pageIndex === pageNum)

    if (targetImage) {
      return new NextResponse(new Uint8Array(targetImage.data), {
        headers: {
          "Content-Type": targetImage.mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      })
    }

    return NextResponse.json(
      { error: "第" + pageNum + "页图片不存在" },
      { status: 404 }
    )
  } catch (error) {
    console.error(`[API] Error getting exam image page ${pageNum}:`, error)
    return NextResponse.json(
      { error: "获取图片失败" },
      { status: 500 }
    )
  }
}
