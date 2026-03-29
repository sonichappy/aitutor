/**
 * 字符串相似度计算工具
 * 用于手写识别结果与标准答案的比对
 */

/**
 * 计算 Levenshtein 距离（编辑距离）
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 删除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost // 替换
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * 计算字符串相似度（0-1）
 * 使用 Levenshtein 距离
 */
export function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  // 归一化处理
  const s1 = str1.trim().toLowerCase()
  const s2 = str2.trim().toLowerCase()

  if (s1 === s2) return 1.0

  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1.0

  const distance = levenshteinDistance(s1, s2)
  const similarity = 1 - distance / maxLen

  return similarity
}

/**
 * 计算余弦相似度（基于字符频率）
 */
export function calculateCosineSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase()
  const s2 = str2.trim().toLowerCase()

  if (s1 === s2) return 1.0

  // 字符频率统计
  const getCharFrequency = (str: string): Map<string, number> => {
    const freq = new Map<string, number>()
    for (const char of str) {
      freq.set(char, (freq.get(char) || 0) + 1)
    }
    return freq
  }

  const freq1 = getCharFrequency(s1)
  const freq2 = getCharFrequency(s2)

  // 计算点积
  let dotProduct = 0
  const allChars = new Set([...freq1.keys(), ...freq2.keys()])

  for (const char of allChars) {
    dotProduct += (freq1.get(char) || 0) * (freq2.get(char) || 0)
  }

  // 计算模
  const magnitude1 = Math.sqrt([...freq1.values()].reduce((sum, val) => sum + val * val, 0))
  const magnitude2 = Math.sqrt([...freq2.values()].reduce((sum, val) => sum + val * val, 0))

  if (magnitude1 === 0 || magnitude2 === 0) return 0

  return dotProduct / (magnitude1 * magnitude2)
}

/**
 * 计算 Jaccard 相似度
 */
export function calculateJaccardSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase()
  const s2 = str2.trim().toLowerCase()

  if (s1 === s2) return 1.0

  const set1 = new Set(s1.split(''))
  const set2 = new Set(s2.split(''))

  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  if (union.size === 0) return 1.0

  return intersection.size / union.size
}

/**
 * 综合相似度计算
 * 结合多种算法，返回最合理的相似度
 */
export function calculateCombinedSimilarity(str1: string, str2: string): number {
  const levenshteinSim = calculateLevenshteinSimilarity(str1, str2)
  const jaccardSim = calculateJaccardSimilarity(str1, str2)

  // 对于短文本（如单个词语），Jaccard 相似度更准确
  // 对于长文本，Levenshtein 相似度更准确
  const avgLength = (str1.length + str2.length) / 2

  if (avgLength <= 5) {
    // 短文本，优先使用 Jaccard
    return jaccardSim * 0.7 + levenshteinSim * 0.3
  } else {
    // 长文本，优先使用 Levenshtein
    return levenshteinSim * 0.7 + jaccardSim * 0.3
  }
}
