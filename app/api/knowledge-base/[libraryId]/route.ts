/**
 * 获取知识库详情 API
 * GET /api/knowledge-base/{libraryId}
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // 在所有学科目录中搜索知识库
    const subjects = ['chinese', 'english']
    let foundLibrary = null
    let wordsData = null

    for (const subject of subjects) {
      const libraryDir = path.join(
        process.cwd(),
        'data',
        'knowledge-base',
        subject,
        libraryId
      )

      try {
        // 读取元数据
        const metaContent = await fs.readFile(
          path.join(libraryDir, 'meta.json'),
          'utf-8'
        )
        foundLibrary = JSON.parse(metaContent)

        // 读取字词数据
        const wordsContent = await fs.readFile(
          path.join(libraryDir, 'words.json'),
          'utf-8'
        )
        wordsData = JSON.parse(wordsContent)

        break // 找到了，停止搜索
      } catch (error) {
        // 这个目录不存在或没有数据，继续搜索
        continue
      }
    }

    if (!foundLibrary || !wordsData) {
      return NextResponse.json(
        {
          success: false,
          error: '知识库不存在'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        library: foundLibrary,
        words: wordsData.words || []
      }
    })
  } catch (error: any) {
    console.error('[获取知识库详情] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取失败'
      },
      { status: 500 }
    )
  }
}

// DELETE 方法：删除知识库
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // 在所有学科目录中搜索知识库
    const subjects = ['chinese', 'english']

    for (const subject of subjects) {
      const libraryDir = path.join(
        process.cwd(),
        'data',
        'knowledge-base',
        subject,
        libraryId
      )

      try {
        // 检查目录是否存在
        await fs.access(libraryDir)

        // 删除目录
        await fs.rm(libraryDir, { recursive: true, force: true })

        // 更新索引文件
        await removeLibraryFromIndex(subject, libraryId)

        return NextResponse.json({
          success: true,
          message: '知识库已删除'
        })
      } catch (error) {
        // 这个目录不存在，继续搜索
        continue
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: '知识库不存在'
      },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('[删除知识库] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '删除失败'
      },
      { status: 500 }
    )
  }
}

/**
 * 从索引中移除知识库
 */
async function removeLibraryFromIndex(subject: string, libraryId: string) {
  const indexFile = path.join(
    process.cwd(),
    'data',
    'knowledge-base',
    subject,
    'libraries.json'
  )

  try {
    const content = await fs.readFile(indexFile, 'utf-8')
    const data = JSON.parse(content)

    // 过滤掉要删除的知识库
    data.libraries = data.libraries.filter((lib: any) => lib.id !== libraryId)

    // 保存更新后的索引
    await fs.writeFile(
      indexFile,
      JSON.stringify(data, null, 2),
      'utf-8'
    )
  } catch (error) {
    console.error('[更新索引] 失败:', error)
  }
}
