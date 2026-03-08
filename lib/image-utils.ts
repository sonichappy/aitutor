/**
 * 图像处理工具函数
 */

/**
 * 清理选项文本中重复的选项标识符
 * 例如: "A. 选项A内容" -> "选项A内容"
 *      "A、A 选项内容" -> "选项内容"
 *      "A. A. ∠1与∠2互为内错角" -> "∠1与∠2互为内错角"
 */
export function cleanOptionText(option: string): string {
  if (!option) return option

  let cleaned = option.trim()

  // 使用循环反复移除开头的选项标识符，直到没有为止
  // 可以处理 "A. A. A. 内容" 这种多重重复的情况
  let maxIterations = 5 // 防止无限循环
  let iterations = 0
  let previousLength: number

  do {
    previousLength = cleaned.length

    // 移除开头的选项标识符（支持多种格式）
    cleaned = cleaned
      .replace(/^[A-D][.、]\s*/, '')  // 移除 "A." "A、" 等
      .replace(/^[A-D]\s+/, '')         // 移除 "A " 等
      .replace(/^[A-D]\s*[.、]\s*/, '') // 移除 "A . " "A 、" 等带空格的
      .trim()

    iterations++
  } while (cleaned.length !== previousLength && iterations < maxIterations)

  return cleaned
}

/**
 * 清理题目内容中的重复标识符
 */
export function cleanQuestionContent(content: string): string {
  if (!content) return content

  // 移除题号开头的重复
  return content
    .replace(/^\d+[.、]\s*\d+[.、]/, (match) => {
      // "1.1." -> "1."
      const firstNum = match.match(/^(\d+)/)?.[1]
      return firstNum ? `${firstNum}. ` : match
    })
    .trim()
}

/**
 * 清理所有题目数据
 */
export function cleanParsedQuestions(questions: any[]): any[] {
  if (!questions || !Array.isArray(questions)) return questions

  return questions.map(q => ({
    ...q,
    content: cleanQuestionContent(q.content),
    options: q.options?.map((opt: string) => cleanOptionText(opt)) || [],
  }))
}

/**
 * 对图像进行扫描效果处理
 * - 将背景转为白色
 * - 增强黑色部分的对比度
 * - 类似扫描仪的效果
 */
export function applyScanEffect(imageData: ImageData): ImageData {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // 遍历每个像素
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // 计算亮度 (使用加权平均，符合人眼感知)
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255

    // 二值化阈值（可以根据需要调整）
    // 使用自适应阈值：背景接近白色，文字接近黑色
    let value: number

    if (brightness > 0.85) {
      // 亮背景 -> 纯白
      value = 255
    } else if (brightness < 0.5) {
      // 深色文字 -> 增强黑色
      value = Math.max(0, brightness * 255 - 30)
    } else {
      // 中间色调 -> 增强对比度
      // 使用 S 型曲线增强对比度
      const t = brightness
      value = Math.floor(
        255 * (
          t < 0.5
            ? 2 * t * t // 暗部更暗
            : 1 - 2 * (1 - t) * (1 - t) // 亮部更亮
        )
      )
    }

    // 应用处理后的值
    data[i] = value     // R
    data[i + 1] = value // G
    data[i + 2] = value // B
    // Alpha 通道保持不变
  }

  return imageData
}

/**
 * 对图像进行去噪处理
 * 移除小的噪点，使图像更干净
 */
export function denoise(imageData: ImageData, iterations: number = 1): ImageData {
  let data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  for (let iter = 0; iter < iterations; iter++) {
    const newData = new Uint8ClampedArray(data)

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4

        // 获取周围 3x3 像素
        let sumR = 0, sumG = 0, sumB = 0
        let count = 0

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4
            sumR += data[nIdx]
            sumG += data[nIdx + 1]
            sumB += data[nIdx + 2]
            count++
          }
        }

        newData[idx] = sumR / count
        newData[idx + 1] = sumG / count
        newData[idx + 2] = sumB / count
      }
    }

    data = newData
  }

  return new ImageData(data, width, height)
}

/**
 * 组合处理：扫描效果 + 轻微去噪
 */
export function processImageForScan(imageData: ImageData): ImageData {
  // 先应用扫描效果
  let processed = applyScanEffect(imageData)

  // 然后进行轻微去噪
  processed = denoise(processed, 1)

  return processed
}
