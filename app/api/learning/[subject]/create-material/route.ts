/**
 * 创建学习材料 API
 * POST /api/learning/[subject]/create-material
 */

import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const MATERIALS_DIR = path.join(process.cwd(), 'data', 'exercises')

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  try {
    const { subject } = await params
    const body = await request.json()
    const { knowledgePoint, severity, learningContent, questions, sources } = body

    if (!knowledgePoint) {
      return NextResponse.json(
        { success: false, error: "缺少知识点名称" },
        { status: 400 }
      )
    }

    const folderName = await getSubjectFolderName(subject)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeKnowledgePoint = knowledgePoint.replace(/[<>:"/\\|?*]/g, '_')
    const materialId = `${timestamp}-${safeKnowledgePoint}`

    const materialDir = path.join(MATERIALS_DIR, folderName, materialId)
    await fs.mkdir(materialDir, { recursive: true })

    const material = {
      id: materialId,
      knowledgePoint,
      severity: severity || 3,
      learningContent: learningContent || '',
      questions: questions || [],
      sources: sources || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await fs.writeFile(
      path.join(materialDir, 'data.json'),
      JSON.stringify(material, null, 2),
      'utf-8'
    )

    return NextResponse.json({
      success: true,
      message: "学习材料创建成功",
      data: material
    })

  } catch (error: any) {
    console.error("[创建学习材料 API] 错误:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "创建失败"
      },
      { status: 500 }
    )
  }
}
