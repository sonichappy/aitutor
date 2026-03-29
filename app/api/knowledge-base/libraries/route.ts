/**
 * 获取知识库列表 API（通过扫描文件夹）
 * GET /api/knowledge-base/libraries?subject={subject}
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface MetaData {
  id: string
  subject: string
  name: string
  description: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const subject = searchParams.get('subject')

    if (!subject) {
      return NextResponse.json(
        { success: false, error: '缺少学科参数' },
        { status: 400 }
      )
    }

    const knowledgeBaseDir = path.join(
      process.cwd(),
      'data',
      'knowledge-base',
      subject
    )

    let libraries: any[] = []

    try {
      // 读取知识库目录下的所有子目录
      const entries = await fs.readdir(knowledgeBaseDir, { withFileTypes: true })

      // 过滤出目录，并排除系统文件
      const directories = entries.filter(entry =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'errors'
      )

      // 遍历每个目录，读取元数据
      for (const dir of directories) {
        const libraryDir = path.join(knowledgeBaseDir, dir.name)
        const metaFile = path.join(libraryDir, 'meta.json')
        const wordsFile = path.join(libraryDir, 'words.json')

        try {
          // 检查 meta.json 和 words.json 是否都存在
          await fs.access(metaFile)
          await fs.access(wordsFile)

          // 读取元数据
          const metaContent = await fs.readFile(metaFile, 'utf-8')
          const metadata: MetaData = JSON.parse(metaContent)

          // 读取字词数据以获取字词数量
          const wordsContent = await fs.readFile(wordsFile, 'utf-8')
          const wordsData = JSON.parse(wordsContent)

          libraries.push({
            ...metadata,
            wordCount: wordsData.words?.length || 0
          })
        } catch (error) {
          // 目录不完整（缺少meta.json或words.json），跳过
          console.log(`[知识库扫描] 跳过不完整的目录: ${dir.name}`)
          continue
        }
      }

      // 按创建时间排序（最新的在前）
      libraries.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      return NextResponse.json({
        success: true,
        data: {
          libraries,
          totalLibraries: libraries.length
        }
      })
    } catch (error) {
      // 目录不存在或读取失败
      return NextResponse.json({
        success: true,
        data: {
          libraries: [],
          totalLibraries: 0
        }
      })
    }
  } catch (error: any) {
    console.error('[获取知识库列表] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取失败'
      },
      { status: 500 }
    )
  }
}
