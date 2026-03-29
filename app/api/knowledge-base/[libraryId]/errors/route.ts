/**
 * 获取知识库字词错误记录 API
 * GET /api/knowledge-base/[libraryId]/errors
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params

    // 获取知识库根目录下的所有子目录（学科目录）
    const knowledgeBaseDir = path.join(process.cwd(), 'data', 'knowledge-base')
    const subjects = ['chinese', 'english', '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

    for (const subject of subjects) {
      const errorFile = path.join(
        knowledgeBaseDir,
        subject,
        'errors',
        `${libraryId}.json`
      )

      try {
        const content = await fs.readFile(errorFile, 'utf-8')
        const data = JSON.parse(content)

        return NextResponse.json({
          success: true,
          data: {
            errors: data.errors || []
          }
        })
      } catch (error) {
        // 这个学科目录中没有，继续搜索
        continue
      }
    }

    // 所有学科目录都没找到，返回空数组
    return NextResponse.json({
      success: true,
      data: {
        errors: []
      }
    })
  } catch (error: any) {
    console.error('[获取字词错误记录] 失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取失败'
      },
      { status: 500 }
    )
  }
}
