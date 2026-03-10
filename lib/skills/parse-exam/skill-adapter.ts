/**
 * Claude Code Skill 适配器
 *
 * 这个模块将核心解析能力封装为 Claude Code Skill
 * 在本地开发环境中提供交互式体验
 */

import { parseExamImage } from "./core"
import type { ParseExamInput } from "./core"

// ============================================
// Skill 定义
// ============================================

export const skill = {
  id: "parse-exam",
  name: "试卷图片解析",
  description: "使用 AI 识别试卷图片，自动提取题目和答案",
  version: "1.0.0",

  /**
   * Skill 执行函数
   *
   * 在 Claude Code 中可以通过以下方式调用：
   * - /parse-exam --file "path/to/image.jpg" --subject "数学"
   * - 右键菜单选择图片后选择 "解析试卷"
   */
  async execute(args: {
    filePath?: string
    file?: File
    subject?: string
    customPrompt?: string
  }) {
    // 参数处理
    const input: ParseExamInput = {
      image: await loadImage(args.file || args.filePath),
      subject: args.subject,
      customPrompt: args.customPrompt
    }

    // 执行解析
    const result = await parseExamImage(input)

    // 格式化输出
    return formatSkillOutput(result)
  },

  /**
   * Skill 参数定义
   */
  parameters: [
    {
      name: "file",
      description: "试卷图片文件",
      type: "file",
      required: true
    },
    {
      name: "subject",
      description: "学科名称（可选，AI会自动识别）",
      type: "string"
    },
    {
      name: "customPrompt",
      description: "自定义提示词（可选）",
      type: "string"
    }
  ],

  /**
   * 使用说明
   */
  usage: `
# 使用方式

## 方式 1：命令行
/parse-exam --file "./试卷.jpg" --subject "数学"

## 方式 2：右键菜单
1. 在文件管理器中右键点击图片文件
2. 选择 "Claude Code > 解析试卷"
3. 等待解析完成

## 方式 3：拖拽
1. 将图片拖入 Claude Code
2. 输入 "请解析这张试卷"
  `
}

// ============================================
// 辅助函数
// ============================================

/**
 * 加载图片文件
 */
async function loadImage(source: File | string | undefined) {
  if (!source) {
    throw new Error("请提供图片文件")
  }

  // 如果是 File 对象
  if (source instanceof File) {
    const bytes = await source.arrayBuffer()
    const buffer = Buffer.from(bytes)
    return {
      data: `data:${source.type};base64,${buffer.toString("base64")}`,
      mimeType: source.type,
      size: source.size
    }
  }

  // 如果是文件路径
  if (typeof source === "string") {
    const fs = await import('fs/promises')
    const buffer = await fs.readFile(source)
    const ext = source.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp'
    }
    return {
      data: `data:${mimeTypes[ext || 'jpg']};base64,${buffer.toString('base64')}`,
      mimeType: mimeTypes[ext || 'jpg'],
      size: buffer.length
    }
  }

  throw new Error("不支持的图片格式")
}

/**
 * 格式化 Skill 输出
 */
function formatSkillOutput(result: any) {
  if (!result.success) {
    return `❌ 解析失败：${result.error}`
  }

  return `
✅ 试卷解析成功！

📋 基本信息：
- 试卷 ID: ${result.examId}
- 题目数量: ${result.questions?.length || 0} 题
- 解析耗时: ${result.metadata?.parseTime || 0}ms
- AI 模型: ${result.metadata?.provider || "未知"} (${result.metadata?.model || "未知"})

📁 数据已保存到: data/exams/

💡 提示：
- 使用 "查看试卷 ${result.examId}" 可以查看详细信息
- 使用 "答题 ${result.examId}" 可以开始答题
  `
}

// 导出默认函数
export default skill
