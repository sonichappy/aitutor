import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { callLLM } from '@/lib/ai/llm'
import { smartParseJSON } from '@/lib/ai/json-fixer'

const ENGLISH_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'english')

interface OCRResult {
  words: Array<{
    word: string
    pronunciation: string
    partOfSpeech: string
    meanings: string[]
    example?: string
  }>
}

// 使用AI进行OCR识别和单词解析
async function recognizeAndParseWords(imageBase64: string): Promise<OCRResult> {
  const prompt = `你是一个专业的英语教师。请仔细分析这张图片中的英语单词或词组。

**重要任务：识别图片中的所有单词/词组**
- 图片中可能有多行单词，请识别出**所有行**，不要遗漏任何一行
- 逐行扫描整个图片，确保识别出每一个单词

图片格式说明：
- 单词行：单词、音标、词性、汉语意思（按顺序排列）
- 词组行：只有词组+汉语意思

**重要排版规则：**
1. 如果一行中出现多个斜体词性标记（如 "n. ... v. ..."），表示该词有两个词性
2. 如果一行的开头就是斜体词性标记（如缩进后的 "v. ..."），则该词性是上一行单词的第二个词性

请按照以下JSON格式输出，不要包含任何其他文字：
{
  "words": [
    {
      "word": "英语单词或词组",
      "pronunciation": "音标（仅单词有，词组留空字符串）",
      "partOfSpeech": "词性，如有多个用/分隔（如 'n./v.'，词组留空字符串）",
      "meanings": ["中文释义1", "中文释义2"],
      "example": "英文例句（可选）"
    }
  ]
}

识别规则：
1. **单词行**：提取单词、音标、第一个词性及其释义
2. **多词性行**：
   - 如果同一行有多个词性，合并到一个条目，用"/"连接词性
   - 如果下一条行开头是词性标记，将其作为上一单词的第二个词性
3. **词组行**：只提取词组和释义，pronunciation和partOfSpeech留空字符串
4. 音标必须准确，使用IPA音标
5. 词性使用标准缩写（n./v./adj./adv./prep./conj./pron.等）
6. 释义要简洁准确，多个词性的释义分别列出
7. 严格按照JSON格式输出，不要添加任何markdown标记
8. **必须识别图片中的所有单词，不能遗漏任何一行**`

  const response = await callLLM([
    {
      role: 'system',
      content: '你是专业的英语教师，擅长英语词汇教学和图片识别。'
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
  console.log('[OCR] Full AI Response:', content)

  try {
    const parsed = smartParseJSON(content)
    const wordCount = parsed.words?.length || 0
    console.log('[OCR] Successfully parsed', wordCount, 'words')

    if (wordCount === 0) {
      console.warn('[OCR] Warning: No words detected!')
    } else if (wordCount < 3) {
      console.warn('[OCR] Warning: Only', wordCount, 'words detected. Expected more from a table.')
    }

    console.log('[OCR] Recognized words:', parsed.words?.map((w: any) => w.word).join(', '))

    return parsed
  } catch (error: any) {
    console.error('[OCR] Failed to parse AI response:', error.message)
    console.error('[OCR] Full response that failed:', content)
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

    const libraryDir = path.join(ENGLISH_BASE_DIR, libraryId)
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

    // 删除该批次之前的旧单词
    const originalCount = existingWords.length
    existingWords = existingWords.filter(w => w.sourceImage !== image)
    console.log(`[Reprocess] Removed ${originalCount - existingWords.length} old words from batch`)

    // 添加新识别的单词
    const timestampStr = new Date().toISOString()
    const newWords = ocrResult.words.map(w => ({
      id: `word-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      word: w.word,
      pronunciation: w.pronunciation,
      partOfSpeech: w.partOfSpeech,
      meanings: w.meanings,
      example: w.example,
      sourceImage: image,
      errorCount: 0,
      addedAt: timestampStr
    }))

    // 合并单词（去重）
    const wordMap = new Map()
    existingWords.forEach(w => wordMap.set(w.word.toLowerCase(), w))
    newWords.forEach(w => {
      const existing = wordMap.get(w.word.toLowerCase())
      if (existing) {
        // 如果单词已存在，只更新图片来源
        if (!existing.sourceImages) {
          existing.sourceImages = [existing.sourceImage]
        }
        if (!existing.sourceImages.includes(image)) {
          existing.sourceImages.push(image)
        }
        existing.sourceImage = image // 更新最新的图片
      } else {
        wordMap.set(w.word.toLowerCase(), w)
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
    const librariesIndexPath = path.join(ENGLISH_BASE_DIR, 'libraries.json')
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
