import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

interface WeakPoint {
  point: string
  severity: number
  reason: string
  priority: number
  count: number  // 出现次数/计数
  sourceReports: string[]  // 来源报告ID列表
  addedAt: string
}

// 薄弱知识点存储目录
const WEAK_DIR = path.join(process.cwd(), 'data', 'weak')

// 获取学科的 folderName（英文名）
async function getSubjectFolderName(subject: string): Promise<string> {
  try {
    const subjectsPath = path.join(process.cwd(), 'data', 'subjects.json')
    const subjectsRaw = await fs.readFile(subjectsPath, 'utf-8')
    const subjectsData = JSON.parse(subjectsRaw)

    const matchedSubject = subjectsData.subjects?.find((s: any) => s.name === subject)
    return matchedSubject?.folderName || subject.toLowerCase()
  } catch {
    return subject.toLowerCase()
  }
}

/**
 * 获取学科的薄弱知识点列表
 * GET /api/learning/[subject]/weak-points
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    // 使用学科 folderName（英文名）作为文件名: data/weak/{folderName}.json
    const folderName = await getSubjectFolderName(subject)
    const weakPointsPath = path.join(WEAK_DIR, `${folderName}.json`)

    let weakPoints: WeakPoint[] = []
    try {
      const content = await fs.readFile(weakPointsPath, 'utf-8')
      weakPoints = JSON.parse(content)
    } catch {
      // 文件不存在，返回空数组
    }

    return NextResponse.json({
      success: true,
      weakPoints
    })
  } catch (error: any) {
    console.error("[Weak Points GET API] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "获取薄弱知识点列表失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * 添加或更新薄弱知识点
 * POST /api/learning/[subject]/weak-points
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params

  try {
    const body = await request.json()
    const { weakPoints: newWeakPoints } = body as { weakPoints: Array<{ point: string; severity: number; reason: string; priority: number; sourceReportId: string }> }

    if (!newWeakPoints || newWeakPoints.length === 0) {
      return NextResponse.json(
        { success: false, error: "请提供要添加的薄弱知识点" },
        { status: 400 }
      )
    }

    // 确保目录存在
    await fs.mkdir(WEAK_DIR, { recursive: true })

    // 使用学科 folderName（英文名）作为文件名: data/weak/{folderName}.json
    const folderName = await getSubjectFolderName(subject)
    const weakPointsPath = path.join(WEAK_DIR, `${folderName}.json`)

    // 读取现有薄弱项列表
    let existingWeakPoints: WeakPoint[] = []
    try {
      const content = await fs.readFile(weakPointsPath, 'utf-8')
      existingWeakPoints = JSON.parse(content)
    } catch {
      // 文件不存在
    }

    // 合并薄弱项（去重，增加计数）
    const now = new Date().toISOString()
    const weakPointsMap = new Map<string, WeakPoint>()

    // 先添加现有的
    existingWeakPoints.forEach(wp => {
      weakPointsMap.set(wp.point, wp)
    })

    // 添加或更新新的
    newWeakPoints.forEach(nwp => {
      const existing = weakPointsMap.get(nwp.point)
      if (existing) {
        // 已存在，增加计数
        existing.count += 1
        existing.severity = Math.max(existing.severity, nwp.severity)
        if (!existing.sourceReports.includes(nwp.sourceReportId)) {
          existing.sourceReports.push(nwp.sourceReportId)
        }
      } else {
        // 新增
        weakPointsMap.set(nwp.point, {
          point: nwp.point,
          severity: nwp.severity,
          reason: nwp.reason,
          priority: nwp.priority,
          count: 1,
          sourceReports: [nwp.sourceReportId],
          addedAt: now
        })
      }
    })

    // 转换为数组并按优先级排序
    const sortedWeakPoints = Array.from(weakPointsMap.values()).sort((a, b) => a.priority - b.priority)

    // 保存
    await fs.writeFile(weakPointsPath, JSON.stringify(sortedWeakPoints, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      weakPoints: sortedWeakPoints,
      message: `已添加 ${newWeakPoints.length} 个薄弱知识点`
    })

  } catch (error: any) {
    console.error("[Weak Points POST API] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "保存薄弱知识点失败",
        details: error.message
      },
      { status: 500 }
    )
  }
}
