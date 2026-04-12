import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')

// GET - 获取字词列表
export async function GET(
  request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
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
        success: true,
        words: []
      })
    }

    const wordsContent = await readFile(wordsPath, 'utf-8')
    const words = JSON.parse(wordsContent)

    return NextResponse.json({
      success: true,
      words
    })
  } catch (error) {
    console.error('[API] Failed to get words:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get words'
    }, { status: 500 })
  }
}

// POST - 添加新字词
export async function POST(
  request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
    const { word, pinyin, meanings } = await request.json()

    if (!word || !pinyin || !meanings) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    const wordsPath = path.join(libraryDir, 'words.json')
    let words: any[] = []
    if (existsSync(wordsPath)) {
      const wordsContent = await readFile(wordsPath, 'utf-8')
      words = JSON.parse(wordsContent)
    }

    // 检查是否已存在
    const existing = words.find(w => w.word === word)
    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Word already exists'
      }, { status: 400 })
    }

    // 添加新字词
    const newWord = {
      id: `word-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      word,
      pinyin,
      meanings,
      errorCount: 0,
      addedAt: new Date().toISOString()
    }

    words.push(newWord)
    await writeFile(wordsPath, JSON.stringify(words, null, 2))

    return NextResponse.json({
      success: true,
      word: newWord
    })
  } catch (error) {
    console.error('[API] Failed to add word:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add word'
    }, { status: 500 })
  }
}
