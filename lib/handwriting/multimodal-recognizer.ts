/**
 * 多模态大模型手写识别
 * 支持通义千问 VL、GPT-4V 等多模态模型
 */

import { callLLM } from '@/lib/ai/llm'

export interface MultimodalRecognizeResult {
  text: string
  confidence: number
  isCorrect?: boolean
  feedback?: string
  suggestions?: string[]
}

export interface MultimodalJudgeResult {
  isCorrect: boolean
  recognizedText: string
  confidence: number
  similarity: number
  feedback: string
  suggestions: string[]
}

/**
 * 使用多模态大模型识别手写内容
 */
export async function recognizeWithMultimodal(
  imageBase64: string,
  options: {
    expectedAnswer?: string // 期望答案，用于判题
    model?: string // 模型名称
  } = {}
): Promise<MultimodalRecognizeResult> {
  const { expectedAnswer, model = 'qwen-vl-max' } = options

  // 构建提示词
  let prompt = '请仔细观察图片中的手写文字，识别出具体内容。只返回识别的文字，不要有其他内容。'

  if (expectedAnswer) {
    prompt = `请仔细观察图片中的手写文字。

期望答案是："${expectedAnswer}"

请判断手写内容是否正确，并提供详细的反馈。

请严格按以下 JSON 格式返回（不要有其他文字）：
{
  "text": "识别出的文字",
  "isCorrect": true 或 false,
  "confidence": 0.0 到 1.0 之间的数字,
  "similarity": 0.0 到 1.0 之间的相似度,
  "feedback": "给学生的反馈意见，要具体、鼓励性强",
  "suggestions": ["具体的改进建议1", "改进建议2"]
}

反馈要求：
- 如果正确：表扬具体的优点（如：书写工整、结构标准等）
- 如果错误：指出问题所在，鼓励学生继续努力
- 保持积极、鼓励的语气`
  }

  try {
    // 调用多模态模型
    const response = await callLLM(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      { model }
    )

    // 解析响应
    let content = response.choices[0].message.content || ''

    // 尝试提取 JSON
    let jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      // 如果没有期望答案，直接返回文本
      if (!expectedAnswer) {
        return {
          text: content.trim(),
          confidence: 0.8
        }
      }

      throw new Error('模型返回格式错误')
    }

    const result = JSON.parse(jsonMatch[0])

    return {
      text: result.text || '',
      confidence: result.confidence || 0.8,
      isCorrect: result.isCorrect,
      feedback: result.feedback,
      suggestions: result.suggestions || []
    }
  } catch (error: any) {
    console.error('[多模态识别] 失败:', error)
    throw error
  }
}

/**
 * 智能判题（带详细反馈）
 */
export async function judgeWithMultimodal(
  imageBase64: string,
  correctAnswer: string
): Promise<MultimodalJudgeResult> {
  const result = await recognizeWithMultimodal(imageBase64, {
    expectedAnswer: correctAnswer
  })

  return {
    isCorrect: result.isCorrect ?? result.text === correctAnswer,
    recognizedText: result.text,
    confidence: result.confidence,
    similarity: result.confidence, // 多模态模型直接给出相似度
    feedback: result.feedback || '',
    suggestions: result.suggestions || []
  }
}

/**
 * 批量判题
 */
export async function judgeWithMultimodalBatch(
  items: Array<{
    imageBase64: string
    correctAnswer: string
  }>
): Promise<MultimodalJudgeResult[]> {
  const results = await Promise.all(
    items.map(item => judgeWithMultimodal(item.imageBase64, item.correctAnswer))
  )

  return results
}
