/**
 * 智能修复AI返回的格式错误的JSON
 * 处理常见的OCR识别和AI生成错误
 */

export function fixMalformedJSON(jsonStr: string): string {
  let fixed = jsonStr

  console.log('[JSON Fixer] Original JSON preview:', fixed.substring(0, 300))
  console.log('[JSON Fixer] Original JSON end:', fixed.substring(Math.max(0, fixed.length - 200)))

  // 1. 移除BOM
  fixed = fixed.replace(/^\uFEFF/, '')

  // 2. 修复截断的对象（处理类似 "word": 这样的不完整行）
  fixed = fixTruncatedLines(fixed)

  // 3. 使用逐行修复方法（最可靠）- 这会处理大部分缺失逗号的情况
  fixed = fixMissingCommasInJSON(fixed)

  // 4. 修复尾随逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')

  // 5. 修复未闭合的字符串
  fixed = fixUnclosedStrings(fixed)

  // 6. 修复截断的JSON
  fixed = fixTruncatedJSON(fixed)

  console.log('[JSON Fixer] Fixed JSON preview:', fixed.substring(0, 300))
  console.log('[JSON Fixer] Fixed JSON end:', fixed.substring(Math.max(0, fixed.length - 200)))
  console.log('[JSON Fixer] Applied fixes')

  return fixed
}

/**
 * 修复截断的行（处理不完整的对象定义）
 */
function fixTruncatedLines(jsonStr: string): string {
  // 找到最后一个完整的对象，删除之后的所有不完整内容
  const lines = jsonStr.split('\n')
  const result: string[] = []
  let skipLines = false
  let currentObjectBraces = 0
  let foundIncompleteSinceLastBrace = false

  // 从后向前扫描，找到最后一个完整的对象
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const trimmed = line.trim()

    // 如果已经决定跳过，检查是否遇到新的对象开始
    if (skipLines) {
      // 如果遇到一个新对象的开始（前面是}或]）
      if (trimmed === '{') {
        // 检查前一行是否是 } 或 ]
        if (i > 0) {
          const prevLine = lines[i - 1].trim()
          if (prevLine === '}' || prevLine === ']' || prevLine.endsWith('}') || prevLine.endsWith(']')) {
            // 这是一个新对象的开始，停止跳过
            skipLines = false
            currentObjectBraces = 0
            foundIncompleteSinceLastBrace = false
          }
        }
      }
      continue
    }

    // 跟踪当前对象的括号
    if (trimmed.includes('{')) currentObjectBraces++
    if (trimmed.includes('}')) currentObjectBraces--

    // 检查这一行是否表示截断
    // 情况1: 只有属性名没有冒号和值 (如 "word": 或 "meanings":)
    if (/^"\w+"\s*:\s*$/.test(trimmed)) {
      console.log('[JSON Fixer] Found truncated property at line', i + 1, ':', trimmed)
      skipLines = true
      foundIncompleteSinceLastBrace = true
      continue
    }

    // 情况2: 属性名后面直接是 ] 或 } (如 "meanings"]})
    if (/^"\w+"\s*\]/.test(trimmed)) {
      console.log('[JSON Fixer] Found property with array closer but no value at line', i + 1, ':', trimmed)
      skipLines = true
      foundIncompleteSinceLastBrace = true
      continue
    }

    // 情况3: 在一个对象内部发现不完整的属性，且我们已经过了对象的开始
    if (currentObjectBraces > 0 && foundIncompleteSinceLastBrace) {
      // 如果遇到对象闭合，标记整个对象为不完整
      if (trimmed === '}') {
        console.log('[JSON Fixer] Found incomplete object closing at line', i + 1)
        skipLines = true
        continue
      }
    }

    result.unshift(line)
  }

  const fixed = result.join('\n')
  if (fixed.length !== jsonStr.length) {
    console.log('[JSON Fixer] Removed truncated lines, original length:', jsonStr.length, 'fixed length:', fixed.length)
  }

  return fixed
}

/**
 * 修复未闭合的字符串
 */
