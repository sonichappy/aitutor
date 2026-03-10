/**
 * 深入分析报告 API
 * 获取指定学科的所有深度分析报告
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDeepResearchReports } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  try {
    const { subject } = await params

    const reports = await getDeepResearchReports(subject)

    return NextResponse.json({
      subject,
      reports,
      total: reports.length
    })
  } catch (error: any) {
    console.error('[Deep Research Reports API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取深度分析报告失败',
        details: error.message
      },
      { status: 500 }
    )
  }
}
