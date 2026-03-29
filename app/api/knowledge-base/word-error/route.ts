/**
 * 字词错误记录 API
 * POST /api/knowledge-base/word-error
 * GET /api/knowledge-base/[libraryId]/errors
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// 错误记录文件路径（存储在学科文件夹内）
const getErrorFilePath = (libraryId: string, subject: string) => {
  return path.join(
    process.cwd(),
    'data',
    'knowledge-base',
    subject || 'chinese',
    'errors',
    `${libraryId}.json`
  )
}

interface WordErrorRecord {
  wordId: string
  word: string
  errorCount: number
  lastErrorAt: string
  libraryId: string
  subject: string
}

/**
 * POST - 记录字词错误
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { libraryId, wordId, word, subject } = body

    if (!libraryId || !wordId || !word) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 读取现有错误记录
    const errorFile = getErrorFilePath(libraryId, subject)
    let errors: WordErrorRecord[] = []

    try {
      const content = await fs.readFile(errorFile, 'utf-8')
      const data = JSON.parse(content)
      errors = data.errors || []
    } catch (error) {
      // 文件不存在，创建新的
      errors = []
    }

    // 查找或创建错误记录
    const existingIndex = errors.findIndex(e => e.wordId === wordId)
    if (existingIndex >= 0) {
      // 更新现有记录
      errors[existingIndex].errorCount += 1
      errors[existingIndex].lastErrorAt = new Date().toISOString()
    } else {
      // 创建新记录
      errors.push({
        libraryId,
        subject: subject || 'chinese',
        wordId,
        word,
        errorCount: 1,
        lastErrorAt: new Date().toISOString()
      })
    }

    // 保存错误记录
    await fs.mkdir(path.dirname(errorFile), { recursive: true })
    await fs.writeFile(
      errorFile,
      JSON.stringify({ errors }, null, 2),
      'utf-8'
    )

    return NextResponse.json({
      success: true,
      data: {
        errorCount: errors[existingIndex >= 0 ? existingIndex : errors.length - 1].errorCount,
        lastErrorAt: errors[existingIndex >= 0 ? existingIndex : errors.length - 1].lastErrorAt
      }
    })
  } catch (error: any) {
    console.error('[记录字词错误] 失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '记录失败'
      },
      { status: 500 }
    )
  }
}
