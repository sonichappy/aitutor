import { NextRequest, NextResponse } from "next/server"
import { getSubjectReport, deleteSubjectReport } from "@/lib/storage"

// GET - 获取单个报告详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string; reportId: string }> }
) {
  const { subject, reportId } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    const report = await getSubjectReport(decodedSubject, reportId)

    if (!report) {
      return NextResponse.json(
        { error: "报告不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json(report)
  } catch (error: any) {
    console.error("[Report Detail GET] Error:", error)
    return NextResponse.json(
      { error: "获取报告详情失败", details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - 删除单个报告
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string; reportId: string }> }
) {
  const { subject, reportId } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    await deleteSubjectReport(decodedSubject, reportId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Report Detail DELETE] Error:", error)
    return NextResponse.json(
      { error: "删除报告失败", details: error.message },
      { status: 500 }
    )
  }
}
