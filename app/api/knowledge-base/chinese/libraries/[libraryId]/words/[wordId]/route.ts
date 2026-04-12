import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')

// PATCH - 更新字词（包括错误次数）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { libraryId: string; wordId: string } }
) {
  try {
    const { libraryId, wordId } = params
    const { errorCount, pinyin, meanings } = await request.json()

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    const wordsPath = path.join(libraryDir, 'words.json')
    if (!existsSync(wordsPath)) {
      return NextResponse.json({
        success: false,
        error: 'Words file not found'
      }, { status: 404 })
    }

    const wordsContent = await readFile(wordsPath, 'utf-8')
    const words = JSON.parse(wordsContent)

    const wordIndex = words.findIndex((w: any) => w.id === wordId)
    if (wordIndex === -1) {
      return NextResponse.json({
        success: false,
        error: 'Word not found'
      }, { status: 404 })
    }

    // 更新字段
    if (errorCount !== undefined) {
      words[wordIndex].errorCount = errorCount
    }
    if (pinyin !== undefined) {
      words[wordIndex].pinyin = pinyin
    }
    if (meanings !== undefined) {
      words[wordIndex].meanings = meanings
    }

    await writeFile(wordsPath, JSON.stringify(words, null, 2))

    return NextResponse.json({
      success: true,
      word: words[wordIndex]
    })
  } catch (error) {
    console.error('[API] Failed to update word:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update word'
    }, { status: 500 })
  }
}

// DELETE - 删除字词
export async function DELETE(
  request: NextRequest,
  { params }: { params: { libraryId: string; wordId: string } }
) {
  try {
    const { libraryId, wordId } = params

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    const wordsPath = path.join(libraryDir, 'words.json')
    if (!existsSync(wordsPath)) {
      return NextResponse.json({
        success: false,
        error: 'Words file not found'
      }, { status: 404 })
    }

    const wordsContent = await readFile(wordsPath, 'utf-8')
    const words = JSON.parse(wordsContent)

    const filteredWords = words.filter((w: any) => w.id !== wordId)

    await writeFile(wordsPath, JSON.stringify(filteredWords, null, 2))

    return NextResponse.json({
      success: true,
      message: 'Word deleted successfully'
    })
  } catch (error) {
    console.error('[API] Failed to delete word:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete word'
    }, { status: 500 })
  }
}
