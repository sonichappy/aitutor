/**
 * Markdown 知识库解析器
 * 支持语文字词表和英语单词表
 * 支持列表格式和表格格式
 */

export interface ParsedChineseWord {
  id: string
  word: string
  pinyin: string
  meanings: string[]
  category?: string
  sourceUnit?: string
}

export interface ParsedKnowledgeLibrary {
  name: string
  description?: string
  words: ParsedChineseWord[]
}

/**
 * 解析语文字词表 Markdown（支持列表和表格格式）
 */
export function parseChineseWordsMarkdown(markdown: string): ParsedKnowledgeLibrary {
  const lines = markdown.split('\n')
  const words: ParsedChineseWord[] = []
  let libraryName = '未命名知识库'
  let currentCategory: string | undefined
  let currentUnit: string | undefined

  // 检测是否为表格格式
  const hasTable = markdown.includes('| 字词 |')

  if (hasTable) {
    // 表格格式解析
    return parseTableFormat(markdown)
  }

  // 列表格式解析（原有逻辑）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 跳过空行和分隔线
    if (!line || line.match(/^[-=]{3,}$/)) continue

    // 解析标题（知识库名称）
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      libraryName = line.replace('# ', '').trim()
      continue
    }

    // 解析单元
    if (line.startsWith('## ')) {
      currentUnit = line.replace('## ', '').trim()
      continue
    }

    // 解析分类
    if (line.startsWith('### ')) {
      currentCategory = line.replace('### ', '').trim()
      continue
    }

    // 解析词语条目
    if (line.startsWith('- ')) {
      const wordData = parseWordLine(line, currentCategory, currentUnit)
      if (wordData) {
        words.push(wordData)
      }
    }
  }

  return {
    name: libraryName,
    words
  }
}

/**
 * 解析表格格式的字词表
 */
function parseTableFormat(markdown: string): ParsedKnowledgeLibrary {
  const lines = markdown.split('\n')
  const words: ParsedChineseWord[] = []
  let libraryName = '未命名知识库'

  // 提取标题（第一行）
  for (const line of lines) {
    if (line.startsWith('# ')) {
      libraryName = line.replace(/^#\s*/, '').trim()
      break
    }
  }

  // 解析表格行
  let inTable = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 检测表格开始
    if (line.includes('| 字词 |') || line.includes('| 词语 |')) {
      inTable = true
      continue
    }

    // 跳过表格分隔行
    if (inTable && line.match(/^\|[\s\-:]+\|[\s\-:]+\|/)) {
      continue
    }

    // 表格结束
    if (inTable && !line.startsWith('|')) {
      break
    }

    // 解析表格行
    if (inTable && line.startsWith('|')) {
      const wordData = parseTableRow(line)
      if (wordData) {
        words.push(wordData)
      }
    }
  }

  return {
    name: libraryName,
    words
  }
}

/**
 * 解析表格行
 * 格式：| 字词 | 拼音 | 释义 |
 */
function parseTableRow(line: string): ParsedChineseWord | null {
  try {
    // 移除首尾的 |
    const content = line.replace(/^\||\|$/g, '').trim()

    // 分割列
    const columns = content.split('|').map(col => col.trim())

    if (columns.length < 3) {
      return null
    }

    const word = columns[0]?.trim()
    const pinyin = columns[1]?.trim()
    const meaningsStr = columns[2]?.trim()

    if (!word || word === '字词' || word === '词语' || word === '') {
      return null // 跳过表头或空行
    }

    if (!pinyin || pinyin === '拼音') {
      return null // 跳过表头
    }

    if (!meaningsStr) {
      return null // 没有释义
    }

    // 解析多个释义（用分号或逗号分隔）
    const meanings = meaningsStr
      .split(/[；;,，]/)
      .map(m => m.trim())
      .filter(m => m)

    if (meanings.length === 0) {
      return null
    }

    return {
      id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word,
      pinyin,
      meanings
    }
  } catch (error) {
    console.warn('解析表格行失败:', line, error)
    return null
  }
}

/**
 * 解析单行词语数据（列表格式）
 */
function parseWordLine(
  line: string,
  category?: string,
  sourceUnit?: string
): ParsedChineseWord | null {
  // 移除列表标记
  const content = line.replace(/^-\s*/, '').trim()

  // 正则匹配：词语（拼音）：释义
  const regex = /^(.+?)（(.+?)）[:：](.+)$/
  const match = content.match(regex)

  if (!match) {
    console.warn(`无法解析行: ${line}`)
    return null
  }

  const [, word, pinyin, meaningsStr] = match

  // 解析多个释义（用分号分隔）
  const meanings = meaningsStr
    .split(/[；;]/)
    .map(m => m.trim())
    .filter(m => m)

  if (meanings.length === 0) {
    console.warn(`词语 ${word} 没有释义`)
    return null
  }

  return {
    id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    word: word.trim(),
    pinyin: pinyin.trim(),
    meanings,
    category,
    sourceUnit
  }
}

/**
 * 从文件系统导入字词表
 */
export async function importChineseWordsFromDirectory(directory: string) {
  const fs = await import('fs/promises')
  const path = await import('path')

  const results = []

  try {
    // 读取目录下的所有文件
    const files = await fs.readdir(directory)

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = path.join(directory, file)
      const content = await fs.readFile(filePath, 'utf-8')

      // 解析 Markdown
      const parsed = parseChineseWordsMarkdown(content)

      results.push({
        fileName: file,
        ...parsed
      })
    }

    return results
  } catch (error) {
    console.error('[导入字词表] 错误:', error)
    throw error
  }
}
