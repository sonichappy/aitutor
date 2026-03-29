/**
 * 导入语文字词表到知识库
 */

import { promises as fs } from 'fs'
import path from 'path'
import { parseChineseWordsMarkdown } from './parser'

const EXERCISES_DIR = path.join(process.cwd(), 'data', 'exercises', 'chinese')
const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')

/**
 * 导入单个字词表文件
 */
export async function importWordListFile(filePath: string): Promise<{
  libraryId: string
  name: string
  wordCount: number
}> {
  console.log(`[导入] 正在读取文件: ${filePath}`)

  // 读取文件内容
  const content = await fs.readFile(filePath, 'utf-8')

  // 解析 Markdown
  const parsed = parseChineseWordsMarkdown(content)

  console.log(`[导入] 解析成功: ${parsed.name} (${parsed.words.length} 个字词)`)

  // 生成知识库 ID
  const libraryId = `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // 创建知识库目录
  const libraryDir = path.join(KNOWLEDGE_BASE_DIR, libraryId)
  await fs.mkdir(libraryDir, { recursive: true })

  // 提取文件名作为描述
  const fileName = path.basename(filePath, '.md')

  // 保存元数据
  const metadata = {
    id: libraryId,
    subject: 'chinese',
    name: parsed.name,
    description: `从 ${fileName} 导入`,
    wordCount: parsed.words.length,
    sourceFile: filePath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await fs.writeFile(
    path.join(libraryDir, 'meta.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  )

  // 保存字词数据
  const wordsData = {
    libraryId,
    words: parsed.words
  }

  await fs.writeFile(
    path.join(libraryDir, 'words.json'),
    JSON.stringify(wordsData, null, 2),
    'utf-8'
  )

  // 更新索引文件
  await updateLibraryIndex(metadata)

  console.log(`[导入] 保存成功: ${libraryId}`)

  return {
    libraryId,
    name: parsed.name,
    wordCount: parsed.words.length
  }
}

/**
 * 导入目录下所有字词表
 */
export async function importAllWordLists(): Promise<Array<{
  libraryId: string
  name: string
  wordCount: number
  sourceFile: string
}>> {
  console.log('[导入] 开始导入语文字词表...')
  console.log(`[导入] 源目录: ${EXERCISES_DIR}`)

  const results = []

  try {
    // 确保目标目录存在
    await fs.mkdir(KNOWLEDGE_BASE_DIR, { recursive: true })

    // 读取源目录
    const entries = await fs.readdir(EXERCISES_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue // 跳过隐藏文件

      const entryPath = path.join(EXERCISES_DIR, entry.name)

      if (entry.isDirectory()) {
        // 处理子目录
        const files = await fs.readdir(entryPath)

        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(entryPath, file)
            const result = await importWordListFile(filePath)
            results.push({
              ...result,
              sourceFile: filePath
            })
          }
        }
      } else if (entry.name.endsWith('.md')) {
        // 处理根目录下的 .md 文件
        const result = await importWordListFile(entryPath)
        results.push({
          ...result,
          sourceFile: entryPath
        })
      }
    }

    console.log(`[导入] 完成！共导入 ${results.length} 个字词表`)
    console.log(`[导入] 总字词数: ${results.reduce((sum, r) => sum + r.wordCount, 0)}`)

    return results
  } catch (error) {
    console.error('[导入] 错误:', error)
    throw error
  }
}

/**
 * 更新知识库索引
 */
async function updateLibraryIndex(metadata: any) {
  const indexFile = path.join(KNOWLEDGE_BASE_DIR, 'libraries.json')

  let libraries = []

  try {
    const indexContent = await fs.readFile(indexFile, 'utf-8')
    const indexData = JSON.parse(indexContent)
    libraries = indexData.libraries || []
  } catch (error) {
    libraries = []
  }

  libraries.push(metadata)

  await fs.writeFile(
    indexFile,
    JSON.stringify({ libraries }, null, 2),
    'utf-8'
  )
}

// 如果直接运行此脚本，执行导入
if (require.main === module) {
  importAllWordLists()
    .then((results) => {
      console.log('\n导入结果:')
      results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.name}`)
        console.log(`   字词数: ${r.wordCount}`)
        console.log(`   知识库 ID: ${r.libraryId}`)
        console.log(`   来源: ${r.sourceFile}`)
        console.log()
      })
    })
    .catch((error) => {
      console.error('导入失败:', error)
      process.exit(1)
    })
}
