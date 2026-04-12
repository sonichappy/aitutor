import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { callLLM } from '@/lib/ai/llm'

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
  const prompt = `你是一个专业的语文教师。请分析这张图片中的田字格汉字或词组。

请按照以下JSON格式输出，不要包含任何其他文字：
{
  "words": [
    {
      "word": "汉字或词组",
      "pinyin": "拼音（带声调）",
      "meanings": ["释义1", "释义2"]
    }
  ]
}

注意事项：
1. 识别所有可见的汉字或词组
2. 拼音必须准确，包含声调
3. 释义要简洁准确，适合中学生理解
4. 如果是成语，给出成语释义
5. 如果是单个字，给出基本义项
6. 严格按照JSON格式输出，不要添加任何markdown标记`

  const response = await callLLM([
    {
      role: 'system',
      content: '你是专业的语文教师，擅长汉字识别和教学。'
    },
    {
      role: 'user',
      content: prompt,
      images: [imageBase64]
    }
  ], { temperature: 0.3 })

  // 解析AI响应
  const content = response.content.trim()
  console.log('[OCR] AI Response:', content.substring(0, 200))

  // 尝试提取JSON（去除可能的markdown标记）
  let jsonStr = content
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (error) {
    console.error('[OCR] Failed to parse AI response:', error)
    throw new Error('Failed to parse OCR result')
  }
}

// POST - 上传图片并识别字词
export async function POST(
  request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'No image provided'
      }, { status: 400 })
    }

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 保存图片
    const imagesDir = path.join(libraryDir, 'images')
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true })
    }

    const timestamp = Date.now()
    const filename = `image-${timestamp}.png`
    const imagePath = path.join(imagesDir, filename)

    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(imagePath, buffer)

    console.log('[Upload] Image saved:', filename)

    // 转换为base64进行OCR识别
    const base64Image = `data:image/png;base64,${buffer.toString('base64')}`

    // 调用AI识别
    console.log('[Upload] Starting OCR recognition...')
    const ocrResult = await recognizeAndParseWords(base64Image)

    // 读取现有的words.json
    const wordsPath = path.join(libraryDir, 'words.json')
    let existingWords: any[] = []
    if (existsSync(wordsPath)) {
      const wordsContent = await readFile(wordsPath, 'utf-8')
      existingWords = JSON.parse(wordsContent)
    }

    // 添加新识别的字词
    const timestampStr = new Date().toISOString()
    const newWords = ocrResult.words.map(w => ({
      id: `word-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      word: w.word,
      pinyin: w.pinyin,
      meanings: w.meanings,
      sourceImage: filename,
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
        if (!existing.sourceImages.includes(filename)) {
          existing.sourceImages.push(filename)
        }
        existing.sourceImage = filename // 更新最新的图片
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

    console.log('[Upload] Recognition complete:', newWords.length, 'words')

    return NextResponse.json({
      success: true,
      image: filename,
      words: newWords,
      totalWords: updatedWords.length
    })
  } catch (error) {
    console.error('[API] Failed to upload image:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image'
    }, { status: 500 })
  }
}
