import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { cleanParsedQuestions } from "@/lib/image-utils"
import { saveExamData } from "@/lib/storage"
import { matchSubjectToIntelligent } from "@/lib/subject-utils"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

// 从试卷内容推断学科（文本版本）
function inferSubjectFromContentForText(parsed: any, content: string): string {
  const rawText = (content || parsed.rawText || "").toLowerCase()
  const questions = parsed.questions || []

  // 英语关键词检测
  const englishMatches = rawText.match(/[a-zA-Z]{3,}/g)
  let englishScore = 0

  if (englishMatches && englishMatches.length > 5) {
    englishScore += englishMatches.length * 2
  }

  // 检查英语听写格式（中文+英文答案）
  let dictationStyleCount = 0
  questions.forEach((q: any) => {
    if ((q.prompt && q.student_answer) || (q.content && q.userAnswer)) {
      const prompt = q.prompt || q.content || ""
      const answer = q.student_answer || q.userAnswer || ""
      if (/[\u4e00-\u9fa5]/.test(prompt) && /[a-zA-Z]/.test(answer)) {
        dictationStyleCount++
      }
    }
  })

  if (dictationStyleCount > 3) {
    englishScore += dictationStyleCount * 5
  }

  // 如果英语分数高，返回英语
  if (englishScore > 5) {
    return "英语"
  }

  // 默认返回数学
  return "数学"
}

