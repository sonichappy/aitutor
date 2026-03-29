/**
 * 导入知识库 API
 * POST /api/knowledge-base/import
 */

import { NextRequest, NextResponse } from 'next/server'
import { importAllWordLists } from '@/lib/knowledge-base/import'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subject } = body

    // 验证请求
    if (!subject) {
      return NextResponse.json(
        { success: false, error: '缺少学科参数' },
        { status: 400 }
      )
    }

    if (subject !== 'chinese') {
      return NextResponse.json(
        { success: false, error: `目前只支持语文学科，${subject} 即将推出` },
        { status: 400 }
      )
    }

    // 执行导入
    const results = await importAllWordLists()

    return NextResponse.json({
      success: true,
      data: {
        message: `成功导入 ${results.length} 个字词表`,
        libraries: results,
        totalWords: results.reduce((sum, r) => sum + r.wordCount, 0)
      }
    })
  } catch (error: any) {
    console.error('[导入知识库] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '导入失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}

// GET 方法支持查询导入状态
export async function GET() {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')

    const indexFile = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese', 'libraries.json')

    try {
      const content = await fs.readFile(indexFile, 'utf-8')
      const data = JSON.parse(content)

      return NextResponse.json({
        success: true,
        data: {
          libraries: data.libraries || [],
          totalLibraries: data.libraries?.length || 0
        }
      })
    } catch (error) {
      // 索引文件不存在
      return NextResponse.json({
        success: true,
        data: {
          libraries: [],
          totalLibraries: 0,
          message: '暂无知识库，请先导入'
        }
      })
    }
  } catch (error: any) {
    console.error('[查询知识库] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '查询失败'
      },
      { status: 500 }
    )
  }
}
