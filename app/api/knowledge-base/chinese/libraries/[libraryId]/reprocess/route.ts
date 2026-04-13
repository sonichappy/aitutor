import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { callLLM } from '@/lib/ai/llm'
import { smartParseJSON } from '@/lib/ai/json-fixer'

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')

interface OCRResult {
  words: Array<{
    word: string
    pinyin: string
    meanings: string[]
  }>
}

// 使用AI进行OCR识别和字词解析
async function recognizeAndParseWords(imageBase64: string): Promise<OCRResult> {
  const prompt = `你是一个专业的语文教师。请分析这张图片中的生字词。

请按照以下JSON格式输出，不要包含任何其他文字：
{
  "words": [
    {
      "word": "汉字",
      "pinyin": "拼音",
      "meanings": ["释义1", "释义2"]
    }
  ]
}

识别规则：
1. 识别所有可见的汉字、词语
2. 拼音必须准确，包括声调
3. 释义要简洁准确
4. 严格按照JSON格式输出，不要添加任何markdown标记`

  const response = await callLLM([
    {
      role: 'system',
      content: '你是专业的语文教师，擅长汉字教学和图片识别。'
    },
    {
      role: 'user',
      content: prompt,
      images: [imageBase64]
    }
  ], { temperature: 0.3 })

  // 解析AI响应
  const content = response.content.trim()
  console.log('[OCR] AI Response (first 500 chars):', content.substring(0, 500))
  console.log('[OCR] AI Response length:', content.length)

  try {
    const parsed = smartParseJSON(content)
    console.log('[OCR] Successfully parsed', parsed.words?.length || 0, 'words')
    return parsed
  } catch (error: any) {
    console.error('[OCR] Failed to parse AI response:', error.message)
    throw new Error(`Failed to parse OCR result: ${error.message}`)
  }
}

// POST - 重新识别批次
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'Image name is required'
      }, { status: 400 })
    }

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 读取图片文件
    const imagePath = path.join(libraryDir, 'images', image)
    if (!existsSync(imagePath)) {
      return NextResponse.json({
        success: false,
        error: 'Image not found'
      }, { status: 404 })
    }

    const imageBuffer = await readFile(imagePath)

    // 转换为base64进行OCR识别
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`

    // 调用AI识别
    console.log('[Reprocess] Starting OCR recognition for:', image)
    const ocrResult = await recognizeAndParseWords(base64Image)

    // 读取现有的words.json
    const wordsPath = path.join(libraryDir, 'words.json')
    let existingWords: any[] = []
    if (existsSync(wordsPath)) {
      const wordsContent = await readFile(wordsPath, 'utf-8')
      existingWords = JSON.parse(wordsContent)
    }

    // 删除该批次之前的旧字词
    const originalCount = existingWords.length
    existingWords = existingWords.filter(w => w.sourceImage !== image)
    console.log(`[Reprocess] Removed ${originalCount - existingWords.length} old words from batch`)

    // 添加新识别的字词
    const timestampStr = new Date().toISOString()
    const newWords = ocrResult.words.map(w => ({
      id: `word-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      word: w.word,
      pinyin: w.pinyin,
      meanings: w.meanings,
      sourceImage: image,
      errorCount: 0,
      addedAt: timestampStr
    }))

    // 合并字词（去重）
    const wordMap = new Map()
    existingWords.forEach(w => wordMap.set(w.word, w))
    newWords.forEach(w => {
      const existing = wordMap.get(w.word)
      if (existing) {
        // 如果字词已存在，只更新图片来源
        if (!existing.sourceImages) {
          existing.sourceImages = [existing.sourceImage]
        }
        if (!existing.sourceImages.includes(image)) {
          existing.sourceImages.push(image)
        }
        existing.sourceImage = image // 更新最新的图片
      } else {
        wordMap.set(w.word, w)
      }
    })

    const updatedWords = Array.from(wordMap.values())
    await writeFile(wordsPath, JSON.stringify(updatedWords, null, 2))

    // 更新元数据
    const metadataPath = path.join(libraryDir, 'metadata.json')
    const metadataContent = await readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)
    metadata.wordCount = updatedWords.length
    metadata.updatedAt = timestampStr
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    // 同步更新 libraries.json
    const librariesIndexPath = path.join(CHINESE_BASE_DIR, 'libraries.json')
    const librariesIndexContent = await readFile(librariesIndexPath, 'utf-8')
    const librariesIndex = JSON.parse(librariesIndexContent)
    const libraryIndex = librariesIndex.libraries.findIndex((lib: any) => lib.id === libraryId)
    if (libraryIndex !== -1) {
      librariesIndex.libraries[libraryIndex].wordCount = updatedWords.length
      librariesIndex.libraries[libraryIndex].updatedAt = timestampStr
      await writeFile(librariesIndexPath, JSON.stringify(librariesIndex, null, 2))
    }

    console.log('[Reprocess] Recognition complete:', newWords.length, 'new words')

    return NextResponse.json({
      success: true,
      image: image,
      words: newWords,
      totalWords: updatedWords.length
    })
  } catch (error) {
    console.error('[API] Failed to reprocess batch:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reprocess batch'
    }, { status: 500 })
  }
}