export async function POST(request: NextRequest) {
  try {
    const { content, customPrompt } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 调用 AI 解析试卷
    const defaultPrompt = `请解析以下试卷内容，提取所有题目信息并识别试卷元数据。

试卷内容：
${content}

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称",
  "examType": "试卷类型ID（daily_homework=日常作业, unit_test=单元测试, midterm_exam=期中考试, final_exam=期末考试, mock_exam=模拟考试, tutoring=课外辅导, competition=竞赛练习, special_practice=专项练习, composition=作文）",
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
2. examType 识别试卷类型并返回对应的类型ID：daily_homework（日常作业）、unit_test（单元测试）、midterm_exam（期中考试）、final_exam（期末考试）、mock_exam（模拟考试）、tutoring（课外辅导）、competition（竞赛练习）、special_practice（专项练习）、composition（作文），默认值为 daily_homework
3. 题号要准确识别（包括一、1、(1)等格式）
4. **重要：不同章节的题目可能有相同的题号（如第一章第1题和第二章第1题），这是正常的，必须全部保留在 questions 数组中，不要去重或删除**
5. **按题目在试卷中出现的顺序添加到数组，即使题号重复也要保留**
6. 选择题要提取选项，选项内容不要包含 A. B. C. D. 前缀
7. 填空题用____标识空位
8. 解答题可能有多个小题
9. 合理估算每题分值和难度
10. overallDifficulty 根据题目复杂度综合评估
11. 识别主要知识点

只返回JSON，不要有其他内容。`

    // 使用自定义提示词或默认提示词
    const finalPrompt = customPrompt?.trim() || defaultPrompt
    console.log(`[Parse] Using ${customPrompt?.trim() ? 'custom' : 'default'} prompt`)

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
        content: finalPrompt,
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
      console.log(`[fixJsonIssues] Starting fix, input length: ${jsonStr.length}`)

      // 步骤1: 移除JavaScript注释（单行和多行）
      // 注意：必须在字符串检测之前做，避免误删字符串中的内容
      jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '')  // 移除 /* */ 注释
      jsonStr = jsonStr.replace(/\/\/.*$/gm, '')  // 移除 // 注释

      // 步骤2: 清理控制字符（除了必要的换行、制表符等）
      jsonStr = jsonStr.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

      // 步骤3: 处理字符串中的未转义换行符
      // 这是一个复杂的问题，需要智能处理
      // 策略：找到所有字符串字面量，确保其中的换行符被转义
      let inString = false
      let stringChar = ''
      let escapeNext = false
      let result = ''

      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i]
        const nextChar = jsonStr[i + 1] || ''

        if (escapeNext) {
          result += char
          escapeNext = false
          continue
        }

        if (char === '\\') {
          result += char
          escapeNext = true
          continue
        }

        if (!inString && (char === '"' || char === "'")) {
          inString = true
          stringChar = char
          result += char
          continue
        }

        if (inString && char === stringChar) {
          inString = false
          stringChar = ''
          result += char
          continue
        }

        if (inString) {
          // 在字符串内部，转义换行符和其他特殊字符
          if (char === '\n') {
            result += '\\n'
          } else if (char === '\r') {
            result += '\\r'
          } else if (char === '\t') {
            result += '\\t'
          } else {
            result += char
          }
        } else {
          result += char
        }
      }

      jsonStr = result

      // 步骤4: 移除尾随逗号
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

      // 步骤5: 修复缺失的引号（在属性名周围）
      // 只修复简单的字母数字属性名
      jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')

      // 步骤6: 处理可能的截断问题
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

      // 如果 JSON 被截断，尝试修复
      if (openBraces > 0 || openBrackets > 0) {
        console.log(`[fixJsonIssues] Detected truncated JSON: braces=${openBraces}, brackets=${openBrackets}`)

        // 从后向前找最后一个闭合的括号
        for (let i = jsonStr.length - 1; i >= 0; i--) {
          if (jsonStr[i] === '}' || jsonStr[i] === ']') {
            lastValidPos = i + 1
            break
          }
        }

        // 截断到最后一个有效位置
        if (lastValidPos < jsonStr.length) {
          console.log(`[fixJsonIssues] Truncating JSON to position ${lastValidPos}`)
          jsonStr = jsonStr.substring(0, lastValidPos)
        }

        // 闭合未完成的括号
        while (openBrackets > 0) { jsonStr += ']'; openBrackets-- }
        while (openBraces > 0) { jsonStr += '}'; openBraces-- }
      }

      console.log(`[fixJsonIssues] Fixed length: ${jsonStr.length}`)
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
    let questions = parsed.questions || []

    // 字段映射：处理AI可能返回的不同字段名
    questions = questions.map((q: any) => {
      // 处理词汇听写类型的题目
      if (q.prompt || q.student_answer) {
        return {
          number: String(q.number || q.index || ''),
          type: q.type || 'dictation',
          content: q.content || q.prompt || q.question || '',
          options: q.options || [],
          score: q.score || 1,
          difficulty: q.difficulty || 1,
          knowledgePoints: q.knowledgePoints || [],
          userAnswer: q.userAnswer || q.student_answer || '',
          correctAnswer: q.correctAnswer || q.answer || '',
        }
      }

      // 处理标准格式的题目
      return {
        number: String(q.number || ''),
        type: q.type || 'answer',
        content: q.content || q.question || q.prompt || '',
        options: q.options || [],
        score: q.score || 1,
        difficulty: q.difficulty || 1,
        knowledgePoints: q.knowledgePoints || [],
        userAnswer: q.userAnswer || '',
        correctAnswer: q.correctAnswer || q.answer || '',
      }
    })

    const cleanedQuestions = cleanParsedQuestions(questions)

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

    // 提取知识点汇总
    const knowledgePointsSummary = Array.from(
      new Set(
        cleanedQuestions
          .flatMap((q: any) => q.knowledgePoints || [])
      )
    )

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

    // 智能匹配学科
    // 首先尝试从AI响应中获取学科，如果没有则从内容推断
    let detectedSubject = parsed.detectedSubject

    if (!detectedSubject) {
      // AI没有返回学科，从内容推断
      console.log('[Parse] No subject detected by AI, inferring from content...')
      detectedSubject = inferSubjectFromContentForText(parsed, content)
      console.log(`[Parse] Inferred subject: "${detectedSubject}"`)
    }

    console.log(`[Parse] Final detected subject: "${detectedSubject}"`)

    // 构建题目上下文用于智能判断（如果是数学，需要判断是代数还是几何）
    const questionContext = content || JSON.stringify(parsed.questions?.slice(0, 3) || [])

    const { folderName, matchedSubject } = await matchSubjectToIntelligent(detectedSubject, questionContext)
    console.log(`[Parse] Matched to folder: "${folderName}", subject: ${matchedSubject?.name || 'N/A'}`)

    const examData = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject: folderName,  // 使用智能匹配后的文件夹名称
      subjectName: matchedSubject?.name || parsed.detectedSubject,  // 保存学科中文名称用于显示
      examType: parsed.examType || "daily_homework", // 默认为日常作业
      rawText: content,  // 使用 rawText 字段存储文本内容
      questions: cleanedQuestions,
      createdAt: chinaTime,  // 创建时间
      updatedAt: chinaTime,  // 更新时间
      testDate: chinaTime,  // 测试时间，默认与创建时间相同
      metadata: {
        detectedSubject: parsed.detectedSubject,
        overallDifficulty: parsed.overallDifficulty || Math.round(avgDifficulty),
        estimatedTime: parsed.estimatedTime || cleanedQuestions.length * 5,
        knowledgePointsSummary, // 使用从题目中提取的知识点汇总
        questionTypeStats,
        // 保存用户提供的自定义提示词
        customPrompt: customPrompt?.trim() || undefined,
      },
    }

    // 保存到文件系统
    await saveExamData(examId, examData)

    if (typeof global !== "undefined") {
      (global as any).examCache = (global as any).examCache || {}
      ;(global as any).examCache[examId] = examData
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${matchedSubject?.name || detectedSubject}试卷`,
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
