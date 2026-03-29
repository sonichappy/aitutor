/**
 * 删除学习材料 API
 * DELETE /api/learning/[subject]/materials/[materialId]
 */

import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const MATERIALS_DIR = path.join(process.cwd(), 'data', 'exercises')
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string; materialId: string }> }
) {
  try {
    const { subject, materialId } = await params

    const folderName = await getSubjectFolderName(subject)
    const materialPath = path.join(MATERIALS_DIR, folderName, `${materialId}.json`)

    // 读取材料信息
    let materialData
    try {
      const content = await fs.readFile(materialPath, 'utf-8')
      materialData = JSON.parse(content)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "学习材料不存在" },
        { status: 404 }
      )
    }

    // 删除材料文件
    await fs.unlink(materialPath)

    // 归档对应的薄弱知识点
    const weakPointsPath = path.join(WEAK_DIR, `${folderName}.json`)
    let weakPoints: any[] = []

    try {
      const content = await fs.readFile(weakPointsPath, 'utf-8')
      weakPoints = JSON.parse(content)
    } catch {
      // 文件不存在，跳过
      return NextResponse.json({
        success: true,
        message: "学习材料已删除"
      })
    }

    // 查找并归档对应的薄弱知识点
    const knowledgePoint = materialData.knowledgePoint
    const targetIndex = weakPoints.findIndex(wp => wp.point === knowledgePoint)

    if (targetIndex !== -1 && !weakPoints[targetIndex].archived) {
      // 归档知识点
      weakPoints[targetIndex].archived = true
      weakPoints[targetIndex].archivedAt = new Date().toISOString()

      // 保存更新后的薄弱知识点
      await fs.writeFile(weakPointsPath, JSON.stringify(weakPoints, null, 2), 'utf-8')
    }

    return NextResponse.json({
      success: true,
      message: "学习材料已删除，对应的薄弱知识点已归档"
    })

  } catch (error: any) {
    console.error("[删除学习材料 API] 错误:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "删除失败"
      },
      { status: 500 }
    )
  }
}
