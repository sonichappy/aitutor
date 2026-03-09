import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { saveExamData, saveExamImage } from "@/lib/storage"
import { cleanParsedQuestions } from "@/lib/image-utils"
import { matchSubjectToIntelligent } from "@/lib/subject-utils"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

// 从试卷内容推断学科
function inferSubjectFromContent(parsed: any): string {
  const rawText = (parsed.rawText || "").toLowerCase()
  const questions = parsed.questions || []

  // 统计各学科特征关键词出现次数
  const scores: Record<string, number> = {
    "英语": 0,
    "语文": 0,
    "数学": 0,
    "物理": 0,
    "化学": 0,
    "生物": 0,
    "历史": 0,
    "地理": 0,
    "政治": 0,
  }

  // 英语关键词
  const englishKeywords = [
    // 英文字母和单词模式
    /\b[a-zA-Z]{3,}\b/g,  // 3个或以上连续英文字母
    // 常见英语词汇
    "fox", "giraffe", "eagle", "wolf", "penguin", "shark", "whale", "snake",
    "the", "and", "is", "are", "was", "were", "have", "has", "had",
    // 英语题型提示
    "vocabulary", "word", "dictation", "translate", "fill in", "blank",
    // 英文标点
    ".", ",", "?", "!"
  ]

  // 检查英文字母模式
  const englishMatches = rawText.match(/[a-zA-Z]{3,}/g)
  if (englishMatches && englishMatches.length > 5) {
    scores["英语"] += englishMatches.length * 2  // 权重较高
  }

  // 检查英语关键词
  englishKeywords.slice(2).forEach((kw: string | RegExp) => {
    if (typeof kw === 'string' && rawText.includes(kw.toLowerCase())) {
      scores["英语"] += 3
    }
  })

  // 检查题目格式是否像英语听写（中文词+英文答案）
  let dictationStyleCount = 0
  questions.forEach((q: any) => {
    if (q.prompt && q.student_answer) {
      // 有中文提示和英文答案，很可能是英语听写
      if (/[\u4e00-\u9fa5]/.test(q.prompt) && /[a-zA-Z]/.test(q.student_answer)) {
        dictationStyleCount++
      }
    }
  })
  if (dictationStyleCount > 3) {
    scores["英语"] += dictationStyleCount * 5  // 高权重
  }

  // 数学关键词
  const mathKeywords = ["方程", "函数", "几何", "代数", "三角形", "圆", "计算", "求解", "证明", "角度"]
  mathKeywords.forEach(kw => {
    if (rawText.includes(kw)) scores["数学"] += 2
  })

  // 语文关键词
  const chineseKeywords = ["作文", "阅读", "拼音", "汉字", "造句", "古诗", "诗词", "文言文"]
  chineseKeywords.forEach(kw => {
    if (rawText.includes(kw)) scores["语文"] += 2
  })

  // 物理关键词
  const physicsKeywords = ["力", "速度", "加速度", "电路", "电流", "电压", "功率", "能量"]
  physicsKeywords.forEach(kw => {
    if (rawText.includes(kw)) scores["物理"] += 2
  })

  // 化学关键词
  const chemistryKeywords = ["化学方程式", "元素", "原子", "分子", "离子", "酸", "碱", "盐"]
  chemistryKeywords.forEach(kw => {
    if (rawText.includes(kw)) scores["化学"] += 2
  })

  // 找出得分最高的学科
  let maxScore = 0
  let inferredSubject = "数学"  // 默认值

  for (const [subject, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      inferredSubject = subject
    }
  }

  console.log(`[inferSubjectFromContent] Scores:`, scores)

  // 如果英语分数明显高于其他学科，返回英语
  if (scores["英语"] > 0 && scores["英语"] > (scores["数学"] || 0)) {
    return "英语"
  }

  return inferredSubject
}

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
    const customPrompt = formData.get("customPrompt") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 1. 将图片转换为 base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = `data:${file.type};base64,${buffer.toString("base64")}`

    // 2. 准备提示词
    const defaultPrompt = `请仔细分析这张试卷图片，完成以下任务：

1. **试卷类型判断**：首先判断试卷类型
   - 如果是语文作文或英语作文，isEssay 设为 true
   - 如果是词汇听写/默写类试卷，题型标记为 "dictation"
   - 如果是普通练习试卷，按常规处理

2. **科目识别**：根据试卷内容识别科目（数学、语文、英语、物理、化学、生物、历史、地理、道法、政治等）
   - **注意**：如果看到英语单词、中文词汇对照，这通常是英语词汇试卷，detectedSubject 应设为 "英语"

3. **词汇听写试卷特殊处理**（如果是词汇/听写类）：
   - 题型 type 设为 "dictation"
   - content 字段填写题目要求（如"狐狸"）或词汇中文
   - userAnswer 字段填写学生答案（如"fox n."）
   - 正确答案 correctAnswer 字段可以省略或填写标准答案

4. **作文试卷特殊处理**（如果是作文）：
   - 提取作文题目/提示语
   - 完整识别学生手写的作文内容，保留段落结构
   - 识别作文的体裁和预估字数

5. **普通试卷处理**（如果不是作文或词汇）：
   - 版面分析：识别试卷的整体布局，找出所有题目
   - 逐题定位：为每道题目确定精确的边界框位置
   - 题目提取：提取每道题的文字内容
   - 难度评估：评估试卷整体难度（1-5）

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "detectedSubject": "识别的科目名称（数学/语文/英语/物理等）",
  "overallDifficulty": 整体难度(1-5),
  "estimatedTime": 预估完成时间(分钟),
  "knowledgePointsSummary": ["主要知识点1", "主要知识点2"],
  "rawText": "OCR识别的完整文本内容",
  "isEssay": false,
  "questions": [
    {
      "number": "题号（字符串格式）",
      "type": "题型(dictation/choice/fill/answer/calculation/essay)",
      "content": "题目内容或问题",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "score": 1,
      "difficulty": 1,
      "knowledgePoints": ["知识点1"],
      "userAnswer": "学生答案（如果有）"
    }
  ]
}

**词汇听写试卷要求：**
1. type 字段必须设为 "dictation"
2. content 字段填写题目内容（如中文词汇或题目要求）
3. userAnswer 字段填写学生写的答案
4. 题号使用字符串格式

**普通试卷重要要求：**
1. **CRITICAL: 必须识别图片中的每一道题目，不要遗漏任何题目**
2. **CRITICAL: 如果不同章节有相同的题号，必须都添加到 questions 数组，它们是不同的题目**
3. **CRITICAL: 绝对不要因为题号相同就覆盖前面的题目**
4. 题号必须使用字符串格式（"1" 而不是 1）
5. type 字段不能为空，必须是有效的题型值
6. content 字段不能为空，必须包含题目内容
7. detectedSubject 必须是具体的科目中文名称

**JSON格式严格要求：**
1. 所有字符串中的换行符必须转义为 \\n
2. 所有字符串中的引号必须转义为 \\" 或 \\'
3. 不要在JSON中使用注释（// 或 /* */）
4. 确保所有属性名都用双引号包围
5. 确保没有尾随逗号
6. 返回完整的、格式正确的JSON，不要截断

只返回JSON，不要有其他内容。`

    // 使用自定义提示词或默认提示词
    const finalPrompt = customPrompt?.trim() || defaultPrompt
    console.log(`[Parse Image] Using ${customPrompt?.trim() ? 'custom' : 'default'} prompt`)

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

