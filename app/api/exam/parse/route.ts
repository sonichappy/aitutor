import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { cleanParsedQuestions } from "@/lib/image-utils"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function POST(request: NextRequest) {
  try {
    const { content, subject, examType, totalScore } = await request.json()

    if (!content || !subject) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 调用 AI 解析试卷
    const prompt = `请解析以下试卷内容，提取所有题目信息并识别试卷元数据。

试卷类型：${examType}
总分：${totalScore}

试卷内容：
${content}

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称",
  "overallDifficulty": 整体难度(1-5),
  "estimatedTime": 预估完成时间(分钟),
  "knowledgePointsSummary": ["主要知识点1", "主要知识点2"],
  "questions": [
    {
      "number": 题号,
      "type": "题型(choice/fill/answer/calculation)",
      "content": "题目内容",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "score": 分值,
      "difficulty": 难度(1-5),
      "knowledgePoints": ["知识点1", "知识点2"]
    }
  ]
}

注意：
1. detectedSubject 必须识别科目（数学、语文、英语、物理、化学、生物、历史、地理、道法、政治等）
2. 题号要准确识别（包括一、1、(1)等格式）
3. **重要：不同章节的题目可能有相同的题号（如第一章第1题和第二章第1题），这是正常的，必须全部保留在 questions 数组中，不要去重或删除**
4. **按题目在试卷中出现的顺序添加到数组，即使题号重复也要保留**
5. 选择题要提取选项，选项内容不要包含 A. B. C. D. 前缀
6. 填空题用____标识空位
7. 解答题可能有多个小题
8. 合理估算每题分值和难度
9. overallDifficulty 根据题目复杂度综合评估
10. 识别主要知识点

只返回JSON，不要有其他内容。`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的试卷解析系统。你的任务是准确识别试卷中的所有题目信息，并按照指定的JSON格式返回。

重要规则：
- 必须提取试卷中的所有题目，包括题号重复的题目
- 不同章节的题目可能有相同的题号（如第一章第1题和第二章第1题），这是正常的，必须全部保留
- 按题目在试卷中出现的顺序添加到数组，即使题号重复也要保留
- 不要对题号进行去重或合并处理

你必须只返回有效的JSON格式，不要包含任何其他说明文字。`,
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.1, // 低温保证准确性
      maxTokens: 8000,  // 增加 token 限制以支持更大的试卷
    })

    // 解析 AI 返回的 JSON
    let jsonStr = response.content.trim()

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
      // 简化的方法：只处理截断问题，不尝试修复字符串内的换行

      // 检查是否被截断
      let openBraces = 0
      let openBrackets = 0
      let lastValidPos = jsonStr.length

      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i]
        if (char === '{') openBraces++
        else if (char === '}') openBraces--
        else if (char === '[') openBrackets++
        else if (char === ']') openBrackets--
      }

      // 如果 JSON 被截断
      if (openBraces > 0 || openBrackets > 0) {
        // 从后向前找最后一个闭合的括号
        for (let i = jsonStr.length - 1; i >= 0; i--) {
          if (jsonStr[i] === '}' || jsonStr[i] === ']') {
            lastValidPos = i + 1
            break
          }
        }

        // 截断到最后一个有效位置
        if (lastValidPos < jsonStr.length) {
          jsonStr = jsonStr.substring(0, lastValidPos)
        }

        // 闭合未完成的括号
        while (openBrackets > 0) { jsonStr += ']'; openBrackets-- }
        while (openBraces > 0) { jsonStr += '}'; openBraces-- }
      }

      // 移除尾随逗号和修复缺失的引号
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
      jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')

      return jsonStr
    }

    // 先尝试修复 JSON（预防性修复）
    let fixedJsonStr = fixJsonIssues(jsonStr)

    let parsed
    try {
      parsed = JSON.parse(fixedJsonStr)
    } catch (e: any) {
      console.error("JSON parse error:", e.message)
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const fixedMatch = fixJsonIssues(match[0])
          parsed = JSON.parse(fixedMatch)
        } catch {
          throw new Error("AI 返回格式错误")
        }
      } else {
        throw new Error("AI 返回格式错误")
      }
    }

    // 清理解析结果中的重复标识符
    const cleanedQuestions = cleanParsedQuestions(parsed.questions || [])

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

    // 生成试卷 ID
    const examId = `exam-${Date.now()}`

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

    // 临时存储（用于演示）
    const examData = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject: parsed.detectedSubject || subject,  // 优先使用AI识别的科目
      examType,  // 保存配置文件中的类型 ID
      totalScore,
      content,
      questions: cleanedQuestions,
      createdAt: chinaTime,  // 使用中国时区时间
      metadata: {
        detectedSubject: parsed.detectedSubject,
        overallDifficulty: parsed.overallDifficulty || Math.round(avgDifficulty),
        estimatedTime: parsed.estimatedTime || cleanedQuestions.length * 5,
        knowledgePointsSummary: parsed.knowledgePointsSummary || [],
        questionTypeStats,
      },
    }

    if (typeof global !== "undefined") {
      (global as any).examCache = (global as any).examCache || {}
      ;(global as any).examCache[examId] = examData
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${examType}${parsed.detectedSubject || subject}试卷`,
      questionCount: parsed.questions?.length || 0,
      questions: cleanedQuestions,
      // 包含完整数据供前端存储
      examData,
    })
  } catch (error: any) {
    console.error("Exam parse error:", error)

    // 提供更详细的错误信息
    let errorMessage = "试卷解析失败"
    let errorDetails = ""

    if (error.message?.includes("API_KEY") || error.message?.includes("not set")) {
      errorMessage = "未配置 AI API 密钥，请检查 .env 文件中的 AI API 密钥配置"
    } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
      errorMessage = "网络连接失败，请检查网络"
    } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
      errorMessage = "AI 返回格式错误，无法解析为 JSON"
      if (error.message) {
        const shortError = error.message.substring(0, 200)
        errorDetails = shortError + (error.message.length > 200 ? "..." : "")
      }
    } else if (error.message) {
      errorMessage = "解析失败"
      errorDetails = error.message.substring(0, 300)
    }

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
