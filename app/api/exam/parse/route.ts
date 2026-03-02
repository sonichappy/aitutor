import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"

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
    const prompt = `请解析以下${subject}试卷内容，提取所有题目信息。

试卷类型：${examType}
总分：${totalScore}

试卷内容：
${content}

请按以下 JSON 格式返回解析结果：
{
  "title": "试卷标题",
  "questions": [
    {
      "number": 题号,
      "type": "题型(choice/fill/answer/calculation)",
      "content": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"], // 选择题才有
      "score": 分值,
      "difficulty": 难度(1-5),
      "knowledgePoints": ["知识点1", "知识点2"]
    }
  ]
}

注意：
1. 题号要准确识别（包括一、1、(1)等格式）
2. 选择题要提取选项
3. 填空题用____标识空位
4. 解答题可能有多个小题
5. 合理估算每题分值和难度
6. 识别题目涉及的知识点

只返回JSON，不要有其他内容。`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的试卷解析系统。你的任务是准确识别试卷中的所有题目信息，并按照指定的JSON格式返回。
你必须只返回有效的JSON格式，不要包含任何其他说明文字。`,
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.1, // 低温保证准确性
      maxTokens: 3000,
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
      // 如果解析失败，尝试提取 JSON
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error("AI 返回格式错误")
      }
    }

    // 生成试卷 ID（模拟数据库保存）
    const examId = `exam-${Date.now()}`

    // TODO: 保存到数据库
    // const exam = await prisma.exam.create({...})

    // 临时存储（用于演示）
    if (typeof global !== "undefined") {
      (global as any).examCache = (global as any).examCache || {}
      ;(global as any).examCache[examId] = {
        id: examId,
        userId: DEFAULT_USER_ID,
        subject,
        examType,
        totalScore,
        content,
        questions: parsed.questions || [],
        createdAt: new Date().toISOString(),
      }
    }

    return NextResponse.json({
      examId,
      title: parsed.title || `${examType}${subject}试卷`,
      questionCount: parsed.questions?.length || 0,
      questions: parsed.questions || [],
    })
  } catch (error) {
    console.error("Exam parse error:", error)
    return NextResponse.json(
      { error: "试卷解析失败，请检查内容格式" },
      { status: 500 }
    )
  }
}
