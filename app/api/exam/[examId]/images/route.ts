import { NextRequest, NextResponse } from "next/server"
import { getExamImages } from "@/lib/storage"

/**
 * 获取试卷的所有图片
 * GET /api/exam/[examId]/images
 *
 * 返回格式:
 * {
 *   images: [
 *     { pageIndex: 1, url: "/api/exam/[examId]/images/1" },
 *     { pageIndex: 2, url: "/api/exam/[examId]/images/2" }
 *   ],
 *   total: number
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params

  try {
    // 从文件系统读取所有图片信息
    const { getExamPageCount } = await import("@/lib/storage")
    const pageCount = await getExamPageCount(examId)

    const images = Array.from({ length: pageCount }, (_, i) => ({
      pageIndex: i + 1,
      url: `/api/exam/${examId}/images/${i + 1}`
    }))

    return NextResponse.json({
      images,
      total: pageCount
    })
  } catch (error) {
    console.error("[API] Error getting exam images:", error)
    return NextResponse.json(
      { error: "获取图片列表失败", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
