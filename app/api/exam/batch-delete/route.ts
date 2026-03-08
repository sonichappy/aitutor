import { NextRequest, NextResponse } from "next/server"
import { deleteExam, getExamData } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const { examIds } = await request.json()

    if (!Array.isArray(examIds) || examIds.length === 0) {
      return NextResponse.json(
        { error: "无效的试卷ID列表" },
        { status: 400 }
      )
    }

    // 验证所有试卷是否存在
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    }

    for (const examId of examIds) {
      try {
        // 验证试卷是否存在
        const exists = await getExamData(examId)
        if (!exists) {
          results.failed.push({ id: examId, error: "试卷不存在" })
          continue
        }

        // 删除试卷
        await deleteExam(examId)
        results.success.push(examId)
      } catch (error: any) {
        console.error(`Failed to delete exam ${examId}:`, error)
        results.failed.push({ id: examId, error: error.message || "删除失败" })
      }
    }

    return NextResponse.json({
      success: true,
      deleted: results.success.length,
      failed: results.failed.length,
      results
    })
  } catch (error: any) {
    console.error("Batch delete error:", error)
    return NextResponse.json(
      { error: "批量删除失败", details: error.message },
      { status: 500 }
    )
  }
}