**JSON格式严格要求**：
- 所有字符串中的换行符必须转义为 \\n
- 所有字符串中的特殊字符必须正确转义
- 不要在JSON中使用任何注释
- 确保返回完整有效的JSON，不要截断

你必须只返回有效的JSON格式，不要包含任何其他说明文字。`,
      },
      {
        role: "user",
        content: finalPrompt,
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

      // 如果 JSON 被截断，尝试修复
      if (openBraces > 0 || openBrackets > 0) {
        console.log(`[fixJsonIssues] Detected truncated JSON: braces=${openBraces}, brackets=${openBrackets}`)

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
          bbox: q.bbox || undefined,
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
        bbox: q.bbox || undefined,
      }
    })

    const cleanedQuestions = cleanParsedQuestions(questions)
    console.log('[Parse Image] Cleaned questions count:', cleanedQuestions.length, '(original:', questions.length, ')')

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
      console.log('[Parse Image] No subject detected by AI, inferring from content...')
      detectedSubject = inferSubjectFromContent(parsed)
      console.log(`[Parse Image] Inferred subject: "${detectedSubject}"`)
    }

    console.log(`[Parse Image] Final detected subject: "${detectedSubject}"`)

    // 构建题目上下文用于智能判断（如果是数学，需要判断是代数还是几何）
    const questionContext = parsed.rawText || JSON.stringify(parsed.questions?.slice(0, 3) || [])

    const { folderName, matchedSubject } = await matchSubjectToIntelligent(detectedSubject, questionContext)
    console.log(`[Parse Image] Matched to folder: "${folderName}", subject: ${matchedSubject?.name || 'N/A'}`)

    const examData = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject: folderName,  // 使用智能匹配后的文件夹名称
      subjectName: matchedSubject?.name || parsed.detectedSubject,  // 保存学科中文名称用于显示
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
        // 保存用户提供的自定义提示词
        customPrompt: customPrompt?.trim() || undefined,
      },
    }
    await saveExamData(examId, examData)

    // 保存图片到文件系统（必须在 saveExamData 之后，因为需要通过 examData 确定目录结构）
    await saveExamImage(examId, base64Image)

    // 返回给前端的数据（不包含大图片）
    const examDataForClient = {
      id: examId,
      userId: DEFAULT_USER_ID,
      subject: folderName,
      subjectName: matchedSubject?.name || parsed.detectedSubject,
      imageUrl: `/api/exam/${examId}/image`,  // 使用 API 获取图片
      rawText: parsed.rawText || "",
      questions: parsed.questions || [],
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${matchedSubject?.name || detectedSubject}试卷`,
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
