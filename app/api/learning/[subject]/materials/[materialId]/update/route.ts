/**
 * 更新学习材料题目 API
 * PATCH /api/learning/[subject]/materials/[materialId]/update
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string; materialId: string }> }
) {
  try {
    const { subject, materialId } = await params
    const body = await request.json()
    const { questions } = body

    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { success: false, error: "题目格式不正确" },
        { status: 400 }
      )
    }

    const folderName = await getSubjectFolderName(subject)
    const materialPath = path.join(MATERIALS_DIR, folderName, `${materialId}.json`)

    // 读取现有材料
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

    // 更新题目
    materialData.questions = questions
    materialData.updatedAt = new Date().toISOString()

    // 保存更新后的材料
    await fs.writeFile(materialPath, JSON.stringify(materialData, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      message: "题目更新成功",
      data: materialData
    })

  } catch (error: any) {
    console.error("[更新学习材料题目 API] 错误:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "更新失败"
      },
      { status: 500 }
    )
  }
}
