/**
 * 手写判题逻辑
 * 结合 OCR 识别结果和相似度算法进行判题
 */

import { recognizeHandwriting } from './ocr-service'
import { calculateCombinedSimilarity } from '@/lib/utils/string-similarity'
import { HandwritingJudgeResult, OCRProvider } from '@/types/handwriting'

export interface JudgeOptions {
  // 相似度阈值（默认 0.8）
  similarityThreshold?: number
  // 置信度阈值（默认 0.7）
  confidenceThreshold?: number
  // 是否启用宽松判题（默认 true）
  lenientMode?: boolean
  // 指定 OCR 服务商
  provider?: OCRProvider
}

/**
 * 判题函数
 */
export async function judgeHandwriting(
  imageBase64: string,
  correctAnswer: string,
  options: JudgeOptions = {}
): Promise<HandwritingJudgeResult> {
  const {
    similarityThreshold = 0.8,
    confidenceThreshold = 0.7,
    lenientMode = true,
    provider
  } = options

  try {
    // 1. 调用 OCR 识别
    const ocrResult = await recognizeHandwriting(imageBase64, provider)

    // 2. 计算相似度
    const similarity = calculateCombinedSimilarity(
      ocrResult.text,
      correctAnswer
    )

    // 3. 判题逻辑
    let isCorrect = false
    let feedback = ''

    // 完全匹配
    if (ocrResult.text.trim() === correctAnswer.trim()) {
      isCorrect = true
      feedback = '完全正确！✨'
    }
    // 高相似度 + 高置信度
    else if (similarity >= similarityThreshold && ocrResult.confidence >= confidenceThreshold) {
      isCorrect = true
      feedback = `识别结果：${ocrResult.text}（相似度${(similarity * 100).toFixed(0)}%，判为正确）✓`
    }
    // 宽松模式：相似度略低但置信度高
    else if (
      lenientMode &&
      similarity >= 0.6 &&
      similarity < similarityThreshold &&
      ocrResult.confidence >= confidenceThreshold
    ) {
      isCorrect = true
      feedback = `识别结果：${ocrResult.text}，与"${correctAnswer}"相似${(similarity * 100).toFixed(0)}%（宽松模式判为正确）`
    }
    // 相似度一般，给出提示
    else if (similarity >= 0.5) {
      isCorrect = false
      feedback = `识别结果：${ocrResult.text}，正确答案：${correctAnswer}（相似度${(similarity * 100).toFixed(0)}%）`
    }
    // 完全错误
    else {
      isCorrect = false
      feedback = `识别结果：${ocrResult.text}，正确答案：${correctAnswer}`
    }

    return {
      success: true,
      isCorrect,
      recognizedText: ocrResult.text,
      confidence: ocrResult.confidence,
      similarity,
      feedback,
      provider: ocrResult.provider
    }
  } catch (error: any) {
    console.error('[手写判题] 失败:', error)

    return {
      success: false,
      isCorrect: false,
      recognizedText: '',
      confidence: 0,
      similarity: 0,
      feedback: `识别失败：${error.message}`,
      provider: provider || 'tencent'
    }
  }
}

/**
 * 批量判题（用于批改）
 */
export async function judgeHandwritingBatch(
  items: Array<{
    imageBase64: string
    correctAnswer: string
  }>,
  options: JudgeOptions = {}
): Promise<HandwritingJudgeResult[]> {
  const results = await Promise.all(
    items.map(item => judgeHandwriting(item.imageBase64, item.correctAnswer, options))
  )

  return results
}
