/**
 * 知识库上传 API
 * POST /api/knowledge-base/upload
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseChineseWordsMarkdown } from '@/lib/knowledge-base/parser'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subject, name, markdown, description } = body

    // 验证请求
    if (!subject) {
      return NextResponse.json(
        { success: false, error: '缺少学科参数' },
        { status: 400 }
      )
    }

    if (!markdown) {
      return NextResponse.json(
        { success: false, error: '缺少 Markdown 内容' },
        { status: 400 }
      )
    }

    // 解析 Markdown
    let parsedLibrary
    if (subject === 'chinese') {
      parsedLibrary = parseChineseWordsMarkdown(markdown)
    } else if (subject === 'english') {
      return NextResponse.json(
        { success: false, error: '英语单词表解析功能即将推出' },
        { status: 501 }
      )
    } else {
      return NextResponse.json(
        { success: false, error: `不支持的学科: ${subject}` },
        { status: 400 }
      )
    }

    // 使用提供的名称或解析出的名称
    const libraryName = name || parsedLibrary.name

    // 生成知识库 ID
    const libraryId = `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 创建知识库目录
    const knowledgeBaseDir = path.join(process.cwd(), 'data', 'knowledge-base', subject)
    const libraryDir = path.join(knowledgeBaseDir, libraryId)

    await fs.mkdir(libraryDir, { recursive: true })

    // 保存元数据
    const metadata = {
      id: libraryId,
      subject,
      name: libraryName,
      description: description || parsedLibrary.description || '',
      wordCount: parsedLibrary.words.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await fs.writeFile(
      path.join(libraryDir, 'meta.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    )

    // 保存字词数据
    const wordsData = {
      libraryId,
      words: parsedLibrary.words
    }

    await fs.writeFile(
      path.join(libraryDir, 'words.json'),
      JSON.stringify(wordsData, null, 2),
      'utf-8'
    )

    // 更新索引文件
    await updateLibraryIndex(subject, metadata)

    return NextResponse.json({
      success: true,
      data: {
        libraryId,
        name: libraryName,
        wordCount: parsedLibrary.words.length,
        words: parsedLibrary.words.slice(0, 5), // 返回前5个作为预览
        message: `成功上传 ${parsedLibrary.words.length} 个字词`
      }
    })
  } catch (error: any) {
    console.error('[知识库上传] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '上传失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}

/**
 * 更新知识库索引
 */
async function updateLibraryIndex(subject: string, metadata: any) {
  const indexFile = path.join(process.cwd(), 'data', 'knowledge-base', subject, 'libraries.json')

  let libraries = []

  try {
    // 读取现有索引
    const indexContent = await fs.readFile(indexFile, 'utf-8')
    const indexData = JSON.parse(indexContent)
    libraries = indexData.libraries || []
  } catch (error) {
    // 文件不存在，创建新索引
    libraries = []
  }

  // 添加新知识库
  libraries.push(metadata)

  // 保存索引
  await fs.mkdir(path.dirname(indexFile), { recursive: true })
  await fs.writeFile(
    indexFile,
    JSON.stringify({ libraries }, null, 2),
    'utf-8'
  )
}
