import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { callLLM } from '@/lib/ai/llm'
import { smartParseJSON } from '@/lib/ai/json-fixer'

const ENGLISH_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'english')

interface IrregularVerb {
  word: string
  pronunciation: string
  meanings: string[]
  pastForm: string
  pastParticiple?: string
  presentParticiple?: string
}

interface OCRResult {
  words: IrregularVerb[]
}

// 使用AI进行OCR识别不规则动词表格
async function recognizeIrregularVerbs(imageBase64: string): Promise<OCRResult> {
  const prompt = `你是一个专业的英语教师。请分析这张图片中的不规则动词表格。

**任务：识别表格中的所有不规则动词**

请仔细查看图片，识别出表格中的**每一行**动词。不要遗漏任何一行。

**输出格式（JSON）：**
\`\`\`json
{
  "words": [
    {
      "word": "go",
      "pronunciation": "[ɡəʊ]",
      "meanings": ["去", "走"],
      "pastForm": "went",
      "pastParticiple": "gone",
      "presentParticiple": "going"
    }
  ]
}
\`\`\`

**识别规则：**
1. word: 动词原型（基础形式）
2. pronunciation: 音标（包含方括号）
3. meanings: 中文释义数组（所有释义）
4. pastForm: 过去式
5. pastParticiple: 过去分词（如果有）
6. presentParticiple: 现在分词（如果有）

**重要提醒：**
- 必须识别图片中的所有行
- 如果某个字段不存在，用空字符串""
- 只输出JSON，不要其他文字`

  const response = await callLLM([
    {
      role: 'system',
      content: '你是专业的英语教师，擅长英语不规则动词教学和图片识别。你非常仔细，能够识别表格中的所有内容，不会遗漏任何一行。'
    },
    {
      role: 'user',
      content: prompt,
      images: [imageBase64]
    }
  ], { temperature: 0.1 }) // 降低温度以获得更一致和准确的输出

  // 解析AI响应
  const content = response.content.trim()
  console.log('[Irregular Verbs OCR] AI Response (first 500 chars):', content.substring(0, 500))
  console.log('[Irregular Verbs OCR] AI Response length:', content.length)
  console.log('[Irregular Verbs OCR] Full AI Response:', content)

  try {
    const parsed = smartParseJSON(content)
    const wordCount = parsed.words?.length || 0
    console.log('[Irregular Verbs OCR] Successfully parsed', wordCount, 'irregular verbs')

    if (wordCount === 0) {
      console.warn('[Irregular Verbs OCR] Warning: No words detected! AI may have failed to recognize the table.')
      console.warn('[Irregular Verbs OCR] Full response:', content)
    } else if (wordCount < 3) {
      console.warn('[Irregular Verbs OCR] Warning: Only', wordCount, 'words detected. Expected more from a table.')
    }

    // 输出识别到的单词列表以便调试
    console.log('[Irregular Verbs OCR] Recognized words:', parsed.words?.map((w: any) => w.word).join(', '))

    return parsed
  } catch (error: any) {
    console.error('[Irregular Verbs OCR] Failed to parse AI response:', error.message)
    console.error('[Irregular Verbs OCR] Full response that failed:', content)
    throw new Error(`Failed to parse OCR result: ${error.message}`)
  }
}

// POST - 上传不规则动词表格图片并识别
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'No image provided'
      }, { status: 400 })
    }

    const libraryDir = path.join(ENGLISH_BASE_DIR, libraryId)
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
    const filename = `irregular-${timestamp}.png`
    const imagePath = path.join(imagesDir, filename)

    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(imagePath, buffer)

    console.log('[Irregular Verbs Upload] Image saved:', filename)

    // 转换为base64进行OCR识别
    const base64Image = `data:image/png;base64,${buffer.toString('base64')}`

    // 调用AI识别
    console.log('[Irregular Verbs Upload] Starting OCR recognition...')
    const ocrResult = await recognizeIrregularVerbs(base64Image)

    // 读取现有的words.json
    const wordsPath = path.join(libraryDir, 'words.json')
    let existingWords: any[] = []
    if (existsSync(wordsPath)) {
      const wordsContent = await readFile(wordsPath, 'utf-8')
      existingWords = JSON.parse(wordsContent)
    }

    // 添加新识别的不规则动词
    const timestampStr = new Date().toISOString()
    const newWords = ocrResult.words.map(w => ({
      id: `word-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      word: w.word,
      pronunciation: w.pronunciation,
      partOfSpeech: 'v.', // 不规则动词都是动词
      meanings: w.meanings,
      pastForm: w.pastForm,
      pastParticiple: w.pastParticiple || '',
      presentParticiple: w.presentParticiple || '',
      sourceImage: filename,
      errorCount: 0,
      addedAt: timestampStr,
      isIrregularVerb: true // 标记为不规则动词
    }))

    // 合并单词（去重）
    const wordMap = new Map()
    existingWords.forEach(w => wordMap.set(w.word.toLowerCase(), w))
    newWords.forEach(w => {
      const existing = wordMap.get(w.word.toLowerCase())
      if (existing) {
        // 如果单词已存在，更新为不规则动词版本
        if (!existing.sourceImages) {
          existing.sourceImages = [existing.sourceImage]
        }
        if (!existing.sourceImages.includes(filename)) {
          existing.sourceImages.push(filename)
        }
        existing.sourceImage = filename
        // 更新为不规则动词属性
        if (w.pastForm) existing.pastForm = w.pastForm
        if (w.pastParticiple) existing.pastParticiple = w.pastParticiple
        if (w.presentParticiple) existing.presentParticiple = w.presentParticiple
        existing.isIrregularVerb = true
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

    console.log('[Irregular Verbs Upload] Recognition complete:', newWords.length, 'irregular verbs')

    return NextResponse.json({
      success: true,
      image: filename,
      words: newWords,
      totalWords: updatedWords.length
    })
  } catch (error) {
    console.error('[Irregular Verbs API] Failed to upload image:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload irregular verbs image'
    }, { status: 500 })
  }
}
