import { NextRequest, NextResponse } from "next/server"
import { getDeepResearchReports } from "@/lib/storage"

/**
 * 获取学科的深入分析报告
 * GET /api/learning/[subject]/deep-reports?timeRange=week|month|quarter|all
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  const searchParams = request.nextUrl.searchParams
  const timeRange = searchParams.get('timeRange') || 'all'

  try {
    const allReports = await getDeepResearchReports(subject)

    // 根据时间范围筛选
    const now = new Date()
    const filteredReports = allReports.filter(report => {
      const reportDate = new Date(report.generatedAt)
      const diffDays = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24)

      switch (timeRange) {
        case 'week':
          return diffDays <= 7
        case 'month':
          return diffDays <= 30
        case 'quarter':
          return diffDays <= 90
        default:
          return true
      }
    })

    // 按时间倒序排列
    const sortedReports = filteredReports.sort((a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )

    return NextResponse.json({
      success: true,
      reports: sortedReports.map(r => ({
        id: r.id || '',
        generatedAt: r.generatedAt,
        summary: r.summary?.substring(0, 200) + '...'
      }))
    })
  } catch (error: any) {
    console.error("[Deep Reports API] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "获取深入分析报告失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}
