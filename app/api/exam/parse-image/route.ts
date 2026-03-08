import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { saveExamData, saveExamImage } from "@/lib/storage"
import { cleanParsedQuestions } from "@/lib/image-utils"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function POST(request: NextRequest) {
  try {
    // 检查 AI 提供商是否支持图片
    const provider = process.env.AI_PROVIDER || "deepseek"
    const visionProviders = ["dashscope", "openai", "anthropic", "gemini"]

    console.log(`[Parse Image] Using provider: ${provider}`)

    if (!visionProviders.includes(provider)) {
      return NextResponse.json(
        { error: `当前 ${provider} 不支持图片解析，请在 .env 中将 AI_PROVIDER 改为以下之一: gemini（推荐）、dashscope、openai、anthropic` },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const subject = formData.get("subject") as string
    const examType = formData.get("examType") as string
    const totalScore = parseFloat(formData.get("totalScore") as string)

    if (!file || !subject) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 1. 将图片转换为 base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = `data:${file.type};base64,${buffer.toString("base64")}`

    // 2. 调用 AI 进行 OCR 和解析
    const prompt = `请仔细分析这张试卷图片，完成以下任务：

1. **试卷类型判断**：首先判断这是否是作文试卷
   - 如果是语文作文或英语作文，将 questionType 设为 "essay"
   - 如果包含作文题目/要求，提取出来
   - 如果有学生手写的作文内容，进行完整的文字识别(OCR)

2. **科目识别**：根据试卷内容识别科目（数学、语文、英语、物理、化学、生物、历史、地理、道法、政治等）

3. **作文试卷特殊处理**（如果是作文）：
   - 提取作文题目/提示语（如果有）
   - 完整识别学生手写的作文内容，保留段落结构
   - 识别作文的体裁（记叙文、议论文、说明文、应用文等）
   - 评估字数（大约）

4. **普通试卷处理**（如果不是作文）：
   - 版面分析：识别试卷的整体布局，找出所有题目
   - 逐题定位：为每道题目确定精确的边界框位置
   - 题目提取：提取每道题的文字内容
   - 难度评估：评估试卷整体难度（1-5）

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称",
  "overallDifficulty": 整体难度(1-5),
  "estimatedTime": 预估完成时间(分钟),
  "knowledgePointsSummary": ["主要知识点1", "主要知识点2"],
  "rawText": "OCR识别的完整文本内容（作文要保留完整文字）",
  "isEssay": true/false,  // 是否是作文试卷
  "essayType": "语文作文/英语作文",  // 如果是作文
  "questions": [
    {
      "number": 题号,
      "type": "题型(choice/fill/answer/calculation/essay)",
      "content": "题目内容（作文包含题目要求和学生作文全文）",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "score": 分值,
      "difficulty": 难度(1-5),
      "knowledgePoints": ["知识点1", "知识点2"],
      "bbox": {
        "x": 左上角X百分比(0-100),
        "y": 左上角Y百分比(0-100),
        "width": 宽度百分比(0-100),
        "height": 高度百分比(0-100)
      },
      "essayGenre": "记叙文/议论文/说明文/应用文",  // 仅作文
      "wordCount": 预估字数  // 仅作文
    }
  ]
}

**作文识别重要要求：**
1. 完整识别学生手写的作文内容，包括所有段落
2. 保留作文的原始结构，不要省略任何内容
3. 识别作文中的标点符号和格式
4. 字数要尽量准确估算

**普通试卷重要要求：**
1. **CRITICAL: 必须识别图片中的每一道题目，不要遗漏任何题目**
2. **CRITICAL: 如果不同章节有相同的题号（如"语法一致"第1题和"就近一致"第1题），必须都添加到 questions 数组，它们是不同的题目**
3. **CRITICAL: 绝对不要因为题号相同就覆盖前面的题目，每个题目都要独立添加到数组**
4. 必须为每道题提供 bbox 字段
5. bbox 使用百分比坐标，范围 0-100
6. detectedSubject 必须是具体的科目名称
7. options 数组中只填选项的纯文本内容，不要包含前缀

只返回JSON，不要有其他内容。`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的试卷OCR和解析系统。你的任务是：

**最重要的规则 - 必须遵守**：
- 试卷中不同章节的题目可能有相同的题号（例如："语法一致原则"章节有第1题，"就近一致原则"章节也有第1题）
- 这是完全正常的，两个第1题是不同的题目，必须都添加到 questions 数组中
- 绝对不能因为题号相同就跳过、覆盖或合并任何题目
- 每个题目都应该出现在 JSON 的 questions 数组中，按从左到右、从上到下的顺序

**作文识别重点**：
1. 优先判断是否为作文试卷（语文作文、英语作文）
2. 对于作文，必须进行完整的文字识别(OCR)，保留所有段落和结构
3. 准确识别手写文字，包括标点符号
4. 提取作文题目/要求
5. 识别作文体裁和预估字数

**普通试卷**：
1. 准确识别试卷图片中的所有文字内容
2. 提取并结构化所有题目信息
3. 按照指定的JSON格式返回结果

你必须只返回有效的JSON格式，不要包含任何其他说明文字。`,
      },
      {
        role: "user",
        content: prompt,
        images: [base64Image],
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.1,
      maxTokens: 8000,  // 增加 token 限制以支持更大的试卷
    })

    console.log(`[Parse Image] LLM response length: ${response.content?.length || 0}`)

    if (!response.content) {
      throw new Error("AI 返回了空响应，请检查 API 配置和图片格式")
    }

    // 解析 AI 返回的 JSON
    let jsonStr = response.content.trim()

    console.log(`[Parse Image] Raw response length: ${jsonStr.length}`)
    console.log(`[Parse Image] Raw response (first 1000 chars):`, jsonStr.substring(0, 1000))

    // 清理可能的 markdown 代码块标记
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```json\n/, "")
        .replace(/^```\n/, "")
        .replace(/\n```$/, "")
        .replace(/```$/, "")
    }

    // 尝试修复常见的 JSON 格式问题（在解析前应用）
    function fixJsonIssues(jsonStr: string): string {
      // 简单的方法：只处理明显的截断问题
      // 不尝试修复字符串内的换行符，因为这可能会导致更多问题

      // 检查是否被截断
      let openBraces = 0
      let openBrackets = 0
      let lastValidPos = jsonStr.length

      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i]
        if (char === '{') {
          openBraces++
        } else if (char === '}') {
          openBraces--
        } else if (char === '[') {
          openBrackets++
        } else if (char === ']') {
          openBrackets--
        }
      }

      // 如果 JSON 被截断，尝试找到最后一个完整的对象或数组
      if (openBraces > 0 || openBrackets > 0) {
        console.log(`[Parse Image] Detected truncated JSON: braces=${openBraces}, brackets=${openBrackets}`)

        // 从后向前找最后一个闭合的括号
        for (let i = jsonStr.length - 1; i >= 0; i--) {
          const char = jsonStr[i]
          if (char === '}' || char === ']') {
            lastValidPos = i + 1
            break
          }
        }

        // 如果找到了有效的结束位置，截断到那里
        if (lastValidPos < jsonStr.length) {
          console.log(`[Parse Image] Truncating JSON to position ${lastValidPos}`)
          jsonStr = jsonStr.substring(0, lastValidPos)
        }

        // 闭合未完成的括号
        while (openBrackets > 0) { jsonStr += ']'; openBrackets-- }
        while (openBraces > 0) { jsonStr += '}'; openBraces-- }
      }

      // 移除尾随逗号
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

      // 修复缺失的引号（在属性名周围）
      jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')

      return jsonStr
    }

    // 先尝试修复 JSON（预防性修复）
    let fixedJsonStr = fixJsonIssues(jsonStr)
    console.log('[Parse Image] Applied JSON fixes proactively')
    console.log('[Parse Image] Fixed JSON length:', fixedJsonStr.length, 'original:', jsonStr.length)

    let parsed
    let parseError: Error | null = null

    // 尝试解析修复后的 JSON
    try {
      parsed = JSON.parse(fixedJsonStr)
      console.log('[Parse Image] Total questions parsed:', parsed.questions?.length || 0)

      // 检查是否有重复题号
      if (parsed.questions && parsed.questions.length > 0) {
        const numbers = parsed.questions.map((q: any) => q.number)
        const duplicates = numbers.filter((n: number, i: number) => numbers.indexOf(n) !== i)
        if (duplicates.length > 0) {
          console.log('[Parse Image] WARNING: Found duplicate question numbers:', [...new Set(duplicates)])
        }

        console.log('[Parse Image] Question list:')
        parsed.questions.forEach((q: any, i: number) => {
          console.log(`  [${i}] Number: ${q.number}, Type: ${q.type}, Content: ${q.content?.substring(0, 40)}...`)
        })
      }
    } catch (e: any) {
      console.error("[Parse Image] JSON parse error even after fixes:", e.message)
      console.error("[Parse Image] Fixed JSON (first 500 chars):", fixedJsonStr.substring(0, 500))
      console.error("[Parse Image] Fixed JSON (around position 2100):", fixedJsonStr.substring(2080, 2130))
      parseError = e

      // 最后尝试：提取 JSON 对象
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const fixedMatch = fixJsonIssues(match[0])
          parsed = JSON.parse(fixedMatch)
          console.log(`[Parse Image] Extracted and fixed JSON with regex`)
        } catch (e3: any) {
          console.error('[Parse Image] All parse attempts failed')
          throw new Error(`AI 返回格式错误，无法解析为 JSON。错误: ${e.message}`)
        }
      } else {
        throw new Error(`AI 返回格式错误，无法解析为 JSON。原始内容: ${jsonStr.substring(0, 200)}...`)
      }
    }

    // 清理解析结果中的重复标识符
    const cleanedQuestions = cleanParsedQuestions(parsed.questions || [])
    console.log('[Parse Image] Cleaned questions count:', cleanedQuestions.length, '(original:', parsed.questions?.length || 0, ')')

    // 验证清理后的题目数量是否一致
    if (cleanedQuestions.length !== (parsed.questions?.length || 0)) {
      console.error('[Parse Image] WARNING: Question count changed after cleaning!')
    }

    // 计算整体平均难度
    const avgDifficulty = cleanedQuestions.length > 0
      ? cleanedQuestions.reduce((sum: number, q: any) => sum + (q.difficulty || 3), 0) / cleanedQuestions.length
      : 3

    // 计算题目分类统计
    const questionTypeStats: Record<string, number> = {}
    cleanedQuestions.forEach((q: any) => {
      const type = q.type || 'unknown'
      questionTypeStats[type] = (questionTypeStats[type] || 0) + 1
    })

    // 题目类型中文映射
    const typeLabelMap: Record<string, string> = {
      'choice': '选择题',
      'fill': '填空题',
      'answer': '解答题',
      'calculation': '计算题',
      'essay': '作文/论述题',
      'reading': '阅读理解',
      'unknown': '其他',
    }

    // 生成试卷 ID
    const examId = `exam-${Date.now()}`

    // 保存图片到文件系统
    await saveExamImage(examId, base64Image)

    // 获取中国时区时间
    const chinaTime = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-')

    // 保存试卷数据到文件
    const examData = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject: parsed.detectedSubject || subject,  // 优先使用AI识别的科目
      examType: examType,  // 保存配置文件中的类型 ID
      totalScore,
      rawText: parsed.rawText || "",
      questions: cleanedQuestions,
      createdAt: chinaTime,  // 使用中国时区时间
      metadata: {
        detectedSubject: parsed.detectedSubject,
        overallDifficulty: parsed.overallDifficulty || Math.round(avgDifficulty),
        estimatedTime: parsed.estimatedTime || cleanedQuestions.length * 5,  // 默认每题5分钟
        knowledgePointsSummary: parsed.knowledgePointsSummary || [],
        questionTypeStats,  // 题目分类统计
        // 作文相关元数据
        isEssay: parsed.isEssay || false,
        essayType: parsed.essayType || null,  // "语文作文" 或 "英语作文"
      },
    }
    await saveExamData(examId, examData)

    // 返回给前端的数据（不包含大图片）
    const examDataForClient = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject,
      examType,
      totalScore,
      imageUrl: `/api/exam/${examId}/image`,  // 使用 API 获取图片
      rawText: parsed.rawText || "",
      questions: parsed.questions || [],
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${examType}${subject}试卷`,
      questionCount: parsed.questions?.length || 0,
      questions: parsed.questions || [],
      rawText: parsed.rawText || "",
      // 返回精简数据给前端存储
      examData: examDataForClient,
    })
  } catch (error: any) {
    console.error("[Parse Image] Error:", error)

    // 提供更详细的错误信息
    let errorMessage = "图片解析失败"
    let errorDetails = ""

    if (error.message?.includes("API_KEY") || error.message?.includes("not set")) {
      const provider = process.env.AI_PROVIDER || "unknown"
      errorMessage = `未配置 AI API 密钥，请检查 .env 文件中的 ${provider.toUpperCase()}_API_KEY`
      errorDetails = `Provider: ${provider}`
    } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
      errorMessage = "网络连接失败，请检查网络或 API 地址"
    } else if (error.message?.includes("safety") || error.message?.includes("blocked")) {
      errorMessage = "图片内容被安全过滤器拦截，请尝试其他图片"
    } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
      // JSON 解析错误，截断详细信息避免响应过长
      errorMessage = "AI 返回格式错误，无法解析为 JSON"
      if (error.message) {
        const shortError = error.message.substring(0, 200)
        errorDetails = shortError + (error.message.length > 200 ? "..." : "")
      }
    } else if (error.message) {
      errorMessage = `解析失败`
      errorDetails = error.message.substring(0, 300)
    }

    console.error("[Parse Image] Final error:", errorMessage, errorDetails?.substring(0, 100))

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        provider: process.env.AI_PROVIDER || "unknown"
      },
      { status: 500 }
    )
  }
}