function fixUnclosedStrings(jsonStr: string): string {
  // 简单但有效的策略：在整个字符串中查找未闭合的引号
  const lines = jsonStr.split('\n')
  const fixedLines: string[] = []

  for (let line of lines) {
    let fixedLine = line

    // 查找这一行中的所有引号
    const quoteMatches = line.match(/"/g)
    const quoteCount = quoteMatches ? quoteMatches.length : 0

    // 如果引号数量是奇数，说明有一个未闭合的字符串
    if (quoteCount % 2 !== 0) {
      // 在行尾添加闭合引号
      fixedLine = line + '"'
      console.log('[JSON Fixer] Closed unclosed string at line ending')
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join('\n')
}

/**
 * 修复字符串中未转义的引号
 */
function fixUnescapedQuotes(jsonStr: string): string {
  // 这个函数尝试智能地修复未转义的引号
  // 策略：在每个字符串值中，确保内部引号都被转义

  const lines = jsonStr.split('\n')
  const fixedLines: string[] = []

  for (let line of lines) {
    // 检查是否是包含字符串值的行
    if (line.includes(': "') && line.includes('",')) {
      // 提取属性名和值
      const match = line.match(/^(\s*)"(\w+)":\s*"(.*)"(.*)$/)
      if (match) {
        const [, indent, key, value, suffix] = match
        // 转义值内部的引号
        const escapedValue = value.replace(/"/g, '\\"')
        fixedLines.push(`${indent}"${key}": "${escapedValue}"${suffix}`)
        continue
      }
    }
    fixedLines.push(line)
  }

  return fixedLines.join('\n')
}

/**
 * 修复截断的JSON（添加缺失的闭合括号）
 */
function fixTruncatedJSON(jsonStr: string): string {
  let fixed = jsonStr

  // 计算需要添加的括号
  let openBraces = 0
  let closeBraces = 0
  let openBrackets = 0
  let closeBrackets = 0

  for (const char of fixed) {
    if (char === '{') openBraces++
    if (char === '}') closeBraces++
    if (char === '[') openBrackets++
    if (char === ']') closeBrackets++
  }

  // 添加缺失的闭合括号
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']'
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}'
  }

  return fixed
}

/**
 * 修复多行JSON数组中对象间缺失的逗号
 * 专门处理 "words" 数组中每个对象之间缺失逗号的问题
 */
function fixMissingCommasInJSON(jsonStr: string): string {
  const lines = jsonStr.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 检查这一行是否以 } 或 ] 结尾（不包括逗号）
    const endsWithBrace = trimmed.endsWith('}') && !trimmed.endsWith(',}')
    const endsWithBracket = trimmed.endsWith(']') && !trimmed.endsWith(',]')

    if ((endsWithBrace || endsWithBracket) && i < lines.length - 1) {
      const nextLine = lines[i + 1].trim()

      // 检查下一行是否以 { 或 [ 开头（表示新的对象或数组元素）
      // 注意：不能只以 " 开头，因为那可能是同一个对象的下一个属性
      if (nextLine.startsWith('{') || nextLine.startsWith('[')) {
        // 需要添加逗号
        const braceIndex = line.lastIndexOf('}')
        const bracketIndex = line.lastIndexOf(']')
        const insertIndex = Math.max(braceIndex, bracketIndex)

        if (insertIndex !== -1) {
          const newLine = line.substring(0, insertIndex) + ',' + line.substring(insertIndex)
          result.push(newLine)
          console.log('[JSON Fixer] Added comma at line', i + 1, 'after', line[insertIndex])
          continue
        }
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

/**
 * 尝试从混乱的文本中提取有效的JSON
 */
export function extractJSON(content: string): string | null {
  // 首先去除可能的markdown代码块标记
  let cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')

  console.log('[JSON Fixer] Cleaned content preview:', cleaned.substring(0, 200))

  // 方法1: 尝试提取markdown代码块（使用贪婪匹配以获取完整内容）
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    const extracted = codeBlockMatch[1].trim()
    console.log('[JSON Fixer] Found markdown code block')
    return extracted
  }

  // 方法2: 尝试提取words数组
  const wordsArrayMatch = cleaned.match(/"words"\s*:\s*(\[[\s\S]*\])(?=\s*[}\]])/);
  if (wordsArrayMatch) {
    console.log('[JSON Fixer] Found words array')
    return `{${wordsArrayMatch[0]}}`
  }

  // 方法3: 尝试提取完整的JSON对象（使用计数器匹配嵌套结构）
  let braceCount = 0
  let startIndex = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (startIndex === -1) {
        startIndex = i
      }
      braceCount++
    } else if (cleaned[i] === '}') {
      braceCount--
      if (braceCount === 0 && startIndex !== -1) {
        console.log('[JSON Fixer] Found complete JSON object using brace counter')
        return cleaned.substring(startIndex, i + 1)
      }
    }
  }

  console.log('[JSON Fixer] No JSON found, returning original cleaned content')
  return cleaned
}

/**
 * 智能解析JSON，支持多种错误恢复
 */
export function smartParseJSON(content: string): any {
  // 首先尝试提取JSON
  let jsonStr = extractJSON(content)
  if (!jsonStr) {
    jsonStr = content
  }

  console.log('[JSON Fixer] Extracted JSON length:', jsonStr.length)
  console.log('[JSON Fixer] Extracted JSON preview:', jsonStr.substring(0, 500))

  // 尝试修复JSON
  const fixed = fixMalformedJSON(jsonStr)

  // 尝试解析
  try {
    const parsed = JSON.parse(fixed)
    console.log('[JSON Fixer] Successfully parsed, words count:', parsed.words?.length || 0)
    return parsed
  } catch (error: any) {
    // 如果还是失败，提供详细的错误信息
    const posMatch = error.message.match(/position (\d+)/)
    if (posMatch) {
      const pos = parseInt(posMatch[1])
      const context = fixed.substring(Math.max(0, pos - 200), Math.min(fixed.length, pos + 200))
      throw new Error(
        `JSON解析失败: ${error.message}\n` +
        `错误位置上下文:\n${context}\n\n` +
        `原始JSON长度: ${fixed.length}`
      )
    }
    throw error
  }
}
