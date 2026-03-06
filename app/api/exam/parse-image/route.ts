import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function POST(request: NextRequest) {
  try {
    // 检查 AI 提供商是否支持图片
    const provider = process.env.AI_PROVIDER || "deepseek"
    if (provider === "deepseek") {
      return NextResponse.json(
        { error: "DeepSeek 暂不支持图片解析，请使用文本粘贴方式，或在 .env 中将 AI_PROVIDER 改为 openai" },
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
    const prompt = `请分析这张${subject}试卷图片，完成以下任务：

1. **OCR识别**：识别图片中的所有文字内容
2. **结构化解析**：提取所有题目信息
3. **版面分析**：识别题目布局、题号、题型等

试卷信息：
- 科目：${subject}
- 类型：${examType}
- 总分：${totalScore}

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "rawText": "OCR识别的完整文本内容",
  "questions": [
    {
      "number": 题号,
      "type": "题型(choice/fill/answer/calculation)",
      "content": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"], // 选择题才有
      "score": 分值,
      "difficulty": 难度(1-5),
      "knowledgePoints": ["知识点1", "知识点2"],
      "position": { // 位置信息（用于标记）
        "page": 页码,
        "region": "区域描述"
      }
    }
  ]
}

注意事项：
1. 仔细识别图片中的所有文字，包括手写内容
2. 题号要准确识别（包括一、1、(1)等格式）
3. 选择题要完整提取所有选项
4. 填空题用____标识空位
5. 解答题要识别题干和所有小题
6. 合理估算每题分值和难度
7. 识别题目涉及的知识点
8. 如果图片中有学生答案，请在 userAnswer 字段中记录

只返回JSON，不要有其他内容。`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的试卷OCR和解析系统。你的任务是：
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
      maxTokens: 4000,
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

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error("JSON parse error:", jsonStr)
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error("AI 返回格式错误")
      }
    }

    // 生成试卷 ID
    const examId = `exam-${Date.now()}`

    // 保存到临时存储
    if (typeof global !== "undefined") {
      (global as any).examCache = (global as any).examCache || {}
      ;(global as any).examCache[examId] = {
        id: examId,
        userId: DEFAULT_USER_ID,
        subject,
        examType,
        totalScore,
        imageUrl: base64Image,
        rawText: parsed.rawText || "",
        questions: parsed.questions || [],
        createdAt: new Date().toISOString(),
      }
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${examType}${subject}试卷`,
      questionCount: parsed.questions?.length || 0,
      questions: parsed.questions || [],
      rawText: parsed.rawText || "",
    })
  } catch (error: any) {
    console.error("Exam image parse error:", error)

    // 提供更详细的错误信息
    let errorMessage = "图片解析失败"
    if (error.message?.includes("API_KEY") || error.message?.includes("not set")) {
      errorMessage = "未配置 AI API 密钥，请检查 .env 文件中的 DEEPSEEK_API_KEY"
    } else if (error.message?.includes("fetch")) {
      errorMessage = "网络连接失败，请检查网络"
    } else if (error.message) {
      errorMessage = `解析失败: ${error.message}`
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
